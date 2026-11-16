// „Limita zlomku“ pro stránku Vlastní příklad: student zadá čitatel, jmenovatel a bod,
// router vybere metodu jako učitel (dosazení, krácení 0/0, k/0, nekonečno, sdružený výraz)
// a použije existující postupy z limita.js. Žádná nová matematika, jen rozpoznání případu.
import { fr, add, mul, div, isZero, gcd, frTex } from '../lin.js';
import { normalize } from '../checker-core.js';
import { parseExpr, exprTex, fail } from '../custom-input.js';
import limita from './limita.js';
import { trim, deg, evalP, polyTex, limTex, resultTex, resultValue } from './limita-lib.js';

const NONPOLY = 'Zatím umím zlomky z polynomů (a jednu odmocninu).';
const SQRT_MSG = 'Odmocniny zatím jen v jednoduchém tvaru (√(ax+b) ± c).';
const typeOf = (id) => limita.types.find((t) => t.id === id);

// ---------- mnohočlen s racionálními koeficienty z uzlu math.js ----------
const ptrim = (p) => { const q = p.slice(); while (q.length > 1 && isZero(q[q.length - 1])) q.pop(); return q; };
const padd = (p, q) => ptrim(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => add(p[i] || fr(0), q[i] || fr(0))));
const pmul = (p, q) => {
  const o = Array.from({ length: p.length + q.length - 1 }, () => fr(0));
  p.forEach((x, i) => q.forEach((y, j) => { o[i + j] = add(o[i + j], mul(x, y)); }));
  return ptrim(o);
};
const pneg = (p) => p.map((c) => mul(c, fr(-1)));
const constOf = (p) => (p.length === 1 ? p[0] : null);

function numFr(v) {
  const s = String(v);
  if (/e/i.test(s)) fail(NONPOLY);
  const [i, f = ''] = s.split('.');
  return fr(Number(i + f), 10 ** f.length);
}
function polyNode(n) {
  switch (n.type) {
    case 'ParenthesisNode': return polyNode(n.content);
    case 'ConstantNode': return [numFr(n.value)];
    case 'SymbolNode':
      if (n.name !== 'x') fail(`Neznámý symbol „${n.name}“. Používej jen proměnnou x.`);
      return [fr(0), fr(1)];
    case 'OperatorNode': {
      const [a, b] = n.args;
      if (n.fn === 'unaryMinus') return pneg(polyNode(a));
      if (n.fn === 'unaryPlus') return polyNode(a);
      const A = polyNode(a); const B = polyNode(b);
      if (n.fn === 'add') return padd(A, B);
      if (n.fn === 'subtract') return padd(A, pneg(B));
      if (n.fn === 'multiply') return pmul(A, B);
      if (n.fn === 'divide') {
        const c = constOf(B);
        if (!c) fail(NONPOLY);
        if (isZero(c)) fail('Ve výrazu se dělí nulou.');
        return pmul(A, [div(fr(1), c)]);
      }
      if (n.fn === 'pow') {
        const k = constOf(B);
        if (!k || k.d !== 1 || k.n < 0 || k.n > 8) fail(NONPOLY);
        let r = [fr(1)];
        for (let i = 0; i < k.n; i++) r = pmul(r, A);
        return r;
      }
      return fail(NONPOLY);
    }
    default: return fail(NONPOLY);
  }
}
const lcm = (a, b) => (a / gcd(a, b)) * b;
// racionální mnohočleny -> celočíselné (pole od absolutního členu) a společný násobek jmenovatelů
const scaleToInt = (polys) => {
  const L = polys.flat().reduce((m, c) => lcm(m, c.d), 1);
  return { L, ints: polys.map((p) => trim(p.map((c) => mul(c, fr(L)).n))) };
};

// ---------- bod ----------
export function parsePoint(raw) {
  const s0 = normalize(String(raw ?? ''), { decimalComma: true });
  if (!s0) return fail('Zadej bod, ke kterému x jde (číslo, zlomek nebo ∞).');
  const s = s0.toLowerCase().replace(/\s+/g, '');
  const m = /^([+-]?)(∞|inf|infinity|oo|nekonecno|nekonečno)$/.exec(s);
  if (m) return { inf: m[1] === '-' ? -1 : 1 };
  const q = /^([+-]?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(s);
  if (!q) return fail(`Bodu „${String(raw).trim()}“ nerozumím. Zadej číslo (např. -2), zlomek (1/2) nebo ∞, -∞.`);
  let v = numFr(q[1].replace('+', ''));
  if (q[2]) { const d = numFr(q[2]); if (isZero(d)) fail('Bod nemůže mít ve jmenovateli nulu.'); v = div(v, d); }
  if (Math.abs(v.n) > 999 || v.d > 99) fail('Bod je příliš velký nebo složitý (zadej např. -2, 1/2).');
  return { a: v };
}

// ---------- jedna odmocnina ----------
function sqrtNodes(n) {
  const out = [];
  n.traverse((x) => {
    if (x.type === 'FunctionNode' && x.fn?.name === 'sqrt') out.push(x);
    else if (x.type === 'FunctionNode') fail(NONPOLY);
  });
  return out;
}
// výraz -> { poly } nebo { sqrt: {rad, c, neg} } (neg: c − √R, jinak √R − c)
function parseSide(str) {
  const node = parseExpr(str);
  const sq = sqrtNodes(node);
  if (!sq.length) return { poly: polyNode(node) };
  if (sq.length > 1 || sq[0].args.length !== 1) return fail(SQRT_MSG);
  const target = sq[0];
  const sub = (val) => node.transform((x) => (x === target ? parseExpr(String(val)) : x));
  const P = polyNode(sub(0)); const Q = polyNode(sub(1));
  const k = constOf(padd(Q, pneg(P)));
  const c = constOf(P);
  if (!k || k.d !== 1 || Math.abs(k.n) !== 1 || !c || c.d !== 1) return fail(SQRT_MSG);
  const rad = polyNode(target.args[0]);
  if (rad.some((x) => x.d !== 1) || rad.length > 3 || rad.length < 2) return fail(SQRT_MSG);
  return { sqrt: { rad: rad.map((x) => x.n), c: k.n > 0 ? -c.n : c.n, neg: k.n < 0 } };
}

// ---------- výsledek ----------
const step = (title, text, board) => ({ title, text, board });
function conclusion(result) {
  const tex = result.kind === 'dne' ? '\\text{Limita neexistuje}' : `\\text{Limita je }${resultTex(result)}`;
  return step('Závěr', result.kind === 'dne'
    ? 'Jednostranné limity se liší, proto limita neexistuje.'
    : 'Shrnutí: hodnota limity je poslední řádek postupu.', [{ tex }]);
}
function problemFrom(base, result, steps, data) {
  return {
    ...base,
    id: `limita-zlomek-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`, topic: 'limita', type: 'zlomek', data,
    answerSpec: { kind: 'limit', value: resultValue(result) }, answerTex: resultTex(result),
    solution: [...steps, conclusion(result)],
  };
}
const parseFr = (s) => { const [n, d = 1] = String(s).split('/').map(Number); return fr(n, d); };
const resultOf = (p) => {
  const v = String(p.answerSpec.value);
  if (v === 'DNE') return { kind: 'dne' };
  if (/∞/.test(v)) return { kind: 'inf', s: v[0] === '-' ? -1 : 1 };
  return { kind: 'num', v: parseFr(v) };
};

// ---------- router ----------
export function solveLimitFraction({ cit, jm, bod, strana = '' }) {
  if (!String(cit ?? '').trim() || !String(jm ?? '').trim()) fail('Vyplň čitatel i jmenovatel.');
  const pt = parsePoint(bod);
  const sc = parseSide(cit); const sj = parseSide(jm);
  if (sc.sqrt || sj.sqrt) return solveSqrt(sc, sj, pt, { cit, jm, bod });
  if (sj.poly.length === 1 && isZero(sj.poly[0])) fail('Jmenovatel je roven nule, zlomek nemá smysl.');
  const side = pt.inf ? '' : strana === 'zleva' || strana === '-' ? '-' : strana === 'zprava' || strana === '+' ? '+' : '';
  const { L, ints: [N, D] } = scaleToInt([sc.poly, sj.poly]);
  const intro = L === 1 ? [] : [step('Úprava zlomku',
    `Koeficienty jsou zlomky. Čitatele i jmenovatele vynásobíme číslem $${L}$ (zlomek se nezmění), aby měli celé koeficienty.`,
    [{ tex: `\\frac{${polyTex(N)}}{${polyTex(D)}}` }])];
  const data = { cit, jm, bod: String(bod).trim(), strana: side };
  if (pt.inf) return solveInf(N, D, pt.inf, intro, data);
  if (N.length === 1 && N[0] === 0) {
    return problemFrom({ task: 'Vypočítej limitu.', promptTex: `${limTex(pt.a, side)}\\frac{0}{${polyTex(D)}}` }, { kind: 'num', v: fr(0) },
      [step('Nulový čitatel', 'Čitatel je nulový mnohočlen a zlomek je roven nule všude, kde je jmenovatel nenulový.', [{ tex: '=0' }])], data);
  }
  const aArg = pt.a.d === 1 ? pt.a.n : `${pt.a.n}/${pt.a.d}`;
  const type = isZero(evalP(D, pt.a)) ? (isZero(evalP(N, pt.a)) ? 'rozklad' : 'jednostranne') : 'dosazeni';
  const p = typeOf(type).solve({ num: N, den: D, a: aArg, ...(side ? { side } : {}) });
  return problemFrom(p, resultOf(p), [...intro, ...p.solution], data);
}

function solveInf(N, D, to, intro, data) {
  const lim = limTex(to > 0 ? '\\infty' : '-\\infty');
  const base = (pt) => ({ task: 'Vypočítej limitu.', promptTex: pt });
  if (N.length === 1 && N[0] === 0) {
    return problemFrom(base(`${lim}\\frac{0}{${polyTex(D)}}`), { kind: 'num', v: fr(0) },
      [step('Nulový čitatel', 'Čitatel je nulový mnohočlen, proto je zlomek roven nule.', [{ tex: '=0' }])], data);
  }
  const dn = deg(N); const dd = deg(D);
  const nek = typeOf('nekonecno');
  if (dd === 0 && dn === 0) {
    const v = div(fr(N[0]), fr(D[0]));
    return problemFrom(base(`${lim}\\frac{${N[0]}}{${D[0]}}`), { kind: 'num', v },
      [step('Konstantní zlomek', 'Čitatel i jmenovatel jsou konstanty, hodnota zlomku se s $x$ nemění.', [{ tex: `=${frTex(v)}` }])], data);
  }
  if (dd === 0 && D[0] !== 1) {
    const p = nek.solve({ num: N, den: [1], to });
    const c = D[0];
    const r0 = resultOf(p);
    const r = { kind: 'inf', s: r0.s * Math.sign(c) };
    return problemFrom(base(`${lim}\\frac{${polyTex(N)}}{${c}}`), r,
      [...intro, ...p.solution, step('Dělení konstantou',
        `Jmenovatel je konstanta $${c}$: nevlastní limitu čitatele vydělíme číslem $${c}$. ${c < 0 ? 'Záporné číslo obrátí znaménko.' : 'Znaménko se nezmění.'}`,
        [{ tex: `${c < 0 ? '-' : ''}\\frac{${resultTex(r0)}}{${Math.abs(c)}}=${resultTex(r)}` }])], data);
  }
  const p = nek.solve({ num: N, den: D, to });
  return problemFrom(p, resultOf(p), [...intro, ...p.solution], data);
}

function solveSqrt(sc, sj, pt, data) {
  if (pt.inf || pt.a.d !== 1) fail(SQRT_MSG);
  const a = pt.a.n;
  const toT = (s) => {
    if (s.sqrt) return s.sqrt;
    if (s.poly.some((c) => c.d !== 1)) fail(SQRT_MSG);
    return { poly: trim(s.poly.map((c) => c.n)) };
  };
  const T1 = toT(sc); const T2 = toT(sj);
  if (!T1.rad && !T2.rad) fail(SQRT_MSG);
  for (const t of [T1, T2]) {
    if (t.poly && !isZero(evalP(t.poly, fr(a)))) fail(SQRT_MSG);
    if (t.rad && (t.c <= 0 || evalP(t.rad, fr(a)).n !== t.c * t.c)) fail(SQRT_MSG);
  }
  let p;
  try { p = typeOf('odmocnina').solve({ a, num: T1, den: T2 }); } catch { fail(SQRT_MSG); }
  return problemFrom(p, resultOf(p), p.solution, data);
}

// ---------- náhled a popis pro stránku ----------
export function limitPreviewTex(v) {
  const c = v.cit?.trim() && exprTex(v.cit); const j = v.jm?.trim() && exprTex(v.jm);
  if (!c || !j) return null;
  let to = 'a'; let side = '';
  try {
    const pt = parsePoint(v.bod);
    to = pt.inf ? (pt.inf > 0 ? '\\infty' : '-\\infty') : frTex(pt.a);
    if (!pt.inf) side = v.strana === 'zleva' ? '^{-}' : v.strana === 'zprava' ? '^{+}' : '';
  } catch { /* bod zatím nečitelný */ }
  return `\\lim_{x\\to ${to}${side}}\\frac{${c}}{${j}}`;
}

export const limitFractionType = {
  id: 'zlomek',
  title: 'Limita zlomku',
  solve: (data) => solveLimitFraction(data),
  custom: {
    preview: limitPreviewTex,
    fields: [
      { id: 'cit', label: 'Čitatel', kind: 'expr', hint: 'Např. x^2-1 nebo sqrt(x+1)-2' },
      { id: 'jm', label: 'Jmenovatel', kind: 'expr', hint: 'Např. x-1 nebo (x+1)(x-2)' },
      { id: 'bod', label: 'x → a, kde a =', kind: 'text', hint: 'Číslo, zlomek (1/2) nebo ∞, -∞, nekonečno' },
      {
        id: 'strana', label: 'Strana', kind: 'choice', options: ['obě strany', 'zleva', 'zprava'],
        when: (v) => { try { return !parsePoint(v.bod).inf; } catch { return true; } },
      },
    ],
    build: (v) => ({ cit: v.cit, jm: v.jm, bod: v.bod, strana: v.strana === 'zleva' || v.strana === 'zprava' ? v.strana : '' }),
  },
};
