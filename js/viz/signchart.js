// Tabulka znamének derivace a průběhu funkce.
//
// data = {
//   points: ['−1', '2'],                  – kritické body (popisky x), zleva doprava
//   rows: [{ label: 'f′', cells: ['+', '−', '+'],   – n + 1 buněk, jedna pro každý interval
//            at?: ['0', 'max'] }],                  – popisky v kritických bodech (n hodnot)
//   alt?: string }
// Buňka: '+', '−' (znaménko), šipky ↗ ↘ ↑ ↓ →, ∪ (konvexní) ∩ (konkávní) nebo jiný krátký text.
import { el, setup, reset, GLYPHS, px } from './common.js';

const W = 420; const LABEL_W = 46; const ROW_H = 46; const AXIS_Y = 40;

function clean(data) {
  if (!data || typeof data !== 'object') return null;
  const points = Array.isArray(data.points) ? data.points.map((p) => (typeof p === 'number' ? String(p) : p)).filter((p) => typeof p === 'string') : null;
  if (!points) return null;
  const rows = (Array.isArray(data.rows) ? data.rows : [])
    .filter((r) => r && Array.isArray(r.cells) && r.cells.length === points.length + 1);
  return rows.length > 0 ? { points, rows } : null;
}

export function layout(data) {
  const c = clean(data);
  if (!c) return null;
  const n = c.points.length;
  const x0 = LABEL_W + 10; const x1 = W - 14;
  const cw = (x1 - x0) / (n + 1);
  const cols = Array.from({ length: n + 1 }, (_, k) => ({ x: x0 + k * cw, w: cw, cx: x0 + (k + 0.5) * cw }));
  const pointXs = Array.from({ length: n }, (_, k) => x0 + (k + 1) * cw);
  return { ...c, x0, x1, cols, pointXs, h: AXIS_Y + c.rows.length * ROW_H + 16 };
}

export function draw(svg, data) {
  reset(svg);
  const L = layout(data);
  if (!L) return false;
  try {
    const doc = setup(svg, W, L.h, data.alt || 'Tabulka znamének');
    // osa x s kritickými body
    el(doc, svg, 'line', { class: 'viz-axis', x1: L.x0, y1: AXIS_Y, x2: L.x1, y2: AXIS_Y });
    el(doc, svg, 'path', { class: 'viz-axis', d: `M ${L.x1 - 7} ${AXIS_Y - 4} L ${L.x1} ${AXIS_Y} L ${L.x1 - 7} ${AXIS_Y + 4}` });
    el(doc, svg, 'text', { class: 'viz-label', x: 8, y: AXIS_Y + 5 }, 'x');
    L.pointXs.forEach((x, k) => {
      el(doc, svg, 'line', { class: 'viz-grid-v', x1: px(x), y1: AXIS_Y, x2: px(x), y2: L.h - 8, 'stroke-dasharray': '4 5' });
      el(doc, svg, 'circle', { class: 'viz-point viz-c-accent', cx: px(x), cy: AXIS_Y, r: 4.8 });
      el(doc, svg, 'text', { class: 'viz-label', x: px(x), y: AXIS_Y - 13, 'text-anchor': 'middle' }, L.points[k]);
    });
    L.rows.forEach((r, i) => {
      const cy = AXIS_Y + i * ROW_H + ROW_H / 2 + 6;
      el(doc, svg, 'line', { class: 'viz-rowline', x1: 6, y1: AXIS_Y + i * ROW_H + 4, x2: L.x1, y2: AXIS_Y + i * ROW_H + 4 });
      if (typeof r.label === 'string') el(doc, svg, 'text', { class: 'viz-label viz-rowlabel', x: 10, y: cy + 6 }, r.label);
      r.cells.forEach((cell, k) => {
        const cx = L.cols[k].cx;
        const s = typeof cell === 'string' ? cell : typeof cell === 'number' ? String(cell) : '';
        if (Object.hasOwn(GLYPHS, s)) {
          el(doc, svg, 'path', { class: 'viz-glyph', d: GLYPHS[s], transform: `translate(${px(cx)} ${px(cy)})`, fill: 'none' });
        } else if (s) {
          const sign = s === '+' ? 'plus' : (s === '−' || s === '-') ? 'minus' : '';
          el(doc, svg, 'text', { class: `viz-sign${sign ? ` viz-sign-${sign}` : ''}`, x: px(cx), y: px(cy + 8), 'text-anchor': 'middle' }, s === '-' ? '−' : s);
        }
      });
      (Array.isArray(r.at) ? r.at : []).forEach((t, k) => {
        if (typeof t === 'string' && t && k < L.pointXs.length) {
          el(doc, svg, 'text', { class: 'viz-at', x: px(L.pointXs[k]), y: px(cy + 5), 'text-anchor': 'middle' }, t);
        }
      });
    });
    return true;
  } catch { return reset(svg); }
}
