import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import * as mj from 'mathjs';
import { deriveWithSteps } from '../js/derive-steps.js';
import derivace from '../js/topics/derivace.js';
import { makeRng } from '../js/rng.js';
import { flatTex } from './helpers/verify.js';
import { texWidth } from '../js/topics/derivace-fit.js';

// Postup ze semináře: jeden řetízek rovností s derivacemi (…)′ rozepisovanými po úrovních.
const trust = (c) => c.command === '\\htmlClass' && /^bt-[a-z0-9-]+$/.test(c.class);
const EXPRS = ['x^2*sin(x)', 'e^x*cos(x)', 'ln(x)/x', 'sin(x^2)', '(3x+1)^5', 'sqrt(1+x^2)', 'tg(x)/x', 'x^3*e^(2x)', 'ln(sin(x))',
  'arctg(x)/x^2', '2^x*x', 'sin(x)*cos(x)', '(x^2+1)/(x-1)', 'x*e^x*cos(x)', 'x^2*sin(x)*ln(x)', '2^x*x^3*cos(x)', '5', 'x', '-x',
  '3x-2x', '1/x', 'sqrt(x)', 'x^2', 'x^(-2)', '3x^4-5x^2+7x-1', 'sin(x)', 'cos(x)', 'cotg(x)', 'ln(x)', 'e^(-x)', 'arcsin(x)',
  'arccos(x)', 'arccotg(x)', 'log(3x,5)', 'ln(x^2+1)', 'cos(x/2)', 'e^(x^2)', 'sqrt(sin(x)+2)', 'arcsin(x/2)', '(x^2+1)^3',
  '(2x-1)^(1/3)', 'x/(x^2+1)', 'cos(x)/(1+x^2)', 'ln(ln(x))', 'sin(cos(x))', 'ln(x+sqrt(x^2+1))', 'e^x*sin(x)*cos(x)',
  'x^2*e^x/sin(x)', '(x*e^x)/(1+cos(x)^2)', '3^x*sin(x)', 'pi*x^2', '-sin(x)', 'cos(x)^2', 'sin(x)^3', '(sin(x)+cos(x))^2',
  'x^2*(x+1)^3', 'x*sqrt(x)', 'x/sqrt(1-x^2)', 'arctg(1/x)', 'e^(1/x)', 'ln(2x+1)^2'];
const toMath = (s) => s.replace(/\barccotg\b/g, 'acot').replace(/\barctg\b/g, 'atan').replace(/\barcsin\b/g, 'asin').replace(/\barccos\b/g, 'acos')
  .replace(/\bcotg\b/g, 'cot').replace(/\btg\b/g, 'tan').replace(/\bln\b/g, 'log');

test('postup ze semináře: řetízek má správnou strukturu a hodnotu', () => {
  for (const e of EXPRS) {
    const r = deriveWithSteps(e);
    const v = r.variants[0];
    assert.equal(v.id, 'seminar');
    assert.equal(v.title, 'Postup ze semináře');
    assert.ok(v.solution.length >= 2 && v.solution.length <= 5, `${e}: ${v.solution.length} kroků`);
    const all = v.solution.flatMap((s) => s.board.map((l) => l.tex));
    assert.ok(all[0].startsWith("f'(x)=") && all[0].includes("'"), `${e}: první řádek ${all[0]}`);
    const last = v.solution.at(-1).board.at(-1);
    assert.ok(last.tex.includes('bt-vysledek') && last.notes.some((n) => n.kind === 'doubleUnderline'), e);
    const res = all.filter((t) => t.includes('bt-vysledek')).map((t) => flatTex(t).replace(/\\quad/g, '')).join('').replace(/^=/, '');
    assert.equal(res, flatTex(r.answerTex), `${e}: výsledek`);
    // hodnota řádku před zjednodušením (bez značek) odpovídá derivaci
    const g1 = mj.parse(v.rawExpr).compile(); const g2 = mj.parse(r.answerExpr).compile();
    for (const x of [0.4, 0.9, 1.7]) {
      const a = (() => { try { return g1.evaluate({ x }); } catch { return NaN; } })();
      const b = g2.evaluate({ x });
      if (Number.isFinite(a) && Number.isFinite(b)) assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${e}: ${a} ≠ ${b}`);
    }
    v.solution.forEach((st) => {
      assert.match(st.text, /[ěščřžýáíéúůň ]/);
      assert.ok(st.board.length, `${e}: prázdný krok`);
    });
    all.forEach((t, i) => {
      assert.doesNotMatch(flatTex(t), /--|\+-/, `${e}: ${t}`);
      assert.doesNotMatch(flatTex(t), /\\frac\{[^{}]*\}\{-/, `${e}: záporný jmenovatel ${t}`);
      if (i) assert.notEqual(t, all[i - 1], `${e}: opakovaný řádek`);
      if (!t.includes('bt-vysledek')) assert.ok(texWidth(t) <= 34, `${e}: široký řádek ${t}`);
      assert.doesNotThrow(() => katex.renderToString(t, { throwOnError: true, strict: 'ignore', trust }), `${e}: ${t}`);
    });
    mj.parse(toMath(e)); // výraz je čitelný i pro nezávislý parser
  }
});

test('postup ze semináře: sin^3 x se přepíše na (sin x)^3 a vyjde 3 sin^2 x cos x', () => {
  const v = deriveWithSteps('sin(x)^3').variants[0];
  const all = v.solution.flatMap((s) => s.board.map((l) => flatTex(l.tex)));
  assert.ok(all.some((t) => t.includes('(\\sinx)^3')), all.join(' | '));
  assert.ok(all.some((t) => t.includes('3\\sin^2x\\cdot\\cosx')), all.join(' | '));
  const x = deriveWithSteps('x*e^x*cos(x)').variants[0].solution.flatMap((s) => s.board.map((l) => flatTex(l.tex)));
  assert.ok(x.some((t) => t.includes("(x\\cdote^x)'\\cdot\\cosx")), x.join(' | '));
});

test('složená funkce (typ slozena) má variantu ze semináře', () => {
  const type = derivace.types.find((t) => t.id === 'slozena');
  for (let seed = 1; seed <= 40; seed++) {
    const p = type.generate(makeRng(seed));
    const v = p.variants?.[0];
    assert.ok(v && v.id === 'seminar', `seed ${seed}`);
    assert.equal(flatTex(v.solution.at(-1).board.at(-1).tex).replace(/^=/, '').length > 0, true);
    assert.ok(v.solution.length >= 2);
  }
});
