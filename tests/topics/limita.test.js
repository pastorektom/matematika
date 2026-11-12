import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import limita from '../../js/topics/limita.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

// Nezávislý výpočet: výraz sestavený jako text pro math.js, vyhodnocený numericky těsně u bodu
// (x = a ± 1e-7) nebo daleko (x = ±1e7); hodnota se převede řetězovým zlomkem na p/q.
// Jiný postup než přesné dělení mnohočlenů v js/topics/limita-lib.js.
const H = 1e-7;
const BIG = 1e5;

function rational(v) {
  const sign = v < 0 ? -1 : 1;
  let x = Math.abs(v);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (Math.abs(h1 / k1 - Math.abs(v)) < 1e-5 * Math.max(1, Math.abs(v))) break;
    x = 1 / (x - a);
    if (!Number.isFinite(x)) break;
  }
  assert.ok(k1 <= 2000, `nezdařilo se převést ${v} na zlomek`);
  return `${sign * h1}/${k1}`;
}
const classify = (v) => (Math.abs(v) > BIG ? (v > 0 ? '∞' : '-∞') : null);

function numLimit(f, a, side) {
  if (a === Infinity || a === -Infinity) {
    const s = a > 0 ? 1 : -1;
    const v1 = f(s * 1e4); const v2 = f(s * 1e7);
    if (Math.abs(v2) > BIG && Math.abs(v2) > 10 * Math.abs(v1)) return v2 > 0 ? '∞' : '-∞';
    return rational(v2);
  }
  // nekonečno pozná hodnota těsně u bodu; konečnou limitu zpřesní Richardsonova extrapolace
  const one = (sd) => {
    const inf = classify(f(a + sd * H));
    if (inf) return inf;
    const h = 1e-4;
    return rational(2 * f(a + sd * h / 2) - f(a + sd * h));
  };
  if (side === '-') return one(-1);
  if (side === '+') return one(1);
  const l = one(-1); const r = one(1);
  if (l === r) return l;
  if (!['∞', '-∞'].includes(l) && !['∞', '-∞'].includes(r) && math.evaluate(l) === math.evaluate(r)) return l;
  return 'DNE';
}
const pstr = (p) => p.map((c, i) => `(${c})*x^${i}`).join(' + ');
const fn = (s) => { const c = math.compile(s); return (x) => c.evaluate({ x }); };
const pointOf = (a) => (typeof a === 'string' ? math.evaluate(a) : a);
const termStr = (t) => (t.poly ? `(${pstr(t.poly)})` : t.neg ? `(${t.c} - sqrt(${pstr(t.rad)}))` : `(sqrt(${pstr(t.rad)}) - ${t.c})`);
const SIN = {
  sx: (d) => `${d.m ?? 1}*sin(${d.a}*x)/(${d.b}*x)`,
  xs: (d) => `${d.b}*x/sin(${d.a}*x)`,
  ss: (d) => `${d.m ?? 1}*sin(${d.a}*x)/sin(${d.b}*x)`,
  tx: (d) => `${d.m ?? 1}*tan(${d.a}*x)/(${d.b}*x)`,
};
function graphFn(d) {
  const pieces = d.pieces.map((p) => ({ ...p, f: fn(p.expr) }));
  return (x) => {
    const p = pieces.find((q) => (q.lo == null || x > q.lo) && (q.hi == null || x < q.hi));
    return p ? p.f(x) : NaN;
  };
}
// mnohočlen p(a + t) v proměnné t (Taylorův posun): u násobného kořene se tak nezkazí zaokrouhlením
const shiftP = (p, a) => {
  const c = p.slice();
  for (let i = 0; i < c.length - 1; i++) for (let j = c.length - 2; j >= i; j--) c[j] += a * c[j + 1];
  return c;
};
const rat = (d) => {
  const a = pointOf(d.a);
  const c = math.compile(`(${pstr(shiftP(d.num, a))})/(${pstr(shiftP(d.den, a))})`);
  return numLimit((x) => c.evaluate({ x: x - a }), a, d.side);
};
const oracles = {
  dosazeni: rat,
  rozklad: rat,
  jednostranne: rat,
  odmocnina: (d) => numLimit(fn(`${termStr(d.num)}/${termStr(d.den)}`), d.a, ''),
  nekonecno: (d) => numLimit(fn(`(${pstr(d.num)})/(${pstr(d.den)})`), d.to * Infinity),
  sinx: (d) => numLimit(fn(SIN[d.form](d)), 0, ''),
  'z-grafu': (d) => numLimit(graphFn(d), d.at === 'inf' ? Infinity : d.at === '-inf' ? -Infinity : d.at, d.side),
};
const type = (id) => limita.types.find((t) => t.id === id);
const boardTex = (p) => p.solution.flatMap((s) => (s.board || []).map((l) => l.tex)).join('\n');
const notes = (p) => p.solution.flatMap((s) => (s.board || []).flatMap((l) => l.notes || []));

test('limita: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(limita, 200, { oracles, strictDenominators: true });
  assert.ok(r.generated >= 200 * 7);
});

test('limita: téma je zaregistrované jako šesté, všechny typy mají solve', () => {
  assert.equal(limita.id, 'limita');
  assert.equal(limita.title, 'Limita funkce');
  assert.equal(limita.order, 6);
  assert.ok(topics.includes(limita));
  const ids = limita.types.map((t) => t.id);
  for (const id of ['dosazeni', 'rozklad', 'jednostranne', 'odmocnina', 'nekonecno', 'sinx', 'z-grafu']) assert.ok(ids.includes(id), id);
  for (const t of limita.types) assert.equal(typeof t.solve, 'function', t.id);
});

test('limita: výklad pokrývá pojmy a časté chyby', () => {
  const all = limita.theory.map((s) => `${s.heading} ${s.text}`).join(' ').toLowerCase();
  for (const w of ['dosazení', 'neurčit', 'rozklad', 'jednostrann', 'nekonečn', 'odmocnin', 'sin', 'spojit', 'graf']) assert.match(all, new RegExp(w), w);
  for (const s of limita.theory) assert.ok(Array.isArray(s.mistakes) && s.mistakes.length > 0, `${s.heading}: chybí časté chyby`);
});

test('rozklad: tabule jako vzor (závorky s hodnotami, škrtnutí, dvojité podtržení)', () => {
  // vlastní příklad: (x^3+8)/(x^2+x-2), x -> -2  =  12/(-3) = -4
  const p = type('rozklad').solve({ num: [8, 0, 0, 1], den: [-2, 1, 1], a: -2 });
  checkProblem(p, oracles, 'vlastní');
  assert.equal(check(p.answerSpec, '-4').ok, true);
  const n = notes(p);
  assert.ok(n.some((x) => x.kind === 'brace' && x.label === '12' && x.position !== 'below'));
  assert.ok(n.some((x) => x.kind === 'brace' && x.label === '−3' && x.position === 'below'));
  assert.ok(n.some((x) => x.kind === 'strike'));
  assert.ok(n.some((x) => x.kind === 'doubleUnderline'));
  const b = boardTex(p);
  assert.match(b, /\(x\^\{3\}\+8\):\(x\+2\)=x\^\{2\}-2x\+4/);
  assert.match(p.solution[1].text, /součet třetích mocnin/);
});

test('rozklad: zlomkový bod a dvojnásobný kořen (vlastní čísla)', () => {
  // (2x^2+x-1)/(2x^2-3x+1) v x -> 1/2: (2x-1)(x+1)/((2x-1)(x-1)) -> (3/2)/(-1/2) = -3
  const p = type('rozklad').solve({ num: [-1, 1, 2], den: [1, -3, 2], a: '1/2' });
  checkProblem(p, oracles, 'zlomek');
  assert.equal(check(p.answerSpec, '-3').ok, true);
  // (x^2-4x+4)/(x^2-x-2) v 2: (x-2)^2/((x-2)(x+1)) -> 0
  const q = type('rozklad').solve({ num: [4, -4, 1], den: [-2, -1, 1], a: 2 });
  checkProblem(q, oracles, 'dvojný');
  assert.equal(check(q.answerSpec, '0').ok, true);
  // (x^3-3x+2)/(x^2-2x+1) v 1: dvakrát 0/0, pak 3/1
  const r = type('rozklad').solve({ num: [2, -3, 0, 1], den: [1, -2, 1], a: 1 });
  checkProblem(r, oracles, 'dvě kola');
  assert.equal(check(r.answerSpec, '3').ok, true);
  // po krácení k/0: (x^2-4)/((x-2)^2(x+1)) v 2 -> (x+2)/((x-2)(x+1)): zleva -inf, zprava inf, neexistuje
  const s = type('rozklad').solve({ num: [-4, 0, 1], den: [4, 0, -3, 1], a: 2 });
  checkProblem(s, oracles, 'k/0 po krácení');
  assert.equal(check(s.answerSpec, 'neexistuje').ok, true);
});

test('jednostranne: liché a sudé mocniny, strany', () => {
  // (x+1)/(x-2): zleva -∞, zprava ∞, oboustranná neexistuje
  const base = { num: [1, 1], den: [-2, 1], a: 2 };
  assert.equal(check(type('jednostranne').solve({ ...base, side: '' }).answerSpec, 'neexistuje').ok, true);
  assert.equal(check(type('jednostranne').solve({ ...base, side: '-' }).answerSpec, '-∞').ok, true);
  assert.equal(check(type('jednostranne').solve({ ...base, side: '+' }).answerSpec, '∞').ok, true);
  // -3/(x-1)^2: -∞ z obou stran
  const p = type('jednostranne').solve({ num: [-3], den: [1, -2, 1], a: 1, side: '' });
  checkProblem(p, oracles, 'sudá');
  assert.equal(check(p.answerSpec, '-∞').ok, true);
  assert.ok(p.solution.some((s) => s.viz && s.viz.kind === 'signchart'));
  // zadání říká formát odpovědi
  const g = type('jednostranne').generate(makeRng(5));
  assert.match(g.task, /neexistuje/);
  assert.match(g.task, /∞/);
});

test('nekonecno: tři případy stupňů a mnohočlen', () => {
  const t = type('nekonecno');
  assert.equal(check(t.solve({ num: [1, 2], den: [3, 0, 1], to: 1 }).answerSpec, '0').ok, true);
  assert.equal(check(t.solve({ num: [1, 0, -4], den: [2, 1, 6], to: -1 }).answerSpec, '-2/3').ok, true);
  assert.equal(check(t.solve({ num: [0, 1, 0, 2], den: [1, 1], to: -1 }).answerSpec, '∞').ok, true);
  assert.equal(check(t.solve({ num: [1, 0, 0, -2], den: [1], to: -1 }).answerSpec, '∞').ok, true);
  assert.equal(check(t.solve({ num: [1, 0, 0, -2], den: [1], to: 1 }).answerSpec, '-∞').ok, true);
  const p = t.solve({ num: [1, 0, -4], den: [2, 1, 6], to: 1 });
  assert.match(boardTex(p), /\\frac\{1\}\{x\^\{2\}\}/);
  const cases = new Set();
  for (let s = 1; s <= 100; s++) {
    const q = t.generate(makeRng(s));
    const n = q.data.num.length; const m = q.data.den.length;
    cases.add(m === 1 ? 'poly' : n < m ? '<' : n === m ? '=' : '>');
  }
  assert.equal(cases.size, 4);
});

test('odmocnina: rozšíření sdruženým výrazem (vlastní čísla)', () => {
  // (sqrt(3x+10)-4)/(x-2) = 3/8
  const p = type('odmocnina').solve({ a: 2, num: { rad: [10, 3], c: 4, neg: false }, den: { poly: [-2, 1] } });
  checkProblem(p, oracles, 'čitatel');
  assert.equal(check(p.answerSpec, '3/8').ok, true);
  assert.match(boardTex(p), /\\sqrt\{3x\+10\}\+4/);
  // (x^2-9)/(2-sqrt(x+1)) v 3 = 6*4/(-1) = -24
  const q = type('odmocnina').solve({ a: 3, num: { poly: [-9, 0, 1] }, den: { rad: [1, 1], c: 2, neg: true } });
  checkProblem(q, oracles, 'jmenovatel');
  assert.equal(check(q.answerSpec, '-24').ok, true);
  // obě odmocniny
  const r = type('odmocnina').solve({ a: 2, num: { rad: [2, 1], c: 2, neg: false }, den: { rad: [-1, 1], c: 1, neg: false } });
  checkProblem(r, oracles, 'obě');
});

test('sinx: všechny tvary', () => {
  const t = type('sinx');
  assert.equal(check(t.solve({ form: 'sx', a: 3, b: 5, m: 2 }).answerSpec, '6/5').ok, true);
  assert.equal(check(t.solve({ form: 'xs', a: 4, b: 2 }).answerSpec, '1/2').ok, true);
  assert.equal(check(t.solve({ form: 'ss', a: 2, b: 7 }).answerSpec, '2/7').ok, true);
  assert.equal(check(t.solve({ form: 'tx', a: 5, b: 3 }).answerSpec, '5/3').ok, true);
});

test('z-grafu: graf s prázdnými a plnými body, odpověď v bodě', () => {
  let open = 0; let dne = 0; let inf = 0;
  for (let s = 1; s <= 200; s++) {
    const p = type('z-grafu').generate(makeRng(s));
    const v = p.solution[0].viz;
    assert.equal(v.kind, 'plot');
    if (v.data.points.some((q) => q.style === 'open')) open++;
    if (p.answerSpec.value === 'DNE') dne++;
    if (String(p.answerSpec.value).includes('∞')) inf++;
    assert.match(p.task, /neexistuje/);
  }
  assert.ok(open > 50, `prázdných bodů ${open}`);
  assert.ok(dne > 10 && dne < 120, `neexistuje ${dne}`);
  assert.ok(inf > 10, `nekonečno ${inf}`);
});

// Kontroly proti materiálům z Moodlu jsou jen v content/ (mimo git):
// content/problems/limita-checks.json = [{ id, input, expect? }]
test('limita: kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/limita-checks.json', import.meta.url));
  const raw = fixedProblemsFile('limita');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/limita-checks.json chybí'); return; }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const rawP = raw.find((x) => x.id === c.id);
    assert.ok(rawP, c.id);
    const p = type(rawP.type).solve(rawP.data);
    const r = check(p.answerSpec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', JSON.stringify(c));
    else assert.equal(r.ok, true, `${JSON.stringify(c)} -> ${JSON.stringify(p.answerSpec)}`);
  }
});

test('z-grafu: graf je i u zadání (promptViz) se stejnými větvemi jako vzorec v zadání', () => {
  for (let s = 1; s <= 100; s++) {
    const p = type('z-grafu').generate(makeRng(s));
    const pv = p.promptViz;
    assert.ok(pv, `seed ${s}: chybí promptViz`);
    assert.equal(pv.kind, 'plot');
    assert.deepEqual(pv, p.solution[0].viz, 'stejný graf jako v prvním kroku');
    const [Lp, Rp] = p.data.pieces;
    const exprs = pv.data.functions.map((f) => f.expr).join(' | ');
    for (const piece of [Lp, Rp]) {
      assert.ok(exprs.includes(piece.expr), `seed ${s}: graf nemá větev ${piece.expr}`);
      assert.ok(p.promptTex.includes(piece.tex), `seed ${s}: zadání nemá větev ${piece.tex}`);
    }
  }
});
