import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEmptyPlan, createSamplePlan, exportCsv, MAX_TASKS, nextTaskId, parsePlan,
  removeTask, serializePlan, upsertTask, validatePlan,
} from "../public/planning/wbs-model.js";

function task(id, properties = {}) {
  return { id, phase: "design", title: `設計 ${id}`, status: "todo", ...properties };
}

test("the sample follows the same requirements, design and test as the guide", () => {
  const plan = createSamplePlan();
  assert.equal(plan.name, "備品貸出管理");
  assert.equal(plan.tasks.length, 12);
  const build = plan.tasks.find(({ id }) => id === "W-06");
  assert.match(build.deliverable, /R-02.*S-02.*D-02/);
  assert.match(build.done, /POST \/loans.*409.*T-02/);
  assert.equal(build.dependencyId, "W-05");
  assert.equal(plan.tasks.find(({ id }) => id === "W-08").dependencyId, build.id);
  assert.equal(nextTaskId(plan), "W-13");
});

test("tasks can be saved, edited and backed up without changing the previous plan", () => {
  const empty = createEmptyPlan();
  const id = nextTaskId(empty);
  const withTask = upsertTask(empty, task(id, { owner: "  佐藤  ", due: "2028-02-29", estimate: "2.5" }));
  assert.equal(empty.tasks.length, 0);
  assert.equal(withTask.tasks[0].owner, "佐藤");
  assert.equal(withTask.tasks[0].due, "2028-02-29");
  assert.equal(withTask.tasks[0].estimate, 2.5);
  assert.equal(withTask.tasks[0].dependencyId, "");
  const edited = upsertTask(withTask, { ...withTask.tasks[0], status: "done", done: "レビュー済み" });
  assert.equal(edited.tasks.length, 1);
  assert.equal(edited.tasks[0].status, "done");
  assert.equal(withTask.tasks[0].status, "todo");
  assert.deepEqual(parsePlan("\uFEFF" + serializePlan(edited)), edited);
  assert.deepEqual(removeTask(edited, id), empty);
});

test("validates normalized IDs, dependencies, removals and cycles", () => {
  const a = upsertTask(createEmptyPlan(), task("A"));
  const b = upsertTask(a, task("B", { dependencyId: "A" }));
  const c = upsertTask(b, task("C", { dependencyId: "B" }));
  assert.throws(() => upsertTask(c, task("A", { dependencyId: "C" })), /循環/);
  assert.throws(() => upsertTask(c, task("C", { dependencyId: "C" })), /自身/);
  assert.throws(() => upsertTask(c, task("D", { dependencyId: "missing" })), /見つかりません/);
  assert.throws(() => removeTask(c, "A"), /前提タスクを変更/);
  assert.throws(() => validatePlan({ ...a, tasks: [...a.tasks, task(" A ")] }), /重複/);
  assert.deepEqual(removeTask(c, "C"), b);
});

test("rejects invalid JSON records, calendar dates, work estimates and oversized plans", () => {
  assert.throws(() => parsePlan("{"), /JSONバックアップ/);
  assert.throws(() => parsePlan('{"version":2,"name":"test","tasks":[]}'), /バージョン1/);
  assert.throws(() => upsertTask(createEmptyPlan(), task("A", { due: "2026-02-29" })), /実在する日付/);
  assert.throws(() => upsertTask(createEmptyPlan(), task("A", { estimate: "-1" })), /見積もり/);
  assert.throws(() => upsertTask(createEmptyPlan(), task("A", { estimate: "0x20" })), /見積もり/);
  assert.throws(() => upsertTask(createEmptyPlan(), task("A", { title: " " })), /タスク名/);
  const tasks = Array.from({ length: MAX_TASKS + 1 }, (_, index) => task(String(index)));
  assert.throws(() => validatePlan({ ...createEmptyPlan(), tasks }), /250件/);
});

test("CSV includes BOM, all rows, escaped multiline notes and neutralized formula cells", () => {
  const plan = upsertTask({ ...createEmptyPlan(), name: "=1+1" }, task("A", {
    title: "@SUM(1,2)", deliverable: "\u200b=2+3", done: '確認 "済"\n明日', owner: "山田",
  }));
  const csv = exportCsv(plan);
  assert.ok(csv.startsWith("\uFEFF\"プロジェクト名\","));
  assert.ok(csv.includes(`"'=1+1","A","設計","'@SUM(1,2)","'\u200b=2+3"`));
  assert.ok(csv.includes('"確認 ""済""\n明日","山田"'));
  assert.ok(csv.endsWith('"未着手",""\r\n'));
});
