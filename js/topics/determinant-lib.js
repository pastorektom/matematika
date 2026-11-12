// Pomocné výpočty pro téma Determinant: celočíselné determinanty, Sarrusovy součiny,
// mnohočleny v parametru x a řádkové úpravy se sledováním změny determinantu.
// Čistá logika bez TeXu kromě jednoduchých zápisů čísel a mnohočlenů.
import { fr, mul, gcd } from '../lin.js';

// ---------- matice ----------
export const minor = (M, i, j) => M.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
export const transpose = (M) => M[0].map((_, j) => M.map((r) => r[j]));
export const copy = (M) => M.map((r) => [...r]);

// Determinant celočíselné matice rozvojem podle prvního řádku (n ≤ 5 stačí).
export function detInt(M) {
  const n = M.length;
  if (n === 1) return M[0][0];
  if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  let s = 0;
  for (let j = 0; j < n; j++) if (M[0][j] !== 0) s += (j % 2 ? -1 : 1) * M[0][j] * detInt(minor(M, 0, j));
  return s;
}
export const cofactor = (M, i, j) => ((i + j) % 2 ? -1 : 1) * detInt(minor(M, i, j));

// ---------- Sarrusovo pravidlo (pořadí jako v přednášce) ----------
// + : a11a22a33, a12a23a31, a13a21a32;  − : a13a22a31, a12a21a33, a11a23a32
export const SARRUS_PLUS = [[[0, 0], [1, 1], [2, 2]], [[0, 1], [1, 2], [2, 0]], [[0, 2], [1, 0], [2, 1]]];
export const SARRUS_MINUS = [[[0, 2], [1, 1], [2, 0]], [[0, 1], [1, 0], [2, 2]], [[0, 0], [1, 2], [2, 1]]];
export function sarrusParts(M) {
  const prod = (d) => d.reduce((s, [i, j]) => s * M[i][j], 1);
  const P = SARRUS_PLUS.map(prod);
  const Q = SARRUS_MINUS.map(prod);
  const S1 = P.reduce((a, b) => a + b, 0);
  const S2 = Q.reduce((a, b) => a + b, 0);
  return { P, Q, S1, S2, value: S1 - S2 };
}
// Data pro viz 'matrix': za matici se znovu napíšou 1. a 2. sloupec, diagonály barevně.
export function sarrusViz(cells, caption = 'oranžově +, červeně −') {
  const rows = cells.map((r) => [...r, r[0], r[1]]);
  return {
    kind: 'matrix',
    data: {
      rows,
      highlight: { cols: [3, 4] },
      lines: [
        { from: [0, 0], to: [2, 2], color: 'accent' }, { from: [0, 1], to: [2, 3], color: 'accent' }, { from: [0, 2], to: [2, 4], color: 'accent' },
        { from: [0, 2], to: [2, 0], color: 'warn' }, { from: [0, 3], to: [2, 1], color: 'warn' }, { from: [0, 4], to: [2, 2], color: 'warn' },
      ],
      caption,
      alt: 'Sarrusovo pravidlo: za matici jsou znovu napsané první dva sloupce, diagonály jsou vyznačené čarami',
    },
  };
}

// ---------- mnohočleny v x: pole koeficientů, index = mocnina ----------
const trim = (p) => { const q = [...p]; while (q.length > 1 && q[q.length - 1] === 0) q.pop(); return q; };
export const pAdd = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0)));
export const pScale = (a, k) => trim(a.map((x) => x * k));
export const pSub = (a, b) => pAdd(a, pScale(b, -1));
export function pMul(a, b) {
  const out = Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] += x * y; }));
  return trim(out);
}
export const pDeg = (p) => { const q = trim(p); return q.length === 1 && q[0] === 0 ? -Infinity : q.length - 1; };
export const pEval = (p, x) => p.reduce((s, c, i) => s + c * x ** i, 0);
// TeX sestupně: -x^2-x+6
export function pTex(p) {
  const q = trim(p);
  const parts = [];
  for (let i = q.length - 1; i >= 0; i--) {
    const c = q[i];
    if (c === 0) continue;
    const a = Math.abs(c);
    const s = c < 0 ? '-' : parts.length ? '+' : '';
    const v = i === 0 ? '' : i === 1 ? 'x' : `x^${i}`;
    parts.push(`${s}${a === 1 && i > 0 ? '' : a}${v}`);
  }
  return parts.length ? parts.join('') : '0';
}
// Prvek matice c + k·x zapsaný jako v materiálech: 2-x, 3+x, 2x, 5
export function entryTex([c, k]) {
  if (k === 0) return String(c);
  const kx = `${Math.abs(k) === 1 ? '' : Math.abs(k)}x`;
  if (c === 0) return `${k < 0 ? '-' : ''}${kx}`;
  return `${c}${k < 0 ? '-' : '+'}${kx}`;
}

// Kořeny mnohočlenu stupně 1 nebo 2 jako zlomky (jen racionální; jinak null), vzestupně.
export function rationalRoots(p) {
  const q = trim(p);
  if (q.length === 2) return [fr(-q[0], q[1])];
  if (q.length !== 3) return null;
  const [c, b, a] = q;
  const D = b * b - 4 * a * c;
  if (D < 0) return [];
  const s = Math.round(Math.sqrt(D));
  if (s * s !== D) return null;
  const r1 = fr(-b - s, 2 * a); const r2 = fr(-b + s, 2 * a);
  const v1 = r1.n / r1.d; const v2 = r2.n / r2.d;
  if (D === 0) return [r1];
  return v1 < v2 ? [r1, r2] : [r2, r1];
}

// ---------- řádkové úpravy ----------
// Popis úpravy R_i := a·R_i − b·R_p (a > 0)
export function opLabel(i, p, a, b) {
  const left = a === 1 ? `R${i + 1}` : `${a}·R${i + 1}`;
  const sign = b > 0 ? ' − ' : ' + ';
  const k = Math.abs(b);
  return `${left}${sign}${k === 1 ? '' : `${k}·`}R${p + 1}`;
}
// Vynuluje sloupec c mimo řádek p (pivot M[p][c] ≠ 0) jen řádkovými úpravami
// R_i := a·R_i − b·R_p. Násobení řádku číslem a mění determinant a-krát, proto se vrací
// factor = součin 1/a (zlomek), kterým se nový determinant násobí.
export function clearColumn(M, p, c, rows = M.map((_, i) => i)) {
  const out = copy(M);
  const pv = out[p][c];
  const ops = []; const changed = [];
  let factor = fr(1);
  for (const i of rows) {
    if (i === p) continue;
    const v = out[i][c];
    if (v === 0) continue;
    let a; let b;
    if (v % pv === 0) { a = 1; b = v / pv; } else {
      const g = gcd(pv, v);
      a = Math.abs(pv / g); b = (v / g) * Math.sign(pv);
    }
    out[i] = out[i].map((x, j) => a * x - b * out[p][j]);
    if (a !== 1) factor = mul(factor, fr(1, a));
    ops.push(opLabel(i, p, a, b));
    changed.push(i);
  }
  return { matrix: out, ops, changed, factor };
}

// Klíčový prvek pro vytvoření nul ve sloupci: nejlépe ±1 ve sloupci s nejvíce nulami,
// jinak nejmenší nenulové číslo. Vrací { p, c } nebo null (nulový sloupec -> det 0).
export function pickKey(M) {
  const n = M.length;
  let best = null;
  for (let c = 0; c < n; c++) {
    const zeros = M.filter((r) => r[c] === 0).length;
    if (zeros === n) return null;
    for (let i = 0; i < n; i++) {
      const v = Math.abs(M[i][c]);
      if (v === 0) continue;
      const rowZeros = M[i].filter((x) => x === 0).length;
      const score = (v === 1 ? 1000 : 0) + zeros * 100 + rowZeros * 10 - v;
      if (!best || score > best.score) best = { p: i, c, score };
    }
  }
  return best && { p: best.p, c: best.c };
}
export const zeroColumn = (M) => M[0].findIndex((_, c) => M.every((r) => r[c] === 0));
export const zeroRow = (M) => M.findIndex((r) => r.every((x) => x === 0));
