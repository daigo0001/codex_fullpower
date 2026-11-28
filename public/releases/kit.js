(() => {
  "use strict";

  const policy = `# リリース方針 ｜ 社内問い合わせ管理

初回公開後は毎週木曜14時にリリースする。変更がなければ公開枠を見送る。運用担当が公開に立ち会い、16時まで監視と切り戻しに対応できる日を選ぶ。

## 担当と作業単位

| 判断 | 担当 | 記録先 |
| --- | --- | --- |
| 何を今回公開するか | 業務担当と開発担当 | マイルストーンと各 Issue の受入条件 |
| マージできるか | 変更者とレビュアー | PR の差分、レビュー、必須チェック |
| 本番へ配れるか | 公開担当と運用担当 | 候補の実行記録、受入結果、Go 判定 |
| 公開後の状態は良好か | 運用担当 | 本番配備記録、確認時刻、業務結果 |

## ブランチの運用

1. デフォルトブランチは main。Issue ごとに短命ブランチを切る。Issue #42 は feat/42-status-conflict で作業し、PR #58 から main にマージする。
2. main に対する必須チェックは test-and-package。チームではレビュアーを割り当て、Issue の受入条件とテスト結果を照合してからマージする。採用できる保護ルールはリポジトリのプランと公開範囲で確認する。
3. 毎週木曜の候補にしたい main のコミットを選ぶ。run ID、成果物 ID、ダイジェストを控え、候補のコミットに RC タグを付ける。検証中に main が進んでも、配布する候補のコミットと成果物 ID は記録どおりに指定する。
4. 候補へ修正を入れる場合は、新しいコミットで候補を作り、次の RC 番号を付けて試験し直す。公開済みのタグは当時のコミットに固定する。

## 規模と頻度に合わせて決める

| 案件 | 作業ブランチと公開の基準 |
| --- | --- |
| ひとり・毎日 | 短命ブランチで PR を作り、自動チェックと自分の差分確認を残す。公開判断と配備結果を短い記録にまとめる。 |
| 3人・週次 | 短命ブランチで PR とレビューを回す。木曜公開は検証済み RC の同じ成果物を承認後に昇格する。 |
| 複数チーム・長い受入 | 機能追加を続ける main から release/1.4 を切り、検証期間だけ修正を取り込む。修正は main にも反映し、新候補で受入を繰り返す。 |
| 旧版に緊急修正 | 実際に本番で動く版のタグから修正ブランチを切る。旧版で動作を確認し、別の PR で main にも同等の修正を反映する。 |

## 版の決め方

このアプリは、公開 API と運用上約束した入出力を互換性の基準にする。互換性のない変更は MAJOR、互換な機能追加は MINOR、互換な修正は PATCH。状態変更 API-05 は v1.4.0 で初めて公開するため MINOR とした。既存の利用者が送信できていた要求に If-Match を新規で必須化する場合は、契約変更として新しい API 版または段階移行を計画する。

## 次回も使う記録

候補ごとに Issue、PR、コミット、試験、成果物の ID とダイジェスト、タグ、配備先、承認者、公開時刻を確認する。本番の稼働版はデプロイ履歴とアプリの実体から確認する。

GitHub 公式原稿とバージョン規則の確認日 2026-11-28。[GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) · [環境を管理する](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) · [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
`;

  const issueAndPr = `# Issue と PR の記入例 ｜ 問い合わせの状態変更

## Issue #42

**タイトル** ｜ 同じ版を見た窓口担当が別々に状態を変えたとき、古い更新を拒否する

**背景** ｜ 2人が同じ問い合わせ詳細を開くと、後から押した人が先の作業を上書きする可能性がある。初めて公開する状態変更 API に競合時の扱いを含め、確定した履歴と画面の表示を一致させる。

**今回の範囲** ｜ REQ-005 のうち、SCR-02 の状態変更、API-05 の条件付き更新、状態履歴・変更監査。担当者を割り当てる API-06 は対応する別 Issue で扱う。

| 条件 | 受入結果 | 試験 |
| --- | --- | --- |
| 同じ問い合わせを2人が同じ ETag で更新する | 200 と 412 が各1件。確定した状態履歴と変更監査は各1件。 | T-005-B |
| 画面で 412 を受ける | 保存できなかった旨と最新状態を読み直す操作を表示する。 | SCR-02 の受入 |
| If-Match を省く | 428。状態、履歴、監査は現状のまま。 | T-005-C |
| 許可されない状態遷移を選ぶ | 409。状態、履歴、監査は現状のまま。 | T-005-D |
| 申請者が閲覧可能な問い合わせの状態変更を試みる | 403。状態、履歴、監査は現状のまま。 | T-005-E |

**担当** ｜ アプリ担当。QA 担当が合成データの ETag と監査件数を照合。

**記録** ｜ WBS「状態変更の詳細設計と実装」に実装と試験を関連付ける。マイルストーンは v1.4.0、優先度は高、Projects の状態は Todo → In progress → In review → Ready to release → Released。

## PR #58

**タイトル** ｜ REQ-005 に状態変更 API と競合時の画面表示を追加

**マージ先** ｜ main（デフォルトブランチ）。

Closes #42

### 変更箇所と確認方法

- API-05 は窓口担当の権限と対象組織を確認し、If-Match を前提に tickets.row_version を条件として更新する。
- 状態、状態履歴、変更監査を同一トランザクションで確定する。競合時は 412 で応答する。
- SCR-02 は 412 を受けた場合に最新状態の読み込みを案内する。状態変更後に戻る操作も確認する。

### テストとレビューの記録例

| チェック | 結果 | 記録先 |
| --- | --- | --- |
| T-005-A〜F | 合格。競合時に 200・412 が各1件。途中失敗時に全変更を取り消した。 | PR の結合試験チェック |
| 操作確認 | 合成データ2件で最新状態の読み直しを確認。 | PR の画面記録 |
| 移行と切り戻し | 当該変更で追加する項目を、前版との互換性試験に含めた。 | Go/No-Go の記録 |

デフォルトブランチへのマージでリンク済み Issue が閉じる。今回の配備完了は Projects の Released と本番デプロイの記録で追う。release ブランチ向けの PR には Issue 番号を参照として残し、担当が合意済みの終了条件で状態を更新する。

GitHub 公式原稿の確認日 2026-11-28。[Pull request と Issue のリンク](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
`;

  const releaseNotes = `# リリース記録 v1.4.0 ｜ 問い合わせの状態変更

## 利用者への案内

問い合わせ詳細から窓口担当が状態を変更できるようになった。他の担当が同じ問い合わせを先に更新したときは最新状態を確認してから操作する。更新履歴で確定した変更を確認できる。

## 内容と影響

- REQ-005 のうち、SCR-02 からの状態変更と API-05 を提供する。Issue #42 と PR #58 が対応する。
- 初回公開する API-05 の書き込みには、取得した ETag を If-Match として付ける。競合は 412、欠落は 428。
- この公開で使うスキーマを前版でも確認済み。切り戻しの判断と復旧条件は release-runbook.md にある。

## 候補と本番の照合

| 記録項目 | 学習用の記入例 |
| --- | --- |
| ソースのコミット | A（9bf0c42）。PR #58 のマージ後のコミットを指す。 |
| 候補タグ → 正式タグ | v1.4.0-rc.1 → v1.4.0。両方ともソース A を指す。 |
| 配布成果物 | D1（sha256:8d…5e）。CI #510 で作成したコンテナイメージのダイジェストを指す。 |
| staging の受入記録 | D1 を使い、T-005-A〜F と前版互換性を確認。QA 担当が13時20分に記録。 |
| Go と production 配備 | 運用担当が14時に Go と判定。D1 を production に昇格。 |
| 配備後の確認 | 14時10分に主要操作、14時30分に 5xx・状態変更・変更監査を確認。運用担当が記録。 |
| 公開時の main の先頭 | B（b61f0d8）。別の Issue の変更を含む。今回選んだ候補は A。 |

実案件では A をコミットの完全な ID、D1 をレジストリに記録された完全なダイジェスト、CI #510 を実際の Actions run へのリンクに置き換える。Release へ添付したパッケージでも SHA-256 を記録する。配備先の版を照合してから Release を利用者に案内する。

## GitHub での操作順

1. 実行記録から候補のソースと成果物を決める。タグを作成するときは候補 A を明示して参照する。
2. v1.4.0-rc.1 の GitHub Release を作り、プレリリースに指定する。利用者向けの変更内容はここへ下書きしておく。
3. staging の受入と Go 判定後、正式タグ v1.4.0 を A に固定し、正式版の Release を下書きする。production には D1 を配備する。
4. 本番の稼働版と主要操作を確認する。紹介する変更と含まれる PR を照合して Release を公開し、Projects の公開状態と配備の参照先を更新する。

GitHub 公式原稿の確認日 2026-11-28。[リポジトリのリリースを管理する](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
`;

  const runbook = `# 公開判定と切り戻しの手順 ｜ v1.4.0

| 役割 | 当日の判断 |
| --- | --- |
| 開発担当 | 候補 A（9bf0c42）、成果物 D1（sha256:8d…5e）、前版 v1.3.4 の D0（sha256:29…1c）の参照先を提示する。 |
| QA 担当 | staging に配布した D1 と受入試験を照合し、既知の課題を挙げる。 |
| 運用担当 | 開始、停止、復旧を判断し、配備結果と利用者への連絡を記録する。 |

## Go の条件

- [ ] 候補 A と D1 が run、staging 配備、RC の記録で一致する。
- [ ] Issue #42 の T-005 と主要フローの受入結果が揃い、確認した候補に紐付いている。
- [ ] 旧版 D0 の格納先と、今回の変更後の DB で D0 が動くかの試験結果がある。
- [ ] DB 復旧手順と業務影響の承認者を確認した。監視の担当と公開後30分の確認枠を確保した。
- [ ] production の待機中ジョブに表示される候補・環境・実行記録を承認者が照合した。手動運用の場合は同じ記録を残した。

条件が未確認なら公開を保留する。たとえば T-005-B で履歴が2件増えた場合は、対応担当と次の試験時刻を Issue に記録し、次候補の検証へ進む。

## 配備と監視の記入例

1. 14時00分に運用担当が production への配備を承認し、検証した D1 を指定する。
2. 14時10分までにログイン、問い合わせ詳細、状態を1件だけ変更する確認を事前承認した本番確認用のレコードで行う。状態履歴と変更監査が各1件であることを確かめる。
3. 14時30分まで 5xx 件数、状態変更の成功率、履歴と監査の異常を確認する。通常の 412 は競合を防いだ結果として別に集計する。
4. この案件の判定例は「主要操作が連続2回失敗」「5xx が5分間に3件以上」「同一操作の履歴が二重に記録」のいずれか。確認時刻、比較期間、実際の数値を配備記録に残す。

## 停止・復旧の判断

| 確認した状態 | 行動 |
| --- | --- |
| アプリ変更が原因で、現スキーマで D0 の動作を確認済み | 配備を停止し、記録済みの前版 D0 を同じ環境に再配備する。利用者への案内を出し、主要操作と監査を確認する。 |
| D0 と現スキーマに互換性がない | 影響する書き込みを停止してデータを保全する。現スキーマ対応の修正版と、承認のうえで行うデータ復旧を比較する。 |
| データの損壊が疑われる | 更新時刻、該当 ID、監査ログを保存し、隔離した復元先で影響と失われる更新を確認する。業務責任者が復旧方針を承認する。 |

公開済みのタグと元の試験記録を保管する。追加の配備には別の時刻・実行 ID が付く。修正を公開するときは新しい版を付け、main の対応 Issue と PR に原因と再発防止を結び付ける。
`;

  const actions = `# GitHub Actions サンプル ｜ PR のテストと配布候補の作成

Codex Lab と同じように、公開ファイルが public/ にあり Node.js 24 の標準機能でテストできる静的アプリの例。リポジトリの .github/workflows/release-check.yml に置き、test-and-package を main の必須チェックの候補にする。依存パッケージがある案件ではロックファイルに合わせたインストール手順を追加する。

## 実行できる YAML

~~~yaml
name: Release check

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test-and-package:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: '24'
      - name: Run tests
        run: node --test
      - name: Package the tested commit
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          mkdir -p out
          tar -C public -czf out/site.tar.gz .
          (cd out && sha256sum site.tar.gz > site.tar.gz.sha256)
          git rev-parse HEAD > out/commit.txt
      - name: Upload candidate
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        id: candidate
        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6
        with:
          name: candidate-\${{ github.sha }}-\${{ github.run_attempt }}
          path: out/
          if-no-files-found: error
          retention-days: 14
      - name: Record the upload
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        env:
          ARTIFACT_ID: \${{ steps.candidate.outputs.artifact-id }}
          ZIP_DIGEST: \${{ steps.candidate.outputs.artifact-digest }}
        run: |
          printf 'Commit: %s\\nArtifact ID: %s\\nArchive digest: %s\\n' \\
            "$GITHUB_SHA" "$ARTIFACT_ID" "$ZIP_DIGEST" >> "$GITHUB_STEP_SUMMARY"
~~~

## 成果物を昇格するために足す設計

この YAML の到達点はテスト済み候補のアップロード。配備ジョブは、公開先に合わせて次の入出力を設計する。

| 工程 | 入力 | 終了時に記録すること |
| --- | --- | --- |
| staging | 保護したブランチで成功した workflow run ID と artifact ID。取得後に site.tar.gz.sha256 と commit.txt を照合する。 | テストしたファイルのダイジェストと受入結果。 |
| production | staging で検証済みと記録した同じ artifact ID とファイルのダイジェスト。 | 配備先、操作した人、ソースと実体の ID、確認時刻。 |
| 切り戻し | 最新の安全な前回配備に記録された実体。現行のデータと互換性があることを確認する。 | 参照した記録、復旧後の確認結果と業務影響。 |

候補の保管期限を、受入期間と切り戻し対応期間に合わせる。長期間保持する正式版は Release の添付ファイルやレジストリに保管する。成果物名の SHA はソース、out 内の SHA-256 は配布するファイル、upload-artifact の出力はアップロードされたアーカイブの同一性を確認する値として使い分ける。

PR は読み取り権限でテストする。クラウドへ配備する権限は信頼できる参照から動く配備ジョブに限定する。GitHub の環境ごとの保護設定と権限を確認し、OIDC 対応の公開先では配備ジョブに必要な範囲だけ資格情報を渡す。ジョブ間で昇格する場合は、ジョブの依存と環境の承認を記録する。

GitHub 公式原稿と Action のタグ参照の確認日 2026-11-28。[ワークフロー構文](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) · [起動イベント](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) · [upload-artifact](https://github.com/actions/upload-artifact)
`;

  globalThis.ReleaseLab.kit = [
    { id: "policy", title: "リリース方針", filename: "release-policy.md", description: "ひとり開発・週次公開・旧版保守でブランチと決定者を選ぶ。", markdown: policy },
    { id: "issue-pr", title: "Issue と PR の記入例", filename: "issue-pr-example.md", description: "REQ-005 から Issue #42・PR #58・受入テストをたどる。", markdown: issueAndPr },
    { id: "release-notes", title: "リリース記録", filename: "release-notes-v1.4.0.md", description: "RC から正式版まで、候補と配備の証拠を残す。", markdown: releaseNotes },
    { id: "runbook", title: "公開判定と切り戻し", filename: "release-runbook.md", description: "Go/No-Go、監視、旧版再配備とデータ復旧の判断をそろえる。", markdown: runbook },
    { id: "actions", title: "Actions ワークフロー例", filename: "release-check-actions.md", description: "PR テスト、main の候補作成、検証済み成果物の昇格を設計する。", markdown: actions },
  ];
})();
