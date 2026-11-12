// Výběr typu příkladu: jedna kompaktní kombinovaná volba (combobox + listbox) místo řady tlačítek.
// Ovládání z klávesnice: Šipky/Home/End přesouvají zvýraznění, Enter vybere, Esc zavře, psaní filtruje
// (u více než 6 typů je nahoře vyhledávací pole). Volby zůstávají v DOM i při zavřeném seznamu
// (skryté), takže jsou dostupné i testům: každá má data-role a click ji vybere.
import { h } from '../render.js';

export const SEARCH_THRESHOLD = 6;

const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let uid = 0;

// choices: [{ id, title, group? }] – group je název skupiny; volby bez skupiny jdou první.
export function createTypePicker(doc, { label = 'Typ příkladu', choices = [], value = '', onSelect, role = (c) => (c.id ? `type-${c.id}` : 'type-all') } = {}) {
  const n = ++uid;
  const listId = `tp-list-${n}`;
  let list = [];
  let current = value;
  let open = false;
  let active = -1; // index ve viditelných volbách
  let options = []; // { choice, el }

  const valueEl = h(doc, 'span', { class: 'tp-value' });
  const trigger = h(doc, 'button', {
    type: 'button', class: 'tp-trigger', role: 'combobox',
    'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-label': label,
  }, [
    h(doc, 'span', { class: 'tp-label', text: `${label}:` }),
    valueEl,
    h(doc, 'span', { class: 'tp-caret', 'aria-hidden': 'true' }),
  ]);
  const search = h(doc, 'input', {
    type: 'search', class: 'tp-search', placeholder: 'Hledat typ příkladu', autocomplete: 'off',
    'aria-label': 'Hledat typ příkladu', 'aria-controls': listId, hidden: true,
  });
  const ul = h(doc, 'ul', { class: 'tp-list', id: listId, role: 'listbox', tabindex: '-1', 'aria-label': label });
  const empty = h(doc, 'p', { class: 'tp-empty', text: 'Nic nenalezeno.', hidden: true });
  const pop = h(doc, 'div', { class: 'tp-pop', hidden: true }, [search, ul, empty]);
  const root = h(doc, 'div', { class: 'type-picker tp' }, [trigger, pop]);

  const visible = () => options.filter((o) => !o.el.hidden);
  const hasSearch = () => list.filter((c) => c.id).length > SEARCH_THRESHOLD;
  const focusTarget = () => (hasSearch() ? search : ul);

  function paint() {
    const cur = list.find((c) => c.id === current) || list[0];
    valueEl.textContent = cur ? cur.title : '';
    for (const o of options) {
      const sel = o.choice.id === (cur ? cur.id : '');
      o.el.setAttribute('aria-selected', String(sel));
      o.el.dataset.selected = String(sel);
    }
  }

  function setActive(i) {
    const vis = visible();
    if (!vis.length) { active = -1; return; }
    active = Math.max(0, Math.min(i, vis.length - 1));
    for (const o of options) o.el.classList.remove('is-active');
    const o = vis[active];
    o.el.classList.add('is-active');
    focusTarget().setAttribute('aria-activedescendant', o.el.id);
    o.el.scrollIntoView?.({ block: 'nearest' });
  }

  function filter() {
    const q = fold(search.value.trim());
    for (const o of options) o.el.hidden = q !== '' && !fold(o.choice.title).includes(q);
    for (const g of ul.querySelectorAll('.tp-group')) {
      let next = g.nextElementSibling;
      let any = false;
      while (next && !next.classList.contains('tp-group')) { if (!next.hidden) any = true; next = next.nextElementSibling; }
      g.hidden = !any;
    }
    empty.hidden = visible().length > 0;
    const i = visible().findIndex((o) => o.choice.id === current);
    setActive(i >= 0 ? i : 0);
  }

  function select(choice) {
    current = choice.id;
    paint();
    close(true);
    if (typeof onSelect === 'function') onSelect(choice);
  }

  function openList() {
    if (open) return;
    open = true;
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    search.value = '';
    filter();
    focusTarget().focus();
    doc.addEventListener('pointerdown', outside, true);
  }

  function close(refocus) {
    if (!open) return;
    open = false;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    doc.removeEventListener('pointerdown', outside, true);
    if (refocus) trigger.focus();
  }

  function outside(e) { if (!root.contains(e.target)) close(false); }

  function onKey(e) {
    const vis = visible();
    switch (e.key) {
      case 'ArrowDown': setActive(active + 1); break;
      case 'ArrowUp': setActive(active - 1); break;
      case 'Home': if (e.target === search) return; setActive(0); break;
      case 'End': if (e.target === search) return; setActive(vis.length - 1); break;
      case 'Enter': if (vis[active]) select(vis[active].choice); break;
      case 'Escape': close(true); break;
      case 'Tab': close(false); return;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  trigger.addEventListener('click', () => (open ? close(true) : openList()));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList(); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); close(true); }
  });
  pop.addEventListener('keydown', onKey);
  search.addEventListener('input', filter);

  function build() {
    ul.textContent = '';
    options = [];
    const groups = [];
    for (const c of list) {
      const key = c.group || '';
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, items: [] }; groups.push(g); }
      g.items.push(c);
    }
    groups.sort((a, b) => (a.key === '' ? -1 : b.key === '' ? 1 : 0));
    for (const g of groups) {
      if (g.key) ul.appendChild(h(doc, 'li', { class: 'tp-group', role: 'presentation', text: g.key }));
      for (const c of g.items) {
        const el = h(doc, 'li', {
          class: 'tp-option', role: 'option', id: `${listId}-${options.length}`,
          'data-type': c.id, 'data-role': role(c), 'aria-selected': 'false',
        }, [h(doc, 'span', { class: 'tp-check', 'aria-hidden': 'true' }), h(doc, 'span', { text: c.title })]);
        el.addEventListener('click', () => select(c));
        el.addEventListener('pointermove', () => {
          const i = visible().indexOf(options.find((o) => o.el === el));
          if (i >= 0 && i !== active) setActive(i);
        });
        ul.appendChild(el);
        options.push({ choice: c, el });
      }
    }
    search.hidden = !hasSearch();
    root.classList.toggle('has-search', hasSearch());
    paint();
  }

  function setChoices(next, val) {
    list = Array.isArray(next) ? next : [];
    if (val !== undefined) current = val;
    build();
  }

  setChoices(choices, value);

  return {
    el: root,
    trigger,
    get value() { return current; },
    get isOpen() { return open; },
    setValue(v) { current = v; paint(); },
    setChoices,
    open: openList,
    close,
    destroy() { doc.removeEventListener('pointerdown', outside, true); root.remove(); },
  };
}
