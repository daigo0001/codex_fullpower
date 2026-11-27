(() => {
  "use strict";

  const lab = globalThis.PLLab;
  const screens = [
    {
      id: "SCR-01", title: "問い合わせ一覧", requirements: "REQ-002",
      route: "GET /tickets", contract: "API-02 · T-002",
      lead: "申請者は自分の問い合わせを、窓口担当と管理者は組織内の問い合わせを一覧で確認します。検索は 20 件単位です。",
      fields: [
        ["L-01", "タイトル検索", "VPN", "文字列・任意。前後の空白を除去し、1〜100文字でタイトルの部分一致を検索する。", "100文字を超えたら項目名と上限を表示する。空欄は条件なし。", "検索を実行すると page=1 に戻す。条件はクエリに保持する。"],
        ["L-02", "状態", "すべて ▾", "新規・対応中・解決・終了から1件を選択。初期値は「すべて」。", "定義外の値は検索 API が 400 を返す。既定値へ戻せるようにする。", "適用ボタンで条件を送信する。"],
        ["L-03", "担当者", "すべて ▾", "選択値は employeeId。候補はラベルを業務名にし、利用者が閲覧できる問い合わせの担当者に限る。", "担当者の指定を受けても、本人・組織の閲覧条件を必ず適用する。", "「未割当」を指定できる。他の条件とは AND 検索。変更後は先頭ページへ。"],
        ["L-04", "検索結果", "IT-1028  VPN に接続できない", "ID・タイトル・状態・更新日時を表示する。更新日時の降順、同時刻は ID 降順。", "0件は空の理由と条件解除の案内を出す。権限内の件数だけを返す。", "行の ID から SCR-02 に移動。戻ると検索条件とページを復元する。"],
        ["L-05", "ページ移動", "1 / 4  ·  次へ", "1ページ20件。現在ページを読み上げ可能にし、最終ページの次ボタンを無効にする。", "データ減少でページが範囲外になれば最終ページを案内する。", "同じ検索条件で該当ページを再取得する。"],
        ["L-06", "新規登録", "＋ 問い合わせを登録", "認証済みの申請者・窓口担当・管理者が本人として登録できる。", "アプリ未割当の利用者には登録リンクと API を許可しない。", "SCR-03 の新規モードに移動する。"],
      ],
      states: {
        normal: ["一覧を表示", "受付中の問い合わせを更新順に表示。検索条件と件数を確認できます。"],
        empty: ["条件に合う問い合わせはありません", "条件を解除して再検索するか、新規登録へ進めます。"],
        invalid: ["タイトル検索は100文字以内で入力してください", "選択済みの条件を保持し、エラー項目にフォーカスします。"],
        forbidden: ["一覧を閲覧する権限がありません", "レコードと件数を表示せず、利用申請の窓口を案内します。"],
        network: ["問い合わせ一覧を読み込めませんでした", "入力済みの条件を保持します。「再読み込み」で同じ条件を試せます。"],
      },
    },
    {
      id: "SCR-02", title: "問い合わせ詳細", requirements: "REQ-003 · REQ-005",
      route: "GET /tickets/{id}", contract: "API-03 · API-05 · API-06 · T-003 · T-005",
      lead: "本文、担当者、状態変更履歴を表示。窓口担当と管理者が、状態と担当者を変更できます。",
      fields: [
        ["D-01", "問い合わせ", "IT-1028 · VPN に接続できない", "表示用受付IDとタイトル。本文と申請者は権限を確認した後に返す。", "権限内に対象がない場合は 404 に統一し、存在の有無を区別しない。", "一覧へ戻ると元の検索条件を引き継ぐ。"],
        ["D-02", "現在の状態", "対応中 → 解決", "現在値から可能な遷移先を表示する。申請者は読むだけ。", "対応中から終了への飛び越しは 409。最新更新と競合した場合は 412。", "「状態を更新」で API-05。読み込み時の ETag を If-Match に付ける。"],
        ["D-03", "担当者", "情報システム担当 ▾", "窓口担当・管理者のみ、同じ組織の有効な窓口担当へ割り当てる。", "無効な担当者や対象外の組織は拒否。本人の権限が外れたら 403。", "「割り当てる」で API-06。成功後は応答の ETag と表示を更新する。"],
        ["D-04", "変更履歴", "12/15 09:20 · 新規 → 対応中", "状態、操作した担当者、日時を更新順に表示。時刻は JST に変換する。", "履歴0件は「状態変更はまだありません」を表示。", "変更成功後に履歴を再取得する。履歴の読み込みに失敗しても更新結果は区別して表示する。"],
        ["D-05", "編集", "問い合わせを編集", "申請者本人の新規問い合わせに表示する。", "画面表示後に対応中へ変われば、保存は競合として扱う。", "SCR-03 の編集モードへ。フォームの初期 ETag は詳細から引き継ぐ。"],
      ],
      states: {
        normal: ["問い合わせの詳細", "現在の状態と更新履歴を確認できます。"],
        empty: ["状態変更はまだありません", "問い合わせ本体は表示し、履歴欄だけを空表示にします。"],
        invalid: ["別の担当者が先に更新しました", "412 の場合は保存されていないことを伝え、最新の状態を確認してから判断します。"],
        forbidden: ["問い合わせが見つかりません", "対象を読む権限がない場合も同じ 404 表示にします。読める対象の操作だけが禁止なら 403 を表示します。"],
        network: ["状態更新の結果を確認できません", "自動で再送せず、詳細を読み直して状態と履歴を照合できるようにします。"],
      },
    },
    {
      id: "SCR-03", title: "問い合わせ登録・編集", requirements: "REQ-004",
      route: "/tickets/new · /tickets/{id}/edit", contract: "API-04 · API-08 · T-004",
      lead: "誰が、何に困り、何を期待しているかを記録します。本人の新規問い合わせのみ編集できます。",
      fields: [
        ["F-01", "タイトル", "VPN への接続エラー", "文字列・必須。前後の空白を除去した上で 1〜100 文字。", "空欄または101文字以上は 422。入力欄と画面先頭に同じ理由を示す。", "登録・保存の入力値。成功前にフォームから消さない。"],
        ["F-02", "問い合わせ内容", "社用PCで社内VPNを開始できません。", "プレーンテキスト・必須。1〜2,000文字。現在の状況と期待する結果を書く。", "空欄・上限超過をサーバー側でも検証。表示時はテキストとして扱う。", "入力エラー時も送信前の本文を保持する。"],
        ["F-03", "新規・編集モード", "編集 · IT-1028", "新規は状態をサーバーで新規に固定。編集では本人かつ状態が新規の条件を再確認する。", "表示後に更新された ETag は 412。本人が操作できなくなった場合は 403。", "編集モードの初期読み込みは API-03。最新を読み直すときは未保存の入力の扱いを確認する。"],
        ["F-04", "登録・保存", "変更を保存", "新規は API-04、編集は API-08。新規時の操作IDは確認が済むまで保持する。", "送信中はボタンを無効にする。応答が消えたときは登録結果の確認を案内する。", "新規の再試行は同じ操作IDを使う。成功時は詳細へ遷移して受付IDを表示する。"],
        ["F-05", "戻る", "入力をやめる", "入力変更がある状態で離れる場合は、編集を破棄するか確認する。", "通信失敗・入力エラーの入力内容は保持する。", "新規は SCR-01、編集は SCR-02 へ戻る。"],
      ],
      states: {
        normal: ["入力内容を確認して保存", "送信中は操作を一時停止し、成功時は詳細に移動します。"],
        empty: ["新しい問い合わせ", "タイトルと本文は空欄で、入力例と文字数の制限を確認できます。"],
        invalid: ["タイトルを入力してください", "本文を保持し、理由とタイトル欄への移動を示します。"],
        forbidden: ["この問い合わせは編集できません", "保存ボタンを無効にし、権限がある場合だけ詳細へ戻します。"],
        network: ["保存の結果を確認できません", "入力値を残し、同じ操作IDでの登録確認または編集内容の照合を案内します。"],
      },
    },
    {
      id: "SCR-04", title: "管理者画面", requirements: "REQ-006 · REQ-007",
      route: "GET /admin", contract: "API-07 · API-09 · T-006 · T-007",
      lead: "社員マスター連携の結果と、ログイン中の管理者の権限を確認します。権限変更は承認済みの Entra 運用で行います。",
      fields: [
        ["A-01", "認証・権限を確認", "現在の権限 · 管理者", "ログイン中の利用者にマップしたアプリロールだけを表示する。", "管理者権限なしは管理 API で 403。機微情報のある応答本文を返さない。", "API-09 で現在の認証済みセッションの概要を取得する。"],
        ["A-02", "連携日時の範囲", "12/14 〜 12/21", "期間を JST の日付で指定。終了日は開始日以降かつ最大31日。", "逆順や範囲超過なら理由を表示。日境界はサーバーで UTC へ変換する。", "API-07 に期間を渡して再検索する。"],
        ["A-03", "連携実績", "12/21 02:00 · 成功 · 312件", "日時、結果、処理件数、監視用実行ID。社員の個別情報や秘密情報は画面に出さない。", "履歴0件、実行中、成功、失敗を文言で区別する。", "失敗の場合は実行IDと連絡先を案内する。手動再実行は初回の範囲外。"],
      ],
      states: {
        normal: ["社員マスター連携は正常です", "認証済みの管理者だけが実績とアクセス概要を確認できます。"],
        empty: ["指定期間に実行記録はありません", "期間を広げる操作を案内します。"],
        invalid: ["開始日は終了日以前にしてください", "選択していた日付を保持し、修正する箇所を示します。"],
        forbidden: ["管理者権限が必要です", "連携実績を読み込まず、一般機能に戻れるようにします。"],
        network: ["連携実績を取得できませんでした", "再読み込みを案内します。取得不能を連携失敗と区別します。"],
      },
    },
  ];

  const stateLabels = [
    ["normal", "正常"], ["empty", "空・初期状態"], ["invalid", "入力・競合エラー"],
    ["forbidden", "権限不足"], ["network", "通信エラー"],
  ];

  const permissions = [
    ["閲覧・検索", "本人の問い合わせ", "組織内", "組織内"],
    ["登録", "本人名義", "本人名義", "本人名義"],
    ["本文編集", "本人の新規だけ", "本人の新規だけ", "本人の新規だけ"],
    ["状態更新・担当者割当", "不可", "組織内", "組織内"],
    ["連携・アクセス概要", "不可", "不可", "参照のみ"],
  ];

  const features = [
    ["FN-01", "認証と許可", "REQ-001 · SCR-00", "API-01 · T-001"],
    ["FN-02", "問い合わせ検索", "REQ-002 · SCR-01", "API-02 · T-002"],
    ["FN-03", "詳細と状態履歴", "REQ-003 · SCR-02", "API-03 · T-003"],
    ["FN-04", "問い合わせ登録・編集", "REQ-004 · SCR-03", "API-04・API-08 · T-004"],
    ["FN-05", "状態と担当者の更新", "REQ-005 · SCR-02", "API-05・API-06 · T-005"],
    ["FN-06", "運用情報を参照", "REQ-006 · SCR-04", "API-07・API-09 · T-006"],
    ["FN-07", "社員マスター取り込み", "REQ-007 · SCR-04", "EXT-01 · T-007"],
  ];

  const api = [
    ["API-01", "GET /account/sign-in", "未認証の社員", "OIDC チャレンジ。戻り先はサイト内のルートのみ。認証成功後は本人の許可ロールで表示。", "302 · 403"],
    ["API-02", "GET /api/tickets", "本人または組織内", "q、status、assignee、page を検証。20件と権限内の総件数。更新日時・ID 順。", "200 · 400 · 403"],
    ["API-03", "GET /api/tickets/{id}", "本人または組織内", "問い合わせ、状態履歴、利用可能操作と引用符付き ETag。閲覧不可の対象は同じ 404。", "200 · 404"],
    ["API-04", "POST /api/tickets", "許可された社員", "title、description。操作IDを送る。受付ID・ETag・Location を返す。同一操作IDと同じ入力の再試行は同じ受付結果。", "201 · 403 · 409 · 422"],
    ["API-05", "PATCH /api/tickets/{id}/status", "窓口担当・管理者", "nextStatus、If-Match、CSRF トークン。新状態と新 ETag。状態履歴と監査の記録も確定。", "200 · 400 · 403 · 404 · 409 · 412 · 422 · 428"],
    ["API-06", "PATCH /api/tickets/{id}/assignment", "窓口担当・管理者", "assigneeId と If-Match。組織内の有効な窓口担当だけを候補にする。新 ETag を返す。", "200 · 403 · 404 · 412 · 422 · 428"],
    ["API-07", "GET /api/admin/sync-runs", "管理者", "from、to。連携日時、実行ID、件数、結果を返す。社員情報や認証情報は含めない。", "200 · 400 · 403"],
    ["API-08", "PATCH /api/tickets/{id}", "本人の新規のみ", "title、description、If-Match。所有者と状態をサーバーで再判定。", "200 · 403 · 404 · 412 · 422 · 428"],
    ["API-09", "GET /api/admin/access-summary", "管理者", "現セッションのマップ済みアプリロールと操作範囲。ディレクトリの列挙や更新は行わない。", "200 · 403"],
    ["EXT-01", "GET /v1/employees?cursor=…", "連携専用ID", "社員ID、有効区分、組織コード、表示名の参照。ページを通してスナップショットを揃える。", "200 · 429 · 5xx"],
  ];

  const schema = [
    ["tickets", "ticket_id bigint PK · requester_id bigint FK · assignee_id bigint FK NULL", "title nvarchar(100) · description nvarchar(2000) · status tinyint · org_code varchar(32) · create_operation_id uniqueidentifier · created_at / updated_at datetime2(3) · row_version rowversion", "状態 CHECK。requester_id と create_operation_id の組を一意化。本人一覧は requester_id、更新日時、ID の索引から計測。担当者の一覧は組織と状態も候補にする。"],
    ["employees", "employee_id bigint PK · external_id varchar(64) UNIQUE", "entra_tenant uniqueidentifier NULL · entra_object uniqueidentifier NULL · display_name nvarchar(100) · active bit · org_code varchar(32)", "認証の対応付けは承認済み登録で管理し、両方が入った行で同一組を一意化。退職者は無効にし、履歴の参照を維持する。"],
    ["ticket_status_history", "history_id bigint PK · ticket_id bigint FK · actor_id bigint FK", "previous_status tinyint · next_status tinyint · changed_at datetime2(3)", "ticket_id、changed_at、history_id で履歴順を確定する。"],
    ["audit_events", "event_id bigint PK · actor_id bigint FK · ticket_id bigint FK NULL", "action varchar(40) · result varchar(24) · occurred_at datetime2(3) · correlation_id varchar(64)", "結果と識別子を記録。本文、トークン、シークレットは含めない。"],
    ["employee_sync_runs", "run_id uniqueidentifier PK", "window_key char(10) UNIQUE · started_at datetime2(3) · finished_at datetime2(3) NULL · state varchar(24) · row_count int · error_code varchar(40) NULL", "JSTの実行日キーで二重起動を防ぐ。再試行は同じ run_id と排他ロックで扱う。"],
  ];

  const outcomes = [
    ["200", "変更を確定", "新状態・ETag を表示。状態・履歴・監査がすべて確定。"],
    ["400", "ヘッダー形式や CSRF トークンが不正", "更新せず、フォームの読み直しを案内。"],
    ["403・404", "操作不可・閲覧範囲外", "権限、所有者、組織を照合。閲覧範囲外は 404 に統一。"],
    ["409", "許されない状態遷移", "問い合わせと状態履歴を変更しない。許可された遷移を案内。"],
    ["412", "取得済み ETag が古い", "更新なし。利用者に読み直しと再判断を求め、自動再送しない。"],
    ["422", "状態値や入力が無効", "無効な項目を示し、入力を保持する。"],
    ["428", "If-Match が必要", "画面の読み込みからやり直す。更新なし。"],
    ["500", "処理途中の異常", "トランザクションを戻す。一般メッセージと照会IDを返す。"],
  ];

  const tests = [
    ["T-001", "REQ-001 · SCR-00 · API-01", "許可ロールあり・ロールなし・未認証", "許可された利用者が入れる。権限なしは403。未認証の画面はログインへ、API は401。"],
    ["T-002", "REQ-002 · SCR-01 · API-02", "一致結果21件、本人以外のレコードは別に用意", "1頁目20件、2頁目1件。所有範囲外の件数や本文を含まない。"],
    ["T-003", "REQ-003 · SCR-02 · API-03", "本人・他人で同じIDを参照", "本人は ETag と履歴、他人は404。"],
    ["T-004", "REQ-004 · SCR-03 · API-04・API-08", "文字数境界、本人と他人、新規の操作IDを2回送信", "不正値は422。本人の新規のみ編集可。同じ操作IDと内容に受付1件。"],
    ["T-005", "REQ-005 · SCR-02 · API-05・API-06", "同じ ETag で2人が更新。欠落・無効遷移・権限外・例外も試す", "成功は ETag 更新、同時更新もう一方は412。履歴1件、変更監査1件。欠落428、遷移違反409、途中例外は全更新を戻す。"],
    ["T-006", "REQ-006 · SCR-04 · API-07・API-09", "管理者・窓口担当で実績と権限概要へアクセス", "管理者だけ成功。秘密値や社員名を応答に含めない。"],
    ["T-007", "REQ-007 · EXT-01 · employee_sync_runs", "実行途中で429・ページ欠落・同一日付で再実行", "前回分を維持して警告。再試行中に重複を作らず、全件揃ってから差分を反映。"],
    ["T-008", "NFR-001 · API-02・API-03", "架空データ1万件、30同時利用、読取80%で15分間", "一覧と詳細それぞれのサーバー応答 p95 が1.5秒以内。条件・版・エラー率を計測結果に記録。"],
    ["T-009", "NFR-002 · API-03〜API-09", "権限別の操作、監査と一般運用ログを確認", "範囲外の操作では行が変わらず、監査は認可された人だけが参照。機微情報をログに含めない。"],
    ["T-010", "NFR-003 · Azure SQL", "DB を隔離環境へ復元し、一致件数と操作を確認", "RPO 1時間以内・RTO 4時間以内。活用できるデータの時刻と全体の復旧所要時間を記録。"],
  ];

  const trace = [
    ["REQ-005", "業務要件", "窓口担当が問い合わせの状態・担当者を更新する。飛び越しや重複更新が起きない条件を受入に含める。"],
    ["SCR-02 · D-02", "画面イベント", "GET の ETag と現在状態を保持し、対応中 → 解決を保存。競合時は表示を読み直す。"],
    ["API-05", "API・認可", "PATCH /api/tickets/{id}/status。アプリロールと行の組織を確認し、If-Match を必須にする。"],
    ["tickets · row_version", "DB・トランザクション", "WHERE の行バージョン条件で更新。問い合わせ、状態履歴、監査を1回で確定する。"],
    ["T-005", "テスト", "同じ ETag で2件を並行送信。200 と 412 が各1件で、履歴・変更監査が1件ずつ。"],
  ];

  const screenReview = {
    title: "問い合わせフォームのレビュー",
    flawed: "画面項目はタイトルと本文。編集ボタンはすべての利用者に表示する。送信エラーなら初期画面を表示する。タイムアウト時は即座に再送する。",
    issues: [
      ["ownership", "編集の本人確認と状態条件がない", "他人や対応中のデータを変更できる恐れがあります。利用可否の表示とサーバーの認可条件を揃えます。", true],
      ["values", "入力チェックと値の保持がない", "入力の理由と修正位置を示し、送信済みのタイトル・本文を保持します。", true],
      ["unknown", "通信途絶を保存失敗と扱い、自動再送している", "応答が途切れても保存済みの場合があります。結果を確認し、新規は同じ操作IDで照合します。", true],
      ["color", "ボタンのブランド色を指定していない", "色の指定は見た目の仕様です。先に権限、入力、応答不明時の操作を受入条件にします。", false],
      ["closed", "終了済み問い合わせを全員が編集できない", "本人の新規だけを編集する要件に沿っています。終了済みの編集は業務確認が必要です。", false],
    ],
    markers: [
      ["編集できる人と状態", /本人|権限|認可|新規/u],
      ["入力チェックと保持", /保持|残す|文字|必須|項目/u],
      ["応答不明時の確認", /再送|照合|タイムアウト|操作\s*ID|通信/u],
    ],
    model: "本人かつ新規時のみ編集を表示し、API-08 も同じ条件を再確認する。タイトル1〜100文字・本文1〜2,000文字。422 では入力を保持し、項目の横に理由を示す。応答不明時は既存の詳細を読み直し、新規なら同じ操作IDで受付の有無を確認してから再試行する。",
  };

  const detailReview = {
    title: "状態変更 API のレビュー",
    flawed: "画面のドロップダウンで指定された状態を受け取る。IDが存在すれば状態を上書きして 200。変更履歴は後続ジョブで書く。例外はクライアントへそのまま渡す。",
    issues: [
      ["auth", "担当者ロールと組織の照合がない", "同じIDへ送信できることと更新の許可は別です。行レベルの認可をサーバーに置きます。", true],
      ["transition", "サーバーで状態遷移を判定していない", "画面と実際の更新経路は同じ業務上の状態機械を使います。遷移違反は 409 です。", true],
      ["version", "読み込み後の別担当者の更新を検知できない", "同じ ETag で並行操作した場合、片方は 412 になり、読み直して再判断します。", true],
      ["transaction", "状態・履歴・監査が別々に確定する", "監査の保存に失敗したときも状態が残る設計では記録が不整合になります。同じトランザクションで確定します。", true],
      ["exception", "例外に含まれる内部情報が画面に出る", "画面へは一般エラーと照会IDを返し、ログは許可した項目だけを残します。", true],
      ["microservices", "状態変更が専用マイクロサービスになっていない", "同じ DB で一貫性を保つ構成が今回の前提です。サービス分離には運用と整合性の代価があります。", false],
    ],
    markers: [
      ["誰がどの行を操作できるか", /権限|認可|組織|窓口/u],
      ["競合と遷移の区別", /If-Match|ETag|rowversion|412/iu],
      ["トランザクションでそろえる記録", /履歴|監査|ロールバック|トランザクション/u],
      ["エラー情報の扱い", /相関|照会|ログ|一般エラー/u],
    ],
    model: "窓口担当・管理者のロールと対象組織を照合し、If-Match を必須にする。遷移違反は409、古い ETag は412で返す。rowversion を UPDATE の条件に入れ、変更・履歴・監査を同じトランザクションで確定する。例外は照会ID付き一般エラーとして表示し、T-005 で並行・権限違反・途中失敗を再現する。",
  };

  function validateReview(review, entry) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry) ||
        typeof entry.revision !== "string" || entry.revision.length > 4000 ||
        typeof entry.reviewed !== "boolean" || !Array.isArray(entry.findings)) {
      throw new Error("設計レビューの形式が正しくありません。");
    }
    const keys = new Set(review.issues.map(issue => issue[0]));
    if (entry.findings.length > keys.size || entry.findings.some(key => !keys.has(key)) ||
        new Set(entry.findings).size !== entry.findings.length) {
      throw new Error("設計レビューの指摘IDが正しくありません。");
    }
    return { findings: [...entry.findings], revision: entry.revision, reviewed: entry.reviewed };
  }

  lab.validators["03"] = entry => validateReview(screenReview, entry);
  lab.validators["04"] = entry => validateReview(detailReview, entry);

  function panel(ctx, title, ...children) {
    return ctx.el("section", { class: "panel design-panel stack" }, ctx.el("h2", {}, title), ...children);
  }

  function disclosure(ctx, title, ...children) {
    return ctx.el("details", { class: "design-disclosure" }, ctx.el("summary", {}, title),
      ctx.el("div", { class: "stack design-disclosure-body" }, ...children));
  }

  function diagram(ctx, template, summary) {
    const figure = ctx.el("figure", { class: "design-figure" });
    const stage = ctx.el("div", { class: "design-svg-wrap", tabindex: "0", "aria-label": "図を横に確認" });
    stage.innerHTML = template; // Only literal SVG authored with the sample.
    figure.append(stage, ctx.el("figcaption", {}, summary));
    return figure;
  }

  const routesSvg = '<svg class="design-svg" viewBox="0 0 760 215" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="サインインから一覧、詳細、登録編集、管理者へ進む画面遷移">' +
    '<defs><marker id="screen-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#34776d"/></marker></defs>' +
    '<g class="design-svg-lines" marker-end="url(#screen-arrow)"><path d="M159 105H226"/><path d="M376 105H445"/><path d="M594 93V60H618"/><path d="M297 80V41H618"/><path d="M297 130V174H452"/></g>' +
    '<g class="design-svg-boxes"><rect x="10" y="78" width="149" height="54" rx="8"/><rect x="227" y="78" width="149" height="54" rx="8"/><rect x="446" y="78" width="149" height="54" rx="8"/><rect x="619" y="19" width="131" height="65" rx="8"/><rect x="454" y="148" width="141" height="54" rx="8"/></g>' +
    '<g class="design-svg-labels"><text x="22" y="99">SCR-00</text><text x="22" y="119">サインイン</text><text x="239" y="99">SCR-01</text><text x="239" y="119">一覧</text><text x="457" y="99">SCR-02</text><text x="457" y="119">詳細</text><text x="631" y="43">SCR-03</text><text x="631" y="63">登録・編集</text><text x="465" y="170">SCR-04</text><text x="465" y="190">管理者画面</text></g>' +
    '<g class="design-svg-notes"><text x="168" y="94">認証後</text><text x="386" y="94">行選択</text><text x="410" y="30">新規登録</text><text x="328" y="165">管理者だけ</text></g></svg>';

  const systemSvg = '<svg class="design-svg" viewBox="0 0 760 195" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="社員のブラウザーから ASP.NET Core、Azure SQL へ通信し、別の経路で認証と既存マスター同期を行う構成">' +
    '<defs><marker id="system-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#34776d"/></marker></defs>' +
    '<g class="design-svg-lines" marker-end="url(#system-arrow)"><path d="M159 72H256"/><path d="M471 72H566"/><path d="M363 104V142"/><path d="M625 144V101"/></g>' +
    '<g class="design-svg-boxes"><rect x="11" y="45" width="147" height="54" rx="8"/><rect x="257" y="40" width="213" height="63" rx="8"/><rect x="567" y="45" width="181" height="54" rx="8"/><rect x="257" y="144" width="213" height="44" rx="8"/><rect x="567" y="145" width="181" height="44" rx="8"/></g>' +
    '<g class="design-svg-labels"><text x="22" y="78">社員ブラウザー</text><text x="273" y="65">Azure App Service</text><text x="273" y="87">ASP.NET Core</text><text x="585" y="77">Azure SQL Database</text><text x="273" y="172">Microsoft Entra ID</text><text x="581" y="173">社員マスター同期</text></g>' +
    '<g class="design-svg-notes"><text x="179" y="60">HTTPS</text><text x="489" y="60">Private Endpoint</text><text x="376" y="128">OIDC</text><text x="632" y="128">差分反映</text></g></svg>';

  const erSvg = '<svg class="design-svg" viewBox="0 0 760 188" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="社員1対問い合わせ多、問い合わせ1対状態履歴多、社員1対状態履歴多の関係">' +
    '<g class="design-svg-lines"><path d="M205 61H277"/><path d="M485 61H557"/><path d="M105 102V139H654V102"/></g>' +
    '<g class="design-svg-boxes"><rect x="12" y="15" width="192" height="86" rx="8"/><rect x="278" y="15" width="206" height="86" rx="8"/><rect x="558" y="15" width="190" height="86" rx="8"/></g>' +
    '<g class="design-svg-labels"><text x="25" y="39">employees</text><text x="25" y="63">PK employee_id</text><text x="25" y="84">UNIQUE tenant + object</text><text x="291" y="39">tickets</text><text x="291" y="63">PK ticket_id</text><text x="291" y="84">FK requester / assignee</text><text x="570" y="39">ticket_status_history</text><text x="570" y="63">PK history_id</text><text x="570" y="84">FK ticket_id / actor_id</text></g>' +
    '<g class="design-svg-notes"><text x="213" y="52">1</text><text x="265" y="52">N</text><text x="495" y="52">1</text><text x="544" y="52">N</text><text x="111" y="121">1</text><text x="662" y="122">N</text><text x="318" y="161">社員が状態変更を記録する</text></g></svg>';

  const sequenceSvg = '<svg class="design-svg" viewBox="0 0 760 310" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="状態変更でブラウザーから API へ If-Match を送信。ロールと組織を確認し、SQL の1トランザクションで更新。成功時は200、新しい ETag。競合時は412で戻す。">' +
    '<defs><marker id="sequence-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#34776d"/></marker></defs>' +
    '<g class="design-svg-boxes"><rect x="15" y="14" width="171" height="38" rx="8"/><rect x="293" y="14" width="171" height="38" rx="8"/><rect x="571" y="14" width="171" height="38" rx="8"/></g>' +
    '<g class="design-svg-labels"><text x="43" y="39">SCR-02 ブラウザー</text><text x="320" y="39">API-05 アプリ</text><text x="603" y="39">Azure SQL</text></g>' +
    '<g class="design-svg-lifelines"><path d="M100 52V296"/><path d="M378 52V296"/><path d="M656 52V296"/></g>' +
    '<g class="design-svg-lines" marker-end="url(#sequence-arrow)"><path d="M101 84H373"/><path d="M379 139H651"/><path d="M655 198H383"/><path d="M376 238H105"/><path d="M376 283H105"/></g>' +
    '<g class="design-svg-notes"><text x="132" y="73">PATCH status + If-Match</text><text x="397" y="119">ロール・組織・状態遷移を確認</text><text x="399" y="130">WHERE に row_version</text><text x="677" y="157">状態 / 履歴 /</text><text x="677" y="174">監査を確定</text><text x="415" y="187">新状態・新しい行バージョン</text><text x="137" y="226">200 · 新しい ETag</text><text x="137" y="271">古い ETag の場合は 412</text></g></svg>';

  function makeChoiceGroup(ctx, entries, selected, label, onPick) {
    const group = ctx.el("div", { class: "design-choices", role: "group", "aria-label": label });
    for (const [key, title] of entries) {
      group.append(ctx.el("button", {
        class: "button secondary", type: "button", "aria-pressed": String(selected === key), "data-choice": key,
        onClick: () => onPick(key),
      }, title));
    }
    return group;
  }

  function markChoice(group, key) {
    for (const button of group.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.choice === key));
    }
  }

  function previewValue(field, screenId, variant) {
    const [id, , demo] = field;
    if (variant === "empty") {
      const labels = {
        "L-01": "タイトルを入力", "L-04": "一致する行 0 件", "L-05": "0件", "D-04": "状態変更履歴 0 件",
        "F-01": "タイトルを入力", "F-02": "問い合わせ内容を入力", "F-03": "新規登録", "F-04": "問い合わせを登録",
        "A-03": "該当する実行記録なし",
      };
      return labels[id] ?? demo;
    }
    if (variant === "invalid") {
      const labels = {
        "L-01": "入力が100文字を超えています", "L-04": "既存の結果を保持", "D-02": "対応中 → 解決 · 412",
        "F-01": "未入力 · 必須", "A-02": "12/21 〜 12/14",
      };
      return labels[id] ?? demo;
    }
    if (variant === "forbidden") return screenId === "SCR-03" && id === "F-04" ? "保存できません" : "情報を表示しません";
    if (variant === "network") {
      const labels = {
        "L-04": "再読み込み", "D-02": "状態の結果を読み直す", "F-04": "受付結果を確認", "A-03": "取得できません",
      };
      return labels[id] ?? demo;
    }
    return demo;
  }

  function screenWorkbench(ctx) {
    let active = screens[0];
    let variant = "normal";
    let selectedField = active.fields[0][0];
    const heading = ctx.el("h3", { class: "design-screen-heading" });
    const lead = ctx.el("p", { class: "muted" });
    const location = ctx.el("span", { class: "design-fake-path mono" });
    const wireBody = ctx.el("div", { class: "design-wire-body" });
    const inspect = ctx.el("div", { class: "design-field-detail stack", "aria-live": "polite" });
    const fieldTable = ctx.el("div", { class: "design-field-table" });
    const eventsTable = ctx.el("div", { class: "design-events-table" });
    const screenControls = makeChoiceGroup(ctx, screens.map(({ id, title }) => [id, title]), active.id, "画面の選択", id => {
      active = screens.find(screen => screen.id === id);
      variant = "normal";
      selectedField = active.fields[0][0];
      renderScreen();
    });
    const stateControls = makeChoiceGroup(ctx, stateLabels, variant, "画面状態", value => {
      variant = value;
      markChoice(stateControls, variant);
      renderWire();
    });

    function renderInspector() {
      const current = active.fields.find(([id]) => id === selectedField);
      const [id, label, , spec, validation, event] = current;
      inspect.replaceChildren(
        ctx.el("h3", {}, id + " " + label),
        ctx.el("p", { class: "muted" }, "項目定義 · " + active.id + " · " + active.contract),
        ctx.el("dl", { class: "design-definitions" },
          ctx.el("dt", {}, "表示条件・項目仕様"), ctx.el("dd", {}, spec),
          ctx.el("dt", {}, "入力チェック・例外"), ctx.el("dd", {}, validation),
          ctx.el("dt", {}, "操作後の処理"), ctx.el("dd", {}, event)),
      );
    }

    function selectField(id) {
      selectedField = id;
      for (const button of wireBody.querySelectorAll("[data-wire-field]")) {
        button.setAttribute("aria-pressed", String(button.dataset.wireField === id));
      }
      renderInspector();
    }

    function renderWire() {
      const [title, guidance] = active.states[variant];
      const signal = variant === "normal" ? "success" : variant === "empty" ? "neutral" : "warning";
      wireBody.replaceChildren(
        ctx.el("div", { class: "design-wire-title" }, ctx.el("strong", {}, active.title),
          ctx.el("span", {}, "IT Support")),
        ctx.el("div", { class: "design-wire-alert design-signal-" + signal },
          ctx.el("strong", {}, title), ctx.el("p", {}, guidance)),
      );
      for (const field of active.fields) {
        const [id, label] = field;
        const column = ctx.el("button", {
          class: "design-wire-field",
          type: "button", "aria-pressed": String(selectedField === id), "data-wire-field": id,
          onClick: () => selectField(id),
        }, ctx.el("span", { class: "design-wire-caption" }, label, ctx.el("span", {}, id)),
        ctx.el("span", { class: "design-wire-value" }, previewValue(field, active.id, variant)));
        wireBody.append(column);
      }
      renderInspector();
    }

    function renderScreen() {
      heading.textContent = active.id + " " + active.title;
      lead.textContent = active.lead;
      location.textContent = "inquiry.example" + active.route.replace(/^GET /u, "");
      markChoice(screenControls, active.id);
      markChoice(stateControls, variant);
      renderWire();
      fieldTable.replaceChildren(ctx.table(
        ["項目ID", "項目", "表示・入力仕様", "チェック"],
        active.fields.map(([id, label, , spec, validation]) => [id, label, spec, validation]),
        active.id + "の項目定義"
      ));
      eventsTable.replaceChildren(ctx.table(
        ["項目ID", "イベント", "画面・API の動作"],
        active.fields.map(([id, label, , , , event]) => [id, label, event]),
        active.id + "の画面イベント"
      ));
    }

    renderScreen();
    return ctx.el("div", { class: "stack" },
      screenControls, heading, lead, stateControls,
      ctx.el("div", { class: "design-wire-grid" },
        ctx.el("div", { class: "design-wire" },
          ctx.el("div", { class: "design-fake-browser" }, ctx.el("span", { "aria-hidden": "true" }, "◆"), location),
          wireBody),
        inspect),
      disclosure(ctx, "画面項目定義と入力チェック", fieldTable),
      disclosure(ctx, "画面イベントの定義", eventsTable),
    );
  }

  function reviewExercise(ctx, review) {
    const answer = ctx.state.answers[ctx.id] ??= { findings: [], revision: "", reviewed: false };
    const result = ctx.el("div", { class: "design-review-result", "aria-live": "polite" });
    const comparison = disclosure(ctx, "模範の改善案", ctx.el("p", {}, review.model));
    const findList = ctx.el("fieldset", { class: "design-review-options" },
      ctx.el("legend", {}, "修正する指摘を選ぶ"));

    function invalidate() {
      answer.reviewed = false;
      result.replaceChildren();
      ctx.save();
    }

    for (const [id, title] of review.issues) {
      const input = ctx.el("input", {
        type: "checkbox", checked: answer.findings.includes(id),
        onChange: event => {
          if (event.currentTarget.checked) answer.findings.push(id);
          else answer.findings = answer.findings.filter(key => key !== id);
          invalidate();
        },
      });
      findList.append(ctx.el("label", {}, input, ctx.el("span", {}, title)));
    }

    const revisionId = "design-revision-" + ctx.id;
    const editor = ctx.el("textarea", {
      id: revisionId, rows: 5, maxlength: 4000, value: answer.revision,
      placeholder: "誰が、何をしたとき、何を確認して、どう表示・保存するかを書いてみましょう。",
      onInput: event => { answer.revision = event.currentTarget.value; invalidate(); },
    });

    function showFeedback(save) {
      const evidence = review.issues.filter(([, , , relevant]) => relevant);
      const good = evidence.filter(([key]) => answer.findings.includes(key));
      const missing = evidence.filter(([key]) => !answer.findings.includes(key));
      const others = review.issues.filter(([key, , , relevant]) => !relevant && answer.findings.includes(key));
      const keep = answer.revision.trim().length >= 30;
      const unmet = review.markers.filter(([, pattern]) => !pattern.test(answer.revision));
      const ready = !missing.length && !others.length && keep && !unmet.length;
      const points = ctx.el("ul", { class: "design-feedback-list" });
      for (const [, title, explanation] of good) {
        points.append(ctx.el("li", {}, ctx.el("strong", {}, "指摘済み · " + title), ctx.el("p", {}, explanation)));
      }
      for (const [, title, explanation] of missing) {
        points.append(ctx.el("li", {}, ctx.el("strong", {}, "再確認 · " + title), ctx.el("p", {}, explanation)));
      }
      for (const [, title, explanation] of others) {
        points.append(ctx.el("li", {}, ctx.el("strong", {}, "要件と照合 · " + title), ctx.el("p", {}, explanation)));
      }
      if (!keep) points.append(ctx.el("li", {}, "採用する修正を30文字以上で説明してください。"));
      if (unmet.length) points.append(ctx.el("li", {}, "記述で確認したい観点 · " + unmet.map(([title]) => title).join("、")));
      result.replaceChildren(ctx.el("div", { class: "callout " + (ready ? "callout-success" : "callout-warning") },
        ctx.el("strong", {}, ready ? "レビューの確認項目を満たしました" : "指摘 " + good.length + " / " + evidence.length + " 件。条件を見直せます。"),
        ctx.el("p", {}, "判定は用意した指摘と記述中の語句を照合します。業務上の判断は模範案と見比べてください。"), points));

      if (!save) return;
      answer.reviewed = true;
      ctx.save();
      if (ready) ctx.complete();
      if (keep) {
        ctx.recordArtifact(review.title, [
          "# " + review.title, "", "## 確認した指摘",
          ...review.issues.filter(([id]) => answer.findings.includes(id)).map(([, title]) => "- " + title),
          "", "## 修正案", "", answer.revision.trim(), "",
        ].join("\n"));
      }
    }

    if (answer.reviewed) showFeedback(false);
    return panel(ctx, review.title,
      ctx.el("p", {}, "不足を見つけ、実装とテストで使える条件に書き直します。"),
      ctx.el("blockquote", { class: "design-flawed" }, review.flawed),
      findList,
      ctx.el("div", { class: "design-revision" }, ctx.el("label", { for: revisionId }, "自分の改善案"), editor),
      ctx.el("div", { class: "actions" }, ctx.el("button", {
        type: "button", class: "button primary", onClick: () => showFeedback(true),
      }, "レビュー結果を確認")),
      result, comparison);
  }

  function tableAsMarkdown(headers, rows) {
    function cell(value) {
      return String(value).replace(/\|/gu, "\\|").replace(/[\r\n]+/gu, " ");
    }
    return [
      "| " + headers.map(cell).join(" | ") + " |",
      "| " + headers.map(() => "---").join(" | ") + " |",
      ...rows.map(row => "| " + row.map(cell).join(" | ") + " |"),
    ].join("\n");
  }

  function downloadSample(ctx, title, filename, markdown) {
    return ctx.el("button", {
      type: "button", class: "button secondary",
      onClick: () => ctx.download(filename, markdown, "text/markdown;charset=utf-8"),
    }, title + "を保存");
  }

  function screenMarkdown() {
    const headers = ["項目ID", "項目", "仕様", "チェック", "イベント"];
    return [
      "# 画面設計書 · 社内問い合わせ管理", "",
      "SCR-00 サインイン → SCR-01 一覧 → SCR-02 詳細。新規は一覧から、編集は詳細から SCR-03 を開く。SCR-04 は管理者のみ。", "",
      ...screens.flatMap(screen => [
        "## " + screen.id + " " + screen.title, "", screen.route + " · " + screen.requirements + " · " + screen.contract, "",
        screen.lead, "", tableAsMarkdown(headers, screen.fields.map(([id, label, , ...rest]) => [id, label, ...rest])), "",
        tableAsMarkdown(["状態", "表示", "次の操作"], stateLabels.map(([id, title]) => [title, ...screen.states[id]])), "",
      ]),
      "## 権限", "", tableAsMarkdown(["操作", "申請者", "窓口担当", "管理者"], permissions), "",
    ].join("\n");
  }

  function traceWorkbench(ctx) {
    const traceDetail = ctx.el("div", { class: "design-trace-detail", "aria-live": "polite" });
    let selected = trace[0][0];
    const steps = ctx.el("ol", { class: "design-trace-list" });
    for (const [id, title] of trace) {
      const button = ctx.el("button", {
        class: "design-trace-button", type: "button", "aria-pressed": String(id === selected), "data-trace": id,
        onClick: () => { selected = id; render(); },
      }, ctx.el("span", { class: "mono" }, id), ctx.el("strong", {}, title));
      steps.append(ctx.el("li", {}, button));
    }
    function render() {
      for (const button of steps.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.trace === selected));
      }
      const [id, title, description] = trace.find(([key]) => key === selected);
      traceDetail.replaceChildren(ctx.el("h3", {}, id + " " + title), ctx.el("p", {}, description));
    }
    render();
    return ctx.el("div", { class: "stack" }, steps, traceDetail);
  }

  const sequenceSteps = [
    "認証済みの利用者から CSRF トークンと If-Match を受け取る。ヘッダーや CSRF トークンが不正なら 400、If-Match がなければ 428。本人のアプリロールと組織を照合する。",
    "対象を読み、現在の行バージョンと If-Match を比較する。古い場合は 412。新規 → 対応中 → 解決 → 終了の順に遷移できる。飛び越しと終了後の変更は 409。",
    "Azure SQL のトランザクション内で対象ID・組織・取得済み rowversion を更新条件にする。更新件数0なら状態を再確認して 412 または範囲外を返す。",
    "更新に成功したら変更履歴と業務監査を挿入し、すべて確定する。いずれかに失敗したら全部をロールバックする。",
    "200 には新しい状態と新しい ETag を返す。利用者には一般エラーと照会IDを返し、失敗記録はロールバックされる履歴とは別の運用ログへ出す。",
  ];

  const sampleRequest = [
    "PATCH /api/tickets/1028/status HTTP/1.1",
    'If-Match: "AAAAAAAAA70="',
    "Content-Type: application/json",
    "X-CSRF-Token: （セッション内の値）", "",
    '{ "nextStatus": "resolved" }', "",
    "HTTP/1.1 200 OK",
    'ETag: "AAAAAAAAA74="', "",
    '{ "id": 1028, "status": "resolved", "updatedAt": "2026-12-15T00:30:00Z" }',
  ].join("\n");

  const safety = [
    ["認証", "許可された Entra テナントの ID トークンを検証し、利用者を tenant ID と object ID の組で対応付ける。未認証のページはサインインへ、API は 401 を返す。"],
    ["認可", "アプリロールと本人・組織を API ごとに確認する。フォーム表示を隠す処理も同じ規則に合わせる。"],
    ["書き込み", "HTTPS、SameSite のセッション Cookie、CSRF トークン、入力長と列挙値の検証を組み合わせる。"],
    ["ログ", "相関ID・操作ID・結果・所要時間を記録。エラー内容は分類コードを記録し機微データを残さない。"],
  ];

  const integration = [
    ["起点", "毎日 02:00 JST（前日 17:00 UTC）の Windows App Service スケジュール WebJob。社員マスターの承認済み HTTPS 参照を使う。"],
    ["取り込み", "同じ実行日の排他を取得し、全ページのカーソルと整合性を確認してステージに保存する。社員IDの重複や無効な組織は反映前に検知する。"],
    ["反映", "検証が通ったスナップショットだけをトランザクションで反映。無効になった社員は active=false とし、履歴の参照を維持する。"],
    ["失敗と再実行", "429 の待ち時間を尊重し、上限つきで再試行。途中の取得失敗は前回分を維持する。相関IDと件数を残して失敗を通知し、同じ実行IDで復旧する。"],
    ["公開までの条件", "既存側の接続許可・サービスID・件数/鮮度の契約・連携再開責任者を承認する。試験には架空データを使う。"],
  ];

  function definitionList(ctx, items) {
    const list = ctx.el("dl", { class: "design-definitions" });
    for (const [key, value] of items) list.append(ctx.el("dt", {}, key), ctx.el("dd", {}, value));
    return list;
  }

  function detailedMarkdown() {
    return [
      "# 詳細設計書 · 社内問い合わせ管理", "",
      "## 要件から試験まで", "", tableAsMarkdown(["ID", "工程", "責務"], trace), "",
      "## API契約", "", tableAsMarkdown(["API", "パス", "権限", "仕様", "応答"], api), "",
      "## データモデル", "", tableAsMarkdown(["テーブル", "キー", "列", "制約・索引"], schema), "",
      "## API-05 の順序", "", ...sequenceSteps.map((step, index) => (index + 1) + ". " + step), "",
      "## 異常時の応答", "", tableAsMarkdown(["応答", "状態", "対応"], outcomes), "",
      "## セキュリティ・運用", "", ...safety.map(([title, line]) => "- " + title + " — " + line), "",
      "## EXT-01 連携", "", ...integration.map(([title, line]) => "- " + title + " — " + line), "",
      "## テスト仕様", "", tableAsMarkdown(["ID", "参照", "手順", "期待結果"], tests), "",
    ].join("\n");
  }

  lab.chapters["03"] = ctx => {
    ctx.root.append(
      panel(ctx, "画面が次の操作を案内する",
        ctx.el("p", {}, "画面設計では、誰が何を見て、どんな条件なら操作でき、失敗時に何をすればよいかを決めます。これを省略すると、同じ API エラーに違う案内が出たり、入力し直す負担が生まれます。"),
        diagram(ctx, routesSvg, "サインイン後は一覧へ進みます。一覧から新規と詳細へ、詳細から編集へ進めます。管理者画面は管理者だけが開けます。"),
        disclosure(ctx, "画面一覧と入口", ctx.table(["ID", "画面", "入口", "要件・試験"], [
          ["SCR-00", "サインイン", "GET /account/sign-in", "REQ-001 · T-001"],
          ...screens.map(screen => [screen.id, screen.title, screen.route, screen.requirements + " · " + screen.contract]),
        ], "画面一覧"))),
      panel(ctx, "操作して読むワイヤーフレーム",
        ctx.el("p", {}, "画面と状態を選び、ワイヤーフレームの項目を押すと、その項目の定義・入力チェック・イベントを確認できます。"),
        screenWorkbench(ctx),
        disclosure(ctx, "権限別の表示と操作", ctx.table(["操作", "申請者", "窓口担当", "管理者"], permissions, "画面とサーバーで揃える条件"),
          ctx.el("p", {}, "申請者が読めるのは本人の問い合わせです。対象外の問い合わせは詳細 API で 404 にします。操作権限は画面を非表示にする処理と、実行時の認可で確認します。")),
        ctx.el("div", { class: "actions" }, downloadSample(ctx, "画面設計サンプル", "screen-design.md", screenMarkdown()))),
      reviewExercise(ctx, screenReview),
    );
  };

  lab.chapters["04"] = ctx => {
    ctx.root.append(
      panel(ctx, "基本設計と詳細設計をつなぐ",
        ctx.el("p", {}, "基本設計では利用者から見える機能・画面・連携の約束をそろえ、詳細設計ではその約束を守る処理順、データの更新、例外時の扱いを決めます。たとえば「状態を解決へ進める」は、画面の操作だけでなく API・DB・試験の条件になります。"),
        traceWorkbench(ctx),
        disclosure(ctx, "システム構成と機能の関係", diagram(ctx, systemSvg, "通常の利用は HTTPS でアプリに入り、App Service から Azure SQL へ接続します。社員マスターの同期は利用者の操作から分離します。"),
          ctx.table(["機能", "説明", "要件・画面", "インターフェース・試験"], features, "基本設計の機能一覧")),
        disclosure(ctx, "API 一覧と状態変更の仕様",
          ctx.table(["API ID", "メソッド・パス", "操作できる人", "入出力・条件", "応答例"], api, "同じ案件の API 契約"),
          ctx.el("h3", {}, "API-05 状態更新のリクエスト・レスポンス例"),
          ctx.el("pre", { class: "design-code", tabindex: "0" }, sampleRequest),
          ctx.el("p", {}, "ETag は取得したデータの版を表す識別子です。If-Match はその版に対してだけ操作する条件。rowversion は SQL Server が行更新時に変更する値で、日時としては扱いません。"),
          ctx.table(["応答", "判定", "処理と利用者への案内"], outcomes, "状態変更の判断表")),
        disclosure(ctx, "データモデル・ER 図・テーブル定義",
          diagram(ctx, erSvg, "社員が問い合わせを申請し、窓口担当が担当に割り当てられます。問い合わせには複数の状態履歴を持てます。"),
          ctx.table(["テーブル", "キー", "主な物理列", "制約と索引"], schema, "Azure SQL の物理設計"),
          ctx.el("p", {}, "一覧は権限で絞ってから並べ替えます。タイトルの部分一致は通常の前方検索と異なるため、実行計画と件数に基づいて検索方法を見直します。")),
        disclosure(ctx, "詳細処理・シーケンス・排他制御",
          diagram(ctx, sequenceSvg, "同時に同じ ETag を送った場合、先に確定した操作だけが成功します。後続では履歴も追加しません。"),
          ctx.el("ol", { class: "design-numbered" }, ...sequenceSteps.map(step => ctx.el("li", {}, step)))),
        disclosure(ctx, "権限・ログ・外部システム連携",
          ctx.el("h3", {}, "セキュリティとログ"), definitionList(ctx, safety),
          ctx.el("h3", {}, "EXT-01 社員マスター連携"), definitionList(ctx, integration)),
        disclosure(ctx, "結合・受入テストの仕様",
          ctx.table(["試験ID", "対応する成果物", "条件と操作", "期待結果"], tests, "テスト仕様と期待結果"),
          ctx.el("p", {}, "実際の試験では対象の版・環境・日時・担当・結果・ログの参照先を証跡として残します。ここで示すのは期待結果の記入例です。")),
        ctx.el("div", { class: "actions" }, downloadSample(ctx, "詳細設計サンプル", "detailed-design.md", detailedMarkdown()),
          downloadSample(ctx, "テスト仕様サンプル", "test-plan.md", "# テスト仕様書 · 社内問い合わせ管理\n\n" +
            tableAsMarkdown(["試験ID", "対応する成果物", "条件と操作", "期待結果"], tests) + "\n")),
      ),
      reviewExercise(ctx, detailReview),
    );
  };

  lab.data.design = { screens, features, api, schema, tests, trace };
})();
