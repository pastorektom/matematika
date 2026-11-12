// Pomůcky tématu Limita funkce: mnohočleny s celočíselnými koeficienty (pole od absolutního
// členu: [c0, c1, c2] = c0 + c1·x + c2·x²), přesné dosazení zlomku, dělení kořenovým činitelem
// a zápis do TeXu. Zlomky (a, hodnoty) jsou {n, d} z js/lin.js.
import { fr, add, mul, frTex, frStr } from '../lin.js';

export const trim = (p) => { const q = p.slice(); while (q.length > 1 && q[q.length - 1] === 0) q.pop(); return q; };
export const deg = (p) => trim(p).length - 1;
export const lead = (p) => trim(p)[deg(p)];

export function evalP(p, a) {
  let r = fr(0);
  for (let i = p.length - 1; i >= 0; i--) r = add(mul(r, a), fr(p[i]));
  return r;
}
export function mulP(p, q) {
  const out = Array(p.length + q.length - 1).fill(0);
  p.forEach((x, i) => q.forEach((y, j) => { out[i + j] += x * y; }));
  return trim(out);
}
export const addP = (p, q) => trim(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] || 0) + (q[i] || 0)));
export const scaleP = (p, k) => trim(p.map((x) => x * k));
// kořenový činitel bodu a = r/q: q·x − r (pro celé a jen x − a)
export const rootP = (a) => [-a.n, a.d];

// p = (q·x − r)·s, vrací s (celočíselný). Nejde-li to beze zbytku, vyhodí chybu.
export function divRoot(p, a) {
  const q = a.d; const r = a.n;
  const rem = trim(p).slice();
  const n = rem.length - 1;
  if (n < 1) throw new Error('divRoot: konstanta');
  const s = Array(n).fill(0);
  for (let k = n; k >= 1; k--) {
    const c = rem[k] / q;
    if (!Number.isInteger(c)) throw new Error('divRoot: neceločíselný podíl');
    s[k - 1] = c; rem[k] -= c * q; rem[k - 1] += c * r;
  }
  if (rem[0] !== 0) throw new Error('divRoot: nenulový zbytek');
  return trim(s);
}

// ---------- TeX ----------
const pw = (k) => (k === 1 ? 'x' : `x^{${k}}`);
function terms(p, asc) {
  const t = [];
  trim(p).forEach((c, i) => { if (c !== 0) t.push([c, i]); });
  return asc ? t : t.reverse();
}
export function polyTex(p, asc = false) {
  const t = terms(p, asc);
  if (!t.length) return '0';
  return t.map(([c, k], i) => {
    const a = Math.abs(c);
    const s = c < 0 ? '-' : i ? '+' : '';
    return `${s}${k === 0 ? a : `${a === 1 ? '' : a}${pw(k)}`}`;
  }).join('');
}
// počet členů (kvůli závorkám)
export const nTerms = (p) => terms(p).length;
export const wrap = (p, asc = false) => (nTerms(p) > 1 ? `(${polyTex(p, asc)})` : polyTex(p, asc));

// dosazená hodnota: záporná čísla a zlomky do závorek, je-li to potřeba
export function valTex(a, paren = false) {
  if (a.d === 1) return a.n < 0 && paren ? `(${a.n})` : String(a.n);
  return paren ? `\\left(${frTex(a)}\\right)` : frTex(a);
}
export function substTex(p, a, asc = false) {
  const t = terms(p, asc);
  if (!t.length) return '0';
  return t.map(([c, k], i) => {
    const m = Math.abs(c);
    const s = c < 0 ? '-' : i ? '+' : '';
    let body;
    if (k === 0) body = String(m);
    else {
      const v = k === 1 ? valTex(a, m !== 1 || c < 0 || i > 0 || a.n < 0) : `${valTex(a, true)}^{${k}}`;
      body = m === 1 ? v : `${m}\\cdot ${v}`;
    }
    return `${s}${body}`;
  }).join('');
}
// x − a jako text: x-3, x+2, x, 4x-1
export function rootTex(a) {
  const { n: r, d: q } = a;
  const x = q === 1 ? 'x' : `${q}x`;
  if (r === 0) return x;
  return `${x}${r > 0 ? '-' : '+'}${Math.abs(r)}`;
}
export const aTex = (a) => frTex(a);
// popisek poznámky na tabuli: skutečné minus
export const lbl = (v) => frStr(v).replace('-', '−');
export const sideSup = (side) => (side === '-' ? '^{-}' : side === '+' ? '^{+}' : '');
export const limTex = (a, side = '') => `\\lim_{x\\to ${typeof a === 'string' ? a : aTex(a)}${sideSup(side)}}`;
// Výsledek {kind:'num', v} | {kind:'inf', s} | {kind:'dne'} -> TeX a hodnota pro kontrolu
export function resultTex(r) {
  if (r.kind === 'dne') return '\\text{neexistuje}';
  if (r.kind === 'inf') return r.s > 0 ? '\\infty' : '-\\infty';
  return frTex(r.v);
}
export function resultValue(r) {
  if (r.kind === 'dne') return 'DNE';
  if (r.kind === 'inf') return r.s > 0 ? '∞' : '-∞';
  return frStr(r.v);
}
// rozpoznání vzorců pro text
export function formulaName(p) {
  const t = trim(p);
  if (t.length === 3 && t[1] === 0 && t[2] === 1 && t[0] < 0 && Number.isInteger(Math.sqrt(-t[0]))) return 'rozdíl čtverců $A^2-B^2=(A-B)(A+B)$';
  if (t.length === 4 && t[1] === 0 && t[2] === 0 && t[3] === 1 && t[0] !== 0 && Number.isInteger(Math.cbrt(Math.abs(t[0])))) {
    return t[0] > 0 ? 'součet třetích mocnin $A^3+B^3=(A+B)(A^2-AB+B^2)$' : 'rozdíl třetích mocnin $A^3-B^3=(A-B)(A^2+AB+B^2)$';
  }
  return null;
}

// Dosazení po částech: [dosazené členy, mocniny vyčíslené, součiny vyčíslené, součet (hodnota)].
// Čtyři řetězce TeXu, které se vypisují řádek po řádku (shodné sousední se na tabuli vynechají).
const frPos = (v, paren) => {
  if (v.d === 1) return v.n < 0 && paren ? `(${v.n})` : String(v.n);
  const t = frTex(v);
  return v.n < 0 && paren ? `\\left(${t}\\right)` : t;
};
export function substStages(p, a, asc = false) {
  const t = terms(p, asc);
  if (!t.length) return ['0', '0', '0', '0'];
  const pw = (k) => { let r = fr(1); for (let i = 0; i < k; i++) r = mul(r, a); return r; };
  const s1 = []; const s2 = []; let sum = fr(0);
  t.forEach(([c, k], i) => {
    const m = Math.abs(c);
    const sign = c < 0 ? '-' : i ? '+' : '';
    const pv = pw(k);
    const tv = mul(fr(c), pv);
    sum = add(sum, tv);
    // 2. řádek: mocniny vyčíslené
    let body;
    if (k === 0) body = String(m);
    else if (k === 1) body = m === 1 ? frPos(a, c < 0 || i > 0) : `${m}\\cdot ${frPos(a, true)}`;
    else body = m === 1 ? frPos(pv, c < 0 || i > 0) : `${m}\\cdot ${frPos(pv, true)}`;
    s1.push(`${sign}${body}`);
    // 3. řádek: součiny vyčíslené, jen se znaménky
    const av = tv.n < 0 ? fr(-tv.n, tv.d) : tv;
    s2.push(`${tv.n < 0 ? '-' : i ? '+' : ''}${frTex(av)}`);
  });
  return [substTex(p, a, asc), s1.join(''), s2.join(''), frTex(sum)];
}
