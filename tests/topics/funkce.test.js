import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import funkce from '../../js/topics/funkce.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';
import { hydrateProblems } from '../../js/content.js';

// Nezávislé výpočty (žádné pomůcky generátoru):
//  - definiční obory: přímé číselné vyhodnocení podmínek předpisu v bodech osy, hledání hranic
//    půlením a kořenů jmenovatelů přes math.polynomialRoot; z toho se složí množina,
//  - parita: math.js vyhodnotí f(x) a f(−x) v náhodných bodech,
//  - inverzní funkce: vlastní odvození v jiném tvaru + kontrola f(f⁻¹(x)) = x přes math.js,
//  - obor hodnot: intervalová aritmetika v testu + kontrola hodnot vzorkováním přes math.js.
const EPS = 1e-12;
const peval = (c, x) => c.reduce((s, a) => s * x + a, 0);
const roots = (c) => {
  const r = math.polynomialRoot(...[...c].reverse());
  return r.filter((z) => typeof z === 'number' || Math.abs(z.im) < 1e-4).map((z) => (typeof z === 'number' ? z : z.re))
    .map((x) => { const s = snap(x, 1e-4); return Math.abs(peval(c, s)) < 1e-9 ? s : x; });
};

function partOk(p, x) {
  const P = p.poly ? peval(p.poly, x) : 0;
  switch (p.k) {
    case 'frac': case 'cbrtDen': return true; // nulové body jmenovatele hlídá seznam pólů
    case 'sqrt': return (p.n || 2) % 2 === 1 || P >= -EPS;
    case 'sqrtDen': return P > EPS;
    case 'ln': return P > EPS;
    case 'lnDen': return P > EPS;
    case 'sqrtQuot': { const d = peval(p.den, x); return d !== 0 && peval(p.num, x) / d >= -EPS; }
    case 'lnQuot': { const d = peval(p.den, x); return d !== 0 && peval(p.num, x) / d > EPS; }
    case 'asin': return Math.abs(peval(p.lin, x) / p.c) <= 1 + EPS;
    case 'cbrt': return true;
    default: throw new Error(p.k);
  }
}
function partPoles(p) {
  if (p.k === 'frac' || p.k === 'cbrtDen') return roots(p.poly);
  if (p.k === 'lnDen') return roots([p.poly[0], p.poly[1] - 1]);
  if (p.k === 'sqrtQuot' || p.k === 'lnQuot') return roots(p.den);
  return [];
}
function snap(x, tol = 1e-7) {
  for (let d = 1; d <= 12; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < tol) return n / d; }
  const k = Math.round(x / (Math.PI / 2));
  if (Math.abs(k * Math.PI / 2 - x) < 1e-7) return k * Math.PI / 2;
  return x;
}
// množina {x : ok(x)} jako textový zápis intervalů s desetinnými čísly
function numericDomain(ok, poles) {
  const L = 20; const h = 1 / 64;
  const pts = [...poles];
  let prev = ok(-L);
  for (let x = -L + h; x <= L; x += h) {
    const cur = ok(x);
    if (cur !== prev) {
      let a = x - h; let b = x;
      for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (ok(m) === prev) a = m; else b = m; }
      pts.push((a + b) / 2);
    }
    prev = cur;
  }
  // dva body těsně u sebe (množina z jediného čísla, např. −(x−3)² ≥ 0) splynou v jeden
  const sorted = [...pts].sort((a, b) => a - b);
  const merged = [];
  for (const v of sorted) {
    if (merged.length && v - merged[merged.length - 1].at(-1) < 1e-4) merged[merged.length - 1].push(v); else merged.push([v]);
  }
  const P = [...new Set(merged.map((g) => snap(g.reduce((a, b) => a + b, 0) / g.length)).map((v) => Number(v.toPrecision(14))))].filter((v) => Math.abs(v) < L).sort((a, b) => a - b);
  const pieces = []; // [lo, hi, lc, hc]
  const bounds = [-Infinity, ...P, Infinity];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const lo = bounds[i]; const hi = bounds[i + 1];
    const mid = !Number.isFinite(lo) && !Number.isFinite(hi) ? 0 : !Number.isFinite(lo) ? hi - 1 : !Number.isFinite(hi) ? lo + 1 : (lo + hi) / 2;
    if (ok(mid)) pieces.push([lo, hi, false, false]);
    if (i + 1 < bounds.length - 1 && ok(hi)) pieces.push([hi, hi, true, true]);
  }
  // sloučení
  const out = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last && last[1] === p[0] && (last[3] || p[2])) { last[1] = p[1]; last[3] = p[3]; if (p[0] === p[1]) last[3] = true; } else out.push([...p]);
  }
  const num = (v) => (v === Infinity ? '∞' : v === -Infinity ? '-∞' : String(v));
  return out.map(([lo, hi, lc, hc]) => (lo === hi ? `{${num(lo)}}` : `${lc ? '<' : '('}${num(lo)}; ${num(hi)}${hc ? '>' : ')'}`)).join(' ∪ ');
}
function domainOracle(d) {
  const poles = d.parts.flatMap(partPoles);
  return numericDomain((x) => poles.every((q) => Math.abs(x - q) > 1e-9) && d.parts.every((p) => partOk(p, x)), poles);
}
function gonioOracle(d) {
  const ok = (x) => {
    const q = d.r * d.r - x * x;
    if (d.rad === 'sqrt' ? q < -EPS : q <= EPS) return false;
    if (d.g === 'tg') return Math.abs(Math.cos(x)) > 1e-12;
    if (d.g === 'cotg') return Math.abs(Math.sin(x)) > 1e-12;
    if (d.g === 'sqrtsin') return Math.sin(x) >= -1e-12;
    return Math.cos(x) >= -1e-12;
  };
  const poles = [];
  for (let k = -12; k <= 12; k++) {
    const x = k * Math.PI / 2;
    if ((d.g === 'tg' && k % 2 !== 0) || (d.g === 'cotg' && k % 2 === 0)) poles.push(x);
  }
  return numericDomain(ok, poles);
}

// ---------- parita ----------
const G = { one: '1', sin: 'sin(x)', cos: 'cos(x)', tg: 'tan(x)', cotg: 'cot(x)', abs: 'abs(x)', exp: 'exp(x)', expm: 'exp(-x)' };
function parityExpr(d) {
  if (d.kind === 'root') return `sqrt(x+(${d.a}))`;
  if (d.kind === 'logq') return d.inv ? `log((${d.a}+x)/(${d.a}-x))` : `log((${d.a}-x)/(${d.a}+x))`;
  const s = (ts) => ts.map((t) => `(${t.c})*x^${t.n}*${G[t.g]}`).join('+');
  return d.den ? `(${s(d.num)})/(${s(d.den)})` : s(d.num);
}
function parityOracle(d) {
  const f = math.compile(parityExpr(d));
  const val = (x) => { const v = f.evaluate({ x }); return typeof v === 'number' && Number.isFinite(v) ? v : null; };
  const rng = makeRng(99);
  let even = true; let odd = true; let n = 0;
  for (let i = 0; i < 200; i++) {
    const x = 0.05 + rng() * 4.5;
    const a = val(x); const b = val(-x);
    if ((a === null) !== (b === null)) return 0; // nesouměrný obor
    if (a === null) continue;
    n++;
    if (Math.abs(b - a) > 1e-7 * Math.max(1, Math.abs(a))) even = false;
    if (Math.abs(b + a) > 1e-7 * Math.max(1, Math.abs(a))) odd = false;
  }
  assert.ok(n > 10, 'parita: málo bodů');
  return even ? 1 : odd ? -1 : 0;
}

// ---------- inverzní funkce ----------
function fExprInv(d) {
  switch (d.kind) {
    case 'lin': return [`${d.a}*x+(${d.b})`, `x/(${d.a})-(${d.b})/(${d.a})`];
    case 'mob': return [`(${d.a}*x+(${d.b}))/(${d.c}*x+(${d.d}))`, `(${d.d}*x-(${d.b}))/(${-d.c}*x+(${d.a}))`];
    case 'exp': return [`${d.k}*exp(x+(${d.m}))+(${d.n})`, d.k > 0 ? `log(x-(${d.n}))-log(${d.k})-(${d.m})` : `log((${d.n})-x)-log(${-d.k})-(${d.m})`];
    case 'ln': return [`${d.a}*log(x+(${d.m}))+(${d.n})`, `exp(x/(${d.a})-(${d.n})/(${d.a}))-(${d.m})`];
    case 'sqrt': return [`(${d.n})+(${d.s})*sqrt(x+(${d.m}))`, `x^2-2*(${d.n})*x+(${d.n})^2-(${d.m})`];
    default: throw new Error(d.kind);
  }
}
function inverseOracle(d) {
  const [fs, gs] = fExprInv(d);
  const f = math.compile(fs); const g = math.compile(gs);
  let n = 0;
  for (let i = -40; i <= 40; i++) {
    const x = i / 7 + 0.013;
    let y; try { y = g.evaluate({ x }); } catch { continue; }
    if (typeof y !== 'number' || !Number.isFinite(y)) continue;
    // jen x z oboru hodnot f: tam f(g(x)) musí dát x
    if (d.kind === 'sqrt' && d.s * (x - d.n) < 0) continue;
    const back = f.evaluate({ x: y });
    if (typeof back !== 'number') continue;
    assert.ok(Math.abs(back - x) < 1e-7, `f(f⁻¹(${x})) = ${back}`);
    n++;
  }
  assert.ok(n > 5, 'inverzní: málo bodů');
  return gs;
}

// ---------- obor hodnot ----------
const BASEH = {
  sq: [0, Infinity, true, false], sqrt: [0, Infinity, true, false], exp: [0, Infinity, false, false], ln: [-Infinity, Infinity, false, false],
  sin: [-1, 1, true, true], cos: [-1, 1, true, true], arctg: [-Math.PI / 2, Math.PI / 2, false, false],
  arcsin: [-Math.PI / 2, Math.PI / 2, true, true], arccos: [0, Math.PI, true, true],
};
const MJ = { sq: 'X^2', sqrt: 'sqrt(X)', exp: 'exp(X)', ln: 'log(X)', sin: 'sin(X)', cos: 'cos(X)', arctg: 'atan(X)', arcsin: 'asin(X)', arccos: 'acos(X)' };
function rangeOracle(d) {
  let [lo, hi, lc, hc] = BASEH[d.g];
  if (d.a < 0) [lo, hi, lc, hc] = [hi * d.a, lo * d.a, hc, lc]; else [lo, hi] = [lo * d.a, hi * d.a];
  lo += d.n; hi += d.n;
  const f = math.compile(`${d.a}*${MJ[d.g].replace('X', `(x-(${d.m}))`)}+(${d.n})`);
  for (let i = -800; i <= 800; i++) {
    const v = f.evaluate({ x: d.m + i / 80 });
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    assert.ok(v >= lo - 1e-9 && v <= hi + 1e-9, `hodnota ${v} mimo obor`);
  }
  const num = (v) => (v === Infinity ? '∞' : v === -Infinity ? '-∞' : String(v));
  return `${lc ? '<' : '('}${num(lo)}; ${num(hi)}${hc ? '>' : ')'}`;
}

const oracles = {
  'obor-zlomek': domainOracle, 'obor-odmocnina': domainOracle, 'obor-podil': domainOracle,
  'obor-arcsin': domainOracle, 'obor-kombinace': domainOracle, 'obor-goniometricke': gonioOracle,
  parita: parityOracle, inverzni: inverseOracle, 'obor-hodnot': rangeOracle,
};
const type = (id) => funkce.types.find((t) => t.id === id);

// Pevné příklady z content/ ověřuje test níže (verify() z helperu vyžaduje u každého pevného příkladu
// data a oracle, což neplatí pro příklady zadané jen zadáním a výsledkem), proto tady jen generované.
const generated = { ...funkce, id: 'funkce-generovane', types: funkce.types.filter((t) => t.id !== 'nacrt-graf') };

test('funkce: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(generated, 200, { oracles });
  assert.ok(r.generated >= 200 * 9);
});

// Náčrt grafu je na tabuli (sebehodnocení), auto-kontrola odpovědi tu není. Ověříme postup a to, že
// graf na posledním kroku odpovídá zadání (math.js, nezávislý zápis základních funkcí).
test('náčrt grafu: tabule, postup po transformacích a výsledný graf odpovídá předpisu', () => {
  const T = type('nacrt-graf');
  const F = { sq: (u) => u * u, sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, sin: Math.sin, cos: Math.cos, arctg: Math.atan, arcsin: Math.asin, arccos: Math.acos };
  for (let seed = 1; seed <= 200; seed++) {
    const p = T.generate(makeRng(seed));
    const { g, a, m, n } = p.data;
    assert.equal(p.answerSpec.kind, 'whiteboard');
    assert.match(p.task, /Ukaž výsledek/);
    assert.ok(p.solution.length >= 3);
    for (const s of p.solution) { assert.ok(s.text.length > 10); assert.ok(s.board.length > 0); }
    const last = p.solution.at(-1);
    assert.equal(last.viz.kind, 'plot');
    const f = math.compile(last.viz.data.functions[0].expr);
    let seen = 0;
    for (let i = 1; i <= 40; i++) {
      const x = m + (i - 20.5) / 8;
      const y = F[g](x - m);
      const v = f.evaluate({ x });
      if (!Number.isFinite(y) || typeof v !== 'number' || !Number.isFinite(v)) continue;
      assert.ok(Math.abs(v - (a * y + n)) < 1e-9, `${p.promptTex} v ${x}`);
      seen++;
    }
    assert.ok(seen > 3, p.promptTex);
  }
  const q = T.solve({ g: 'sin', a: 2, m: 0, n: 0 });
  assert.equal(q.promptTex, String.raw`f(x)=2\sin(x)`);
});

test('funkce: téma je v seznamu, typy mají solve, výklad pokrývá pojmy a časté chyby', () => {
  assert.equal(funkce.id, 'funkce');
  assert.equal(funkce.title, 'Funkce a její vlastnosti');
  assert.equal(funkce.order, 5);
  assert.ok(topics.includes(funkce));
  for (const t of funkce.types) assert.equal(typeof t.solve, 'function', t.id);
  const all = funkce.theory.map((s) => `${s.heading} ${s.text}`).join(' ').toLowerCase();
  for (const w of ['definiční obor', 'obor hodnot', 'sudá', 'lichá', 'inverzní', 'prostá', 'rostoucí', 'ohraničen', 'periodick', 'exponenciál', 'logaritm', 'sinus', 'arkussinus', 'posun', 'tabulk']) {
    assert.ok(all.includes(w), w);
  }
  assert.ok(funkce.theory.every((s) => Array.isArray(s.mistakes) && s.mistakes.length > 0));
});

test('definiční obor: tabulka znamének u kvadratické nerovnice a průnik u více podmínek', () => {
  const p = type('obor-odmocnina').solve({ parts: [{ k: 'sqrt', poly: [-1, 2, 8] }] }); // 8 + 2x − x² ≥ 0
  assert.equal(check(p.answerSpec, '<-2; 4>').ok, true);
  assert.equal(check(p.answerSpec, '[-2, 4]').ok, true);
  assert.equal(check(p.answerSpec, '(-2; 4)').reason, 'wrong');
  assert.ok(p.solution.some((s) => s.viz?.kind === 'signchart'));
  assert.ok(p.solution.some((s) => s.board.some((l) => /bt-krat/.test(l.tex))), 'násobení −1 je vidět');
  const q = type('obor-kombinace').solve({ parts: [{ k: 'sqrt', poly: [1, 1] }, { k: 'lnDen', poly: [-1, 4] }] }); // √(x+1) + 1/ln(4−x)
  assert.equal(check(q.answerSpec, '<-1; 3) ∪ (3; 4)').ok, true);
  assert.equal(q.solution[q.solution.length - 1].viz.kind, 'signchart');
  const pt = type('obor-odmocnina').solve({ parts: [{ k: 'sqrt', poly: [-1, 4, -4] }] }); // −(x−2)² ≥ 0
  assert.equal(check(pt.answerSpec, '{2}').ok, true);
  const r = type('obor-zlomek').solve({ parts: [{ k: 'frac', num: [1], poly: [1, -1, -4, 4] }] }); // seskupení
  assert.equal(check(r.answerSpec, '(-inf; -2) U (-2; 1) U (1; 2) U (2; inf)').ok, true);
  assert.ok(r.solution[1].board.some((l) => /x\^2\(x-1\)/.test(l.tex)), 'seskupení je na tabuli');
});

test('definiční obor s goniometrickou funkcí: π v odpovědi', () => {
  const p = type('obor-goniometricke').solve({ r: 5, rad: 'sqrt', g: 'tg' });
  assert.equal(check(p.answerSpec, '<-5; -3pi/2) ∪ (-3pi/2; -pi/2) ∪ (-pi/2; pi/2) ∪ (pi/2; 3pi/2) ∪ (3pi/2; 5>').ok, true);
  const q = type('obor-goniometricke').solve({ r: 4, rad: 'sqrtDen', g: 'sqrtsin' });
  assert.equal(check(q.answerSpec, '(-4; -π> ∪ <0; π>').ok, true);
  assert.match(q.task, /pi/);
});

test('parita: odpověď číslem a f(−x) na tabuli', () => {
  const T = (c, n, g = 'one') => ({ c, n, g });
  const odd = type('parita').solve({ kind: 'sum', num: [T(1, 3), T(-2, 1)], den: [T(1, 2), T(3, 0)] });
  assert.equal(check(odd.answerSpec, '-1').ok, true);
  assert.equal(odd.answerSpec.value, -1);
  assert.ok(odd.solution.some((s) => s.board.some((l) => l.tex.includes('(-x)^3'))));
  assert.match(odd.task, /1 = sudá/);
  const even = type('parita').solve({ kind: 'sum', num: [T(1, 0, 'sin')], den: [T(1, 1)] });
  assert.equal(even.answerSpec.value, 1);
  const none = type('parita').solve({ kind: 'sum', num: [T(1, 2), T(1, 1)] });
  assert.equal(none.answerSpec.value, 0);
  assert.ok(none.solution.some((s) => s.board.some((l) => /f\(1\)/.test(l.tex))), 'protipříklad');
  const asym = type('parita').solve({ kind: 'sum', num: [T(1, 2)], den: [T(1, 1), T(-3, 0)] });
  assert.equal(asym.answerSpec.value, 0);
  assert.equal(type('parita').solve({ kind: 'root', a: 2 }).answerSpec.value, 0);
  assert.equal(type('parita').solve({ kind: 'logq', a: 3 }).answerSpec.value, -1);
});

test('inverzní funkce: vzájemně ekvivalentní zápisy a graf se souměrností', () => {
  const p = type('inverzni').solve({ kind: 'lin', a: 3, b: -6 });
  assert.equal(check(p.answerSpec, '(x+6)/3').ok, true);
  assert.equal(check(p.answerSpec, 'x/3+2').ok, true);
  assert.equal(check(p.answerSpec, '3x-6').reason, 'wrong');
  const q = type('inverzni').solve({ kind: 'sqrt', s: 1, m: 1, n: 2 }); // 2 + √(x+1)
  assert.equal(check(q.answerSpec, '(x-2)^2-1').ok, true);
  const e = type('inverzni').solve({ kind: 'exp', k: 2, m: 0, n: 1 }); // 2e^x + 1
  assert.equal(check(e.answerSpec, 'log((x-1)/2)').ok, true);
  const last = p.solution[p.solution.length - 1];
  assert.equal(last.viz.kind, 'plot');
  assert.deepEqual(last.viz.data.lines[0], { k: 1, q: 0, label: 'y = x' });
  for (let seed = 1; seed <= 100; seed++) {
    const g = type('inverzni').generate(makeRng(seed));
    assert.ok(!/\\frac\{[^{}]*\}\{-/.test(g.answerTex), g.answerTex);
  }
});

test('obor hodnot: transformace s π a překlopení', () => {
  const p = type('obor-hodnot').solve({ g: 'arctg', a: -2, m: 1, n: 3 });
  assert.equal(check(p.answerSpec, '(3-pi; 3+pi)').ok, true);
  const q = type('obor-hodnot').solve({ g: 'sq', a: -2, m: 1, n: 3 });
  assert.equal(check(q.answerSpec, '(-inf; 3>').ok, true);
  assert.ok(q.solution.filter((s) => s.viz?.kind === 'plot').length >= 2);
});

test('funkce: generátory dávají pestrá zadání (různé druhy podmínek)', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 200; seed++) for (const p of type('obor-kombinace').generate(makeRng(seed)).data.parts) kinds.add(p.k);
  for (const k of ['sqrt', 'sqrtDen', 'ln', 'lnDen', 'frac', 'cbrtDen']) assert.ok(kinds.has(k), k);
  const par = new Map();
  for (let seed = 1; seed <= 200; seed++) { const v = type('parita').generate(makeRng(seed)).answerSpec.value; par.set(v, (par.get(v) || 0) + 1); }
  for (const v of [1, -1, 0]) assert.ok((par.get(v) || 0) > 25, `parita ${v}: ${par.get(v)}`);
});

// Kontroly proti příkladům z Moodlu jsou jen v content/ (není v gitu):
//  content/problems/funkce.json = pevné příklady (typ + data, nebo zadání a výsledek přímo),
//  content/problems/funkce-checks.json = [{ id, input, expect? }] – výsledky z klíčů ve sbírkách
//  (expect: 'wrong' = klíč v materiálu je chybný nebo jen zaokrouhlený, uložený výsledek se s ním nesmí shodovat).
// check() u výrazů vzorkuje náhodné body z pevných rozsahů; u funkce definované jen na malé části
// (např. arccos e^x pro x ≤ 0) může sebrat méně než 3 platné body a správný výsledek odmítnout.
// Proto se správná odpověď zkouší opakovaně (viz „Shared issues“ ve zprávě).
const okAny = (spec, input) => { let r; for (let i = 0; i < 12; i++) { r = check(spec, input); if (r.ok) return r; } return r; };

test('funkce: pevné příklady a kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/funkce-checks.json', import.meta.url));
  const raw = fixedProblemsFile('funkce');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/funkce*.json chybí'); return; }
  const fixed = hydrateProblems(funkce, raw);
  assert.ok(fixed.length >= 100, `načteno jen ${fixed.length} pevných příkladů`);
  for (const p of fixed) {
    assert.ok(p.source, `${p.id}: chybí zdroj`);
    assert.ok(p.answerTex, `${p.id}: chybí answerTex`);
    if (p.answerSpec.kind === 'whiteboard') continue; // sebehodnocení, nic se nekontroluje automaticky
    if (p.data) checkProblem(p, oracles, `pevný ${p.id}`);
    else if (p.answerSpec.kind !== 'whiteboard') {
      const r = okAny(p.answerSpec, typeof p.answerSpec.value === 'number' ? String(p.answerSpec.value) : p.answerSpec.value);
      assert.equal(r.ok, true, `${p.id}: ${JSON.stringify(p.answerSpec)} -> ${JSON.stringify(r)}`);
    }
  }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const p = fixed.find((x) => x.id === c.id);
    assert.ok(p, JSON.stringify(c));
    const r = c.expect === 'wrong' ? check(p.answerSpec, c.input) : okAny(p.answerSpec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', `${c.id} ${JSON.stringify(c.input)}`);
    else assert.equal(r.ok, true, `${c.id}: ${JSON.stringify(c.input)} -> ${JSON.stringify(p.answerSpec)} ${JSON.stringify(r)}`);
  }
});

test('definiční obor: kubika s celočíselným kořenem se rozloží a zapíše na tabuli', () => {
  const p = type('obor-zlomek').solve({ parts: [{ k: 'frac', num: [1], poly: [1, 3, -6, -8] }] }); // x³ + 3x² − 6x − 8 = (x+1)(x−2)(x+4)
  assert.equal(p.answerSpec.value, '(-∞; -4) ∪ (-4; -1) ∪ (-1; 2) ∪ (2; ∞)');
  const lines = p.solution.flatMap((s) => s.board.map((l) => l.tex));
  assert.ok(lines.some((t) => /\(x\+1\)\(x\^2\+2x-8\)/.test(t)), 'vydělení kořenem je vidět');
  assert.ok(lines.some((t) => /\(x\+4\)\(x\+1\)\(x-2\)/.test(t)), 'úplný rozklad je vidět');
  const q = type('obor-odmocnina').solve({ parts: [{ k: 'sqrt', poly: [-1, 0, 0, 8] }] }); // 8 − x³ ≥ 0
  assert.equal(q.answerSpec.value, '(-∞; 2>');
  assert.ok(q.solution.flatMap((s) => s.board.map((l) => l.tex)).some((t) => /\(x-2\)\(x\^2\+2x\+4\)/.test(t)), 'kvadratický činitel bez kořenů je v součinu');
  assert.ok(q.solution.some((s) => /stále kladný/.test(s.text)));
});

test('interval: ekvivalentní zápisy téže množiny se uznají, jiná množina ne', () => {
  const spec = { kind: 'interval', value: '(-∞; -2) ∪ (-2; 1) ∪ (1; 3> ∪ <5; ∞)' };
  for (const ok of [
    '(-inf; -2) U (-2; 1) U (1; 3> U <5; inf)',
    '(-∞, -2) ∪ (-2, 1) ∪ (1, 3] ∪ [5, ∞)',
    '<5; inf) ∪ (1; 3> ∪ (-2; 1) ∪ (-inf; -2)',
    '(-∞;-2)∪(-2;1)∪(1;2)∪<2;3>∪<5;∞)', // 3 = (1; 2) ∪ <2; 3> spojeno
  ]) assert.equal(check(spec, ok).ok, true, ok);
  for (const bad of [
    '(-∞; -2) ∪ (-2; 1) ∪ (1; 3) ∪ <5; ∞)', // chybí 3
    '(-∞; -2) ∪ (-2; 1) ∪ (1; 3> ∪ (5; ∞)', // 5 nepatří
    '(-∞; -2> ∪ (-2; 1) ∪ (1; 3> ∪ <5; ∞)', // −2 patří
    '(-∞; ∞)',
    '(-∞; -2) ∪ (1; 3> ∪ <5; ∞)', // chybí (−2; 1)
  ]) assert.equal(check(spec, bad).reason, 'wrong', bad);
  assert.equal(check(spec, '(-∞; -2').reason, 'syntax');
});

test('goniometrický obor: dost různých zadání; parita bez záporných jmenovatelů v závorce', () => {
  const g = type('obor-goniometricke');
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) seen.add(JSON.stringify(g.generate(makeRng(seed)).data));
  assert.ok(seen.size >= 55, `jen ${seen.size} různých zadání`);
  const par = type('parita');
  for (let seed = 1; seed <= 200; seed++) {
    const p = par.generate(makeRng(seed));
    for (const s of p.solution) for (const l of s.board) assert.doesNotMatch(l.tex, /\}\{\(-(?!x\))/,'jmenovatel nezačíná minusem v závorce');
  }
});
