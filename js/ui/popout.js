// Okno tabule pro druhý displej (#/okno-tabule): velká kreslicí plocha („Psaní“) a zrcadlo
// řešeného postupu z hlavního okna („Postup“) s tlačítky, která krokovač hlavního okna ovládají.
// Spojení: BroadcastChannel (js/ui/board-link.js). Okno nemá žádnou navigaci a nic neposílá na server.
import { renderTex, renderText, h } from '../render.js';
import { mountWhiteboard } from './whiteboard.js';
import { drawBoard, disposeBoard } from '../viz/board.js';
import { drawViz, disposeViz } from '../viz/index.js';
import { CHANNEL_NAME, encode, validate } from './board-link.js';

export function mountPopout(el, { Channel, win } = {}) {
  const doc = el.ownerDocument;
  const w = win || doc.defaultView;
  const Ch = Channel || w.BroadcastChannel;
  let ch = null;
  try { ch = Ch ? new Ch(CHANNEL_NAME) : null; } catch { ch = null; }
  const post = (m) => { try { ch?.postMessage(m); } catch { /* kanál zavřený */ } };
  el.textContent = '';

  // --- záhlaví: zadání, přepínač režimů, celá obrazovka ---
  const topic = h(doc, 'p', { class: 'po-meta', 'data-role': 'po-meta' });
  const task = h(doc, 'div', { class: 'po-task', 'data-role': 'po-task' });
  const taskBox = h(doc, 'div', { class: 'po-prompt', hidden: true }, [topic, task]);
  const waiting = h(doc, 'p', { class: 'po-waiting', 'data-role': 'po-waiting',
    text: 'Čekám na příklad z hlavního okna. Otevři v něm Procvičování nebo Postup.' });
  const tabs = {};
  const tabList = h(doc, 'div', { class: 'po-modes', role: 'tablist', 'aria-label': 'Režim tabule' });
  for (const [id, label] of [['write', 'Psaní'], ['steps', 'Postup']]) {
    const b = h(doc, 'button', {
      type: 'button', class: 'po-mode', role: 'tab', id: `po-tab-${id}`, 'data-role': `po-mode-${id}`,
      'aria-controls': `po-panel-${id}`, text: label, onclick: () => setMode(id),
    });
    tabs[id] = b;
    tabList.appendChild(b);
  }
  tabList.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const next = mode === 'write' ? 'steps' : 'write';
      setMode(next);
      tabs[next].focus();
      e.preventDefault();
    }
  });
  const fsBtn = h(doc, 'button', { type: 'button', class: 'po-btn', 'data-role': 'po-fullscreen', 'aria-pressed': 'false', text: 'Celá obrazovka' });
  const head = h(doc, 'header', { class: 'po-head' }, [
    h(doc, 'div', { class: 'po-info' }, [taskBox, waiting]), tabList, fsBtn,
  ]);

  // --- režim Psaní ---
  const writeHost = h(doc, 'div', { class: 'po-board' });
  const gradeOk = h(doc, 'button', { type: 'button', class: 'po-btn po-btn-primary', 'data-role': 'po-grade-ok', text: 'Zvládl jsem', onclick: () => post(encode('grade', { correct: true })) });
  const gradeBad = h(doc, 'button', { type: 'button', class: 'po-btn', 'data-role': 'po-grade-bad', text: 'Nezvládl jsem', onclick: () => post(encode('grade', { correct: false })) });
  const gradeRow = h(doc, 'div', { class: 'po-grade', hidden: true }, [
    h(doc, 'span', { class: 'po-grade-note', text: 'Po „Ukaž výsledek“ v hlavním okně se ohodnoť:' }), gradeOk, gradeBad,
  ]);
  const writePanel = h(doc, 'section', { class: 'po-panel', id: 'po-panel-write', role: 'tabpanel', 'aria-labelledby': 'po-tab-write' }, [writeHost, gradeRow]);

  // --- režim Postup (zrcadlo krokovače hlavního okna) ---
  const visual = h(doc, 'div', { class: 'po-visual', 'data-role': 'po-visual' });
  const counter = h(doc, 'p', { class: 'po-counter', 'data-role': 'po-counter', 'aria-live': 'polite' });
  const stepTitle = h(doc, 'h2', { class: 'po-step-title', 'data-role': 'po-step-title' });
  const stepText = h(doc, 'div', { class: 'po-step-text prose', 'data-role': 'po-step-text' });
  const prevBtn = h(doc, 'button', { type: 'button', class: 'po-btn', 'data-role': 'po-prev', disabled: true, text: 'Předchozí', onclick: () => post(encode('nav', { dir: 'prev' })) });
  const nextBtn = h(doc, 'button', { type: 'button', class: 'po-btn po-btn-primary', 'data-role': 'po-next', disabled: true, text: 'Další krok', onclick: () => post(encode('nav', { dir: 'next' })) });
  const stepsEmpty = h(doc, 'p', { class: 'po-waiting', text: 'Postup se tu ukáže, jakmile v hlavním okně otevřeš záložku Postup.' });
  const stepsBody = h(doc, 'div', { class: 'po-steps-body', hidden: true }, [
    visual,
    h(doc, 'div', { class: 'po-caption' }, [counter, stepTitle, stepText]),
  ]);
  const stepsPanel = h(doc, 'section', { class: 'po-panel', id: 'po-panel-steps', role: 'tabpanel', 'aria-labelledby': 'po-tab-steps', hidden: true }, [
    stepsEmpty, stepsBody,
    h(doc, 'nav', { class: 'po-nav', 'aria-label': 'Krokování hlavního okna' }, [prevBtn, nextBtn]),
  ]);

  const root = h(doc, 'div', { class: 'popout' }, [head, h(doc, 'main', { class: 'po-main' }, [writePanel, stepsPanel])]);
  el.appendChild(root);
  const wb = mountWhiteboard(writeHost);

  let mode = 'write';
  function setMode(m) {
    mode = m;
    for (const [id, b] of Object.entries(tabs)) {
      b.setAttribute('aria-selected', String(id === m));
      b.tabIndex = id === m ? 0 : -1;
    }
    writePanel.hidden = m !== 'write';
    stepsPanel.hidden = m !== 'steps';
    root.dataset.mode = m;
    // po zobrazení plátna se změní jeho velikost; pozorovatel kresbu překreslí ze zásobníku tahů
  }
  setMode('write');

  function onProblem(m) {
    topic.textContent = [m.topicTitle, m.typeTitle].filter(Boolean).join(' – ');
    renderTex(task, m.promptTex, { display: true });
    taskBox.hidden = false;
    waiting.hidden = true;
    gradeRow.hidden = !m.selfGraded;
  }

  function onStep(m) {
    stepsEmpty.hidden = true;
    stepsBody.hidden = false;
    counter.textContent = `Krok ${m.index + 1} z ${m.total}`;
    stepTitle.textContent = m.title;
    renderText(stepText, m.text);
    let drawn = false;
    if (m.board) drawn = drawBoard(visual, m.board.lines, m.board.upTo) > 0;
    if (m.viz) {
      if (!drawn) disposeBoard(visual);
      drawn = drawViz(visual, m.viz, { join: drawn }) || drawn;
    }
    if (!drawn) {
      disposeBoard(visual); disposeViz(visual);
      if (m.tex) { renderTex(visual, m.tex, { display: true }); drawn = true; } else visual.textContent = '';
    }
    visual.hidden = !drawn;
    prevBtn.disabled = m.index === 0;
    nextBtn.disabled = m.index === m.total - 1;
  }

  if (ch) {
    ch.onmessage = (ev) => {
      const m = validate(ev?.data);
      if (!m) return;
      if (m.type === 'problem') onProblem(m);
      else if (m.type === 'clear') wb.clear();
      else if (m.type === 'step') onStep(m);
      else if (m.type === 'close') { try { w.close(); } catch { /* ignorováno */ } }
    };
  }

  // Celá obrazovka celého okna (vyžaduje kliknutí uživatele).
  async function toggleFs() {
    const de = doc.documentElement;
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else if (de.requestFullscreen) await de.requestFullscreen();
    } catch { /* prohlížeč celou obrazovku nepovolil */ }
    syncFs();
  }
  const syncFs = () => {
    const on = !!doc.fullscreenElement;
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.textContent = on ? 'Zavřít celou obrazovku' : 'Celá obrazovka';
  };
  fsBtn.addEventListener('click', toggleFs);
  doc.addEventListener('fullscreenchange', syncFs);

  const bye = () => post(encode('bye'));
  w.addEventListener?.('beforeunload', bye);
  w.addEventListener?.('pagehide', bye);
  post(encode('hello'));

  return {
    get mode() { return mode; },
    whiteboard: wb,
    setMode,
    destroy() {
      bye();
      w.removeEventListener?.('beforeunload', bye);
      w.removeEventListener?.('pagehide', bye);
      doc.removeEventListener('fullscreenchange', syncFs);
      wb.destroy();
      disposeBoard(visual); disposeViz(visual);
      try { ch?.close(); } catch { /* ignorováno */ }
      el.textContent = '';
    },
  };
}
