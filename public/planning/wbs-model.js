export const WBS_STORAGE_KEY = "codex-lab.dev-blueprint.wbs.v1";
export const MAX_TASKS = 250;
export const MAX_PLAN_JSON_LENGTH = 2_000_000;

export const PHASES = [
  { id: "scope", label: "要件・計画" },
  { id: "design", label: "設計" },
  { id: "implementation", label: "実装" },
  { id: "test", label: "テスト" },
  { id: "release", label: "リリース" },
  { id: "operations", label: "運用" },
];
export const STATUSES = [
  { id: "todo", label: "未着手" },
  { id: "doing", label: "進行中" },
  { id: "blocked", label: "保留" },
  { id: "done", label: "完了" },
];

const phaseLabels = new Map(PHASES.map(({ id, label }) => [id, label]));
const statusLabels = new Map(STATUSES.map(({ id, label }) => [id, label]));
const PLAN_VERSION = 1;

function normalizeText(value, label, maxLength, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new Error(`${label}は文字で入力してください。`);
  const text = value.trim();
  if (required && !text) throw new Error(`${label}を入力してください。`);
  if (text.length > maxLength) throw new Error(`${label}は${maxLength}文字以内で入力してください。`);
  return text;
}

function normalizeId(value, label, required = false) {
  const id = normalizeText(value, label, 64, required);
  if (/[\p{Cc}\p{Cf}]/u.test(id)) throw new Error(`${label}には制御文字を使えません。`);
  return id;
}

function normalizeDate(value) {
  const due = normalizeText(value, "期限", 10);
  if (!due) return "";
  const time = Date.parse(due);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due.startsWith("0000") ||
      !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== due) {
    throw new Error("期限は実在する日付を YYYY-MM-DD 形式で入力してください。");
  }
  return due;
}

function normalizeEstimate(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const decimal = typeof value === "string" && /^(?:\d+\.?\d*|\.\d+)$/.test(value.trim());
  const hours = decimal ? Number(value) : value;
  if (!Number.isFinite(hours) || hours < 0 || hours > 100_000) {
    throw new Error("見積もりは0から100,000までの時間数で入力してください。");
  }
  return hours;
}

function normalizeTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) throw new Error("タスクの形式が正しくありません。");
  if (!phaseLabels.has(task.phase)) throw new Error("タスクの工程を選んでください。");
  if (!statusLabels.has(task.status)) throw new Error("タスクの状態を選んでください。");
  return {
    id: normalizeId(task.id, "タスクID", true),
    phase: task.phase,
    title: normalizeText(task.title, "タスク名", 160, true),
    deliverable: normalizeText(task.deliverable, "成果物", 280),
    done: normalizeText(task.done, "完了条件", 800),
    owner: normalizeText(task.owner, "担当", 100),
    due: normalizeDate(task.due),
    estimate: normalizeEstimate(task.estimate),
    status: task.status,
    dependencyId: normalizeId(task.dependencyId, "前提タスクID"),
  };
}

function validateDependencies(tasks) {
  const byId = new Map();
  for (const task of tasks) {
    if (byId.has(task.id)) throw new Error(`タスクID「${task.id}」が重複しています。`);
    byId.set(task.id, task);
  }

  for (const { id, dependencyId } of tasks) {
    if (!dependencyId) continue;
    if (!byId.has(dependencyId)) throw new Error(`「${id}」の前提タスク「${dependencyId}」が見つかりません。`);
    if (dependencyId === id) throw new Error(`「${id}」自身を前提タスクにできません。`);
  }

  const resolved = new Set();
  for (const { id } of tasks) {
    const path = new Set();
    let current = id;
    while (current && !resolved.has(current)) {
      if (path.has(current)) throw new Error(`「${current}」を含む前提タスクが循環しています。`);
      path.add(current);
      current = byId.get(current).dependencyId;
    }
    for (const visited of path) resolved.add(visited);
  }
}

export function validatePlan(value) {
  if (!value || value.version !== PLAN_VERSION || !Array.isArray(value.tasks)) {
    throw new Error("バージョン1のWBSバックアップを選んでください。");
  }
  if (value.tasks.length > MAX_TASKS) throw new Error(`タスクは${MAX_TASKS}件まで保存できます。`);
  const name = normalizeText(value.name, "プロジェクト名", 120, true);
  const tasks = Array.from(value.tasks, normalizeTask);
  validateDependencies(tasks);
  return { version: PLAN_VERSION, name, tasks };
}

export function createEmptyPlan() {
  return { version: PLAN_VERSION, name: "新しいWebアプリ", tasks: [] };
}

export function createSamplePlan() {
  const rows = [
    ["W-01", "scope", "貸出登録の対象と対象外を決める", "要件 R-01〜R-03", "社員が自分の貸出・返却を登録する範囲を決め、通知は次回に回すと合意済み。", "企画担当", "2026-12-01", 2, "done", ""],
    ["W-02", "design", "備品一覧と貸出フォームを設計する", "画面 S-01・S-02", "通常・入力エラー・貸出中の画面と、送信後の遷移を確認済み。", "画面担当", "2026-12-02", 4, "done", "W-01"],
    ["W-03", "design", "貸出登録の処理とデータを設計する", "詳細 D-02・ER図", "登録の分岐、ロール確認、二重貸出の排他方法、テスト T-02 を記述済み。", "実装担当", "2026-12-03", 5, "done", "W-02"],
    ["W-04", "design", "配備先と復旧方法を決める", "構成図・運用手順", "環境ごとの設定、秘密情報の保管先、デプロイと復旧の手順を確認済み。", "運用担当", "2026-12-03", 3, "doing", "W-01"],
    ["W-05", "implementation", "備品と貸出レコードのスキーマを作る", "マイグレーション", "空のDBで適用でき、貸出中の重複レコードをDBが拒否する。", "実装担当", "2026-12-04", 4, "doing", "W-03"],
    ["W-06", "implementation", "貸出フォームから貸出を登録する", "R-02 / S-02 / D-02", "POST /loans が assetId と dueOn を受け取り、ログインした社員本人の貸出を保存する。同一備品の同時登録は1件だけ成功し、後続は409になる。T-02で確認できる。", "実装担当", "2026-12-08", 7, "todo", "W-05"],
    ["W-07", "implementation", "貸出を返却済みにする", "返却操作 R-03", "返却日時が保存され、備品一覧で次の貸出が可能になる。", "実装担当", "2026-12-09", 4, "todo", "W-06"],
    ["W-08", "test", "二重貸出の拒否を確認する", "結合テスト T-02", "同じ備品への同時リクエストで、貸出中レコードが1件だけ残る。", "テスト担当", "2026-12-10", 3, "todo", "W-06"],
    ["W-09", "test", "未認可ユーザーの登録拒否と返却を確認する", "受け入れテスト", "未認可の操作でレコードが作られず、貸出から返却まで通る。", "テスト担当", "2026-12-11", 4, "todo", "W-07"],
    ["W-10", "release", "ステージングに配備する", "ステージング環境", "設定とマイグレーションを反映し、主要画面のスモークテストが通る。", "運用担当", "2026-12-14", 3, "todo", "W-04"],
    ["W-11", "release", "初回リリースと切り戻しを確認する", "リリース記録", "受け入れ・T-02・ステージングの結果を確認し、本番の監視と切り戻し手順を記録する。", "運用担当", "2026-12-16", 3, "todo", "W-10"],
    ["W-12", "operations", "バックアップからの復元を試す", "復元テスト記録", "隔離した環境に復元し、備品件数と貸出状態を確認する。", "運用担当", "2026-12-18", 3, "todo", "W-11"],
  ];
  return validatePlan({
    version: PLAN_VERSION,
    name: "備品貸出管理",
    tasks: rows.map(([id, phase, title, deliverable, done, owner, due, estimate, status, dependencyId]) =>
      ({ id, phase, title, deliverable, done, owner, due, estimate, status, dependencyId })),
  });
}

export function parsePlan(jsonText) {
  if (typeof jsonText !== "string" || jsonText.length > MAX_PLAN_JSON_LENGTH) {
    throw new Error("読み込めるJSONバックアップは200万文字までです。");
  }
  let value;
  try {
    value = JSON.parse(jsonText.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("JSONバックアップを読み込めませんでした。");
  }
  return validatePlan(value);
}

export function serializePlan(plan) {
  return JSON.stringify(validatePlan(plan), null, 2) + "\n";
}

export function nextTaskId(plan) {
  const usedIds = new Set(plan.tasks.map(({ id }) => id));
  let number = 1;
  for (const id of usedIds) {
    const match = /^W-(\d{1,5})$/.exec(id);
    if (match) number = Math.max(number, Number(match[1]) + 1);
  }
  let id = `W-${String(number).padStart(2, "0")}`;
  while (usedIds.has(id)) {
    number += 1;
    id = `W-${String(number).padStart(2, "0")}`;
  }
  return id;
}

export function upsertTask(plan, task) {
  const normalized = normalizeTask(task);
  const existing = plan.tasks.some(({ id }) => id === normalized.id);
  const tasks = existing
    ? plan.tasks.map((item) => item.id === normalized.id ? normalized : item)
    : [...plan.tasks, normalized];
  return validatePlan({ ...plan, tasks });
}

export function removeTask(plan, id) {
  const dependent = plan.tasks.find(({ dependencyId }) => dependencyId === id);
  if (dependent) throw new Error(`「${dependent.title}」の前提タスクを変更してから削除してください。`);
  return validatePlan({ ...plan, tasks: plan.tasks.filter((task) => task.id !== id) });
}

function csvCell(value) {
  let text = String(value ?? "");
  // Spreadsheets can interpret formulas even after leading spaces or controls.
  if (/^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function exportCsv(input) {
  const plan = validatePlan(input);
  const header = ["プロジェクト名", "タスクID", "工程", "タスク名", "成果物", "完了条件", "担当", "期限", "見積もり（時間）", "状態", "前提タスクID"];
  const records = plan.tasks.map((task) => [
    plan.name, task.id, phaseLabels.get(task.phase), task.title, task.deliverable, task.done, task.owner, task.due,
    task.estimate, statusLabels.get(task.status), task.dependencyId,
  ]);
  return "\uFEFF" + [header, ...records].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
