(() => {
  const lab = globalThis.ReleaseLab ??= {};
  const branch = (label, commit) => ({ label, commit, kind: "branch" });
  const tag = (label, commit) => ({ label, commit, kind: "tag" });
  const deployed = (version, commit) => ({ label: version, commit, kind: "deployed" });

  const previousRelease = tag("v1.3.4", "base");
  const previousProduction = deployed("v1.3.4", "base");
  const candidateRelease = tag("v1.4.0-rc.1", "merge");
  const featureRelease = tag("v1.4.0", "merge");

  lab.graphCases = [
    {
      id: "feature",
      label: "機能追加",
      summary: "Issue #42 の状態変更機能を PR #58 で取り込みます。検証中に main が進んだ状態で、確認済みの候補を公開します。",
      lanes: [
        { id: "main", label: "main" },
        { id: "feature", label: "feat/42-status-conflict" },
      ],
      commits: [
        { id: "base", sha: "42dd7e1", lane: "main", column: 0, parents: [], title: "v1.3.4 の公開時点", description: "一覧・登録 API を提供する版です。図はこの公開時点からの履歴を抜粋しています。" },
        { id: "implementation", sha: "a2f3b11", lane: "feature", column: 1, parents: ["base"], title: "状態変更 API を追加", description: "REQ-005 に従い、If-Match の照合を含む新しい PATCH エンドポイントを実装します。" },
        { id: "tests", sha: "4c2fe80", lane: "feature", column: 2, parents: ["implementation"], title: "状態変更の試験を追加", description: "T-005 で同じ ETag を使った並行更新が成功 200 と競合 412 に分かれ、状態履歴と変更監査が各1件追加されることを確かめます。" },
        { id: "merge", sha: "9bf0c42", lane: "main", column: 3, parents: ["base", "tests"], title: "PR #58 をマージ", description: "マージコミットの第1親はそれまでの main、第2親は PR の先端です。マージ後の CI #510 が配備物 D1 を作ります。" },
        { id: "advance", sha: "b61f0d8", lane: "main", column: 4, parents: ["merge"], title: "次回向けの一覧変更", description: "今回の公開対象に含めていない変更です。main の先端は進み、検証した候補は元のコミットに留まります。" },
      ],
      steps: [
        { title: "現在の本番を確認", description: "main の先端と本番のソースは、どちらも v1.3.4 の 42dd7e1 です。", visible: ["base"], refs: [branch("main", "base"), previousRelease, previousProduction], focus: "base" },
        { title: "機能ブランチで実装", description: "main から短命ブランチを切り、Issue #42 の変更をコミットします。main と本番はこの時点では同じ場所に留まります。", visible: ["base", "implementation"], refs: [branch("main", "base"), branch("feat/42-status-conflict", "implementation"), previousRelease, previousProduction], focus: "implementation", command: "git switch -c feat/42-status-conflict main" },
        { title: "PR で差分と試験を確認", description: "試験を追加して PR #58 をレビューします。PR の CI で差分を検証し、受入条件を満たすことを確認します。", visible: ["base", "implementation", "tests"], refs: [branch("main", "base"), branch("feat/42-status-conflict", "tests"), previousRelease, previousProduction], focus: "tests" },
        { title: "マージして成果物を作成", description: "PR #58 を merge commit 方式で取り込みます。main は 9bf0c42 に進み、マージ後の CI #510 が D1（sha256:8d…5e）を生成します。機能ブランチの参照を削除しても、マージしたコミットの履歴は残ります。", visible: ["base", "implementation", "tests", "merge"], refs: [branch("main", "merge"), previousRelease, previousProduction], focus: "merge" },
        { title: "RC を固定して検証", description: "9bf0c42 に候補タグを付け、D1 をステージングに配備して受入試験を実施します。", visible: ["base", "implementation", "tests", "merge"], refs: [branch("main", "merge"), previousRelease, candidateRelease, previousProduction], focus: "merge", command: 'git tag -a v1.4.0-rc.1 9bf0c42 -m "Release candidate 1"' },
        { title: "検証中に main が進む", description: "次回の変更が入り、main は b61f0d8 を指します。候補タグとステージングで確認した D1 は同じ版を指し続けます。", visible: ["base", "implementation", "tests", "merge", "advance"], refs: [branch("main", "advance"), previousRelease, candidateRelease, previousProduction], focus: "advance" },
        { title: "検証済みの版を公開", description: "9bf0c42 に正式タグを付け、GitHub Release に照合記録を残します。本番もステージングで検証した D1 を指定し、配備後に主要操作と監視を確認します。", visible: ["base", "implementation", "tests", "merge", "advance"], refs: [branch("main", "advance"), previousRelease, candidateRelease, featureRelease, deployed("v1.4.0", "merge")], focus: "merge", command: 'git tag -a v1.4.0 9bf0c42 -m "Release v1.4.0"' },
      ],
      takeaway: "この図は merge commit 方式です。Squash merge では機能ブランチの差分をまとめた新しいコミットが main に1件でき、その親はマージ直前の main です。どちらの方式でも、公開にはマージ後に検証したコミットと成果物を使います。",
    },
    {
      id: "patch",
      label: "パッチ修正",
      summary: "本番 v1.4.0 の競合メッセージを修正します。v1.5 開発中の main を保守版から切り分け、公開後に同じ修正を main に取り込みます。",
      lanes: [
        { id: "main", label: "main" },
        { id: "maintenance", label: "release/1.4" },
        { id: "hotfix", label: "hotfix/61" },
        { id: "port", label: "port/61" },
      ],
      commits: [
        { id: "stable", sha: "9bf0c42", lane: "main", column: 0, parents: [], title: "本番 v1.4.0", description: "PR #58 で公開したコミットです。この図では v1.4.0 より前の親を省略しています。" },
        { id: "advance", sha: "b61f0d8", lane: "main", column: 1, parents: ["stable"], title: "v1.5 の開発が進む", description: "本番でまだ検証していない一覧とスキーマの変更を含みます。" },
        { id: "fix", sha: "4cb475e", lane: "hotfix", column: 2, parents: ["stable"], title: "競合メッセージを修正", description: "HTTP 412 を受けたときに再読み込みを案内します。既存の API 契約と状態変更の判定は続けて使えます。" },
        { id: "patch-release", sha: "bd3fc51", lane: "maintenance", column: 3, parents: ["stable", "fix"], title: "PR #63 を保守ブランチへ", description: "第1親は release/1.4 の v1.4.0、第2親は hotfix/61 の先端です。CI #562 が成果物 sha256:17…a6 を生成します。" },
        { id: "copy", sha: "a17de30", lane: "port", column: 4, parents: ["advance"], replayOf: "fix", title: "修正コミットを cherry-pick", description: "4cb475e の変更を b61f0d8 を親とする作業ブランチへ適用します。新しいコミットの親と SHA は元と異なります。" },
        { id: "port-merge", sha: "61e84ab", lane: "main", column: 5, parents: ["advance", "copy"], title: "PR #64 を main へ", description: "main の構成に合わせて回帰試験を通し、後続の版でも同じ不具合が再発しないようにします。" },
      ],
      steps: [
        { title: "本番のソースと実体を照合", description: "本番の配備履歴で v1.4.0 の 9bf0c42 と D1 を確認します。このケースでは release/1.4 が本番のコミットと一致しています。", visible: ["stable", "advance"], refs: [branch("main", "advance"), branch("release/1.4", "stable"), tag("v1.4.0", "stable"), deployed("v1.4.0", "stable")], focus: "stable" },
        { title: "本番タグから修正ブランチを作成", description: "v1.4.0 を起点に hotfix/61 を作り、競合時の案内を直します。このパッチの公開範囲は案内の修正です。", visible: ["stable", "advance", "fix"], refs: [branch("main", "advance"), branch("release/1.4", "stable"), branch("hotfix/61", "fix"), tag("v1.4.0", "stable"), deployed("v1.4.0", "stable")], focus: "fix", command: "git switch -c hotfix/61 v1.4.0" },
        { title: "保守ブランチで候補を作成", description: "PR #63 を release/1.4 に取り込み、bd3fc51 から作った成果物をステージングで確認します。この時点の main は b61f0d8、本番は v1.4.0 です。", visible: ["stable", "advance", "fix", "patch-release"], refs: [branch("main", "advance"), branch("release/1.4", "patch-release"), tag("v1.4.0", "stable"), deployed("v1.4.0", "stable")], focus: "patch-release" },
        { title: "パッチ版 v1.4.1 を公開", description: "互換性を保つ修正なので、この案件ではパッチ番号を上げます。承認後に同じ成果物を配備し、v1.4.0 のタグと成果物も保管します。", visible: ["stable", "advance", "fix", "patch-release"], refs: [branch("main", "advance"), branch("release/1.4", "patch-release"), tag("v1.4.0", "stable"), tag("v1.4.1", "patch-release"), deployed("v1.4.1", "patch-release")], focus: "patch-release", command: 'git tag -a v1.4.1 bd3fc51 -m "Release v1.4.1"' },
        { title: "修正の差分を main 向けに適用", description: "最新の main から port/61 を作り、通常コミット 4cb475e の差分を cherry-pick します。点線は修正元を示し、新しいコミットの親は main の b61f0d8 です。", visible: ["stable", "advance", "fix", "patch-release", "copy"], refs: [branch("main", "advance"), branch("release/1.4", "patch-release"), branch("port/61", "copy"), tag("v1.4.0", "stable"), tag("v1.4.1", "patch-release"), deployed("v1.4.1", "patch-release")], focus: "copy", command: "git switch -c port/61 main\ngit cherry-pick 4cb475e" },
        { title: "main の試験を通して PR をマージ", description: "PR #64 で main 側に修正を反映します。保守版の公開を別途維持しているため、本番は検証済みの v1.4.1 のままです。", visible: ["stable", "advance", "fix", "patch-release", "copy", "port-merge"], refs: [branch("main", "port-merge"), branch("release/1.4", "patch-release"), tag("v1.4.0", "stable"), tag("v1.4.1", "patch-release"), deployed("v1.4.1", "patch-release")], focus: "port-merge" },
      ],
      takeaway: "cherry-pick は既存コミットの変更を現在のブランチへ適用し、新しいコミットを作ります。main の構造が変わっていると競合が起きるため、差分と試験を確認します。同じ挙動を main 用に実装し直す方法もあります。",
    },
    {
      id: "revert",
      label: "リバート",
      summary: "v1.5.1 の内部設定変更で不具合が発生しました。先に本番を安定版に再配備し、Git では原因のマージを打ち消す変更を PR にします。",
      lanes: [
        { id: "main", label: "main" },
        { id: "tune", label: "fix/88-timeout" },
        { id: "revert", label: "revert/89-timeout" },
      ],
      commits: [
        { id: "base", sha: "56c03da", lane: "main", column: 0, parents: [], title: "安定版 v1.5.0", description: "既知の安定版のソースと、実際に配備していた成果物を記録しています。この図は v1.5.0 からを抜粋しています。" },
        { id: "setting", sha: "a140ce2", lane: "tune", column: 1, parents: ["base"], title: "照会のタイムアウト値を調整", description: "問い合わせ一覧のタイムアウトを短くした内部設定の変更です。" },
        { id: "regression", sha: "8d1a6c2", lane: "main", column: 2, parents: ["base", "setting"], title: "PR #88 をマージ", description: "第1親は変更前の main、第2親は修正ブランチの先端です。公開した v1.5.1 の実データではタイムアウトが増加しました。" },
        { id: "advance", sha: "f67da23", lane: "main", column: 3, parents: ["regression"], title: "監視の案内を更新", description: "リバート対象と独立した変更です。原因のマージを調べている間に main に入りました。" },
        { id: "inverse", sha: "e2c6a91", lane: "revert", column: 4, parents: ["advance"], revertOf: "regression", title: "マージの変更を打ち消す", description: "第1親の main を基準に PR #88 が持ち込んだ差分を逆向きに適用します。元のコミットと次回向けの監視の案内は履歴に残ります。" },
        { id: "merge", sha: "ac42f8e", lane: "main", column: 5, parents: ["advance", "inverse"], title: "リバート PR #90 をマージ", description: "問い合わせ一覧と監視の回帰試験を確認し、再公開用の成果物を作ります。" },
      ],
      steps: [
        { title: "影響と稼働版を特定", description: "本番 v1.5.1 で一覧の失敗率が上がりました。配備時刻、実体の識別子、影響する要求を照合し、原因を PR #88 の設定変更まで絞ります。", visible: ["base", "setting", "regression", "advance"], refs: [branch("main", "advance"), tag("v1.5.0", "base"), tag("v1.5.1", "regression"), deployed("v1.5.1", "regression")], focus: "regression" },
        { title: "既知の安定版を再配備", description: "DB スキーマに変更がなく、現行データと旧版の互換性を確認できたので、承認を得て保管済み v1.5.0 を配備します。この操作で変わるのは本番の配備記録です。Git の変更は次の手順で行います。", visible: ["base", "setting", "regression", "advance"], refs: [branch("main", "advance"), tag("v1.5.0", "base"), tag("v1.5.1", "regression"), deployed("v1.5.0", "base")], focus: "base" },
        { title: "現在の main からリバートを作る", description: "main から作業ブランチを切り、原因のマージをリバートします。-m 1 はマージの第1親を差分計算の基準にします。新しいコミットの親は作業開始時の main です。", visible: ["base", "setting", "regression", "advance", "inverse"], refs: [branch("main", "advance"), branch("revert/89-timeout", "inverse"), tag("v1.5.0", "base"), tag("v1.5.1", "regression"), deployed("v1.5.0", "base")], focus: "inverse", command: "git switch -c revert/89-timeout main\ngit revert -m 1 8d1a6c2" },
        { title: "差分を確認して PR を取り込む", description: "設定値が正しく戻り、独立した監視の変更が残ることを確かめます。リバートを PR #90 でマージし、最新の main を検証します。", visible: ["base", "setting", "regression", "advance", "inverse", "merge"], refs: [branch("main", "merge"), tag("v1.5.0", "base"), tag("v1.5.1", "regression"), deployed("v1.5.0", "base")], focus: "merge" },
        { title: "新しい版を検証して公開", description: "リバートを含む成果物を検証し、v1.5.2 として本番へ昇格します。既存のタグは当時の版を指し続けるため、障害時と復旧後のコードを追跡できます。", visible: ["base", "setting", "regression", "advance", "inverse", "merge"], refs: [branch("main", "merge"), tag("v1.5.0", "base"), tag("v1.5.1", "regression"), tag("v1.5.2", "merge"), deployed("v1.5.2", "merge")], focus: "merge" },
      ],
      takeaway: "Git のリバートは打ち消しを新しいコミットにします。通常コミットなら git revert <コミット> を使い、マージなら親の順序を確認します。後続変更が元の差分に依存している場合は競合や回帰を調べます。本番の再配備には DB 互換性と既存データの確認も必要です。機能を再導入するときは、修正版を作るか、リバート自体を打ち消すかを新しい PR で検討します。",
    },
  ];
})();
