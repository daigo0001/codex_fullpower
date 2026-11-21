import assert from "node:assert/strict";
import { test } from "node:test";
import { localDate, localTime, observingNight } from "../public/js/observing-time.js";

test("observing night begins at local 18:00 and ends at local 06:00 the next day", () => {
  const zone = "Asia/Tokyo";
  const night = observingNight("2026-12-31", zone);
  assert.equal(night.start.toISOString(), "2026-12-31T09:00:00.000Z");
  assert.equal(localDate(night.end, zone), "2027-01-01");
  assert.equal(localTime(night.end, zone), "06:00");
  assert.equal(night.minutes, 720);
  assert.equal(night.previewMinutes, 180);
});

test("evening-to-morning timeline reflects spring and autumn daylight changes", () => {
  const zone = "Europe/London";
  const spring = observingNight("2026-03-28", zone);
  const autumn = observingNight("2026-10-24", zone);
  assert.equal(spring.minutes, 660);
  assert.equal(autumn.minutes, 780);
  for (const night of [spring, autumn]) {
    assert.equal(localTime(night.start, zone), "18:00");
    assert.equal(localTime(night.end, zone), "06:00");
  }
});
