const svgNamespace = "http://www.w3.org/2000/svg";
const topologyState = new WeakMap();
let nextDiagramId = 0;

// Actor centers use the same 1000×350 coordinate system as the SVG arrows.
const nodePositions = {
  client: [147, 101],
  middleware: [472, 101],
  routing: [805, 101],
  mvc: [472, 218],
  controller: [805, 218],
  view: [472, 305],
};

const routes = [
  { from: "client", to: "middleware", forward: "M283 101 H336", reverse: "M336 101 H283" },
  { from: "middleware", to: "routing", forward: "M608 101 H669", reverse: "M669 101 H608" },
  { from: "middleware", to: "mvc", forward: "M472 137 V182", reverse: "M472 182 V137" },
  { from: "mvc", to: "controller", forward: "M608 218 H669", reverse: "M669 218 H608" },
  { from: "mvc", to: "view", forward: "M472 253 V270", reverse: "M472 270 V253" },
];

const nodeRoles = {
  client: "HTTP の送信元",
  middleware: "前処理と戻り処理",
  routing: "エンドポイント選択",
  mvc: "フィルターとモデル処理",
  controller: "アクションを実行",
  view: "HTML を描画",
};

const nodeIcons = {
  client: "M4 5h16v11H4z M9 20h6 M12 16v4 M4 13h16",
  middleware: "m12 3 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5",
  routing: "M5 12h7m0 0V6h5m-5 6v6h5 M20 6a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Zm0 12a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z",
  mvc: "M9 4H4v16h5m6-16h5v16h-5 M8 12h8m-3-3 3 3-3 3",
  controller: "m9 6-6 6 6 6m6-12 6 6-6 6m-2-14-2 16",
  view: "M4 5h16v14H4z M4 9h16 M8 14h4m-4 2.8h7",
};

const phases = {
  forward: "往路",
  unwind: "戻り処理",
  "short-circuit": "短絡",
};

function html(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(doc, tag, attributes) {
  const node = doc.createElementNS(svgNamespace, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function connects(route, step) {
  return (route.from === step.from && route.to === step.to) ||
    (route.from === step.to && route.to === step.from);
}

function selfPath(actorId) {
  const [x, y] = nodePositions[actorId];
  return `M${x - 39} ${y - 33} C${x - 38} ${y - 70} ${x + 43} ${y - 70} ${x + 43} ${y - 35}`;
}

function drawRoutes(doc, steps, activeIndex, markerId, motion) {
  const diagram = svg(doc, "svg", {
    class: "mvc-diagram-arrows",
    viewBox: "0 0 1000 350",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
  });
  const defs = svg(doc, "defs", {});
  const marker = svg(doc, "marker", {
    id: markerId, viewBox: "0 0 10 10", refX: "9", refY: "5",
    markerWidth: "15", markerHeight: "13", markerUnits: "userSpaceOnUse", orient: "auto",
  });
  marker.append(svg(doc, "path", { d: "M0 0 10 5 0 10 2 5Z", class: "mvc-diagram-arrowhead" }));
  defs.append(marker);
  diagram.append(defs);

  const completed = steps.slice(0, activeIndex);
  const current = steps[activeIndex];
  for (const route of routes) {
    const className = ["mvc-diagram-line"];
    if (!steps.some((step) => connects(route, step))) className.push("mvc-diagram-line--unused");
    else if (completed.some((step) => connects(route, step))) className.push("mvc-diagram-line--visited");
    diagram.append(svg(doc, "path", {
      d: route.forward,
      class: className.join(" "),
      "vector-effect": "non-scaling-stroke",
    }));
  }

  if (!current) return diagram;
  const route = routes.find((item) => connects(item, current));
  const direction = current.from === current.to && nodePositions[current.from]
    ? selfPath(current.from)
    : route && (current.from === route.from ? route.forward : route.reverse);
  if (!direction) return diagram;

  diagram.append(svg(doc, "path", {
    d: direction,
    class: "mvc-diagram-active-line",
    "marker-end": `url(#${markerId})`,
    "vector-effect": "non-scaling-stroke",
  }));

  if (motion) {
    const pulse = svg(doc, "circle", { r: "5.5", class: "mvc-diagram-pulse" });
    pulse.append(svg(doc, "animateMotion", { path: direction, dur: "0.68s", repeatCount: "indefinite" }));
    diagram.append(pulse);
  }
  return diagram;
}

function createNode(doc, actor, active, available) {
  const [x, y] = nodePositions[actor.id];
  const node = html(doc, "li", "mvc-diagram-node");
  node.dataset.actor = actor.id;
  node.style.setProperty("--node-x", `${x / 10}%`);
  node.style.setProperty("--node-y", `${y / 3.5}%`);
  node.title = actor.detail;
  const sending = active?.from === actor.id;
  const receiving = active?.to === actor.id;
  const visited = available.has(actor.id);

  if (sending || receiving) node.classList.add("mvc-diagram-node--active");
  if (!visited) node.classList.add("mvc-diagram-node--unused");

  const icon = html(doc, "span", "mvc-diagram-icon");
  const glyph = svg(doc, "svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" });
  glyph.append(svg(doc, "path", { d: nodeIcons[actor.id] }));
  icon.append(glyph);

  const label = html(doc, "div", "mvc-diagram-node-label");
  label.append(
    html(doc, "strong", "mvc-diagram-node-name", actor.name),
    html(doc, "span", "mvc-diagram-node-role", nodeRoles[actor.id]),
  );
  node.append(icon, label);

  const status = sending && receiving ? "内部処理" : sending ? "起点" : receiving ? "到達" : !visited ? "未経由" : "";
  if (status) node.append(html(doc, "span", "mvc-diagram-node-status", status));
  return node;
}

export function renderTopology(container, { actors, steps, activeIndex, motion = false }) {
  const previous = topologyState.get(container);
  if (previous?.actors === actors && previous.steps === steps &&
      previous.activeIndex === activeIndex && previous.motion === motion) return;
  const markerId = previous?.markerId ?? `mvc-arrow-${++nextDiagramId}`;
  topologyState.set(container, { actors, steps, activeIndex, motion, markerId });

  const doc = container.ownerDocument;
  const active = steps[activeIndex];
  const graph = html(doc, "div", "mvc-diagram");
  graph.dataset.category = active?.category ?? "middleware";

  const stage = html(doc, "div", "mvc-diagram-stage");
  const appFrame = html(doc, "div", "mvc-diagram-frame mvc-diagram-frame--app");
  appFrame.append(html(doc, "span", "mvc-diagram-frame-label", "ASP.NET Core"));
  const mvcFrame = html(doc, "div", "mvc-diagram-frame mvc-diagram-frame--mvc");
  mvcFrame.append(html(doc, "span", "mvc-diagram-frame-label", "MVC の内側"));
  stage.append(appFrame, mvcFrame, drawRoutes(doc, steps, activeIndex, markerId, motion));

  const nodes = html(doc, "ul", "mvc-diagram-nodes");
  nodes.setAttribute("aria-label", "リクエストの処理経路");
  const available = new Set(steps.flatMap(({ from, to }) => [from, to]));
  for (const actor of actors) {
    if (nodePositions[actor.id]) nodes.append(createNode(doc, actor, active, available));
  }
  stage.append(nodes);
  graph.append(stage);

  if (active) {
    const from = actors.find(({ id }) => id === active.from)?.name ?? active.from;
    const to = actors.find(({ id }) => id === active.to)?.name ?? active.to;
    const caption = html(doc, "div", "mvc-diagram-caption");
    const phase = html(doc, "span", "mvc-diagram-phase", phases[active.phase] ?? phases.forward);
    phase.dataset.phase = active.phase ?? "forward";
    caption.append(
      phase,
      html(doc, "span", "mvc-diagram-direction", from === to ? `${from}内の処理` : `${from} → ${to}`),
    );
    graph.append(caption);
  }
  container.replaceChildren(graph);
}
