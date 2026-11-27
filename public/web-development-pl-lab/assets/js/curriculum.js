(() => {
  const chapters = [
    { id: "00", title: "ダッシュボード", short: "現在地", group: "home", requires: [], aim: "工程のつながりとプロジェクトの現在地を確認する" },
    { id: "01", title: "プロジェクト開始・要求整理", short: "要求整理", group: "discovery", requires: [], aim: "曖昧な依頼から確認事項を組み立て、決まったことと未決事項を整理する" },
    { id: "02", title: "要件定義シミュレーター", short: "要件定義", group: "discovery", requires: ["01"], aim: "業務要求を、範囲・要件 ID・受入条件に置き換える" },
    { id: "03", title: "画面設計演習", short: "画面設計", group: "design", requires: ["02"], aim: "操作と業務ルールを、画面項目・イベント・権限・状態に割り当てる" },
    { id: "04", title: "基本設計・詳細設計演習", short: "基本・詳細設計", group: "design", requires: ["02"], aim: "要件から API、データ、実装時の判断、テストまでを追う" },
    { id: "05", title: "Azure インフラ設計演習", short: "基盤設計", group: "design", requires: ["02", "04"], aim: "公開経路、認証、秘密情報、復旧と費用を要件に合わせて設計する" },
    { id: "06", title: "WBS 作成演習", short: "WBS", group: "plan", requires: ["02", "03", "04", "05"], aim: "成果物と完了条件が説明できる単位まで仕事を分解する" },
    { id: "07", title: "工数見積シミュレーター", short: "工数見積", group: "plan", requires: ["06"], aim: "工数と期間を区別し、不確実性と根拠を残して見積もる" },
    { id: "08", title: "スケジュール作成シミュレーター", short: "スケジュール", group: "plan", requires: ["06", "07"], aim: "前提作業、担当者の稼働、待ち、納期を一つの計画にする" },
    { id: "09", title: "進捗管理・トラブル対応", short: "進捗・トラブル", group: "lead", requires: ["08"], aim: "想定外の出来事が起きたとき、影響と選択肢を説明して計画を直す" },
    { id: "10", title: "PL の管理業務", short: "管理と合意", group: "lead", requires: ["06"], aim: "課題・リスク・変更を、担当・期限・合意判断につなぐ" },
    { id: "11", title: "AI 成果物レビュー演習", short: "AI 成果物レビュー", group: "lead", requires: ["02", "04", "06"], aim: "もっともらしい成果物を要件・リスク・テストの根拠でレビューする" },
    { id: "12", title: "最終演習", short: "リリース・運用を含む最終演習", group: "lead", requires: ["08", "09", "10", "11"], aim: "別案件でリリースと運用までの計画を組み立てる" },
  ];

  const workflow = [
    { title: "要求・要件", chapters: ["01", "02"], output: "利用者・範囲・受入条件" },
    { title: "設計", chapters: ["03", "04", "05"], output: "画面・処理・データ・基盤" },
    { title: "開発計画", chapters: ["06", "07", "08"], output: "WBS・見積・担当・工程表" },
    { title: "実行・変更管理", chapters: ["09", "10", "11"], output: "変更記録・試験・品質判断" },
    { title: "リリース・保守", chapters: ["12"], output: "配布・切り戻し・運用引き継ぎ" },
  ];

  const milestones = [
    { date: "2026-12-11", title: "要件合意" },
    { date: "2027-01-08", title: "設計レビュー" },
    { date: "2027-02-05", title: "結合試験候補" },
    { date: "2027-02-19", title: "顧客受入" },
    { date: "2027-02-26", title: "公開判断" },
  ];

  globalThis.PLLab = {
    chapters: Object.create(null),
    validators: Object.create(null),
    data: Object.create(null),
    curriculum: { chapters, workflow, milestones },
  };
})();
