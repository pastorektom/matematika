// Pomůcky tématu Derivace: malý přesný „počítač“ se součty členů tvaru
//   c · x^p · e^{E·x} · sin^S x · cos^C x · ln^L x      (c, p zlomky; E, S, C, L celá čísla)
// Umí derivovat (pravidla pro mocninu, e^x, sin, cos, ln a součin), násobit, sčítat,
// přesně dosadit vhodný bod (0, 1, celé číslo u polynomu), chování v nekonečnu a v 0+,
// zápis do TeXu (odmocniny a zlomky jako na papíře) a do math.js (pro kontrolu odpovědí).
import { fr, add, sub, mul, div, isZero, toNum, frTex, frStr } from '../lin.js';

export { fr, add, sub, mul, div, isZero, toNum, frTex, frStr };

const ONE = fr(1);
const ZERO = fr(0);

// ---------- čtení dat ----------
// Zlomek z dat: 3, "3/2", {n, d}
export function parseFr(v) {
  if (v && typeof v === 'object') return fr(v.n, v.d);
  if (typeof v === 'string') {
    const [a, b = '1'] = v.split('/');
    return fr(Number(a), Number(b));
  }
  return fr(v ?? 0);
}
// Člen z dat: { c, p, E, S, C, L } (chybějící = 0, c výchozí 1)
export const term = (o) => ({
  c: parseFr(o.c ?? 1), p: parseFr(o.p ?? 0), E: o.E | 0, S: o.S | 0, C: o.C | 0, L: o.L | 0,
});
export const sumOf = (arr) => norm(arr.map(term), { keepOrder: true });
// Zpět do dat (JSON)
export const termData = (t) => {
  const o = { c: frStr(t.c) };
  if (!isZero(t.p)) o.p = frStr(t.p);
  for (const k of ['E', 'S', 'C', 'L']) if (t[k]) o[k] = t[k];
  return o;
};

const atomKey = (t) => `${t.E}|${t.S}|${t.C}|${t.L}`;
const key = (t) => `${frStr(t.p)}|${atomKey(t)}`;
const cmpFr = (a, b) => toNum(a) - toNum(b);
export const hasAtoms = (t) => !!(t.E || t.S || t.C || t.L);

// Sečte stejné členy, vynechá nulové. Polynom (bez e, sin, cos, ln) seřadí od nejvyšší mocniny,
// jinak ponechá pořadí prvního výskytu.
export function norm(ts, { keepOrder = false } = {}) {
  const out = [];
  const idx = new Map();
  for (const t of ts) {
    const k = key(t);
    if (idx.has(k)) { const e = out[idx.get(k)]; e.c = add(e.c, t.c); } else { idx.set(k, out.length); out.push({ ...t }); }
  }
  const res = out.filter((t) => !isZero(t.c));
  if (!keepOrder && res.every((t) => !hasAtoms(t))) res.sort((a, b) => cmpFr(b.p, a.p));
  return res;
}

export const scaleTerm = (t, k) => ({ ...t, c: mul(t.c, k) });
export const scale = (s, k) => norm(s.map((t) => scaleTerm(t, k)), { keepOrder: true });
export const neg = (s) => scale(s, fr(-1));
export const mulTerm = (a, b) => ({
  c: mul(a.c, b.c), p: add(a.p, b.p), E: a.E + b.E, S: a.S + b.S, C: a.C + b.C, L: a.L + b.L,
});
export const mulSum = (A, B) => norm(A.flatMap((a) => B.map((b) => mulTerm(a, b))));
export const addSum = (A, B) => norm([...A, ...B]);
export const subSum = (A, B) => norm([...A, ...neg(B)]);
export const xPow = (p) => ({ c: ONE, p: parseFr(p), E: 0, S: 0, C: 0, L: 0 });
export const constT = (c) => ({ c: parseFr(c), p: ZERO, E: 0, S: 0, C: 0, L: 0 });
// Součin členu a jeho „kořenového“ zbytku: dělení jedním členem (záporné mocniny jsou v pořádku).
export const divTerm = (a, b) => ({
  c: div(a.c, b.c), p: sub(a.p, b.p), E: a.E - b.E, S: a.S - b.S, C: a.C - b.C, L: a.L - b.L,
});

// ---------- derivace ----------
export function dTerm(t) {
  const out = [];
  if (!isZero(t.p)) out.push({ ...t, c: mul(t.c, t.p), p: sub(t.p, ONE) });
  if (t.E) out.push({ ...t, c: mul(t.c, fr(t.E)) });
  if (t.S) out.push({ ...t, c: mul(t.c, fr(t.S)), S: t.S - 1, C: t.C + 1 });
  if (t.C) out.push({ ...t, c: mul(t.c, fr(-t.C)), C: t.C - 1, S: t.S + 1 });
  if (t.L) out.push({ ...t, c: mul(t.c, fr(t.L)), L: t.L - 1, p: sub(t.p, ONE) });
  return out;
}
export const dSum = (s) => norm(s.flatMap(dTerm), { keepOrder: true });

// ---------- přesné dosazení ----------
function rootExact(n, d) { // přesná d-tá odmocnina z nezáporného celého n, jinak null
  const r = Math.round(n ** (1 / d));
  for (const c of [r - 1, r, r + 1]) if (c >= 0 && c ** d === n) return c;
  return null;
}
function powFr(x, p) { // x^p přesně (x zlomek), nebo null
  if (p.d === 1) {
    if (isZero(x) && p.n < 0) return null;
    const k = Math.abs(p.n);
    let r = ONE;
    for (let i = 0; i < k; i++) r = mul(r, x);
    return p.n < 0 ? div(ONE, r) : r;
  }
  if (x.n < 0) return null;
  if (isZero(x)) return p.n > 0 ? ZERO : null;
  const a = rootExact(x.n, p.d); const b = rootExact(x.d, p.d);
  if (a === null || b === null) return null;
  return powFr(fr(a, b), fr(p.n));
}
export function termAt(t, x0) {
  let v = t.c;
  const xp = isZero(t.p) ? ONE : powFr(x0, t.p);
  if (xp === null) return null;
  v = mul(v, xp);
  const zero = isZero(x0); const one = x0.n === 1 && x0.d === 1;
  if (t.E && !zero) return null;
  if (t.S) { if (!zero || t.S < 0) return null; v = ZERO; }
  if (t.C && !zero) return null;
  if (t.L) { if (!one || t.L < 0) return null; v = ZERO; }
  return v;
}
export function sumAt(s, x0) {
  let v = ZERO;
  for (const t of s) { const a = termAt(t, x0); if (a === null) return null; v = add(v, a); }
  return v;
}
// Číselná hodnota (pro grafy a kontrolu znamének).
export const termNum = (t, x) => toNum(t.c) * x ** toNum(t.p) * Math.exp(t.E * x)
  * Math.sin(x) ** t.S * Math.cos(x) ** t.C * Math.log(x) ** t.L;
export const sumNum = (s, x) => s.reduce((a, t) => a + termNum(t, x), 0);

// ---------- chování v +∞ a v 0+ ----------
// Výsledek: { fin: zlomek } nebo { inf: ±1 }
function sgn(c) { return c.n > 0 ? 1 : -1; }
export function limitInf(s) {
  if (!s.length) return { fin: ZERO };
  if (s.some((t) => t.S || t.C)) throw new Error('limitInf: sin/cos');
  const cmp = (a, b) => (a.E - b.E) || cmpFr(a.p, b.p) || (a.L - b.L);
  const dom = s.reduce((m, t) => (cmp(t, m) > 0 ? t : m));
  const zeroKey = dom.E === 0 && isZero(dom.p) && dom.L === 0;
  if (zeroKey) return { fin: dom.c };
  const grows = dom.E > 0 || (dom.E === 0 && (toNum(dom.p) > 0 || (isZero(dom.p) && dom.L > 0)));
  return grows ? { inf: sgn(dom.c) } : { fin: ZERO };
}
export function limitZeroPlus(s) {
  if (!s.length) return { fin: ZERO };
  // e^{Ex} a cos x mají v 0 hodnotu 1, sin x se chová jako x
  const eff = s.map((t) => ({ c: t.c, p: add(t.p, fr(t.S)), L: t.L }));
  const cmp = (a, b) => (cmpFr(b.p, a.p)) || (a.L - b.L); // menší mocnina a vyšší ln dominuje
  const merged = new Map();
  for (const t of eff) { const k = `${frStr(t.p)}|${t.L}`; merged.set(k, merged.has(k) ? { ...t, c: add(merged.get(k).c, t.c) } : t); }
  const list = [...merged.values()].filter((t) => !isZero(t.c));
  if (!list.length) return { fin: ZERO };
  const dom = list.reduce((m, t) => (cmp(t, m) > 0 ? t : m));
  if (isZero(dom.p) && dom.L === 0) return { fin: dom.c };
  if (toNum(dom.p) < 0 || (isZero(dom.p) && dom.L > 0)) return { inf: sgn(dom.c) * (dom.L % 2 ? -1 : 1) };
  return { fin: ZERO };
}

// ---------- TeX ----------
// x^p pro kladné p: x^2, \sqrt{x}, x\sqrt{x}, \sqrt[3]{x^2}
export function xTex(p, base = 'x') {
  if (isZero(p)) return '';
  const pw = (k) => (k === 1 ? base : `${base}^{${k}}`);
  if (p.d === 1) return pw(p.n);
  const whole = Math.floor(p.n / p.d);
  const r = p.n - whole * p.d;
  const inner = r === 1 ? base : `${base}^{${r}}`;
  const root = p.d === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${p.d}]{${inner}}`;
  return `${whole ? pw(whole) : ''}${root}`;
}
export const eTex = (E) => `e^{${E === 1 ? '' : E === -1 ? '-' : E}x}`;
const fnTex = (name, k) => `\\${name}${k === 1 ? '' : `^{${k}}`} x`;
function atomsTex(t) {
  const parts = [];
  if (t.E) parts.push(eTex(t.E));
  if (t.S > 0) parts.push(fnTex('sin', t.S));
  if (t.C > 0) parts.push(fnTex('cos', t.C));
  if (t.L > 0) parts.push(fnTex('ln', t.L));
  return parts.join('\\,');
}
function atomsDenTex(t) {
  const parts = [];
  if (t.S < 0) parts.push(fnTex('sin', -t.S));
  if (t.C < 0) parts.push(fnTex('cos', -t.C));
  if (t.L < 0) parts.push(fnTex('ln', -t.L));
  return parts.join('\\,');
}
// |člen| v TeXu (bez znaménka); záporné mocniny jako zlomek, odmocniny jako odmocniny.
export function absTermTex(t) {
  const cn = Math.abs(t.c.n); const cd = t.c.d;
  const pos = toNum(t.p) > 0 ? xTex(t.p) : '';
  const negp = toNum(t.p) < 0 ? xTex(fr(-t.p.n, t.p.d)) : '';
  const at = atomsTex(t);
  const rest = [pos, at].filter(Boolean).join(pos && at && /[a-z]$/i.test(pos) && at.startsWith('\\') ? '' : '');
  const den = [cd !== 1 ? String(cd) : '', negp, atomsDenTex(t)].filter(Boolean).join('');
  let num = rest ? `${cn !== 1 ? cn : ''}${rest}` : String(cn);
  if (den) {
    if (!rest) num = String(cn);
    return `\\frac{${num}}{${den}}`;
  }
  return num;
}
export const termTex = (t, first = true) => {
  const body = absTermTex(t);
  return t.c.n < 0 ? `-${body}` : first ? body : `+${body}`;
};
export function sumTex(s) {
  if (!s.length) return '0';
  return s.map((t, i) => termTex(t, i === 0)).join('');
}
// Zápis s mocninami (x^{\frac{1}{2}}, x^{-3}) – pro přepis před derivováním.
export function powTermTex(t, first = true) {
  const sign = t.c.n < 0 ? '-' : first ? '' : '+';
  const a = fr(Math.abs(t.c.n), t.c.d);
  const isOne = a.n === 1 && a.d === 1;
  let xs = '';
  if (!isZero(t.p)) xs = t.p.n === 1 && t.p.d === 1 ? 'x' : `x^{${frTex(t.p)}}`;
  const at = atomsTex(t);
  const rest = `${xs}${at}`;
  if (!rest) return `${sign}${frTex(a)}`;
  return `${sign}${isOne ? '' : `${frTex(a)}${a.d !== 1 ? '\\,' : ''}`}${rest}`;
}
export const powSumTex = (s) => (s.length ? s.map((t, i) => powTermTex(t, i === 0)).join('') : '0');
// Do závorky, pokud je víc členů nebo záporný člen (při násobení).
export const parenTex = (s) => (s.length > 1 || (s[0] && s[0].c.n < 0) ? `(${sumTex(s)})` : sumTex(s));
export const parenAlways = (s) => (s.length > 1 ? `(${sumTex(s)})` : sumTex(s));
// Vytknutí společného e^{Ex}: (x^2+2x)e^{x}
export function factorETex(s) {
  if (s.length < 2) return null;
  const E = s[0].E;
  if (!E || s.some((t) => t.E !== E)) return null;
  const inner = s.map((t) => ({ ...t, E: 0 }));
  return `(${sumTex(inner)})${eTex(E)}`;
}
// Dosazení čísla za x do členu: 2\cdot(-1)^{3}, 3\cdot\sqrt{4}, e^{0}, \ln 1
export function substTermTex(t, x0, first = true) {
  const base = x0.n < 0 || x0.d !== 1 ? `(${frTex(x0)})` : frTex(x0);
  const parts = [];
  let flip = false; // záporný jmenovatel (x0 < 0, lichý exponent): znaménko jde před zlomek
  if (!isZero(t.p)) {
    const ap = fr(Math.abs(t.p.n), t.p.d);
    let xt = xTex(ap, base);
    if (t.p.n < 0 && x0.n < 0 && ap.d === 1 && ap.n % 2 === 1) { flip = true; xt = xTex(ap, frTex(fr(-x0.n, x0.d))); }
    parts.push(t.p.n < 0 ? { den: xt } : xt);
  }
  if (t.E) parts.push(`e^{${t.E === 1 ? '' : t.E === -1 ? '-' : `${t.E}\\cdot `}${t.E === 1 ? frTex(x0) : base}}`);
  if (t.S) parts.push(`\\sin${t.S > 1 ? `^{${t.S}}` : ''}${frTex(x0)}`);
  if (t.C) parts.push(`\\cos${t.C > 1 ? `^{${t.C}}` : ''}${frTex(x0)}`);
  if (t.L) parts.push(`\\ln${t.L > 1 ? `^{${t.L}}` : ''}${frTex(x0)}`);
  const a = fr(Math.abs(t.c.n), t.c.d);
  const nums = parts.filter((q) => typeof q === 'string');
  const dens = parts.filter((q) => typeof q === 'object').map((q) => q.den);
  const coef = a.n === 1 && a.d === 1 && nums.length ? '' : frTex(a);
  let body = [coef, ...nums].filter(Boolean).join('\\cdot ');
  if (dens.length) body = `\\frac{${body || '1'}}{${dens.join('\\cdot ')}}`;
  const sign = (t.c.n < 0) !== flip ? '-' : first ? '' : '+';
  return `${sign}${body}`;
}
export const substSumTex = (s, x0) => s.map((t, i) => substTermTex(t, x0, i === 0)).join('');

// ---------- math.js ----------
export function termStr(t) {
  const f = [];
  f.push(t.c.d === 1 ? String(t.c.n) : `(${t.c.n}/${t.c.d})`);
  if (!isZero(t.p)) f.push(`x^(${frStr(t.p)})`);
  if (t.E) f.push(`exp(${t.E}*x)`);
  if (t.S) f.push(`sin(x)^(${t.S})`);
  if (t.C) f.push(`cos(x)^(${t.C})`);
  if (t.L) f.push(`log(x)^(${t.L})`);
  return f.join('*');
}
export const sumStr = (s) => (s.length ? s.map(termStr).map((x) => `(${x})`).join('+') : '0');

// Přímka y = kx + q v TeXu.
export function lineTex(k, q) {
  const kx = isZero(k) ? '' : k.n === k.d ? 'x' : k.n === -k.d ? '-x' : `${frTex(k)}x`;
  if (!kx) return frTex(q);
  if (isZero(q)) return kx;
  return `${kx}${q.n < 0 ? '-' : '+'}${frTex(fr(Math.abs(q.n), q.d))}`;
}
// x − a v TeXu (x, x-2, x+3)
export function xMinus(a, v = 'x') {
  const f = parseFr(a);
  if (isZero(f)) return v;
  return `${v}${f.n > 0 ? '-' : '+'}${frTex(fr(Math.abs(f.n), f.d))}`;
}
