// Stránka „Vlastní příklad“ (#/vlastni): student zadá vlastní matici, vektor nebo výraz,
// aplikace vyřeší příklad stávajícím solverem typu a ukáže výsledek i postup na tabuli.
// Typy s `custom: { fields, build }` jsou v js/topics/*.js, kontrola vstupu v js/custom-input.js.
import { h, renderTex } from '../render.js';
import { mountStepper } from './stepper.js';
import { stepVisual, disposeStepVisual } from '../viz/step.js';
import { createTypePicker } from './typepicker.js';
import { matrixInput, mathField, symbolPanel } from './inputs.js';
import { exprTex, MAX_DIM } from '../custom-input.js';

export const customChoices = (topics) => topics.flatMap((t) => [...(t.customTypes || []), ...(t.types || []).filter((x) => x.custom)]
  .map((x) => ({ id: `${t.id}/${x.id}`, title: x.title, group: t.title, type: x })));

const KEY = 'matika-vlastni:';
const load = (id) => { try { return JSON.parse(localStorage.getItem(KEY + id)); } catch { return null; } };
const save = (id, v) => { try { localStorage.setItem(KEY + id, JSON.stringify(v)); } catch { /* bez ukládání */ } };

// Matice nebo vektor s tlačítky pro změnu rozměrů -> { el, inputs(), get() }
function gridField(doc, f, saved) {
  const isVec = f.kind === 'vector';
  let rows = (Array.isArray(saved) && saved.length) || f.rows || 2;
  let cols = isVec ? 1 : (Array.isArray(saved) && saved[0]?.length) || f.cols || 2;
  let vals = isVec && Array.isArray(saved) ? saved.map((x) => [x]) : saved;
  const host = h(doc, 'div');
  let grid;
  const draw = () => {
    host.textContent = '';
    grid = matrixInput(rows, cols, doc);
    grid.inputs.forEach((inp, k) => { inp.value = vals?.[Math.floor(k / cols)]?.[k % cols] ?? ''; });
    host.appendChild(grid.el);
  };
  const resize = (dr, dc) => {
    vals = grid.getValue();
    const sq = f.square;
    rows = Math.min(MAX_DIM, Math.max(sq ? 2 : 1, rows + dr));
    cols = sq ? rows : isVec ? 1 : Math.min(MAX_DIM, Math.max(1, cols + dc));
    draw();
  };
  const btn = (text, dr, dc, label) => h(doc, 'button', { type: 'button', class: 'btn btn-quiet', 'aria-label': label, text, onclick: () => resize(dr, dc) });
  const ctl = f.fixed ? []
    : f.square ? [btn('+ řádek a sloupec', 1, 0, 'Přidat řádek a sloupec'), btn('− řádek a sloupec', -1, 0, 'Ubrat řádek a sloupec')]
      : isVec ? [btn('+ složka', 1, 0, 'Přidat složku'), btn('− složka', -1, 0, 'Ubrat složku')]
        : [btn('+ řádek', 1, 0, 'Přidat řádek'), btn('− řádek', -1, 0, 'Ubrat řádek'), btn('+ sloupec', 0, 1, 'Přidat sloupec'), btn('− sloupec', 0, -1, 'Ubrat sloupec')];
  draw();
  return {
    el: h(doc, 'div', {}, [host, ctl.length ? h(doc, 'div', { class: 'actions' }, ctl) : null]),
    inputs: () => [],
    get: () => (isVec ? grid.getValue().map((r) => r[0]) : grid.getValue()),
  };
}

// Výraz nebo číslo; u výrazu živý náhled (math.js parse -> toTex -> KaTeX)
function textField(doc, f, saved) {
  const input = mathField(doc, { id: `vl-${f.id}`, 'aria-label': f.label, value: typeof saved === 'string' ? saved : '', size: 28 });
  const prev = f.kind === 'expr' ? h(doc, 'div', { class: 'formula', 'aria-live': 'polite' }) : null;
  const upd = () => {
    if (!prev) return;
    const t = input.value.trim() && (f.tex ? f.tex(input.value) : exprTex(input.value));
    prev.hidden = !t;
    if (t) renderTex(prev, t);
  };
  input.addEventListener('input', upd);
  upd();
  return { el: h(doc, 'div', {}, [input, prev]), inputs: () => [input], get: () => input.value };
}

// Volba z několika možností (select) -> stejné rozhraní jako ostatní pole
function choiceField(doc, f, saved) {
  const sel = h(doc, 'select', { class: 'answer-input', id: `vl-${f.id}`, 'aria-label': f.label },
    f.options.map((o) => h(doc, 'option', { value: o, text: o })));
  sel.value = f.options.includes(saved) ? saved : f.options[0];
  return { el: h(doc, 'div', {}, [sel]), inputs: () => [], get: () => sel.value, onChange: (fn) => sel.addEventListener('change', fn) };
}

export function mountCustom(el, topics, { initial, coarse } = {}) {
  const doc = el.ownerDocument;
  const choices = customChoices(topics);
  let current = choices.find((c) => c.id === initial) || choices[0];
  let stepper = null;
  const formHost = h(doc, 'div', { class: 'custom-form' });
  const out = h(doc, 'div', { 'data-role': 'custom-out' });
  const picker = createTypePicker(doc, {
    label: 'Typ příkladu', choices: choices.map(({ id, title, group }) => ({ id, title, group })), value: current?.id,
    onSelect: (c) => { current = choices.find((x) => x.id === c.id); buildForm(); },
  });
  el.append(picker.el, formHost, out);

  function clearOut() { stepper?.destroy(); stepper = null; out.textContent = ''; }

  function buildForm() {
    clearOut();
    formHost.textContent = '';
    const { custom } = current.type;
    const saved = load(current.id) || {};
    const fields = custom.fields.map((f) => ({ f, w: f.kind === 'matrix' || f.kind === 'vector' ? gridField(doc, f, saved[f.id]) : f.kind === 'choice' ? choiceField(doc, f, saved[f.id]) : textField(doc, f, saved[f.id]) }));
    const wraps = [];
    const prevBox = custom.preview ? h(doc, 'div', { class: 'formula', 'aria-live': 'polite', 'data-role': 'custom-preview', hidden: true }) : null;
    const values = () => Object.fromEntries(fields.map(({ f, w }) => [f.id, w.get()]));
    const refresh = () => {
      const v = values();
      wraps.forEach(({ f, box }) => { box.hidden = !!f.when && !f.when(v); });
      if (!prevBox) return;
      const t = custom.preview(v);
      prevBox.hidden = !t;
      if (t) renderTex(prevBox, t, { display: true });
    };
    const texts = fields.flatMap((x) => x.w.inputs());
    const errBox = h(doc, 'p', { class: 'feedback', role: 'alert', 'data-role': 'custom-error' });
    const solve = () => {
      clearOut();
      errBox.className = 'feedback';
      errBox.textContent = '';
      const vals = values();
      save(current.id, vals);
      try {
        const problem = current.type.solve(custom.build(vals));
        const steps = h(doc, 'div', { 'data-role': 'custom-steps' });
        const q = h(doc, 'div', { class: 'formula' });
        renderTex(q, problem.promptTex, { display: true });
        const a = h(doc, 'div', { class: 'formula', 'data-role': 'custom-answer' });
        renderTex(a, problem.answerTex || '', { display: true });
        out.append(h(doc, 'p', { class: 'prompt-label', text: current.title }), q, h(doc, 'p', { class: 'prompt-label', text: 'Výsledek' }), a, steps);
        stepper = mountStepper(steps, problem.solution, { renderStepVisual: stepVisual, disposeStepVisual });
      } catch (e) {
        clearOut();
        errBox.className = 'feedback wrong';
        errBox.textContent = String(e?.message || '').replace(/^[a-z-]+: /, '') || 'Příklad se nepodařilo vyřešit. Zkontroluj zadání.';
      }
    };
    formHost.append(...fields.map(({ f, w }) => {
      const box = h(doc, 'div', {}, [
        h(doc, 'p', { class: 'prompt-label', text: f.label }),
        f.hint ? h(doc, 'p', { class: 'prompt-label', text: f.hint }) : null,
        w.el,
      ]);
      wraps.push({ f, box });
      return box;
    }));
    if (prevBox) formHost.append(prevBox);
    texts.forEach((i) => i.addEventListener('input', refresh));
    fields.forEach(({ w }) => w.onChange?.(refresh));
    refresh();
    if (texts.length) {
      const s = symbolPanel(doc, texts, { coarse, kind: custom.keypad });
      formHost.append(h(doc, 'div', { class: 'actions' }, [s.toggle]), s.panel);
    }
    formHost.append(
      h(doc, 'div', { class: 'actions' }, [h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'custom-solve', text: 'Vyřešit', onclick: solve })]),
      errBox,
    );
  }
  if (current) buildForm(); else el.appendChild(h(doc, 'p', { class: 'empty', text: 'Vlastní příklady zatím nejsou k dispozici.' }));
  return { destroy: clearOut };
}
