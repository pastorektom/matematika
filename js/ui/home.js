// Domovská obrazovka: karty témat v pořadí z Moodlu, pokrok a doporučení.
// stats: pole { topic, tried, correctRate } přihlášeného uživatele; guest = režim bez přihlášení.
import { h } from '../render.js';
import { routeHref } from '../router.js';
import { recommendNext } from '../progress.js';

const DESCRIPTIONS = {
  vektory: 'Skalární součin, velikost vektoru, úhel a lineární závislost.',
  matice: 'Násobení matic, hodnost a inverzní matice.',
  determinant: 'Sarrus, rozvoj, adjungovaná matice a Cramerovo pravidlo.',
  soustavy: 'Gaussova eliminace a Frobeniova věta o řešitelnosti.',
  funkce: 'Definiční obor, parita, inverzní a složená funkce.',
  limita: 'Limity, nekonečno a neurčité výrazy.',
  derivace: "Derivace, l'Hospitalovo pravidlo a průběh funkce.",
};

export function typesLabel(n) {
  return `${n} ${n === 1 ? 'typ' : n >= 2 && n <= 4 ? 'typy' : 'typů'} příkladů`;
}

function progressEl(doc, stat, guest) {
  if (guest) return null;
  if (!stat || !stat.tried) return h(doc, 'p', { class: 'topic-progress', 'data-state': 'none', text: 'Zatím nezkoušeno' });
  const pct = Math.round(stat.correctRate * 100);
  return h(doc, 'div', { class: 'topic-progress', 'data-state': 'tried' }, [
    h(doc, 'p', { class: 'progress-text', text: `Vyzkoušeno ${stat.tried}×, správně ${pct} %` }),
    h(doc, 'div', { class: 'meter', role: 'img', 'aria-label': `Úspěšnost ${pct} %` },
      h(doc, 'span', { class: 'meter-fill', style: `width:${pct}%` })),
  ]);
}

export function renderHome(el, { topics, stats = null, guest = false }) {
  const doc = el.ownerDocument;
  el.textContent = '';
  el.appendChild(h(doc, 'div', { class: 'home-hero' }, [
    h(doc, 'h1', { class: 'page-title', text: 'Matematika E1' }),
    h(doc, 'p', { class: 'lede', text: 'Výklad, procvičování a řešené postupy k předmětu 1MAT1 na FaME UTB. Vyberte téma.' }),
  ]));
  if (topics.length === 0) {
    el.appendChild(h(doc, 'p', { class: 'empty', text: 'Témata se připravují. Jakmile budou hotová, objeví se tady i v nabídce.' }));
    return el;
  }
  if (guest) el.appendChild(h(doc, 'p', { class: 'guest-note', text: 'Bez přihlášení se pokrok neukládá a doporučení se nezobrazuje.' }));
  const list = !guest && Array.isArray(stats) ? stats : [];
  const recId = list.some((s) => s.tried > 0) ? recommendNext(list, topics.map((t) => t.id)) : null;
  const rec = recId ? topics.find((t) => t.id === recId) : null;
  if (rec) {
    el.appendChild(h(doc, 'aside', { class: 'recommend', 'aria-label': 'Doporučení' }, [
      h(doc, 'span', { class: 'recommend-label', text: 'Doporučujeme procvičit' }),
      h(doc, 'a', { href: routeHref(rec.id, 'procvicovani'), text: rec.title }),
    ]));
  }
  el.appendChild(h(doc, 'ol', { class: 'topic-cards' }, topics.map((t, i) => {
    const stat = list.find((s) => s.topic === t.id);
    const types = Array.isArray(t.types) ? t.types.length : 0;
    return h(doc, 'li', { class: 'topic-card', 'data-recommended': rec && rec.id === t.id ? 'true' : null }, [
      h(doc, 'a', { href: routeHref(t.id), class: 'topic-card-link' }, [
        h(doc, 'span', { class: 'topic-num', text: String(i + 1) }),
        h(doc, 'span', { class: 'topic-card-body' }, [
          h(doc, 'span', { class: 'topic-name', text: t.title }),
          h(doc, 'span', { class: 'topic-desc', text: DESCRIPTIONS[t.id] || '' }),
          h(doc, 'span', { class: 'topic-meta', text: typesLabel(types) }),
        ]),
      ]),
      progressEl(doc, stat, guest),
    ]);
  })));
  el.appendChild(h(doc, 'p', { class: 'home-formulas' }, [
    h(doc, 'a', { class: 'btn btn-quiet', href: '#/vzorce', text: 'Přehled vzorců' }),
    ' ',
    h(doc, 'a', { class: 'btn btn-quiet', href: '#/vlastni', text: 'Vlastní příklad' }),
  ]));
  return el;
}
