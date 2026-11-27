(() => {
  "use strict";

  const lab = globalThis.PLLab;
  const MAX_NOTE = 2400;
  const REGISTER_LIMIT = 40;
  const kinds = {
    risks: { title: "リスク管理表", prefix: "RSK", context: "起こりうる原因と影響", response: "予防策と発生時の対応" },
    issues: { title: "課題管理表", prefix: "ISS", context: "発生した事実と影響", response: "暫定対応・解決条件" },
    changes: { title: "変更管理表", prefix: "CHG", context: "変更理由と範囲・工数・納期への影響", response: "判断結果と更新する資料" },
  };
  const statusLabels = { open: "未対応", working: "対応中", done: "完了" };
  const levelLabels = { high: "高", medium: "中", low: "低" };
  const decisionLabels = { pending: "審議中", approved: "承認", deferred: "延期", rejected: "却下" };

  const events = [
    {
      id: "export-request", title: "顧客から集計用のExcel出力を求められた", date: "2026-12-15", type: "仕様変更",
      signal: "部門長が「月報に必要なので検索結果をExcelで出したい」と依頼しました。現行の初回範囲には一括出力がありません。",
      cause: "月報業務と閲覧権限の境界を要求整理の時点で確認し切れておらず、公開対象とのすり合わせが必要です。",
      impact: "REQ-002 の閲覧範囲、個人情報、操作ログ、出力時の負荷、テスト、工数とリリース判定に影響します。",
      choices: [
        ["次回候補として受け付け、現行範囲を維持する", "確定した受入条件と納期を守りやすい", "月報作業が残る。代替手段と次回判断日が必要", "顧客責任者が月報の代替方法を使え、初回公開の目的を満たせる場合"],
        ["必須性を確認し、別機能と入れ替える", "顧客の優先度を初回範囲に反映できる", "外す機能の利用者にも再確認が必要。入れ替え前後の工数を見直す", "権限・件数・保存先を定義でき、対象外にする作業に合意が取れる場合"],
        ["短い調査を追加して、判断日を決める", "利用者と用途が不明なままの実装を防げる", "判断待ちに担当と上限を決めないと開発が止まる", "既存データや担当者を確認でき、調査中も確定済みの機能を進められる場合"],
      ],
      prompt: "月報の提出日と対象データを誰に確認しますか。承認前後で要件ID、工数、テストをどう扱いますか。",
      example: "顧客責任者へ用途・件数・閲覧範囲を確認し、変更 CHG-01 を起票。12/18 に影響見積と代替案を提示。承認までは REQ-002 の一括出力なしの範囲で進める。",
    },
    {
      id: "late-review", title: "画面設計の承認が1週間ずれた", date: "2027-01-08", type: "顧客待ち",
      signal: "業務責任者のレビュー枠が5営業日後に変更になりました。画面設計を前提とするフォーム実装も同じ週に予定されています。",
      cause: "承認者と代行者の予定が合わず、画面設計の完了と承認が同じタスクとして計画されていました。",
      impact: "SCR-03 の項目や入力条件が未確定です。フォーム実装、結合テスト、予備日、顧客の受入枠を見直します。",
      choices: [
        ["確認待ちを明示し、確定部分を先行する", "認証や共通レイアウトを進めながら手戻りを抑えられる", "承認済みの範囲を明示しないと作り直しが発生する", "先行可能な作業と、承認を待つ部品を切り分けられる場合"],
        ["代行承認と短い論点レビューを相談する", "論点を絞れば依存タスクの開始を守れる可能性がある", "代理者の決裁範囲と後日の確認責任が必要", "顧客側で代行者と決裁手順を確認できる場合"],
        ["後続と納期を再計画する", "承認の不確実性を実態どおりに扱える", "受入枠、他の案件、人員への影響を合意する必要がある", "先行できる作業が少なく、予備日でも吸収できない場合"],
      ],
      prompt: "レビュー待ちタスクの開始・終了と、依存している作業をどう置き直しますか。",
      example: "PL が1/8に業務責任者へ代理確認の可否を照会。難しければ承認待ちを5営業日のタスクにし、SCR-03 の実装開始を調整する。受入枠への影響は顧客責任者へ同日共有。",
    },
    {
      id: "capacity-loss", title: "実装メンバーが5営業日離脱した", date: "2027-01-18", type: "人員・稼働",
      signal: "1/18〜1/22 に開発メンバー1人が作業できません。問い合わせ一覧や連携の実装とレビューが重なっています。",
      cause: "担当の作業知識が集中し、代替作業や引き継ぎ時間が把握されていませんでした。",
      impact: "欠員期間の予定工数を残り日に入れられるか、他メンバーへ割り当てた際のレビュー負荷、依存する結合テストの日程を確認します。",
      choices: [
        ["作業順と担当を見直し、引き継げるところから進める", "要件や基本設計を使って一部を並行できる", "引き継ぎ時間とレビュー負荷が追加される", "必要な権限と資料があり、代替担当に空きがある場合"],
        ["開始日を後ろ倒しし、リリース範囲・予備日を見直す", "品質と作業の連続性を守りやすい", "予備日の消費、受入枠や納期への影響が出る", "依存関係と残る予備日を提示し、PL と顧客が承認できる場合"],
        ["人員追加の可否を評価して判断を保留する", "専門性や対策の候補を比較できる", "受け入れ・環境準備に工数がかかり、依存作業は並行化できない", "数日以内に環境を使える候補があり、割り当て可能な独立作業がある場合"],
      ],
      prompt: "実際の稼働率をガントで確認し、再割当か日程変更に必要な条件を説明してください。",
      example: "開発担当の1/18〜1/22を非稼働に設定。残り日の負荷から一覧レビューをPLへ移せるか確認し、結合試験の日程を守れないときは1/19に顧客へ予備日利用を相談する。",
    },
    {
      id: "db-conflict", title: "結合テストで状態の上書きが判明した", date: "2027-02-05", type: "品質・DB",
      signal: "窓口担当2人が古い画面から同じ問い合わせを更新したところ、先に保存された状態が消えました。T-005 は失敗です。",
      cause: "API-05 が If-Match の値を確認しておらず、最終書き込みが勝つ処理になっていました。",
      impact: "REQ-005、詳細設計、監査ログ、API の 412 応答、画面の再読込案内、Azure SQL 上の並行テストに影響します。",
      choices: [
        ["更新の公開前に設計と実装を修正する", "先行更新を守り、履歴と状態を整合させられる", "DB変更、監査ログ、画面案内、再試験の工数が生じる", "要件の状態管理が必須であり、結合テストをやり直せる場合"],
        ["更新を停止した検証版を渡し、修正版を別枠で試す", "他の機能の受入を進めながら欠陥への対応ができる", "公開範囲と確認可能な受入が限定される。顧客合意が必要", "検証用の範囲を顧客と明文化でき、状態更新の本番公開は保留できる場合"],
        ["リリース全体を延期し、証跡を揃える", "重要な品質条件とリリース後の運用を守れる", "納期・運用引継ぎ・利用者の切替予定が動く", "データ整合性が必須であり、暫定分離では業務を成立させられない場合"],
      ],
      prompt: "どこで失敗が確認できましたか。設計書、修正、テスト、リリース判定の担当を分けてください。",
      example: "品質課題としてT-005失敗を登録。開発担当が API-05 の条件付き更新と監査の同一トランザクションを修正。別担当が Azure SQL で競合を再確認し、失敗が残る間は公開判定を保留。",
    },
    {
      id: "access-request", title: "Azureの権限申請が差し戻された", date: "2026-12-23", type: "権限・依存",
      signal: "ネットワーク構成を検証するための権限申請が、担当者と対象スコープの記載不足で差し戻されました。",
      cause: "必要ロールと対象リソースを分けておらず、責任範囲と期限が審査で確認できませんでした。",
      impact: "検証環境の作成、Private Endpoint の疎通、CI/CD の認証、環境統合試験に影響します。",
      choices: [
        ["必要最小のロール・対象・期限で再申請する", "監査可能な手順で責任範囲を守れる", "承認まで環境依存タスクが待つ", "既存の承認経路が使え、確定した対象を提出できる場合"],
        ["基盤チームに構築を依頼し、設定と検証を分担する", "プロジェクト側に恒久的な高権限を持たせずに進められる", "依頼待ちと引き渡し確認が増える", "基盤チームの担当と完了条件が合意できる場合"],
        ["ローカルで代替可能な自動テストを先行する", "権限申請中も対応できる作業がある", "実環境の認証やPrivate DNS、到達性は検証で別途確認する必要がある", "Azure実機の検証枠を明示し、ローカル合格だけで公開判定しない場合"],
      ],
      prompt: "申請先にはどの権限・対象・目的・期限を提示しますか。承認されるまでに何を進めますか。",
      example: "基盤担当と検証サブスクリプションの対象・操作・期間を確定し再申請。PL は環境準備をブロックとして報告し、ローカルでAPIエラーと権限の試験を進める。",
    },
    {
      id: "azure-route", title: "既存連携のAzure通信経路を変える必要が出た", date: "2027-01-27", type: "技術選定",
      signal: "社員マスター側の管理者は許可済みの送信元からのHTTPSだけを受け入れます。検証用の想定経路から到達できません。",
      cause: "既存側の送信元制限と、App ServiceのVNet統合後の外向き経路を設計時に照合していませんでした。",
      impact: "EXT-01、実行基盤の責任分担、名前解決・経路・認可テスト、運用コスト、承認期間に影響します。",
      choices: [
        ["固定送信元と通信経路を基盤側と調整する", "直接連携の自動化を維持できる", "出口の選択、固定IP、費用、監視変更、相手側の承認が必要", "相手側責任者と基盤担当が承認し、検証の枠を確保できる場合"],
        ["既存の連携基盤を利用できるか比較する", "既存の運用・経路・アクセス管理を使える可能性がある", "引き継ぎ責任、仕様差、ジョブの再実行方式を見直す", "既存連携基盤に空きと安全なデータ受け渡し方法がある場合"],
        ["限定した手動取り込みで試行し、公開範囲を再承認する", "自動化の不確実性を隔離できる", "運用負荷と取り込みミスの対策が必要。業務受入を変更する", "データ保護要件を満たし、顧客が運用と終了期限を承認できる場合"],
      ],
      prompt: "構成差分、追加コスト、疎通と障害時の確認、誰がいつ合意するかを書いてください。",
      example: "基盤担当と連携先担当で出口と許可条件を確認。変更案を ADR に記録し、Azure SQL の公開範囲は維持。検証でHTTPS疎通と失敗通知を確認してから日程を確定。",
    },
    {
      id: "security-review", title: "セキュリティレビューで個人情報のログ記録が判明した", date: "2027-02-12", type: "セキュリティ",
      signal: "エラー時のテレメトリに問い合わせ本文と社員メールの一部が含まれていました。",
      cause: "エラー情報を一括で採取する方針に、許可する項目、保管期間、閲覧者の定義がありませんでした。",
      impact: "NFR-002、App Insights と Log Analytics の取り扱い、ログ設計、受入、データ管理担当への連絡が必要です。",
      choices: [
        ["記録内容を制限し、既存ログの扱いを依頼する", "運用に必要な相関IDを残しながら情報の露出を抑えられる", "収集設定、既存ログの取扱い、再試験と責任者確認の時間が必要", "ログ管理担当と利用端末の調査範囲、保全・削除手順を合意できる場合"],
        ["影響する経路を止め、修正中は他の受入を進める", "追加の記録を止め、独立した試験を進行できる", "監視の死角ができるため、代替の検証と再開条件が必要", "対象経路を安全に分離でき、セキュリティ担当が暫定運用を確認できる場合"],
        ["公開を延期し、取り扱いの範囲と報告先を確定する", "データの性質と責任を整理したうえで修正できる", "顧客の利用開始と運用準備の日程を組み直す必要がある", "情報がすでに送られた範囲が未確定、または責任者が公開条件を満たさないと判断した場合"],
      ],
      prompt: "ログに残せる項目を列挙し、既存ログの取扱いの決定者、再発防止の試験を記録してください。",
      example: "データ管理担当へ対象ログと発生範囲を限定して報告。相関ID・操作名・結果だけを許可し、ログ収集後の検査もテストに追加。判断がつくまで対象経路の本番公開を保留。",
    },
    {
      id: "release-blocker", title: "本番直前に重大な不具合が見つかった", date: "2027-02-24", type: "リリース判定",
      signal: "リハーサルで、社員マスター連携の再実行後に窓口担当の割当が欠落しました。復元手順の所要時間も未計測です。",
      cause: "参照データの更新と問い合わせの割当の境界、再実行の振る舞いを試験で確かめ切れていませんでした。",
      impact: "REQ-005 と REQ-007 の受入、担当者への業務案内、データ整合性、RTO、リリースの Go/No-Go 判定に影響します。",
      choices: [
        ["No-Goとしてデータを保全し、復旧と再試験を優先する", "重大な影響を本番へ持ち込まずに済む", "新しい公開日を顧客と運用担当に確保してもらう必要がある", "再現性があるデータ不整合、未確認の復旧、必須機能の欠陥が残る場合"],
        ["連携を除いたパイロットの可否を条件付きで検討する", "合意済み範囲で一部の利用を先行できる可能性がある", "初期マスターの正当性、停止した連携、再開と復旧を検証し、受入範囲を変更する必要がある", "連携を完全に切り離せ、利用者・運用・責任者が別の受入条件を承認できる場合"],
        ["復旧を確かめる短い再判定枠を設ける", "再現と原因を明確にし、元の公開枠を再評価できる", "確認期限を超えても進めると品質上の判断が曖昧になる", "再実行の整合性と復旧計測を独立担当が確認でき、未達なら延期する合意がある場合"],
      ],
      prompt: "誰がどの証跡でいつ判定しますか。修正が終わらない場合の公開停止・報告を明確にしてください。",
      example: "2/24 時点では No-Go。連携の再実行と復元計測を修正対象として登録し、翌営業日に再判定。通らなければ旧運用を継続し、運用責任者が利用者へ変更日時を案内。",
    },
  ];

  const registerSamples = {
    risks: [
      { id: "RSK-01", title: "社員マスター連携の疎通承認が遅れる", owner: "PL", due: "2027-01-15", status: "working", priority: "high", probability: "medium", impact: "high", context: "未確認の送信元制限で EXT-01 の結合テストが遅れる可能性がある。", response: "1/15 までに連携先の責任者と経路・疎通枠を確定。未確定なら開発用スタブと本番受入の不足を分けて報告。", trigger: "担当と疎通日が確認期限を過ぎても未確定", decision: "pending" },
      { id: "RSK-02", title: "受入確認が特定の担当に集中する", owner: "顧客責任者", due: "2027-02-05", status: "open", priority: "medium", probability: "medium", impact: "medium", context: "窓口担当1人しか実操作を確認できない場合、確認枠を超過する。", response: "代理確認者を決め、T-005 と連携の試験を前の週に試行。", trigger: "2/5 時点で顧客の受入枠に代行者がいない", decision: "pending" },
    ],
    issues: [
      { id: "ISS-01", title: "画面設計レビューの承認枠が1週間遅延", owner: "PL", due: "2027-01-12", status: "working", priority: "high", probability: "medium", impact: "high", context: "1/8 にレビュー延期を確認。未承認の SCR-03 の後続作業が止まっている。", response: "代行者と部分承認の可否を確認。承認日と実装の新しい開始日を WBS に記録したら解決。", trigger: "", decision: "pending" },
      { id: "ISS-02", title: "T-005 の状態上書きを修正した", owner: "開発担当", due: "2027-02-09", status: "done", priority: "high", probability: "medium", impact: "high", context: "Azure SQL の結合試験で古い画面からの更新が成功した。", response: "API-05 の条件付き更新を修正。2/9 に 412、状態と監査の整合を別担当が確認。", trigger: "", decision: "pending" },
    ],
    changes: [
      { id: "CHG-01", title: "検索結果のExcel出力を追加したい", owner: "顧客責任者", due: "2026-12-18", status: "done", priority: "medium", probability: "medium", impact: "high", context: "月報を省力化したい。REQ-002の拡張、権限・個人情報と負荷テスト、試算5人日、追加の受入枠が必要。", response: "12/18に初回対象外として合意。現在の月報手順を残し、次回要求の一覧に要望と再評価日を記録。", trigger: "", decision: "deferred" },
      { id: "CHG-02", title: "外部連携の固定送信元を設ける", owner: "基盤責任者", due: "2027-02-01", status: "working", priority: "high", probability: "medium", impact: "high", context: "接続先が送信元を制限。経路、ランニング費用、疎通確認、連携運用の変更が必要。", response: "基盤責任者と顧客責任者に代替案、費用と日程を提示。承認後に構成図、ADR、試験、WBS を更新する。", trigger: "", decision: "pending" },
    ],
  };

  const aiCases = [
    {
      id: "design", title: "AI案 A · 状態変更の設計",
      draft: "API-05 PATCH /api/tickets/{id}/status\n画面から ticketId、新しい状態、実行者ロールを受け取り、状態を書き換える。最新の書き込みを有効とし、監査は次期対応。解決時は外部チャットに問い合わせ本文を自動送信する。テストは「対応中 → 解決」が成功することを確認する。",
      context: "REQ-005 は窓口担当と管理者だけの正当な状態遷移を許可し、NFR-002 は監査とデータ保護を求めます。初回範囲に外部チャット連携はありません。",
      checks: [
        ["scope", "要件にない外部チャット送信", true, "設計・実装の対象から外し、必要なら個人情報と承認を変更管理へ回す。"],
        ["auth", "画面から受け取ったロールを認可に使う", true, "検証済み認証情報と DB 上の対象・操作の関係で認可する。"],
        ["lock", "同時更新と監査の整合性が欠ける", true, "If-Match と rowversion で条件付き更新し、監査を同じトランザクションに置く。"],
        ["tests", "拒否・競合のテストがない", true, "T-005 で拒否、428、412、監査行を確認する。"],
        ["method", "PATCH を使用したこと自体が問題", false, "既存の API 契約に合う。問題は認可、遷移の妥当性、更新条件。"],
      ],
      example: "API-05 は要求者のロールを信頼せず、サーバー側で窓口担当・管理者と対象レコードの権限を確認する。If-Match 欠落は 428、古い値は 412、許可されない遷移は契約どおりに拒否。状態と監査を一体でコミットし、T-005 で競合時に1件だけ成功することを確認する。",
    },
    {
      id: "wbs", title: "AI案 B · 初回公開のWBS",
      draft: "仕様を固める　担当 PL　2人日\n一覧・詳細・フォーム・管理者を全部実装　担当 アプリ　2人日\n結合・受入テスト　担当 アプリ　2人日（同じ実装日前半に実施）\n本番配布　担当 基盤　2人日\n※ 時間が余ったら監視を検討。工数は全作業に同じ値を適用。",
      context: "3人の稼働率は PL 60%、アプリ 80%、基盤・QA 60%。顧客レビューと受入の枠、外部接続承認、監視と復元確認を初回に含めます。",
      checks: [
        ["basis", "作業の粒度と見積根拠が不足", true, "成果物、受入条件、見積方法、前提をタスク単位に分ける。"],
        ["load", "先行作業と担当者負荷が矛盾する", true, "実装後に結合を置き、担当の休日と稼働率をガントで確認する。"],
        ["ops", "監視・復元・Go/No-Go が欠ける", true, "リハーサルと運用移管を WBS に追加し、公開前の判定材料にする。"],
        ["customers", "顧客の確認待ちと受入が分解されていない", true, "依頼先、予定日、待機期間、承認条件を独立した作業にする。"],
        ["naming", "PLに仕様整理を割り当てた時点で誤り", false, "PLが整理を進められる。承認責任や実務レビュー担当は別に確認する。"],
      ],
      example: "先に主要画面の項目定義と顧客確認を分け、完了後に一覧と状態変更を実装する。1作業に成果物、8時間を1人日とする見積、依存を付け、実装者とは別の担当で結合試験を計画。監視・復元試験の通過後に顧客受入と公開判断を置く。",
    },
    {
      id: "infrastructure", title: "AI案 C · Azureの構成とログ",
      draft: "6週間以内を目標として2リージョンに AKS を構築する。Azure SQL と Key Vault は全環境で共有する。障害解析のため本文と認証ヘッダーをエラーログに残す。サービスへの接続を確認できたら可用性・復元要件は合格とする。",
      context: "初回は Azure App Service と Azure SQL が指定され、開発・検証・本番の責任を分けます。既知の目標は30同時利用で p95 1.5秒以内、RPO 1時間・RTO 4時間以内です。",
      checks: [
        ["topology", "構成変更の根拠と代替比較が不足", true, "App Serviceで要求を満たせるか比較し、AKS の運用コストと採用条件を ADR に記録。"],
        ["separation", "環境のDB・秘密情報を共有している", true, "本番データと設定へのアクセスを分離して、権限とデプロイ先を検証する。"],
        ["logs", "ログに機微情報を記録する", true, "相関ID、操作、結果、所要時間など許可項目を決め、トークンと本文を除外する。"],
        ["recovery", "接続確認を復元試験の代わりにしている", true, "分離環境で復元し、データの時点・復元時間・主操作の再開を測る。"],
        ["regions", "1リージョン構成は要件に関係なく常に不可", false, "可用性の要件、障害モデル、運用費用、復旧手段に照らして判断する。"],
      ],
      example: "App Serviceを出発点に、計測値と障害モデルから可用性を決める。環境ごとにDBとシークレットを分離し、DBはプライベートアクセスを前提に構成する。ログには本文と資格情報を出さず、復元したデータで主要業務を再開できるまでを計測する。",
    },
  ];

  const finalCase = {
    name: "社内会議室予約",
    start: "2027-03-01",
    deadline: "2027-04-09",
    story: "総務部から「空いていると聞いて会議室へ行ったら使われていた。空き状況をひと目で確認して予約したい」と依頼されました。現在は8室を表計算とメールで調整しています。まず40人へ試験公開し、6週間で主要な予約業務を成立させます。",
    conditions: [
      "PLと開発担当の2名。稼働率と休日は最終演習用のWBSで確認する。",
      "既存の社内認証は使える予定。予約者と総務の権限、外部利用の扱いは確認が必要。",
      "予約はJSTの30分単位、1室につき時間の重複を拒否する。繰り返し予約と設備予約は次回候補。",
      "対象社員は最大120人を想定。パイロットは40人。12人同時利用を検証の仮定とし、実利用者を確認して計測条件を更新する。",
    ],
  };
  const finalFields = [
    { key: "overview", label: "プロジェクト概要", hint: "誰の困りごと、改善したい業務、期限、確認相手を記述します。", sample: "総務・社員が8室の空き確認と予約変更のためにやり取りしている。3/1〜4/9に40名へ試行公開し、初週の重複予約が0件、5名中4名以上が案内のみで1分以内に初回予約できることを確認する。総務責任者が初回範囲と公開判断を承認する。" },
    { key: "requirements", label: "要件一覧と対象外", hint: "誰が何を行うかをIDで整理し、対象外と判断待ちを残します。", sample: "BR-001 社員が日付・会議室ごとの空き状況を見る。BR-002 30分単位で会議室を予約し、重複を拒否する。BR-003 予約者は自分の将来予約を取り消せる。総務だけに管理操作を許すかは3/3までに総務責任者が判断。繰り返し予約と設備予約は対象外。" },
    { key: "functions", label: "機能一覧", hint: "機能IDと要件IDを結びつけ、画面やデータの境界を示します。", sample: "F-01 空き一覧（SCR-B01、BR-001）。F-02 予約フォーム（SCR-B02、BR-002、API-B02）。F-03 予約一覧からの本人取り消し（SCR-B03、BR-003、API-B03）。取消済みが空き表示に反映される。" },
    { key: "nonfunctional", label: "非機能要件", hint: "性能、権限、復旧などを、測る対象と条件まで書きます。", sample: "NFR-B01 12人相当・800件の合成予約で10分計測し、一覧 p95 1秒以内。NFR-B02 予約・取消を本人または承認済みロールに制限し、予約・取消結果の監査を90日保管。NFR-B03 許容損失4時間・復旧時間2時間以内を検証復元で確認。" },
    { key: "design", label: "主要な設計方針", hint: "業務ルールをどこで保証し、失敗・競合をどう返すかを説明します。", sample: "予約情報と30分枠の明細を同じDB取引で保存し、room_id と枠開始時刻を一意にする。重複は409で候補日時の再確認へ誘導。取消は本人確認後、予約を無効として枠を解放し、結果を監査に残す。保管日時はUTC、表示と業務日はJST。" },
    { key: "technology", label: "技術選定と理由", hint: "既存サービス、別構成、開発・運用コストを比較します。", sample: "既存 Entra ID、運用担当の ASP.NET Core と管理型 SQL を活用する。連続枠の一意性をトランザクションで守れる。会議室用既製サービスは機能適合とデータ持出条件を比較し、既存サービスが使える場合は開発の必要性を見直す。持続的な性能不足が出たら再計測して構成変更を検討する。" },
    { key: "deliverables", label: "成果物一覧", hint: "誰がどの資料を確認するか。要件・設計・テスト・公開記録までつなぎます。", sample: "docs/requirements.md（範囲と受入、総務承認）、docs/design.md（画面・API・DBと枠取得、相互レビュー）、docs/test-plan.md（BR-001〜003・TB-01〜03）、planning/wbs.csv（前提と工数）、docs/release.md（実機結果・復元・切替手順、PLと総務確認）。" },
    { key: "risks", label: "リスク一覧", hint: "予防策、顕在化の条件、担当と判断期限を書きます。", sample: "R-B01 認証連携申請の遅れ。PLが3/5までに設定枠を確定し、遅れたらローカル試験と検証認証の作業を分ける。R-B02 重複予約。開発担当が先に DB 枠の並行試験を作り、競合拒否が通らなければ公開を止める。R-B03 確認者欠員。総務責任者が受入の代理を3/19までに指名。" },
    { key: "quality", label: "品質・受入条件", hint: "成功だけでなく競合、権限不足、復元の証拠と担当を書きます。", sample: "TB-01 指定日付の空きと予約済みが一致。TB-02 同室の同時予約は201と409が各1回、重複枠が0件。TB-03 他人の取消は403で枠と監査を確認し、本人取消で空きに戻る。12人負荷と復元計測を残し、総務が40名パイロット前に主要業務を操作して受け入れる。" },
    { key: "release", label: "リリース計画", hint: "Go/No-Go、同一候補、スモーク、停止と復旧、運用引継ぎを具体化します。", sample: "ステージングでTB-01〜03・負荷・復元を通した候補を4/9に配布。PLが検証結果・復元・運用担当の可否を確認し総務責任者とGo/No-Goを決定。予約・取消と監視をパイロットで確認し、重複を検知した場合は新規書き込みを止め、旧台帳へ案内する。問い合わせ先と翌営業日の監視担当を記録。" },
  ];

  const levels = { low: 1, medium: 2, high: 3 };
  const absenceDays = ["2027-01-18", "2027-01-19", "2027-01-20", "2027-01-21", "2027-01-22"];
  const emptyEvent = () => ({ choice: -1, rationale: "", report: "", change: "", reviewed: false });
  const emptyRegister = () => ({ risks: [], issues: [], changes: [] });
  const emptyRegisterEntry = () => ({ title: "", owner: "", due: "", status: "open", priority: "medium", probability: "medium", impact: "medium", context: "", response: "", trigger: "", decision: "pending" });
  const emptyAi = () => ({ flagged: [], evidence: "", revision: "", reviewed: false });

  function expectObject(value, name) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(name + " の形式を確認してください。");
    return value;
  }

  function validatedString(value, name, max = MAX_NOTE, required = false) {
    if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(name + " の長さまたは形式を確認してください。");
    return value;
  }

  function enumValue(value, choices, name) {
    if (typeof value !== "string" || !Object.hasOwn(choices, value)) throw new Error(name + " に未知の値が含まれています。");
    return value;
  }

  function dateValue(value) {
    if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error("期限を YYYY-MM-DD で入力してください。");
    const instant = Date.parse(value + "T00:00:00Z");
    if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== value) throw new Error("存在する日付を入力してください。");
    return value;
  }

  function knownRows(value, catalog, validator, name) {
    const source = expectObject(value, name);
    const result = {};
    for (const [key, row] of Object.entries(source)) {
      const spec = catalog.find(item => item.id === key);
      if (!spec) throw new Error(name + " の識別子を確認してください。");
      result[key] = validator(expectObject(row, name), spec);
    }
    return result;
  }

  function eventValue(value) {
    const input = expectObject(value, "トラブル演習");
    if (!events.some(event => event.id === input.selected)) throw new Error("トラブル演習の選択値を確認してください。");
    return {
      selected: input.selected,
      drafts: knownRows(input.drafts, events, (row, spec) => {
        if (!Number.isInteger(row.choice) || row.choice < -1 || row.choice >= spec.choices.length || typeof row.reviewed !== "boolean") throw new Error("対応案の選択値を確認してください。");
        const draft = {
          choice: row.choice,
          rationale: validatedString(row.rationale, "判断の根拠"),
          report: validatedString(row.report, "報告案"),
          change: validatedString(row.change, "計画への反映"),
          reviewed: row.reviewed,
        };
        if (draft.reviewed && (draft.choice < 0 || [draft.rationale, draft.report, draft.change].some(text => !text.trim()))) {
          throw new Error("確認済みのトラブル演習には判断の根拠、報告、計画変更を記録してください。");
        }
        return draft;
      }, "トラブル演習"),
    };
  }

  function registerEntry(value, type) {
    const source = expectObject(value, kinds[type].title);
    const entry = {
      title: validatedString(source.title, "件名", 140, true).trim(),
      owner: validatedString(source.owner, "担当", 60, true).trim(),
      due: dateValue(source.due),
      status: enumValue(source.status, statusLabels, "状態"),
      priority: enumValue(source.priority, levelLabels, "優先度"),
      probability: enumValue(source.probability, levelLabels, "発生可能性"),
      impact: enumValue(source.impact, levelLabels, "影響度"),
      context: validatedString(source.context, "内容", MAX_NOTE, true).trim(),
      response: validatedString(source.response, "対応", MAX_NOTE, true).trim(),
      trigger: validatedString(source.trigger, "顕在化の条件", 300, type === "risks").trim(),
      decision: enumValue(source.decision, decisionLabels, "変更判断"),
    };
    if (type === "changes" && entry.status === "done" && entry.decision === "pending") {
      throw new Error("変更を完了にする前に、承認・延期・却下の判断を記録してください。");
    }
    return entry;
  }

  function registerValue(value) {
    const input = expectObject(value, "管理表");
    const output = {};
    for (const [type, spec] of Object.entries(kinds)) {
      const rows = input[type];
      if (!Array.isArray(rows) || rows.length > REGISTER_LIMIT) throw new Error(spec.title + " は " + REGISTER_LIMIT + "件までです。");
      const seen = new Set();
      output[type] = rows.map(row => {
        const fields = registerEntry(row, type);
        if (typeof row.id !== "string" || !new RegExp("^" + spec.prefix + "-(?!0+$)\\d{2,4}$").test(row.id) || seen.has(row.id)) {
          throw new Error(spec.title + " の管理IDを確認してください。");
        }
        seen.add(row.id);
        return { id: row.id, ...fields };
      });
    }
    return output;
  }

  function aiValue(value) {
    const input = expectObject(value, "AI成果物レビュー");
    if (!aiCases.some(item => input.selected === item.id)) throw new Error("レビュー案の選択値を確認してください。");
    return {
      selected: input.selected,
      drafts: knownRows(input.drafts, aiCases, (row, spec) => {
        if (!Array.isArray(row.flagged) || new Set(row.flagged).size !== row.flagged.length ||
           !row.flagged.every(key => spec.checks.some(check => check[0] === key)) || typeof row.reviewed !== "boolean") {
          throw new Error("レビュー指摘の識別子を確認してください。");
        }
        const draft = {
          flagged: [...row.flagged],
          evidence: validatedString(row.evidence, "レビューの根拠"),
          revision: validatedString(row.revision, "改善案"),
          reviewed: row.reviewed,
        };
        if (draft.reviewed && (!draft.evidence.trim() || !draft.revision.trim())) throw new Error("確認済みのレビューに根拠と改善案を記録してください。");
        return draft;
      }, "AI成果物レビュー"),
    };
  }

  function finalValue(value) {
    const input = expectObject(value, "最終演習");
    return Object.fromEntries(finalFields.map(({ key, label }) => [key, validatedString(input[key], label)]));
  }

  lab.validators["09"] = eventValue;
  lab.validators["10"] = registerValue;
  lab.validators["11"] = aiValue;
  lab.validators["12"] = finalValue;

  function button(ctx, label, onClick, variant = "secondary") {
    return ctx.el("button", { type: "button", class: "button " + variant, onClick }, label);
  }

  function panel(ctx, label, ...children) {
    return ctx.el("section", { class: "panel pl-practice-panel" }, ctx.el("h3", {}, label), ...children);
  }

  function details(ctx, label, ...children) {
    return ctx.el("details", { class: "pl-practice-details" }, ctx.el("summary", {}, label), ctx.el("div", { class: "stack" }, ...children));
  }

  function select(ctx, aria, initial, choices, onChange) {
    const element = ctx.el("select", { "aria-label": aria },
      ...choices.map(([value, label]) => ctx.el("option", { value }, label)));
    element.value = initial;
    if (onChange) element.addEventListener("change", () => onChange(element.value));
    return element;
  }

  function textInput(ctx, value, onInput, { rows = 0, max = MAX_NOTE, type = "text", name } = {}) {
    const element = rows ? ctx.el("textarea", { rows, maxLength: max, name })
      : ctx.el("input", { type, maxLength: max, name });
    element.value = value;
    if (onInput) element.addEventListener("input", () => onInput(element.value));
    return element;
  }

  function field(ctx, caption, control, hint) {
    return ctx.el("label", { class: "pl-practice-field" }, ctx.el("span", {}, caption), control,
      hint ? ctx.el("small", { class: "muted" }, hint) : null);
  }

  function note(ctx, label, content, variant = "") {
    return ctx.el("div", { class: "callout pl-practice-callout " + variant }, ctx.el("strong", {}, label), ctx.el("p", {}, content));
  }

  function status(ctx) {
    return ctx.el("div", { class: "pl-practice-status", role: "status" });
  }

  function tags(ctx, ...items) {
    return ctx.el("div", { class: "pl-practice-tags" }, ...items.map(text => ctx.el("span", { class: "badge" }, text)));
  }

  function bullet(ctx, items) {
    return ctx.el("ul", { class: "pl-practice-list" }, ...items.map(text => ctx.el("li", {}, text)));
  }

  function md(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function mdCell(value) {
    return md(value).replace(/\|/g, "\\|").replace(/\r\n|[\r\n]/g, " ／ ");
  }

  function choosePlan(ctx, id, mode = "sample") {
    ctx.state.planMode = mode;
    ctx.save();
    ctx.go(id);
  }

  function eventReport(data) {
    const lines = ["# 問い合わせ管理 · トラブル対応記録", ""];
    for (const event of events) {
      const draft = data.drafts[event.id];
      if (!draft || draft.choice === -1) continue;
      lines.push("## " + event.date + " " + event.title, "", "- 対応案 " + event.choices[draft.choice][0],
        "- 状態 " + (draft.reviewed ? "確認済み" : "下書き"), "", "### 判断の根拠", "", md(draft.rationale),
        "", "### 関係者への報告", "", md(draft.report), "", "### 計画変更・確認条件", "", md(draft.change), "");
    }
    return lines.join("\n");
  }

  function absenceControls(ctx, feedback) {
    const plan = ctx.state.plans.sample;
    const person = plan?.people.find(member => member.id === "dev");
    if (!person) return note(ctx, "反映前の確認", "サンプル案件にアプリ担当（dev）が存在することをWBSまたはガントで確認してください。");
    const applied = absenceDays.every(day => person.absences.includes(day));
    const absenceCount = (analysis) => analysis.issues.filter(issue => issue.type === "absence").length;
    const apply = button(ctx, applied ? "非稼働日を反映済み" : "1/18〜1/22の非稼働を計画へ反映", () => {
      try {
        const before = lab.plan.analyzePlan(plan);
        const changed = lab.plan.validatePlan({
          ...plan,
          people: plan.people.map(member => member.id === "dev" ? { ...member, absences: [...new Set([...member.absences, ...absenceDays])] } : member),
        });
        ctx.state.plans.sample = changed;
        ctx.save();
        const after = lab.plan.analyzePlan(changed);
        apply.disabled = true;
        apply.textContent = "非稼働日を反映済み";
        feedback.textContent = "アプリ担当へ非稼働日を5日追加しました。非稼働日の警告 " + absenceCount(before) + " → " + absenceCount(after) +
          " 件、過負荷の警告 " + before.summary.overloads + " → " + after.summary.overloads +
          " 件。固定した日付を動かすには、ガントで担当・予定日と前提タスクを調整します。";
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
    apply.disabled = applied;
    return apply;
  }

  lab.chapters["09"] = function eventsChapter(ctx) {
    const data = ctx.state.answers[ctx.id] ??= { selected: events[0].id, drafts: {} };
    const mount = ctx.el("div", { class: "stack" });
    const menu = select(ctx, "発生イベント", data.selected, events.map(event => [event.id, event.title]), value => {
      data.selected = value;
      ctx.save();
      render();
    });
    const intro = panel(ctx, "遅れと変更を判断する",
      ctx.el("p", {}, "最初に事実と未確認事項を分け、影響する成果物、担当、依存関係を追います。対応の選択、関係者への報告、計画の更新までを一組で記録します。"),
      note(ctx, "この工程を省くと", "変更要望が暗黙の約束になり、期限と品質の判断材料が残りません。事実が変わった時点で基準計画と実績を比較します。"),
      field(ctx, "発生イベント", menu));
    ctx.root.append(intro, mount);

    function render() {
      const spec = events.find(event => event.id === data.selected);
      const draft = data.drafts[spec.id] ??= emptyEvent();
      const check = status(ctx);
      const planStatus = status(ctx);
      function invalidate() {
        draft.reviewed = false;
        check.replaceChildren();
        ctx.save();
      }
      const options = ctx.el("fieldset", { class: "pl-practice-options" }, ctx.el("legend", {}, "採用する対応案"),
        ...spec.choices.map(([label, merits, cost, condition], index) => {
          const input = ctx.el("input", { type: "radio", name: "event-strategy", value: String(index) });
          input.checked = draft.choice === index;
          input.addEventListener("change", () => { draft.choice = index; invalidate(); });
          return ctx.el("label", { class: "pl-practice-option" }, input,
            ctx.el("span", { class: "pl-practice-option-copy" }, ctx.el("strong", {}, label),
              ctx.el("span", {}, "利点 — " + merits), ctx.el("span", {}, "負担 — " + cost), ctx.el("span", {}, "成立条件 — " + condition)));
        }));
      const view = panel(ctx, spec.title, tags(ctx, spec.date, spec.type), ctx.el("p", {}, spec.signal),
        ctx.el("dl", { class: "pl-practice-facts" },
          ctx.el("div", {}, ctx.el("dt", {}, "原因"), ctx.el("dd", {}, spec.cause)),
          ctx.el("div", {}, ctx.el("dt", {}, "影響範囲"), ctx.el("dd", {}, spec.impact))));
      const response = panel(ctx, "判断と報告を作る", options,
        field(ctx, "判断の根拠", textInput(ctx, draft.rationale, text => { draft.rationale = text; invalidate(); }, { rows: 3 }), spec.prompt),
        field(ctx, "関係者への報告案", textInput(ctx, draft.report, text => { draft.report = text; invalidate(); }, { rows: 3 }), "誰に、いつ、確定事項・未確定事項・必要な判断を伝えるかを記録します。"),
        field(ctx, "WBS・スケジュール・資料の変更", textInput(ctx, draft.change, text => { draft.change = text; invalidate(); }, { rows: 3 }), "変更するID・担当・前提・期限・再判定条件。変更不要なら根拠と再点検日を書きます。"),
        ctx.el("div", { class: "actions" },
          button(ctx, "判断を確認して記録", assess, "primary"),
          button(ctx, "対応記録をMarkdownで保存", () => ctx.download("trouble-response.md", eventReport(data), "text/markdown;charset=utf-8"))),
        check,
        details(ctx, "報告と計画変更の記入例", ctx.el("p", {}, spec.example)));
      const apply = panel(ctx, "計画に戻って調整する",
        ctx.el("p", {}, "現在の計画と判断を見比べ、依存する作業、担当者の負荷、予備期間を更新します。元の計画を残すときは先に全体バックアップを保存します。"),
        ctx.el("div", { class: "actions" },
          button(ctx, "問い合わせ案件のWBSを開く", () => choosePlan(ctx, "06")),
          button(ctx, "問い合わせ案件のガントを開く", () => choosePlan(ctx, "08")),
          spec.id === "capacity-loss" ? absenceControls(ctx, planStatus) : null),
        planStatus);
      function assess() {
        const missing = [];
        if (draft.choice === -1) missing.push("成立条件に合う対応案を選びます。");
        if (!draft.rationale.trim()) missing.push("失うものと、成立条件を確認する方法を書きます。");
        if (!draft.report.trim()) missing.push("報告先と判断が必要な時点を記録します。");
        if (!draft.change.trim()) missing.push("変更する計画・文書、または維持する条件を書きます。");
        if (missing.length) {
          check.replaceChildren(note(ctx, "確認する項目", "判断を記録する前に補ってください。", "callout-warning"), bullet(ctx, missing));
          return;
        }
        draft.reviewed = true;
        ctx.save();
        ctx.recordArtifact("トラブル対応記録", eventReport(data));
        ctx.complete();
        showResult();
      }
      function showResult() {
        const reviewed = Object.values(data.drafts).filter(item => item.reviewed).length;
        check.replaceChildren(note(ctx, "判断メモを確認しました（" + reviewed + " / " + events.length + " ケース）",
          "選んだ案の成立条件 — " + spec.choices[draft.choice][3] + "。実際に確認する担当・時点・証拠が報告案に含まれるか見直してください。", "callout-success"));
      }
      mount.replaceChildren(view, response, apply);
      if (draft.reviewed && draft.choice >= 0) showResult();
    }
    render();
  };

  function riskScore(row) {
    return levels[row.probability] * levels[row.impact];
  }

  function registerRows(type, rows) {
    return rows.map(row => [
      row.id, row.title, row.owner, row.due, statusLabels[row.status], levelLabels[row.priority],
      row.context, row.response,
      ...(type === "risks" ? [levelLabels[row.probability] + " × " + levelLabels[row.impact] + " = " + riskScore(row) + "、" + row.trigger] : []),
      ...(type === "changes" ? [decisionLabels[row.decision]] : []),
    ]);
  }

  function registerHeaders(type) {
    return ["ID", "件名", "担当", "期限", "状況", "優先度", kinds[type].context, kinds[type].response,
      ...(type === "risks" ? ["発生可能性・影響度と顕在化条件"] : []),
      ...(type === "changes" ? ["承認判断"] : [])];
  }

  function registerReport(data, brief = false) {
    const lines = ["# 問い合わせ管理 · PL管理表", ""];
    for (const type of Object.keys(kinds)) {
      const headers = brief ? registerHeaders(type).slice(0, 6) : registerHeaders(type);
      const rows = registerRows(type, data[type]);
      const body = brief ? rows.map(row => row.slice(0, 6)) : rows;
      lines.push("## " + kinds[type].title, "", "| " + headers.join(" | ") + " |",
        "| " + headers.map(() => "---").join(" | ") + " |",
        ...body.map(row => "| " + row.map(mdCell).join(" | ") + " |"), "");
    }
    return lines.join("\n");
  }

  function nextRegisterId(type, entries) {
    const prefix = kinds[type].prefix + "-";
    const ids = new Set(entries.map(entry => entry.id));
    let sequence = 1;
    while (ids.has(prefix + String(sequence).padStart(2, "0"))) sequence += 1;
    return prefix + String(sequence).padStart(2, "0");
  }

  const managementRows = [
    ["進捗管理・割当", "予定と実績・影響を照合し、優先順位と作業負荷を見て次の担当を決める。", "WBS の予定・実績・依存を比較し、未承認の SCR-03 を実装へ渡さない。"],
    ["課題・リスク・変更管理", "発生済みの事実、起こりうる事象、基準変更の提案を別に扱う。", "接続が不確定なら RSK-01、疎通承認が遅れて作業が停止したら ISS を作成。構成変更の許可は CHG で記録。"],
    ["品質管理・成果物レビュー", "受入条件と成果物を照合し、検証の責任を分けて見落としを減らす。", "REQ-005・API-05・T-005 の条件をつなぎ、実装者以外が 412 と監査行を確認。"],
    ["会議体・合意形成", "判断が必要な論点と証拠を先に送り、決めたこと・宿題・担当を残す。", "週次の顧客確認では新規論点を議論。定例の進捗共有はボードを更新し、承認は議事録に残す。"],
    ["エスカレーション", "担当が決められない時や納期・安全に関わる時は権限のある人へ上げる。", "PL は公開判断に影響するT-005の失敗を即日通知。影響、選択肢、判断期限を付ける。"],
    ["リリース判定", "必須の受入、運用の準備、停止・復旧、責任者の合意を一緒に確認する。", "同一候補、重大不具合なし、T-005・パイプライン・復元の証跡、当番の可否を確認しGo/No-Goを決める。"],
  ];
  const scaleRows = [
    ["ひとり", "WBS と3種類の判断を共用メモにまとめる。依存・期限・停止条件は記録する。", "10分程度で毎日見直し、例外を後日自分が追える形にする。顧客承認は本人以外の業務責任者へ。"],
    ["2〜3人", "WBSで担当とレビュー担当を別に置く。リスク・課題・変更にIDと判断期限を付ける。", "短い作業共有、週次の要件・リスク更新、節目で顧客の合意。判断を共有記録に残す。"],
    ["5人以上", "作業領域ごとの責任、横断の依存、品質ゲート、決裁権限と代理を明文化する。", "作業領域の同期と顧客の意思決定を分け、重大事項の連絡経路を共有する。"],
  ];

  lab.chapters["10"] = function managementChapter(ctx) {
    const data = ctx.state.answers[ctx.id] ??= emptyRegister();
    const mount = ctx.el("div", { class: "stack" });
    const intro = panel(ctx, "PLの判断を記録に残す",
      ctx.el("p", {}, "管理の目的は、報告のための表を増やすことより、担当者が次の判断に進めるようにすることです。起きた事実は課題、起きうる事象はリスク、承認が必要な基準の変更は変更として記録します。"),
      note(ctx, "この工程を省くと", "課題の期限と責任が曖昧になり、遅延が受入の直前に発覚します。関係者の判断を必要とする内容は、作業と同じように担当と期限を付けます。"),
      ctx.table(["管理業務", "判断の軸", "問い合わせ案件での記入例"], managementRows, "PLの定例と節目の判断"),
      details(ctx, "規模に応じた管理と会議", ctx.table(["開発規模", "残す情報", "確認・合意の例"], scaleRows, "規模別の管理方針")));
    let type = "risks";
    let editId = "";
    const picker = select(ctx, "編集する管理表", type, Object.entries(kinds).map(([key, spec]) => [key, spec.title]), value => {
      type = value;
      editId = "";
      render();
    });
    ctx.root.append(intro, panel(ctx, "リスク・課題・変更の管理表", field(ctx, "編集する管理表", picker)), mount);

    function render(message = "") {
      const spec = kinds[type];
      const entries = data[type];
      const existing = entries.find(entry => entry.id === editId);
      const defaults = existing ?? emptyRegisterEntry();
      const feedback = status(ctx);
      const formFeedback = status(ctx);
      feedback.textContent = message;
      const form = ctx.el("form", { class: "stack pl-practice-form" });
      const samples = details(ctx, "完成サンプルを見る",
        ctx.table(registerHeaders(type), registerRows(type, registerSamples[type]), spec.title + "の記入例"),
        ctx.el("p", { class: "muted" }, "例の期限と担当者は演習上の仮定です。課題とリスクは別の根拠で登録し、変更は決裁前後に影響を見比べます。"));
      const body = entries.length ?
        ctx.table([...registerHeaders(type), "操作"], registerRows(type, entries).map((cells, index) => [
          ...cells, ctx.el("div", { class: "pl-practice-row-actions" },
            button(ctx, "編集 " + entries[index].id, () => {
              editId = entries[index].id;
              render();
              mount.querySelector("form input")?.focus();
            }),
            button(ctx, "削除 " + entries[index].id, () => beginDelete(entries[index]))),
        ]), "登録済みの" + spec.title)
        : ctx.el("p", { class: "muted" }, "まだ登録がありません。トラブル演習の事実や懸念から、担当と期限のある記録を作ります。");
      const bodyActions = ctx.el("div", { class: "actions" },
        entries.length ? null : button(ctx, "この記入例を作業用にコピー", () => {
          data[type] = registerSamples[type].map(row => ({ ...row }));
          ctx.save();
          render("記入例をコピーしました。担当・期限・解決条件を編集できます。");
        }),
        button(ctx, "管理表を確認して成果物に保存", finish, "primary"),
        button(ctx, "管理表をMarkdownで保存", () => ctx.download("pl-management-registers.md", registerReport(data), "text/markdown;charset=utf-8")));
      const heading = existing ? existing.id + " を編集する" : spec.title + "に登録する";

      function beginDelete(entry) {
        feedback.replaceChildren(
          ctx.el("p", {}, entry.id + "「" + entry.title + "」を削除しますか。"),
          ctx.el("div", { class: "actions" },
            button(ctx, "削除を確定", () => {
              data[type] = entries.filter(row => row.id !== entry.id);
              if (editId === entry.id) editId = "";
              ctx.save();
              render(entry.id + " を削除しました。");
            }, "danger"),
            button(ctx, "キャンセル", () => feedback.replaceChildren())));
      }

      function makeText(key, caption, options = {}, hint) {
        const element = textInput(ctx, defaults[key], null, { ...options, name: key });
        return field(ctx, caption, element, hint);
      }
      function makeChoice(key, caption, values) {
        const input = select(ctx, caption, defaults[key], Object.entries(values));
        input.name = key;
        return field(ctx, caption, input);
      }

      form.append(
        ctx.el("div", { class: "field-grid" },
          makeText("title", "件名", { max: 140 }),
          makeText("owner", "対応・判断の担当", { max: 60 }),
          makeText("due", "期限・次回確認日", { type: "date", max: 10 }),
          makeChoice("status", "状況", statusLabels),
          makeChoice("priority", "優先度", levelLabels),
          type === "risks" ? makeChoice("probability", "発生可能性", levelLabels) : null,
          type === "risks" ? makeChoice("impact", "影響度", levelLabels) : null,
          type === "changes" ? makeChoice("decision", "変更判断", decisionLabels) : null),
        makeText("context", spec.context, { rows: 3 }),
        makeText("response", spec.response, { rows: 3 }),
        type === "risks" ? makeText("trigger", "顕在化の条件", { max: 300 }, "例。顧客レビューの代行者が1/15時点で決まっていない。発生可能性と影響度は低1・中2・高3で、積を確認の順序づけに使います。") : null,
        ctx.el("div", { class: "actions" }, ctx.el("button", { type: "submit", class: "button primary" }, existing ? "変更を保存" : "登録する"),
          existing ? button(ctx, "編集をやめる", () => { editId = ""; render(); }) : null),
        formFeedback,
      );

      form.addEventListener("submit", event => {
        event.preventDefault();
        try {
          if (!existing && entries.length >= REGISTER_LIMIT) throw new Error("この管理表は " + REGISTER_LIMIT + " 件までです。");
          const fields = registerEntry({ ...emptyRegisterEntry(), ...Object.fromEntries(new FormData(form)) }, type);
          const id = existing?.id ?? nextRegisterId(type, entries);
          const record = { id, ...fields };
          data[type] = existing ? entries.map(row => row.id === id ? record : row) : [...entries, record];
          editId = "";
          ctx.save();
          render(id + " を保存しました。");
        } catch (error) {
          formFeedback.textContent = error.message;
        }
      });

      function finish() {
        const missing = Object.keys(kinds).filter(key => !data[key].length);
        if (missing.length) {
          feedback.textContent = "成果物の確認前に、" + missing.map(key => kinds[key].title).join("、") + " に各1件を記録してください。";
          return;
        }
        const markdown = registerReport(data);
        ctx.recordArtifact("課題・リスク・変更管理表", artifactSize(markdown, registerReport(data, true)));
        ctx.complete();
        feedback.textContent = "3種類の管理表を成果物に保存しました。次の確認時に担当と期限も見直してください。";
      }

      mount.replaceChildren(panel(ctx, spec.title, samples, body, bodyActions, feedback),
        panel(ctx, heading, form));
    }
    render();
  };

  function aiReport(data) {
    const lines = ["# AI成果物レビュー · 問い合わせ管理", "", "教材内の固定ルールと設計サンプルを使ったレビュー記録です。", ""];
    for (const spec of aiCases) {
      const draft = data.drafts[spec.id];
      if (!draft) continue;
      lines.push("## " + spec.title, "", ...spec.checks.map(([id, label]) => "- [" + (draft.flagged.includes(id) ? "x" : " ") + "] " + label),
        "", "### 要件・根拠と影響", "", md(draft.evidence), "", "### 改善案と確認方法", "", md(draft.revision), "");
    }
    return lines.join("\n");
  }

  lab.chapters["11"] = function aiChapter(ctx) {
    const data = ctx.state.answers[ctx.id] ??= { selected: aiCases[0].id, drafts: {} };
    const mount = ctx.el("div", { class: "stack" });
    const picker = select(ctx, "レビューする成果物", data.selected, aiCases.map(spec => [spec.id, spec.title]), value => {
      data.selected = value;
      ctx.save();
      render();
    });
    ctx.root.append(panel(ctx, "もっともらしい提案を、案件の事実と照らし合わせる",
      ctx.el("p", {}, "設計、WBS、Azure構成の案を読み、根拠となる要件・制約・試験と照合します。指摘ごとに影響と改善を記録します。"),
      note(ctx, "判定方法", "準備済みのルールでチェック項目を比較します。根拠と改善案の文章は、記入例や条件を読んで評価してください。"),
      field(ctx, "レビューする成果物", picker)), mount);

    function render() {
      const spec = aiCases.find(item => item.id === data.selected);
      const draft = data.drafts[spec.id] ??= emptyAi();
      const feedback = status(ctx);
      const reference = details(ctx, "模範の指摘と改善例",
        ctx.table(["指摘候補", "見立て", "判断と改善の例"],
          spec.checks.map(([, label, expected, advice]) => [label, expected ? "今回の設計で要確認" : "条件を確認できれば許容", advice]), "要件と試験を根拠にした見立て"),
        ctx.el("p", {}, spec.example));
      function changeDraft() {
        draft.reviewed = false;
        feedback.replaceChildren();
        ctx.save();
      }
      const checklist = ctx.el("fieldset", { class: "pl-practice-options" }, ctx.el("legend", {}, "指摘候補"),
        ...spec.checks.map(([id, label]) => {
          const box = ctx.el("input", { type: "checkbox", value: id });
          box.checked = draft.flagged.includes(id);
          box.addEventListener("change", () => {
            draft.flagged = box.checked ? [...draft.flagged, id] : draft.flagged.filter(flag => flag !== id);
            changeDraft();
          });
          return ctx.el("label", { class: "pl-practice-option pl-practice-check-option" }, box, ctx.el("span", {}, label));
        }));
      const review = panel(ctx, "チェックリストと自分のレビュー記録", checklist,
        field(ctx, "要件・根拠と影響", textInput(ctx, draft.evidence, text => { draft.evidence = text; changeDraft(); }, { rows: 4 }),
          "例。どの要件・どの行に関係して、誰の操作やどの公開条件が変わるか。"),
        field(ctx, "改善案と確認方法", textInput(ctx, draft.revision, text => { draft.revision = text; changeDraft(); }, { rows: 4 }),
          "どう直すか、どの環境で何を観測できればよいかを書きます。"),
        ctx.el("div", { class: "actions" },
          button(ctx, "指摘を照合してレビューを記録", assess, "primary"),
          button(ctx, "レビュー記録をMarkdownで保存", () => ctx.download("ai-artifact-review.md", aiReport(data), "text/markdown;charset=utf-8"))),
        feedback, reference);

      function showResult() {
        const flagged = new Set(draft.flagged);
        const expected = spec.checks.filter(([, , isConcern]) => isConcern);
        const matched = expected.filter(([id]) => flagged.has(id)).length;
        const missed = expected.filter(([id]) => !flagged.has(id)).map(([, label]) => label);
        const additional = spec.checks.filter(([id, , isConcern]) => !isConcern && flagged.has(id)).map(([, label]) => label);
        feedback.replaceChildren(
          note(ctx, "教材の要確認項目 " + matched + " / " + expected.length,
            "指摘内容を具体化するため、守る要件と試験の期待結果を改善案に追記しましょう。",
            missed.length ? "callout-warning" : "callout-success"),
          missed.length ? ctx.el("p", {}, "確認を追加 — " + missed.join("、")) : null,
          additional.length ? ctx.el("p", {}, "条件に照らして再評価 — " + additional.join("、")) : null);
      }
      function assess() {
        showResult();
        reference.open = true;
        if (!draft.evidence.trim() || !draft.revision.trim()) {
          feedback.append(ctx.el("p", {}, "レビューを成果物にするには、自分の根拠と改善案を記録してください。"));
          return;
        }
        draft.reviewed = true;
        ctx.save();
        ctx.recordArtifact("AI成果物レビュー", aiReport(data));
        ctx.complete();
      }
      mount.replaceChildren(panel(ctx, spec.title, note(ctx, "照合する案件条件", spec.context),
        ctx.el("pre", {}, spec.draft)), review);
      if (draft.reviewed) showResult();
    }
    render();
  };

  function finalRows(plan, analysis) {
    const people = new Map(plan.people.map(person => [person.id, person.name]));
    return analysis.rows.filter(row => row.task.kind !== "group").map(row => [
      row.wbs, row.task.title, row.task.deliverable || "—", people.get(row.task.assignee) || "—",
      row.estimate == null ? "—" : row.estimate + " h", row.start || "未設定", row.end || "未設定",
      row.task.dependsOn.map(id => analysis.byId[id]?.wbs ?? id).join("、") || "—",
    ]);
  }

  const finalHeaders = ["WBS", "作業", "成果物", "担当", "予定工数", "開始", "終了", "前提"];

  function finalPlanText(plan, analysis) {
    const { summary } = analysis;
    const hours = Math.round(summary.estimate * 100) / 100;
    const days = Math.round(summary.estimate / 8 * 100) / 100;
    return hours + "時間（" + days + "人日、1人日8時間） · 期限 " + plan.deadline +
      " · 計画終了 " + (summary.finish || "未設定") + " · " + summary.taskCount + "タスク";
  }

  function finalReport(data, plan, analysis, includeRows = true) {
    const lines = ["# 最終演習 · 社内会議室予約", "",
      "## 案件の前提", "", finalCase.story, "", ...finalCase.conditions.map(text => "- " + text), ""];
    for (const { key, label } of finalFields) lines.push("## " + label, "", data[key]?.trim() ? md(data[key]) : "下書き未記入", "");
    lines.push("## WBS・工数見積・スケジュール", "", finalPlanText(plan, analysis), "",
      ...plan.people.map(person => "- " + md(person.name) + " " + person.rate + "%"));
    if (includeRows) {
      const rows = finalRows(plan, analysis);
      lines.push("", "| " + finalHeaders.join(" | ") + " |", "| " + finalHeaders.map(() => "---").join(" | ") + " |",
        ...rows.map(row => "| " + row.map(mdCell).join(" | ") + " |"), "",
        "### 日程・割当の確認事項", "", ...analysis.issues.map(issue => "- " + md(issue.message)));
    }
    return lines.join("\n") + "\n";
  }

  function artifactSize(markdown, summary) {
    return markdown.length > 80_000 ? summary : markdown;
  }

  lab.chapters["12"] = function finalChapter(ctx) {
    const data = ctx.state.answers[ctx.id] ??= Object.fromEntries(finalFields.map(({ key }) => [key, ""]));
    const feedback = status(ctx);
    const plan = ctx.state.plans.final;
    const analysis = lab.plan.analyzePlan(plan);
    const samplePlan = lab.plan.samplePlan("final");
    const sampleAnalysis = lab.plan.analyzePlan(samplePlan);
    const sampleDocuments = Object.fromEntries(finalFields.map(({ key, sample }) => [key, sample]));
    const sample = details(ctx, "模範的な計画例と比較する",
      ctx.el("p", {}, "会議室予約の初回公開向けに選んだ一例です。利用規模、責任者、予算、権限が変わると判断も変わります。"),
      ctx.table(["成果物", "記入例"], finalFields.map(({ label, sample: example }) => [label, example]), "計画の記入例"),
      note(ctx, "WBS・工数・期間", finalPlanText(samplePlan, sampleAnalysis)),
      ctx.table(finalHeaders, finalRows(samplePlan, sampleAnalysis), "予備日・受入・リリースを含むWBSの例"),
      button(ctx, "模範計画をMarkdownで保存", () => ctx.download("meeting-room-plan-example.md",
        finalReport(sampleDocuments, samplePlan, sampleAnalysis), "text/markdown;charset=utf-8")));
    ctx.root.append(
      panel(ctx, finalCase.name,
        tags(ctx, "最終演習の新規案件", "6週間", "2名"),
        ctx.el("p", {}, finalCase.story), bullet(ctx, finalCase.conditions),
        note(ctx, "始める順序", "総務と利用者に確認する論点を整理し、初回の業務範囲、受入、設計と試験、依存と工数、公開判断を順に決めます。")),
      panel(ctx, "自分の計画書を作る", ctx.el("div", { class: "pl-practice-final-fields" },
        ...finalFields.map(({ key, label, hint }) => field(ctx, label, textInput(ctx, data[key], text => {
          data[key] = text;
          feedback.replaceChildren();
          ctx.save();
        }, { rows: 4 }), hint)))),
      panel(ctx, "最終演習用のWBS・工数・日程",
        note(ctx, "現在の計画", finalPlanText(plan, analysis)),
        analysis.summary.taskCount
          ? ctx.table(finalHeaders, finalRows(plan, analysis), "作成したWBSとスケジュール")
          : ctx.el("p", { class: "muted" }, "作業の内訳が未登録です。ここから開くWBSには、問い合わせ案件と独立して計画を保存できます。"),
        ctx.el("div", { class: "actions" },
          button(ctx, "最終演習用WBSを開く", () => choosePlan(ctx, "06", "final"), "primary"),
          button(ctx, "最終演習用の見積を開く", () => choosePlan(ctx, "07", "final")),
          button(ctx, "最終演習用のガントを開く", () => choosePlan(ctx, "08", "final")))),
      panel(ctx, "仕上がりを確認して出力する",
        ctx.el("div", { class: "actions" },
          button(ctx, "計画を確認して成果物に保存", assess, "primary"),
          button(ctx, "最終計画 Markdown", () => ctx.download("meeting-room-plan.md", finalReport(data, plan, analysis), "text/markdown;charset=utf-8")),
          button(ctx, "WBS CSV", () => ctx.download("meeting-room-wbs.csv", lab.plan.exportCsv(plan), "text/csv;charset=utf-8")),
          button(ctx, "最終計画 JSON", () => exportJson())),
        feedback, sample));

    function exportJson() {
      const payload = { version: 1, project: finalCase.name, documents: data, plan, calculated: analysis.summary };
      ctx.download("meeting-room-plan.json", JSON.stringify(payload, null, 2), "application/json");
    }
    function assess() {
      const gaps = finalFields.filter(({ key }) => !data[key].trim()).map(({ label }) => label + "を追記する。");
      if (!analysis.summary.taskCount) gaps.push("最終演習用のWBSに、成果物を完了できる作業と担当を追加する。");
      if (analysis.summary.unscheduled) gaps.push("開始・終了が確定していないタスク " + analysis.summary.unscheduled + " 件を見直す。");
      if (analysis.summary.taskCount && !analysis.summary.estimate) gaps.push("作業ごとに根拠と予定工数を入力する。");
      if (gaps.length) {
        feedback.replaceChildren(note(ctx, "下書きで確認すること", "該当箇所を修正すると計画の関係を確認できます。", "callout-warning"), bullet(ctx, gaps));
        return;
      }
      const warningNotes = analysis.issues.filter(issue => issue.severity === "warning");
      const trace = /BR-\d{3}/i.test(data.requirements) && /BR-\d{3}/i.test(data.functions)
        ? "要件IDと機能を照合する記載があります。各要件に受入と試験の対応を確認してください。"
        : "要件と機能に共通するIDを付けると、影響する画面と試験を追えます。";
      feedback.replaceChildren(
        note(ctx, "計画の構成を確認しました",
          trace + " 技術選定の妥当性と公開可否は、模範例と案件条件を照合してください。",
          warningNotes.length ? "callout-warning" : "callout-success"),
        warningNotes.length ? bullet(ctx, warningNotes.slice(0, 6).map(issue => issue.message)) : null);
      const markdown = finalReport(data, plan, analysis);
      ctx.recordArtifact("最終演習の計画書", artifactSize(markdown, finalReport(data, plan, analysis, false)));
      ctx.complete();
    }
  };

  lab.dashboardExtras = function dashboardExtras(state) {
    const register = state.answers["10"];
    const riskEntries = register?.risks.length ? register.risks : registerSamples.risks;
    const issueEntries = register?.issues.length ? register.issues : registerSamples.issues;
    const risks = riskEntries.filter(item => item.status !== "done")
      .slice().sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 4)
      .map(item => (register?.risks.length ? item.id : "記入例 " + item.id) + " " + item.title + "（" + item.due + "）");
    const issues = issueEntries.filter(item => item.status !== "done").slice(0, 4)
      .map(item => (register?.issues.length ? item.id : "記入例 " + item.id) + " " + item.title + "（" + item.owner + "）");
    const response = state.answers["09"];
    const current = events.find(event => event.id === response?.selected);
    if (current && response.drafts[current.id]?.choice >= 0 && !response.drafts[current.id].reviewed) {
      issues.unshift("対応の確認待ち " + current.title);
    }
    return { risks, issues };
  };

  lab.data.practice = { eventIds: events.map(event => event.id), registerSamples, finalCase };
})();
