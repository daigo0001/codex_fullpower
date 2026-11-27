(() => {
  "use strict";

  const lab = globalThis.PLLab;
  const project = {
    title: "社内問い合わせ管理システムの新規開発",
    start: "2026-12-01",
    deadline: "2027-02-26",
    sponsor: "業務企画部・社内問い合わせ窓口",
    team: [
      { name: "PL", role: "要求整理、合意形成、品質・リリース判定" },
      { name: "アプリ担当", role: "画面、API、DB、結合試験" },
      { name: "基盤・QA担当", role: "Azure、連携、配備、試験設計" },
    ],
    context: [
      "経費・総務・ITへの社内問い合わせをメールと表計算で受付中。窓口は受信箱から依頼を転記して担当を決め、申請者にはメールで回答します。",
      "問い合わせ窓口のヒアリング、依頼を割り当てる場面の観察、個人情報を除いた10営業日の受付記録を、要求整理の材料にします。",
      "教材の顧客回答・利用規模・受付記録はすべて架空です。仮説や数値は実案件で再確認し、要件に根拠を添えます。",
    ],
    problems: [
      { fact: "窓口の朝会を2回観察すると、複数人が同じ未割当のメールを開いていた。", effect: "担当者と状態が共有されるまで、二重対応や確認待ちが起きる。", evidence: "窓口2名の実演、引継ぎメモ" },
      { fact: "10営業日で540件の受付があり、状況確認の追加メールが78件あった。", effect: "申請者が進捗を知らず、窓口が同じ回答を繰り返す。", evidence: "個人情報を除いた件数集計" },
      { fact: "窓口が社員名・所属を台帳へ手入力している。", effect: "所属変更が反映されず、引継ぎの宛先を誤ることがある。", evidence: "入力手順と社員マスターの項目一覧" },
    ],
    goal: "申請者は自分の問い合わせの状態を確認でき、窓口は未割当の案件を把握して担当者と状態を更新できる。",
    success: [
      "受入試験で申請者と窓口が登録から終了までを通し、誰がいつ状態を変えたか照合できる。",
      "公開1か月後、業務責任者が10営業日あたりの状況確認メールの件数を比較する。初回の目安は78件の半分以下とし、受付総数の変化も併記する。",
    ],
    roles: [
      { name: "申請者", scope: "自分の問い合わせの登録・参照、自分の新規案件の編集" },
      { name: "窓口担当", scope: "受付対象の問い合わせの検索・詳細参照、担当者割当、状態変更" },
      { name: "管理者", scope: "窓口操作、初回公開の同期結果と自分のアクセス権を確認" },
    ],
    constraints: [
      "開発期間は2026-12-01〜2027-02-26。PL込み3名で、稼働率と顧客確認待ちは実働と分けて計画する。",
      "ASP.NET Core、Azure App Service、Azure SQL、Microsoft Entra ID、GitHub Actionsを使う想定。ネットワークや権限の申請期限と技術選定理由を別途確認する。",
      "社員マスターの連携は既存システム責任者が承認したHTTPSの読み取り専用境界。初回は毎日02:00 JSTに同期し、リハーサルでは架空データを使う。",
      "社員・問い合わせの識別情報はアクセスを限定し、動作確認には合成データを使う。実施予算、データ保存期間、既存契約、監視当番の確定は業務・基盤責任者に確認する。",
    ],
    milestones: [
      { date: "2026-12-11", title: "要求・範囲の合意" },
      { date: "2027-01-08", title: "設計レビュー" },
      { date: "2027-02-05", title: "機能統合" },
      { date: "2027-02-19", title: "顧客受入" },
      { date: "2027-02-26", title: "初回公開" },
    ],
    glossary: [
      ["要求", "利用者が解決したい困りごとや実現したい結果。まず背景と根拠を集める。"],
      ["要件", "範囲・条件・確認方法について合意した約束。設計と試験に引き継ぐ。"],
      ["受入条件", "利用者や承認者が、成果物が約束を満たしたか判断できる観測結果。"],
      ["PL", "プロジェクトリーダー。判断材料を集め、担当・期限・品質を調整する。"],
    ],
  };

  const questions = [
    {
      id: "users", title: "誰が使い、誰の問い合わせを参照・変更できるか",
      answer: "申請者・窓口担当・管理者の3ロール。申請者は自分の案件のみ参照し、新規の間だけ編集できます。窓口と管理者は受付範囲を参照し、割当・状態を変更します。",
      reason: "画面の表示範囲と、サーバー側のロール・案件単位の認可要件を分けるため。",
      omission: "一覧が制限されていても、詳細や更新の処理で他人の案件まで扱える設計になる。",
    },
    {
      id: "volume", title: "利用者数、ピーク、データ量、主な操作の比率はどれくらいか",
      answer: "対象社員は600人、窓口12人。月曜9時台は30人同時を当初の検証条件とし、一覧・詳細の読み取りは80%。負荷試験は合成1万件を使います。運用後の実績で条件を見直します。",
      reason: "応答目標を操作・データ量・ピーク条件と結び付け、負荷試験を再現できるようにするため。",
      omission: "「十分速い」の判断が担当ごとに変わり、実利用の検索条件やピークを見落とす。",
    },
    {
      id: "value", title: "どの業務を改善したくて、何が現状の根拠になるか",
      answer: "割当前の二重対応と、申請者からの状況確認を減らしたい。窓口の操作を観察し、10営業日の受付540件、状況確認78件を基準にします。",
      reason: "効果と受入時の利用シナリオを決め、改善と結び付く機能を優先するため。",
      omission: "要望の件数に流されて集計画面を先に作り、受付・割当の問題が残る。",
    },
    {
      id: "integration", title: "既存システム連携の契約、所有者、失敗時の扱いは何か",
      answer: "既存システム責任者が許可した読み取り専用HTTPSで、社員ID・表示名・所属・有効状態を毎日02:00 JSTに取得。失敗時は最終成功分を保持して担当者へ通知。ネットワークの接続手順は設計までに確認します。",
      reason: "接続の承認、検証データ、タイムゾーン、再実行時の重複防止に必要な作業を見積もるため。",
      omission: "承認待ちを見積もれず、タイムアウトで社員情報を失う、再実行で重複を作るなどの問題が出る。",
    },
    {
      id: "scope", title: "初回公開の範囲と次回に回せる機能は何か",
      answer: "ログイン、一覧・検索、詳細、登録・編集、割当・状態変更、管理者の同期確認、社員連携。添付・チャット・代理申請・モバイルアプリ・過去メール一括移行は次回候補です。",
      reason: "3か月で一連の業務を通せるよう、初回に不可欠な範囲と変更判断の基準を合意するため。",
      omission: "初回の完了条件が広がり、試験・運用準備の工数が押し出される。",
    },
    {
      id: "milestones", title: "いつまでに、誰が何を確認して承認するか",
      answer: "2027-02-26を初回公開枠とし、02-19の顧客受入までに正常・例外の記録をそろえます。窓口責任者が業務の受入、基盤責任者が配備・復旧を確認します。",
      reason: "顧客確認待ち・再レビュー・配備可能な曜日を期間と工数に分けるため。",
      omission: "作業が終わっても承認が間に合わず、配備枠に入れない。",
    },
    {
      id: "capacity", title: "予算、メンバーの稼働率、兼務・休暇の制約はあるか",
      answer: "PL込み3名で兼務があります。初期の計画仮定はPL60%、アプリ担当80%、基盤・QA担当60%。運用費の仮枠は月10万円。契約・実稼働と見積結果を確認して合意します。",
      reason: "名目人数と実際に使える時間の差、設計やクラウド費の判断基準を可視化するため。",
      omission: "3人全員を毎日割り当て、承認や既存業務との兼務を考慮しない計画になる。",
    },
    {
      id: "quality", title: "応答性能、アクセス制御、監査、復旧の合格条件は何か",
      answer: "30人同時で一覧・詳細はp95 1.5秒以内。状態変更にはロール・対象案件の認可と監査記録が必要。許容データ損失は1時間、復旧目標は4時間です。",
      reason: "性能測定、権限拒否の試験、DB復元の確認を受入に組み込むため。",
      omission: "機能試験だけが終わり、権限漏れやバックアップから戻せるかを公開直前まで判断できない。",
    },
    {
      id: "support", title: "障害時に誰が検知・復旧・周知し、どこへ連絡するか",
      answer: "運用当番が監視通知を受け、基盤担当が復旧を担当。窓口責任者が受付の継続判断と利用者周知を行う。営業時間外は既存の当番体制に従い、連絡先と代理を公開前に記録します。",
      reason: "アラートからエスカレーション、判断、業務の代替手段まで決めるため。",
      omission: "記録が残っていても、連携停止への対応や利用者への連絡が開始されない。",
    },
    {
      id: "acceptance", title: "正常時・競合時・失敗時に何を見れば業務を受け入れられるか",
      answer: "申請者が登録し、窓口が割当・状態を更新すると、本人の一覧と履歴に反映されます。同時に変更した場合は1件だけ成功、古い版は再読込。社員連携の失敗では直近のデータが使えます。",
      reason: "どの利用者が何を操作し、画面・応答・データ・監査のどれを確認するかを書けるため。",
      omission: "見た目の確認で受入を終え、データの重複更新や障害時の継続が検証されない。",
    },
  ];

  const requirements = [
    { id: "BUS-001", kind: "business", title: "窓口の二重対応を減らす", description: "窓口は未割当を一覧で把握し、受付時に担当を確定する。件数集計と業務観察を根拠とする。", acceptance: "受入で窓口2名が同じ案件を確認し、担当確定後に一覧・詳細・監査の結果が一致する。", screen: "SCR-01, SCR-02", api: "API-02, API-06", test: "T-002, T-005" },
    { id: "BUS-002", kind: "business", title: "状況確認の連絡を減らす", description: "申請者は本人の問い合わせの状態を自分で把握できる。公開後の10営業日で状況確認件数を観測する。", acceptance: "受入で申請者が自分の一覧で状態を確認できる。公開後の改善目標は現状78件の半分以下とし、受付総数と併記する。", screen: "SCR-01, SCR-02", api: "API-02, API-03", test: "T-002, T-003" },
    { id: "REQ-001", kind: "functional", title: "社員としてログイン", description: "許可されたテナントのMicrosoft Entra IDで認証し、アプリのロールに基づいて許可する。", acceptance: "許可済み社員は一覧へ進む。ロールのない社員は操作を拒否され、未認証のAPIは401になる。", screen: "SCR-00", api: "API-01", test: "T-001" },
    { id: "REQ-002", kind: "functional", title: "問い合わせ一覧と検索", description: "タイトル・状態・担当者をAND条件で絞り込み、更新日時の降順で20件ずつ表示する。同時刻の並び順は問い合わせIDで安定させる。", acceptance: "条件に合う21件を用意すると1ページ目に20件、次に1件表示する。申請者の結果は本人案件に限定し、0件なら条件解除を案内する。", screen: "SCR-01", api: "API-02", test: "T-002" },
    { id: "REQ-003", kind: "functional", title: "問い合わせ詳細と履歴", description: "本文、担当者、現在状態と状態履歴を参照する。対象案件の閲覧可否を毎回サーバーで確認する。", acceptance: "自分の案件で状態と履歴を確認できる。申請者の閲覧範囲外と存在しないIDには404を返し、詳細を返さない。", screen: "SCR-02", api: "API-03", test: "T-003" },
    { id: "REQ-004", kind: "functional", title: "問い合わせ登録・編集", description: "タイトル・本文を使って本人の問い合わせを登録し、本人の新規案件だけを編集できる。", acceptance: "許可された登録は201で新規になる。タイトルは1〜100文字、本文は1〜2000文字とし、空欄・超過は更新せず項目ごとに理由を返す。", screen: "SCR-03", api: "API-04, API-08", test: "T-004" },
    { id: "REQ-005", kind: "functional", title: "担当者割当・状態変更", description: "窓口担当と管理者は担当者の割当、許可された状態遷移（新規→対応中→解決→終了）を行う。変更と履歴を一体で確定する。", acceptance: "対応中の案件に同じIf-Matchで2件の変更を送ると片方は200、古くなった片方は412。If-Matchなしは428。許可外の操作や遷移で履歴を増やさない。", screen: "SCR-02", api: "API-05, API-06", test: "T-005" },
    { id: "REQ-006", kind: "functional", title: "管理者による同期・アクセス確認", description: "管理者が社員同期の実行結果と、自分の認証済みクレームから導出された権限を参照する。ロール変更は既存のEntra管理手順で行う。", acceptance: "管理者が直近の成功・失敗、および自分の権限を確認できる。申請者と窓口担当は管理APIの結果を受け取らない。", screen: "SCR-04", api: "API-07, API-09", test: "T-006" },
    { id: "REQ-007", kind: "functional", title: "社員マスターの日次連携", description: "既存の社員マスターを02:00 JSTに承認済みHTTPSで読み取る。社員IDで照合し、同じ入力の再実行で重複しない。", acceptance: "同一の連携入力を2回処理して社員IDは1件のまま。失敗時は最終成功分を保持し、次の勤務開始までに失敗を把握できる。", screen: "SCR-04", api: "EXT-01", test: "T-007" },
    { id: "NFR-001", kind: "nonfunctional", title: "応答性能", description: "ステージングで合成問い合わせ1万件、30人相当、一覧・詳細の比率80%のシナリオを15分間実行する。", acceptance: "サーバーが扱う一覧と詳細の応答時間を操作別に集計し、どちらもp95が1.5秒以内。候補版・条件・集計範囲を記録する。", screen: "SCR-01, SCR-02", api: "API-02, API-03", test: "T-008" },
    { id: "NFR-002", kind: "nonfunctional", title: "認可と監査", description: "認証とロールに加えて対象を確認する。変更の時刻・操作・対象ID・操作者ID・結果を記録し、本文やトークンは記録しない。", acceptance: "ロール不足と本人外の参照・更新を拒否し、変更履歴の確認は許可された役割に限る。合成の本文・資格情報がログに含まれない。", screen: "SCR-02, SCR-04", api: "API-03, API-05, API-07", test: "T-003, T-005, T-009" },
    { id: "NFR-003", kind: "nonfunctional", title: "バックアップと復旧", description: "アプリまたはデータの単独障害で、許容データ損失は1時間以内（RPO）、想定障害から業務再開まで4時間以内（RTO）。ゾーン・リージョン全体の障害は別に合意する。", acceptance: "隔離環境への復元試験で最終有効更新の時刻、再開確認の時刻、件数・参照・状態遷移を記録する。", screen: "SCR-01, SCR-02", api: "API-02, API-05", test: "T-010" },
  ];

  const artifacts = {
    screens: {
      label: "画面一覧",
      columns: ["画面ID", "画面", "役割と概要", "要件"],
      rows: [
        ["SCR-00", "サインイン", "社員。Entra認証を開始し、戻り先を確認", "REQ-001"],
        ["SCR-01", "問い合わせ一覧", "申請者は本人分、窓口・管理者は受付範囲を検索", "REQ-002"],
        ["SCR-02", "問い合わせ詳細", "閲覧・履歴と権限に応じた割当・状態変更", "REQ-003, REQ-005"],
        ["SCR-03", "登録・編集", "申請者が登録し、本人の新規案件を編集", "REQ-004"],
        ["SCR-04", "管理者画面", "同期結果と管理者本人の権限を確認", "REQ-006, REQ-007"],
      ],
      hint: "画面ID｜画面名｜アクセスできる役割｜主な操作｜要件ID",
    },
    useCases: {
      label: "ユースケース一覧",
      columns: ["ID", "利用者と目的", "正常な結果", "例外と扱い"],
      rows: [
        ["UC-01", "申請者が問い合わせる", "新規、未割当で担当者の一覧に入る", "入力不正は値を保持し、項目に理由を示す"],
        ["UC-02", "窓口が割当・対応する", "担当と状態が更新され、履歴が付く", "競合は412。最新の状態を確認して判断し直す"],
        ["UC-03", "申請者が進捗を見る", "自分の案件の状態を確認する", "0件は条件を解除できる。本人外の詳細は404"],
        ["UC-04", "管理者が同期を点検する", "前回成功と最新結果、件数が分かる", "失敗は連携担当へ引き継ぎ、利用中の社員データを保持"],
      ],
      hint: "利用者｜目的｜開始条件｜正常な終点｜例外が起きたとき",
    },
    flow: {
      label: "業務フロー",
      columns: ["順序", "役割", "操作・判断", "残る結果"],
      rows: [
        ["1", "申請者", "問い合わせを登録", "新規・未割当として受付"],
        ["2", "窓口担当", "未割当を確認し担当を選ぶ", "担当が確定して窓口に共有"],
        ["3", "窓口担当", "対応中→解決へ変更", "状態と監査が確定。競合は確認して再判断"],
        ["4", "窓口担当", "回答済みと確認して終了", "状態と履歴を保存"],
        ["5", "申請者", "本人の一覧と詳細を確認", "状況確認メールの代わりに進捗を参照"],
      ],
      hint: "誰が何を受け取り、どんな判断をして次の役割へ渡すか",
    },
    acceptance: {
      label: "受入条件",
      columns: ["ID", "前提・操作", "期待する観測結果", "確認者"],
      rows: [
        ["AC-01", "申請者が新規登録し、窓口が担当と状態を変更", "申請者の一覧・詳細と窓口側の履歴に反映", "窓口責任者"],
        ["AC-02", "同じ版の案件を別の窓口2人が同時更新", "200と412が1回ずつ。状態・履歴の更新は1件", "QA・窓口責任者"],
        ["AC-03", "本人外の詳細および管理画面を開く", "本人外の詳細は404。管理ロールを持たない操作は拒否", "QA・基盤責任者"],
        ["AC-04", "社員マスターが一時的に応答しない", "最終成功データを保持し、窓口と運用が異常を確認", "連携責任者"],
      ],
      hint: "前提｜誰がどの操作をするか｜画面・応答・データの期待結果｜確認者",
    },
    scope: {
      label: "対象範囲・対象外",
      columns: ["区分", "内容", "判断の根拠"],
      rows: [
        ["初回の対象", "ログイン、一覧・検索、詳細、登録・編集、割当・状態変更、管理者の確認、社員連携", "受付から終了までが社内で一貫して完了する"],
        ["対象外", "チャット、通知強化、添付、代理申請、ネイティブアプリ、過去メール一括移行", "初回の業務経路に必須でない。効果や扱うデータの条件を観測して次回判断"],
      ],
      hint: "初回に含む機能｜対象外にする候補｜その理由と再検討する条件",
    },
    constraints: {
      label: "制約条件",
      columns: ["分類", "条件", "確認する人"],
      rows: [
        ["期限と人員", "2027-02-26公開、PL込み3人。実稼働で再計画", "PL・各担当"],
        ["既存連携", "承認済みHTTPS・読み取り専用・毎日02:00 JST", "既存システム責任者"],
        ["データ", "合成データで検証。アクセスと保存期間は社内規程を確認", "データ管理・基盤責任者"],
        ["技術", "ASP.NET Core、App Service、Azure SQL、Entra ID、GitHub Actions", "基盤担当・運用責任者"],
      ],
      hint: "期限・予算・稼働・既存契約・技術・データ保護の制約と確認先",
    },
  };

  lab.data.project = project;
  lab.data.interviewQuestions = questions;
  lab.data.requirements = requirements;
  lab.data.requirementArtifacts = artifacts;

  const kindLabels = { business: "業務要件", functional: "機能要件", nonfunctional: "非機能要件" };
  const kindPrefixes = { business: "BUS", functional: "REQ", nonfunctional: "NFR" };
  const rowColumns = ["ID", "区分", "名称", "内容", "受入条件", "画面ID", "API・連携ID", "試験ID"];
  const fields = {
    title: { title: "要件名", max: 120 },
    description: { title: "成立する条件と機能", max: 1600 },
    acceptance: { title: "測定できる受入条件", max: 1600 },
    screen: { title: "画面ID", max: 160, placeholder: "SCR-02" },
    api: { title: "API・連携ID", max: 160, placeholder: "API-05, API-06" },
    test: { title: "試験ID", max: 160, placeholder: "T-005" },
  };

  function requireObject(value, label) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${label}はオブジェクト形式で指定します。`);
    }
  }

  function requireText(value, cap, label, required = false) {
    if (typeof value !== "string" || value.length > cap || (required && !value.trim())) {
      throw new Error(`${label}は${required ? "1〜" : ""}${cap}文字${required ? "" : "以内"}で指定します。`);
    }
    return value;
  }

  function validateInterview(value) {
    requireObject(value, "ヒアリング");
    if (!Array.isArray(value.selected) || value.selected.length > questions.length
      || new Set(value.selected).size !== value.selected.length
      || !value.selected.every(id => questions.some(question => question.id === id))
      || typeof value.reviewed !== "boolean") {
      throw new Error("ヒアリングの質問または確認状態が不正です。");
    }
    return {
      selected: value.selected,
      custom: requireText(value.custom, 800, "独自の質問"),
      next: requireText(value.next, 1600, "確認事項メモ"),
      reviewed: value.reviewed,
    };
  }

  function validateWorkspace(value) {
    requireObject(value, "要件定義");
    if (!Array.isArray(value.rows) || value.rows.length > 60 || typeof value.reviewed !== "boolean") {
      throw new Error("要件一覧は60件まで、確認状態は未確認か確認済みで指定します。");
    }
    requireObject(value.documents, "補助資料");
    const ids = new Set();
    const rows = value.rows.map(row => {
      requireObject(row, "要件");
      if (typeof row.id !== "string" || !/^(?:BUS|REQ|NFR)-(?!000)\d{3}$/.test(row.id)
        || ids.has(row.id) || typeof row.kind !== "string" || !Object.hasOwn(kindLabels, row.kind)) {
        throw new Error("要件IDまたは区分が不正です。IDは重複できません。");
      }
      ids.add(row.id);
      return {
        id: row.id,
        kind: row.kind,
        ...Object.fromEntries(Object.entries(fields).map(([key, field]) => [
          key,
          requireText(row[key], field.max, field.title, key === "title" || key === "description"),
        ])),
      };
    });
    const documents = Object.fromEntries(Object.entries(artifacts).map(([key, item]) => [
      key,
      requireText(value.documents[key], 3600, item.label),
    ]));
    if (value.nextIds !== undefined) requireObject(value.nextIds, "要件IDの採番");
    const nextIds = Object.fromEntries(Object.entries(kindPrefixes).map(([kind, prefix]) => {
      const minimum = highestRequirementId(rows, prefix) + 1;
      const next = value.nextIds === undefined ? minimum : value.nextIds[kind];
      if (!Number.isInteger(next) || next < minimum || next > 1000) throw new Error("要件IDの採番が不正です。");
      return [kind, next];
    }));
    return { rows, documents, reviewed: value.reviewed, nextIds };
  }

  lab.validators["01"] = validateInterview;
  lab.validators["02"] = validateWorkspace;

  function rawMarkdown(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function tableCell(value) {
    return rawMarkdown(value).replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\r\n|\r|\n/g, " ");
  }

  function markdownTable(headers, rows) {
    const render = cells => `| ${cells.map(tableCell).join(" | ")} |`;
    return [render(headers), render(headers.map(() => "---")), ...rows.map(render)].join("\n");
  }

  function rowValues(row) {
    return [row.id, kindLabels[row.kind], row.title, row.description, row.acceptance, row.screen, row.api, row.test];
  }

  function interviewMarkdown(answer) {
    const selected = questions.filter(question => answer.selected.includes(question.id));
    return [
      "# 顧客ヒアリング記録", "", project.title, "",
      "## 開始時に確認する質問と回答", "",
      selected.length ? markdownTable(["質問", "顧客回答", "確認理由"], selected.map(item => [item.title, item.answer, item.reason])) : "独自の質問と次の確認事項を記録。", "",
      "## 独自に追加する質問", "", rawMarkdown(answer.custom) || "（未記入）", "",
      "## 担当・期限と次の確認事項", "", rawMarkdown(answer.next) || "（未記入）", "",
    ].join("\n");
  }

  function requirementsMarkdown(workspace) {
    return [
      "# 社内問い合わせ管理システム 要件定義書", "",
      "## 要件・受入条件・トレーサビリティ", "",
      markdownTable(rowColumns, workspace.rows.map(rowValues)), "",
      ...Object.entries(artifacts).flatMap(([key, item]) => [
        `## ${item.label}`, "", rawMarkdown(workspace.documents[key]) || "（未記入）", "",
      ]),
    ].join("\n");
  }

  function recordRequirements(ctx, workspace) {
    const markdown = requirementsMarkdown(workspace);
    const dashboardLimit = 75_000;
    if (markdown.length <= dashboardLimit) {
      ctx.recordArtifact("要件定義書・追跡表", markdown);
      return;
    }
    const outline = [
      "# 要件定義書・追跡表の概要", "",
      "本文の全量は要件定義章の「自分の要件定義書を保存」から出力できます。", "",
      markdownTable(["ID", "区分", "名称"], workspace.rows.map(row => [
        row.id, kindLabels[row.kind], row.title,
      ])),
      "",
    ].join("\n");
    ctx.recordArtifact("要件定義書・追跡表", outline);
  }

  function labelInput(el, title, control) {
    return el("label", { class: "stack" }, el("span", {}, title), control);
  }

  function action(el, text, className, click) {
    return el("button", { type: "button", class: `button ${className}`, onClick: click }, text);
  }

  function saveMarkdown(ctx, filename, markdown) {
    ctx.download(filename, markdown, "text/markdown;charset=utf-8");
  }

  function scenarioPanel(ctx) {
    const { el, table } = ctx;
    return el("section", { class: "panel stack" },
      el("h2", {}, "窓口から届いた開発依頼"),
      el("blockquote", { class: "callout" }, "問い合わせをメールで管理していて、誰が対応しているか分かりにくい。春の業務引継ぎ前に、社内で使える画面にまとめたい。社員マスターは既存のものを使ってほしい。"),
      el("div", { class: "split" },
        el("div", { class: "stack" },
          el("h3", {}, "業務背景"),
          ...project.context.map(line => el("p", {}, line)),
        ),
        el("div", { class: "stack" },
          el("h3", {}, "依頼時点の前提"),
          el("ul", {}, ...project.constraints.map(line => el("li", {}, line))),
        ),
      ),
      table(["現状の観察", "業務への影響", "根拠"], project.problems.map(item => [item.fact, item.effect, item.evidence]), "困りごとを裏付ける記録"),
      el("div", { class: "split" },
        el("div", { class: "callout" }, el("strong", {}, "改善したいこと"), el("p", {}, project.goal)),
        el("div", { class: "callout" }, el("strong", {}, "効果の確かめ方"), el("ul", {}, ...project.success.map(line => el("li", {}, line)))),
      ),
      el("details", {},
        el("summary", {}, "想定する利用者・役割と用語"),
        table(["役割", "できること"], project.roles.map(role => [role.name, role.scope]), "利用者像"),
        el("dl", {}, ...project.glossary.flatMap(([term, meaning]) => [el("dt", {}, term), el("dd", {}, meaning)])),
      ),
    );
  }

  function interview(ctx) {
    const { root, el, table, state } = ctx;
    const answer = state.answers["01"] ??= { selected: [], custom: "", next: "", reviewed: false };
    const feedback = el("div", { class: "stack" });
    const notice = el("p", { role: "status", class: "muted" });
    const items = questions.map(item => el("input", { type: "checkbox", value: item.id, checked: answer.selected.includes(item.id) }));
    const custom = el("textarea", { rows: 3, maxlength: 800, placeholder: "例　新規・対応中・解決・終了を切り替えるのは誰で、例外時はどう戻しますか？" }, answer.custom);
    const next = el("textarea", { rows: 3, maxlength: 1600, placeholder: "確認する人・期限・回答後に決めることを記録。例　既存システム責任者へ12月8日までに疎通手順を確認。" }, answer.next);

    function readDraft() {
      const selected = items.filter(input => input.checked).map(input => input.value);
      const changed = selected.join(",") !== answer.selected.join(",") || custom.value !== answer.custom;
      answer.selected = selected;
      answer.custom = custom.value;
      answer.next = next.value;
      if (changed) answer.reviewed = false;
    }

    function renderFeedback() {
      feedback.replaceChildren();
      if (!answer.reviewed) return;
      const compared = (item) => [item.title, item.answer, item.reason, item.omission];
      const selected = questions.filter(item => answer.selected.includes(item.id));
      const remaining = questions.filter(item => !answer.selected.includes(item.id));
      if (selected.length) {
        feedback.append(el("h3", {}, "確認した質問への顧客回答"), table(["質問", "回答例", "確認する理由", "確認しなかった場合"], selected.map(compared), "架空の顧客ヒアリング"));
      }
      if (answer.custom.trim()) {
        feedback.append(el("div", { class: "callout" },
          el("h3", {}, "追加した質問の見直し"),
          el("p", {}, answer.custom),
          el("p", {}, "誰に答えてもらうか、いつまでに必要か、回答が変わるとどの設計・計画に影響するかを書き足してください。独自の質問は自分で見直します。"),
        ));
      }
      if (remaining.length) {
        feedback.append(el("details", {},
          el("summary", {}, `未確認の論点 ${remaining.length}件と影響を比較する`),
          table(["確認する質問", "回答例", "確認する理由", "抜けた場合の影響"], remaining.map(compared), "確認しておきたい論点"),
        ));
      }
      if (answer.next.trim()) {
        feedback.append(el("p", { class: "callout callout-success" }, "要件定義に引き継ぐメモを保存しました。事実、仮説、確認待ちが区別できるかを読み返します。"));
      }
      feedback.append(el("div", { class: "actions" },
        action(el, "ヒアリング記録を保存", "secondary", () => saveMarkdown(ctx, "interview-notes.md", interviewMarkdown(answer))),
        action(el, "要件定義へ進む", "secondary", () => ctx.go("02")),
      ));
    }

    const onDraftChanged = () => {
      const wasReviewed = answer.reviewed;
      readDraft();
      ctx.save();
      if (wasReviewed && !answer.reviewed) renderFeedback();
      if (wasReviewed && answer.reviewed) ctx.recordArtifact("顧客ヒアリング記録", interviewMarkdown(answer));
    };
    for (const input of [...items, custom, next]) input.addEventListener("change", onDraftChanged);
    const form = el("form", { class: "panel stack" },
      el("h2", {}, "あなたがPLなら、最初に何を聞くか"),
      el("p", {}, "開発範囲・計画・公開条件を変える情報を優先します。質問の選択と独自の質問をもとに、回答例と抜けた論点を比べられます。"),
      el("fieldset", { class: "field-grid" },
        el("legend", {}, "先に確認する質問"),
        ...questions.map((item, index) => el("label", { class: "interview-choice" }, items[index], el("span", {}, item.title))),
      ),
      labelInput(el, "独自に追加する質問", custom),
      labelInput(el, "確認事項・担当・期限のメモ", next),
      el("div", { class: "actions" }, el("button", { class: "button primary", type: "submit" }, "顧客回答・抜け漏れを確認")),
      notice,
      feedback,
    );
    form.addEventListener("submit", event => {
      event.preventDefault();
      readDraft();
      if (!answer.selected.length && !answer.custom.trim()) {
        notice.textContent = "質問を1件選ぶか、独自の質問を記入してください。";
        return;
      }
      answer.reviewed = true;
      ctx.save();
      ctx.recordArtifact("顧客ヒアリング記録", interviewMarkdown(answer));
      ctx.complete();
      notice.textContent = "確認結果を表示しました。追加で確かめたい点は質問とメモに書き足せます。";
      renderFeedback();
    });
    root.append(scenarioPanel(ctx), form);
    renderFeedback();
  }

  function traceTable(ctx, rows, caption) {
    return ctx.table(rowColumns, rows.map(rowValues), caption);
  }

  const traceIds = "REQ-005 → SCR-02 → API-05 → tickets.row_version・ticket_status_history → T-005";

  function examplesPanel(ctx) {
    const { el } = ctx;
    return el("section", { class: "panel stack" },
      el("h2", {}, "要求を実装と試験の約束に変える"),
      el("p", {}, "要求は利用者の達成したいことです。業務要件は業務の成果、機能要件はアプリでできる操作、非機能要件は性能・権限・復旧などの満たすべき水準を表します。"),
      el("div", { class: "split" },
        el("div", { class: "callout callout-warning" }, el("h3", {}, "確認できない書き方"), el("p", {}, "「検索機能を使いやすくする」だけでは、誰のどの操作を確認するか決まりません。")),
        el("div", { class: "callout callout-success" }, el("h3", {}, "観察できる書き方"), el("p", {}, "「タイトル・状態・担当者で絞り込み、更新順に20件ずつ表示する」。性能と権限の範囲、0件時や通信失敗時の結果も確認します。")),
      ),
      el("p", { class: "callout" },
        el("strong", {}, "要件から試験をたどる例 "), el("code", { class: "mono" }, traceIds),
        el("br", {}), "同じ版から2人が状態を更新し、200と412が各1回、履歴が1件だけ確定することを確認します。",
      ),
      el("details", {},
        el("summary", {}, "記入済みの完成例を読む"),
        traceTable(ctx, requirements, "業務・機能・非機能要件と追跡表"),
        ...Object.values(artifacts).map(item => ctx.table(item.columns, item.rows, item.label)),
      ),
    );
  }

  function interviewHandoff(ctx) {
    const { el, state, table } = ctx;
    const answer = state.answers["01"];
    if (!answer?.reviewed) return null;
    const confirmed = questions.filter(question => answer.selected.includes(question.id));
    return el("details", { class: "panel stack" },
      el("summary", {}, "ヒアリングから引き継いだ情報"),
      el("p", {}, "回答を読んで、要件にする約束と確認待ちの情報を分けます。"),
      confirmed.length ? table(["質問", "確認した回答例"], confirmed.map(question => [question.title, question.answer]), "01で確認した回答") : null,
      answer.custom.trim() ? el("p", {}, el("strong", {}, "追加の質問 "), answer.custom) : null,
      answer.next.trim() ? el("p", {}, el("strong", {}, "担当・期限のメモ "), answer.next) : null,
    );
  }

  function highestRequirementId(rows, prefix) {
    return rows.reduce((value, row) => row.id.startsWith(prefix) ? Math.max(value, Number(row.id.slice(4))) : value, 0);
  }

  function reviewChecks(workspace) {
    const checks = [];
    for (const [id, label] of Object.entries(kindLabels)) {
      if (!workspace.rows.some(row => row.kind === id)) checks.push(`${label}を少なくとも1件書きます。`);
    }
    for (const row of workspace.rows) {
      if (!row.acceptance.trim()) checks.push(`${row.id} に操作、条件、観察できる結果を書きます。`);
      else if (/使いやすい|十分(に)?速い|適切に|なるべく|必要に応じ/.test(row.acceptance)) checks.push(`${row.id} の受入条件を、担当者が同じ判断をできる具体的な操作や値にします。`);
      if (!/^T-\d{3}(?:\s*[,、]\s*T-\d{3})*$/.test(row.test.trim())) checks.push(`${row.id} の試験IDを確認します（例 T-005）。`);
      if (!row.api.trim() && !row.screen.trim()) checks.push(`${row.id} の画面、API、連携などの設計先を記録します。`);
    }
    for (const [key, item] of Object.entries(artifacts)) {
      if (!workspace.documents[key].trim()) checks.push(`${item.label}に確認済みの内容を書きます。未確定なら担当と期限を書けます。`);
    }
    return checks;
  }

  function requirementsExercise(ctx) {
    const { root, el, table, state } = ctx;
    const workspace = state.answers["02"] ??= {
      rows: [],
      documents: Object.fromEntries(Object.keys(artifacts).map(key => [key, ""])),
      reviewed: false,
      nextIds: { business: 1, functional: 1, nonfunctional: 1 },
    };
    const list = el("div", { class: "stack" });
    const feedback = el("div", { class: "stack" });
    const formMessage = el("p", { role: "status", class: "muted" });
    const formHeading = el("h3", {}, "要件を1件追加");
    const kind = el("select", { required: true }, ...Object.entries(kindLabels).map(([value, label]) => el("option", { value }, label)));
    let editing = "";
    const controls = Object.fromEntries(Object.entries(fields).map(([key, field]) => {
      const attrs = { maxlength: field.max, placeholder: field.placeholder, required: key === "title" || key === "description" };
      const input = key === "description" || key === "acceptance" ? el("textarea", { ...attrs, rows: 3 }) : el("input", { ...attrs, type: "text" });
      return [key, input];
    }));
    const documentControls = Object.fromEntries(Object.entries(artifacts).map(([key, item]) => [
      key, el("textarea", { rows: 3, maxlength: 3600, placeholder: item.hint }, workspace.documents[key]),
    ]));

    function renderReview() {
      feedback.replaceChildren();
      if (!workspace.reviewed) return;
      const checks = reviewChecks(workspace);
      feedback.append(el("div", { class: `callout ${checks.length ? "callout-warning" : "callout-success"}` },
        el("h3", {}, checks.length ? `見直す点 ${checks.length}件` : "記入と参照の確認を通過"),
        checks.length ? el("ul", {}, ...checks.map(check => el("li", {}, check))) : el("p", {}, "区分、受入条件、関連先、補助資料の記入を確認しました。業務担当との合意と実際の試験結果を確認します。"),
      ),
      el("p", {}, "確認は入力と試験IDの形式に基づきます。レビューでは性能の測り方、権限不足や通信失敗・競合時の挙動、対象外と未決事項の担当も比較します。"));
    }

    function resetForm() {
      editing = "";
      kind.value = "functional";
      for (const control of Object.values(controls)) control.value = "";
      formHeading.textContent = "要件を1件追加";
    }

    function markChanged() {
      workspace.reviewed = false;
      ctx.save();
      if (workspace.rows.length || Object.values(workspace.documents).some(value => value.trim())) {
        recordRequirements(ctx, workspace);
      }
      renderReview();
    }

    function editRequirement(row) {
      editing = row.id;
      kind.value = row.kind;
      for (const [key, control] of Object.entries(controls)) control.value = row[key];
      formHeading.textContent = `${row.id} を編集`;
      formMessage.textContent = "変更して「要件を保存」を押すと、同じ要件IDで更新します。";
      controls.title.focus();
    }

    function renderList() {
      list.replaceChildren();
      if (!workspace.rows.length) {
        list.append(el("p", { class: "muted" }, "要件はまだありません。まず一覧・検索などの操作を1件選び、完了の判断を書きます。"));
        return;
      }
      list.append(table([...rowColumns, "操作"], workspace.rows.map(row => [
        ...rowValues(row),
        el("div", { class: "actions" },
          action(el, "編集", "secondary", () => editRequirement(row)),
          action(el, "削除", "danger", () => {
            workspace.rows = workspace.rows.filter(item => item.id !== row.id);
            if (editing === row.id) resetForm();
            markChanged();
            renderList();
            formMessage.textContent = `${row.id} を削除しました。`;
          }),
        ),
      ]), "作成中の要件一覧・トレーサビリティ"));
    }

    const form = el("form", { class: "stack" },
      formHeading,
      el("div", { class: "field-grid" }, labelInput(el, "要件区分", kind), labelInput(el, fields.title.title, controls.title)),
      labelInput(el, fields.description.title, controls.description),
      labelInput(el, fields.acceptance.title, controls.acceptance),
      el("div", { class: "field-grid" }, ...["screen", "api", "test"].map(key => labelInput(el, fields[key].title, controls[key]))),
      el("div", { class: "actions" },
        el("button", { type: "submit", class: "button primary" }, "要件を保存"),
        action(el, "入力を取り消す", "secondary", () => {
          resetForm();
          formMessage.textContent = "";
        }),
      ),
      formMessage,
    );
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!controls.title.value.trim() || !controls.description.value.trim()) {
        formMessage.textContent = "要件名と成立する条件を書いてください。";
        return;
      }
      if (!editing && workspace.rows.length >= 60) {
        formMessage.textContent = "要件の保存は60件までです。";
        return;
      }
      const type = kind.value;
      const next = workspace.nextIds[type];
      if (!editing && next > 999) {
        formMessage.textContent = "この要件区分のIDは999件までです。登録済みの要件を編集できます。";
        return;
      }
      const row = {
        id: editing || `${kindPrefixes[type]}-${String(next).padStart(3, "0")}`,
        kind: type,
        ...Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value.trim()])),
      };
      if (editing) workspace.rows[workspace.rows.findIndex(item => item.id === editing)] = row;
      else {
        workspace.rows.push(row);
        workspace.nextIds[type] += 1;
      }
      resetForm();
      markChanged();
      renderList();
      formMessage.textContent = `${row.id} を保存しました。`;
    });
    resetForm();

    const supplemental = el("section", { class: "panel stack" },
      el("h2", {}, "要件を支える資料を作る"),
      el("p", {}, "箇条書きでも作れます。初回に必須の手順や権限、確認するデータを、要件IDと一緒に記録します。"),
      el("div", { class: "field-grid" }, ...Object.entries(artifacts).map(([key, item]) => {
        documentControls[key].addEventListener("change", () => {
          workspace.documents[key] = documentControls[key].value;
          markChanged();
        });
        return labelInput(el, item.label, documentControls[key]);
      })),
    );
    const reviewNotice = el("p", { role: "status", class: "muted" });
    const review = el("section", { class: "panel stack" },
      el("h2", {}, "レビューしてから書き直す"),
      el("div", { class: "actions" },
        action(el, "下書きをレビュー", "primary", () => {
          if (!workspace.rows.length) {
            reviewNotice.textContent = "先に要件を1件以上保存してください。";
            return;
          }
          workspace.reviewed = true;
          ctx.save();
          recordRequirements(ctx, workspace);
          ctx.complete();
          reviewNotice.textContent = "確認結果を表示しました。必要に応じて要件と資料を修正できます。";
          renderReview();
        }),
        action(el, "自分の要件定義書を保存", "secondary", () => saveMarkdown(ctx, "requirements-draft.md", requirementsMarkdown(workspace))),
        action(el, "画面設計の例へ進む", "secondary", () => ctx.go("03")),
      ),
      reviewNotice,
      feedback,
    );
    root.append(examplesPanel(ctx));
    const handoff = interviewHandoff(ctx);
    if (handoff) root.append(handoff);
    root.append(el("section", { class: "panel stack" }, el("h2", {}, "自分の要件一覧と追跡表"), form, list), supplemental, review);
    renderList();
    renderReview();
  }

  lab.chapters["01"] = interview;
  lab.chapters["02"] = requirementsExercise;
})();
