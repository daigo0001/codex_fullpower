import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_EVIDENCE, createExercise, createIncidentReport, openEvidence,
  submitAction, submitHypothesis, toggleCheck, verifyRecovery,
} from "../public/incidents/engine.js";
import { appCases } from "../public/incidents/app-cases.js";
import { cloudCases } from "../public/incidents/cloud-cases.js";

const sampleCase = {
  id: "sample",
  title: "ロールアウト後の 502",
  service: "備品貸出 API",
  startedAt: "09:05",
  symptom: "HTTPS の応答が 502",
  impact: "一覧と登録にアクセスできない",
  context: "起動設定を変更した直後",
  evidence: [
    { id: "status", title: "応答の割合", summary: "502 が継続" },
    { id: "probe", title: "プローブ", summary: "バックエンドに接続できない" },
    { id: "release", title: "リリース差分", summary: "起動ポートが変わった" },
  ],
  hypotheses: [
    { id: "dns", label: "DNS 障害", correct: false, feedback: "名前は解決できています。" },
    { id: "port", label: "ポートが食い違う", correct: true, feedback: "変更と症状が一致します。" },
  ],
  actions: [
    { id: "wait", label: "経過観察", correct: false, feedback: "設定の差は自然には解消しません。" },
    { id: "rollback", label: "稼働実績のある版に戻す", correct: true, feedback: "既存の設定と互換性があります。" },
  ],
  checks: [
    { id: "healthy", label: "プローブが正常になる", correct: true, feedback: "経路の到達確認です。" },
    { id: "user", label: "利用者と同じ経路で成功", correct: true, feedback: "利用者影響の解消を示します。" },
    { id: "deployment", label: "デプロイ完了通知のみ", correct: false, feedback: "デプロイ完了だけでは利用者の復旧を判断できません。" },
  ],
  resolution: {
    cause: "Application Gateway とアプリの接続設定が不一致",
    mitigation: "変更を戻す。データの互換性を確認した手順を使う。",
    verify: "正常なプローブと利用者経路の成功を確認した。",
    followUp: ["ステージングで同じプローブを確認する"],
  },
};

function observeSample() {
  return ["status", "probe"].reduce(openEvidence, createExercise(sampleCase));
}

function reachVerification() {
  return submitAction(submitHypothesis(observeSample(), "port"), "rollback");
}

test("requires two distinct clues before accepting a hypothesis", () => {
  const start = createExercise(sampleCase);
  assert.equal(start.phase, "investigate");
  assert.equal(MIN_EVIDENCE, 2);
  assert.equal(openEvidence(start, "unknown"), start);

  const observed = openEvidence(start, "status");
  assert.equal(openEvidence(observed, "status"), observed);
  assert.deepEqual(start.openedEvidence, []);

  const early = submitHypothesis(observed, "port");
  assert.equal(early.phase, "investigate");
  assert.deepEqual(early.attempts.hypotheses, []);
  assert.equal(early.feedback.kind, "info");

  const allowed = submitHypothesis(openEvidence(observed, "probe"), "port");
  assert.equal(allowed.phase, "respond");
  assert.equal(allowed.confirmedHypothesisId, "port");
});

test("keeps phases gated and permits retries with contextual feedback", () => {
  const observed = observeSample();
  assert.equal(submitHypothesis(observed, "unknown"), observed);
  assert.equal(submitAction(observed, "rollback"), observed);
  assert.equal(toggleCheck(observed, "healthy"), observed);
  assert.equal(verifyRecovery(observed), observed);

  const wrongHypothesis = submitHypothesis(observed, "dns");
  assert.equal(wrongHypothesis.phase, "investigate");
  assert.deepEqual(wrongHypothesis.feedback, { kind: "error", text: sampleCase.hypotheses[0].feedback });

  const diagnosed = submitHypothesis(wrongHypothesis, "port");
  assert.deepEqual(diagnosed.attempts.hypotheses, ["dns", "port"]);
  assert.deepEqual(observed.attempts.hypotheses, []);
  assert.equal(submitHypothesis(diagnosed, "dns"), diagnosed);
  assert.equal(submitAction(diagnosed, "unknown"), diagnosed);

  const wrongAction = submitAction(diagnosed, "wait");
  assert.equal(wrongAction.phase, "respond");
  assert.equal(wrongAction.feedback.kind, "error");

  const acted = submitAction(wrongAction, "rollback");
  assert.equal(acted.phase, "verify");
  assert.equal(acted.confirmedActionId, "rollback");
  assert.deepEqual(acted.attempts.actions, ["wait", "rollback"]);
});

test("requires all and only the checks that establish recovery", () => {
  const acted = reachVerification();
  assert.equal(toggleCheck(acted, "unknown"), acted);
  const one = toggleCheck(acted, "healthy");
  assert.equal(toggleCheck(one, "healthy").selectedChecks.length, 0);
  const insufficient = verifyRecovery(one);
  assert.equal(insufficient.phase, "verify");
  assert.equal(insufficient.feedback.kind, "error");

  const selections = ["deployment", "user"].reduce(toggleCheck, insufficient);
  const extra = verifyRecovery(selections);
  assert.equal(extra.phase, "verify");
  assert.equal(extra.feedback.text, sampleCase.checks[2].feedback);

  const recovered = verifyRecovery(toggleCheck(extra, "deployment"));
  assert.equal(recovered.phase, "complete");
  assert.equal(recovered.feedback.kind, "success");
  assert.equal(recovered.attempts.verifications, 3);
  assert.equal(verifyRecovery(recovered), recovered);
  assert.equal(toggleCheck(recovered, "user"), recovered);
  assert.deepEqual(acted.selectedChecks, []);
  assert.equal(acted.attempts.verifications, 0);
});

test("exports the observed evidence and decisions only after recovery, with notes as literal text", () => {
  const acted = reachVerification();
  assert.equal(createIncidentReport(acted), null);

  const complete = verifyRecovery(["healthy", "user"].reduce(toggleCheck, acted));
  const notes = "障害の経緯\r\n## 見出しにしない\r\n<script>例</script>\u0000";
  const report = createIncidentReport(complete, { notes });
  assert.match(report, /^# ロールアウト後の 502 — 障害対応レポート/mu);
  assert.match(report, /プローブ — バックエンドに接続できない/u);
  assert.doesNotMatch(report, /リリース差分/u);
  assert.match(report, /ポートが食い違う/u);
  assert.match(report, /稼働実績のある版に戻す/u);
  assert.match(report, /利用者と同じ経路で成功/u);
  assert.doesNotMatch(report, /デプロイ完了通知のみ/u);
  assert.match(report, /ステージングで同じプローブを確認する/u);
  assert.match(report, /## 自分のメモ\n\n {4}障害の経緯\n {4}## 見出しにしない\n {4}<script>例<\/script>\n$/u);
  assert.doesNotMatch(createIncidentReport(complete, { notes: "   " }), /自分のメモ/u);
});

test("every published case has a complete path from evidence to report", () => {
  const cases = [...cloudCases, ...appCases];
  assert.deepEqual(new Set(cases.map(({ id }) => id)), new Set(["gateway", "private-dns", "db-lock", "auth-cookie"]));
  for (const incident of cases) {
    for (const items of [incident.evidence, incident.hypotheses, incident.actions, incident.checks]) {
      assert.equal(new Set(items.map(({ id }) => id)).size, items.length, incident.id);
    }
    const answers = incident.hypotheses.filter(({ correct }) => correct);
    const actions = incident.actions.filter(({ correct }) => correct);
    const checks = incident.checks.filter(({ correct }) => correct);
    assert.equal(answers.length, 1, incident.id);
    assert.equal(actions.length, 1, incident.id);
    assert.ok(checks.length >= 2 && checks.length < incident.checks.length, incident.id);

    const observed = incident.evidence.map(({ id }) => id).reduce(openEvidence, createExercise(incident));
    const acted = submitAction(submitHypothesis(observed, answers[0].id), actions[0].id);
    const complete = verifyRecovery(checks.map(({ id }) => id).reduce(toggleCheck, acted));
    assert.equal(complete.phase, "complete", incident.id);
    assert.match(createIncidentReport(complete), /## 再発防止/u, incident.id);
    assert.ok(incident.resolution.followUp.length > 0, incident.id);
  }
});
