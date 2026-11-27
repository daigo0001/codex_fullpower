import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const labDir = new URL("../public/web-development-pl-lab/", import.meta.url);
const contents = (path) => readFileSync(new URL(path, labDir), "utf8");
const context = vm.createContext({});
vm.runInContext(contents("assets/js/plan-model.js"), context, { filename: "plan-model.js" });
const model = context.PLLab.plan;
const plain = (value) => JSON.parse(JSON.stringify(value));

function task(id, options = {}) {
  return { id, title: `タスク ${id}`, ...options };
}

function plan(options = {}) {
  return { mode: "sample", start: "2026-12-01", deadline: "2026-12-31", ...options };
}

test("walkthrough and final plans keep their case modes and remain within their own deadlines", () => {
  const project = JSON.parse(contents("data/sample-project.json"));
  const initial = model.defaultPlan("sample");
  const walkthrough = model.samplePlan("sample");
  const final = model.samplePlan("final");
  const finalInitial = model.defaultPlan("final");

  assert.equal(initial.version, 1);
  assert.equal(initial.mode, "sample");
  assert.equal(initial.tasks.length, 1);
  assert.equal(initial.tasks[0].kind, "group");
  assert.equal(initial.tasks[0].title, project.title);
  assert.equal(initial.deadline, project.deadline);
  assert.deepEqual(plain(model.validatePlan(JSON.parse(contents("data/sample-wbs.json")))), plain(walkthrough));
  assert.deepEqual(
    plain(walkthrough.tasks.filter(({ kind }) => kind === "milestone").map(({ end }) => end)),
    project.milestones.map(({ date }) => date),
  );
  assert.deepEqual(plain(walkthrough.people.map(({ rate }) => rate)), [60, 80, 60]);
  assert.equal(final.mode, "final");
  assert.equal(finalInitial.mode, "final");
  assert.notEqual(finalInitial.tasks[0].title, initial.tasks[0].title);
  assert.equal(final.people.length, 2);
  for (const example of [walkthrough, final]) {
    const { summary } = model.analyzePlan(example);
    assert.equal(summary.finish, example.deadline);
    assert.equal(summary.deadlineOverruns, 0);
    assert.equal(summary.unscheduled, 0);
    assert.equal(summary.overloads, 0);
    assert.ok(summary.criticalPath.length > 1);
  }
});

test("WBS numbering is based on tree order and summaries count each leaf once", () => {
  const example = plan({
    tasks: [
      task("outer", { kind: "group" }), task("inner", { kind: "group", parentId: "outer" }),
      task("first", { parentId: "inner", estimate: 8, actual: 9, status: "done" }),
      task("second", { parentId: "outer", estimate: 4, progress: 50 }),
    ],
  });
  const analysis = model.analyzePlan(example);
  assert.deepEqual(plain(analysis.rows.map(({ wbs }) => wbs)), ["1", "1.1", "1.1.1", "1.2"]);
  assert.equal(analysis.byId.outer.estimate, 12);
  assert.equal(analysis.byId.inner.estimate, 8);
  assert.equal(analysis.summary.taskCount, 2);
  assert.equal(analysis.summary.doneCount, 1);
  assert.equal(analysis.summary.completionPercent, 75);
  assert.equal(analysis.summary.estimate, 12);
  assert.equal(analysis.summary.actual, 9);
  assert.equal(analysis.summary.difference, -3);
});

test("a group can span more than ten years while individual date ranges remain bounded", () => {
  const early = "2026-12-01";
  const late = "2037-12-01";
  const analysis = model.analyzePlan(plan({
    tasks: [
      task("group", { kind: "group" }),
      task("first", { parentId: "group", start: early, end: early }),
      task("last", { parentId: "group", start: late, end: late }),
    ],
  }));
  assert.equal(analysis.byId.group.start, early);
  assert.equal(analysis.byId.group.end, late);
  assert.equal(analysis.byId.group.duration, 2871);
  assert.equal(analysis.summary.deadlineOverruns, 1);
  assert.throws(() => model.validatePlan(plan({ tasks: [task("too-long", { start: early, end: late })] })), /10年以内/);
});

test("calendar scheduling includes endpoints, skips holidays and absences, and respects finish-before-start", () => {
  const holidays = ["2026-12-02"];
  const absences = ["2026-12-03"];
  assert.equal(model.businessDays("2026-12-01", "2026-12-07", holidays, absences), 3);
  const analysis = model.analyzePlan(plan({
    holidays,
    people: [{ id: "owner", name: "担当", rate: "50", absences }],
    tasks: [
      task("derive", { assignee: "owner", optimistic: 8, likely: 14, pessimistic: 32 }),
      task("review", { kind: "review", dependsOn: ["derive"], estimate: 3, assignee: "owner" }),
      task("gate", { kind: "milestone", dependsOn: ["review"] }),
    ],
  }));
  const first = analysis.byId.derive;
  assert.equal(first.pert, 16);
  assert.equal(first.estimate, 16);
  assert.equal(first.personDays, 2);
  assert.equal(first.start, "2026-12-01");
  assert.equal(first.end, "2026-12-08");
  assert.equal(first.duration, 5); // Project business days include the member's absence.
  assert.equal(analysis.byId.review.start, "2026-12-09");
  assert.equal(analysis.byId.gate.end, "2026-12-09");
  assert.equal(analysis.summary.overloads, 0);
  assert.deepEqual(plain(analysis.summary.criticalPath), ["derive", "review", "gate"]);
});

test("overlapping fixed work triggers capacity, predecessor and deadline warnings", () => {
  const analysis = model.analyzePlan(plan({
    deadline: "2026-12-02", people: [{ id: "owner", name: "担当", rate: 50 }],
    tasks: [
      task("first", { assignee: "owner", estimate: 8, start: "2026-12-01", end: "2026-12-02" }),
      task("second", { assignee: "owner", estimate: 8, start: "2026-12-02", end: "2026-12-03", dependsOn: ["first"] }),
    ],
  }));
  const date = analysis.workload.find((day) => day.date === "2026-12-02");
  assert.deepEqual(plain(date.taskIds), ["first", "second"]);
  assert.equal(date.capacity, 4);
  assert.equal(date.hours, 8);
  assert.equal(date.overload, true);
  assert.equal(analysis.summary.overloads, 1);
  assert.equal(analysis.summary.deadlineOverruns, 1);
  assert.ok(analysis.byId.second.issues.some(({ type }) => type === "predecessor"));
});

test("an absence is detected without moving the explicitly planned work", () => {
  const walkthrough = model.samplePlan();
  const days = ["2027-01-18", "2027-01-19", "2027-01-20", "2027-01-21", "2027-01-22"];
  const analysis = model.analyzePlan({
    ...walkthrough,
    people: walkthrough.people.map((person) => person.id === "dev" ? { ...person, absences: days } : person),
  });
  assert.equal(analysis.byId.t015.start, days[0]);
  assert.equal(analysis.byId.t015.end, days.at(-1));
  assert.ok(analysis.byId.t015.issues.some(({ type, assignee }) => type === "absence" && assignee === "dev"));
});

test("input validation detects missing references, hierarchy and dependency cycles, and invalid numeric/date inputs", () => {
  const check = (tasks, options = {}) => model.validatePlan(plan({ tasks, ...options }));
  assert.throws(() => check([task("A"), task("A")]), /重複/);
  assert.throws(() => check([task("A", { parentId: "missing" })]), /親には既存のグループ/);
  assert.throws(() => check([task("A", { dependsOn: ["missing"] })]), /前提タスク.*見つかりません/);
  assert.throws(() => check([task("A", { kind: "group", parentId: "B" }), task("B", { kind: "group", parentId: "A" })]), /親子関係が循環/);
  assert.throws(() => check([task("A", { dependsOn: ["B"] }), task("B", { dependsOn: ["A"] })]), /依存関係が循環/);
  assert.throws(() => check([task("A", { assignee: "missing" })]), /担当者が見つかりません/);
  assert.throws(() => check([task("A", { optimistic: "4", likely: "3", pessimistic: "9" })]), /見積もりが大きくなる/);
  assert.throws(() => check([task("A", { progress: 101 })]), /進捗率/);
  assert.throws(() => check([task("A", { start: "2027-02-29" })]), /実在する日付/);
  assert.throws(() => check([task("A", { start: "2026-12-03", end: "2026-12-02" })]), /終了日は開始日以降/);
  assert.throws(() => check([], { people: [{ id: "owner", name: "担当", rate: 101 }] }), /稼働率/);
  assert.throws(() => check([], { mode: "other" }), /ケースの種類/);
});

test("CSV template uses the live export header, and exports preserve multiline data and neutralize formulas", () => {
  const template = contents("templates/wbs.csv");
  const csv = model.exportCsv(plan({
    tasks: [task("quoted", { title: "\u200b=1+1", description: '理由 "確認"\n次の行' })],
  }));
  assert.ok(template.startsWith("\ufeff\"WBS番号\","));
  const liveHeader = model.exportCsv(plan({ tasks: [] }));
  assert.equal(template, liveHeader.replaceAll("\r\n", "\n"));
  assert.ok(csv.startsWith(liveHeader));
  assert.match(csv, /"'\u200b=1\+1","理由 ""確認""\n次の行"/);
  assert.ok(csv.endsWith("\r\n"));
});
