// Strukturované druhy odpovědí: vektor, matice, interval, limita, soustava, seznam.
import { SYNTAX, WRONG, TOL, parse, normalize, parseNumber, close, fail } from './checker-core.js';

const OK = (normalized) => ({ ok: true, normalized });

// ---------- vektor a matice ----------
function compareCells(expected, input) {
  let wrong = false;
  const norm = [];
  for (let i = 0; i < expected.length; i++) {
    norm.push([]);
    for (let j = 0; j < expected[i].length; j++) {
      const r = parseNumber(input[i][j]);
      if (r.err === 'syntax') return SYNTAX;
      if (r.err || !close(r.v, Number(expected[i][j]))) wrong = true;
      else norm[i].push(r.v);
    }
  }
  return wrong ? WRONG : OK(norm);
}

export function checkVector(spec, input) {
  if (!Array.isArray(input) || !Array.isArray(spec.value)) return SYNTAX;
  if (input.length !== spec.value.length) return WRONG;
  const res = compareCells(spec.value.map((x) => [x]), input.map((x) => [x]));
  return res.ok ? OK(res.normalized.map((r) => r[0])) : res;
}

export function checkMatrix(spec, input) {
  if (!Array.isArray(input) || !input.every(Array.isArray) || !Array.isArray(spec.value)) return SYNTAX;
  if (input.length !== spec.value.length) return WRONG;
  if (spec.value.length && input.some((r) => r.length !== spec.value[0].length)) return WRONG;
  return compareCells(spec.value, input);
}

// ---------- nekonečno, limita ----------
const fold = (str) => String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function parseInf(str) {
  const t = fold(str).replace(/[−–—]/g, '-').replace(/\s+/g, '');
  const m = /^(minus)?([+-]?)(∞|inf|infinity|oo|nekonecno)$/.exec(t);
  if (!m) return null;
  return m[1] || m[2] === '-' ? -Infinity : Infinity;
}

// {kind:'dne'} | {kind:'num', v} | {err}
function parseLimit(raw) {
  const s = String(raw).trim();
  if (/^(neexistuje|dne|nex\.?|does not exist)$/i.test(s)) return { kind: 'dne' };
  const inf = parseInf(s);
  if (inf !== null) return { kind: 'num', v: inf };
  const r = parseNumber(s);
  return r.err ? { err: r.err } : { kind: 'num', v: r.v };
}

export function checkLimit(spec, input) {
  if (typeof input !== 'string') return SYNTAX;
  const u = parseLimit(input);
  if (u.err) return fail(u.err);
  const e = parseLimit(spec.value);
  if (e.err) return WRONG;
  if (u.kind !== e.kind) return WRONG;
  if (u.kind === 'dne') return OK('DNE');
  const same = Number.isFinite(e.v) && Number.isFinite(u.v) ? close(u.v, e.v) : u.v === e.v;
  return same ? OK(u.v) : WRONG;
}

// ---------- intervaly ----------
const OPEN_L = { '(': false, '[': true, '<': true };
const CLOSE_R = { ')': false, ']': true, '>': true };

function bound(str) {
  const inf = parseInf(str);
  if (inf !== null) return inf;
  const r = parseNumber(str, { decimalComma: false });
  return r.err ? null : r.v;
}

// Prázdná množina: ∅, Ø, {}, \emptyset, „prázdná množina“, „neexistuje“ (zadání: 'empty', [] nebo '∅').
function isEmptySet(raw) {
  if (Array.isArray(raw)) return raw.length === 0;
  const t = fold(raw).trim().replace(/\s+/g, ' ');
  return /^(∅|ø|\{ ?\}|\emptyset|\varnothing|empty|prazdna mnozina|neexistuje|zadne reseni|nema reseni)$/.test(t);
}

// Čárka mimo závorky (oddělovač krajních bodů, ne argumenty funkcí jako log(8, 2)).
function splitTopComma(body) {
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return [body.slice(0, i), body.slice(i + 1)];
  }
  return [body];
}

// -> [{lo, hi, lc, hc}] nebo null při syntaktické chybě
function parseIntervals(raw) {
  const text = normalize(String(raw), { decimalComma: false });
  if (text === null) return null;
  const parts = text.split(/[∪U]/).map((p) => p.trim());
  const out = [];
  for (const p of parts) {
    let lo, hi, lc, hc;
    const pt = /^\{(.+)\}$/.exec(p);
    if (pt) {
      lo = hi = bound(pt[1].replace(',', '.'));
      lc = hc = true;
    } else {
      if (p.length < 5 || !(p[0] in OPEN_L) || !(p[p.length - 1] in CLOSE_R)) return null;
      lc = OPEN_L[p[0]]; hc = CLOSE_R[p[p.length - 1]];
      const body = p.slice(1, -1);
      const bs = body.includes(';') ? body.split(';') : splitTopComma(body);
      if (bs.length !== 2) return null;
      lo = bound(bs[0].trim().replace(/(\d),(\d)/, '$1.$2')); hi = bound(bs[1].trim().replace(/(\d),(\d)/, '$1.$2'));
    }
    if (lo === null || hi === null || Number.isNaN(lo) || Number.isNaN(hi)) return null;
    if (lo > hi || (lo === hi && !(lc && hc))) return null;
    if (!Number.isFinite(lo)) lc = false;
    if (!Number.isFinite(hi)) hc = false;
    out.push({ lo, hi, lc, hc });
  }
  return out;
}

function mergeIntervals(list) {
  const s = [...list].sort((a, b) => a.lo - b.lo || (b.lc ? 1 : 0) - (a.lc ? 1 : 0));
  const out = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && (iv.lo < last.hi || (iv.lo === last.hi && (iv.lc || last.hc)))) {
      if (iv.hi > last.hi) { last.hi = iv.hi; last.hc = iv.hc; }
      else if (iv.hi === last.hi) last.hc = last.hc || iv.hc;
    } else out.push({ ...iv });
  }
  return out;
}

// Iracionální krajní bod (3π/2, ln 2, √2, e): není zlomkem p/q se jmenovatelem do 1000.
function isIrrational(v) {
  if (!Number.isFinite(v)) return false;
  for (let q = 1; q <= 1000; q++) {
    if (Math.abs(v * q - Math.round(v * q)) <= 1e-9 * q * Math.max(1, Math.abs(v))) return false;
  }
  return true;
}

// Desetinné přiblížení iracionálního bodu se uzná, je-li správně aspoň na 3 desetinná místa.
export const APPROX_TOL = 5e-4;
const eqEnd = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? close(a, b) : a === b);
const eqEndApprox = (u, e) => eqEnd(u, e) || (Number.isFinite(u) && isIrrational(e) && Math.abs(u - e) <= APPROX_TOL);

export function checkInterval(spec, input) {
  if (typeof input !== 'string') return SYNTAX;
  const emptySpec = spec.value === 'empty' || isEmptySet(spec.value);
  if (isEmptySet(input)) return emptySpec ? OK('∅') : WRONG;
  const u = parseIntervals(input);
  if (!u) return SYNTAX;
  if (emptySpec) return WRONG;
  const e = parseIntervals(spec.value);
  if (!e) return WRONG;
  const a = mergeIntervals(u), b = mergeIntervals(e);
  const same = a.length === b.length &&
    a.every((x, i) => eqEndApprox(x.lo, b[i].lo) && eqEndApprox(x.hi, b[i].hi) && x.lc === b[i].lc && x.hc === b[i].hc);
  return same ? OK(input.trim()) : WRONG;
}

// ---------- seznam ----------
// Vrací seznam možných výkladů (čárka jako oddělovač / desetinná čárka).
function parseList(raw) {
  let s = String(raw).trim();
  const m = /^[[{(](.*)[\]})]$/s.exec(s);
  if (m) s = m[1];
  const variants = s.includes(';') ? [s.split(';')] : [s.split(','), s.split(/,\s+/)];
  return variants.map((items) => {
    const out = [];
    for (const it of items) {
      const r = parseNumber(it);
      if (r.err) return { err: r.err };
      out.push(r.v);
    }
    return { v: out };
  });
}

function uniqSorted(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s.filter((x, i) => i === 0 || !close(x, s[i - 1]));
}

export function checkList(spec, input) {
  if (typeof input !== 'string' || !Array.isArray(spec.value)) return SYNTAX;
  const cands = parseList(input);
  const good = cands.filter((c) => !c.err);
  if (!good.length) return cands.some((c) => c.err === 'wrong') ? WRONG : SYNTAX;
  const b = uniqSorted(spec.value.map(Number));
  for (const c of good) {
    const a = uniqSorted(c.v);
    if (a.length === b.length && a.every((x, i) => close(x, b[i]))) return OK(a);
  }
  return WRONG;
}

// ---------- soustava ----------
const NONE_RE = /^(nema (zadne )?reseni|zadne reseni|neexistuje|no solution|none|∅)$/;
const INF_RE = /^(nekonecne mnoho( reseni)?|∞ reseni|nekonecno reseni|infinitely many( solutions)?)$/;
const foldWs = (str) => fold(str).replace(/\s+/g, ' ').trim();
const RESERVED = new Set(['pi', 'e', 'i', 'Infinity', 'NaN', 'true', 'false']);

function splitTop(s, mode) {
  const out = [];
  let depth = 0, cur = '';
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    const sep = depth === 0 && (mode === 'semi' ? ch === ';'
      : mode === 'comma' ? ch === ','
        : ch === ',' && /\s/.test(chars[i + 1] || ''));
    if (sep) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function buildTuple(comps) {
  if (comps.some((c) => c === '')) return null;
  const nodes = [];
  const params = new Set();
  try {
    for (const c of comps) {
      const node = parse(c);
      node.compile();
      node.traverse((n, path, parent) => {
        if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn') && !RESERVED.has(n.name)) params.add(n.name);
      });
      nodes.push(node);
    }
  } catch { return null; }
  return { nodes, params: [...params] };
}

// -> pole možných výkladů {nodes, params} (čárka jako oddělovač / desetinná čárka); prázdné při chybě
function parseTuples(raw) {
  let s = Array.isArray(raw) ? raw.join(',') : String(raw);
  s = normalize(s, { decimalComma: false });
  if (s === null) return [];
  const m = /^[[(](.*)[\])]$/s.exec(s);
  if (m && splitTop(s, 'comma').length === 1 && splitTop(s, 'semi').length === 1) s = m[1];
  const dec = (c) => c.replace(/(\d),(\d)/g, '$1.$2').trim();
  const variants = s.includes(';')
    ? [splitTop(s, 'semi').map(dec)]
    : [splitTop(s, 'comma').map((c) => c.trim()), splitTop(s, 'commaSpace').map(dec)];
  return variants.map(buildTuple).filter(Boolean);
}

function point(t, scope) {
  const p = [];
  for (const n of t.nodes) {
    let v;
    try { v = n.evaluate(scope); } catch { return null; }
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    p.push(v);
  }
  return p;
}

const zeroScope = (params) => Object.fromEntries(params.map((p) => [p, 0]));

// Afinní množina {p0, dirs} nebo null, když řešení není afinní (lineární v parametrech).
function affine(t) {
  const p0 = point(t, zeroScope(t.params));
  if (!p0) return null;
  const dirs = [];
  for (const name of t.params) {
    const p = point(t, { ...zeroScope(t.params), [name]: 1 });
    if (!p) return null;
    dirs.push(p.map((x, k) => x - p0[k]));
  }
  // Ověření linearity na náhodných hodnotách parametrů.
  for (let k = 0; k < 3; k++) {
    const vals = t.params.map(() => Math.random() * 6 - 3);
    const scope = Object.fromEntries(t.params.map((n, i) => [n, vals[i]]));
    const p = point(t, scope);
    if (!p) return null;
    for (let c = 0; c < p0.length; c++) {
      const pred = p0[c] + dirs.reduce((s, d, i) => s + vals[i] * d[c], 0);
      if (!close(p[c], pred)) return null;
    }
  }
  return { p0, dirs };
}

function rank(vectors) {
  const m = vectors.map((v) => [...v]);
  let r = 0;
  const cols = m.length ? m[0].length : 0;
  const scale = Math.max(1, ...m.flat().map(Math.abs));
  for (let c = 0; c < cols && r < m.length; c++) {
    let best = r;
    for (let i = r + 1; i < m.length; i++) if (Math.abs(m[i][c]) > Math.abs(m[best][c])) best = i;
    if (Math.abs(m[best][c]) < TOL * scale) continue;
    [m[r], m[best]] = [m[best], m[r]];
    for (let i = r + 1; i < m.length; i++) {
      const f = m[i][c] / m[r][c];
      for (let j = c; j < cols; j++) m[i][j] -= f * m[r][j];
    }
    r++;
  }
  return r;
}

function sameAffine(a, b) {
  if (a.p0.length !== b.p0.length) return false;
  const ra = rank(a.dirs), rb = rank(b.dirs);
  if (ra !== rb || rank([...a.dirs, ...b.dirs]) !== ra) return false;
  const diff = a.p0.map((x, i) => x - b.p0[i]);
  return rank([...a.dirs, diff]) === ra;
}

export function checkSystem(spec, input) {
  if (typeof input !== 'string') return SYNTAX;
  const trimmed = input.trim();
  if (trimmed === '') return SYNTAX;
  const folded = foldWs(trimmed);
  const userNone = NONE_RE.test(folded);
  const userInf = INF_RE.test(folded);
  const specNone = typeof spec.value === 'string' && NONE_RE.test(foldWs(spec.value));
  const e = specNone ? null : parseTuples(spec.value)[0];
  if (userInf) {
    return e && e.params.length > 0 ? { ok: false, reason: 'wrong', normalized: 'infinite' } : WRONG;
  }
  if (userNone || specNone) return userNone && specNone ? OK('none') : WRONG;
  const us = parseTuples(input);
  if (!us.length) return SYNTAX;
  if (!e) return WRONG;
  const ea = affine(e);
  if (!ea) return WRONG;
  for (const u of us) {
    const ua = affine(u);
    if (ua && sameAffine(ua, ea)) return OK(trimmed);
  }
  return WRONG;
}
