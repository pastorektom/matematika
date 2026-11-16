import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import * as mj from 'mathjs';
import { deriveWithSteps, previewTex } from '../js/derive-steps.js';
import { topics } from '../js/topics/index.js';
import { derivAnyType } from '../js/topics/derivace-custom.js';
import { mountCustom } from '../js/ui/custom.js';
import { check } from '../js/checker.js';
import { makeRng } from '../js/rng.js';
import { checkProblem, flatTex } from './helpers/verify.js';
import { texWidth } from '../js/topics/derivace-fit.js';

// ---------- nezávislý číselný oracle ----------
// f se vyhodnocuje přímo v math.js (české názvy se přepíšou na anglické), derivace je centrální diference.
const toMath = (s) => s
  .replace(/\barccotg\b/g, 'acot').replace(/\barctg\b/g, 'atan').replace(/\barcsin\b/g, 'asin').replace(/\barccos\b/g, 'acos')
  .replace(/\bcotg\b/g, 'cot').replace(/\btg\b/g, 'tan').replace(/\bln\b/g, 'log')
  .replace(/\bx\(/g, 'x*(').replace(/\)\(/g, ')*(');
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function oracle(expr, seed = 1, need = 3) {
  const src = toMath(expr);
  const f = mj.parse(src).compile();
  const ans = deriveWithSteps(expr).answerExpr;
  const g = mj.parse(ans).compile();
  const rng = makeRng(seed);
  const val = (c, x) => { try { const v = c.evaluate({ x }); return finite(v) ? v : NaN; } catch { return NaN; } };
  let ok = 0;
  for (let i = 0; i < 400 && ok < 5; i++) {
    const x = -3 + 6 * rng();
    const h = 1e-5;
    const a = val(f, x + h); const b = val(f, x - h); const f0 = val(f, x);
    const d = val(g, x);
    if (![a, b, f0, d].every(finite) || Math.abs(a) > 1e5 || Math.abs(b) > 1e5 || Math.abs(d) > 1e5) continue;
    const num = (a - b) / (2 * h);
    // v bodě s ostrým zlomem (tan, 1/x u pólu) diference nesouhlasí s f(x±h): ověř i hladkost
    const a2 = val(f, x + 2 * h); const b2 = val(f, x - 2 * h);
    if (!finite(a2) || !finite(b2) || Math.abs((a2 - b2) / (4 * h) - num) > 1e-4 * Math.max(1, Math.abs(num))) continue;
    assert.ok(Math.abs(num - d) <= 1e-4 * Math.max(1, Math.abs(num)), `${expr}: x=${x}, diference ${num}, odpověď ${d} (${ans})`);
    ok++;
  }
  assert.ok(ok >= need, `${expr}: jen ${ok} použitelných bodů`);
  return ans;
}

const CASES = [
  'x^2*sin(x)', 'e^x*cos(x)', 'ln(x)/x', 'sin(x^2)', '(3x+1)^5', 'sqrt(1+x^2)', 'tg(x)/x', 'x^3*e^(2x)', 'ln(sin(x))',
  'arctg(x)/x^2', '2^x*x', 'sin(x)*cos(x)', '(x^2+1)/(x-1)', 'x*e^x*cos(x)', 'x e^x cos(x)', 'x^2*sin(x)*ln(x)', '2^x*x^3*cos(x)',
  '5', 'x', '-x', '3x-2x', '1/x', 'sqrt(x)', 'x^2', 'x^(1/2)', 'x^(-2)', '3x^4-5x^2+7x-1', '2x+3', 'x(x+1)', '(x+1)(x+2)',
  'sin(x)', 'cos(x)', 'tg(x)', 'cotg(x)', 'ln(x)', 'e^x', 'e^(-x)', 'exp(3x)', 'arcsin(x)', 'arccos(x)', 'arctg(x)', 'arccotg(x)',
  'log(x,2)', 'log(3x,5)', 'ln(x^2+1)', 'sin(3x+1)', 'cos(x/2)', 'tan(x^2)', 'cot(2x)', 'e^(x^2)', 'sqrt(x^2+1)', 'sqrt(sin(x)+2)',
  'arctg(2x)', 'arcsin(x/2)', 'arccos(x^2/4)', '(x^2+1)^3', '(2x-1)^(1/3)', '3*sin(x)+2*cos(x)', 'x^2*e^x', 'x*ln(x)',
  'x/(x^2+1)', '(x+1)/(x-1)', '1/(x^2+1)', 'e^x/x', 'sin(x)/x', 'cos(x)/(1+x^2)', 'ln(x)/(x^2+1)', 'x*arctg(x)', 'x^2*arcsin(x)',
  'ln(ln(x))', 'sin(cos(x))', 'e^(sin(x))', 'sin(e^x)', 'sqrt(1+sin(x)^2)', 'ln(x+sqrt(x^2+1))', 'e^x*sin(x)*cos(x)',
  'x^2*e^x/sin(x)', '(x*e^x)/(1+cos(x)^2)', '2^(3x)', '3^x*sin(x)', 'pi*x^2', 'e*x', 'x*pi^x', '0.5x^2+1,5x', '(1/2)*x^4', 'x^2/3', '-sin(x)', 'cos(x)^2',
  'sin(x)^3', '(sin(x)+cos(x))^2', 'x^2*(x+1)^3', 'x*sqrt(x)', 'sqrt(x)*ln(x)', 'x/sqrt(1-x^2)', 'arctg(1/x)', 'e^(1/x)', 'ln(2x+1)^2',
];
test(`oracle: ${CASES.length} ručně vybraných výrazů odpovídá centrální diferenci`, () => {
  assert.ok(CASES.length >= 60);
  CASES.forEach((c, i) => oracle(c.replace(',', '.'), i + 1, c === '5' || c === 'pi*x^2' ? 3 : 3));
});

test('oracle: mathjs.derivative souhlasí na výrazech, které umí', () => {
  const same = ['x^2*sin(x)', 'e^x*cos(x)', 'ln(x)/x', 'sin(x^2)', '(3x+1)^5', 'sqrt(1+x^2)', 'x^3*e^(2x)', 'ln(sin(x))', '(x^2+1)/(x-1)', 'x*e^x*cos(x)'];
  for (const e of same) {
    const ans = deriveWithSteps(e).answerExpr;
    const d = mj.derivative(toMath(e), 'x');
    for (const x of [0.6, 1.3, 2.2]) {
      const a = mj.evaluate(ans, { x }); const b = d.evaluate({ x });
      assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${e} v ${x}: ${a} ≠ ${b}`);
    }
  }
});

// ---------- náhodné výrazy ----------
function gen(rng, depth) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  if (depth <= 0 || rng() < 0.15) return rng() < 0.6 ? 'x' : String(1 + Math.floor(rng() * 4));
  const a = () => gen(rng, depth - 1);
  switch (pick(['+', '-', '*', '/', '^', 'f', 'f', 'g'])) {
    case '+': return `(${a()}+${a()})`;
    case '-': return `(${a()}-${a()})`;
    case '*': return `(${a()})*(${a()})`;
    case '/': return `(${a()})/((${a()})^2+1)`;
    case '^': return `(${a()})^${pick([2, 3])}`;
    case 'f': return `${pick(['sin', 'cos', 'tan', 'exp'])}(${a()})`;
    default: return pick([`ln((${a()})^2+1)`, `sqrt((${a()})^2+1)`]);
  }
}
test('300 náhodných složených výrazů souhlasí s číselnou derivací', () => {
  const rng = makeRng(20260101);
  let n = 0;
  while (n < 300) {
    const e = gen(rng, 3);
    if (!/(^|[^a-z])x([^a-z]|$)/.test(e)) continue;
    let r;
    try { r = deriveWithSteps(e); } catch (err) { assert.match(err.message, /příliš/, `${e}: ${err.message}`); continue; }
    assert.ok(r.steps.length >= 3);
    oracle(e, n + 7, 1);
    n++;
  }
});

// ---------- struktura postupu ----------
const trust = (c) => c.command === '\\htmlClass' && /^bt-[a-z0-9-]+$/.test(c.class);
const WIDTH_EXAMPLES = ['x^2*sin(x)', 'e^x*cos(x)', 'ln(x)/x', 'sin(x^2)', '(3x+1)^5', 'sqrt(1+x^2)', 'tg(x)/x', 'x^3*e^(2x)', 'ln(sin(x))',
  'arctg(x)/x^2', '2^x*x', 'sin(x)*cos(x)', '(x^2+1)/(x-1)', 'x*e^x*cos(x)', 'x e^x cos(x)', 'x^2*sin(x)*ln(x)', '2^x*x^3*cos(x)',
  '3x^4-5x^2+7x-1', 'x/(x^2+1)', 'cos(x)/(1+x^2)', 'sin(cos(x))', '5', 'x', '-3x'];
test('postup: obecné kontroly (checkProblem, KaTeX, šířka, znaménka)', () => {
  const oracles = { libovolna: (d) => deriveWithSteps(d.f).answerExpr };
  for (const e of WIDTH_EXAMPLES) {
    const p = derivAnyType.solve(derivAnyType.custom.build({ expr: e }));
    checkProblem(p, oracles, e, { strictDenominators: true });
    assert.ok(p.solution[0].title === 'Rozbor funkce' && p.solution.at(-1).title === 'Výsledek', e);
    for (const st of p.solution) {
      assert.match(st.text, /[ěščřžýáíéúůň ]/);
      for (const l of st.board) {
        assert.ok(!/--|\+-|\+\s*-|-\s*-/.test(flatTex(l.tex).replace(/\\htmlClass/g, '')) || !/(--|\+-)/.test(flatTex(l.tex)), `${e}: ${l.tex}`);
        assert.doesNotMatch(flatTex(l.tex), /--|\+-/, `${e}: ${l.tex}`);
        const w = texWidth(l.tex);
        assert.ok(w <= 34, `${e}: řádek je příliš široký (${w}): ${l.tex}`);
        assert.doesNotThrow(() => katex.renderToString(l.tex, { throwOnError: true, strict: 'ignore', trust }), `${e}: ${l.tex}`);
      }
      assert.doesNotThrow(() => katex.renderToString(p.promptTex, { throwOnError: true, strict: 'ignore' }));
    }
    assert.doesNotThrow(() => katex.renderToString(p.answerTex, { throwOnError: true, strict: 'ignore' }));
    const spec = p.answerSpec;
    assert.equal(check(spec, spec.value).ok, true);
  }
});

const lines = (r) => r.steps.flatMap((s) => s.board.map((l) => flatTex(l.tex)));
test('součin: kroky pojmenují u, v, u′, v′ a vzorec', () => {
  const r = deriveWithSteps('x^2*sin(x)');
  assert.ok(r.steps.length >= 3);
  const L = lines(r);
  assert.ok(L.some((l) => l.startsWith('u=x^2')), 'u');
  assert.ok(L.some((l) => l.startsWith('v=\\sinx')), 'v');
  assert.ok(L.some((l) => l.startsWith("u'=")), "u'");
  assert.ok(L.some((l) => l.startsWith("v'=")), "v'");
  assert.ok(L.some((l) => l === "(u\\cdotv)'=u'\\cdotv+u\\cdotv'"), 'vzorec');
  assert.ok(r.steps.some((s) => /součin/.test(s.title)));
  assert.match(r.steps[0].text, /součin/);
  assert.equal(r.steps.at(-1).board.at(-1).notes[0].kind, 'doubleUnderline');
});
test('složená funkce: vnější a vnitřní funkce, f′(u)·u′', () => {
  const r = deriveWithSteps('sin(3x+1)');
  const L = lines(r);
  assert.ok(L.some((l) => l.startsWith('\\text{vnější:}')) || L.some((l) => l.includes('vnější')), 'vnější');
  assert.ok(L.some((l) => l.includes('vnitřní')), 'vnitřní');
  assert.ok(L.includes("f'(u)=\\cosu"), "f'(u)");
  assert.ok(L.includes("u'=(3x+1)'=(3x)'+(1)'") || L.some((l) => l.startsWith("u'=")), "u'");
  assert.ok(L.some((l) => l.includes("f'(u)\\cdotu'")));
  assert.equal(r.answerExpr.replace(/\s/g, ''), '3*cos(3*x+1)');
});
test('součin tří činitelů: první řádek ve stylu tabule a vnořený součin', () => {
  for (const e of ['x*e^x*cos(x)', 'x e^x cos(x)']) {
    const r = deriveWithSteps(e);
    const L = lines(r).map((l) => l.replace(/\\cdot/g, '').replace(/\\quad/g, ''));
    const first = L.findIndex((l) => l.startsWith("f'(x)=(xe^x\\cosx)'"));
    assert.ok(first >= 0, 'první řádek');
    assert.ok(L.slice(first, first + 3).join('').includes("(xe^x)'\\cosx+xe^x(\\cosx)'"), L.slice(first, first + 3).join('|'));
    assert.ok(L.some((l) => l.startsWith("u'=(xe^x)'")), 'vnořená derivace u′');
    assert.ok(L.some((l) => l === "=1e^x+xe^x"), 'rozepsaný vnořený součin');
    assert.equal(r.answerTex, 'e^{x}\\cos x+xe^{x}\\cos x-xe^{x}\\sin x');
    // součet sloučený na tři členy
    assert.equal(new Set(r.steps.at(-1).board.map((l) => l.tex)).size, r.steps.at(-1).board.length);
  }
  assert.equal(deriveWithSteps('x*e^x*cos(x)').fTex.replace(/\\cdot ?/g, ''), 'xe^{x}\\cos x');
});
test('podíl se součinem v čitateli a jmenovateli', () => {
  for (const e of ['x*e^x/(x^2+1)', '(x^2*sin(x))/(x*cos(x))', 'sin(x)*cos(x)/(x*e^x)']) {
    oracle(e, 3);
    const p = derivAnyType.solve({ f: e });
    checkProblem(p, { libovolna: (d) => deriveWithSteps(d.f).answerExpr }, e, { strictDenominators: true });
  }
});

// ---------- neplatné vstupy ----------
test('neplatné vstupy vyhodí Error s českou hláškou', () => {
  const bad = ['', '   ', 'y+1', 'x^x', '(x+1', 'x^(', 'sin', 'sin x', 'foo(x)', 'sinh(x)', 'x+', '2^(-x)^x', 'a*x', 'x=1', '[1,2]',
    Array.from({ length: 30 }, () => 'sin(x)').join('+'), 'x'.repeat(250), '(-2)^x'];
  for (const b of bad) {
    assert.throws(() => deriveWithSteps(b), (e) => e instanceof Error && e.message.length > 15 && /[ěščřžýáíéúůňó]|Zadej|Pou/.test(e.message)
      && !/undefined|TypeError|is not|Cannot|\[object/.test(e.message), `vstup „${b.slice(0, 20)}“`);
  }
  for (const v of [null, undefined, 5, {}]) assert.throws(() => deriveWithSteps(v), (e) => e instanceof Error);
  assert.throws(() => deriveWithSteps('x^x'), /u\(x\)\^v\(x\)/);
  assert.throws(() => deriveWithSteps('sin(x)^x'), /logaritmickou derivaci/);
});
test('česká desetinná čárka, aliasy a náhled', () => {
  assert.equal(oracle('2,5x^2'.replace(',', '.'), 2), deriveWithSteps('2,5x^2').answerExpr);
  assert.ok(previewTex('arctg(x)/x').includes('arctg'));
  assert.ok(previewTex('ln(x)').includes('\\ln'));
  assert.equal(previewTex('x^'), null);
  katex.renderToString(previewTex('e^(2x)*cotg(x)+arccotg(x)+arcsin(x)+π*x'), { throwOnError: true });
});

// ---------- stránka Vlastní příklad ----------
test('stránka Vlastní příklad: x^2*sin(x) dá výsledek a postup', () => {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const c = mountCustom(el, topics, { initial: 'derivace/libovolna' });
  const q = (s) => el.querySelector(s);
  const input = q('input[id="vl-expr"]');
  assert.ok(input, 'pole f(x)');
  // tlačítka funkcí a kurzor uvnitř závorky
  const btn = (label) => [...el.querySelectorAll('.sym-btn')].find((b) => b.textContent === label);
  for (const l of ['sin', 'cos', 'tg', 'cotg', 'ln', 'e^', '√', 'π', 'arcsin', 'arctg']) assert.ok(btn(l), `tlačítko ${l}`);
  input.focus();
  btn('sin').click();
  assert.equal(input.value, 'sin()');
  assert.equal(input.selectionStart, 4);
  input.value = '';
  input.value = 'x^2*sin(x)';
  input.dispatchEvent(new window.Event('input'));
  assert.ok(q('.formula').textContent.includes('\\sin'), 'živý náhled');
  q('[data-role="custom-solve"]').click();
  assert.equal(q('[data-role="custom-error"]').textContent, '');
  assert.ok(q('[data-role="custom-answer"]').textContent.trim().length > 5);
  const m = /Krok 1 z (\d+)/.exec(q('[data-role="custom-steps"] .stepper-counter').textContent);
  assert.ok(m && Number(m[1]) >= 3, 'krokovač má aspoň 3 kroky');
  // zobrazená odpověď = answerSpec úlohy, který se číselně shoduje s 2x·sin x + x²·cos x
  const ty = topics.find((t) => t.id === 'derivace').customTypes.find((x) => x.id === 'libovolna');
  const p = ty.solve(ty.custom.build({ expr: 'x^2*sin(x)' }));
  for (const x of [0.4, 1.7, -2.1]) assert.ok(Math.abs(mj.evaluate(p.answerSpec.value, { x }) - (2 * x * Math.sin(x) + x * x * Math.cos(x))) < 1e-9);
  assert.equal(check(p.answerSpec, '2x sin(x) + x^2 cos(x)').ok, true);
  // chyba
  input.value = 'y+1';
  q('[data-role="custom-solve"]').click();
  assert.match(q('[data-role="custom-error"]').textContent, /proměnnou x/);
  c.destroy();
});
