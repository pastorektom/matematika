// Tečna ke grafu funkce v bodě.
//
// data = { expr: 'x^2', x0: 1, domain?: [a, b], range?: [c, d],
//          label?: 'y = 2x − 1',          – text rovnice tečny (zadává autor)
//          pointLabel?: 'T[1; 1]', slope?: číslo (jinak číselná derivace), alt? }
import { compileFn, isNum, isPair } from './common.js';
import { draw as drawPlot } from './plot.js';

// Tečna v x0: bod (x0, y0) a sklon k (symetrický rozdíl, při nespojitosti jednostranný).
export function tangentLine(fn, x0, slope) {
  const y0 = fn(x0);
  let k = slope;
  if (!isNum(k)) {
    const hs = [1e-5, 1e-4, 1e-3];
    for (const h of hs) {
      const a = fn(x0 + h); const b = fn(x0 - h);
      if (Number.isFinite(a) && Number.isFinite(b)) { k = (a - b) / (2 * h); break; }
    }
  }
  return { x0, y0, k: isNum(k) ? k : NaN };
}

export function draw(svg, data) {
  svg?.replaceChildren?.();
  if (!data || typeof data !== 'object' || typeof data.expr !== 'string' || !isNum(data.x0)) return false;
  const fn = compileFn(data.expr);
  const t = tangentLine(fn, data.x0, data.slope);
  if (!isNum(t.y0) || !isNum(t.k)) return false;
  const domain = isPair(data.domain) ? data.domain : [data.x0 - 3, data.x0 + 3];
  return drawPlot(svg, {
    domain,
    range: data.range,
    functions: [{ expr: data.expr }],
    lines: [{ k: t.k, q: t.y0 - t.k * data.x0, tangent: true, label: typeof data.label === 'string' ? data.label : undefined }],
    points: [{ x: data.x0, y: t.y0, label: typeof data.pointLabel === 'string' ? data.pointLabel : undefined, style: 'closed' }],
    alt: data.alt || 'Graf funkce s tečnou',
  });
}
