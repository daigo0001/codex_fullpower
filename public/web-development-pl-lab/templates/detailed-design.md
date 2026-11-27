# 詳細設計書 · 社内問い合わせ管理

架空案件の記入例。状態変更に焦点を置き、画面の期待と API・DB の実装条件をつなげる。

## 要件から試験まで

| 成果物 ID | 観点 | 詳細 |
| --- | --- | --- |
| REQ-005 | 業務要件 | 窓口担当が問い合わせの状態・担当者を更新する。飛び越しや重複更新が起きない条件を受入に含める。 |
| SCR-02 · D-02 | 画面イベント | GET の ETag と現在状態を保持し、対応中 → 解決を保存。競合時は表示を読み直す。 |
| API-05 | API・認可 | PATCH /api/tickets/{id}/status。アプリロールと行の組織を確認し、If-Match を必須にする。 |
| tickets · row_version | DB・トランザクション | WHERE の行バージョン条件で更新。問い合わせ、状態履歴、監査を1回で確定する。 |
| T-005 | テスト | 同じ ETag で2件を並行送信。200 と 412 が各1件で、履歴・変更監査が1件ずつ。 |

## API 一覧

| API ID | メソッドとパス | 許可範囲 | インターフェース | 想定応答 |
| --- | --- | --- | --- | --- |
| API-01 | GET /account/sign-in | 未認証の社員 | OIDC チャレンジ。戻り先はサイト内のルートのみ。認証成功後は本人の許可ロールで表示。 | 302 · 403 |
| API-02 | GET /api/tickets | 本人または組織内 | q、status、assignee、page を検証。20件と権限内の総件数。更新日時・ID 順。 | 200 · 400 · 403 |
| API-03 | GET /api/tickets/{id} | 本人または組織内 | 問い合わせ、状態履歴、利用可能操作と引用符付き ETag。閲覧不可の対象は同じ 404。 | 200 · 404 |
| API-04 | POST /api/tickets | 許可された社員 | title、description。操作IDを送る。受付ID・ETag・Location を返す。同一操作IDと同じ入力の再試行は同じ受付結果。 | 201 · 403 · 409 · 422 |
| API-05 | PATCH /api/tickets/{id}/status | 窓口担当・管理者 | nextStatus、If-Match、CSRF トークン。新状態と新 ETag。状態履歴と監査の記録も確定。 | 200 · 400 · 403 · 404 · 409 · 412 · 422 · 428 |
| API-06 | PATCH /api/tickets/{id}/assignment | 窓口担当・管理者 | assigneeId と If-Match。組織内の有効な窓口担当だけを候補にする。新 ETag を返す。 | 200 · 403 · 404 · 412 · 422 · 428 |
| API-07 | GET /api/admin/sync-runs | 管理者 | from、to。連携日時、実行ID、件数、結果を返す。社員情報や認証情報は含めない。 | 200 · 400 · 403 |
| API-08 | PATCH /api/tickets/{id} | 本人の新規のみ | title、description、If-Match。所有者と状態をサーバーで再判定。 | 200 · 403 · 404 · 412 · 422 · 428 |
| API-09 | GET /api/admin/access-summary | 管理者 | 現セッションのマップ済みアプリロールと操作範囲。ディレクトリの列挙や更新は行わない。 | 200 · 403 |
| EXT-01 | GET /v1/employees?cursor=… | 連携専用ID | 社員ID、有効区分、組織コード、表示名の参照。ページを通してスナップショットを揃える。 | 200 · 429 · 5xx |

## API-05 状態変更

~~~http
PATCH /api/tickets/1028/status HTTP/1.1
Content-Type: application/json
X-CSRF-Token: <セッション内の値>
If-Match: "AAAAAAAAA70="

{ "nextStatus": "resolved" }

HTTP/1.1 200 OK
ETag: "AAAAAAAAA74="

{ "id": 1028, "status": "resolved", "updatedAt": "2026-12-15T00:30:00Z" }
~~~

Cookie 認証の画面から発行する書き込みには CSRF 検証を適用する。GET API-03 の引用符付きの強い ETag をそのまま If-Match で送る。更新成功後は応答の ETag に置き換える。欠落は428、対象を取得した版との不一致は412。状態値は new、in_progress、resolved、closed。対応中から終了へ飛ぶ操作は409。

~~~text
SCR-02               API-05                              Azure SQL
  | --PATCH + ETag----> |                                     |
  |                     | 認証・CSRF・ロール・行の組織を確認  |
  |                     | --版を指定して状態更新---------------> |
  |                     |   状態・履歴・監査を同じ取引で確定    |
  | <---200 / 新ETag--- | <------------新しい版---------------- |
  | <---412 / 読み直し- |    （既に別の人が更新した場合）        |
~~~

1. ログイン済み本人を Entra テナント ID と object ID の組で識別する。指定ロールがなければ403。読み取れる組織の外なら404。
2. 要求本文の型、状態の値、ヘッダーの形式を検証する。認証済み画面の操作では CSRF トークンも検証する。
3. 対象を取得して版を照合し、許可した遷移か判定する。現行状態はDBの値を使う。
4. 1トランザクション内で問い合わせ ID・組織・row_version を条件に更新する。競合による更新0件の場合は履歴を書かず、再確認後に412または404で返す。
5. 変更前後、操作者、処理時刻を状態履歴へ記録し、監査イベントを追加する。いずれかに失敗した場合は全体を戻す。成功時のみ200と更新済み状態を返す。
6. 読み直し時は利用者が状態を再確認してから次の操作を選ぶ。タイムアウト時に同じ変更を自動で再送しない。

ETag はレスポンスの版識別子。rowversion は行の更新につれて生成される8バイトの値です。画面上の時刻には updated_at を使う。

## 論理モデルと物理定義

社員1対問い合わせ多（申請者と担当者の2関係）。問い合わせ1対状態履歴多。変更者は社員を参照する。監査は問い合わせを参照でき、管理画面の閲覧など対象のない操作では空を許可する。社員マスター取込結果は日次の運用単位で保持する。

| テーブル | キー | 主な物理列 | 制約と索引 |
| --- | --- | --- | --- |
| tickets | ticket_id bigint PK · requester_id bigint FK · assignee_id bigint FK NULL | title nvarchar(100) · description nvarchar(2000) · status tinyint · org_code varchar(32) · create_operation_id uniqueidentifier · created_at / updated_at datetime2(3) · row_version rowversion | 状態 CHECK。requester_id と create_operation_id の組を一意化。本人一覧は requester_id、更新日時、ID の索引から計測。担当者の一覧は組織と状態も候補にする。 |
| employees | employee_id bigint PK · external_id varchar(64) UNIQUE | entra_tenant uniqueidentifier NULL · entra_object uniqueidentifier NULL · display_name nvarchar(100) · active bit · org_code varchar(32) | 認証の対応付けは承認済み登録で管理し、両方が入った行で同一組を一意化。退職者は無効にし、履歴の参照を維持する。 |
| ticket_status_history | history_id bigint PK · ticket_id bigint FK · actor_id bigint FK | previous_status tinyint · next_status tinyint · changed_at datetime2(3) | ticket_id、changed_at、history_id で履歴順を確定する。 |
| audit_events | event_id bigint PK · actor_id bigint FK · ticket_id bigint FK NULL | action varchar(40) · result varchar(24) · occurred_at datetime2(3) · correlation_id varchar(64) | 結果と識別子を記録。本文、トークン、シークレットは含めない。 |
| employee_sync_runs | run_id uniqueidentifier PK | window_key char(10) UNIQUE · started_at datetime2(3) · finished_at datetime2(3) NULL · state varchar(24) · row_count int · error_code varchar(40) NULL | JSTの実行日キーで二重起動を防ぐ。再試行は同じ run_id と排他ロックで扱う。 |

申請者と担当者は社員の内部キーを参照する。各組織の表示範囲はチケット作成時の org_code で制御する。日時は UTC で記録し、表示と日次スケジュールは JST とする。社員の退職は active を更新し、過去の参照を維持する。

初期の検索索引は本人検索の requester_id、updated_at、ticket_id と、組織内検索の org_code、status、updated_at、ticket_id を候補にする。部分一致のタイトルはこれらの索引で直接探索できないことがあるため、1万件の架空データの実行計画と応答を観測する。

## 例外とログ

| 結果 | 扱い |
| --- | --- |
| 400 | ヘッダーの形や CSRF 条件が満たせない場合。画面に照会IDを示す。 |
| 403・404 | 操作権限がないか対象が読めない。対象外の情報は返さない。 |
| 409・412・428 | 遷移違反、古い版、必須条件の欠落。画面に読み直しと再判断の方法を示す。 |
| 422 | 不正な状態や入力値。修正する項目を示し、入力値を維持する。 |
| 500・通信切断 | 一般エラーと照会ID。操作結果を画面から読み直す。DB上の成否を照合してから再操作する。 |

成功の業務監査は変更と同じトランザクションで作る。ロールバックした操作の失敗理由は運用ログに分類コードとして残す。要求・操作・利用者の照合に必要な識別子と時間だけを記録する。本文・トークン・シークレットの記録は禁止する。

## EXT-01 定時連携

02:00 JST（前日17:00 UTC）に Windows App Service の定時 WebJob を開始する。承認済みの参照 HTTPS API を連携専用IDで読む。日付キーで1実行に制限し、全ページをステージで検証してから差分をトランザクションで反映する。拒否・429・途中切断・不完全スナップショットでは現行データを維持する。429 は Retry-After があれば待ち、上限を超えたら通知する。再実行は元の実行IDで排他を取得する。

## 参考資料

- SQL Server の行バージョン仕様、MicrosoftDocs GitHub 原文を確認。確認日 2026-11-26。[rowversion](https://github.com/MicrosoftDocs/sql-docs/blob/live/docs/t-sql/data-types/rowversion-transact-sql.md)
- ASP.NET Core の Cookie 認証時の CSRF 検証、Microsoft 公式ドキュメント GitHub 原文を確認。確認日 2026-11-26。[Antiforgery](https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/security/anti-request-forgery.md)
- If-Match、ETag、412 の HTTP 意味論、HTTP Working Group の仕様ソースを確認。確認日 2026-11-26。[RFC 9110](https://github.com/httpwg/http-core/blob/main/rfc9110.xml)
