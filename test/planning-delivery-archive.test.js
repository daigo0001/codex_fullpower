import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeliveryArchive } from "../public/planning/delivery-archive.js";

test("writes UTF-8 names and contents with STORE headers and valid directory offsets", () => {
  const documents = [
    { path: "docs/要件.md", markdown: "123456789" },
    { path: "docs/工程🚀.md", markdown: "工程表\n着手: 開発 🚀" },
    { path: "README.md", markdown: "" },
  ];
  const bytes = createDeliveryArchive(documents);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset) => view.getUint16(offset, true);
  const u32 = (offset) => view.getUint32(offset, true);
  const decode = (offset, len) => new TextDecoder().decode(bytes.subarray(offset, offset + len));

  const end = bytes.length - 22;
  assert.equal(u32(end), 0x06054b50);
  assert.equal(u16(end + 8), documents.length);
  assert.equal(u16(end + 10), documents.length);
  const directoryStart = u32(end + 16);
  assert.equal(directoryStart + u32(end + 12), end);

  let directory = directoryStart;
  let nextLocal = 0;
  for (const document of documents) {
    const local = u32(directory + 42);
    assert.equal(local, nextLocal);
    assert.equal(u32(local), 0x04034b50);
    assert.equal(u32(directory), 0x02014b50);
    assert.equal(u16(local + 6), 0x0800);
    assert.equal(u16(directory + 8), 0x0800);
    assert.equal(u16(local + 8), 0);
    assert.equal(u16(directory + 10), 0);
    assert.equal(u16(local + 12), 0x0021);
    assert.equal(u16(directory + 14), 0x0021);
    const nameSize = u16(local + 26);
    const contentSize = u32(local + 22);
    assert.equal(u16(directory + 28), nameSize);
    assert.equal(u32(directory + 24), contentSize);
    assert.equal(u32(directory + 20), contentSize);
    assert.equal(u32(directory + 16), u32(local + 14));
    assert.equal(decode(directory + 46, nameSize), document.path);
    assert.equal(decode(local + 30, nameSize), document.path);
    assert.equal(decode(local + 30 + nameSize, contentSize), document.markdown);
    nextLocal += 30 + nameSize + contentSize;
    directory += 46 + nameSize;
  }
  assert.equal(nextLocal, directoryStart);
  assert.equal(directory, end);
  assert.equal(u32(14), 0xcbf43926); // Standard CRC-32 test vector, "123456789"
});

test("writes a valid empty archive", () => {
  const bytes = createDeliveryArchive([]);
  assert.deepEqual(bytes, Uint8Array.of(0x50, 0x4b, 0x05, 0x06, ...new Uint8Array(18)));
});

test("rejects unsafe and non-portable ZIP entry paths", () => {
  const paths = [
    "", "/x.md", "../x.md", "./x.md", "folder/../x.md", "folder//x.md", "folder/",
    "folder\\x.md", "C:x.md", "NUL.md", "a. /x.md", "bad\u0000name.md", "bad\ud800name.md",
  ];
  for (const path of paths) {
    assert.throws(() => createDeliveryArchive([{ path, markdown: "" }]), TypeError, JSON.stringify(path));
  }
});

test("rejects duplicate, normalized, and file-directory collisions", () => {
  const pairs = [
    ["README.md", "README.md"],
    ["docs/README.md", "Docs/readme.md"],
    ["doc/é.md", "doc/e\u0301.md"],
    ["docs", "DOCS/file.md"],
    ["docs/file.md", "DOCS"],
  ];
  for (const [first, second] of pairs) {
    assert.throws(() => createDeliveryArchive([
      { path: first, markdown: "first" },
      { path: second, markdown: "second" },
    ]), TypeError);
  }
});
