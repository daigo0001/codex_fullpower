import { actors, scenarios, getTimeline } from "./scenarios.js";
import { renderTopology, renderSequence } from "./diagram.js";

const $ = (id) => document.getElementById(id);
const icons = {
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  link: '<path d="M10 13a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6m2.6 5.8a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 1 0 6.4 6.4l1.6-1.6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v2.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
  alert: '<path d="M12 8v5m0 3.5v.5"/><circle cx="12" cy="12" r="9"/>',
  previous: '<path d="M6 5v14m12-13L9 12l9 6V6Z"/>',
  next: '<path d="M18 5v14M6 6l9 6-9 6V6Z"/>',
  play: '<path d="m9 5 10 7-10 7V5Z" fill="currentColor"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="3"/>',
};

const presentation = {
  https: { icon: "lock", caption: "TCP + TLS 1.3" },
  cache: { icon: "layers", caption: "エッジで応答" },
  http3: { icon: "bolt", caption: "QUIC + TLS 1.3" },
  "dns-error": { icon: "alert", caption: "接続前に停止" },
};

function svg(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

for (const element of document.querySelectorAll("[data-icon]")) element.innerHTML = svg(element.dataset.icon);

const actorById = new Map(actors.map((actor) => [actor.id, actor]));
const scenarioButtons = new Map();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const state = { scenario: scenarios[0], timeline: [], active: 0, playing: false, timer: null };

for (const scenario of scenarios) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scenario-button";
  button.dataset.scenario = scenario.id;
  button.setAttribute("aria-pressed", "false");
  const symbol = document.createElement("span");
  symbol.className = "scenario-icon";
  symbol.innerHTML = svg(presentation[scenario.id].icon);
  const copy = document.createElement("span");
  const name = document.createElement("span");
  name.className = "scenario-name";
  name.textContent = scenario.name;
  const caption = document.createElement("span");
  caption.className = "scenario-kind";
  caption.textContent = presentation[scenario.id].caption;
  copy.append(name, caption);
  button.append(symbol, copy);
  button.addEventListener("click", () => setScenario(scenario, 0));
  scenarioButtons.set(scenario.id, button);
  $("scenario-options").append(button);
}

function currentStep() {
  return state.timeline[state.active];
}

function isLastStep() {
  return state.active === state.timeline.length - 1;
}

function drawTopology() {
  renderTopology($("topology"), {
    actors, steps: state.timeline, activeIndex: state.active,
    motion: state.playing && !reduceMotion.matches,
  });
}

function renderControls() {
  const current = currentStep();
  $("previous").disabled = state.active === 0;
  $("next").disabled = isLastStep();
  const label = state.playing ? "一時停止" : isLastStep() ? "最初から再生" : "再生";
  const play = $("play");
  play.firstElementChild.innerHTML = svg(state.playing ? "pause" : "play");
  play.title = label;
  play.setAttribute("aria-label", label);
  const range = $("scrubber");
  range.max = state.timeline.length;
  range.value = state.active + 1;
  range.setAttribute("aria-valuetext", `${state.active + 1} / ${state.timeline.length} ${current.title}`);
  range.style.setProperty("--progress", `${state.active / Math.max(1, state.timeline.length - 1) * 100}%`);
  $("playback-position").value = `${current.start}–${current.end} ms`;
}

function renderDetail(step) {
  $("detail-heading").closest(".detail-panel").dataset.category = step.category;
  $("step-number").textContent = `${String(state.active + 1).padStart(2, "0")} / ${state.timeline.length}`;
  $("step-layer").textContent = `${step.protocol} · ${step.layer}`;
  $("step-title").textContent = step.title;
  $("step-description").textContent = step.description;
  $("step-from").textContent = actorById.get(step.from).name;
  $("step-to").textContent = actorById.get(step.to).name;
  const rows = step.data.map(({ label, value }) => {
    const row = document.createElement("div");
    const labelNode = document.createElement("dt");
    labelNode.textContent = label;
    const valueNode = document.createElement("dd");
    valueNode.textContent = value;
    row.append(labelNode, valueNode);
    return row;
  });
  $("step-data").replaceChildren(...rows);
}

function renderStep() {
  renderControls();
  drawTopology();
  renderDetail(currentStep());
  renderSequence($("sequence"), {
    actors, timeline: state.timeline, activeIndex: state.active,
    onSelect: (index) => setStep(index),
  });
}

function getSelectionURL() {
  const url = new URL(location.href);
  url.hash = `${state.scenario.id}/${state.active + 1}`;
  return url;
}

function saveSelection() {
  history.replaceState(null, "", getSelectionURL());
}

function cancelPlayback() {
  clearTimeout(state.timer);
  state.timer = null;
  state.playing = false;
}

function setScenario(scenario, initial, { writeUrl = true } = {}) {
  cancelPlayback();
  state.scenario = scenario;
  state.timeline = getTimeline(scenario);
  state.active = Math.max(0, Math.min(initial, state.timeline.length - 1));
  for (const [id, button] of scenarioButtons) button.setAttribute("aria-pressed", String(id === scenario.id));
  $("scenario-summary").textContent = scenario.summary;
  $("scenario-condition").textContent = scenario.initialCondition;
  const outcome = $("scenario-outcome");
  outcome.textContent = scenario.outcome;
  outcome.dataset.error = String(scenario.id === "dns-error");
  $("timeline-duration").textContent = `${state.timeline.at(-1).end} ms`;
  renderStep();
  if (writeUrl) saveSelection();
}

function setStep(index) {
  cancelPlayback();
  state.active = Math.max(0, Math.min(index, state.timeline.length - 1));
  renderStep();
  saveSelection();
}

function schedulePlayback() {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    if (isLastStep()) {
      cancelPlayback();
      renderControls();
      drawTopology();
      return;
    }
    state.active += 1;
    renderStep();
    saveSelection();
    schedulePlayback();
  }, 1650 / Number($("speed").value));
}

function togglePlayback() {
  if (state.playing) {
    cancelPlayback();
    renderControls();
    drawTopology();
    return;
  }
  if (isLastStep()) state.active = 0;
  state.playing = true;
  renderStep();
  saveSelection();
  schedulePlayback();
}

function applyLocation() {
  const match = /^#([\w-]+)\/([1-9]\d{0,2})$/.exec(location.hash);
  const scenario = scenarios.find(({ id }) => id === match?.[1]) ?? scenarios[0];
  const step = match ? Number(match[2]) - 1 : 0;
  setScenario(scenario, step, { writeUrl: false });
}

$("previous").addEventListener("click", () => setStep(state.active - 1));
$("next").addEventListener("click", () => setStep(state.active + 1));
$("play").addEventListener("click", togglePlayback);
$("scrubber").addEventListener("input", (event) => setStep(Number(event.currentTarget.value) - 1));
$("speed").addEventListener("change", () => { if (state.playing) schedulePlayback(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.playing) togglePlayback();
});
reduceMotion.addEventListener("change", drawTopology);
window.addEventListener("hashchange", applyLocation);

$("share").addEventListener("click", () => {
  if (state.playing) togglePlayback();
  $("share-url").value = getSelectionURL().href;
  $("share-status").textContent = "";
  $("share-dialog").showModal();
  $("share-url").select();
});

$("copy").addEventListener("click", async () => {
  const share = $("share-url");
  try {
    await navigator.clipboard.writeText(share.value);
    $("share-status").textContent = "共有リンクをコピーしました。";
  } catch {
    share.focus();
    share.select();
    $("share-status").textContent = "選択したリンクをコピーしてください。";
  }
});

applyLocation();
