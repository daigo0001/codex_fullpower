(() => {
  const lab = globalThis.PLLab;
  const { chapters, workflow, milestones } = lab.curriculum;
  const { workspace } = lab;
  const $ = (id) => document.getElementById(id);
  const byId = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const chapterLinks = [...document.querySelectorAll(".course-nav [data-chapter]")];
  const mobile = matchMedia("(max-width: 780px)");
  const menu = $("chapter-menu");
  const dataMenu = $("data-menu");
  const backupFile = $("backup-file");
  const dateUnits = 86_400_000;
  let state;
  let storage;
  let current;

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs ?? {})) {
      if (typeof value === "function" && /^on\w+$/i.test(name)) node.addEventListener(name.slice(2).toLowerCase(), value);
      else if (name === "value" && "value" in node) continue;
      else if (typeof value === "boolean" && !name.startsWith("aria-")) node.toggleAttribute(name, value);
      else if (value != null) node.setAttribute(name, String(value));
    }
    for (const child of children.flat(Infinity)) {
      if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
    }
    if (attrs && Object.hasOwn(attrs, "value") && "value" in node) node.value = attrs.value ?? "";
    return node;
  }

  function table(headers, rows, caption) {
    const grid = el("table", {},
      caption ? el("caption", {}, caption) : null,
      el("thead", {}, el("tr", {}, headers.map(value => el("th", { scope: "col" }, value)))),
      el("tbody", {}, rows.map(row => el("tr", {}, row.map(value => el("td", {}, value))))));
    return el("div", { class: "table-wrap", tabindex: 0, role: "region", "aria-label": caption || "表" }, grid);
  }

  function chapterLink(id, text, cssClass) {
    return el("a", { href: `#chapter-${id}`, class: cssClass }, text ?? byId.get(id).title);
  }

  function inform(message, warning = false) {
    $("app-status").textContent = message;
    $("app-status").classList.toggle("is-warning", warning);
  }

  function loadState() {
    let source;
    try {
      storage = window.localStorage;
      source = storage.getItem(workspace.storageKey);
    } catch {
      storage = undefined;
      inform("この環境ではブラウザーに保存できません。続きはデータメニューから JSON に保存できます。", true);
    }
    if (source) {
      try {
        return workspace.parse(source);
      } catch {
        inform("ブラウザーに保存されたデータを読み込めなかったため、初期状態を表示しています。JSON ファイルがあれば復元できます。", true);
      }
    }
    return workspace.fresh();
  }

  function save() {
    if (!storage) return;
    try {
      storage.setItem(workspace.storageKey, JSON.stringify(state));
    } catch {
      storage = undefined;
      inform("ブラウザーへの保存に失敗しました。現在のタブで演習を続け、データメニューから JSON に保存できます。", true);
    }
  }

  function download(filename, data, mime = "application/octet-stream") {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const link = el("a", { href: url, download: filename, hidden: true });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }

  function updateProgress() {
    const completed = chapters.slice(1).filter(({ id }) => state.progress[id]).length;
    const total = chapters.length - 1;
    $("mobile-progress").textContent = `${completed} / ${total} 完了`;
    $("nav-progress").replaceChildren(el("span", {}, `演習の完了 ${completed} / ${total}`),
      el("progress", { max: total, value: completed, "aria-label": "演習の進捗" }));
    for (const link of chapterLinks) {
      const id = link.dataset.chapter;
      const done = Boolean(state.progress[id]);
      link.dataset.done = String(done);
      if (done) link.setAttribute("aria-label", `${byId.get(id).title}（完了）`);
      else link.removeAttribute("aria-label");
    }
  }

  function complete(id, value = true) {
    if (value) state.progress[id] = true;
    else delete state.progress[id];
    save();
    updateProgress();
  }

  function metric(label, value, detail) {
    return el("div", { class: "dashboard-metric" }, el("span", {}, label), el("strong", {}, value), el("small", {}, detail));
  }

  function dateIndex(value) {
    return Math.floor(Date.parse(value + "T00:00:00Z") / dateUnits);
  }

  function timeline(start, deadline, asOf) {
    const origin = dateIndex(start);
    const span = Math.max(1, dateIndex(deadline) - origin);
    const x = (date) => String(Math.round(30 + 640 * Math.max(0, Math.min(1, (dateIndex(date) - origin) / span))));
    const draw = (tag, attrs) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      return node;
    };
    const svg = draw("svg", { viewBox: "0 0 700 54", "aria-hidden": "true", preserveAspectRatio: "xMidYMid meet" });
    svg.append(draw("rect", { x: 30, y: 24, width: 640, height: 8, rx: 4, fill: "#dbe6ee" }),
      draw("rect", { x: 30, y: 24, width: Number(x(asOf)) - 30, height: 8, rx: 4, fill: "#73b9a8" }));
    for (const milestone of milestones) {
      if (milestone.date < start || milestone.date > deadline) continue;
      svg.append(draw("path", { d: `M${x(milestone.date)} 21l7 7-7 7-7-7Z`, fill: "#315c78", stroke: "#fff", "stroke-width": 1.5 }));
    }
    svg.append(draw("path", { d: `M${x(asOf)} 11v33`, stroke: "#11705f", "stroke-width": 2.4, "stroke-linecap": "round" }),
      draw("circle", { cx: x(asOf), cy: 10, r: 4, fill: "#11705f" }));
    return svg;
  }

  function dashboardHero(next) {
    const graphic = el("div", { "aria-hidden": "true" });
    graphic.innerHTML = `<svg viewBox="0 0 395 178" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="grid" width="17" height="17" patternUnits="userSpaceOnUse"><path d="M17 0H0v17" stroke="#99b7ca" stroke-opacity=".19"/></pattern></defs>
      <rect x="8" y="8" width="377" height="162" rx="15" fill="url(#grid)" stroke="#9cc3cf" stroke-opacity=".23"/>
      <path d="M78 55H145M145 55V103H206M145 55V32H242M251 103H316M286 32H315V73" stroke="#91d6c9" stroke-opacity=".77" stroke-width="2" stroke-linecap="round"/>
      <rect x="37" y="40" width="63" height="30" rx="6" fill="#a6ead5"/><path d="M50 52h27m-27 6h17" stroke="#24595b" stroke-width="2" stroke-linecap="round"/>
      <rect x="203" y="86" width="64" height="33" rx="6" fill="#294e64" stroke="#93d5d2"/><path d="M217 98h30m-30 7h21" stroke="#90d7d0" stroke-width="2" stroke-linecap="round"/>
      <rect x="234" y="19" width="58" height="26" rx="5" fill="#2b4d70" stroke="#8caecb"/><path d="M246 29h27m-27 6h18" stroke="#abc4db" stroke-width="1.6" stroke-linecap="round"/>
      <rect x="307" y="74" width="54" height="55" rx="9" fill="#284764" stroke="#aac3dc"/><path d="m322 102 8 8 16-17" stroke="#a9efcf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="145" cy="55" r="4" fill="#91d6c9"/><path d="M37 142H255m-218 8h115" stroke="#93b3cc" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    return el("div", { class: "dashboard-hero" }, el("div", {},
      el("p", { class: "eyebrow" }, "社内問い合わせ管理システムの新規開発"),
      el("h1", { id: "title-00" }, "Web開発 PL実践ラボ"),
      el("p", {}, "3人・3か月の案件を担当し、顧客の依頼から初回リリースまで判断を積み重ねます。"),
      el("div", { class: "actions" }, chapterLink(next.id, next.id === "01" ? "プロジェクトを始める ↗" : `次へ ${next.short} ↗`, "button primary"),
        chapterLink("08", "工程表を見る", "button secondary"))), graphic);
  }

  function dashboard() {
    const panel = $("chapter-00");
    const progress = chapters.slice(1);
    const completed = progress.filter(({ id }) => state.progress[id]).length;
    const next = progress.find(({ id }) => !state.progress[id]) ?? byId.get("12");
    const documents = workspace.artifacts(state);
    const activePlan = state.plans[state.planMode];
    const demo = state.plans.sample;
    const analysis = lab.plan.analyzePlan(activePlan);
    const extras = lab.dashboardExtras?.(state) ?? { risks: [], issues: [] };
    const artifactList = documents.map(({ id, title }) => chapterLink(id, [el("span", {}, title), el("span", { class: "mono" }, id)]));
    const warnings = analysis.issues.filter(item => item.severity !== "info");
    const dependencies = progress.map(({ id, short, requires }) => [
      chapterLink(id, `${id} ${short}`),
      requires.length ? requires.map(required => chapterLink(required, `${required} ${byId.get(required).short}`)).reduce((links, link) => links.length ? [...links, " · ", link] : [link], []) : "案件の依頼",
      state.progress[id] ? "完了" : "未完了",
    ]);
    const workflowList = el("ol", { class: "dashboard-workflow" }, workflow.map(stage => el("li", {},
      el("h3", {}, stage.title), el("p", {}, stage.output),
      el("div", { class: "phase-links" }, stage.chapters.map(id => el("a", { href: `#chapter-${id}`, "aria-label": `${byId.get(id).title} ${state.progress[id] ? "完了" : "未完了"}`, "data-done": String(Boolean(state.progress[id])) }, id, state.progress[id] ? " ✓" : ""))))));
    const dates = el("ul", { class: "milestone-list" }, milestones.map(({ date, title }) => el("li", {}, el("time", { datetime: date }, date.slice(5).replace("-", "/")), title)));
    const modeName = state.planMode === "final" ? "最終演習" : "問い合わせ管理";
    const riskList = [...(extras.risks ?? []), ...warnings.slice(0, 4).map(item => item.message)];
    panel.replaceChildren(el("div", { class: "dashboard" }, dashboardHero(next),
      el("div", { class: "dashboard-metrics" },
        metric("完了した演習", `${completed} / ${progress.length}`, "工程ごとの確認・レビュー"),
        metric("作成した成果物", `${documents.length} 件`, "提出した資料と記録"),
        metric("作業の完了", `${analysis.summary.doneCount} / ${analysis.summary.taskCount}`, `${modeName}の WBS`),
        metric("現在の日付（演習）", activePlan.asOf || activePlan.start, modeName)),
      el("section", { class: "panel" }, el("h2", {}, "開発工程マップ"),
        el("p", { class: "muted" }, "要求から受入条件を作り、設計・実装・試験をつなぎます。変更の判断は関連する工程へ戻ります。"),
        workflowList,
        el("details", { class: "method-note" }, el("summary", {}, "各章の前提・完了状況"), table(["章", "参照する前工程", "進捗"], dependencies, "学習工程の依存関係")),
        el("details", { class: "method-note" }, el("summary", {}, "進め方は案件に合わせる"),
          el("p", {}, "ウォーターフォール型は工程の境界で成果物を確認します。反復型では高リスクの機能を先に通し、学んだことを次の反復へ入れます。アジャイルでは小さな価値単位を短い周期で届け、実物を見て優先順位を変えます。どの進め方でも、要件・判断・試験の対応は更新します。この案件では顧客承認を区切りにしつつ、一覧と状態変更は先に接続して検証します。"))),
      el("section", { class: "panel" }, el("h2", {}, "全体スケジュール"),
        el("p", { class: "muted" }, `問い合わせ管理の合意時点の目安 ${demo.start} 〜 ${demo.deadline}。縦線は演習日 ${demo.asOf || demo.start}。`),
        el("div", { class: "dashboard-timeline" }, timeline(demo.start, demo.deadline, demo.asOf || demo.start)), dates,
        el("p", { class: "muted" }, `${modeName}の計画上の終了 ${analysis.summary.finish || "未算出"} · 納期 ${activePlan.deadline}。`),
        el("div", { class: "actions" }, chapterLink("08", "実際のタスク・負荷を確認", "button secondary"))),
      el("div", { class: "split" },
        el("section", { class: "panel" }, el("h2", {}, "次に進めること"), el("p", {}, next.aim),
          extras.next ? el("p", { class: "callout callout-warning" }, extras.next) : null,
          el("div", { class: "actions" }, chapterLink(next.id, next.title, "button secondary"))),
        el("section", { class: "panel" }, el("h2", {}, "成果物"), documents.length ? el("div", { class: "dashboard-artifacts" }, artifactList) : el("p", { class: "muted" }, "演習の回答を確認すると、企画や設計の記録がここに並びます。"))),
      el("section", { class: "panel" }, el("h2", {}, "リスク・未解決事項"),
        el("div", { class: "split" },
          el("div", {}, el("h3", {}, "リスクと計画上の警告"), riskList.length ? el("ul", {}, riskList.map(item => el("li", {}, item))) : el("p", { class: "muted" }, "登録されたリスクはありません。")),
          el("div", {}, el("h3", {}, "未解決事項"), (extras.issues ?? []).length ? el("ul", {}, extras.issues.map(item => el("li", {}, item))) : el("p", { class: "muted" }, "登録された課題はありません。"))),
        el("div", { class: "actions" }, chapterLink("10", "リスク・課題・変更を管理", "button secondary")))));
  }

  function go(id) {
    if (!byId.has(id)) return;
    if (location.hash === `#chapter-${id}`) render(true);
    else location.hash = `chapter-${id}`;
  }

  function render(focus = false) {
    const match = /^#chapter-(\d\d)$/.exec(location.hash);
    const id = match && byId.has(match[1]) ? match[1] : "00";
    current = id;
    if (mobile.matches && focus) menu.open = false;
    dataMenu.open = false;
    for (const chapter of chapters) $("chapter-" + chapter.id).hidden = chapter.id !== id;
    for (const link of chapterLinks) {
      if (link.dataset.chapter === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const panel = $("chapter-" + id);
    if (id === "00") dashboard();
    else {
      const chapter = byId.get(id);
      const header = el("header", { class: "chapter-header" },
        el("p", { class: "eyebrow" }, `第 ${id} 章`), el("h1", { id: "title-" + id }, chapter.title), el("p", {}, chapter.aim));
      const root = el("div", { class: "chapter-body" });
      panel.replaceChildren(header, root);
      lab.chapters[id]({ root, state, id, el, table, save, download, go,
        complete: (value) => complete(id, value),
        recordArtifact(title, markdown) {
          workspace.recordArtifact(state, id, title, markdown);
          save();
        },
      });
    }
    const position = chapters.findIndex(chapter => chapter.id === id);
    const prev = chapters[position - 1];
    const next = chapters[position + 1];
    const footer = $("chapter-footer");
    footer.hidden = id === "00";
    footer.replaceChildren(...[
      prev && chapterLink(prev.id, `← ${prev.short}`, "button secondary"),
      next ? chapterLink(next.id, `${next.short} →`, "button primary") : chapterLink("00", "ダッシュボードへ →", "button primary"),
    ].filter(Boolean));
    updateProgress();
    if (focus) {
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: "start" });
    }
  }

  $("save-backup").addEventListener("click", () => {
    download("pl-lab-backup.json", JSON.stringify(state, null, 2), "application/json;charset=utf-8");
    dataMenu.open = false;
    inform("学習データを JSON に保存しました。");
  });
  $("load-backup").addEventListener("click", () => backupFile.click());
  backupFile.addEventListener("change", async () => {
    const [file] = backupFile.files;
    backupFile.value = "";
    if (!file) return;
    dataMenu.open = false;
    try {
      if (file.size > workspace.maxBackupBytes) throw new Error("バックアップは 4 MB 以内にしてください。");
      const imported = workspace.parse(await file.text());
      if (!window.confirm("今の演習データを、読み込んだバックアップで置き換えますか？")) return;
      state = imported;
      save();
      render();
      inform("バックアップを復元しました。");
    } catch (error) {
      inform(`復元できませんでした。${error.message}`, true);
    }
  });
  $("save-artifacts").addEventListener("click", () => {
    const items = workspace.artifacts(state);
    dataMenu.open = false;
    if (!items.length) return inform("まだ成果物がありません。演習画面で回答を確認してください。", true);
    const markdown = ["# Web開発 PL実践ラボ 成果物", ...items.map(({ id, title, markdown: body }) => `## ${id} ${title}\n\n${body}`)].join("\n\n---\n\n");
    download("pl-lab-artifacts.md", markdown, "text/markdown;charset=utf-8");
    inform("成果物を Markdown に保存しました。");
  });
  $("reset-workspace").addEventListener("click", () => {
    if (!window.confirm("保存した回答・計画・進捗を削除して、最初の案件設定に戻しますか？")) return;
    state = workspace.fresh();
    save();
    go("00");
    inform("演習を初期状態に戻しました。完成例は各章で引き続き参照できます。");
  });

  function tuneMenu() { menu.open = !mobile.matches; }
  if (mobile.addEventListener) mobile.addEventListener("change", tuneMenu);
  else mobile.addListener(tuneMenu);
  window.addEventListener("hashchange", () => render(true));
  document.addEventListener("click", event => {
    const anchor = event.target.closest?.('a[href^="#chapter-"]');
    if (anchor && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && anchor.hash === `#chapter-${current}`) {
      event.preventDefault();
      render(true);
    }
  });
  dataMenu.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !dataMenu.open) return;
    dataMenu.open = false;
    dataMenu.querySelector("summary").focus();
  });
  state = loadState();
  tuneMenu();
  if (location.protocol === "file:") document.querySelector("[data-portal-link]").hidden = true;
  dataMenu.hidden = false;
  $("nav-progress").hidden = false;
  document.documentElement.classList.add("lab-ready");
  render();
})();
