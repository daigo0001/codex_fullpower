const SELECT_ACTIVE = `SELECT count(*)
FROM loans
WHERE tenant_id = 1 AND asset_id = 3
  AND returned_at IS NULL;`;

const UNIQUE_INDEX = `CREATE UNIQUE INDEX loans_one_active_per_asset
ON loans (tenant_id, asset_id)
WHERE returned_at IS NULL;`;

function insertSql(id, borrower) {
  return `INSERT INTO loans
  (id, tenant_id, asset_id, borrower_id, borrowed_at, returned_at)
VALUES (${id}, 1, 3, ${borrower}, CURRENT_TIMESTAMP, NULL);`;
}

const start = {
  title: "開始前", operation: "ready", actor: "",
  detail: "テナント1の備品 A-03 に、貸出中の行はありません。社員 A と社員 B がほぼ同時に借りようとします。",
};

const selectA = {
  title: "A が貸出状況を確認", operation: "select", actor: "A", sql: SELECT_ACTIVE,
  detail: "A はトランザクションを開始し、貸出中の行が0件なので空きありと判断します。",
};

const selectB = {
  title: "B も貸出状況を確認", operation: "select", actor: "B", sql: SELECT_ACTIVE,
  detail: "B の SELECT も0件です。通常の SELECT で得た結果は、この後の INSERT をほかのトランザクションから守りません。",
};

const insertA = {
  title: "A が貸出行を追加", operation: "insert", actor: "A", sql: insertSql(101, 21),
  detail: "A の INSERT は成功しました。行は未確定で、別の接続の通常の SELECT にはまだ見えません。",
};

const insertBUnguarded = {
  title: "B も貸出行を追加", operation: "insert", actor: "B", sql: insertSql(102, 22),
  detail: "2行が同じ備品を指すことをチェックする制約がないため、B の INSERT も成功します。どちらもまだ未確定です。",
};

const insertBGuarded = {
  title: "B の INSERT が待機", operation: "wait", actor: "B", sql: insertSql(102, 22),
  detail: "ユニークインデックスの検査が A の未確定の行にぶつかり、B の INSERT は A が COMMIT または ROLLBACK するまで待機します。",
};

const commitA = {
  title: "A がコミット", operation: "commit", actor: "A", sql: "COMMIT;",
  detail: "A の行が確定し、別の接続からも見える状態になります。",
};

const commitBConflict = {
  title: "B もコミット", operation: "commit", actor: "B", sql: "COMMIT;",
  detail: "B の行も確定し、同じ備品に対して2件の有効な貸出が残りました。2つの処理がそれぞれ成功しても、業務ルールは守れていません。",
};

const rejectB = {
  title: "B がユニーク違反を受け取る", operation: "reject", actor: "B",
  sql: "ERROR: duplicate key value violates unique constraint\nSQLSTATE: 23505",
  detail: "A のコミット後、B の INSERT が一意性を再確認して 23505 を返します。B は失敗状態になり、この例ではトランザクションをロールバックします。",
};

const rollbackB = {
  title: "B がロールバック", operation: "rollback", actor: "B", sql: "ROLLBACK;",
  detail: "B は失敗した処理を終了します。アプリは該当の制約違反を貸出競合に変換して、利用者へ結果を伝えられます。",
};

const rollbackA = {
  title: "A がロールバック", operation: "rollback", actor: "A", sql: "ROLLBACK;",
  detail: "A の未確定行が取り消されます。確定した貸出行はまだ0件です。",
};

const resumeB = {
  title: "B の INSERT が成功", operation: "insert", actor: "B",
  detail: "A が取り消したため、B の INSERT が再開し、重複がないことを確かめて成功します。B が行を見られる状態になり、確定はまだです。",
};

const commitB = {
  title: "B がコミット", operation: "commit", actor: "B", sql: "COMMIT;",
  detail: "B の貸出が確定します。テナント1の備品 A-03 に対して、貸出中の行は1件です。",
};

export const transactionScenarios = [
  {
    id: "select-only", label: "SELECT で確認", hasIndex: false,
    summary: "2人が空きの確認を済ませてから、それぞれ行を追加します。",
    steps: [start, selectA, selectB, insertA, insertBUnguarded, commitA, commitBConflict],
  },
  {
    id: "unique-commit", label: "部分ユニーク ＋ A が COMMIT", hasIndex: true,
    summary: "A が貸出を確定し、待機していた B がユニーク違反を受け取ります。",
    steps: [start, selectA, selectB, insertA, insertBGuarded, commitA, rejectB, rollbackB],
  },
  {
    id: "unique-rollback", label: "部分ユニーク ＋ A が ROLLBACK", hasIndex: true,
    summary: "A が処理を取り消すと、待機していた B が貸出を開始できます。",
    steps: [start, selectA, selectB, insertA, insertBGuarded, rollbackA, resumeB, commitB],
  },
];

const sqlLabels = {
  ready: "未開始", select: "空き確認 · 0件", insert: "INSERT · 未確定",
  wait: "INSERT · 待機", commit: "確定", reject: "失敗 · 23505", rollback: "取消",
};

function applyStep(state, step) {
  if (!step.actor) return state;
  const { operation, actor } = step;
  let rows = state.rows;
  if (operation === "insert") {
    const id = actor === "A" ? 101 : 102;
    rows = [...rows, { id, owner: actor, status: "pending" }];
  }
  if (operation === "commit") {
    rows = rows.map((row) => row.owner === actor ? { ...row, status: "committed" } : row);
  }
  if (operation === "rollback") rows = rows.filter((row) => row.owner !== actor);
  return { rows, actors: { ...state.actors, [actor]: operation } };
}

export function transactionSnapshot(scenarioId, stepIndex) {
  const scenario = transactionScenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new RangeError("Unknown transaction scenario.");
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= scenario.steps.length) {
    throw new RangeError("Unknown transaction step.");
  }
  const initial = { rows: [], actors: { A: "ready", B: "ready" } };
  return scenario.steps.slice(0, stepIndex + 1).reduce(applyStep, initial);
}

export function mountTransactionLab(container) {
  if (container.classList.contains("rdb-transaction")) return;
  container.classList.add("rdb-transaction");
  container.innerHTML = `
    <div class="rdb-tx-header">
      <div><h2>同時更新を試す</h2><p>2人が同じ備品を借りたとき、SELECT と部分ユニークインデックスが守れる範囲を比べます。</p></div>
      <span class="rdb-tx-tech">PostgreSQL · READ COMMITTED</span>
    </div>
    <div class="rdb-tx-choices" role="group" aria-label="並行処理のシナリオ"></div>
    <p class="rdb-tx-summary"></p>
    <div class="rdb-tx-controls">
      <button type="button" data-tx-control="prev">前の手順</button>
      <button type="button" data-tx-control="next" class="rdb-tx-primary">次の手順</button>
      <button type="button" data-tx-control="reset">最初に戻る</button>
      <output aria-label="進行状況" class="rdb-tx-progress"></output>
    </div>
    <div class="rdb-tx-stage" aria-live="polite">
      <div class="rdb-tx-stage-copy">
        <h3 class="rdb-tx-step-title"></h3>
        <p class="rdb-tx-detail"></p>
        <pre class="rdb-tx-sql"><code></code></pre>
      </div>
      <div class="rdb-tx-snapshots">
        <div class="rdb-tx-actor" data-tx-actor="A"><span>社員 A</span><strong></strong></div>
        <div class="rdb-tx-actor" data-tx-actor="B"><span>社員 B</span><strong></strong></div>
        <div class="rdb-tx-storage"><span>確定した貸出</span><strong class="rdb-tx-committed"></strong><ul class="rdb-tx-rows" aria-label="対象の貸出行"></ul></div>
      </div>
    </div>
    <ol class="rdb-tx-timeline" aria-label="トランザクションの時系列"></ol>
    <details class="rdb-tx-rule"><summary>この実験の制約と前提</summary>
      <p class="rdb-tx-rule-copy"></p>
      <pre><code></code></pre>
      <p>2つのトランザクションを READ COMMITTED で実行する模式図です。各 SELECT は書き込み前に実行し、ロック待ちにタイムアウトは設定しません。再送を同じ要求として扱う必要がある場合は、操作IDなどの冪等性キーも設計します。</p>
      <p class="rdb-tx-source"><a href="https://www.postgresql.org/docs/current/index-unique-checks.html">PostgreSQL 公式 · ユニークインデックスの検査</a></p>
    </details>
  `;

  const $ = (selector) => container.querySelector(selector);
  const select = $(".rdb-tx-choices");
  const timeline = $(".rdb-tx-timeline");
  const scoped = container.ownerDocument;
  let active = transactionScenarios[0];
  let stepIndex = 0;
  const flags = [];
  const jumpButtons = [];

  function button(label) {
    const node = scoped.createElement("button");
    node.type = "button";
    node.textContent = label;
    return node;
  }

  for (const scenario of transactionScenarios) {
    const tab = button(scenario.label);
    tab.addEventListener("click", () => {
      active = scenario;
      stepIndex = 0;
      renderTimeline();
      render();
    });
    select.append(tab);
    flags.push({ tab, scenario });
  }

  $(".rdb-tx-controls").addEventListener("click", (event) => {
    const control = event.target.closest("[data-tx-control]")?.dataset.txControl;
    if (!control) return;
    if (control === "prev") stepIndex -= 1;
    if (control === "next") stepIndex += 1;
    if (control === "reset") stepIndex = 0;
    render();
  });

  function renderTimeline() {
    timeline.replaceChildren();
    jumpButtons.length = 0;
    for (const [index, step] of active.steps.entries()) {
      const item = scoped.createElement("li");
      const jump = button(index === 0 ? step.title : `${index}. ${step.title}`);
      jump.addEventListener("click", () => {
        stepIndex = index;
        render();
      });
      item.append(jump);
      timeline.append(item);
      jumpButtons.push(jump);
    }
  }

  function render() {
    const { rows, actors } = transactionSnapshot(active.id, stepIndex);
    const step = active.steps[stepIndex];
    const committedCount = rows.filter(({ status }) => status === "committed").length;
    for (const { tab, scenario } of flags) tab.setAttribute("aria-pressed", String(active === scenario));
    for (const [index, jump] of jumpButtons.entries()) {
      if (index === stepIndex) jump.setAttribute("aria-current", "step");
      else jump.removeAttribute("aria-current");
    }
    $(".rdb-tx-summary").textContent = active.summary;
    $(".rdb-tx-progress").textContent = `${stepIndex} / ${active.steps.length - 1}`;
    $("[data-tx-control=prev]").disabled = stepIndex === 0;
    $("[data-tx-control=reset]").disabled = stepIndex === 0;
    $("[data-tx-control=next]").disabled = stepIndex === active.steps.length - 1;
    $(".rdb-tx-step-title").textContent = step.title;
    $(".rdb-tx-detail").textContent = step.detail;
    $(".rdb-tx-sql").hidden = !step.sql;
    $(".rdb-tx-sql code").textContent = step.sql ?? "";
    for (const actor of ["A", "B"]) {
      const card = $(`[data-tx-actor="${actor}"]`);
      card.dataset.status = actors[actor];
      card.querySelector("strong").textContent = sqlLabels[actors[actor]];
    }
    const storage = $(".rdb-tx-storage");
    storage.classList.toggle("rdb-tx-duplicate", committedCount > 1);
    $(".rdb-tx-committed").textContent = `${committedCount}件`;
    $(".rdb-tx-rows").replaceChildren(...rows.map(({ id, owner, status }) => {
      const row = scoped.createElement("li");
      row.textContent = `貸出 ${id} · 社員 ${owner} · ${status === "committed" ? "確定" : "未確定"}`;
      return row;
    }));
    $(".rdb-tx-rule-copy").textContent = active.hasIndex
      ? "返却されていない行だけを対象に、テナントと備品の組み合わせを一意にします。"
      : "このシナリオでは、同じ備品の有効な貸出を1件に制限するDB制約を設定していません。";
    $(".rdb-tx-rule pre").hidden = !active.hasIndex;
    $(".rdb-tx-rule code").textContent = active.hasIndex ? UNIQUE_INDEX : "";
  }

  renderTimeline();
  render();
}
