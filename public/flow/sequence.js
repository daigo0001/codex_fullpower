const sequenceState = new WeakMap();

function html(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendLanes(doc, node, actors) {
  const lanes = html(doc, "div", "flow-seq-lanes");
  for (const actor of actors) {
    lanes.append(html(doc, "span", "flow-seq-lane", actor.laneLabel ?? actor.name));
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
  if (from === to) arrow.classList.add("flow-seq-arrow--local");
  else arrow.style.width = `${Math.abs(to - from)}%`;
  laneArea.append(arrow);
  return laneArea;
}

export function renderSequence(container, { actors, timeline, activeIndex, onSelect, actionLabel = "通信内容" }) {
  const doc = container.ownerDocument;
  let rendered = sequenceState.get(container);
  if (rendered?.actors !== actors || rendered.timeline !== timeline) {
    const focusedIndex = container.contains(doc.activeElement) ? doc.activeElement.dataset.stepIndex : undefined;
    const board = html(doc, "div", "flow-sequence");
    const header = html(doc, "div", "flow-sequence-header");
    header.setAttribute("aria-hidden", "true");
    header.append(html(doc, "span", "flow-seq-heading", "経過時間"));
    appendLanes(doc, header, actors);
    header.append(html(doc, "span", "flow-seq-heading flow-seq-heading--action", actionLabel));
    const list = html(doc, "ol", "flow-sequence-list");
    const rows = timeline.map((step, index) => {
      const item = html(doc, "li", "flow-sequence-item");
      const row = html(doc, "button", "flow-sequence-row");
      row.type = "button";
      row.dataset.stepIndex = String(index);
      row.dataset.protocol = step.category;
      const from = actors.find(({ id }) => id === step.from)?.name ?? step.from;
      const to = actors.find(({ id }) => id === step.to)?.name ?? step.to;
      const direction = step.from === step.to ? `${from}の内部処理` : `${from} から ${to}`;
      const annotation = step.annotation ? ` ${step.annotation}。` : "";
      row.setAttribute("aria-label", `${index + 1}。 ${step.title}。 ${direction}。${annotation} ${step.start} から ${step.end} ミリ秒。`);
      const time = html(doc, "span", "flow-seq-time", `${step.start}–${step.end}`);
      time.append(html(doc, "small", "", "ms"));
      const content = html(doc, "span", "flow-seq-content");
      content.append(html(doc, "strong", "flow-seq-title", step.title));
      const badge = step.annotation ? `${step.protocol} · ${step.annotation}` : step.protocol;
      content.append(html(doc, "span", "flow-protocol", badge));
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
