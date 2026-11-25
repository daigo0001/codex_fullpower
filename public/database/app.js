import { renderDatabaseGuide } from "./guide.js";
import { mountIndexWorkbench } from "./index-workbench.js";
import { mountTransactionLab } from "./transactions.js";

const $ = (id) => document.getElementById(id);
const icons = {
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  activity: '<path d="M4 4v16h16M8 15l4-5 4 3 4-7"/>',
  diagram: '<rect x="4" y="3" width="6" height="6" rx="1"/><rect x="14" y="15" width="6" height="6" rx="1"/><path d="M7 9v9h7M10 6h7v9"/>',
  check: '<path d="M12 21s7-3.4 7-8.9V5l-7-3-7 3v7.1C5 17.6 12 21 12 21Z"/><path d="m9 11 2 2 4-4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  arrows: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  book: '<path d="M7 3h12v18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm-3 15a3 3 0 0 1 3-3h12M8 7h7m-7 4h5"/>',
};

for (const element of document.querySelectorAll("[data-icon]")) {
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${icons[element.dataset.icon]}</svg>`;
}

const links = [...document.querySelectorAll("[data-topic]")];
const topics = new Set(links.map(({ dataset }) => dataset.topic));
const labs = {
  indexes: { panel: $("index-lab"), mount: mountIndexWorkbench },
  concurrency: { panel: $("transaction-lab"), mount: mountTransactionLab },
};
const mounted = new Set();

function changeTopic({ focus = false } = {}) {
  const fragment = location.hash.slice(1);
  const topic = topics.has(fragment) ? fragment : "design";
  const lab = labs[topic];
  const guide = $("rdb-guide");
  guide.hidden = Boolean(lab);
  for (const [name, { panel }] of Object.entries(labs)) panel.hidden = topic !== name;
  $("workbench").dataset.wide = String(Boolean(lab));
  for (const link of links) {
    if (link.dataset.topic === topic) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  if (!lab) {
    renderDatabaseGuide(guide, topic);
  } else if (!mounted.has(topic)) {
    lab.mount(lab.panel);
    mounted.add(topic);
  }

  if (focus) {
    const activePanel = lab?.panel ?? guide;
    activePanel.tabIndex = -1;
    activePanel.focus({ preventScroll: true });
    $("workbench").scrollIntoView({ block: "start" });
  }
}

window.addEventListener("hashchange", () => changeTopic({ focus: true }));
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (link.hash === location.hash && topics.has(link.hash.slice(1))) {
    event.preventDefault();
    changeTopic({ focus: true });
  }
});
changeTopic();
