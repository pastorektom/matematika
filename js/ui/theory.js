// Obrazovka Výklad: topic.theory = [{ heading, tex?, text, viz?: { kind, data }, mistakes?: string[] }]
// viz je stejná grafická pomůcka jako u kroků postupu (plot, tangent, matrix, gauss, signchart);
// kreslí se pod text a vzorec do rámu tabule. Vadná data se tiše vynechají.
import { renderTex, renderText, h } from '../render.js';
import { drawViz, disposeViz } from '../viz/index.js';

// Rozdělí dlouhý display vzorec na části podle \quad, \qquad a čárek na nejvyšší úrovni
// (mimo závorky, { }, \begin…\end a \left…\right). Vrací pole částí (čárka zůstává na konci části).
export function splitDisplayTex(tex) {
  const s = String(tex ?? '');
  const parts = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  const push = (end, next) => { const t = s.slice(start, end).trim(); if (t) parts.push(t); start = next; };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      const name = m ? m[1] : '';
      if (!name && s[i + 1] === '{') depth++; // \{ … \} se chová jako závorka
      if (!name && s[i + 1] === '}') depth = Math.max(0, depth - 1);
      if (name === 'begin' || name === 'left') depth++;
      else if (name === 'end' || name === 'right') depth = Math.max(0, depth - 1);
      else if ((name === 'quad' || name === 'qquad') && depth === 0) { push(i, i + name.length + 1); }
      i += 1 + (name.length || 1);
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) push(i + 1, i + 1);
    i++;
  }
  push(s.length, s.length);
  return parts;
}

export function disposeTheory(el) {
  el.__theoryRo?.disconnect();
  el.__theoryRo = null;
  disposeViz(el);
}

const overflows = (f) => f.scrollWidth > f.clientWidth + 1;

function renderFormula(doc, f, tex, parts) {
  f.textContent = '';
  if (parts) {
    f.classList.add('formula-split');
    for (const t of parts) renderTex(f.appendChild(h(doc, 'div', { class: 'formula-part' })), t, { display: true });
  } else {
    f.classList.remove('formula-split');
    renderTex(f, tex, { display: true });
  }
}

// Vzorec se nikdy neřeže, dokud je kde: 1) vedle textu, 2) přes celou šířku pod textem,
// 3) rozdělený na řádky podle čárek, 4) teprve nakonec vodorovné posouvání.
export function fitTheory(el) {
  const doc = el.ownerDocument;
  for (const block of el.querySelectorAll('.theory-block')) {
    const f = block.querySelector(':scope > .formula');
    if (!f || f.dataset.tex == null) continue;
    block.classList.remove('wide');
    if (f.classList.contains('formula-split')) renderFormula(doc, f, f.dataset.tex, null);
    if (!overflows(f)) continue;
    block.classList.add('wide');
    if (!overflows(f)) continue;
    const parts = splitDisplayTex(f.dataset.tex);
    if (parts.length > 1) renderFormula(doc, f, f.dataset.tex, parts);
  }
}

export function renderTheory(el, topic) {
  const doc = el.ownerDocument;
  disposeTheory(el);
  el.textContent = '';
  const items = Array.isArray(topic?.theory) ? topic.theory : [];
  if (items.length === 0) {
    el.appendChild(h(doc, 'p', { class: 'empty', text: 'Výklad k tomuto tématu se připravuje.' }));
    return el;
  }
  for (const item of items) {
    const text = h(doc, 'div', { class: 'prose' });
    renderText(text, item.text || '');
    let formula = null;
    if (item.tex) {
      formula = h(doc, 'div', { class: 'formula', 'data-tex': item.tex });
      renderTex(formula, item.tex, { display: true });
    }
    let viz = null;
    if (item.viz) {
      viz = h(doc, 'div', { class: 'theory-viz' });
      if (!drawViz(viz, item.viz)) viz = null;
    }
    let mistakes = null;
    if (Array.isArray(item.mistakes) && item.mistakes.length) {
      mistakes = h(doc, 'aside', { class: 'mistakes', 'aria-label': 'Časté chyby' }, [
        h(doc, 'h3', { text: 'Časté chyby' }),
        h(doc, 'ul', {}, item.mistakes.map((m) => renderText(h(doc, 'li'), m))),
      ]);
    }
    el.appendChild(h(doc, 'section', { class: 'theory-block' }, [
      h(doc, 'h2', { text: item.heading || '' }),
      text,
      formula,
      viz,
      mistakes,
    ]));
  }
  const win = doc.defaultView;
  if (win && typeof win.ResizeObserver === 'function') {
    let last = -1;
    const ro = new win.ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      if (w === last) return;
      last = w;
      fitTheory(el);
    });
    ro.observe(el);
    el.__theoryRo = ro;
  }
  win?.requestAnimationFrame?.(() => fitTheory(el));
  doc.fonts?.ready?.then?.(() => { if (el.isConnected) fitTheory(el); });
  return el;
}

