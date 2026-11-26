import { createDeliveryArchive } from "./delivery-archive.js";
import { discoveryStages } from "./delivery-discovery.js";
import { releaseStages } from "./delivery-release.js";

const stages = [...discoveryStages, ...releaseStages];
const documentIndex = {
  path: "docs/README.md",
  title: "資料の読み順",
  markdown: [
    "# 備品貸出管理 — 企画からリリースまで",
    "",
    "社内の社員が空いている備品を探し、自分の貸出と返却を記録する架空の Web アプリです。自分の案件に使うときは、利用者・規模・制約・担当・公開条件を実際に確認した内容に置き換えます。",
    "",
    ...stages.flatMap((stage, index) => [
      `## ${index + 1}. ${stage.title}`,
      "",
      stage.summary,
      "",
      ...stage.documents.map(doc => `- [${doc.title}](${doc.path.slice("docs/".length)})`),
      "",
      `完了の判断 — ${stage.ready}`,
      "",
    ]),
    "## 資料のつなぎ方",
    "",
    "貸出登録なら R-02（要件） → S-02（画面） → D-02（処理） → T-02（競合試験）とたどります。W-06 で実装し、W-08 で試験結果を残します。R-02 が変われば、この参照を使って確認すべき資料と作業を特定できます。",
    "",
    "リポジトリでは実行コードを `src/`、自動テストを `tests/`、環境定義を `infra/` に置く構成を想定しています。資料は `docs/` に置き、コードと関係する変更は同じ差分で更新します。",
    "",
  ].join("\n"),
};
const documents = [documentIndex, ...stages.flatMap(stage => stage.documents)];

export function mountDelivery(container, { saveFile }) {
  const document = container.ownerDocument;
  const find = (selector) => container.querySelector(selector);
  container.innerHTML = `
    <header class="delivery-heading">
      <div>
        <h2 id="delivery-title">1本のアプリを企画からリリースまで</h2>
        <p>社内の備品貸出アプリを例に、何を聞き、何を決め、どの資料に残すかを追います。</p>
      </div>
      <button type="button" class="action primary-action" data-download-zip>記入例一式を ZIP で保存</button>
    </header>
    <ol class="delivery-stages" aria-label="開発の段階"></ol>
    <section class="delivery-stage" aria-labelledby="delivery-stage-title">
      <div class="delivery-stage-main">
        <h3 id="delivery-stage-title"></h3>
        <p class="delivery-stage-summary"></p>
        <ol class="delivery-steps"></ol>
      </div>
      <div class="delivery-stage-aside">
        <div class="delivery-ready">
          <h4>完了の判断</h4>
          <p></p>
        </div>
        <div class="delivery-mode">
          <h4></h4>
          <p></p>
        </div>
      </div>
    </section>
    <section class="delivery-docs" aria-labelledby="delivery-docs-title">
      <header>
        <h3 id="delivery-docs-title">資料フォルダの構成と記入例</h3>
        <p>ファイルを選んで中身を確認できます。ZIP を展開すると同じ <code>docs/</code> 構成になります。</p>
      </header>
      <div class="delivery-library">
        <nav class="delivery-tree" aria-label="資料ファイル">
          <p><code>docs/</code></p>
        </nav>
        <div class="delivery-preview">
          <header>
            <div><h4></h4><code class="delivery-path"></code></div>
            <button type="button" class="action secondary-action" data-download-markdown>Markdown を保存</button>
          </header>
          <pre tabindex="0" aria-label="選択した資料の Markdown"></pre>
        </div>
      </div>
    </section>
    <p class="delivery-status" role="status"></p>
    <footer class="delivery-related" aria-label="関連する作業スペース">
      <a href="#templates">自分の案件に使うひな形</a>
      <a href="#wbs">WBS を編集する</a>
      <a href="../database/#constraints">貸出の制約を RDB Design Lab で学ぶ</a>
    </footer>`;

  const stageList = find(".delivery-stages");
  const tree = find(".delivery-tree");
  const preview = find(".delivery-preview pre");
  const status = find(".delivery-status");
  const folders = new Map();
  const fileButtons = new Map();
  const stageButtons = new Map();
  let activeStage = stages[0];
  let selectedDocument;
  let mode = "solo";

  function selectDocument(doc) {
    if (selectedDocument) fileButtons.get(selectedDocument.path).removeAttribute("aria-current");
    selectedDocument = doc;
    fileButtons.get(doc.path).setAttribute("aria-current", "true");
    find(".delivery-preview h4").textContent = doc.title;
    find(".delivery-path").textContent = doc.path;
    preview.textContent = doc.markdown;
    preview.scrollTop = 0;
    status.textContent = "";
  }

  function addDocument(parent, doc) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = doc.path.split("/").at(-1);
    button.setAttribute("aria-label", `${doc.title} ${button.textContent}`);
    button.addEventListener("click", () => selectDocument(doc));
    parent.append(button);
    fileButtons.set(doc.path, button);
  }

  function updateMode() {
    find(".delivery-mode h4").textContent = mode === "team" ? "チーム開発での確認" : "ひとり開発での確認";
    find(".delivery-mode p").textContent = activeStage[mode];
  }

  function selectStage(stage) {
    stageButtons.get(activeStage.id).setAttribute("aria-pressed", "false");
    activeStage = stage;
    stageButtons.get(stage.id).setAttribute("aria-pressed", "true");
    find("#delivery-stage-title").textContent = stage.title;
    find(".delivery-stage-summary").textContent = stage.summary;
    find(".delivery-ready p").textContent = stage.ready;
    find(".delivery-steps").replaceChildren(...stage.steps.map(({ title, text }) => {
      const item = document.createElement("li");
      const heading = document.createElement("h4");
      const body = document.createElement("p");
      heading.textContent = title;
      body.textContent = text;
      item.append(heading, body);
      return item;
    }));
    updateMode();
    folders.get(stage.id).open = true;
    selectDocument(stage.documents[0]);
  }

  addDocument(tree, documentIndex);
  for (const [index, stage] of stages.entries()) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const number = document.createElement("span");
    button.type = "button";
    button.dataset.deliveryStage = stage.id;
    button.setAttribute("aria-pressed", "false");
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1);
    button.append(number, stage.title);
    button.addEventListener("click", () => selectStage(stage));
    item.append(button);
    stageList.append(item);
    stageButtons.set(stage.id, button);

    const folder = document.createElement("details");
    const label = document.createElement("summary");
    label.textContent = `${stage.documents[0].path.split("/")[1]}/`;
    folder.append(label);
    for (const doc of stage.documents) addDocument(folder, doc);
    tree.append(folder);
    folders.set(stage.id, folder);
  }

  find("[data-download-zip]").addEventListener("click", () => {
    saveFile("asset-lending-delivery-docs.zip", createDeliveryArchive(documents), "application/zip");
    status.textContent = "資料一式の保存を開始しました。";
  });
  find("[data-download-markdown]").addEventListener("click", () => {
    const filename = selectedDocument.path.split("/").at(-1);
    saveFile(filename, selectedDocument.markdown, "text/markdown;charset=utf-8");
    status.textContent = "選択した資料の保存を開始しました。";
  });

  selectStage(activeStage);
  return {
    setMode(value) {
      mode = value;
      updateMode();
    },
  };
}
