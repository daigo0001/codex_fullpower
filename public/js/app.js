import { objects, constellationLinks } from "./catalog.js";
import { position, solarPosition, lunarPhase, observationWindows } from "./astro.js";
import { createSkyMap } from "./sky-map.js";
import { loadLibrary, renderLibrary } from "./journal.js";
import { icon } from "./icons.js";
import { localDate, localTime, observingNight } from "./observing-time.js";

const $ = (id) => document.getElementById(id);
const minute = 60_000;
const dateMin = "1800-01-01";
const dateMax = "2050-12-31";
const typeLabels = { star: "恒星", planet: "惑星", "deep-sky": "深空天体", moon: "月" };
const typeIcons = { star: "star", planet: "planet", "deep-sky": "sparkles", moon: "moon" };
const directions = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
const locations = [
  { id: "tokyo", name: "東京", lat: 35.6762, lon: 139.6503, zone: "Asia/Tokyo" },
  { id: "sapporo", name: "札幌", lat: 43.0621, lon: 141.3544, zone: "Asia/Tokyo" },
  { id: "kyoto", name: "京都", lat: 35.0116, lon: 135.7681, zone: "Asia/Tokyo" },
  { id: "naha", name: "那覇", lat: 26.2124, lon: 127.6809, zone: "Asia/Tokyo" },
  { id: "mauna-kea", name: "マウナケア", lat: 19.8207, lon: -155.4681, zone: "Pacific/Honolulu" },
  { id: "london", name: "ロンドン", lat: 51.5072, lon: -0.1276, zone: "Europe/London" },
  { id: "atacama", name: "アタカマ", lat: -23.029, lon: -67.755, zone: "America/Santiago" },
  { id: "sydney", name: "シドニー", lat: -33.8688, lon: 151.2093, zone: "Australia/Sydney" },
];
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timeZones = [
  ["Asia/Tokyo", "日本標準時 (JST)"], ["UTC", "協定世界時 (UTC)"],
  ["Pacific/Honolulu", "ハワイ"], ["Europe/London", "ロンドン"], ["America/Santiago", "サンティアゴ"],
  ["Australia/Sydney", "シドニー"], ["America/New_York", "ニューヨーク"],
  ["America/Los_Angeles", "ロサンゼルス"], ["Europe/Paris", "パリ"],
  ["Asia/Kolkata", "インド"], ["Pacific/Auckland", "ニュージーランド"],
];
if (!timeZones.some(([id]) => id === localZone)) timeZones.push([localZone, `端末 (${localZone})`]);

function getSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem("yosora.location"));
    const preset = locations.find(({ id }) => id === saved?.id);
    if (preset) return preset;
    if (saved?.id === "custom" && Number.isFinite(saved.lat) && Math.abs(saved.lat) <= 90 &&
        Number.isFinite(saved.lon) && Math.abs(saved.lon) <= 180) {
      Intl.DateTimeFormat("ja", { timeZone: saved.zone });
      if (typeof saved.zone === "string") return { ...saved, name: "カスタム観測地" };
    }
  } catch {
    // The default also works when browser storage is unavailable.
  }
  return locations[0];
}

const initialLocation = getSavedLocation();
const currentDate = localDate(new Date(), initialLocation.zone);
const startingDate = currentDate < dateMin ? dateMin : currentDate > dateMax ? dateMax : currentDate;
const initialNight = observingNight(startingDate, initialLocation.zone);
const state = {
  location: initialLocation, nightDate: startingDate, night: initialNight, minutes: initialNight.previewMinutes,
  view: "sky", selectedId: null, filter: "all", showGrid: true, showConstellations: true,
  showAllCatalog: false, positions: [], playback: null,
};
const library = loadLibrary();
const targetCache = new Map();
let toastTimeout;

for (const element of document.querySelectorAll("[data-icon]")) element.innerHTML = icon(element.dataset.icon);

const skyMap = createSkyMap($("sky-map"), {
  onSelect: (object) => selectTarget(object.id),
  onHover: (object, point) => {
    const tip = $("map-tooltip");
    tip.hidden = !object;
    if (!object) return;
    const width = $("map-frame").clientWidth;
    tip.textContent = object.name;
    const inset = tip.offsetWidth / 2 + 3;
    tip.style.left = `${Math.max(inset, Math.min(width - inset, point.x))}px`;
    tip.style.top = `${Math.max(46, point.y)}px`;
  },
});

function instantAt(minutes) {
  return new Date(state.night.start.getTime() + minutes * minute);
}

function clock(date) {
  return localTime(date, state.location.zone);
}

function angle(value) {
  return `${value.toFixed(1).replace("-", "−")}°`;
}

function locationText({ lat, lon }) {
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"}  ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? "W" : "E"}`;
}

function notify(text) {
  const toast = $("toast");
  clearTimeout(toastTimeout);
  toast.hidden = false;
  toast.textContent = text;
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 2800);
}

function dusk() {
  const start = state.night.noon;
  let previous = solarPosition(start, state.location).altitude;
  let alwaysDark = previous <= -18;
  for (let time = start.getTime() + 5 * minute; time <= state.night.end.getTime(); time += 5 * minute) {
    const current = solarPosition(new Date(time), state.location).altitude;
    if (previous > -18 && current <= -18) {
      const fraction = (-18 - previous) / (current - previous);
      return clock(new Date(Math.round((time / minute) - 5 + 5 * fraction) * minute));
    }
    alwaysDark &&= current <= -18;
    previous = current;
  }
  return alwaysDark ? "日中から太陽高度 −18° 以下" : "該当なし";
}

function renderNight() {
  const { location, nightDate, night } = state;
  const heroDate = $("hero-date");
  const displayDate = new Date(`${nightDate}T12:00:00Z`);
  heroDate.dateTime = nightDate;
  heroDate.textContent = displayDate.toLocaleDateString("en-GB", {
    weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).toUpperCase();
  $("header-location").textContent = location.name;
  $("location-name").textContent = location.name;
  $("location-coords").textContent = locationText(location);
  $("timezone").textContent = location.zone === "Asia/Tokyo" ? "Asia/Tokyo · JST" : location.zone;
  $("night-date").value = nightDate;
  $("timeline").max = night.minutes;
  $("timeline").value = state.minutes;
  for (const [index, tick] of [...document.querySelectorAll(".ticks span")].entries()) {
    tick.textContent = clock(instantAt(night.minutes * index / 4));
  }
  $("dark-start").textContent = dusk();
  updateSky();
}

function filtersMatch(object) {
  return state.filter === "all" || object.type === state.filter ||
    (state.filter === "planet" && object.type === "moon");
}

function preferredTarget() {
  const candidates = ["m31", "m45", "m42"];
  const useful = state.positions.find((object) => candidates.includes(object.id) && object.altitude >= 30);
  return useful ?? state.positions.filter((object) => object.altitude >= 20)
    .sort((a, b) => (b.altitude / 30 - (b.magnitude ?? 0)) - (a.altitude / 30 - (a.magnitude ?? 0)))[0]
    ?? state.positions[0];
}

function updateSky() {
  const date = instantAt(state.minutes);
  state.positions = objects.map((object) => ({ ...object, ...position(object, date, state.location) }));
  state.selectedId ??= preferredTarget().id;
  const phase = lunarPhase(date);
  $("moon-phase").textContent = phase.name;
  $("moon-illumination").textContent = `輝面比 ${Math.round(phase.illumination * 100)}%`;
  $("map-time").dateTime = date.toISOString();
  const time = clock(date);
  $("map-time").textContent = `${time} · 現地時刻`;
  $("time-output").textContent = time;
  $("timeline").setAttribute("aria-valuetext", time);
  $("timeline").style.setProperty("--progress", `${100 * state.minutes / state.night.minutes}%`);
  renderMap(date);
  renderTarget();
  renderCatalog();
}

function renderMap(date = instantAt(state.minutes)) {
  skyMap.render({
    objects: state.positions.filter(filtersMatch), selectedId: state.selectedId,
    showConstellations: state.showConstellations, showGrid: state.showGrid,
    showBackdrop: state.filter === "all" || state.filter === "star",
    constellationLinks, date, location: state.location,
  });
}

function updateNavCount() {
  const badge = document.querySelector(".favorite-count");
  badge.hidden = library.favorites.length === 0;
  badge.textContent = library.favorites.length;
}

function renderBookmark() {
  const saved = library.hasFavorite(state.selectedId);
  const label = saved ? "お気に入りから外す" : "お気に入りに追加";
  const button = $("save-target");
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute("aria-label", label);
  button.title = label;
}

function getTargetSeries(target) {
  if (!targetCache.has(target.id)) {
    const { location, night } = state;
    const samples = Array.from({ length: 49 }, (_, index) =>
      position(target, instantAt(night.minutes * index / 48), location).altitude);
    const windows = observationWindows(target, night.start, night.end, location);
    targetCache.set(target.id, { samples, windows });
  }
  return targetCache.get(target.id);
}

function renderChart(target, samples, windows) {
  const left = 29;
  const right = 312;
  const top = 9;
  const bottom = 93;
  const floor = Math.min(0, Math.floor(Math.min(...samples) / 30) * 30);
  const y = (altitude) => bottom - (bottom - top) * (altitude - floor) / (90 - floor);
  const x = (fraction) => left + (right - left) * fraction;
  const portion = (date) => (date - state.night.start) / (state.night.end - state.night.start);
  const series = samples.map((altitude, index) =>
    `${x(index / (samples.length - 1)).toFixed(2)},${y(altitude).toFixed(2)}`).join(" ");
  const labels = [90, 60, 30, 0, -30, -60, -90].filter((altitude) => altitude >= floor);
  const horizontal = labels.map((altitude) =>
    `<line class="${altitude === 0 ? "chart-horizon" : "chart-grid"}" x1="${left}" x2="${right}" y1="${y(altitude)}" y2="${y(altitude)}"/><text class="chart-axis-text" x="24" y="${y(altitude) + 3}" text-anchor="end">${altitude}°</text>`).join("");
  const highlights = windows.map(({ start, end }) =>
    `<rect class="chart-window" x="${x(portion(start))}" y="${top}" width="${x(portion(end)) - x(portion(start))}" height="${bottom - top}"/>`).join("");
  const times = [0, .5, 1].map((fraction, index) =>
    `<text class="chart-axis-text" x="${x(fraction)}" y="109" text-anchor="${["start", "middle", "end"][index]}">${clock(instantAt(state.night.minutes * fraction))}</text>`).join("");
  const cursor = x(state.minutes / state.night.minutes);
  const chart = $("altitude-chart");
  chart.innerHTML = `${highlights}${horizontal}${times}
    <polyline class="chart-line" points="${series}"/>
    <line class="chart-cursor" x1="${cursor}" x2="${cursor}" y1="${top}" y2="${bottom}"/>
    <circle class="chart-point" cx="${cursor}" cy="${y(target.altitude)}" r="3.3"/>`;
  chart.setAttribute("aria-label", `${target.name}の高度の推移。現在 ${angle(target.altitude)}。観測の目安 ${$("target-window").textContent}`);
}

function renderTarget() {
  const target = state.positions.find((object) => object.id === state.selectedId);
  if (!target) return;
  const emblem = $("target-emblem");
  if (emblem.dataset.kind !== target.type) {
    emblem.dataset.kind = target.type;
    emblem.innerHTML = icon(typeIcons[target.type]);
  }
  $("target-type").textContent = [typeLabels[target.type], target.constellation].filter(Boolean).join(" · ");
  $("target-name").textContent = target.name;
  $("target-english").textContent = target.english;
  $("target-description").textContent = target.description;
  $("target-altitude").textContent = angle(target.altitude);
  $("target-altitude").classList.toggle("is-below", target.altitude < 0);
  const direction = directions[Math.round(target.azimuth / 45) % directions.length];
  $("target-azimuth").textContent = `${direction} ${Math.round(target.azimuth) % 360}°`;
  $("target-magnitude").textContent = target.magnitude == null ? "—" : `${target.magnitude.toFixed(1)} 等`;
  const { samples, windows } = getTargetSeries(target);
  $("target-window").textContent = windows.length
    ? windows.map(({ start, end }) => `${clock(start)} – ${clock(end)}`).join(" / ")
    : "条件を満たす時間帯なし";
  renderChart(target, samples, windows);
  renderBookmark();
}

function searchKey(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ja").replace(/[\s・-]/g, "");
}

function renderCatalog() {
  const query = searchKey($("catalog-search").value);
  const list = $("catalog-list");
  const activeId = list.contains(document.activeElement) ? document.activeElement.dataset.target : null;
  const matches = state.positions.filter((object) =>
    !query || [object.name, object.english, object.id, object.constellation ?? ""].some((value) => searchKey(value).includes(query)))
    .sort((a, b) => (a.id === state.selectedId ? -1 : b.id === state.selectedId ? 1 : b.altitude - a.altitude));
  const showAll = Boolean(query) || state.showAllCatalog;
  $("catalog-more").hidden = Boolean(query) || matches.length <= 6;
  $("catalog-more").setAttribute("aria-expanded", String(state.showAllCatalog));
  $("catalog-more").firstChild.nodeValue = state.showAllCatalog ? "表示を折りたたむ" : "すべての天体を表示";
  const content = document.createDocumentFragment();
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "catalog-empty";
    empty.textContent = "一致する天体が見つかりませんでした。";
    content.append(empty);
  }
  for (const object of showAll ? matches : matches.slice(0, 6)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catalog-item";
    button.dataset.kind = object.type;
    button.dataset.target = object.id;
    button.setAttribute("aria-pressed", String(object.id === state.selectedId));
    const symbol = document.createElement("span");
    symbol.innerHTML = icon(typeIcons[object.type]);
    const names = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = object.name;
    const subtitle = document.createElement("small");
    subtitle.textContent = object.english;
    names.append(title, subtitle);
    const altitude = document.createElement("span");
    altitude.className = "catalog-altitude";
    altitude.textContent = angle(object.altitude);
    button.append(symbol, names, altitude);
    content.append(button);
  }
  list.replaceChildren(content);
  if (activeId) [...list.children].find((element) => element.dataset.target === activeId)?.focus({ preventScroll: true });
}

function selectTarget(id, { reveal = false, resetFilter = true } = {}) {
  state.selectedId = id;
  if (resetFilter) {
    const target = state.positions.find((object) => object.id === id);
    if (target && !filtersMatch(target)) setFilter("all");
  }
  renderMap();
  renderTarget();
  renderCatalog();
  if (reveal) {
    const heading = $("target-heading");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    if (matchMedia("(max-width: 835px)").matches || heading.getBoundingClientRect().top < 0) {
      heading.scrollIntoView({ block: "start" });
    }
  }
}

function setFilter(filter) {
  state.filter = filter;
  for (const button of $("filters").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  }
  renderMap();
}

function setMinutes(minutes) {
  state.minutes = Math.max(0, Math.min(state.night.minutes, minutes));
  $("timeline").value = state.minutes;
  updateSky();
}

function stopPlayback() {
  if (state.playback === null) return;
  clearInterval(state.playback);
  state.playback = null;
  const button = $("play-time");
  button.firstElementChild.innerHTML = icon("play");
  button.setAttribute("aria-label", "星空の動きを再生");
  button.title = "星空の動きを再生";
}

function renderView() {
  const requested = location.hash.slice(1);
  state.view = ["favorites", "journal"].includes(requested) ? requested : "sky";
  if (state.view !== "sky") stopPlayback();
  $("sky-view").hidden = state.view !== "sky";
  $("library-view").hidden = state.view === "sky";
  for (const link of document.querySelectorAll("[data-view]")) {
    if (link.dataset.view === state.view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (state.view !== "sky") {
    renderLibrary($("library-view"), {
      library, objects, selectedId: state.selectedId, date: instantAt(state.minutes), mode: state.view,
      onSelect: (id) => {
        location.hash = "sky";
        selectTarget(id);
        window.scrollTo(0, 0);
      },
      onChange: () => {
        updateNavCount();
        renderBookmark();
      },
    });
  } else {
    renderMap();
    renderBookmark();
  }
}

const presetSelect = $("location-select");
presetSelect.replaceChildren(...locations.map((item) => new Option(item.name, item.id)), new Option("緯度・経度を入力", "custom"));
$("custom-timezone").replaceChildren(...timeZones.map(([id, label]) => new Option(label, id)));

function updateLocationFields() {
  const custom = presetSelect.value === "custom";
  $("custom-location").hidden = !custom;
  $("custom-latitude").required = custom;
  $("custom-longitude").required = custom;
  $("custom-latitude").disabled = !custom;
  $("custom-longitude").disabled = !custom;
}

const locationDialog = $("location-dialog");
for (const button of document.querySelectorAll("[data-open-location]")) {
  button.addEventListener("click", () => {
    const site = state.location;
    presetSelect.value = site.id;
    $("custom-latitude").value = site.lat;
    $("custom-longitude").value = site.lon;
    const timezone = $("custom-timezone");
    if (![...timezone.options].some(({ value }) => value === site.zone)) timezone.add(new Option(site.zone, site.zone));
    timezone.value = site.zone;
    updateLocationFields();
    locationDialog.showModal();
  });
}
presetSelect.addEventListener("change", updateLocationFields);
$("close-location").addEventListener("click", () => locationDialog.close());
$("location-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const locationChoice = locations.find(({ id }) => id === presetSelect.value) ?? {
    id: "custom", name: "カスタム観測地",
    lat: $("custom-latitude").valueAsNumber, lon: $("custom-longitude").valueAsNumber,
    zone: $("custom-timezone").value,
  };
  state.location = locationChoice;
  try {
    localStorage.setItem("yosora.location", JSON.stringify(locationChoice));
  } catch {
    notify("このブラウザーで観測地を保存できませんでした。");
  }
  resetNight();
  if (state.view !== "sky") renderView();
  locationDialog.close();
});

function resetNight() {
  stopPlayback();
  targetCache.clear();
  state.night = observingNight(state.nightDate, state.location.zone);
  state.minutes = Math.min(state.minutes, state.night.minutes);
  renderNight();
}

$("night-date").min = dateMin;
$("night-date").max = dateMax;
$("night-date").addEventListener("change", (event) => {
  const input = event.currentTarget;
  if (!input.value || !input.validity.valid) {
    input.value = state.nightDate;
    notify("観測日は 1800年から2050年まで選べます。");
    return;
  }
  state.nightDate = input.value;
  resetNight();
});

$("timeline").addEventListener("input", (event) => {
  stopPlayback();
  setMinutes(Number(event.currentTarget.value));
});
$("play-time").addEventListener("click", (event) => {
  if (state.playback !== null) {
    stopPlayback();
    return;
  }
  if (state.minutes >= state.night.minutes) setMinutes(0);
  const button = event.currentTarget;
  button.firstElementChild.innerHTML = icon("pause");
  button.setAttribute("aria-label", "星空の動きを一時停止");
  button.title = "星空の動きを一時停止";
  state.playback = setInterval(() => {
    setMinutes(state.minutes + 10);
    if (state.minutes >= state.night.minutes) stopPlayback();
  }, 130);
});

$("filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (button) setFilter(button.dataset.filter);
});
$("zoom-in").addEventListener("click", () => skyMap.zoomBy(1.25));
$("zoom-out").addEventListener("click", () => skyMap.zoomBy(0.8));
$("reset-map").addEventListener("click", () => skyMap.resetView());
for (const [id, key] of [["toggle-grid", "showGrid"], ["toggle-constellations", "showConstellations"]]) {
  $(id).addEventListener("click", (event) => {
    state[key] = !state[key];
    event.currentTarget.setAttribute("aria-pressed", String(state[key]));
    renderMap();
  });
}

$("save-target").addEventListener("click", () => {
  const saved = library.toggleFavorite(state.selectedId);
  renderBookmark();
  updateNavCount();
  notify(library.persistenceError ? "ブラウザーに保存できませんでした。" : saved ? "お気に入りに追加しました。" : "お気に入りから外しました。");
});

$("catalog-search").addEventListener("input", renderCatalog);
$("catalog-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-target]");
  if (button) selectTarget(button.dataset.target, { reveal: true });
});
$("catalog-more").addEventListener("click", () => {
  state.showAllCatalog = !state.showAllCatalog;
  renderCatalog();
});

window.addEventListener("hashchange", renderView);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPlayback();
});
renderNight();
updateNavCount();
renderView();
