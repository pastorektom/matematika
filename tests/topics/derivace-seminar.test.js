import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import derivace from '../../js/topics/derivace.js';
import { texWidth } from '../../js/topics/derivace-fit.js';
import { makeRng } from '../../js/rng.js';
import { mountSolution } from '../../js/ui/stepper.js';

const type = derivace.types.find((t) => t.id === 'mocniny');
const lines = (steps) => steps.flatMap((s) => s.board.map((l) => l.tex));
const norm = (t) => t.replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '').replace(/^(f'\(x\))?=/, '');

test('mocniny: postup ze semináře má stejný výsledek, rámeček a slušné řádky', () => {
  let withDen = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const p = type.generate(makeRng(seed));
    const v = p.variants?.[0];
    assert.ok(v && v.id === 'seminar' && v.title === 'Postup ze semináře', `seed ${seed}`);
    assert.ok(v.solution.length >= 3 && v.solution.length <= 4, `seed ${seed}: ${v.solution.length} kroků`);
    const last = v.solution.at(-1).board.at(-1);
    assert.ok(last.tex.includes('bt-vysledek') && last.notes.some((n) => n.kind === 'doubleUnderline'));
    const ref = p.solution.at(-1).board.at(-1);
    assert.equal(norm(last.tex), norm(ref.tex), `seed ${seed}: výsledek`);
    const all = lines(v.solution);
    assert.ok(v.solution.at(-1).board.some((l) => l.tex.includes('\\sqrt[n]{x^p}=x^{p/n}')), `seed ${seed}: rámeček`);
    if (p.data.den !== undefined) {
      withDen++;
      assert.ok(all.some((t) => /x\^\{[^}]*-[^}]*\}/.test(t)), `seed ${seed}: odečtení exponentů`);
    }
    all.forEach((t, i) => {
      assert.ok(!/--|\+-/.test(t), `seed ${seed}: ${t}`);
      assert.ok(!/\\frac\{[^{}]*\}\{-/.test(t), `seed ${seed}: záporný jmenovatel ${t}`);
      assert.notEqual(t, all[i - 1], `seed ${seed}: opakovaný řádek`);
      if (!t.includes('bt-vysledek')) assert.ok(texWidth(t) <= 36, `seed ${seed}: široký řádek ${t}`);
    });
  }
  assert.ok(withDen > 10);
});

test('postup ze semináře: přepínač mění počet kroků a pamatuje si volbu', () => {
  const dom = new JSDOM('<!doctype html><div id="a"></div><div id="b"></div>', { url: 'https://example.test/' });
  const { document: doc } = dom.window;
  globalThis.localStorage = dom.window.localStorage;
  const p = type.generate(makeRng(3));
  const count = (el) => el.querySelectorAll('.stepper-progress li').length;
  const a = doc.getElementById('a');
  const s = mountSolution(a, p, {});
  assert.equal(count(a), p.variants[0].solution.length, 'výchozí je postup ze semináře');
  assert.equal(a.querySelector('[aria-selected="true"]').dataset.variant, 'seminar');
  const tabs = a.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 2);
  tabs[0].click();
  assert.equal(count(a), p.solution.length);
  tabs[1].click();
  assert.equal(count(a), p.variants[0].solution.length);
  s.destroy();
  const b = doc.getElementById('b');
  mountSolution(b, p, {});
  assert.equal(count(b), p.variants[0].solution.length, 'zapamatovaná volba');
  b.querySelector('[role="tablist"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(count(b), p.solution.length);
  s.destroy();
  localStorage.clear();
  const c = doc.createElement('div');
  mountSolution(c, p, {});
  assert.equal(count(c), p.variants[0].solution.length, 'bez uložené volby výchozí seminar');
  delete globalThis.localStorage;
});
