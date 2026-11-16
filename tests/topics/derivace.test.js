import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import derivace from '../../js/topics/derivace.js';
import { topics } from '../../js/topics/index.js';
import { verify, fixedProblemsFile, checkProblem } from '../helpers/verify.js';
import { hydrateProblems } from '../../js/content.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

// Nezávislé výpočty: math.derivative (symbolické derivování v math.js) a číselné hledání
// nulových bodů, pólů a limit – jiný postup než přesný počítač v js/topics/derivace-lib.js.

// ---------- převod dat na výraz math.js (vlastní, nezávislý) ----------
const q = (v) => (typeof v === 'string' ? `(${v})` : `(${v ?? 0})`);
function termExpr(t) {
  const parts = [q(t.c ?? 1)];
  if (t.p !== undefined && t.p !== 0 && t.p !== '0') parts.push(`x^${q(t.p)}`);
  if (t.E) parts.push(`exp(${t.E}*x)`);
  if (t.S) parts.push(`sin(x)^${t.S}`);
  if (t.C) parts.push(`cos(x)^${t.C}`);
  if (t.L) parts.push(`log(x)^${t.L}`);
  return parts.join('*');
}
const sumExpr = (ts) => ts.map((t) => `(${termExpr(t)})`).join('+');
const deriv = (expr) => math.derivative(expr, 'x').toString();
const evalAt = (expr, x) => math.evaluate(expr, { x });
const num = (v) => (typeof v === 'string' ? math.evaluate(v) : v);

const OUTER = {
  pow: (i, n) => `(${i})^${n}`, sqrt: (i) => `sqrt(${i})`, exp: (i) => `exp(${i})`,
  ln: (i) => `log(${i})`, sin: (i) => `sin(${i})`, cos: (i) => `cos(${i})`,
  tan: (i) => `tan(${i})`, atan: (i) => `atan(${i})`, asin: (i) => `asin(${i})`, acos: (i) => `acos(${i})`, acot: (i) => `acot(${i})`,
  apow: (i, n) => `${n}^(${i})`, log: (i, n) => `log(${i}, ${n})`,
};

// Zlomek s malým jmenovatelem nebo nekonečno (výsledek limity jako text).
function roundLimit(v) {
  if (!Number.isFinite(v) || Math.abs(v) > 1e6) return v > 0 ? '∞' : '-∞';
  for (let d = 1; d <= 60; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-5) return `${n}/${d}`;
  }
  throw new Error(`limita ${v} není hezké číslo`);
}
const twoSided = (expr, x0) => {
  const h = 1e-4;
  return (evalAt(expr, x0 + h) + evalAt(expr, x0 - h)) / 2;
};

// ---------- průběh funkce: vlastní předpisy rodin a číselná analýza ----------
function famExpr(d) {
  switch (d.fam) {
    case 'P1': return `${d.s}*(x^3-3*(${d.b})*x^2)`;
    case 'P2': return `${d.s}*x*(x-3*(${d.b}))^2`;
    case 'P3': return `x^3*(x-4*(${d.b}))`;
    case 'R1': return `(x^2+((${d.m})^2-(${d.d})^2))/(x-(${d.d}))`;
    case 'R2': return `(${d.k})*x/(x^2+(${d.m})^2)`;
    case 'R3': return `(${d.k})*x^2/(x^2-(${d.m})^2)`;
    case 'E1': return `(x-(${d.b}))*exp((${d.s})*x)`;
    default: throw new Error(d.fam);
  }
}
function bisect(g, a, b) {
  let ga = g(a);
  for (let i = 0; i < 200 && b - a > 1e-13; i++) {
    const m = (a + b) / 2; const gm = g(m);
    if (Math.sign(gm) === Math.sign(ga)) { a = m; ga = gm; } else b = m;
  }
  return (a + b) / 2;
}
function signChanges(g, lo = -25, hi = 25, step = 0.02) {
  const out = [];
  let x0 = lo + 0.00123; let s0 = Math.sign(g(x0));
  for (let x = x0 + step; x < hi; x += step) {
    const s = Math.sign(g(x));
    if (s && s0 && s !== s0) out.push(bisect(g, x - step, x));
    if (s) s0 = s;
    x0 = x;
  }
  return out;
}
const analyse = (d) => analyseExpr(famExpr(d));
const real = (v) => (typeof v === 'number' ? v : NaN);
function analyseExpr(fe) {
  const f = math.compile(fe);
  const d1 = math.compile(deriv(fe));
  const d2 = math.compile(deriv(deriv(fe)));
  const F = (x) => real(f.evaluate({ x }));
  const D1 = (x) => real(d1.evaluate({ x }));
  const D2 = (x) => real(d2.evaluate({ x }));
  // póly se změnou znaménka i sudé póly (např. 1/x^2): lokální maximum |f| nad prahem, zpřesněné půlením
  const peaks = [];
  for (let x = -25 + 0.00123; x < 25; x += 0.02) {
    const v = Math.abs(F(x));
    if (v > 5e3 && v >= Math.abs(F(x - 0.02)) && v >= Math.abs(F(x + 0.02))) {
      let lo = x - 0.02; let hi = x + 0.02;
      for (let i = 0; i < 200; i++) {
        const m1 = lo + (hi - lo) / 3; const m2 = hi - (hi - lo) / 3;
        if (Math.abs(F(m1)) < Math.abs(F(m2))) lo = m1; else hi = m2;
      }
      const xp = (lo + hi) / 2;
      if (Math.abs(F(xp)) > 1e8) peaks.push(xp);
    }
  }
  // okraje definičního oboru (reálná hodnota ↔ NaN)
  const edges = [];
  for (let x = -25 + 0.00123; x < 25; x += 0.02) {
    if (Number.isNaN(F(x)) !== Number.isNaN(F(x + 0.02))) {
      let lo = x; let hi = x + 0.02; const nanLo = Number.isNaN(F(lo));
      for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (Number.isNaN(F(m)) === nanLo) lo = m; else hi = m; }
      edges.push((lo + hi) / 2);
    }
  }
  const poles = [...edges, ...signChanges(F).filter((x) => Math.abs(F(x)) > 1e5), ...peaks.filter((x) => !signChanges(F).some((y) => Math.abs(y - x) < 1e-3))];
  const near = (x, list) => list.some((p) => Math.abs(p - x) < 1e-6);
  const c1 = signChanges(D1);
  const c2 = signChanges(D2);
  const extrema = c1.filter((x) => !near(x, poles));
  const infl = c2.filter((x) => !near(x, poles));
  const where = (g, pts) => {
    const all = [...new Set([...pts].map((x) => Math.round(x * 1e9) / 1e9))].sort((a, b) => a - b);
    const ends = [-Infinity, ...all, Infinity];
    const segs = [];
    for (let i = 0; i + 1 < ends.length; i++) {
      const a = ends[i]; const b = ends[i + 1];
      const mid = !Number.isFinite(a) && !Number.isFinite(b) ? 0 : !Number.isFinite(a) ? b - 1 : !Number.isFinite(b) ? a + 1 : (a + b) / 2;
      if (g(mid) > 0 && !Number.isNaN(F(mid))) {
        const last = segs[segs.length - 1];
        if (last && last[1] === a && !near(a, poles)) last[1] = b; else segs.push([a, b]);
      }
    }
    const fmt = (v) => (v === -Infinity ? '-∞' : v === Infinity ? '∞' : String(v));
    return segs.map(([a, b]) => `(${fmt(a)}; ${fmt(b)})`).join(' ∪ ');
  };
  const exact = (xs) => xs.map((x) => {
    // dorovnání na přesnou hodnotu (celé číslo nebo násobek odmocniny ze 3)
    const r = Math.round(x);
    if (Math.abs(r - x) < 1e-7) return r;
    const s = Math.round(x / Math.sqrt(3));
    return Math.abs(s * Math.sqrt(3) - x) < 1e-7 ? s * Math.sqrt(3) : x;
  });
  const P = exact(poles); const E = exact(extrema); const I = exact(infl);
  return {
    increasing: where(D1, [...exact(c1), ...P]),
    convex: where(D2, [...exact(c2), ...P]),
    extrema: E, infl: I, poles: P,
  };
}

function asymExpr(d) {
  return d.fam === 'A'
    ? `((${d.a})*x^2+(${d.b})*x+(${d.c}))/(x-(${d.d}))`
    : `((${d.a})*x^3+(${d.b})*x^2+(${d.c})*x+(${d.e}))/(x^2+(${d.g}))`;
}

const oracles = {
  logder: (d) => deriv(`(${sumExpr(d.u)})^(${sumExpr(d.v)})`),
  mocniny: (d) => deriv(`(${sumExpr(d.terms)})/x^${q(d.den ?? 0)}`),
  soucin: (d) => deriv(`(${sumExpr(d.u)})*(${sumExpr(d.v)})`),
  podil: (d) => deriv(`(${sumExpr(d.u)})/(${sumExpr(d.v)})`),
  slozena: (d) => deriv(OUTER[d.outer](sumExpr(d.inner), d.n)),
  druha: (d) => evalAt(deriv(deriv(sumExpr(d.terms))), num(d.x0)),
  tecna: (d) => {
    const fe = sumExpr(d.terms); const x0 = num(d.x0);
    const k = evalAt(deriv(fe), x0); const y0 = evalAt(fe, x0);
    return `${k}*x+(${y0 - k * x0})`;
  },
  normala: (d) => {
    const fe = sumExpr(d.terms); const x0 = num(d.x0);
    const k = -1 / evalAt(deriv(fe), x0); const y0 = evalAt(fe, x0);
    return `${k}*x+(${y0 - k * x0})`;
  },
  lhospital: (d) => roundLimit(bigLimit(`(${sumExpr(d.N)})/(${sumExpr(d.D)})`, num(d.x0))),
  'lhospital-nekonecno': (d) => {
    const e = `(${sumExpr(d.N)})/(${sumExpr(d.D)})`;
    const big = [...d.N, ...d.D].some((t) => t.E) ? 60 : 1e30;
    return roundLimit(evalAt(e, big));
  },
  'lhospital-upravy': (d) => {
    if (d.form === 'soucin') return roundLimit(evalAt(`(${d.c})*x^(${d.n})*log(x)`, 1e-40));
    const e = d.kind === 'exp' ? `${d.a}/x-${d.a * d.k}/(exp(${d.k}*x)-1)`
      : d.kind === 'sin' ? `${d.a}/x-${d.a}/sin(x)` : `${d.a}/log(x)-${d.a}/(x-1)`;
    return roundLimit(twoSided(e, d.kind === 'ln' ? 1 : 0));
  },
  monotonie: (d) => analyse(d).increasing,
  extremy: (d) => analyse(d).extrema.join('; '),
  konvexnost: (d) => analyse(d).convex,
  asymptoty: (d) => {
    const f = math.compile(asymExpr(d));
    const X = 1e7;
    const k = Math.round((f.evaluate({ x: 2 * X }) - f.evaluate({ x: X })) / X * 6) / 6;
    const qq = Math.round((f.evaluate({ x: X }) - k * X) * 6) / 6;
    return `${k}*x+(${qq})`;
  },
};

const type = (id) => derivace.types.find((t) => t.id === id);
// 'prubeh' je sebehodnocený (whiteboard) a 'extremy' má odpověď typu list – sdílený
// tests/helpers/verify.js je neumí samokontrolovat (asInput pošle pole, check() whiteboard nezná),
// proto je mají vlastní testy níže.
const graded = { ...derivace, id: 'derivace-bez-pevnych', types: derivace.types.filter((t) => t.id !== 'prubeh' && t.id !== 'extremy' && t.id !== 'asymptoty-svisle') };
const listInput = (p) => p.answerSpec.value.map(String).join('; ');
function checkListProblem(p, label) {
  assert.equal(check(p.answerSpec, listInput(p)).ok, true, `${label}: vlastní odpověď neprošla`);
  assert.ok(p.solution.length >= 3);
  for (const s of p.solution) assert.ok(s.text.length > 10 && s.board.length > 0, label);
  const last = p.solution[p.solution.length - 1].board.map((l) => l.tex).join(' ');
  assert.ok(last.includes(p.answerTex), `${label}: poslední krok bez výsledku`);
  const exp = oracles.extremy(p.data);
  assert.equal(check(p.answerSpec, exp).ok, true, `${label}: nezávislý výpočet ${exp} ≠ ${p.answerSpec.value}`);
}

test('derivace: 200 příkladů každého typu projde kontrolou a nezávislým výpočtem', () => {
  const r = verify(graded, 200, { oracles });
  assert.ok(r.generated >= 200 * 10);
});

test('extremy: 200 příkladů, odpověď typu seznam a nezávislý výpočet', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const p = type('extremy').generate(makeRng(seed));
    checkListProblem(p, `extremy ${seed}`);
    seen.add(p.promptTex);
  }
  assert.ok(seen.size >= 20);
  const raw = fixedProblemsFile('derivace');
  for (const r of (raw || []).filter((x) => x.type === 'extremy')) checkListProblem({ ...type('extremy').solve(r.data), source: r.source }, r.id);
});

test('derivace: téma je v seznamu, typy mají solve a výklad pokrývá látku', () => {
  assert.equal(derivace.id, 'derivace');
  assert.equal(derivace.order, 7);
  assert.equal(derivace.title, "Derivace, l'Hospitalovo pravidlo, průběh funkce");
  assert.ok(topics.includes(derivace));
  for (const t of derivace.types) assert.equal(typeof t.solve, 'function', t.id);
  const ids = derivace.types.map((t) => t.id);
  for (const id of ['mocniny', 'soucin', 'podil', 'slozena', 'druha', 'tecna', 'normala', 'lhospital',
    'lhospital-nekonecno', 'lhospital-upravy', 'logder', 'monotonie', 'extremy', 'konvexnost', 'asymptoty', 'prubeh']) {
    assert.ok(ids.includes(id), id);
  }
  const all = derivace.theory.map((s) => `${s.heading} ${s.text}`).join(' ').toLowerCase();
  for (const w of ['součin', 'podíl', 'složen', 'tečn', 'normál', 'hospital', 'rostoucí', 'extrém', 'konvexní',
    'inflexní', 'asymptot', 'průběh', 'druhá derivace', 'logaritmick']) assert.match(all, new RegExp(w), w);
  assert.ok(derivace.theory.filter((s) => Array.isArray(s.mistakes) && s.mistakes.length).length >= 8);
});

test('součin a podíl: na tabuli jsou závorky u, v, u′, v′', () => {
  for (const id of ['soucin', 'podil']) {
    for (let seed = 1; seed <= 30; seed++) {
      const p = type(id).generate(makeRng(seed));
      const notes = p.solution.flatMap((s) => s.board.flatMap((l) => (l.notes || []).map((n) => n.label)));
      for (const lab of ['u', 'v', "u′", "v′"]) assert.ok(notes.includes(lab), `${id} ${seed}: ${lab}`);
    }
  }
  const p = type('slozena').generate(makeRng(5));
  const labels = p.solution.flatMap((s) => s.board.flatMap((l) => (l.notes || []).map((n) => n.label)));
  assert.ok(labels.some((l) => /vnitřní/.test(l)) && labels.some((l) => /vnější/.test(l)));
});

test("l'Hospital: nejdřív se ověří typ 0/0 nebo ∞/∞, pak se derivuje", () => {
  for (const id of ['lhospital', 'lhospital-nekonecno', 'lhospital-upravy']) {
    for (let seed = 1; seed <= 40; seed++) {
      const p = type(id).generate(makeRng(seed));
      const lines = p.solution.flatMap((s) => s.board.map((l) => l.tex));
      const iForm = lines.findIndex((l) => /\\left\|\\frac\{(0|-?\\infty)\}\{(0|-?\\infty)\}\\right\|/.test(l));
      const iLH = lines.findIndex((l) => l.includes("l'H"));
      assert.ok(iForm >= 0 && iLH > iForm, `${id} ${seed}`);
    }
  }
  // opakované použití: (e^x - 1 - x)/x^2 potřebuje dvakrát
  const p = type('lhospital').solve({ N: [{ c: 1, E: 1 }, { c: -1 }, { c: -1, p: 1 }], D: [{ c: 3, p: 2 }], x0: 0 });
  assert.equal(p.solution.filter((s) => /l'Hospital/.test(s.title)).length, 2);
  assert.equal(check(p.answerSpec, '1/6').ok, true);
});

test('tečna: graf s tečnou, normála: kolmá směrnice', () => {
  const p = type('tecna').solve({ terms: [{ c: 1, p: 2 }], x0: 1 });
  assert.equal(check(p.answerSpec, '2x - 1').ok, true);
  assert.equal(check(p.answerSpec, 'y = 2x - 1').ok, true);
  assert.ok(p.solution.some((s) => s.viz && s.viz.kind === 'tangent'));
  const n = type('normala').solve({ terms: [{ c: 1, p: 2 }], x0: 1 });
  assert.equal(check(n.answerSpec, '-x/2 + 3/2').ok, true);
});

test('průběh: tabulky znamének pro f′ a f″ a graf; odpovědi dílčích typů', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const p = type('prubeh').generate(makeRng(seed));
    assert.equal(p.answerSpec.kind, 'whiteboard');
    assert.ok(p.solution.length >= 8, `kroků ${p.solution.length}`);
    const kinds = p.solution.map((s) => s.viz && s.viz.kind).filter(Boolean);
    assert.equal(kinds.filter((k) => k === 'signchart').length, 2);
    assert.ok(kinds.includes('plot'));
    for (const s of p.solution) {
      assert.ok(s.text.length > 10);
      assert.ok(Array.isArray(s.board) && s.board.length > 0, s.title);
    }
    const plot = p.solution.find((s) => s.viz && s.viz.kind === 'plot').viz.data;
    const a = analyse(p.data);
    for (const x of a.extrema) assert.ok(plot.points.some((pt) => Math.abs(pt.x - x) < 1e-6), `${seed} extrém ${x} v grafu`);
    for (const x of a.infl) assert.ok(plot.points.some((pt) => Math.abs(pt.x - x) < 1e-6), `${seed} inflexe ${x} v grafu`);
    // nezávislá kontrola závěru: totéž zadání v dílčích typech
    for (const id of ['monotonie', 'konvexnost']) checkProblem(type(id).solve(p.data), oracles, `${id} z průběhu ${seed}`);
    checkListProblem(type('extremy').solve(p.data), `extremy z průběhu ${seed}`);
  }
  // všechny rodiny se objeví
  const fams = new Set();
  for (let seed = 1; seed <= 200; seed++) fams.add(type('prubeh').generate(makeRng(seed)).data.fam);
  assert.equal(fams.size, 7);
});

test('dílčí odpovědi průběhu mají formát v zadání', () => {
  assert.match(type('monotonie').generate(makeRng(1)).task, /∪/);
  assert.match(type('extremy').generate(makeRng(1)).task, /středník/);
  assert.match(type('asymptoty').generate(makeRng(1)).task, /y = /);
});

// ---------- pevné příklady z materiálů: nezávislé výpočty (jen když je content/ k dispozici) ----------
const mb = math.create(math.all, { number: 'BigNumber', precision: 300 });
const big = (expr, x) => Number(mb.evaluate(expr, { x: mb.bignumber(x) }).toString());
function bigLimit(expr, x0) { // oboustranný průměr v těsné blízkosti bodu, 80 platných číslic
  const c = mb.bignumber(x0); const h = mb.bignumber('1e-20');
  const at = (x) => Number(mb.evaluate(expr, { x }).toString());
  return (at(c.plus(h)) + at(c.minus(h))) / 2;
}
const customOracles = {
  'v-deriv': (d) => deriv(d.oracle.f),
  'v-lim': (d) => `${bigLimit(d.oracle.f, num(d.oracle.x0))}`,
  'v-asym': (d) => {
    const { f, k, q } = d.oracle;
    for (const X of [1e9, 1e10]) {
      const gap = Math.abs(big(f, X) - (k * X + q));
      assert.ok(gap < 1e-5, `${f}: vzdálenost od přímky v ${X} je ${gap}`);
    }
    return `${k}*x+(${q})`;
  },
  'v-vert': (d) => {
    for (const x0 of d.oracle.x) for (const s of [-1, 1]) assert.ok(Math.abs(big(d.oracle.f, x0 + s * 1e-8)) > 1e6, `${d.oracle.f}: v ${x0} není svislá asymptota`);
    return d.oracle.x.join('; ');
  },
  'v-inc': (d) => analyseExpr(d.oracle.f).increasing,
  'v-convex': (d) => analyseExpr(d.oracle.f).convex,
  'v-extr': (d) => analyseExpr(d.oracle.f).extrema.join('; '),
};
Object.assign(oracles, customOracles);

test('derivace: pevné příklady z materiálů (jen když je content/ k dispozici)', (ctx) => {
  const raw = fixedProblemsFile('derivace');
  if (!raw) { ctx.skip('content/problems/derivace.json chybí'); return; }
  const list = hydrateProblems(derivace, raw);
  assert.equal(list.length, raw.length, 'některý pevný příklad se nepodařilo sestavit');
  for (const p of list) {
    assert.ok(p.source, `${p.id}: chybí zdroj`);
    if (p.answerSpec.kind === 'whiteboard') {
      assert.ok(p.solution.length >= 5, p.id);
      for (const s of p.solution) assert.ok(s.text.length > 10 && s.board.length > 0, p.id);
    } else if (p.answerSpec.kind === 'list') {
      const exp = oracles[p.type](p.data);
      assert.equal(check(p.answerSpec, exp).ok, true, `${p.id}: nezávislý výpočet ${exp} ≠ ${p.answerSpec.value}`);
      assert.ok(p.solution.length >= 3, p.id);
    } else checkProblem(p, oracles, `pevný ${p.id}`);
  }
});

test('derivace: kontroly proti materiálům z Moodlu (jen když je content/ k dispozici)', (ctx) => {
  const file = fileURLToPath(new URL('../../content/problems/derivace-checks.json', import.meta.url));
  const raw = fixedProblemsFile('derivace');
  if (!existsSync(file) || !raw) { ctx.skip('content/problems/derivace-checks.json chybí'); return; }
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  const hydrated = hydrateProblems(derivace, raw);
  assert.ok(checks.length > 0);
  for (const c of checks) {
    const full = c.id ? hydrated.find((x) => x.id === c.id) : type(c.type).solve(c.data);
    assert.ok(full, JSON.stringify(c));
    const r = check(full.answerSpec, c.input);
    if (c.expect === 'wrong') assert.equal(r.reason, 'wrong', JSON.stringify(c));
    else assert.equal(r.ok, true, `${JSON.stringify(c)} -> ${JSON.stringify(full.answerSpec)}`);
  }
});

// ---------- podrobný postup typu „mocniny“ ----------
test('mocniny: podrobný postup (≥ 5 kroků, krok na člen, odečtení exponentů, bez opakovaných řádků)', () => {
  const type = derivace.types.find((t) => t.id === 'mocniny');
  for (let seed = 1; seed <= 200; seed++) {
    const p = type.generate(makeRng(seed));
    const steps = p.solution;
    assert.ok(steps.length >= 5, `seed ${seed}: ${steps.length} kroků`);
    assert.equal(steps[0].title, 'Pravidlo, které použijeme');
    assert.ok(steps.every((s) => s.text && s.board.length), `seed ${seed}: krok bez textu nebo tabule`);
    const dn = p.data.den === undefined ? 0 : math.evaluate(String(p.data.den));
    const nonConst = p.data.terms.filter((t) => math.evaluate(String(t.p ?? 0)) !== dn).length;
    assert.equal(steps.filter((s) => s.title.startsWith('Derivace členu')).length, nonConst, `seed ${seed}: kroky po členech`);
    const lines = steps.flatMap((s) => s.board.map((l) => l.tex));
    lines.forEach((t, i) => { if (i && !t.startsWith('f') && t === lines[i - 1]) assert.fail(`seed ${seed}: zdvojený řádek ${t}`); });
    for (const t of lines) assert.ok(!/--|\+-/.test(t), `seed ${seed}: ${t}`);
    // zlomkový exponent: odečtení jedničky na společný jmenovatel
    const termSteps = steps.filter((s) => s.title.startsWith('Derivace členu'));
    for (const s of termSteps) {
      if (!s.board[0].tex.includes('\\frac')) continue;
      assert.ok(s.board.some((l) => /^(-?\\frac\{\d+\}\{(\d+)\})-1=\1-\\frac\{\2\}\{\2\}=-?(\\frac\{\d+\}\{\d+\}|\d+)$/.test(l.tex)), `seed ${seed}: chybí odečtení na společný jmenovatel u ${s.title}`);
    }
    const last = lines[lines.length - 1];
    assert.ok(last.includes('bt-vysledek'));
    assert.ok(steps[steps.length - 1].board.at(-1).notes.some((n) => n.kind === 'doubleUnderline'));
  }
  // konkrétní příklad: 3∛(x²) − 3/x
  const p = type.solve({ terms: [{ c: 3, p: '2/3' }, { c: -3, p: -1 }] });
  assert.deepEqual(p.solution.map((s) => s.title), [
    'Pravidlo, které použijeme', 'Přepis odmocnin na mocniny', 'Derivace členu 3x^(2/3)', 'Derivace členu −3x^(−1)', 'Sečtení členů', 'Zpět na odmocniny a zlomky',
  ]);
  const all = p.solution.flatMap((s) => s.board.map((l) => l.tex));
  assert.ok(all.includes('\\frac{2}{3}-1=\\frac{2}{3}-\\frac{3}{3}=-\\frac{1}{3}'));
  assert.ok(all.includes('3\\cdot \\frac{2}{3}=2'));
  assert.equal(check(p.answerSpec, '2/cbrt(x)+3/x^2').ok, true);
});
