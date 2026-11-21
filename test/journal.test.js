import assert from "node:assert/strict";
import test from "node:test";
import { LIBRARY_KEY, loadLibrary } from "../public/js/journal.js";

function memoryStorage(initial) {
  const records = new Map();
  if (initial !== undefined) records.set(LIBRARY_KEY, initial);
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
}

test("favorite toggles persist and maintain insertion order", () => {
  const storage = memoryStorage();
  const library = loadLibrary(storage);
  assert.equal(library.toggleFavorite("vega"), true);
  assert.equal(library.toggleFavorite("moon"), true);
  assert.equal(library.toggleFavorite("vega"), false);
  assert.equal(library.hasFavorite("vega"), false);
  assert.deepEqual(loadLibrary(storage).favorites, ["moon"]);
});

test("journal entries normalize instants, sort by observation date and can be deleted", () => {
  const storage = memoryStorage();
  const library = loadLibrary(storage);
  const newest = library.addEntry({ targetId: "vega", date: "2026-08-07T23:12:00+09:00", note: "  肉眼で確認  ", rating: 4 });
  const oldest = library.addEntry({ targetId: "moon", date: new Date("2026-03-01T17:00:00Z"), note: "上弦の月" });
  assert.equal(newest.date, "2026-08-07T14:12:00.000Z");
  assert.equal(newest.note, "肉眼で確認");
  assert.equal(newest.rating, 4);
  assert.equal(oldest.rating, null);
  assert.deepEqual(loadLibrary(storage).entries, [newest, oldest]);
  assert.equal(library.deleteEntry(newest.id), true);
  assert.equal(library.deleteEntry(newest.id), false);
  assert.deepEqual(loadLibrary(storage).entries, [oldest]);
});

test("malformed storage is recovered and valid records are kept", () => {
  assert.deepEqual(loadLibrary(memoryStorage("{")).entries, []);
  const entry = { id: "1", targetId: "moon", date: "2026-03-01T17:00:00Z", note: "観測成功", rating: 9 };
  const storage = memoryStorage(JSON.stringify({
    favorites: ["moon", null, "moon", "   ", 1],
    entries: [null, { ...entry, date: "invalid" }, entry, entry, { ...entry, id: "2", note: "" }],
  }));
  const library = loadLibrary(storage);
  assert.deepEqual(library.favorites, ["moon"]);
  assert.deepEqual(library.entries, [{ ...entry, rating: null, date: "2026-03-01T17:00:00.000Z" }]);
  assert.throws(() => library.addEntry({ targetId: "moon", date: "invalid", note: "観測成功" }), TypeError);
  assert.equal(library.entries.length, 1);
});

test("storage access and quota failures preserve changes in memory and can recover", () => {
  const stored = memoryStorage();
  let available = false;
  const library = loadLibrary({
    getItem(key) {
      if (!available) throw new Error("storage blocked");
      return stored.getItem(key);
    },
    setItem(key, value) {
      if (!available) throw new Error("quota exceeded");
      stored.setItem(key, value);
    },
  });

  assert.equal(library.persistenceError, true);
  library.toggleFavorite("moon");
  assert.deepEqual(library.favorites, ["moon"]);
  available = true;
  library.toggleFavorite("vega");
  assert.equal(library.persistenceError, false);
  assert.deepEqual(loadLibrary(stored).favorites, ["moon", "vega"]);
});
