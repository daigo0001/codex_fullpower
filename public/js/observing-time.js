const minute = 60_000;
const day = 24 * 60 * minute;
const formatters = new Map();

function zonedParts(date, zone) {
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }));
  }
  return Object.fromEntries(formatters.get(zone).formatToParts(date).map(({ type, value }) => [type, value]));
}

export function localDate(date, zone) {
  const { year, month, day } = zonedParts(date, zone);
  return `${year}-${month}-${day}`;
}

export function localTime(date, zone) {
  const { hour, minute } = zonedParts(date, zone);
  return `${hour}:${minute}`;
}

function shiftDay(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * day).toISOString().slice(0, 10);
}

function zonedInstant(date, hour, zone) {
  const wallTime = Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(instant), zone);
    const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const difference = wallTime - represented;
    if (difference === 0) break;
    instant += difference;
  }
  return new Date(instant);
}

export function observingNight(date, zone) {
  const start = zonedInstant(date, 18, zone);
  const end = zonedInstant(shiftDay(date, 1), 6, zone);
  const noon = zonedInstant(date, 12, zone);
  const startPreview = zonedInstant(date, 21, zone);
  return {
    start, end, noon,
    minutes: (end - start) / minute,
    previewMinutes: (startPreview - start) / minute,
  };
}
