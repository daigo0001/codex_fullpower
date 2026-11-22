import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { test } from "node:test";

import {
  PBKDF2_ITERATIONS,
  MAX_MESSAGE_BYTES,
  MAX_PASSWORD_BYTES,
  bytesToHex,
  createDemoKey,
  decryptMessage,
  encryptMessage,
  hashPassword,
  verifyPassword,
} from "../public/crypto/demos.js";

test("the same UTF-8 password uses a fresh salt and derives independent PBKDF2 hashes", async () => {
  assert.equal(PBKDF2_ITERATIONS, 600_000);
  const password = "読書サンプル-🌿";
  const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
  assert.equal(first.salt.length, 16);
  assert.equal(second.salt.length, 16);
  assert.equal(first.hash.length, 32);
  assert.equal(second.hash.length, 32);
  assert.notDeepEqual(first.salt, second.salt);
  assert.notDeepEqual(first.hash, second.hash);
  const expected = pbkdf2Sync(password, first.salt, 600_000, 32, "sha256");
  assert.equal(bytesToHex(first.hash), expected.toString("hex"));
});

test("password verification uses the stored salt and requires matching UTF-8 bytes", async () => {
  const password = "démo 🐈";
  const salt = Uint8Array.from({ length: 16 }, (_, index) => index);
  const hash = pbkdf2Sync(password, salt, 600_000, 32, "sha256");
  const record = { salt, hash };
  const candidates = [password, "different", password.normalize("NFD")];
  const actual = await Promise.all(candidates.map((candidate) => verifyPassword(candidate, record)));
  assert.deepEqual(actual, [true, false, false]);
  await assert.rejects(verifyPassword(password, { ...record, salt: salt.slice(1) }), TypeError);
});

test("AES-GCM uses a nonextractable 256-bit key, fresh nonces and separate tags", async () => {
  const key = await createDemoKey();
  assert.equal(key.extractable, false);
  assert.equal(key.algorithm.name, "AES-GCM");
  assert.equal(key.algorithm.length, 256);
  await assert.rejects(crypto.subtle.exportKey("raw", key), { name: "InvalidAccessError" });

  const text = "\uFEFF研修用データ 🌿";
  const [first, second] = await Promise.all([encryptMessage(text, key), encryptMessage(text, key)]);
  assert.equal(first.nonce.length, 12);
  assert.equal(first.tag.length, 16);
  assert.notDeepEqual(first.nonce, second.nonce);
  assert.notDeepEqual(first.ciphertext, second.ciphertext);
  assert.equal(await decryptMessage(first, key), text);
  assert.equal(await decryptMessage(second, key), text);
});

test("AES-GCM refuses ciphertext, tag, nonce or key changes", async () => {
  const [key, wrongKey] = await Promise.all([createDemoKey(), createDemoKey()]);
  const record = await encryptMessage("確認", key);
  for (const part of ["ciphertext", "tag", "nonce"]) {
    const modified = record[part].slice();
    modified[0] ^= 1;
    await assert.rejects(decryptMessage({ ...record, [part]: modified }, key), { name: "OperationError" });
  }
  await assert.rejects(decryptMessage(record, wrongKey), { name: "OperationError" });
  assert.equal(await decryptMessage(record, key), "確認");
});

test("demo inputs enforce UTF-8 byte limits and support encrypting empty text", async () => {
  const key = await createDemoKey();
  const empty = await encryptMessage("", key);
  assert.equal(empty.ciphertext.length, 0);
  assert.equal(await decryptMessage(empty, key), "");
  await assert.rejects(hashPassword(""), RangeError);
  await assert.rejects(hashPassword("あ".repeat(Math.floor(MAX_PASSWORD_BYTES / 3) + 1)), RangeError);
  await assert.rejects(encryptMessage("あ".repeat(Math.floor(MAX_MESSAGE_BYTES / 3) + 1), key), RangeError);
  await assert.rejects(decryptMessage({ ...empty, tag: empty.tag.slice(1) }, key), TypeError);
  assert.equal(bytesToHex(Uint8Array.of(0, 10, 15, 16, 255)), "000a0f10ff");
});
