import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeHeaders, MAX_INPUT_LENGTH } from "../public/security/analysis.js";

const check = (result, id) => result.issues.find((issue) => issue.id === id);

test("scores a complete baseline and counts repeated Set-Cookie fields independently", () => {
  const result = analyzeHeaders([
    "HTTP/2 200",
    "Strict-Transport-Security: max-age=31536000",
    "CONTENT-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy: camera=(), microphone=(self)",
    "Set-Cookie: first=VALUE1; Secure; HttpOnly; SameSite=Strict",
    "set-cookie: second=VALUE2; Expires=Wed, 09 Jun 2027 10:18:14 GMT; secure; httponly; samesite=lax",
  ].join("\r\n"));
  assert.equal(result.responses, 1);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.headerCount, 7);
  assert.equal(result.score, 100);
  assert.equal(check(result, "cookies").status, "pass");
  assert.equal(check(result, "cache").status, "info");
  assert.match(check(result, "cookies").evidence, /2 件/);
  assert.doesNotMatch(JSON.stringify(result), /VALUE1|VALUE2|first=|second=/);
});

test("checks only the last curl response and ignores the response body", () => {
  const result = analyzeHeaders([
    "HTTP/1.1 301 Moved Permanently", "Strict-Transport-Security: max-age=31536000", "",
    "HTTP/1.1 200 OK", "X-Content-Type-Options: nosniff", "", "X-Frame-Options: DENY",
  ].join("\r\n"));
  assert.equal(result.responses, 2);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.headerCount, 1);
  assert.equal(check(result, "hsts").status, "fail");
  assert.equal(check(result, "nosniff").status, "pass");
  assert.equal(check(result, "frame").status, "fail");
  assert.match(result.notes[0], /2 件/);
});

test("parses DevTools name/value pairs, status and URL-valued headers", () => {
  const result = analyzeHeaders([
    "全般", "Request URL", "https://private.example/secret", "レスポンス ヘッダー",
    ":status", "200", "x-content-type-options", "nosniff", "Location", "https://private.example/other",
    "referrer-policy", "same-origin", "リクエスト ヘッダー", "x-frame-options", "DENY",
  ].join("\n"));
  assert.equal(result.httpStatus, 200);
  assert.equal(result.headerCount, 3);
  assert.equal(check(result, "nosniff").status, "pass");
  assert.equal(check(result, "referrer").status, "pass");
  assert.equal(check(result, "frame").status, "fail");
  assert.doesNotMatch(JSON.stringify(result), /private\.example/);
});

test("leaves the score empty for malformed or body-only input", () => {
  for (const input of ["", "<html></html>", "HTTP/2 200\n\nX-Frame-Options: DENY"]) {
    const result = analyzeHeaders(input);
    assert.equal(result.score, null);
    assert.equal(result.headerCount, 0);
    assert.deepEqual(result.issues, []);
    assert.ok(result.notes.length);
  }
});

test("handles empty final blocks and reports the last distinct status", () => {
  const result = analyzeHeaders("HTTP/2 304\nETag: earlier\n\nHTTP/3 302\n\n");
  assert.equal(result.score, null);
  assert.equal(result.responses, 2);
  assert.equal(result.httpStatus, 302);
  assert.ok(result.notes.some((note) => note.includes("3xx")));
});

test("uses the initial HSTS directive and flags duplicate fields", () => {
  const firstUnset = analyzeHeaders("Strict-Transport-Security: max-age=0\nStrict-Transport-Security: max-age=31536000");
  assert.equal(check(firstUnset, "hsts").status, "fail");
  const duplicated = analyzeHeaders("Strict-Transport-Security: max-age=31536000\nStrict-Transport-Security: max-age=0");
  assert.equal(check(duplicated, "hsts").status, "warn");
  assert.equal(check(analyzeHeaders("Strict-Transport-Security: max-age=31536000; max-age=0"), "hsts").status, "fail");
});

test("does not treat report-only CSP as enforcement or framing", () => {
  const result = analyzeHeaders("Content-Security-Policy-Report-Only: default-src 'none'; frame-ancestors 'none'");
  assert.equal(check(result, "csp").status, "warn");
  assert.equal(check(result, "frame").status, "fail");
  assert.match(check(result, "csp").detail, /Report-Only/);
});

test("checks granular CSP script directives and framing precedence", () => {
  const result = analyzeHeaders([
    "Content-Security-Policy: default-src 'self'; script-src-elem *; script-src-attr 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors *",
    "X-Frame-Options: DENY",
  ].join("\n"));
  assert.equal(check(result, "csp").status, "warn");
  assert.equal(check(result, "frame").status, "warn");
  assert.match(check(result, "csp").detail, /スクリプト要素/);
  assert.match(check(result, "csp").detail, /インラインハンドラー/);
});

test("recognizes narrow enforced CSP when multiple policies apply and redacts nonce text", () => {
  const result = analyzeHeaders([
    "Content-Security-Policy: default-src *",
    "Content-Security-Policy: default-src 'none'; script-src 'nonce-AbCdEfGh123456' 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'",
  ].join("\n"));
  assert.equal(check(result, "csp").status, "pass");
  assert.equal(check(result, "frame").status, "pass");
  assert.doesNotMatch(JSON.stringify(result), /AbCdEfGh123456/);
});

test("uses the last recognized referrer policy and checks explicit Permissions-Policy directives", () => {
  const result = analyzeHeaders([
    "Referrer-Policy: no-referrer, unsafe-url, unknown",
    "Permissions-Policy: nonexistent-feature=(), camera=(), camera=*",
  ].join("\n"));
  assert.equal(check(result, "referrer").status, "fail");
  assert.equal(check(result, "permissions").status, "warn");
  assert.doesNotMatch(JSON.stringify(result), /nonexistent-feature/);
});

test("marks SameSite=None without Secure for review without revealing cookie data", () => {
  const result = analyzeHeaders("Set-Cookie: session=secret-value; HttpOnly; SameSite=None\nCache-Control: private");
  assert.equal(check(result, "cookies").status, "fail");
  assert.equal(check(result, "cache").status, "info");
  assert.doesNotMatch(JSON.stringify(result), /session=|secret-value/);
  assert.equal(result.score, analyzeHeaders("Content-Type: text/html").score);
});

test("limits input and keeps malformed response lines out of results", () => {
  assert.throws(() => analyzeHeaders("x".repeat(MAX_INPUT_LENGTH + 1)), RangeError);
  assert.throws(() => analyzeHeaders(null), TypeError);
  const result = analyzeHeaders("X-Content-Type-Options: nosniff\nMalformed line with a secret-value\nX-Test: bad\u0000value");
  assert.equal(result.headerCount, 1);
  assert.equal(check(result, "nosniff").status, "pass");
  assert.match(result.notes[0], /2 行/);
  assert.doesNotMatch(JSON.stringify(result), /secret-value|bad/);
});
