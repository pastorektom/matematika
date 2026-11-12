// Gaussova eliminace: posloupnost matic pod sebou, mezi nimi popisy řádkových úprav.
//
// data = {
//   augmented?: k,                         – k posledních sloupců za svislou čarou
//   steps: [{ matrix: [[…]], op?: 'R2 − 2·R1',   – op se píše mezi předchozí a tuto matici
//             pivot?: [i, j],                    – zvýrazněný pivot (oranžově)
//             changed?: [i, …] }],               – řádky změněné poslední úpravou
//   alt?: string }
import { el, setup, reset } from './common.js';
import { matrixLayout, drawMatrix } from './matrix.js';

const GAP_OP = 44; const GAP_PLAIN = 22;

function cleanSteps(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.steps)) return null;
  const steps = data.steps.filter((s) => s && Array.isArray(s.matrix) && s.matrix.length > 0
    && s.matrix.every((r) => Array.isArray(r) && r.length > 0));
  return steps.length > 0 ? steps : null;
}

export function layout(data) {
  const steps = cleanSteps(data);
  if (!steps) return null;
  const blocks = [];
  let y = 8; let maxW = 0;
  steps.forEach((s, idx) => {
    const cols = Math.max(...s.matrix.map((r) => r.length));
    const rows = s.matrix.map((r) => Array.from({ length: cols }, (_, j) => r[j]));
    if (idx > 0) y += s.op ? GAP_OP : GAP_PLAIN;
    const L = matrixLayout(rows, data.augmented);
    blocks.push({ step: s, rows, y, w: L.w, h: L.h, opY: y - GAP_OP / 2 });
    maxW = Math.max(maxW, L.w);
    y += L.h;
  });
  return { blocks, w: Math.max(maxW + 40, 220), h: y + 10 };
}

export function draw(svg, data) {
  reset(svg);
  const L = layout(data);
  if (!L) return false;
  try {
    const doc = setup(svg, L.w, L.h, data.alt || 'Gaussova eliminace');
    L.blocks.forEach((b, idx) => {
      const ox = (L.w - b.w) / 2;
      const s = b.step;
      if (idx > 0 && s.op) {
        const cy = b.y - GAP_OP / 2;
        el(doc, svg, 'path', { class: 'viz-arrow', d: `M ${ox + 22} ${cy - 13} L ${ox + 22} ${cy + 11} M ${ox + 17} ${cy + 5} L ${ox + 22} ${cy + 11} L ${ox + 27} ${cy + 5}`, fill: 'none' });
        if (typeof s.op === 'string') el(doc, svg, 'text', { class: 'viz-op', x: ox + 36, y: cy + 6, 'text-anchor': 'start' }, s.op);
      }
      const g = el(doc, svg, 'g');
      const hl = { pivot: s.pivot, rows: [] };
      drawMatrix(doc, g, b.rows, { ox, oy: b.y, augmented: data.augmented, highlight: hl });
      // změněné řádky podbarvit
      const changed = (Array.isArray(s.changed) ? s.changed : []).filter((i) => Number.isInteger(i) && i >= 0 && i < b.rows.length);
      const ML = matrixLayout(b.rows, data.augmented, ox, b.y);
      for (const i of changed) {
        g.insertBefore(el(doc, null, 'rect', {
          class: 'viz-changed', x: ox + 12, y: ML.rowY(i) - 16, width: b.w - 24, height: 32, rx: 6,
        }), g.firstChild);
      }
    });
    return true;
  } catch { return reset(svg); }
}
