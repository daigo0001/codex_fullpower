import assert from "node:assert/strict";
import test from "node:test";
import { getOsiFocus, osiLayers } from "../public/azure/osi.js";
import { getTimeline, scenarios } from "../public/azure/scenarios.js";

function focus(scenarioId, stepId) {
  const scenario = scenarios.find(({ id }) => id === scenarioId);
  const step = getTimeline(scenario).find(({ id }) => id === stepId);
  assert.ok(step, `${scenarioId}/${stepId}`);
  return getOsiFocus(step);
}

test("defines all seven OSI layers in descending order", () => {
  assert.deepEqual(osiLayers.map(({ number }) => number), [7, 6, 5, 4, 3, 2, 1]);
  for (const { name, shortName, description, example } of osiLayers) {
    assert.ok(name && shortName && description && example);
  }
});

test("each modeled step identifies its OSI teaching focus", () => {
  const knownLayers = new Set(osiLayers.map(({ number }) => number));
  for (const scenario of scenarios) {
    for (const step of getTimeline(scenario)) {
      const { layers, reason } = getOsiFocus(step);
      assert.ok(layers.length, `${scenario.id}/${step.id}`);
      assert.equal(new Set(layers).size, layers.length, step.id);
      assert.ok(layers.every((layer) => knownLayers.has(layer)), step.id);
      assert.ok(reason, step.id);
    }
  }
});

test("distinguishes service-level decisions, transport filters and IP routing", () => {
  assert.deepEqual(focus("ingress", "gateway-select-backend").layers, [7]);
  assert.deepEqual(focus("ingress", "backend-nsg").layers, [4, 3]);
  assert.deepEqual(focus("egress", "internet-route").layers, [3]);
  assert.deepEqual(focus("egress", "nat-outbound").layers, [4, 3]);
  assert.deepEqual(focus("hub", "firewall-network-rule").layers, [4, 3]);
  assert.deepEqual(focus("private", "blob-dns-query").layers, [7]);
  assert.deepEqual(focus("private", "storage-private-link").layers, [7, 3]);
  assert.deepEqual(focus("dns-missing", "reject-public-access").layers, [7]);
});

test("unknown steps have no misleading layer assignment", () => {
  assert.deepEqual(getOsiFocus({ id: "unknown" }).layers, []);
  assert.deepEqual(getOsiFocus({ id: "toString" }).layers, []);
});
