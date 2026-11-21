import assert from 'node:assert/strict';
import test from 'node:test';
import { equatorialProjector, lunarPhase, observationWindows, position, solarPosition } from '../public/js/astro.js';
import { constellationLinks, objects } from '../public/js/catalog.js';

const tokyo = { lat: 35.6762, lon: 139.6503 };
const sirius = { id: 'sirius', type: 'star', ra: 6.752481, dec: -16.716116 };
const polaris = { id: 'polaris', type: 'star', ra: 2.5303, dec: 89.2641 };
const moon = { id: 'moon', type: 'moon' };

function near(actual, expected, tolerance = 0.00001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} within ${tolerance} of ${expected}`);
}

test('projects fixed J2000 coordinates to the zenith and cardinal directions', () => {
  const date = new Date('2000-01-01T12:00:00Z');
  const project = equatorialProjector(date, { lat: 0, lon: 79.53938163 });
  near(project(0, 0).altitude, 90);
  near(project(6, 0).altitude, 0);
  near(project(6, 0).azimuth, 90);
  near(project(18, 0).altitude, 0);
  near(project(18, 0).azimuth, 270);
  near(project(0, 80).altitude, 10);
  near(project(0, 80).azimuth, 0);
});

test('star positions match the shared projection and precess to the observed date', () => {
  const date = new Date('2026-11-21T12:00:00Z');
  const projected = equatorialProjector(date, tokyo)(polaris.ra, polaris.dec);
  const direct = position(polaris, date, tokyo);
  near(projected.altitude, direct.altitude);
  near(projected.azimuth, direct.azimuth);
  near(direct.altitude, tokyo.lat, 1);
  assert.ok(direct.dec > polaris.dec);
});

test('approximates the apparent Sun, Moon and planets at a known time and location', () => {
  const date = new Date('2026-11-21T12:00:00Z');
  // Independent fixtures from Astronomy Engine 2.1.19, equator of date and
  // topocentric horizon, omitting refraction. Values are altitude and azimuth.
  const reference = {
    sun: [-54.13930, 285.98429],
    moon: [63.64441, 193.66396],
    mercury: [-61.74110, 320.64100],
    venus: [-63.62643, 355.60821],
    mars: [-21.99030, 52.24887],
    jupiter: [-20.93324, 54.42612],
    saturn: [53.58057, 199.66847],
    uranus: [50.68300, 100.80376],
  };
  for (const [id, [altitude, azimuth]] of Object.entries(reference)) {
    const body = id === 'moon' ? moon : { id, type: 'planet' };
    const actual = id === 'sun' ? solarPosition(date, tokyo) : position(body, date, tokyo);
    near(actual.altitude, altitude, 0.15);
    near(actual.azimuth, azimuth, 0.15);
    assert.ok(actual.ra >= 0 && actual.ra < 24);
    assert.ok(actual.dec >= -90 && actual.dec <= 90);
  }
});

test('every catalog object projects and constellation links reference real catalog stars', () => {
  const date = new Date('2026-11-21T12:00:00Z');
  const byId = new Map(objects.map((object) => [object.id, object]));
  assert.equal(byId.size, objects.length);
  for (const object of objects) {
    const { altitude, azimuth } = position(object, date, tokyo);
    assert.ok(altitude >= -90 && altitude <= 90, object.id);
    assert.ok(azimuth >= 0 && azimuth < 360, object.id);
  }
  for (const ids of constellationLinks) {
    assert.equal(ids.length, 2);
    for (const id of ids) assert.equal(byId.get(id)?.type, 'star', id);
  }
});

test('distinguishes an eclipse new moon, a full moon and a waxing moon', () => {
  const eclipse = lunarPhase(new Date('2024-04-08T18:17:00Z'));
  assert.equal(eclipse.name, '新月');
  near(eclipse.illumination, 0, 0.001);
  const full = lunarPhase(new Date('2025-07-10T21:00:00Z'));
  assert.equal(full.name, '満月');
  near(full.illumination, 0.99851, 0.001);
  near(full.age, 14.77, 0.1);
  const waxing = lunarPhase(new Date('2026-11-21T12:00:00Z'));
  assert.equal(waxing.waxing, true);
  near(waxing.illumination, 0.87016, 0.002);
});

test('finds separate nights and measures peaks inside visible windows', () => {
  const start = new Date('2026-01-10T12:00:00+09:00');
  const end = new Date('2026-01-12T12:00:00+09:00');
  const windows = observationWindows(sirius, start, end, tokyo);
  assert.equal(windows.length, 2);
  assert.ok(windows[0].end < windows[1].start);

  for (const window of windows) {
    assert.ok(start <= window.start && window.start <= window.peak);
    assert.ok(window.peak <= window.end && window.end <= end);
    for (const date of [window.start, window.peak, window.end]) {
      assert.ok(solarPosition(date, tokyo).altitude <= -12);
      assert.ok(position(sirius, date, tokyo).altitude >= 20);
    }
    near(window.peakAltitude, 37.57896, 0.001);
    near(position(sirius, window.peak, tokyo).altitude, window.peakAltitude);
  }
  assert.deepEqual(observationWindows(sirius, start, end, tokyo, { minAltitude: 40 }), []);
});

test('clips an ongoing observation window to the requested start and finish', () => {
  const start = new Date('2026-01-10T21:23:00+09:00');
  const end = new Date('2026-01-11T03:15:00+09:00');
  const [window, extra] = observationWindows(polaris, start, end, tokyo);
  assert.equal(extra, undefined);
  assert.deepEqual(window.start, start);
  assert.deepEqual(window.end, end);
  assert.deepEqual(observationWindows(polaris, end, start, tokyo), []);
});
