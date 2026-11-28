import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = new URL("../public/releases/graph-data.js", import.meta.url);
const sandbox = { ReleaseLab: { existing: true } };
runInNewContext(readFileSync(source, "utf8"), sandbox, { filename: source.pathname });
const cases = JSON.parse(JSON.stringify(sandbox.ReleaseLab.graphCases));

const ref = (step, kind, label) => step.refs.find(item => item.kind === kind && (!label || item.label === label));
const bySha = (scenario, sha) => scenario.commits.find(commit => commit.sha === sha);

test("graph data is a classic script and all references and parents resolve at each step", () => {
  assert.equal(sandbox.ReleaseLab.existing, true);
  assert.deepEqual(cases.map(scenario => scenario.id), ["feature", "patch", "revert"]);
  for (const scenario of cases) {
    const commits = new Map(scenario.commits.map(commit => [commit.id, commit]));
    const lanes = new Set(scenario.lanes.map(lane => lane.id));
    assert.equal(scenario.lanes[0].id, "main");
    assert.equal(lanes.size, scenario.lanes.length);
    assert.equal(commits.size, scenario.commits.length);
    assert.equal(new Set(scenario.commits.map(commit => commit.sha)).size, commits.size);
    for (const [column, commit] of scenario.commits.entries()) {
      assert.equal(commit.column, column);
      assert.match(commit.sha, /^[0-9a-f]{7}$/);
      assert.ok(lanes.has(commit.lane));
      assert.equal(new Set(commit.parents).size, commit.parents.length);
      assert.equal(commit.parents.length === 0, column === 0);
      for (const parent of [...commit.parents, commit.replayOf, commit.revertOf].filter(Boolean)) {
        assert.ok(commits.get(parent)?.column < column, `${commit.id} must follow ${parent}`);
      }
    }

    let seen = new Set();
    const tags = new Map();
    for (const step of scenario.steps) {
      const visible = new Set(step.visible);
      assert.equal(visible.size, step.visible.length);
      assert.ok(visible.has(step.focus));
      assert.ok([...seen].every(id => visible.has(id)));
      for (const id of visible) {
        assert.ok(commits.has(id));
        const commit = commits.get(id);
        assert.ok([...commit.parents, commit.replayOf, commit.revertOf].filter(Boolean).every(parent => visible.has(parent)));
      }
      const refKeys = step.refs.map(item => `${item.kind}:${item.label}`);
      assert.equal(new Set(refKeys).size, refKeys.length);
      assert.equal(step.refs.filter(item => item.kind === "deployed").length, 1);
      assert.ok(ref(step, "branch", "main"));
      for (const item of step.refs) {
        assert.ok(visible.has(item.commit));
        assert.ok(["branch", "tag", "deployed"].includes(item.kind));
        if (item.kind === "tag" && !tags.has(item.label)) tags.set(item.label, item.commit);
      }
      for (const [label, commit] of tags) assert.equal(ref(step, "tag", label)?.commit, commit);
      seen = visible;
    }
    assert.equal(seen.size, commits.size);
  }
});

test("feature merge preserves both parents and publishes the checked RC after main advances", () => {
  const scenario = cases.find(item => item.id === "feature");
  const base = bySha(scenario, "42dd7e1");
  const merge = bySha(scenario, "9bf0c42");
  assert.deepEqual(merge.parents, [base.id, "tests"]);
  const candidate = scenario.steps.find(step => ref(step, "tag", "v1.4.0-rc.1"));
  assert.equal(ref(candidate, "tag", "v1.4.0-rc.1").commit, merge.id);
  assert.equal(ref(candidate, "deployed").commit, base.id);
  const published = scenario.steps.at(-1);
  assert.equal(ref(published, "branch", "main").commit, bySha(scenario, "b61f0d8").id);
  assert.equal(ref(published, "tag", "v1.4.0").commit, merge.id);
  assert.equal(ref(published, "tag", "v1.4.0-rc.1").commit, merge.id);
  assert.equal(ref(published, "deployed").commit, merge.id);
});

test("patch release and cherry-pick follow separate parent chains", () => {
  const scenario = cases.find(item => item.id === "patch");
  const main = bySha(scenario, "b61f0d8");
  const stable = bySha(scenario, "9bf0c42");
  const patch = bySha(scenario, "bd3fc51");
  const copy = scenario.commits.find(commit => commit.replayOf);
  const original = scenario.commits.find(commit => commit.id === copy.replayOf);
  assert.deepEqual(original.parents, [stable.id]);
  assert.deepEqual(patch.parents, [stable.id, original.id]);
  assert.deepEqual(copy.parents, [main.id]);
  assert.notEqual(copy.sha, original.sha);
  assert.match(scenario.steps.find(step => step.focus === copy.id).command, /git cherry-pick 4cb475e/);
  const completed = scenario.steps.at(-1);
  assert.deepEqual(scenario.commits.find(commit => commit.id === ref(completed, "branch", "main").commit).parents, [main.id, copy.id]);
  assert.equal(ref(completed, "branch", "release/1.4").commit, patch.id);
  assert.equal(ref(completed, "tag", "v1.4.1").commit, patch.id);
  assert.equal(ref(completed, "deployed").commit, patch.id);
});

test("production redeploy leaves Git intact and merge revert creates a fresh commit and release", () => {
  const scenario = cases.find(item => item.id === "revert");
  const [failing, recovery, revert, , repaired] = scenario.steps;
  const withoutDeployment = step => step.refs.filter(item => item.kind !== "deployed");
  assert.deepEqual(recovery.visible, failing.visible);
  assert.deepEqual(withoutDeployment(recovery), withoutDeployment(failing));
  assert.equal(ref(failing, "deployed").commit, ref(failing, "tag", "v1.5.1").commit);
  assert.equal(ref(recovery, "deployed").commit, ref(recovery, "tag", "v1.5.0").commit);
  const inverse = scenario.commits.find(commit => commit.revertOf);
  const target = scenario.commits.find(commit => commit.id === inverse.revertOf);
  assert.deepEqual(inverse.parents, [ref(recovery, "branch", "main").commit]);
  assert.deepEqual(target.parents, ["base", "setting"]);
  assert.ok(revert.command.endsWith(`git revert -m 1 ${target.sha}`));
  assert.ok(repaired.visible.includes(target.id));
  assert.equal(ref(repaired, "tag", "v1.5.1").commit, target.id);
  assert.equal(ref(repaired, "deployed").commit, ref(repaired, "tag", "v1.5.2").commit);
});
