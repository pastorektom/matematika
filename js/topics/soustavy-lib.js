// Pomůcky tématu Soustavy lineárních rovnic: zápis soustav do TeXu, Jordanova eliminace,
// determinanty (Sarrus) a přesné maticové operace se zlomky. Sdílené js/lin.js se jen čte.
import { fr, add, sub, mul, div, isZero, frTex, frCell, gcd, gaussInt } from '../lin.js';

export const minus = (s) => String(s).replace(/-/g, '−');
const num = (x) => (typeof x === 'object' ? frTex(x) : String(x));
export const par = (x) => (typeof x === 'object' ? (x.n < 0 ? `\\left(${frTex(x)}\\right)` : frTex(x)) : x < 0 ? `(${x})` : `${x}`);

// ---------- neznámé ----------
// vars = pole TeXových jmen (např. ['x', 'y', 'z']) nebo nic -> x_{1}, x_{2}, …
export const varTex = (vars, i) => (vars ? vars[i] : `x_{${i + 1}}`);
export const varsTuple = (vars, n) => `(${Array.from({ length: n }, (_, i) => varTex(vars, i)).join(',')})`;
// řádky ze solveEchelon používají p_{1}, p_{2}, … -> skutečná jména neznámých
export const renameVars = (tex, vars) => tex.replace(/p_\{(\d+)\}/g, (_, d) => varTex(vars, Number(d) - 1));

// Levá strana rovnice: 2x_{1}-x_{2}+x_{4}
export function lhsTex(coefs, vars) {
  const parts = [];
  coefs.forEach((c, k) => {
    if (c === 0) return;
    const a = Math.abs(c);
    parts.push(`${c < 0 ? '-' : parts.length ? '+' : ''}${a === 1 ? '' : a}${varTex(vars, k)}`);
  });
  return parts.length ? parts.join('') : '0';
}
export const eqTex = (row, n, vars, rhs = row[n]) => `${lhsTex(row.slice(0, n), vars)}=${num(rhs)}`;

// Zadání soustavy zarovnané podle rovnítek.
export function systemTex(A, rhs, vars) {
  return `\\begin{aligned}${A.map((r, i) => `${lhsTex(r, vars)}&=${num(rhs[i])}`).join('\\\\ ')}\\end{aligned}`;
}

// Rozšířená matice (n sloupců koeficientů, zbytek za čarou); buňky čísla, zlomky nebo text.
export function arrayTex(rows, n) {
  const cols = rows[0].length;
  const spec = `${'r'.repeat(n)}|${'r'.repeat(cols - n)}`;
  return `\\left(\\begin{array}{${spec}}${rows.map((r) => r.map(num).join(' & ')).join(' \\\\ ')}\\end{array}\\right)`;
}
export const pmatrix = (M) => `\\begin{pmatrix}${M.map((r) => r.map(num).join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
export const vmatrix = (M) => `\\begin{vmatrix}${M.map((r) => r.map(num).join(' & ')).join(' \\\\ ')}\\end{vmatrix}`;

// ---------- hodnosti ze schodovitého tvaru ----------
export function ranks(rows, n) {
  const hA = rows.filter((r) => r.slice(0, n).some((v) => v !== 0)).length;
  const hAr = rows.filter((r) => r.some((v) => v !== 0)).length;
  return { hA, hAr };
}

// Popis úpravy R_i := a·R_i − b·R_p (a > 0)
function opLabel(i, p, a, b) {
  const left = a === 1 ? `R${i + 1}` : `${a}·R${i + 1}`;
  const sign = b > 0 ? ' − ' : ' + ';
  const k = Math.abs(b);
  return `${left}${sign}${k === 1 ? '' : `${k}·`}R${p + 1}`;
}
const cells = (rows) => rows.map((r) => r.map(minus));

// Jordanova (úplná) eliminace: nejdřív gaussInt (přímý chod), pak nulování nad pivoty
// (zpětný chod) a nakonec – je-li normalize – vydělení řádků pivoty (jednotková matice vlevo).
// -> { forward: steps, backward: steps (první = schodovitý tvar), echelon, rows, frRows, pivots }
export function jordanInt(M, n, { normalize = true } = {}) {
  const g = gaussInt(M, n);
  const rows = g.rows.map((r) => [...r]);
  const backward = [{ matrix: cells(rows) }];
  const { pivots } = g;
  for (let q = pivots.length - 1; q >= 0; q--) {
    const [pr, pc] = pivots[q];
    const ops = []; const changed = [];
    for (let i = 0; i < pr; i++) {
      const v = rows[i][pc];
      if (v === 0) continue;
      const pv = rows[pr][pc];
      let a; let b;
      if (v % pv === 0) { a = 1; b = v / pv; } else {
        const gg = gcd(pv, v);
        a = Math.abs(pv / gg); b = (v / gg) * Math.sign(pv);
      }
      rows[i] = rows[i].map((x, j) => a * x - b * rows[pr][j]);
      ops.push(opLabel(i, pr, a, b));
      const gg = rows[i].reduce((s, x) => gcd(s, x), 0);
      if (gg > 1) { rows[i] = rows[i].map((x) => x / gg); ops.push(`R${i + 1} : ${gg}`); }
      changed.push(i);
    }
    if (ops.length) backward.push({ op: ops.join(',  '), matrix: cells(rows), pivot: [pr, pc], changed });
  }
  let frRows = rows.map((r) => r.map((x) => fr(x)));
  if (normalize) {
    const ops = []; const changed = [];
    frRows = rows.map((r, i) => {
      const p = pivots.find(([pr]) => pr === i);
      if (!p) return r.map((x) => fr(x));
      const pv = r[p[1]];
      if (pv === 1) return r.map((x) => fr(x));
      ops.push(pv === -1 ? `R${i + 1} · (−1)` : `R${i + 1} : ${pv < 0 ? `(${minus(pv)})` : pv}`);
      changed.push(i);
      return r.map((x) => fr(x, pv));
    });
    if (ops.length) backward.push({ op: ops.join(',  '), matrix: frRows.map((r) => r.map(frCell)), changed });
  }
  return { forward: g.steps, backward, echelon: g.rows, rows, frRows, pivots };
}

// ---------- determinanty ----------
export function detInt(M) {
  const n = M.length;
  if (n === 1) return M[0][0];
  if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  let s = 0;
  for (let j = 0; j < n; j++) {
    if (M[0][j] === 0) continue;
    const minor = M.slice(1).map((r) => r.filter((_, k) => k !== j));
    s += (j % 2 ? -1 : 1) * M[0][j] * detInt(minor);
  }
  return s;
}

const prodTex = (xs) => xs.map(par).join('\\cdot ');
const signedNums = (nums) => nums.map((x, i) => (i === 0 ? `${x}` : x < 0 ? `-${-x}` : `+${x}`)).join('');

// Řádky tabule pro výpočet determinantu 2. nebo 3. řádu (křížové pravidlo / Sarrus).
// name = 'D', 'D_{1}', …  -> { lines, value, viz? }
export function detLines(M, name, { highlightCol = null } = {}) {
  const n = M.length;
  const col = (tex, j) => (highlightCol === j ? `\\htmlClass{bt-sloupec}{${tex}}` : tex);
  const vm = `\\begin{vmatrix}${M.map((r) => r.map((v, j) => col(String(v), j)).join(' & ')).join(' \\\\ ')}\\end{vmatrix}`;
  const head = highlightCol === null
    ? { tex: `${name}=${vm}` }
    : { tex: `${name}=${vm}`, notes: [{ kind: 'color', target: 'bt-sloupec' }] };
  const value = detInt(M);
  if (n === 2) {
    const P = M[0][0] * M[1][1]; const Q = M[0][1] * M[1][0];
    const lines = [head, { tex: `=${prodTex([M[0][0], M[1][1]])}-${prodTex([M[0][1], M[1][0]])}` }];
    lines.push({ tex: `=${P}-${par(Q)}` });
    lines.push({ tex: `=${value}` });
    return { lines: dedupe(lines), value };
  }
  if (n !== 3) throw new Error('detLines: jen řád 2 a 3');
  const a = M;
  const plus = [[a[0][0], a[1][1], a[2][2]], [a[0][1], a[1][2], a[2][0]], [a[0][2], a[1][0], a[2][1]]];
  const minusT = [[a[0][2], a[1][1], a[2][0]], [a[0][0], a[1][2], a[2][1]], [a[0][1], a[1][0], a[2][2]]];
  const P = plus.map((t) => t[0] * t[1] * t[2]);
  const Q = minusT.map((t) => t[0] * t[1] * t[2]);
  const sP = P.reduce((s, x) => s + x, 0); const sQ = Q.reduce((s, x) => s + x, 0);
  // jeden součin na řádek (telefon 360 px)
  const pt = plus.map(prodTex); const qt = minusT.map(prodTex);
  const lines = [
    head,
    { tex: `=${pt[0]}` },
    { tex: `\\quad +${pt[1]}` },
    { tex: `\\quad +${pt[2]}` },
    { tex: `\\quad -${qt[0]}` },
    { tex: `\\quad -${qt[1]}` },
    { tex: `\\quad -${qt[2]}` },
    { tex: `=(${signedNums(P)})-(${signedNums(Q)})` },
    { tex: `=${sP}-${par(sQ)}` },
    { tex: `=${value}` },
  ];
  const ext = a.map((r) => [...r, r[0], r[1]]);
  const viz = {
    kind: 'matrix',
    data: {
      rows: ext,
      augmented: 2,
      highlight: highlightCol === null ? undefined : { cols: [highlightCol] },
      lines: [
        { from: [0, 0], to: [2, 2], color: 'accent' }, { from: [0, 1], to: [2, 3], color: 'accent' }, { from: [0, 2], to: [2, 4], color: 'accent' },
        { from: [0, 2], to: [2, 0], color: 'warn' }, { from: [0, 3], to: [2, 1], color: 'warn' }, { from: [0, 4], to: [2, 2], color: 'warn' },
      ],
      caption: 'Sarrus: oranžové součiny přičítáme, červené odečítáme',
      alt: `Sarrusovo pravidlo pro determinant ${name.replace(/[{}_\\]/g, '')}`,
    },
  };
  return { lines: dedupe(lines), value, viz };
}
// ---------- šířka řádku tabule (přibližně ve znacích křídy) a lámání ----------
export const LINE_MAX = 24;
function matW(body, w) {
  const rows = body.split('\\\\').map((r) => r.split('&').map((c) => w(c)));
  const cols = Math.max(...rows.map((r) => r.length));
  let s = 2;
  for (let j = 0; j < cols; j++) s += Math.max(...rows.map((r) => r[j] ?? 0)) + 1;
  return s;
}
export function texWidth(tex) {
  let s = String(tex).replace(/\\htmlClass\{[^}]*\}/g, '');
  s = s.replace(/\\begin\{(pmatrix|vmatrix|array)\}(\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g, (_, e, sp, body) => 'M'.repeat(matW(body, texWidth)));
  s = s.replace(/\\left|\\right|\\big|\\Big/g, '');
  const FR = /\\frac\{([^{}]*)\}\{([^{}]*)\}/;
  while (FR.test(s)) s = s.replace(FR, (_, a, b) => 'F'.repeat(Math.max(1, Math.ceil(Math.max(texWidth(a), texWidth(b)) * 0.8))));
  s = s.replace(/[_^]\{([^{}]*)\}/g, (_, a) => 's'.repeat(Math.max(1, Math.ceil(texWidth(a) * 0.6))));
  s = s.replace(/[_^]./g, 's');
  s = s.replace(/\\text\{([^}]*)\}/g, (_, a) => a);
  s = s.replace(/\\quad/g, 'qq').replace(/\\[,;:! ]/g, '').replace(/\\(cdot|iff|Rightarrow|neq|in)\b/g, 'cc').replace(/\\[a-zA-Z]+/g, 'c');
  return s.replace(/[{}\s&]/g, '').length;
}
// Rozdělí dlouhou rovnici na hlavních + a − (mimo závorky) do více řádků; pokračování odsazené.
export function splitLine(tex, max = LINE_MAX) {
  if (texWidth(tex) <= max) return [tex];
  const cuts = [];
  let depth = 0;
  for (let i = 1; i < tex.length; i++) {
    const ch = tex[i];
    if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if (depth === 0 && (ch === '+' || ch === '-' || ch === '=') && !/[=({\s]$/.test(tex.slice(0, i)) && tex[i - 1] !== '\\') cuts.push(i);
  }
  const out = [];
  let start = 0; let last = 0;
  for (const c of [...cuts, tex.length]) {
    const piece = (out.length ? '\\quad ' : '') + tex.slice(start, c);
    if (texWidth(piece) > max && last > start) {
      out.push((out.length ? '\\quad ' : '') + tex.slice(start, last));
      start = last;
    }
    last = c;
  }
  out.push((out.length ? '\\quad ' : '') + tex.slice(start));
  return out;
}
// Součin činitelů rozložený do řádků: první řádek začíná prefixem, další „\quad\cdot …“.
export function chainLines(prefix, factors, max = LINE_MAX) {
  const lines = [];
  let cur = prefix;
  factors.forEach((f, i) => {
    const join = i === 0 ? '' : '\\cdot ';
    if (i > 0 && texWidth(cur + join + f) > max) { lines.push(cur); cur = `\\quad\\cdot ${f}`; } else cur += join + f;
  });
  lines.push(cur);
  return lines;
}

const flat = (t) => t.replace(/\\htmlClass\{[^}]*\}/g, '').replace(/[{}\s]|\\left|\\right/g, '');
export function dedupe(lines) {
  return lines.filter((l, i) => i === 0 || flat(l.tex) !== flat(lines[i - 1].tex));
}

// ---------- přesné matice se zlomky ----------
export const frM = (M) => M.map((r) => r.map((x) => (typeof x === 'object' ? x : fr(x))));
export function mulM(A, B) {
  return A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => add(s, mul(x, B[k][j])), fr(0))));
}
export const subM = (A, B) => A.map((r, i) => r.map((x, j) => sub(x, B[i][j])));
export const addM = (A, B) => A.map((r, i) => r.map((x, j) => add(x, B[i][j])));
export const scaleM = (A, k) => A.map((r) => r.map((x) => mul(x, k)));
export const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => fr(i === j ? 1 : 0)));
export const isIntM = (A) => A.every((r) => r.every((x) => x.d === 1));
export const intM = (A) => A.map((r) => r.map((x) => x.n));

// Adjungovaná matice celočíselné matice 2. nebo 3. řádu + řádky tabule s algebraickými doplňky.
export function adjugate(M, name) {
  const n = M.length;
  if (n === 2) {
    return { adj: [[M[1][1], -M[0][1]], [-M[1][0], M[0][0]]], lines: [] };
  }
  const cof = (i, j) => {
    const minor = M.filter((_, r) => r !== i).map((r) => r.filter((_, c) => c !== j));
    return { minor, v: ((i + j) % 2 ? -1 : 1) * detInt(minor) };
  };
  const C = [0, 1, 2].map((i) => [0, 1, 2].map((j) => cof(i, j)));
  const lines = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const { minor, v } = C[i][j];
      lines.push({ tex: `${name}_{${i + 1}${j + 1}}=${(i + j) % 2 ? '-' : '+'}${vmatrix(minor)}=${v}` });
    }
  }
  const adj = [0, 1, 2].map((i) => [0, 1, 2].map((j) => C[j][i].v)); // transponovaná matice doplňků
  return { adj, lines };
}

// Součin dvou celočíselných matic po prvcích: p_{ij} = i-tý řádek · j-tý sloupec = hodnota
// (jeden prvek na řádek tabule, dlouhé se lámou). -> { lines, val }
export function productEntryLines(A, B, name = 'p') {
  const val = A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
  const lines = [];
  A.forEach((r, i) => B[0].forEach((_, j) => {
    const sum = r.map((x, k) => `${par(x)}\\cdot ${par(B[k][j])}`).join('+');
    for (const t of splitLine(`${name}_{${i + 1}${j + 1}}=${sum}=${val[i][j]}`)) lines.push({ tex: t });
  }));
  return { lines, val };
}
// Součin dvou celočíselných matic zapsaný „řádek krát sloupec“ (TeX pmatrix) a výsledek.
export function productTex(A, B) {
  const rows = A.map((r) => B[0].map((_, j) => r.map((x, k) => `${par(x)}\\cdot ${par(B[k][j])}`).join('+')));
  const val = A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
  return { tex: `\\begin{pmatrix}${rows.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{pmatrix}`, val };
}

export { fr, add, sub, mul, div, isZero, frTex, frCell };
