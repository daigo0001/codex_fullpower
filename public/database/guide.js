const design = `
  <h2>設計は「何が起きてはいけないか」から</h2>
  <p class="rdbg-lead">社内の備品貸出で、同じ備品に貸出中の記録が2件あると困ります。まず業務の言葉でルールを書き、どのデータが事実を表すか、誰がどの条件で読むかを決めます。</p>

  <ol class="rdbg-steps">
    <li><h3>業務ルールを言葉にする</h3><p>備品・借りる人・貸出は同じ組織に属し、備品1件につき有効な貸出は最大1件です。</p></li>
    <li><h3>主な読み書きを並べる</h3><p>社員は自分の履歴を新しい順に読み、管理者は未返却を確認します。貸出登録と返却は、他の利用者の操作と重なります。</p></li>
    <li><h3>保証と読み方を具体化する</h3><p>テーブルの関係、必須項目、一意性を先に決めます。検索条件や並び順が決まったら、代表的なデータの量と偏りでインデックスを比較します。</p></li>
  </ol>

  <figure class="rdbg-schema">
    <figcaption>備品貸出の関係と主キー</figcaption>
    <div class="rdbg-relationship" aria-label="貸出は1件の備品と1人の社員に属し、備品と社員には複数の貸出が紐づく">
      <strong>備品 1</strong><span aria-hidden="true">→</span><strong>貸出 0..N</strong><span aria-hidden="true">←</span><strong>社員 1</strong>
    </div>
    <div class="rdbg-schema-grid">
      <div class="rdbg-entity">
        <h3><code>assets</code> 備品</h3>
        <dl>
          <div><dt><code>tenant_id, id</code></dt><dd>組織内の備品を識別</dd></div>
          <div><dt><code>name</code></dt><dd>現在の備品名</dd></div>
        </dl>
      </div>
      <div class="rdbg-entity">
        <h3><code>members</code> 社員</h3>
        <dl>
          <div><dt><code>tenant_id, id</code></dt><dd>組織内の社員を識別</dd></div>
          <div><dt><code>display_name</code></dt><dd>現在の表示名</dd></div>
        </dl>
      </div>
      <div class="rdbg-entity rdbg-entity-accent">
        <h3><code>loans</code> 貸出</h3>
        <dl>
          <div><dt><code>tenant_id, id</code></dt><dd>貸出記録を識別</dd></div>
          <div><dt><code>asset_id, borrower_id</code></dt><dd>同じ組織の備品と社員を参照</dd></div>
          <div><dt><code>borrowed_at, returned_at</code></dt><dd>貸出と実際の返却の時刻</dd></div>
        </dl>
      </div>
    </div>
    <p class="rdbg-caption">一つの備品と一人の社員は、それぞれ複数の貸出履歴を持てます。複合外部キーに <code>tenant_id</code> を含めると、別の組織への誤った参照をDBが拒否できます。</p>
  </figure>

  <div class="rdbg-grid">
    <section class="rdbg-card">
      <h3>正規化で、変更する場所を一つにする</h3>
      <p>備品の現在の名前は <code>assets.name</code> に持ちます。履歴の画面では <code>loans</code> から参照します。当時の名前を後から再現するという要件があるなら、貸出時の名前を意味の明確なスナップショットとして保存します。</p>
    </section>
    <section class="rdbg-card">
      <h3>列に持たせる意味を決める</h3>
      <p>この例で貸出中は <code>returned_at IS NULL</code> です。返却時刻が入ると履歴になります。貸出中フラグも保存する設計では、両方の値がいつ一致するべきかまで決める必要があります。</p>
    </section>
  </div>

  <section class="rdbg-section">
    <h3>同じテーブルでも、用途ごとに読む量が違う</h3>
    <div class="rdbg-table-wrap" role="region" tabindex="0" aria-label="貸出の利用場面とアクセス条件">
      <table>
        <thead><tr><th scope="col">利用場面</th><th scope="col">条件と順序</th><th scope="col">測るポイント</th></tr></thead>
        <tbody>
          <tr><th scope="row">社員の最近の貸出</th><td>組織・社員・日付で絞り、貸出時刻の降順で先頭5件</td><td>絞り込みのあと、並べ替えを省けるか</td></tr>
          <tr><th scope="row">管理者の未返却一覧</th><td>組織で絞り、返却時刻が空の行だけを読む</td><td>履歴のうち、未返却が占める割合</td></tr>
          <tr><th scope="row">期間の運用集計</th><td>指定期間の履歴を許可された運用処理でまとめて読む</td><td>期間が長く、テーブルの大半を読む場合の計画</td></tr>
        </tbody>
      </table>
    </div>
    <p>貸出時刻が同じ行も並びが決まるよう、ページ送りする一覧では <code>id</code> を並び順の最後に加えます。インデックス演習では、200組織に分かれた貸出6万件のうち1,000件が未返却という架空データを使います。自分のアプリでも、対象となる行の割合とデータの偏りを変えて計画を比較します。</p>
  </section>

  <p class="rdbg-links"><a href="#constraints">業務ルールを制約にする</a><a href="#indexes">読み方からインデックスを試す</a></p>
  <p class="rdbg-sources">出典 <a href="https://www.postgresql.org/docs/current/ddl-constraints.html">PostgreSQL · 制約と外部キー</a></p>
`;

const constraints = `
  <h2>業務ルールを、DBが守れる制約にする</h2>
  <p class="rdbg-lead">画面、バッチ、AIが生成した処理が同じテーブルに書き込みます。書き込み元が増えても守りたいルールは、スキーマの制約として表します。</p>

  <div class="rdbg-table-wrap" role="region" tabindex="0" aria-label="DB制約の用途">
    <table>
      <thead><tr><th scope="col">制約</th><th scope="col">保証すること</th><th scope="col">貸出の例</th></tr></thead>
      <tbody>
        <tr><th scope="row"><code>PRIMARY KEY</code></th><td>行を一意に識別する。値は必須。</td><td>組織と貸出IDの組み合わせ</td></tr>
        <tr><th scope="row"><code>FOREIGN KEY</code></th><td>指定した参照相手が存在する。</td><td>貸し出す備品と借りた社員が同じ組織に存在する</td></tr>
        <tr><th scope="row"><code>NOT NULL</code></th><td>列に値が必ずある。</td><td>備品ID、借りた社員ID、貸出時刻</td></tr>
        <tr><th scope="row"><code>CHECK</code></th><td>その行の値が条件を満たす。</td><td>返却済みなら返却時刻が貸出時刻以降</td></tr>
        <tr><th scope="row"><code>UNIQUE</code></th><td>列の組み合わせが重複しない。</td><td>同じ組織の資産管理番号が重複しない</td></tr>
      </tbody>
    </table>
  </div>

  <section class="rdbg-section">
    <h3>「貸出中だけ一意」は部分ユニークインデックス</h3>
    <p>同じ備品に返却済みの履歴が何件あっても構いません。条件に合う行をインデックスの対象にし、同じ組織の同じ備品について、返却時刻が空の行を最大1件にします。</p>
    <pre tabindex="0" aria-label="部分ユニークインデックスのSQL"><code>CREATE UNIQUE INDEX loans_one_active_per_asset
    ON loans (tenant_id, asset_id)
    WHERE returned_at IS NULL;</code></pre>
    <div class="rdbg-rule-options">
      <div><strong>返却済み</strong><p>インデックスの対象外になり、同じ備品の履歴を残せます。</p></div>
      <div><strong>貸出中</strong><p>組織IDと備品IDが同じ行を同時に2件確定できなくなります。</p></div>
    </div>
    <p class="rdbg-note">この例では <code>tenant_id</code> と <code>asset_id</code> も <code>NOT NULL</code> です。アプリで事前確認している場合も、競合時はこのインデックスに対応する一意性違反を貸出中のエラーとして扱います。</p>
  </section>

  <section class="rdbg-section">
    <h3>NULL と参照整合性の意味も確認する</h3>
    <div class="rdbg-grid">
      <section class="rdbg-card"><h4>外部IDが任意の場合</h4><p>PostgreSQL の通常の <code>UNIQUE</code> では、同じ外部IDの重複は拒否され、複数の行が未設定（NULL）でも保存できます。設定済みの値と未設定をどう扱うか、先に決めておきます。</p></section>
      <section class="rdbg-card"><h4>CHECK で必須も保証したい場合</h4><p><code>CHECK (returned_at &gt;= borrowed_at)</code> は式が NULL でも行を許可します。貸出時刻の必須は <code>NOT NULL</code> で表し、返却時刻だけ空を許します。</p></section>
      <section class="rdbg-card"><h4>組織をまたぐ誤参照を防ぐ</h4><p><code>FOREIGN KEY (tenant_id, asset_id)</code> で <code>assets (tenant_id, id)</code> を参照します。借りた社員も同じ考え方です。誰に貸出を見る権限があるかは別途認可で判定します。</p></section>
      <section class="rdbg-card"><h4>外部システムのIDを受け取る</h4><p>値がどのサービスで発行され、再発行されるかを確認します。連携するなら <code>tenant_id</code>、発行元、外部IDを組にして扱い、内部の行を識別するキーは安定させます。</p></section>
    </div>
  </section>

  <p class="rdbg-links"><a href="#concurrency">同時登録の実験へ</a><a href="#indexes">通常の検索用インデックスを比べる</a></p>
  <p class="rdbg-sources">出典 <a href="https://www.postgresql.org/docs/current/ddl-constraints.html">PostgreSQL · 制約のNULLと参照整合性</a> · <a href="https://www.postgresql.org/docs/current/indexes-partial.html">PostgreSQL · 部分インデックス</a></p>
`;

const ai = `
  <h2>AIが入っても、確定データを追えるようにする</h2>
  <p class="rdbg-lead">AIにスキーマやSQLを書かせる場合は、業務ルール、想定データ量、権限と移行時の前提をレビューします。アプリにAIの提案機能を入れる場合は、提案から確定までを別々に記録します。</p>

  <div class="rdbg-grid">
    <section class="rdbg-card">
      <h3>AIの提案を記録する</h3>
      <p><code>return_suggestions</code> に対象の貸出、根拠となった記録、作成日時、モデルや設定の版、確認状態を持たせます。根拠を後から追うための参照を残し、原文・個人情報の保存範囲と期限は用途に合わせます。</p>
    </section>
    <section class="rdbg-card">
      <h3>業務上の返却を確定する</h3>
      <p>担当者が確認したあと、返却サービスが同じ認可と業務ルールを確認して <code>loans.returned_at</code> を更新します。確定した人と時刻を記録し、実施済みの提案が再送された場合の扱いも決めます。</p>
    </section>
  </div>

  <section class="rdbg-section">
    <h3>データに触れる権限をサーバーで制御する</h3>
    <p>サーバーで確認した利用者と組織を使い、検索・返却など用途の明確な操作を呼び出します。定型SQLには値をバインドし、接続先のロールには必要な権限を与えます。AIの生成文だけで組織や操作権限を決定しない設計にします。</p>
    <p>PostgreSQL の行レベルセキュリティ（RLS）を使う場合、実際のアプリ用ロールで別組織の行を読めない・更新できないことをテストします。テーブル所有者は通常ポリシーを迂回するため、アプリ用ロールの設定も確認します。</p>
  </section>

  <section class="rdbg-section">
    <h3>稼働中のスキーマは段階を分けて変更する</h3>
    <ol class="rdbg-steps">
      <li><h4>追加</h4><p>旧版が動く形で新しい列やテーブルを追加します。ロックと所要時間を見積もり、コードとSQLの適用順を確認します。</p></li>
      <li><h4>移行と切替</h4><p>既存データを小分けで移し、件数・欠損・重複を検証します。必要な期間は新旧のアプリ版で読み書きできる状態を保ちます。</p></li>
      <li><h4>整理</h4><p>利用と切り戻しの期間を確認し、使わなくなった列や互換処理を後のリリースで外します。</p></li>
    </ol>
    <p class="rdbg-note">大きいテーブルのインデックスを追加するときは、負荷やロックの影響を確認します。PostgreSQL の <code>CREATE INDEX CONCURRENTLY</code> には複数回の走査が必要で、トランザクションブロックの中では実行できません。</p>
  </section>

  <section class="rdbg-section">
    <h3>AIが作った差分のレビューで確かめること</h3>
    <ul class="rdbg-checks">
      <li>既存データに重複、NULL、参照先のない行がある状態で適用結果を確認する。</li>
      <li>同時登録・タイムアウト後の再送・別組織からの操作を実際のDBで試す。</li>
      <li>代表クエリの実行計画と読み取る行・ページを比較し、書き込みへの負担も確認する。</li>
      <li>失敗時の停止条件と復旧手順を決め、旧版が変更後のスキーマで稼働できるか確認する。</li>
    </ul>
  </section>

  <p class="rdbg-links"><a href="../planning/#detail">Web開発ガイドの詳細設計</a><a href="../incidents/#db-lock">障害対応ラボのDBロック演習</a></p>
  <p class="rdbg-sources">出典 <a href="https://www.postgresql.org/docs/current/ddl-rowsecurity.html">PostgreSQL · Row Security Policies</a> · <a href="https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY">PostgreSQL · 並行インデックス作成</a></p>
`;

const sections = { design, constraints, ai };

export function renderDatabaseGuide(container, topic = "design") {
  container.classList.add("rdb-guide");
  container.innerHTML = Object.hasOwn(sections, topic) ? sections[topic] : design;
}
