(() => {
  const lab = globalThis.ReleaseLab ??= {};
  const docs = "https://docs.github.com/ja/";
  const sourcePaths = {
    flow: ["GitHub Flow", "get-started/using-github/github-flow"],
    rules: ["ブランチ・タグのルールセット", "repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets"],
    merges: ["PR のマージ方式", "repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github"],
    events: ["ワークフローを起動するイベント", "actions/reference/workflows-and-actions/events-that-trigger-workflows"],
    artifacts: ["Actions の成果物", "actions/concepts/workflows-and-actions/workflow-artifacts"],
    environments: ["デプロイ環境と保護ルール", "actions/reference/workflows-and-actions/deployments-and-environments"],
    releases: ["GitHub Releases", "repositories/releasing-projects-on-github/about-releases"],
    manageReleases: ["Release とプレリリースを作成する", "repositories/releasing-projects-on-github/managing-releases-in-a-repository"],
    issues: ["Issue と PR の関連付け", "issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue"],
    projects: ["GitHub Projects", "issues/planning-and-tracking-with-projects/learning-about-projects/about-projects"],
    milestones: ["マイルストーン", "issues/using-labels-and-milestones-to-track-work/about-milestones"],
  };

  function sources(keys, includeSemver = false) {
    const items = keys.map(key => {
      const [label, path] = sourcePaths[key];
      return `<li><a href="${docs}${path}">${label}</a> · <a href="https://raw.githubusercontent.com/github/docs/main/content/${path}.md">公式原稿</a></li>`;
    });
    if (includeSemver) {
      items.push('<li><a href="https://semver.org/lang/ja/">Semantic Versioning</a> · <a href="https://raw.githubusercontent.com/semver/semver/master/semver.md">仕様原稿</a></li>');
    }
    return `<details class="guide-sources"><summary>公式資料と確認日</summary>
      <p>2026年11月28日（UTC）に、公開されている原稿で仕様を確認しました。案件名・番号・版・期限は学習用の例です。</p>
      <ul>${items.join("")}</ul></details>`;
  }

  lab.guide = {
    cycle: {
      title: "Issue から本番まで、同じ版を追う",
      intro: "既存の一覧・登録 API を保ち、必須の If-Match と競合応答 412 を備えた状態変更 API を追加する例で、作業から公開までを追います。",
      html: `
        <section class="guide-grid" aria-label="リリースの工程">
          <article class="lesson-card">
            <h3>1. Issue で完了条件を決める</h3>
            <p><code>#42</code> に要件 <code>REQ-005</code>、API <code>API-05</code>、テスト <code>T-005</code> を記録します。同じ ETag（画面が読んだ版）で2人が更新すると、成功の <code>200</code> と競合の <code>412</code> が各1件となり、履歴と変更監査も各1件だけ残ることを確かめます。</p>
          </article>
          <article class="lesson-card">
            <h3>2. 短いブランチで PR を作る</h3>
            <p><code>main</code> から <code>feat/42-status-conflict</code> を作り、PR <code>#58</code> に変更点、試験結果、DB への影響を書きます。<code>pull_request</code> の CI でテストを実行し、レビューします。<code>main</code> を対象に <code>Closes #42</code> を記載します。</p>
          </article>
          <article class="lesson-card">
            <h3>3. マージ後のコミットから作る</h3>
            <p><code>push</code> で動く <code>main</code> の CI で、実際に取り込まれたコミット A を再確認します。A から配備物を1回作り、イメージのダイジェスト D1 とビルドの実行 URL を記録します。ダイジェストはイメージの中身を特定する値です。</p>
          </article>
          <article class="lesson-card">
            <h3>4. 候補を検証する</h3>
            <p>A を <code>v1.4.0-rc.1</code> として識別し、D1 をステージングへ配備します。候補を GitHub Release で案内するときはプレリリースに指定します。状態変更・競合、DB の移行と切り戻し条件を試し、結果を D1 にひも付けます。</p>
          </article>
          <article class="lesson-card">
            <h3>5. タグ、Release、本番配備を記録する</h3>
            <p>合格した同じ A に <code>v1.4.0</code> を付け、GitHub Release に変更点と D1 を記録します。<code>production</code> の許可や承認を確認して D1 を配備します。候補の検証後に <code>main</code> が先へ進む場合も、配備対象は合格した A・D1 です。</p>
          </article>
          <article class="lesson-card">
            <h3>6. 配備後に利用できるか確かめる</h3>
            <p>担当が状態変更の正常系、エラー率、監査ログを確認します。配備結果に実行 URL、環境、時刻、D1、確認者を残します。異常時は事前に決めた停止条件と DB の互換性を確認し、切り戻しまたは修正版の公開を判断します。</p>
          </article>
        </section>

        <section class="lesson-card" aria-labelledby="release-guide-identities">
          <h3 id="release-guide-identities">何で版と配備先を特定するか</h3>
          <div class="table-wrap" role="region" aria-label="版と配備先の記録" tabindex="0">
            <table><thead><tr><th scope="col">記録</th><th scope="col">特定できること</th><th scope="col">この例</th></tr></thead>
            <tbody>
              <tr><th scope="row">コミット SHA</th><td>ビルド元のコード</td><td>A は <code>9bf0c42</code>。実案件では完全な SHA を記録</td></tr>
              <tr><th scope="row">Git タグ</th><td>履歴上のリリース名と参照先</td><td><code>v1.4.0-rc.1</code> と <code>v1.4.0</code> が A を指す</td></tr>
              <tr><th scope="row">GitHub Release</th><td>そのタグに対応する更新内容や配布ファイル</td><td><code>v1.4.0</code> のノートに対象 Issue、既知の問題、D1 を記載</td></tr>
              <tr><th scope="row">配備物・ダイジェスト</th><td>実際に動かすイメージの内容</td><td>実行 <code>#510</code> で作った D1 は <code>sha256:8d…5e</code>。同じ D1 を両環境へ</td></tr>
              <tr><th scope="row">環境の配備記録</th><td>いつ、どこで、どの版が動いたか</td><td><code>production</code> の配備結果、稼働確認、直前に稼働した版</td></tr>
            </tbody></table>
          </div>
          <p>Release の公開と本番配備は別々に記録します。どちらを先に行うかは組織で決め、本番確認前は公開状況をノートに明示します。CI の実行番号と Actions の一時成果物 ID は別の記録です。配備にはレジストリで解決できる完全なダイジェストを使います。</p>
        </section>

        <section class="lesson-card" aria-labelledby="release-guide-guards">
          <h3 id="release-guide-guards">マージと本番配備の関門</h3>
          <ul>
            <li><strong>PR の関門</strong>　ブランチルールで PR、必要な CI とレビューを要求します。ひとり開発で別の承認者を確保できない場合は、第三者レビューの代わりに試験とセルフチェックを記録します。</li>
            <li><strong>マージ方法</strong>　短い PR を履歴上の1変更にしたいなら squash、複数コミットや分岐の経緯を残したいなら merge commit を検討します。squash 後のコミットは PR の先端と異なるので、配備物の出所にはマージ後の A を使います。</li>
            <li><strong>配備の関門</strong>　配備ジョブに <code>environment: production</code> を指定し、環境側で許可するブランチやタグ、利用可能な承認や自己承認の制限を設定します。環境と保護ルールの対応は契約プランとリポジトリの公開範囲で確認します。</li>
            <li><strong>権限と保管</strong>　PR の確認ジョブは読み取りなど必要最小限の権限で動かし、本番操作の権限やシークレットは配備ジョブに限定します。切り戻しで使う配備物は、Actions の一時成果物の保持期間とは別に、復旧に必要な期間保管します。</li>
          </ul>
          <p class="callout"><strong>配備の確認</strong>　「承認済みコミットは何か」「ステージングで試したダイジェストはどれか」「本番で稼働中のダイジェストはどれか」の3つを、実行履歴から答えられるようにします。</p>
        </section>
        ${sources(["flow", "events", "rules", "merges", "artifacts", "environments", "releases", "manageReleases"])}
      `,
    },

    strategy: {
      title: "リリース頻度と保守期間からブランチを選ぶ",
      intro: "開発を止めずに検証したい期間と、公開済みの旧版を保守する必要があるかで、残すブランチを決めます。",
      html: `
        <section class="lesson-card" aria-labelledby="release-guide-matrix">
          <h3 id="release-guide-matrix">案件に合わせた運用の例</h3>
          <div class="table-wrap" role="region" aria-label="ブランチ運用の比較" tabindex="0">
            <table><thead><tr><th scope="col">状況</th><th scope="col">ブランチの置き方</th><th scope="col">適する理由と負担</th></tr></thead>
            <tbody>
              <tr><th scope="row">ひとり・小さな変更を頻繁に出す</th><td><code>main</code> ＋短い <code>feat/*</code>・<code>fix/*</code></td><td>短い差分を PR と CI で確認し、合格したコミットを候補にします。候補が古くなったら配備前に変更の有無を確認します。</td></tr>
              <tr><th scope="row">少人数チーム・毎週出す</th><td><code>main</code> ＋短い作業ブランチ。検証に出す候補を固定</td><td>同僚レビューと CI で取り込みを管理します。週の途中に <code>main</code> が進んでも、候補の SHA とダイジェストを記録していれば公開対象を特定できます。</td></tr>
              <tr><th scope="row">定例リリース・長めの受入と開発が重なる</th><td>候補の基点から期間限定の <code>release/1.4</code></td><td>受入中は候補に修正だけを取り込み、通常開発は <code>main</code> で続けます。修正を <code>main</code> にも反映し、意図した保守期間が終われば整理します。</td></tr>
              <tr><th scope="row">出荷後も複数の系列を保守</th><td>対象の公開タグを基点に <code>support/1.3</code></td><td>系列ごとに試験とパッチを管理できます。更新漏れを防ぐため、各系列への反映と保守終了日を Issue に残します。</td></tr>
            </tbody></table>
          </div>
          <p><code>staging</code> と <code>production</code> は配備環境の名前として扱い、どのビルドをどこへ進めるかを記録します。環境ごとに常設ブランチを運用するなら、差分と再ビルド、修正の反映先を管理する担当と手順も決めます。</p>
        </section>

        <section class="guide-grid" aria-label="版の管理と復旧">
          <article class="lesson-card">
            <h3>タグと版番号</h3>
            <p>SemVer は公開する互換性の約束を決めて使います。公開 API の互換性を壊す変更は MAJOR、互換性を保った機能追加は MINOR、互換性を保った修正は PATCH。<code>v</code> はタグの接頭辞で、版番号は <code>1.4.0</code> です。</p>
            <p>この案件は既存の一覧・登録 API を保ったまま、新しい <code>PATCH /api/tickets/{id}/status</code>（<code>API-05</code>）を追加するので、MINOR の例です。既存クライアントが省略できたヘッダーを必須にする変更は互換性を壊します。段階導入や新しい API 版を検討します。</p>
            <p><code>1.4.0-rc.1</code> は安定版の候補です。修正が必要なら <code>rc.2</code> を新しく作り、公開済みタグは動かしません。同じ候補を安定版に進めるなら、版番号や設定のために再ビルドせず、Release ノートで同じ配備物を参照します。</p>
          </article>
          <article class="lesson-card">
            <h3>本番より main が先に進んでいる</h3>
            <p>障害時は本番の配備記録で、稼働中の <code>v1.4.0</code> の SHA とダイジェストを確認します。<code>main</code> に未公開の変更があれば、稼働版のタグを出発点に短い修正系列を作ります。互換性を保つ表示不具合の修正なら <code>v1.4.1</code> としてテスト・配備します。</p>
            <p>同じ修正が次回も必要なら、PR で <code>main</code> に反映します。競合解消や適用し直しが必要なときは、修正の意図と試験結果を Issue でつなぎます。</p>
          </article>
          <article class="lesson-card">
            <h3>切り戻しと修正版の判断</h3>
            <p>安全に動かせるなら、直前に配備・検証したダイジェストを同じ経路で再配備します。タグやリリース記録は履歴として残し、再配備の結果も追記します。</p>
            <p>たとえば新しい版が旧カラムを削除していたら、旧アプリが書き込めるか判断が必要です。切り戻しが通らない場合は、書き込み停止、互換性を戻す修正版、責任者承認のもとでのデータ復旧から選びます。移行前に互換期間を設けると、旧版を戻せる選択肢が残ります。</p>
          </article>
        </section>
        ${sources(["flow", "rules", "environments", "releases"], true)}
      `,
    },

    tickets: {
      title: "WBS と Issue を、リリースまでつなぐ",
      intro: "担当者が終わりを判断できる単位でチケットを作り、見積り、検証、公開の記録をつなぎます。",
      html: `
        <section class="lesson-card" aria-labelledby="release-guide-ticket-trace">
          <h3 id="release-guide-ticket-trace">問い合わせの状態変更を1機能で追う</h3>
          <div class="table-wrap" role="region" aria-label="WBS から本番までの対応" tabindex="0">
            <table><thead><tr><th scope="col">場所</th><th scope="col">この案件に書くこと</th></tr></thead>
            <tbody>
              <tr><th scope="row">WBS</th><td>「状態変更」を設計、API 実装、結合試験に分けます。たとえば実装は ETag と DB の振る舞いが決まってから、結合試験は PR で試せる状態になってから始めます。</td></tr>
              <tr><th scope="row">Issue <code>#42</code></th><td><code>REQ-005</code> のうち、状態競合を扱う API 部分を割り当てます。背景、作業範囲、担当、完了条件、試験 <code>T-005</code>、前提作業の Issue を記録します。</td></tr>
              <tr><th scope="row">PR <code>#58</code></th><td>差分、試験結果、DB 互換性、<code>Closes #42</code> を記載。レビュー担当と CI で、完了条件を満たす証拠を確認します。</td></tr>
              <tr><th scope="row">Project と milestone</th><td>Projects の Status で作業中・レビュー中を見ます。milestone <code>v1.4.0</code> では同じ版に入れる Issue や PR の進み具合を把握します。</td></tr>
              <tr><th scope="row">Release と本番</th><td><code>v1.4.0-rc.1</code> の合格記録を残し、<code>v1.4.0</code> の Release ノートに変更と D1 を記載。本番の配備記録で実際に運用へ入ったことを確かめます。</td></tr>
            </tbody></table>
          </div>
          <p>依存や担当負荷は WBS と工程表で確認し、Issue には判断の根拠と各作業の状況を残します。見積りと依存関係を入力できる演習は <a href="../web-development-pl-lab/#chapter-06">Web開発 PL実践ラボ</a> にあります。</p>
        </section>

        <section class="guide-grid" aria-label="Issue と PR の記入例">
          <article class="lesson-card">
            <h3>Issue #42 の記入例</h3>
            <ul>
              <li><strong>タイトル</strong>　状態更新 API で古い ETag の上書きを防ぐ</li>
              <li><strong>対象</strong>　<code>REQ-005</code> → <code>API-05</code>。状態遷移と画面メッセージは別の担当とすり合わせる。</li>
              <li><strong>前提</strong>　状態遷移表と履歴・変更監査の更新方針がレビュー済み</li>
              <li><strong>完了条件</strong>　<code>T-005</code> で同じ ETag を使った並行更新が <code>200</code> と <code>412</code> に分かれ、履歴・変更監査が各1件追加される。</li>
              <li><strong>割り当て</strong>　担当はアプリ開発者、試験は QA、対象 milestone は <code>v1.4.0</code></li>
            </ul>
          </article>
          <article class="lesson-card">
            <h3>PR #58 の記入例</h3>
            <ul>
              <li><strong>変更</strong>　状態更新時に <code>If-Match</code> と照合し、古い版には <code>412</code> を返す。</li>
              <li><strong>証跡</strong>　PR の CI で <code>T-005</code> が成功。監査の重複がないことを確認。</li>
              <li><strong>配備の前提</strong>　マージ後の CI でビルドし、ステージングで同じ配備物を試す。</li>
              <li><strong>関連</strong>　<code>Closes #42</code>。対象は既定ブランチ <code>main</code>。</li>
            </ul>
          </article>
        </section>

        <section class="lesson-card" aria-labelledby="release-guide-done">
          <h3 id="release-guide-done">「終わった」の基準を決める</h3>
          <p>Projects では「未着手 → 作業中 → レビュー中 → マージ済み」の状態を共有します。公開前の作業は Release や配備履歴で「検証済み → 配備済み → 稼働確認済み」と別に追跡できます。</p>
          <p class="callout"><strong>自動クローズの条件</strong>　PR 本文の <code>Closes #42</code> は PR の対象が既定ブランチのときに解釈され、マージ時に Issue が閉じます。<code>release/1.4</code> が対象なら参照を記録し、クローズは合意した完了基準に沿って扱います。Issue の状態と本番の稼働状況はそれぞれの記録で確認します。</p>
        </section>
        ${sources(["issues", "projects", "milestones", "releases"])}
      `,
    },
  };
})();
