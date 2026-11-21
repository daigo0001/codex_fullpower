const RAD = Math.PI / 180;
const DAY = 86_400_000;
const MINUTE = 60_000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const SYNODIC_MONTH = 29.5305889;
const LIGHT_DAYS_PER_AU = 0.0057755183;
const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;
const EARTH_ECCENTRICITY_SQUARED = 0.00669438;

// JPL approximate ecliptic orbital elements and rates, valid 1800–2050.
// The columns are a (AU), e, I, L, longitude of perihelion and longitude of node.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
const orbitalElements = {
  mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  ],
  earth: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  mars: [
    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  jupiter: [
    [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
  uranus: [
    [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  ],
};

function normalize(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function daysSinceJ2000(date) {
  return (date.getTime() - J2000) / DAY;
}

function rotateZ([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function rotateX([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function subtract([x, y, z], [originX, originY, originZ]) {
  return [x - originX, y - originY, z - originZ];
}

function sphericalVector(longitude, latitude, distance = 1) {
  const projected = distance * Math.cos(latitude);
  return [projected * Math.cos(longitude), projected * Math.sin(longitude), distance * Math.sin(latitude)];
}

function orbitVector(id, centuries) {
  const [epoch, rates] = orbitalElements[id];
  const [a, e, inclination, longitude, perihelion, node] = epoch.map(
    (element, i) => element + rates[i] * centuries,
  );
  const meanAnomaly = normalize(longitude - perihelion) * RAD;
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 6; i++) {
    eccentricAnomaly -= (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - meanAnomaly)
      / (1 - e * Math.cos(eccentricAnomaly));
  }
  const orbital = [a * (Math.cos(eccentricAnomaly) - e), a * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly), 0];
  const fromNode = rotateZ(orbital, (perihelion - node) * RAD);
  return rotateZ(rotateX(fromNode, inclination * RAD), node * RAD);
}

function meanObliquity(centuries) {
  return (23.439291111 - 0.013004167 * centuries - 0.000000164 * centuries ** 2
    + 0.000000504 * centuries ** 3) * RAD;
}

function precessToDate(centuries) {
  const arcseconds = RAD / 3600;
  const square = centuries ** 2;
  const cube = centuries ** 3;
  const zeta = (2306.2181 * centuries + 0.30188 * square + 0.017998 * cube) * arcseconds;
  const z = (2306.2181 * centuries + 1.09468 * square + 0.018203 * cube) * arcseconds;
  const theta = (2004.3109 * centuries - 0.42665 * square - 0.041833 * cube) * arcseconds;
  const sine = Math.sin(theta);
  const cosine = Math.cos(theta);
  return (vector) => {
    const [x, y, height] = rotateZ(vector, zeta);
    return rotateZ([x * cosine - height * sine, y, x * sine + height * cosine], z);
  };
}

function observerView(days, { lat, lon }) {
  const centuries = days / 36525;
  const sidereal = normalize(280.46061837 + 360.98564736629 * days
    + 0.000387933 * centuries ** 2 - centuries ** 3 / 38710000 + lon) * RAD;
  const sinLatitude = Math.sin(lat * RAD);
  const cosLatitude = Math.cos(lat * RAD);
  const sinSidereal = Math.sin(sidereal);
  const cosSidereal = Math.cos(sidereal);
  const normalRadius = EARTH_EQUATORIAL_RADIUS_KM
    / Math.sqrt(1 - EARTH_ECCENTRICITY_SQUARED * sinLatitude ** 2);

  return {
    vectorKm: [
      normalRadius * cosLatitude * cosSidereal,
      normalRadius * cosLatitude * sinSidereal,
      normalRadius * (1 - EARTH_ECCENTRICITY_SQUARED) * sinLatitude,
    ],
    project([x, y, z]) {
      const meridian = x * cosSidereal + y * sinSidereal;
      const east = -x * sinSidereal + y * cosSidereal;
      const north = z * cosLatitude - meridian * sinLatitude;
      const up = z * sinLatitude + meridian * cosLatitude;
      return {
        azimuth: normalize(Math.atan2(east, north) / RAD),
        altitude: Math.atan2(up, Math.hypot(east, north)) / RAD,
      };
    },
  };
}

function solarVector(centuries) {
  return orbitVector('earth', centuries).map((axis) => -axis);
}

function planetVector(id, centuries) {
  const sun = solarVector(centuries);
  const orbit = orbitVector(id, centuries);
  const lightDelay = Math.hypot(...orbit.map((axis, i) => axis + sun[i])) * LIGHT_DAYS_PER_AU / 36525;
  return orbitVector(id, centuries - lightDelay).map((axis, i) => axis + sun[i]);
}

// Largest periodic terms from Meeus, Astronomical Algorithms, chapter 47.
// The reduced series is for sky planning at sub-degree precision.
function lunarCoordinates(centuries) {
  const square = centuries ** 2;
  const longitude = normalize(218.3164477 + 481267.88123421 * centuries - 0.0015786 * square);
  const d = normalize(297.8501921 + 445267.1114034 * centuries - 0.0018819 * square);
  const m = normalize(357.5291092 + 35999.0502909 * centuries - 0.0001536 * square);
  const moon = normalize(134.9633964 + 477198.8675055 * centuries + 0.0087414 * square);
  const f = normalize(93.2720950 + 483202.0175233 * centuries - 0.0036539 * square);
  const sin = (degrees) => Math.sin(degrees * RAD);
  const cos = (degrees) => Math.cos(degrees * RAD);

  return {
    longitude: normalize(longitude + 6.288774 * sin(moon) + 1.274027 * sin(2 * d - moon)
      + 0.658314 * sin(2 * d) + 0.213618 * sin(2 * moon) - 0.185116 * sin(m)
      - 0.114332 * sin(2 * f) + 0.058793 * sin(2 * d - 2 * moon)
      + 0.057066 * sin(2 * d - m - moon) + 0.053322 * sin(2 * d + moon)
      + 0.045758 * sin(2 * d - m) - 0.040923 * sin(m - moon) - 0.034720 * sin(d)
      - 0.030383 * sin(m + moon) + 0.015327 * sin(2 * d - 2 * f)
      - 0.012528 * sin(2 * f + moon) + 0.010980 * sin(2 * f - moon)),
    latitude: 5.128122 * sin(f) + 0.280602 * sin(moon + f) + 0.277693 * sin(moon - f)
      + 0.173237 * sin(2 * d - f) + 0.055413 * sin(2 * d - moon + f)
      + 0.046271 * sin(2 * d - moon - f) + 0.032573 * sin(2 * d + f)
      + 0.017198 * sin(2 * moon + f) + 0.009266 * sin(2 * d + moon - f)
      + 0.008822 * sin(2 * moon - f) + 0.008216 * sin(2 * d - m - f),
    distance: 385000.56 - 20905.355 * cos(moon) - 3699.111 * cos(2 * d - moon)
      - 2955.968 * cos(2 * d) - 569.925 * cos(2 * moon) + 246.158 * cos(2 * moon - 2 * d)
      - 204.586 * cos(m - 2 * d) - 170.733 * cos(2 * d + moon),
  };
}

function equatorialOfDate(vector, centuries) {
  return precessToDate(centuries)(rotateX(vector, meanObliquity(0)));
}

function describePosition(vector, view) {
  const [x, y, z] = vector;
  return {
    ...view.project(vector),
    ra: normalize(Math.atan2(y, x) / RAD) / 15,
    dec: Math.atan2(z, Math.hypot(x, y)) / RAD,
  };
}

/** Project multiple fixed J2000 coordinates (RA hours, declination degrees). */
export function equatorialProjector(date, location) {
  const days = daysSinceJ2000(date);
  const view = observerView(days, location);
  const precess = precessToDate(days / 36525);
  return (ra, dec) => view.project(precess(sphericalVector(ra * 15 * RAD, dec * RAD)));
}

/** Return geometric altitude and azimuth (north clockwise) in degrees, plus RA in hours and declination in degrees. */
export function position(object, date, location) {
  const days = daysSinceJ2000(date);
  const centuries = days / 36525;
  const view = observerView(days, location);

  if (object.type === 'moon') {
    const moon = lunarCoordinates(centuries);
    const equatorial = rotateX(sphericalVector(moon.longitude * RAD, moon.latitude * RAD, moon.distance),
      meanObliquity(centuries));
    return describePosition(subtract(equatorial, view.vectorKm), view);
  }
  if (object.type === 'planet') {
    if (!Object.hasOwn(orbitalElements, object.id) || object.id === 'earth') {
      throw new RangeError(`Unknown planet: ${object.id}`);
    }
    return describePosition(equatorialOfDate(planetVector(object.id, centuries), centuries), view);
  }
  const fixed = sphericalVector(object.ra * 15 * RAD, object.dec * RAD);
  return describePosition(precessToDate(centuries)(fixed), view);
}

/** Geometric solar position, without atmospheric refraction. */
export function solarPosition(date, location) {
  const days = daysSinceJ2000(date);
  const centuries = days / 36525;
  return describePosition(equatorialOfDate(solarVector(centuries), centuries), observerView(days, location));
}

const phaseNames = ['新月', '満ちる細い月', '上弦', '満ちていく月', '満月', '欠けていく月', '下弦', '欠ける細い月'];

/** Phase name, illuminated fraction and approximate age derived from geocentric elongation. */
export function lunarPhase(date) {
  const centuries = daysSinceJ2000(date) / 36525;
  const moon = lunarCoordinates(centuries);
  const sunEquatorial = equatorialOfDate(solarVector(centuries), centuries);
  const [sunX, sunY] = rotateX(sunEquatorial, -meanObliquity(centuries));
  const elongation = normalize(moon.longitude - Math.atan2(sunY, sunX) / RAD);

  return {
    illumination: (1 - Math.cos(elongation * RAD) * Math.cos(moon.latitude * RAD)) / 2,
    age: elongation * SYNODIC_MONTH / 360,
    name: phaseNames[Math.round(elongation / 45) % phaseNames.length],
    waxing: elongation < 180,
  };
}

function crossingTime(intervalStart, intervalEnd, endVisible, measure) {
  let left = intervalStart;
  let right = intervalEnd;
  while (right - left > MINUTE / 2) {
    const midpoint = Math.floor((left + right) / 2);
    if (measure(midpoint).visible === endVisible) right = midpoint;
    else left = midpoint;
  }
  return endVisible ? right : left;
}

function makeWindow(start, end, best, measure) {
  let left = Math.max(start, best.time - 5 * MINUTE);
  let right = Math.min(end, best.time + 5 * MINUTE);
  while (right - left > MINUTE / 2) {
    const third = (right - left) / 3;
    if (measure(left + third).altitude < measure(right - third).altitude) left += third;
    else right -= third;
  }
  const candidates = [best, measure(start), measure(end), measure((left + right) / 2)];
  const peak = candidates.reduce((highest, point) => point.altitude > highest.altitude ? point : highest);
  return { start: new Date(start), end: new Date(end), peak: new Date(peak.time), peakAltitude: peak.altitude };
}

/**
 * Find intervals in the given date range when the target and Sun fulfill both altitude limits.
 * Sample five-minute intervals and refine detected crossings to within 30 seconds.
 */
export function observationWindows(object, startDate, endDate, location, {
  minAltitude = 20,
  maxSolarAltitude = -12,
} = {}) {
  const start = startDate.getTime();
  const end = endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const measure = (time) => {
    const date = new Date(time);
    const altitude = position(object, date, location).altitude;
    return { time, altitude, visible: altitude >= minAltitude && solarPosition(date, location).altitude <= maxSolarAltitude };
  };

  const windows = [];
  let previous = measure(start);
  let windowStart = previous.visible ? start : null;
  let best = previous.visible ? previous : null;
  while (previous.time < end) {
    const current = measure(Math.min(end, previous.time + 5 * MINUTE));
    if (!previous.visible && current.visible) {
      windowStart = crossingTime(previous.time, current.time, true, measure);
      best = current;
    }
    if (current.visible && current.altitude > best.altitude) best = current;
    if (previous.visible && !current.visible) {
      const windowEnd = crossingTime(previous.time, current.time, false, measure);
      windows.push(makeWindow(windowStart, windowEnd, best, measure));
      windowStart = null;
    }
    previous = current;
  }
  if (windowStart !== null) windows.push(makeWindow(windowStart, end, best, measure));
  return windows;
}
