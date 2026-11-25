import { indexQueries, indexSetup } from "./index-data.js";

const formatter = new Intl.NumberFormat("ja");
const planTerms = [
  ["Seq Scan", "テーブルを順に走査し、条件に一致する行を選びます。多くの行を読むクエリでは合理的なことがあります。"],
  ["Index Scan", "インデックスの順序や条件で行を探し、必要に応じてテーブル本体から列を取り出します。"],
  ["Index Only Scan", "必要な列をインデックスから得ます。行の可視性によっては、テーブル本体も確認します。"],
  ["Bitmap Index / Heap Scan", "インデックスで候補の行位置を集め、テーブルのページ単位で読み進めます。"],
  ["Sort", "下位の処理から受け取った行を指定順に並べます。インデックス順で出せる場合は省かれることがあります。"],
  ["Index Cond / Filter", "Index Cond はインデックス内で探す範囲を絞ります。Filter は取得後の行に条件を適用します。"],
];

function make(doc, tag, className, content) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function totalBlocks(variant) {
  const buffers = variant.buffers;
  return buffers ? buffers.hit + buffers.read : null;
}

function addCode(doc, target, label, value) {
  const pre = make(doc, "pre", "iw-code");
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", label);
  pre.append(make(doc, "code", "", value));
  target.append(pre);
  return pre;
}

function makePlan(doc, role, variant) {
  const card = make(doc, "article", "iw-plan");
  card.dataset.planRole = role;
  const label = role === "before" ? "比較元" : "選択中";
  const header = make(doc, "header", "iw-plan-head");
  header.append(make(doc, "p", "iw-plan-role", label), make(doc, "h4", "", variant.label));
  card.append(header);

  const counts = make(doc, "dl", "iw-counts");
  const blocks = totalBlocks(variant);
  const facts = [
    ["結果行", Number.isFinite(variant.rows) ? formatter.format(variant.rows) : "—"],
    ["共有ブロック参照", blocks === null ? "—" : formatter.format(blocks)],
  ];
  for (const [key, value] of facts) {
    const group = make(doc, "div");
    group.append(make(doc, "dt", "", key), make(doc, "dd", "", value));
    counts.append(group);
  }
  card.append(counts);
  if (variant.buffers) {
    card.append(make(doc, "p", "iw-buffer-split", `hit ${formatter.format(variant.buffers.hit)} · read ${formatter.format(variant.buffers.read)}`));
  }
  if (variant.nodes?.length) {
    const operators = make(doc, "ul", "iw-operators");
    operators.setAttribute("aria-label", "実行計画に出る主な処理");
    for (const operator of variant.nodes) operators.append(make(doc, "li", "", operator));
    card.append(operators);
  }
  addCode(doc, card, `${label}の実行計画`, variant.plan);
  return card;
}

function addCopy(doc, heading, pre, status, label) {
  const button = make(doc, "button", "iw-copy", "コピー");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.addEventListener("click", async () => {
    try {
      await doc.defaultView.navigator.clipboard.writeText(pre.textContent);
      status.textContent = "コピーしました。";
    } catch {
      const selection = doc.getSelection();
      if (!selection) return;
      const range = doc.createRange();
      range.selectNodeContents(pre);
      pre.focus();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "選択したテキストをコピーしてください。";
    }
  });
  heading.append(button);
  return button;
}

export function mountIndexWorkbench(container) {
  const doc = container.ownerDocument;
  container.classList.add("rdb-index");

  const title = make(doc, "h2", "", "クエリからインデックスを選ぶ");
  const intro = make(doc, "p", "iw-intro", "サンプルデータで取得した PostgreSQL の実行計画を比較します。SQL の条件・並び順と、インデックスの列や順番を見比べてみましょう。");
  const controls = make(doc, "div", "iw-controls");
  const queryArea = make(doc, "div", "iw-query-picker");
  queryArea.append(make(doc, "h3", "", "試すクエリ"));
  const queryButtons = make(doc, "div", "iw-query-buttons");
  queryButtons.setAttribute("role", "group");
  queryButtons.setAttribute("aria-label", "試すクエリ");
  queryArea.append(queryButtons);
  const variantLabel = make(doc, "label", "iw-variant-label");
  variantLabel.append(make(doc, "span", "", "比較するインデックス"));
  const select = make(doc, "select");
  select.id = "index-candidate";
  variantLabel.append(select);
  controls.append(queryArea, variantLabel);

  const goal = make(doc, "p", "iw-goal");
  const snippets = make(doc, "div", "iw-snippets");
  const sqlBox = make(doc, "div", "iw-code-box");
  const sqlHeading = make(doc, "div", "iw-code-heading");
  sqlHeading.append(make(doc, "h3", "", "クエリ"));
  sqlBox.append(sqlHeading);
  const sql = addCode(doc, sqlBox, "クエリの SQL", "");
  const ddlBox = make(doc, "div", "iw-code-box");
  const ddlHeading = make(doc, "div", "iw-code-heading");
  ddlHeading.append(make(doc, "h3", "", "追加する定義"));
  ddlBox.append(ddlHeading);
  const ddl = addCode(doc, ddlBox, "インデックスの DDL", "");
  snippets.append(sqlBox, ddlBox);
  const copyStatus = make(doc, "p", "iw-copy-status");
  copyStatus.setAttribute("role", "status");
  addCopy(doc, sqlHeading, sql, copyStatus, "クエリの SQL をコピー");
  const copyDdl = addCopy(doc, ddlHeading, ddl, copyStatus, "インデックスの DDL をコピー");

  const planHeading = make(doc, "div", "iw-comparison-heading");
  planHeading.append(make(doc, "h3", "", "実行計画の比較"), make(doc, "span", "", indexSetup.title));
  const plans = make(doc, "div", "iw-plans");
  const planBlocks = make(doc, "p", "iw-plan-blocks");

  const insights = make(doc, "section", "iw-insights");
  insights.append(make(doc, "h3", "", "読み取れること"));
  const summary = make(doc, "p");
  const tradeoff = make(doc, "p", "iw-tradeoff");
  insights.append(summary, tradeoff);

  const glossary = make(doc, "details", "iw-reference");
  glossary.append(make(doc, "summary", "", "実行計画の用語を確認する"));
  const terms = make(doc, "dl", "iw-glossary");
  for (const [name, description] of planTerms) {
    const term = make(doc, "div");
    term.append(make(doc, "dt", "", name), make(doc, "dd", "", description));
    terms.append(term);
  }
  glossary.append(terms);

  const setup = make(doc, "details", "iw-reference");
  setup.append(make(doc, "summary", "", "この比較の条件"));
  const setupContent = make(doc, "div", "iw-setup");
  setupContent.append(make(doc, "p", "", indexSetup.description), make(doc, "p", "", indexSetup.source));
  if (indexSetup.notes.length) {
    const list = make(doc, "ul");
    for (const note of indexSetup.notes) list.append(make(doc, "li", "", note));
    setupContent.append(list);
  }
  setup.append(setupContent);

  container.replaceChildren(title, intro, controls, goal, snippets, copyStatus, planHeading, plans, planBlocks, insights, glossary, setup);

  const buttons = new Map();
  let query = indexQueries[0];

  function renderVariant() {
    const baseline = query.variants[0];
    const variant = query.variants.find(({ id }) => id === select.value) ?? baseline;
    sql.firstElementChild.textContent = query.sql;
    ddl.firstElementChild.textContent = variant.ddl || "追加のインデックス定義はありません。";
    copyDdl.disabled = !variant.ddl;
    copyStatus.textContent = "";
    plans.replaceChildren(makePlan(doc, "before", baseline), makePlan(doc, "after", variant));
    const before = totalBlocks(baseline);
    const after = totalBlocks(variant);
    planBlocks.hidden = before === null || after === null;
    if (!planBlocks.hidden) {
      planBlocks.textContent = `この例の共有ブロック参照は ${formatter.format(before)} → ${formatter.format(after)}。hit と read の合計で、ディスク I/O や処理時間とは区別します。`;
    }
    summary.textContent = variant.summary;
    tradeoff.textContent = variant.tradeoff ?? "";
    tradeoff.hidden = !variant.tradeoff;
  }

  function chooseQuery(next) {
    query = next;
    for (const [id, button] of buttons) button.setAttribute("aria-pressed", String(id === query.id));
    goal.textContent = query.goal;
    const candidates = query.variants.length > 1 ? query.variants.slice(1) : query.variants;
    const options = candidates.map(({ id, label }) => {
      const option = make(doc, "option", "", label);
      option.value = id;
      return option;
    });
    select.replaceChildren(...options);
    select.disabled = options.length < 2;
    renderVariant();
  }

  for (const item of indexQueries) {
    const button = make(doc, "button", "", item.title);
    button.type = "button";
    button.dataset.indexQuery = item.id;
    button.addEventListener("click", () => chooseQuery(item));
    queryButtons.append(button);
    buttons.set(item.id, button);
  }

  select.addEventListener("change", renderVariant);
  chooseQuery(query);
}
