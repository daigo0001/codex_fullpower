import assert from "node:assert/strict";
import test from "node:test";
import { actors, scenarios, getTimeline } from "../public/network/scenarios.js";

const byId = (name) => scenarios.find(({ id }) => id === name);

test("each scenario is a sequence of labeled messages between known actors", () => {
  const actorIds = new Set(actors.map(({ id }) => id));
  assert.equal(actorIds.size, actors.length);
  assert.equal(new Set(scenarios.map(({ id }) => id)).size, scenarios.length);

  for (const { steps } of scenarios) {
    assert.equal(new Set(steps.map(({ id }) => id)).size, steps.length);
    for (const step of steps) {
      assert.ok(actorIds.has(step.from), step.id);
      assert.ok(actorIds.has(step.to), step.id);
      assert.notEqual(step.from, step.to);
      assert.ok(step.protocol && step.layer && step.title && step.description);
      assert.ok(step.data.length > 0 && step.data.every(({ label, value }) => label && value));
    }
  }
});

test("illustrative timings accumulate without gaps or mutating the original steps", () => {
  for (const scenario of scenarios) {
    const rows = getTimeline(scenario);
    assert.equal(rows.length, scenario.steps.length);
    let elapsed = 0;
    for (const [index, { start, end, duration }] of rows.entries()) {
      assert.ok(Number.isFinite(duration) && duration > 0);
      assert.equal(start, elapsed);
      elapsed += duration;
      assert.equal(end, elapsed);
      assert.equal(scenario.steps[index].start, undefined);
      assert.equal(scenario.steps[index].end, undefined);
    }
  }
});

test("first HTTPS request resolves DNS, establishes TCP and TLS, then reaches the origin", () => {
  const { steps } = byId("https");
  const protocols = steps.map(({ protocol }) => protocol);
  assert.deepEqual(protocols.slice(0, 8), ["DNS", "DNS", "TCP", "TCP", "TCP", "TLS 1.3", "TLS 1.3", "TLS 1.3"]);
  assert.deepEqual(steps.slice(2, 5).map(({ data }) => data.at(-1).value), ["SYN", "SYN, ACK", "ACK"]);
  assert.deepEqual(steps.slice(-4).map(({ from, to }) => [from, to]), [
    ["client", "edge"], ["edge", "origin"], ["origin", "edge"], ["edge", "client"],
  ]);
});

test("CDN hit keeps the browser's new connection and serves from the edge", () => {
  const hit = getTimeline(byId("cache"));
  const miss = getTimeline(byId("https"));
  assert.deepEqual(hit.slice(0, -1), miss.slice(0, 9));
  assert.equal(hit.at(-1).category, "cache");
  assert.deepEqual([hit.at(-1).from, hit.at(-1).to], ["edge", "client"]);
  assert.ok(hit.every(({ from, to }) => from !== "origin" && to !== "origin"));
  assert.ok(hit.at(-1).end < miss.at(-1).end);
});

test("HTTP/3 integrates TLS into QUIC over UDP and keeps the origin hop independent", () => {
  const { steps } = byId("http3");
  const protocols = steps.map(({ protocol }) => protocol);
  assert.deepEqual(protocols.slice(0, 2), ["DNS", "DNS"]);
  assert.ok(protocols.includes("QUIC・UDP"));
  assert.ok(protocols.includes("QUIC・TLS 1.3"));
  assert.equal(protocols.includes("TCP"), false);
  assert.equal(protocols.includes("HTTP/2"), false);
  assert.equal(protocols.at(-1), "HTTP/3");
  assert.equal(steps.find(({ to }) => to === "origin").protocol, "HTTPS");
});

test("an NXDOMAIN response ends the flow before connection or HTTP", () => {
  const { steps } = byId("dns-error");
  assert.deepEqual(steps.map(({ protocol }) => protocol), ["DNS", "DNS"]);
  assert.equal(steps.at(-1).category, "error");
  assert.ok(steps.at(-1).data.some(({ value }) => value === "NXDOMAIN"));
  assert.ok(steps.every(({ from, to }) => [from, to].every((actor) => actor === "client" || actor === "dns")));
});
