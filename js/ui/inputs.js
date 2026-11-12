// Vstupní pole pro odpovědi: jedno pole (číslo, výraz, interval, limita, soustava, seznam),
// sloupec políček (vektor), mřížka políček (matice) a panel znaků pro výrazy.
// Pole mají nastavení vhodná pro matematiku na iOS/Androidu: žádné automatické velké písmeno,
// opravy ani kontrola pravopisu; inputmode je záměrně „text“, protože desetinná klávesnice
// na iPhonu nemá minus ani lomítko.
import { h } from '../render.js';

export const SYMBOLS = [
  { label: '^', insert: '^', title: 'Mocnina' },
  { label: '√', insert: '√()', caret: 2, title: 'Odmocnina' },
  { label: '/', insert: '/', title: 'Zlomek' },
  { label: 'π', insert: 'π', title: 'Číslo pí' },
  { label: '(', insert: '(', title: 'Levá závorka' },
  { label: ')', insert: ')', title: 'Pravá závorka' },
  { label: '∞', insert: '∞', title: 'Nekonečno' },
];

// Navíc u odpovědi typu interval (answerSpec.kind === 'interval').
export const INTERVAL_SYMBOLS = [
  { label: '<', insert: '<', title: 'Uzavřený interval zleva' },
  { label: '>', insert: '>', title: 'Uzavřený interval zprava' },
  { label: ';', insert: '; ', title: 'Středník mezi krajními body' },
  { label: '∪', insert: '∪', title: 'Sjednocení' },
  { label: '∅', insert: '∅', title: 'Prázdná množina' },
  { label: 'ln', insert: 'ln()', caret: 3, title: 'Přirozený logaritmus' },
  { label: 'e', insert: 'e', title: 'Eulerovo číslo' },
];

export function symbolsFor(kind) {
  return kind === 'interval' ? [...SYMBOLS, ...INTERVAL_SYMBOLS] : SYMBOLS;
}

export function mathField(doc, attrs = {}) {
  return h(doc, 'input', {
    type: 'text', class: 'answer-input',
    inputmode: 'text', enterkeyhint: 'done',
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    ...attrs,
  });
}

function bindEnter(input, onSubmit) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (onSubmit) onSubmit(); }
  });
}

// Mřížka rows × cols; getValue() vrací pole polí řetězců.
export function matrixInput(rows, cols, doc = document, { onSubmit } = {}) {
  const inputs = [];
  const grid = h(doc, 'div', { class: 'matrix-input', role: 'group', 'aria-label': `Matice ${rows} × ${cols}`, style: `--cols:${cols}` });
  for (let i = 0; i < rows; i++) {
    inputs.push([]);
    for (let j = 0; j < cols; j++) {
      const input = mathField(doc, { class: 'answer-input cell', 'aria-label': `Řádek ${i + 1}, sloupec ${j + 1}`, size: 3 });
      bindEnter(input, onSubmit);
      inputs[i].push(input);
      grid.appendChild(input);
    }
  }
  const wrap = h(doc, 'div', { class: 'matrix-scroll' }, grid);
  return {
    el: wrap,
    inputs: inputs.flat(),
    getValue: () => inputs.map((r) => r.map((c) => c.value)),
  };
}

function vectorInput(n, doc, { onSubmit } = {}) {
  const inputs = [];
  const col = h(doc, 'div', { class: 'matrix-input vector-input', role: 'group', 'aria-label': `Vektor o ${n} složkách`, style: '--cols:1' });
  for (let i = 0; i < n; i++) {
    const input = mathField(doc, { class: 'answer-input cell', 'aria-label': `Složka ${i + 1}`, size: 3 });
    bindEnter(input, onSubmit);
    inputs.push(input);
    col.appendChild(input);
  }
  return { el: h(doc, 'div', { class: 'matrix-scroll' }, col), inputs, getValue: () => inputs.map((c) => c.value) };
}

// Vytvoří pole podle druhu odpovědi. Vrací { el, inputs, getValue, isEmpty, setDisabled, focus, clear }.
export function createAnswerInput(doc, spec, { onSubmit } = {}) {
  let part;
  const v = spec?.value;
  if (spec?.kind === 'matrix' && Array.isArray(v) && Array.isArray(v[0])) part = matrixInput(v.length, v[0].length, doc, { onSubmit });
  else if (spec?.kind === 'vector' && Array.isArray(v)) part = vectorInput(v.length, doc, { onSubmit });
  else {
    const input = mathField(doc, { 'aria-label': 'Tvoje odpověď', placeholder: 'Odpověď' });
    bindEnter(input, onSubmit);
    part = { el: input, inputs: [input], getValue: () => input.value };
  }
  const flat = (x) => (Array.isArray(x) ? x.flatMap(flat) : [x]);
  return {
    ...part,
    hasEmpty: () => flat(part.getValue()).some((s) => String(s).trim() === ''),
    isEmpty: () => flat(part.getValue()).every((s) => String(s).trim() === ''),
    setDisabled(d) { part.inputs.forEach((i) => { i.disabled = d; }); },
    focus() { part.inputs[0]?.focus(); },
    clear() { part.inputs.forEach((i) => { i.value = ''; }); },
  };
}

// Vloží text na místo kurzoru v poli a přesune kurzor.
export function insertAtCaret(input, text, caret = text.length) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const pos = start + caret;
  try { input.setSelectionRange(pos, pos); } catch { /* pole nemusí podporovat výběr */ }
  input.dispatchEvent(new input.ownerDocument.defaultView.Event('input', { bubbles: true }));
}

// Panel znaků; vkládá do naposledy vybraného pole z `inputs`. Na dotykových zařízeních
// je vidět hned, jinde se zapíná tlačítkem „Znaky“.
// kind = answerSpec.kind (u intervalu přibudou <, >, ∪, ∅, ln, e).
export function symbolPanel(doc, inputs, { coarse, kind } = {}) {
  const win = doc.defaultView;
  const isCoarse = coarse ?? !!win?.matchMedia?.('(pointer: coarse)').matches;
  let last = inputs[0] || null;
  inputs.forEach((i) => i.addEventListener('focus', () => { last = i; }));
  const panel = h(doc, 'div', { class: 'symbol-panel', id: `sym-${Math.random().toString(36).slice(2, 8)}`, role: 'group', 'aria-label': 'Matematické znaky' });
  for (const s of symbolsFor(kind)) {
    const b = h(doc, 'button', { type: 'button', class: 'sym-btn', 'aria-label': s.title, title: s.title, text: s.label });
    // Tlačítko nesmí sebrat zaměření poli, jinak by zmizela klávesnice i kurzor.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') e.preventDefault(); });
    b.addEventListener('click', () => {
      const target = last || inputs[0];
      if (!target || target.disabled) return;
      target.focus();
      insertAtCaret(target, s.insert, s.caret);
    });
    panel.appendChild(b);
  }
  const toggle = h(doc, 'button', {
    type: 'button', class: 'btn btn-quiet sym-toggle', 'aria-controls': panel.id,
    'aria-expanded': String(isCoarse), text: 'Znaky',
  });
  panel.hidden = !isCoarse;
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  return { panel, toggle };
}
