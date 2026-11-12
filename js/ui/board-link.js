// Tabule na druhém displeji: protokol zpráv mezi hlavním oknem a oknem #/okno-tabule.
// Spojení běží přes BroadcastChannel('matika-tabule') – žádný server, nic neopouští prohlížeč.
// Modul obsahuje čisté funkce (validace zpráv, výběr obrazovky) a malé „hub“ rozhraní pro hlavní okno.

export const CHANNEL_NAME = 'matika-tabule';
export const POPOUT_ROUTE = '#/okno-tabule';
export const POPOUT_HINT = 'Přetáhni okno na druhý displej a klikni na Celá obrazovka.';
export const TYPES = new Set(['hello', 'bye', 'problem', 'clear', 'step', 'nav', 'grade', 'close']);

const MAX_STR = 20000;
const str = (v) => (typeof v === 'string' ? v.slice(0, MAX_STR) : v == null ? '' : String(v).slice(0, MAX_STR));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Zpráva bez dat se jen označí typem; neznámý typ je chyba programátora, ne zprávy zvenčí.
export function encode(type, payload = {}) {
  if (!TYPES.has(type)) throw new Error(`Neznámý typ zprávy: ${type}`);
  return { ...payload, type, v: 1 };
}

function cleanLines(lines) {
  if (!Array.isArray(lines)) return null;
  const out = [];
  for (const l of lines) {
    if (!isObj(l) || typeof l.tex !== 'string') return null;
    const line = { tex: l.tex.slice(0, MAX_STR) };
    if (Array.isArray(l.notes)) line.notes = l.notes.filter(isObj).slice(0, 40);
    out.push(line);
  }
  return out;
}

// Vrací očištěnou zprávu, nebo null (nikdy nevyhodí výjimku).
export function validate(msg) {
  try {
    if (!isObj(msg) || typeof msg.type !== 'string' || !TYPES.has(msg.type)) return null;
    switch (msg.type) {
      case 'hello': case 'bye': case 'clear': case 'close':
        return { type: msg.type };
      case 'problem': {
        if (typeof msg.promptTex !== 'string') return null;
        return {
          type: 'problem',
          id: str(msg.id),
          promptTex: str(msg.promptTex),
          topicTitle: str(msg.topicTitle),
          typeTitle: str(msg.typeTitle),
          selfGraded: msg.selfGraded === true,
        };
      }
      case 'step': {
        const index = Number(msg.index);
        const total = Number(msg.total);
        if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) return null;
        let board = null;
        if (msg.board != null) {
          const lines = cleanLines(msg.board.lines);
          const upTo = Number(msg.board.upTo);
          if (!lines || !Number.isInteger(upTo) || upTo < 0) return null;
          board = { lines, upTo: Math.min(upTo, lines.length) };
        }
        let viz = null;
        if (msg.viz != null) {
          if (!isObj(msg.viz) || typeof msg.viz.kind !== 'string') return null;
          viz = { kind: msg.viz.kind, data: msg.viz.data };
        }
        return {
          type: 'step', index, total, title: str(msg.title), text: str(msg.text), board, viz,
          tex: typeof msg.tex === 'string' ? msg.tex.slice(0, MAX_STR) : null,
        };
      }
      case 'nav':
        return msg.dir === 'prev' || msg.dir === 'next' ? { type: 'nav', dir: msg.dir } : null;
      case 'grade':
        return typeof msg.correct === 'boolean' ? { type: 'grade', correct: msg.correct } : null;
      default:
        return null;
    }
  } catch { return null; }
}

// Krok krokovače -> zpráva `step` (řádky tabule až po aktuální krok, pomůcka, text).
export function stepMessage(steps, index, boardForStep) {
  const list = Array.isArray(steps) ? steps : [];
  const s = list[index] || {};
  const b = boardForStep ? boardForStep(list, index) : null;
  return encode('step', {
    index, total: list.length, title: s.title || '', text: s.text || '',
    board: b ? { lines: b.lines, upTo: b.upTo } : null,
    viz: s.viz || null,
    tex: s.tex || null,
  });
}

// Nepřimární obrazovka z Window Management API (screens z getScreenDetails), jinak null.
export function pickSecondScreen(screens) {
  const list = Array.from(screens || []);
  const ok = (s) => s && [s.availWidth, s.availHeight].every((v) => Number.isFinite(v) && v > 0);
  return list.find((s) => s && s.isPrimary === false && ok(s)) || null;
}

export function popupFeatures(screen) {
  if (!screen) return 'popup=yes,width=1280,height=800,left=60,top=40';
  const left = Math.round(screen.availLeft ?? screen.left ?? 0);
  const top = Math.round(screen.availTop ?? screen.top ?? 0);
  return `popup=yes,left=${left},top=${top},width=${Math.round(screen.availWidth)},height=${Math.round(screen.availHeight)}`;
}

// Otevře okno tabule; oprávnění „Správa oken“ se žádá jen tady (po kliknutí na tlačítko).
// Odmítnutí nebo nepodpora = běžné okno 1280×800 a nápověda.
export async function openPopout(win, { url } = {}) {
  let screen = null;
  try {
    if (typeof win.getScreenDetails === 'function') {
      const details = await win.getScreenDetails();
      screen = pickSecondScreen(details?.screens);
    }
  } catch { screen = null; }
  const target = url || `${win.location.href.split('#')[0]}${POPOUT_ROUTE}`;
  let w = null;
  try { w = win.open(target, 'matika-tabule', popupFeatures(screen)); } catch { w = null; }
  return { window: w || null, placed: !!(screen && w), blocked: !w };
}

// Hub v hlavním okně: drží aktuální příklad a krok, odpovídá na `hello`, přeposílá `nav` a `grade`.
export function createHub(Channel) {
  let ch = null;
  try { ch = Channel ? new Channel(CHANNEL_NAME) : null; } catch { ch = null; }
  let open = false;
  let problem = null;
  let step = null;
  const presence = new Set();
  const navFns = new Set();
  const gradeFns = new Set();

  const post = (m) => { try { ch?.postMessage(m); } catch { /* kanál zavřený */ } };
  const setOpen = (v) => { if (open !== v) { open = v; for (const f of [...presence]) f(v); } };

  if (ch) {
    ch.onmessage = (ev) => {
      const m = validate(ev?.data);
      if (!m) return;
      if (m.type === 'hello') {
        setOpen(true);
        if (problem) post(encode('problem', problem));
        if (step) post(encode('step', step));
      } else if (m.type === 'bye') setOpen(false);
      else if (m.type === 'nav') for (const f of [...navFns]) f(m.dir);
      else if (m.type === 'grade') for (const f of [...gradeFns]) f(m.correct);
    };
  }

  return {
    get supported() { return !!ch; },
    get isOpen() { return open; },
    setProblem(p) {
      problem = p ? validate(encode('problem', p)) : null;
      if (problem) { delete problem.type; post(encode('problem', problem)); if (open) post(encode('clear')); }
      step = null;
    },
    setStep(s) {
      const m = s ? validate(s) : null;
      step = m ? (({ type, ...rest }) => rest)(m) : null;
      if (m) post(encode('step', step));
    },
    clearBoard() { post(encode('clear')); },
    closePopout() { post(encode('close')); },
    release() { setOpen(false); },
    onPresence(f) { presence.add(f); return () => presence.delete(f); },
    onNav(f) { navFns.add(f); return () => navFns.delete(f); },
    onGrade(f) { gradeFns.add(f); return () => gradeFns.delete(f); },
    destroy() { try { ch?.close(); } catch { /* ignorováno */ } ch = null; presence.clear(); navFns.clear(); gradeFns.clear(); },
  };
}

// Sdílený hub okna (jeden kanál na stránku); bez BroadcastChannel vrací hub bez funkce.
const hubs = new WeakMap();
export function getHub(win) {
  if (!win) return createHub(null);
  if (!hubs.has(win)) hubs.set(win, createHub(win.BroadcastChannel));
  return hubs.get(win);
}
