// Výrazy pro derivování: vlastní strom (IR), úprava (sčítání členů, krácení, odstranění ·1 a +0),
// zápis do TeXu pro tabuli a do textu pro kontrolu odpovědi. Čistý modul bez závislostí.
//
// Uzly: { t:'num', v:{n,d} } · { t:'x' } · { t:'cst', name:'pi'|'e' } · { t:'add', a:[…] } (člen může být neg)
//       · { t:'mul', a:[…], imp? } · { t:'div', n, d } · { t:'pow', b, e } · { t:'neg', a }
//       · { t:'fn', f, a, base? } (sin cos tan cot exp ln log sqrt asin acos atan acot)
//       · { t:'der', a } (zápis (a)′ v postupu).
// Čísla jsou zlomky {n,d}. Výsledek úpravy (simp) má znaménko vždy před členem nebo zlomkem,
// jmenovatel není záporný a v součtu se členy slučují.

export class DeriveError extends Error {}
export const fail = (msg) => { throw new DeriveError(msg); };

// ---------- zlomky ----------
const BIG = 1e12;
const gcd = (a, b) => { let x = Math.abs(a); let y = Math.abs(b); while (y) { [x, y] = [y, x % y]; } return x; };
export const R = (n, d = 1) => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  n /= g; d /= g;
  if (Math.abs(n) > BIG || d > BIG) fail('Čísla ve výrazu jsou příliš velká.');
  return { n, d };
};
const radd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const rmul = (a, b) => R(a.n * b.n, a.d * b.d);
const rneg = (a) => R(-a.n, a.d);
const rIsInt = (a) => a.d === 1;
const rIs = (a, n, d = 1) => a.n === n && a.d === d;
const rpowInt = (a, k) => {
  if (a.n === 0 && k < 0) fail('Ve výrazu se dělí nulou.');
  let r = R(1);
  const m = Math.abs(k);
  if (m > 64) fail('Exponent je příliš velký.');
  for (let i = 0; i < m; i++) r = rmul(r, a);
  return k < 0 ? R(r.d, r.n) : r;
};

// ---------- konstruktory ----------
export const num = (n, d = 1) => ({ t: 'num', v: R(n, d) });
export const numR = (v) => ({ t: 'num', v });
export const X = { t: 'x' };
export const cst = (name) => ({ t: 'cst', name });
export const add = (...a) => ({ t: 'add', a });
export const mul = (...a) => ({ t: 'mul', a });
export const mulI = (...a) => ({ t: 'mul', a, imp: true });
export const div = (n, d) => ({ t: 'div', n, d });
export const pow = (b, e) => ({ t: 'pow', b, e });
export const neg = (a) => ({ t: 'neg', a });
export const fn = (f, a, base) => (base ? { t: 'fn', f, a, base } : { t: 'fn', f, a });
export const der = (a) => ({ t: 'der', a });
export const sub = (a, b) => add(a, neg(b));

export const isNum = (n) => n.t === 'num';
export const isInt = (n) => n.t === 'num' && rIsInt(n.v);

export function dep(n) {
  switch (n.t) {
    case 'x': return true;
    case 'num': case 'cst': return false;
    case 'add': case 'mul': return n.a.some(dep);
    case 'div': return dep(n.n) || dep(n.d);
    case 'pow': return dep(n.b) || dep(n.e);
    case 'neg': case 'der': return dep(n.a);
    case 'fn': return dep(n.a) || (n.base ? dep(n.base) : false);
    default: return false;
  }
}
export function size(n) {
  switch (n.t) {
    case 'add': case 'mul': return 1 + n.a.reduce((s, c) => s + size(c), 0);
    case 'div': return 1 + size(n.n) + size(n.d);
    case 'pow': return 1 + size(n.b) + size(n.e);
    case 'neg': case 'der': return 1 + size(n.a);
    case 'fn': return 1 + size(n.a) + (n.base ? size(n.base) : 0);
    default: return 1;
  }
}

// ---------- zápis do textu (math.js, pro kontrolu odpovědi) ----------
const FN_STR = { sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', exp: 'exp', ln: 'log', sqrt: 'sqrt', asin: 'asin', acos: 'acos', atan: 'atan', acot: 'acot' };
export function str(n) { return s0(n).s; }
const sp = (r, min) => (r.p < min ? `(${r.s})` : r.s);
function numStr(v) { return v.d === 1 ? String(v.n) : `(${v.n}/${v.d})`; }
function s0(n) {
  switch (n.t) {
    case 'num': return { s: numStr(n.v), p: 5 };
    case 'x': return { s: 'x', p: 5 };
    case 'cst': return { s: n.name, p: 5 };
    case 'der': return { s: `(${str(n.a)})'`, p: 5 };
    case 'neg': return { s: `-${sp(s0(n.a), 3)}`, p: 1 };
    case 'add': {
      let s = '';
      n.a.forEach((it, i) => {
        const isNeg = it.t === 'neg';
        const body = sp(s0(isNeg ? it.a : it), isNeg ? 3 : 1);
        s += i === 0 ? `${isNeg ? '-' : ''}${body}` : `${isNeg ? '-' : '+'}${body}`;
      });
      return { s, p: 1 };
    }
    case 'mul': return { s: n.a.map((c) => sp(s0(c), 3)).join('*'), p: 2 };
    case 'div': return { s: `${sp(s0(n.n), 3)}/${sp(s0(n.d), 4)}`, p: 2 };
    case 'pow': return { s: `${sp(s0(n.b), 5)}^${sp(s0(n.e), 5)}`, p: 4 };
    case 'fn':
      if (n.f === 'log') return { s: `log(${str(n.a)},${str(n.base)})`, p: 5 };
      return { s: `${FN_STR[n.f]}(${str(n.a)})`, p: 5 };
    default: return { s: '?', p: 5 };
  }
}

// ---------- zápis do TeXu ----------
const FN_TEX = {
  sin: '\\sin', cos: '\\cos', tan: '\\operatorname{tg}', cot: '\\operatorname{cotg}', ln: '\\ln',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\operatorname{arctg}', acot: '\\operatorname{arccotg}',
};
const bareArg = (a) => a.t === 'x' || a.t === 'cst' || (a.t === 'num' && a.v.d === 1);

// o: { marks?: Map(uzel -> jméno třídy bt-…) }; vrací řetězec
export function tex(n, o = {}) { return t0(n, o).s; }
const tp = (r, min) => (r.p < min ? `\\left(${r.s}\\right)` : r.s);
const wrapMark = (n, r, o) => {
  const m = o.marks && o.marks.get(n);
  return m ? { ...r, s: `\\htmlClass{bt-${m}}{${r.s}}` } : r;
};
function numTex(n) {
  const v = n.v;
  if (n.src) return n.src.replace('.', '{,}');
  return v.d === 1 ? String(v.n) : `\\frac{${v.n}}{${v.d}}`;
}
// slévá vnořené součiny a součty, které nejsou označené (označený uzel zůstane celý)
function flat(n, kind, o) {
  const out = [];
  const walk = (x, top) => {
    if (x.t === kind && (top || !(o.marks && o.marks.has(x)))) x.a.forEach((c) => walk(c, false));
    else out.push(x);
  };
  walk(n, true);
  return out;
}
function t0(n, o) {
  return wrapMark(n, t1(n, o), o);
}
function addTex(n, o, den) {
  let items = flat(n, 'add', o);
  if (den && items[0].t === 'neg') {
    const k = items.findIndex((it) => it.t !== 'neg');
    if (k > 0) items = [items[k], ...items.slice(0, k), ...items.slice(k + 1)];
  }
  let s = '';
  items.forEach((it, i) => {
    const isNeg = it.t === 'neg';
    const body = tp(t0(isNeg ? it.a : it, o), isNeg ? 2 : 1);
    s += i === 0 ? `${isNeg ? '-' : ''}${body}` : `${isNeg ? '-' : '+'}${body}`;
  });
  return { s, p: 1 };
}
function fnTex(n, o, power) {
  const pw = power ? `^{${power}}` : '';
  if (n.f === 'exp') return { s: `e^{${t0(n.a, o).s}}`, p: 4 };
  if (n.f === 'sqrt') return { s: `\\sqrt{${t0(n.a, o).s}}`, p: 5 };
  const name = n.f === 'log' ? `\\log_{${t0(n.base, o).s}}` : FN_TEX[n.f];
  const arg = t0(n.a, o);
  if (bareArg(n.a)) return { s: `${name}${pw} ${arg.s}`, p: 3, bare: true };
  return { s: `${name}${pw}\\left(${arg.s}\\right)`, p: 3 };
}
function t1(n, o) {
  switch (n.t) {
    case 'num': return { s: numTex(n), p: n.v.d === 1 ? 5 : 4 };
    case 'x': return { s: 'x', p: 5 };
    case 'cst': return { s: n.name === 'pi' ? '\\pi' : 'e', p: 5 };
    case 'der': return { s: `\\left(${t0(n.a, o).s}\\right)'`, p: 5 };
    case 'neg': return { s: `-${tp(t0(n.a, o), 2)}`, p: 1 };
    case 'add': return addTex(n, o, false);
    case 'mul': {
      const fs = flat(n, 'mul', o).map((c) => t0(c, o));
      let s = '';
      fs.forEach((r, i) => {
        const part = r.p < 2 ? `\\left(${r.s}\\right)` : r.s;
        if (i === 0) { s = part; return; }
        const prev = fs[i - 1];
        const needDot = !n.imp || part.endsWith("'") || prev.s.endsWith("'") || /^[0-9]/.test(part) || part.startsWith('\\frac') || prev.bare || /^[0-9]$/.test(prev.s.slice(-1)) && /^[0-9]/.test(part);
        s += `${needDot ? '\\cdot ' : /\\[a-zA-Z]+$/.test(prev.s) && /^[a-zA-Z]/.test(part) ? ' ' : ''}${part}`;
      });
      return { s, p: 2, bare: fs[fs.length - 1].bare };
    }
    case 'div': {
      if (n.d.t === 'neg') return { s: `-${tp(t0(div(n.n, n.d.a), o), 3)}`, p: 1 };
      if (n.n.t === 'neg') return { s: `-${t0(div(n.n.a, n.d), o).s}`, p: 1 };
      const dr = n.d.t === 'add' ? wrapMark(n.d, addTex(n.d, o, true), o) : t0(n.d, o);
      return { s: `\\frac{${t0(n.n, o).s}}{${dr.s}}`, p: 4 };
    }
    case 'pow': {
      if (!o.plainPow && n.b.t === 'fn' && !(o.marks && o.marks.has(n.b)) && !['exp', 'sqrt', 'log'].includes(n.b.f) && isInt(n.e) && n.e.v.n > 0) {
        return { ...fnTex(n.b, o, String(n.e.v.n)), p: 4 };
      }
      return { s: `${tp(t0(n.b, o), 5)}^{${t0(n.e, o).s}}`, p: 4 };
    }
    case 'fn': return fnTex(n, o);
    default: return { s: '?', p: 5 };
  }
}

// ---------- úprava výrazu ----------
// Součin, podíl, mocnina s číselným exponentem a znaménko se převedou na koeficient a mapu
// základ -> exponent; stejné základy se sloučí a zkrátí. exps = činitelé e^{…} (sčítají se exponenty).
const newAcc = () => ({ c: R(1), m: new Map(), exps: [] });
function addAtom(acc, node, k) {
  const key = str(node);
  const cur = acc.m.get(key);
  const nk = cur ? radd(cur.k, k) : k;
  if (nk.n === 0) acc.m.delete(key); else acc.m.set(key, { base: node, k: nk });
}
const half = R(1, 2);
function rf(n, k, acc) {
  switch (n.t) {
    case 'num':
      if (rIsInt(k)) acc.c = rmul(acc.c, rpowInt(n.v, k.n));
      else if (!rIs(n.v, 1)) addAtom(acc, n, k);
      return;
    case 'neg':
      if (rIsInt(k)) { if (k.n % 2) acc.c = rneg(acc.c); rf(n.a, k, acc); } else addAtom(acc, n, k);
      return;
    case 'mul': n.a.forEach((c) => rf(c, k, acc)); return;
    case 'div': rf(n.n, k, acc); rf(n.d, rneg(k), acc); return;
    case 'pow': {
      const e = simp(n.e);
      if (e.t === 'num') {
        if (rIsInt(k)) { rf(n.b, rmul(e.v, k), acc); return; }
        addAtom(acc, pow(simp(n.b), e), k);
        return;
      }
      addAtom(acc, pow(simp(n.b), e), k);
      return;
    }
    case 'fn': {
      if (n.f === 'sqrt') { rf(n.a, rmul(half, k), acc); return; }
      const a = simp(n.a);
      if (n.f === 'exp' && rIsInt(k)) { acc.exps.push({ arg: a, k }); return; }
      addAtom(acc, n.base ? fn(n.f, a, simp(n.base)) : fn(n.f, a), k);
      return;
    }
    case 'add': {
      let s = simp(n);
      if (s.t !== 'add') { rf(s, k, acc); return; }
      // součet jen se zápornými členy: znaménko ven (−x−1 → −(x+1))
      if (s.a.every((it) => it.t === 'neg') && rIsInt(k)) {
        if (k.n % 2) acc.c = rneg(acc.c);
        s = simp(add(...s.a.map((it) => it.a)));
      }
      addAtom(acc, s, k);
      return;
    }
    default: addAtom(acc, n, k);
  }
}
const rankOf = (b) => {
  if (b.t === 'x' || b.t === 'cst') return 1;
  if (b.t === 'add' || b.t === 'pow' || b.t === 'fn' && b.f === 'sqrt') return 2;
  return b.t === 'fn' ? 4 : 3;
};
function factorOf(base, k) {
  if (rIs(k, 1)) return base;
  if (rIs(k, 1, 2)) return fn('sqrt', base);
  return pow(base, numR(k));
}
function build(acc) {
  if (acc.c.n === 0) return num(0);
  const nums = []; const dens = [];
  const items = [...acc.m.values()].map((e, i) => ({ ...e, i }));
  let ex = null;
  if (acc.exps.length) {
    const total = simp(add(...acc.exps.map((e) => (rIs(e.k, 1) ? e.arg : mul(e.arg, numR(e.k))))));
    if (!(total.t === 'num' && total.v.n === 0)) ex = total;
  }
  if (ex) items.push({ base: fn('exp', ex), k: R(1), i: items.length, exp: true });
  items.sort((p, q) => (p.exp ? 3 : rankOf(p.base)) - (q.exp ? 3 : rankOf(q.base)) || p.i - q.i);
  for (const e of items) (e.k.n > 0 ? nums : dens).push(e.exp ? e.base : factorOf(e.base, e.k.n > 0 ? e.k : rneg(e.k)));
  const a = Math.abs(acc.c.n);
  if (a !== 1 || !nums.length) nums.unshift(num(a));
  if (acc.c.d !== 1) dens.unshift(num(acc.c.d));
  const top = nums.length === 1 ? nums[0] : { t: 'mul', a: nums, imp: true };
  const bottom = dens.length === 1 ? dens[0] : dens.length ? { t: 'mul', a: dens, imp: true } : null;
  const q = bottom ? div(top, bottom) : top;
  return acc.c.n < 0 ? neg(q) : q;
}
const FN0 = { sin: 0, tan: 0, asin: 0, atan: 0 };
export function simp(n) {
  switch (n.t) {
    case 'num': return numR(n.v);
    case 'x': case 'cst': return n;
    case 'der': return n;
    case 'fn': {
      const a = simp(n.a);
      if (a.t === 'num' && a.v.n === 0) {
        if (n.f in FN0) return num(0);
        if (n.f === 'cos' || n.f === 'exp') return num(1);
      }
      if (n.f === 'ln' && a.t === 'num' && rIs(a.v, 1)) return num(0);
      return n.base ? fn(n.f, a, simp(n.base)) : fn(n.f, a);
    }
    case 'add': {
      const terms = [];
      const walk = (x, sign) => {
        if (x.t === 'add') x.a.forEach((c) => walk(c, sign));
        else if (x.t === 'neg') walk(x.a, -sign);
        else {
          const s = simp(x);
          if (s.t === 'add') s.a.forEach((c) => walk(c, sign)); else terms.push({ s: sign, node: s });
        }
      };
      walk(n, 1);
      const map = new Map();
      for (const { s, node } of terms) {
        const acc = newAcc();
        rf(node, R(1), acc);
        acc.c = rmul(acc.c, R(s));
        const key = str(build({ ...acc, c: R(1) }));
        const cur = map.get(key);
        if (cur) cur.c = radd(cur.c, acc.c); else map.set(key, { ...acc, c: acc.c });
      }
      let list = [...map.values()].filter((e) => e.c.n !== 0);
      if (!list.length) return num(0);
      const polyish = list.every((e) => [...e.m.values()].every((v) => v.base.t === 'x') && !e.exps.length);
      if (polyish) {
        const deg = (e) => { const v = e.m.get('x'); return v ? v.k.n / v.k.d : 0; };
        list = list.sort((p, q) => deg(q) - deg(p));
      }
      const built = list.map(build);
      return built.length === 1 ? built[0] : add(...built);
    }
    default: {
      const acc = newAcc();
      rf(n, R(1), acc);
      return build(acc);
    }
  }
}

// ---------- mnohočleny ----------
const padd = (p, q) => Array.from({ length: Math.max(p.length, q.length) }, (_, i) => radd(p[i] || R(0), q[i] || R(0)));
const pmul = (p, q) => {
  const o = Array.from({ length: p.length + q.length - 1 }, () => R(0));
  p.forEach((a, i) => q.forEach((b, j) => { o[i + j] = radd(o[i + j], rmul(a, b)); }));
  return o;
};
export function asPoly(n) {
  switch (n.t) {
    case 'num': return [n.v];
    case 'x': return [R(0), R(1)];
    case 'neg': { const p = asPoly(n.a); return p && p.map(rneg); }
    case 'add': {
      let p = [R(0)];
      for (const c of n.a) { const q = asPoly(c); if (!q) return null; p = padd(p, q); }
      return p;
    }
    case 'mul': {
      let p = [R(1)];
      for (const c of n.a) { const q = asPoly(c); if (!q) return null; p = pmul(p, q); if (p.length > 9) return null; }
      return p;
    }
    case 'div': {
      if (n.d.t !== 'num' || n.d.v.n === 0) return null;
      const p = asPoly(n.n);
      return p && p.map((c) => rmul(c, R(n.d.v.d, n.d.v.n)));
    }
    case 'pow': {
      if (!isInt(n.e) || n.e.v.n < 0 || n.e.v.n > 6) return null;
      const b = asPoly(n.b);
      if (!b) return null;
      let p = [R(1)];
      for (let i = 0; i < n.e.v.n; i++) { p = pmul(p, b); if (p.length > 9) return null; }
      return p;
    }
    default: return null;
  }
}
// Roznásobí výraz, je-li to mnohočlen (nejvýše 4. stupně), jinak ho vrátí beze změny.
export function expandPoly(n) {
  const p = asPoly(n);
  if (!p) return n;
  let deg = p.length - 1;
  while (deg > 0 && p[deg].n === 0) deg--;
  if (deg > 4) return n;
  const terms = [];
  for (let k = deg; k >= 0; k--) {
    if (p[k].n === 0) continue;
    const acc = newAcc();
    acc.c = p[k];
    if (k) acc.m.set('x', { base: X, k: R(k) });
    terms.push(build(acc));
  }
  if (!terms.length) return num(0);
  return terms.length === 1 ? terms[0] : add(...terms);
}
