// Jedna matice na tabuli se zvýrazněním.
//
// data = {
//   rows: [[…], …],                   – čísla nebo řetězce (popisky přes textContent)
//   augmented?: k,                    – k posledních sloupců je za svislou čarou (rozšířená matice)
//   highlight?: { cells?: [[i, j]], rows?: [i], cols?: [j], pivot?: [i, j] },
//   lines?: [{ from: [i, j], to: [i, j], color?: 'accent'|'warn'|'blue'|'green'|'chalk' }],
//                                     – úsečky mezi středy buněk (např. diagonály Sarrusova pravidla)
//   caption?: string, alt?: string
// }
import { el, setup, reset, isNum, color, cellText, px } from './common.js';

export const CELL_W = 54; export const CELL_H = 36; const PAD = 16; const BR = 10;

function cleanRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (!rows.every((r) => Array.isArray(r) && r.length > 0)) return null;
  const cols = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: cols }, (_, j) => r[j]));
}

// Rozložení: středy buněk (x, y), rozměry matice a poloha svislé čáry.
export function matrixLayout(rows, augmented = 0, ox = 0, oy = 0) {
  const nr = rows.length; const nc = rows[0].length;
  const aug = Number.isInteger(augmented) && augmented > 0 && augmented < nc ? augmented : 0;
  const gap = aug ? 10 : 0;
  const colX = (j) => ox + PAD + j * CELL_W + CELL_W / 2 + (aug && j >= nc - aug ? gap : 0);
  const cells = [];
  rows.forEach((r, i) => r.forEach((val, j) => cells.push({ i, j, x: colX(j), y: oy + PAD / 2 + i * CELL_H + CELL_H / 2, text: cellText(val) })));
  const w = PAD * 2 + nc * CELL_W + gap;
  const h = PAD + nr * CELL_H;
  const barX = aug ? ox + PAD + (nc - aug) * CELL_W + gap / 2 : null;
  return { cells, w, h, ox, oy, nr, nc, aug, barX, colX, rowY: (i) => oy + PAD / 2 + i * CELL_H + CELL_H / 2 };
}

export function layout(data) {
  const rows = cleanRows(data?.rows);
  return rows ? matrixLayout(rows, data.augmented) : null;
}

// Nakreslí matici do skupiny `parent` na polohu (ox, oy); používá i gauss.js.
export function drawMatrix(doc, parent, rows, opts = {}) {
  const L = matrixLayout(rows, opts.augmented, opts.ox || 0, opts.oy || 0);
  const hl = opts.highlight || {};
  const g = el(doc, parent, 'g', { class: 'viz-matrix' });
  const hlg = el(doc, g, 'g');
  const rect = (x, y, w, h, cls) => el(doc, hlg, 'rect', { class: cls, x: px(x), y: px(y), width: px(w), height: px(h), rx: 5 });
  const left = L.ox + PAD - 4; const width = L.w - 2 * PAD + 8;
  for (const i of Array.isArray(hl.rows) ? hl.rows : []) {
    if (Number.isInteger(i) && i >= 0 && i < L.nr) rect(left, L.rowY(i) - CELL_H / 2 + 2, width, CELL_H - 4, 'viz-hl viz-hl-row');
  }
  for (const j of Array.isArray(hl.cols) ? hl.cols : []) {
    if (Number.isInteger(j) && j >= 0 && j < L.nc) rect(L.colX(j) - CELL_W / 2 + 2, L.oy + PAD / 2 + 2, CELL_W - 4, L.nr * CELL_H - 4, 'viz-hl viz-hl-col');
  }
  for (const c of Array.isArray(hl.cells) ? hl.cells : []) {
    if (Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[0] < L.nr && c[1] >= 0 && c[1] < L.nc) {
      rect(L.colX(c[1]) - CELL_W / 2 + 3, L.rowY(c[0]) - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 'viz-hl viz-hl-cell');
    }
  }
  const pv = hl.pivot;
  if (Array.isArray(pv) && Number.isInteger(pv[0]) && Number.isInteger(pv[1]) && pv[0] >= 0 && pv[0] < L.nr && pv[1] >= 0 && pv[1] < L.nc) {
    el(doc, g, 'rect', {
      class: 'viz-pivot', x: px(L.colX(pv[1]) - CELL_W / 2 + 3), y: px(L.rowY(pv[0]) - CELL_H / 2 + 3),
      width: CELL_W - 6, height: CELL_H - 6, rx: 8,
    });
  }
  // hranaté závorky
  const top = L.oy + 2; const bottom = L.oy + L.h - 2;
  const lx = L.ox + 4; const rx = L.ox + L.w - 4;
  el(doc, g, 'path', { class: 'viz-bracket', d: `M ${lx + BR} ${top} L ${lx} ${top} L ${lx} ${bottom} L ${lx + BR} ${bottom}`, fill: 'none' });
  el(doc, g, 'path', { class: 'viz-bracket', d: `M ${rx - BR} ${top} L ${rx} ${top} L ${rx} ${bottom} L ${rx - BR} ${bottom}`, fill: 'none' });
  if (L.barX != null) {
    el(doc, g, 'line', { class: 'viz-bar', x1: px(L.barX), y1: top + 4, x2: px(L.barX), y2: bottom - 4 });
  }
  // úsečky pod čísly, aby číslice zůstaly čitelné
  for (const l of Array.isArray(opts.lines) ? opts.lines : []) {
    const a = l?.from; const b = l?.to;
    if (!Array.isArray(a) || !Array.isArray(b) || !a.concat(b).every((n) => Number.isInteger(n))) continue;
    if (a[0] < 0 || b[0] < 0 || a[1] < 0 || b[1] < 0 || a[0] >= L.nr || b[0] >= L.nr || a[1] >= L.nc || b[1] >= L.nc) continue;
    const x1 = L.colX(a[1]); const y1 = L.rowY(a[0]); const x2 = L.colX(b[1]); const y2 = L.rowY(b[0]);
    const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy) || 1;
    const ext = 16; // čára přesahuje středy buněk
    el(doc, g, 'line', {
      class: `viz-diag viz-c-${color(l.color, 'accent')}`,
      x1: px(x1 - dx / len * ext), y1: px(y1 - dy / len * ext), x2: px(x2 + dx / len * ext), y2: px(y2 + dy / len * ext),
    });
  }
  for (const c of L.cells) {
    el(doc, g, 'text', { class: 'viz-cell', x: px(c.x), y: px(c.y + 7), 'text-anchor': 'middle' }, c.text);
  }
  return L;
}

export function draw(svg, data) {
  reset(svg);
  const rows = data && typeof data === 'object' ? cleanRows(data.rows) : null;
  if (!rows) return false;
  try {
    const caption = typeof data.caption === 'string' && data.caption ? data.caption : '';
    const L0 = matrixLayout(rows, data.augmented);
    const capH = caption ? 30 : 0;
    const W = Math.max(L0.w + 24, 200);
    const doc = setup(svg, W, L0.h + capH + 16, data.alt || 'Matice');
    drawMatrix(doc, svg, rows, {
      ox: (W - L0.w) / 2, oy: 8, augmented: data.augmented, highlight: data.highlight, lines: data.lines,
    });
    if (caption) el(doc, svg, 'text', { class: 'viz-label viz-label-accent', x: W / 2, y: L0.h + 8 + 22, 'text-anchor': 'middle' }, caption);
    return true;
  } catch { return reset(svg); }
}

export { isNum };
