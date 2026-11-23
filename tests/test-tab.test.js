import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { topics } from '../js/topics/index.js';
import { check } from '../js/checker.js';
import { parseRoute } from '../js/router.js';
import {
  buildTest, testPool, PARTS, normalizeConfig, encodeConfig, decodeConfig,
  percent, isPassed, remainingMs, isExpired, formatClock, isWarning, announceMark,
} from '../js/test.js';
import { mountTest } from '../js/ui/test.js';

const ALL = PARTS.map((p) => p.id);
const KINDS = new Set(['limit', 'expression', 'number']);
const combos = [];
for (const level of ['easy', 'hard', 'mix']) {
  for (const parts of [ALL, ['limity'], ['der1'], ['der2'], ['limity', 'der2']]) combos.push({ parts, level });
}
const input = (spec) => String(spec.value);

test('pool: každá část a úroveň má aspoň jeden typ', () => {
  const pool = testPool(topics);
  for (const part of ALL) for (const level of [1, 2]) assert.ok(pool.some((p) => p.part === part && (p.level === level || p.level === 0)), `${part}/${level}`);
});

test('sestavení: přesný počet, kontrolovatelné druhy, rovnoměrně, deterministicky, bez duplicit', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { parts, level } = combos[seed % combos.length];
    const count = [5, 10, 15, 20][seed % 4];
    const qs = buildTest(topics, seed, { parts, level, count });
    assert.equal(qs.length, count);
    assert.deepEqual(qs.map((q) => q.problem.promptTex), buildTest(topics, seed, { parts, level, count }).map((q) => q.problem.promptTex));
    const per = parts.map((p) => qs.filter((q) => q.part === p).length);
    assert.ok(Math.max(...per) - Math.min(...per) <= 1, `rozdělení ${per}`);
    const sigs = new Set(qs.map((q) => `${q.type}|${q.problem.promptTex}|${q.problem.task ?? ''}`));
    assert.equal(sigs.size, count, 'duplicity');
    for (const q of qs) assert.ok(KINDS.has(q.problem.answerSpec.kind), q.type);
    if (level !== 'mix') assert.ok(qs.every((q) => q.level === (level === 'easy' ? 1 : 2)));
  }
});

test('dokonalý student má 100 %, prázdná a špatná odpověď 0', () => {
  for (const { parts, level } of combos) {
    for (let seed = 1; seed <= 8; seed++) {
      for (const q of buildTest(topics, seed * 7919, { parts, level, count: 20 })) {
        assert.equal(check(q.problem.answerSpec, input(q.problem.answerSpec)).ok, true, `${q.type} ${q.problem.promptTex}`);
        assert.notEqual(check(q.problem.answerSpec, '').ok, true);
        assert.notEqual(check(q.problem.answerSpec, '987654.5').ok, true);
      }
    }
  }
});

test('bodování a čas', () => {
  assert.equal(percent(7, 10), 70);
  assert.equal(percent(1, 3), 33);
  assert.equal(percent(2, 3), 67);
  assert.equal(percent(0, 0), 0);
  assert.equal(isPassed(49), false);
  assert.equal(isPassed(50), true);
  assert.equal(remainingMs(1000, 0, 5000), null);
  assert.equal(remainingMs(0, 20, 60000), 19 * 60000);
  assert.equal(remainingMs(0, 20, 99 * 60000), 0);
  assert.equal(isExpired(0, 20, 20 * 60000), true);
  assert.equal(isExpired(0, 20, 20 * 60000 - 1), false);
  assert.equal(formatClock(754000), '12:34');
  assert.equal(isWarning(300000), true);
  assert.equal(isWarning(300001), false);
  assert.equal(isWarning(null), false);
  assert.equal(announceMark(301000, 299000), 300000);
  assert.equal(announceMark(70000, 59000), 60000);
  assert.equal(announceMark(1000, 0), 0);
  assert.equal(announceMark(200000, 199000), null);
  const c = { parts: ['der1'], level: 'hard', count: 15, limit: 45 };
  assert.deepEqual(decodeConfig(encodeConfig(c)), c);
  assert.deepEqual(normalizeConfig({ parts: [], count: 7 }), normalizeConfig({}));
  assert.deepEqual(parseRoute('#/test/123?c=a'), { name: 'test', seed: 123, c: 'a' });
  assert.deepEqual(parseRoute('#/test'), { name: 'test' });
});

function page(extra = {}, shared = {}) {
  const dom = shared.dom ?? new JSDOM('<!doctype html><div id="r"></div>', { url: 'http://localhost/' });
  const { window } = dom;
  const el = window.document.getElementById('r');
  el.textContent = '';
  const rec = [];
  const hashes = [];
  const m = mountTest(el, topics, {
    record: (a) => { rec.push(a); return Promise.resolve(); },
    session: window.sessionStorage, local: window.localStorage,
    setHash: (x) => hashes.push(x), newSeed: () => 4242, ...extra,
  });
  const q = (s) => el.querySelector(s);
  return { dom, el, rec, hashes, m, q, all: (s) => [...el.querySelectorAll(s)] };
}
const mark = (window, name, v) => {
  [...window.document.querySelectorAll(`input[name="${name}"]`)].find((x) => x.value === v).checked = true;
};

test('stránka: nastavení -> test -> odevzdání -> výsledek s postupem; nastavení a odpovědi se pamatují', () => {
  const p = page();
  const w = p.dom.window;
  mark(w, 'count', '5'); mark(w, 'level', 'easy');
  p.q('[data-role="test-start"]').click();
  assert.equal(p.all('.test-q').length, 5);
  assert.equal(p.hashes.at(-1), `#/test/4242?c=${encodeURIComponent('limity,der1,der2~easy~5~0')}`);
  assert.match(p.q('.prompt-label').textContent, /Příklad 1 \/ 5/);
  assert.equal(p.q('[data-role="test-clock"]'), null);
  const qs = buildTest(topics, 4242, { parts: ALL, level: 'easy', count: 5 });
  const inputs = p.all('.answer-input');
  inputs[0].value = input(qs[0].problem.answerSpec); inputs[0].dispatchEvent(new w.Event('input', { bubbles: true }));
  inputs[1].value = '987654'; inputs[1].dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.match(p.q('[data-role="test-progress"]').textContent, /2 z 5/);
  const route = { seed: 4242, c: encodeConfig({ parts: ALL, level: 'easy', count: 5, limit: 0 }) };
  // znovunačtení: odpovědi se obnoví ze sessionStorage
  const again = page(route, { dom: p.dom });
  assert.equal(again.all('.answer-input')[0].value, input(qs[0].problem.answerSpec));
  assert.match(again.q('[data-role="test-progress"]').textContent, /2 z 5/);
  // odevzdání s nezodpovězenými -> potvrzení
  again.q('[data-role="test-submit"]').click();
  assert.equal(again.q('[data-role="test-confirm"]').hidden, false);
  again.q('[data-role="test-confirm-yes"]').click();
  assert.match(again.q('[data-role="test-score"]').textContent, /^1 \/ 5 \(20 %\)$/);
  assert.match(again.q('[data-role="test-pass"]').textContent, /Nesplněno/);
  assert.equal(again.rec.length, 5);
  assert.ok(again.rec.every((r) => JSON.parse(r.answer).test === true));
  assert.equal(again.rec.filter((r) => r.correct).length, 1);
  const det = again.q('[data-role="test-detail"]');
  det.open = true; det.dispatchEvent(new w.Event('toggle'));
  assert.ok(det.querySelector('.stepper'), 'postup se otevře');
  // opětovné vykreslení výsledku nezapisuje podruhé
  const third = page(route, { dom: p.dom });
  assert.match(third.q('[data-role="test-score"]').textContent, /1 \/ 5/);
  assert.equal(third.rec.length, 0);
  // nastavení se pamatuje
  third.q('[data-role="test-change"]').click();
  assert.equal(third.q('input[name="count"]:checked').value, '5');
  assert.equal(third.q('input[name="level"]:checked').value, 'easy');
  third.q('[data-role="test-start"]').click();
  const stored = JSON.parse(w.localStorage.getItem('matika.test.cfg'));
  assert.equal(stored.count, 5);
  const fresh = page({}, { dom: p.dom });
  assert.equal(fresh.q('input[name="count"]:checked').value, '5');
});

test('časový limit: odpočet, varování a automatické odevzdání', () => {
  let t = 1_000_000; let tick = null;
  const p = page({ now: () => t, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, seed: 9, c: encodeConfig({ parts: ['der2'], level: 'easy', count: 5, limit: 20 }) });
  assert.match(p.q('[data-role="test-clock"]').textContent, /20:00/);
  t += 16 * 60000; tick();
  assert.equal(p.q('[data-role="test-clock"]').dataset.warn, 'true');
  assert.match(p.q('[data-role="test-live"]').textContent, /5 min/);
  t += 4 * 60000; tick();
  assert.match(p.q('[data-role="test-score"]').textContent, /^0 \/ 5/);
  assert.match(p.el.textContent, /čas vypršel/);
});
