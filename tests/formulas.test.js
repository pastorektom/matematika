import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import { formulaGroups, filterGroups, OWN_NOTE } from '../js/formulas.js';
import { renderFormulas } from '../js/ui/formulas.js';
import { renderHome } from '../js/ui/home.js';
import { setTexEngine } from '../js/render.js';
import { topics, sortTopics } from '../js/topics/index.js';
import { parseRoute } from '../js/router.js';

const sorted = sortTopics(topics);
const doc = () => new JSDOM('<!doctype html><main id="r"></main>').window.document;

test('každý vzorec se vykreslí KaTeXem bez chyby', () => {
  let n = 0;
  for (const g of formulaGroups) {
    for (const f of g.items) {
      assert.ok(f.tex && typeof f.tex === 'string', `${g.id}: prázdný vzorec`);
      assert.doesNotThrow(() => katex.renderToString(f.tex, { throwOnError: true, strict: 'ignore' }), `${g.id}: ${f.tex}`);
      n++;
    }
  }
  assert.ok(n >= 50, `málo vzorců: ${n}`);
});

test('skupiny jsou v pořadí témat z Moodlu, za nimi algebra a goniometrie', () => {
  const ids = formulaGroups.map((g) => g.id);
  const topicIds = sorted.map((t) => t.id);
  const withTopic = formulaGroups.filter((g) => g.topic);
  assert.deepEqual([...new Set(withTopic.map((g) => g.topic))], topicIds);
  assert.deepEqual(ids.slice(-2), ['algebra', 'goniometrie']);
  assert.ok(ids.indexOf('prubeh') === ids.indexOf('derivace') + 1);
  for (const g of formulaGroups) assert.ok(g.title && g.items.length > 0);
});

test('filterGroups: čistá funkce, bez dotazu vrátí vše, dotaz hledá v názvu a poznámce', () => {
  const copy = JSON.stringify(formulaGroups);
  assert.equal(filterGroups(formulaGroups, '').length, formulaGroups.length);
  assert.equal(filterGroups(formulaGroups, '   ').length, formulaGroups.length);
  const byTitle = filterGroups(formulaGroups, 'LIMIT');
  assert.ok(byTitle.some((g) => g.id === 'limita'));
  assert.equal(byTitle.find((g) => g.id === 'limita').items.length, formulaGroups.find((g) => g.id === 'limita').items.length);
  const byNote = filterGroups(formulaGroups, 'cramer');
  assert.ok(byNote.length >= 1);
  for (const g of byNote) assert.ok(g.items.every((f) => /cramer/i.test(f.note || '')) || /cramer/i.test(g.title));
  assert.deepEqual(filterGroups(formulaGroups, 'sarrus')[0].id, 'determinant'); // bez ohledu na diakritiku/velikost
  assert.equal(filterGroups(formulaGroups, 'xyzxyzxyz').length, 0);
  assert.equal(JSON.stringify(formulaGroups), copy, 'vstup se nesmí měnit');
});

test('stránka vzorců: označení, skupiny, prázdný výsledek hledání', () => {
  setTexEngine(null);
  const d = doc();
  const root = d.getElementById('r');
  renderFormulas(root);
  assert.match(root.textContent, new RegExp(OWN_NOTE));
  assert.equal(root.querySelectorAll('section.formula-group').length, formulaGroups.length);
  const input = root.querySelector('input[type="search"]');
  input.value = 'sarrus';
  input.dispatchEvent(new d.defaultView.Event('input'));
  assert.equal(root.querySelectorAll('section.formula-group').length, 1);
  input.value = 'zzzzqq';
  input.dispatchEvent(new d.defaultView.Event('input'));
  assert.equal(root.querySelectorAll('section.formula-group').length, 0);
  assert.match(root.textContent, /Nic nenalezeno/);
});

test('router zná #/vzorce', () => {
  assert.deepEqual(parseRoute('#/vzorce'), { name: 'formulas' });
  assert.deepEqual(parseRoute('#/vzorce/'), { name: 'formulas' });
});

test('domů: 7 karet v pořadí, počet typů, odkaz na vzorce', () => {
  setTexEngine(null);
  const root = doc().getElementById('r');
  renderHome(root, { topics: sorted, stats: null, guest: true });
  const cards = [...root.querySelectorAll('.topic-card')];
  assert.equal(cards.length, 7);
  cards.forEach((c, i) => {
    assert.ok(c.querySelector('a').getAttribute('href').includes(encodeURIComponent(sorted[i].id)));
    assert.match(c.textContent, new RegExp(sorted[i].title.slice(0, 8)));
    assert.match(c.textContent, new RegExp(`${sorted[i].types.length} (typ|typy|typů)`));
  });
  assert.ok(root.querySelector('a[href="#/vzorce"]'));
});

test('domů: host vidí poznámku, přihlášený pokrok a doporučení', () => {
  const guest = doc().getElementById('r');
  renderHome(guest, { topics: sorted, stats: null, guest: true });
  assert.match(guest.textContent, /bez přihlášení/i);
  assert.equal(guest.querySelectorAll('.topic-progress').length, 0);
  assert.equal(guest.querySelector('.recommend'), null);

  const user = doc().getElementById('r');
  const stats = [
    { topic: sorted[0].id, tried: 10, correctRate: 0.9 },
    { topic: sorted[2].id, tried: 8, correctRate: 0.25 },
  ];
  renderHome(user, { topics: sorted, stats, guest: false });
  const cards = [...user.querySelectorAll('.topic-card')];
  assert.match(cards[0].textContent, /10/);
  assert.match(cards[0].textContent, /90 %/);
  assert.match(cards[2].textContent, /25 %/);
  assert.match(cards[1].textContent, /Zatím nezkoušeno/);
  const rec = user.querySelector('.recommend');
  assert.ok(rec);
  assert.match(rec.textContent, new RegExp(sorted[2].title.slice(0, 8)));
  assert.doesNotMatch(user.textContent, /bez přihlášení/i);
  assert.equal(user.querySelector('.topic-card[data-recommended="true"] .topic-name').textContent, sorted[2].title);
});

test('domů: přihlášený bez pokusů nemá doporučení', () => {
  const root = doc().getElementById('r');
  renderHome(root, { topics: sorted, stats: [], guest: false });
  assert.equal(root.querySelector('.recommend'), null);
  assert.equal(root.querySelectorAll('.topic-card').length, 7);
});
