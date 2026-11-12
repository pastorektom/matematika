import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import vektory from '../../js/topics/vektory.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

// Nezávislé výpočty: math.js (dot, norm, acos, multiply/add/divide) a vlastní
// Gauss-Jordanova eliminace v plovoucí čárce – jiný postup než celočíselná eliminace v js/lin.js.
// (math.pinv se nepoužívá, u singulárních matic dává nesmyslné výsledky.)
const tiny = (v) => Math.abs(v) < 1e-9;
const PARAMS = ['t', 's', 'u', 'v', 'w', 'z'];

function groupSum(vectors, groups) {
  let acc = null;
  for (const g of groups) {
    for (const [c, name] of g.terms) {
      if (name === 'x') continue;
      const part = math.multiply(g.k * c, vectors[name]);
      acc = acc ? math.add(acc, part) : part;
    }
  }
  return acc;
}
const xCoef = (groups) => groups.reduce((s, g) => s + g.terms.reduce((t, [c, n]) => t + (n === 'x' ? g.k * c : 0), 0), 0);

// A·p = b: jediné řešení -> pole, žádné -> 'none', nekonečně mnoho -> '(c + k*t + l*s, …)'.
function solveLinear(vecs, b) {
  const k = vecs.length;
  const M = b.map((bi, i) => [...vecs.map((v) => v[i]), bi]);
  const piv = [];
  let r = 0;
  for (let c = 0; c < k && r < M.length; c++) {
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
  for (let i = r; i < M.length; i++) if (!tiny(M[i][k])) return 'none';
  const free = [...Array(k).keys()].filter((c) => !piv.includes(c));
  if (free.length === 0) return piv.map((_, i) => M[i][k]);
  const out = Array(k);
  free.forEach((c, q) => { out[c] = `0 + 1*${PARAMS[q]}`; });
  piv.forEach((c, i) => { out[c] = `${M[i][k]}${free.map((f, q) => ` - (${M[i][f]})*${PARAMS[q]}`).join('')}`; });
  return `(${out.join(', ')})`;
}

const oracles = {
  kombinace: (d) => groupSum(d.vectors, d.expr),
  rovnice: (d) => {
    const dx = xCoef(d.left) - xCoef(d.right);
    const zero = d.vectors[Object.keys(d.vectors)[0]].map(() => 0);
    const rhs = math.subtract(groupSum(d.vectors, d.right) ?? zero, groupSum(d.vectors, d.left) ?? zero);
    return math.divide(rhs, dx);
  },
  'skalarni-soucin': (d) => math.dot(d.a, d.b),
  kolmost: (d) => {
    const at = (t) => math.dot(d.a.map((v, i) => (i === d.j ? t : v)), d.b);
    return -at(0) / (at(1) - at(0));
  },
  'velikost-uhel': (d) => math.acos(math.dot(d.a, d.b) / (math.norm(d.a) * math.norm(d.b))) * 180 / Math.PI,
  zavislost: (d) => solveLinear(d.vectors, d.vectors[0].map(() => 0)),
  'je-kombinace': (d) => solveLinear(d.vecs, d.b),
  souradnice: (d) => solveLinear(d.basis, d.u),
};
const type = (id) => vektory.types.find((x) => x.id === id);

test('vektory: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(vektory, 200, { oracles, strictDenominators: true });
  assert.ok(r.generated >= 200 * 4);
});

test('vektory: aspoň 4 požadované typy, téma je v seznamu jako první', () => {
  const ids = vektory.types.map((t) => t.id);
  for (const id of ['kombinace', 'skalarni-soucin', 'zavislost', 'velikost-uhel']) assert.ok(ids.includes(id), id);
  assert.equal(vektory.id, 'vektory');
  assert.equal(vektory.title, 'Aritmetické vektory');
  assert.equal(vektory.order, 1);
  assert.ok(topics.includes(vektory));
  for (const t of vektory.types) assert.equal(typeof t.solve, 'function', `${t.id}: chybí solve(data)`);
});

test('vektory: výklad pokrývá pojmy, časté chyby a celou tabulku kosinu', () => {
  const all = vektory.theory.map((s) => `${s.heading} ${s.text}`).join(' ');
  for (const w of ['lineární kombinac', 'skalární součin', 'lineárně závisl', 'báze', 'kolm', 'velikost']) {
    assert.match(all.toLowerCase(), new RegExp(w), w);
  }
  for (const d of [0, 30, 45, 60, 90, 120, 135, 150, 180]) assert.ok(all.includes(`\\cos ${d}^\\circ`), `cos ${d}°`);
  assert.ok(vektory.theory.filter((s) => Array.isArray(s.mistakes) && s.mistakes.length).length >= 5);
});

test('zavislost: libovolný počet parametrů (vlastní čísla)', () => {
  // tři rovnoběžné vektory v R^3: hodnost 1 -> dva parametry
  const p1 = type('zavislost').solve({ vectors: [[1, 2, -1], [2, 4, -2], [-3, -6, 3]] });
  checkProblem(p1, oracles, 'rovnoběžné v R3');
  assert.match(p1.conclusion, /závislé/);
  assert.equal(check(p1.answerSpec, '(-2t + 3s, t, s)').ok, true);
  // tři vektory v R^2 s hodností 1
  const p2 = type('zavislost').solve({ vectors: [[1, 2], [2, 4], [-1, -2]] });
  checkProblem(p2, oracles, 'hodnost 1 v R2');
  // nezávislé
  const p3 = type('zavislost').solve({ vectors: [[1, 0, 2], [0, 1, 1], [1, 1, 0]] });
  assert.equal(check(p3.answerSpec, '(0, 0, 0)').ok, true);
  assert.match(p3.conclusion, /nezávislé/);
  // šest vektorů v R^2
  const p4 = type('zavislost').solve({ vectors: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 3], [0, 2]] });
  checkProblem(p4, oracles, 'šest vektorů');
});

test('zavislost: zadání obsahuje rovnici a formát odpovědi, bez příkladu z přednášky', () => {
  const p = type('zavislost').generate(makeRng(3));
  assert.match(p.task, /Vyřeš rovnici/);
  assert.match(p.task, /rozhodni, zda jsou vektory lineárně závislé/);
  assert.match(p.task, /nezávislé/);
  assert.ok(p.task.includes('(2t,\\ t,\\ -3t)'), 'vlastní příklad zápisu s parametrem');
});

test('velikost-uhel: odpověď ve stupních i radiánech, ptá se jen na úhel', () => {
  const p = type('velikost-uhel').solve({ a: [1, 1, 0], b: [0, 1, 1] }); // 60°
  assert.equal(p.answerSpec.unit, 'deg');
  for (const ok of ['60', '60°', 'π/3', 'pi/3']) assert.equal(check(p.answerSpec, ok).ok, true, ok);
  assert.match(p.task, /ve stupních/);
  assert.match(p.task, /radiánech/);
  const board = p.solution[2].board.map((l) => l.tex).join('\n');
  assert.match(board, /bt-spoj/); // spojení odmocnin
});

test('rovnice: různé koeficienty u x a občas zlomky', () => {
  const dxs = new Map();
  let frac = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const p = type('rovnice').generate(makeRng(seed));
    const dx = p.data.left.reduce((s, g) => s + g.terms.reduce((t, [c, n]) => t + (n === 'x' ? g.k * c : 0), 0), 0)
      - p.data.right.reduce((s, g) => s + g.terms.reduce((t, [c, n]) => t + (n === 'x' ? g.k * c : 0), 0), 0);
    dxs.set(dx, (dxs.get(dx) || 0) + 1);
    if (p.answerSpec.value.some((v) => !Number.isInteger(v))) frac++;
  }
  assert.ok(dxs.size >= 8, `málo různých koeficientů: ${[...dxs.keys()]}`);
  assert.ok(Math.max(...dxs.values()) < 300 * 0.25, 'jeden koeficient převládá');
  assert.ok(frac > 10 && frac < 150, `zlomkových výsledků: ${frac}`);
});

test('je-kombinace a soustavy: první rovnice nikdy 0 = c', () => {
  for (const id of ['je-kombinace', 'zavislost', 'souradnice']) {
    for (let seed = 1; seed <= 200; seed++) {
      const p = type(id).generate(makeRng(seed));
      const sys = p.solution.find((s) => s.title === 'Soustava rovnic');
      assert.ok(!/^0=/.test(sys.board[0].tex.replace(/\\htmlClass\{[^}]*\}\{/, '')), `${id} ${seed}`);
    }
  }
});

test('hydrateProblems: chyba v solve se zaloguje s id příkladu', async () => {
  const { hydrateProblems } = await import('../../js/content.js');
  const warns = [];
  const orig = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    hydrateProblems(vektory, [{ id: 'zly-1', type: 'souradnice', data: { basis: [[1, 2], [2, 4]], u: [1, 1] } }]);
  } finally { console.warn = orig; }
  assert.equal(warns.length, 1);
  assert.match(warns[0], /zly-1/);
});

// Kontroly proti příkladům z Moodlu (přednáška, výsledky ve sbírce) jsou jen v content/,
// které není v gitu: content/problems/vektory-checks.json = [{ type, data, input, expect? } | { id, input, expect? }]
test('vektory: kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/vektory-checks.json', import.meta.url));
  const raw = fixedProblemsFile('vektory');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/vektory-checks.json chybí'); return; }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const p = c.id ? raw.find((x) => x.id === c.id) : type(c.type).solve(c.data);
    assert.ok(p, JSON.stringify(c));
    const r = check(p.answerSpec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', JSON.stringify(c));
    else assert.equal(r.ok, true, `${JSON.stringify(c)} -> ${JSON.stringify(p.answerSpec)}`);
  }
});

test('velikost-uhel: stejné velikosti se spojí na √n·√n = n (ne √n²) a zlomek má mezikrok', () => {
  const p = type('velikost-uhel').solve({ a: [3, 3, 0], b: [3, 0, 3] }); // |a|² = |b|² = 18
  const board = p.solution[2].board.map((l) => l.tex).join('\n');
  assert.ok(!board.includes('324'), board);
  assert.match(p.solution[2].board.map((l) => (l.notes ?? []).map((n) => n.label).join()).join(), /√18·√18 = 18/);
  // cos = 1/√2: mezikrok s √2·√2 = 2 před tabulkovou hodnotou
  const q = type('velikost-uhel').solve({ a: [1, 1, 0], b: [1, 0, 0] });
  const labels = q.solution[2].board.map((l) => (l.notes ?? []).map((n) => n.label).join());
  assert.ok(labels.some((t) => /√2·√2 = 2/.test(t)), labels.join('|'));
});

test('zpětné dosazení: jednotné i množné číslo u parametrů a bez slibu „bez zlomků“', () => {
  let one = 0; let many = 0;
  for (let seed = 1; seed <= 200; seed++) for (const id of ['je-kombinace', 'zavislost', 'souradnice']) {
    const p = type(id).generate(makeRng(seed));
    for (const s of p.solution) {
      assert.ok(!/nevyšly zlomky/.test(s.text), s.text);
      if (/^Neznámá /.test(s.text)) { one++; assert.match(s.text, /nemá .* ji zvolíme jako parametr \(/); }
      if (/^Neznámé /.test(s.text)) { many++; assert.match(s.text, /nemají .* je zvolíme jako parametry \(/); }
    }
  }
  assert.ok(one > 0, `jednotné ${one}, množné ${many}`);
});
