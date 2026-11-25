export const MIN_EVIDENCE = 2;
const maxNotesLength = 4000;

export function createExercise(caseInfo) {
  return {
    caseInfo,
    phase: "investigate",
    openedEvidence: [],
    selectedChecks: [],
    attempts: { hypotheses: [], actions: [], verifications: 0 },
    feedback: null,
    confirmedHypothesisId: null,
    confirmedActionId: null,
  };
}

export function openEvidence(state, id) {
  if (state.openedEvidence.includes(id) || !state.caseInfo.evidence.some((item) => item.id === id)) return state;
  return { ...state, openedEvidence: [...state.openedEvidence, id] };
}

export function submitHypothesis(state, id) {
  if (state.phase !== "investigate") return state;
  const choice = state.caseInfo.hypotheses.find((item) => item.id === id);
  if (!choice) return state;
  const needed = MIN_EVIDENCE - state.openedEvidence.length;
  if (needed > 0) {
    return { ...state, feedback: { kind: "info", text: `仮説を選ぶ前に、あと${needed}件の証拠を確認してください。` } };
  }

  const attempts = { ...state.attempts, hypotheses: [...state.attempts.hypotheses, id] };
  if (!choice.correct) return { ...state, attempts, feedback: { kind: "error", text: choice.feedback } };
  return {
    ...state,
    phase: "respond",
    confirmedHypothesisId: id,
    attempts,
    feedback: { kind: "success", text: choice.feedback },
  };
}

export function submitAction(state, id) {
  if (state.phase !== "respond") return state;
  const choice = state.caseInfo.actions.find((item) => item.id === id);
  if (!choice) return state;
  const attempts = { ...state.attempts, actions: [...state.attempts.actions, id] };
  if (!choice.correct) return { ...state, attempts, feedback: { kind: "error", text: choice.feedback } };
  return {
    ...state,
    phase: "verify",
    confirmedActionId: id,
    attempts,
    feedback: { kind: "success", text: choice.feedback },
  };
}

export function toggleCheck(state, id) {
  if (state.phase !== "verify" || !state.caseInfo.checks.some((item) => item.id === id)) return state;
  const selectedChecks = state.selectedChecks.includes(id)
    ? state.selectedChecks.filter((item) => item !== id)
    : [...state.selectedChecks, id];
  return { ...state, selectedChecks };
}

export function verifyRecovery(state) {
  if (state.phase !== "verify") return state;
  const selected = new Set(state.selectedChecks);
  const misleading = state.caseInfo.checks.find(({ correct, id }) => !correct && selected.has(id));
  const missing = state.caseInfo.checks.some(({ correct, id }) => correct && !selected.has(id));
  const attempts = { ...state.attempts, verifications: state.attempts.verifications + 1 };
  if (misleading || missing) {
    const text = misleading?.feedback || "復旧を判断するには、関連する証拠をもう少し確認する必要があります。症状と原因の両方について、回復を示せる項目を選んでください。";
    return { ...state, attempts, feedback: { kind: "error", text } };
  }
  return {
    ...state,
    phase: "complete",
    attempts,
    feedback: { kind: "success", text: state.caseInfo.resolution.verify },
  };
}

function markdownInline(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[&<>]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]))
    .replace(/[\\`*_{}\[\]()#+.!|~]/gu, "\\$&");
}

function markdownNote(value) {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\r\n?|\u2028|\u2029/gu, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/gu, "")
    .trim().slice(0, maxNotesLength);
  return clean.split("\n").map((line) => `    ${line}`).join("\n").trimEnd();
}

export function createIncidentReport(state, { notes } = {}) {
  if (state.phase !== "complete") return null;
  const { caseInfo, openedEvidence, selectedChecks, confirmedHypothesisId, confirmedActionId } = state;
  const { title, service, startedAt, symptom, impact, context, resolution } = caseInfo;
  const evidence = openedEvidence.map((id) => caseInfo.evidence.find((item) => item.id === id));
  const hypothesis = caseInfo.hypotheses.find(({ id }) => id === confirmedHypothesisId);
  const action = caseInfo.actions.find(({ id }) => id === confirmedActionId);
  const checks = caseInfo.checks.filter(({ id }) => selectedChecks.includes(id));
  const note = markdownNote(notes);
  const lines = [
    `# ${markdownInline(title)} — 障害対応レポート`,
    "",
    "学習用の架空シナリオです。",
    "",
    "## 概要",
    "",
    `- 発生時刻 — ${markdownInline(startedAt)}`,
    `- 対象 — ${markdownInline(service)}`,
    `- 症状 — ${markdownInline(symptom)}`,
    `- 影響 — ${markdownInline(impact)}`,
    `- 背景 — ${markdownInline(context)}`,
    "",
    "## 調査で確認した証拠",
    "",
    ...evidence.map((item) => `- ${markdownInline(item.title)} — ${markdownInline(item.summary)}`),
    "",
    "## 原因と対応",
    "",
    `- 確認した原因 — ${markdownInline(hypothesis.label)}`,
    `- 診断の根拠 — ${markdownInline(resolution.cause)}`,
    `- 選んだ対応 — ${markdownInline(action.label)}`,
    `- 対応の要点 — ${markdownInline(resolution.mitigation)}`,
    "",
    "## 復旧確認",
    "",
    ...checks.map(({ label }) => `- ${markdownInline(label)}`),
    "",
    markdownInline(resolution.verify),
    "",
    "## 再発防止",
    "",
    ...resolution.followUp.map((item) => `- ${markdownInline(item)}`),
  ];
  if (note) lines.push("", "## 自分のメモ", "", note);
  return lines.join("\n") + "\n";
}
