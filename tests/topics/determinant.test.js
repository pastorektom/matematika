import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import determinant from '../../js/topics/determinant.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

// Nezávislé výpočty: math.js (det, inv, lusolve) a vlastní numerické řešení rovnice
// a nerovnice s parametrem (interpolace hodnot determinantu a test znamének na úsecích).
const D = (M) => Math.round(math.det(M));
const ent = (e) => (Array.isArray(e) ? e : [e, 0]);
const detAt = (M, x) => math.det(M.map((r) => r.map((e) => ent(e)[0] + ent(e)[1] * x)));

// det(A(x)) je mnohočlen stupně ≤ 2 -> koeficienty z hodnot v 0, 1, -1
function quad(M) {
  const f0 = detAt(M, 0); const f1 = detAt(M, 1); const fm = detAt(M, -1);
  return { a: (f1 + fm) / 2 - f0, b: (f1 - fm) / 2, c: f0 };
}
function realRoots({ a, b, c }) {
  const t = (v) => Math.abs(v) < 1e-9;
  if (t(a)) return t(b) ? [] : [-c / b];
  const d = b * b - 4 * a * c;
  if (d < -1e-9) return [];
  const s = Math.sqrt(Math.max(d, 0));
  return [...new Set([(-b - s) / (2 * a), (-b + s) / (2 * a)].map((v) => Math.round(v * 1e9) / 1e9))].sort((x, y) => x - y);
}
const fmt = (v) => (Number.isInteger(v) ? String(v) : `${Math.round(v * 1e9) / 1e9}`);
function solveIneq(M, rel) {
  const q = quad(M);
  const r = realRoots(q);
  const f = (x) => q.a * x * x + q.b * x + q.c;
  const ok = (v) => ({ '<=': v <= 1e-9, '<': v < -1e-9, '>=': v >= -1e-9, '>': v > 1e-9 }[rel]);
  const pts = [-Infinity, ...r, Infinity];
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i]; const hi = pts[i + 1];
    const mid = !Number.isFinite(lo) ? hi - 1 : !Number.isFinite(hi) ? lo + 1 : (lo + hi) / 2;
    if (!ok(f(Number.isFinite(mid) ? mid : 0))) continue;
    const closed = rel === '<=' || rel === '>=';
    const L = Number.isFinite(lo) ? `${closed ? '<' : '('}${fmt(lo)}` : '(-∞';
    const H = Number.isFinite(hi) ? `${fmt(hi)}${closed ? '>' : ')'}` : '∞)';
    parts.push(`${L}; ${H}`);
  }
  // sloučení navazujících uzavřených intervalů (kořen patří do obou)
  return parts.join(' ∪ ');
}

function applyOps(n, d, ops) {
  // matice s determinantem d: diag(d,1,…) a pár přičtení řádků (det se nezmění)
  let A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? (i === 0 ? d : 1) : 0)));
  A = A.map((r, i) => (i > 0 ? r.map((x, j) => x + 2 * A[0][j]) : r));
  for (const o of ops) {
    if (o.kind === 'swap') [A[o.i], A[o.j]] = [A[o.j], A[o.i]];
    else if (o.kind === 'scale') A[o.i] = A[o.i].map((x) => x * o.k);
    else if (o.kind === 'add') A[o.i] = A[o.i].map((x, j) => x + o.k * A[o.j][j]);
    else if (o.kind === 'transpose') A = math.transpose(A);
    else if (o.kind === 'mult') A = math.multiply(o.k, A);
  }
  return D(A);
}

const oracles = {
  det2: (d) => D(d.M),
  sarrus: (d) => D(d.M),
  rozvoj: (d) => D(d.M),
  uprava: (d) => D(d.M),
  schodovity: (d) => D(d.M),
  vlastnosti: (d) => applyOps(d.n, d.d, d.ops),
  parametr: (d) => (d.rel === '=' ? `${realRoots(quad(d.M)).map(fmt).join('; ')}` : solveIneq(d.M, d.rel)),
  adjungovana: (d) => math.inv(d.M),
  cramer: (d) => math.lusolve(d.A, d.b).map((r) => r[0]),
  aplikace: (d) => math.lusolve(d.A, d.B).map((r) => r[0]),
};
const type = (id) => determinant.types.find((x) => x.id === id);

test('determinant: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(determinant, 200, { oracles });
  assert.ok(r.generated >= 200 * 8);
});

test('determinant: téma je registrované, pořadí 3, každý typ má solve', () => {
  assert.equal(determinant.id, 'determinant');
  assert.equal(determinant.title, 'Determinant, adjungovaná matice');
  assert.equal(determinant.order, 3);
  assert.ok(topics.includes(determinant));
  for (const id of ['det2', 'sarrus', 'rozvoj', 'uprava', 'schodovity', 'parametr', 'adjungovana', 'cramer']) assert.ok(type(id), id);
  for (const t of determinant.types) assert.equal(typeof t.solve, 'function', `${t.id}: chybí solve(data)`);
});

test('determinant: výklad pokrývá pojmy a časté chyby', () => {
  const all = determinant.theory.map((s) => `${s.heading} ${s.text}`).join(' ').toLowerCase();
  for (const w of ['sarrus', 'křížov', 'algebraick', 'subdeterminant', 'rozvoj', 'šachovnic', 'adjungovan', 'cramer', 'regulární', 'schodovit', 'parametr', 'transpon']) {
    assert.match(all, new RegExp(w), w);
  }
  assert.ok(determinant.theory.every((s) => Array.isArray(s.mistakes) && s.mistakes.length > 0));
});

test('sarrus: krok s maticí a barevnými diagonálami (přepsané dva sloupce)', () => {
  const p = type('sarrus').solve({ M: [[1, 2, 0], [3, -1, 4], [2, 5, 1]] });
  const viz = p.solution.find((s) => s.viz)?.viz;
  assert.equal(viz.kind, 'matrix');
  assert.equal(viz.data.rows[0].length, 5);
  assert.equal(viz.data.lines.filter((l) => l.color === 'accent').length, 3);
  assert.equal(viz.data.lines.filter((l) => l.color === 'warn').length, 3);
  assert.equal(p.answerSpec.value, D([[1, 2, 0], [3, -1, 4], [2, 5, 1]]));
});

test('rozvoj: volí řádek/sloupec s nejvíce nulami a ukazuje šachovnici znamének', () => {
  const p = type('rozvoj').solve({ M: [[2, 1, 3], [4, -1, 2], [0, 5, 0]] });
  assert.match(p.solution[1].title, /3\. řádku/);
  const board = p.solution.flatMap((s) => s.board.map((l) => l.tex)).join(' ');
  assert.match(board, /\(-1\)\^\{5\}/);
  assert.ok(p.solution.some((s) => s.viz && s.viz.kind === 'matrix'));
  const q = type('rozvoj').solve({ M: [[1, 0, 2, 1], [3, 0, 1, 2], [2, 1, 4, 0], [1, 0, 1, 1]] });
  assert.match(q.solution[1].title, /2\. sloupce/);
  checkProblem(q, oracles, 'rozvoj 4x4');
});

test('uprava: zvládne i matici 5×5 a matici bez jedničky (vlastní čísla)', () => {
  const M5 = [[2, 1, 0, 3, 1], [1, 2, 1, 0, 2], [3, 0, 2, 1, 1], [0, 1, 1, 2, 3], [1, 1, 0, 1, 2]];
  checkProblem(type('uprava').solve({ M: M5 }), oracles, '5x5');
  const M4 = [[2, 3, 4, 2], [3, 2, 5, 3], [4, 6, 2, 3], [2, 5, 3, 4]];
  checkProblem(type('uprava').solve({ M: M4 }), oracles, 'bez jedničky');
  const z = type('uprava').solve({ M: [[1, 2, 0, 3], [2, 1, 0, 1], [3, 3, 0, 2], [1, 4, 0, 1]] });
  assert.equal(z.answerSpec.value, 0);
  assert.ok(z.solution.some((s) => s.viz?.kind === 'gauss') || z.solution.length >= 3);
});

test('schodovity: výměna řádků mění znaménko, výsledek je součin diagonály', () => {
  const p = type('schodovity').solve({ M: [[0, 2, 1], [1, 3, 2], [2, 1, 1]] });
  checkProblem(p, oracles, 'výměna');
  const text = p.solution.map((s) => s.text).join(' ');
  assert.match(text, /znaménko/);
});

test('parametr: rovnice -> seznam kořenů, nerovnice -> interval', () => {
  const eq = type('parametr').solve({ M: [[1, 1, 1], [1, [4, -1], 1], [1, 1, [1, 1]]], rel: '=' }); // (3-x)x
  assert.equal(eq.answerSpec.kind, 'system');
  assert.equal(check(eq.answerSpec, '0; 3').ok, true);
  assert.match(eq.task, /např/);
  const ne = type('parametr').solve({ M: [[1, 0, [0, 1]], [0, 2, 1], [3, 0, 1]], rel: '<=' }); // 2 - 6x
  assert.equal(ne.answerSpec.kind, 'interval');
  assert.equal(check(ne.answerSpec, '<1/3; ∞)').ok, true);
  checkProblem(ne, oracles, 'nerovnice');
  assert.match(ne.task, /interval/);
});

test('adjungovana: 4×4 a zlomky; odpověď se zlomky projde', () => {
  const p = type('adjungovana').solve({ M: [[2, 1], [1, 3]] });
  assert.equal(check(p.answerSpec, [['3/5', '-1/5'], ['-1/5', '2/5']]).ok, true);
  checkProblem(type('adjungovana').solve({ M: [[1, 2, 0, 1], [0, 1, 1, 2], [2, 0, 1, 1], [1, 1, 0, 1]] }), oracles, '4x4');
  assert.throws(() => type('adjungovana').solve({ M: [[1, 2], [2, 4]] }));
});

test('vlastnosti a cramer: vlastní čísla', () => {
  const v = type('vlastnosti').solve({ n: 3, d: 4, ops: [{ kind: 'swap', i: 0, j: 2 }, { kind: 'mult', k: 2 }, { kind: 'transpose' }] });
  assert.equal(v.answerSpec.value, -32);
  const c = type('cramer').solve({ A: [[2, 1], [1, -1]], b: [5, 1] });
  assert.deepEqual(c.answerSpec.value, [2, 1]);
});

test('generátory: rozumná čísla a různorodost', () => {
  for (const id of ['sarrus', 'rozvoj', 'uprava', 'schodovity', 'adjungovana', 'cramer']) {
    const dets = new Set();
    for (let seed = 1; seed <= 100; seed++) {
      const p = type(id).generate(makeRng(seed));
      const M = p.data.M || p.data.A;
      assert.ok(M.flat().every((x) => Math.abs(x) <= 12), `${id} ${seed}: velké číslo`);
      dets.add(D(M));
    }
    assert.ok(dets.size >= 10, `${id}: málo různých determinantů`);
  }
});

// Kontroly proti výsledkům z Moodlu jsou jen v content/ (není v gitu):
// content/problems/determinant-checks.json = [{ id, input, expect? } | { type, data, input, expect? }]
test('determinant: kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/determinant-checks.json', import.meta.url));
  const raw = fixedProblemsFile('determinant');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/determinant-checks.json chybí'); return; }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const p = c.id ? raw.find((x) => x.id === c.id) : type(c.type).solve(c.data);
    assert.ok(p, JSON.stringify(c));
    const built = c.id ? type(p.type).solve(p.data) : p;
    const r = check(built.answerSpec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', JSON.stringify(c));
    else assert.equal(r.ok, true, `${JSON.stringify(c)} -> ${JSON.stringify(built.answerSpec)}`);
  }
});

test('pokrytí generátorů: uprava 5×5 a zlomek před determinantem, adjungovana 4×4 (vzácně)', () => {
  const cnt = { u5: 0, uFrac: 0, a4: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    const u = type('uprava').generate(makeRng(seed));
    if (u.data.M.length === 5) cnt.u5++;
    if (u.solution.some((st) => st.board.some((l) => l.tex.includes('\\frac')))) cnt.uFrac++;
    if (type('adjungovana').generate(makeRng(seed)).data.M.length === 4) cnt.a4++;
  }
  assert.ok(cnt.u5 >= 5, `5×5: ${cnt.u5}`);
  assert.ok(cnt.uFrac >= 10, `zlomek před determinantem: ${cnt.uFrac}`);
  assert.ok(cnt.a4 >= 5 && cnt.a4 <= 50, `4×4: ${cnt.a4}`);
});

test('teorie: Časté chyby neobsahují chybné tvrzení o R_2 − 2R_2', () => {
  const all = JSON.stringify(determinant.theory);
  assert.ok(!all.includes('vznikne nulový řádek a determinant se změní'));
});
