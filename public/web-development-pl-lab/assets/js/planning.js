(() => {
  "use strict";

  const lab = globalThis.PLLab;
  const labels = {
    kind: { group: "グループ", work: "作業", review: "レビュー", wait: "回答待ち", buffer: "バッファ", milestone: "マイルストーン" },
    status: { todo: "未着手", doing: "進行中", blocked: "保留", done: "完了" },
    priority: { high: "高", medium: "中", low: "低" },
  };
  const phaseOptions = ["要件", "設計", "実装", "テスト", "リリース", "運用", "管理"];
  const modes = ["sample", "final"];
  const descriptions = {
    "06": "成果物を起点に、担当を決めて合否を判定できる大きさまで分解します。",
    "07": "根拠のある見積もりを作り、工数・日数・不確かさを分けて考えます。",
    "08": "先行関係、休み、担当負荷をカレンダーに置いて、納期と突き合わせます。",
  };
  const milestones = "対象機能が動く、受入が承認された、配備が終わったなど、確認すべき到達点。工数と期間は 0 として扱います。";
  const DAY = 86_400_000;
  const dateFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "UTC" });
  const hoursFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

  function isRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function answers(value) {
    if (!isRecord(value) || Object.keys(value).some((key) => !modes.includes(key))) throw new Error("計画演習の回答形式が正しくありません。");
    const normalized = {};
    for (const mode of modes) {
      if (!(mode in value)) continue;
      const attempt = value[mode];
      if (!isRecord(attempt) || !Number.isSafeInteger(attempt.edits) || attempt.edits < 0 || attempt.edits > 10_000 ||
          typeof attempt.note !== "string" || attempt.note.length > 2_000) throw new Error("計画演習の記録を読み込めません。");
      normalized[mode] = { edits: attempt.edits, note: attempt.note };
    }
    return normalized;
  }

  lab.validators ??= {};
  for (const id of ["06", "07", "08"]) lab.validators[id] = answers;

  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
    return node;
  }

  function panel(...children) {
    return h("section", { class: "panel pl-plan-panel stack" }, ...children);
  }

  function button(text, action, kind = "secondary") {
    return h("button", { type: "button", class: `button ${kind}`, onclick: action }, text);
  }

  function select(name, options, value) {
    const node = h("select", { name }, options.map(([key, text]) => h("option", { value: key }, text)));
    node.value = value ?? "";
    return node;
  }

  function field(caption, control, wide = false) {
    return h("label", { class: wide ? "pl-plan-wide" : "" }, caption, control);
  }

  function input(name, type, value, attrs = {}) {
    const control = h("input", { name, type, ...attrs });
    control.value = value ?? "";
    return control;
  }

  function textarea(name, value, attrs = {}) {
    const control = h("textarea", { name, rows: 2, ...attrs });
    control.value = value ?? "";
    return control;
  }

  function message(role = "status") {
    return h("p", { class: "pl-plan-message", role });
  }

  function display(target, text, error = false) {
    target.textContent = text;
    target.classList.toggle("pl-plan-error", error);
  }

  function formatHours(value) {
    return Number.isFinite(value) ? `${hoursFormat.format(value)} h` : "—";
  }

  function formatNumber(value) {
    return Number.isFinite(value) ? hoursFormat.format(value) : "—";
  }

  function dateOrdinal(day) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
    return Date.parse(day) / DAY;
  }

  function isoDay(value) {
    return new Date(value * DAY).toISOString().slice(0, 10);
  }

  function phaseText(phase) {
    return phase || "工程未設定";
  }

  function optionEntries(key) {
    return Object.entries(labels[key]);
  }

  function stateFor(ctx) {
    const model = lab.plan;
    const mode = modes.includes(ctx.state.planMode) ? ctx.state.planMode : "sample";
    ctx.state.plans ??= {};
    const plan = ctx.state.plans[mode] ?? model.defaultPlan(mode);
    const saved = ctx.state.answers?.[ctx.id] ?? {};
    const attempt = { ...(saved[mode] ?? { edits: 0, note: "" }) };

    function remember() {
      ctx.state.answers ??= {};
      ctx.state.answers[ctx.id] = { ...ctx.state.answers[ctx.id], [mode]: { ...attempt } };
      ctx.save();
    }

    function changePlan(next, countEdit = true) {
      const normalized = model.validatePlan(next);
      ctx.state.plans[mode] = normalized;
      if (countEdit) attempt.edits = Math.min(10_000, attempt.edits + 1);
      remember();
    }

    return { plan, mode, model, attempt, remember, changePlan };
  }

  function planChooser(ctx, state, rerender) {
    const modesBar = h("div", { class: "actions pl-plan-mode", role: "group", "aria-label": "編集する計画" });
    for (const [mode, label] of [["sample", "学習用の計画"], ["final", "最終演習の計画"]]) {
      const tab = button(label, () => {
        if (mode === state.mode) return;
        ctx.state.planMode = mode;
        ctx.save();
        rerender();
        ctx.root.querySelector('.pl-plan-mode [aria-pressed="true"]')?.focus();
      }, mode === state.mode ? "primary" : "secondary");
      tab.setAttribute("aria-pressed", String(mode === state.mode));
      modesBar.append(tab);
    }
    return h("div", { class: "pl-plan-context stack" },
      h("p", {}, descriptions[ctx.id]),
      modesBar,
      h("p", { class: "muted" }, "WBS・見積もり・日程は同じ計画を編集します。学習用と最終演習のデータは別々に保存されます。"),
    );
  }

  function confirmAction(root, title, text, action, callback) {
    const dialog = h("dialog", { class: "pl-plan-dialog pl-plan-confirm", "aria-label": title });
    const cancel = button("キャンセル", () => dialog.close());
    cancel.autofocus = true;
    dialog.append(h("div", { class: "stack" },
      h("h3", {}, title), h("p", {}, text),
      h("div", { class: "actions" }, cancel, button(action, () => {
        dialog.close();
        callback();
      }, "danger")),
    ));
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    root.append(dialog);
    dialog.showModal();
  }

  function activePlanExample(ctx, state, rerender) {
    const details = h("details", { class: "panel pl-plan-example" },
      h("summary", {}, "記入例を開く"),
      h("p", { class: "muted" }, "先に自分の案を記録すると、違いを比べやすくなります。ここで開く記入例は、比較のための一案です。"),
    );
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.ready) return;
      details.dataset.ready = "true";
      const sample = state.model.samplePlan(state.mode);
      const evaluation = state.model.analyzePlan(sample);
      function previewRows() {
        return evaluation.rows.slice(0, 8).map(({ task, wbs }) =>
          [wbs, task.title, task.deliverable || "—", task.done || "—"]);
      }
      const feedback = message("alert");
      details.append(
        ctx.table(["WBS", "タスク", "成果物", "完了条件"], previewRows(), "サンプル先頭のタスク"),
        h("div", { class: "actions" }, button("記入例を現在の計画に読み込む", () => {
          confirmAction(ctx.root, "計画を置き換えますか？",
            "現在の計画は記入例に置き換わります。手元の案を残す場合は JSON または CSV を先に保存してください。",
            "記入例に置き換える", () => {
              try {
                state.changePlan(sample, false);
                rerender();
              } catch (error) {
                display(feedback, error.message, true);
              }
            });
        })),
        feedback,
      );
    });
    return details;
  }

  function deleteTask(ctx, state, task, onSave, feedback) {
    const related = state.plan.tasks.find((item) => item.parentId === task.id || item.dependsOn.includes(task.id));
    if (related) {
      display(feedback, `「${related.title}」の親または先行タスクの設定を変更してから削除してください。`, true);
      return;
    }
    confirmAction(ctx.root, "タスクを削除しますか？", `「${task.title}」を現在の計画から削除します。`, "削除する", () => {
      try {
        state.changePlan({ ...state.plan, tasks: state.plan.tasks.filter((item) => item.id !== task.id) });
        onSave("タスクを削除しました。");
      } catch (error) {
        display(feedback, error.message, true);
      }
    });
  }

  function openTask(ctx, state, evaluation, task, onSave, initial = {}) {
    const value = task ?? { kind: "work", status: "todo", priority: "medium", progress: 0, dependsOn: [], ...initial };
    const dialog = h("dialog", { class: "pl-plan-dialog", "aria-label": task ? "タスクを編集" : "タスクを追加" });
    const form = h("form", { class: "stack" });
    const fields = h("div", { class: "field-grid pl-plan-fields" });
    const feedback = message("alert");
    const parents = [["", "最上位"], ...evaluation.rows.filter((row) => row.task.id !== task?.id && row.task.kind === "group")
      .map((row) => [row.task.id, `${row.wbs} ${row.task.title}`])];
    const options = [["", "未割当"], ...state.plan.people.map(({ id, name }) => [id, name])];
    const title = input("title", "text", value.title, { required: true, maxlength: "160", autofocus: true });
    const phase = input("phase", "text", value.phase, { list: "pl-phase-options", maxlength: "60", placeholder: "例：設計" });
    const kind = select("kind", optionEntries("kind"), value.kind);
    const datalist = h("datalist", { id: "pl-phase-options" }, phaseOptions.map((item) => h("option", { value: item })));

    fields.append(
      field("タスク名", title, true),
      field("親グループ", select("parentId", parents, value.parentId)),
      field("種類", kind),
      field("工程・カテゴリ", phase),
      field("担当者", select("assignee", options, value.assignee)),
      field("作業の説明", textarea("description", value.description, { maxlength: "1200" }), true),
      field("成果物", input("deliverable", "text", value.deliverable, { maxlength: "500", placeholder: "例：画面項目定義" }), true),
      field("完了条件", textarea("done", value.done, { maxlength: "900", placeholder: "例：入力・異常時のふるまいがレビュー済み" }), true),
      field("見積もり（時間）", input("estimate", "number", value.estimate, { min: "0", max: "100000", step: "any" })),
      field("実績（時間）", input("actual", "number", value.actual, { min: "0", max: "100000", step: "any" })),
      field("開始日", input("start", "date", value.start)),
      field("終了日", input("end", "date", value.end)),
      field("優先度", select("priority", optionEntries("priority"), value.priority)),
      field("状態", select("status", optionEntries("status"), value.status)),
      field("進捗（%）", input("progress", "number", value.progress, { min: "0", max: "100", step: "1", required: true })),
    );

    const depOptions = evaluation.rows.filter((row) => row.task.id !== task?.id && row.task.kind !== "group");
    const deps = h("fieldset", { class: "pl-plan-deps pl-plan-wide" }, h("legend", {}, "先行タスク（複数選択）"));
    if (depOptions.length) {
      const controls = depOptions.map(({ task: item, wbs }) => h("label", { class: "pl-plan-checkbox" },
        input("dependsOn", "checkbox", item.id, { checked: value.dependsOn.includes(item.id) }),
        h("span", {}, `${wbs} ${item.title}`)));
      deps.append(h("div", { class: "pl-plan-dep-options" }, controls));
    } else {
      deps.append(h("p", { class: "muted" }, "選べる先行タスクはありません。"));
    }
    fields.append(deps);

    form.append(
      h("div", { class: "pl-plan-head" },
        h("div", {}, h("h3", {}, task ? `タスクを編集 · ${task.id}` : "タスクを追加")),
        button("閉じる", () => dialog.close())),
      fields,
      datalist,
      h("p", { class: "muted" }, "グループは子の作業をまとめます。集計で二重計上しないため、工数・期間は作業側に置きます。"),
      feedback,
      h("div", { class: "actions pl-plan-form-actions" },
        task ? button("削除", () => deleteTask(ctx, state, task, (text) => {
          dialog.close();
          onSave(text);
        }, feedback), "danger") : null,
        button("キャンセル", () => dialog.close()),
        h("button", { type: "submit", class: "button primary" }, "保存する")),
    );

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const id = task?.id ?? state.model.nextTaskId(state.plan);
      const next = { ...value, ...Object.fromEntries(data.entries()), id, dependsOn: data.getAll("dependsOn") };
      if (next.kind === "group") {
        Object.assign(next, { estimate: null, actual: null, dependsOn: [], optimistic: null, likely: null, pessimistic: null, basis: "" });
      }
      try {
        const tasks = task ? state.plan.tasks.map((item) => item.id === id ? next : item) : [...state.plan.tasks, next];
        state.changePlan({ ...state.plan, tasks });
        dialog.close();
        onSave(`${id} を保存しました。`, id);
      } catch (error) {
        display(feedback, error.message, true);
      }
    });

    dialog.append(form);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    ctx.root.append(dialog);
    dialog.showModal();
  }

  function table(headers, rows, caption, className = "") {
    const doc = h("table", { class: `pl-plan-table ${className}`, "aria-label": caption });
    const head = h("thead", {}, h("tr", {}, headers.map((title) => h("th", { scope: "col" }, title))));
    const body = h("tbody", {}, rows.map((values) => h("tr", {}, values.map((value, index) =>
      h("td", { "data-label": headers[index] }, value)))));
    doc.append(head, body);
    return h("div", { class: "table-wrap pl-plan-table-wrap", tabindex: "0", role: "region", "aria-label": caption }, doc);
  }

  function notesPanel(ctx, state, structure) {
    const note = textarea("reflection", state.attempt.note, { maxlength: "2000", rows: 3, required: true });
    const status = message("status");
    const form = h("form", { class: "stack pl-plan-notes" },
      h("h3", {}, structure.title),
      h("p", { class: "muted" }, structure.prompt),
      field(structure.label, note, true),
      h("div", { class: "actions" }, h("button", { type: "submit", class: "button primary" }, "振り返りを保存")),
      status,
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = note.value.trim();
      if (!text) {
        display(status, "振り返りを記入してください。", true);
        return;
      }
      state.attempt.note = text;
      state.remember();
      const problem = structure.check();
      if (problem) {
        display(status, `振り返りを保存しました。${problem}`, true);
        return;
      }
      try {
        const artifact = state.mode === "final" ? `${structure.artifact}（最終演習）` : structure.artifact;
        ctx.recordArtifact(artifact, structure.output(text));
        ctx.complete();
        display(status, "振り返りと計画の要点を成果物に保存しました。");
      } catch (error) {
        display(status, error.message, true);
      }
    });
    return panel(form);
  }

  function md(text) {
    return String(text ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replace(/[\r\n]+/g, " ").replace(/[|\x60]/g, "\\$&");
  }

  function wbsView(ctx, text = "", restoreId = "") {
    const state = stateFor(ctx);
    const evaluation = state.model.analyzePlan(state.plan);
    const people = new Map(state.plan.people.map(({ id, name }) => [id, name]));
    const rerender = (notice, id) => wbsView(ctx, notice, id);
    const status = message();
    display(status, text);
    const rows = evaluation.rows.map((row) => {
      const { task } = row;
      const taskTitle = h("div", { class: "pl-plan-task" },
        h("code", { class: "pl-plan-code" }, row.wbs),
        h("div", {},
          h("div", { class: "pl-plan-task-title" }, h("strong", {}, task.title), h("span", { class: "badge" }, labels.kind[task.kind])),
          h("div", { class: "muted pl-plan-task-meta" }, `${task.id} · ${phaseText(task.phase)}`),
          task.description ? h("details", { class: "pl-plan-meta" }, h("summary", {}, "説明"), h("p", {}, task.description)) : null,
        ),
      );
      taskTitle.style.setProperty("--pl-plan-indent", Math.min(row.depth, 5));
      const taskWork = h("div", { class: "pl-plan-deliverable" }, task.deliverable || "—");
      if (task.done) taskWork.append(h("details", { class: "pl-plan-meta" }, h("summary", {}, "完了条件"), h("p", {}, task.done)));
      const stateCell = h("div", { class: "pl-plan-state" },
        h("span", { class: `pl-plan-status pl-plan-${task.status}` }, labels.status[task.status]),
        h("span", { class: "muted" }, `${task.progress}% · 優先：${labels.priority[task.priority]}`),
      );
      const effortCell = h("div", {}, formatHours(task.estimate), h("span", { class: "muted pl-plan-small" }, `実績 ${formatHours(task.actual)}`));
      const span = task.start || task.end ? `${task.start || "?"} ～ ${task.end || "?"}` : "—";
      const schedule = h("div", {}, span, task.dependsOn.length ? h("span", { class: "muted pl-plan-small" }, `先行：${task.dependsOn.join("、")}`) : null);
      const edit = button("編集", () => openTask(ctx, state, evaluation, task, rerender));
      edit.dataset.planEdit = task.id;
      edit.setAttribute("aria-label", `${task.title}を編集`);
      const actions = h("div", { class: "actions pl-plan-row-actions" }, edit);
      if (task.kind === "group") actions.append(button("子を追加", () => openTask(ctx, state, evaluation, null, rerender, { parentId: task.id, phase: task.phase })));
      return [taskTitle, taskWork, people.get(task.assignee) ?? "—", effortCell, schedule, stateCell, actions];
    });

    const guidance = panel(
      h("h3", {}, "波及範囲が分かるところまで分ける"),
      h("p", {}, "WBS は作業を階層に分けた一覧です。上位の成果物に必要な子を漏れなく置き、同じ作業を別の枝に重ねて書かないようにします。実装だけでなく、テスト・配備・運用の準備も入れます。"),
      h("div", { class: "pl-plan-decompose" },
        h("strong", {}, "画面設計"),
        h("span", { "aria-hidden": "true" }, "→"),
        h("p", {}, "画面一覧を作る → ワイヤーフレームを書く → 項目と入力ルールを定義する → レビューする → 指摘を反映する"),
      ),
      h("p", { class: "muted" }, "担当や完了判定を1つに絞れない作業は分解します。短い作業を無理に1日単位へそろえる必要はありません。グループを動かすと表示番号が変わりますが、先行関係には変わらないタスク ID を使います。"),
    );
    const workspace = panel(
      h("div", { class: "pl-plan-head" },
        h("div", {}, h("h3", {}, "WBS エディター"), h("p", { class: "muted" }, "成果物、完了条件、先行作業まで記録すると、レビューで作業の抜けを見つけやすくなります。")),
        h("div", { class: "actions" },
          button("タスクを追加", () => openTask(ctx, state, evaluation, null, rerender), "primary"),
          button("CSV 出力", () => ctx.download(`wbs-${state.mode}.csv`, state.model.exportCsv(state.plan), "text/csv;charset=utf-8")),
        ),
      ),
      h("div", { class: "pl-plan-metrics", "aria-label": "WBS 集計" },
        metric("タスク", `${evaluation.summary.taskCount} 件`),
        metric("完了", `${evaluation.summary.doneCount} 件`),
        metric("見積もり合計", formatHours(evaluation.summary.estimate)),
        metric("実績合計", formatHours(evaluation.summary.actual)),
      ),
      rows.length ? table(["タスク", "成果物・完了条件", "担当", "見積・実績", "日程・先行", "進捗", "操作"], rows, "階層別の WBS", "pl-plan-task-table") : h("p", { class: "muted" }, "「タスクを追加」から作業を登録します。"),
      status,
    );
    const review = notesPanel(ctx, state, {
      title: "分解した理由を残す",
      prompt: "分け直した作業を1つ選び、何を成果物として、何ができれば完了なのかを書きます。",
      label: "WBS を見直した理由",
      artifact: "WBS 分解と完了条件",
      check: () => {
        if (!state.attempt.edits) return "タスクを追加または編集して、自分の分解を試してください。";
        const leaf = evaluation.rows.filter((row) => row.task.kind !== "group" && row.task.deliverable && row.task.done);
        if (!leaf.length) return "作業に成果物と完了条件を入力してください。";
        return "";
      },
      output: (reflection) => [
        `### ${state.mode === "sample" ? "学習用" : "最終演習"}の WBS`,
        `振り返り：${md(reflection)}`,
        "| WBS | ID | タスク | 成果物 | 完了条件 |",
        "| --- | --- | --- | --- | --- |",
        ...evaluation.rows.slice(0, 40).map(({ wbs, task }) => `| ${md(wbs)} | ${md(task.id)} | ${md(task.title)} | ${md(task.deliverable.slice(0, 160))} | ${md(task.done.slice(0, 160))} |`),
        "",
        "抜粋です。すべての項目は WBS の CSV から確認できます。",
      ].join("\n"),
    });
    ctx.root.replaceChildren(planChooser(ctx, state, rerender), guidance, workspace, activePlanExample(ctx, state, rerender), review);
    if (restoreId) [...ctx.root.querySelectorAll("[data-plan-edit]")].find((edit) => edit.dataset.planEdit === restoreId)?.focus();
    else if (text) status.scrollIntoView({ block: "nearest" });
  }

  function metric(label, value) {
    return h("div", { class: "pl-plan-metric" }, h("span", { class: "muted" }, label), h("strong", {}, value));
  }

  function calcPert({ optimistic, likely, pessimistic }) {
    if (![optimistic, likely, pessimistic].every(Number.isFinite) ||
      optimistic < 0 || optimistic > likely || likely > pessimistic) return null;
    return { expected: (optimistic + 4 * likely + pessimistic) / 6, spread: (pessimistic - optimistic) / 6 };
  }

  function numeric(value) {
    return value === "" || value === null || value === undefined ? null : Number(value);
  }

  function openPert(ctx, state, row, rerender) {
    const task = row.task;
    const dialog = h("dialog", { class: "pl-plan-dialog", "aria-label": `${task.title}の見積もりを編集` });
    const form = h("form", { class: "stack" });
    const make = (name, label) => field(label, input(name, "number", task[name], { min: "0", max: "100000", step: "any", required: true }));
    const basis = textarea("basis", task.basis, { rows: "3", maxlength: "900", required: true, placeholder: "例：画面2項目の既存パターンを再利用し、競合時の確認を加える" });
    const calc = h("p", { class: "callout" });
    const feedback = message("alert");
    const use = input("apply", "checkbox", "yes");
    form.append(
      h("div", { class: "pl-plan-head" }, h("div", {}, h("h3", {}, `${row.wbs} ${task.title}`), h("p", { class: "muted" }, "O・M・P は担当者の作業時間でそろえます。")),
        button("閉じる", () => dialog.close())),
      h("div", { class: "field-grid pl-plan-fields" }, make("optimistic", "楽観 O（時間）"), make("likely", "最頻 M（時間）"), make("pessimistic", "悲観 P（時間）"), field("見積もりの根拠・想定リスク", basis, true)),
      calc,
      h("label", { class: "pl-plan-checkbox" }, use, h("span", {}, "期待値を見積工数にも反映する")),
      feedback,
      h("div", { class: "actions pl-plan-form-actions" }, button("キャンセル", () => dialog.close()), h("button", { type: "submit", class: "button primary" }, "保存する")),
    );

    function draft() {
      const data = new FormData(form);
      return {
        optimistic: numeric(data.get("optimistic")),
        likely: numeric(data.get("likely")),
        pessimistic: numeric(data.get("pessimistic")),
        basis: data.get("basis").trim(),
      };
    }

    function preview() {
      const values = draft();
      const result = calcPert(values);
      calc.textContent = result
        ? `(${values.optimistic} + 4 × ${values.likely} + ${values.pessimistic}) ÷ 6 = ${formatHours(result.expected)} ／ ばらつきの目安 ${formatHours(result.spread)}`
        : "0 ≦ 楽観 O ≦ 最頻 M ≦ 悲観 P になるように3つの値を入れます。";
    }

    form.addEventListener("input", preview);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = draft();
      const result = calcPert(values);
      if (!result || !values.basis) {
        display(feedback, "三点の順序と根拠を確認してください。", true);
        return;
      }
      try {
        const estimate = use.checked ? Math.round(result.expected * 100) / 100 : task.estimate;
        state.changePlan({ ...state.plan, tasks: state.plan.tasks.map((item) => item.id === task.id ? { ...task, ...values, estimate } : item) });
        dialog.close();
        rerender(`${task.id} の見積もりを保存しました。`, task.id);
      } catch (error) {
        display(feedback, error.message, true);
      }
    });

    dialog.append(form);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    ctx.root.append(dialog);
    preview();
    dialog.showModal();
  }

  function pertView(ctx, text = "", restoreId = "") {
    const state = stateFor(ctx);
    const evaluation = state.model.analyzePlan(state.plan);
    const rerender = (notice, id) => pertView(ctx, notice, id);
    const status = message();
    display(status, text);
    const possible = evaluation.rows.filter(({ task }) => ["work", "review"].includes(task.kind));
    const rows = possible.map((row) => {
      const { task } = row;
      const result = calcPert(task);
      const edit = button("三点を入力", () => openPert(ctx, state, row, rerender));
      edit.dataset.planPert = task.id;
      edit.setAttribute("aria-label", `${task.title}の三点見積もりを編集`);
      return [
        h("div", {}, h("code", { class: "pl-plan-code" }, row.wbs), " ", h("strong", {}, task.title)),
        `${formatNumber(task.optimistic)} / ${formatNumber(task.likely)} / ${formatNumber(task.pessimistic)}`,
        result ? h("div", {}, formatHours(result.expected), h("span", { class: "muted pl-plan-small" }, `σ ≈ ${formatHours(result.spread)}`)) : "—",
        formatHours(row.estimate),
        Number.isFinite(row.personDays) ? `${formatNumber(row.personDays)} 人日` : "—",
        task.basis || "—",
        edit,
      ];
    });

    const methods = [
      ["類推", "似た機能の実績を起点に、利用条件や処理量の違いを足し引きする。"],
      ["積み上げ", "WBS の小さな作業ごとに根拠を書き、レビューや試験も合算する。"],
      ["三点見積もり", "条件が良い・最もありそう・厳しいときの幅を数値にする。"],
      ["過去実績", "見積もりと実績の差を記録し、次の類似作業で補正する。"],
      ["リスクの見積もり", "誰が何を決めれば解消するかを決め、待ちや予備を別行で持つ。"],
    ];
    const guidance = panel(
      h("h3", {}, "見積もりの根拠を選ぶ"),
      h("div", { class: "pl-plan-methods" }, methods.map(([title, desc]) => h("div", {}, h("strong", {}, title), h("p", { class: "muted" }, desc)))),
      h("div", { class: "callout" },
        h("strong", {}, "期待工数 E = (O + 4M + P) ÷ 6"),
        h("p", {}, "たとえば 3・5・9 h なら E ≈ 5.33 h。ばらつきの目安 σ = (P − O) ÷ 6 ≈ 1 h。作業ごとの想定を明示するための手法で、この数値だけで納期や達成確率は決まりません。")),
      h("p", {}, "16 時間は 8 時間 × 2 人日の工数です。担当者の稼働率が 50% なら、1日4時間のため、同じ人で完了まで最短4営業日です。人数を増やしても、先行関係、引き継ぎ、顧客の確認待ちがあると期間は同じ比率では縮まりません。"),
      h("p", { class: "muted" }, "レビュー作業は担当者の工数、顧客の回答待ちは日程、予備は不確かさへの備えとして扱います。例の時間数は学習用です。"),
    );
    const workspace = panel(
      h("h3", {}, "作業ごとの見積もり"),
      h("p", { class: "muted" }, "三点見積もりは作業とレビューに記録できます。見積工数が未入力の場合は期待値を試算に使います。既存の工数を置き換えるときは、入力時に反映を選びます。"),
      rows.length ? table(["タスク", "O / M / P（h）", "期待値・ばらつき", "採用工数", "人日 (8 h)", "根拠", "操作"], rows, "三点見積もり", "pl-plan-pert-table")
        : h("p", {}, "作業がまだありません。WBS で作業またはレビューを追加します。"),
      h("div", { class: "actions" }, button("WBS を開く", () => ctx.go("06"))),
      status,
    );
    const review = notesPanel(ctx, state, {
      title: "採用する値と理由を決める",
      prompt: "どの実績や前提から見積もったか、悲観値が大きくなる要因は何かを書きます。",
      label: "見積もりの振り返り",
      artifact: "工数の見積もりと根拠",
      check: () => {
        if (!state.attempt.edits || !possible.some(({ task }) => calcPert(task) && task.basis)) {
          return "少なくとも1つの作業に三点見積もりと根拠を保存してください。";
        }
        return "";
      },
      output: (reflection) => [
        "### 採用する工数と前提",
        `振り返り：${md(reflection)}`,
        "| タスク | O / M / P (h) | E (h) | 採用工数 | 根拠 |",
        "| --- | --- | --- | --- | --- |",
        ...possible.filter(({ task }) => calcPert(task) && task.basis).slice(0, 40).map(({ task, estimate }) =>
          `| ${md(task.title)} | ${task.optimistic} / ${task.likely} / ${task.pessimistic} | ${formatNumber(calcPert(task).expected)} | ${formatHours(estimate)} | ${md(task.basis.slice(0, 160))} |`),
        "",
        "抜粋です。すべての項目は WBS の CSV から確認できます。",
      ].join("\n"),
    });
    ctx.root.replaceChildren(planChooser(ctx, state, rerender), guidance, workspace, activePlanExample(ctx, state, rerender), review);
    if (restoreId) [...ctx.root.querySelectorAll("[data-plan-pert]")].find((edit) => edit.dataset.planPert === restoreId)?.focus();
  }

  function parseDays(text) {
    return text.trim().split(/[\s,、]+/).filter(Boolean);
  }

  function calendarForm(ctx, state, rerender) {
    const plan = state.plan;
    const feedback = message("alert");
    const form = h("form", { class: "stack" },
      h("div", { class: "field-grid pl-plan-fields" },
        field("計画開始日", input("start", "date", plan.start, { required: true })),
        field("目標納期", input("deadline", "date", plan.deadline, { required: true })),
        field("進捗の基準日", input("asOf", "date", plan.asOf)),
        field("共通の休日（YYYY-MM-DD、1行1日）", textarea("holidays", plan.holidays.join("\n"), { placeholder: "2026-12-29\n2026-12-30" }), true),
      ),
      h("p", { class: "muted" }, "土日は共通の非稼働日です。祝日は案件で使う日付を追加し、個別の不在日は担当者ごとに設定します。"),
      h("div", { class: "actions" }, h("button", { type: "submit", class: "button primary" }, "カレンダーを保存")),
      feedback,
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        state.changePlan({ ...plan, start: data.get("start"), deadline: data.get("deadline"), asOf: data.get("asOf"), holidays: parseDays(data.get("holidays")) });
        rerender("計画日付と休日を保存しました。");
      } catch (error) {
        display(feedback, error.message, true);
      }
    });
    return panel(h("h3", {}, "カレンダーと目標納期"), form);
  }

  function personId(plan) {
    const used = new Set(plan.people.map(({ id }) => id));
    let count = 1;
    while (used.has(`person-${count}`)) count += 1;
    return `person-${count}`;
  }

  function openPerson(ctx, state, person, rerender) {
    const dialog = h("dialog", { class: "pl-plan-dialog pl-plan-person", "aria-label": person ? "担当者を編集" : "担当者を追加" });
    const form = h("form", { class: "stack" });
    const feedback = message("alert");
    form.append(
      h("h3", {}, person ? "担当者を編集" : "担当者を追加"),
      h("div", { class: "field-grid pl-plan-fields" },
        field("担当者名", input("name", "text", person?.name, { maxlength: "80", required: true, autofocus: true })),
        field("稼働率（%）", input("rate", "number", person?.rate ?? 100, { min: "0", max: "100", step: "any", required: true })),
        field("不在日（YYYY-MM-DD、1行1日）", textarea("absences", person?.absences.join("\n"), { placeholder: "2027-01-15" }), true),
      ),
      h("p", { class: "muted" }, "稼働率はこの案件に割ける割合です。基準8時間 × 50% なら1日4時間。個別の不在日は工数の配分から外れます。"),
      feedback,
      h("div", { class: "actions pl-plan-form-actions" },
        person ? button("削除", () => {
          const assigned = state.plan.tasks.find(({ assignee }) => assignee === person.id);
          if (assigned) {
            display(feedback, `「${assigned.title}」の担当を変更してから削除してください。`, true);
            return;
          }
          confirmAction(ctx.root, "担当者を削除しますか？", `「${person.name}」を担当者一覧から削除します。`, "削除する", () => {
            try {
              state.changePlan({ ...state.plan, people: state.plan.people.filter(({ id }) => id !== person.id) });
              dialog.close();
              rerender("担当者を削除しました。");
            } catch (error) {
              display(feedback, error.message, true);
            }
          });
        }, "danger") : null,
        button("キャンセル", () => dialog.close()),
        h("button", { type: "submit", class: "button primary" }, "担当者を保存"),
      ),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const next = { id: person?.id ?? personId(state.plan), name: data.get("name"), rate: data.get("rate"), absences: parseDays(data.get("absences")) };
      try {
        const people = person ? state.plan.people.map((item) => item.id === person.id ? next : item) : [...state.plan.people, next];
        state.changePlan({ ...state.plan, people });
        dialog.close();
        rerender("担当者の稼働率と不在日を保存しました。");
      } catch (error) {
        display(feedback, error.message, true);
      }
    });
    dialog.append(form);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    ctx.root.append(dialog);
    dialog.showModal();
  }

  function capacityPanel(ctx, state, evaluation, rerender) {
    const byPerson = new Map(state.plan.people.map(({ id }) => [id, { entries: 0, peak: 0, peakDate: "", total: 0, overloads: 0 }]));
    for (const entry of evaluation.workload) {
      const value = byPerson.get(entry.assignee);
      if (!value) continue;
      value.entries += 1;
      value.total += entry.hours;
      if (entry.hours > value.peak) {
        value.peak = entry.hours;
        value.peakDate = entry.date;
      }
      if (entry.overload) value.overloads += 1;
    }
    const rows = state.plan.people.map((person) => {
      const work = byPerson.get(person.id);
      return [
        person.name,
        `${formatNumber(person.rate)}% ／ ${formatHours(person.rate * 0.08)}/日`,
        person.absences.length ? h("details", { class: "pl-plan-meta" }, h("summary", {}, `${person.absences.length} 日`), person.absences.join("、")) : "—",
        work.entries ? `${formatHours(work.total)} ／ ${work.entries} 日` : "—",
        work.entries ? `${formatHours(work.peak)}（${work.peakDate}）` : "—",
        work.overloads ? h("span", { class: "pl-plan-error" }, `${work.overloads} 日`) : "0 日",
        button("編集", () => openPerson(ctx, state, person, rerender)),
      ];
    });
    const overloads = evaluation.workload.filter((item) => item.overload);
    const detail = overloads.length ? h("details", { class: "pl-plan-meta" },
      h("summary", {}, `稼働超過の明細（${overloads.length} 件）`),
      table(["日付", "担当者", "日別の予定工数", "稼働可能", "該当タスク"], overloads.slice(0, 20).map((entry) => [
        entry.date, entry.name, formatHours(entry.hours), formatHours(entry.capacity),
        entry.taskIds.map((id) => evaluation.byId[id]?.wbs ?? id).join("、"),
      ]), "稼働超過の明細"),
      overloads.length > 20 ? h("p", { class: "muted" }, "先頭20件を表示しています。日程・担当・工数を見直すと評価が更新されます。") : null,
    ) : null;
    return panel(
      h("div", { class: "pl-plan-head" },
        h("div", {}, h("h3", {}, "担当者と日別の負荷"), h("p", { class: "muted" }, "予定工数を勤務可能日に均等配分して、各日の作業可能時間と比べます。")),
        button("担当者を追加", () => openPerson(ctx, state, null, rerender)),
      ),
      rows.length ? table(["担当者", "稼働率・容量", "不在日", "総工数・作業日", "ピーク時の負荷", "超過日", "操作"], rows, "担当者ごとの作業負荷") : h("p", { class: "muted" }, "担当者を追加すると、タスクで担当を選べます。"),
      detail,
    );
  }

  function ganttPanel(ctx, state, evaluation, rerender) {
    const earliest = [state.plan.start, ...evaluation.rows.map((row) => row.start)].filter(Boolean).sort()[0] ?? "2026-12-01";
    const latest = [state.plan.deadline, ...evaluation.rows.map((row) => row.end)].filter(Boolean).sort().at(-1) ?? earliest;
    const firstDate = input("gantt-from", "date", earliest, { min: "2000-01-01", max: "2100-12-31" });
    const span = select("gantt-span", [["28", "4週間"], ["56", "8週間"], ["98", "14週間"]], "98");
    const graphic = h("div", { class: "pl-plan-gantt-scroll", tabindex: "0", role: "region", "aria-label": "日付別のガントチャート" });
    const period = h("span", { class: "muted pl-plan-period" });
    const holidaySet = new Set(state.plan.holidays);
    const draw = () => {
      const windowStart = dateOrdinal(firstDate.value);
      if (!Number.isFinite(windowStart) || !firstDate.checkValidity()) {
        period.textContent = "2000年から2100年までの日付を選んでください。";
        return;
      }
      const length = Number(span.value);
      const windowEnd = Math.min(windowStart + length - 1, dateOrdinal("2100-12-31"));
      const days = Array.from({ length: windowEnd - windowStart + 1 }, (_, index) => windowStart + index);
      period.textContent = `${isoDay(windowStart)} ～ ${isoDay(windowEnd)}`;
      const chart = h("div", { class: "pl-plan-gantt" });
      chart.style.setProperty("--pl-plan-days", days.length);
      const heading = h("div", { class: "pl-plan-gantt-head" }, h("div", { class: "pl-plan-gantt-label" }, "日程・タスク"));
      const daysRow = h("div", { class: "pl-plan-gantt-days" }, days.map((day) => {
        const date = isoDay(day);
        const weekDay = (day + 4) % 7;
        const isOff = weekDay === 0 || weekDay === 6 || holidaySet.has(date);
        const band = date === state.plan.deadline ? "pl-plan-deadline" : date === state.plan.asOf ? "pl-plan-asof" : "";
        const info = dateFormat.format(new Date(day * DAY));
        return h("div", { class: `pl-plan-day ${isOff ? "pl-plan-dayoff" : ""} ${band}`, title: `${info}${holidaySet.has(date) ? "・休日" : ""}` },
          date.slice(8, 10), date.slice(8, 10) === "01" ? h("small", {}, date.slice(5, 7) + "月") : null);
      }));
      heading.append(daysRow);
      chart.append(heading);
      for (const row of evaluation.rows) {
        const { task } = row;
        const realStart = dateOrdinal(row.start);
        const realEnd = dateOrdinal(row.end);
        const visibleStart = Math.max(windowStart, realStart);
        const visibleEnd = Math.min(windowEnd, realEnd);
        const track = h("div", { class: "pl-plan-gantt-track" });
        const name = button(`${row.wbs} ${task.title}`, () => openTask(ctx, state, evaluation, task, rerender));
        name.setAttribute("aria-label", `${task.title}の日程を編集`);
        name.dataset.planSchedule = task.id;
        const predecessors = task.dependsOn.map((id) => evaluation.byId[id]?.wbs ?? id);
        const leading = h("div", { class: "pl-plan-gantt-label" }, name,
          h("span", { class: "muted pl-plan-small" }, row.start && row.end ? `${row.start} ～ ${row.end}` : "日程未確定"),
          predecessors.length ? h("span", { class: "muted pl-plan-small" }, `先行：${predecessors.join("、")}`) : null);
        if (Number.isFinite(visibleStart) && Number.isFinite(visibleEnd) && visibleStart <= visibleEnd) {
          const bar = h("span", {
            class: `pl-plan-gantt-bar pl-plan-kind-${task.kind}${row.critical ? " pl-plan-critical" : ""}`,
            title: `${task.title}：${row.start} ～ ${row.end}${row.critical ? "（余裕0）" : ""}`,
            "aria-hidden": "true",
          }, task.kind === "milestone" ? "◆" : "");
          bar.style.setProperty("--pl-start", visibleStart - windowStart);
          bar.style.setProperty("--pl-span", visibleEnd - visibleStart + 1);
          track.append(bar);
        }
        const deadline = dateOrdinal(state.plan.deadline);
        if (deadline >= windowStart && deadline <= windowEnd) {
          const marker = h("span", { class: "pl-plan-deadline-marker", "aria-hidden": "true" });
          marker.style.setProperty("--pl-start", deadline - windowStart);
          track.append(marker);
        }
        chart.append(h("div", { class: "pl-plan-gantt-row" }, leading, track));
      }
      graphic.replaceChildren(chart);
    };

    function shift(direction) {
      const current = dateOrdinal(firstDate.value);
      if (!Number.isFinite(current)) return;
      const target = Math.min(dateOrdinal("2100-12-31"), Math.max(dateOrdinal("2000-01-01"), current + 28 * direction));
      firstDate.value = isoDay(target);
      draw();
    }

    firstDate.addEventListener("change", draw);
    span.addEventListener("change", draw);
    draw();
    return panel(
      h("h3", {}, "ガントチャート"),
      h("p", { class: "muted" }, `計画に含まれる日付：${earliest} ～ ${latest}。タスク名から日程を編集できます。チャートは暦日、作業期間の集計は営業日です。`),
      h("div", { class: "actions pl-plan-gantt-toolbar" },
        button("4週間前へ", () => shift(-1)), field("表示開始日", firstDate),
        field("表示幅", span), button("4週間後へ", () => shift(1)), period,
      ),
      h("div", { class: "pl-plan-legend", "aria-label": "ガントの凡例" },
        h("span", {}, "■ 作業"), h("span", {}, "■ レビュー"), h("span", {}, "■ 回答待ち"), h("span", {}, "■ バッファ"), h("span", {}, "◆ 到達点"), h("span", {}, "▏目標納期")),
      graphic,
    );
  }

  const issueNames = {
    overload: "稼働超過", overlap: "担当の重なり", predecessor: "先行関係", deadline: "納期超過",
    "test-short": "テスト期間", "missing-review": "顧客レビュー", "missing-key-work": "工程の不足",
    unscheduled: "日程未確定", nonworking: "休日を含む日程", baseline: "計画開始日の前", late: "予定日超過",
    absence: "不在・稼働日不足", "missing-owner": "担当未定", "missing-wait": "顧客回答待ち", "missing-buffer": "日程の予備",
  };

  function scheduleIssues(evaluation) {
    const issues = [...evaluation.issues];
    const plans = evaluation.rows.map(({ task }) => task);
    if (plans.some(({ kind }) => kind !== "group")) {
      if (!plans.some(({ kind }) => kind === "wait")) issues.push({ type: "missing-wait", severity: "info", message: "顧客の回答・承認待ちが発生する場合、期限と待ち期間を別タスクに記録します。" });
      if (!plans.some(({ kind }) => kind === "buffer")) issues.push({ type: "missing-buffer", severity: "info", message: "見積もりの不確かさに備え、予備期間をどこに置くかレビューします。" });
    }
    return issues;
  }

  function findingsPanel(evaluation) {
    const issues = scheduleIssues(evaluation);
    const entries = new Map();
    for (const entry of issues) {
      if (!entries.has(entry.type)) entries.set(entry.type, []);
      entries.get(entry.type).push(entry);
    }
    const sorted = [...entries].sort(([, first], [, second]) => Number(second[0].severity === "warning") - Number(first[0].severity === "warning"));
    return panel(
      h("h3", {}, "自動チェックと見直しの論点"),
      h("p", { class: "muted" }, "このチェックは入力済みの予定と工数に基づきます。工程名からの判定は目安です。顧客との合意や、すべての作業を網羅したことも確認します。"),
      sorted.length ? h("div", { class: "pl-plan-findings" }, sorted.map(([type, items]) => h("details", { class: "pl-plan-findings-group", open: items[0].severity === "warning" && ["predecessor", "deadline", "test-short", "missing-review", "missing-key-work"].includes(type) },
        h("summary", {}, h("strong", { class: items[0].severity === "warning" ? "pl-plan-error" : "" }, issueNames[type] ?? type), ` · ${items.length} 件`),
        h("ul", {}, items.slice(0, 8).map(({ message: text }) => h("li", {}, text))),
        items.length > 8 ? h("p", { class: "muted" }, "先頭8件を表示しています。") : null,
      ))) : h("p", { class: "callout callout-success" }, "入力された予定に自動チェックの指摘はありません。"),
    );
  }

  function scheduleView(ctx, text = "", restoreId = "") {
    const state = stateFor(ctx);
    const evaluation = state.model.analyzePlan(state.plan);
    const metrics = evaluation.summary;
    const rerender = (notice, id) => scheduleView(ctx, notice, id);
    const status = message();
    display(status, text);
    const path = metrics.criticalPath.map((id) => {
      const row = evaluation.byId[id];
      return row ? `${row.wbs} ${row.task.title}` : id;
    });
    const finishStatus = !metrics.finish || !state.plan.deadline || metrics.unscheduled
      ? "納期内に収まるか未確定です。"
      : metrics.finish <= state.plan.deadline ? "入力された終了日は目標納期の範囲内です。" : "入力された終了日は目標納期を超えています。";
    const guide = panel(
      h("h3", {}, "工程を並べてから日付を置く"),
      h("p", {}, "先に成果物の前提関係をつなぎ、担当の稼働日、顧客レビュー、外部の回答待ちを置きます。レビューそのものは作業、回答期限までの間は待ち行として分けます。"),
      h("p", {}, milestones),
      h("p", { class: "muted" }, "予定日を空にした作業は、入力済みの工数・先行関係・稼働率から日付を試算します。回答待ちやバッファは開始日・終了日を設定します。"),
      h("div", { class: "actions" },
        button("タスクを追加", () => openTask(ctx, state, evaluation, null, rerender), "primary"),
        button("WBS で編集", () => ctx.go("06")),
      ),
      status,
    );
    const overview = panel(
      h("h3", {}, "期限と到達点"),
      h("div", { class: "pl-plan-metrics" },
        metric("目標納期", state.plan.deadline || "—"),
        metric("終了日（予定のある作業）", metrics.finish || "—"),
        metric("納期超過のタスク", `${metrics.deadlineOverruns} 件`),
        metric("未確定タスク", `${metrics.unscheduled} 件`),
      ),
      h("p", { class: metrics.deadlineOverruns ? "callout callout-warning" : "callout" }, finishStatus),
      path.length ? h("details", { class: "pl-plan-meta" },
        h("summary", {}, `簡易クリティカルパス · ${metrics.criticalDays} 営業日`),
        h("p", {}, path.join(" → ")),
        h("p", { class: "muted" }, "依存関係と営業日日数だけを使った例です。固定日・担当者の競合・タスク間の空白は含めず、最長経路が複数あれば代表1本を表示します。"),
      ) : h("p", { class: "muted" }, "すべての作業に日程が付くと、依存関係から簡易クリティカルパスを表示します。"),
    );
    const assumptions = panel(
      h("details", { class: "pl-plan-meta" }, h("summary", {}, "計算の前提を確認する"),
        h("ul", {}, evaluation.assumptions.map((text) => h("li", {}, text))),
      ),
    );
    const review = notesPanel(ctx, state, {
      title: "納期と調整案を説明する",
      prompt: "目標納期に収める条件と、残る指摘や先に合意したい調整案を1つ以上書きます。",
      label: "日程の判断と次の調整",
      artifact: "日程表と調整案",
      check: () => {
        if (!state.attempt.edits) return "予定日、休日、または担当者の稼働率を見直して保存してください。";
        if (!evaluation.rows.some(({ task, start, end }) => task.kind !== "group" && start && end)) return "少なくとも1つの作業の日程を決めてください。";
        return "";
      },
      output: (reflection) => [
        "### 日程の判断",
        `目標納期：${state.plan.deadline || "未設定"} ／ 最終予定：${metrics.finish || "未確定"}`,
        finishStatus,
        `調整案：${md(reflection)}`,
        "| WBS | タスク | 開始 | 終了 | 先行タスク |",
        "| --- | --- | --- | --- | --- |",
        ...evaluation.rows.map(({ wbs, task, start, end }) => `| ${md(wbs)} | ${md(task.title)} | ${start || "—"} | ${end || "—"} | ${md(task.dependsOn.join("、"))} |`),
        "",
        "### 自動チェック",
        ...scheduleIssues(evaluation).slice(0, 25).map(({ message: text }) => `- ${md(text)}`),
      ].join("\n"),
    });
    ctx.root.replaceChildren(planChooser(ctx, state, rerender), guide, overview, ganttPanel(ctx, state, evaluation, rerender),
      calendarForm(ctx, state, rerender), capacityPanel(ctx, state, evaluation, rerender), findingsPanel(evaluation), assumptions,
      activePlanExample(ctx, state, rerender), review);
    if (restoreId) [...ctx.root.querySelectorAll("[data-plan-schedule]")].find((edit) => edit.dataset.planSchedule === restoreId)?.focus();
    else if (text) status.scrollIntoView({ block: "nearest" });
  }

  lab.chapters["06"] = wbsView;
  lab.chapters["07"] = pertView;
  lab.chapters["08"] = scheduleView;
})();
