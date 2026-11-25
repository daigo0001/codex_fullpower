export const appCases = [
  {
    id: "db-lock",
    title: "貸出登録だけが 504 になる",
    subtitle: "処理を待たせている相手を見つける",
    category: "データベース",
    symptom: "備品の貸出登録がタイムアウトする。一覧は表示できる。",
    impact: "貸出登録の約4割が失敗。登録結果が分からず、利用者から問い合わせが来ている。",
    startedAt: "09:05 JST",
    service: "備品貸出管理",
    context: "ASP.NET Core MVC と PostgreSQL で動く社内アプリです。オンライン処理と集計ジョブが同じデータベースを使います。",
    evidence: [
      {
        id: "metrics",
        kind: "metrics",
        label: "メトリクス",
        title: "貸出登録の 504 率と応答時間",
        summary: "貸出登録と備品一覧の指標を分けて確認できます。",
        body: `08:58  貸出登録 504率 0%    p95 0.4秒
09:05  貸出登録 504率 24%   p95 30.0秒
09:10  貸出登録 504率 38%   p95 30.0秒
09:10  備品一覧 p95 0.3秒
09:10  DB CPU 21% | アプリ DB 接続 12/40 | 接続待ち 0件
補足   このグラフの 504 率は貸出登録のリクエストだけを集計`,
        chart: { title: "貸出登録の 504 率", unit: "%", points: [0, 0, 1, 3, 24, 29, 34, 37, 38] },
      },
      {
        id: "request-log",
        kind: "logs",
        label: "リクエストログ",
        title: "貸出登録の待ち時間を追う",
        summary: "リクエストを受け取ってからタイムアウトするまでの記録です。",
        body: `09:06:12 gateway request=R-184 POST /loans upstream_start
09:06:12 app     request=R-184 pool_acquire=3ms db_pid=3812
09:06:12 app     request=R-184 operation=update-asset asset=A-042
09:06:42 gateway request=R-184 status=504 upstream_timeout=30s
09:06:42 app     request=R-184 request_cancelled
09:06:43 app     request=R-184 db_transaction=rolled_back
備考     R-184 のロールバックは確認済み。他の 504 は個別に照合が必要`,
      },
      {
        id: "db-wait",
        kind: "logs",
        label: "DB の待ち情報",
        title: "待っている処理と待たせている処理",
        summary: "同じ時刻に取得した DB の接続と待ちの記録です。",
        body: `09:10:00 waiter_pid=3812 app=loan-web request=R-201
         wait_type=Lock wait_event=transactionid blocked_by=2901
         operation=update-asset asset=A-042
09:10:00 blocker_pid=2901 app=inventory-report run=J-0900
         state=idle in transaction transaction_open_for=580s
         preceding_operation=lock-asset-rows
09:10:00 登録処理の待ち 9件のうち 9件で blocker_pid=2901`,
      },
      {
        id: "schedule-change",
        kind: "change",
        label: "変更履歴",
        title: "当日の実行スケジュール",
        summary: "アプリと定期ジョブの更新履歴を照合します。",
        body: `08:40  集計ジョブの開始時刻を 02:00 → 09:00 JST に変更
09:00  集計ジョブ J-0900 開始
09:00  集計ジョブが対象備品の行を更新用にロック
09:01  集計ファイルの生成・転送を待機。トランザクションは開いたまま
09:10  貸出アプリと DB スキーマの変更なし`,
      },
    ],
    hypotheses: [
      {
        id: "connection-pool",
        label: "DB の接続プールが枯渇し、接続を取得できない",
        correct: false,
        feedback: "失敗したリクエストは 3ms で接続を取得しています。接続待ちの件数と、SQL を送ったあとの待ちを比べてみましょう。",
      },
      {
        id: "long-transaction",
        label: "集計ジョブの長いトランザクションが備品の行をロックしている",
        correct: true,
        feedback: "貸出登録を待たせている DB 接続は集計ジョブに対応しています。同じ接続がトランザクションを開いたままで、変更後の実行時刻も症状と一致します。",
      },
      {
        id: "gateway-latency",
        label: "ゲートウェイのタイムアウト設定が変わり、正常な処理まで打ち切られる",
        correct: false,
        feedback: "504 が発生したのはゲートウェイの期限を超えたためです。設定変更の記録と、背後のアプリが実際に何を待っているかを確認しましょう。",
      },
    ],
    actions: [
      {
        id: "increase-timeout",
        label: "ゲートウェイの待ち時間だけを延長する",
        correct: false,
        feedback: "行ロックが残っている間は登録が進みません。待ち時間を延ばすと、利用者や他の処理が長く待つことになります。",
      },
      {
        id: "pause-batch",
        label: "集計の新規実行を止め、担当に開いたトランザクションの終了を依頼する",
        correct: true,
        feedback: "新しいロックの発生を抑えられます。実行中の処理は、集計担当と復旧期限を確認し、手順書に沿って完了または中断して、ロックの解放を確認します。",
      },
      {
        id: "increase-pool",
        label: "接続プールの上限を増やしてから利用者に再送を案内する",
        correct: false,
        feedback: "接続プールの空きがあり、待ちは同じ備品の行に集中しています。再送は、元の登録の確定有無を確認してから案内します。",
      },
    ],
    checks: [
      {
        id: "lock-released",
        label: "待ちの原因だったトランザクションが終了し、貸出登録のロック待ちが平常に戻った",
        correct: true,
        feedback: "原因の解消を DB 側で確認できます。",
      },
      {
        id: "test-registration",
        label: "検証用備品で貸出登録が成功し、一覧に反映され、同じ備品に有効な貸出が1件だけある",
        correct: true,
        feedback: "利用者の操作と、貸出データの整合性を通して確認できます。",
      },
      {
        id: "service-stable",
        label: "利用状況が戻ったあとも、貸出登録の成功率と p95 応答時間が監視区間で平常を維持した",
        correct: true,
        feedback: "一度の試験だけでなく、実トラフィックでも安定したことを確かめられます。",
      },
      {
        id: "cpu-normal",
        label: "DB の CPU 使用率が 50% 未満である",
        correct: false,
        feedback: "障害中も CPU は 21% でした。今回の復旧判定には、ロック待ちと貸出登録そのものの指標が必要です。",
      },
      {
        id: "health-check",
        label: "アプリのヘルスチェックが 200 を一度返した",
        correct: false,
        feedback: "一覧やヘルスチェックは動いていても、貸出の更新処理にはロック待ちが残ることがあります。",
      },
    ],
    resolution: {
      cause: "営業時間に移した集計ジョブが、集計ファイルを作って転送する間も備品行のロックを保持していた。貸出登録はその行の更新を待ち、ゲートウェイの期限を超えた。",
      mitigation: "集計ジョブの新規開始を停止し、実行中の処理は担当者が手順書に沿って終了させる。結果が不明な貸出は記録を照合してから再送を案内する。",
      verify: "ロック待ちの解消、検証用備品の貸出と一覧反映、実トラフィックでの貸出成功率と応答時間の回復を確認する。",
      followUp: [
        "集計ジョブの処理を見直し、ファイルの生成・転送をトランザクションの外に出す。",
        "集計と貸出が同時に動くテストを追加し、トランザクションが長時間開いたときに担当へ通知する。",
        "タイムアウトでも貸出結果を確認できる導線と、再送時に結果を照合する手順を整える。",
      ],
    },
  },
  {
    id: "auth-cookie",
    title: "ログイン直後にログイン画面へ戻される",
    subtitle: "インスタンスをまたぐと何が変わるかを見る",
    category: "認証",
    symptom: "ログインは完了するが、次のページで再度ログインを求められることがある。",
    impact: "保護された画面への遷移が一部の利用者で繰り返し 302 になり、作業を続けられない。",
    startedAt: "14:12 JST",
    service: "備品貸出管理",
    context: "ロードバランサーの配下で ASP.NET Core MVC の Cookie 認証を利用しています。アプリは同じ版を複数インスタンスで動かせます。",
    evidence: [
      {
        id: "metrics",
        kind: "metrics",
        label: "メトリクス",
        title: "ログイン成功とその後の遷移",
        summary: "ログイン処理と、ログイン後の保護画面を別々に集計した指標です。",
        body: `14:08  稼働インスタンス app-a
       ログイン成功 99% | ログイン直後の再誘導 0%
14:11  稼働インスタンス app-a, app-b
14:14  ログイン成功 99% | ログイン直後の再誘導 36%
14:18  ログイン成功 99% | ログイン直後の再誘導 45%
補足   再誘導の指標はログイン成功後の /loans から /account/login への 302`,
        chart: { title: "ログイン直後の再誘導率", unit: "%", points: [0, 0, 0, 5, 36, 38, 46, 44, 45] },
      },
      {
        id: "redirect-trace",
        kind: "logs",
        label: "リクエストログ",
        title: "Cookie の有無と処理したインスタンス",
        summary: "同じブラウザー操作に含まれるリクエストを追跡します。",
        body: `14:13:20 trace=T-81 app-a POST /account/login credentials=valid
         status=302 location=/loans auth_cookie=issued
14:13:21 trace=T-81 app-b GET /loans request_auth_cookie=present
         ticket=unprotect_failed status=302 location=/account/login
14:14:06 trace=T-93 app-a POST /account/login credentials=valid
         status=302 location=/loans auth_cookie=issued
14:14:07 trace=T-93 app-a GET /loans request_auth_cookie=present
         ticket=validated status=200
備考     Cookie 自体の値は記録していない`,
      },
      {
        id: "key-ring",
        kind: "logs",
        label: "アプリログ",
        title: "認証チケットを開けなかった理由",
        summary: "Cookie 認証と Data Protection の記録を確認します。",
        body: `14:11:30 app-b DataProtection key_store=local-to-instance
         key_ring_loaded=[key-b09] application_name=LoanPortal
14:13:20 app-a CookieAuthentication ticket_protected key_id=key-a17
14:13:21 app-b DataProtection key_id=key-a17 error=key_not_found
14:13:21 app-b CookieAuthentication error=unprotect_ticket_failed
備考     キー ID は架空の識別子。鍵の内容は記録していない`,
      },
      {
        id: "runtime-config",
        kind: "config",
        label: "構成と履歴",
        title: "スケール変更と Cookie 認証の構成",
        summary: "切り替え前後で変わった構成と、各インスタンスの設定を確認できます。",
        body: `14:11  インスタンスが app-a の1台から app-a, app-b の2台に増加
14:11  デプロイ版、ログイン URL、Cookie 属性に変更なし
現在   バランサーはリクエストごとに振り分け
現在   両台とも認証スキーム=LoanCookie、Cookie名=loan.auth
現在   Data Protection の永続先はインスタンスローカル。共有ストアなし`,
      },
    ],
    hypotheses: [
      {
        id: "cookie-domain",
        label: "Cookie の属性が変わり、ブラウザーが保護画面に Cookie を送らなくなった",
        correct: false,
        feedback: "失敗したリクエストにも認証 Cookie が届いています。受け取ったインスタンスで何が起きているかを確認しましょう。",
      },
      {
        id: "key-ring-mismatch",
        label: "Cookie を発行したインスタンスの鍵が、別のインスタンスにない",
        correct: true,
        feedback: "app-a の鍵で発行されたチケットが app-b に届き、app-b はその鍵を見つけられていません。app-a 内で完結した遷移は成功しています。",
      },
      {
        id: "bad-credentials",
        label: "ログイン処理が認証情報を拒否している",
        correct: false,
        feedback: "ログイン処理は認証情報を受理し、Cookie を発行しています。失敗するのは保護画面のリクエストを処理するときです。",
      },
    ],
    actions: [
      {
        id: "session-affinity",
        label: "同じインスタンスへ振り分ける設定だけで復旧完了とする",
        correct: false,
        feedback: "同じ台に届く間は症状が減っても、その台の入れ替えや障害時に再発します。このケースでは別インスタンスでチケットを検証できることが必要です。",
      },
      {
        id: "extend-cookie",
        label: "Cookie の有効期間を延ばして様子を見る",
        correct: false,
        feedback: "期限を延ばしても、発行に使った鍵が検証側になければチケットは読めません。",
      },
      {
        id: "shared-key-ring",
        label: "保護した共有キーストアと同じアプリ名を使う構成を検証して適用する",
        correct: true,
        feedback: "同一アプリの各インスタンスが共通の Data Protection キーリングを読めるようにします。旧チケットに必要な鍵を安全に引き継げない場合は、再ログインが必要です。",
      },
    ],
    checks: [
      {
        id: "cross-instance",
        label: "app-a でログインし、app-b が同じ Cookie で保護画面を 200 で返す",
        correct: true,
        feedback: "発行と検証を異なる台で実施すると、今回の条件を再現して復旧を確かめられます。",
      },
      {
        id: "instance-replacement",
        label: "検証環境でインスタンスを入れ替えても、入れ替え前に発行した Cookie を新しい台で検証できる",
        correct: true,
        feedback: "共有した鍵がインスタンスの寿命に依存しないことを確かめられます。",
      },
      {
        id: "login-flow-stable",
        label: "再ログインの案内後、再誘導率とチケットの検証エラーが平常に戻る",
        correct: true,
        feedback: "新しいログインフローが実際の利用でも安定したことを、利用者側とアプリ側の両方で確認できます。",
      },
      {
        id: "login-success-only",
        label: "ログイン POST の成功率が 99% 以上である",
        correct: false,
        feedback: "ログインの POST は障害中もほとんど成功していました。そのあとの保護画面まで確認します。",
      },
      {
        id: "sign-in-page",
        label: "ログイン画面を開いたら 200 が返る",
        correct: false,
        feedback: "公開されているログイン画面の表示だけでは、認証済み Cookie の検証を確認できません。",
      },
    ],
    resolution: {
      cause: "スケールアウトで別のローカルキーリングを使う app-b が追加された。app-a が発行したチケットを app-b が読めず、認証をやり直すリダイレクトを返した。",
      mitigation: "権限を制限し保存時に保護した共有キーリングを使い、同一アプリの全台で ApplicationName と認証スキームをそろえる。失われた鍵に依存する既存チケットについては再ログインを案内する。",
      verify: "別インスタンスでのチケット検証、入れ替え後の既存チケット検証、再誘導率とアプリログの回復を確認する。",
      followUp: [
        "スケール・ローリング更新後に別インスタンスで保護画面を開く自動試験を追加する。",
        "キーリングの永続先、保存時の保護、読み取り権限、鍵のローテーションを設計・運用資料に残す。",
        "ログイン後の再誘導率と認証チケット検証エラーを監視する。",
      ],
    },
  },
];
