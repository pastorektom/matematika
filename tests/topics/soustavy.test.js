import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import soustavy from '../../js/topics/soustavy.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem, flatTex } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

// Nezávislé výpočty: Gauss-Jordanova eliminace v plovoucí čárce s částečným výběrem pivotu
// (jiný postup než celočíselná eliminace v js/lin.js) a math.js (det, inv, multiply).
const tiny = (v) => Math.abs(v) < 1e-9;
const PARAMS = ['t', 's', 'u', 'v', 'w', 'z'];

// Redukovaný tvar [A | pravé strany] v plovoucí čárce -> { M, piv }
function rref(A, rhsCols) {
  const n = A[0].length;
  const M = A.map((r, i) => [...r, ...rhsCols.map((c) => c[i])]);
  const piv = [];
  let r = 0;
  for (let c = 0; c < n && r < M.length; c++) {
    let best = r;
    for (let i = r; i < M.length; i++) if (Math.abs(M[i][c]) > Math.abs(M[best][c])) best = i;
    if (tiny(M[best][c])) continue;
    [M[r], M[best]] = [M[best], M[r]];
    const p = M[r][c];
    M[r] = M[r].map((x) => x / p);
    for (let i = 0; i < M.length; i++) {
      if (i === r || tiny(M[i][c])) continue;
      const f = M[i][c];
      M[i] = M[i].map((x, j) => x - f * M[r][j]);
    }
    piv.push(c); r++;
  }
  return { M, piv, r };
}
function solveLinear(A, b) {
  const n = A[0].length;
  const { M, piv, r } = rref(A, [b]);
  for (let i = r; i < M.length; i++) if (!tiny(M[i][n])) return 'none';
  const free = [...Array(n).keys()].filter((c) => !piv.includes(c));
  if (free.length === 0) return piv.map((_, i) => M[i][n]);
  const out = Array(n);
  free.forEach((c, q) => { out[c] = `0 + 1*${PARAMS[q]}`; });
  piv.forEach((c, i) => { out[c] = `${M[i][n]}${free.map((f, q) => ` - (${M[i][f]})*${PARAMS[q]}`).join('')}`; });
  return `(${out.join(', ')})`;
}
const rank = (A) => rref(A, []).r;

const leftOf = (d) => (d.form === 'AXB=C' ? d.A : d.form.includes('=B+X') ? math.subtract(d.A, math.identity(d.A.length).toArray()) : d.A);
const oracles = {
  gauss: (d) => solveLinear(d.A, d.b),
  jordan: (d) => solveLinear(d.A, d.b),
  homogenni: (d) => solveLinear(d.A, d.A.map(() => 0)),
  frobenius: (d) => [rank(d.A), rank(d.A.map((r, i) => [...r, d.b[i]]))],
  cramer: (d) => {
    const D = math.det(d.A);
    return d.A[0].map((_, k) => math.det(d.A.map((r, i) => r.map((v, j) => (j === k ? d.b[i] : v)))) / D);
  },
  'parametr-k': (d) => {
    // b = b0 + k·bk; nulové řádky vlevo dávají podmínku c0 + k·ck = 0
    const ev = (v, kk) => (typeof v === 'number' ? v : math.evaluate(v.replace(/(\d)k/g, '$1*k'), { k: kk }));
    const b0 = d.b.map((v) => ev(v, 0));
    const bk = d.b.map((v) => ev(v, 1) - ev(v, 0));
    const n = d.A[0].length;
    const { M, r } = rref(d.A, [b0, bk]);
    const conds = M.slice(r).filter((row) => !tiny(row[n]) || !tiny(row[n + 1]));
    const k = -conds[0][n] / conds[0][n + 1];
    const withK = (kk) => d.A.map((row, i) => [...row, ev(d.b[i], kk)]);
    assert.equal(rank(withK(k)), rank(d.A), 'pro nalezené k je soustava řešitelná');
    assert.notEqual(rank(withK(k + 1)), rank(d.A), 'pro jiné k řešitelná není');
    return k;
  },
  'maticova-rovnice': (d) => {
    const inv = math.inv;
    let X;
    switch (d.form) {
      case 'AX=B': X = math.multiply(inv(d.A), d.B); break;
      case 'XA=B': X = math.multiply(d.B, inv(d.A)); break;
      case 'AX+B=C': X = math.multiply(inv(d.A), math.subtract(d.C, d.B)); break;
      case 'XA+B=C': X = math.multiply(math.subtract(d.C, d.B), inv(d.A)); break;
      case 'AX=B+X': X = math.multiply(inv(leftOf(d)), d.B); break;
      case 'XA=B+X': X = math.multiply(d.B, inv(leftOf(d))); break;
      case 'AXB=C': X = math.multiply(math.multiply(inv(d.A), d.C), inv(d.B)); break;
      default: throw new Error(d.form);
    }
    assertSolves(d, X);
    return X;
  },
};
// Dosazení X do ORIGINÁLNÍ rovnice (math.js): obě strany musí vyjít stejně.
function assertSolves(d, X) {
  const mul = math.multiply; const add = math.add;
  let L; let R;
  switch (d.form) {
    case 'AX=B': L = mul(d.A, X); R = d.B; break;
    case 'XA=B': L = mul(X, d.A); R = d.B; break;
    case 'AX+B=C': L = add(mul(d.A, X), d.B); R = d.C; break;
    case 'XA+B=C': L = add(mul(X, d.A), d.B); R = d.C; break;
    case 'AX=B+X': L = mul(d.A, X); R = add(d.B, X); break;
    case 'XA=B+X': L = mul(X, d.A); R = add(d.B, X); break;
    case 'AXB=C': L = mul(mul(d.A, X), d.B); R = d.C; break;
    default: throw new Error(d.form);
  }
  const diff = math.subtract(L, R).flat ? math.subtract(L, R).flat() : [];
  for (const v of diff) assert.ok(Math.abs(v) < 1e-9, `X nevyhovuje původní rovnici ${d.form}: ${v}`);
}
const type = (id) => soustavy.types.find((x) => x.id === id);

test('soustavy: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(soustavy, 200, { oracles });
  assert.ok(r.generated >= 200 * 7);
});

test('soustavy: typy, pořadí a registrace tématu', () => {
  const ids = soustavy.types.map((t) => t.id);
  for (const id of ['gauss', 'jordan', 'homogenni', 'frobenius', 'parametr-k', 'cramer', 'maticova-rovnice']) assert.ok(ids.includes(id), id);
  assert.equal(soustavy.id, 'soustavy');
  assert.equal(soustavy.title, 'Soustavy lineárních rovnic');
  assert.equal(soustavy.order, 4);
  assert.ok(topics.includes(soustavy));
  for (const t of soustavy.types) assert.equal(typeof t.solve, 'function', `${t.id}: chybí solve(data)`);
});

test('soustavy: výklad pokrývá pojmy a každá část má časté chyby', () => {
  const all = soustavy.theory.map((s) => `${s.heading} ${s.text}`).join(' ').toLowerCase();
  for (const w of ['frobeniov', 'rozšířen', 'gaussov', 'jordanov', 'homogenní', 'parametr', 'cramer', 'maticov', 'zleva', 'zprava']) assert.match(all, new RegExp(w), w);
  for (const s of soustavy.theory) assert.ok(Array.isArray(s.mistakes) && s.mistakes.length > 0, s.heading);
});

test('gauss: všechny tři případy se vyskytují a závěr uvádí Frobeniovu větu', () => {
  const kinds = { unique: 0, param: 0, none: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    const p = type('gauss').generate(makeRng(seed));
    const v = p.answerSpec.value;
    kinds[v === 'none' ? 'none' : typeof v === 'string' ? 'param' : 'unique']++;
    const text = p.solution.map((s) => `${s.text} ${(s.board || []).map((l) => l.tex).join(' ')}`).join(' ');
    assert.match(text, /h\(A\)/, `seed ${seed}: chybí hodnosti`);
    assert.match(text, /h\(A_r\)/, `seed ${seed}: chybí hodnost rozšířené matice`);
    assert.ok(p.solution.some((s) => s.viz?.kind === 'gauss'), 'eliminace má grafiku');
    assert.match(p.task, /nemá řešení/);
    assert.match(p.task, /parametr/);
  }
  for (const k of Object.keys(kinds)) assert.ok(kinds[k] >= 30, `${k}: ${kinds[k]}`);
});

test('gauss: vlastní soustavy – jedno, nekonečně mnoho, žádné řešení', () => {
  const g = type('gauss');
  const p1 = g.solve({ A: [[1, 1, 1], [2, -1, 1], [1, 2, -1]], b: [6, 3, 2] });
  checkProblem(p1, oracles, 'jediné');
  assert.equal(check(p1.answerSpec, '(1; 2; 3)').ok, true);
  const p2 = g.solve({ A: [[1, 2, -1], [2, 4, -2]], b: [3, 6] });
  checkProblem(p2, oracles, 'dva parametry');
  assert.equal(check(p2.answerSpec, '(3 - 2t + s; t; s)').ok, true);
  const p3 = g.solve({ A: [[1, 1], [1, 1]], b: [1, 2] });
  assert.equal(check(p3.answerSpec, 'nemá řešení').ok, true);
  const p4 = g.solve({ A: [[1, -1, 2], [3, 1, 1], [2, 2, -1]], b: [1, 2, 1], vars: ['x', 'y', 'z'] });
  checkProblem(p4, oracles, 'písmena x, y, z');
  assert.ok(p4.answerTex.startsWith('(x,y,z)'));
});

test('maticova-rovnice: postup ukazuje násobení zleva / zprava a pořadí', () => {
  const m = type('maticova-rovnice');
  const ax = m.solve({ form: 'AX=B', A: [[2, 1], [1, 1]], B: [[1, 0], [3, 2]] });
  checkProblem(ax, oracles, 'AX=B');
  const t1 = ax.solution.map((s) => s.text).join(' ');
  assert.match(t1, /zleva/);
  assert.match(flatTex(ax.solution[0].board.map((l) => l.tex).join('')), /A\^-1\\cdotA\\cdotX/);
  const xa = m.solve({ form: 'XA=B', A: [[2, 1], [1, 1]], B: [[1, 0], [3, 2]] });
  checkProblem(xa, oracles, 'XA=B');
  assert.match(xa.solution.map((s) => s.text).join(' '), /zprava/);
  // stejné A, B, ale jiné pořadí -> jiný výsledek
  assert.notDeepEqual(ax.answerSpec.value, xa.answerSpec.value);
  const three = m.solve({ form: 'XA=B', A: [[1, 2, 0], [0, 1, 1], [1, 0, 2]], B: [[4, 0, 0], [0, 4, 0], [0, 0, 4]] });
  checkProblem(three, oracles, '3x3');
  const axb = m.solve({ form: 'AXB=C', A: [[1, 2], [1, 3]], B: [[2, 1], [1, 1]], C: [[1, 0], [0, 1]] });
  checkProblem(axb, oracles, 'AXB=C');
  const col = m.solve({ form: 'AX=B', A: [[1, 1, 0], [0, 1, 1], [1, 0, 1]], B: [[2], [3], [1]] });
  checkProblem(col, oracles, 'sloupec');
});

test('parametr-k, cramer, homogenni, jordan, frobenius: vlastní příklady', () => {
  const k = type('parametr-k').solve({ A: [[1, 1, 1], [1, -1, 2], [2, 0, 3]], b: [2, 1, 'k'] });
  checkProblem(k, oracles, 'k');
  assert.equal(k.answerSpec.value, 3);
  const c = type('cramer').solve({ A: [[1, 1, 1], [1, -1, 0], [0, 1, 2]], b: [4, -1, 5] });
  checkProblem(c, oracles, 'cramer 3');
  assert.ok(c.solution.some((s) => s.viz?.kind === 'matrix'), 'Sarrus má grafiku');
  const c2 = type('cramer').solve({ A: [[2, 1], [1, 3]], b: [1, 2] });
  checkProblem(c2, oracles, 'cramer 2');
  const h = type('homogenni').solve({ A: [[1, 1, 1], [1, 2, 3], [2, 3, 4]] });
  checkProblem(h, oracles, 'homogenní');
  assert.match(h.conclusion, /nekonečně/);
  const j = type('jordan').solve({ A: [[2, 1, 0], [1, 1, 1], [0, 1, 2]], b: [3, 3, 3] });
  checkProblem(j, oracles, 'jordan');
  const f = type('frobenius').solve({ A: [[1, 2], [2, 4]], b: [1, 3] });
  checkProblem(f, oracles, 'frobenius');
  assert.deepEqual(f.answerSpec.value, [1, 2]);
});

// Kontroly proti příkladům z Moodlu jsou jen v content/ (není v gitu):
// content/problems/soustavy-checks.json = [{ type, data, input, expect? } | { id, input, expect? }]
test('soustavy: kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/soustavy-checks.json', import.meta.url));
  const raw = fixedProblemsFile('soustavy');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/soustavy-checks.json chybí'); return; }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const p = c.id ? raw.find((x) => x.id === c.id) : type(c.type).solve(c.data);
    assert.ok(p, JSON.stringify(c));
    const spec = p.answerSpec ?? type(p.type).solve(p.data).answerSpec;
    const r = check(spec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', JSON.stringify(c));
    else assert.equal(r.ok, true, `${JSON.stringify(c)} -> ${JSON.stringify(spec)}`);
  }
});

// ---------- kontroly zápisu na tabuli (revize: telefon 360 px, záporné jmenovatele) ----------
const boardTex = (p) => p.solution.flatMap((st) => (st.board || []).map((l) => l.tex));
const plain = (t) => t.replace(/\\htmlClass\{[^}]*\}/g, '');
const clean = (c) => c.replace(/\\left|\\right|\\big/g, '').replace(/\\[a-zA-Z]+/g, 'c').replace(/[{}\s]/g, '');
const wide = (t) => {
  // hrubá šířka v „znacích“: matice = součet nejširších buněk sloupců, TeX příkazy za 1 znak
  const noM = plain(t).replace(/\\begin\{(?:pmatrix|vmatrix|array)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:pmatrix|vmatrix|array)\}/g, (_, body) => {
    const rows = body.split('\\\\').map((r) => r.split('&').map((c) => clean(c).length));
    const w = rows[0].map((_, j) => Math.max(...rows.map((r) => r[j] ?? 0)) + 1).reduce((x, y) => x + y, 2);
    return 'M'.repeat(w);
  });
  return clean(noM.replace(/&/g, '')).length;
};

test('soustavy: žádný řádek tabule není pro telefon (360 px) příliš dlouhý', () => {
  for (const t of soustavy.types) {
    for (let seed = 1; seed <= 300; seed++) {
      const p = t.generate(makeRng(seed));
      for (const tex of boardTex(p)) assert.ok(wide(tex) <= 32, `${t.id}, seed ${seed}: řádek má ${wide(tex)} znaků: ${tex}`);
    }
  }
});

test('soustavy: v zápisu není závorkovaný záporný jmenovatel ani „· −matice“', () => {
  for (const t of soustavy.types) {
    for (let seed = 1; seed <= 300; seed++) {
      const p = t.generate(makeRng(seed));
      for (const tex of boardTex(p)) {
        assert.doesNotMatch(plain(tex), /\\frac\{[^{}]*\}\{\s*\(?-/, `${t.id}, seed ${seed}: záporný jmenovatel: ${tex}`);
        assert.doesNotMatch(plain(tex), /\\cdot\s*-\s*(\\frac|\\begin)/, `${t.id}, seed ${seed}: záporný činitel bez závorky: ${tex}`);
      }
    }
  }
  const cr = type('cramer').solve({ A: [[2, 1, 0], [1, 0, 3], [0, 1, 1]], b: [1, 2, 3] });
  assert.ok(math.det([[2, 1, 0], [1, 0, 3], [0, 1, 1]]) < 0);
  assert.doesNotMatch(boardTex(cr).join(' '), /\\frac\{[^{}]*\}\{\(/);
  assert.match(boardTex(cr).join(' '), /\\frac\{-4\}\{7\}/);
  const axb = type('maticova-rovnice').solve({ form: 'AXB=C', A: [[1, 2], [1, 3]], B: [[1, 1], [2, 1]], C: [[1, 0], [0, 1]] }); // |B| = -1
  checkProblem(axb, oracles, '|B| = -1');
  assert.doesNotMatch(boardTex(axb).join(' '), /\\cdot\s*-/);
});

test('maticova-rovnice: dosazení výsledku z odpovědi do původní rovnice', () => {
  const m = type('maticova-rovnice');
  for (let seed = 1; seed <= 200; seed++) {
    const p = m.generate(makeRng(seed));
    assertSolves(p.data, p.answerSpec.value);
  }
});

test('maticova-rovnice: u AX = B + X text jmenuje (A − E)⁻¹', () => {
  for (const form of ['AX=B+X', 'XA=B+X']) {
    const p = type('maticova-rovnice').solve({ form, A: [[3, 1], [2, 4]], B: [[1, 0], [2, 1]] });
    checkProblem(p, oracles, form);
    assert.match(p.solution[0].text, /\(A - E\)\^\{-1\}/);
    assert.match(p.solution[0].text, /ne z \$A\$/);
  }
});

test('frobenius: zadání se ptá přesně na dvě hodnosti', () => {
  const p = type('frobenius').generate(makeRng(3));
  assert.match(p.task, /h\(A\)/);
  assert.match(p.task, /h\(A_r\)/);
  assert.doesNotMatch(p.task, /kolik má soustava řešení/);
});

test('parametr-k: pestrost (záporné i zlomkové k, k ve víc řádcích)', () => {
  let frac = 0; let neg = 0; let multi = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const p = type('parametr-k').generate(makeRng(seed));
    const k = p.answerSpec.value;
    if (!Number.isInteger(k)) frac++;
    if (k < 0) neg++;
    if (p.data.b.filter((v) => typeof v === 'string').length > 1) multi++;
  }
  assert.ok(frac >= 10, `zlomkové k: ${frac}`);
  assert.ok(neg >= 20, `záporné k: ${neg}`);
  assert.ok(multi >= 40, `k ve víc řádcích: ${multi}`);
});
