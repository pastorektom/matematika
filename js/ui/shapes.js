// Rozpoznání tvaru z ručního tahu (čára, kruh, elipsa, obdélník, trojúhelník). Čistá geometrie bez DOM,
// aby šla celá otestovat. Tvar se vrací jako hustá lomená čára {x,y}, takže zásobník tahů, překreslení,
// export i zrcadlení do druhého okna nepotřebují žádný nový primitiv.

export const HOLD_MS = 550; // jak dlouho musí ukazatel stát, aby se tah narovnal
export const REST_PX = 4; // pohyb menší než tohle se počítá jako klid (třes ruky)

const DEFAULTS = {
  minSize: 30, // menší tah (úhlopříčka ohraničení) se nikdy nepřichytává
  lineTol: 0.06, // největší odchylka od tětivy jako podíl její délky
  closeRatio: 0.25, // mezera mezi začátkem a koncem jako podíl úhlopříčky, pod ní je tah „uzavřený“
  ellipseRes: 0.08, // střední radiální reziduum elipsy
  polyRes: 0.05, // střední vzdálenost od hran mnohoúhelníku (podíl středního poloměru)
  circleRatio: 0.88, // poměr os od něhož je elipsa kruh
  rightTol: 15, // tolerance pravého úhlu (stupně)
  axisSnap: 7, // přichycení obdélníku k osám (stupně)
  squareRatio: 0.9, // poměr stran od něhož je obdélník čtverec
  rightSnap: 7, // trojúhelník: úhel do ±7° od 90° se srovná na pravý
  maxTrace: 1.5, // nejvýše tolikrát delší tah než obvod tvaru (jinak je to škrabanice)
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

function pathLength(pts, closed = false) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return closed && pts.length > 1 ? s + dist(pts.at(-1), pts[0]) : s;
}

// Přichytí úsečku p0→p1 k násobkům 45° (vodorovně, svisle, úhlopříčně), je-li blíž než tolDeg. Délka se zachová.
export function snapLineAngle(p0, p1, tolDeg = 5) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: p1.x, y: p1.y };
  const ang = deg(Math.atan2(dy, dx));
  const nearest = Math.round(ang / 45) * 45;
  if (Math.abs(ang - nearest) > tolDeg) return { x: p1.x, y: p1.y };
  const r = rad(nearest);
  const x = Math.abs(Math.cos(r)) < 1e-12 ? 0 : Math.cos(r);
  const y = Math.abs(Math.sin(r)) < 1e-12 ? 0 : Math.sin(r);
  return { x: p0.x + x * len, y: p0.y + y * len };
}

// Detektor „držení“: ukazatel musí zůstat v okruhu restPx po dobu holdMs. Čas se dodává zvenčí (testovatelné).
export function createHoldDetector({ holdMs = HOLD_MS, restPx = REST_PX } = {}) {
  let ax = 0;
  let ay = 0;
  let at = 0;
  return {
    start(x, y, t) { ax = x; ay = y; at = t; },
    // true, když se ukazatel pohnul nad práh (časovač se vynuloval)
    move(x, y, t) {
      if (Math.hypot(x - ax, y - ay) >= restPx) { ax = x; ay = y; at = t; return true; }
      return false;
    },
    isHeld(t) { return t - at >= holdMs; },
    remaining(t) { return Math.max(0, holdMs - (t - at)); },
  };
}

function clean(input) {
  const out = [];
  for (const p of input || []) {
    const q = Array.isArray(p) ? { x: p[0], y: p[1] } : p;
    if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
    const l = out.at(-1);
    if (!l || Math.hypot(q.x - l.x, q.y - l.y) >= 0.5) out.push({ x: q.x, y: q.y });
  }
  return out;
}

// Klouzavý průměr (okno 5): potlačí třes, konce zůstanou na místě.
function smooth(pts) {
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const lo = Math.max(0, i - 2);
    const hi = Math.min(pts.length - 1, i + 2);
    let x = 0;
    let y = 0;
    for (let k = lo; k <= hi; k++) { x += pts[k].x; y += pts[k].y; }
    const n = hi - lo + 1;
    return { x: x / n, y: y / n };
  });
}

// n bodů rovnoměrně po délce uzavřené smyčky (poslední bod se nezdvojuje).
function resampleClosed(pts, n) {
  const loop = [...pts, pts[0]];
  const cum = [0];
  for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + dist(loop[i - 1], loop[i]));
  const total = cum.at(-1);
  const out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (j < loop.length - 1 && cum[j] < s) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const t = (s - cum[j - 1]) / seg;
    out.push({ x: loop[j - 1].x + (loop[j].x - loop[j - 1].x) * t, y: loop[j - 1].y + (loop[j].y - loop[j - 1].y) * t });
  }
  return out;
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function distToLine(p, a, b) {
  const l = dist(a, b);
  return l ? Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / l : dist(p, a);
}

// Douglas–Peucker na úseku [i0, i1] otevřené lomené čáry; vrací indexy vrcholů včetně krajních.
function dp(pts, i0, i1, eps) {
  let best = -1;
  let bd = 0;
  for (let i = i0 + 1; i < i1; i++) {
    const d = distToSegment(pts[i], pts[i0], pts[i1]);
    if (d > bd) { bd = d; best = i; }
  }
  if (best < 0 || bd <= eps) return [i0, i1];
  const l = dp(pts, i0, best, eps);
  const r = dp(pts, best, i1, eps);
  return [...l.slice(0, -1), ...r];
}

// Vrcholy uzavřené smyčky: DP od bodu 0 a nejvzdálenějšího bodu, pak se vyhodí téměř přímé „vrcholy“.
function closedCorners(pts, eps) {
  let far = 1;
  for (let i = 2; i < pts.length; i++) if (dist(pts[i], pts[0]) > dist(pts[far], pts[0])) far = i;
  const a = dp(pts, 0, far, eps);
  const b = dp([...pts, pts[0]], far, pts.length, eps);
  const idx = [...a.slice(0, -1), ...b.slice(0, -1)];
  let v = idx.map((i) => pts[i]);
  const turn = (i) => {
    const p = v[(i + v.length - 1) % v.length];
    const c = v[i];
    const n = v[(i + 1) % v.length];
    const a1 = Math.atan2(c.y - p.y, c.x - p.x);
    const a2 = Math.atan2(n.y - c.y, n.x - c.x);
    return Math.abs(deg(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))));
  };
  while (v.length > 3) {
    let mi = 0;
    let mt = Infinity;
    for (let i = 0; i < v.length; i++) { const t = turn(i); if (t < mt) { mt = t; mi = i; } }
    if (mt >= 28) break; // všechny zbylé vrcholy jsou opravdové rohy
    v = v.filter((_, i) => i !== mi);
  }
  return v;
}

function interiorAngle(p, c, n) {
  const a1 = Math.atan2(p.y - c.y, p.x - c.x);
  const a2 = Math.atan2(n.y - c.y, n.x - c.x);
  return Math.abs(deg(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))));
}

function polyResidual(R, corners, meanR) {
  let s = 0;
  for (const p of R) {
    let d = Infinity;
    for (let i = 0; i < corners.length; i++) d = Math.min(d, distToSegment(p, corners[i], corners[(i + 1) % corners.length]));
    s += d;
  }
  return s / R.length / meanR;
}

// Obecná kuželosečka (5 parametrů, nejmenší čtverce) → střed, poloosy a natočení; null, není-li to elipsa.
function fitConic(R, c0) {
  const M = Array.from({ length: 5 }, () => new Array(6).fill(0)); // normálové rovnice + pravá strana
  const sc = Math.max(...R.map((p) => Math.hypot(p.x - c0.x, p.y - c0.y))) || 1;
  for (const p of R) {
    const x = (p.x - c0.x) / sc;
    const y = (p.y - c0.y) / sc;
    const f = [x * x, x * y, y * y, x, y];
    for (let i = 0; i < 5; i++) { for (let j = 0; j < 5; j++) M[i][j] += f[i] * f[j]; M[i][5] += f[i]; }
  }
  for (let i = 0; i < 5; i++) { // Gaussova eliminace s výběrem pivotu
    let piv = i;
    for (let r = i + 1; r < 5; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    if (Math.abs(M[piv][i]) < 1e-12) return null;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let r = 0; r < 5; r++) {
      if (r === i) continue;
      const k = M[r][i] / M[i][i];
      for (let j = i; j < 6; j++) M[r][j] -= k * M[i][j];
    }
  }
  const [A, B, C, D, E] = M.map((row, i) => row[5] / row[i]);
  const det = 4 * A * C - B * B;
  if (!(det > 1e-12)) return null;
  const cx = (B * E - 2 * C * D) / det;
  const cy = (B * D - 2 * A * E) / det;
  const k = 1 + A * cx * cx + B * cx * cy + C * cy * cy + D * cx + E * cy; // (p−c)ᵀQ(p−c) = k
  if (!(k > 0)) return null;
  const tr = (A + C) / k;
  const dd = Math.sqrt(((A - C) / k) ** 2 + (B / k) ** 2);
  const l1 = (tr - dd) / 2; // menší vlastní číslo = delší osa
  const l2 = (tr + dd) / 2;
  if (!(l1 > 0)) return null;
  const th = 0.5 * Math.atan2(-B / k, -(A - C) / k); // směr vlastního vektoru menšího čísla
  return { rx: sc / Math.sqrt(l1), ry: sc / Math.sqrt(l2), th, cx: c0.x + cx * sc, cy: c0.y + cy * sc };
}

function fitEllipse(R, c) {
  const g = fitConic(R, c);
  if (g && Number.isFinite(g.rx + g.ry + g.th + g.cx + g.cy)) return g;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of R) { const x = p.x - c.x; const y = p.y - c.y; sxx += x * x; syy += y * y; sxy += x * y; }
  let th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // hlavní osa
  const ct = Math.cos(th);
  const st = Math.sin(th);
  // algebraická metoda nejmenších čtverců u·x'² + v·y'² = 1
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;
  for (const p of R) {
    const x = p.x - c.x;
    const y = p.y - c.y;
    const X = (x * ct + y * st) ** 2;
    const Y = (-x * st + y * ct) ** 2;
    a11 += X * X; a12 += X * Y; a22 += Y * Y; b1 += X; b2 += Y;
  }
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-12) return null;
  const u = (b1 * a22 - b2 * a12) / det;
  const v = (a11 * b2 - a12 * b1) / det;
  if (!(u > 0 && v > 0)) return null;
  let rx = 1 / Math.sqrt(u);
  let ry = 1 / Math.sqrt(v);
  if (ry > rx) { [rx, ry] = [ry, rx]; th += Math.PI / 2; }
  return { rx, ry, th, cx: c.x, cy: c.y };
}

function ellipseResidual(R, e) {
  const c = { x: e.cx, y: e.cy };
  const ct = Math.cos(e.th);
  const st = Math.sin(e.th);
  let s = 0;
  let mr = 0;
  for (const p of R) {
    const x = p.x - c.x;
    const y = p.y - c.y;
    const X = x * ct + y * st;
    const Y = -x * st + y * ct;
    const r = Math.hypot(X, Y);
    const re = 1 / Math.sqrt((X / (r || 1)) ** 2 / (e.rx * e.rx) + (Y / (r || 1)) ** 2 / (e.ry * e.ry));
    s += Math.abs(r - re);
    mr += r;
  }
  return s / mr; // podíl středního poloměru
}

const perimeterEllipse = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

function ellipsePolyline(c, rx, ry, th, n = 96) {
  const out = [];
  const ct = Math.cos(th);
  const st = Math.sin(th);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    out.push({ x: c.x + x * ct - y * st, y: c.y + x * st + y * ct });
  }
  out.push({ ...out[0] });
  return out;
}

// Je-li některý úhel trojúhelníku do tol stupňů od 90°, natočí se kratší rameno tak, aby byl přesně pravý.
function snapRightTriangle(v, tol) {
  for (let i = 0; i < 3; i++) {
    const p = v[(i + 2) % 3];
    const c = v[i];
    const n = v[(i + 1) % 3];
    if (Math.abs(interiorAngle(p, c, n) - 90) > tol) continue;
    const shortP = dist(c, p) <= dist(c, n);
    const [fix, mov] = shortP ? [n, p] : [p, n];
    const base = Math.atan2(fix.y - c.y, fix.x - c.x);
    const cur = Math.atan2(mov.y - c.y, mov.x - c.x);
    const side = Math.sin(cur - base) >= 0 ? 1 : -1;
    const len = dist(c, mov);
    const m = { x: c.x + len * Math.cos(base + side * Math.PI / 2), y: c.y + len * Math.sin(base + side * Math.PI / 2) };
    const out = v.map((q) => q);
    out[v.indexOf(mov)] = m;
    return out;
  }
  return v;
}

function buildRectangle(v, o) {
  // směr: kruhový průměr směrů hran modulo 90°
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 4; i++) {
    const a = v[i];
    const b = v[(i + 1) % 4];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    sx += Math.cos(4 * ang);
    sy += Math.sin(4 * ang);
  }
  let th = Math.atan2(sy, sx) / 4; // (−45°, 45°]
  if (Math.abs(deg(th)) < o.axisSnap) th = 0;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const proj = v.map((p) => ({ u: p.x * ct + p.y * st, w: -p.x * st + p.y * ct }));
  const u0 = Math.min(...proj.map((p) => p.u));
  const u1 = Math.max(...proj.map((p) => p.u));
  const w0 = Math.min(...proj.map((p) => p.w));
  const w1 = Math.max(...proj.map((p) => p.w));
  const at = (u, w) => ({ x: u * ct - w * st, y: u * st + w * ct });
  const corners = [at(u0, w0), at(u1, w0), at(u1, w1), at(u0, w1)];
  const center = at((u0 + u1) / 2, (w0 + w1) / 2);
  return { corners, th, center, width: u1 - u0, height: w1 - w0 };
}

// Rozpozná tvar z tahu (pole {x,y} nebo [x,y,…]). Vrací {kind, points, …parametry} nebo null.
export function recognizeShape(input, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const raw = clean(input);
  if (raw.length < 3) return null;
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (diag < o.minSize) return null;
  const pts = smooth(raw);
  const first = pts[0];
  const last = pts.at(-1);
  const gap = dist(first, last);

  // ---- otevřený tah: jen přímka ----
  if (gap >= o.closeRatio * diag) {
    if (gap < o.minSize) return null;
    let dev = 0;
    for (const p of pts) dev = Math.max(dev, distToLine(p, first, last));
    if (dev >= o.lineTol * gap) return null;
    const end = snapLineAngle(first, last, 5);
    return { kind: 'line', points: [{ x: first.x, y: first.y }, end], start: { x: first.x, y: first.y }, end };
  }

  // ---- uzavřený tah: elipsa/kruh nebo mnohoúhelník ----
  const R = resampleClosed(pts, 96);
  const c = { x: R.reduce((s, p) => s + p.x, 0) / R.length, y: R.reduce((s, p) => s + p.y, 0) / R.length };
  const meanR = R.reduce((s, p) => s + dist(p, c), 0) / R.length;
  if (!(meanR > 0)) return null;
  const trace = pathLength(pts, true);
  const cands = [];

  const e = fitEllipse(R, c);
  if (e) {
    const res = ellipseResidual(R, e);
    if (res < o.ellipseRes && trace <= o.maxTrace * perimeterEllipse(e.rx, e.ry)) cands.push({ res, e });
  }

  const eps = 0.045 * diag;
  const v = closedCorners(R, eps);
  if (v.length === 4) {
    const ok = v.every((p, i) => Math.abs(interiorAngle(v[(i + 3) % 4], p, v[(i + 1) % 4]) - 90) <= o.rightTol);
    if (ok) {
      const r = buildRectangle(v, o);
      const res = polyResidual(R, r.corners, meanR);
      if (res < o.polyRes && trace <= o.maxTrace * 2 * (r.width + r.height)) cands.push({ res, rect: r });
    }
  } else if (v.length === 3) {
    const ok = v.every((p, i) => interiorAngle(v[(i + 2) % 3], p, v[(i + 1) % 3]) >= 20);
    if (ok) {
      const res = polyResidual(R, v, meanR);
      if (res < o.polyRes && trace <= o.maxTrace * pathLength(v, true)) cands.push({ res, tri: v });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.res - b.res);
  const best = cands[0];

  if (best.rect) {
    let r = best.rect;
    const ratio = Math.min(r.width, r.height) / Math.max(r.width, r.height);
    let kind = 'rectangle';
    if (ratio >= o.squareRatio) {
      kind = 'square';
      const side = (r.width + r.height) / 2;
      const ct = Math.cos(r.th);
      const st = Math.sin(r.th);
      const at = (u, w) => ({ x: r.center.x + u * ct - w * st, y: r.center.y + u * st + w * ct });
      const h = side / 2;
      r = { ...r, corners: [at(-h, -h), at(h, -h), at(h, h), at(-h, h)], width: side, height: side };
    }
    const pts5 = [...r.corners, r.corners[0]].map((p) => ({ ...p }));
    return { kind, points: pts5, cx: r.center.x, cy: r.center.y, width: r.width, height: r.height, angle: deg(r.th) };
  }
  if (best.tri) {
    const tri = snapRightTriangle(best.tri, o.rightSnap);
    const pts4 = [...tri, tri[0]].map((p) => ({ x: p.x, y: p.y }));
    return { kind: 'triangle', points: pts4 };
  }
  let { rx, ry, th } = best.e;
  const ec = { x: best.e.cx, y: best.e.cy };
  if (ry / rx >= o.circleRatio) {
    const r = (rx + ry) / 2;
    return { kind: 'circle', points: ellipsePolyline(ec, r, r, 0), cx: ec.x, cy: ec.y, r };
  }
  let angle = deg(th) % 180;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  if (Math.abs(angle) < 5) angle = 0;
  else if (Math.abs(Math.abs(angle) - 90) < 5) { angle = 0; [rx, ry] = [ry, rx]; }
  return { kind: 'ellipse', points: ellipsePolyline(ec, rx, ry, rad(angle)), cx: ec.x, cy: ec.y, rx, ry, angle };
}
