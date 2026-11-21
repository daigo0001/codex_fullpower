import { equatorialProjector } from './astro.js';
import { faintStars } from './faint-stars.js';

const radians = Math.PI / 180;
const fullCircle = 2 * Math.PI;
const accent = '#ff9b6a';
const typeColors = {
  star: '#e9f0ff',
  planet: '#ffc18c',
  moon: '#f4e0b8',
  'deep-sky': '#aabefc',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function pointAt(altitude, azimuth, { x, y, radius }) {
  const angle = azimuth * radians;
  const distance = radius * (90 - altitude) / 90;
  return { x: x - Math.sin(angle) * distance, y: y - Math.cos(angle) * distance };
}

function traceCircle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, fullCircle);
}

function fillCircle(context, x, y, radius, fill) {
  traceCircle(context, x, y, radius);
  context.fillStyle = fill;
  context.fill();
}

function drawFrame(context, chart, showGrid) {
  const { x, y, radius } = chart;
  const sky = context.createRadialGradient(
    x, y - radius * 0.24, 0,
    x, y, radius * 1.1,
  );
  sky.addColorStop(0, '#192540');
  sky.addColorStop(0.7, '#131e33');
  sky.addColorStop(1, '#0d1526');
  fillCircle(context, x, y, radius, sky);

  if (!showGrid) return;

  context.lineWidth = 1;
  context.strokeStyle = '#95abce19';
  for (const altitude of [30, 60]) {
    traceCircle(context, x, y, radius * (90 - altitude) / 90);
    context.stroke();
  }

  context.beginPath();
  for (let azimuth = 0; azimuth < 360; azimuth += 45) {
    const inner = pointAt(90, azimuth, chart);
    const edge = pointAt(0, azimuth, chart);
    context.moveTo(inner.x, inner.y);
    context.lineTo(edge.x, edge.y);
  }
  context.stroke();

  context.fillStyle = '#8395b5';
  context.font = '9px "IBM Plex Mono", monospace';
  context.textBaseline = 'bottom';
  context.textAlign = 'left';
  for (const altitude of [30, 60]) {
    const anchor = pointAt(altitude, 0, chart);
    context.fillText(`${altitude}°`, anchor.x + 5, anchor.y - 2);
  }
}

function drawCompass(context, chart) {
  const { x, y, radius } = chart;
  traceCircle(context, x, y, radius);
  context.lineWidth = 1;
  context.strokeStyle = '#506380';
  context.stroke();

  context.beginPath();
  for (let azimuth = 0; azimuth < 360; azimuth += 10) {
    const onAxis = azimuth % 90 === 0;
    const start = pointAt(0, azimuth, chart);
    const end = pointAt(0, azimuth, { x, y, radius: radius + (onAxis ? 8 : 3) });
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
  }
  context.strokeStyle = '#647a9d80';
  context.stroke();

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 11px "IBM Plex Mono", monospace';
  for (const [azimuth, label] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
    const edge = pointAt(0, azimuth, { x, y, radius: radius + 17 });
    context.fillStyle = azimuth === 0 ? accent : '#adbdd4';
    context.fillText(label, edge.x, edge.y);
  }

  const mark = 4;
  context.beginPath();
  context.moveTo(x - mark, y);
  context.lineTo(x + mark, y);
  context.moveTo(x, y - mark);
  context.lineTo(x, y + mark);
  context.strokeStyle = '#6c809d';
  context.stroke();
}

function drawFaintStars(context, background, chart) {
  for (const star of background) {
    const { x, y } = pointAt(star.altitude, star.azimuth, chart);
    const brightness = clamp((5.8 - star.magnitude) / 5, 0.08, 0.85);
    context.globalAlpha = 0.17 + brightness * 0.58;
    fillCircle(context, x, y, 0.39 + brightness * 0.81, '#c5d6f6');
  }
  context.globalAlpha = 1;
}

function drawConstellations(context, stars, links) {
  context.beginPath();
  for (const [startId, endId] of links) {
    const start = stars.get(startId);
    const end = stars.get(endId);
    if (!start || !end) continue;
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
  }
  context.strokeStyle = '#849fd05c';
  context.lineWidth = 1;
  context.stroke();
}

function drawObject(context, { object, x, y }) {
  const color = object.color || typeColors[object.type];
  if (object.type === 'deep-sky') {
    const size = 5;
    context.beginPath();
    context.moveTo(x, y - size);
    context.lineTo(x + size, y);
    context.lineTo(x, y + size);
    context.lineTo(x - size, y);
    context.closePath();
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.stroke();
    return;
  }

  const magnitude = Number.isFinite(object.magnitude) ? object.magnitude : 3;
  const radius = object.type === 'moon' ? 5.5 : clamp(2.6 - magnitude * 0.43, 1.35, 4);
  context.globalAlpha = 0.13;
  fillCircle(context, x, y, radius + 3, color);
  context.globalAlpha = 0.27;
  fillCircle(context, x, y, radius + 1.3, color);
  context.globalAlpha = 1;
  fillCircle(context, x, y, radius, color);
}

function drawSelection(context, { x, y }) {
  fillCircle(context, x, y, 13, '#ff9b6a13');
  traceCircle(context, x, y, 11.5);
  context.strokeStyle = accent;
  context.lineWidth = 1;
  context.stroke();
}

function drawLabels(context, plotted, selected, chart, width) {
  context.font = '500 11px "Noto Sans JP", system-ui, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.lineWidth = 3;
  context.strokeStyle = '#101827';
  const occupied = [];
  let labels = 0;
  const limit = width < 450 ? 5 : 10;

  const byBrightness = [...plotted].sort((a, b) => (
    (a.object.magnitude ?? 10) - (b.object.magnitude ?? 10)
  ));
  const ordered = selected ? [selected, ...byBrightness.filter(point => point !== selected)] : byBrightness;
  for (const point of ordered) {
    if (labels >= limit) break;
    const active = point === selected;
    if (!active && point.object.type === 'star' && point.object.magnitude > 2.2) continue;

    const label = point.object.name;
    const labelWidth = context.measureText(label).width;
    const offset = active ? 17 : 8;
    const labelY = point.y + (active ? 1 : -5);
    const options = [point.x + offset, point.x - offset - labelWidth];
    for (const labelX of options) {
      const right = labelX + labelWidth;
      if (Math.hypot(labelX - chart.x, labelY - chart.y) > chart.radius - 7
        || Math.hypot(right - chart.x, labelY - chart.y) > chart.radius - 7) continue;
      if (occupied.some(box => labelX - 4 < box.right && right + 4 > box.left
        && Math.abs(box.y - labelY) < 16)) continue;
      context.fillStyle = active ? accent : '#d1dbec';
      context.strokeText(label, labelX, labelY);
      context.fillText(label, labelX, labelY);
      occupied.push({ left: labelX, right, y: labelY });
      labels += 1;
      break;
    }
  }
}

export function createSkyMap(canvas, { onSelect, onHover } = {}) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D Canvas is unavailable');

  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  if (!canvas.hasAttribute('aria-label')) {
    canvas.setAttribute('aria-label', '星図。北が上、東が左です。プラス・マイナスキーで拡大縮小できます。');
  }

  let state = { objects: [] };
  let view = { zoom: 1, x: 0, y: 0 };
  let plotted = [];
  let background = [];
  let backgroundKey = null;
  let animationFrame = 0;
  let chartRadius = 1;
  let drag = null;

  function ensureBackground(date, location) {
    const dateMs = date instanceof Date ? date.getTime() : Number(date);
    if (!Number.isFinite(dateMs) || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lon)) {
      background = [];
      backgroundKey = null;
      return;
    }
    const key = `${dateMs}:${location.lat}:${location.lon}`;
    if (backgroundKey === key) return;

    const project = equatorialProjector(new Date(dateMs), location);
    background = [];
    for (const [ra, dec, magnitude] of faintStars) {
      const sky = project(ra, dec);
      if (sky.altitude >= 0) background.push({ ...sky, magnitude });
    }
    backgroundKey = key;
  }

  function repaint() {
    animationFrame = 0;
    const { width, height } = canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    chartRadius = Math.max(1, Math.min(width - 55, height - 58) * 0.5);
    const chart = { x: width * 0.5 + view.x, y: height * 0.5 + view.y, radius: chartRadius * view.zoom };
    drawFrame(context, chart, state.showGrid !== false);

    plotted = [];
    const pointsById = new Map();
    for (const object of state.objects) {
      if (!Number.isFinite(object.altitude) || !Number.isFinite(object.azimuth) || object.altitude < 0) continue;
      const point = { ...pointAt(object.altitude, object.azimuth, chart), object };
      plotted.push(point);
      pointsById.set(object.id, point);
    }

    context.save();
    traceCircle(context, chart.x, chart.y, chart.radius);
    context.clip();
    if (state.showBackdrop !== false) {
      ensureBackground(state.date, state.location);
      drawFaintStars(context, background, chart);
    }
    if (state.showConstellations !== false) {
      drawConstellations(context, pointsById, state.constellationLinks ?? []);
    }
    for (const point of plotted) drawObject(context, point);
    const selected = pointsById.get(state.selectedId);
    if (selected) drawSelection(context, selected);
    drawLabels(context, plotted, selected, chart, width);
    context.restore();

    drawCompass(context, chart);
  }

  function schedule() {
    if (!animationFrame) animationFrame = requestAnimationFrame(repaint);
  }

  function setView(zoom, x, y) {
    const movement = chartRadius * (zoom - 1);
    view = {
      zoom,
      x: clamp(x, -movement, movement),
      y: clamp(y, -movement, movement),
    };
    onHover?.(null);
    schedule();
  }

  function zoomBy(factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const zoom = clamp(view.zoom * factor, 1, 3.5);
    const scale = zoom / view.zoom;
    setView(zoom, view.x * scale, view.y * scale);
  }

  function resetView() {
    setView(1, 0, 0);
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function hitTest({ x, y }) {
    let nearest = null;
    let distance = 12;
    for (const point of plotted) {
      const candidate = Math.hypot(point.x - x, point.y - y);
      if (candidate < distance) {
        nearest = point.object;
        distance = candidate;
      }
    }
    return nearest;
  }

  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    drag = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      viewX: view.x, viewY: view.y, moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    if (drag?.pointerId === event.pointerId) {
      const x = event.clientX - drag.startX;
      const y = event.clientY - drag.startY;
      drag.moved ||= Math.hypot(x, y) > 5;
      if (drag.moved && view.zoom > 1) {
        canvas.style.cursor = 'grabbing';
        setView(view.zoom, drag.viewX + x, drag.viewY + y);
      }
      return;
    }
    const point = localPoint(event);
    const object = hitTest(point);
    canvas.style.cursor = object ? 'pointer' : view.zoom > 1 ? 'grab' : 'crosshair';
    onHover?.(object, point);
  }

  function pointerUp(event) {
    if (drag?.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      const object = hitTest(localPoint(event));
      if (object) onSelect?.(object);
    }
    drag = null;
    canvas.style.cursor = view.zoom > 1 ? 'grab' : 'crosshair';
  }

  function clearPointer() {
    drag = null;
    canvas.style.cursor = '';
    onHover?.(null);
  }

  function pointerLeave() {
    if (!drag) clearPointer();
  }

  function keyDown(event) {
    const pan = 32;
    switch (event.key) {
      case '+':
      case '=': zoomBy(1.25); break;
      case '-': zoomBy(0.8); break;
      case 'Home': resetView(); break;
      case 'ArrowLeft': setView(view.zoom, view.x - pan, view.y); break;
      case 'ArrowRight': setView(view.zoom, view.x + pan, view.y); break;
      case 'ArrowUp': setView(view.zoom, view.x, view.y - pan); break;
      case 'ArrowDown': setView(view.zoom, view.x, view.y + pan); break;
      default: return;
    }
    event.preventDefault();
  }

  const events = {
    pointerdown: pointerDown,
    pointermove: pointerMove,
    pointerup: pointerUp,
    pointercancel: clearPointer,
    pointerleave: pointerLeave,
    lostpointercapture: clearPointer,
    keydown: keyDown,
  };
  for (const [type, listener] of Object.entries(events)) canvas.addEventListener(type, listener);
  const sizeObserver = new ResizeObserver(schedule);
  sizeObserver.observe(canvas);

  return {
    render(nextState) {
      state = nextState;
      schedule();
    },
    destroy() {
      sizeObserver.disconnect();
      for (const [type, listener] of Object.entries(events)) canvas.removeEventListener(type, listener);
      cancelAnimationFrame(animationFrame);
    },
    resetView,
    zoomBy,
  };
}
