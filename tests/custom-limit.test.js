import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as mjAll from 'mathjs';
import { topics } from '../js/topics/index.js';
import { mountCustom, customChoices } from '../js/ui/custom.js';
import { solveLimitFraction, parsePoint, limitPreviewTex } from '../js/topics/limita-custom.js';

// Nezávislá kontrola: vyhodnocení původního zadání v BigNumber (mathjs) blízko bodu / v ±1e40.
const mj = mjAll.create(mjAll.all, { number: 'BigNumber', precision: 90 });
const B = (s) => mj.bignumber(s);
const ev = (expr, x) => mj.evaluate(expr.replace(/(\d),(\d)/g, '$1.$2'), { x });
const frac = (s) => { const [n, d = '1'] = s.split('/'); return mj.divide(B(n), B(d)); };
const f = (c, j, x) => mj.divide(ev(c, x), ev(j, x));

// -> { kind: 'num', v } | { kind: 'inf', s } | { kind: 'dne' }
function oracle(c, j, bod, strana = '') {
  if (/∞/.test(bod)) {
    const sg = bod.startsWith('-') ? -1 : 1;
    const v1 = f(c, j, B(sg).times(B('1e40'))); const v2 = f(c, j, B(sg).times(B('1e41')));
    if (v1.abs().gt(1e10)) return { kind: 'inf', s: v1.isNegative() ? -1 : 1 };
    assert.ok(v1.minus(v2).abs().lt(1e-30), 'oracle nekonverguje');
    return { kind: 'num', v: Number(v1) };
  }
  const a = frac(bod);
  const h = B('1e-12');
  const val = (sd) => {
    const y1 = f(c, j, a.plus(h.times(sd))); const y2 = f(c, j, a.plus(h.times(sd).div(2)));
    if (y1.abs().gt(1e6)) return { kind: 'inf', s: y1.isNegative() ? -1 : 1 };
    return { kind: 'num', v: Number(y2.times(2).minus(y1)) }; // Richardson
  };
  const L = val(-1); const R = val(1);
  const same = L.kind === R.kind && (L.kind === 'inf' ? L.s === R.s : Math.abs(L.v - R.v) < 1e-6);
  if (strana === 'zleva') return L;
  if (strana === 'zprava') return R;
  return same ? L : { kind: 'dne' };
}
const fromProblem = (p) => {
  const v = String(p.answerSpec.value);
  if (v === 'DNE') return { kind: 'dne' };
  if (/∞/.test(v)) return { kind: 'inf', s: v.startsWith('-') ? -1 : 1 };
  const [n, d = 1] = v.split('/').map(Number);
  return { kind: 'num', v: n / d };
};
const same = (A, Bv) => {
  assert.equal(A.kind, Bv.kind, JSON.stringify([A, Bv]));
  if (A.kind === 'inf') assert.equal(A.s, Bv.s);
  if (A.kind === 'num') assert.ok(Math.abs(A.v - Bv.v) < 1e-6, `${A.v} != ${Bv.v}`);
};
const vis = (tex) => tex.replace(/\\htmlClass\{[^}]*\}/g, '').replace(/\\[a-zA-Z]+/g, 'c').replace(/[\\{}^_ ]/g, '').length;

const CASES = [
  // [čitatel, jmenovatel, bod, strana]
  ['x^2+3x-1', '2x+5', '2'],                 // dosazení
  ['(x+1)(x-2)', 'x^2+1', '-3'],             // dosazení, záporný bod
  ['2x-1', '3x+1', '1/2'],                   // zlomkový bod
  ['x^2-1', 'x-1', '1'],                     // 0/0
  ['x^2-4', 'x^2-5x+6', '2'],                // 0/0
  ['x^3-8', 'x^2-4', '2'],                   // 0/0
  ['x^2+4x+4', 'x^2-x-6', '-2'],             // 0/0 se záporným bodem
  ['(x-1)^2', 'x^3-3x+2', '1'],              // dvojnásobný činitel
  ['x^3-3x^2+3x-1', 'x^2-2x+1', '1'],        // dvojnásobný kořen v čitateli i jmenovateli
  ['2x^2-x-1', 'x-1', '1'],
  ['x', 'x^2', '0'],                         // k/0 opačné strany
  ['1', 'x-2', '2'],                         // opačné strany
  ['x+1', 'x^2-2x+1', '1'],                  // k/0, stejné strany (+∞)
  ['-3', '(x-1)^2', '1'],                    // k/0 stejné strany (−∞)
  ['x-5', 'x^2-1', '1', 'zleva'],            // jednostranná
  ['x-5', 'x^2-1', '1', 'zprava'],
  ['1', 'x^3', '0', 'zleva'],
  ['2', 'x+3', '-3', 'zprava'],
  ['x^2-1', 'x+1', '1/2'],                   // 0/0 není, dosazení zlomek
  ['2x-1', '2x^2-3x+1', '1/2'],              // 0/0 ve zlomkovém bodě
  ['x^2+x+1', 'x^2+x+1', '∞'],               // stupně stejné
  ['3x^2-x', '2x^2+7', '∞'],
  ['3x^2-x', '2x^2+7', '-∞'],
  ['x+1', 'x^3-2', '∞'],                     // menší stupeň čitatele
  ['5', 'x^2+1', '-∞'],
  ['x^3+1', 'x^2+x', '∞'],                   // větší stupeň, lichá mocnina
  ['x^3+1', 'x^2+x', '-∞'],
  ['x^4-x', '-2x+1', '-∞'],                  // sudá mocnina, záporné koeficienty
  ['-x^2+x', 'x+2', '∞'],
  ['x^2+1', '4', '∞'],                       // konstantní jmenovatel
  ['x^3', '-2', '-∞'],
  ['(x+1)(x-2)', '(2x-1)(x+3)', '+∞'],       // implicitní násobení a +∞
  ['0,5x^2-1', 'x-1', '1'],                  // desetinná čárka
  ['x/2-1', 'x^2/4-1', '2'],                 // zlomkové koeficienty
  ['sqrt(x+1)-2', 'x-3', '3'],               // odmocnina
  ['x-4', 'sqrt(x)-2', '4'],
  ['sqrt(x^2+9)-5', 'x-4', '4'],
  ['x^2-1', '3-sqrt(x+8)', '1'],
];

test('Limita zlomku: výsledek odpovídá nezávislému číselnému výpočtu', () => {
  for (const [c, j, bod, strana] of CASES) {
    const p = solveLimitFraction({ cit: c, jm: j, bod, strana });
    assert.equal(p.answerSpec.kind, 'limit');
    assert.ok(p.solution.length >= 2, `${c} / ${j}`);
    same(fromProblem(p), oracle(c, j, bod, strana));
    const last = p.solution[p.solution.length - 1];
    assert.match(last.board[0].tex, /Limita (je|neexistuje)/);
  }
});

test('Limita zlomku: postup nemá záporný jmenovatel, „--“ ani příliš dlouhé řádky', () => {
  for (const [c, j, bod, strana] of CASES) {
    const p = solveLimitFraction({ cit: c, jm: j, bod, strana });
    for (const s of p.solution) {
      assert.ok(s.board?.length, `${c} / ${j}: krok bez tabule`);
      for (const l of s.board) {
        assert.ok(!/--/.test(l.tex), `${c}/${j}: ${l.tex}`);
        assert.ok(!/\\frac\{[^{}]*\}\{-/.test(l.tex), `záporný jmenovatel: ${l.tex}`);
        assert.ok(vis(l.tex) <= 34, `${c}/${j}: dlouhý řádek (${vis(l.tex)}): ${l.tex}`);
      }
    }
  }
});

test('Limita zlomku: k/0 popisuje obě strany, zleva i zprava', () => {
  const p = solveLimitFraction({ cit: '1', jm: 'x-2', bod: '2' });
  assert.equal(p.answerSpec.value, 'DNE');
  assert.equal(solveLimitFraction({ cit: '1', jm: 'x-2', bod: '2', strana: 'zleva' }).answerSpec.value, '-∞');
  assert.equal(solveLimitFraction({ cit: '1', jm: 'x-2', bod: '2', strana: 'zprava' }).answerSpec.value, '∞');
  assert.equal(solveLimitFraction({ cit: 'x^2-1', jm: 'x-1', bod: '1' }).answerSpec.value, '2');
});

test('Limita zlomku: neplatné vstupy mají českou hlášku', () => {
  const bad = (v, re) => assert.throws(() => solveLimitFraction(v), (e) => e instanceof Error && re.test(e.message) && !/undefined|TypeError|Cannot/.test(e.message), JSON.stringify(v));
  bad({ cit: '', jm: 'x', bod: '1' }, /Vyplň/);
  bad({ cit: 'x', jm: ' ', bod: '1' }, /Vyplň/);
  bad({ cit: 'x', jm: 'x', bod: '' }, /Zadej bod/);
  bad({ cit: 'x', jm: 'x', bod: 'abc' }, /nerozumím/);
  bad({ cit: 'x', jm: 'x', bod: '1/0' }, /nulu/);
  bad({ cit: 'x+1', jm: 'x-x', bod: '1' }, /nulová|roven nule/);
  bad({ cit: 'x+1', jm: '0', bod: '1' }, /roven nule/);
  bad({ cit: 'sin(x)', jm: 'x', bod: '0' }, /Zatím umím zlomky z polynomů/);
  bad({ cit: 'x', jm: '2^x', bod: '0' }, /Zatím umím zlomky z polynomů/);
  bad({ cit: 'x', jm: '1/x', bod: '1' }, /Zatím umím zlomky z polynomů/);
  bad({ cit: 'x+', jm: 'x', bod: '1' }, /nepodařilo/);
  bad({ cit: 'y', jm: 'x', bod: '1' }, /Neznámý symbol/);
  bad({ cit: 'sqrt(x)+sqrt(x+1)', jm: 'x', bod: '1' }, /Odmocniny zatím jen/);
  bad({ cit: 'sqrt(x+1)-2', jm: 'x-3', bod: '∞' }, /Odmocniny zatím jen/);
  bad({ cit: 'x^2-1', jm: 'x-1', bod: '1,5,2' }, /nerozumím/);
});

test('Limita zlomku: bod a náhled', () => {
  assert.deepEqual(parsePoint('-1/2').a, { n: -1, d: 2 });
  assert.deepEqual(parsePoint('0,5').a, { n: 1, d: 2 });
  assert.equal(parsePoint('nekonečno').inf, 1);
  assert.equal(parsePoint('-∞').inf, -1);
  assert.match(limitPreviewTex({ cit: '2x', jm: 'x^2-1', bod: '1', strana: 'zleva' }), /^\\lim_\{x\\to 1\^\{-\}\}\\frac\{.*\}\{.*\}$/);
  assert.equal(limitPreviewTex({ cit: '', jm: 'x', bod: '1' }), null);
});

test('stránka Vlastní příklad: Limita zlomku je první v limitách, živý náhled a řešení', () => {
  const ch = customChoices(topics).filter((x) => x.group === 'Limita funkce');
  assert.equal(ch[0].title, 'Limita zlomku');
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const c = mountCustom(el, topics, { initial: 'limita/zlomek' });
  const q = (s) => el.querySelector(s);
  const set = (id, v) => { const i = q(`#vl-${id}`); i.value = v; i.dispatchEvent(new window.Event('input')); i.dispatchEvent(new window.Event('change')); };
  assert.ok(q('#vl-strana'));
  set('cit', '(x^2-1)'); set('jm', 'x-1'); set('bod', '1');
  assert.equal(q('[data-role="custom-preview"]').hidden, false);
  assert.ok(q('[data-role="custom-preview"]').textContent.includes('lim'));
  q('[data-role="custom-solve"]').click();
  assert.equal(q('[data-role="custom-error"]').textContent, '');
  assert.match(q('[data-role="custom-answer"]').textContent, /2/);
  assert.ok(q('[data-role="custom-steps"] .stepper'));
  set('bod', '∞');
  assert.equal(q('#vl-strana').closest('div').parentElement.hidden, true);
  c.destroy();
});

test('Limita zlomku: stránka vrátí hlášku při chybě', () => {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const c = mountCustom(el, topics, { initial: 'limita/zlomek' });
  el.querySelector('[data-role="custom-solve"]').click();
  assert.match(el.querySelector('[data-role="custom-error"]').textContent, /Vyplň/);
  c.destroy();
});
