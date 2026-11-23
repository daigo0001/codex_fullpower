const trace = `
  <div class="pg-trace" aria-label="貸出登録の関連資料と作業">
    <span><strong>R-02</strong> 貸出登録</span>
    <a href="#screen"><strong>S-02</strong> 貸出フォーム</a>
    <a href="#detail"><strong>D-02</strong> 貸出登録処理</a>
    <span><strong>T-02</strong> 二重貸出の拒否</span>
    <a href="#wbs"><strong>W-06</strong> 貸出登録を実装</a>
  </div>`;

const roadmap = `
  <h2>使う人と最初の成果を決める</h2>
  <p class="pg-lead">最初のリリースで誰の何が変わるかを一文で書き、通しで試せる範囲を決めます。設計では、作る人や確認する人が判断に迷う箇所から具体化します。</p>
  <div class="pg-example">
    <h3>題材は社内の備品貸出管理</h3>
    <div class="pg-triple">
      <div><strong>目的</strong><p>社員が空いている備品を探し、自分で貸出登録できるようにする。</p></div>
      <div><strong>最初の範囲</strong><p>R-01 備品一覧、R-02 貸出登録、R-03 返却。貸出中の備品は二重登録できない。</p></div>
      <div><strong>次に回すもの</strong><p>メール通知、予約待ち、拠点間の在庫移動。必要性は初回利用の観察で見直す。</p></div>
    </div>
  </div>
  <h3>着手順と残す成果物</h3>
  <ol class="pg-steps">
    <li><strong>業務の流れと受入条件を決める</strong><p>利用者、成功・失敗の例、初回リリースの対象と対象外を <code>docs/requirements.md</code> に記録します。貸出の成功は「一覧に貸出中と表示され、同じ備品で2件目を作れない」で確認できます。</p></li>
    <li><strong>画面とデータの流れを描く</strong><p>画面遷移と成功・失敗時のワイヤーフレームを用意し、必要なデータと権限を洗い出します。<a href="#screen">画面設計の例</a></p></li>
    <li><strong>壊れると困るルールを設計する</strong><p>API 仕様、状態遷移、トランザクション、失敗時の応答と試験を決めます。<a href="#detail">詳細設計の例</a></p></li>
    <li><strong>起動から公開までを設計する</strong><p>構成図、環境差、配布方法、バックアップと復旧手順を記録します。<a href="#infra">インフラ設計の例</a></p></li>
    <li><strong>作業に分解し、縦に1本通す</strong><p>WBS に完了条件と前提を入れます。最初は一覧から貸出登録までを小さく実装し、画面・アプリ・DB・テストがつながることを確かめます。<a href="#wbs-guide">WBS の書き方</a></p></li>
    <li><strong>公開し、戻せる状態で運用する</strong><p>ステージングで試験して公開し、ログ・監視・問い合わせ導線を確認します。本番で得た情報をもとに対象範囲や優先度を更新します。</p></li>
  </ol>
  <h3>同じ機能を資料間で追えるようにする</h3>
  <p>要件、画面、処理、試験、WBS に同じ参照を置きます。たとえば W-06 をレビューするときは、D-02 のルールと T-02 の試験結果をその場で確認できます。</p>
  ${trace}`;

const screen = `
  <h2>画面設計</h2>
  <p class="pg-lead">ワイヤーフレームに、画面を使う目的、遷移、表示状態、入出力、エラー時に続けられる操作を紐づけます。</p>
  <div class="pg-example">
    <h3>S-02 貸出フォーム <small>R-02 に対応</small></h3>
    <div class="pg-trace" aria-label="貸出登録の画面遷移"><span>S-01 備品一覧</span><span>S-02 貸出フォーム</span><span>S-01 備品一覧に結果を表示</span></div>
    <p>ログイン済みの社員が備品を借りる画面です。備品名と利用者を表示し、返却予定日を入力して登録します。「戻る」で一覧の検索条件を維持します。</p>
    <figure class="pg-wireframe">
      <figcaption>ワイヤーフレーム · 貸出が競合したとき</figcaption>
      <div class="pg-wireframe-body">
        <strong>備品を借りる</strong>
        <p class="pg-wireframe-error">この備品は貸出中です。備品一覧から別の備品を選んでください。</p>
        <dl>
          <div><dt>備品</dt><dd>プロジェクター A</dd></div>
          <div><dt>利用者</dt><dd>ログイン中の社員</dd></div>
          <div class="pg-wireframe-field"><dt>返却予定日 <small>必須</small></dt><dd>2026-12-01</dd></div>
        </dl>
        <p class="pg-wireframe-action">← 備品一覧へ戻る</p>
      </div>
    </figure>
  </div>
  <div class="pg-scroll" role="region" tabindex="0" aria-label="入力と出力の設計例">
    <table><caption>入力と出力</caption><thead><tr><th scope="col">項目</th><th scope="col">仕様</th><th scope="col">確認例</th></tr></thead><tbody>
      <tr><th scope="row">備品</th><td>一覧から引き継いだ名称を表示。通信には <code>assetId</code> を送る。</td><td>存在しない ID はエラーとし、一覧に戻れる。</td></tr>
      <tr><th scope="row">利用者</th><td>ログイン中の社員名を表示する。貸出者はサーバーの認証情報から確定する。</td><td>ブラウザーから別人を指定できない。</td></tr>
      <tr><th scope="row">返却予定日</th><td>必須。JST の当日以降。未入力と日付の範囲をサーバーでも検証する。</td><td>当日は登録可、前日はエラー。</td></tr>
      <tr><th scope="row">成功時の出力</th><td>貸出登録の完了を伝え、一覧に貸出中の状態を表示する。</td><td>戻る操作で同じ登録が再送されない。</td></tr>
    </tbody></table>
  </div>
  <div class="pg-scroll" role="region" tabindex="0" aria-label="画面状態の設計例">
    <table><caption>状態ごとの操作とメッセージ</caption><thead><tr><th scope="col">状態</th><th scope="col">表示と操作</th></tr></thead><tbody>
      <tr><th scope="row">読込中・取得失敗</th><td>読込中はフォームの送信を止める。失敗時は理由を短く表示し、再読込と一覧への導線を出す。</td></tr>
      <tr><th scope="row">空・利用不可</th><td>一覧に備品がなければ空表示。選んだ備品が貸出不可なら理由を表示し、別の備品を選べるようにする。</td></tr>
      <tr><th scope="row">入力エラー</th><td>入力を保持し、該当項目にエラー文を関連付ける。送信後はエラー概要にフォーカスを移す。</td></tr>
      <tr><th scope="row">送信中</th><td>登録ボタンの連打を防ぐ。ネットワークエラーでは登録済みの可能性を考慮し、一覧で状態を確認してから再試行できるようにする。</td></tr>
      <tr><th scope="row">競合</th><td>「この備品は貸出中です」と表示する。再送を案内せず、空いている備品を探せるようにする。</td></tr>
    </tbody></table>
  </div>
  <p class="pg-note">Tab 順を画面の上から下に合わせ、入力にラベルを付けます。エラーは色とテキストで伝え、キーボードだけで送信とエラー修正を試します。</p>`;

const detail = `
  <h2>詳細設計</h2>
  <p class="pg-lead">画面から呼ばれる処理について、入力、実行権限、データの更新、失敗の返し方を決めます。曖昧になりやすい並行実行や外部サービス失敗も確認例を置きます。</p>
  <div class="pg-example">
    <h3>D-02 貸出登録処理 <small>R-02 / S-02</small></h3>
    <div class="pg-chips"><code>POST /loans</code><code>assetId</code><code>dueOn</code></div>
    <div class="pg-triple">
      <div><strong>境界</strong><p>コントローラーがフォームの入力と認証・認可を確認し、貸出サービスに処理を渡す。</p></div>
      <div><strong>更新</strong><p>貸出サービスが DB のトランザクション内で貸出レコードを作成し、更新を確定する。</p></div>
      <div><strong>戻り</strong><p>確定後に <code>303 See Other</code> で一覧へ戻る。入力エラーや競合では現在のフォームに理由を表示する。</p></div>
    </div>
  </div>
  <div class="pg-scroll" role="region" tabindex="0" aria-label="貸出処理の結果と画面表示">
    <table><caption>処理結果の契約</caption><thead><tr><th scope="col">条件</th><th scope="col">結果</th><th scope="col">試験で確認</th></tr></thead><tbody>
      <tr><th scope="row">有効な備品と日付</th><td>登録後に <code>303</code></td><td>貸出者と日付が保存され、一覧で貸出中になる。</td></tr>
      <tr><th scope="row">未入力・過去日</th><td><code>422</code> でフォームを返す</td><td>入力を保持し、貸出行を作らない。</td></tr>
      <tr><th scope="row">権限なし・備品なし</th><td>権限なしは <code>403</code>、備品が存在しなければ <code>404</code></td><td>許可のない利用者は更新できない。未ログインなら先に認証を求める。</td></tr>
      <tr><th scope="row">すでに貸出中</th><td><code>409 Conflict</code></td><td><strong>T-02</strong> 同じ備品への並行登録は片方だけ成功し、有効な貸出行は1件になる。</td></tr>
    </tbody></table>
  </div>
  <h3>DB が守る不変条件</h3>
  <p><code>assets</code>（備品）と <code>loans</code>（貸出履歴）は備品 ID で1対多です。貸出には利用者、貸出日時、返却予定日、実際の返却日時を持たせ、備品 ID に外部キーを置きます。</p>
  <p><code>returned_at</code> が空の行を「貸出中」とし、備品ごとに同時に1件だけ許可します。PostgreSQL の部分ユニークインデックスで確認と登録の間の競合を防ぎます。</p>
  <pre><code>CREATE UNIQUE INDEX loans_one_active_per_asset
ON loans (asset_id)
WHERE returned_at IS NULL;</code></pre>
  <p>この制約に該当する違反だけを貸出競合として返します。二重送信の防止と、再送が同じ登録を指すことの保証は別の問題です。タイムアウト時に自動再送する仕様なら、同じキーを持つ再送に同じ結果を返す冪等性キーを設計します。</p>
  <p class="pg-note">Cookie 認証のフォームでは CSRF 対策を組み込みます。申請者は認証済みの利用者から取得し、ログには識別に必要な情報だけを残します。サーバーで起きた想定外の例外は共通エラーにし、調査はリクエスト ID でログを追います。</p>
  ${trace}`;

const infra = `
  <h2>インフラ設計と公開</h2>
  <p class="pg-lead">どこで動かすか、誰が外からアクセスできるか、配布に失敗したとき何を戻すかを決めます。構成を図にし、チームなら判断の責任者を明記します。</p>
  <div class="pg-example">
    <h3>構成例</h3>
    <div class="pg-trace" aria-label="インフラの構成"><span>社員のブラウザー</span><span>HTTPS / マネージド入口</span><span>ASP.NET Core MVC</span><span>PostgreSQL</span></div>
    <p>公開経路はアプリの入口に絞ります。DB はアプリからだけ接続させ、接続先や鍵はホスティング側のシークレット設定から注入します。本番のデータや鍵を開発用環境と共有しません。</p>
  </div>
  <div class="pg-scroll" role="region" tabindex="0" aria-label="環境ごとの用途と設定">
    <table><caption>環境の分け方</caption><thead><tr><th scope="col">環境</th><th scope="col">目的</th><th scope="col">データと運用</th></tr></thead><tbody>
      <tr><th scope="row">ローカル</th><td>開発・再現。アプリと DB を起動できる手順を README に置く。</td><td>サンプルデータ。設定のひな形は値を抜いてコミットする。</td></tr>
      <tr><th scope="row">ステージング</th><td>本番に近い設定で認証、貸出、返却の動作やマイグレーションを確認。</td><td>テスト用データ。アクセスを確認担当者に限定する。</td></tr>
      <tr><th scope="row">本番</th><td>利用者が使う環境。ヘルスチェック、監視、連絡手順を置く。</td><td>本番用の設定・権限・接続情報。バックアップ先と復元方法を記録する。</td></tr>
    </tbody></table>
  </div>
  <h3>配布と復旧を先に決める</h3>
  <ol class="pg-steps">
    <li><strong>CI で検証</strong><p>変更ごとにビルドとテストを走らせ、通過した成果物をコミット ID で識別します。</p></li>
    <li><strong>ステージングで検証</strong><p>同じ成果物を配布し、起動・貸出登録・ログを確認。DB の変更は古い版のアプリと一定期間互換にし、戻せるか試します。</p></li>
    <li><strong>本番で確認</strong><p>エラー率、応答時間、貸出の成功件数を見ます。異常時の判断者、影響の連絡先、前の成果物への戻し方を手順書に書きます。</p></li>
    <li><strong>データの復旧を試す</strong><p>保持期間と許容できるデータ損失の時間幅（RPO）、復旧までの目標時間（RTO）を決めます。バックアップから別環境に復元し、必要なデータが使えることを確認します。</p></li>
  </ol>
  <p class="pg-note">アプリの版を戻しても DB は元の状態に戻りません。不可逆なデータ変更は後段に分け、復元または修正の手順を用意してから実行します。</p>`;

const layout = `
  <h2>リポジトリとフォルダ構成</h2>
  <p class="pg-lead">README は入口、<code>docs/</code> は設計と判断、<code>src/</code> は実装、<code>tests/</code> は検証です。システムが小さいうちは少数のファイルで始め、責任の境界が見えてから分けます。</p>
  <div class="pg-tree-grid">
    <div class="pg-tree"><h3>設計と運用の資料</h3><pre><code>README.md
docs/
├─ requirements.md
├─ design/
│  ├─ screens/
│  │  └─ S-02-loan-form.md
│  ├─ detail/
│  │  └─ D-02-loan-create.md
│  └─ infrastructure.md
├─ decisions/
│  └─ 001-database.md
├─ testing/
│  └─ acceptance.md
└─ operations/
   └─ release-rollback.md</code></pre></div>
    <div class="pg-tree"><h3>ASP.NET Core MVC の実装例</h3><pre><code>src/
└─ LoanApp/
   ├─ Program.cs
   ├─ Controllers/
   │  └─ LoansController.cs
   ├─ Views/
   │  └─ Loans/Create.cshtml
   ├─ Services/
   │  └─ LoanService.cs
   ├─ Data/
   │  └─ Migrations/
   └─ wwwroot/
tests/
└─ LoanApp.Tests/
.github/workflows/
infra/</code></pre></div>
  </div>
  <div class="pg-scroll" role="region" tabindex="0" aria-label="資料の置き場所の例">
    <table><caption>どこに何を書くか</caption><thead><tr><th scope="col">場所</th><th scope="col">判断の目安</th></tr></thead><tbody>
      <tr><th scope="row">README.md</th><td>何を作るか、起動とテストのコマンド、詳しい資料への入口。環境ごとの実値はホスト側に置く。</td></tr>
      <tr><th scope="row">docs/design/</th><td>画面や処理の約束と受け入れ条件。動作を変える PR で、該当する資料も更新する。</td></tr>
      <tr><th scope="row">docs/decisions/</th><td>後から理由を確認したい決定。背景、候補、決定、変更の影響を1件ずつ短く書く。</td></tr>
      <tr><th scope="row">src/ と tests/</th><td>実行されるコードと、ふるまいを確認できるテスト。T-02 のような ID を手動試験と対応させる。</td></tr>
      <tr><th scope="row">infra/ と docs/operations/</th><td>前者には適用できる構成コード、後者には配布・障害対応・復旧の手順。手順のリンク先は該当する環境と版を明記する。</td></tr>
    </tbody></table>
  </div>
  <p class="pg-note">フォルダを追加する目安は読みたい人や更新する人が変わるときです。機能が増えたら <code>Features/Loans/</code> のように機能単位でまとめる方法もあります。採用するルールは README に一文で記録します。</p>`;

const wbsGuide = `
  <h2>WBS の作り方・書き方</h2>
  <p class="pg-lead">リリースに必要な成果物を並べ、作業を検証できる単位まで分けます。前提、担当、工数、期日を記録し、先に進めない理由が分かる計画にします。</p>
  <ol class="pg-steps">
    <li><strong>成果物で区切る</strong><p>「備品貸出を公開する」を、受入条件、画面・処理設計、貸出機能、受入試験、公開手順に分けます。</p></li>
    <li><strong>1行で1つの完了を判定できるようにする</strong><p>「貸出対応」という名前を「貸出登録を実装する」に変え、成果物と確認方法を指定します。複数の担当が必要なら、引き渡せる成果物ごとに行を分けます。</p></li>
    <li><strong>依存と並行作業を確認する</strong><p>後続が待つ成果物を依存に記入します。たとえば貸出登録は処理仕様の確定を待ちます。運用手順は API 実装と並行で下書きできます。</p></li>
    <li><strong>工数と期日を分ける</strong><p>工数は集中して使う時間、期日はレビュー待ちや人の稼働を含めた提出日です。テスト、レビュー、修正も見積もり、曖昧な箇所は調査の作業を先に置きます。</p></li>
    <li><strong>到達点を置き、継続して更新する</strong><p>「受入試験合格」「本番公開」などを目印にし、遅れると到達点が動く依存を優先して確認します。計画を変えた理由も残します。</p></li>
  </ol>
  <div class="pg-scroll" role="region" tabindex="0" aria-label="WBSの改善前と改善後">
    <table><caption>W-06 貸出登録を実装する</caption><thead><tr><th scope="col">欄</th><th scope="col">曖昧な例</th><th scope="col">確認できる例</th></tr></thead><tbody>
      <tr><th scope="row">作業名</th><td>貸出対応</td><td>貸出登録を実装する</td></tr>
      <tr><th scope="row">成果物</th><td>できたもの</td><td><code>POST /loans</code> と有効な貸出を重複させない DB 制約</td></tr>
      <tr><th scope="row">完了条件</th><td>動作確認済み</td><td>D-02 の契約どおりに登録できる。成功と貸出済みの分岐を実装し、実装側のテストが通る。</td></tr>
      <tr><th scope="row">前提</th><td>設計が終わったら</td><td>画面と処理仕様の確定を経て、W-05 のスキーマ作成が完了している。</td></tr>
      <tr><th scope="row">後続作業</th><td>あとでテスト</td><td>W-08 の結合テスト T-02 で、並行リクエストの片方が 409 になり、有効な貸出が1件だけ残ることを確認する。</td></tr>
    </tbody></table>
  </div>
  <p class="pg-note">ブラウザーの作業表は工数の合計や完了行数を確認するために使えます。依存、各人の稼働、休日を踏まえた日程決定は、チームで確認します。</p>
  <a class="pg-action" href="#wbs">サンプル WBS を開く</a>`;

const sections = {
  start: roadmap,
  screen,
  detail,
  infra,
  layout,
  "wbs-guide": wbsGuide,
};

const modeNotes = {
  start: {
    solo: "要件・受入条件・対象外を短い1ページで残し、最初の機能を通してから分割を考えます。不明点と次にすることを翌日の自分が分かる言葉で記録します。",
    team: "要件ごとに確認する人を決め、設計・実装・検証で共通の受入条件を使います。役割をまたぐ引き渡しは、成果物と確認方法を先に合意してから並行作業に入ります。",
  },
  screen: {
    solo: "手書きのワイヤーフレーム1枚に、遷移とエラー例を追記してから実装します。実機で入力の順番とエラー後の戻り方を確認します。",
    team: "画面 ID、API の入出力、エラー文言を画面担当とサーバー担当で確認します。仕様がずれたときは実装と資料を同じ PR で揃えます。",
  },
  detail: {
    solo: "失敗するとデータが壊れるルールを優先して記録します。通常処理はサービスとテストで表現し、追加の図は迷う箇所に絞ります。",
    team: "入出力とエラー応答をインターフェースの担当者同士で確定します。DB 制約、認可、マイグレーションは担当外のレビュアーにも確認してもらいます。",
  },
  infra: {
    solo: "最初の構成はアプリと DB に絞ります。復元方法、監視通知、障害時に戻す版を、休止を挟んでも再現できる手順で残します。",
    team: "環境ごとのデプロイ権限、承認者、障害時の連絡先を共有します。バックアップを別環境に戻す作業を分担し、確認結果を残します。",
  },
  layout: {
    solo: "資料が少なければ、最初は README と設計メモでも進められます。更新頻度や読者が変わる資料からファイルを分けます。",
    team: "設計の置き場所と更新時の確認担当を README に記録します。PR では関係する要件・設計・試験 ID を添え、レビューで追えるようにします。",
  },
  "wbs-guide": {
    solo: "直近に着手する数件だけを細かくします。毎日の終わりに残りの工数と阻害要因を更新し、予定を詰めすぎないようにします。",
    team: "各作業の主担当とレビュー担当を決め、完了条件と待ち行列を確認します。共有版の置き場所を決め、この作業表を使う場合は CSV や JSON を共有します。",
  },
};

export function renderGuide(container, topic, { mode = "solo" } = {}) {
  const key = Object.hasOwn(sections, topic) ? topic : "start";
  const team = mode === "team";
  container.classList.add("planning-guide");
  container.innerHTML = `${sections[key]}<aside class="pg-mode"><h3>${team ? "チームで進める場合" : "ひとりで進める場合"}</h3><p>${modeNotes[key][team ? "team" : "solo"]}</p></aside>`;
}
