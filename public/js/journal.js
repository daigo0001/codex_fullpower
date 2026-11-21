export const LIBRARY_KEY = "yosora.library.v1";

const NOTE_LIMIT = 2000;
const CONDITIONS = ["未記録", "雲が多い", "雲がやや多い", "雲が少ない", "ほぼ快晴", "快晴"];
const TYPE_NAMES = { star: "恒星", planet: "惑星", "deep-sky": "深空天体", moon: "月" };
const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });

function cleanId(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 120 ? value.trim() : null;
}

function cleanDate(value) {
  if (!(typeof value === "string" || value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function cleanRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

function cleanEntry(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanId(value.id);
  const targetId = cleanId(value.targetId);
  const date = cleanDate(value.date);
  const note = typeof value.note === "string" ? value.note.trim() : "";
  if (!id || !targetId || !date || !note || note.length > NOTE_LIMIT) return null;
  return { id, targetId, date, note, rating: cleanRating(value.rating) };
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadLibrary(storage = getDefaultStorage()) {
  let raw;
  let persistenceError = false;
  try {
    raw = storage.getItem(LIBRARY_KEY);
  } catch {
    persistenceError = true;
  }

  let stored;
  try {
    stored = JSON.parse(raw ?? "null");
  } catch {
    stored = null;
  }

  const storedFavorites = Array.isArray(stored?.favorites) ? stored.favorites : [];
  const favorites = new Set(storedFavorites.map(cleanId).filter(Boolean));
  const seenEntries = new Set();
  const storedEntries = Array.isArray(stored?.entries) ? stored.entries : [];
  let entries = storedEntries.map(cleanEntry).filter((entry) => {
    if (!entry || seenEntries.has(entry.id)) return false;
    seenEntries.add(entry.id);
    return true;
  });

  function sortEntries() {
    entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
  sortEntries();

  function persist() {
    try {
      storage.setItem(LIBRARY_KEY, JSON.stringify({ favorites: [...favorites], entries }));
      persistenceError = false;
    } catch {
      persistenceError = true;
    }
  }

  function newEntryId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  return {
    get favorites() { return [...favorites]; },
    get entries() { return entries.map((entry) => ({ ...entry })); },
    get persistenceError() { return persistenceError; },
    hasFavorite(id) {
      return favorites.has(cleanId(id));
    },
    toggleFavorite(value) {
      const id = cleanId(value);
      if (!id) throw new TypeError("天体を選んでください。");
      const removing = favorites.delete(id);
      if (!removing) favorites.add(id);
      persist();
      return !removing;
    },
    addEntry(fields) {
      const entry = cleanEntry({ ...fields, id: newEntryId() });
      if (!entry) throw new TypeError("天体と観測日時を選び、観測メモを入力してください。");
      entries.unshift(entry);
      sortEntries();
      persist();
      return { ...entry };
    },
    deleteEntry(id) {
      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) return false;
      entries.splice(index, 1);
      persist();
      return true;
    },
  };
}

function element(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = content;
  return result;
}

function actionButton(text, modifier, action, label) {
  const button = element("button", `library-button library-button-${modifier}`, text);
  button.type = "button";
  if (label) button.setAttribute("aria-label", label);
  button.addEventListener("click", action);
  return button;
}

function emptyState(title, message) {
  const block = element("div", "library-empty");
  block.append(element("strong", null, title), element("p", null, message));
  return block;
}

function field(label, control) {
  const wrapper = element("label", "journal-field");
  wrapper.append(element("span", null, label), control);
  return wrapper;
}

function localDateInput(value) {
  const date = new Date(cleanDate(value) ?? Date.now());
  const fields = [date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
  const [month, day, hours, minutes] = fields.map((part) => String(part).padStart(2, "0"));
  return `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}`;
}

function focusAfterRemoval(list, previousIndex, fallback) {
  const buttons = list.querySelectorAll("[data-remove]");
  (buttons[Math.min(previousIndex, buttons.length - 1)] ?? fallback).focus();
}

function renderFavorites(view, { library, catalog, onSelect, onChange, heading }) {
  const list = element("div", "library-grid");
  view.append(list);

  function refresh() {
    list.replaceChildren();
    const ids = library.favorites;
    if (!ids.length) {
      list.append(emptyState("お気に入りがありません", "星図の詳細パネルから、観測したい天体を保存できます。"));
      return;
    }
    ids.forEach((id, index) => {
      const object = catalog.get(id);
      const card = element("article", "library-card");
      const title = object?.name ?? "カタログ外の天体";
      const subtitle = [TYPE_NAMES[object?.type], object?.constellation].filter(Boolean).join(" · ");
      const tag = element("p", "library-kicker", subtitle);
      const footer = element("div", "library-actions");
      if (object && onSelect) {
        footer.append(actionButton("星図で見る", "primary", () => onSelect(id), `${title}を星図で見る`));
      }
      const remove = actionButton("解除", "quiet", () => {
        library.toggleFavorite(id);
        refresh();
        focusAfterRemoval(list, index, heading);
        onChange();
      }, `${title}のお気に入りを解除`);
      remove.dataset.remove = "";
      footer.append(remove);
      card.append(tag, element("h3", null, title), element("p", null, object?.description ?? id), footer);
      list.append(card);
    });
  }

  refresh();
}

function renderJournal(view, { library, catalog, onChange, selectedId, date }) {
  const layout = element("div", "journal-layout");
  const form = element("form", "journal-form");
  const fields = element("div", "journal-fields");
  const target = element("select");
  target.required = true;
  for (const [id, object] of catalog) {
    const option = element("option", null, object.name);
    option.value = id;
    target.append(option);
  }
  if (catalog.has(selectedId)) target.value = selectedId;

  const time = element("input");
  time.type = "datetime-local";
  time.required = true;
  time.value = localDateInput(date);

  const rating = element("select");
  CONDITIONS.forEach((condition, index) => {
    const option = element("option", null, condition);
    option.value = String(index);
    rating.append(option);
  });

  const note = element("textarea");
  note.required = true;
  note.maxLength = NOTE_LIMIT;
  note.rows = 5;
  note.placeholder = "見えた色や明るさ、使った機材など";
  const feedback = element("p", "journal-feedback");
  feedback.setAttribute("role", "status");
  const footer = element("div", "library-actions");
  const submit = element("button", "library-button library-button-primary", "観測ログを記録");
  submit.type = "submit";
  footer.append(submit);
  fields.append(field("天体", target), field("観測日時（端末の時刻）", time), field("空の状態", rating), field("観測メモ", note));
  form.append(element("h3", null, "新しい記録"), fields, footer, feedback);

  const history = element("section", "journal-history");
  const historyHeading = element("h3", null, "観測履歴");
  historyHeading.tabIndex = -1;
  const list = element("div", "journal-list");
  history.append(historyHeading, list);
  layout.append(form, history);
  view.append(layout);

  function refreshHistory() {
    list.replaceChildren();
    const entries = library.entries;
    if (!entries.length) {
      list.append(emptyState("観測履歴がありません", "フォームから観測内容を記録できます。"));
      return;
    }
    entries.forEach((entry, index) => {
      const article = element("article", "journal-entry");
      const title = catalog.get(entry.targetId)?.name ?? "カタログ外の天体";
      const metarow = element("div", "journal-entry-meta");
      const observed = element("time", null, dateFormat.format(new Date(entry.date)));
      observed.dateTime = entry.date;
      metarow.append(observed);
      if (entry.rating) metarow.append(element("span", "library-kicker", CONDITIONS[entry.rating]));
      const remove = actionButton("削除", "quiet", () => {
        library.deleteEntry(entry.id);
        refreshHistory();
        focusAfterRemoval(list, index, historyHeading);
        onChange();
      }, `${title}の観測ログ（${observed.textContent}）を削除`);
      remove.dataset.remove = "";
      const actions = element("div", "library-actions");
      actions.append(remove);
      article.append(element("h4", null, title), metarow, element("p", "journal-note", entry.note), actions);
      list.append(article);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const memo = note.value.trim();
    if (!memo) {
      feedback.classList.add("journal-error");
      feedback.textContent = "観測メモを入力してください。";
      note.focus();
      return;
    }
    try {
      library.addEntry({ targetId: target.value, date: new Date(time.value), note: memo, rating: Number(rating.value) });
    } catch (error) {
      feedback.classList.add("journal-error");
      feedback.textContent = error.message;
      return;
    }
    note.value = "";
    feedback.classList.remove("journal-error");
    feedback.textContent = library.persistenceError ? "このページ内に記録しました。" : "観測ログを保存しました。";
    refreshHistory();
    onChange();
  });
  refreshHistory();
}

export function renderLibrary(container, { library, objects, mode, onSelect, onChange, selectedId, date }) {
  const favorites = mode === "favorites";
  const catalog = new Map(objects.map((object) => [object.id, object]));
  const view = element("section", "library-view");
  const header = element("header", "library-heading");
  const heading = element("h2", null, favorites ? "お気に入り" : "観測ノート");
  heading.tabIndex = -1;
  const description = favorites ? "観測したい天体をまとめて、すぐに星図に表示。" : "見上げた夜空を記録して、観測を振り返る。";
  header.append(heading, element("p", null, description));

  const warning = element("p", "journal-error");
  warning.setAttribute("role", "status");

  function refreshPersistence() {
    warning.textContent = library.persistenceError ? "ブラウザーに保存できません。このページを閉じると変更が失われます。" : "";
  }
  function change() {
    refreshPersistence();
    onChange?.();
  }

  view.append(header, warning);
  if (favorites) {
    renderFavorites(view, { library, catalog, onSelect, onChange: change, heading });
  } else {
    renderJournal(view, { library, catalog, onChange: change, selectedId, date });
  }
  refreshPersistence();
  container.replaceChildren(view);
}
