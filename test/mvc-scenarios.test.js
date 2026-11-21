import assert from "node:assert/strict";
import test from "node:test";
import { actors, scenarios, getTimeline } from "../public/mvc/scenarios.js";

const byId = (scenarioId) => scenarios.find(({ id }) => id === scenarioId);
const stepIds = (scenarioId) => byId(scenarioId).steps.map(({ id }) => id);
const getStep = (scenarioId, stepId) => byId(scenarioId).steps.find(({ id }) => id === stepId);

test("MVC steps describe known actors, phases and positive illustrative timings", () => {
  const names = new Set(actors.map(({ id }) => id));
  assert.equal(names.size, actors.length);
  assert.equal(new Set(scenarios.map(({ id }) => id)).size, scenarios.length);

  for (const scenario of scenarios) {
    assert.equal(new Set(stepIds(scenario.id)).size, scenario.steps.length);
    let elapsed = 0;
    for (const [index, step] of getTimeline(scenario).entries()) {
      assert.ok(names.has(step.from) && names.has(step.to), step.id);
      assert.ok(["forward", "unwind", "short-circuit"].includes(step.phase), step.id);
      assert.ok(step.protocol && step.layer && step.title && step.description, step.id);
      assert.ok(step.data.length && step.data.every(({ label, value }) => label && value), step.id);
      assert.ok(Number.isFinite(step.duration) && step.duration > 0, step.id);
      assert.equal(step.start, elapsed);
      elapsed += step.duration;
      assert.equal(step.end, elapsed);
      assert.equal(scenario.steps[index].start, undefined);
    }
  }
});

test("a GET runs middleware and routing, then nests MVC filters around binding, action and result", () => {
  assert.deepEqual(stepIds("get"), [
    "request", "middleware-in", "route-match", "route-values", "authenticate", "authorize", "mvc-start",
    "csrf-safe-method", "resource-in", "bind-id", "action-in", "run-action", "action-result", "action-out",
    "result-in", "render-view", "view-out", "result-out", "resource-out", "mvc-out", "middleware-out", "response",
  ]);
  assert.deepEqual(byId("get").steps.slice(-5).map(({ phase }) => phase), Array(5).fill("unwind"));
  assert.equal(getStep("get", "run-action").to, "controller");
  assert.equal(getStep("get", "render-view").to, "view");
});

test("endpoint authorization challenges the cookie scheme before MVC is invoked", () => {
  const scenario = byId("auth");
  assert.equal(scenario.outcomeKind, "redirect");
  assert.deepEqual(stepIds("auth").slice(-4), ["auth-challenge", "cookie-redirect", "middleware-out", "response"]);
  assert.equal(getStep("auth", "auth-challenge").phase, "short-circuit");
  assert.ok(scenario.steps.every(({ from, to }) => [from, to].every((actor) => ["client", "routing", "middleware"].includes(actor))));
  assert.ok(getStep("auth", "response").data.some(({ label, value }) => label === "Location" && value.includes("/account/login")));
});

test("an invalid POST passes antiforgery before validation and redisplays the form", () => {
  const ids = stepIds("invalid");
  assert.ok(ids.indexOf("csrf-validate") < ids.indexOf("bind-invalid"));
  assert.ok(ids.indexOf("bind-invalid") < ids.indexOf("run-action"));
  assert.match(getStep("invalid", "bind-invalid").data.at(-1).value, /ModelState.IsValid = false/);
  assert.match(getStep("invalid", "run-action").data.at(-1).value, /スキップ/);
  assert.match(getStep("invalid", "render-view").data[0].value, /Edit\.cshtml/);
  assert.match(byId("invalid").outcome, /200 OK/);
});

test("an exception handled by an MVC exception filter skips ordinary result filters and Razor", () => {
  const ids = stepIds("action-error");
  assert.deepEqual(ids.slice(-7), [
    "action-throws", "exception-filter", "filtered-result", "resource-out", "mvc-out", "middleware-out", "response",
  ]);
  assert.ok(!ids.includes("result-in") && !ids.includes("render-view"));
  assert.match(getStep("action-error", "filtered-result").data[0].value, /StatusCodeResult\(500\)/);
});

test("a Razor result exception crosses MVC and is replaced only before the response has started", () => {
  const ids = stepIds("view-error");
  assert.deepEqual(ids.slice(-6), [
    "render-view", "view-throws", "exception-propagates", "exception-middleware", "middleware-out", "response",
  ]);
  assert.ok(!ids.includes("exception-filter"));
  const handler = getStep("view-error", "exception-middleware");
  assert.ok(handler.data.some(({ value }) => value === "HttpResponse.HasStarted = false"));
  assert.match(handler.description, /差し替えられません/);
});
