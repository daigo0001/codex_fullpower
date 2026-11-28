import assert from "node:assert/strict";
import { test } from "node:test";
import "../public/releases/drill.js";

const { choose, getSteps, scenarios, start } = globalThis.ReleaseLab.drill;

function advance(state, id) {
  const result = choose(state, id);
  assert.equal(result.accepted, true, result.note);
  return result.state;
}

test("scheduled releases preserve the staging artifact and commit even after main advances", () => {
  const initial = start("planned");
  let state = advance(initial, "verified");
  state = advance(state, "release");
  assert.match(state.snapshot.source, /b61f0d8/);
  assert.equal(state.snapshot.candidate, "v1.4.0 · 9bf0c42");
  assert.equal(state.snapshot.artifact, initial.snapshot.artifact);
  assert.match(state.snapshot.production, /v1\.3\.4/);

  const rebuild = choose(state, "fresh-build");
  assert.equal(rebuild.state, state);
  assert.match(rebuild.note, /ダイジェスト/);

  state = advance(state, "promote");
  assert.equal(state.snapshot.production, "v1.4.0 · 9bf0c42");
  assert.equal(state.snapshot.artifact, initial.snapshot.artifact);
  state = advance(state, "close");
  assert.equal(state.cursor, getSteps(state).length);
  assert.match(state.snapshot.record, /30分監視/);
  assert.equal(initial.log.length, 0);
});

test("hotfix weighs a verified stable branch and tag, then follows up in main", () => {
  const initial = start("hotfix");
  assert.equal(choose(initial, "from-main").accepted, false);
  for (const origin of ["prod-tag", "stable-branch"]) {
    for (const followUp of ["followup-cherry-pick", "followup-adapt"]) {
      let state = advance(initial, origin);
      assert.match(state.snapshot.source, /9bf0c42/);
      state = advance(state, "patch-release");
      assert.equal(state.snapshot.production, "v1.4.0 · 9bf0c42");
      assert.equal(choose(state, "replace-old-tag").accepted, false);
      state = advance(state, "promote-patch");
      assert.equal(state.snapshot.production, "v1.4.1 · bd3fc51");
      assert.equal(choose(state, "stop-after-prod").accepted, false);
      state = advance(state, followUp);
      assert.match(state.snapshot.record, /main .*PR #6[45]・試験済み/);
      assert.equal(state.cursor, getSteps(state).length);
    }
  }
});

test("recovery on compatible schema redeploys the known previous artifact and retains the database", () => {
  let state = start("rollback", "compatible");
  assert.equal(choose(state, "restore-now").accepted, false);
  state = advance(state, "assess");
  assert.equal(choose(state, "overwrite-release").accepted, false);
  state = advance(state, "redeploy");
  assert.equal(state.snapshot.production, "v1.3.4 · 42dd7e1");
  assert.equal(state.snapshot.artifact, "sha256:29…1c");
  assert.match(state.snapshot.record, /DB維持/);
  state = advance(state, "verify-redevelop");
  assert.match(state.snapshot.record, /復旧確認/);
});

test("recovery on incompatible schema keeps the old artifact out of production and verifies the fix before reopening", () => {
  let state = advance(start("rollback", "incompatible"), "assess");
  assert.equal(choose(state, "redeploy").accepted, false);
  assert.equal(choose(state, "blind-redeploy").accepted, false);
  state = advance(state, "limit-forward");
  assert.match(state.snapshot.production, /対象操作を一時制限/);
  assert.equal(choose(state, "open-before-verify").accepted, false);
  state = advance(state, "verify-forward");
  assert.equal(state.snapshot.production, "v1.4.1 · e7ac3b9");
  assert.equal(state.snapshot.artifact, "sha256:61…bb");
  assert.match(state.snapshot.record, /整合性・監視確認後/);
});

test("every scenario gives a safe progression and stale options leave state unchanged", () => {
  for (const id of Object.keys(scenarios)) {
    let state = start(id);
    for (const step of getSteps(state)) {
      assert.equal(choose(state, "no-such-option").state, state);
      assert.ok(step.facts.length >= 2);
      state = advance(state, step.options.find(option => option.patch).id);
    }
    assert.equal(choose(state, state.log[0]).state, state);
  }
  assert.throws(() => start("not-a-scenario"));
  assert.throws(() => start("rollback", "__proto__"));
});
