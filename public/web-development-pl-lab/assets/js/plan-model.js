(function attachPlan(global) {
  "use strict";

  const lab = global.PLLab ||= {};
  const DAY_MS = 86_400_000;
  const DAY_HOURS = 8;
  const MAX_TASKS = 250;
  const MAX_RANGE = 3660;
  const VERSION = 1;
  const MODES = ["sample", "final"];
  const KINDS = [
    { id: "work", label: "作業" }, { id: "group", label: "グループ" },
    { id: "wait", label: "回答待ち" }, { id: "review", label: "レビュー" },
    { id: "buffer", label: "バッファ" }, { id: "milestone", label: "マイルストーン" },
  ];
  const STATUSES = [
    { id: "todo", label: "未着手" }, { id: "doing", label: "進行中" },
    { id: "blocked", label: "保留" }, { id: "done", label: "完了" },
  ];
  const PRIORITIES = [
    { id: "high", label: "高" }, { id: "medium", label: "中" }, { id: "low", label: "低" },
  ];
  const ASSUMPTIONS = [
    "日付は開始日と終了日を含みます。土日と入力済みの休日を除きます。",
    "8時間を1人日とし、担当者の稼働率を8時間に掛けて1日の作業可能時間を算出します。",
    "自動計算では前提タスクが終了した次の稼働日から着手します。マイルストーンは完了日を示すため前提と同日を許します。",
    "予定日を両方指定した作業はその日付を維持し、担当者の稼働可能日に工数を均等配分します。同じ人に並行作業がある場合は警告し、日程を自動調整しません。",
    "グループの日程は配下の予定から集計します。回答待ち、バッファ、マイルストーンは日程に含めます。",
    "簡易クリティカルパスは依存関係と営業日日数に基づきます。固定日、担当者の取り合い、予定間の空白日は別途確認してください。",
    "テストの日数や工程に関する指摘は、入力された工程・タスク名などから判定する見直しの目安です。",
  ];

  function plainObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}の形式を確認してください。`);
    return value;
  }

  function trimmed(value, label, max, required = false) {
    if (value == null && !required) return "";
    if (typeof value !== "string") throw new Error(`${label}は文字列で入力してください。`);
    const text = value.trim();
    if (required && !text) throw new Error(`${label}を入力してください。`);
    if (text.length > max) throw new Error(`${label}は${max}文字以内で入力してください。`);
    return text;
  }

  function safeId(value, label, required = false) {
    const id = trimmed(value, label, 64, required);
    if (id && !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
      throw new Error(`${label}には半角英数字、ハイフン、ピリオド、アンダースコアを使ってください。`);
    }
    return id;
  }

  function isoDay(serial) {
    return new Date(serial * DAY_MS).toISOString().slice(0, 10);
  }

  function readDay(value, label) {
    const day = trimmed(value, label, 10);
    if (!day) return "";
    const time = Date.parse(day);
    if (!/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(day) || !Number.isFinite(time) ||
        isoDay(time / DAY_MS) !== day) {
      throw new Error(`${label}は2000年から2100年までの実在する日付を入力してください。`);
    }
    return day;
  }

  const MIN_DAY = Date.parse("2000-01-01") / DAY_MS;
  const MAX_DAY = Date.parse("2100-12-31") / DAY_MS;
  const daySerial = (day) => Date.parse(day) / DAY_MS;

  function validRange(start, end, label) {
    if (!start || !end) return;
    const range = daySerial(end) - daySerial(start);
    if (range < 0) throw new Error(`${label}の終了日は開始日以降にしてください。`);
    if (range >= MAX_RANGE) throw new Error(`${label}の日程は10年以内にしてください。`);
  }

  function readArray(value, label, max) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > max) throw new Error(`${label}は${max}件以内の一覧にしてください。`);
    return Array.from(value);
  }

  function dayList(value, label) {
    return [...new Set(readArray(value, label, 400).map((day) => {
      const normalized = readDay(day, label);
      if (!normalized) throw new Error(`${label}に空の日付があります。`);
      return normalized;
    }))].sort();
  }

  function quantity(value, label, max, fallback = null) {
    if (value == null || (typeof value === "string" && value.trim() === "")) return fallback;
    const numeric = typeof value === "string" && /^(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ? Number(value) : value;
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) {
      throw new Error(`${label}は0から${max.toLocaleString("ja-JP")}までの数値で入力してください。`);
    }
    return numeric;
  }

  function choice(value, options, fallback, label) {
    if (value == null || value === "") return fallback;
    if (!options.some(({ id }) => id === value)) throw new Error(`${label}を選び直してください。`);
    return value;
  }

  function normalizePerson(raw) {
    plainObject(raw, "担当者");
    return {
      id: safeId(raw.id, "担当者ID", true),
      name: trimmed(raw.name, "担当者名", 80, true),
      rate: quantity(raw.rate, "稼働率", 100, 100),
      absences: dayList(raw.absences, "不在日"),
    };
  }

  function normalizeTask(raw) {
    plainObject(raw, "タスク");
    const title = trimmed(raw.title, "タスク名", 160, true);
    const start = readDay(raw.start, "予定開始日");
    const end = readDay(raw.end, "予定終了日");
    validRange(start, end, `「${title}」`);
    const kind = choice(raw.kind, KINDS, "work", "タスク種別");
    if (kind === "milestone" && start && end && start !== end) throw new Error(`「${title}」のマイルストーンは1日にしてください。`);
    const optimistic = quantity(raw.optimistic, "楽観見積もり（時間）", 100_000);
    const likely = quantity(raw.likely, "最頻見積もり（時間）", 100_000);
    const pessimistic = quantity(raw.pessimistic, "悲観見積もり（時間）", 100_000);
    const threePoints = [optimistic, likely, pessimistic].filter((hours) => hours !== null);
    if (threePoints.some((hours, index) => index > 0 && hours < threePoints[index - 1])) {
      throw new Error(`「${title}」は楽観、最頻、悲観の順に見積もりが大きくなるよう入力してください。`);
    }
    const status = choice(raw.status, STATUSES, "todo", "状態");
    const progress = quantity(raw.progress, "進捗率", 100, 0);
    return {
      id: safeId(raw.id, "タスクID", true), title, kind, start, end, status,
      parentId: safeId(raw.parentId, "親グループID"),
      phase: trimmed(raw.phase, "工程", 60),
      description: trimmed(raw.description, "作業内容", 1200),
      deliverable: trimmed(raw.deliverable, "成果物", 500),
      assignee: safeId(raw.assignee, "担当者ID"),
      estimate: quantity(raw.estimate, "予定工数（時間）", 100_000),
      actual: quantity(raw.actual, "実績工数（時間）", 100_000),
      dependsOn: [...new Set(readArray(raw.dependsOn, "前提タスク", MAX_TASKS)
        .map((id) => safeId(id, "前提タスクID", true)))],
      priority: choice(raw.priority, PRIORITIES, "medium", "優先度"),
      progress: status === "done" ? 100 : progress,
      done: trimmed(raw.done, "完了条件", 900),
      optimistic, likely, pessimistic,
      basis: trimmed(raw.basis, "見積もり根拠", 900),
    };
  }

  function uniqueMap(items, label) {
    const map = new Map();
    for (const item of items) {
      if (map.has(item.id)) throw new Error(`${label}「${item.id}」が重複しています。`);
      map.set(item.id, item);
    }
    return map;
  }

  function orderedTasks(tasks, getPredecessors, errorLabel) {
    const order = [];
    const processed = new Set();
    const pending = new Set();
    function visit(task) {
      if (pending.has(task.id)) throw new Error(`「${task.title}」を含む${errorLabel}が循環しています。`);
      if (processed.has(task.id)) return;
      pending.add(task.id);
      for (const previous of getPredecessors(task)) visit(previous);
      pending.delete(task.id);
      processed.add(task.id);
      order.push(task);
    }
    for (const task of tasks) visit(task);
    return order;
  }

  function validatePlan(raw) {
    plainObject(raw, "計画");
    if (raw.version != null && raw.version !== VERSION) throw new Error("バージョン1の計画データを選んでください。");
    const mode = raw.mode || "sample";
    if (!MODES.includes(mode)) throw new Error("ケースの種類を確認してください。");
    const start = readDay(raw.start, "計画開始日");
    const deadline = readDay(raw.deadline, "計画期限");
    const asOf = readDay(raw.asOf, "進捗基準日");
    validRange(start, deadline, "計画");
    const people = readArray(raw.people, "担当者", 40).map(normalizePerson);
    const tasks = readArray(raw.tasks, "タスク", MAX_TASKS).map(normalizeTask);
    const peopleById = uniqueMap(people, "担当者ID");
    const tasksById = uniqueMap(tasks, "タスクID");
    const holidays = dayList(raw.holidays, "休日");
    for (const task of tasks) {
      if (task.assignee && !peopleById.has(task.assignee)) throw new Error(`「${task.title}」の担当者が見つかりません。`);
      if (task.parentId && tasksById.get(task.parentId)?.kind !== "group") {
        throw new Error(`「${task.title}」の親には既存のグループを指定してください。`);
      }
      if (task.kind === "group" && task.dependsOn.length) throw new Error(`「${task.title}」の前提は、グループ内の個別タスクに設定してください。`);
      for (const id of task.dependsOn) {
        const dependency = tasksById.get(id);
        if (!dependency) throw new Error(`「${task.title}」の前提タスク「${id}」が見つかりません。`);
        if (dependency.kind === "group") throw new Error(`「${task.title}」の前提にはグループ内の個別タスクを指定してください。`);
      }
    }
    orderedTasks(tasks, (task) => task.parentId ? [tasksById.get(task.parentId)] : [], "親子関係");
    orderedTasks(tasks, (task) => task.dependsOn.map((id) => tasksById.get(id)), "依存関係");
    return { version: VERSION, mode, start, deadline, asOf, people, holidays, tasks };
  }

  function makeCalendar(holidays, absences = []) {
    const excluded = new Set([...holidays, ...absences].map(daySerial));
    return (serial) => {
      const dayOfWeek = (serial + 4) % 7;
      return dayOfWeek !== 0 && dayOfWeek !== 6 && !excluded.has(serial);
    };
  }

  function businessDays(start, end, holidays = [], absences = []) {
    if (!start || !end) return 0;
    const first = daySerial(readDay(start, "開始日"));
    const last = daySerial(readDay(end, "終了日"));
    if (first > last) throw new Error("終了日は開始日以降にしてください。");
    // A group can summarize child tasks whose combined dates exceed the per-task limit.
    const works = makeCalendar(holidays, absences);
    let count = 0;
    for (let serial = first; serial <= last; serial += 1) {
      if (works(serial)) count += 1;
    }
    return count;
  }

  function addWorkdays(anchor, count, works, step = 1) {
    if (!anchor || count < 1 || count > MAX_RANGE) return "";
    let remaining = count;
    for (let serial = daySerial(anchor), walked = 0; serial >= MIN_DAY && serial <= MAX_DAY && walked <= MAX_RANGE;
      serial += step, walked += 1) {
      if (works(serial) && --remaining === 0) return isoDay(serial);
    }
    return "";
  }

  function flatRows(tasks) {
    const children = new Map();
    for (const task of tasks) {
      if (!children.has(task.parentId)) children.set(task.parentId, []);
      children.get(task.parentId).push(task);
    }
    const rows = [];
    function walk(parentId, prefix, depth) {
      (children.get(parentId) || []).forEach((task, index) => {
        const wbs = prefix ? `${prefix}.${index + 1}` : String(index + 1);
        rows.push({ id: task.id, task, wbs, depth, start: "", end: "", duration: 0, estimate: null, personDays: null,
          pert: null, critical: false, slack: null, issues: [] });
        walk(task.id, wbs, depth + 1);
      });
    }
    walk("", "", 0);
    return { rows, children };
  }

  const costsEffort = (task) => task.kind === "work" || task.kind === "review";

  function pertEstimate(task) {
    const { optimistic, likely, pessimistic } = task;
    return optimistic === null || likely === null || pessimistic === null ? null : (optimistic + 4 * likely + pessimistic) / 6;
  }

  function chooseDates(row, plan, peopleById, byId, cal) {
    const task = row.task;
    const person = peopleById.get(task.assignee);
    const work = costsEffort(task);
    const calendar = work && person ? makeCalendar(plan.holidays, person.absences) : cal;
    const capacity = person ? DAY_HOURS * person.rate / 100 : DAY_HOURS;
    const effort = row.estimate;
    const required = effort === null || capacity === 0 ? 0 : Math.max(1, Math.ceil(effort / capacity));
    const milestone = task.kind === "milestone";
    let start = task.start;
    let end = task.end;
    if (milestone) {
      start ||= end;
      end ||= start;
    }
    if (start && end) return { start, end };
    if (end && required) return { start: addWorkdays(end, required, calendar, -1), end };
    if (!start) {
      const predecessorDates = task.dependsOn.map((id) => byId[id].end);
      if (predecessorDates.some((day) => !day)) return { start, end };
      const previous = predecessorDates.sort().at(-1);
      const next = previous && !milestone && daySerial(previous) < MAX_DAY ? isoDay(daySerial(previous) + 1) : previous;
      const baseline = [plan.start, next].filter(Boolean).sort().at(-1);
      start = addWorkdays(baseline, 1, calendar);
    }
    if (start) {
      if (milestone) end = start;
      else if (required) end = addWorkdays(start, required, calendar);
    }
    return { start, end };
  }

  function analyzePlan(raw) {
    const plan = validatePlan(raw);
    const { rows, children } = flatRows(plan.tasks);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    const peopleById = new Map(plan.people.map((person) => [person.id, person]));
    const leaves = rows.filter(({ task }) => task.kind !== "group");
    const order = orderedTasks(leaves.map(({ task }) => task), (task) => task.dependsOn.map((id) => byId[id].task), "依存関係");
    const cal = makeCalendar(plan.holidays);
    const issues = [];
    const issue = (type, message, taskIds = [], details = {}) => {
      const entry = { type, severity: "warning", taskIds, assignee: "", date: "", message, ...details };
      issues.push(entry);
      for (const id of taskIds) byId[id]?.issues.push(entry);
    };
    for (const task of order) {
      const row = byId[task.id];
      row.pert = pertEstimate(task);
      row.estimate = task.estimate ?? row.pert;
      row.personDays = row.estimate === null ? null : row.estimate / DAY_HOURS;
      Object.assign(row, chooseDates(row, plan, peopleById, byId, cal));
      if (!row.start || !row.end) {
        issue("unscheduled", `「${task.title}」の予定日を決めるため、日付、工数、前提タスク、担当者の稼働率を確認してください。`, [task.id]);
      } else {
        row.duration = businessDays(row.start, row.end, plan.holidays);
        if (row.duration === 0 || !cal(daySerial(row.start)) || !cal(daySerial(row.end))) {
          issue("nonworking", `「${task.title}」の予定日が土日または休日にかかっています。`, [task.id]);
        }
        if (plan.start && row.start < plan.start) issue("baseline", `「${task.title}」が計画開始日より前に始まります。`, [task.id]);
        if (plan.deadline && row.end > plan.deadline) {
          issue("deadline", `「${task.title}」の終了日 ${row.end} が計画期限 ${plan.deadline} を超えています。`, [task.id]);
        }
        const unfinished = task.dependsOn.filter((id) => {
          const previous = byId[id];
          return previous.end && (task.kind === "milestone" ? row.start < previous.end : row.start <= previous.end);
        });
        if (unfinished.length) {
          issue("predecessor", `「${task.title}」の開始日より前に、前提タスクを完了できる日程を決めてください。`, [task.id, ...unfinished]);
        }
        if (task.dependsOn.some((id) => !byId[id].end)) {
          issue("predecessor", `「${task.title}」に終了日が未決定の前提タスクがあります。`, [task.id]);
        }
        if (plan.asOf && row.end < plan.asOf && task.status !== "done") {
          issue("late", `「${task.title}」は基準日 ${plan.asOf} より前が終了予定ですが、完了していません。`, [task.id]);
        }
      }
      if (costsEffort(task) && !task.assignee) issue("missing-owner", `「${task.title}」の担当者が未定です。`, [task.id], { severity: "info" });
    }
    for (const row of rows.slice().reverse()) {
      if (row.task.kind !== "group") continue;
      const nested = (children.get(row.id) || []).map(({ id }) => byId[id]);
      row.start = nested.map((child) => child.start).filter(Boolean).sort()[0] || "";
      row.end = nested.map((child) => child.end).filter(Boolean).sort().at(-1) || "";
      row.duration = row.start && row.end ? businessDays(row.start, row.end, plan.holidays) : 0;
      const effort = nested.filter((child) => child.task.kind === "group" || costsEffort(child.task))
        .map((child) => child.estimate).filter((value) => value !== null);
      row.estimate = effort.length ? effort.reduce((sum, value) => sum + value, 0) : null;
      row.personDays = row.estimate === null ? null : row.estimate / DAY_HOURS;
    }

    const workload = calculateWorkload(leaves, plan, peopleById, issue);
    const { path, days } = criticalPath(order, byId);
    checkPlanCoverage(leaves, plan, issue);
    const work = leaves.filter(({ task }) => costsEffort(task));
    const estimate = work.reduce((sum, row) => sum + (row.estimate ?? 0), 0);
    const actual = work.reduce((sum, { task }) => sum + (task.actual ?? 0), 0);
    const taskCount = leaves.length;
    const doneCount = leaves.filter(({ task }) => task.status === "done").length;
    const summary = {
      taskCount, doneCount, estimate, actual, difference: actual - estimate,
      completionPercent: taskCount ? Math.round(leaves.reduce((sum, { task }) => sum + task.progress, 0) / taskCount) : 0,
      finish: leaves.map((row) => row.end).filter(Boolean).sort().at(-1) || "",
      deadlineOverruns: issues.filter((entry) => entry.type === "deadline").length,
      overloads: issues.filter((entry) => entry.type === "overload").length,
      unscheduled: issues.filter((entry) => entry.type === "unscheduled").length,
      criticalPath: path, criticalDays: days,
    };
    return { rows, byId, issues, summary, workload, assumptions: [...ASSUMPTIONS] };
  }

  function calculateWorkload(rows, plan, peopleById, issue) {
    const entries = new Map();
    for (const row of rows) {
      const { task, start, end, estimate } = row;
      const person = peopleById.get(task.assignee);
      if (!costsEffort(task) || !person || !start || !end || !estimate) continue;
      const works = makeCalendar(plan.holidays, person.absences);
      const available = [];
      for (let serial = daySerial(start); serial <= daySerial(end); serial += 1) {
        if (works(serial)) available.push(isoDay(serial));
      }
      if (!available.length) {
        issue("absence", `「${task.title}」の期間中、${person.name}が作業できる日がありません。`, [task.id], { assignee: person.id });
        continue;
      }
      const hoursPerDay = estimate / available.length;
      for (const date of available) {
        const key = `${person.id}/${date}`;
        if (!entries.has(key)) entries.set(key, { assignee: person.id, name: person.name, date,
          hours: 0, capacity: DAY_HOURS * person.rate / 100, taskIds: [] });
        const entry = entries.get(key);
        entry.hours += hoursPerDay;
        entry.taskIds.push(task.id);
      }
    }
    const result = [...entries.values()].sort((first, second) => first.date.localeCompare(second.date) || first.name.localeCompare(second.name, "ja"));
    for (const entry of result) {
      const { assignee, date, hours, capacity, taskIds, name } = entry;
      entry.overload = hours > capacity + 1e-8;
      if (entry.overload) {
        issue("overload", `${date} の${name}は、予定 ${hours.toFixed(1)}時間に対して稼働可能 ${capacity.toFixed(1)}時間です。`,
          taskIds, { assignee, date });
      } else if (taskIds.length > 1) {
        issue("overlap", `${date} に${name}の担当作業が${taskIds.length}件重なっています。`, taskIds, { assignee, date, severity: "info" });
      }
    }
    return result;
  }

  function criticalPath(order, byId) {
    if (!order.length || order.some(({ id }) => !byId[id].start || !byId[id].end)) return { path: [], days: null };
    const timing = new Map();
    let finish = 0;
    let finalId = "";
    for (const task of order) {
      const duration = task.kind === "milestone" ? 0 : byId[task.id].duration;
      let earliest = 0;
      let source = "";
      for (const id of task.dependsOn) {
        const finishOfPredecessor = timing.get(id).finish;
        if (finishOfPredecessor >= earliest) {
          earliest = finishOfPredecessor;
          source = id;
        }
      }
      const value = { earliest, source, finish: earliest + duration, duration, latestFinish: Infinity };
      timing.set(task.id, value);
      if (value.finish >= finish) {
        finish = value.finish;
        finalId = task.id;
      }
    }
    for (const task of order.slice().reverse()) {
      const value = timing.get(task.id);
      const latestStart = Math.min(value.latestFinish, finish) - value.duration;
      const row = byId[task.id];
      row.slack = latestStart - value.earliest;
      row.critical = row.slack === 0;
      for (const id of task.dependsOn) {
        const previous = timing.get(id);
        previous.latestFinish = Math.min(previous.latestFinish, latestStart);
      }
    }
    const path = [];
    for (let id = finalId; id; id = timing.get(id).source) path.push(id);
    return { path: path.reverse(), days: finish };
  }

  function checkPlanCoverage(rows, plan, issue) {
    if (!rows.length) return;
    const text = ({ task }) => [task.phase, task.title, task.description, task.done, task.deliverable].join(" ");
    const test = rows.filter(({ task }) => /テスト|試験|\btest\b/i.test(task.phase) || /(?:テスト|試験)(?:を|実施|計画|結果|し|する|工程|$)/.test(task.title));
    const testDays = new Set();
    const works = makeCalendar(plan.holidays);
    for (const row of test) {
      for (let serial = daySerial(row.start); serial <= daySerial(row.end); serial += 1) {
        if (works(serial)) testDays.add(serial);
      }
    }
    if (test.length && testDays.size < 3) issue("test-short", "テストとして計画された営業日が3日未満です。対象機能・再試験・レビューに必要な日数を見直してください。", test.map(({ id }) => id));
    if (!rows.some((row) => row.task.kind === "review" && /顧客|受入|利用部門|customer/i.test(text(row)))) {
      issue("missing-review", "顧客・利用部門のレビューを確認できません。承認者と確認日を決めてWBSに記載してください。");
    }
    const checks = [
      ["要件・対象範囲", /要件|スコープ|ヒアリング|scope/i],
      ["設計", /設計|design/i],
      ["実装", /実装|開発|構築|implement/i],
      ["テスト", /テスト|試験|\btest\b/i],
      ["リリースリハーサル", /リハーサル|rehearsal/i],
      ["公開可否の判定", /Go\s*[\/／-]\s*No[ -]?Go|リリース判定|公開可否/i],
      ["運用引き継ぎ", /引き継|引継|運用移管|handover/i],
    ];
    const missing = checks.filter(([, pattern]) => !rows.some((row) => pattern.test(text(row)))).map(([label]) => label);
    if (missing.length) issue("missing-key-work", `WBS上で確認できない工程・確認項目があります。 ${missing.join("、")}`);
  }

  function nextTaskId(plan) {
    const ids = new Set(plan.tasks.map(({ id }) => id));
    let number = 1;
    for (const id of ids) {
      const suffix = /^t(\d{1,6})$/i.exec(id);
      if (suffix) number = Math.max(number, Number(suffix[1]) + 1);
    }
    let next = `t${String(number).padStart(3, "0")}`;
    while (ids.has(next)) next = `t${String(++number).padStart(3, "0")}`;
    return next;
  }

  function csvCell(value) {
    let text = String(value ?? "");
    // Excel and similar tools can interpret formulas after leading whitespace or controls.
    if (/^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }

  function exportCsv(raw) {
    const plan = validatePlan(raw);
    const { rows, byId } = analyzePlan(plan);
    const names = new Map(plan.people.map(({ id, name }) => [id, name]));
    const label = (options, id) => options.find((option) => option.id === id)?.label || "";
    const header = ["WBS番号", "タスクID", "親ID", "種別", "工程", "タスク名", "作業内容", "成果物", "完了条件", "担当者",
      "予定工数（時間）", "実績工数（時間）", "予定開始", "予定終了", "営業日日数", "前提タスクID", "優先度", "進捗（%）", "状態",
      "楽観（時間）", "最頻（時間）", "悲観（時間）", "PERT（時間）", "見積根拠"];
    const lines = rows.map(({ task, wbs, start, end, duration, pert, estimate }) => [
      wbs, task.id, task.parentId, label(KINDS, task.kind), task.phase, task.title, task.description,
      task.deliverable, task.done, names.get(task.assignee), estimate === null ? null : Math.round(estimate * 100) / 100,
      task.actual, start, end, start && end ? duration : null, task.dependsOn.map((id) => byId[id].id).join(" / "),
      label(PRIORITIES, task.priority), task.progress, label(STATUSES, task.status), task.optimistic, task.likely,
      task.pessimistic, pert === null ? null : Math.round(pert * 100) / 100, task.basis,
    ]);
    return "\uFEFF" + [header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function defaultPlan(mode = "sample") {
    const final = mode === "final";
    const start = final ? "2027-03-01" : "2026-12-01";
    return validatePlan({
      mode, start, asOf: start, deadline: final ? "2027-04-09" : "2027-02-26",
      people: [
        { id: "pl", name: "PL", rate: 60 },
        { id: "dev", name: final ? "開発担当" : "アプリ担当", rate: 80 },
        ...(final ? [] : [{ id: "qa", name: "基盤・QA担当", rate: 60 }]),
      ],
      holidays: final ? ["2027-03-22"] : [
        "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23",
      ],
      tasks: [{
        id: "g00", title: final ? "社内会議室予約システム" : "社内問い合わせ管理システムの新規開発", kind: "group",
      }],
    });
  }

  const sampleGroups = [
    { id: "g01", title: "要件定義と計画", kind: "group", phase: "要件定義" },
    { id: "g02", title: "画面・詳細・基盤設計", kind: "group", phase: "設計" },
    { id: "g03", title: "実装と結合", kind: "group", phase: "実装" },
    { id: "g04", title: "テストと運用受入", kind: "group", phase: "テスト" },
    { id: "g05", title: "リリースと運用", kind: "group", phase: "リリース・運用" },
  ].map((group) => ({ ...group, parentId: "g00" }));

  function exampleTask(id, group, title, assignee, estimate, start, end, dependsOn, deliverable, done, options = {}) {
    return { id, parentId: group, phase: sampleGroups.find(({ id: groupId }) => groupId === group).phase,
      title, assignee, estimate, start, end, dependsOn, deliverable, done, ...options };
  }

  function gate(id, group, title, date, dependsOn, deliverable, done) {
    return exampleTask(id, group, title, "", null, date, date, dependsOn, deliverable, done, { kind: "milestone" });
  }

  function walkthroughExample() {
    const finished = { status: "done" };
    const review = { kind: "review" };
    return [
      exampleTask("t001", "g01", "利用部門に現行業務と完了判断を確認する", "pl", 12, "2026-12-01", "2026-12-03", [],
        "ヒアリング記録・要求一覧", "困りごと、対象ユーザー、問い合わせの終了条件、承認者を記録した。", { ...finished, actual: 11 }),
      exampleTask("t002", "g01", "既存システムの担当者マスタ連携を調査する", "dev", 15, "2026-12-01", "2026-12-03", [],
        "IF調査メモ", "HTTPS夜間連携の既存窓口、データ形式、失敗時の問合せ先を整理した。", { ...finished, actual: 14 }),
      exampleTask("t003", "g01", "既存システム担当から仕様の回答を待つ", "", null, "2026-12-04", "2026-12-07", ["t002"],
        "マスタ連携の回答", "既存担当から項目定義と再実行方法の回答を受け取った。", { ...finished, kind: "wait" }),
      exampleTask("t004", "g01", "要件と対象外を整理する", "pl", 12, "2026-12-04", "2026-12-08", ["t001"],
        "要件定義書・対応表", "R-001〜R-007に受入条件と優先度があり、対象外と未決事項を記録した。", { ...finished, actual: 13 }),
      exampleTask("t005", "g01", "顧客レビューで要件と対象外に合意する", "pl", 5, "2026-12-09", "2026-12-10", ["t003", "t004"],
        "要件レビュー議事録", "利用部門責任者が対象範囲と確認方法を承認し、残課題に担当と期限がある。", { ...finished, ...review, actual: 5 }),
      gate("t006", "g01", "要件確定", "2026-12-11", ["t005"], "承認済み要件", "要件・対象外のベースラインを記録した。"),
      exampleTask("t007", "g02", "一覧・詳細・登録・状態変更の画面を設計する", "dev", 22, "2026-12-14", "2026-12-17", ["t006"],
        "画面一覧・遷移図・画面仕様", "正常、入力エラー、権限不足、競合時の表示と操作を確認した。",
        { ...finished, actual: 23, optimistic: 16, likely: 22, pessimistic: 30,
          basis: "4画面の叩き台と部門レビュー。状態表示と競合時の見え方を別に確認する。" }),
      exampleTask("t008", "g02", "データと状態変更の詳細・外部IFを設計する", "dev", 24, "2026-12-18", "2026-12-23", ["t007"],
        "ER図・状態遷移・IF仕様", "更新条件、履歴、楽観ロック、既存マスタのエラー時の扱いを確認した。", { ...finished, actual: 24 }),
      exampleTask("t009", "g02", "環境・監視・バックアップの構成を設計する", "qa", 28, "2026-12-14", "2026-12-22", ["t006"],
        "構成図・環境表・復旧方針", "本番と検証の環境を切り分け、ID、秘密情報、監視、復元、切り戻しの責任者を記載した。", { ...finished, actual: 26 }),
      exampleTask("t010", "g02", "設計から機能・非機能の確認観点を作る", "qa", 12, "2026-12-23", "2026-12-28", ["t009"],
        "トレーサビリティ・テスト観点表", "要件IDと実施する試験を対応付け、性能、認可、復元も確認範囲に含めた。", { ...finished, actual: 12 }),
      exampleTask("t011", "g02", "顧客・運用担当が設計をレビューする", "pl", 12, "2027-01-04", "2027-01-07", ["t008", "t009", "t010"],
        "設計レビュー記録", "画面遷移、状態、連携方式、受入条件を関係者が承認した。", { ...finished, ...review, actual: 11 }),
      gate("t012", "g02", "設計確定", "2027-01-08", ["t011"], "レビュー済み設計書", "実装に必要な設計がそろい、追加確認に担当と期限がある。"),
      exampleTask("t013", "g03", "認証認可とDB移行の最小構成を実装する", "dev", 24, "2027-01-12", "2027-01-15", ["t012"],
        "認可処理・マイグレーション", "空の検証DBに適用でき、権限のある利用者だけが許可された操作を実行できる。", { ...finished, actual: 25 }),
      exampleTask("t014", "g03", "検証環境とCI/CDを構築する", "qa", 20, "2027-01-12", "2027-01-18", ["t012"],
        "検証環境・パイプライン", "レビュー済みの変更が自動テストを通過し、検証環境に配備できる。", { status: "doing", progress: 80, actual: 16 }),
      exampleTask("t015", "g03", "問い合わせ登録・閲覧・状態変更を実装する", "dev", 30, "2027-01-18", "2027-01-22", ["t013"],
        "問い合わせ画面、API、変更履歴", "受付から対応済みまで遷移でき、不正な状態遷移や同時更新は拒否して履歴を残す。",
        { status: "doing", progress: 20, actual: 5, optimistic: 24, likely: 30, pessimistic: 42,
          basis: "登録・一覧と、状態変更の権限確認・履歴・競合処理を個別に積み上げた。" }),
      exampleTask("t016", "g03", "既存マスタの夜間取込と再実行を実装する", "dev", 24, "2027-01-25", "2027-01-28", ["t003", "t015"],
        "HTTPS夜間連携・運用ログ", "検証データの取込、失敗時の通知・再実行、重複防止を確認した。"),
      exampleTask("t017", "g03", "監視・バックアップを検証環境に設定する", "qa", 20, "2027-01-19", "2027-01-25", ["t014"],
        "監視設定・試験用バックアップ", "障害通知とバックアップが有効で、復元試験の準備ができている。"),
      exampleTask("t018", "g03", "主要機能の単体・結合テストを実行する", "dev", 30, "2027-01-29", "2027-02-04", ["t016", "t017"],
        "結合結果・修正記録", "認可、状態変更の正常・異常経路（T-005）、夜間連携を検証し不合格を記録した。"),
      gate("t019", "g03", "実装・結合完了", "2027-02-05", ["t018"], "テスト対象リリース候補", "機能試験を始められ、既知課題の優先順位が付いている。"),
      exampleTask("t020", "g04", "主要な業務フローと権限を機能テストする", "qa", 12, "2027-02-08", "2027-02-10", ["t019"],
        "機能テスト結果", "主要フロー・ロール別操作・状態遷移の結果と証跡を保存した。"),
      exampleTask("t021", "g04", "性能・監視・復元を非機能テストする", "qa", 8, "2027-02-12", "2027-02-15", ["t020"],
        "非機能試験・復元結果", "合意した条件と負荷で測定し、通知と隔離環境での復元を確認した。"),
      exampleTask("t022", "g04", "不合格箇所を修正し再試験する", "dev", 12, "2027-02-16", "2027-02-17", ["t021"],
        "修正差分・再試験結果", "公開を阻む問題が解消し、残課題の対応方針が決まった。"),
      exampleTask("t023", "g04", "利用部門・運用担当の受入レビューを行う", "pl", 4, "2027-02-18", "2027-02-18", ["t022"],
        "受入承認記録", "利用部門は業務フローを確認し、運用担当はアラート、復元、問い合わせ先を確認した。", review),
      gate("t024", "g04", "運用受入完了", "2027-02-19", ["t023"], "運用受入記録", "受入の残課題が担当・期限付きで管理されている。"),
      exampleTask("t025", "g05", "リリースと切り戻しをリハーサルする", "qa", 4, "2027-02-22", "2027-02-22", ["t024"],
        "リハーサル記録", "検証環境で配備・DB変更・スモークテスト・切り戻しの順序と所要時間を記録した。"),
      exampleTask("t026", "g05", "リハーサル後の調整バッファを確保する", "", null, "2027-02-24", "2027-02-24", ["t025"],
        "リリース調整時間", "リハーサルで見つかった修正の要否を決める時間を確保した。", { kind: "buffer" }),
      exampleTask("t027", "g05", "Go/No-Go を判定する", "pl", 4, "2027-02-25", "2027-02-25", ["t026"],
        "公開可否の判定記録", "受入結果、障害時の責任分担、切り戻し条件、公開判断者を確認した。", review),
      exampleTask("t028", "g05", "本番配備とスモーク確認を行う", "qa", 3, "2027-02-26", "2027-02-26", ["t027"],
        "本番配備・監視ログ", "ログイン、一覧、登録、エラーログを確認して公開判断者に共有した。"),
      exampleTask("t029", "g05", "監視・問い合わせ対応を運用担当に引き継ぐ", "pl", 3, "2027-02-26", "2027-02-26", ["t027"],
        "運用引き継ぎチェックリスト", "当番、連絡先、一次対応、復旧手順、残課題を運用担当が確認した。"),
      gate("t030", "g05", "初回リリース", "2027-02-26", ["t028", "t029"], "リリース完了記録", "配備確認と引き継ぎが完了し、運用連絡を送った。"),
    ].map((task) => task.kind === "milestone" && task.end <= "2027-01-08" ? { ...task, ...finished } : task);
  }

  function finalExample() {
    return [
      exampleTask("t001", "g01", "会議室予約の要件と対象外を決める", "pl", 12, "2027-03-01", "2027-03-03", [],
        "要件 BR-001〜003", "空き一覧、重複を拒否する予約、取消と履歴の対象者・受入条件を記載した。"),
      exampleTask("t002", "g01", "利用部門の要件レビューと承認を行う", "pl", 7, "2027-03-04", "2027-03-05", ["t001"],
        "利用部門の要件承認", "定期予約・外部カレンダー連携を今回の対象外とし、利用部門が範囲を承認した。", { kind: "review" }),
      exampleTask("t003", "g02", "一覧・予約・取消の画面とデータを設計する", "dev", 24, "2027-03-08", "2027-03-11", ["t002"],
        "画面遷移、ER図、競合時の処理設計", "時間帯の重なり、日付境界、取消権限、操作履歴の例とテストを確認した。"),
      exampleTask("t004", "g02", "公開環境と監視・復旧の方針を決める", "pl", 12, "2027-03-08", "2027-03-11", ["t002"],
        "構成図、環境変数一覧、復旧方針", "検証と本番を区別し、監視、DBバックアップ、切り戻しの責任者を決めた。"),
      gate("t005", "g02", "設計を実装へ引き渡す", "2027-03-12", ["t003", "t004"], "設計完了", "画面・データ・公開判断の条件がそろった。"),
      exampleTask("t006", "g03", "空き一覧と重複防止付き予約を実装する", "dev", 28, "2027-03-15", "2027-03-19", ["t005"],
        "空き一覧・予約API（BR-001・BR-002）", "同一会議室の重なる予約を同時送信しても、1件だけが登録される。",
        { optimistic: 20, likely: 28, pessimistic: 40, basis: "一覧、予約条件、同時登録対策とユニットテストの積み上げ。" }),
      exampleTask("t007", "g03", "取消と操作履歴、検証環境を実装する", "dev", 24, "2027-03-23", "2027-03-26", ["t006"],
        "取消処理、履歴、検証環境（BR-003）", "予約者と管理者の取消権限を確認し、検証環境に配備できる。"),
      exampleTask("t008", "g04", "機能・競合・認可・復元テストを実行する", "dev", 26, "2027-03-29", "2027-04-02", ["t007"],
        "機能・非機能テスト結果", "二重予約、取消後の空き枠、権限、監視通知、隔離環境の復元を確認した。"),
      exampleTask("t009", "g04", "利用部門で受入レビューを行う", "pl", 4, "2027-04-05", "2027-04-05", ["t008"],
        "利用部門の受入承認", "利用部門が空き一覧、登録、取消を確認し、リリース可否の判断条件を満たした。", { kind: "review" }),
      exampleTask("t010", "g05", "配備・切り戻しのリハーサルを行う", "dev", 5, "2027-04-06", "2027-04-06", ["t009"],
        "配備手順とリハーサル結果", "検証環境に配備し、異常時に元に戻す手順を確認した。"),
      exampleTask("t011", "g05", "指摘事項を調整するバッファを取る", "", null, "2027-04-07", "2027-04-07", ["t010"],
        "調整時間", "残った指摘の修正、不採用、延期を判定した。", { kind: "buffer" }),
      exampleTask("t012", "g05", "Go/No-Go と運用引き継ぎを行う", "pl", 4, "2027-04-08", "2027-04-08", ["t011"],
        "公開可否と運用引き継ぎ記録", "利用部門の承認、監視の担当、障害時の連絡・切り戻し方針がそろった。", { kind: "review" }),
      exampleTask("t013", "g05", "本番配備と公開確認を行う", "dev", 5, "2027-04-09", "2027-04-09", ["t012"],
        "本番配備記録", "主要操作のスモークテストと監視ログの確認が完了した。"),
      gate("t014", "g05", "初回リリース", "2027-04-09", ["t013"], "公開完了記録", "告知と本番確認の結果を記録した。"),
    ];
  }

  function samplePlan(mode = "sample") {
    const frame = defaultPlan(mode);
    const final = mode === "final";
    return validatePlan({
      ...frame, asOf: final ? frame.start : "2027-01-18",
      tasks: [...frame.tasks, ...sampleGroups, ...(final ? finalExample() : walkthroughExample())],
    });
  }

  lab.plan = {
    KINDS, STATUSES, PRIORITIES, MODES, defaultPlan, samplePlan, validatePlan, analyzePlan,
    exportCsv, businessDays, nextTaskId, pertEstimate,
  };
})(globalThis);
