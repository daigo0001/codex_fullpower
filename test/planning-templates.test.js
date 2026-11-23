import assert from "node:assert/strict";
import test from "node:test";
import { templates, renderTemplate, renderTemplatePack } from "../public/planning/templates.js";

test("exports five independent Markdown templates with predictable filenames", () => {
  assert.deepEqual(templates.map(({ id }) => id), ["requirements", "screen", "detail", "infrastructure", "structure"]);
  assert.equal(new Set(templates.map(({ filename }) => filename)).size, templates.length);
  for (const { id, title, filename, description } of templates) {
    assert.match(filename, /^\d{2}-[a-z-]+\.md$/);
    assert.ok(description.length > 0);
    const content = renderTemplate(id);
    assert.ok(content.startsWith(`# プロジェクト名\n\n## ${title}\n`));
    assert.ok(content.includes("### 次に確認すること"));
  }
  assert.throws(() => renderTemplate("constructor"), RangeError);
});

test("filled sample ties requirements, screens, detailed design, tests and WBS together", () => {
  const sample = renderTemplatePack({ sample: true, mode: "team" });
  assert.ok(sample.startsWith("# 備品貸出管理\n"));
  assert.match(sample, /R-02.*S-02.*D-02.*T-02.*W-06/);
  assert.match(sample, /POST \/loans/);
  assert.match(sample, /loans\(asset_id\) WHERE returned_at IS NULL/);
  assert.match(sample, /片方が成功、もう片方が 409。未返却の行は1件/);
  assert.match(sample, /docs\/design\/screens\/S-02-loan-form\.md/);
  assert.match(sample, /docs\/design\/detail\/D-02-loan-create\.md/);
  assert.match(sample, /RPO 24時間・RTO 2時間/);
});

test("team mode adds relevant review checkpoints to every template", () => {
  for (const { id } of templates) {
    assert.ok(renderTemplate(id, { mode: "team" }).includes("### 担当とレビュー"));
    assert.ok(renderTemplate(id, { mode: "team", sample: true }).includes("### 担当とレビュー"));
    assert.ok(!renderTemplate(id, { mode: "solo", sample: true }).includes("### 担当とレビュー"));
  }
});

test("sanitizes a custom project name before including it as a heading", () => {
  const projectName = "貸出 & <img>\n# [[" + String.fromCharCode(0) + "確認]]";
  for (const content of [
    renderTemplate("requirements", { projectName }),
    renderTemplatePack({ projectName }),
  ]) {
    assert.equal(content.split("\n")[0], "# 貸出 &amp; &lt;img&gt; \\# \\[\\[確認\\]\\]");
    assert.ok(!content.includes("<img>"));
    assert.ok(!content.includes(String.fromCharCode(0)));
  }
  assert.ok(renderTemplate("requirements", { projectName: "　 " }).startsWith("# プロジェクト名\n"));
  const longName = "🧭".repeat(150);
  assert.equal(renderTemplate("screen", { projectName: longName }).split("\n")[0], "# " + "🧭".repeat(120));
});
