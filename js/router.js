// Adresy: #/  ·  #/vzorce  ·  #/okno-tabule (okno tabule na druhém displeji)  ·  #/tema/<id>/vyklad|procvicovani|postup  (bez záložky = vyklad)
export const TABS = [
  { id: 'vyklad', label: 'Výklad' },
  { id: 'procvicovani', label: 'Procvičování' },
  { id: 'postup', label: 'Postup' },
];
const TAB_IDS = new Set(TABS.map((t) => t.id));

// Za cestou může následovat ?seed=<číslo>&type=<id typu> (příklad z procvičování ve Postupu).
function parseQuery(qs) {
  const sp = new URLSearchParams(qs);
  const q = {};
  const seed = sp.get('seed');
  if (seed !== null && /^\d{1,10}$/.test(seed)) q.seed = Number(seed);
  if (sp.get('type')) q.type = sp.get('type');
  return q;
}

export function parseRoute(hash) {
  const [rawPath, qs] = String(hash ?? '').split('?', 2);
  const path = rawPath.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (path === '') return { name: 'home' };
  if (path === 'vzorce') return { name: 'formulas' };
  if (path === 'okno-tabule') return { name: 'popout' };
  const parts = path.split('/');
  if (parts[0] === 'tema' && parts[1] && parts.length <= 3) {
    let id;
    try { id = decodeURIComponent(parts[1]); } catch { return { name: 'notfound' }; }
    const tab = parts[2] || 'vyklad';
    if (!TAB_IDS.has(tab)) return { name: 'notfound' };
    const query = qs ? parseQuery(qs) : null;
    return query && Object.keys(query).length ? { name: 'topic', id, tab, query } : { name: 'topic', id, tab };
  }
  return { name: 'notfound' };
}

export function routeHref(id, tab = 'vyklad', query) {
  if (id == null) return '#/';
  const base = `#/tema/${encodeURIComponent(id)}/${tab}`;
  const sp = new URLSearchParams();
  if (query?.seed != null) sp.set('seed', String(query.seed));
  if (query?.type) sp.set('type', query.type);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
