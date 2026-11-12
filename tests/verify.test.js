// Testy sdílené kontroly témat (tests/helpers/verify.js) na malých vložených tématech.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, checkProblem, asInput, negativeDenominators } from './helpers/verify.js';

const steps = (result) => [
  { title: 'a', text: 'První krok postupu.', board: [{ tex: 'x=1' }] },
  { title: 'b', text: 'Druhý krok postupu.', board: [{ tex: 'x=2' }] },
  { title: 'c', text: 'Třetí krok s výsledkem.', board: [{ tex: `=${result}` }] },
];

function topicOf(type) { return { id: 'pokus', title: 'Pokus', types: [type] }; }

test('asInput: seznam se spojí středníkem, soustava v závorkách', () => {
  assert.equal(asInput([1, -2, 0.5], 'list'), '1; -2; 0.5');
  assert.equal(asInput([1, 2], 'system'), '(1; 2)');
  assert.deepEqual(asInput([1, 2], 'vector'), ['1', '2']);
  assert.equal(asInput(3, 'number'), '3');
});

test('verify: druh list projde (pole -> text pro kontrolu)', () => {
  const t = topicOf({ id: 'koreny', generate(rng) {
    const a = 1 + Math.floor(rng() * 50);
    return { type: 'koreny', promptTex: `x^2=${a * a}`, answerSpec: { kind: 'list', value: [-a, a] }, answerTex: `\\pm ${a}`, data: { a }, solution: steps(`\\pm ${a}`) };
  } });
  const r = verify(t, 40, { oracles: { koreny: (d) => [d.a, -d.a] } });
  assert.equal(r.generated, 40);
});

test('verify: druh whiteboard (bez kontroly odpovědi, ale postup s výsledkem)', () => {
  const t = topicOf({ id: 'nakresli', generate(rng) {
    const a = 1 + Math.floor(rng() * 50);
    return { type: 'nakresli', promptTex: `y=${a}x`, answerSpec: { kind: 'whiteboard' }, answerTex: `\\text{přímka }${a}`, solution: steps(`\\text{přímka }${a}`) };
  } });
  assert.equal(verify(t, 40).generated, 40);
  const bad = { type: 'nakresli', promptTex: 'y=x', answerSpec: { kind: 'whiteboard' }, answerTex: 'X', solution: steps('Y') };
  assert.throws(() => checkProblem(bad, {}, 'b'), /výsledek/);
  assert.throws(() => checkProblem({ ...bad, solution: [] }, {}, 'b'), /méně než 3/);
});

test('verify: pevné příklady bez generátoru (jen solve, nebo úplně hotové)', () => {
  const t = {
    id: 'pevne',
    types: [{ id: 'jen-solve', solve: (d) => ({ promptTex: `${d.a}+1`, answerSpec: { kind: 'number', value: d.a + 1 }, answerTex: `${d.a + 1}`, solution: steps(`${d.a + 1}`) }) }],
  };
  const fixed = [
    { id: 'p1', type: 'jen-solve', data: { a: 4 }, source: 'Sbírka' },
    { id: 'p2', type: 'syrovy', promptTex: '2\\cdot 3', answerSpec: { kind: 'number', value: 6 }, answerTex: '6', solution: steps('6'), source: 'Sbírka' },
  ];
  const r = verify(t, 10, { oracles: { 'jen-solve': (d) => d.a + 1 }, fixed });
  assert.deepEqual(r, { generated: 0, fixed: 2 });
  // hotový příklad se špatnou odpovědí neprojde
  assert.throws(() => verify(t, 10, { fixed: [{ ...fixed[1], answerSpec: { kind: 'number', value: 'x' } }] }));
});

test('negativeDenominators: přímý i závorkovaný záporný jmenovatel, vnořené složené závorky', () => {
  const plain = (s) => negativeDenominators(s).filter((d) => !d.parenthesised).length;
  const par = (s) => negativeDenominators(s).filter((d) => d.parenthesised).length;
  assert.equal(plain('\\frac{1}{-2}'), 1);
  assert.equal(plain('\\frac{x^{2}}{-2}'), 1, 'čitatel se složenými závorkami');
  assert.equal(plain('\\frac{\\frac{1}{2}}{- 3}'), 1);
  assert.equal(plain('\\dfrac{1}{\\htmlClass{bt-v}{-3}}'), 1);
  assert.equal(par('\\frac{x}{(-3)}'), 1);
  assert.equal(par('\\frac{x}{\\left(-3\\right)}'), 1);
  assert.equal(par('\\frac{x^{2}+1}{(-(x+1))}'), 1);
  assert.equal(negativeDenominators('\\frac{-1}{2}').length, 0);
  assert.equal(negativeDenominators('\\frac{1}{2-x}').length, 0);
  assert.equal(negativeDenominators('\\frac{1}{(2)(-x)}').length, 0);
  assert.equal(negativeDenominators('\\frac{1}{{-2}}').length, 1);
  assert.equal(negativeDenominators('\\frac{1}{x}-\\frac{2}{-x}').length, 1);
  // nevyvážené závorky nic nehlásí (ani nespadne)
  assert.equal(negativeDenominators('\\frac{1{-2}').length, 0);
});

test('checkProblem: závorkovaný záporný jmenovatel jen s volbou strictDenominators', () => {
  const p = { type: 'z', promptTex: 'z', answerSpec: { kind: 'number', value: 1 }, answerTex: '1', data: {},
    solution: [...steps('1').slice(0, 2), { title: 'c', text: 'Třetí krok s výsledkem.', board: [{ tex: '\\frac{-3}{(-3)}=1' }] }] };
  const oracles = { z: () => 1 };
  checkProblem(p, oracles, 'mírná');
  assert.throws(() => checkProblem(p, oracles, 'přísná', { strictDenominators: true }), /záporný jmenovatel/);
  // čitatel se složenými závorkami: dříve mezera v regulárním výrazu, teď jen v přísném režimu
  const braces = { ...p, solution: [...p.solution.slice(0, 2), { title: 'c', text: 'Třetí krok s výsledkem.', board: [{ tex: '\\frac{x^{2}}{-3}=1' }] }] };
  checkProblem(braces, oracles, 'mírná');
  assert.throws(() => checkProblem(braces, oracles, 'přísná', { strictDenominators: true }), /záporný jmenovatel/);
  // přímý záporný jmenovatel hlídá i mírná kontrola
  const direct = { ...p, solution: [...p.solution.slice(0, 2), { title: 'c', text: 'Třetí krok s výsledkem.', board: [{ tex: '\\frac{3}{-3}=1' }] }] };
  assert.throws(() => checkProblem(direct, oracles, 'přímý'), /záporný jmenovatel/);
});

test('negativeDenominators: dosazené záporné číslo v mnohočlenu není záporný jmenovatel', () => {
  assert.equal(negativeDenominators('\frac{1}{(-3)^{2}+8\cdot (-3)+15}').length, 0);
  assert.equal(negativeDenominators('\frac{1}{(-3)(x+1)}').length, 0);
  assert.equal(negativeDenominators('\frac{1}{(-3)\cdot 2}').length, 0);
});
