import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../js/checker.js';

test('number: zlomek, čárka, mezery', () => {
  const s = { kind: 'number', value: 0.5 };
  assert.equal(check(s, '2/4').ok, true);
  assert.equal(check(s, '0,5').ok, true);
  assert.equal(check(s, ' 1/2 ').ok, true);
  assert.equal(check(s, '0.51').ok, false);
  assert.equal(check(s, '0.51').reason, 'wrong');
});

test('expression: ekvivalentní tvary', () => {
  const s = { kind: 'expression', value: 'x^2+x', variable: 'x' };
  assert.equal(check(s, 'x*(x+1)').ok, true);
  assert.equal(check(s, 'x^2+x+1').ok, false);
});

test('syntaktické chyby nehází výjimku', () => {
  const s = { kind: 'expression', value: 'x^2+x', variable: 'x' };
  assert.deepEqual(check(s, 'abc(('), { ok: false, reason: 'syntax' });
  assert.equal(check(s, '').reason, 'syntax');
  assert.equal(check({ kind: 'number', value: 1 }, '').reason, 'syntax');
  assert.equal(check({ kind: 'number', value: 1 }, 'abc((').reason, 'syntax');
});

test('nepodporované druhy', () => {
  for (const kind of ['whiteboard', 'foo']) {
    assert.deepEqual(check({ kind, value: 1 }, '1'), { ok: false, reason: 'unsupported' });
  }
});

test('π se čte jako pi (obecně)', () => {
  assert.equal(check({ kind: 'number', value: Math.PI / 2 }, 'π/2').ok, true);
  assert.equal(check({ kind: 'number', value: 2 * Math.PI }, '2π').ok, true);
  assert.equal(check({ kind: 'expression', value: 'pi*x', variable: 'x' }, 'π x').ok, true);
});

test('úhel ve stupních (unit: deg): stupně i radiány', () => {
  const s = { kind: 'number', value: 30, unit: 'deg' };
  for (const ok of ['30', '30°', '30 °', ' 30° ', 'π/6', 'pi/6', 'pi / 6']) assert.equal(check(s, ok).ok, true, ok);
  for (const bad of ['60', 'π/3', '0.5236']) assert.equal(check(s, bad).ok, false, bad);
  assert.equal(check(s, '°').reason, 'syntax');
  assert.equal(check({ kind: 'number', value: 135, unit: 'deg' }, '3π/4').ok, true);
  assert.equal(check({ kind: 'number', value: 90, unit: 'deg' }, '90°').ok, true);
  // bez jednotky se nic nepřevádí
  assert.equal(check({ kind: 'number', value: 30 }, 'π/6').ok, false);
});

// Výrazy s úzkým definičním oborem: kontrola je deterministická (pevná síť bodů, žádné Math.random)
// a správný ekvivalentní tvar projde vždy, špatný nikdy.
const NARROW = [
  { value: 'acos(exp(x))', same: ['acos(e^x)'], bad: ['acos(exp(x)) + 0.001', 'asin(exp(x))'] },
  { value: 'ln(ln(x-3))', same: ['log(log(x-3))', 'ln(ln(x - 3))'], bad: ['ln(ln(x-2))', 'ln(x-3)'] },
  { value: 'sqrt(x-4)/(x-5)', same: ['(x-4)^(1/2)/(x-5)', '√(x-4)/(x-5)'], bad: ['sqrt(x-4)/(x+5)', 'sqrt(x-3)/(x-5)'] },
  { value: 'sqrt(x-4.5)', same: ['sqrt(2x-9)/sqrt(2)'], bad: ['sqrt(x-4.4)'] },
  { value: 'asin(x^2-3)', same: ['asin(x*x-3)'], bad: ['asin(x^2-3.01)'] },
  { value: 'ln(1-x^2)', same: ['ln(1-x)+ln(1+x)'], bad: ['ln(1+x^2)'] },
  { value: 'sqrt(0.0004-x^2)', same: ['sqrt((0.02-x)*(0.02+x))'], bad: ['sqrt(0.0004-x^2)*1.01'] },
];

test('expression: úzké definiční obory (acos(e^x), ln(ln(x−3)), √(x−4)/…)', () => {
  for (const { value, same, bad } of NARROW) {
    const s = { kind: 'expression', value, variable: 'x' };
    for (const u of same) assert.equal(check(s, u).ok, true, `${value} ~ ${u}`);
    for (const u of bad) assert.equal(check(s, u).ok, false, `${value} !~ ${u}`);
  }
});

test('expression: 200 opakování na úzkých oborech, žádné selhání', () => {
  const orig = Math.random;
  let calls = 0;
  Math.random = () => { calls++; return orig(); };
  try {
    for (const { value, same } of NARROW) {
      const s = { kind: 'expression', value, variable: 'x' };
      let failed = 0;
      for (let i = 0; i < 200; i++) if (!check(s, same[0]).ok) failed++;
      assert.equal(failed, 0, `${value}: ${failed} selhání z 200`);
    }
  } finally { Math.random = orig; }
  assert.equal(calls, 0, 'kontrola výrazu nepoužívá Math.random');
});

test('expression: méně než 3 platné body -> jen strukturně shodný zápis', () => {
  // definováno jen v x = 2 (a okolí v rámci zaokrouhlení) – ekvivalenci nejde ověřit čísly
  const s = { kind: 'expression', value: 'sqrt(-(x-2)^2)', variable: 'x' };
  assert.equal(check(s, 'sqrt(-(x-2)^2)').ok, true);
  assert.equal(check(s, 'sqrt( - (x - 2)^2 )').ok, true);
  assert.equal(check(s, '0').ok, false);
  assert.equal(check({ kind: 'expression', value: 'sqrt(-x^2-1)', variable: 'x' }, '5').ok, false);
});

test('expression: hodnoty na širším rozsahu (x > 5) se také porovnávají', () => {
  const s = { kind: 'expression', value: 'sqrt(x-10)', variable: 'x' };
  assert.equal(check(s, 'sqrt(x-10)').ok, true);
  assert.equal(check(s, 'sqrt(x-11)').ok, false);
  assert.equal(check({ kind: 'expression', value: 'x^2', variable: 'x' }, 'x^2 + (x > 7 ? 1 : 0)').ok, false);
});
