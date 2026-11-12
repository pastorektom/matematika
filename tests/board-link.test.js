import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { makeRng } from '../js/rng.js';
import {
  validate, encode, pickSecondScreen, popupFeatures, createHub, stepMessage, openPopout, CHANNEL_NAME,
} from '../js/ui/board-link.js';
import { mountPopout } from '../js/ui/popout.js';
import { mountPractice } from '../js/ui/practice.js';
import { mountStepper } from '../js/ui/stepper.js';
import { createTypePicker } from '../js/ui/typepicker.js';
import { boardForStep } from '../js/viz/board.js';

// Paměťový BroadcastChannel: zprávy dostanou ostatní instance téhož jména (ne odesílatel), asynchronně.
function fakeChannelClass() {
  const all = new Set();
  return class FakeChannel {
    constructor(name) { this.name = name; this.onmessage = null; all.add(this); }
    postMessage(data) {
      const copy = JSON.parse(JSON.stringify(data));
      for (const c of all) if (c !== this && c.name === this.name && c.onmessage) c.onmessage({ data: copy });
    }
    close() { all.delete(this); }
  };
}

test('protokol: platné zprávy projdou, nesmyslné vrátí null a nevyhodí výjimku', () => {
  assert.equal(validate(encode('hello')).type, 'hello');
  assert.deepEqual(validate(encode('nav', { dir: 'next' })), { type: 'nav', dir: 'next' });
  assert.equal(validate({ type: 'nav', dir: 'sideways' }), null);
  assert.equal(validate({ type: 'grade', correct: 'yes' }), null);
  assert.equal(validate({ type: 'neznamy' }), null);
  assert.equal(validate(null), null);
  assert.equal(validate('text'), null);
  assert.equal(validate({ type: 'problem' }), null);
  assert.equal(validate({ type: 'step', index: 5, total: 3 }), null);
  assert.equal(validate({ type: 'step', index: 0, total: 1, board: { lines: [{ tex: 1 }], upTo: 1 } }), null);
  const p = validate({ type: 'problem', id: 7, promptTex: 'x', topicTitle: 'T', typeTitle: 'U', extra: 1 });
  assert.deepEqual(p, { type: 'problem', id: '7', promptTex: 'x', topicTitle: 'T', typeTitle: 'U', selfGraded: false });
  assert.throws(() => encode('nesmysl'));
  const s = validate({ type: 'step', index: 1, total: 3, title: 'a', text: 'b', board: { lines: [{ tex: 'x', notes: [{ kind: 'brace' }, 5] }], upTo: 9 }, viz: { kind: 'plot', data: {} } });
  assert.equal(s.board.upTo, 1);
  assert.equal(s.board.lines[0].notes.length, 1);
});

test('pickSecondScreen: nepřimární obrazovka, jinak null', () => {
  const a = { isPrimary: true, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 };
  const b = { isPrimary: false, availLeft: 1920, availTop: 0, availWidth: 1920, availHeight: 1080 };
  assert.equal(pickSecondScreen([a, b]), b);
  assert.equal(pickSecondScreen([a]), null);
  assert.equal(pickSecondScreen([]), null);
  assert.equal(pickSecondScreen(undefined), null);
  assert.equal(pickSecondScreen([a, { isPrimary: false }]), null);
  assert.match(popupFeatures(b), /left=1920,top=0,width=1920,height=1080/);
  assert.match(popupFeatures(null), /width=1280,height=800/);
});

test('openPopout: bez Window Management API otevře běžné okno, s ním umístí na druhou obrazovku', async () => {
  const calls = [];
  const win = { location: { href: 'http://x/index.html#/tema/a' }, open: (u, n, f) => { calls.push([u, n, f]); return {}; } };
  let r = await openPopout(win);
  assert.equal(r.placed, false);
  assert.equal(calls[0][0], 'http://x/index.html#/okno-tabule');
  assert.match(calls[0][2], /1280/);
  win.getScreenDetails = async () => ({ screens: [{ isPrimary: true, availWidth: 10, availHeight: 10 }, { isPrimary: false, availLeft: 5, availTop: 6, availWidth: 700, availHeight: 400 }] });
  r = await openPopout(win);
  assert.equal(r.placed, true);
  assert.match(calls[1][2], /left=5,top=6,width=700,height=400/);
  win.getScreenDetails = async () => { throw new Error('denied'); };
  r = await openPopout(win);
  assert.equal(r.placed, false);
  assert.equal(r.blocked, false);
  win.open = () => null;
  assert.equal((await openPopout(win)).blocked, true);
});

const STEPS = [
  { title: 'Jedna', text: 'první', board: [{ tex: 'a=1' }] },
  { title: 'Dva', text: 'druhý', board: [{ tex: 'b=2' }] },
  { title: 'Tři', text: 'třetí', tex: 'c=3' },
];

function dom() { return new JSDOM('<!doctype html><div id="r"></div>').window; }

test('hub + okno: hello pošle příklad a krok, krok se zrcadlí, nav ovládá krokovač, bye hlásí přítomnost', () => {
  const Channel = fakeChannelClass();
  const hub = createHub(Channel);
  hub.setProblem({ id: 'p1', promptTex: 'x^2', topicTitle: 'Téma', typeTitle: 'Typ' });
  const win = dom();
  const stepper = mountStepper(win.document.getElementById('r'), STEPS, {
    onChange: (i) => hub.setStep(stepMessage(STEPS, i, boardForStep)),
  });
  hub.onNav((d) => (d === 'next' ? stepper.next() : stepper.prev()));
  const seen = [];
  hub.onPresence((v) => seen.push(v));

  const popWin = dom();
  const host = popWin.document.getElementById('r');
  const po = mountPopout(host, { Channel, win: popWin });
  assert.equal(hub.isOpen, true);
  assert.deepEqual(seen, [true]);
  assert.match(host.querySelector('[data-role="po-meta"]').textContent, /Téma – Typ/);
  assert.ok(host.querySelector('[data-role="po-task"]').textContent.includes('x^2'));
  assert.match(host.querySelector('[data-role="po-counter"]').textContent, /Krok 1 z 3/);
  assert.equal(host.querySelector('[data-role="po-prev"]').disabled, true);

  host.querySelector('[data-role="po-next"]').click();
  assert.equal(stepper.index, 1);
  assert.match(host.querySelector('[data-role="po-counter"]').textContent, /Krok 2 z 3/);
  host.querySelector('[data-role="po-next"]').click();
  assert.equal(host.querySelector('[data-role="po-next"]').disabled, true);
  host.querySelector('[data-role="po-prev"]').click();
  assert.equal(stepper.index, 1);

  // nový příklad: hlavička se přepíše a kresba v okně se smaže
  const wb = po.whiteboard;
  assert.ok(host.querySelector('[data-role="wb-pen"]'));
  hub.setProblem({ id: 'p2', promptTex: 'y', topicTitle: 'Téma', typeTitle: 'Jiný' });
  assert.match(host.querySelector('[data-role="po-meta"]').textContent, /Jiný/);
  assert.equal(wb.strokeCount, 0);

  popWin.dispatchEvent(new popWin.Event('beforeunload'));
  assert.equal(hub.isOpen, false);
  assert.deepEqual(seen, [true, false]);
  po.destroy();
});

test('okno: přepínač režimů a tlačítka Zvládl/Nezvládl posílají zprávy', () => {
  const Channel = fakeChannelClass();
  const hub = createHub(Channel);
  const grades = [];
  hub.onGrade((c) => grades.push(c));
  hub.setProblem({ id: 'p', promptTex: 'x', topicTitle: 'T', typeTitle: 'U', selfGraded: true });
  const popWin = dom();
  const host = popWin.document.getElementById('r');
  const po = mountPopout(host, { Channel, win: popWin });
  assert.equal(po.mode, 'write');
  assert.equal(host.querySelector('.po-grade').hidden, false);
  host.querySelector('[data-role="po-grade-ok"]').click();
  host.querySelector('[data-role="po-grade-bad"]').click();
  assert.deepEqual(grades, [true, false]);
  host.querySelector('[data-role="po-mode-steps"]').click();
  assert.equal(po.mode, 'steps');
  assert.equal(host.querySelector('#po-panel-write').hidden, true);
  assert.ok(host.querySelector('[data-role="po-fullscreen"]'));
  assert.ok(host.querySelector('.wb-bar'));
  po.destroy();
});

test('praxe: při otevřeném okně je místo tabule poznámka, po zavření se tabule vrátí; zvládl jen po Ukaž výsledek', () => {
  const Channel = fakeChannelClass();
  const hub = createHub(Channel);
  const w = dom();
  const el = w.document.getElementById('r');
  const wbType = { id: 'w', title: 'W', generate: () => ({ id: 'w', topic: 't', type: 'w', seed: 0, promptTex: 'x', answerTex: '42', answerSpec: { kind: 'whiteboard' }, solution: [] }) };
  const calls = [];
  const opened = [];
  mountPractice(el, { id: 't', title: 'T', order: 1, theory: [], types: [wbType] }, {
    record: (a) => { calls.push(a); return Promise.resolve({}); }, navigate() {}, rng: makeRng(1), hub,
    openPopout: async () => { opened.push(1); return { placed: false }; },
  });
  const q = (s) => el.querySelector(s);
  assert.equal(q('[data-role="board"]').hidden, false);
  // okno se připojí
  const popWin = dom();
  const po = mountPopout(popWin.document.getElementById('r'), { Channel, win: popWin });
  assert.equal(q('[data-role="board"]').hidden, true);
  assert.equal(q('[data-role="board-moved"]').hidden, false);
  assert.ok(popWin.document.querySelector('[data-role="po-task"]').textContent.includes('x'));
  // hodnocení z okna před „Ukaž výsledek“ nic nezapíše
  popWin.document.querySelector('[data-role="po-grade-ok"]').click();
  assert.equal(calls.length, 0);
  q('[data-role="reveal"]').click();
  popWin.document.querySelector('[data-role="po-grade-ok"]').click();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].correct, true);
  // zavření okna
  popWin.dispatchEvent(new popWin.Event('pagehide'));
  assert.equal(q('[data-role="board"]').hidden, false);
  assert.equal(q('[data-role="board-moved"]').hidden, true);
  po.destroy();
});

test('praxe: tlačítko „Vrátit zpět“ tabuli vrátí i bez zprávy bye', () => {
  const Channel = fakeChannelClass();
  const hub = createHub(Channel);
  const w = dom();
  const el = w.document.getElementById('r');
  const numType = { id: 'a', title: 'A', generate: () => ({ id: 'a', topic: 't', type: 'a', seed: 0, promptTex: '1+1', answerSpec: { kind: 'number', value: 2 }, solution: [] }) };
  mountPractice(el, { id: 't', title: 'T', order: 1, theory: [], types: [numType] }, { record: () => Promise.resolve({}), navigate() {}, rng: makeRng(2), hub });
  const popWin = dom();
  mountPopout(popWin.document.getElementById('r'), { Channel, win: popWin });
  assert.equal(el.querySelector('[data-role="board-moved"]').hidden, false);
  el.querySelector('[data-role="board-return"]').click();
  assert.equal(el.querySelector('[data-role="board-moved"]').hidden, true);
  assert.equal(CHANNEL_NAME, 'matika-tabule');
});

// ---- rozbalovací výběr typu ----
function picker(n, extra = []) {
  const w = dom();
  const choices = [{ id: '', title: 'Všechny typy' }, ...Array.from({ length: n }, (_, i) => ({ id: `t${i}`, title: `Typ číslo ${i}` })), ...extra];
  const picked = [];
  const p = createTypePicker(w.document, { choices, value: '', onSelect: (c) => picked.push(c.id) });
  w.document.body.appendChild(p.el);
  return { w, p, picked };
}
const key = (w, el, k) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

test('výběr typu: combobox/listbox sémantika, klávesy a Esc', () => {
  const { w, p, picked } = picker(4);
  assert.equal(p.trigger.getAttribute('role'), 'combobox');
  assert.equal(p.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(p.el.querySelector('[role="listbox"]').getAttribute('aria-label'), 'Typ příkladu');
  assert.equal(p.el.querySelector('.tp-search').hidden, true); // do 6 typů bez hledání
  key(w, p.trigger, 'ArrowDown');
  assert.equal(p.trigger.getAttribute('aria-expanded'), 'true');
  const list = p.el.querySelector('[role="listbox"]');
  key(w, list, 'ArrowDown');
  key(w, list, 'ArrowDown');
  const activeId = list.getAttribute('aria-activedescendant');
  assert.equal(w.document.getElementById(activeId).textContent, 'Typ číslo 1');
  key(w, list, 'Enter');
  assert.deepEqual(picked, ['t1']);
  assert.equal(p.trigger.getAttribute('aria-expanded'), 'false');
  assert.match(p.trigger.textContent, /Typ číslo 1/);
  assert.equal(p.el.querySelector('[aria-selected="true"]').dataset.type, 't1');
  p.open();
  key(w, p.el.querySelector('.tp-pop'), 'Escape');
  assert.equal(p.isOpen, false);
  assert.equal(w.document.activeElement, p.trigger);
});

test('výběr typu: u více než 6 typů hledání (bez diakritiky) a skupina „Příklady ze cvičení“ zvlášť', () => {
  const { w, p, picked } = picker(8, [{ id: 'cviceni', title: 'Příklady ze cvičení', group: 'Příklady ze cvičení' }]);
  const search = p.el.querySelector('.tp-search');
  assert.equal(search.hidden, false);
  assert.equal(p.el.querySelectorAll('.tp-group').length, 1);
  p.open();
  search.value = 'priklady';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  const shown = [...p.el.querySelectorAll('.tp-option')].filter((o) => !o.hidden);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].dataset.role, 'type-cviceni');
  key(w, search, 'Enter');
  assert.deepEqual(picked, ['cviceni']);
  p.setChoices([{ id: '', title: 'Všechny typy' }], '');
  assert.equal(p.el.querySelector('[data-role="type-cviceni"]'), null);
});

test('tabule: skupiny v panelu nástrojů, tlačítko Celá obrazovka přepíná třídu, tahy přežijí', async () => {
  const w = dom();
  const el = w.document.getElementById('r');
  const { mountWhiteboard } = await import('../js/ui/whiteboard.js');
  let popped = 0;
  const wb = mountWhiteboard(el, { onPopout: () => { popped++; } });
  const groups = [...el.querySelectorAll('.wb-bar > .wb-group')];
  assert.equal(groups.length, 5);
  for (const b of el.querySelectorAll('.wb-btn')) assert.ok(b.getAttribute('aria-label'));
  assert.ok(el.querySelector('.wb-btn svg'));
  el.querySelector('[data-role="wb-popout"]').click();
  assert.equal(popped, 1);
  await wb.setFullscreen(true);
  assert.ok(wb.root.classList.contains('wb-full'));
  assert.equal(el.querySelector('[data-role="wb-full"]').getAttribute('aria-pressed'), 'true');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(wb.root.classList.contains('wb-full'), false);
});

test('tabule: dotyk se při přiloženém peru ignoruje (dlaň)', async () => {
  const w = dom();
  const el = w.document.getElementById('r');
  const { mountWhiteboard } = await import('../js/ui/whiteboard.js');
  const wb = mountWhiteboard(el);
  const canvas = el.querySelector('canvas');
  const fire = (type, props) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: 0, clientY: 0, pressure: 0.5, button: 0, buttons: 1 }, props);
    canvas.dispatchEvent(e);
  };
  fire('pointerdown', { pointerId: 1, pointerType: 'pen' });
  fire('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 50 });
  fire('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 60 });
  fire('pointermove', { pointerId: 1, pointerType: 'pen', clientX: 10 });
  fire('pointerup', { pointerId: 2, pointerType: 'touch' });
  fire('pointerup', { pointerId: 1, pointerType: 'pen' });
  assert.equal(wb.strokeCount, 1);
  fire('pointerdown', { pointerId: 3, pointerType: 'touch' }); // hned po peru se dotyk ještě ignoruje
  fire('pointerup', { pointerId: 3, pointerType: 'touch' });
  assert.equal(wb.strokeCount, 1);
});
