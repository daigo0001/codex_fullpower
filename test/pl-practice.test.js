import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

function practiceModules() {
  const lab = { chapters: {}, validators: {}, data: {} };
  const source = readFileSync(new URL("../public/web-development-pl-lab/assets/js/practice.js", import.meta.url), "utf-8");
  runInContext(source, createContext({ PLLab: lab }));
  return lab;
}

const copy = value => JSON.parse(JSON.stringify(value));

test("registers all PL practice chapters and eight distinct events", () => {
  const lab = practiceModules();
  assert.deepEqual(Object.keys(lab.chapters).sort(), ["09", "10", "11", "12"]);
  assert.deepEqual(Object.keys(lab.validators).sort(), ["09", "10", "11", "12"]);
  assert.equal(new Set(lab.data.practice.eventIds).size, 8);
});

test("validates known event choices and requires supporting notes for reviewed records", () => {
  const lab = practiceModules();
  const id = "release-blocker";
  const valid = { selected: id, drafts: { [id]: { choice: 0, rationale: "資産を保全する", report: "運用責任者に連絡", change: "再試験枠を追加", reviewed: true } } };
  assert.equal(lab.validators["09"](valid).drafts[id].choice, 0);
  assert.throws(() => lab.validators["09"]({ ...valid, selected: "other" }), /選択値/);
  for (const update of [{ choice: 8 }, { rationale: "" }, { reviewed: "true" }]) {
    const invalid = copy(valid);
    Object.assign(invalid.drafts[id], update);
    assert.throws(() => lab.validators["09"](invalid));
  }
});

test("rejects invalid dates, repeated IDs, invalid status and undecided completed changes", () => {
  const lab = practiceModules();
  const valid = copy(lab.data.practice.registerSamples);
  assert.equal(lab.validators["10"](valid).changes[0].decision, "deferred");
  for (const [type, index, patch] of [
    ["risks", 0, { due: "2027-02-29" }],
    ["issues", 1, { id: valid.issues[0].id }],
    ["issues", 0, { status: ["working"] }],
    ["changes", 0, { decision: "pending" }],
  ]) {
    const invalid = copy(valid);
    Object.assign(invalid[type][index], patch);
    assert.throws(() => lab.validators["10"](invalid));
  }
});

test("dashboard prioritizes live registers and omits completed items", () => {
  const lab = practiceModules();
  const registers = copy(lab.data.practice.registerSamples);
  assert.match(lab.dashboardExtras({ answers: {} }).risks[0], /^記入例/);
  registers.risks[0].status = "done";
  registers.risks[1].title = "確認枠の確保";
  const values = lab.dashboardExtras({ answers: { "10": registers } });
  assert.equal(values.risks.length, 1);
  assert.match(values.risks[0], /^RSK-02 確認枠の確保/);
  assert.equal(values.issues.length, 1);
});

test("checks AI review flags and final document field lengths", () => {
  const lab = practiceModules();
  const review = { selected: "design", drafts: { design: { flagged: ["lock"], evidence: "REQ-005", revision: "412 と監査", reviewed: true } } };
  assert.equal(lab.validators["11"](review).drafts.design.flagged[0], "lock");
  review.drafts.design.flagged.push("lock");
  assert.throws(() => lab.validators["11"](review), /識別子/);
  const final = Object.fromEntries(
    ["overview", "requirements", "functions", "nonfunctional", "design", "technology", "deliverables", "risks", "quality", "release"]
      .map(key => [key, "BR-002 予約競合を確認する"]),
  );
  assert.equal(lab.validators["12"](final).quality, final.quality);
  final.overview = "a".repeat(2401);
  assert.throws(() => lab.validators["12"](final), /長さ/);
});
