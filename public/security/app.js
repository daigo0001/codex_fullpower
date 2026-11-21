import { analyzeHeaders, MAX_INPUT_LENGTH } from "./analysis.js";

const SAMPLE = `HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31536000
content-security-policy-report-only: default-src 'self'; object-src 'none'; base-uri 'self'
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
cache-control: private, no-store
set-cookie: __Host-demo=example; Path=/; Secure; HttpOnly; SameSite=Lax`;

const STATUSES = [
  { id: "fail", label: "要対応" },
  { id: "warn", label: "見直し" },
  { id: "pass", label: "良好" },
  { id: "info", label: "参考" },
];
const statusLabel = new Map(STATUSES.map(({ id, label }) => [id, label]));
const numberFormat = new Intl.NumberFormat("ja-JP");
const format = (value) => numberFormat.format(value);
const byId = (id) => document.getElementById(id);

const editor = byId("header-input");
const editorMode = byId("editor-mode");
const lineNumbers = byId("line-numbers");
const inputSize = byId("input-size");
const inputFeedback = byId("input-feedback");
const dropZone = byId("drop-zone");
const fileInput = byId("file-input");
const download = byId("download");
const reportMeta = byId("report-meta");
const reportStatus = byId("report-status");
const reportNotes = byId("report-notes");
const reportContent = byId("report-content");
const reportStats = byId("report-stats");
const findings = byId("findings");
const visibleCount = byId("visible-count");
const showAll = byId("show-all");
const emptyReport = byId("empty-report");

let result;
let analyzedText = "";
let filter = null;
let dragDepth = 0;
let importVersion = 0;

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function textFootnote() {
  const text = editor.value;
  if (text.length > MAX_INPUT_LENGTH) {
    lineNumbers.textContent = "";
    inputSize.textContent = `${format(text.length)} 文字`;
    return;
  }
  const totalLines = text.split("\n").length;
  lineNumbers.textContent = Array.from({ length: totalLines }, (_, index) => index + 1).join("\n");
  lineNumbers.scrollTop = editor.scrollTop;
  inputSize.textContent = `${format(text.length)} 文字 · ${format(text === "" ? 0 : totalLines)} 行`;
}

function updateDownload() {
  const stale = Boolean(result) && analyzedText !== editor.value;
  reportStatus.hidden = !stale;
  reportStatus.textContent = stale ? "入力が変更されました。再診断するとレポートを保存できます。" : "";
  download.disabled = stale || !result?.issues.length;
}

function setInput(value, mode) {
  editor.value = value;
  editor.scrollTop = 0;
  editor.scrollLeft = 0;
  editorMode.textContent = mode;
  inputFeedback.textContent = "";
  textFootnote();
  updateDownload();
}

function countsByStatus() {
  const counts = Object.fromEntries(STATUSES.map(({ id }) => [id, 0]));
  for (const issue of result.issues) counts[issue.status] += 1;
  return counts;
}

function reflectFilter() {
  for (const button of reportStats.children) {
    const active = button.dataset.kind === filter;
    button.setAttribute("aria-pressed", String(active));
  }
  let count = 0;
  for (const item of findings.children) {
    item.hidden = filter !== null && filter !== item.dataset.kind;
    if (!item.hidden) {
      count += 1;
      item.open = count === 1 && ["fail", "warn"].includes(item.dataset.kind);
    }
  }
  visibleCount.textContent = `${count} / ${result.issues.length}`;
  showAll.hidden = filter === null;
}

function renderFindings() {
  const counts = countsByStatus();
  const buttons = STATUSES.map(({ id, label }) => {
    const button = element("button", "stat");
    button.type = "button";
    button.dataset.kind = id;
    button.disabled = counts[id] === 0;
    button.append(element("span", "", label), element("strong", "", String(counts[id])));
    button.addEventListener("click", () => {
      filter = filter === id ? null : id;
      reflectFilter();
    });
    return button;
  });
  reportStats.replaceChildren(...buttons);

  const rank = STATUSES.map(({ id }) => id);
  const sortedIssues = [...result.issues].sort((first, second) => rank.indexOf(first.status) - rank.indexOf(second.status));
  findings.replaceChildren(...sortedIssues.map((issue) => {
    const item = element("details", "finding");
    item.dataset.kind = issue.status;
    const summary = element("summary");
    summary.append(element("span", "finding-status", statusLabel.get(issue.status)), element("span", "finding-title", issue.title));
    const details = element("div", "finding-content");
    if (issue.detail) details.append(element("p", "", issue.detail));
    if (issue.evidence) details.append(element("p", "finding-evidence", issue.evidence));
    if (issue.recommendation) details.append(element("p", "finding-recommendation", issue.recommendation));
    item.append(summary, details);
    return item;
  }));
  reflectFilter();
}

function renderReport() {
  const hasFindings = Boolean(result?.issues.length);
  reportContent.hidden = !hasFindings;
  emptyReport.hidden = hasFindings || Boolean(result?.notes.length);
  reportNotes.hidden = !result?.notes.length;
  reportNotes.replaceChildren(...(result?.notes ?? []).map((text) => element("li", "", text)));
  if (hasFindings) {
    const metadata = [result.httpStatus ? `HTTP ${result.httpStatus}` : null, `ヘッダー ${result.headerCount} 件`];
    if (result.responses > 1) metadata.push(`最終レスポンスを診断 (${result.responses} 件中)`);
    if (result.score !== null) metadata.push(`点検スコア ${result.score} / 100`);
    reportMeta.textContent = metadata.filter(Boolean).join(" · ");
    renderFindings();
  } else {
    reportMeta.textContent = "";
  }
  updateDownload();
}

function runAnalysis() {
  inputFeedback.textContent = "";
  const text = editor.value;
  if (!text.trim()) {
    inputFeedback.textContent = "レスポンスヘッダーを入力してください。";
    editor.focus();
    return;
  }

  let next;
  try {
    next = analyzeHeaders(text);
  } catch (error) {
    inputFeedback.textContent = error instanceof RangeError ? error.message : "入力を解析できませんでした。";
    editor.focus();
    return;
  }
  result = next;
  analyzedText = text;
  filter = null;
  renderReport();
}

async function importTextFile(file) {
  const version = ++importVersion;
  if (file.size > MAX_INPUT_LENGTH * 4) {
    inputFeedback.textContent = "ファイルが大きすぎます。レスポンスヘッダーの部分だけを読み込んでください。";
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    if (version === importVersion) inputFeedback.textContent = "ファイルを開けませんでした。";
    return;
  }
  if (version !== importVersion) return;
  if (text.length > MAX_INPUT_LENGTH || text.includes("\u0000")) {
    inputFeedback.textContent = `UTF-8 のテキストファイルを ${format(MAX_INPUT_LENGTH)} 文字以内で読み込んでください。`;
    return;
  }
  setInput(text, "ファイル");
  runAnalysis();
}

function markdownText(value) {
  return value.replace(/[\r\n]+/g, " ").replace(/[&<>]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
  })[character]).replace(/[\\`*_[\]|]/g, "\\$&");
}

function saveReport() {
  if (download.disabled) return;
  const counts = countsByStatus();
  const markdown = [
    "# Header Guard 診断レポート",
    "",
    markdownText(reportMeta.textContent),
    "",
    STATUSES.map(({ id, label }) => `${label} ${counts[id]}`).join(" / "),
    "",
    ...result.notes.map((note) => `- ${markdownText(note)}`),
    ...(result.notes.length ? [""] : []),
    ...result.issues.flatMap((issue) => [
      `## ${statusLabel.get(issue.status)} — ${markdownText(issue.title)}`,
      "",
      ...[issue.detail, issue.evidence, issue.recommendation].filter(Boolean).map(markdownText),
      "",
    ]),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = element("a");
  anchor.href = url;
  anchor.download = "header-guard-report.md";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function loadSample() {
  importVersion += 1;
  setInput(SAMPLE, "サンプル");
  runAnalysis();
}

byId("scan").addEventListener("submit", (event) => {
  event.preventDefault();
  runAnalysis();
});
editor.addEventListener("input", () => {
  importVersion += 1;
  editorMode.textContent = "入力中";
  inputFeedback.textContent = editor.value.length > MAX_INPUT_LENGTH
    ? `入力は ${format(MAX_INPUT_LENGTH)} 文字以内にしてください。`
    : "";
  textFootnote();
  updateDownload();
});
editor.addEventListener("scroll", () => { lineNumbers.scrollTop = editor.scrollTop; });
editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    runAnalysis();
  }
});
byId("sample").addEventListener("click", loadSample);
byId("clear").addEventListener("click", () => {
  importVersion += 1;
  result = undefined;
  analyzedText = "";
  filter = null;
  setInput("", "");
  renderReport();
  editor.focus();
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (file) importTextFile(file);
});
dropZone.addEventListener("dragenter", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add("drag-active");
});
dropZone.addEventListener("dragover", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
dropZone.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropZone.classList.remove("drag-active");
});
dropZone.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("drag-active");
  if (files.length === 1) importTextFile(files[0]);
  else inputFeedback.textContent = "ファイルを 1 つずつ開いてください。";
});
showAll.addEventListener("click", () => {
  const previousFilter = filter;
  filter = null;
  reflectFilter();
  reportStats.querySelector(`[data-kind="${previousFilter}"]`)?.focus();
});
download.addEventListener("click", saveReport);
loadSample();
