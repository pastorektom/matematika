// Obrazovka Procvičování: zadání, pole pro odpověď, kontrola, zápis pokusu.
// Závislosti (check, record, navigate, rng, now) lze podstrčit přes opts kvůli testům.
import { check as defaultCheck } from '../checker.js';
import { recordAttempt } from '../progress.js';
import { renderTex, renderText, h } from '../render.js';
import { makeRng, randomSeed } from '../rng.js';
import { routeHref } from '../router.js';
import { createAnswerInput, symbolPanel } from './inputs.js';
import { mountWhiteboard } from './whiteboard.js';
import { drawViz, disposeViz } from '../viz/index.js';
import { createTypePicker } from './typepicker.js';
import { getHub, openPopout as defaultOpenPopout, POPOUT_HINT } from './board-link.js';

export const MESSAGES = {
  correct: 'Správně!',
  wrong: 'Zatím ne – zkus to znovu.',
  syntax: 'Tomu zápisu nerozumím – zkontroluj závorky a znaménka.',
  unsupported: 'Tuhle odpověď zatím neumím sama ověřit. Použij „Ukaž výsledek“ a porovnej.',
  infinite: 'Správně, řešení je nekonečně mnoho – zapiš je parametricky, např. (t, 2t).',
  empty: 'Nejdřív něco zadej.',
  failed: 'Příklad se nepodařilo vytvořit – zkus další.',
};

function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(Number(n.toPrecision(10))).replace('.', '{,}');
}

// Správná odpověď pro „Ukaž výsledek“: { tex } nebo { text }.
export function formatAnswer(problem) {
  if (problem.answerTex) return { tex: problem.answerTex };
  const { kind, value } = problem.answerSpec || {};
  if (kind === 'number') return { tex: num(value) };
  if (kind === 'matrix' && Array.isArray(value)) {
    return { tex: `\\begin{pmatrix}${value.map((r) => r.map(num).join(' & ')).join(' \\\\ ')}\\end{pmatrix}` };
  }
  if (kind === 'vector' && Array.isArray(value)) {
    return { tex: `\\begin{pmatrix}${value.map(num).join(' \\\\ ')}\\end{pmatrix}` };
  }
  if (Array.isArray(value)) return { text: value.map((x) => (Array.isArray(x) ? `(${x.join(', ')})` : String(x))).join('; ') };
  return { text: String(value ?? '') };
}

// Pevné příklady ze cvičení (js/content.js) mají typ 'cviceni' a „seed“ = pořadí v seznamu.
export const FIXED_TYPE = 'cviceni';
export const FIXED_TITLE = 'Příklady ze cvičení';

export function buildFixedProblem(topic, list, index) {
  const i = ((index % list.length) + list.length) % list.length;
  const f = list[i];
  return { ...f, topic: topic.id, type: FIXED_TYPE, sourceType: f.type, seed: i };
}

// Seed -> typ (při volbě „Všechny typy“) a příklad; stejný seed dá vždy stejný příklad.
export function buildProblem(topic, seed, typeId) {
  const types = topic.types;
  const type = types.find((t) => t.id === typeId) || types[Math.floor(makeRng(seed ^ 0x9e3779b9)() * types.length)];
  const problem = type.generate(makeRng(seed));
  return { ...problem, topic: problem.topic ?? topic.id, type: type.id, seed };
}

export function mountPractice(el, topic, opts = {}) {
  const doc = el.ownerDocument;
  const check = opts.check || defaultCheck;
  const record = opts.record || recordAttempt;
  const now = opts.now || (() => Date.now());
  const navigate = opts.navigate || ((r) => { doc.defaultView.location.hash = routeHref(r.id, 'postup', r); });
  const hub = opts.hub || getHub(doc.defaultView);
  const openPopout = opts.openPopout || defaultOpenPopout;
  const nextSeed = opts.rng ? () => Math.floor(opts.rng() * 4294967296) >>> 0 : randomSeed;
  const types = Array.isArray(topic.types) ? topic.types : [];
  el.textContent = '';

  if (types.length === 0) {
    el.appendChild(h(doc, 'p', { class: 'empty', text: 'Procvičování k tomuto tématu se připravuje.' }));
    return { get problem() { return null; }, destroy() {} };
  }

  let selected = null; // null = všechny typy, FIXED_TYPE = příklady ze cvičení
  let fixed = [];
  let fixedIndex = -1;
  let problem = null;
  let shownAt = 0;
  let finished = false;
  let answerInput = null;
  let board = null;
  let boardBtn = null;
  let boardOpen = false; // uživatel chce tabuli vidět (v okně, nebo na druhém displeji)
  let autoOpened = false; // tabuli „otevřelo“ až okno na druhém displeji (po jeho zavření se zase schová)

  const onSelect = (c) => {
    if (c.id === FIXED_TYPE) { selected = FIXED_TYPE; fixedIndex = -1; } else selected = c.id || null;
    newProblem();
  };
  const pickerChoices = () => [
    types.length > 1 ? { id: '', title: 'Všechny typy' } : { id: '', title: types[0].title },
    ...(types.length > 1 ? types.map((t) => ({ id: t.id, title: t.title })) : []),
    ...(fixed.length ? [{ id: FIXED_TYPE, title: FIXED_TITLE, group: 'Příklady ze cvičení' }] : []),
  ];
  let picker = types.length > 1 ? createTypePicker(doc, { choices: pickerChoices(), value: '', onSelect }) : null;
  const prompt = h(doc, 'div', { class: 'prompt' });
  const toolsSlot = h(doc, 'div', { class: 'practice-tools', 'data-slot': 'tabule' });
  const boardBox = h(doc, 'div', { class: 'practice-board', 'data-role': 'board', hidden: true });
  const answerBox = h(doc, 'div', { class: 'answer-box' });
  const feedback = h(doc, 'p', { class: 'feedback', 'data-role': 'feedback', 'aria-live': 'polite' });
  const revealBox = h(doc, 'div', { class: 'reveal-box', 'data-role': 'reveal-box', hidden: true });
  const checkBtn = h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'check', text: 'Zkontrolovat' });
  const revealBtn = h(doc, 'button', { type: 'button', class: 'btn btn-quiet', 'data-role': 'reveal', text: 'Ukaž výsledek' });
  const nextBtn = h(doc, 'button', { type: 'button', class: 'btn btn-quiet', 'data-role': 'next', text: 'Další příklad' });
  const solutionBtn = h(doc, 'button', { type: 'button', class: 'btn btn-quiet', 'data-role': 'solution', text: 'Ukaž postup' });
  const stepperSlot = h(doc, 'div', { class: 'practice-stepper', 'data-slot': 'postup' });
  const moved = h(doc, 'div', { class: 'practice-board board-moved', 'data-role': 'board-moved', hidden: true }, [
    h(doc, 'p', { class: 'board-moved-text', text: 'Tabule je na druhém displeji.' }),
    h(doc, 'button', {
      type: 'button', class: 'btn btn-quiet', 'data-role': 'board-return', text: 'Vrátit zpět',
      onclick: () => { hub.closePopout(); hub.release(); },
    }),
  ]);
  const root = h(doc, 'section', { class: 'practice', 'aria-label': 'Procvičování' }, [
    picker?.el, prompt, toolsSlot, answerBox, boardBox, moved, feedback, revealBox,
    h(doc, 'div', { class: 'practice-buttons' }, [checkBtn, revealBtn]),
    h(doc, 'div', { class: 'practice-buttons practice-more' }, [nextBtn, solutionBtn]),
    stepperSlot,
  ]);
  el.appendChild(root);

  function say(kind, text) {
    feedback.textContent = text;
    feedback.className = `feedback ${kind}`;
  }

  function markPicker() { picker?.setValue(selected ?? ''); }

  async function popOut() {
    const r = await openPopout(doc.defaultView);
    if (r.blocked) say('hint', 'Okno se nepodařilo otevřít. Povol pro tuto stránku vyskakovací okna.');
    else if (!r.placed) say('hint', POPOUT_HINT);
  }
  const popAvailable = () => hub.supported || typeof opts.openPopout === 'function';

  // Tabule se ukáže v okně, nebo (když běží okno na druhém displeji) jako poznámka s tlačítkem „Vrátit zpět“.
  function applyBoard() {
    const popped = hub.isOpen;
    if (boardOpen && !popped) {
      if (!board) board = mountWhiteboard(boardBox, popAvailable() ? { onPopout: popOut } : {});
      boardBox.hidden = false;
      moved.hidden = true;
      root.classList.add('has-board');
    } else {
      boardBox.hidden = true;
      root.classList.remove('has-board');
      moved.hidden = !(boardOpen && popped);
    }
    boardBtn?.setAttribute('aria-pressed', String(boardOpen));
  }

  function closeBoard() {
    board?.destroy();
    board = null;
    boardBox.textContent = '';
    boardOpen = autoOpened = hub.isOpen; // běží-li okno na druhém displeji, poznámka zůstává i u dalšího příkladu
    applyBoard();
  }

  function openBoard() { boardOpen = true; autoOpened = false; applyBoard(); }

  // Skrytí tabule kresbu zachová; zničí se až u dalšího příkladu.
  function hideBoard() { boardOpen = false; autoOpened = false; applyBoard(); }

  function isBoard() { return problem?.answerSpec?.kind === 'whiteboard'; }

  function lock(v) {
    finished = v;
    revealBtn.disabled = v;
    answerInput?.setDisabled(v);
    checkBtn.disabled = v;
  }

  function show(seed, typeId) {
    revealBox.hidden = true;
    revealBox.textContent = '';
    stepperSlot.textContent = '';
    toolsSlot.textContent = '';
    closeBoard();
    boardBtn = null;
    checkBtn.hidden = false;
    revealBtn.disabled = false;
    say('', '');
    disposeViz(prompt);
    try {
      problem = typeId === FIXED_TYPE ? buildFixedProblem(topic, fixed, seed) : buildProblem(topic, seed, typeId);
    } catch {
      problem = null;
      answerInput = null; // staré políčko už nesmí zůstat v použití
      prompt.textContent = '';
      answerBox.textContent = '';
      answerBox.appendChild(h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'retry', text: 'Další příklad', onclick: newProblem }));
      say('wrong', MESSAGES.failed);
      lock(true);
      return;
    }
    prompt.textContent = '';
    const type = types.find((t) => t.id === problem.type);
    const labelText = problem.type === FIXED_TYPE
      ? `${FIXED_TITLE}: ${problem.seed + 1} z ${fixed.length}${problem.source ? ` · ${problem.source}` : ''}`
      : type?.title || '';
    prompt.appendChild(h(doc, 'p', { class: 'prompt-label', text: labelText }));
    hub.setProblem({
      id: `${problem.topic}:${problem.type}:${problem.seed}`, promptTex: String(problem.promptTex ?? ''),
      topicTitle: topic.title || '', typeTitle: labelText, selfGraded: problem.answerSpec?.kind === 'whiteboard',
    });
    const f = h(doc, 'div', { class: 'formula' });
    renderTex(f, problem.promptTex, { display: true });
    if (problem.task) prompt.appendChild(renderText(h(doc, 'div', { class: 'prompt-task prose', 'data-role': 'task' }), problem.task));
    prompt.appendChild(f);
    // problem.promptViz = { kind, data }: graf k zadání (např. „Limity z grafu“) pod vzorcem v rámu tabule
    if (problem.promptViz) {
      const pv = h(doc, 'div', { class: 'prompt-viz', 'data-role': 'prompt-viz' });
      if (drawViz(pv, problem.promptViz)) prompt.appendChild(pv);
    }
    if (problem.hint) prompt.appendChild(h(doc, 'p', { class: 'prompt-hint', text: problem.hint }));

    answerBox.textContent = '';
    if (isBoard()) {
      // Tabule místo textového pole; správnost posoudí student sám po „Ukaž výsledek“.
      checkBtn.hidden = true;
      answerInput = { inputs: [], setDisabled() {}, hasEmpty: () => false, getValue: () => '' };
      openBoard();
    } else {
      answerInput = createAnswerInput(doc, problem.answerSpec, { onSubmit: submit });
      const sym = symbolPanel(doc, answerInput.inputs, { coarse: opts.coarse, kind: problem.answerSpec?.kind });
      const field = h(doc, 'div', { class: 'answer-field', 'data-role': 'answer' }, answerInput.el);
      answerBox.append(
        h(doc, 'div', { class: 'answer-row' }, [field, sym.toggle]),
        sym.panel,
      );
      boardBtn = h(doc, 'button', {
        type: 'button', class: 'btn btn-quiet', 'data-role': 'tabule', 'aria-pressed': 'false',
        'aria-label': 'Tabule: zobrazit nebo skrýt kreslicí plochu', text: 'Tabule',
        onclick: () => (board && !boardBox.hidden ? hideBoard() : openBoard()),
      });
      toolsSlot.appendChild(boardBtn);
    }
    if (popAvailable() && !isBoard()) {
      toolsSlot.appendChild(h(doc, 'button', {
        type: 'button', class: 'btn btn-quiet', 'data-role': 'popout', text: 'Na druhý displej',
        'aria-label': 'Otevřít tabuli v samostatném okně na druhém displeji', onclick: popOut,
      }));
    }
    lock(false);
    shownAt = now();
    markPicker();
    if (typeof opts.onProblem === 'function') opts.onProblem({ problem, toolsSlot, stepperSlot });
  }

  function newProblem() {
    if (selected === FIXED_TYPE && fixed.length) {
      fixedIndex = (fixedIndex + 1) % fixed.length;
      show(fixedIndex, FIXED_TYPE);
    } else show(nextSeed(), selected);
  }

  function submit() {
    if (!problem || finished) return;
    if (answerInput.hasEmpty()) { say('hint', MESSAGES.empty); return; }
    const value = answerInput.getValue();
    const ms = now() - shownAt;
    const r = check(problem.answerSpec, value);
    if (r.ok) {
      say('ok', problem.conclusion ? `${MESSAGES.correct} ${problem.conclusion}` : MESSAGES.correct);
      logWith(true, value, ms);
      lock(true);
      nextBtn.focus();
    } else if (r.reason === 'syntax') {
      say('hint', MESSAGES.syntax); // zápis nejde přečíst, takže to není pokus
    } else if (r.reason === 'unsupported') {
      say('hint', MESSAGES.unsupported);
    } else {
      if (r.normalized === 'infinite') { say('hint', MESSAGES.infinite); return; } // není pokus, příklad zůstává otevřený
      say('wrong', MESSAGES.wrong);
      logWith(false, value, ms);
    }
  }

  function logWith(correct, value, ms) {
    const answer = typeof value === 'string' ? value : JSON.stringify(value);
    Promise.resolve(record({
      topic: problem.topic, type: problem.type, seed: problem.seed, answer, correct, ms,
    })).catch(() => {});
  }

  function reveal() {
    if (!problem || finished || revealBox.hidden === false) return;
    const ms = now() - shownAt;
    if (isBoard()) { revealBoard(); return; }
    // „Ukaž výsledek“ se zapisuje jako nezodpovězený příklad (correct:false, revealed:true).
    logWith(false, { revealed: true }, ms);
    const a = formatAnswer(problem);
    revealBox.textContent = '';
    revealBox.appendChild(h(doc, 'p', { class: 'reveal-label', text: 'Správný výsledek' }));
    const body = h(doc, 'div', { class: 'reveal-value' });
    if (a.tex != null) renderTex(body, a.tex, { display: true });
    else body.textContent = a.text;
    revealBox.appendChild(body);
    revealBox.hidden = false;
    say('hint', `${problem.conclusion ? `${problem.conclusion} ` : ''}Výsledek je ukázaný. Zkus další příklad, nebo si ukaž postup.`);
    lock(true);
    nextBtn.focus();
  }

  // Tabule: správné řešení vedle kresby, student se hodnotí sám (zapíše se jeden pokus, selfGraded).
  function revealBoard() {
    const a = formatAnswer(problem);
    revealBox.textContent = '';
    revealBox.appendChild(h(doc, 'p', { class: 'reveal-label', text: 'Správný výsledek' }));
    const body = h(doc, 'div', { class: 'reveal-value' });
    if (a.tex != null) renderTex(body, a.tex, { display: true });
    else body.textContent = a.text;
    const grade = (correct) => {
      if (finished) return;
      logWith(correct, { selfGraded: true }, now() - shownAt);
      lock(true);
      selfRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      say('hint', correct ? 'Zapsáno jako zvládnuté.' : 'Zapsáno. Zkus další příklad, nebo si ukaž postup.');
      nextBtn.focus();
    };
    const selfRow = h(doc, 'div', { class: 'practice-buttons' }, [
      h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'self-ok', 'aria-label': 'Zvládl jsem', text: 'Zvládl jsem', onclick: () => grade(true) }),
      h(doc, 'button', { type: 'button', class: 'btn btn-quiet', 'data-role': 'self-bad', 'aria-label': 'Nezvládl jsem', text: 'Nezvládl jsem', onclick: () => grade(false) }),
    ]);
    revealBox.append(body, selfRow);
    revealBox.hidden = false;
    revealBtn.disabled = true;
    say('hint', 'Porovnej s tabulí a označ, jak ti to šlo.');
  }

  checkBtn.addEventListener('click', submit);
  revealBtn.addEventListener('click', reveal);
  nextBtn.addEventListener('click', newProblem);
  solutionBtn.addEventListener('click', () => {
    if (problem) navigate({ id: topic.id, seed: problem.seed, type: problem.type });
  });

  const unPresence = hub.onPresence((open) => {
    if (!root.isConnected) { unPresence(); return; }
    if (open) { if (!boardOpen) { boardOpen = true; autoOpened = true; } } else if (autoOpened) { boardOpen = false; autoOpened = false; }
    applyBoard();
  });
  const unGrade = hub.onGrade((correct) => {
    if (!root.isConnected) { unGrade(); return; }
    const b = revealBox.querySelector(correct ? '[data-role="self-ok"]' : '[data-role="self-bad"]');
    if (b && !b.disabled) b.click();
  });

  newProblem();

  // Pevné příklady se načítají asynchronně; volba „Příklady ze cvičení“ se přidá, jen když nějaké jsou.
  function setFixed(list) {
    fixed = Array.isArray(list) ? list.filter((p) => p && p.promptTex && p.answerSpec) : [];
    if (!fixed.length) {
      if (picker && types.length <= 1) { picker.destroy(); picker = null; } else picker?.setChoices(pickerChoices(), selected ?? '');
      return;
    }
    if (!picker) {
      picker = createTypePicker(doc, { choices: pickerChoices(), value: selected ?? '', onSelect });
      root.insertBefore(picker.el, prompt);
    } else picker.setChoices(pickerChoices(), selected ?? '');
  }

  return {
    setFixed,
    get problem() { return problem; },
    destroy() { unPresence(); unGrade(); closeBoard(); disposeViz(prompt); el.textContent = ''; },
  };
}
