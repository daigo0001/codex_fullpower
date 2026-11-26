import { renderGuide } from "./guide.js";
import { mountDelivery } from "./delivery.js";
import { mountWbs } from "./wbs.js";
import { renderTemplate, renderTemplatePack, templates } from "./templates.js";

const $ = (id) => document.getElementById(id);
const icons = {
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 20v-2c0-3.2 2.6-5 7-5s7 1.8 7 5v2"/>',
  team: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2c0-2.9 2.2-5 6-5s6 2.1 6 5v2m1.5-15a3 3 0 0 1 0 6m1 2.5c2.3.7 3.5 2.4 3.5 4.5v2"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  route: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6"/>',
  tasks: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="m8 10 1 1 2-2m2 1h3m-8 5 1 1 2-2m2 1h3"/>',
  screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M3 8h18"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  server: '<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><path d="M8 7h.01M8 17h.01m4-10h5m-5 10h5"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3V6Z"/>',
  list: '<path d="M10 6h10m-10 6h10m-10 6h10M4 6h1m-1 6h1m-1 6h1"/>',
  file: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4m-9 4h6m-6 4h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  download: '<path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5"/>',
};
for (const element of document.querySelectorAll("[data-icon]")) {
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${icons[element.dataset.icon]}</svg>`;
}

const modeKey = "codex-lab.planning-mode";
function savedMode() {
  try {
    if (localStorage.getItem(modeKey) === "team") return "team";
  } catch {
    // The guide can still be used when browser storage is unavailable.
  }
  return "solo";
}

const topicLinks = [...document.querySelectorAll("[data-topic]")];
const topics = new Set(topicLinks.map(({ dataset }) => dataset.topic));
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const sampleButtons = [...document.querySelectorAll("[data-template-sample]")];
const templateSelect = $("template-select");
const projectName = $("project-name");
const preview = $("template-preview");
const templateStatus = $("template-status");
let mode = savedMode();
let sample = true;
let wbsMounted = false;
let delivery;

templateSelect.replaceChildren(...templates.map(({ id, title }) => new Option(title, id)));

function templateOptions() {
  return { projectName: projectName.value, mode, sample };
}

function displayTemplate() {
  const item = templates.find(({ id }) => id === templateSelect.value) ?? templates[0];
  $("template-filename").textContent = item.filename;
  $("template-description").textContent = item.description;
  preview.textContent = renderTemplate(item.id, templateOptions());
  preview.scrollTop = 0;
  templateStatus.textContent = "";
  for (const button of sampleButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.templateSample === String(sample)));
  }
}

function renderPage() {
  const requested = location.hash.slice(1);
  const topic = topics.has(requested) ? requested : "delivery";
  const isDelivery = topic === "delivery";
  const isWbs = topic === "wbs";
  const isTemplate = topic === "templates";
  const isGuide = !isDelivery && !isWbs && !isTemplate;
  $("workbench").dataset.wide = String(isDelivery || isWbs);
  $("guide").hidden = !isGuide;
  $("delivery-view").hidden = !isDelivery;
  $("wbs").hidden = !isWbs;
  $("template-view").hidden = !isTemplate;
  for (const link of topicLinks) {
    if (link.dataset.topic === topic) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  if (isDelivery) {
    delivery ??= mountDelivery($("delivery-view"), { saveFile });
    delivery.setMode(mode);
    return $("delivery-view");
  }
  if (isGuide) renderGuide($("guide"), topic, { mode });
  if (isTemplate) displayTemplate();
  if (isWbs && !wbsMounted) {
    mountWbs($("wbs"));
    wbsMounted = true;
  }
  return isGuide ? $("guide") : isWbs ? $("wbs") : $("template-view");
}

function showSelectedPanel(panel) {
  panel.tabIndex = -1;
  panel.focus({ preventScroll: true });
  $("workbench").scrollIntoView({ block: "start" });
}

window.addEventListener("hashchange", () => showSelectedPanel(renderPage()));
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (link.hash === location.hash && topics.has(link.hash.slice(1))) {
    event.preventDefault();
    showSelectedPanel(renderPage());
  }
});

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    try {
      localStorage.setItem(modeKey, mode);
    } catch {
      // The selected mode still applies until the page is closed.
    }
    renderPage();
  });
}
for (const button of sampleButtons) {
  button.addEventListener("click", () => {
    sample = button.dataset.templateSample === "true";
    displayTemplate();
  });
}
templateSelect.addEventListener("change", displayTemplate);
projectName.addEventListener("input", displayTemplate);

function saveFile(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveMarkdown(filename, text) {
  saveFile(filename, text, "text/markdown;charset=utf-8");
  templateStatus.textContent = "Markdown ファイルの保存を開始しました。";
}

$("download-template").addEventListener("click", () => {
  const item = templates.find(({ id }) => id === templateSelect.value) ?? templates[0];
  saveMarkdown(item.filename, preview.textContent);
});
$("download-pack").addEventListener("click", () => saveMarkdown("design-pack.md", renderTemplatePack(templateOptions())));
$("copy-template").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(preview.textContent);
    templateStatus.textContent = "Markdown をコピーしました。";
  } catch {
    const selection = document.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(preview);
    preview.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    templateStatus.textContent = "選択した Markdown をコピーしてください。";
  }
});

renderPage();
