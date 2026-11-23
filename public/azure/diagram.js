const svgNamespace = "http://www.w3.org/2000/svg";
const instances = new WeakMap();
let nextMarker = 0;

const layouts = {
  ingress: {
    desktop: [[16, 59], [50, 59], [83, 59]],
    mobile: [[25, 34], [75, 34], [75, 76]],
    zones: [
      ["インターネット", [3, 12, 26, 78], [3, 7, 44, 47]],
      ["Azure VNet", [34, 12, 63, 78], [52, 7, 45, 88], "tenant"],
    ],
  },
  egress: {
    desktop: [[16, 59], [50, 59], [83, 59]],
    mobile: [[25, 34], [75, 34], [75, 76]],
    zones: [
      ["Azure VNet · 送信元サブネット", [3, 12, 63, 78], [3, 7, 94, 47], "tenant"],
      ["インターネット", [70, 12, 27, 78], [52, 57, 45, 38]],
    ],
  },
  private: {
    desktop: [[17, 72], [35, 25], [50, 72], [83, 72]],
    mobile: [[25, 34], [75, 34], [25, 76], [75, 76]],
    zones: [
      ["Azure VNet", [3, 46, 61, 49], [3, 7, 44, 88], "tenant"],
      ["Azure の名前解決", [22, 3, 26, 40], [52, 7, 45, 47], "dns"],
      ["Azure 管理サービス", [70, 46, 27, 49], [52, 57, 45, 38]],
    ],
  },
  "dns-missing": {
    desktop: [[17, 72], [35, 25], [50, 72], [83, 72]],
    mobile: [[25, 34], [75, 34], [25, 76], [75, 76]],
    zones: [
      ["Azure VNet", [3, 46, 61, 49], [3, 7, 44, 88], "tenant"],
      ["Azure の名前解決", [22, 3, 26, 40], [52, 7, 45, 47], "dns"],
      ["Storage · 公開経路", [70, 46, 27, 49], [52, 57, 45, 38]],
    ],
  },
  hub: {
    desktop: [[16, 59], [50, 59], [83, 59]],
    mobile: [[25, 34], [75, 34], [75, 76]],
    zones: [
      ["Spoke A VNet", [3, 12, 26, 78], [3, 7, 44, 47], "tenant"],
      ["Hub VNet", [37, 12, 26, 78], [52, 7, 45, 47], "hub"],
      ["Spoke B VNet", [70, 12, 27, 78], [52, 57, 45, 38], "tenant"],
    ],
  },
};

const nodeRoles = {
  client: "外部の利用者",
  "app-gateway": "公開リスナー",
  "web-vm": "プライベート IP",
  vm: "ワークロード",
  "nat-gateway": "サブネットに関連付け",
  "public-service": "公開 API",
  dns: "DNS 応答",
  "private-endpoint": "VNet 内のプライベート IP",
  storage: "Blob 保管",
  "spoke-a": "送信元 VM",
  firewall: "ハブの中継と制御",
  "spoke-b": "宛先 VM",
};
const icons = {
  client: "M4 5h16v11H4zM8 20h8m-4-4v4",
  "app-gateway": "M4 7h16M4 17h16m-4-14 4 4-4 4m-8 2-4 4 4 4",
  "web-vm": "M5 4h14v7H5zm0 9h14v7H5zM8 7.5h.1m-.1 9h.1",
  vm: "M5 4h14v7H5zm0 9h14v7H5zM8 7.5h.1m-.1 9h.1",
  "nat-gateway": "M4 7h16M4 17h16m-4-14 4 4-4 4m-8 2-4 4 4 4",
  "public-service": "M7 18a4 4 0 0 1-.4-8 5.6 5.6 0 0 1 10.7 1.5A3.3 3.3 0 0 1 18 18Z",
  dns: "M3.5 12h17M12 3.5v17M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17zM12 3.5c4 4.5 4 12.5 0 17m0-17c-4 4.5-4 12.5 0 17",
  "private-endpoint": "M4 13h8m0 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-5 0V7h13",
  storage: "M5 7v10c0 2 14 2 14 0V7M5 7c0-2.5 14-2.5 14 0S5 9.5 5 7Zm0 5c0 2 14 2 14 0",
  firewall: "M12 3l7 3v6c0 4-3 6-7 9-4-3-7-5-7-9V6l7-3Zm-3 9 2 2 4-4",
  "spoke-a": "M5 4h14v7H5zm0 9h14v7H5zM8 7.5h.1m-.1 9h.1",
  "spoke-b": "M5 4h14v7H5zm0 9h14v7H5zM8 7.5h.1m-.1 9h.1",
};
const phases = { forward: "往路", unwind: "戻り通信", "short-circuit": "ここで停止" };

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

function defaultLayout(count) {
  const columns = Array.from({ length: count }, (_, index) => [100 * (index + 0.5) / count, 58]);
  return { desktop: columns, mobile: columns, zones: [] };
}

function pointVariables(node, prefix, [x, y, width, height]) {
  node.style.setProperty(`--${prefix}-x`, `${x}%`);
  node.style.setProperty(`--${prefix}-y`, `${y}%`);
  if (width !== undefined) {
    node.style.setProperty(`--${prefix}-w`, `${width}%`);
    node.style.setProperty(`--${prefix}-h`, `${height}%`);
  }
}

// Attach connections to the measured card edges so labels can wrap naturally.
function bounds(node, origin) {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left - origin.left + rect.width / 2,
    y: rect.top - origin.top + rect.height / 2,
    w: rect.width,
    h: rect.height,
  };
}

function port(node, other) {
  const dx = other.x - node.x;
  const dy = other.y - node.y;
  const scale = Math.min((node.w / 2 + 4) / Math.abs(dx), (node.h / 2 + 4) / Math.abs(dy));
  return [node.x + dx * scale, node.y + dy * scale];
}

function pathFor(from, to) {
  if (from === to) {
    const x1 = from.x - 14;
    const x2 = from.x + 14;
    const y = from.y - from.h / 2 - 5;
    const top = Math.max(8, y - 28);
    return `M${x1} ${y} C${x1 - 10} ${top} ${x2 + 10} ${top} ${x2} ${y}`;
  }
  const start = port(from, to);
  const end = port(to, from);
  return `M${start.join(" ")} L${end.join(" ")}`;
}

function routeKey(from, to) {
  return [from, to].sort().join("/");
}

function drawArrows(view) {
  const { stage, wires, nodes, steps, activeIndex, motion, marker } = view;
  const rect = wires.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  wires.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  const doc = stage.ownerDocument;
  const positions = new Map([...nodes].map(([id, node]) => [id, bounds(node, rect)]));
  const completed = new Set(steps.slice(0, activeIndex).map(({ from, to }) => routeKey(from, to)));
  const routes = new Map();
  for (const { from, to } of steps) {
    if (from !== to && positions.has(from) && positions.has(to)) routes.set(routeKey(from, to), [from, to]);
  }

  const paths = [...routes].map(([key, [from, to]]) => svg(doc, "path", {
    d: pathFor(positions.get(from), positions.get(to)),
    class: completed.has(key) ? "azure-route azure-route--visited" : "azure-route",
  }));
  const active = steps[activeIndex];
  if (active && positions.has(active.from) && positions.has(active.to)) {
    const direction = pathFor(positions.get(active.from), positions.get(active.to));
    paths.push(svg(doc, "path", {
      d: direction,
      class: "azure-route-active",
      "marker-end": `url(#${marker.id})`,
    }));
    if (motion) {
      const pulse = svg(doc, "circle", { class: "azure-route-pulse", r: "3.5" });
      pulse.append(svg(doc, "animateMotion", { path: direction, dur: "0.72s", repeatCount: "indefinite" }));
      paths.push(pulse);
    }
  }
  wires.replaceChildren(marker.defs, ...paths);
}

function attachDiagram(container, actors, scenarioId) {
  const doc = container.ownerDocument;
  const layout = layouts[scenarioId] ?? defaultLayout(actors.length);
  const wrapper = html(doc, "figure", "azure-topology");
  wrapper.setAttribute("aria-label", "Azure の通信経路");
  const stage = html(doc, "div", "azure-topology-stage");
  for (const [name, desktop, mobile, kind] of layout.zones) {
    const zone = html(doc, "div", "azure-zone");
    if (kind) zone.dataset.kind = kind;
    zone.append(html(doc, "span", "azure-zone-title", name));
    pointVariables(zone, "desktop", desktop);
    pointVariables(zone, "mobile", mobile);
    stage.append(zone);
  }

  const wires = svg(doc, "svg", {
    class: "azure-topology-wires",
    "aria-hidden": "true",
    focusable: "false",
  });
  const defs = svg(doc, "defs", {});
  const id = `azure-arrow-${++nextMarker}`;
  const arrow = svg(doc, "marker", {
    id, viewBox: "0 0 10 10", refX: "8", refY: "5",
    markerWidth: "8", markerHeight: "7", markerUnits: "userSpaceOnUse", orient: "auto",
  });
  arrow.append(svg(doc, "path", { d: "M0 0 10 5 0 10 2.8 5Z", class: "azure-arrowhead" }));
  defs.append(arrow);
  stage.append(wires);

  const nodes = new Map();
  const list = html(doc, "ul", "azure-topology-nodes");
  list.setAttribute("aria-label", "経路上のサービス");
  actors.forEach((actor, index) => {
    const node = html(doc, "li", "azure-topology-node");
    node.dataset.actor = actor.id;
    pointVariables(node, "desktop", layout.desktop[index] ?? defaultLayout(actors.length).desktop[index]);
    pointVariables(node, "mobile", layout.mobile[index] ?? defaultLayout(actors.length).mobile[index]);
    node.title = actor.detail;
    const glyph = svg(doc, "svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" });
    glyph.append(svg(doc, "path", { d: icons[actor.id] ?? icons.vm }));
    const icon = html(doc, "span", "azure-node-icon");
    icon.append(glyph);
    const label = html(doc, "span", "azure-node-label");
    label.append(html(doc, "strong", "azure-node-name", actor.name));
    label.append(html(doc, "span", "azure-node-role", nodeRoles[actor.id] ?? ""));
    node.append(icon, label, html(doc, "span", "azure-node-status"));
    nodes.set(actor.id, node);
    list.append(node);
  });
  stage.append(list);

  const caption = html(doc, "figcaption", "azure-route-caption");
  const phase = html(doc, "span", "azure-route-phase");
  const description = html(doc, "span", "azure-route-description");
  caption.append(phase, description);
  wrapper.append(stage, caption);
  container.replaceChildren(wrapper);

  return { wrapper, stage, wires, roles: new Map(actors.map(({ id, name }) => [id, name])),
    nodes, marker: { id, defs }, phase, description, actors, scenarioId };
}

export function renderTopology(container, { actors, steps, activeIndex, motion = false, scenario }) {
  const scenarioId = scenario?.id ?? "";
  let view = instances.get(container);
  if (view?.actors !== actors || view.scenarioId !== scenarioId) {
    view?.observer?.disconnect();
    view = attachDiagram(container, actors, scenarioId);
    instances.set(container, view);
    if (typeof ResizeObserver !== "undefined") {
      view.observer = new ResizeObserver(() => drawArrows(view));
      view.observer.observe(view.stage);
    }
  }
  if (view.steps === steps && view.activeIndex === activeIndex && view.motion === motion) return;
  Object.assign(view, { steps, activeIndex, motion });

  const active = steps[activeIndex];
  const phase = active?.phase ?? "forward";
  view.wrapper.dataset.category = active?.category ?? "route";
  view.wrapper.dataset.phase = phase;
  for (const [id, node] of view.nodes) {
    const source = active?.from === id;
    const dest = active?.to === id;
    node.toggleAttribute("data-active", source || dest);
    const status = node.querySelector(".azure-node-status");
    status.textContent = source && dest ? "ここで判定" : source ? "送信元" : dest ? "宛先" : "";
    status.hidden = !status.textContent;
  }
  view.phase.textContent = phases[phase] ?? phases.forward;
  view.description.textContent = !active ? "" : active.from === active.to
    ? `${view.roles.get(active.from)} · ${active.protocol}`
    : `${view.roles.get(active.from)} → ${view.roles.get(active.to)}`;
  drawArrows(view);
}
