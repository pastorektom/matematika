import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/rng.js';
import { recognizeShape, snapLineAngle, createHoldDetector, HOLD_MS, REST_PX } from '../js/ui/shapes.js';

const deg = (a) => (a * Math.PI) / 180;
const jit = (rng, amp = 2.5) => (rng() - 0.5) * 2 * amp;

// Pomocné generátory „ručně“ nakreslených tahů (rovnoměrné vzorkování, náhodný šum).
function along(poly, step, rng, amp) {
  const pts = [];
  for (let i = 0; i + 1 < poly.length; i++) {
    const [a, b] = [poly[i], poly[i + 1]];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push({ x: a.x + (b.x - a.x) * t + jit(rng, amp), y: a.y + (b.y - a.y) * t + jit(rng, amp) });
    }
  }
  const last = poly.at(-1);
  pts.push({ x: last.x + jit(rng, amp), y: last.y + jit(rng, amp) });
  return pts;
}
const line = (x0, y0, ang, len, seed, wob = 0.02) => {
  const rng = makeRng(seed);
  const pts = along([{ x: x0, y: y0 }, { x: x0 + len * Math.cos(deg(ang)), y: y0 + len * Math.sin(deg(ang)) }], 4, rng, 2.5);
  // pomalé vlnění (ruka) kolmo na směr
  return pts.map((p, i) => {
    const w = Math.sin((i / pts.length) * Math.PI * 2) * len * wob;
    return { x: p.x - Math.sin(deg(ang)) * w, y: p.y + Math.cos(deg(ang)) * w };
  });
};
function ellipse(cx, cy, a, b, rotDeg, seed, { frac = 1, over = 0.04 } = {}) {
  const rng = makeRng(seed);
  const n = 90;
  const pts = [];
  const total = Math.PI * 2 * (frac + (frac === 1 ? over : 0));
  const start = rng() * 6;
  for (let i = 0; i <= n * (frac + (frac === 1 ? over : 0)); i++) {
    const t = start + (i / n) * Math.PI * 2;
    if (t - start > total) break;
    const x = a * Math.cos(t);
    const y = b * Math.sin(t);
    pts.push({
      x: cx + x * Math.cos(deg(rotDeg)) - y * Math.sin(deg(rotDeg)) + jit(rng),
      y: cy + x * Math.sin(deg(rotDeg)) + y * Math.cos(deg(rotDeg)) + jit(rng),
    });
  }
  return pts;
}
function poly(corners, seed, close = true) {
  const rng = makeRng(seed);
  const c = close ? [...corners, corners[0]] : corners;
  return along(c, 5, rng, 2.5);
}
const rectCorners = (cx, cy, w, h, rotDeg) => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => ({
  x: cx + (x * Math.cos(deg(rotDeg)) - y * Math.sin(deg(rotDeg))) / 2,
  y: cy + (x * Math.sin(deg(rotDeg)) + y * Math.cos(deg(rotDeg))) / 2,
}));
const angleOf = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

// ---- čára ----
test('čára: téměř vodorovná se narovná na 0°', () => {
  const s = recognizeShape(line(40, 100, 3, 220, 1));
  assert.equal(s.kind, 'line');
  const [a, b] = [s.points[0], s.points.at(-1)];
  assert.ok(Math.abs(a.y - b.y) < 1e-6, 'vodorovná čára');
});

test('čára: různé úhly zůstanou čárou; blízko 45° se přichytí', () => {
  for (const [ang, seed] of [[-20, 2], [70, 3], [135, 4], [160, 5]]) {
    const s = recognizeShape(line(100, 100, ang, 200, seed));
    assert.equal(s?.kind, 'line', `úhel ${ang}`);
    assert.ok(Math.abs(angleOf(s.points[0], s.points.at(-1)) - ang) < 8, `úhel ${ang} zachován`);
  }
  const s = recognizeShape(line(100, 100, 47, 200, 6));
  assert.equal(s.kind, 'line');
  assert.ok(Math.abs(angleOf(s.points[0], s.points.at(-1)) - 45) < 1e-6);
});

test('čára: svislá se přichytí na 90°', () => {
  const s = recognizeShape(line(100, 40, 92, 180, 7));
  assert.equal(s.kind, 'line');
  assert.ok(Math.abs(s.points[0].x - s.points.at(-1).x) < 1e-6);
});

// ---- elipsa, kruh ----
test('kruh o poloměru 80 se šumem → circle, polyline ≥ 72 bodů, uzavřená', () => {
  const s = recognizeShape(ellipse(200, 200, 80, 80, 0, 11));
  assert.equal(s.kind, 'circle');
  assert.ok(s.points.length >= 72);
  assert.deepEqual(s.points[0], s.points.at(-1));
  assert.ok(Math.abs(s.r - 80) < 6, `r=${s.r}`);
  assert.ok(Math.hypot(s.cx - 200, s.cy - 200) < 5);
});

test('elipsa 2:1 otočená o 30° → ellipse se správnými osami a natočením', () => {
  const s = recognizeShape(ellipse(250, 180, 120, 60, 30, 12));
  assert.equal(s.kind, 'ellipse');
  assert.ok(Math.abs(s.rx - 120) < 10 && Math.abs(s.ry - 60) < 10, `${s.rx}/${s.ry}`);
  assert.ok(Math.abs(s.angle - 30) < 6, `angle=${s.angle}`);
  assert.ok(s.points.length >= 72);
});

test('elipsa 2:1 vodorovná → ellipse, ne kruh', () => {
  const s = recognizeShape(ellipse(250, 180, 120, 60, 0, 13));
  assert.equal(s.kind, 'ellipse');
});

// ---- obdélník, trojúhelník ----
test('obdélník bez natočení → rectangle, osově zarovnaný', () => {
  const s = recognizeShape(poly(rectCorners(200, 150, 220, 130, 0), 21));
  assert.equal(s.kind, 'rectangle');
  assert.equal(s.points.length, 5);
  assert.deepEqual(s.points[0], s.points.at(-1));
  for (let i = 0; i < 4; i++) {
    const [a, b] = [s.points[i], s.points[i + 1]];
    assert.ok(Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6, 'strana je vodorovná/svislá');
  }
});

test('obdélník otočený o 20° → rectangle s pravými úhly a natočením zachovaným', () => {
  const s = recognizeShape(poly(rectCorners(220, 160, 240, 120, 20), 22));
  assert.equal(s.kind, 'rectangle');
  assert.ok(Math.abs(s.angle - 20) < 6, `angle=${s.angle}`);
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = [s.points[i], s.points[i + 1], s.points[i + 2] || s.points[1]];
    const d = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    assert.ok(Math.abs(d) < 1e-6, 'pravý úhel');
  }
});

test('čtverec nakreslený mírně vlnitě → square s přesně stejnými stranami', () => {
  for (const [rot, seed] of [[0, 23], [25, 24]]) {
    const s = recognizeShape(poly(rectCorners(220, 200, 170, 170, rot), seed));
    assert.equal(s.kind, 'square', `rot ${rot}`);
    const sides = [0, 1, 2, 3].map((i) => Math.hypot(s.points[i + 1].x - s.points[i].x, s.points[i + 1].y - s.points[i].y));
    assert.ok(Math.max(...sides) - Math.min(...sides) < 1e-6);
    if (rot === 0) assert.ok(Math.abs(s.points[0].y - s.points[1].y) < 1e-6);
    else assert.ok(Math.abs(s.angle - 25) < 6);
  }
});

test('obdélník 2:1 a 1.15:1 zůstanou rectangle', () => {
  assert.equal(recognizeShape(poly(rectCorners(220, 160, 260, 130, 0), 25)).kind, 'rectangle');
  assert.equal(recognizeShape(poly(rectCorners(220, 160, 230, 200, 0), 26)).kind, 'rectangle');
});

test('trojúhelník s úhlem ≈ 90° (±7°) má pravý úhel přesně', () => {
  const s = recognizeShape(poly([{ x: 100, y: 80 }, { x: 100, y: 260 }, { x: 290, y: 266 }], 32));
  assert.equal(s.kind, 'triangle');
  const [a, b, c] = s.points;
  const d = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
  assert.ok(Math.abs(d) < 1e-6, 'pravý úhel u vrcholu b');
});

test('trojúhelník → triangle se 3 vrcholy (4 body, uzavřený)', () => {
  const s = recognizeShape(poly([{ x: 200, y: 60 }, { x: 310, y: 240 }, { x: 90, y: 250 }], 31));
  assert.equal(s.kind, 'triangle');
  assert.equal(s.points.length, 4);
  assert.deepEqual(s.points[0], s.points.at(-1));
});

// ---- co se nemá poznat ----
test('otevřený oblouk „C“ (60 % kružnice) → null', () => {
  assert.equal(recognizeShape(ellipse(200, 200, 80, 80, 0, 41, { frac: 0.6 })), null);
});

test('vlnovka → null', () => {
  const rng = makeRng(42);
  const pts = [];
  for (let i = 0; i <= 80; i++) pts.push({ x: 40 + i * 3, y: 150 + Math.sin(i / 6) * 28 + jit(rng, 1) });
  assert.equal(recognizeShape(pts), null);
});

test('cikcak jako rukopis → null', () => {
  const zig = [[40, 100], [90, 60], [120, 120], [170, 50], [200, 130], [250, 60]].map(([x, y]) => ({ x, y }));
  assert.equal(recognizeShape(poly(zig, 43, false)), null);
});

test('příliš krátký tah → null', () => {
  assert.equal(recognizeShape([{ x: 0, y: 0 }, { x: 10, y: 3 }, { x: 18, y: 2 }]), null);
  assert.equal(recognizeShape([{ x: 5, y: 5 }]), null);
  assert.equal(recognizeShape([]), null);
});

test('uzavřená „kaňka“: buď elipsa s malým reziduem, jinak null', () => {
  const rng = makeRng(44);
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * Math.PI * 2;
    const r = 80 * (1 + 0.45 * Math.sin(3 * t) + 0.25 * Math.cos(5 * t)); // výrazně nepravidelná
    pts.push({ x: 200 + r * Math.cos(t) + jit(rng, 1), y: 200 + r * Math.sin(t) + jit(rng, 1) });
  }
  assert.equal(recognizeShape(pts), null);
});

test('dvakrát obtažená kružnice (spirála/škrabanice) → null', () => {
  const pts = ellipse(200, 200, 80, 80, 0, 45, { over: 1.0 });
  assert.equal(recognizeShape(pts), null);
});

// ---- snapLineAngle ----
test('snapLineAngle: přichytí k násobkům 45° v toleranci a zachová délku', () => {
  const p0 = { x: 0, y: 0 };
  const a = snapLineAngle(p0, { x: 100, y: 3 });
  assert.ok(Math.abs(a.y) < 1e-9 && Math.abs(a.x - Math.hypot(100, 3)) < 1e-9);
  const b = snapLineAngle(p0, { x: 100, y: 96 });
  assert.ok(Math.abs(b.x - b.y) < 1e-9);
  const c = snapLineAngle(p0, { x: 3, y: -100 });
  assert.ok(Math.abs(c.x) < 1e-9 && c.y < 0);
  const d = snapLineAngle(p0, { x: 100, y: 20 }); // 11° – mimo toleranci
  assert.deepEqual(d, { x: 100, y: 20 });
  const e = snapLineAngle(p0, { x: 100, y: 20 }, 15); // 11° s tolerancí 15° → vodorovně
  assert.ok(Math.abs(e.y) < 1e-9);
});

// ---- detekce podržení ----
test('hold: klid ≥ HOLD_MS spustí, pohyb časovač nuluje, drobný třas ne', () => {
  assert.equal(HOLD_MS, 550);
  const d = createHoldDetector();
  d.start(10, 10, 0);
  assert.equal(d.isHeld(HOLD_MS - 1), false);
  assert.equal(d.isHeld(HOLD_MS), true);
  d.move(10 + REST_PX - 1, 10, 300); // třas
  assert.equal(d.isHeld(HOLD_MS), true);
  assert.equal(d.move(30, 10, 400), true, 'pohyb nad práh vrací true');
  assert.equal(d.isHeld(400 + HOLD_MS - 1), false);
  assert.equal(d.isHeld(400 + HOLD_MS), true);
  assert.equal(d.remaining(500), 450);
});
