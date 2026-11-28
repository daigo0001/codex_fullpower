(() => {
  const lab = globalThis.ReleaseLab ??= {};
  const releaseSha = "9bf0c42";
  const releaseDigest = "sha256:8d…5e";
  const priorSha = "42dd7e1";
  const priorDigest = "sha256:29…1c";
  const hotfixSha = "bd3fc51";
  const hotfixDigest = "sha256:17…a6";

  const scenarios = {
    planned: {
      label: "定期リリース",
      summary: "REQ-005 の状態変更を含む v1.4.0 を出します。ステージングの候補を確認している間に main は先へ進みました。",
      initial: { source: "main · b61f0d8", candidate: "v1.4.0-rc.1 · " + releaseSha, artifact: releaseDigest, production: "v1.3.4 · " + priorSha, record: "Issue #42 · PR #58" },
      steps: [
        {
          title: "検証済みの候補を特定する",
          facts: [
            ["候補", "v1.4.0-rc.1 → " + releaseSha + "。CI #510 の成果物は " + releaseDigest + "。"],
            ["検証記録", "ステージングは " + releaseDigest + "。T-005 は更新成功と古い If-Match の 412 を確認済み。"],
            ["現在の main", "b61f0d8。候補の後に、今回の範囲外の一覧変更がマージされた。"],
          ],
          options: [
            { id: "verified", label: "SHA とダイジェストを照合し、CI #510 の候補を固定する", note: "候補タグ、テスト結果、ステージング配備の記録が同じコミットと成果物を指しています。", patch: { record: "CI #510 · T-005 合格 · 候補照合済み" } },
            { id: "latest", label: "main の最新コミットを今回の候補にする", note: "ステージングで確認したコミットと異なります。最新を出す方針なら、対象を見直して新しい候補を作り、検証からやり直します。" },
          ],
        },
        {
          title: "正式版を記録する",
          facts: [
            ["予定版", "追加機能を含む今回の正式版は v1.4.0。候補タグ v1.4.0-rc.1 は保存する。"],
            ["レビュー", "Issue #42 と PR #58 を公開ノートに記載。必要な運用上の注意と確認方法をまとめた。"],
            ["成果物保管", "CI #510 の成果物は承認期間中に取得可能。後日も戻せる保管先に昇格する。"],
          ],
          options: [
            { id: "release", label: "同じ SHA に v1.4.0 を付け、Release に検証記録と成果物の識別子を残す", note: "候補と正式タグが同じソースを指します。Release は版の記録となり、本番反映は承認された配備で実施します。", patch: { candidate: "v1.4.0 · " + releaseSha, record: "Release v1.4.0 · Issue #42 · PR #58 · CI #510" } },
            { id: "tag-main", label: "v1.4.0 を main の最新に付け、同じ版名で新規ビルドする", note: "名前が合っていてもコードと成果物が変わります。タグのリンク先と検証時のダイジェストを先に合わせます。" },
          ],
        },
        {
          title: "本番の承認と配備を判断する",
          facts: [
            ["環境", "production Environment の配備条件を満たす。テスト・移行確認・承認記録は承認者が確認済み。"],
            ["DB", "既存アプリと互換性のある追加変更。旧版のイメージと切り戻し手順を確認済み。"],
            ["配備記録", "検証したバイト列を " + releaseDigest + " で指定できる。"],
          ],
          options: [
            { id: "promote", label: "承認を通して、検証済み成果物を同じダイジェストで配備する", note: "同じ成果物を昇格しました。環境ごとの設定値は配備先で適用し、実際に稼働するダイジェストを記録します。", patch: { production: "v1.4.0 · " + releaseSha, record: "production 承認・配備済み · " + releaseDigest } },
            { id: "fresh-build", label: "production ジョブでタグからビルドし直して配備する", note: "同じ SHA でも依存物やビルド環境が変わり、別の成果物になり得ます。今回の配備条件はステージングで確認したダイジェストと一致することです。" },
          ],
        },
        {
          title: "公開後の確認を終える",
          facts: [
            ["スモーク確認", "読み取り・状態変更・権限の代表操作を確認済み。"],
            ["監視", "公開後30分、エラー率は事前の範囲。問い合わせ窓口に新規報告なし。"],
          ],
          options: [
            { id: "close", label: "配備と監視の証跡を残し、今回のリリースを完了する", note: "タグと配備履歴をたどれば、確認した版と今動く版を後から説明できます。", patch: { record: "稼働版照合・スモーク・30分監視・周知済み" } },
            { id: "release-page", label: "Release ページが公開された時刻だけで完了にする", note: "Release の公開だけでは、本番反映や利用者から見た正常動作を確認できません。配備履歴と観測結果を残します。" },
          ],
        },
      ],
    },

    hotfix: {
      label: "緊急修正",
      summary: "v1.4.0 本番で旧画面の競合メッセージに問題が見つかりました。main では v1.5 向けの変更が進んでいます。",
      initial: { source: "main · b61f0d8（v1.5 開発中）", candidate: "候補なし", artifact: "未作成", production: "v1.4.0 · " + releaseSha, record: "Issue #61 · 旧画面の表示不具合" },
      steps: [
        {
          title: "修正の起点を確認する",
          facts: [
            ["本番", "配備履歴と v1.4.0 タグは " + releaseSha + "。稼働しているのは " + releaseDigest + "。"],
            ["main", "b61f0d8。未承認のスキーマ変更が含まれる。"],
            ["保守ブランチ", "release/1.4 は本番と同じ " + releaseSha + "。保護ルールと CI を確認済み。"],
          ],
          options: [
            { id: "prod-tag", label: "本番タグ v1.4.0 の SHA から修正ブランチを切り、保守向けの PR を作る", note: "現在動くソースを起点にできました。PR の比較先は本番系列の保護されたブランチです。", patch: { source: "hotfix/61 · 起点 v1.4.0 " + releaseSha, record: "Issue #61 · PR #63（保守系列）" } },
            { id: "stable-branch", label: "SHA が一致する release/1.4 を起点にし、同系列へ PR を作る", note: "このケースでは既存の保守ブランチが本番 SHA と一致します。起点の照合と PR の比較先を記録します。", patch: { source: "release/1.4 · 照合 " + releaseSha, record: "Issue #61 · PR #63（保守系列）" } },
            { id: "from-main", label: "main 最新から修正し、既存の変更も本番へ出す", note: "本番の緊急修正範囲に未承認のスキーマ変更が入ります。保守対象の版から修正の差分を切り出します。" },
          ],
        },
        {
          title: "修正範囲と試験結果を確かめる",
          facts: [
            ["修正範囲", "旧画面の 412 の表示を整える。API の競合判定と DB の書き込み条件は維持する。"],
            ["試験", "T-005 の正常更新と古い If-Match の 412 に加え、旧画面の文言を再現・確認した。マージ後の CI #562 は合格。"],
            ["配備物", hotfixSha + " から " + hotfixDigest + " を生成し、ステージングで確認した。"],
          ],
          options: [
            { id: "patch-release", label: "修正だけの候補を v1.4.1 として記録し、検証済み成果物を固定する", note: "互換性を保つ修正のため、この案件のバージョン規約ではパッチを上げます。再現手順、PR #63、CI #562 を記録します。", patch: { candidate: "v1.4.1 · " + hotfixSha, artifact: hotfixDigest, record: "PR #63 · CI #562 · 互換確認" } },
            { id: "source-only", label: "修正が一行なのでマージ後の成果物テストを省く", note: "一行でも元の不具合と既存の成功・失敗パスを確認します。試験対象と配備対象の識別子も合わせます。" },
          ],
        },
        {
          title: "承認を通して本番に昇格する",
          facts: [
            ["運用判断", "緊急用の承認者と公開時間を確認済み。DB 変更なし。"],
            ["戻し先", "必要なら v1.4.0 の保管済み " + releaseDigest + " を再配備可能。"],
          ],
          options: [
            { id: "promote-patch", label: "承認済みの成果物を配備し、旧画面の競合表示と監視を確認する", note: "保守系列の配備記録を残し、消えたはずの症状が本番で再現しないことを確かめます。", patch: { production: "v1.4.1 · " + hotfixSha, record: "配備・スモーク・監視済み · " + hotfixDigest } },
            { id: "replace-old-tag", label: "既存の v1.4.0 タグを修正後のコミットに向け直す", note: "同じ版名が時点によって違うコードを指し、配備や切り戻しを再現できなくなります。新しいタグと配備記録を追加します。" },
          ],
        },
        {
          title: "次回の main に修正を持ち込む",
          facts: [
            ["残る作業", "本番は直ったが main の変更列に Issue #61 の修正はまだない。"],
            ["判断材料", "差分が適用できるなら由来を PR に記録。画面構造が変わっていれば同じ挙動を別実装できる。"],
          ],
          options: [
            { id: "followup-cherry-pick", label: "差分が適用できることを確認し、cherry-pick した PR を main に出す", note: "取り込み用 PR を通して、main 側の対象テストが合格した証跡を Issue #61 に紐づけました。", patch: { record: "本番 v1.4.1 · main 取り込み PR #64・試験済み" } },
            { id: "followup-adapt", label: "main の構造に合わせて同じ挙動を実装し、同じ要件の試験を足す", note: "元の PR と今回の差分、振る舞いの試験を紐づけました。保守系列と main の両方で再発を防げます。", patch: { record: "本番 v1.4.1 · main 等価修正 PR #65・試験済み" } },
            { id: "stop-after-prod", label: "本番が復旧したので main への反映を記録しない", note: "次回の main 由来の配備で再発する可能性があります。反映するか、適用が不要と説明できる試験結果を残します。" },
          ],
        },
      ],
    },

    rollback: {
      label: "配備後の異常",
      summary: "v1.4.0 の配備直後に 5xx が増えました。旧版を配備できるかは、いま動いている DB との互換性で変わります。",
      initial: { source: "main · b61f0d8", candidate: "現行 v1.4.0 · " + releaseSha, artifact: releaseDigest, production: "v1.4.0 · 5xx 増加", record: "INC-07 · 配備直後に発生" },
      steps: [
        {
          title: "影響と変更の記録を集める",
          facts: [
            ["影響", "配備後に状態変更の 5xx が増加。利用者に影響があり、対応担当と責任者へ連絡する。"],
            ["履歴", "現行 v1.4.0 とその成果物は " + releaseDigest + "。直前の安定版は v1.3.4 の " + priorDigest + "。"],
            ["DB", "今回のマイグレーションが適用済み。旧版の起動と書き込みが可能か互換性試験の記録を調べる。"],
          ],
          options: [
            { id: "assess", label: "配備・ログ・マイグレーション履歴を特定し、影響と書き込み可否を調べる", note: "復旧方法の前に、影響する操作、時刻、実際に稼働する版、DB の状態をそろえました。", patch: { record: "INC-07 · 影響範囲と配備/DB履歴を確定" } },
            { id: "restore-now", label: "5xx を見てすぐ本番 DB を前日のバックアップで上書きする", note: "復元対象、失われる更新、影響範囲の判断がありません。まずアプリと DB の障害を切り分け、現在の状態を保全します。" },
          ],
        },
        {
          title: "DB との互換性で復旧策を選ぶ",
          facts: [],
          options: [],
        },
        {
          title: "復旧と再開を確認する",
          facts: [],
          options: [],
        },
      ],
    },
  };

  const recoveryPaths = {
    compatible: [
      {
        facts: [
          ["適用済み変更", "NULL を許す列を追加した。旧版が参照する列や制約はそのまま。"],
          ["互換性", "適用済みスキーマに対する旧版の読み書き・起動を検証記録で確認。直前の成果物は保管済み。"],
        ],
        options: [
          { id: "redeploy", label: "保管済みの v1.3.4 成果物を再配備し、DB は維持する", note: "旧版が現行スキーマで使えることを根拠に、直前のアプリ成果物に切り戻しました。", patch: { candidate: "復旧対象 v1.3.4 · " + priorSha, production: "v1.3.4 · " + priorSha, artifact: priorDigest, record: "INC-07 · 旧版再配備 · DB維持" } },
          { id: "overwrite-release", label: "v1.4.0 タグを旧コミットへ動かし、そこから配備する", note: "変更前後でタグの意味が変わります。既存のタグを保ち、旧版のダイジェストで再配備します。" },
        ],
      },
      {
        facts: [
          ["再配備", "承認された v1.3.4 · " + priorDigest + " を稼働中。"],
          ["確認", "代表操作、権限、エラー率、変更後も保存されたデータを確認した。"],
        ],
        options: [
          { id: "verify-redevelop", label: "確認結果と利用者への案内を記録し、再リリースは新しい版で計画する", note: "復旧時に使った版、検証項目、経過を記録し、原因の修正を新しい候補で検証できます。", patch: { record: "INC-07 · v1.3.4 復旧確認 · 再リリース計画" } },
          { id: "same-tag-repeat", label: "v1.4.0 を作り直して同名で公開する", note: "以前に取得された成果物と混同します。是正した成果物には新しい版を付け、元の記録も残します。" },
        ],
      },
    ],
    incompatible: [
      {
        facts: [
          ["適用済み変更", "旧版が書き込みに使う列を削除した。旧版を動かすと更新処理が失敗する。"],
          ["復旧の選択肢", "現行の書き込みを一時制限できる。現行スキーマと互換な小さな修正を準備可能。"],
        ],
        options: [
          { id: "limit-forward", label: "影響する書き込みを止め、現行スキーマに合う修正を検証する", note: "非互換な旧版の配備を避け、現行スキーマで動作する修正候補を試験します。DB 復元が必要になれば、別環境で検証し、データ損失と切替手順を承認します。", patch: { production: "v1.4.0 · 対象操作を一時制限", record: "INC-07 · 書き込み制限・前進修正の検証" } },
          { id: "blind-redeploy", label: "タグ v1.3.4 の成果物をそのまま本番に再配備する", note: "タグと成果物が特定できても、現行 DB との互換性が必要です。旧版が必要とする列が存在しません。" },
        ],
      },
      {
        facts: [
          ["新しい候補", "現行 DB で回帰テストとスモークを通過。承認後に v1.4.1 · e7ac3b9 の sha256:61…bb を昇格できる。"],
          ["再開条件", "監視が事前の範囲に戻り、制限した操作の結果とデータ整合性を確認する。"],
        ],
        options: [
          { id: "verify-forward", label: "同じ検証済み修正成果物を配備し、再開条件を確認して制限を解除する", note: "新しいタグと配備、再開時刻、確認したデータを記録しました。障害時の対応と再発防止をリリース記録から追えます。", patch: { candidate: "修正候補 v1.4.1 · e7ac3b9", production: "v1.4.1 · e7ac3b9", artifact: "sha256:61…bb", record: "INC-07 · 整合性・監視確認後に制限解除" } },
          { id: "open-before-verify", label: "ビルドが成功したら、配備前にすぐ書き込み制限を解除する", note: "ビルドの成功は利用者から見た復旧と異なります。配備後のスモーク、データ、監視を確認してから再開します。" },
        ],
      },
    ],
  };

  function start(id, variant = "compatible") {
    if (!Object.hasOwn(scenarios, id) || !Object.hasOwn(recoveryPaths, variant)) throw new Error("演習が見つかりません。");
    return { id, variant, cursor: 0, snapshot: { ...scenarios[id].initial }, log: [] };
  }

  function getSteps(state) {
    const steps = scenarios[state.id].steps;
    if (state.id !== "rollback") return steps;
    return [steps[0], ...recoveryPaths[state.variant].map((event, index) => ({ ...steps[index + 1], ...event }))];
  }

  function choose(state, optionId) {
    const option = getSteps(state)[state.cursor]?.options.find(({ id }) => id === optionId);
    if (!option) return { accepted: false, state, note: "現在の判断項目を選んでください。" };
    if (!option.patch) return { accepted: false, state, note: option.note };
    return {
      accepted: true,
      state: { ...state, cursor: state.cursor + 1, snapshot: { ...state.snapshot, ...option.patch }, log: [...state.log, option.label] },
      note: option.note,
    };
  }

  lab.drill = { scenarios, start, getSteps, choose };

  function mountDrill(container) {
    const document = container.ownerDocument;
    const el = (tag, className, content) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (content) node.textContent = content;
      return node;
    };
    const button = (label, callback, className = "button") => {
      const node = el("button", className, label);
      node.type = "button";
      node.addEventListener("click", callback);
      return node;
    };
    let state = start("planned");
    let feedback = null;
    let recovery = "compatible";
    const sessions = new Map();

    const shell = el("div", "release-drill");
    const chooser = el("div", "rd-chooser");
    chooser.setAttribute("role", "group");
    chooser.setAttribute("aria-label", "リリース演習のケース");
    const variants = el("div", "rd-chooser");
    variants.setAttribute("role", "group");
    variants.setAttribute("aria-label", "DB の互換性");
    const progress = el("ol", "rd-steps");
    progress.setAttribute("aria-label", "判断ステップ");
    const decision = el("section", "lesson-card rd-decision");
    const status = el("div", "rd-feedback");
    status.setAttribute("role", "status");
    const next = el("div", "rd-next");
    const snapshot = el("dl", "rd-snapshot");
    const aside = el("aside", "lesson-card rd-state");
    aside.append(el("h3", "", "リリースの記録"), snapshot);
    const board = el("div", "rd-board");
    const main = el("div", "rd-main");
    main.append(decision, status, next);
    board.append(main, aside);
    const summary = el("p", "muted rd-summary");
    shell.append(chooser, summary, variants, progress, board);
    container.replaceChildren(shell);

    function openCase(id, variant = "compatible", reset = false) {
      if (!reset && state.id === id && state.variant === variant) return;
      const key = id + "/" + variant;
      if (reset) sessions.delete(key);
      else sessions.set(state.id + "/" + state.variant, { state, feedback });
      const saved = sessions.get(key);
      state = saved?.state ?? start(id, variant);
      feedback = saved?.feedback ?? null;
      if (id === "rollback") recovery = variant;
      render();
    }

    const cases = Object.entries(scenarios).map(([id, scenario]) => [id, button(scenario.label, () => openCase(id, id === "rollback" ? recovery : "compatible"))]);
    chooser.append(...cases.map(([, control]) => control));
    const toggle = [
      ["compatible", button("現行 DB と旧版に互換性あり", () => openCase("rollback", "compatible"))],
      ["incompatible", button("現行 DB と旧版に互換性なし", () => openCase("rollback", "incompatible"))],
    ];
    variants.append(...toggle.map(([, control]) => control));

    function render({ focus = false } = {}) {
      const { id, variant, snapshot: results } = state;
      const steps = getSteps(state);
      const cursor = feedback?.accepted ? state.cursor - 1 : state.cursor;
      const current = steps[cursor];
      summary.textContent = scenarios[id].summary;
      variants.hidden = id !== "rollback";
      for (const [key, control] of cases) control.setAttribute("aria-pressed", String(id === key));
      for (const [key, control] of toggle) control.setAttribute("aria-pressed", String(variant === key));
      progress.replaceChildren(...steps.map((step, index) => {
        const item = el("li", "", step.title);
        if (index < state.cursor) {
          item.dataset.done = "true";
          item.prepend("✓ ");
        } else if (index === cursor) {
          item.setAttribute("aria-current", "step");
        }
        return item;
      }));
      const details = [
        ["起点・現在の主系列", results.source],
        ["対象の版", results.candidate],
        ["対象成果物の識別子（一部省略）", results.artifact],
        ["本番", results.production],
        ["最新の記録", results.record],
      ];
      snapshot.replaceChildren(...details.map(([label, value]) => {
        const row = el("div");
        row.append(el("dt", "", label), el("dd", "", value));
        return row;
      }));
      const title = el("h3", "", current ? current.title : "演習完了");
      title.tabIndex = -1;
      decision.replaceChildren(title);
      status.replaceChildren();
      next.replaceChildren();

      if (current) {
        const evidence = el("dl", "rd-evidence");
        for (const [label, detail] of current.facts) {
          evidence.append(el("dt", "", label), el("dd", "", detail));
        }
        const choices = el("div", "rd-options");
        for (const option of current.options) {
          choices.append(button(option.label, (event) => {
            feedback = choose(state, option.id);
            const previous = [...choices.children].indexOf(event.currentTarget);
            state = feedback.state;
            render();
            if (feedback.accepted) next.querySelector("button").focus();
            else decision.querySelectorAll("button")[previous]?.focus();
          }));
        }
        if (feedback?.accepted) for (const control of choices.children) control.disabled = true;
        decision.append(evidence, choices);
      } else {
        const log = el("ol", "rd-log");
        log.append(...state.log.map(item => el("li", "", item)));
        decision.append(log);
        next.append(button("このケースをやり直す", () => {
          openCase(id, variant, true);
          decision.querySelector("h3").focus();
        }));
      }

      if (feedback) {
        const result = el("div", "callout rd-result", feedback.note);
        result.dataset.accepted = String(feedback.accepted);
        result.prepend(el("strong", "", feedback.accepted ? "記録しました" : "証拠を確認して再選択"));
        status.append(result);
        if (feedback.accepted) next.append(button(cursor + 1 === steps.length ? "結果を確認" : "次の判断", () => {
          feedback = null;
          render({ focus: true });
        }, "button primary"));
      }
      if (focus) title.focus();
    }

    render();
  }

  lab.mountDrill = mountDrill;
})();
