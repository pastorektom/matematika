// Graf funkce na tabuli.
//
// data = {
//   domain: [a, b],                 – definiční obor zobrazení (povinné)
//   range?: [c, d],                 – svislý rozsah (jinak odhad z hodnot)
//   functions: [{ expr: 'x^2', color?, label? }],     – výrazy v x (math.js, omezený)
//   asymptotes?: [{ kind: 'vertical', x, label? } | { kind: 'horizontal', y, label? }
//                 | { kind: 'oblique', k, q, label? }],     – čárkovaně, oranžově
//   points?: [{ x, y, label?, style?: 'closed'|'open', color? }],  – extrémy, inflexe, průsečíky
//   lines?: [{ k, q, label?, tangent? }],   – přímky y = kx + q (používá tečna)
//   alt?: string                    – popis pro čtečky
// }
// Křivka se vzorkuje nejméně na 400 místech; v pólech, skocích a tam, kde výraz není
// číslo, se přeruší (sampleCurve). Všechny popisky se vkládají přes textContent.
import { el, setup, reset, compileFn, niceTicks, fmtNum, isNum, isPair, color, px } from './common.js';

const W = 420; const H = 300;
const M = { l: 34, r: 16, t: 14, b: 26 };
const MIN_SAMPLES = 400;
const JUMP_CHECK = 0.02; // změna mezi vzorky nad 2 % rozsahu se zpřesní půlením (skok, pól, nebo jen strmost)
let clipCounter = 0; // jedinečná id ořezových oblastí (několik grafů na stránce)

// Vzorkuje křivku a vrací úseky [[x, y], …]. Úsek končí, kde výraz není konečné číslo
// nebo kde se hodnota „utrhne“ (pól, skok): podezřelý skok mezi sousedními vzorky se zpřesní
// půlením; konverguje-li k jedné hodnotě, jde o strmou spojitou část a křivka se spojí.
export function sampleCurve(fn, domain, range, n = 600) {
  const [x0, x1] = domain;
  const [lo, hi] = range;
  const span = hi - lo;
  const count = Math.max(MIN_SAMPLES, Math.trunc(n) || MIN_SAMPLES);
  const clampY = (y) => Math.max(lo - 3 * span, Math.min(hi + 3 * span, y));
  const val = (x) => { const y = fn(x); return Number.isFinite(y) ? y : NaN; };
  const segs = [];
  let cur = [];
  const flush = () => { if (cur.length > 0) segs.push(cur); cur = []; };
  let px0 = 0; let py0 = NaN;
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * i / (count - 1);
    const y = val(x);
    if (Number.isNaN(y)) { flush(); py0 = NaN; continue; }
    if (cur.length > 0 && Math.abs(y - py0) > JUMP_CHECK * span) {
      // zpřesnění: půlíme tam, kde je rozdíl větší
      let a = px0; let ya = py0; let b = x; let yb = y;
      let broken = false;
      for (let k = 0; k < 50; k++) {
        const mid = (a + b) / 2;
        const ym = val(mid);
        if (Number.isNaN(ym)) { broken = true; break; }
        if (Math.abs(ym - ya) >= Math.abs(yb - ym)) { b = mid; yb = ym; } else { a = mid; ya = ym; }
      }
      // bisekce se stáčí k jednomu okraji a pól sudého typu nepozná; zkusí se proto i původní dvojice vzorků
      const diverged = !broken && isPole(val, px0, x, py0, y, span);
      if (diverged) {
        flush();
      } else if (broken || Math.abs(yb - ya) > 0.01 * span) {
        cur.push([a, clampY(ya)]);
        flush();
        if (!broken) cur.push([b, clampY(yb)]); // u pólu s nekonečnou hodnotou b leží na druhé straně, nezačínat tam
      }
    } else if (cur.length > 0 && isPole(val, px0, x, py0, y, span)) { flush(); }
    cur.push([x, clampY(y)]);
    px0 = x; py0 = y;
  }
  flush();
  return segs;
}

// Pól sudého typu (1/(x-1)^2): oba sousední vzorky jsou stejně vysoko, rozdíl je nulový, ale mezi
// nimi hodnota vzroste nad oba. Najde se vrchol |y| půlením (jednovrcholové) a pól se pozná podle
// toho, že vrchol je mnohonásobně vyšší než okraje (spojitý vrchol ho jen mírně přesahuje).
function isPole(val, xa, xb, ya, yb, span) {
  const mid = val((xa + xb) / 2);
  if (Number.isNaN(mid)) return true;
  const edge = Math.max(Math.abs(ya), Math.abs(yb));
  if (edge <= span && Math.abs(mid) <= edge + JUMP_CHECK * span) return false; // vše v dohledu rozsahu: žádný pól
  let a = xa; let b = xb;
  let peak = Math.abs(mid);
  for (let k = 0; k < 60; k++) {
    const m1 = a + (b - a) / 3; const m2 = b - (b - a) / 3;
    const y1 = val(m1); const y2 = val(m2);
    if (Number.isNaN(y1) || Number.isNaN(y2)) return true;
    peak = Math.max(peak, Math.abs(y1), Math.abs(y2));
    if (Math.abs(y1) < Math.abs(y2)) a = m1; else b = m2;
  }
  return peak > Math.max(10 * edge, span);
}

// Odhad svislého rozsahu: kvantily konečných hodnot s okrajem.
function autoRange(fns, domain) {
  const ys = [];
  for (const f of fns) {
    for (let i = 0; i <= 200; i++) {
      const y = f(domain[0] + (domain[1] - domain[0]) * i / 200);
      if (Number.isFinite(y)) ys.push(y);
    }
  }
  if (ys.length === 0) return [-1, 1];
  ys.sort((a, b) => a - b);
  let lo = ys[Math.floor(ys.length * 0.02)];
  let hi = ys[Math.ceil(ys.length * 0.98) - 1];
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!isPair(data.domain)) return null;
  const fns = (Array.isArray(data.functions) ? data.functions : [])
    .filter((f) => f && typeof f.expr === 'string' && f.expr.trim());
  if (fns.length === 0) return null;
  return { domain: [Math.min(...data.domain), Math.max(...data.domain)], fns };
}

export function draw(svg, data) {
  reset(svg);
  const v = validate(data);
  if (!v) return false;
  try { return render(svg, data, v) || reset(svg); } catch { return reset(svg); }
}

function render(svg, data, v) {
  const { domain: [x0, x1], fns } = v;
  const compiled = fns.map((f) => compileFn(f.expr));
  const range = isPair(data.range) ? [Math.min(...data.range), Math.max(...data.range)] : autoRange(compiled, [x0, x1]);
  const [y0, y1] = range;
  const doc = setup(svg, W, H, data.alt || 'Graf funkce');
  const pw = W - M.l - M.r; const ph = H - M.t - M.b;
  const sx = (x) => px(M.l + (x - x0) / (x1 - x0) * pw);
  const sy = (y) => px(M.t + (y1 - y) / (y1 - y0) * ph);

  const clipId = `viz-clip-${++clipCounter}`;
  const defs = el(doc, svg, 'defs');
  const cp = el(doc, defs, 'clipPath', { id: clipId });
  el(doc, cp, 'rect', { x: M.l, y: M.t, width: pw, height: ph });

  // mřížka a osy
  const xt = niceTicks(x0, x1, 8); const yt = niceTicks(y0, y1, 6);
  const grid = el(doc, svg, 'g', { class: 'viz-grid' });
  for (const t of xt) el(doc, grid, 'line', { x1: sx(t), y1: M.t, x2: sx(t), y2: M.t + ph });
  for (const t of yt) el(doc, grid, 'line', { x1: M.l, y1: sy(t), x2: M.l + pw, y2: sy(t) });
  const axX = y0 <= 0 && y1 >= 0 ? sy(0) : M.t + ph;
  const axY = x0 <= 0 && x1 >= 0 ? sx(0) : M.l;
  const axes = el(doc, svg, 'g', { class: 'viz-axes' });
  el(doc, axes, 'line', { class: 'viz-axis', x1: M.l, y1: axX, x2: M.l + pw, y2: axX });
  el(doc, axes, 'line', { class: 'viz-axis', x1: axY, y1: M.t, x2: axY, y2: M.t + ph });
  el(doc, axes, 'path', { class: 'viz-axis', d: `M ${M.l + pw - 7} ${axX - 4} L ${M.l + pw} ${axX} L ${M.l + pw - 7} ${axX + 4}` });
  el(doc, axes, 'path', { class: 'viz-axis', d: `M ${axY - 4} ${M.t + 7} L ${axY} ${M.t} L ${axY + 4} ${M.t + 7}` });
  const labels = el(doc, svg, 'g', { class: 'viz-ticks' });
  for (const t of xt) {
    if (t === 0 && axY !== M.l) continue;
    el(doc, labels, 'text', { x: sx(t), y: Math.min(axX + 15, H - 8), 'text-anchor': 'middle' }, fmtNum(t));
  }
  for (const t of yt) {
    if (t === 0 && axX !== M.t + ph) continue;
    el(doc, labels, 'text', { x: Math.max(axY - 5, 22), y: sy(t) + 4, 'text-anchor': 'end' }, fmtNum(t));
  }

  const clipped = el(doc, svg, 'g', { 'clip-path': `url(#${clipId})` });
  const inPlot = (x, y) => x >= M.l && x <= M.l + pw && y >= M.t && y <= M.t + ph;
  const obstacles = []; // body (px) kreslených čar, kterým se mají popisky vyhnout
  const placed = [];    // obdélníky už umístěných popisků
  const addLine = (x1, y1, x2, y2) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
    for (let k = 0; k <= n; k++) obstacles.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
  };
  const pending = []; // popisky k umístění po nakreslení čar: { x, y, text, cls }

  // asymptoty
  for (const a of Array.isArray(data.asymptotes) ? data.asymptotes : []) {
    if (!a || typeof a !== 'object') continue;
    let ln = null; let lx = 0; let ly = 0; let anchor = 'start';
    if (a.kind === 'vertical' && isNum(a.x)) {
      ln = { x1: sx(a.x), y1: M.t, x2: sx(a.x), y2: M.t + ph }; lx = sx(a.x) + 10; ly = M.t + 30;
      if (lx > W - 70) { lx = sx(a.x) - 10; anchor = 'end'; }
    } else if (a.kind === 'horizontal' && isNum(a.y)) {
      ln = { x1: M.l, y1: sy(a.y), x2: M.l + pw, y2: sy(a.y) }; lx = M.l + pw - 4; ly = sy(a.y) - 5; anchor = 'end';
    } else if (a.kind === 'oblique' && isNum(a.k) && isNum(a.q)) {
      ln = { x1: sx(x0), y1: sy(a.k * x0 + a.q), x2: sx(x1), y2: sy(a.k * x1 + a.q) };
      lx = M.l + pw - 4; ly = Math.max(M.t + 14, Math.min(M.t + ph - 6, ln.y2 - 7)); anchor = 'end';
    }
    if (!ln) continue;
    el(doc, clipped, 'line', { class: 'viz-asymptote', 'stroke-dasharray': '7 5', ...ln });
    addLine(ln.x1, ln.y1, ln.x2, ln.y2);
    if (typeof a.label === 'string' && a.label) {
      el(doc, svg, 'text', { class: 'viz-label viz-label-accent', x: lx, y: ly, 'text-anchor': anchor }, a.label);
      placed.push(textBox(lx, ly, anchor, a.label));
    }
  }
  // přímky (tečny)
  for (const l of Array.isArray(data.lines) ? data.lines : []) {
    if (!l || !isNum(l.k) || !isNum(l.q)) continue;
    const ln = { x1: sx(x0), y1: sy(l.k * x0 + l.q), x2: sx(x1), y2: sy(l.k * x1 + l.q) };
    el(doc, clipped, 'line', { class: l.tangent ? 'viz-tangent' : 'viz-line', ...ln });
    addLine(ln.x1, ln.y1, ln.x2, ln.y2);
    if (typeof l.label === 'string' && l.label) {
      const lxv = x0 + (x1 - x0) * 0.9;
      pending.push({ x: sx(lxv), y: sy(l.k * lxv + l.q), text: l.label, cls: 'viz-label viz-label-accent' });
    }
  }
  // křivky
  let curves = 0;
  fns.forEach((f, i) => {
    const segs = sampleCurve(compiled[i], [x0, x1], [y0, y1], 600);
    const d = segs.filter((sg) => sg.length > 1)
      .map((sg) => `M ${sg.map(([x, y]) => `${sx(x)} ${sy(y)}`).join(' L ')}`).join(' ');
    if (!d) return;
    curves++;
    for (const sg of segs) for (const [x, y] of sg) { const X = sx(x); const Y = sy(y); if (inPlot(X, Y)) obstacles.push([X, Y]); }
    el(doc, clipped, 'path', { class: `viz-curve viz-c-${color(f.color, i === 0 ? 'chalk' : ['blue', 'green', 'warn'][(i - 1) % 3])}`, d, fill: 'none' });
  });
  if (curves === 0) return false; // žádný použitelný výraz: nic se nekreslí
  // body
  for (const p of Array.isArray(data.points) ? data.points : []) {
    if (!p || !isNum(p.x) || !isNum(p.y)) continue;
    const open = p.style === 'open';
    const cx = sx(p.x); const cy = sy(p.y);
    el(doc, svg, 'circle', { class: `viz-point${open ? ' viz-open' : ''} viz-c-${color(p.color, 'accent')}`, cx, cy, r: 4.8 });
    for (const [dx, dy] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) obstacles.push([cx + dx, cy + dy]);
    if (typeof p.label === 'string' && p.label) pending.push({ x: cx, y: cy, text: p.label, cls: 'viz-label' });
  }
  // popisky: čtyři polohy (SV, SZ, JV, JZ), první, která nic nepřekrývá a leží v grafu
  const OFFSETS = [[8, -8, 'start'], [-8, -8, 'end'], [8, 18, 'start'], [-8, 18, 'end']];
  for (const lb of pending) {
    let best = null;
    for (const [dx, dy, anchor] of OFFSETS) {
      const x = lb.x + dx; const y = lb.y + dy;
      const box = textBox(x, y, anchor, lb.text);
      const score = labelScore(box, obstacles, placed, M, pw, ph);
      if (!best || score < best.score) best = { score, x, y, anchor, box };
      if (score === 0) break;
    }
    placed.push(best.box);
    el(doc, svg, 'text', { class: lb.cls, x: px(best.x), y: px(best.y), 'text-anchor': best.anchor }, lb.text);
  }
  return true;
}

const FONT = 17;
// Přibližný obdélník popisku z velikosti písma a délky textu.
export function textBox(x, y, anchor, text) {
  const w = String(text).length * FONT * 0.5;
  const l = anchor === 'end' ? x - w : x;
  return { l, r: l + w, t: y - FONT + 2, b: y + 4 };
}

// 0 = bez kolize; jinak počet zásahů čar a jiných popisků, velká pokuta za výstup z grafu.
export function labelScore(box, obstacles, placed, m, pw, ph) {
  let s = 0;
  if (box.l < m.l || box.r > m.l + pw || box.t < m.t || box.b > m.t + ph) s += 1000;
  for (const [x, y] of obstacles) if (x >= box.l - 2 && x <= box.r + 2 && y >= box.t - 2 && y <= box.b + 2) s++;
  for (const o of placed) if (box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t) s += 50;
  return s;
}
