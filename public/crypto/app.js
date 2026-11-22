import { renderGuide } from "./guide.js";
import {
  bytesToHex, createDemoKey, decryptMessage, encryptMessage, hashPassword, verifyPassword,
} from "./demos.js";

const $ = (id) => document.getElementById(id);
const icons = {
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  fingerprint: '<path d="M3 11a9 9 0 0 1 18 0m-15 3v-3a6 6 0 0 1 12 0v4m-9 6c1.8-2.8 3-6.2 3-10m-6 8a10 10 0 0 0 3-7v-1a3 3 0 0 1 6 0c0 3.5-.8 6.9-2.2 10m5-2.5.3-1.5"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v2.5"/>',
  archive: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M3 4h18v4H3zm7 8h4"/>',
  check: '<path d="M12 22s7-3.7 7-9.3V5l-7-3-7 3v7.7C5 18.3 12 22 12 22Z"/><path d="m9 12 2 2 4-4"/>',
  key: '<circle cx="8.5" cy="9" r="4.5"/><path d="m12 12 7 7m-3.5-3.5 2.3-2.3m-5 0 2.5-2.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5m0 3.5v.5"/>',
};

for (const element of document.querySelectorAll("[data-icon]")) {
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${icons[element.dataset.icon]}</svg>`;
}

const topicLinks = [...document.querySelectorAll("[data-topic]")];
const topics = new Set(topicLinks.map((link) => link.dataset.topic));
const labs = {
  password: { id: "password-demo", label: "ハッシュの実験へ" },
  encryption: { id: "encryption-demo", label: "暗号化の実験へ" },
  zip: { id: "zip-check", label: "ZIP の選び方を試す" },
};

function showTopic() {
  const requested = location.hash.slice(1);
  const topic = topics.has(requested) ? requested : "overview";
  for (const link of topicLinks) {
    if (link.dataset.topic === topic) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  for (const [lab, { id }] of Object.entries(labs)) $(id).hidden = lab !== topic;
  const guide = $("guide");
  renderGuide(guide, topic);
  const activeLab = labs[topic];
  if (activeLab) {
    const shortcut = document.createElement("button");
    shortcut.type = "button";
    shortcut.className = "button secondary lab-shortcut";
    shortcut.textContent = activeLab.label + " ↓";
    shortcut.addEventListener("click", () => {
      const panel = $(activeLab.id);
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: "start" });
    });
    const heading = guide.querySelector("h2");
    if (heading) heading.after(shortcut);
    else guide.prepend(shortcut);
  }
}

function setStatus(element, text, variant = "") {
  element.dataset.variant = variant;
  element.textContent = text;
}

const cryptoReady = globalThis.isSecureContext && Boolean(globalThis.crypto?.subtle);
const secureOriginHelp = "この実験には HTTPS または localhost が必要です。";
const hashStatus = $("hash-status");
const cipherStatus = $("cipher-status");
const hashSource = $("hash-input");
const verifySource = $("verify-input");
const hashGenerate = $("hash-generate");
const hashVerify = $("hash-verify");
let storedPassword = null;

function setHashBusy(busy) {
  hashSource.disabled = busy;
  verifySource.disabled = busy;
  hashGenerate.disabled = !cryptoReady || busy;
  hashVerify.disabled = !cryptoReady || busy || storedPassword === null;
}

function showHashRecord(record, slot) {
  $(`salt-${slot}`).textContent = bytesToHex(record.salt);
  $(`hash-${slot}`).textContent = bytesToHex(record.hash);
}

$("hash-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (hashGenerate.disabled) return;
  const source = hashSource.value;
  storedPassword = null;
  $("hash-records").hidden = true;
  setHashBusy(true);
  setStatus(hashStatus, "異なるソルトで計算中…");
  try {
    const [first, second] = await Promise.all([hashPassword(source), hashPassword(source)]);
    storedPassword = first;
    showHashRecord(first, "a");
    showHashRecord(second, "b");
    $("hash-records").hidden = false;
    setStatus(hashStatus, "同じ入力でも、ソルトが異なるとハッシュが変わります。", "positive");
  } catch (error) {
    setStatus(hashStatus, error instanceof RangeError ? error.message : "ハッシュを生成できませんでした。", "negative");
  } finally {
    setHashBusy(false);
  }
});

$("verify-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (hashVerify.disabled) return;
  const candidate = verifySource.value;
  setHashBusy(true);
  setStatus(hashStatus, "レコード A のソルトを使って照合中…");
  try {
    const matches = await verifyPassword(candidate, storedPassword);
    setStatus(hashStatus, matches ? "一致しました。レコード A と同じハッシュです。" : "一致しません。入力が異なります。", matches ? "positive" : "negative");
  } catch (error) {
    setStatus(hashStatus, error instanceof RangeError ? error.message : "照合できませんでした。", "negative");
  } finally {
    setHashBusy(false);
  }
});

const cipherSource = $("cipher-input");
const cipherEncrypt = $("cipher-encrypt");
const cipherDecrypt = $("cipher-decrypt");
const cipherTamper = $("cipher-tamper");
const cipherPlaintext = $("cipher-plaintext");
let key = null;
let record = null;

function setCipherBusy(busy) {
  cipherSource.disabled = busy;
  cipherEncrypt.disabled = !cryptoReady || busy;
  cipherDecrypt.disabled = !cryptoReady || busy || record === null;
  cipherTamper.disabled = cipherDecrypt.disabled;
}

$("cipher-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (cipherEncrypt.disabled) return;
  const source = cipherSource.value;
  record = null;
  $("cipher-record").hidden = true;
  cipherPlaintext.hidden = true;
  cipherPlaintext.textContent = "";
  setCipherBusy(true);
  setStatus(cipherStatus, "暗号化中…");
  try {
    key ??= await createDemoKey();
    record = await encryptMessage(source, key);
    $("cipher-nonce").textContent = bytesToHex(record.nonce);
    $("cipher-text").textContent = record.ciphertext.length ? bytesToHex(record.ciphertext) : "空（0バイト）";
    $("cipher-tag").textContent = bytesToHex(record.tag);
    $("cipher-record").hidden = false;
    setStatus(cipherStatus, "暗号化しました。ノンスは暗号化するたびに新しく生成します。", "positive");
  } catch (error) {
    setStatus(cipherStatus, error instanceof RangeError ? error.message : "暗号化できませんでした。", "negative");
  } finally {
    setCipherBusy(false);
  }
});

async function decrypt(tamper) {
  if (cipherDecrypt.disabled) return;
  let encrypted = record;
  cipherPlaintext.hidden = true;
  cipherPlaintext.textContent = "";
  if (tamper) {
    const field = record.ciphertext.length ? "ciphertext" : "tag";
    const modified = record[field].slice();
    modified[0] ^= 1;
    encrypted = { ...record, [field]: modified };
  }
  setCipherBusy(true);
  try {
    const plaintext = await decryptMessage(encrypted, key);
    cipherPlaintext.textContent = plaintext || "空のメッセージ";
    cipherPlaintext.hidden = false;
    setStatus(cipherStatus, "復号できました。", "positive");
  } catch (error) {
    if (tamper && error.name === "OperationError") {
      setStatus(cipherStatus, "改変を検出したため復号を拒否しました。元の暗号文は残っています。", "positive");
    } else {
      setStatus(cipherStatus, "復号できませんでした。", "negative");
    }
  } finally {
    setCipherBusy(false);
  }
}

cipherDecrypt.addEventListener("click", () => decrypt(false));
cipherTamper.addEventListener("click", () => decrypt(true));

const archiveAdvice = {
  compatible: {
    title: "対応形式を確認してから共有する",
    body: "ZIP を開けるソフトでも、AES ZIP に対応しているとは限りません。対応形式が分からなければ、相手が使える共有方法を先に確認します。",
  },
  aes: {
    title: "ファイルの内容の保護に AES ZIP を使う",
    body: "双方で AES ZIP を開けることを確認し、推測されにくいパスフレーズを使います。ファイル名も隠したいときは別の形式を検討します。",
  },
  names: {
    title: "ヘッダー暗号化に対応した 7z を使う",
    body: "7z のヘッダー暗号化を有効にすると、パスフレーズを入力するまでファイル名などが表示されません。相手のソフトの対応も確認します。",
  },
};

function showArchiveAdvice() {
  const { title, body } = archiveAdvice[$("archive-condition").value];
  $("archive-title").textContent = title;
  $("archive-advice").textContent = body;
}

$("archive-condition").addEventListener("change", showArchiveAdvice);
window.addEventListener("hashchange", showTopic);
if (!cryptoReady) {
  setStatus(hashStatus, secureOriginHelp, "negative");
  setStatus(cipherStatus, secureOriginHelp, "negative");
  setHashBusy(false);
  setCipherBusy(false);
}
showArchiveAdvice();
showTopic();
