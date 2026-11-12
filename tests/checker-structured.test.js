import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../js/checker.js';

test('matrix: zlomky v buňkách, rozměr', () => {
  const s = { kind: 'matrix', value: [[1, 2], [3, 4]] };
  assert.equal(check(s, [['1', '2'], ['6/2', '4']]).ok, true);
  assert.equal(check(s, [['1', '2']]).ok, false);
  assert.equal(check(s, [['1', '2', '0'], ['3', '4', '0']]).reason, 'wrong');
  assert.equal(check(s, [['1', '2'], ['3', '5']]).reason, 'wrong');
  assert.equal(check(s, [['1', '2'], ['3', 'x(']]).reason, 'syntax');
});

test('vector: čárka, dimenze', () => {
  const s = { kind: 'vector', value: [0.5, 2, -1] };
  assert.equal(check(s, ['0,5', '4/2', '-1']).ok, true);
  assert.equal(check(s, ['0,5', '2']).reason, 'wrong');
  assert.equal(check(s, ['1', '2', '-1']).reason, 'wrong');
});

test('limit: nekonečno a neexistuje', () => {
  const dne = { kind: 'limit', value: 'DNE' };
  for (const i of ['neexistuje', 'DNE', 'dne', 'nex.', 'Neexistuje']) assert.equal(check(dne, i).ok, true, i);
  assert.equal(check(dne, '5').ok, false);
  const inf = { kind: 'limit', value: '∞' };
  for (const i of ['inf', 'oo', '∞', '+∞', 'Inf']) assert.equal(check(inf, i).ok, true, i);
  assert.equal(check(inf, '-∞').ok, false);
  assert.equal(check(inf, 'neexistuje').ok, false);
  const minf = { kind: 'limit', value: '-∞' };
  assert.equal(check(minf, '-inf').ok, true);
  assert.equal(check(minf, '-oo').ok, true);
  assert.equal(check({ kind: 'limit', value: 2 }, '4/2').ok, true);
  assert.equal(check({ kind: 'limit', value: 2 }, '∞').ok, false);
});

test('interval: české závorky, sjednocení', () => {
  const s = { kind: 'interval', value: '[-1,2)' };
  assert.equal(check(s, '<-1,2)').ok, true);
  assert.equal(check(s, '(-1,2)').ok, false);
  assert.equal(check(s, '<-1,2>').ok, false);
  const u = { kind: 'interval', value: '(-∞,2>∪(3,∞)' };
  assert.equal(check(u, '(-inf,2] U (3,oo)').ok, true);
  assert.equal(check(u, '(3,∞)∪(-∞,2>').ok, true);
  assert.equal(check(u, '(-∞,2)∪(3,∞)').ok, false);
  assert.equal(check(u, '(-∞,∞)').ok, false);
  assert.equal(check({ kind: 'interval', value: '[0,2]' }, '[0,1]∪[1,2]').ok, true);
  assert.equal(check({ kind: 'interval', value: '[0,2]' }, '[0,1)∪(1,2]').ok, false);
  assert.equal(check(u, '(1;').reason, 'syntax');
});

test('system: jedno řešení, žádné, parametr', () => {
  const uniq = { kind: 'system', value: [1, 2, 3] };
  assert.equal(check(uniq, '(1, 2, 3)').ok, true);
  assert.equal(check(uniq, '(1, 2, 4)').ok, false);
  assert.equal(check(uniq, 'nemá řešení').ok, false);
  const none = { kind: 'system', value: 'none' };
  assert.equal(check(none, 'nemá řešení').ok, true);
  assert.equal(check(none, '(1,2)').ok, false);
  const fam = { kind: 'system', value: '(t, 2t)' };
  assert.equal(check(fam, '(s/2*2, s*2)').ok, true);
  assert.equal(check(fam, '(t, 3t)').ok, false);
  assert.equal(check(fam, '(1, 2)').ok, false);
  assert.equal(check(fam, '(2u, 4u)').ok, true);
  const plane = { kind: 'system', value: '(1 - a - b, a, b)' };
  assert.equal(check(plane, '(p, 1 - p - q, q)').ok, true);
  assert.equal(check(plane, '(p, q, 1 - p - q)').ok, true);
  assert.equal(check(plane, '(p, q, 2 - p - q)').ok, false);
  assert.equal(check(plane, '(1, 0, 0)').ok, false);
  assert.equal(check(fam, '(t^2, t)').ok, false);
  assert.equal(check(fam, '(t,').reason, 'syntax');
});

test('list: neuspořádaná množina', () => {
  const s = { kind: 'list', value: [3, 1] };
  assert.equal(check(s, '1,3').ok, true);
  assert.equal(check(s, '{3; 1}').ok, true);
  assert.equal(check(s, '1').ok, false);
  assert.equal(check(s, '1,3,5').ok, false);
  assert.equal(check(s, '1,x(').reason, 'syntax');
});

test('Unicode: odmocnina, násobení, mínus', () => {
  const n = { kind: 'number', value: Math.SQRT2 };
  assert.equal(check(n, '√2').ok, true);
  assert.equal(check({ kind: 'number', value: 6 }, '2·3').ok, true);
  assert.equal(check({ kind: 'number', value: 6 }, '2×3').ok, true);
  assert.equal(check({ kind: 'number', value: -3 }, '−3').ok, true);
  const e = { kind: 'expression', value: 'sqrt(x+1)', variable: 'x' };
  assert.equal(check(e, '√(x+1)').ok, true);
  assert.equal(check({ kind: 'expression', value: '2*x', variable: 'x' }, '2·x').ok, true);
});

test('omezený jmenný prostor: nebezpečné funkce jsou syntax', () => {
  const n = { kind: 'number', value: 1 };
  const e = { kind: 'expression', value: 'x', variable: 'x' };
  for (const bad of ['import({})', 'createUnit("foo")', 'evaluate("1")', 'parse("1")', 'simplify("x")', 'derivative("x","x")']) {
    assert.deepEqual(check(n, bad), { ok: false, reason: 'syntax' }, bad);
    assert.deepEqual(check(e, bad), { ok: false, reason: 'syntax' }, bad);
  }
});

test('nekonečné výsledky jsou wrong, ne syntax', () => {
  const n = { kind: 'number', value: 1 };
  assert.deepEqual(check(n, '1/0'), { ok: false, reason: 'wrong' });
  assert.equal(check(n, '0/0').reason, 'wrong');
  assert.equal(check(n, 'abc((').reason, 'syntax');
});

test('whiteboard zůstává unsupported', () => {
  assert.deepEqual(check({ kind: 'whiteboard' }, 'x'), { ok: false, reason: 'unsupported' });
});

test('system: nekonečně mnoho řešení se rozpozná', () => {
  const fam = { kind: 'system', value: '(t, 2t)' };
  for (const i of ['nekonečně mnoho řešení', 'Nekonecne mnoho reseni', 'nekonečně mnoho', '∞ řešení']) {
    assert.deepEqual(check(fam, i), { ok: false, reason: 'wrong', normalized: 'infinite' }, i);
  }
  assert.deepEqual(check({ kind: 'system', value: [1, 2] }, 'nekonečně mnoho řešení'), { ok: false, reason: 'wrong' });
  assert.deepEqual(check({ kind: 'system', value: 'none' }, 'nekonečně mnoho'), { ok: false, reason: 'wrong' });
  const none = { kind: 'system', value: 'none' };
  for (const i of ['nemá žádné řešení', 'nemá řešení', 'žádné řešení', 'neexistuje', 'Nema reseni']) {
    assert.equal(check(none, i).ok, true, i);
  }
  assert.equal(check(fam, 'nemá žádné řešení').ok, false);
});

test('limit: Unicode minus a české nekonečno', () => {
  const minf = { kind: 'limit', value: '-∞' };
  for (const i of ['−∞', '−inf', '−oo', '–∞', '—oo', '-nekonečno', '-nekonecno', 'minus nekonečno', 'mínus nekonečno']) {
    assert.equal(check(minf, i).ok, true, i);
  }
  const inf = { kind: 'limit', value: '∞' };
  for (const i of ['nekonečno', 'nekonecno', '+nekonečno']) assert.equal(check(inf, i).ok, true, i);
  assert.equal(check(inf, '-nekonečno').ok, false);
});

test('seznam a n-tice: desetinná čárka vs. oddělovač', () => {
  assert.equal(check({ kind: 'list', value: [0.5] }, '0,5').ok, true);
  assert.equal(check({ kind: 'list', value: [0.5, 2] }, '0,5; 2').ok, true);
  assert.equal(check({ kind: 'list', value: [0.5, 2] }, '0,5, 2').ok, true);
  assert.equal(check({ kind: 'list', value: [0, 5] }, '0,5').ok, true);
  assert.equal(check({ kind: 'list', value: [0.5] }, '0,6').ok, false);
  const sys = { kind: 'system', value: [0.5, 2] };
  assert.equal(check(sys, '(0,5; 2)').ok, true);
  assert.equal(check(sys, '(0,5, 2)').ok, true);
  assert.equal(check({ kind: 'system', value: [0, 5] }, '(0,5)').ok, true);
  assert.equal(check({ kind: 'system', value: [0.5] }, '0,5').ok, true);
});

test('system: tolerance řešení je přísná (1e-7 neprojde)', () => {
  const s = { kind: 'system', value: [1, 2, 3] };
  assert.equal(check(s, '(1, 2, 3.0000001)').ok, false);
  assert.equal(check(s, '(1, 2, 3.0000000000001)').ok, true);
});

test('interval: krajní body s ln, e, π, odmocninou', () => {
  assert.equal(check({ kind: 'interval', value: '(e; ∞)' }, '(e; ∞)').ok, true);
  assert.equal(check({ kind: 'interval', value: '(exp(1), inf)' }, '(e; ∞)').ok, true);
  assert.equal(check({ kind: 'interval', value: '[3pi/2, inf)' }, '<3π/2; ∞)').ok, true);
  assert.equal(check({ kind: 'interval', value: '[3pi/2, inf)' }, '(3π/2; ∞)').ok, false);
  assert.equal(check({ kind: 'interval', value: '(-inf, log(2)]' }, '(−∞; ln 2>').ok, true);
  assert.equal(check({ kind: 'interval', value: '(-inf, log(2)]' }, '(−∞; ln(2)>').ok, true);
  assert.equal(check({ kind: 'interval', value: '(-inf, log(2)]' }, '(−∞; ln 3>').ok, false);
  assert.equal(check({ kind: 'interval', value: '(-sqrt(2), sqrt(2))' }, '(−√2; √2)').ok, true);
  assert.equal(check({ kind: 'interval', value: '(-sqrt(2), sqrt(2))' }, '(−√(2); √(2))').ok, true);
  assert.equal(check({ kind: 'interval', value: '(1, 8)' }, '(e^0; 2^3)').ok, true);
  assert.equal(check({ kind: 'interval', value: '(1, 8)' }, '(ln(;').reason, 'syntax');
});

test('interval: prázdná množina', () => {
  for (const value of ['empty', [], '∅']) {
    const s = { kind: 'interval', value };
    for (const ok of ['∅', 'Ø', 'prázdná množina', 'prazdna mnozina', 'neexistuje', '{}', ' { } ', '\emptyset']) {
      assert.equal(check(s, ok).ok, true, `${JSON.stringify(value)} ~ ${ok}`);
    }
    assert.equal(check(s, '(0; 1)').ok, false);
    assert.equal(check(s, '{0}').ok, false);
  }
  assert.equal(check({ kind: 'interval', value: '(0, 1)' }, '∅').ok, false);
  assert.equal(check({ kind: 'interval', value: '(0, 1)' }, '∅').reason, 'wrong');
});

test('interval: desetinné přiblížení iracionálního krajního bodu (na 3 desetinná místa)', () => {
  const s = { kind: 'interval', value: '[3pi/2, inf)' };
  assert.equal(check(s, '<4.712; ∞)').ok, true);
  assert.equal(check(s, '<4,712; ∞)').ok, true);
  assert.equal(check(s, '<4.7124; ∞)').ok, true);
  assert.equal(check(s, '<4.71; ∞)').ok, false);
  assert.equal(check(s, '<4.72; ∞)').ok, false);
  assert.equal(check(s, '(4.712; ∞)').ok, false, 'závorka musí sedět');
  assert.equal(check({ kind: 'interval', value: '(-inf, log(2)]' }, '(-∞; 0.693>').ok, true);
  // racionální krajní body se porovnávají přesně
  assert.equal(check({ kind: 'interval', value: '(1/3, 2)' }, '(0.333; 2)').ok, false);
  assert.equal(check({ kind: 'interval', value: '(0.5, 2)' }, '(0.5004; 2)').ok, false);
  assert.equal(check({ kind: 'interval', value: '(sqrt(4), 3)' }, '(2.0004; 3)').ok, false);
});
