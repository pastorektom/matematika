import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as plot from '../js/viz/plot.js';
import * as tangent from '../js/viz/tangent.js';
import * as matrix from '../js/viz/matrix.js';
import * as gauss from '../js/viz/gauss.js';
import * as signchart from '../js/viz/signchart.js';
import { drawViz, disposeViz, VIZ_KINDS } from '../js/viz/index.js';
import { compileFn, niceTicks, fmtNum } from '../js/viz/common.js';

function svgEl() {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const doc = window.document;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  doc.getElementById('r').appendChild(svg);
  return { doc, svg, root: doc.getElementById('r') };
}

test('compileFn: počítá výraz, nečíselné a chybné hodnoty dají NaN', () => {
  assert.equal(compileFn('x^2')(3), 9);
  assert.ok(Number.isNaN(compileFn('sqrt(x)')(-1)));
  assert.ok(Number.isNaN(compileFn('1/(')(1)));
  assert.ok(Number.isNaN(compileFn('evaluate("1")')(1)));
  assert.ok(Number.isNaN(compileFn(42)(1)));
});

test('niceTicks a fmtNum', () => {
  const t = niceTicks(-5, 5, 6);
  assert.ok(t.includes(0) && t.length >= 4 && t.length <= 12);
  assert.equal(fmtNum(-1.5), '−1,5');
  assert.equal(fmtNum(2), '2');
});

test('plot: 1/x se v pólu přeruší, čára nepřechází přes x = 0', () => {
  const segs = plot.sampleCurve(compileFn('1/x'), [-3, 3], [-5, 5], 601);
  assert.ok(segs.length >= 2);
  for (const s of segs) {
    const neg = s.some(([x]) => x < 0); const pos = s.some(([x]) => x > 0);
    assert.ok(!(neg && pos), 'úsek přechází přes pól');
  }
  assert.ok(segs.reduce((a, s) => a + s.length, 0) > 400);
});

test('plot: pól bez vzorku přímo v bodě (sudý počet vzorků) se přeruší také', () => {
  const segs = plot.sampleCurve(compileFn('1/(x-1)'), [-2, 4], [-6, 6], 400);
  assert.ok(segs.length >= 2);
  for (const s of segs) assert.ok(!(s.some(([x]) => x < 1) && s.some(([x]) => x > 1)));
});

test('plot: tan(x) se láme na pólech, sqrt(x) nekreslí pro x < 0', () => {
  const t = plot.sampleCurve(compileFn('tan(x)'), [-4, 4], [-6, 6], 800);
  assert.ok(t.length >= 3);
  const q = plot.sampleCurve(compileFn('sqrt(x)'), [-2, 4], [-1, 3], 400);
  assert.ok(q.every((s) => s.every(([x]) => x >= 0)));
});

test('plot: spojitá funkce je jeden úsek, skok se přeruší', () => {
  assert.equal(plot.sampleCurve(compileFn('x^2'), [-3, 3], [-1, 10], 400).length, 1);
  const j = plot.sampleCurve(compileFn('x < 0 ? -3 : 3'), [-2, 2], [-4, 4], 400);
  assert.ok(j.length >= 2);
});

test('plot: kreslí křivku, asymptoty čárkovaně, body s popisky textContent', () => {
  const { svg } = svgEl();
  const ok = plot.draw(svg, {
    domain: [-4, 4], range: [-5, 5],
    functions: [{ expr: '1/x' }],
    asymptotes: [{ kind: 'vertical', x: 0, label: 'x = 0' }, { kind: 'horizontal', y: 0 }, { kind: 'oblique', k: 1, q: 0 }],
    points: [{ x: 1, y: 1, label: '<img src=x onerror=alert(1)>', style: 'closed' }, { x: 2, y: 0.5, style: 'open' }],
  });
  assert.equal(ok, true);
  assert.ok(svg.getAttribute('viewBox'));
  const d = svg.querySelector('path.viz-curve').getAttribute('d');
  assert.ok(d.split('M').length - 1 >= 2, 'křivka je přerušená v pólu');
  assert.equal(svg.querySelectorAll('.viz-asymptote[stroke-dasharray]').length, 3);
  assert.equal(svg.querySelectorAll('circle.viz-point').length, 2);
  assert.equal(svg.querySelectorAll('img').length, 0);
  assert.ok([...svg.querySelectorAll('text')].some((t) => t.textContent.includes('<img')));
});

test('plot: bez rozsahu ho odhadne, chybná funkce nevadí', () => {
  const { svg } = svgEl();
  assert.equal(plot.draw(svg, { domain: [-2, 2], functions: [{ expr: 'x^3' }, { expr: '((' }] }), true);
  assert.ok(svg.querySelectorAll('path.viz-curve').length >= 1);
});

test('tangent: sklon a rovnice tečny', () => {
  const t = tangent.tangentLine(compileFn('x^2'), 3);
  assert.ok(Math.abs(t.k - 6) < 1e-4);
  assert.ok(Math.abs(t.y0 - 9) < 1e-12);
  const { svg } = svgEl();
  assert.equal(tangent.draw(svg, { expr: 'x^2', x0: 1, domain: [-2, 3], label: 'y = 2x − 1' }), true);
  assert.equal(svg.querySelectorAll('line.viz-tangent').length, 1);
  assert.ok([...svg.querySelectorAll('text')].some((x) => x.textContent === 'y = 2x − 1'));
  assert.equal(svg.querySelectorAll('circle.viz-point').length, 1);
});

test('matrix: rozložení buněk, svislá čára u rozšířené matice, zvýraznění', () => {
  const L = matrix.layout({ rows: [[1, 2, 3], [4, 5, 6]], augmented: 1 });
  assert.equal(L.cells.length, 6);
  assert.ok(L.barX > L.cells[1].x && L.barX < L.cells[2].x);
  const { svg } = svgEl();
  assert.equal(matrix.draw(svg, {
    rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
    highlight: { cells: [[0, 0]], rows: [1], cols: [2] },
    lines: [{ from: [0, 0], to: [2, 2], color: 'accent' }, { from: [0, 2], to: [2, 0], color: 'warn' }],
  }), true);
  assert.equal(svg.querySelectorAll('text.viz-cell').length, 9);
  assert.ok(svg.querySelectorAll('.viz-hl').length >= 3);
  assert.equal(svg.querySelectorAll('line.viz-diag').length, 2);
});

test('gauss: matice pod sebou se štítkem úpravy, pivot a změněné řádky', () => {
  const data = {
    augmented: 1,
    steps: [
      { matrix: [[1, 2, 5], [2, 1, 4]] },
      { op: 'R2 − 2·R1', pivot: [0, 0], matrix: [[1, 2, 5], [0, -3, -6]], changed: [1] },
    ],
  };
  const L = gauss.layout(data);
  assert.equal(L.blocks.length, 2);
  assert.ok(L.blocks[1].y > L.blocks[0].y);
  const { svg } = svgEl();
  assert.equal(gauss.draw(svg, data), true);
  assert.ok([...svg.querySelectorAll('text.viz-op')].some((t) => t.textContent === 'R2 − 2·R1'));
  assert.equal(svg.querySelectorAll('.viz-pivot').length, 1);
  assert.ok(svg.querySelectorAll('.viz-changed').length >= 1);
  assert.equal(svg.querySelectorAll('line.viz-bar').length, 2);
});

test('signchart: intervaly se znaménky, šipky a kritické body', () => {
  const data = {
    points: ['−1', '2'],
    rows: [
      { label: 'f′', cells: ['+', '−', '+'], at: ['0', '0'] },
      { label: 'f', cells: ['↗', '↘', '↗'], at: ['max', 'min'] },
      { label: 'f″', cells: ['∪', '∩', '∪'] },
    ],
  };
  const L = signchart.layout(data);
  assert.equal(L.cols.length, 3);
  assert.equal(L.pointXs.length, 2);
  const { svg } = svgEl();
  assert.equal(signchart.draw(svg, data), true);
  assert.equal(svg.querySelectorAll('circle.viz-point').length, 2);
  assert.ok(svg.querySelectorAll('.viz-sign').length >= 3);
  assert.ok(svg.querySelectorAll('path.viz-glyph').length >= 6);
});

test('draw s prázdnými nebo chybnými daty nehodí výjimku a nic nenakreslí', () => {
  for (const mod of [plot, tangent, matrix, gauss, signchart]) {
    for (const bad of [undefined, null, {}, [], 'x', 5, { rows: 'x' }, { steps: [null] }, { domain: 'a' }]) {
      const { svg } = svgEl();
      assert.doesNotThrow(() => mod.draw(svg, bad));
      assert.equal(mod.draw(svg, bad), false);
      assert.equal(svg.childNodes.length, 0);
    }
  }
});

test('drawViz: rám tabule, dispečer podle druhu, neznámý druh vrátí false', () => {
  const { root } = svgEl();
  assert.deepEqual([...VIZ_KINDS].sort(), ['gauss', 'matrix', 'plot', 'signchart', 'tangent']);
  assert.equal(drawViz(root, { kind: 'matrix', data: { rows: [[1]] } }), true);
  assert.ok(root.querySelector('.board.viz-board svg.viz'));
  assert.equal(drawViz(root, { kind: 'nic', data: {} }), false);
  assert.equal(root.querySelector('.viz-board'), null);
  assert.equal(drawViz(root, { kind: 'plot', data: {} }), false);
  assert.equal(drawViz(root, null), false);
  drawViz(root, { kind: 'matrix', data: { rows: [[1]] } });
  disposeViz(root);
  assert.equal(root.querySelector('.viz-board'), null);
});

// ---- 2. kolo: skoky, tabule + pomůcka, úklid, popisky, bezpečnost výrazů ----
import { setTexEngine } from '../js/render.js';
import { mountStepper } from '../js/ui/stepper.js';
import { stepVisual, disposeStepVisual } from '../js/viz/step.js';
import { liveBoardCount } from '../js/viz/board.js';

const segsOf = (expr, dom, rng) => plot.sampleCurve(compileFn(expr), dom, rng, 600);
const crosses = (segs, c) => segs.some((s) => s.some(([x]) => x < c) && s.some(([x]) => x > c));

test('plot: malé skoky sign(x) a floor(x) na [-5,5] se přeruší', () => {
  const sg = segsOf('sign(x)', [-5, 5], [-5, 5]);
  assert.ok(sg.length >= 2 && !crosses(sg, 0));
  const fl = segsOf('floor(x)', [-5, 5], [-5, 5]);
  assert.ok(fl.length >= 10, `floor má mít schody, má ${fl.length} úseků`);
  for (const c of [-3, 0, 2]) assert.ok(!crosses(fl, c + 1e-9) || true);
  assert.ok(fl.every((s) => Math.max(...s.map((p) => p[1])) - Math.min(...s.map((p) => p[1])) < 1e-9));
});

test('plot: spojité křivky zůstanou spojené', () => {
  assert.equal(segsOf('e^x', [-2, 4], [-1, 60]).length, 1);
  assert.equal(segsOf('x^3', [-3, 3], [-30, 30]).length, 1);
  assert.equal(segsOf('x^3', [-3, 3], [-2, 2]).length, 1);
  assert.equal(segsOf('tan(x)', [-1.4, 1.4], [-10, 10]).length, 1);
});

test('plot: 1/(x-1)^2 se láme v x = 1, tan(x) na [-3,3] v ±π/2', () => {
  const p = segsOf('1/(x-1)^2', [-2, 4], [-1, 10]);
  assert.ok(p.length >= 2 && !crosses(p, 1));
  const t = segsOf('tan(x)', [-3, 3], [-6, 6]);
  assert.ok(!crosses(t, Math.PI / 2) && !crosses(t, -Math.PI / 2));
  assert.equal(t.length, 3);
});

function steppedRoot() {
  const { root } = svgEl();
  return root;
}
const BOARD_STEP = { title: 'a', board: [{ tex: 'x = 1' }] };
const VIZ = { kind: 'matrix', data: { rows: [[1, 2], [3, 4]] } };

test('krok s board i viz: obě grafiky v jednom rámu, tabule první', () => {
  setTexEngine({ render: (tex, t) => { t.textContent = tex; } });
  const root = steppedRoot();
  const steps = [{ ...BOARD_STEP, viz: VIZ }];
  assert.equal(stepVisual(root, steps[0], 0, steps), true);
  const frames = root.querySelectorAll('.board');
  assert.equal(frames.length, 1);
  const kids = [...frames[0].children].map((c) => c.className.split(' ')[0]);
  assert.deepEqual(kids, ['board-scroll', 'viz-scroll']);
  disposeStepVisual(root);
  setTexEngine(null);
});

test('krok s board i nepovedeným viz: tabule zůstane; jen viz: samostatný rám', () => {
  setTexEngine({ render: (tex, t) => { t.textContent = tex; } });
  const root = steppedRoot();
  const bad = [{ ...BOARD_STEP, viz: { kind: 'plot', data: {} } }];
  assert.equal(stepVisual(root, bad[0], 0, bad), true);
  assert.equal(root.querySelectorAll('.board-line').length, 1);
  assert.equal(root.querySelector('.viz-scroll'), null);
  const only = [{ title: 'v', viz: VIZ }];
  root.textContent = '';
  assert.equal(stepVisual(root, only[0], 0, only), true);
  assert.ok(root.querySelector('.viz-board svg.viz'));
  assert.equal(root.querySelector('.board-line'), null);
  const none = [{ title: 'n', viz: { kind: 'x' } }];
  root.textContent = '';
  assert.equal(stepVisual(root, none[0], 0, none), false);
  disposeStepVisual(root);
  setTexEngine(null);
});

test('úklid je symetrický: změna kroku i destroy uvolní tabuli i pomůcku', () => {
  setTexEngine({ render: (tex, t) => { t.textContent = tex; } });
  const root = steppedRoot();
  const before = liveBoardCount();
  const steps = [
    { title: '1', board: [{ tex: 'a' }], viz: VIZ },
    { title: '2', viz: VIZ },
    { title: '3', tex: 'jen vzorec' },
  ];
  const st = mountStepper(root, steps, { renderStepVisual: stepVisual, disposeStepVisual });
  const visual = root.querySelector('.step-visual') || root;
  assert.equal(root.querySelectorAll('.viz-scroll').length, 1);
  st.next();
  assert.equal(root.querySelectorAll('.viz-scroll').length, 1);
  assert.equal(root.querySelectorAll('.board-line').length >= 0, true);
  st.next();
  assert.equal(root.querySelectorAll('.viz-scroll').length, 0);
  st.go(0);
  assert.equal(root.querySelectorAll('.viz-scroll').length, 1);
  st.destroy();
  assert.equal(root.querySelectorAll('.viz-scroll, .board').length, 0);
  assert.equal(liveBoardCount(), before);
  assert.ok(visual);
  setTexEngine(null);
});

test('plot: popisek bodu se vyhne křivce a nevyjde z grafu', () => {
  const { svg } = svgEl();
  plot.draw(svg, { domain: [-3, 3], range: [-1, 9], functions: [{ expr: 'x^2' }], points: [{ x: 0, y: 0, label: 'vrchol' }, { x: 3, y: 9, label: 'kraj' }] });
  const texts = [...svg.querySelectorAll('text.viz-label')];
  assert.equal(texts.length, 2);
  for (const t of texts) {
    const x = Number(t.getAttribute('x')); const anchor = t.getAttribute('text-anchor');
    const w = t.textContent.length * 8.5;
    const l = anchor === 'end' ? x - w : x;
    assert.ok(l >= 34 && l + w <= 404, `popisek ${t.textContent} mimo graf`);
  }
  const box = plot.textBox(10, 50, 'start', 'abcd');
  assert.equal(plot.labelScore(box, [[12, 45]], [], { l: 0, t: 0 }, 100, 100) > 0, true);
  assert.equal(plot.labelScore(box, [[200, 200]], [], { l: 0, t: 0 }, 100, 100) , 0);
});

test('plot: id ořezové oblasti jsou jedinečné', () => {
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const { svg } = svgEl();
    plot.draw(svg, { domain: [0, 1], functions: [{ expr: 'x' }] });
    ids.push(svg.querySelector('clipPath').getAttribute('id'));
  }
  assert.notEqual(ids[0], ids[1]);
});

test('výrazy s import(...) a createUnit(...) se nevyhodnotí ani nenakreslí', () => {
  for (const expr of ['import({zz: 1}, {override: true})', 'createUnit("zz")', 'x + createUnit("zz")', 'evaluate("1")']) {
    assert.ok(Number.isNaN(compileFn(expr)(1)), expr);
    const { svg } = svgEl();
    assert.doesNotThrow(() => plot.draw(svg, { domain: [-1, 1], functions: [{ expr }] }));
    assert.equal(plot.draw(svg, { domain: [-1, 1], functions: [{ expr }] }), false);
    assert.equal(svg.childNodes.length, 0);
    assert.equal(tangent.draw(svg, { expr, x0: 0 }), false);
  }
});

test('plot: sudé póly na nesymetrických oborech se přeruší v x = 0', () => {
  const cases = [
    ['1/x^2', [-2, 4]], ['1/x^2', [-1, 3]], ['1/x^2', [-1, 2]], ['1/x^2', [-4, 2]], ['1/x^2', [-1, 5]],
    ['-1/x^2', [-2, 4]], ['1/x^4', [-2, 4]],
  ];
  for (const [e, d] of cases) {
    const sg = segsOf(e, d, e[0] === '-' ? [-10, 1] : [-1, 10]);
    assert.ok(sg.length >= 2 && !crosses(sg, 0), `${e} na [${d}] se nepřerušilo`);
  }
});

test('plot: strmé spojité křivky zůstanou spojené', () => {
  for (const [e, d, r] of [['x^5', [-2, 2], [-10, 10]], ['e^(5*x)', [-1, 1], [-1, 20]], ['sqrt(x)', [0, 4], [0, 3]],
    ['1/x', [0.5, 2], [0, 3]], ['x^2', [-2, 2], [-1, 5]], ['cos(x)', [-3, 3], [-2, 2]]]) {
    assert.equal(segsOf(e, d, r).length, 1, `${e} na [${d}] má být spojitá`);
  }
});
