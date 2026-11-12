// Rozvržení stránky: zajížděcí levé menu (od 1100 px) a „Focus režim“ (bez menu a záhlaví).
// Volby se pamatují v localStorage (každé čtení i zápis v try/catch – v soukromém okně může selhat).
// Stav se zrcadlí do atributů: .shell[data-nav="open|closed"] a body[data-focus="true"].
export const NAV_KEY = 'matika.nav';
export const FOCUS_KEY = 'matika.focus';
export const NAV_BREAKPOINT = 1280; // od této šířky je menu ve výchozím stavu otevřené

const isTyping = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function createShell(doc, { storage } = {}) {
  const win = doc.defaultView;
  const shell = doc.querySelector('.shell');
  const body = doc.body;
  const nav = doc.getElementById('nav-collapse');
  const rail = doc.getElementById('nav-rail');
  const focusExit = doc.getElementById('focus-exit');
  let store = storage;
  if (store === undefined) { try { store = win.localStorage; } catch { store = null; } }
  const get = (k) => { try { return store?.getItem(k) ?? null; } catch { return null; } };
  const put = (k, v) => { try { store?.setItem(k, v); } catch { /* ignorováno */ } };

  const wide = () => { try { return !!win.matchMedia?.(`(min-width: ${NAV_BREAKPOINT}px)`).matches; } catch { return false; } };
  const saved = get(NAV_KEY);
  let navOpen = saved === 'open' ? true : saved === 'closed' ? false : wide();
  let focus = get(FOCUS_KEY) === '1';

  function paint() {
    shell?.setAttribute('data-nav', navOpen ? 'open' : 'closed');
    if (focus) body.setAttribute('data-focus', 'true'); else body.removeAttribute('data-focus');
    for (const b of [nav, rail]) {
      if (!b) continue;
      b.setAttribute('aria-expanded', String(navOpen));
      const label = navOpen ? 'Skrýt menu' : 'Zobrazit menu';
      b.setAttribute('title', label);
      b.setAttribute('aria-label', label);
    }
    for (const b of doc.querySelectorAll('[data-role="focus-toggle"]')) b.setAttribute('aria-pressed', String(focus));
    if (focusExit) focusExit.hidden = !focus;
  }

  const api = {
    get navOpen() { return navOpen; },
    get focus() { return focus; },
    setNav(v) { navOpen = !!v; put(NAV_KEY, navOpen ? 'open' : 'closed'); paint(); },
    toggleNav() { api.setNav(!navOpen); },
    setFocus(v) { focus = !!v; put(FOCUS_KEY, focus ? '1' : '0'); paint(); },
    toggleFocus() { api.setFocus(!focus); },
    refresh: paint, // po vykreslení nové stránky (tlačítka Focus režimu přibyla)
    destroy() { doc.removeEventListener('keydown', onKey); },
  };

  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && focus) { api.setFocus(false); return; }
    if ((e.key === 'm' || e.key === 'M') && !isTyping(e.target)) { api.toggleNav(); e.preventDefault?.(); }
  }

  nav?.addEventListener('click', () => api.toggleNav());
  rail?.addEventListener('click', () => api.toggleNav());
  focusExit?.addEventListener('click', () => api.setFocus(false));
  doc.addEventListener('keydown', onKey);
  paint();
  return api;
}
