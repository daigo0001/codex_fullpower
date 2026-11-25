import assert from "node:assert/strict";
import test from "node:test";
import { indexQueries, indexSetup } from "../public/database/index-data.js";

function findQuery(id) {
  return indexQueries.find((query) => query.id === id);
}

function totalBlocks(variant) {
  return variant.buffers.hit + variant.buffers.read;
}

test("all plans have observed output rows and execution buffers drawn from their top-level nodes", () => {
  assert.equal(indexSetup.rows, 60_000);
  assert.match(indexSetup.source, /PostgreSQL 17\.12/);
  assert.equal(new Set(indexQueries.map(({ id }) => id)).size, indexQueries.length);

  for (const { sql, variants } of indexQueries) {
    assert.match(sql, /^SELECT/);
    assert.equal(variants[0].id, "baseline");
    assert.ok(variants.length >= 2);
    assert.equal(new Set(variants.map(({ id }) => id)).size, variants.length);

    for (const { plan, rows, nodes, buffers } of variants) {
      const [root] = plan.split("\n", 1);
      assert.match(root, new RegExp(`actual rows=${rows} loops=1`));
      assert.ok(root.startsWith(nodes[0]));
      const parsed = /^  Buffers: shared(?: hit=(\d+))?(?: read=(\d+))?$/m.exec(plan);
      assert.ok(parsed);
      assert.deepEqual(buffers, { hit: Number(parsed[1] ?? 0), read: Number(parsed[2] ?? 0) });
      assert.equal(rows, variants[0].rows);
    }
  }
});

test("equality keys followed by an ordered date range can avoid the explicit sort", () => {
  const { sql, variants: [baseline, tenant, composite] } = findQuery("recent");
  assert.match(sql, /tenant_id = 42\s+AND borrower_id = 7\s+AND borrowed_at >=/);
  assert.match(sql, /ORDER BY borrowed_at DESC\s+LIMIT 5/);
  assert.ok(baseline.nodes.some((node) => node.startsWith("Seq Scan")));
  assert.ok(tenant.nodes.some((node) => node.startsWith("Bitmap Index Scan")));
  assert.ok(tenant.nodes.includes("Sort"));
  assert.match(composite.ddl, /tenant_id, borrower_id, borrowed_at DESC/);
  assert.ok(composite.nodes.some((node) => node.startsWith("Index Scan")));
  assert.ok(!composite.nodes.includes("Sort"));
  assert.ok(totalBlocks(composite) < totalBlocks(tenant));
});

test("the broad report still uses a sequential scan when a date index exists", () => {
  const { variants: [baseline, indexed] } = findQuery("period");
  assert.match(indexed.ddl, /CREATE INDEX .*\(borrowed_at\)/);
  for (const variant of [baseline, indexed]) {
    assert.ok(variant.nodes.some((node) => node.startsWith("Seq Scan")));
    assert.match(variant.plan, /actual rows=53280 loops=1/);
    assert.equal(variant.rows, 200);
  }
});

test("a partial read index and a conditional uniqueness guarantee serve different requirements", () => {
  const { sql, variants } = findQuery("active");
  const partial = variants.find((variant) => variant.id === "partial");
  const unique = variants.find((variant) => variant.id === "unique");
  assert.match(sql, /returned_at IS NULL/);
  assert.match(partial.ddl, /\(tenant_id, borrowed_at DESC\)\s+WHERE returned_at IS NULL/);
  assert.match(unique.ddl, /CREATE UNIQUE INDEX[\s\S]*\(tenant_id, asset_id\)\s+WHERE returned_at IS NULL/);
  assert.ok(!partial.nodes.includes("Sort"));
  assert.ok(unique.nodes.includes("Sort"));
  assert.equal(partial.rows, unique.rows);
});
