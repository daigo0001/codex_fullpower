import assert from "node:assert/strict";
import { test } from "node:test";
import { transactionScenarios, transactionSnapshot } from "../public/database/transactions.js";

function finalSnapshot(id) {
  const scenario = transactionScenarios.find((item) => item.id === id);
  return transactionSnapshot(id, scenario.steps.length - 1);
}

test("two successful READ COMMITTED checks can still lead to duplicate loans", () => {
  const checked = transactionSnapshot("select-only", 2);
  assert.deepEqual(checked, { rows: [], actors: { A: "select", B: "select" } });
  const inserted = transactionSnapshot("select-only", 4);
  assert.deepEqual(inserted.rows.map(({ status }) => status), ["pending", "pending"]);
  const final = finalSnapshot("select-only");
  assert.deepEqual(final.rows.map(({ owner, status }) => [owner, status]), [
    ["A", "committed"], ["B", "committed"],
  ]);
});

test("a concurrent conflicting unique insert waits instead of making a second visible loan", () => {
  for (const scenario of ["unique-commit", "unique-rollback"]) {
    const waiting = transactionSnapshot(scenario, 4);
    assert.deepEqual(waiting.actors, { A: "insert", B: "wait" });
    assert.deepEqual(waiting.rows, [{ id: 101, owner: "A", status: "pending" }]);
  }
});

test("committing the first loan causes the waiting transaction to reject the second loan", () => {
  const rejected = transactionSnapshot("unique-commit", 6);
  assert.equal(rejected.actors.B, "reject");
  assert.deepEqual(rejected.rows, [{ id: 101, owner: "A", status: "committed" }]);
  assert.deepEqual(finalSnapshot("unique-commit").actors, { A: "commit", B: "rollback" });
});

test("rolling back the first loan lets the second insert resume and commit", () => {
  assert.deepEqual(transactionSnapshot("unique-rollback", 5).rows, []);
  assert.deepEqual(transactionSnapshot("unique-rollback", 6).rows, [{ id: 102, owner: "B", status: "pending" }]);
  assert.deepEqual(finalSnapshot("unique-rollback"), {
    rows: [{ id: 102, owner: "B", status: "committed" }],
    actors: { A: "rollback", B: "commit" },
  });
});
