# インフラ設計書｜社内問い合わせ管理システム

## 設計の前提

- 期間は 2026-12-01〜2027-02-26。初回公開は部署内の問い合わせ管理で、社員は社外拠点の社用端末からも HTTPS に到達でき、単一テナントの認証と業務ロールを満たした場合のみアプリを使える。運用の対象はアプリ、DB、夜間取込。例の負荷・保持期間・復旧目標・台数は顧客合意前提の教材値。
- ブラウザー → App Service（公開の HTTPS 入口）→ Entra ID（認証）
- App Service → リージョン VNet 統合（送信）→ Private Endpoint → Azure SQL／Key Vault
- GitHub Actions → Azure OIDC → 検証成果物 → 本番スロット。DB 移行は VNet 内の承認済みジョブ。
- WebJob → 既存社員マスターの承認済み HTTPS API（読取）→ 取込の検証・確定 → 監視。

## 環境分離

| 環境 | 構成 | 使うデータ・確認 |
| --- | --- | --- |
| 開発 | ローカル .NET、SQL Server の検証環境 | 架空データ。再現手順・DB マイグレーション・CI 単体結合試験を共有 |
| 検証 | 別リソースグループ、別 App Service／SQL／Vault、別 Entra アプリ登録 | 10,000件の架空データ、テスト用ユーザー。Public network access と DNS の試験も本番相当 |
| 本番 | 承認された本番サブスクリプション、専用 Azure SQL／Vault、承認付き配備 | 本番データと資格情報。スロットは公開前の温めと配備確認に使用。検証環境とは分離し、検証用 URL を公開しない |

## 構成要素と役割

| 要素 | 設定・使い方 | 採用理由 | 検証 | 代替案 |
| --- | --- | --- | --- | --- |
| 社員ブラウザー | 公開 HTTPS で App Service に到達します。社内テナントで認証した社員だけが業務画面を使えます。 | 社外拠点の社員も社用端末から使えます。ネットワークの公開範囲と業務データの認可を別々に定義します。 | 未認証アクセス、別テナントのサインイン、権限のない問い合わせの直接指定を受入試験にします。 | 私設接続が必須なら、App Service の受信用 Private Endpoint と、利用者 VPN／社内 DNS を含めた入口を別案にします。AZ-02 |
| Microsoft Entra ID | 単一テナントの OIDC を使い、アプリでは issuer、audience、有効期限と署名を検証します。 | 利用者は tid と oid の組で識別します。メールアドレスは表示用です。申請者・窓口担当・管理者の業務権限と行の所有権はサーバーで判定します。 | 有効なセッションでも他の申請者の問い合わせを閲覧・更新できないことを確認します。AZ-06 | App Service の組み込み認証も候補です。アプリ内での担当者制約、テスト方法、既存の .NET 方針を含めて比較します。 |
| Azure App Service | Windows の App Service で画面と API を実行します。見積の出発点はスロット対応の Standard S1 2台です。容量は負荷試験で決めます。 | 既存チームが運用できる一体構成で、3名・3か月の中でログインから公開までの作業を小さくします。 | HTTPS のみ、入口のアクセス条件、認証、応答時間、スロット固有の DB と Key Vault 設定を確認します。AZ-09、AZ-20 | コンテナ基盤が既存なら Container Apps、短時間のイベント処理が中心なら Functions を比較します。 |
| 夜間取込 WebJob | Windows App Service のスケジュール WebJob。UTC の 17:00 で起動し、社員マスターを読取専用で取り込みます。 | 初回はアプリと同じ実行基盤を利用します。Always On と本番スロットだけの起動を確認し、DB の実行リースと取込キーで重複処理を防ぎます。 | 件数検証・差分適用後に成功マーカーを記録します。失敗時は最終成功データを維持し、監視で連絡します。AZ-18 | Web アプリとジョブを別々に配備・スケールしたい場合は、タイマートリガーの Functions や Container Apps Jobs を比較します。 |
| GitHub Actions | PR でテストし、同じビルド成果物を検証と本番へ移します。本番は承認付きの環境で配備用 ID を使います。 | OIDC フェデレーションで Azure の短いトークンを受けます。配備権限と DB 変更権限は別に保持します。AZ-08 | ワークフローの OIDC 条件、App Service のデプロイ経路、可視性、承認イベント、成果物ダイジェストを確認します。 | Azure DevOps 等で既存の運用に合わせられます。Private Endpoint の DB 移行には VNet 内で実行できる承認済みのジョブが必要です。 |
| Azure Key Vault | 外部連携に長期の資格情報が必要な場合、環境ごとの Vault に保管します。アプリのマネージド ID に必要な読取だけ許可します。 | コード、GitHub、ログから値を分離できます。DB 接続はマネージド ID を利用し、DB パスワードは管理しません。AZ-07、AZ-19 | 本番の Vault は専用 Private Endpoint と privatelink.vaultcore.azure.net を使います。アクセス経路、ローテーション後の反映、参照エラーを試験します。 | 外部側がフェデレーションに対応すれば秘密の長期保管を減らせます。アプリの構成値の保管と Vault の運用手順は別に記録します。 |
| VNet 統合 | App Service のリージョン VNet 統合で、VNet への送信を可能にします。統合用サブネットは Microsoft.Web/serverFarms に委任します。 | App Service の業務画面の入口を保ちつつ、DB と Vault のプライベート接続を作れます。AZ-01、AZ-03 | アプリ・検証スロット・ジョブから DNS と TCP を試験し、各スロットのネットワーク構成を確認します。 | 私設の入口が必要な場合は受信用 Private Endpoint を追加します。統合用と Private Endpoint 用のサブネットは分けます。 |
| Private Endpoint | VNet 内の別サブネットに Azure SQL と Key Vault の各 Private Endpoint を作り、接続を承認します。 | DB と Vault へのデータ通信をプライベート経路に限定します。SQL の Public network access は明示的に無効化します。AZ-04 | FQDN が内部 IP へ解決すること、内部からの接続成功と外部からの拒否、SQL の利用者権限を別々に確認します。 | 一時的な最小構成でも公開接続を使うならデータ分類と許可条件の承認が必要です。この案件の本番は Private Endpoint とします。 |
| Private DNS | privatelink.database.windows.net と privatelink.vaultcore.azure.net を VNet にリンクします。App は通常のサービス FQDN を使います。 | SQL 接続文字列のホストは server.database.windows.net で、名前解決結果が Private Endpoint の IP になります。AZ-04、AZ-05 | 本番相当の実行位置で名前解決結果を記録します。カスタム DNS ならフォワードと解決先を確認します。 | 既存ハブ DNS や Azure DNS Private Resolver を使う案は、名前解決の所有者や既存の連携を確認して判断します。 |
| DB 移行ジョブ | VNet にアクセスできる承認済みランナーまたはジョブから、配備後に必要な SQL 移行を一度だけ実行します。 | GitHub の Azure OIDC と DB ネットワークを分離し、スキーマ変更の権限を実行アプリと分けます。 | 同じ移行が二度適用されないこと、失敗時の記録、前版アプリとの互換性を検証。 | 自動移行を導入する前は、同じ VNet 内の承認された作業環境でレビュー済みの変更を実行できます。 |
| Azure SQL Database | Azure SQL の General Purpose を見積の出発点にします。問い合わせ、担当、行の版、業務監査を永続化し、アプリ ID と DB 移行 ID に別ロールを割り当てます。 | REQ-005 の状態変更と監査を同一トランザクションで管理します。アプリから DB への TCP/TLS と DB 認可を両方満たします。AZ-04、AZ-19 | 接続、T-005、バックアップからの時点復元、役割別のアクセス、NFR-001 の負荷計測を検証します。 | 既存 DB 基盤を使う候補は運用責任、Entra 対応、トランザクション、バックアップ仕様を比較します。 |
| Azure Monitor | App Insights の要求・依存先・例外のテレメトリを Log Analytics ワークスペースで参照し、Monitor のアラートを運用当番に送ります。 | エラー増加、SQL の応答低下、夜間取込停止を API・DB・ジョブの記録から切り分けます。業務監査は DB で別管理します。AZ-13、AZ-14 | アラートの発報と到着をリハーサルし、本文・トークン・認証ヘッダーがログに入らないことを確認します。 | 既存の監視基盤へ OpenTelemetry を送る案では、保持、運用担当、コストの違いを確認します。 |
| 既存の社員マスター | ジョブは既存マスターを読取専用で利用します。SLA、認証、データ項目、固定送信元の要否を連携先運用者と確認します。 | 利用者管理の元データを一つにし、手修正との差分や取り込み失敗を追えるようにします。 | 接続元許可、タイムアウト、再試行、重複キー、件数異常、既存の最終成功データを使い続ける挙動を検証します。 | 送信元の固定が必要なら VNet 経由の送信と NAT Gateway などを検証します。社内専用 API なら VPN／既存網と DNS を先に合意します。 |

## CI/CD と切り戻し

1. PR で単体・結合・権限の試験を実施。ビルドした成果物のコミット ID とハッシュを登録し、別環境で同じ成果物を試験する。
2. 本番は GitHub 環境で対象ブランチ・承認者・OIDC の対象を制限する。業務アプリ、デプロイ用、DB 移行用にそれぞれ専用 ID を割り当てる。
3. スロットのホスト、アクセス制限、Entra のリダイレクト URI、ユーザー割り当て ID／権限、ネットワーク、環境固有の値を確認する。旧アプリと互換のある DB 変更を分離し、同時適用を防ぐ。
4. 非本番スロットは WEBJOBS_STOPPED=1 をスロット設定にする。本番の取込だけを有効にする。温めと読み取り中心の確認後にスワップし、ログとスモーク試験を確認。
5. 本番配備記録に成果物 ID・設定・移行結果・確認者を残す。旧版と DB の互換性を確かめてからアプリを切り戻す。データ復元は業務責任者が失う更新を確認して判断する。

## 運用、復旧、費用

| 観点 | 運用方針 | 責任 |
| --- | --- | --- |
| アプリ障害 | ヘルスチェックとエラー率・遅延を監視。可能な規模を負荷試験で確認し、本番は2インスタンスを見積前提にする。地域・プランのゾーン対応は契約時に確認。 | 運用担当が一次対応、PL が顧客へ状況・次の報告時刻を連絡 |
| DB 障害・誤更新 | 自動バックアップの保持14日を想定。PITR は別名 DB に復元し、突合・接続先切替・更新再開の順を計測。アプリの切り戻しと DB の復元は別判断。 | DB 担当が検証、顧客運用責任者が復元時点・失う更新を承認 |
| 地域障害 | 単一リージョン案では、アプリまたはデータの単独障害を初回の RPO/RTO の対象とする。ゾーン・地域障害を含める場合は、ゾーン冗長、復元先の構成、geo-restore またはフェールオーバー構成と実測、費用を再検討。 | 顧客責任者と PL が対象障害・予算を合意 |
| 監視とログ | 5xx 増加と p95 悪化を直近15分で確認。02:00 の取込成功が 03:00 JST までに無ければ通知。相関 ID・件数・HTTP 状態を記録し、本文とトークンは記録しない。 | 運用当番、アプリ担当、連携先担当 |
| 費用 | App Service plan のサイズと台数、SQL の層とバックアップ、Private Endpoint、Log Analytics の取込・保持、検証環境、通信費を積み上げる。初回はログ保持30日を仮定し、料金は SKU・地域と見積当日に確認。 | PL が構成と稼働条件を見積記録に残し、月次で予算アラートを確認 |

## 検証と担当

| ID | 観点 | 受入の目安 | 担当 |
| --- | --- | --- | --- |
| NET-01 | 公開範囲と名前解決 | HTTPS 入口の認証、DB の公開接続無効、通常の SQL FQDN の内部解決を各実行位置で確認 | インフラ担当 |
| SEC-01 | 認証・認可と資格情報 · T-001、T-009 | 申請者・窓口担当・管理者を試し、他人のデータへの許可外操作は拒否。秘密がログやバックアップ資料に出ない | 実装担当、PL |
| PERF-01 | 性能 NFR-001 · T-008 | 30人相当、10,000件、一覧・詳細が80%の負荷を15分実行。操作別の応答 p95 が 1.5秒以内。エラー率と計測条件を記録 | 実装担当 |
| DR-01 | 復旧 NFR-003 · T-010 | 時点復元を新規 DB に行い、データ時点差と想定障害から業務再開までを測る。RPO 1時間、RTO 4時間。ゾーン・地域障害は別途合意 | インフラ担当、顧客運用 |
| OBS-01 | 監視と運用 NFR-002 · T-007、T-009 | 5xx、依存先遅延、翌朝の取込未完了、復旧の監視が当番に通知され、担当と判断時刻を追える | 顧客運用、PL |
| REL-01 | 配備と切り戻し | 同じ成果物 ID、承認・移行・スロット設定、旧版の DB 互換性、復元判断をリハーサルで確認 | PL、インフラ担当 |

## 配備先の技術選定

| 方式 | 適合する点 | 運用上の負担 |
| --- | --- | --- |
| Azure App Service | ASP.NET Core の画面・API と配備スロットを一体で運用しやすい。 | ホスティングプランと常時容量が費用に効き、ジョブの負荷が同居する。 |
| Azure Functions | タイマー・キュー等のトリガーを起点に処理を分離しやすい。 | プランによりネットワーク・スケール・待機時の特性が違う。Web UI は別に設計する。 |
| Azure Container Apps | コンテナ、リビジョン、HTTP／イベントの別スケーリングや Jobs が使える。 | イメージ管理、Ingress、プライベート経路、レプリカの設定・監視を追加で設計する。 |

利用条件の例。画面/APIは App Service。夜間取込を WebJob で開始し、取込時間やエラー率が閾値を越えたらワーカー分離を再見積します。

## 仕様の参照

Microsoft Learn の公式原稿で確認。確認日 2026-11-27（UTC）。

- AZ-01 App Service の VNet 統合。確認内容は 送信方向、同一リージョン、委任サブネット。[App Service の VNet 統合](https://learn.microsoft.com/azure/app-service/overview-vnet-integration) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/overview-vnet-integration.md)
- AZ-02 App Service の Private Endpoint。確認内容は 受信方向、公開入口の扱い。[App Service の Private Endpoint](https://learn.microsoft.com/azure/app-service/overview-private-endpoint) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/overview-private-endpoint.md)
- AZ-03 Azure Virtual Network。確認内容は ネットワークとサブネットによる分離。[Azure Virtual Network](https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/virtual-network/virtual-networks-overview.md)
- AZ-04 Azure SQL の Private Link。確認内容は 公開接続の無効化、接続文字列の FQDN。[Azure SQL の Private Link](https://learn.microsoft.com/azure/azure-sql/database/private-endpoint-overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/sql-docs/live/azure-sql/database/private-endpoint-overview.md)
- AZ-05 Private Endpoint と DNS。確認内容は プライベート DNS ゾーンの FQDN とリンク。[Private Endpoint と DNS](https://learn.microsoft.com/azure/private-link/private-endpoint-dns) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/private-link/private-endpoint-dns.md)
- AZ-06 Entra ID トークンのクレーム。確認内容は tid と oid の意味、メールを永続 ID に使う場合の問題。[Entra ID トークンのクレーム](https://learn.microsoft.com/entra/identity-platform/id-token-claims-reference) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/entra-docs/main/docs/identity-platform/id-token-claims-reference.md)
- AZ-07 App Service と Key Vault 参照。確認内容は マネージド ID、読取権限、キャッシュ・更新。[App Service と Key Vault 参照](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/app-service-key-vault-references.md)
- AZ-08 GitHub Actions から App Service へ配備。確認内容は OIDC、短期間トークン、デプロイ設定。[GitHub Actions から App Service へ配備](https://learn.microsoft.com/azure/app-service/deploy-github-actions) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/deploy-github-actions.md)
- AZ-09 App Service のデプロイスロット。確認内容は スロット対象プラン、スワップと環境固有設定。[App Service のデプロイスロット](https://learn.microsoft.com/azure/app-service/deploy-staging-slots) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/deploy-staging-slots.md)
- AZ-10 Azure SQL の自動バックアップ。確認内容は 保持期間、バックアップ方式、冗長性。[Azure SQL の自動バックアップ](https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/sql-docs/live/azure-sql/database/automated-backups-overview.md)
- AZ-11 Azure SQL のバックアップ復元。確認内容は 時点復元の復元先、地域障害と geo-restore。[Azure SQL のバックアップ復元](https://learn.microsoft.com/azure/azure-sql/database/recovery-using-backups) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/sql-docs/live/azure-sql/database/recovery-using-backups.md)
- AZ-12 Azure SQL の可用性とゾーン冗長。確認内容は 層ごとの冗長化とリージョン選定。[Azure SQL の可用性とゾーン冗長](https://learn.microsoft.com/azure/azure-sql/database/high-availability-sla-local-zone-redundancy) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/sql-docs/live/azure-sql/database/high-availability-sla-local-zone-redundancy.md)
- AZ-13 Application Insights の概要。確認内容は アプリテレメトリ、トレース。[Application Insights の概要](https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-monitor-docs/main/articles/azure-monitor/app/app-insights-overview.md)
- AZ-14 Log Analytics ワークスペース。確認内容は データ保存、クエリ、取り込みと保持。[Log Analytics ワークスペース](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-workspace-overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-monitor-docs/main/articles/azure-monitor/logs/log-analytics-workspace-overview.md)
- AZ-15 Azure Functions の概要。確認内容は トリガー、ホスティング選定、イベント処理。[Azure Functions の概要](https://learn.microsoft.com/azure/azure-functions/functions-overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/azure-functions/functions-overview.md)
- AZ-16 Azure Container Apps の概要。確認内容は コンテナ、リビジョン、イベント・HTTP スケーリング。[Azure Container Apps の概要](https://learn.microsoft.com/azure/container-apps/overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/container-apps/overview.md)
- AZ-17 Container Apps Jobs。確認内容は スケジュール・イベントで実行するジョブ。[Container Apps Jobs](https://learn.microsoft.com/azure/container-apps/jobs) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/container-apps/jobs.md)
- AZ-18 App Service の WebJobs。確認内容は Always On、NCRONTAB、スロット設定。[App Service の WebJobs](https://learn.microsoft.com/azure/app-service/webjobs-create) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/webjobs-create.md)
- AZ-19 Azure SQL の Entra 認証の構成。確認内容は Entra 管理者と DB ユーザー、データ権限。[Azure SQL の Entra 認証の構成](https://learn.microsoft.com/azure/azure-sql/database/authentication-aad-configure) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/sql-docs/live/azure-sql/database/authentication-aad-configure.md)
- AZ-20 App Service の概要。確認内容は 管理された HTTP アプリ実行環境。[App Service の概要](https://learn.microsoft.com/azure/app-service/overview) · [公式原稿](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/app-service/overview.md)
