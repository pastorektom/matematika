import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { makeRng } from '../js/rng.js';
import { createStrokeStore, mountWhiteboard, canStartStroke } from '../js/ui/whiteboard.js';
import { mountPractice } from '../js/ui/practice.js';

const stroke = (n) => ({ tool: 'pen', color: 'ink', width: 3, points: [[n, n, 0.5]] });

test('undo po dvou tazích zruší jen poslední tah', () => {
  const s = createStrokeStore();
  s.addStroke(stroke(1));
  s.addStroke(stroke(2));
  s.undo();
  assert.equal(s.strokes.length, 1);
  assert.equal(s.strokes[0].points[0][0], 1);
});

test('clear + undo vrátí smazané tahy; další undo zruší poslední tah', () => {
  const s = createStrokeStore();
  s.addStroke(stroke(1));
  s.addStroke(stroke(2));
  s.clear();
  assert.equal(s.strokes.length, 0);
  s.undo();
  assert.equal(s.strokes.length, 2);
  s.undo();
  assert.equal(s.strokes.length, 1);
  s.undo(); s.undo();
  assert.equal(s.strokes.length, 0);
  assert.equal(s.canUndo, false);
});

test('clear prázdné tabule nic nezapíše', () => {
  const s = createStrokeStore();
  s.clear();
  assert.equal(s.canUndo, false);
});

function board() {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const changes = [];
  const wb = mountWhiteboard(el, { onChange: (c) => changes.push(c) });
  const canvas = el.querySelector('canvas');
  const fire = (type, props) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, pressure: 0.5, pointerType: 'mouse', button: 0 }, props);
    canvas.dispatchEvent(e);
  };
  return { window, el, wb, canvas, fire, changes };
}

test('plátno má touch-action:none a tlačítka mají české aria-label', () => {
  const { el, canvas } = board();
  assert.equal(canvas.style.touchAction, 'none');
  for (const b of el.querySelectorAll('button')) assert.ok(b.getAttribute('aria-label'), b.textContent);
  assert.ok(el.querySelector('[aria-label="Smazat vše"]'));
});

test('tah myší se zapíše a undo ho zruší; druhý ukazatel se ignoruje', () => {
  const { wb, fire, changes } = board();
  fire('pointerdown', { pointerId: 1 });
  fire('pointerdown', { pointerId: 2, clientX: 50 }); // dlaň
  fire('pointermove', { pointerId: 2, clientX: 60 });
  fire('pointermove', { pointerId: 1, clientX: 10, clientY: 10 });
  fire('pointerup', { pointerId: 2 });
  fire('pointerup', { pointerId: 1 });
  assert.equal(wb.strokeCount, 1);
  assert.equal(changes.at(-1).strokes, 1);
  wb.undo();
  assert.equal(wb.strokeCount, 0);
  wb.destroy();
});

test('exportPng bez plátna vrací řetězec', () => {
  const { wb } = board();
  assert.equal(typeof wb.exportPng(), 'string');
});

// ---- integrace do procvičování ----
function practice(types) {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const calls = [];
  mountPractice(el, { id: 't', title: 'T', order: 1, theory: [], types }, {
    record: (a) => { calls.push(a); return Promise.resolve({}); },
    navigate() {}, rng: makeRng(3),
  });
  return { el, calls, q: (s) => el.querySelector(s) };
}
const numType = { id: 'a', title: 'A', generate: () => ({ id: 'a', topic: 't', type: 'a', seed: 0, promptTex: '1+1', answerSpec: { kind: 'number', value: 2 }, solution: [] }) };
const wbType = { id: 'w', title: 'W', generate: () => ({ id: 'w', topic: 't', type: 'w', seed: 0, promptTex: 'x', answerTex: '42', answerSpec: { kind: 'whiteboard' }, solution: [] }) };

test('Tabule: skrytí a znovu zobrazení kresbu zachová, další příklad ji smaže', () => {
  const { q } = practice([numType]);
  const btn = q('[data-role="tabule"]');
  assert.equal(q('canvas'), null);
  btn.click();
  const canvas = q('canvas');
  const fire = (type, props) => {
    const e = new canvas.ownerDocument.defaultView.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerId: 1, clientX: 5, clientY: 5, pressure: 0.5, pointerType: 'mouse', button: 0, buttons: 1 }, props);
    canvas.dispatchEvent(e);
  };
  fire('pointerdown'); fire('pointermove', { clientX: 20 }); fire('pointerup');
  assert.equal(q('[data-role="wb-clear"]').disabled, false);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  btn.click();
  assert.equal(q('[data-role="board"]').hidden, true);
  btn.click();
  assert.equal(q('[data-role="board"]').hidden, false);
  assert.equal(q('canvas'), canvas);
  assert.equal(q('[data-role="wb-clear"]').disabled, false);
  q('[data-role="next"]').click();
  assert.equal(q('canvas'), null);
  q('[data-role="tabule"]').click();
  assert.equal(q('[data-role="wb-clear"]').disabled, true);
  assert.ok(q('[data-role="answer"] input'));
});

test('canStartStroke: zbylý tah se zahodí, cizí ukazatel při kreslení ne', () => {
  const act = { id: 1 };
  assert.deepEqual(canStartStroke(null, { pointerId: 1 }), { start: true, stale: false });
  assert.equal(canStartStroke(act, { pointerId: 2, pointerType: 'touch' }).start, false);
  assert.equal(canStartStroke(act, { pointerId: 2, pointerType: 'mouse', buttons: 1 }).start, false);
  assert.deepEqual(canStartStroke(act, { pointerId: 1, pointerType: 'touch' }), { start: true, stale: true });
  assert.equal(canStartStroke(act, { pointerId: 2, pointerType: 'mouse', buttons: 0 }).start, true);
});

test('zmeškané pointerup: lostpointercapture tah ukončí a lze kreslit dál', () => {
  const { wb, fire, canvas, window } = board();
  fire('pointerdown', { pointerId: 1 });
  fire('pointermove', { pointerId: 1, clientX: 9 });
  canvas.dispatchEvent(Object.assign(new window.Event('lostpointercapture'), { pointerId: 1 }));
  assert.equal(wb.strokeCount, 1);
  fire('pointerdown', { pointerId: 3 }); fire('pointerup', { pointerId: 3 });
  assert.equal(wb.strokeCount, 2);
});

test('whiteboard: tabule místo pole, po „Ukaž výsledek“ dvě volby, zapíše se jediný selfGraded pokus', () => {
  const { q, calls } = practice([wbType]);
  assert.ok(q('canvas'));
  assert.equal(q('[data-role="answer"] input'), null);
  q('[data-role="reveal"]').click();
  assert.equal(calls.length, 0);
  assert.ok(q('[data-role="reveal-box"]').textContent.includes('Správný výsledek'));
  q('[data-role="self-ok"]').click();
  q('[data-role="self-bad"]')?.click();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].correct, true);
  assert.equal(JSON.parse(calls[0].answer).selfGraded, true);
});

test('whiteboard: „Nezvládl jsem“ zapíše correct:false', () => {
  const { q, calls } = practice([wbType]);
  q('[data-role="reveal"]').click();
  q('[data-role="self-bad"]').click();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].correct, false);
  assert.equal(JSON.parse(calls[0].answer).selfGraded, true);
});

// ---- tvary: podržení konce tahu ----
function manualClock() {
  let t = 1000;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { fn, at: t + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const target = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = Math.max(t, due[1].at);
        due[1].fn();
      }
      t = target;
    },
  };
}
function shapeBoard() {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>', { url: 'http://localhost/' });
  const el = window.document.getElementById('r');
  const clock = manualClock();
  const wb = mountWhiteboard(el, { clock });
  const canvas = el.querySelector('canvas');
  const fire = (type, props) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, pressure: 0.5, pointerType: 'mouse', button: 0, buttons: 1 }, props);
    canvas.dispatchEvent(e);
  };
  const drawCircle = () => {
    const rng = makeRng(5);
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI * 2 * 1.03;
      const x = 200 + 80 * Math.cos(t) + (rng() - 0.5) * 5;
      const y = 200 + 80 * Math.sin(t) + (rng() - 0.5) * 5;
      if (i === 0) fire('pointerdown', { clientX: x, clientY: y });
      else fire('pointermove', { clientX: x, clientY: y });
      clock.advance(8);
    }
  };
  return { window, el, wb, canvas, fire, clock, drawCircle };
}

test('tvary: tlačítko „Tvary“ je ve skupině nástrojů, defaultně zapnuté, přepíná a pamatuje si volbu', () => {
  const { el, window } = shapeBoard();
  const btn = el.querySelector('[data-role="wb-shapes"]');
  assert.ok(btn);
  assert.equal(btn.closest('.wb-group').getAttribute('aria-label'), 'Nástroje');
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.ok(btn.getAttribute('aria-label'));
  assert.ok(btn.title.includes('kruh, ovál, čtverec, obdélník, trojúhelník'));
  btn.click();
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  assert.equal(window.localStorage.getItem('matika.wb.shapes'), '0');
});

test('tvary: podržení po kruhu nahradí tah dokonalým kruhem; jeden undo ho celý odstraní', () => {
  const { wb, fire, clock, drawCircle, el } = shapeBoard();
  drawCircle();
  clock.advance(700);
  fire('pointerup', { clientX: 280, clientY: 200 });
  assert.equal(wb.strokeCount, 1);
  const s = wb.strokes[0];
  assert.ok(s.points.length >= 72, `body: ${s.points.length}`);
  assert.deepEqual(s.points[0].slice(0, 2), s.points.at(-1).slice(0, 2));
  const rs = s.points.map((p) => Math.hypot(p[0] - 200, p[1] - 200));
  assert.ok(Math.max(...rs) - Math.min(...rs) < 8, 'dokonalý kruh');
  wb.undo();
  assert.equal(wb.strokeCount, 0);
});

test('tvary: bez podržení zůstane odřenoruční tah (mnoho bodů, šum)', () => {
  const { wb, fire, drawCircle, clock } = shapeBoard();
  drawCircle();
  clock.advance(300);
  fire('pointerup', { clientX: 280, clientY: 200 });
  const rs = wb.strokes[0].points.map((p) => Math.hypot(p[0] - 200, p[1] - 200));
  assert.ok(Math.max(...rs) - Math.min(...rs) > 3, 'šum zůstal');
});

test('tvary: pohyb časovač nuluje (400 ms + pohyb + 400 ms nespustí)', () => {
  const { wb, fire, clock, drawCircle } = shapeBoard();
  drawCircle();
  clock.advance(400);
  fire('pointermove', { clientX: 300, clientY: 230 });
  clock.advance(400);
  fire('pointerup', { clientX: 300, clientY: 230 });
  const rs = wb.strokes[0].points.map((p) => Math.hypot(p[0] - 200, p[1] - 200));
  assert.ok(Math.max(...rs) - Math.min(...rs) > 3);
  assert.ok(wb.strokes[0].points.length > 72 - 1);
});

test('tvary: čára se po podržení narovná a konec následuje ukazatel (gumička s přichycením)', () => {
  const { wb, fire, clock } = shapeBoard();
  fire('pointerdown', { clientX: 50, clientY: 100 });
  for (let x = 54; x <= 250; x += 4) { fire('pointermove', { clientX: x, clientY: 100 + (x % 8 === 0 ? 2 : -2) }); clock.advance(8); }
  clock.advance(700);
  fire('pointermove', { clientX: 300, clientY: 103 }); // konec se táhne dál, 3° od vodorovné
  fire('pointerup', { clientX: 300, clientY: 103 });
  const s = wb.strokes[0];
  assert.equal(s.points.length, 2);
  assert.deepEqual(s.points[0].slice(0, 2), [50, 100]);
  assert.ok(Math.abs(s.points[1][1] - 100) < 1e-6, 'vodorovně');
  assert.ok(s.points[1][0] > 290);
  wb.undo();
  assert.equal(wb.strokeCount, 0);
});

test('tvary: guma nikdy nepřichytává', () => {
  const { wb, el, fire, clock, drawCircle } = shapeBoard();
  el.querySelector('[data-role="wb-eraser"]').click();
  drawCircle();
  clock.advance(700);
  fire('pointerup', { clientX: 280, clientY: 200 });
  assert.equal(wb.strokes[0].tool, 'eraser');
  const rs = wb.strokes[0].points.map((p) => Math.hypot(p[0] - 200, p[1] - 200));
  assert.ok(Math.max(...rs) - Math.min(...rs) > 3);
});

test('tvary: vypnutý přepínač nepřichytává', () => {
  const { wb, el, fire, clock, drawCircle } = shapeBoard();
  el.querySelector('[data-role="wb-shapes"]').click();
  drawCircle();
  clock.advance(700);
  fire('pointerup', { clientX: 280, clientY: 200 });
  const rs = wb.strokes[0].points.map((p) => Math.hypot(p[0] - 200, p[1] - 200));
  assert.ok(Math.max(...rs) - Math.min(...rs) > 3);
});

test('pointercancel zahodí rozdělaný tah (prohlížeč ho zrušil), další tah pak jde nakreslit', () => {
  const { wb, fire, canvas, window } = board();
  fire('pointerdown', { pointerId: 1 });
  fire('pointermove', { pointerId: 1, clientX: 9, clientY: 9 });
  fire('pointercancel', { pointerId: 1 });
  canvas.dispatchEvent(Object.assign(new window.Event('lostpointercapture'), { pointerId: 1 })); // přijde hned po cancel
  assert.equal(wb.strokeCount, 0);
  fire('pointerdown', { pointerId: 2 }); fire('pointermove', { pointerId: 2, clientX: 5 }); fire('pointerup', { pointerId: 2 });
  assert.equal(wb.strokeCount, 1);
  wb.destroy();
});
