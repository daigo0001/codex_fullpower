import {
  MAX_PLAN_JSON_LENGTH, MAX_TASKS, PHASES, STATUSES, WBS_STORAGE_KEY,
  createEmptyPlan, createSamplePlan, exportCsv, nextTaskId, parsePlan, removeTask,
  serializePlan, upsertTask, validatePlan,
} from "./wbs-model.js";

const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });
const phaseLabels = new Map(PHASES.map(({ id, label }) => [id, label]));
const statusLabels = new Map(STATUSES.map(({ id, label }) => [id, label]));

function element(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent) node.textContent = textContent;
  return node;
}

function setOptions(select, options, first) {
  select.replaceChildren(...(first ? [new Option(first, "")] : []), ...options.map(({ id, label }) => new Option(label, id)));
}

function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = element("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function taskCell(label, ...children) {
  const cell = element("td");
  cell.dataset.label = label;
  cell.append(...children);
  return cell;
}

function showMessage(node, message, error = false) {
  node.textContent = message;
  node.classList.toggle("is-error", error);
}

function taskSummary(task) {
  const detail = element("div", "wbs-task-summary");
  const code = element("span", "wbs-task-id", task.id);
  const title = element("strong", "", task.title);
  const identity = element("div", "wbs-task-identity");
  identity.append(code, title);
  detail.append(identity);
  if (task.deliverable) detail.append(element("span", "wbs-deliverable", task.deliverable));
  if (task.done) {
    const done = element("details", "wbs-done");
    done.append(element("summary", "", "完了条件"), element("p", "", task.done));
    detail.append(done);
  }
  return detail;
}

export function mountWbs(container) {
  container.innerHTML = `
    <section class="wbs-workspace" aria-labelledby="wbs-heading">
      <div class="wbs-head">
        <div><h2 id="wbs-heading">WBS を作る</h2><p>作業を成果物単位に分け、担当・順序・完了条件を記録します。</p></div>
        <button class="wbs-button wbs-primary" type="button" id="wbs-add">＋ タスクを追加</button>
      </div>
      <div class="wbs-controls">
        <form id="wbs-project-form" class="wbs-project-form">
          <label for="wbs-project-name">プロジェクト名</label>
          <input type="text" id="wbs-project-name" maxlength="120" required>
          <button class="wbs-button" type="submit">変更を保存</button>
        </form>
        <div class="wbs-export-controls">
          <button class="wbs-button" type="button" id="wbs-csv">CSV 出力</button>
          <button class="wbs-button" type="button" id="wbs-json">JSON バックアップ</button>
          <button class="wbs-button" type="button" id="wbs-import">JSON を読み込む</button>
          <input type="file" id="wbs-file" accept=".json,application/json" hidden>
        </div>
      </div>
      <div class="wbs-metrics" aria-label="WBS の集計">
        <dl><div><dt>タスク</dt><dd id="wbs-total"></dd></div><div><dt>完了</dt><dd id="wbs-completed"></dd></div><div><dt>見積もり合計</dt><dd id="wbs-estimate-total"></dd></div></dl>
        <div class="wbs-progress">
          <label for="wbs-progress-bar">件数ベースの進捗 <strong id="wbs-progress-percent"></strong></label>
          <progress id="wbs-progress-bar" max="100" value="0"></progress>
        </div>
      </div>
      <div class="wbs-list-head">
        <label>検索 <input id="wbs-search" type="search" placeholder="タスク名・ID・担当"></label>
        <label>フェーズ <select id="wbs-phase-filter"></select></label>
        <label>状態 <select id="wbs-status-filter"></select></label>
        <span id="wbs-count" role="status"></span>
      </div>
      <div class="wbs-table-wrap">
        <table class="wbs-table" aria-label="フェーズとタスクの一覧">
          <thead><tr><th scope="col">タスク・成果物</th><th scope="col">担当</th><th scope="col">期限・工数</th><th scope="col">先行タスク</th><th scope="col">状態</th><th scope="col"><span class="wbs-sr-only">操作</span></th></tr></thead>
          <tbody id="wbs-rows"></tbody>
        </table>
      </div>
      <p class="wbs-empty" id="wbs-empty" hidden></p>
      <p class="wbs-message" id="wbs-message" role="status"></p>
      <div class="wbs-foot">
        <p id="wbs-storage-note">このブラウザーに保存します。移行や共同確認には JSON を、表計算での共有には CSV を使えます。</p>
        <div><button class="wbs-button" type="button" id="wbs-sample">サンプルを読み込む</button><button class="wbs-button" type="button" id="wbs-new">空の WBS を作る</button></div>
      </div>
      <dialog class="wbs-dialog" id="wbs-task-dialog" aria-labelledby="wbs-dialog-title">
        <form id="wbs-task-form">
          <div class="wbs-dialog-head">
            <h3 id="wbs-dialog-title"></h3>
            <button type="button" class="wbs-button wbs-icon-button" id="wbs-task-close" aria-label="閉じる">×</button>
          </div>
          <div class="wbs-fields">
            <label class="wbs-full">タスク名 <input name="title" maxlength="160" required autofocus></label>
            <label>フェーズ <select name="phase"></select></label>
            <label>状態 <select name="status"></select></label>
            <label class="wbs-full">成果物 <input name="deliverable" maxlength="280" placeholder="例：承認済みの画面仕様"></label>
            <label class="wbs-full">完了条件 <textarea name="done" rows="2" maxlength="800" placeholder="例：空欄送信と二重貸出のテストが通る"></textarea></label>
            <label>担当 <input name="owner" maxlength="100" placeholder="未定の場合は空欄"></label>
            <label>期限 <input name="due" type="date" max="9999-12-31"></label>
            <label>見積もり（時間） <input name="estimate" type="number" min="0" max="100000" step="any" placeholder="未見積もり"></label>
            <label>先行タスク <select name="dependencyId"></select></label>
          </div>
          <p class="wbs-message" id="wbs-form-message" role="alert"></p>
          <div class="wbs-dialog-actions">
            <button type="button" class="wbs-button wbs-danger" id="wbs-delete" hidden>タスクを削除</button>
            <div>
              <button type="button" class="wbs-button" id="wbs-task-cancel">キャンセル</button>
              <button type="submit" class="wbs-button wbs-primary">タスクを保存</button>
            </div>
          </div>
        </form>
      </dialog>
      <dialog class="wbs-dialog wbs-confirm" id="wbs-confirm" aria-labelledby="wbs-confirm-title">
        <form method="dialog">
          <div class="wbs-dialog-head"><h3 id="wbs-confirm-title"></h3></div>
          <p id="wbs-confirm-text"></p>
          <div class="wbs-dialog-actions"><div>
            <button class="wbs-button" value="cancel" autofocus>キャンセル</button>
            <button class="wbs-button wbs-danger" value="replace" id="wbs-confirm-action"></button>
          </div></div>
        </form>
      </dialog>
    </section>`;

  const get = (id) => container.querySelector("#wbs-" + id);
  const taskForm = get("task-form");
  const taskDialog = get("task-dialog");
  const confirmDialog = get("confirm");
  const rows = get("rows");
  const message = get("message");
  const storageNote = get("storage-note");
  let storedSnapshot;
  let plan = createSamplePlan();
  let editingId = "";
  let confirmAction;
  let importAttempt = 0;

  try {
    storedSnapshot = localStorage.getItem(WBS_STORAGE_KEY);
    if (storedSnapshot !== null) plan = parsePlan(storedSnapshot);
  } catch {
    storageNote.textContent = "前回のデータを開けなかったため、サンプルを表示しています。変更後は JSON をバックアップできます。";
  }

  function persist() {
    try {
      const currentSnapshot = localStorage.getItem(WBS_STORAGE_KEY);
      if (storedSnapshot !== undefined && currentSnapshot !== storedSnapshot) {
        storageNote.textContent = "別のタブでデータが変更されました。この画面の変更は JSON に出力できます。";
        return;
      }
      const nextSnapshot = serializePlan(plan);
      localStorage.setItem(WBS_STORAGE_KEY, nextSnapshot);
      storedSnapshot = nextSnapshot;
      storageNote.textContent = "保存済み。このブラウザーに保存しています。移行や復元には JSON を使えます。";
    } catch {
      storageNote.textContent = "このブラウザーに保存できません。変更は現在の画面に残っているので、JSON を出力できます。";
    }
  }

  function commit(next, text, { syncProjectName = false } = {}) {
    plan = next;
    persist();
    render(syncProjectName);
    showMessage(message, text);
  }

  function confirm({ title, text, actionText, onConfirm }) {
    get("confirm-title").textContent = title;
    get("confirm-text").textContent = text;
    get("confirm-action").textContent = actionText;
    confirmDialog.returnValue = "";
    confirmAction = onConfirm;
    confirmDialog.showModal();
  }

  confirmDialog.addEventListener("close", () => {
    const action = confirmAction;
    confirmAction = undefined;
    if (confirmDialog.returnValue === "replace") action?.();
  });

  function replacePlan(next, title, actionText) {
    confirm({
      title,
      text: "現在の WBS を「" + next.name + "」に置き換えます。必要なら先に JSON バックアップを保存してください。",
      actionText,
      onConfirm: () => {
        get("search").value = "";
        get("phase-filter").value = "";
        get("status-filter").value = "";
        commit(next, "「" + next.name + "」を開きました。", { syncProjectName: true });
      },
    });
  }

  function renderTask(task, tasksById) {
    const row = element("tr", "wbs-task-row");
    const timetable = element("div", "wbs-timetable");
    timetable.append(
      element("span", "", task.due || "期限未定"),
      element("span", "", task.estimate === null ? "未見積もり" : number.format(task.estimate) + " 時間"),
    );
    const dependency = tasksById.get(task.dependencyId);
    const predecessor = element("span", "wbs-dependency", dependency ? dependency.id + " " + dependency.title : "—");
    const badge = element("span", "wbs-status-badge", statusLabels.get(task.status));
    badge.dataset.status = task.status;
    const edit = element("button", "wbs-button wbs-edit", "編集");
    edit.type = "button";
    edit.dataset.taskId = task.id;
    edit.setAttribute("aria-label", task.id + " " + task.title + " を編集");
    edit.addEventListener("click", () => openTask(task));

    row.append(
      taskCell("タスク・成果物", taskSummary(task)),
      taskCell("担当", task.owner || "—"),
      taskCell("期限・工数", timetable),
      taskCell("先行タスク", predecessor),
      taskCell("状態", badge),
      taskCell("操作", edit),
    );
    return row;
  }

  function renderTasks() {
    const query = get("search").value.trim().toLowerCase();
    const phase = get("phase-filter").value;
    const status = get("status-filter").value;
    const tasks = plan.tasks.filter((task) =>
      (!phase || task.phase === phase) &&
      (!status || task.status === status) &&
      (!query || [task.id, task.title, task.owner].some((field) => field.toLowerCase().includes(query))),
    );
    const byId = new Map(plan.tasks.map((task) => [task.id, task]));
    const fragment = document.createDocumentFragment();

    for (const [id, label] of phaseLabels) {
      const group = tasks.filter((task) => task.phase === id);
      if (group.length === 0) continue;
      const heading = element("tr", "wbs-group");
      const cell = element("th", "", label);
      cell.colSpan = 6;
      cell.append(element("span", "", group.length + " 件"));
      heading.append(cell);
      fragment.append(heading, ...group.map((task) => renderTask(task, byId)));
    }

    rows.replaceChildren(fragment);
    get("count").textContent = tasks.length + " / " + plan.tasks.length + " 件";
    get("empty").textContent = plan.tasks.length ? "条件に合うタスクがありません。" : "「タスクを追加」から始めます。";
    get("empty").hidden = tasks.length !== 0;
    container.querySelector(".wbs-table-wrap").hidden = tasks.length === 0;
  }

  function render(syncProjectName) {
    const count = plan.tasks.length;
    const completed = plan.tasks.filter(({ status }) => status === "done").length;
    const estimates = plan.tasks.map(({ estimate }) => estimate).filter((estimate) => estimate !== null);
    const progress = count === 0 ? 0 : Math.round((completed / count) * 100);
    if (syncProjectName) get("project-name").value = plan.name;
    get("total").textContent = count + " 件";
    get("completed").textContent = completed + " 件";
    get("estimate-total").textContent = estimates.length ? number.format(estimates.reduce((total, value) => total + value, 0)) + " 時間" : "—";
    get("progress-bar").value = progress;
    get("progress-percent").textContent = progress + "%";
    get("add").disabled = count >= MAX_TASKS;
    renderTasks();
  }

  function openTask(task) {
    editingId = task?.id || "";
    const fields = taskForm.elements;
    const dependencyOptions = plan.tasks.filter(({ id }) => id !== editingId).map(({ id, title }) => ({ id, label: id + " " + title }));
    setOptions(fields.dependencyId, dependencyOptions, "なし");
    get("dialog-title").textContent = task ? task.id + " を編集" : "タスクを追加";
    for (const name of ["title", "deliverable", "done", "owner", "due", "estimate", "dependencyId"]) {
      fields[name].value = task?.[name] ?? "";
    }
    fields.phase.value = task?.phase || get("phase-filter").value || PHASES[0].id;
    fields.status.value = task?.status || STATUSES[0].id;
    get("delete").hidden = !task;
    showMessage(get("form-message"), "");
    taskDialog.showModal();
  }

  setOptions(get("phase-filter"), PHASES, "すべて");
  setOptions(get("status-filter"), STATUSES, "すべて");
  setOptions(taskForm.elements.phase, PHASES);
  setOptions(taskForm.elements.status, STATUSES);
  get("search").addEventListener("input", renderTasks);
  get("phase-filter").addEventListener("change", renderTasks);
  get("status-filter").addEventListener("change", renderTasks);

  get("project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      commit(validatePlan({ ...plan, name: get("project-name").value }), "プロジェクト名を変更しました。", { syncProjectName: true });
    } catch (error) {
      showMessage(message, error.message, true);
      get("project-name").focus();
    }
  });

  get("add").addEventListener("click", () => openTask());
  get("task-close").addEventListener("click", () => taskDialog.close());
  get("task-cancel").addEventListener("click", () => taskDialog.close());

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(taskForm));
    try {
      const id = editingId || nextTaskId(plan);
      const next = upsertTask(plan, { ...values, id });
      taskDialog.close();
      commit(next, id + " を保存しました。");
      const savedRow = [...rows.querySelectorAll(".wbs-edit")].find((button) => button.dataset.taskId === id);
      (savedRow || get("add")).focus();
    } catch (error) {
      showMessage(get("form-message"), error.message, true);
    }
  });

  get("delete").addEventListener("click", () => {
    const id = editingId;
    try {
      const next = removeTask(plan, id);
      confirm({
        title: id + " を削除しますか？",
        text: "タスク名、完了条件、見積もりを含めて削除します。",
        actionText: "削除する",
        onConfirm: () => {
          taskDialog.close();
          commit(next, id + " を削除しました。");
          get("add").focus();
        },
      });
    } catch (error) {
      showMessage(get("form-message"), error.message, true);
    }
  });

  get("csv").addEventListener("click", () => download(exportCsv(plan), "text/csv;charset=utf-8", "wbs.csv"));
  get("json").addEventListener("click", () => download(serializePlan(plan), "application/json;charset=utf-8", "wbs-backup.json"));
  get("sample").addEventListener("click", () => replacePlan(createSamplePlan(), "サンプルを読み込みますか？", "読み込む"));
  get("new").addEventListener("click", () => replacePlan(createEmptyPlan(), "空の WBS を作りますか？", "新規作成する"));
  get("import").addEventListener("click", () => get("file").click());

  get("file").addEventListener("change", async () => {
    const file = get("file").files[0];
    get("file").value = "";
    if (!file) return;
    const attempt = ++importAttempt;
    try {
      if (file.size > MAX_PLAN_JSON_LENGTH * 4) throw new Error("JSON ファイルが大きすぎます。");
      const text = await file.text();
      if (attempt !== importAttempt) return;
      replacePlan(parsePlan(text), "JSON を読み込みますか？", "読み込む");
    } catch (error) {
      if (attempt === importAttempt) showMessage(message, "読み込みに失敗しました。 " + error.message, true);
    }
  });

  render(true);
}
