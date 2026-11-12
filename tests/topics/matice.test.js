import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import matice from '../../js/topics/matice.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem, flatTex } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

// Nezávislé výpočty: math.js (add, multiply, transpose, pow, inv, lusolve) a vlastní hodnost
// v plovoucí čárce se sloupcovým výběrem pivota – jiný postup než celočíselná eliminace v lin.js.
const tiny = (v) => Math.abs(v) < 1e-9;
function rank(M) {
  const m = M.map((r) => r.map(Number));
  let r = 0;
  const cols = m[0].length;
  for (let c = 0; c < cols && r < m.length; c++) {
    let best = r;
    for (let i = r; i < m.length; i++) if (Math.abs(m[i][c]) > Math.abs(m[best][c])) best = i;
    if (tiny(m[best][c])) continue;
    [m[r], m[best]] = [m[best], m[r]];
    for (let i = r + 1; i < m.length; i++) {
      const f = m[i][c] / m[r][c];
      m[i] = m[i].map((x, j) => x - f * m[r][j]);
    }
    r++;
  }
  return r;
}

// skupiny { k, terms: [[c, jméno, T?]] } -> součet (jméno 'X' se přeskočí)
function groupSum(mats, groups) {
  let acc = null;
  for (const g of groups) {
    for (const [c, name, t] of g.terms) {
      if (name === 'X') continue;
      const M = t ? math.transpose(mats[name]) : mats[name];
      const part = math.multiply(g.k * c, M);
      acc = acc ? math.add(acc, part) : part;
    }
  }
  return acc;
}
const xCoef = (groups) => groups.reduce((s, g) => s + g.terms.reduce((t, [c, n]) => t + (n === 'X' ? g.k * c : 0), 0), 0);

// rovnost matic se zápisy prvků jako '2x+5y' – math.js je vyhodnotí, soustava se vyřeší přes lusolve
function solveEquality(d) {
  const side = (groups) => (scope) => groups.map((g) => g.M.map((r) => r.map((e) => g.k * math.evaluate(String(e), scope))))
    .reduce((a, b) => math.add(a, b));
  const L = side(d.left); const R = side(d.right);
  const zero = Object.fromEntries(d.vars.map((v) => [v, 0]));
  const f = (scope) => math.subtract(L(scope), R(scope)).flat();
  const f0 = f(zero);
  const cols = d.vars.map((v) => f({ ...zero, [v]: 1 }).map((x, i) => x - f0[i]));
  const A = f0.map((_, i) => cols.map((c) => c[i]));
  const b = f0.map((x) => -x);
  const At = math.transpose(A);
  const sol = math.lusolve(math.multiply(At, A), math.multiply(At, b)).map((r) => r[0]);
  const scope = Object.fromEntries(d.vars.map((v, i) => [v, sol[i]]));
  assert.ok(f(scope).every(tiny), 'rovnost nemá řešení');
  return sol;
}

const exprMat = (d, side) => {
  const M = d[side];
  return d[`${side}t`] ? math.transpose(M) : M;
};

const oracles = {
  kombinace: (d) => groupSum(d.mats, d.expr),
  rovnice: (d) => {
    const dx = xCoef(d.left) - xCoef(d.right);
    const some = d.mats[Object.keys(d.mats)[0]];
    const zero = math.multiply(0, some);
    return math.divide(math.subtract(groupSum(d.mats, d.right) ?? zero, groupSum(d.mats, d.left) ?? zero), dx);
  },
  rovnost: (d) => solveEquality(d),
  soucin: (d) => {
    let P = d.factors.map((n) => d.mats[n]).reduce((a, b) => math.multiply(a, b));
    if (d.add) P = math.add(P, math.multiply(d.add.k, d.add.t ? math.transpose(d.mats[d.add.name]) : d.mats[d.add.name]));
    return P;
  },
  'typ-vysledku': (d) => {
    try {
      const L = exprMat(d, 'l'); const R = exprMat(d, 'r');
      if (d.op === 'add' && (L.length !== R.length || L[0].length !== R[0].length)) return 'neexistuje'; // math.add by rozšiřoval
      const res = d.op === 'mul' ? math.multiply(L, R) : math.add(L, R);
      return math.size(res);
    } catch { return 'neexistuje'; }
  },
  mocnina: (d) => math.pow(d.A, d.n),
  polynom: (d) => {
    const [a, b, c] = d.coefs;
    const n = d.A.length;
    return math.add(math.add(math.multiply(a, math.multiply(d.A, d.A)), math.multiply(b, d.A)), math.multiply(c, math.identity(n).toArray()));
  },
  hodnost: (d) => rank(d.rows),
  'hodnost-parametr': (d) => {
    // hledáme a (zlomek p/q), pro které má matice danou hodnost
    const found = [];
    for (let q = 1; q <= 12; q++) for (let p = -150; p <= 150; p++) {
      const a = p / q;
      const M = d.rows.map((r) => r.map((e) => (e === 'a' ? a : e)));
      if (rank(M) === d.target && !found.some((x) => Math.abs(x - a) < 1e-9)) found.push(a);
    }
    assert.equal(found.length, 1, `hodnost ${d.target} pro a = ${found}`);
    return found[0];
  },
  inverzni: (d) => math.inv(d.A),
  regularita: (d) => rank(d.A),
};
const type = (id) => matice.types.find((x) => x.id === id);

test('matice: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(matice, 200, { oracles });
  assert.ok(r.generated >= 200 * 8);
});

test('matice: registrace, pořadí a požadované typy', () => {
  assert.equal(matice.id, 'matice');
  assert.equal(matice.title, 'Matice, hodnost, inverzní matice');
  assert.equal(matice.order, 2);
  assert.ok(topics.includes(matice));
  assert.ok(topics.indexOf(matice) > topics.findIndex((t) => t.id === 'vektory'));
  const ids = matice.types.map((t) => t.id);
  for (const id of ['kombinace', 'soucin', 'typ-vysledku', 'mocnina', 'polynom', 'hodnost', 'inverzni', 'regularita']) assert.ok(ids.includes(id), id);
  for (const t of matice.types) assert.equal(typeof t.solve, 'function', `${t.id}: chybí solve(data)`);
});

test('matice: výklad pokrývá pojmy a má časté chyby', () => {
  const all = matice.theory.map((s) => `${s.heading} ${s.text}`).join(' ').toLowerCase();
  for (const w of ['transpon', 'součin', 'jednotková', 'hodnost', 'schodovit', 'regulární', 'singulární', 'inverzní', '(a|e)', 'neexistuje', 'adjungovan']) {
    assert.ok(all.includes(w), w);
  }
  for (const s of matice.theory) assert.ok(Array.isArray(s.mistakes) && s.mistakes.length >= 2, `${s.heading}: časté chyby`);
});

test('soucin: krok s typy a gauss/řádek krát sloupec', () => {
  const p = type('soucin').solve({ mats: { A: [[1, 2, 0], [-1, 3, 2]], B: [[2, 1], [0, -1], [4, 3]] }, factors: ['A', 'B'] });
  checkProblem(p, oracles, 'vlastní 2x3·3x2');
  const all = p.solution.flatMap((s) => s.board.map((l) => flatTex(l.tex))).join(' ');
  assert.ok(all.includes('c_11=1\\cdot2+2\\cdot0'), all);
  assert.ok(all.includes('+0\\cdot4=2'), all);
  assert.deepEqual(p.answerSpec.value, [[2, -1], [6, 2]]);
});

test('typ-vysledku: nedefinovaný součin i součet, typ výsledku', () => {
  const A = [[1, 2], [3, 4], [5, 6]]; const B = [[1, 0, 1], [2, 1, 0], [0, 0, 1]];
  const ab = type('typ-vysledku').solve({ l: A, r: B, op: 'mul' }); // (3×2)·(3×3)
  assert.equal(check(ab.answerSpec, 'neexistuje').ok, true);
  const ba = type('typ-vysledku').solve({ l: B, r: A, op: 'mul' });
  assert.equal(check(ba.answerSpec, '(3; 2)').ok, true);
  assert.equal(check(ba.answerSpec, 'neexistuje').ok, false);
  const sum = type('typ-vysledku').solve({ l: A, r: [[1, 2, 3], [4, 5, 6]], rt: true, op: 'add' });
  assert.equal(check(sum.answerSpec, '(3; 2)').ok, true);
  for (const p of [ab, ba, sum]) checkProblem(p, oracles, 'typ');
  assert.match(ab.task, /neexistuje/);
});

test('inverzni: Gauss–Jordan s rozšířenou maticí, zkouška A·A⁻¹ = E, zlomky', () => {
  const p = type('inverzni').solve({ A: [[2, 1, 0], [1, 1, 1], [0, 1, 3]] });
  checkProblem(p, oracles, 'vlastní 3x3');
  const gauss = p.solution.filter((s) => s.viz?.kind === 'gauss');
  assert.ok(gauss.length >= 2);
  for (const g of gauss) assert.equal(g.viz.data.augmented, 3);
  const last = p.solution[p.solution.length - 1];
  const tex = last.board.map((l) => l.tex).join(' ');
  assert.match(tex, /A\\cdot A\^\{-1\}/);
  assert.match(tex, /=E/);
  const p2 = type('inverzni').solve({ A: [[3, 1], [1, 1]] }); // det 2 -> poloviny
  checkProblem(p2, oracles, 'vlastní 2x2');
  assert.equal(check(p2.answerSpec, [['1/2', '-1/2'], ['-1/2', '3/2']]).ok, true);
  // 4×4
  checkProblem(type('inverzni').solve({ A: [[1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 1, 2]] }), oracles, '4x4');
});

test('inverzni: singulární matice v solve vyhodí chybu, regularita ji pozná', () => {
  assert.throws(() => type('inverzni').solve({ A: [[1, 2], [2, 4]] }));
  const p = type('regularita').solve({ A: [[1, 2, 3], [2, 4, 6], [1, 0, 1]] });
  checkProblem(p, oracles, 'singulární');
  assert.equal(p.answerSpec.value, 2);
  assert.match(p.conclusion, /neexistuje/);
  const q = type('regularita').solve({ A: [[1, 2], [3, 5]] });
  assert.match(q.conclusion, /existuje/);
  assert.doesNotMatch(q.conclusion, /neexistuje/);
});

test('regularita a hodnost: dost singulárních i regulárních, různé hodnosti', () => {
  let sing = 0;
  const ranks = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const p = type('regularita').generate(makeRng(seed));
    if (p.answerSpec.value < p.data.A.length) sing++;
    ranks.add(`${type('hodnost').generate(makeRng(seed)).answerSpec.value}`);
  }
  assert.ok(sing > 80 && sing < 180, `singulárních ${sing}`);
  assert.ok(ranks.size >= 3, [...ranks].join());
});

test('hodnost-parametr: hodnota parametru a vyšší hodnost pro ostatní a', () => {
  const p = type('hodnost-parametr').solve({ rows: [[1, 2, 0], [0, 1, 1], [2, 5, 'a']], target: 2 });
  checkProblem(p, oracles, 'vlastní parametr');
  assert.equal(p.answerSpec.value, 1);
});

test('rovnost: soustava pro neznámé prvky, i zlomkový výsledek', () => {
  const p = type('rovnost').solve({
    vars: ['x', 'y', 'u'],
    left: [{ k: 1, M: [['3x+y', '2u'], ['u+4', 'y-1']] }],
    right: [{ k: 1, M: [['x+2', '-2'], ['3', '0']] }],
  });
  checkProblem(p, oracles, 'vlastní rovnost');
  assert.equal(check(p.answerSpec, ['1/2', '1', '-1']).ok, true);
});

test('rovnice a polynom: vlastní čísla', () => {
  const r = type('rovnice').solve({
    mats: { A: [[1, 0], [2, 1]], B: [[0, 3], [1, 1]] },
    left: [{ k: 3, terms: [[1, 'A']] }, { k: 1, terms: [[-1, 'X']] }],
    right: [{ k: 1, terms: [[1, 'X'], [-1, 'B']] }],
  });
  checkProblem(r, oracles, 'rovnice');
  const pol = type('polynom').solve({ A: [[1, 1], [0, 2]], coefs: [2, -3, 1] });
  checkProblem(pol, oracles, 'polynom');
});

// Kontroly proti materiálům z Moodlu jsou jen v content/ (není v gitu).
test('matice: kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/matice-checks.json', import.meta.url));
  const raw = fixedProblemsFile('matice');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/matice-checks.json chybí'); return; }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const base = c.id ? raw.find((x) => x.id === c.id) : { type: c.type, data: c.data };
    assert.ok(base, JSON.stringify(c));
    const p = type(base.type).solve(base.data);
    const r = check(p.answerSpec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', JSON.stringify(c));
    else assert.equal(r.ok, true, `${JSON.stringify(c)} -> ${JSON.stringify(p.answerSpec)}`);
  }
});
