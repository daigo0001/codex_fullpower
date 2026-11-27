(() => {
  const lab = globalThis.PLLab;
  const ids = lab.curriculum.chapters.slice(1).map(({ id }) => id);
  const version = 1;
  const storageKey = "codex-lab.pl-practice.workspace.v1";
  const maxBackupBytes = 4_000_000;

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function fresh() {
    return {
      version,
      progress: Object.create(null),
      answers: Object.create(null),
      artifacts: Object.create(null),
      planMode: "sample",
      plans: { sample: lab.plan.defaultPlan("sample"), final: lab.plan.defaultPlan("final") },
    };
  }

  function validateArtifact(raw) {
    if (!isRecord(raw) || typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 120 ||
      typeof raw.markdown !== "string" || !raw.markdown.trim() || raw.markdown.length > 80_000) {
      throw new Error("成果物のタイトルまたは本文が不正です。");
    }
    return { title: raw.title.trim(), markdown: raw.markdown };
  }

  function checkKeys(record, label) {
    if (!isRecord(record) || Object.keys(record).some(id => !ids.includes(id))) {
      throw new Error(`${label}の章 ID が不正です。`);
    }
  }

  function validate(raw) {
    if (!isRecord(raw) || raw.version !== version) throw new Error("対応していないバックアップのバージョンです。");
    if (!isRecord(raw.plans) || !["sample", "final"].includes(raw.planMode)) throw new Error("計画の形式が不正です。");
    checkKeys(raw.progress, "進捗");
    checkKeys(raw.answers, "演習データ");
    checkKeys(raw.artifacts, "成果物");

    const state = {
      version,
      progress: Object.create(null),
      answers: Object.create(null),
      artifacts: Object.create(null),
      planMode: raw.planMode,
      plans: { sample: lab.plan.validatePlan(raw.plans.sample), final: lab.plan.validatePlan(raw.plans.final) },
    };
    for (const mode of ["sample", "final"]) {
      if (state.plans[mode].mode !== mode) throw new Error("演習案件と計画データが対応していません。");
    }

    for (const id of ids) {
      if (Object.hasOwn(raw.progress, id)) {
        if (typeof raw.progress[id] !== "boolean") throw new Error(`章 ${id} の進捗が不正です。`);
        if (raw.progress[id]) state.progress[id] = true;
      }
      if (Object.hasOwn(raw.answers, id)) {
        if (typeof lab.validators[id] !== "function") throw new Error(`章 ${id} の演習データを読めません。`);
        state.answers[id] = lab.validators[id](raw.answers[id]);
      }
      if (Object.hasOwn(raw.artifacts, id)) {
        const items = raw.artifacts[id];
        if (!Array.isArray(items) || items.length > 24) throw new Error(`章 ${id} の成果物が不正です。`);
        state.artifacts[id] = items.map(validateArtifact);
        if (new Set(state.artifacts[id].map(item => item.title)).size !== items.length) {
          throw new Error(`章 ${id} に同名の成果物があります。`);
        }
      }
    }
    return state;
  }

  function parse(source) {
    if (typeof source !== "string" || source.length > maxBackupBytes) throw new Error("バックアップは 4 MB 以内にしてください。");
    let raw;
    try {
      raw = JSON.parse(source.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("JSON の形式を確認してください。");
    }
    return validate(raw);
  }

  function recordArtifact(state, id, title, markdown) {
    if (!ids.includes(id)) throw new Error("成果物の章 ID が不正です。");
    const value = validateArtifact({ title, markdown });
    const items = state.artifacts[id] ?? [];
    const existing = items.findIndex(item => item.title === value.title);
    if (existing >= 0) items[existing] = value;
    else if (items.length < 24) items.push(value);
    else throw new Error("1章に保存できる成果物は24件です。");
    state.artifacts[id] = items;
  }

  function artifacts(state) {
    return ids.flatMap(id => (state.artifacts[id] ?? []).map(item => ({ id, ...item })));
  }

  lab.workspace = { fresh, validate, parse, recordArtifact, artifacts, storageKey, maxBackupBytes };
})();
