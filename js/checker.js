// Kontrola odpovědí. ES modul funguje v Node (testy) i v prohlížeči.
// math.js se importuje jako 'mathjs'. V Node ho vyřeší node_modules; v prohlížeči
// bude v index.html import map, např.:
//   <script type="importmap">{"imports":{"mathjs":"https://cdn.jsdelivr.net/npm/mathjs@13.2.0/+esm"}}</script>
import { makeRng } from './rng.js';
import { SYNTAX, WRONG, UNSUPPORTED, parse, usesBlocked, normalize, parseNumber, close, fail } from './checker-core.js';
import {
  checkVector, checkMatrix, checkInterval, checkLimit, checkSystem, checkList,
} from './checker-structured.js';

const prepare = normalize;

// Úhel ve stupních (spec.unit === 'deg'): '30', '30°', '30 °' i radiány 'π/6', 'pi/6'.
function checkDegrees(spec, input) {
  if (typeof input !== 'string') return SYNTAX;
  const s = input.trim().replace(/\s*(°|stupňů|stupně|stupen|deg)\s*$/i, '');
  const r = parseNumber(s);
  if (r.err) return fail(r.err);
  const rad = /pi|π/i.test(s);
  const deg = rad ? (r.v * 180) / Math.PI : r.v;
  return close(deg, Number(spec.value)) ? { ok: true, normalized: deg } : WRONG;
}

function checkNumber(spec, input) {
  if (spec.unit === 'deg') return checkDegrees(spec, input);
  const r = parseNumber(input);
  if (r.err) return fail(r.err);
  return close(r.v, Number(spec.value)) ? { ok: true, normalized: r.v } : WRONG;
}

// Pevná, seedovaná síť bodů pro porovnání výrazů (žádné Math.random – stejný vstup dá vždy stejný
// verdikt). Hustá síť kolem nuly, řidší do ±60, každý bod s malým posunem, aby se netrefoval do
// celých čísel (póly, hranice oborů). Body se nejdřív hledají tam, kde je definovaný VZOROVÝ výraz.
function grid(lo, hi, step, rng) {
  const out = [];
  for (let k = 0; lo + k * step < hi; k++) out.push(lo + (k + 0.2 + 0.6 * rng()) * step);
  return out;
}
const GRID_RNG = makeRng(0x5eed2611);
const NEAR = grid(-6, 6, 0.05, GRID_RNG);       // hlavní okno
const FINE = grid(-1, 1, 0.0025, GRID_RNG);     // úzké obory kolem nuly
const WIDE = grid(-60, 60, 0.5, GRID_RNG);      // obory daleko od nuly (x > 6, x < −6)
const REFINE = 0.05 / 16;                        // zjemnění kolem nalezených bodů
const PICK_NEAR = 24;
const PICK_WIDE = 8;
const MIN_COMPARE = 5;

function compileNode(node) {
  const code = node.compile();
  return (name, x) => {
    try {
      const r = code.evaluate({ [name]: x });
      return typeof r === 'number' && Number.isFinite(r) ? r : null;
    } catch { return null; }
  };
}

// Rovnoměrný výběr nejvýš n prvků (zachová krajní body).
function spread(list, n) {
  if (list.length <= n) return list;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return out;
}

// Body, kde je vzorový výraz definovaný: [[x, hodnota], …]. Výsledek se pamatuje (vzorů je málo).
const refCache = new Map();
function referencePoints(key, ev, name) {
  if (refCache.has(key)) return refCache.get(key);
  const at = (xs) => xs.map((x) => [x, ev(name, x)]).filter(([, v]) => v !== null);
  let near = at([...NEAR, ...FINE]).sort((a, b) => a[0] - b[0]);
  let wide = at(WIDE.filter((x) => x < -6 || x > 6));
  if (near.length + wide.length < MIN_COMPARE) {
    // obor je užší než krok sítě: zahustit okolí nalezených bodů
    const extra = [];
    for (const [x0] of [...near, ...wide].slice(0, 12)) {
      for (let j = -24; j <= 24; j++) if (j) extra.push(x0 + j * REFINE * (Math.abs(x0) > 6 ? 10 : 1));
    }
    near = [...near, ...at(extra)].sort((a, b) => a[0] - b[0]);
  }
  const pts = [...spread(near, PICK_NEAR), ...spread(wide, PICK_WIDE)];
  if (refCache.size > 200) refCache.clear();
  refCache.set(key, pts);
  return pts;
}

function checkExpression(spec, input) {
  const s = prepare(input);
  if (s === null) return SYNTAX;
  const name = spec.variable || 'x';
  const ref = prepare(String(spec.value));
  let user, expected, evU, evE;
  try {
    user = parse(s);
    if (usesBlocked(user)) return SYNTAX;
    evU = compileNode(user);
    expected = parse(ref);
    evE = compileNode(expected);
  } catch { return SYNTAX; }

  const pts = referencePoints(`${name}|${ref}`, evE, name);
  // Méně než 3 body: rovnost nejde ověřit čísly, uzná se jen stejný zápis.
  if (pts.length < 3) return user.toString() === expected.toString() ? { ok: true, normalized: s } : WRONG;
  for (const [x, e] of pts) {
    const u = evU(name, x);
    if (u === null || !close(u, e)) return WRONG;
  }
  return { ok: true, normalized: s };
}

export function check(answerSpec, input) {
  try {
    switch (answerSpec && answerSpec.kind) {
      case 'number': return checkNumber(answerSpec, input);
      case 'expression': return checkExpression(answerSpec, input);
      case 'vector': return checkVector(answerSpec, input);
      case 'matrix': return checkMatrix(answerSpec, input);
      case 'interval': return checkInterval(answerSpec, input);
      case 'limit': return checkLimit(answerSpec, input);
      case 'system': return checkSystem(answerSpec, input);
      case 'list': return checkList(answerSpec, input);
      default: return UNSUPPORTED;
    }
  } catch {
    return SYNTAX;
  }
}
