// Pomůcky tématu Funkce: přesné krajní body intervalů (zlomky, násobky π/2), množiny jako
// sjednocení intervalů, zápis mnohočlenů, rozklad na kořenové činitele a tabulka znamének.
import { fr, add, mul, toNum, frTex, frStr, frCell, gcd } from '../lin.js';

export { fr, frTex, frStr, toNum };

// ---------- krajní body ----------
// Bod = { v: číslo, tex, str (pro kontrolu odpovědi), cell (text v SVG), key (rovnost) }
export const INF = { v: Infinity, tex: '\\infty', str: '∞', cell: '∞', key: '+inf' };
export const NINF = { v: -Infinity, tex: '-\\infty', str: '-∞', cell: '−∞', key: '-inf' };
// Bod r + k·π/2 (r zlomek, k celé číslo)
export function ep(r, k = 0) {
  const f = typeof r === 'object' ? r : fr(r);
  if (k === 0) return { v: toNum(f), tex: frTex(f), str: frStr(f), cell: frCell(f), key: `f${f.n}/${f.d}`, r: f, k: 0 };
  const pt = piTex(k); const ps = piStr(k);
  if (f.n === 0) return { v: (k * Math.PI) / 2, tex: pt, str: ps, cell: ps.replace('-', '−'), key: `p${k}`, r: f, k };
  const sgn = k < 0 ? '-' : '+';
  const absT = piTex(Math.abs(k)); const absS = piStr(Math.abs(k));
  return {
    v: toNum(f) + (k * Math.PI) / 2,
    tex: `${frTex(f)}${sgn}${absT}`,
    str: `${frStr(f)}${sgn}${absS}`,
    cell: `${frCell(f)}${sgn === '-' ? '−' : '+'}${absS}`,
    key: `m${f.n}/${f.d}:${k}`, r: f, k,
  };
}
function piTex(k) {
  const s = k < 0 ? '-' : ''; const a = Math.abs(k);
  if (a % 2 === 0) { const m = a / 2; return `${s}${m === 1 ? '' : m}\\pi`; }
  return `${s}\\frac{${a === 1 ? '' : a}\\pi}{2}`;
}
function piStr(k) {
  const s = k < 0 ? '-' : ''; const a = Math.abs(k);
  if (a % 2 === 0) { const m = a / 2; return `${s}${m === 1 ? '' : m}π`; }
  return `${s}${a === 1 ? '' : a}π/2`;
}
const same = (a, b) => a.key === b.key || a.v === b.v;
const cmp = (a, b) => (same(a, b) ? 0 : a.v - b.v);

// ---------- množiny (setříděné disjunktní intervaly) ----------
// interval = { lo, hi, lc, hc }; bod = { lo: a, hi: a, lc: true, hc: true }
export const iv = (lo, hi, lc = false, hc = false) => ({ lo, hi, lc: lc && Number.isFinite(lo.v), hc: hc && Number.isFinite(hi.v) });
export const point = (a) => ({ lo: a, hi: a, lc: true, hc: true });
export const REALS = [iv(NINF, INF)];

export function normalize(list) {
  const s = list.filter((i) => cmp(i.lo, i.hi) < 0 || (cmp(i.lo, i.hi) === 0 && i.lc && i.hc))
    .map((i) => ({ ...i }))
    .sort((a, b) => cmp(a.lo, b.lo) || (b.lc ? 1 : 0) - (a.lc ? 1 : 0));
  const out = [];
  for (const i of s) {
    const last = out[out.length - 1];
    const c = last ? cmp(i.lo, last.hi) : 1;
    if (last && (c < 0 || (c === 0 && (i.lc || last.hc)))) {
      const d = cmp(i.hi, last.hi);
      if (d > 0) { last.hi = i.hi; last.hc = i.hc; } else if (d === 0) last.hc = last.hc || i.hc;
    } else out.push(i);
  }
  return out;
}
export function intersect(A, B) {
  const out = [];
  for (const a of A) for (const b of B) {
    let lo; let lc; let hi; let hc;
    const l = cmp(a.lo, b.lo);
    if (l > 0) { lo = a.lo; lc = a.lc; } else if (l < 0) { lo = b.lo; lc = b.lc; } else { lo = a.lo; lc = a.lc && b.lc; }
    const h = cmp(a.hi, b.hi);
    if (h < 0) { hi = a.hi; hc = a.hc; } else if (h > 0) { hi = b.hi; hc = b.hc; } else { hi = a.hi; hc = a.hc && b.hc; }
    out.push({ lo, hi, lc, hc });
  }
  return normalize(out);
}
export const contains = (S, x) => S.some((i) => (x.v > i.lo.v || (same(x, i.lo) && i.lc)) && (x.v < i.hi.v || (same(x, i.hi) && i.hc)));
// Množina R bez daných bodů
export function without(points) {
  const ps = [...points].sort(cmp).filter((p, i, a) => i === 0 || !same(p, a[i - 1]));
  const out = [];
  let lo = NINF;
  for (const p of ps) { out.push(iv(lo, p)); lo = p; }
  out.push(iv(lo, INF));
  return normalize(out);
}
export const ivTex = (i) => (same(i.lo, i.hi) ? `\\{${i.lo.tex}\\}` : `${i.lc ? '\\langle ' : '('}${i.lo.tex};\\ ${i.hi.tex}${i.hc ? '\\rangle' : ')'}`);
export const ivStr = (i) => (same(i.lo, i.hi) ? `{${i.lo.str}}` : `${i.lc ? '<' : '('}${i.lo.str}; ${i.hi.str}${i.hc ? '>' : ')'}`);
export const setTex = (S) => (S.length ? S.map(ivTex).join('\\cup ') : '\\emptyset');
export const setStr = (S) => S.map(ivStr).join(' ∪ ');
const texLen = (t) => String(t).replace(/\\htmlClass\{[^}]*\}/g, '').replace(/\\(frac|langle|rangle|infty|pi|cup|quad)/g, 'x').replace(/[{}\\ ]/g, '').length;

// Řádky tabule „prefix + množina“; dlouhá množina se zalomí za ∪ (telefon 360 px).
// result = true: výsledek s dvojitým podtržením (třída bt-vysledek na každém řádku).
export function setLines(prefix, S, { result = false, max = 22 } = {}) {
  const parts = S.map(ivTex);
  const wrap = (t) => (result ? `\\htmlClass{bt-vysledek}{${t}}` : t);
  const note = result ? { notes: [{ kind: 'doubleUnderline', target: 'bt-vysledek' }] } : {};
  const lines = [];
  let cur = [];
  let len = texLen(prefix);
  parts.forEach((p, i) => {
    const l = texLen(p) + 1;
    if (cur.length && len + l > max) { lines.push(cur); cur = []; len = 2; }
    cur.push(p + (i < parts.length - 1 ? '\\cup ' : ''));
    len += l;
  });
  lines.push(cur);
  return lines.map((g, i) => ({ tex: `${i === 0 ? prefix : '\\ \\ '}${wrap(g.join(''))}`, ...note }));
}

// ---------- mnohočleny (celočíselné koeficienty, od nejvyšší mocniny) ----------
const deg = (c) => c.length - 1;
function monoTex(a, p, first) {
  const s = a < 0 ? '-' : first ? '' : '+';
  const m = Math.abs(a);
  if (p === 0) return `${s}${m}`;
  return `${s}${m === 1 ? '' : m}x${p > 1 ? `^${p}` : ''}`;
}
// Záporný vedoucí člen a kladná konstanta -> píše se od konstanty (9-x^2, 4-5x).
export function polyTex(c) {
  const terms = c.map((a, i) => [a, deg(c) - i]).filter(([a]) => a !== 0);
  if (!terms.length) return '0';
  const asc = terms[0][0] < 0 && terms[terms.length - 1][1] === 0 && terms[terms.length - 1][0] > 0;
  const ord = asc ? [...terms].reverse() : terms;
  return ord.map(([a, p], i) => monoTex(a, p, i === 0)).join('');
}
export const polyPlain = (c) => polyTex(c).replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/-/g, '−');
export const polyEval = (c, x) => c.reduce((s, a) => s * x + a, 0);
export const polyExpr = (c) => c.map((a, i) => `(${a})*x^${deg(c) - i}`).join('+');

// lineární činitel px+q (p > 0)
export const linTex = (p, q) => {
  const head = p === 1 ? 'x' : `${p}x`;
  return q === 0 ? head : `${head}${q < 0 ? '-' : '+'}${Math.abs(q)}`;
};
const linPlain = (p, q) => linTex(p, q).replace('-', '−');
// činitel s kořenem r (zlomek): (d·x − n)
const factorOf = (r) => ({ p: r.d, q: -r.n, root: r });
function factorTex(f, alone) {
  const t = linTex(f.p, f.q);
  const pow = f.m === 2 ? '^2' : '';
  if (f.q === 0 && f.p === 1) return `x${pow}`;
  return alone && !pow ? t : `(${t})${pow}`;
}
export function productTex(k, factors) {
  const body = factors.map((f) => factorTex(f, factors.length === 1 && k === 1)).join('');
  if (k === 1) return body;
  if (k === -1) return `-${body}`;
  return `${k}${body}`;
}

function isqrt(n) { const s = Math.round(Math.sqrt(n)); return s * s === n ? s : null; }
const par = (v) => (v < 0 ? `(${v})` : `${v}`);

// Rozklad mnohočlenu (stupeň 1–2, u stupně 3 vytknutí x nebo seskupení) na kořenové činitele.
// Vrací { k, factors: [{p, q, m, root}], lines: řádky tabule, none: true (bez reálných kořenů) }.
// Předpoklad: vedoucí koeficient je kladný.
export function factorPoly(c) {
  const d = deg(c);
  if (d === 1) {
    const g = gcd(c[0], c[1]);
    const k = c[1] === 0 ? c[0] : g;
    return { k, factors: [{ ...factorOf(fr(-c[1], c[0])), m: 1 }], lines: [] };
  }
  if (d === 2) return factorQuad(c[0], c[1], c[2]);
  if (d === 3) {
    if (c[3] === 0) {
      const q = factorQuad(c[0], c[1], c[2], true);
      const fx = { p: 1, q: 0, root: fr(0), m: 1 };
      return { k: q.k, factors: mergeFactors([fx, ...q.factors]), lines: quadLinesWithX(c, q) };
    }
    // x^3 + b x^2 + c x + b c = x^2(x + b) + c(x + b) = (x + b)(x^2 + c)
    if (c[0] === 1 && c[3] === c[1] * c[2]) {
      const b = c[1]; const cc = c[2];
      const lin = linTex(1, b);
      const sq = polyTex([1, 0, cc]);
      const lines = [
        { tex: polyTex(c) },
        { tex: `=x^2(${lin})${cc < 0 ? '-' : '+'}${Math.abs(cc) === 1 ? '' : Math.abs(cc)}(${lin})` },
        { tex: `=(${lin})(${sq})` },
      ];
      const q = factorQuad(1, 0, cc);
      if (!q.none) lines.push({ tex: `=${productTex(1, mergeFactors([{ ...factorOf(fr(-b)), m: 1 }, ...q.factors]))}` });
      return { k: 1, factors: mergeFactors([{ ...factorOf(fr(-b)), m: 1 }, ...q.factors]), lines };
    }
    // obecná kubika x³ + …: najdeme celočíselný kořen r a vydělíme (x − r)
    if (c[0] === 1 && c[3] !== 0) {
      for (const r of Array.from({ length: 24 }, (_, i) => (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1))) { // 1, −1, 2, −2, …
        const q1 = c[1] + r; const q2 = c[2] + r * q1;
        if (c[3] + r * q2 !== 0) continue;
        const Q = [1, q1, q2];
        const q = factorQuad(1, q1, q2);
        // zkouška: dosazení r do mnohočlenu člen po členu (vyjde 0)
        const terms = [c[0] * r ** 3, c[1] * r ** 2, c[2] * r, c[3]].filter((t, i) => t !== 0 || i === 0);
        const sum = terms.map((t, i) => (i === 0 ? `${t}` : t < 0 ? `${t}` : `+${t}`)).join('');
        // dlouhý rovnostní řádek se rozdělí na dva (na úzké tabuli se vejde jen asi 20 znaků)
        const eq = (lhs, rhs) => (lhs.replace(/[\\^_{}]/g, '').length + rhs.replace(/[\\^_{}]/g, '').length > 19
          ? [{ tex: lhs }, { tex: `=${rhs}` }] : [{ tex: `${lhs}=${rhs}` }]);
        const lines = [
          { tex: `x=${r}:\\ ${sum}=0` },
          ...eq(polyTex(c), `(${linTex(1, -r)})(${polyTex(Q)})`),
          ...q.lines,
        ];
        const fs = mergeFactors([{ ...factorOf(fr(r)), m: 1 }, ...q.factors]);
        if (q.none) return { k: 1, factors: fs, lines, extraTex: `(${polyTex(Q)})` };
        lines.push(...eq(polyTex(c), productTex(1, fs)));
        return { k: 1, factors: fs, lines };
      }
    }
  }
  throw new Error(`factorPoly: nepodporovaný mnohočlen ${c}`);
}
function quadLinesWithX(c, q) {
  const inner = polyTex(c.slice(0, 3));
  const lines = [{ tex: `${polyTex(c)}=x(${inner})` }];
  for (const l of q.lines) lines.push({ tex: l.tex, notes: l.notes });
  if (!q.none) lines.push({ tex: `${polyTex(c)}=${productTex(q.k, mergeFactors([{ p: 1, q: 0, root: fr(0), m: 1 }, ...q.factors]))}` });
  return lines;
}
function mergeFactors(fs) {
  const out = [];
  for (const f of fs) {
    const e = out.find((g) => g.p === f.p && g.q === f.q);
    if (e) e.m += f.m; else out.push({ ...f });
  }
  return out.sort((a, b) => toNum(a.root) - toNum(b.root));
}
// ax^2 + bx + c, a > 0
function factorQuad(a, b, c, inner = false) {
  const P = polyTex([a, b, c]);
  if (c === 0) {
    const g = gcd(a, b);
    const f1 = { p: 1, q: 0, root: fr(0), m: 1 };
    const f2 = { ...factorOf(fr(-b, a)), m: 1 };
    const k = g * (a / g / f2.p);
    return { k, factors: mergeFactors([f1, f2]), lines: inner ? [] : [{ tex: `${P}=${productTex(k, mergeFactors([f1, f2]))}` }] };
  }
  if (b === 0 && c < 0 && isqrt(a) && isqrt(-c)) {
    const s = isqrt(a); const t = isqrt(-c);
    const f1 = { ...factorOf(fr(-t, s)), m: 1 }; const f2 = { ...factorOf(fr(t, s)), m: 1 };
    const k = a / (f1.p * f2.p);
    const fs = mergeFactors([f1, f2]);
    return { k, factors: fs, lines: [{ tex: `${P}=${productTex(k, fs)}`, notes: [] }], dsq: true };
  }
  if (b === 0 && c > 0) {
    return { k: a, factors: [], none: true, lines: [{ tex: `${P}>0\\ \\text{pro každé } x` }] };
  }
  const D = b * b - 4 * a * c;
  const lines = [{ tex: `D=${par(b)}^2-4\\cdot ${a}\\cdot ${par(c)}=${D}` }];
  if (D < 0) {
    lines.push({ tex: '\\text{nemá reálné kořeny}' });
    return { k: a, factors: [], none: true, lines };
  }
  if (D === 0) {
    const r = fr(-b, 2 * a);
    lines.push({ tex: `x_0=\\frac{${-b}}{${2 * a}}${frTex(r) === `\\frac{${-b}}{${2 * a}}` ? '' : `=${frTex(r)}`}` });
    const f = { ...factorOf(r), m: 2 };
    const k = a / (f.p * f.p);
    lines.push({ tex: `${P}=${productTex(k, [f])}` });
    return { k, factors: [f], lines };
  }
  const s = isqrt(D);
  if (s === null) throw new Error('factorQuad: iracionální kořeny');
  const r1 = fr(-b - s, 2 * a); const r2 = fr(-b + s, 2 * a);
  lines.push({ tex: `x_{1,2}=\\frac{${-b}\\pm\\sqrt{${D}}}{${2 * a}}=\\frac{${-b}\\pm ${s}}{${2 * a}}` });
  lines.push({ tex: `x_1=${frTex(r1)},\\quad x_2=${frTex(r2)}` });
  const fs = mergeFactors([{ ...factorOf(r1), m: 1 }, { ...factorOf(r2), m: 1 }]);
  const k = a / (fs[0].p * fs[1].p);
  lines.push({ tex: `${P}=${productTex(k, fs)}` });
  return { k, factors: fs, lines };
}

// ---------- znaménka ----------
const REL_TEX = { '>': '>', '>=': '\\ge', '<': '<', '<=': '\\le', '!=': '\\mathrel{\\char"2260}' };
export const relTex = (r) => REL_TEX[r];
export const flipRel = (r) => ({ '>': '<', '>=': '<=', '<': '>', '<=': '>=', '!=': '!=' }[r]);

// Řešení k·Π(num činitelé)/Π(den činitelé) rel 0 (k > 0). Vrací { set, chart } (chart pro viz signchart).
export function signSolve(num, den, rel) {
  const all = [...num.map((f) => ({ ...f, den: false })), ...den.map((f) => ({ ...f, den: true }))];
  const pts = [];
  for (const f of all) if (!pts.some((p) => p.r.n === f.root.n && p.r.d === f.root.d)) pts.push({ r: f.root });
  pts.sort((a, b) => toNum(a.r) - toNum(b.r));
  pts.forEach((p) => {
    p.den = all.some((f) => f.den && f.root.n === p.r.n && f.root.d === p.r.d);
    p.ep = ep(p.r);
  });
  const idx = (f) => pts.findIndex((p) => p.r.n === f.root.n && p.r.d === f.root.d);
  const signAt = (f, i) => (f.m % 2 === 0 ? 1 : i <= idx(f) ? -1 : 1); // interval i leží vlevo od bodu i
  const n = pts.length;
  const total = Array.from({ length: n + 1 }, (_, i) => all.reduce((s, f) => s * signAt(f, i), 1));
  const want = (s) => (rel === '>' || rel === '>=' ? s > 0 : rel === '<' || rel === '<=' ? s < 0 : true);
  const parts = [];
  total.forEach((s, i) => {
    if (want(s)) parts.push(iv(i === 0 ? NINF : pts[i - 1].ep, i === n ? INF : pts[i].ep));
  });
  if (rel === '>=' || rel === '<=') pts.forEach((p) => { if (!p.den) parts.push(point(p.ep)); });
  const cellOf = (s) => (s > 0 ? '+' : '−');
  const rows = all.map((f) => ({
    label: f.m === 2 ? `(${linPlain(f.p, f.q)})²` : linPlain(f.p, f.q),
    cells: total.map((_, i) => cellOf(signAt(f, i))),
    at: pts.map((p, j) => (j === idx(f) ? '0' : '')),
  }));
  rows.push({ label: 'V', cells: total.map(cellOf), at: pts.map((p) => (p.den ? '✗' : '0')) });
  return { set: normalize(parts), chart: { points: pts.map((p) => frCell(p.r)), rows } };
}

// Obrázek průniku: řádky = podmínky, ✓ / ✗ na intervalech, ● / ○ v bodech.
export function meetChart(sets, labels, result) {
  const pts = [];
  for (const S of [...sets, result]) for (const i of S) for (const e of [i.lo, i.hi]) {
    if (Number.isFinite(e.v) && !pts.some((p) => same(p, e))) pts.push(e);
  }
  pts.sort(cmp);
  const mids = Array.from({ length: pts.length + 1 }, (_, i) => {
    const lo = i === 0 ? pts[0].v - 1 : pts[i - 1].v; const hi = i === pts.length ? pts[pts.length - 1].v + 1 : pts[i].v;
    return { v: (lo + hi) / 2, key: `mid${i}` };
  });
  const row = (S, label) => ({
    label,
    cells: mids.map((m) => (contains(S, m) ? '✓' : '✗')),
    at: pts.map((p) => (contains(S, p) ? '●' : '○')),
  });
  return {
    points: pts.map((p) => p.cell),
    rows: [...sets.map((S, i) => row(S, labels[i])), row(result, 'D')],
    alt: 'Průnik podmínek na číselné ose',
  };
}
export { mul, add };
