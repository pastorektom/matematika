import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createShell, NAV_KEY, FOCUS_KEY } from '../js/ui/shell.js';
import { splitDisplayTex, renderTheory, fitTheory } from '../js/ui/theory.js';

const HTML = `<!doctype html><body><div class="shell" data-nav="open">
  <button id="nav-rail" aria-expanded="false"></button>
  <aside class="sidebar"><button id="nav-collapse" aria-expanded="true"></button></aside>
  <main><button data-role="focus-toggle" aria-pressed="false"></button><input id="q"></main></div>
  <button id="focus-exit" hidden></button></body>`;

function memory(init = {}) {
  const data = { ...init };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}
function setup(storage, wide = false) {
  const dom = new JSDOM(HTML);
  dom.window.matchMedia = () => ({ matches: wide });
  const shell = createShell(dom.window.document, { storage });
  return { dom, doc: dom.window.document, shell, shellEl: dom.window.document.querySelector('.shell') };
}
const press = (dom, target, key, extra = {}) => {
  const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  target.dispatchEvent(e);
};

test('menu: tlačítko přepíná aria-expanded, třídu rozvržení a ukládá volbu', () => {
  const st = memory();
  const { doc, shellEl } = setup(st, true);
  assert.equal(shellEl.dataset.nav, 'open'); // široká obrazovka: výchozí otevřeno
  const btn = doc.getElementById('nav-collapse');
  btn.click();
  assert.equal(shellEl.dataset.nav, 'closed');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(btn.getAttribute('title'), 'Zobrazit menu');
  assert.equal(st.data[NAV_KEY], 'closed');
  doc.getElementById('nav-rail').click(); // úchyt na okraji otevře zpět
  assert.equal(shellEl.dataset.nav, 'open');
  assert.equal(btn.getAttribute('title'), 'Skrýt menu');
});

test('menu: výchozí stav podle šířky a obnovení uloženého stavu', () => {
  assert.equal(setup(memory(), false).shellEl.dataset.nav, 'closed');
  assert.equal(setup(memory({ [NAV_KEY]: 'open' }), false).shellEl.dataset.nav, 'open');
  assert.equal(setup(memory({ [NAV_KEY]: 'closed' }), true).shellEl.dataset.nav, 'closed');
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const { shell } = setup(broken, true);
  shell.toggleNav(); // nesmí vyhodit výjimku
  assert.equal(shell.navOpen, false);
});

test('klávesa M přepíná menu, v poli ani s Ctrl se ignoruje', () => {
  const { dom, doc, shellEl } = setup(memory(), true);
  press(dom, doc.body, 'm');
  assert.equal(shellEl.dataset.nav, 'closed');
  press(dom, doc.getElementById('q'), 'm');
  assert.equal(shellEl.dataset.nav, 'closed');
  press(dom, doc.body, 'm', { ctrlKey: true });
  assert.equal(shellEl.dataset.nav, 'closed');
  press(dom, doc.body, 'M');
  assert.equal(shellEl.dataset.nav, 'open');
});

test('Focus režim: atribut na body, tlačítko pressed, Esc ukončí, volba se uloží', () => {
  const st = memory();
  const { dom, doc, shell } = setup(st, true);
  const t = doc.querySelector('[data-role="focus-toggle"]');
  shell.toggleFocus();
  assert.equal(doc.body.getAttribute('data-focus'), 'true');
  assert.equal(t.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.getElementById('focus-exit').hidden, false);
  assert.equal(st.data[FOCUS_KEY], '1');
  press(dom, doc.body, 'Escape');
  assert.equal(doc.body.hasAttribute('data-focus'), false);
  assert.equal(st.data[FOCUS_KEY], '0');
  assert.equal(setup(memory({ [FOCUS_KEY]: '1' }), true).doc.body.getAttribute('data-focus'), 'true');
});

// ---- dělení dlouhých vzorců ----
test('splitDisplayTex: dělí podle čárek a \\quad na nejvyšší úrovni, závorky a matice nechá celé', () => {
  assert.deepEqual(splitDisplayTex('A=\\begin{pmatrix}1,2\\\\3,4\\end{pmatrix},\\quad E=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}'),
    ['A=\\begin{pmatrix}1,2\\\\3,4\\end{pmatrix},', 'E=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}']);
  assert.deepEqual(splitDisplayTex('f(x,y)=x,\\ g=\\left(a,b\\right), h=\\{1,2\\}'), ['f(x,y)=x,', '\\ g=\\left(a,b\\right),', 'h=\\{1,2\\}']);
  assert.deepEqual(splitDisplayTex('a+b\\qquad c'), ['a+b', 'c']);
  assert.deepEqual(splitDisplayTex('x^2+1'), ['x^2+1']);
  assert.deepEqual(splitDisplayTex(''), []);
});

test('fitTheory: bez přetečení se nic nemění; přetečení vzorce přepne blok na celou šířku a pak rozdělí', () => {
  const dom = new JSDOM('<!doctype html><div id="r"></div>');
  const el = dom.window.document.getElementById('r');
  renderTheory(el, { theory: [{ heading: 'H', text: 't', tex: 'a=1,\\quad b=2' }] });
  const f = el.querySelector('.formula');
  const block = el.querySelector('.theory-block');
  fitTheory(el);
  assert.equal(block.classList.contains('wide'), false);
  // simulace přetečení (jsdom nemá rozložení)
  Object.defineProperty(f, 'scrollWidth', { get: () => 500, configurable: true });
  Object.defineProperty(f, 'clientWidth', { get: () => 300, configurable: true });
  fitTheory(el);
  assert.equal(block.classList.contains('wide'), true);
  assert.equal(f.classList.contains('formula-split'), true);
  assert.equal(f.querySelectorAll('.formula-part').length, 2);
});
