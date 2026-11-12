// Stránka #/vzorce: vlastní přehled vzorců s vyhledáváním (js/formulas.js).
import { renderTex, renderText, h } from '../render.js';
import { formulaGroups, filterGroups, OWN_NOTE } from '../formulas.js';

export function renderFormulas(el) {
  const doc = el.ownerDocument;
  el.textContent = '';
  const input = h(doc, 'input', {
    type: 'search', id: 'formula-search', class: 'search-input', autocomplete: 'off',
    placeholder: 'Např. limita, Cramer, tečna',
  });
  const list = h(doc, 'div', { class: 'formula-list', 'aria-live': 'polite' });
  el.append(
    h(doc, 'p', { class: 'own-note', text: `${OWN_NOTE}.` }),
    h(doc, 'div', { class: 'field search-field' }, [
      h(doc, 'label', { for: 'formula-search', text: 'Hledat podle tématu nebo poznámky' }),
      input,
    ]),
    list,
  );

  function draw() {
    list.textContent = '';
    const groups = filterGroups(formulaGroups, input.value);
    if (groups.length === 0) {
      list.appendChild(h(doc, 'p', { class: 'empty', text: 'Nic nenalezeno. Zkuste jiné slovo.' }));
      return;
    }
    for (const g of groups) {
      list.appendChild(h(doc, 'section', { class: 'formula-group', 'aria-labelledby': `fg-${g.id}` }, [
        h(doc, 'h2', { id: `fg-${g.id}`, text: g.title }),
        h(doc, 'ul', { class: 'formula-items' }, g.items.map((f) => {
          const tex = h(doc, 'div', { class: 'formula' });
          renderTex(tex, f.tex, { display: true });
          return h(doc, 'li', {}, [tex, f.note ? renderText(h(doc, 'div', { class: 'formula-note prose' }), f.note) : null]);
        })),
      ]));
    }
  }
  input.addEventListener('input', draw);
  draw();
  return el;
}
