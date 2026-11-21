const svgNamespace = "http://www.w3.org/2000/svg";
const topologyState = new WeakMap();
const sequenceState = new WeakMap();
let nextDiagramId = 0;

const routes = [
  {
    from: "client",
    to: "dns",
    forward: "M160 177 C176 147 258 86 366 83",
    reverse: "M366 83 C258 86 176 147 160 177",
  },
  {
    from: "client",
    to: "edge",
    forward: "M292 226 H368",
    reverse: "M368 226 H292",
  },
  {
    from: "edge",
    to: "origin",
    forward: "M632 226 H708",
    reverse: "M708 226 H632",
  },
];

const nodeIcons = {
  client: ["M4 5.5h16v11H4z", "M9 20h6m-3-3.5V20", "M4 13.5h16"],
  dns: ["M4 7h16M4 17h16M12 3.5v17", "M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17Z", "M12 3.5c4 4.7 4 12.3 0 17m0-17c-4 4.7-4 12.3 0 17"],
  edge: ["M6.5 17.5a4 4 0 0 1-.3-8 6 6 0 0 1 11.3 1.5 3.3 3.3 0 0 1-.3 6.5Z", "M9.5 14h5m-1.6-1.6 1.6 1.6-1.6 1.6"],
  origin: ["M5 4h14v7H5zm0 9h14v7H5z", "M8 7.5h.01M8 16.5h.01", "M12 7.5h4m-4 9h4"],
};

const actorRoles = {
  client: "アクセス元",
  dns: "名前解決",
  edge: "キャッシュ・中継",
  origin: "ページ生成",
};

const laneLabels = {
  client: "ブラウザー",
  dns: "DNS",
  edge: "エッジ",
  origin: "オリジン",
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

function topologyIcon(doc, actor) {
  const icon = svg(doc, "svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  for (const path of nodeIcons[actor.id] ?? []) {
    icon.append(svg(doc, "path", { d: path }));
  }
  const surface = html(doc, "span", "flow-net-icon");
  surface.append(icon);
  return surface;
}

function connects(route, step) {
  return (route.from === step.from && route.to === step.to) ||
    (route.from === step.to && route.to === step.from);
}

function renderRoutes(doc, steps, activeIndex, markerId, motion) {
  const lines = svg(doc, "svg", {
    class: "flow-net-routes",
    viewBox: "0 0 1000 320",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
  });
  const defs = svg(doc, "defs", {});
  const arrow = svg(doc, "marker", {
    id: markerId,
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "14",
    markerHeight: "11",
    markerUnits: "userSpaceOnUse",
    orient: "auto",
  });
  arrow.append(svg(doc, "path", { d: "M0 0 L10 5 L0 10 L2 5 Z", class: "flow-net-arrow" }));
  defs.append(arrow);
  lines.append(defs);

  const completed = steps.slice(0, Math.max(0, activeIndex));
  const active = steps[activeIndex];
  for (const route of routes) {
    const reached = completed.some((step) => connects(route, step));
    lines.append(svg(doc, "path", {
      d: route.forward,
      class: reached ? "flow-net-link flow-net-link--visited" : "flow-net-link",
      "vector-effect": "non-scaling-stroke",
    }));
  }

  const route = active && routes.find((candidate) => connects(candidate, active));
  if (!route) return lines;
  const direction = active.from === route.from ? route.forward : route.reverse;
  lines.append(svg(doc, "path", {
    d: direction,
    class: "flow-net-active-link",
    "marker-end": `url(#${markerId})`,
    "vector-effect": "non-scaling-stroke",
  }));

  if (motion) {
    const packet = svg(doc, "circle", { r: "6", class: "flow-net-packet" });
    packet.append(svg(doc, "animateMotion", {
      path: direction,
      dur: "0.65s",
      repeatCount: "indefinite",
    }));
    lines.append(packet);
  }
  return lines;
}

export function renderTopology(container, { actors, steps, activeIndex, motion = false }) {
  const previous = topologyState.get(container);
  if (previous?.actors === actors && previous.steps === steps &&
      previous.activeIndex === activeIndex && previous.motion === motion) return;
  const markerId = previous?.markerId ?? `flow-arrow-${++nextDiagramId}`;
  topologyState.set(container, { actors, steps, activeIndex, motion, markerId });
  const doc = container.ownerDocument;
  const active = steps[activeIndex];
  const graph = html(doc, "div", "flow-topology");
  if (active) graph.dataset.protocol = active.category;

  const stage = html(doc, "div", "flow-net-stage");
  const available = new Set(steps.flatMap(({ from, to }) => [from, to]));
  stage.append(renderRoutes(doc, steps, activeIndex, markerId, motion));
  const nodes = html(doc, "ul", "flow-net-actors");
  nodes.setAttribute("aria-label", "通信に登場する機器");
  for (const actor of actors) {
    const node = html(doc, "li", "flow-net-node");
    node.dataset.actor = actor.id;
    const source = active?.from === actor.id;
    const target = active?.to === actor.id;
    if (!available.has(actor.id)) node.classList.add("flow-net-node--unused");
    if (source || target) node.classList.add("flow-net-node--active");
    const inner = html(doc, "div", "flow-net-node-content");
    inner.append(topologyIcon(doc, actor));
    const label = html(doc, "div", "flow-net-node-label");
    label.append(html(doc, "strong", "flow-net-node-name", actor.name));
    if (actorRoles[actor.id]) {
      label.append(html(doc, "span", "flow-net-node-detail", actorRoles[actor.id]));
    }
    if (actor.detail) node.title = actor.detail;
    inner.append(label);
    node.append(inner);
    const status = source ? "送信" : target ? "受信" : available.has(actor.id) ? "" : "未経由";
    if (status) node.append(html(doc, "span", "flow-net-badge", status));
    nodes.append(node);
  }
  stage.append(nodes);

  const caption = html(doc, "div", "flow-net-caption");
  if (active) {
    const from = actors.find(({ id }) => id === active.from)?.name ?? active.from;
    const to = actors.find(({ id }) => id === active.to)?.name ?? active.to;
    caption.append(html(doc, "span", "flow-protocol", active.protocol));
    caption.append(html(doc, "span", "flow-net-direction", `${from} → ${to}`));
  } else {
    caption.append(html(doc, "span", "flow-net-caption-empty", "ステップを選ぶと通信の向きが表示されます。"));
  }
  graph.append(stage, caption);
  container.replaceChildren(graph);
}

function appendLanes(doc, node, actors) {
  const lanes = html(doc, "div", "flow-seq-lanes");
  for (const actor of actors) {
    lanes.append(html(doc, "span", "flow-seq-lane", laneLabels[actor.id] ?? actor.name));
  }
  node.append(lanes);
}

function laneCenter(actors, actorId) {
  return 100 * (actors.findIndex(({ id }) => id === actorId) + 0.5) / actors.length;
}

function drawSequenceLink(doc, actors, step) {
  const laneArea = html(doc, "span", "flow-seq-track");
  laneArea.setAttribute("aria-hidden", "true");
  for (const actor of actors) {
    const line = html(doc, "span", "flow-seq-lifeline");
    line.style.left = `${laneCenter(actors, actor.id)}%`;
    laneArea.append(line);
  }
  const from = laneCenter(actors, step.from);
  const to = laneCenter(actors, step.to);
  const arrow = html(doc, "span", "flow-seq-arrow");
  if (from > to) arrow.classList.add("flow-seq-arrow--reverse");
  arrow.style.left = `${Math.min(from, to)}%`;
  arrow.style.width = `${Math.abs(to - from)}%`;
  laneArea.append(arrow);
  return laneArea;
}

export function renderSequence(container, { actors, timeline, activeIndex, onSelect }) {
  const doc = container.ownerDocument;
  let rendered = sequenceState.get(container);
  if (rendered?.actors !== actors || rendered.timeline !== timeline) {
    const focusedIndex = container.contains(doc.activeElement) ? doc.activeElement.dataset.stepIndex : undefined;
    const board = html(doc, "div", "flow-sequence");
    const header = html(doc, "div", "flow-sequence-header");
    header.setAttribute("aria-hidden", "true");
    header.append(html(doc, "span", "flow-seq-heading", "経過時間"));
    appendLanes(doc, header, actors);
    header.append(html(doc, "span", "flow-seq-heading flow-seq-heading--action", "通信内容"));
    const list = html(doc, "ol", "flow-sequence-list");
    const rows = timeline.map((step, index) => {
      const item = html(doc, "li", "flow-sequence-item");
      const row = html(doc, "button", "flow-sequence-row");
      row.type = "button";
      row.dataset.stepIndex = String(index);
      row.dataset.protocol = step.category;
      const from = actors.find(({ id }) => id === step.from)?.name ?? step.from;
      const to = actors.find(({ id }) => id === step.to)?.name ?? step.to;
      row.setAttribute("aria-label", `${index + 1}。 ${step.title}。 ${from} から ${to}。 ${step.start} から ${step.end} ミリ秒。`);
      const time = html(doc, "span", "flow-seq-time", `${step.start}–${step.end}`);
      time.append(html(doc, "small", "", "ms"));
      const content = html(doc, "span", "flow-seq-content");
      content.append(html(doc, "strong", "flow-seq-title", step.title));
      content.append(html(doc, "span", "flow-protocol", step.protocol));
      row.append(time, drawSequenceLink(doc, actors, step), content);
      row.addEventListener("click", () => sequenceState.get(container)?.onSelect?.(index));
      item.append(row);
      list.append(item);
      return row;
    });
    board.append(header, list);
    container.replaceChildren(board);
    rendered = { actors, timeline, rows, onSelect };
    sequenceState.set(container, rendered);
    if (focusedIndex !== undefined) rows[focusedIndex]?.focus({ preventScroll: true });
  }

  rendered.onSelect = onSelect;
  rendered.rows.forEach((row, index) => {
    row.setAttribute("aria-pressed", String(index === activeIndex));
  });
}
