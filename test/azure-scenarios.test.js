import assert from "node:assert/strict";
import test from "node:test";
import { actors, getTimeline, scenarios } from "../public/azure/scenarios.js";

const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
const findStep = (scenarioId, stepId) => scenarioById.get(scenarioId).steps.find(({ id }) => id === stepId);
const field = (step, label) => step.data.find((item) => item.label === label)?.value;
const hops = (scenarioId) => scenarioById.get(scenarioId).steps
  .filter(({ from, to }) => from !== to)
  .map(({ from, to }) => [from, to]);

test("Azure scenarios declare ordered, known actors and meaningful timeline steps", () => {
  assert.deepEqual([...scenarioById.keys()], ["ingress", "egress", "private", "dns-missing", "hub"]);
  assert.equal(scenarios.length, scenarioById.size);
  const known = new Set(actors.map(({ id }) => id));
  assert.equal(known.size, actors.length);

  for (const scenario of scenarios) {
    const active = new Set(scenario.actorIds);
    const actual = new Set(scenario.steps.flatMap(({ from, to }) => [from, to]));
    assert.deepEqual(active, actual, scenario.id);
    assert.ok([...active].every((actor) => known.has(actor)), scenario.id);
    assert.equal(active.size, scenario.actorIds.length, scenario.id);
    assert.equal(scenario.steps.length, new Set(scenario.steps.map(({ id }) => id)).size, scenario.id);
    let elapsed = 0;
    for (const { id, start, end, duration, layer, title, description, category, phase, data } of getTimeline(scenario)) {
      assert.ok(layer && title && description && category, id);
      assert.ok(["forward", "unwind", "short-circuit"].includes(phase), id);
      assert.ok(data.length && data.every(({ label, value }) => label && typeof value === "string" && value), id);
      assert.ok(Number.isFinite(duration) && duration > 0, id);
      assert.equal(start, elapsed);
      elapsed += duration;
      assert.equal(end, elapsed);
    }
  }
});

test("public Application Gateway proxies the private backend in both directions", () => {
  assert.deepEqual(hops("ingress"), [
    ["client", "app-gateway"],
    ["app-gateway", "web-vm"],
    ["web-vm", "app-gateway"],
    ["app-gateway", "client"],
  ]);
  const backend = findStep("ingress", "backend-https");
  assert.match(backend.description, /別の TLS 接続/);
  assert.equal(field(backend, "宛先"), "10.10.1.4:443");
  assert.match(findStep("ingress", "backend-nsg").description, /Gateway サブネット/);
  assert.match(findStep("ingress", "backend-response").description, /接続状態/);
});

test("NAT Gateway changes the source while the route still points to Internet", () => {
  const route = findStep("egress", "internet-route");
  const snat = findStep("egress", "nat-outbound");
  const reverse = findStep("egress", "nat-return");
  assert.equal(field(route, "次ホップ"), "Internet");
  assert.equal(field(snat, "変換前"), "10.10.1.4:51511");
  assert.equal(field(snat, "変換後"), "203.0.113.24:62102");
  assert.equal(field(reverse, "変換前の宛先"), field(snat, "変換後"));
  assert.equal(field(reverse, "変換後の宛先"), field(snat, "変換前"));
  assert.equal(reverse.phase, "unwind");
});

test("private DNS preserves the storage hostname and directs HTTPS to a Private Endpoint", () => {
  const dns = findStep("private", "private-dns-answer");
  const query = findStep("private", "blob-dns-query");
  const https = findStep("private", "connect-private-endpoint");
  assert.equal(field(dns, "ゾーン"), "privatelink.blob.core.windows.net");
  assert.equal(field(dns, "A"), "10.10.2.5");
  assert.equal(field(https, "ホスト名"), field(query, "ホスト名"));
  assert.equal(field(https, "宛先"), field(dns, "A") + ":443");
  assert.ok(!scenarioById.get("private").actorIds.includes("nat-gateway"));
  assert.equal(field(findStep("private", "storage-private-link"), "認可の例"), "Storage Blob Data Reader");
});

test("a missing DNS zone link leads to the public path and a storage policy refusal", () => {
  const dns = findStep("dns-missing", "public-dns-answer");
  const denied = findStep("dns-missing", "reject-public-access");
  assert.match(scenarioById.get("dns-missing").initialCondition, /別リージョン.+Service Endpoint も未設定/);
  assert.equal(field(dns, "DNS 応答"), "NOERROR");
  assert.equal(field(dns, "公開 DNS の解決結果"), "198.51.100.25");
  assert.ok(!scenarioById.get("dns-missing").actorIds.includes("private-endpoint"));
  assert.equal(denied.phase, "short-circuit");
  assert.equal(field(denied, "結果"), "403 Forbidden");
  assert.equal(scenarioById.get("dns-missing").outcomeKind, "client-error");
});

test("both spoke UDRs use the hub firewall without changing the final destination", () => {
  const outbound = findStep("hub", "spoke-a-udr");
  const inbound = findStep("hub", "spoke-b-udr");
  assert.equal(field(outbound, "宛先プレフィックス"), "10.20.0.0/16");
  assert.equal(field(inbound, "宛先プレフィックス"), "10.10.0.0/16");
  assert.equal(field(outbound, "次ホップの IP"), field(inbound, "次ホップの IP"));
  assert.equal(field(findStep("hub", "spoke-a-to-firewall"), "最終宛先"), "10.20.1.4:443");
  assert.deepEqual(hops("hub"), [
    ["spoke-a", "firewall"],
    ["firewall", "spoke-b"],
    ["spoke-b", "firewall"],
    ["firewall", "spoke-a"],
  ]);
});
