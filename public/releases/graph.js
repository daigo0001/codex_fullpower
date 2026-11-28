(() => {
  const lab = globalThis.ReleaseLab;
  const svgNS = "http://www.w3.org/2000/svg";
  const referenceKinds = { branch: "ブランチ", tag: "タグ", deployed: "本番稼働" };
  const graphLeft = 173;
  const columnGap = 105;
  const laneGap = 91;

  function element(document, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgElement(document, tag, attributes, text) {
    const node = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    if (text != null) node.textContent = text;
    return node;
  }

  function edge(source, target) {
    const { x, y } = source;
    const mid = (x + target.x) / 2;
    return y === target.y ? `M${x} ${y}H${target.x}` : `M${x} ${y}C${mid} ${y} ${mid} ${target.y} ${target.x} ${target.y}`;
  }

  function drawGraph(document, scenario, visible, refs, onSelect) {
    const laneIndex = new Map(scenario.lanes.map(({ id }, index) => [id, index]));
    const coordinates = new Map(visible.map(commit => [commit.id, {
      x: graphLeft + commit.column * columnGap,
      y: 53 + laneIndex.get(commit.lane) * laneGap,
    }]));
    const width = Math.max(480, Math.max(...[...coordinates.values()].map(point => point.x)) + 63);
    const height = 53 + (scenario.lanes.length - 1) * laneGap + 56;
    const graph = svgElement(document, "svg", {
      class: "gg-diagram", width, height, viewBox: `0 0 ${width} ${height}`,
      role: "group", "aria-label": `${scenario.label}のコミット履歴`,
    });
    const nodes = new Map();

    scenario.lanes.forEach(({ label }, index) => {
      const y = 53 + index * laneGap;
      graph.append(
        svgElement(document, "line", { class: "gg-track", x1: 14, y1: y, x2: width - 23, y2: y }),
        svgElement(document, "text", { class: "gg-lane-label", x: 16, y: y - 10 }, label),
      );
    });
    for (const commit of visible) {
      const target = coordinates.get(commit.id);
      commit.parents.forEach((id, index) => {
        graph.append(svgElement(document, "path", {
          class: index ? "gg-edge gg-merge-edge" : "gg-edge",
          d: edge(coordinates.get(id), target),
        }));
      });
      for (const [related, kind] of [[commit.replayOf, "replay"], [commit.revertOf, "revert"]]) {
        if (!related || !coordinates.has(related)) continue;
        const source = coordinates.get(related);
        const mid = (source.x + target.x) / 2;
        // Offset these relations so that a cherry-pick or a revert does not look like a parent.
        const arch = Math.max(7, Math.min(source.y, target.y) - 47);
        graph.append(svgElement(document, "path", {
          class: `gg-relation gg-relation-${kind}`,
          d: `M${source.x} ${source.y - 9}Q${mid} ${arch} ${target.x} ${target.y - 9}`,
        }));
      }
    }

    for (const commit of visible) {
      const { x, y } = coordinates.get(commit.id);
      const attached = refs.filter(ref => ref.commit === commit.id);
      const group = svgElement(document, "g", {
        class: `gg-commit gg-color-${laneIndex.get(commit.lane) % 4}`,
        role: "button", tabindex: 0, "aria-pressed": "false", "data-commit": commit.id,
        "aria-label": `${commit.sha} ${commit.title}`,
      });
      group.append(svgElement(document, "title", {}, `${commit.sha} · ${commit.title}`),
        svgElement(document, "circle", { class: "gg-hit", cx: x, cy: y, r: 20 }),
        svgElement(document, "circle", { class: "gg-dot", cx: x, cy: y, r: 8 }));
      if (attached.some(ref => ref.kind === "branch")) group.append(svgElement(document, "circle", { class: "gg-branch-mark", cx: x, cy: y, r: 12 }));
      if (attached.some(ref => ref.kind === "tag")) group.append(svgElement(document, "rect", { class: "gg-tag-mark", x: x + 15, y: y - 18, width: 8, height: 8, rx: 1 }));
      if (attached.some(ref => ref.kind === "deployed")) group.append(svgElement(document, "path", { class: "gg-prod-mark", d: `M${x + 20} ${y + 7}l5 5-5 5-5-5Z` }));
      group.append(svgElement(document, "text", { class: "gg-sha", x, y: y + 32, "text-anchor": "middle" }, commit.sha));
      group.addEventListener("click", () => onSelect(commit.id));
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(commit.id);
        }
      });
      graph.append(group);
      nodes.set(commit.id, group);
    }
    return { graph, nodes, coordinates };
  }

  function mountGraph(container) {
    const document = container.ownerDocument;
    container.innerHTML = `
      <div class="gg-cases" role="group" aria-label="Git グラフのケース"></div>
      <p class="gg-summary muted"></p>
      <div class="gg-toolbar">
        <div class="gg-current" aria-live="polite"><span class="gg-count"></span><h3 class="gg-step-title"></h3></div>
        <div class="actions">
          <button class="button secondary" type="button" data-gg-move="-1">前の手順</button>
          <button class="button primary" type="button" data-gg-move="1">次の手順</button>
        </div>
      </div>
      <div class="gg-viewport" tabindex="0" role="region" aria-label="Git グラフ。左から右に古い順。必要に応じて横にスクロール"></div>
      <p class="gg-scroll-hint muted">グラフを左右にスクロールすると、前後のコミットを確認できます。</p>
      <ul class="gg-legend" aria-label="記号の見方">
        <li><i class="gg-legend-parent" aria-hidden="true"></i>親から子へのつながり</li>
        <li><i class="gg-legend-branch" aria-hidden="true"></i>ブランチ先端</li>
        <li><i class="gg-legend-tag" aria-hidden="true"></i>タグ</li>
        <li><i class="gg-legend-prod" aria-hidden="true"></i>本番稼働</li>
        <li><i class="gg-legend-relation" aria-hidden="true"></i>差分の取り込み・取り消し元</li>
      </ul>
      <p class="gg-explanation"></p>
      <pre class="gg-command" hidden></pre>
      <div class="gg-information">
        <section class="lesson-card gg-refs" aria-labelledby="gg-refs-title"><h3 id="gg-refs-title">この手順の参照先</h3><ul></ul></section>
        <section class="lesson-card gg-inspector" aria-labelledby="gg-inspector-title">
          <h3 id="gg-inspector-title">コミットの詳細</h3><div class="gg-inspector-body"></div>
        </section>
      </div>
      <details class="gg-steps-list"><summary>手順を選ぶ</summary><ol></ol></details>
      <p class="callout gg-takeaway"></p>`;

    const find = selector => container.querySelector(selector);
    const choices = find(".gg-cases");
    const viewport = find(".gg-viewport");
    const refList = find(".gg-refs ul");
    const inspector = find(".gg-inspector-body");
    const command = find(".gg-command");
    const stepList = find(".gg-steps-list ol");
    const previous = find('[data-gg-move="-1"]');
    const next = find('[data-gg-move="1"]');
    const positions = new Map(lab.graphCases.map(scenario => [scenario.id, 0]));
    let scenario = lab.graphCases[0];
    let drawn;
    let visibleById;

    function selectCommit(id, { scroll = false } = {}) {
      const commit = visibleById.get(id);
      if (!commit) return;
      for (const [key, node] of drawn.nodes) node.setAttribute("aria-pressed", String(key === id));
      for (const button of refList.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.commit === id));
      const identity = element(document, "p", "gg-identity");
      identity.append(element(document, "code", "", commit.sha), " ", element(document, "strong", "", commit.title));
      const ancestors = element(document, "p", "gg-parents muted");
      const parentNames = commit.parents.map(parent => visibleById.get(parent).sha);
      ancestors.textContent = parentNames.length > 1 ? `第一親 ${parentNames[0]} ／ 第二親 ${parentNames[1]}` : parentNames.length ? `親 ${parentNames[0]}` : "図の起点";
      inspector.replaceChildren(identity, ancestors, element(document, "p", "", commit.description));
      if (commit.replayOf) inspector.append(element(document, "p", "gg-relation-note muted", `cherry-pick 元 ${visibleById.get(commit.replayOf).sha}`));
      if (commit.revertOf) inspector.append(element(document, "p", "gg-relation-note muted", `リバートの対象 ${visibleById.get(commit.revertOf).sha}`));
      if (scroll) {
        const { x } = drawn.coordinates.get(id);
        viewport.scrollLeft = x < viewport.clientWidth - 40 ? 0 : x - viewport.clientWidth / 2;
      }
    }

    const caseButtons = lab.graphCases.map(item => {
      const button = element(document, "button", "button secondary", item.label);
      button.type = "button";
      button.dataset.graphCase = item.id;
      button.addEventListener("click", () => {
        scenario = item;
        render();
      });
      choices.append(button);
      return button;
    });

    function moveTo(index) {
      positions.set(scenario.id, index);
      render();
    }

    function render() {
      const index = positions.get(scenario.id);
      const step = scenario.steps[index];
      const visibleSet = new Set(step.visible);
      const visible = scenario.commits.filter(commit => visibleSet.has(commit.id));
      visibleById = new Map(visible.map(commit => [commit.id, commit]));

      for (const button of caseButtons) button.setAttribute("aria-pressed", String(button.dataset.graphCase === scenario.id));
      find(".gg-summary").textContent = scenario.summary;
      find(".gg-count").textContent = `${index + 1} / ${scenario.steps.length} 手順`;
      find(".gg-step-title").textContent = step.title;
      find(".gg-explanation").textContent = step.description;
      find(".gg-takeaway").textContent = scenario.takeaway;
      command.textContent = step.command ?? "";
      command.hidden = !step.command;
      previous.disabled = index === 0;
      next.disabled = index === scenario.steps.length - 1;

      drawn = drawGraph(document, scenario, visible, step.refs, selectCommit);
      viewport.replaceChildren(drawn.graph);
      refList.replaceChildren(...step.refs.map(ref => {
        const item = element(document, "li", "");
        const button = element(document, "button", `gg-ref-button gg-ref-${ref.kind}`);
        button.type = "button";
        button.dataset.commit = ref.commit;
        button.append(element(document, "span", "gg-ref-kind", referenceKinds[ref.kind]),
          element(document, "span", "", ref.label), element(document, "code", "", visibleById.get(ref.commit).sha));
        button.addEventListener("click", () => selectCommit(ref.commit, { scroll: true }));
        item.append(button);
        return item;
      }));
      stepList.replaceChildren(...scenario.steps.map((item, position) => {
        const row = element(document, "li", "");
        const button = element(document, "button", "button secondary", item.title);
        button.type = "button";
        if (position === index) button.setAttribute("aria-current", "step");
        button.addEventListener("click", () => {
          moveTo(position);
          stepList.querySelector('[aria-current="step"]').focus();
        });
        row.append(button);
        return row;
      }));
      selectCommit(step.focus, { scroll: true });
    }

    previous.addEventListener("click", () => moveTo(positions.get(scenario.id) - 1));
    next.addEventListener("click", () => moveTo(positions.get(scenario.id) + 1));
    render();
  }

  lab.mountGraph = mountGraph;
})();
