import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { makeRng, randomSeed } from '../js/rng.js';
import { mountPractice } from '../js/ui/practice.js';
import { matrixInput } from '../js/ui/inputs.js';
import { parseRoute, routeHref } from '../js/router.js';

function setup(extra = {}, topicOver = {}) {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const calls = [];
  const nav = [];
  const topic = {
    id: 't', title: 'T', order: 1, theory: [],
    types: [
      { id: 'a', title: 'Typ A', generate(rng) {
        const n = 1 + Math.floor(rng() * 1000);
        return { id: `a-${n}`, topic: 't', type: 'a', seed: 0, promptTex: `${n}+2`, answerSpec: { kind: 'number', value: n + 2 }, solution: [{ title: 'k', text: 'x' }] };
      } },
      { id: 'm', title: 'Matice', generate() {
        return { id: 'm', topic: 't', type: 'm', seed: 0, promptTex: 'I', answerSpec: { kind: 'matrix', value: [[1, 0], [0, 1]] }, solution: [] };
      } },
    ],
    ...topicOver,
  };
  const p = mountPractice(el, topic, {
    record: (a) => { calls.push(a); return Promise.resolve({}); },
    navigate: (r) => nav.push(r),
    rng: makeRng(7),
    ...extra,
  });
  const q = (s) => el.querySelector(s);
  const type = (v) => { const i = q('[data-role="answer"] input'); i.value = v; return i; };
  const click = (role) => q(`[data-role="${role}"]`).click();
  return { window, el, calls, nav, p, q, type, click };
}

test('špatná odpověď: zapíše se correct:false a příklad zůstane', () => {
  const { calls, q, type, click } = setup();
  q('[data-role="type-a"]').click();
  const before = q('.prompt').textContent;
  type('0');
  click('check');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].correct, false);
  assert.equal(calls[0].topic, 't');
  assert.equal(calls[0].type, 'a');
  assert.equal(typeof calls[0].ms, 'number');
  assert.equal(q('.prompt').textContent, before);
  assert.match(q('[data-role="feedback"]').textContent, /Zatím ne – zkus to znovu\./);
  assert.equal(q('[data-role="feedback"]').getAttribute('aria-live'), 'polite');
});

test('správná odpověď: Správně! a zápis correct:true', () => {
  const { calls, q, type, click, p } = setup();
  q('[data-role="type-a"]').click();
  const n = Number(q('.prompt').textContent.match(/(\d+)\+2/)[1]);
  type(String(n + 2));
  click('check');
  assert.equal(calls[0].correct, true);
  assert.match(q('[data-role="feedback"]').textContent, /Správně!/);
  assert.equal(calls[0].seed, p.problem.seed);
});

test('Enter odešle odpověď', () => {
  const { calls, window, type } = setup();
  const i = type('1');
  i.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(calls.length, 1);
});

test('syntaktická chyba se nezapisuje', () => {
  const { calls, q, type, click } = setup();
  q('[data-role="type-a"]').click();
  type('2+*(');
  click('check');
  assert.equal(calls.length, 0);
  assert.match(q('[data-role="feedback"]').textContent, /Tomu zápisu nerozumím/);
});

test('prázdná odpověď se nezapisuje', () => {
  const { calls, click } = setup();
  click('check');
  assert.equal(calls.length, 0);
});

test('Ukaž výsledek: zápis jako nezodpovězený (correct:false, revealed:true), ne správně', () => {
  const { calls, q, click } = setup();
  q('[data-role="type-a"]').click();
  click('reveal');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].correct, false);
  assert.equal(JSON.parse(calls[0].answer).revealed, true);
  assert.ok(q('[data-role="reveal-box"]').textContent.length > 0);
  assert.doesNotMatch(q('[data-role="feedback"]').textContent, /Správně/);
});

test('Další příklad vytvoří nový příklad s jiným seedem', () => {
  const { p, click } = setup();
  const s1 = p.problem.seed;
  click('next');
  assert.notEqual(p.problem.seed, s1);
});

test('Ukaž postup předá téma, seed a typ', () => {
  const { p, nav, click } = setup();
  click('solution');
  assert.deepEqual(nav, [{ id: 't', seed: p.problem.seed, type: p.problem.type }]);
});

test('stejný seed dá stejný příklad (výběr typu je funkcí seedu)', () => {
  const a = setup({ rng: makeRng(5) });
  const b = setup({ rng: makeRng(5) });
  assert.equal(a.q('.prompt').textContent, b.q('.prompt').textContent);
  assert.equal(a.p.problem.seed, b.p.problem.seed);
});

test('matice: mřížka políček a odpověď jako pole polí', () => {
  const { calls, q, click } = setup();
  q('[data-role="type-m"]').click();
  const cells = [...q('[data-role="answer"]').querySelectorAll('input')];
  assert.equal(cells.length, 4);
  ['1', '0', '0', '1'].forEach((v, i) => { cells[i].value = v; });
  click('check');
  assert.equal(calls[0].correct, true);
});

test('matrixInput(rows, cols)', () => {
  const { window } = new JSDOM('<!doctype html><body></body>');
  const m = matrixInput(2, 3, window.document);
  const cells = m.el.querySelectorAll('input');
  assert.equal(cells.length, 6);
  cells[4].value = '7';
  assert.deepEqual(m.getValue(), [['', '', ''], ['', '7', '']]);
  for (const c of cells) {
    assert.equal(c.getAttribute('autocapitalize'), 'off');
    assert.equal(c.getAttribute('autocomplete'), 'off');
    assert.equal(c.getAttribute('spellcheck'), 'false');
  }
});

test('nekonečně mnoho řešení: zvláštní hláška', () => {
  const t = { id: 's', title: 'S', order: 1, theory: [], types: [{ id: 's', title: 'S', generate: () => ({
    id: 's', topic: 's', type: 's', seed: 0, promptTex: 'x', solution: [],
    answerSpec: { kind: 'system', value: [], parametric: true },
  }) }] };
  const { q, type, click } = setup({ check: () => ({ ok: false, reason: 'wrong', normalized: 'infinite' }) }, t);
  type('nekonečně mnoho řešení');
  click('check');
  assert.match(q('[data-role="feedback"]').textContent, /řešení je nekonečně mnoho/);
});

test('rng: makeRng je deterministický a v [0,1)', () => {
  const a = makeRng(42); const b = makeRng(42);
  const xs = Array.from({ length: 5 }, a); const ys = Array.from({ length: 5 }, b);
  assert.deepEqual(xs, ys);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, Array.from({ length: 5 }, makeRng(43)));
  const s = randomSeed();
  assert.ok(Number.isInteger(s) && s >= 0);
});

test('router: query seed a type', () => {
  assert.deepEqual(parseRoute('#/tema/m/postup?seed=12&type=a'), { name: 'topic', id: 'm', tab: 'postup', query: { seed: 12, type: 'a' } });
  assert.deepEqual(parseRoute('#/tema/m/postup'), { name: 'topic', id: 'm', tab: 'postup' });
  assert.equal(routeHref('m', 'postup', { seed: 12, type: 'a' }), '#/tema/m/postup?seed=12&type=a');
});

test('infinite: nezapisuje se a pole zůstane otevřené', () => {
  const t = { id: 's', title: 'S', order: 1, theory: [], types: [{ id: 's', title: 'S', generate: () => ({
    id: 's', topic: 's', type: 's', seed: 0, promptTex: 'x', solution: [], answerSpec: { kind: 'system', value: [] },
  }) }] };
  const { q, calls, type, click } = setup({ check: () => ({ ok: false, reason: 'wrong', normalized: 'infinite' }) }, t);
  type('nekonečně mnoho řešení');
  click('check');
  assert.equal(calls.length, 0);
  assert.equal(q('[data-role="answer"] input').disabled, false);
  assert.doesNotMatch(q('[data-role="feedback"]').className, /wrong/);
});

test('po správné odpovědi je Ukaž výsledek zakázáno a nezapíše druhý pokus', () => {
  const { calls, q, type, click } = setup();
  q('[data-role="type-a"]').click();
  const n = Number(q('.prompt').textContent.match(/(\d+)\+2/)[1]);
  type(String(n + 2));
  click('check');
  assert.equal(q('[data-role="reveal"]').disabled, true);
  click('reveal');
  assert.equal(calls.length, 1);
  assert.equal(q('[data-role="solution"]').disabled, false);
});

test('matice s prázdným políčkem se nezapíše', () => {
  const { calls, q, click } = setup();
  q('[data-role="type-m"]').click();
  q('[data-role="answer"] input').value = '1';
  click('check');
  assert.equal(calls.length, 0);
  assert.match(q('[data-role="feedback"]').textContent, /Nejdřív něco zadej/);
});

test('panel znaků: u intervalu navíc <, >, ∪, ∅, ln, e; u čísla ne', () => {
  const extra = ['<', '>', '∪', '∅', 'ln', 'e'];
  const labels = (el) => [...el.querySelectorAll('.symbol-panel .sym-btn')].map((b) => b.textContent);
  const iv = setup({ coarse: true }, { types: [{ id: 'i', title: 'Interval', generate() {
    return { id: 'i', topic: 't', type: 'i', seed: 0, promptTex: 'x>0', answerSpec: { kind: 'interval', value: '(0,inf)' }, solution: [] };
  } }] });
  const got = labels(iv.el);
  for (const s of [...extra, '√', 'π', '∞', '(', ')']) assert.ok(got.includes(s), `chybí ${s}: ${got}`);
  // tlačítko vloží znak do pole
  const input = iv.q('[data-role="answer"] input');
  input.focus();
  [...iv.el.querySelectorAll('.sym-btn')].find((b) => b.textContent === '∪').click();
  [...iv.el.querySelectorAll('.sym-btn')].find((b) => b.textContent === 'ln').click();
  assert.equal(input.value, '∪ln()');
  const num = setup({ coarse: true });
  const plain = labels(num.el);
  for (const s of extra) assert.ok(!plain.includes(s), `u čísla navíc ${s}`);
  assert.ok(plain.includes('√'));
});

test('promptViz: graf pod zadáním v rámu tabule, u dalšího příkladu se uvolní', () => {
  let n = 0;
  const { el, q, click } = setup({}, { types: [{ id: 'g', title: 'Graf', generate() {
    n++;
    const viz = n === 1 ? { kind: 'plot', data: { domain: [-2, 2], functions: [{ expr: 'x^2' }] } } : undefined;
    return { id: `g${n}`, topic: 't', type: 'g', seed: 0, promptTex: 'f(x)=x^2', answerSpec: { kind: 'number', value: 1 }, solution: [], promptViz: viz };
  } }] });
  const frame = q('.prompt .board.viz-board');
  assert.ok(frame, 'graf v zadání');
  assert.ok(frame.querySelector('svg path'));
  const kids = [...q('.prompt').children];
  assert.ok(kids.findIndex((k) => k.contains(frame)) > kids.findIndex((k) => k.classList.contains('formula')), 'pod vzorcem');
  click('next');
  assert.equal(el.querySelectorAll('.viz-board').length, 0, 'další příklad bez grafu');
});

test('promptViz: vadná data zadání nerozbijí', () => {
  const { q } = setup({}, { types: [{ id: 'g', title: 'Graf', generate() {
    return { id: 'g', topic: 't', type: 'g', seed: 0, promptTex: 'x', answerSpec: { kind: 'number', value: 1 }, solution: [], promptViz: { kind: 'plot', data: {} } };
  } }] });
  assert.equal(q('.prompt .viz-board'), null);
  assert.ok(q('.prompt .formula'));
  assert.ok(q('[data-role="answer"] input'));
});

test('generátor, který selže: zmizí staré políčko, ukáže se hláška a „Další příklad“ vytvoří nový', () => {
  let calls = 0;
  const gen = () => {
    calls++;
    if (calls === 2) throw new Error('rozbitý generátor');
    return { id: `a${calls}`, topic: 't', type: 'a', seed: 0, promptTex: '1+1', answerSpec: { kind: 'number', value: 2 }, solution: [] };
  };
  const { q, click } = setup({}, { types: [{ id: 'a', title: 'Typ A', generate: gen }] });
  assert.ok(q('[data-role="answer"] input'));
  click('next'); // druhé volání selže
  assert.equal(q('[data-role="answer"]'), null, 'staré políčko nesmí zůstat');
  assert.match(q('[data-role="feedback"]').textContent, /Příklad se nepodařilo vytvořit – zkus další/);
  assert.equal(q('[data-role="check"]').disabled, true);
  click('retry');
  assert.ok(q('[data-role="answer"] input'));
  assert.equal(q('[data-role="feedback"]').textContent, '');
  assert.equal(q('[data-role="check"]').disabled, false);
});
