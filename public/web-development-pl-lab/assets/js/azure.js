(() => {
  "use strict";
  const lab = globalThis.PLLab;
  const checked = "2026-11-27";
  const sources = [
    ["AZ-01", "App Service の VNet 統合", "https://learn.microsoft.com/azure/app-service/overview-vnet-integration", "azure-docs/main/articles/app-service/overview-vnet-integration.md", "送信方向、同一リージョン、委任サブネット"],
    ["AZ-02", "App Service の Private Endpoint", "https://learn.microsoft.com/azure/app-service/overview-private-endpoint", "azure-docs/main/articles/app-service/overview-private-endpoint.md", "受信方向、公開入口の扱い"],
    ["AZ-03", "Azure Virtual Network", "https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview", "azure-docs/main/articles/virtual-network/virtual-networks-overview.md", "ネットワークとサブネットによる分離"],
    ["AZ-04", "Azure SQL の Private Link", "https://learn.microsoft.com/azure/azure-sql/database/private-endpoint-overview", "sql-docs/live/azure-sql/database/private-endpoint-overview.md", "公開接続の無効化、接続文字列の FQDN"],
    ["AZ-05", "Private Endpoint と DNS", "https://learn.microsoft.com/azure/private-link/private-endpoint-dns", "azure-docs/main/articles/private-link/private-endpoint-dns.md", "プライベート DNS ゾーンの FQDN とリンク"],
    ["AZ-06", "Entra ID トークンのクレーム", "https://learn.microsoft.com/entra/identity-platform/id-token-claims-reference", "entra-docs/main/docs/identity-platform/id-token-claims-reference.md", "tid と oid の意味、メールを永続 ID に使う場合の問題"],
    ["AZ-07", "App Service と Key Vault 参照", "https://learn.microsoft.com/azure/app-service/app-service-key-vault-references", "azure-docs/main/articles/app-service/app-service-key-vault-references.md", "マネージド ID、読取権限、キャッシュ・更新"],
    ["AZ-08", "GitHub Actions から App Service へ配備", "https://learn.microsoft.com/azure/app-service/deploy-github-actions", "azure-docs/main/articles/app-service/deploy-github-actions.md", "OIDC、短期間トークン、デプロイ設定"],
    ["AZ-09", "App Service のデプロイスロット", "https://learn.microsoft.com/azure/app-service/deploy-staging-slots", "azure-docs/main/articles/app-service/deploy-staging-slots.md", "スロット対象プラン、スワップと環境固有設定"],
    ["AZ-10", "Azure SQL の自動バックアップ", "https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview", "sql-docs/live/azure-sql/database/automated-backups-overview.md", "保持期間、バックアップ方式、冗長性"],
    ["AZ-11", "Azure SQL のバックアップ復元", "https://learn.microsoft.com/azure/azure-sql/database/recovery-using-backups", "sql-docs/live/azure-sql/database/recovery-using-backups.md", "時点復元の復元先、地域障害と geo-restore"],
    ["AZ-12", "Azure SQL の可用性とゾーン冗長", "https://learn.microsoft.com/azure/azure-sql/database/high-availability-sla-local-zone-redundancy", "sql-docs/live/azure-sql/database/high-availability-sla-local-zone-redundancy.md", "層ごとの冗長化とリージョン選定"],
    ["AZ-13", "Application Insights の概要", "https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview", "azure-monitor-docs/main/articles/azure-monitor/app/app-insights-overview.md", "アプリテレメトリ、トレース"],
    ["AZ-14", "Log Analytics ワークスペース", "https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-workspace-overview", "azure-monitor-docs/main/articles/azure-monitor/logs/log-analytics-workspace-overview.md", "データ保存、クエリ、取り込みと保持"],
    ["AZ-15", "Azure Functions の概要", "https://learn.microsoft.com/azure/azure-functions/functions-overview", "azure-docs/main/articles/azure-functions/functions-overview.md", "トリガー、ホスティング選定、イベント処理"],
    ["AZ-16", "Azure Container Apps の概要", "https://learn.microsoft.com/azure/container-apps/overview", "azure-docs/main/articles/container-apps/overview.md", "コンテナ、リビジョン、イベント・HTTP スケーリング"],
    ["AZ-17", "Container Apps Jobs", "https://learn.microsoft.com/azure/container-apps/jobs", "azure-docs/main/articles/container-apps/jobs.md", "スケジュール・イベントで実行するジョブ"],
    ["AZ-18", "App Service の WebJobs", "https://learn.microsoft.com/azure/app-service/webjobs-create", "azure-docs/main/articles/app-service/webjobs-create.md", "Always On、NCRONTAB、スロット設定"],
    ["AZ-19", "Azure SQL の Entra 認証の構成", "https://learn.microsoft.com/azure/azure-sql/database/authentication-aad-configure", "sql-docs/live/azure-sql/database/authentication-aad-configure.md", "Entra 管理者と DB ユーザー、データ権限"],
    ["AZ-20", "App Service の概要", "https://learn.microsoft.com/azure/app-service/overview", "azure-docs/main/articles/app-service/overview.md", "管理された HTTP アプリ実行環境"],
  ];
  const resources = {
    browser: {label:"社員ブラウザー", sub:"HTTPS の入口", x:20,y:42,w:176,h:60,
      use:"公開 HTTPS で App Service に到達します。社内テナントで認証した社員だけが業務画面を使えます。",
      reason:"社外拠点の社員も社用端末から使えます。ネットワークの公開範囲と業務データの認可を別々に定義します。",
      verify:"未認証アクセス、別テナントのサインイン、権限のない問い合わせの直接指定を受入試験にします。",
      alternative:"私設接続が必須なら、App Service の受信用 Private Endpoint と、利用者 VPN／社内 DNS を含めた入口を別案にします。AZ-02"},
    entra: {label:"Microsoft Entra ID", sub:"サインインとトークン", x:20,y:154,w:176,h:60,
      use:"単一テナントの OIDC を使い、アプリでは issuer、audience、有効期限と署名を検証します。",
      reason:"利用者は tid と oid の組で識別します。メールアドレスは表示用です。申請者・窓口担当・管理者の業務権限と行の所有権はサーバーで判定します。",
      verify:"有効なセッションでも他の申請者の問い合わせを閲覧・更新できないことを確認します。AZ-06",
      alternative:"App Service の組み込み認証も候補です。アプリ内での担当者制約、テスト方法、既存の .NET 方針を含めて比較します。"},
    app: {label:"Azure App Service",sub:"ASP.NET Core / 公開 HTTPS",x:286,y:42,w:210,h:60,
      use:"Windows の App Service で画面と API を実行します。見積の出発点はスロット対応の Standard S1 2台です。容量は負荷試験で決めます。",
      reason:"既存チームが運用できる一体構成で、3名・3か月の中でログインから公開までの作業を小さくします。",
      verify:"HTTPS のみ、入口のアクセス条件、認証、応答時間、スロット固有の DB と Key Vault 設定を確認します。AZ-09、AZ-20",
      alternative:"コンテナ基盤が既存なら Container Apps、短時間のイベント処理が中心なら Functions を比較します。"},
    jobs: {label:"夜間取込 WebJob",sub:"02:00 JST / 17:00 UTC",x:286,y:154,w:210,h:60,
      use:"Windows App Service のスケジュール WebJob。UTC の 17:00 で起動し、社員マスターを読取専用で取り込みます。",
      reason:"初回はアプリと同じ実行基盤を利用します。Always On と本番スロットだけの起動を確認し、DB の実行リースと取込キーで重複処理を防ぎます。",
      verify:"件数検証・差分適用後に成功マーカーを記録します。失敗時は最終成功データを維持し、監視で連絡します。AZ-18",
      alternative:"Web アプリとジョブを別々に配備・スケールしたい場合は、タイマートリガーの Functions や Container Apps Jobs を比較します。"},
    actions: {label:"GitHub Actions",sub:"承認と Azure OIDC",x:712,y:42,w:208,h:60,
      use:"PR でテストし、同じビルド成果物を検証と本番へ移します。本番は承認付きの環境で配備用 ID を使います。",
      reason:"OIDC フェデレーションで Azure の短いトークンを受けます。配備権限と DB 変更権限は別に保持します。AZ-08",
      verify:"ワークフローの OIDC 条件、App Service のデプロイ経路、可視性、承認イベント、成果物ダイジェストを確認します。",
      alternative:"Azure DevOps 等で既存の運用に合わせられます。Private Endpoint の DB 移行には VNet 内で実行できる承認済みのジョブが必要です。"},
    vault: {label:"Azure Key Vault",sub:"環境別の資格情報",x:712,y:154,w:208,h:60,
      use:"外部連携に長期の資格情報が必要な場合、環境ごとの Vault に保管します。アプリのマネージド ID に必要な読取だけ許可します。",
      reason:"コード、GitHub、ログから値を分離できます。DB 接続はマネージド ID を利用し、DB パスワードは管理しません。AZ-07、AZ-19",
      verify:"本番の Vault は専用 Private Endpoint と privatelink.vaultcore.azure.net を使います。アクセス経路、ローテーション後の反映、参照エラーを試験します。",
      alternative:"外部側がフェデレーションに対応すれば秘密の長期保管を減らせます。アプリの構成値の保管と Vault の運用手順は別に記録します。"},
    integration: {label:"VNet 統合",sub:"送信専用・委任サブネット",x:284,y:305,w:197,h:60,
      use:"App Service のリージョン VNet 統合で、VNet への送信を可能にします。統合用サブネットは Microsoft.Web/serverFarms に委任します。",
      reason:"App Service の業務画面の入口を保ちつつ、DB と Vault のプライベート接続を作れます。AZ-01、AZ-03",
      verify:"アプリ・検証スロット・ジョブから DNS と TCP を試験し、各スロットのネットワーク構成を確認します。",
      alternative:"私設の入口が必要な場合は受信用 Private Endpoint を追加します。統合用と Private Endpoint 用のサブネットは分けます。"},
    endpoints: {label:"Private Endpoint",sub:"SQL と Vault の個別 NIC",x:507,y:305,w:194,h:60,
      use:"VNet 内の別サブネットに Azure SQL と Key Vault の各 Private Endpoint を作り、接続を承認します。",
      reason:"DB と Vault へのデータ通信をプライベート経路に限定します。SQL の Public network access は明示的に無効化します。AZ-04",
      verify:"FQDN が内部 IP へ解決すること、内部からの接続成功と外部からの拒否、SQL の利用者権限を別々に確認します。",
      alternative:"一時的な最小構成でも公開接続を使うならデータ分類と許可条件の承認が必要です。この案件の本番は Private Endpoint とします。"},
    dns: {label:"Private DNS",sub:"ゾーンを VNet にリンク",x:729,y:430,w:172,h:62,
      use:"privatelink.database.windows.net と privatelink.vaultcore.azure.net を VNet にリンクします。App は通常のサービス FQDN を使います。",
      reason:"SQL 接続文字列のホストは server.database.windows.net で、名前解決結果が Private Endpoint の IP になります。AZ-04、AZ-05",
      verify:"本番相当の実行位置で名前解決結果を記録します。カスタム DNS ならフォワードと解決先を確認します。",
      alternative:"既存ハブ DNS や Azure DNS Private Resolver を使う案は、名前解決の所有者や既存の連携を確認して判断します。"},
    migration: {label:"DB 移行ジョブ",sub:"VNet 内 / 配備用とは別 ID",x:729,y:305,w:172,h:60,
      use:"VNet にアクセスできる承認済みランナーまたはジョブから、配備後に必要な SQL 移行を一度だけ実行します。",
      reason:"GitHub の Azure OIDC と DB ネットワークを分離し、スキーマ変更の権限を実行アプリと分けます。",
      verify:"同じ移行が二度適用されないこと、失敗時の記録、前版アプリとの互換性を検証。",
      alternative:"自動移行を導入する前は、同じ VNet 内の承認された作業環境でレビュー済みの変更を実行できます。"},
    sql: {label:"Azure SQL Database",sub:"公開接続なし / Entra ID",x:507,y:430,w:194,h:62,
      use:"Azure SQL の General Purpose を見積の出発点にします。問い合わせ、担当、行の版、業務監査を永続化し、アプリ ID と DB 移行 ID に別ロールを割り当てます。",
      reason:"REQ-005 の状態変更と監査を同一トランザクションで管理します。アプリから DB への TCP/TLS と DB 認可を両方満たします。AZ-04、AZ-19",
      verify:"接続、T-005、バックアップからの時点復元、役割別のアクセス、NFR-001 の負荷計測を検証します。",
      alternative:"既存 DB 基盤を使う候補は運用責任、Entra 対応、トランザクション、バックアップ仕様を比較します。"},
    monitor: {label:"Azure Monitor",sub:"App Insights / Log Analytics",x:20,y:430,w:205,h:62,
      use:"App Insights の要求・依存先・例外のテレメトリを Log Analytics ワークスペースで参照し、Monitor のアラートを運用当番に送ります。",
      reason:"エラー増加、SQL の応答低下、夜間取込停止を API・DB・ジョブの記録から切り分けます。業務監査は DB で別管理します。AZ-13、AZ-14",
      verify:"アラートの発報と到着をリハーサルし、本文・トークン・認証ヘッダーがログに入らないことを確認します。",
      alternative:"既存の監視基盤へ OpenTelemetry を送る案では、保持、運用担当、コストの違いを確認します。"},
    external: {label:"既存の社員マスター",sub:"承認済み HTTPS API / 読取",x:20,y:294,w:205,h:62,
      use:"ジョブは既存マスターを読取専用で利用します。SLA、認証、データ項目、固定送信元の要否を連携先運用者と確認します。",
      reason:"利用者管理の元データを一つにし、手修正との差分や取り込み失敗を追えるようにします。",
      verify:"接続元許可、タイムアウト、再試行、重複キー、件数異常、既存の最終成功データを使い続ける挙動を検証します。",
      alternative:"送信元の固定が必要なら VNet 経由の送信と NAT Gateway などを検証します。社内専用 API なら VPN／既存網と DNS を先に合意します。"},
  };
  const routes = [
    {id:"access", title:"利用者のアクセス", nodes:["browser","entra","app"],
      text:"社員のブラウザー → 公開 HTTPS → App Service → Entra ID で認証 → 業務権限を確認。App Service の公開 HTTPS と、アプリへの入場権限は別の設計項目です。"},
    {id:"database", title:"DB と秘密への接続",nodes:["app","integration","endpoints","dns","sql","vault"],
      text:"アプリ → VNet 統合 → 名前解決 → 各 Private Endpoint → SQL／Vault。名前解決の成功、プライベート経路、サービス内の認可を個別に試験します。"},
    {id:"nightly",title:"夜間の社員取込",nodes:["jobs","external","integration","endpoints","dns","sql","vault","monitor"],
      text:"ジョブ → 承認済み既存 API → 取込件数・重複チェック → DB で確定 → 監視。接続元要件と認証は相手先の承認を得ます。"},
    {id:"deploy",title:"配備と監視",nodes:["actions","app","monitor","migration","endpoints","sql"],
      text:"GitHub Actions → Azure OIDC → 検証・承認・本番配備。VNet 内の移行ジョブは別 ID で実行します。App Service とジョブの監視は Log Analytics で照合します。"},
  ];
  const paths = [
    ["access","M196 72H286"],["access","M108 102V154"],["access","M196 184H233V94H286"],
    ["database","M286 79H251V335H284"],["database nightly","M481 335H507"],["database nightly deploy","M604 365V430"],
    ["database nightly","M391 365V407H815V430","dash"],["database nightly","M694 324H716V183H712"],
    ["nightly","M286 186H248V322H225"],["nightly","M393 214V305"],
    ["deploy","M712 72H496"],["deploy nightly","M287 207H239V461H225","dash"],
    ["deploy","M817 102V124H934V335H901","dash"],["deploy","M729 347H701"],
  ];
  const environments = [
    ["開発", "ローカル .NET、SQL Server の検証環境", "架空データ。再現手順・DB マイグレーション・CI 単体結合試験を共有"],
    ["検証", "別リソースグループ、別 App Service／SQL／Vault、別 Entra アプリ登録", "10,000件の架空データ、テスト用ユーザー。Public network access と DNS の試験も本番相当"],
    ["本番", "承認された本番サブスクリプション、専用 Azure SQL／Vault、承認付き配備", "本番データと資格情報。スロットは公開前の温めと配備確認に使用。検証環境とは分離し、検証用 URL を公開しない"],
  ];
  const checks = [
    ["NET-01", "公開範囲と名前解決", "HTTPS 入口の認証、DB の公開接続無効、通常の SQL FQDN の内部解決を各実行位置で確認", "インフラ担当"],
    ["SEC-01", "認証・認可と資格情報 · T-001、T-009", "申請者・窓口担当・管理者を試し、他人のデータへの許可外操作は拒否。秘密がログやバックアップ資料に出ない", "実装担当、PL"],
    ["PERF-01", "性能 NFR-001 · T-008", "30人相当、10,000件、一覧・詳細が80%の負荷を15分実行。操作別の応答 p95 が 1.5秒以内。エラー率と計測条件を記録", "実装担当"],
    ["DR-01", "復旧 NFR-003 · T-010", "時点復元を新規 DB に行い、データ時点差と想定障害から業務再開までを測る。RPO 1時間、RTO 4時間。ゾーン・地域障害は別途合意", "インフラ担当、顧客運用"],
    ["OBS-01", "監視と運用 NFR-002 · T-007、T-009", "5xx、依存先遅延、翌朝の取込未完了、復旧の監視が当番に通知され、担当と判断時刻を追える", "顧客運用、PL"],
    ["REL-01", "配備と切り戻し", "同じ成果物 ID、承認・移行・スロット設定、旧版の DB 互換性、復元判断をリハーサルで確認", "PL、インフラ担当"],
  ];
  const ops = [
    ["アプリ障害", "ヘルスチェックとエラー率・遅延を監視。可能な規模を負荷試験で確認し、本番は2インスタンスを見積前提にする。地域・プランのゾーン対応は契約時に確認。", "運用担当が一次対応、PL が顧客へ状況・次の報告時刻を連絡"],
    ["DB 障害・誤更新", "自動バックアップの保持14日を想定。PITR は別名 DB に復元し、突合・接続先切替・更新再開の順を計測。アプリの切り戻しと DB の復元は別判断。", "DB 担当が検証、顧客運用責任者が復元時点・失う更新を承認"],
    ["地域障害", "単一リージョン案では、アプリまたはデータの単独障害を初回の RPO/RTO の対象とする。ゾーン・地域障害を含める場合は、ゾーン冗長、復元先の構成、geo-restore またはフェールオーバー構成と実測、費用を再検討。", "顧客責任者と PL が対象障害・予算を合意"],
    ["監視とログ", "5xx 増加と p95 悪化を直近15分で確認。02:00 の取込成功が 03:00 JST までに無ければ通知。相関 ID・件数・HTTP 状態を記録し、本文とトークンは記録しない。", "運用当番、アプリ担当、連携先担当"],
    ["費用", "App Service plan のサイズと台数、SQL の層とバックアップ、Private Endpoint、Log Analytics の取込・保持、検証環境、通信費を積み上げる。初回はログ保持30日を仮定し、料金は SKU・地域と見積当日に確認。", "PL が構成と稼働条件を見積記録に残し、月次で予算アラートを確認"],
  ];
  const services = {
    app:{name:"Azure App Service", advantage:"ASP.NET Core の画面・API と配備スロットを一体で運用しやすい。", caveat:"ホスティングプランと常時容量が費用に効き、ジョブの負荷が同居する。"},
    functions:{name:"Azure Functions", advantage:"タイマー・キュー等のトリガーを起点に処理を分離しやすい。", caveat:"プランによりネットワーク・スケール・待機時の特性が違う。Web UI は別に設計する。"},
    containers:{name:"Azure Container Apps", advantage:"コンテナ、リビジョン、HTTP／イベントの別スケーリングや Jobs が使える。",caveat:"イメージ管理、Ingress、プライベート経路、レプリカの設定・監視を追加で設計する。"},
  };
  const cases = {
    inquiry:{name:"本案件の画面と API", context:"3名・3か月。既存の ASP.NET Core と運用手順を使い、30人同時でも画面が応答できる状態を維持します。Web UI、認証、ロール分離、Private SQL、夜間取込を要件にします。",
      appraisal:{app:"既存の運用経験と一体の UI／API を優先する設計に合います。夜間処理が日中のアプリに影響しないかを計測します。",functions:"イベント処理に絞った採用には説明がつきます。Web UI・セッション・配備経路を別に持つ場合の増える作業を見積もります。",containers:"既存のコンテナ運用があり、独立配備が必要なら候補です。初回の3名・3か月にイメージと ingress の運用工数を含めます。"},
      model:"画面/APIは App Service。夜間取込を WebJob で開始し、取込時間やエラー率が閾値を越えたらワーカー分離を再見積します。"},
    batch:{name:"独立した夜間取込", context:"連携が成長し、Web と別リリースが必要になりました。1日1回の取込、再実行と冪等性、既存 API と Private SQL の接続が必要です。",
      appraisal:{app:"既存 plan の余力を使えます。別リリース要件には WebJob の独立した配備手順と容量の分離策を示します。",functions:"タイマートリガーが合います。選んだプランの VNet 統合、想定実行時間、ロック・再試行・監視を確かめます。",containers:"バッチがすでにコンテナ化されていれば Jobs が候補です。実行結果と再試行、スケジュールの UTC、通信経路を検証します。"},
      model:"既存コンテナが無ければ、VNet 統合対応の Functions を検証候補にする。Private SQL 到達、再実行での重複防止、監視が通れば決定する。"},
    container:{name:"既存コンテナ基盤から配備", context:"既存基盤がコンテナを管理し、UI とワーカーの別々のスケールが必要です。負荷が低い時間の費用と初回要求の遅延を確認します。",
      appraisal:{app:"マネージドな Web に既存コンテナを配置できます。ワーカーの独立容量や段階的配備の費用も含めます。",functions:"新しい処理をトリガーに切り出せます。既存 Web コンテナの配備と監視をどこに持つかも設計します。",containers:"既存イメージ運用と独立スケールを活用できます。最低レプリカ数、負荷の少ない時間の費用、変更時の切替試験を検討します。"},
      model:"既存 Container Apps 環境を使い、画面/API とジョブを別にする。画面の最低レプリカ、接続制約とダイジェストによるロールバックを試験する。"},
  };
  const criteria = {
    ingress:"入口・DNS・DB の経路", identity:"認証・認可と実行 ID", operations:"監視・障害復旧・運用担当",
    cost:"負荷見積・プラン・費用", delivery:"配備・再試行・切り戻し",
  };
  const review = [
    ["network","VNet 統合だけで App Service の入口を非公開にできる","VNet 統合は送信機能です。公開 HTTPS と Entra 認証を採用するか、受信用 Private Endpoint と利用者ネットワークを別に設計します。"],
    ["sql","Private Endpoint を作れば SQL の公開接続と DNS は自動で適切になる","公開接続を明示的に無効にし、Private DNS ゾーンをリンクして通常の FQDN が内部 IP に解決することを確認します。"],
    ["oidc","GitHub OIDC で Azure にサインインできれば、その runner から Private SQL へ移行できる","OIDC は Azure の認証です。VNet 内の移行ジョブ、別のデータ権限、排他、実行記録が必要です。"],
    ["restore","バックアップを有効にすれば RTO 4時間を満たせる","復元先の用意、突合、接続先変更、業務確認まで実測します。地域障害の対象範囲も顧客と確認します。"],
    ["insights","アプリと夜間取込の失敗で担当に通知し、相関 ID で調べる","この判断は妥当です。ログ自体に本文・トークンを記録しない条件と保持期間を加えます。"],
  ];

  const rawSource = path => "https://raw.githubusercontent.com/MicrosoftDocs/" + path;
  const sourceLine = ([id, title, url, path, scope]) =>
    "- " + id + " " + title + "。確認内容は " + scope + "。[" + title + "](" + url + ") · [公式原稿](" + rawSource(path) + ")";
  const mdTable = (head, records) => [
    "| " + head.join(" | ") + " |",
    "| " + head.map(() => "---").join(" | ") + " |",
    ...records.map(row => "| " + row.map(value => String(value).replaceAll("|", "\\|")).join(" | ") + " |"),
  ].join("\n");
  const overview = [
    "期間は 2026-12-01〜2027-02-26。初回公開は部署内の問い合わせ管理で、社員は社外拠点の社用端末からも HTTPS に到達でき、単一テナントの認証と業務ロールを満たした場合のみアプリを使える。運用の対象はアプリ、DB、夜間取込。例の負荷・保持期間・復旧目標・台数は顧客合意前提の教材値。",
    "ブラウザー → App Service（公開の HTTPS 入口）→ Entra ID（認証）",
    "App Service → リージョン VNet 統合（送信）→ Private Endpoint → Azure SQL／Key Vault",
    "GitHub Actions → Azure OIDC → 検証成果物 → 本番スロット。DB 移行は VNet 内の承認済みジョブ。",
    "WebJob → 既存社員マスターの承認済み HTTPS API（読取）→ 取込の検証・確定 → 監視。",
  ];
  const deployment = [
    "PR で単体・結合・権限の試験を実施。ビルドした成果物のコミット ID とハッシュを登録し、別環境で同じ成果物を試験する。",
    "本番は GitHub 環境で対象ブランチ・承認者・OIDC の対象を制限する。業務アプリ、デプロイ用、DB 移行用にそれぞれ専用 ID を割り当てる。",
    "スロットのホスト、アクセス制限、Entra のリダイレクト URI、ユーザー割り当て ID／権限、ネットワーク、環境固有の値を確認する。旧アプリと互換のある DB 変更を分離し、同時適用を防ぐ。",
    "非本番スロットは WEBJOBS_STOPPED=1 をスロット設定にする。本番の取込だけを有効にする。温めと読み取り中心の確認後にスワップし、ログとスモーク試験を確認。",
    "本番配備記録に成果物 ID・設定・移行結果・確認者を残す。旧版と DB の互換性を確かめてからアプリを切り戻す。データ復元は業務責任者が失う更新を確認して判断する。",
  ];
  const designText = [
    "# インフラ設計書｜社内問い合わせ管理システム", "", "## 設計の前提", "", ...overview.map(line => "- " + line), "",
    "## 環境分離", "", mdTable(["環境","構成","使うデータ・確認"], environments), "",
    "## 構成要素と役割", "",
    mdTable(["要素","設定・使い方","採用理由","検証","代替案"],
      Object.values(resources).map(item => [item.label,item.use,item.reason,item.verify,item.alternative])), "",
    "## CI/CD と切り戻し", "", ...deployment.map((line,index) => (index+1)+". "+line), "",
    "## 運用、復旧、費用", "", mdTable(["観点","運用方針","責任"], ops), "",
    "## 検証と担当", "", mdTable(["ID", "観点", "受入の目安", "担当"], checks), "",
    "## 配備先の技術選定", "", mdTable(["方式", "適合する点","運用上の負担"],Object.values(services).map(item=>[item.name,item.advantage,item.caveat])), "",
    "利用条件の例。"+cases.inquiry.model, "",
    "## 仕様の参照", "", "Microsoft Learn の公式原稿で確認。確認日 "+checked+"（UTC）。", "",
    ...sources.map(sourceLine), "",
  ].join("\n");
  lab.data.azureSources = sources;
  lab.data.infrastructureMarkdown = designText;

  function validAnswers(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Azure 演習の保存形式を確認してください。");
    const selected = value.scenario ?? "inquiry";
    const platform = value.service ?? "app";
    if (typeof selected !== "string" || typeof platform !== "string" || !Object.hasOwn(cases, selected) || !Object.hasOwn(services, platform)) throw new Error("Azure 演習の選択肢が不正です。");
    function sentence(key) {
      const s = value[key] ?? "";
      if (typeof s !== "string" || s.length > 2000) throw new Error("Azure 演習は1欄2000文字までです。");
      return s;
    }
    function selection(key, ids) {
      const list = value[key] ?? [];
      if (!Array.isArray(list) || list.length > ids.length || list.some(key => !ids.includes(key))) throw new Error("Azure 演習のチェック項目が不正です。");
      return [...new Set(list)];
    }
    return {
      scenario:selected, service:platform, reason:sentence("reason"), tradeoff:sentence("tradeoff"),
      test:sentence("test"), revised:sentence("revised"),
      criteria:selection("criteria",Object.keys(criteria)), review:selection("review",review.map(item=>item[0])),
    };
  }
  lab.validators["05"] = validAnswers;

  function renderDiagram(ctx) {
    const {el} = ctx;
    const svgNS = "http://www.w3.org/2000/svg";
    function svgNode(tag, attrs, content) {
      const node = document.createElementNS(svgNS,tag);
      for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
      if (content) node.textContent = content;
      return node;
    }
    const selectedRouteButtons = new Map();
    const desktopNodes = new Map();
    const mobileButtons = new Map();
    const edges = [];
    const info = el("div",{class:"azlab-node-info callout","aria-live":"polite"});
    const routeText = el("p",{class:"azlab-route-note","aria-live":"polite"});
    const visual = svgNode("svg",{viewBox:"0 0 945 519",role:"group","aria-labelledby":"azlab-diagram-title azlab-diagram-description"});
    visual.append(
      svgNode("title",{id:"azlab-diagram-title"},"問い合わせ管理の Azure 構成図"),
      svgNode("desc",{id:"azlab-diagram-description"},"App Service の公開入口と VNet への送信、SQL と Key Vault への非公開接続を示します。要素を選択すると採用理由を表示します。"),
    );
    const defs = svgNode("defs",{});
    const arrow = svgNode("marker",{id:"azlab-arrow",markerWidth:9,markerHeight:9,refX:7,refY:4.5,orient:"auto-start-reverse"});
    arrow.append(svgNode("path",{d:"M0 0 L8 4.5 L0 9 Z",class:"azlab-arrow-tip"}));
    defs.append(arrow);
    visual.append(defs);
    visual.append(
      svgNode("rect",{x:265,y:253,width:654,height:145,rx:14,class:"azlab-vnet"}),
      svgNode("text",{x:285,y:279,class:"azlab-vnet-label"},"Azure Virtual Network · 同一リージョン"),
      svgNode("text",{x:285,y:384,class:"azlab-boundary-label"},"VNet 統合用と Private Endpoint 用のサブネットを分ける"),
    );
    for (const [applies,d,kind] of paths) {
      const line = svgNode("path",{d,class:"azlab-edge","marker-end":"url(#azlab-arrow)"});
      if (kind) line.classList.add(kind);
      edges.push([applies.split(" "),line]);
      visual.append(line);
    }
    const nodes = el("div",{class:"azlab-resource-buttons","aria-label":"構成要素"});
    for (const [id,item] of Object.entries(resources)) {
      const group = svgNode("g",{role:"button",tabindex:"0","aria-label":item.label,"aria-pressed":"false",class:"azlab-resource",
        transform:"translate(" + item.x + " " + item.y + ")"});
      group.append(
        svgNode("rect",{width:item.w,height:item.h,rx:8}),
        svgNode("text",{x:12,y:24,class:"azlab-svg-title"},item.label),
        svgNode("text",{x:12,y:43,class:"azlab-svg-sub"},item.sub),
      );
      group.addEventListener("click",()=>selectNode(id));
      group.addEventListener("keydown",event=>{
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode(id);
        }
      });
      desktopNodes.set(id,group);
      visual.append(group);
      const button = el("button",{type:"button",class:"button secondary","aria-pressed":"false",onClick:()=>selectNode(id)},item.label);
      mobileButtons.set(id,button);
      nodes.append(button);
    }

    function selectNode(id) {
      const item = resources[id];
      for (const group of [desktopNodes,mobileButtons]) for (const [nodeId,node] of group) {
        node.setAttribute("aria-pressed",String(id === nodeId));
      }
      const description = el("dl",{class:"azlab-node-points"},
        el("dt",{},"採用理由"),el("dd",{},item.reason),el("dt",{},"検証"),el("dd",{},item.verify),el("dt",{},"代替案"),el("dd",{},item.alternative));
      info.replaceChildren(el("h4",{},item.label),el("p",{},item.use),description);
    }

    function selectRoute(route) {
      for (const [id,button] of selectedRouteButtons) button.setAttribute("aria-pressed",String(id===route.id));
      for (const [applies,edge] of edges) edge.classList.toggle("active",applies.includes(route.id));
      for (const [key,node] of desktopNodes) node.classList.toggle("active",route.nodes.includes(key));
      routeText.textContent = route.text;
      selectNode(route.nodes[0]);
    }

    const routeButtons = el("div",{class:"azlab-route-buttons actions","aria-label":"通信の流れ"});
    for (const route of routes) {
      const button = el("button",{type:"button",class:"button secondary",onClick:()=>selectRoute(route)},route.title);
      selectedRouteButtons.set(route.id,button);
      routeButtons.append(button);
    }
    selectRoute(routes[0]);

    return el("section",{class:"panel azlab-architecture"},
      el("h3",{},"Azure 構成図"),
      el("p",{class:"muted"},"通信の流れを切り替え、構成要素を選ぶと採用理由と代替案が読めます。点線は名前解決・テレメトリ・操作の指示を示します。"),
      routeButtons,routeText,
      el("p",{class:"azlab-scroll-hint muted"},"図は左右にスクロールできます。"),
      el("div",{class:"azlab-diagram-scroll",tabindex:"0","aria-label":"構成図を横にスクロール"},visual),
      nodes,info);
  }

  function renderSample(ctx) {
    const {el,table} = ctx;
    const procedure = el("ol",{class:"azlab-procedure"},...deployment.map(line=>el("li",{},line)));
    const appendix = el("details",{class:"azlab-expand"},
      el("summary",{},"20件の Azure 公式資料と確認日"),
      el("p",{class:"muted"},"確認日 "+checked+"（UTC）。Microsoft Learn の公式原稿を確認しました。リンク先の閲覧にはインターネット接続が必要です。"),
      el("ul",{class:"azlab-sources"},...sources.map(([id,title,url,path,scope])=>
        el("li",{},el("a",{href:url,target:"_blank",rel:"noreferrer"},id+" "+title), " · "+scope+" ",
          el("a",{href:rawSource(path),target:"_blank",rel:"noreferrer"},"公式原稿")))));
    return el("section",{class:"panel azlab-sample"},
      el("div",{class:"azlab-row"},el("h3",{},"記入済みインフラ設計書"),
        el("button",{type:"button",class:"button secondary",onClick:()=>ctx.download("infrastructure-design.md",designText,"text/markdown;charset=utf-8")},"Markdown を保存")),
      el("p",{class:"muted"},"台数、保持期間、測定条件は案件の例です。採用するリージョン、サービス階層、費用はプロジェクトで確認します。"),
      el("details",{class:"azlab-expand",open:true},el("summary",{},"環境分離と運用責任"),
        table(["環境","構成","使うデータ・確認"],environments,"環境ごとの境界"),
        table(["観点","運用方針","責任"],ops,"運用と費用の設計")),
      el("details",{class:"azlab-expand"},el("summary",{},"CI/CD と切り戻し"),procedure),
      el("details",{class:"azlab-expand"},el("summary",{},"技術要件と試験の対応"),
        table(["ID","観点","受入の目安","担当"],checks,"受入試験の追跡")),
      el("details",{class:"azlab-expand"},el("summary",{},"3サービスの使い分け"),
        table(["方式","適合する点","検討する負担"],Object.values(services).map(s=>[s.name,s.advantage,s.caveat]),"条件に応じた技術選定")),
      appendix);
  }

  function renderExercise(ctx) {
    const {el} = ctx;
    const state = validAnswers(ctx.state.answers[ctx.id] ?? {});
    const status = el("div",{class:"azlab-feedback","aria-live":"polite"});
    const reviewFeedback = el("div",{"aria-live":"polite",class:"azlab-feedback"});
    const model = el("details",{class:"azlab-expand",hidden:true},el("summary",{},"模範案と比較する"));
    const modelText = el("p",{});
    model.append(modelText);
    const scenarioText = el("p",{class:"callout"});
    const scenario = el("select",{},...Object.entries(cases).map(([id,item])=>el("option",{value:id},item.name)));
    const platform = el("select",{},...Object.entries(services).map(([id,item])=>el("option",{value:id},item.name)));
    scenario.value = state.scenario;
    platform.value = state.service;
    scenarioText.textContent = cases[state.scenario].context;
    function save() {
      ctx.state.answers[ctx.id] = state;
      ctx.save();
    }
    function refresh() {
      status.replaceChildren();
      model.hidden = true;
      model.open = false;
    }
    scenario.addEventListener("change",()=>{
      state.scenario = scenario.value;
      scenarioText.textContent = cases[state.scenario].context;
      refresh();
      save();
    });
    platform.addEventListener("change",()=>{
      state.service = platform.value;
      refresh();
      save();
    });
    function field(key,label,placeholder) {
      const area = el("textarea",{maxlength:2000,rows:3,placeholder});
      area.value = state[key];
      area.addEventListener("input",()=>{
        state[key] = area.value;
        save();
      });
      return el("label",{class:"azlab-field"},label,area);
    }
    function checklist(key,entries,legend) {
      return el("fieldset",{class:"azlab-checklist"},el("legend",{},legend),
        ...entries.map(([id,label])=>{
          const input = el("input",{type:"checkbox",checked:state[key].includes(id)});
          input.addEventListener("change",()=>{
            state[key] = input.checked ? [...state[key],id] : state[key].filter(item=>item !== id);
            save();
          });
          return el("label",{},input,el("span",{},label));
        }));
    }

    function conditionFeedback() {
      const currentCase = cases[state.scenario];
      const missing = [];
      if (!state.reason.trim()) missing.push("案件の制約を一つ根拠にした採用理由");
      if (!state.tradeoff.trim()) missing.push("採る案の負担と対策");
      if (!state.test.trim()) missing.push("比較・検証して採用を決める条件");
      if (state.criteria.length < 2) missing.push("重視する観点を2つ以上");
      status.replaceChildren(el("div",{class:"callout "+(missing.length ? "callout-warning" : "callout-success")},
        el("h4",{},"選択した案の評価｜"+services[state.service].name),
        el("p",{},currentCase.appraisal[state.service]),
        el("p",{class:"muted"},missing.length ? "追記する項目｜"+missing.join("、") : "比較に必要な欄がそろいました。模範案を開き、残った弱点を見つけて判断を修正しましょう。")));
      if (!missing.length) {
        modelText.textContent = currentCase.model;
        model.hidden = false;
      }
      return !missing.length;
    }
    function reviewDesign() {
      const selected = new Set(state.review);
      reviewFeedback.replaceChildren(el("div",{class:"callout"},
        el("h4",{},"構成レビューの見方"),
        el("ul",{},...review.map(([id,example,detail],index)=>
          el("li",{},el("strong",{},index===4 ? (selected.has(id) ? "この記述は維持できます。" : "維持する記述です。") :
            (selected.has(id) ? "指摘できています。" : "見直す候補です。"))," "+detail)))));
    }
    function finish() {
      const ready = conditionFeedback();
      if (!ready || !state.revised.trim()) {
        if (ready) status.append(el("p",{class:"callout callout-warning"},"比較後に変えた判断を記録してください。"));
        return;
      }
      const text = [
        "# Azure 構成の設計判断", "",
        "- 対象事例 "+cases[state.scenario].name,
        "- 選定 "+services[state.service].name,
        "- 観点 "+state.criteria.map(key=>criteria[key]).join("、"),"",
        "## 採用理由","",state.reason,"","## トレードオフと対策","",state.tradeoff,"",
        "## 検証","",state.test,"","## 比較後の修正","",state.revised,"",
        "## 指摘した設計レビュー項目","",...review.filter(item=>state.review.includes(item[0])).map(item=>"- "+item[1]),"",
      ].join("\n");
      ctx.recordArtifact("Azure 構成の設計判断",text);
      ctx.complete();
      status.append(el("p",{class:"callout callout-success"},"設計判断を成果物に保存しました。"));
    }

    return el("section",{class:"panel azlab-exercise"},
      el("h3",{},"サービスの選定理由を残す"),
      el("p",{class:"muted"},"入力欄と観点の選択をチェックし、想定案件に対する適合性と弱点を表示します。"),
      el("div",{class:"azlab-selectors"},el("label",{class:"azlab-field"},"判断する案件",scenario),el("label",{class:"azlab-field"},"選定候補",platform)),
      scenarioText,
      checklist("criteria",Object.entries(criteria),"今回重視する観点"),
      field("reason","案件の条件を踏まえた採用理由","例　既存の .NET 運用と小さなチームで、画面と API を一体で提供する。"),
      field("tradeoff","残る負担と対策","例　WebJob の負荷が影響するため、処理時間を計測して分離条件を決める。"),
      field("test","採用前に試すこと","例　選択プランで SQL の名前解決・疎通とトークン取得を検証する。"),
      el("div",{class:"actions"},el("button",{type:"button",class:"button secondary",onClick:conditionFeedback},"判断を確認する")),
      status,model,
      el("details",{class:"azlab-expand"},el("summary",{},"構成レビュー｜修正すべき記述を選ぶ"),
        checklist("review",review.map(([id,text])=>[id,text]),"配備前レビューの記述"),
        el("button",{type:"button",class:"button secondary",onClick:reviewDesign},"レビュー結果を確認する"),reviewFeedback),
      field("revised","比較後に修正した判断","例　公開前にステージングからの DNS と復元を実測する条件を追加した。"),
      el("div",{class:"actions"},el("button",{type:"button",class:"button primary",onClick:finish},"成果物を保存して完了する")));
  }

  lab.chapters["05"] = function(ctx) {
    const {el} = ctx;
    ctx.root.append(el("div",{class:"azlab stack"},
      el("section",{class:"panel azlab-intro"},
        el("h3",{},"通信経路・権限・復旧を公開前に決める"),
        el("p",{},"インフラ設計は、どの経路で届き、誰が使え、止まったとき誰が復旧するかを決める工程です。同じ Web アプリを実行できるサービスでも、ネットワーク要件や運用工数によって選択は変わります。"),
        el("p",{class:"callout"},"接続元と名前解決の設計が抜けると、検証では動いても本番で DB へ届かないことがあります。監視と復旧を決めておくと、切り分けと報告の担当も明確になります。")),
      el("details",{class:"panel azlab-glossary"},
        el("summary",{},"この章の用語"),
        el("dl",{class:"azlab-node-points"},
          el("dt",{},"VNet 統合"),el("dd",{},"App Service から仮想ネットワークへの送信経路を作る機能。"),
          el("dt",{},"Private Endpoint"),el("dd",{},"対象サービスにプライベート IP で到達するインターフェイス。名前解決の設定も必要。"),
          el("dt",{},"OIDC"),el("dd",{},"ID 基盤から得たトークンに基づいて、アプリが利用者や配備ジョブの ID を確かめる仕組み。"),
          el("dt",{},"マネージド ID"),el("dd",{},"Azure 上のアプリやジョブに与える ID。保護先の権限と組み合わせて接続する。"),
          el("dt",{},"RPO / RTO"),el("dd",{},"許容するデータ損失の時間差と、業務再開までに許容する時間。"))),
      renderDiagram(ctx),renderSample(ctx),renderExercise(ctx)));
  };
})();
