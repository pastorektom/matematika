// Přesná lineární algebra pro generátory a postupy: zlomky {n, d} a Gaussova eliminace
// celočíselnými řádkovými úpravami (tak, jak se počítá ručně: bez zlomků, dokud to jde).
// Sdílí ji témata vektory, matice a soustavy.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export { gcd };

export function fr(n, d = 1) {
  if (typeof n === 'object' && n) return fr(n.n, n.d * d);
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('fr: celá čísla');
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g + 0, d: d / g };
}
export const add = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => fr(a.n * b.n, a.d * b.d);
export const div = (a, b) => fr(a.n * b.d, a.d * b.n);
export const isZero = (a) => a.n === 0;
export const toNum = (a) => a.n / a.d;

// TeX: -\frac{3}{2}, 5
export function frTex(a) {
  if (a.d === 1) return String(a.n);
  return `${a.n < 0 ? '-' : ''}\\frac{${Math.abs(a.n)}}{${a.d}}`;
}
// Zápis pro kontrolu odpovědí (math.js): -3/2
export const frStr = (a) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
// Buňka tabulky v SVG: skutečné minus
export const frCell = (a) => frStr(a).replace('-', '−');

const minus = (s) => String(s).replace('-', '−');

// Popis úpravy R_i := a·R_i − b·R_p (a > 0)
function opLabel(i, p, a, b) {
  const left = a === 1 ? `R${i + 1}` : `${a}·R${i + 1}`;
  const sign = b > 0 ? ' − ' : ' + ';
  const k = Math.abs(b);
  return `${left}${sign}${k === 1 ? '' : `${k}·`}R${p + 1}`;
}

// Gaussova eliminace na schodovitý tvar. M = celočíselná matice (řádky), nCols = počet sloupců
// koeficientů (zbytek je pravá strana). Vrací { steps, rows, pivots } – steps pro viz 'gauss'.
export function gaussInt(M, nCols = M[0].length) {
  const rows = M.map((r) => r.map((v) => { if (!Number.isInteger(v)) throw new Error('gaussInt: celá čísla'); return v; }));
  const steps = [{ matrix: rows.map((r) => r.map(minus)) }];
  const pivots = [];
  let r = 0;
  for (let c = 0; c < nCols && r < rows.length; c++) {
    // pivot: nejlépe ±1, jinak nejmenší nenulové číslo ve sloupci
    let p = -1;
    for (let i = r; i < rows.length; i++) {
      if (rows[i][c] === 0) continue;
      if (p < 0 || Math.abs(rows[i][c]) < Math.abs(rows[p][c])) p = i;
    }
    if (p < 0) continue;
    const ops = [];
    const changed = [];
    if (p !== r) {
      [rows[p], rows[r]] = [rows[r], rows[p]];
      ops.push(`R${r + 1} ↔ R${p + 1}`);
      changed.push(r, p);
    }
    const pv = rows[r][c];
    for (let i = r + 1; i < rows.length; i++) {
      const v = rows[i][c];
      if (v === 0) continue;
      let a; let b;
      if (v % pv === 0) { a = 1; b = v / pv; } else {
        const g = gcd(pv, v);
        a = Math.abs(pv / g); b = (v / g) * Math.sign(pv);
      }
      rows[i] = rows[i].map((x, j) => a * x - b * rows[r][j]);
      ops.push(opLabel(i, r, a, b));
      // zkrácení řádku společným dělitelem
      const g = rows[i].reduce((s, x) => gcd(s, x), 0);
      if (g > 1) { rows[i] = rows[i].map((x) => x / g); ops.push(`R${i + 1} : ${g}`); }
      changed.push(i);
    }
    pivots.push([r, c]);
    if (ops.length) steps.push({ op: ops.join(',  '), matrix: rows.map((row) => row.map(minus)), pivot: [r, c], changed: [...new Set(changed)] });
    else steps[steps.length - 1].pivot ??= [r, c];
    r++;
  }
  return { steps, rows, pivots };
}

// ---------- afinní výrazy c + k1·t + k2·s + … (hodnoty neznámých s parametry) ----------
export const PARAM_NAMES = ['t', 's', 'u', 'v', 'w', 'z'];
const aff = (c, t) => ({ c, t });
const affSub = (a, b) => aff(sub(a.c, b.c), a.t.map((x, i) => sub(x, b.t[i])));
const affMul = (a, k) => aff(mul(a.c, k), a.t.map((x) => mul(x, k)));
const affDiv = (a, k) => aff(div(a.c, k), a.t.map((x) => div(x, k)));
const affIsConst = (a) => a.t.every(isZero);

// TeX: \frac{3}{2}-2t+s
export function affTex(a, names = PARAM_NAMES) {
  const parts = [];
  if (!isZero(a.c)) parts.push(frTex(a.c));
  a.t.forEach((k, i) => {
    if (isZero(k)) return;
    const abs = fr(Math.abs(k.n), k.d);
    const s = k.n < 0 ? '-' : parts.length ? '+' : '';
    parts.push(`${s}${abs.n === abs.d ? '' : frTex(abs)}${names[i]}`);
  });
  return parts.length ? parts.join('') : '0';
}
// Výraz pro kontrolu odpovědí (math.js): 3/2 + (-2)*t + (1)*s
export function affStr(a, names = PARAM_NAMES) {
  const parts = [frStr(a.c)];
  a.t.forEach((k, i) => { if (!isZero(k)) parts.push(`(${frStr(k)})*${names[i]}`); });
  return parts.join(' + ');
}
export const paramStr = (values, names = PARAM_NAMES) => `(${values.map((v) => affStr(v, names)).join(', ')})`;
export const paramTex = (values, names = PARAM_NAMES) => `(${values.map((v) => affTex(v, names)).join(',\\ ')})`;

const lcm = (a, b) => (a * b) / gcd(a, b);
const pv = (i) => `p_{${i + 1}}`;

// Rovnice řádku: 2p_{1}-p_{3}=4
export function rowEqTex(row, nVars) {
  const parts = [];
  for (let k = 0; k < nVars; k++) {
    const c = row[k];
    if (c === 0) continue;
    const a = Math.abs(c);
    parts.push(`${c < 0 ? '-' : parts.length ? '+' : ''}${a === 1 ? '' : a}${pv(k)}`);
  }
  return `${parts.length ? parts.join('') : '0'}=${row[nVars]}`;
}

// Člen a·(hodnota) při dosazení: +3\cdot 2, -2\cdot(1-t)
function substTerm(a, v, first) {
  const s = a < 0 ? '-' : first ? '' : '+';
  const abs = Math.abs(a);
  const tex = affTex(v);
  const simple = /^[0-9]+$|^[a-z]$/.test(tex);
  const body = simple ? tex : `(${tex})`;
  return abs === 1 ? `${s}${body}` : `${s}${abs}\\cdot ${body}`;
}

// Zpětné dosazení ze schodovitého tvaru (rows z gaussInt; poslední sloupec pravá strana).
// Volné neznámé dostanou parametry t, s, …; parametr se násobí tak, aby u něj nevyšly zlomky.
// -> { kind: 'none', bad } | { kind: 'unique', values: Fr[], lines }
//    | { kind: 'param', values: Aff[], free: [index], names, lines }
//    lines = řádky tabule (TeX) s volbou parametrů a dosazováním po jedné neznámé.
export function solveEchelon(rows, nVars) {
  const piv = [];
  for (const row of rows) {
    const j = row.findIndex((v, k) => k < nVars && v !== 0);
    if (j < 0) { if (row[nVars] !== 0) return { kind: 'none', bad: row }; continue; }
    piv.push({ row, j });
  }
  const free = [];
  for (let k = 0; k < nVars; k++) if (!piv.some((p) => p.j === k)) free.push(k);
  const run = (scales) => {
    const zeroT = () => free.map(() => fr(0));
    const val = Array(nVars).fill(null);
    const lines = [];
    free.forEach((j, q) => {
      const t = zeroT(); t[q] = fr(scales[q]);
      val[j] = aff(fr(0), t);
      lines.push(`${pv(j)}=${affTex(val[j])}`);
    });
    for (let q = piv.length - 1; q >= 0; q--) {
      const { row, j } = piv[q];
      const aj = row[j];
      const others = [];
      for (let k = j + 1; k < nVars; k++) if (row[k] !== 0) others.push(k);
      const lead = `${aj === 1 ? '' : aj === -1 ? '-' : aj}${pv(j)}`;
      lines.push(rowEqTex(row, nVars));
      let rhs = aff(fr(row[nVars]), zeroT());
      if (others.length) {
        lines.push(`${lead}${others.map((k) => substTerm(row[k], val[k], false)).join('')}=${row[nVars]}`);
        for (const k of others) rhs = affSub(rhs, affMul(val[k], fr(row[k])));
        lines.push(`${lead}=${affTex(rhs)}`);
      }
      val[j] = affDiv(rhs, fr(aj));
      if (aj !== 1) lines.push(`${pv(j)}=${affTex(val[j])}`);
    }
    return { val, lines: lines.filter((l, i) => l !== lines[i - 1]) };
  };
  let { val, lines } = run(free.map(() => 1));
  if (free.length) {
    const scales = free.map((_, q) => val.reduce((L, v) => lcm(L, v.t[q].d), 1));
    if (scales.some((s) => s !== 1)) ({ val, lines } = run(scales));
    return { kind: 'param', values: val, free, names: PARAM_NAMES.slice(0, free.length), lines, scales };
  }
  return { kind: 'unique', values: val.map((v) => v.c), lines };
}
export { affIsConst };
