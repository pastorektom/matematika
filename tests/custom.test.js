import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as mj from 'mathjs';
import { topics } from '../js/topics/index.js';
import { mountCustom, customChoices } from '../js/ui/custom.js';
import { termsOf, polyOf } from '../js/custom-input.js';

const type = (t, id) => topics.find((x) => x.id === t).types.find((x) => x.id === id);
const solve = (t, id, v) => { const ty = type(t, id); return ty.solve(ty.custom.build(v)); };
const bad = (t, id, v) => assert.throws(() => type(t, id).custom.build(v), (e) => e instanceof Error && e.message.length > 15 && !/undefined|TypeError|is not|Cannot/.test(e.message));
const S = (rows) => rows.map((r) => r.map(String));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const nearMat = (A, B) => A.forEach((r, i) => r.forEach((x, j) => near(x, B[i][j])));
const rankOf = (M) => { // nezávislý výpočet přes mj: počet nenulových singulárních čísel přes QR je zbytečný, použij eliminaci v mj.fraction
  const R = M.map((r) => r.map((x) => mj.fraction(x))); let rank = 0;
  for (let c = 0; c < R[0].length && rank < R.length; c++) {
    const p = R.findIndex((r, i) => i >= rank && !r[c].equals(0)); if (p < 0) continue;
    [R[rank], R[p]] = [R[p], R[rank]];
    for (let i = rank + 1; i < R.length; i++) { const k = mj.divide(R[i][c], R[rank][c]); R[i] = R[i].map((x, j) => mj.subtract(x, mj.multiply(k, R[rank][j]))); }
    rank++;
  }
  return rank;
};

test('determinanty: výsledek odpovídá math.js', () => {
  const A2 = [[1, 2], [3, 4]]; const A3 = [[2, 0, 1], [1, 3, 2], [1, 1, 1]];
  const A4 = [[2, 0, 1, 3], [1, 3, 2, 0], [1, 1, 1, 4], [0, 2, 5, 1]];
  const A5 = [[2, 0, 1, 3, 1], [1, 3, 2, 0, 1], [1, 1, 1, 4, 0], [0, 2, 5, 1, 2], [1, 1, 0, 0, 3]];
  assert.equal(solve('determinant', 'det2', { M: S(A2) }).answerSpec.value, Math.round(mj.det(A2)));
  assert.equal(solve('determinant', 'sarrus', { M: S(A3) }).answerSpec.value, Math.round(mj.det(A3)));
  assert.equal(solve('determinant', 'rozvoj', { M: S(A4) }).answerSpec.value, Math.round(mj.det(A4)));
  assert.equal(solve('determinant', 'rozvoj', { M: S(A5) }).answerSpec.value, Math.round(mj.det(A5)));
  const B4 = [[2, 1, 0, 1], [5, 3, 1, 0], [1, 0, 1, 1], [0, 1, 2, 3]];
  nearMat(solve('determinant', 'adjungovana', { M: S(B4) }).answerSpec.value, mj.inv(B4));
});

test('matice: součin, hodnost, inverze', () => {
  const A = [[1, 2, 3], [4, 5, 6]]; const B = [[1, 0], [0, 1], [2, -1]];
  nearMat(solve('matice', 'soucin', { A: S(A), B: S(B) }).answerSpec.value, mj.multiply(A, B));
  const R = [[1, 2, 3], [2, 4, 6], [1, 0, 1]];
  assert.equal(solve('matice', 'hodnost', { A: S(R) }).answerSpec.value, rankOf(R));
  const Q = [[2, 1, 0], [1, 3, 1], [0, 1, 2]];
  nearMat(solve('matice', 'inverzni', { A: S(Q) }).answerSpec.value, mj.inv(Q));
});

test('soustavy a vektory', () => {
  const p = solve('soustavy', 'gauss', { M: S([[1, 1, 1, 6], [2, -1, 1, 3], [1, 2, -1, 2]]) });
  assert.deepEqual(p.answerSpec.value, [1, 2, 3]);
  assert.equal(solve('soustavy', 'gauss', { M: S([[1, 1, 2], [2, 2, 5]]) }).answerSpec.value, 'none');
  assert.equal(solve('vektory', 'skalarni-soucin', { a: ['1', '2', '3'], b: ['4', '-5', '6'] }).answerSpec.value, 12);
});

test('derivace: odpověď se číselně shoduje s mathjs.derivative', () => {
  const check = (spec, f) => {
    const d = mj.derivative(f, 'x');
    for (const x of [0.7, 1.9, 3.3]) near(mj.evaluate(spec.value, { x }), d.evaluate({ x }));
  };
  const f1 = '3x^2-5x+1/x+sqrt(x)';
  check(solve('derivace', 'mocniny', { f: f1 }).answerSpec, f1);
  check(solve('derivace', 'soucin', { u: 'x^2+1', v: '3x-2' }).answerSpec, '(x^2+1)*(3x-2)');
  check(solve('derivace', 'podil', { u: 'x^2+1', v: 'x-2' }).answerSpec, '(x^2+1)/(x-2)');
  assert.deepEqual(polyOf('x^2-3x+2'), [2, -3, 1]);
  assert.equal(termsOf('(x+1)^2').length, 3);
});

test('limity: dosazení a rozklad', () => {
  assert.equal(solve('limita', 'dosazeni', { num: 'x^2-1', den: 'x+3', a: '2' }).answerSpec.value, '3/5');
  assert.equal(solve('limita', 'rozklad', { num: 'x^2-1', den: 'x-1', a: '1' }).answerSpec.value, '2');
  assert.equal(solve('limita', 'rozklad', { num: 'x^3+8', den: 'x^2+x-2', a: '-2' }).answerSpec.value, '-4');
});

test('neplatné vstupy vyhodí českou chybu', () => {
  bad('determinant', 'det2', { M: S([[1, 2], [3, 'a']]) });
  bad('determinant', 'det2', { M: [['1', '2'], ['3', '']] });
  bad('determinant', 'rozvoj', { M: S([[1, 2], [3, 4]]) });
  bad('determinant', 'adjungovana', { M: S([[1, 2], [2, 4]]) });
  bad('matice', 'inverzni', { A: S([[1, 2], [2, 4]]) });
  bad('matice', 'inverzni', { A: S([[1, 2, 3], [4, 5, 6]]) });
  bad('matice', 'soucin', { A: S([[1, 2]]), B: S([[1, 2]]) });
  bad('matice', 'hodnost', { A: S([[1000]]) });
  bad('matice', 'hodnost', { A: S(Array.from({ length: 6 }, () => [1])) });
  bad('vektory', 'skalarni-soucin', { a: ['1', '2'], b: ['1'] });
  bad('derivace', 'mocniny', { f: 'x^' });
  bad('derivace', 'mocniny', { f: 'sin(x)' });
  bad('derivace', 'mocniny', { f: 'y+1' });
  bad('derivace', 'mocniny', { f: 'x-x' });
  bad('limita', 'rozklad', { num: 'x^2-1', den: 'x+3', a: '1' });
  bad('limita', 'dosazeni', { num: 'x^2-1', den: 'x-1', a: '1' });
});

test('stránka Vlastní příklad: zadání, řešení, chyba', () => {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const c = mountCustom(el, topics, { initial: 'determinant/det2' });
  assert.ok(customChoices(topics).length >= 10);
  const q = (s) => el.querySelector(s);
  const cells = [...el.querySelectorAll('.matrix-input input')];
  assert.equal(cells.length, 4);
  q('[data-role="custom-solve"]').click();
  assert.match(q('[data-role="custom-error"]').textContent, /vyplň/);
  [1, 2, 3, 4].forEach((v, i) => { cells[i].value = String(v); });
  q('[data-role="custom-solve"]').click();
  assert.equal(q('[data-role="custom-error"]').textContent, '');
  assert.match(q('[data-role="custom-answer"]').textContent, /-2/);
  assert.ok(q('[data-role="custom-steps"] .stepper'));
  // výraz: přepnutí typu a živý náhled
  q('[data-role="type-derivace/mocniny"]').click();
  const input = q('input[id="vl-f"]');
  input.value = 'x^3';
  input.dispatchEvent(new window.Event('input'));
  assert.ok(q('.formula').textContent.includes('x'));
  q('[data-role="custom-solve"]').click();
  assert.match(q('[data-role="custom-answer"]').textContent, /3/);
  c.destroy();
});
