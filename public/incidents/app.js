import { cloudCases } from "./cloud-cases.js";
import { appCases } from "./app-cases.js";
import {
  MIN_EVIDENCE, createExercise, openEvidence, submitHypothesis, submitAction,
  toggleCheck, verifyRecovery, createIncidentReport,
} from "./engine.js";

const $ = (id) => document.getElementById(id);
const cases = [...cloudCases, ...appCases];
const runs = new Map();
const caseButtons = new Map();
const phaseItems = [...document.querySelectorAll("[data-phase]")];
const phaseLabels = {
  investigate: {
    intro: "証拠を二つ以上読み、症状を説明できる仮説を選びます。",
    legend: "最も根拠のある原因は？",
    submit: "仮説を検証する",
    choices: "hypotheses",
  },
  respond: {
    intro: "確認した原因に対して、影響を抑えられる対応を選びます。",
    legend: "次にとる対応は？",
    submit: "対応を確認する",
    choices: "actions",
  },
  verify: {
    intro: "対応後、何を見て復旧と判断できるか考えます。",
    legend: "復旧の根拠になる項目をすべて選ぶ",
    submit: "復旧を判定する",
    choices: "checks",
  },
};
const kindLabels = { metrics: "メトリクス", logs: "ログ", config: "構成", change: "変更履歴" };
const kindIcons = { metrics: "activity", logs: "terminal", config: "settings", change: "history" };
const caseIcons = { gateway: "activity", "private-dns": "network", "db-lock": "database", "auth-cookie": "lock" };
const lessons = {
  gateway: { path: "../azure/#ingress/2", label: "Gateway の経路を見る" },
  "private-dns": { path: "../azure/#dns-missing/6", label: "Blob への経路を見る" },
  "db-lock": { path: "../planning/#detail", label: "貸出の詳細設計を見る" },
  "auth-cookie": { path: "../mvc/#auth/6", label: "認可の流れを見る" },
};
const icons = {
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  book: '<path d="M7 3h12v18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm-3 15a3 3 0 0 1 3-3h12M8 7h7m-7 4h5"/>',
  download: '<path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  restart: '<path d="M6.5 7A7 7 0 1 1 5 15M5 4v5h5"/>',
  activity: '<path d="M3 13h4l3-7 3 12 2-5h6"/>',
  terminal: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 10 2 2-2 2m5 0h4"/>',
  settings: '<path d="M4 7h5m4 0h7M4 12h10m4 0h2M4 17h2m4 0h10"/><circle cx="11" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="17" r="2"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  network: '<rect x="4" y="4" width="5" height="5" rx="1"/><rect x="15" y="15" width="5" height="5" rx="1"/><path d="M9 6.5h8.5v8.5M6.5 9v8.5H15"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v2.5"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

for (const element of document.querySelectorAll("[data-icon]")) {
  element.innerHTML = icon(element.dataset.icon);
}

let current;

function shuffle(choices) {
  const options = [...choices];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [options[index], options[swap]] = [options[swap], options[index]];
  }
  return options;
}

function newRun(caseInfo) {
  const first = caseInfo.evidence[0].id;
  return {
    state: openEvidence(createExercise(caseInfo), first),
    evidenceId: first, choices: { investigate: "", respond: "" },
    options: Object.fromEntries(Object.entries(phaseLabels).map(([phase, { choices }]) => [phase, shuffle(caseInfo[choices])])),
    notes: "",
  };
}

function renderOverview(caseInfo) {
  $("case-title").textContent = caseInfo.title;
  $("case-category").textContent = caseInfo.category;
  $("case-context").textContent = caseInfo.context;
  $("case-service").textContent = caseInfo.service;
  $("case-started").textContent = caseInfo.startedAt;
  $("case-symptom").textContent = caseInfo.symptom;
  $("case-impact").textContent = caseInfo.impact;
  for (const [id, button] of caseButtons) button.setAttribute("aria-pressed", String(caseInfo.id === id));
}

function createEvidenceButtons(caseInfo) {
  return caseInfo.evidence.map(({ id, kind, label }) => {
    const button = make("button", "", label);
    button.type = "button";
    button.dataset.evidence = id;
    const symbol = make("span");
    symbol.dataset.icon = kindIcons[kind];
    symbol.innerHTML = icon(kindIcons[kind]);
    button.prepend(symbol);
    button.addEventListener("click", () => {
      current.evidenceId = id;
      current.state = openEvidence(current.state, id);
      renderEvidence();
      renderDecisionControls();
    });
    return button;
  });
}

function drawChart(chart) {
  const canvas = $("evidence-chart");
  canvas.hidden = !chart?.points.length;
  if (canvas.hidden) {
    canvas.replaceChildren();
    return;
  }
  const format = (value) => `${value}${chart.unit}`;
  const title = make("div", "chart-title");
  title.append(make("strong", "", chart.title), make("span", "", format(chart.points.at(-1))));
  const bars = make("div", "chart-bars");
  bars.setAttribute("role", "img");
  bars.setAttribute("aria-label", `${chart.title}。古い順に ${chart.points.map(format).join("、")}`);
  const maximum = Math.max(1, ...chart.points);
  for (const value of chart.points) {
    const bar = make("span");
    bar.style.height = `${100 * value / maximum}%`;
    bar.title = format(value);
    bars.append(bar);
  }
  const axis = make("div", "chart-axis");
  axis.append(make("span", "", "過去"), make("span", "", "直近"));
  canvas.replaceChildren(title, bars, axis);
}

function renderEvidence() {
  const { caseInfo, openedEvidence } = current.state;
  const selected = caseInfo.evidence.find(({ id }) => id === current.evidenceId);
  $("evidence-count").textContent = `確認済み ${openedEvidence.length} / ${caseInfo.evidence.length}`;
  for (const button of $("evidence-tabs").children) {
    const id = button.dataset.evidence;
    button.setAttribute("aria-pressed", String(id === selected.id));
    button.toggleAttribute("data-seen", openedEvidence.includes(id));
  }
  $("evidence-kind").textContent = kindLabels[selected.kind];
  $("evidence-title").textContent = selected.title;
  $("evidence-summary").textContent = selected.summary;
  $("evidence-body").textContent = selected.body;
  $("evidence-body").scrollTop = 0;
  drawChart(selected.chart);
}

function renderDecisionControls() {
  const { phase, openedEvidence, selectedChecks } = current.state;
  if (phase === "complete") return;
  const missing = MIN_EVIDENCE - openedEvidence.length;
  const choosingChecks = phase === "verify";
  const waitingForEvidence = phase === "investigate" && missing > 0;
  let hint = "";
  if (waitingForEvidence) hint = `証拠をあと${missing}件確認すると仮説を検証できます。`;
  if (choosingChecks) hint = `選択中 ${selectedChecks.length}件`;
  $("decision-hint").hidden = hint === "";
  $("decision-hint").textContent = hint;
  $("decision-submit").disabled = choosingChecks
    ? selectedChecks.length === 0
    : waitingForEvidence || !current.choices[phase];
}

function createChoice({ id, label }, phase) {
  const input = make("input");
  const checking = phase === "verify";
  input.type = checking ? "checkbox" : "radio";
  input.name = "decision";
  input.value = id;
  input.checked = checking ? current.state.selectedChecks.includes(id) : current.choices[phase] === id;
  input.addEventListener("change", () => {
    if (checking) current.state = toggleCheck(current.state, id);
    else if (input.checked) current.choices[phase] = id;
    renderDecisionControls();
  });
  const option = make("label", "choice");
  option.append(input, make("span", "", label));
  return option;
}

function renderDecision() {
  const { phase, caseInfo } = current.state;
  const complete = phase === "complete";
  $("decision-form").hidden = complete;
  $("resolution").hidden = !complete;
  if (complete) {
    $("decision-intro").textContent = "確認した原因、対応、復旧の根拠を記録に残します。";
    const { resolution } = caseInfo;
    $("resolution-cause").textContent = resolution.cause;
    $("resolution-mitigation").textContent = resolution.mitigation;
    $("resolution-verify").textContent = resolution.verify;
    $("resolution-followup").replaceChildren(...resolution.followUp.map((text) => make("li", "", text)));
    const lesson = lessons[caseInfo.id];
    $("resolution-link").href = lesson.path;
    $("resolution-link").textContent = lesson.label;
  } else {
    const wording = phaseLabels[phase];
    $("decision-intro").textContent = wording.intro;
    $("decision-title").textContent = wording.legend;
    $("decision-submit").textContent = wording.submit;
    $("decision-options").replaceChildren(...current.options[phase].map((choice) => createChoice(choice, phase)));
    renderDecisionControls();
  }
}

function renderProgress() {
  const { phase, feedback } = current.state;
  const active = phaseItems.findIndex((step) => step.dataset.phase === phase);
  for (const [index, item] of phaseItems.entries()) {
    if (index === active) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
    item.toggleAttribute("data-done", index < active);
  }
  $("decision-heading").textContent = phaseItems[active].lastElementChild.textContent;
  $("feedback").dataset.kind = feedback?.kind ?? "";
  $("feedback").textContent = phase === "complete" ? "演習の復旧条件を満たしました。" : feedback?.text ?? "";
}

function showCase(caseInfo, { writeHash = false, restart = false } = {}) {
  if (restart || !runs.has(caseInfo.id)) runs.set(caseInfo.id, newRun(caseInfo));
  current = runs.get(caseInfo.id);
  renderOverview(caseInfo);
  $("notes").value = current.notes;
  $("evidence-tabs").replaceChildren(...createEvidenceButtons(caseInfo));
  renderEvidence();
  renderDecision();
  renderProgress();
  if (writeHash) history.replaceState(null, "", `#${caseInfo.id}`);
}

for (const caseInfo of cases) {
  const button = make("button", "scenario-button");
  button.type = "button";
  button.dataset.case = caseInfo.id;
  const glyph = make("span", "scenario-glyph");
  glyph.innerHTML = icon(caseIcons[caseInfo.id]);
  const text = make("span");
  text.append(make("strong", "", caseInfo.title), make("small", "", caseInfo.subtitle));
  button.append(glyph, text);
  button.addEventListener("click", () => showCase(caseInfo, { writeHash: true }));
  caseButtons.set(caseInfo.id, button);
  $("cases").append(button);
}

function getCaseFromHash() {
  return cases.find(({ id }) => "#" + id === location.hash);
}

window.addEventListener("hashchange", () => {
  const next = getCaseFromHash();
  if (next) showCase(next);
});

$("notes").addEventListener("input", () => { current.notes = $("notes").value; });
$("decision-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("decision-submit").disabled) return;
  const { phase } = current.state;
  if (phase === "investigate") current.state = submitHypothesis(current.state, current.choices[phase]);
  if (phase === "respond") current.state = submitAction(current.state, current.choices[phase]);
  if (phase === "verify") current.state = verifyRecovery(current.state);
  renderProgress();
  if (current.state.phase !== phase) {
    renderDecision();
    const heading = $("decision-heading");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
});

const resetDialog = $("reset-dialog");
$("reset").addEventListener("click", () => {
  resetDialog.returnValue = "";
  resetDialog.showModal();
});
resetDialog.addEventListener("close", () => {
  if (resetDialog.returnValue === "reset") showCase(current.state.caseInfo, { restart: true });
});

$("report-download").addEventListener("click", () => {
  const output = createIncidentReport(current.state, { notes: current.notes });
  if (!output) return;
  const url = URL.createObjectURL(new Blob([output], { type: "text/markdown;charset=utf-8" }));
  const anchor = make("a");
  anchor.href = url;
  anchor.download = `incident-${current.state.caseInfo.id}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

showCase(getCaseFromHash() ?? cases[0]);
