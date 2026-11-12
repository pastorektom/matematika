// Kreslicí tabule: čistý zásobník tahů (bez DOM, testovatelný) + tenká vrstva nad <canvas>.
// Kresba žije jen v paměti stránky, nikam se neposílá.
import { h } from '../render.js';
import { recognizeShape, snapLineAngle, createHoldDetector } from './shapes.js';

const SHAPES_KEY = 'matika.wb.shapes';
const SHAPES_TIP = 'Přidrž konec tahu – narovná čáru nebo vytvoří kruh, ovál, čtverec, obdélník, trojúhelník';

// Zásobník tahů. Historie akcí: přidání tahu nebo „smazat vše“; undo vrací akce zpět.
export function createStrokeStore() {
  const actions = []; // { type:'stroke', stroke } | { type:'clear', strokes }
  let strokes = [];
  return {
    get strokes() { return strokes; },
    get canUndo() { return actions.length > 0; },
    addStroke(s) { strokes = [...strokes, s]; actions.push({ type: 'stroke', stroke: s }); },
    clear() {
      if (strokes.length === 0) return;
      actions.push({ type: 'clear', strokes });
      strokes = [];
    },
    undo() {
      const a = actions.pop();
      if (!a) return false;
      strokes = a.type === 'stroke' ? strokes.slice(0, -1) : a.strokes;
      return true;
    },
  };
}

// Rozhodne, zda nový stisk smí začít tah. Zbylý „aktivní“ tah (zmeškané pointerup/cancel)
// se zahodí: myš bez stisknutého tlačítka, nebo týž ukazatel, který stiskl znovu.
export function canStartStroke(active, e) {
  if (!active) return { start: true, stale: false };
  const stale = e.pointerId === active.id || (e.pointerType === 'mouse' && e.buttons === 0);
  return { start: stale, stale };
}

// Barvy křídy jsou vždy světlé na tmavé tabuli (--board), shodně s panelem řešení.
export const INKS = [
  { id: 'ink', label: 'Bílá', css: '#eef2f0' },
  { id: 'yellow', label: 'Žlutá', css: '#f2d16b' },
  { id: 'blue', label: 'Modrá', css: '#7fc4f0' },
];
const PEN_W = 2.6;
const ERASER_W = 22;

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  pen: 'M15.2 4.8l4 4L9 19H5v-4zM13 7l4 4',
  eraser: 'M9 20h10M5.6 14.4l7.8-7.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 20H8.4l-2.8-2.8a2 2 0 0 1 0-2.8z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  fullExit: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  shapes: 'M17 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3.5 12.5h8v8h-8zM14 20.5h6.5',
  screen: 'M2.5 6h12v9h-12zM6.5 19h4M8.5 15v4M17 9h4.5v11H17z',
};

function icon(doc, name) {
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'wb-icon');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.appendChild(path);
  return svg;
}

// Kreslicí tabule. Volby: onChange({strokes, canUndo}); onPopout() přidá tlačítko „Na druhý displej“.
export function mountWhiteboard(el, { onChange, onPopout, clock: injected } = {}) {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const store = createStrokeStore();
  let tool = 'pen';
  let color = 'ink';
  let grid = false;
  let active = null; // { id, stroke }
  let ctx = null;
  let cssW = 0;
  let cssH = 0;
  let rect = null; // ohraničení plátna uložené při pointerdown
  let penDown = false; // právě je přiloženo pero (dlaň/dotyk se pak ignoruje)
  let lastPen = -1e9;
  let full = false;
  let native = false;
  let shapesOn = true;
  try { if (win.localStorage?.getItem(SHAPES_KEY) === '0') shapesOn = false; } catch { /* úložiště nemusí být dostupné */ }
  const clock = injected || {
    now: () => win.performance?.now?.() ?? Date.now(),
    setTimeout: (f, ms) => win.setTimeout(f, ms),
    clearTimeout: (id) => win.clearTimeout(id),
  };
  const hold = createHoldDetector();
  let holdTimer = null;
  let flashTimer = null;

  const canvas = h(doc, 'canvas', { class: 'wb-canvas', role: 'img', 'aria-label': 'Kreslicí plocha. Piš prstem, myší nebo perem.' });
  canvas.style.touchAction = 'none';
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  const stage = h(doc, 'div', { class: 'wb-stage' }, canvas);

  // Tlačítko: ikona + popisek (popisek se na úzkém displeji schová, aria-label zůstává).
  const mk = (role, ico, text, label, onclick) =>
    h(doc, 'button', { type: 'button', class: 'wb-btn', 'data-role': role, 'aria-label': label, title: label, onclick },
      [ico ? icon(doc, ico) : null, text ? h(doc, 'span', { class: 'wb-label', text }) : null]);
  const penBtn = mk('wb-pen', 'pen', 'Pero', 'Pero', () => setTool('pen'));
  const eraserBtn = mk('wb-eraser', 'eraser', 'Guma', 'Guma', () => setTool('eraser'));
  const colorBtns = INKS.map((c) => {
    const b = mk(`wb-color-${c.id}`, null, '', `Barva: ${c.label}`, () => { color = c.id; setTool('pen'); });
    b.classList.add('wb-color');
    b.style.setProperty('--ink-dot', c.css);
    return b;
  });
  const shapesBtn = mk('wb-shapes', 'shapes', 'Tvary', 'Tvary: automatické narovnání tahu', () => {
    shapesOn = !shapesOn;
    try { win.localStorage?.setItem(SHAPES_KEY, shapesOn ? '1' : '0'); } catch { /* ignorováno */ }
    if (!shapesOn) cancelHold();
    sync();
  });
  shapesBtn.title = SHAPES_TIP;
  const undoBtn = mk('wb-undo', 'undo', 'Zpět', 'Krok zpět', () => api.undo());
  const clearBtn = mk('wb-clear', 'trash', 'Smazat vše', 'Smazat vše', () => api.clear());
  const gridBtn = mk('wb-grid', 'grid', 'Mřížka', 'Zobrazit nebo skrýt mřížku', () => { grid = !grid; sync(); });
  const fullBtn = mk('wb-full', 'full', 'Celá obrazovka', 'Celá obrazovka', () => api.toggleFullscreen());
  const popBtn = typeof onPopout === 'function'
    ? mk('wb-popout', 'screen', 'Na druhý displej', 'Na druhý displej', () => onPopout())
    : null;
  const group = (name, kids) => h(doc, 'div', { class: 'wb-group', role: 'group', 'aria-label': name }, kids.filter(Boolean));
  const bar = h(doc, 'div', { class: 'wb-bar', role: 'toolbar', 'aria-label': 'Nástroje tabule' }, [
    group('Nástroje', [penBtn, eraserBtn, shapesBtn]),
    group('Barvy', colorBtns),
    group('Úpravy', [undoBtn, clearBtn]),
    group('Mřížka', [gridBtn]),
    group('Zobrazení', [fullBtn, popBtn]),
  ]);
  const root = h(doc, 'div', { class: 'wb' }, [bar, stage]);
  el.appendChild(root);

  function setTool(t) { tool = t; sync(); }

  function sync() {
    penBtn.setAttribute('aria-pressed', String(tool === 'pen'));
    eraserBtn.setAttribute('aria-pressed', String(tool === 'eraser'));
    colorBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(tool === 'pen' && INKS[i].id === color)));
    shapesBtn.setAttribute('aria-pressed', String(shapesOn));
    gridBtn.setAttribute('aria-pressed', String(grid));
    fullBtn.setAttribute('aria-pressed', String(full));
    stage.classList.toggle('wb-grid', grid);
    undoBtn.disabled = !store.canUndo;
    clearBtn.disabled = store.strokes.length === 0;
  }

  function changed() {
    sync();
    redraw();
    if (typeof onChange === 'function') onChange({ strokes: store.strokes.length, canUndo: store.canUndo });
  }

  const inkCss = (id) => (INKS.find((c) => c.id === id) || INKS[0]).css;
  const widthOf = (s, p) => (s.tool === 'eraser' ? ERASER_W : PEN_W * (s.pressure && p > 0 ? 0.5 + p : 1.2));

  // Vykreslí body tahu od indexu from (při pohybu jen nový úsek, jinak celý tah).
  function drawStroke(c, s, from = 0) {
    c.save();
    c.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    c.strokeStyle = c.fillStyle = s.tool === 'eraser' ? '#000' : inkCss(s.color);
    c.lineCap = c.lineJoin = 'round';
    const pts = s.points;
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0][0], pts[0][1], widthOf(s, pts[0][2]) / 2, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = Math.max(1, from); i < pts.length; i++) {
      c.lineWidth = widthOf(s, pts[i][2]);
      c.beginPath();
      c.moveTo(pts[i - 1][0], pts[i - 1][1]);
      c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
    }
    c.restore();
  }

  function redraw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cssW, cssH);
    for (const s of store.strokes) drawStroke(ctx, s);
    if (active) drawStroke(ctx, active.stroke);
  }

  // Po změně velikosti se plátno přepočítá (devicePixelRatio) a tahy se překreslí ze zásobníku.
  function resize() {
    rect = null; // rozpracovaný tah si při dalším pohybu změří plátno znovu
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = win.devicePixelRatio || 1;
    cssW = r.width; cssH = r.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function pt(e) {
    const r = rect || (rect = canvas.getBoundingClientRect());
    return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5];
  }

  function cancelHold() {
    if (holdTimer != null) { clock.clearTimeout(holdTimer); holdTimer = null; }
  }
  function armHold() {
    cancelHold();
    holdTimer = clock.setTimeout(onHold, hold.remaining(clock.now()));
  }
  function onHold() {
    holdTimer = null;
    if (!active || active.snap || !shapesOn || active.stroke.tool !== 'pen') return;
    if (!hold.isHeld(clock.now())) { armHold(); return; }
    trySnap();
  }
  // Po podržení zkusí z tahu udělat dokonalý tvar; když se nic nepozná, tah zůstane od ruky a čeká se dál.
  function trySnap() {
    const st = active.stroke;
    const shape = recognizeShape(st.points.map((p) => ({ x: p[0], y: p[1] })));
    if (!shape) return;
    const pr = st.points.reduce((a, p) => a + p[2], 0) / st.points.length;
    st.points = shape.points.map((p) => [p.x, p.y, pr]);
    active.snap = { kind: shape.kind, start: shape.kind === 'line' ? shape.start : null, pr };
    try { win.navigator?.vibrate?.(8); } catch { /* ignorováno */ }
    root.classList.add('wb-snap');
    if (flashTimer != null) clock.clearTimeout(flashTimer);
    flashTimer = clock.setTimeout(() => { flashTimer = null; root.classList.remove('wb-snap'); }, 150);
    redraw();
  }
  // Přímka po přichycení: začátek zůstává, konec následuje ukazatel (s přichycením k 0/45/90°).
  function rubberBand(x, y) {
    const { start, pr } = active.snap;
    const e2 = snapLineAngle(start, { x, y }, 5);
    active.stroke.points = [[start.x, start.y, pr], [e2.x, e2.y, pr]];
    redraw();
  }

  const end = (e) => {
    if (!active || (e.pointerId != null && e.pointerId !== active.id)) return;
    cancelHold();
    if (active.snap?.kind === 'line' && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) { const q = pt(e); rubberBand(q[0], q[1]); }
    const st = active.stroke;
    if (penDown) { penDown = false; lastPen = win.performance?.now?.() ?? Date.now(); }
    active = null;
    rect = null;
    store.addStroke(st);
    changed();
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button > 0) return;
    const t = win.performance?.now?.() ?? Date.now();
    if (e.pointerType === 'touch' && (penDown || t - lastPen < 450)) return; // dlaň při psaní perem
    if (e.pointerType === 'pen') { penDown = true; lastPen = t; }
    const { start, stale } = canStartStroke(active, e);
    if (!start) return; // dlaň nebo druhý prst se ignoruje
    if (stale) end({ pointerId: active.id });
    e.preventDefault?.();
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* ignorováno */ }
    rect = canvas.getBoundingClientRect();
    active = { id: e.pointerId, stroke: { tool, color, pressure: e.pointerType === 'pen', points: [pt(e)] } };
    if (ctx) drawStroke(ctx, active.stroke);
    if (shapesOn && tool === 'pen') { hold.start(active.stroke.points[0][0], active.stroke.points[0][1], clock.now()); armHold(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault?.();
    if (active.snap) {
      if (active.snap.kind === 'line') { const q = pt(e); rubberBand(q[0], q[1]); }
      return; // uzavřený tvar je pevný
    }
    const from = active.stroke.points.length;
    const evs = e.getCoalescedEvents?.();
    for (const ev of (evs && evs.length ? evs : [e])) active.stroke.points.push(pt(ev));
    if (ctx) drawStroke(ctx, active.stroke, from);
    if (shapesOn && active.stroke.tool === 'pen') {
      const last = active.stroke.points.at(-1);
      if (hold.move(last[0], last[1], clock.now())) armHold();
    }
  });
  canvas.addEventListener('pointerup', end);
  // Prohlížeč tah zrušil (dlaň, posun stránky): rozdělaný tah se zahodí, nezapisuje se.
  canvas.addEventListener('pointercancel', (e) => {
    if (!active || (e.pointerId != null && e.pointerId !== active.id)) return;
    cancelHold();
    if (penDown) { penDown = false; lastPen = win.performance?.now?.() ?? Date.now(); }
    active = null;
    rect = null;
    redraw();
  });
  canvas.addEventListener('lostpointercapture', end);

  let ro = null;
  if (typeof win.ResizeObserver === 'function') { ro = new win.ResizeObserver(resize); ro.observe(canvas); }
  win.addEventListener?.('resize', resize);
  const onFsChange = () => { if (full && native && doc.fullscreenElement !== root) { native = false; api.setFullscreen(false); } };
  const onKey = (e) => { if (e.key === 'Escape' && full && !native) api.setFullscreen(false); };
  doc.addEventListener('fullscreenchange', onFsChange);
  doc.addEventListener('keydown', onKey);
  sync();
  resize();

  const api = {
    get strokeCount() { return store.strokes.length; },
    get strokes() { return store.strokes; },
    get shapesEnabled() { return shapesOn; },
    exportPng() {
      try {
        const out = doc.createElement('canvas');
        out.width = canvas.width; out.height = canvas.height;
        const c = out.getContext('2d');
        if (!c) return '';
        c.fillStyle = win.getComputedStyle(root).getPropertyValue('--board').trim() || '#263238';
        c.fillRect(0, 0, out.width, out.height);
        c.drawImage(canvas, 0, 0);
        return out.toDataURL('image/png');
      } catch { return ''; }
    },
    get root() { return root; },
    get isFullscreen() { return full; },
    async setFullscreen(v) {
      v = !!v;
      if (v === full) return;
      full = v;
      root.classList.toggle('wb-full', v);
      const fi = fullBtn.querySelector('.wb-label');
      if (fi) fi.textContent = v ? 'Zavřít celou obrazovku' : 'Celá obrazovka';
      fullBtn.replaceChild(icon(doc, v ? 'fullExit' : 'full'), fullBtn.querySelector('svg'));
      sync();
      if (v) {
        try { if (root.requestFullscreen) { await root.requestFullscreen(); native = true; } } catch { native = false; }
      } else if (native) {
        native = false;
        try { if (doc.fullscreenElement) await doc.exitFullscreen(); } catch { /* ignorováno */ }
      }
      resize();
    },
    toggleFullscreen() { return api.setFullscreen(!full); },
    clear() { store.clear(); changed(); },
    undo() { if (store.undo()) changed(); },
    destroy() {
      cancelHold();
      if (flashTimer != null) clock.clearTimeout(flashTimer);
      ro?.disconnect();
      win.removeEventListener?.('resize', resize);
      doc.removeEventListener('fullscreenchange', onFsChange);
      doc.removeEventListener('keydown', onKey);
      if (native && doc.fullscreenElement) { try { doc.exitFullscreen(); } catch { /* ignorováno */ } }
      root.remove();
    },
  };
  return api;
}
