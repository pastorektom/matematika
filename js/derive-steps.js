// Obecná derivace libovolné funkce f(x) s postupem krok za krokem na tabuli (stránka Vlastní příklad).
// deriveWithSteps(text) -> { fTex, answerTex, answerExpr, steps }; při chybě vyhodí Error s českou hláškou.
// Pravidla: konstanta, x, součet/rozdíl, konstantní násobek, součin (i více činitelů), podíl,
// složená funkce (vnější × vnitřní) pro mocninu, a^u, e^u, sin, cos, tg, cotg, ln, log_a, √, arcsin,
// arccos, arctg, arccotg. Čistý modul: jen math.js z checker-core a derive-expr.
import { parse, normalize } from './checker-core.js';
import {
  DeriveError, fail, R, num, numR, X, cst, add, mul, div, pow, neg, fn, der, sub,
  dep, size, simp, tex, str, expandPoly,
} from './derive-expr.js';

const MAX_NODES = 40;
const MAX_LEN = 200;
const LIM = 28;
const TERMS_MAX = 12;

// ---------- čtení vstupu ----------
const ALIASES = [
  [/\barccotg\b/g, 'acot'], [/\barcctg\b/g, 'acot'], [/\barccot\b/g, 'acot'], [/\barctg\b/g, 'atan'], [/\barctan\b/g, 'atan'],
  [/\barcsin\b/g, 'asin'], [/\barccos\b/g, 'acos'], [/\bcotg\b/g, 'cot'], [/\bctg\b/g, 'cot'], [/\btg\b/g, 'tan'],
];
const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'exp', 'log', 'sqrt', 'cbrt', 'asin', 'acos', 'atan', 'acot']);
const READ_MSG = 'Výraz se nepodařilo přečíst. Zkontroluj závorky a násobení (např. x^2*sin(x) nebo 2x).';

function prepare(input) {
  if (typeof input !== 'string') fail('Zadej funkci f(x), například x^2*sin(x).');
  let s = normalize(input);
  if (!s) fail('Zadej funkci f(x), například x^2*sin(x).');
  if (s.length > MAX_LEN) fail('Zápis je příliš dlouhý. Zadej kratší funkci.');
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  return s;
}

function numberNode(n) {
  const text = String(n.value);
  if (/e/i.test(text)) fail('Používej obyčejná čísla (bez zápisu 1e3).');
  if (!text.includes('.')) return numR(R(Number(text)));
  const [i, f] = text.split('.');
  return { ...numR(R(Number(i + f), 10 ** f.length)), src: text };
}

function fromMath(n) {
  switch (n.type) {
    case 'ParenthesisNode': return fromMath(n.content);
    case 'ConstantNode':
      if (typeof n.value !== 'number') fail(READ_MSG);
      return numberNode(n);
    case 'SymbolNode':
      if (n.name === 'x') return X;
      if (n.name === 'pi') return cst('pi');
      if (n.name === 'e') return cst('e');
      if (FUNCS.has(n.name) || ['tg', 'cotg', 'ln'].includes(n.name)) fail(`Za funkci „${n.name}“ patří závorka s argumentem, například ${n.name}(x).`);
      return fail(`Používej jen proměnnou x (nalezeno „${n.name}“). Konstanty: π a e.`);
    case 'OperatorNode': {
      const a = n.args.map(fromMath);
      switch (n.fn) {
        case 'add': return add(...a.flatMap((c) => (c.t === 'add' ? c.a : [c])));
        case 'subtract': return add(...(a[0].t === 'add' ? a[0].a : [a[0]]), neg(a[1]));
        case 'multiply': return { t: 'mul', a, imp: !!n.implicit };
        case 'divide': return div(a[0], a[1]);
        case 'unaryMinus': return neg(a[0]);
        case 'unaryPlus': return a[0];
        case 'pow': return makePow(a[0], a[1]);
        default: return fail('Tuhle operaci neumím derivovat. Povolené jsou + − * / ^ a funkce.');
      }
    }
    case 'FunctionNode': {
      const name = n.fn?.name;
      const a = n.args.map(fromMath);
      if (name === 'x' && a.length === 1) return { t: 'mul', a: [X, a[0]], imp: true };
      if (!FUNCS.has(name)) fail(`Funkci „${name ?? '?'}“ zatím neumím derivovat. Umím sin, cos, tg, cotg, ln, log, e^, √, arcsin, arccos, arctg, arccotg.`);
      if (name === 'log') {
        if (a.length === 2) {
          if (dep(a[1])) fail('Základ logaritmu musí být číslo, ne výraz s x.');
          return fn('log', a[0], a[1]);
        }
        if (a.length === 1) return fn('ln', a[0]);
        return fail('Logaritmus zadej jako ln(x) nebo log(x; základ).');
      }
      if (a.length !== 1) fail(`Funkce ${name} má jen jeden argument.`);
      if (name === 'exp') return fn('exp', a[0]);
      if (name === 'cbrt') return pow(a[0], num(1, 3));
      return fn(name, a[0]);
    }
    default: return fail(READ_MSG);
  }
}

function makePow(b, e) {
  if (!dep(e)) return pow(b, e);
  if (dep(b)) fail('Výraz typu u(x)^v(x) zatím neumím – použij logaritmickou derivaci.');
  if (b.t === 'cst' && b.name === 'e') return fn('exp', e);
  const v = b.t === 'num' ? b.v : b.t === 'neg' && b.a.t === 'num' ? { n: -b.a.v.n } : null;
  if (v && v.n <= 0) fail('Základ mocniny a^x musí být kladné číslo.');
  return pow(b, e);
}

// Konstantní činitele dopředu: 2·x·sin x = 2·(x·sin x); činitelé s x se skládají zleva.
function regroup(n) {
  switch (n.t) {
    case 'add': return { ...n, a: n.a.map(regroup) };
    case 'neg': return neg(regroup(n.a));
    case 'div': return div(regroup(n.n), regroup(n.d));
    case 'pow': return pow(regroup(n.b), regroup(n.e));
    case 'fn': return n.base ? fn(n.f, regroup(n.a), regroup(n.base)) : fn(n.f, regroup(n.a));
    case 'mul': {
      const fs = [];
      const walk = (x) => { if (x.t === 'mul') x.a.forEach(walk); else fs.push(regroup(x)); };
      walk(n);
      const imp = !!n.imp;
      const fold = (l) => l.reduce((p, c) => ({ t: 'mul', a: [p, c], imp }));
      const cs = fs.filter((f) => !dep(f));
      const ds = fs.filter(dep);
      if (!ds.length) return fold(fs);
      return cs.length ? { t: 'mul', a: [fold(cs), fold(ds)], imp } : fold(ds);
    }
    default: return n;
  }
}

// ---------- základní funkce a složená funkce ----------
const U = '§';
const sw = (s, w) => s.split(U).join(w);
const FN_NAME = {
  sin: 'sinus', cos: 'kosinus', tan: 'tangens', cot: 'kotangens', exp: 'exponenciální funkce', ln: 'přirozený logaritmus',
  log: 'logaritmus', sqrt: 'odmocnina', asin: 'arkus sinus', acos: 'arkus kosinus', atan: 'arkus tangens', acot: 'arkus kotangens',
};
const one = num(1);
const two = num(2);
const rootExpr = (w) => fn('sqrt', sub(one, pow(w, two)));
const OUTER = {
  sin: () => ({ fT: `\\sin ${U}`, fpT: `\\cos ${U}`, fp: (w) => fn('cos', w) }),
  cos: () => ({ fT: `\\cos ${U}`, fpT: `-\\sin ${U}`, fp: (w) => neg(fn('sin', w)) }),
  tan: () => ({ fT: `\\operatorname{tg}${U}`, fpT: `\\frac{1}{\\cos^{2}${U}}`, fp: (w) => div(one, pow(fn('cos', w), two)) }),
  cot: () => ({ fT: `\\operatorname{cotg}${U}`, fpT: `-\\frac{1}{\\sin^{2}${U}}`, fp: (w) => neg(div(one, pow(fn('sin', w), two))) }),
  exp: () => ({ fT: `e^{${U}}`, fpT: `e^{${U}}`, fp: (w) => fn('exp', w) }),
  ln: () => ({ fT: `\\ln ${U}`, fpT: `\\frac{1}{${U}}`, fp: (w) => div(one, w) }),
  sqrt: () => ({ fT: `\\sqrt{${U}}`, fpT: `\\frac{1}{2\\sqrt{${U}}}`, fp: (w) => div(one, mul(two, fn('sqrt', w))) }),
  asin: () => ({ fT: `\\arcsin ${U}`, fpT: `\\frac{1}{\\sqrt{1-${U}^{2}}}`, fp: (w) => div(one, rootExpr(w)) }),
  acos: () => ({ fT: `\\arccos ${U}`, fpT: `-\\frac{1}{\\sqrt{1-${U}^{2}}}`, fp: (w) => neg(div(one, rootExpr(w))) }),
  atan: () => ({ fT: `\\operatorname{arctg}${U}`, fpT: `\\frac{1}{1+${U}^{2}}`, fp: (w) => div(one, add(one, pow(w, two))) }),
  acot: () => ({ fT: `\\operatorname{arccotg}${U}`, fpT: `-\\frac{1}{1+${U}^{2}}`, fp: (w) => neg(div(one, add(one, pow(w, two)))) }),
};
// Vnější funkce uzlu: { u (vnitřní), name, fT, fpT (s § na místě vnitřní), fp(w) } nebo null.
function outer(n) {
  if (n.t === 'fn') {
    if (n.f === 'log') {
      const a = tex(n.base);
      return { u: n.a, name: FN_NAME.log, fT: `\\log_{${a}}${U}`, fpT: `\\frac{1}{${U}\\ln ${a}}`, fp: (w) => div(one, mul(w, fn('ln', n.base))) };
    }
    return { u: n.a, name: FN_NAME[n.f], ...OUTER[n.f]() };
  }
  if (n.t === 'pow' && !dep(n.e)) {
    const e = tex(n.e);
    const ep = e.length > 3 || n.e.t !== 'num' ? `\\left(${e}\\right)` : e;
    return { u: n.b, name: 'mocnina', fT: `${U}^{${e}}`, fpT: `${ep}\\cdot ${U}^{${e}-1}`, fp: (w) => mul(n.e, pow(w, add(n.e, neg(one)))) };
  }
  if (n.t === 'pow') {
    const a = tex(n.b); const ap = n.b.t === 'num' && n.b.v.d === 1 ? a : `\\left(${a}\\right)`;
    return { u: n.e, name: 'exponenciální funkce', fT: `${ap}^{${U}}`, fpT: `${ap}^{${U}}\\cdot\\ln ${ap}`, fp: (w) => mul(pow(n.b, w), fn('ln', n.b)) };
  }
  return null;
}

// ---------- rozbor uzlu: jaké pravidlo je nejvyšší ----------
function an(n) {
  if (n.t === 'add') {
    const items = n.a;
    return { kind: 'soucet', parts: items.map((it) => (it.t === 'neg' ? it.a : it)), build: (ds) => add(...ds.map((d, i) => (items[i].t === 'neg' ? neg(d) : d))) };
  }
  if (n.t === 'neg') return { kind: 'konstmul', parts: [n.a], build: (ds) => neg(ds[0]), form: 'neg' };
  if (n.t === 'mul') {
    const [p, q] = n.a;
    if (!dep(p)) return { kind: 'konstmul', k: p, parts: [q], build: (ds) => mul(p, ds[0]), form: 'mul' };
    return {
      kind: 'soucin', u: p, v: q, parts: [p, q],
      build: (ds) => add(mul(ds[0], q), mul(p, ds[1])),
      numer: (ds) => add(mul(ds[0], q), mul(p, ds[1])),
    };
  }
  if (n.t === 'div') {
    if (!dep(n.d)) return { kind: 'konstmul', k: n.d, parts: [n.n], build: (ds) => div(ds[0], n.d), form: 'div' };
    const numer = (ds) => add(mul(ds[0], n.d), neg(mul(n.n, ds[1])));
    return { kind: 'podil', u: n.n, v: n.d, parts: [n.n, n.d], numer, build: (ds) => div(numer(ds), pow(n.d, two)) };
  }
  const o = outer(n);
  if (o) return { kind: 'slozena', o, u: o.u, parts: [o.u], build: (ds) => mul(o.fp(o.u), ds[0]) };
  return fail('Tenhle tvar funkce zatím neumím zderivovat.');
}
function kindOf(n) {
  if (!dep(n)) return 'konst';
  if (n.t === 'x') return 'x';
  const o = (n.t === 'fn' || n.t === 'pow') ? outer(n) : null;
  if (o && o.u.t === 'x') return 'elem';
  return an(n).kind;
}
const KIND_NAME = {
  konst: 'konstanta', x: 'proměnná $x$', elem: 'základní funkce', konstmul: 'konstantní násobek', soucet: 'součet',
  soucin: 'součin', podil: 'podíl', slozena: 'složená funkce',
};

// ---------- rozdělení na součet členů ----------
// Roznásobení součinů přes součty (nejvýše TERMS_MAX členů), aby šly sloučit stejné činitele.
function expandRaw(n) {
  switch (n.t) {
    case 'add': return n.a.flatMap(expandRaw);
    case 'neg': return expandRaw(n.a).map((t) => ({ ...t, s: -t.s }));
    case 'mul': {
      const lists = n.a.map(expandRaw);
      const total = lists.reduce((p, l) => p * l.length, 1);
      if (total > 8) return [{ s: 1, f: [n] }];
      let acc = [{ s: 1, f: [] }];
      for (const l of lists) acc = acc.flatMap((x) => l.map((y) => ({ s: x.s * y.s, f: [...x.f, ...y.f] })));
      return acc;
    }
    default: return [{ s: 1, f: [n] }];
  }
}
function expandSum(raw) {
  const ts = expandRaw(raw);
  if (ts.length > TERMS_MAX) return simp(raw);
  const nodes = ts.map((t) => { const b = t.f.length === 1 ? t.f[0] : mul(...t.f); return t.s < 0 ? neg(b) : b; });
  return simp(add(...nodes));
}
// Výsledek pravidla z výsledků derivací částí (ds).
function resOf(a, ds) {
  if (a.kind === 'soucin') return expandPoly(expandSum(a.build(ds)));
  if (a.kind === 'podil') {
    const nu = expandPoly(expandSum(a.numer(ds)));
    return simp(div(nu, pow(a.v, two)));
  }
  return simp(a.build(ds));
}

// ---------- stručný postup (vnořené derivace) ----------
const T = (n, o) => tex(n, o);
const prime = (n) => T(der(n));
const dedupe = (ls) => ls.filter((l, i) => i === 0 || l !== ls[i - 1]);
function cd(n) {
  const k = kindOf(n);
  if (k === 'konst') return { lines: [`${prime(n)}=0`], res: num(0) };
  if (k === 'x') return { lines: ["\\left(x\\right)'=1"], res: num(1) };
  if (k === 'elem') {
    const o = outer(n);
    const res = simp(o.fp(X));
    return { lines: [`${prime(n)}=${T(res)}`], res };
  }
  const a = an(n);
  const subs = a.parts.map(cd);
  const ds = subs.map((s) => s.res);
  const res = resOf(a, ds);
  const inner = subs.filter((s) => s.compound).flatMap((s) => s.lines);
  const lines = dedupe([`${prime(n)}=${T(a.build(a.parts.map(der)))}`, ...inner, `=${T(a.build(ds))}`, `=${T(res)}`]);
  return { lines, res, compound: true };
}

// ---------- tabule: řádky, poznámky, zalamování ----------
const COLORS = { u: 'accent', du: 'accent', v: 'warn', dv: 'warn', g: 'accent', k: 'warn' };
const cls = (name, t) => `\\htmlClass{bt-${name}}{${t}}`;
const classesIn = (t) => [...new Set([...t.matchAll(/bt-([a-z0-9-]+)/g)].map((m) => m[1]))];
const L = (t, extra) => {
  const names = classesIn(t).filter((c) => c !== 'vysledek' && COLORS[c] && !(extra || []).some((x) => x.target === `bt-${c}`));
  const notes = [...names.map((c) => ({ kind: 'color', target: `bt-${c}`, color: COLORS[c] })), ...(extra || [])];
  return notes.length ? { tex: t, notes } : { tex: t };
};
export const texWidth = (t) => String(t)
  .replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '')
  .replace(/\\(?:left|right|big|Bigl|Bigr|text|operatorname)/g, '')
  .replace(/\\[,;:! ]/g, '')
  .replace(/\\[a-zA-Z]+/g, 'X')
  .replace(/[{}\s]/g, '').length;

function breakPoints(t, types) {
  const out = [];
  let d = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\') {
      if (d === 0 && types.includes('dot') && t.startsWith('\\cdot', i) && i > 0) out.push(i);
      i += 1;
      while (/[a-zA-Z]/.test(t[i + 1] || '')) i++;
      continue;
    }
    if ('{(['.includes(c)) d++;
    else if ('})]'.includes(c)) d--;
    else if (d === 0 && i > 0) {
      if (c === '=' && types.includes('eq')) out.push(i);
      else if ((c === '+' || c === '-') && types.includes('add') && /[0-9a-zA-Z)}']$/.test(t.slice(0, i))) out.push(i);
    }
  }
  return out;
}
function pack(t, cuts, lim) {
  const parts = [];
  let start = 0; let last = -1;
  for (const c of cuts) {
    if (texWidth(t.slice(start, c)) > lim && last > start) { parts.push(t.slice(start, last)); start = last; }
    last = c;
  }
  if (texWidth(t.slice(start)) > lim && last > start) { parts.push(t.slice(start, last)); start = last; }
  parts.push(t.slice(start));
  return parts;
}
function braced(s, i) {
  if (s[i] !== '{') return null;
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') d++;
    else if (s[j] === '}' && --d === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}
function fracTail(t) {
  const m = /\\frac(?=\{)/.exec(t);
  if (!m) return null;
  const a = braced(t, m.index + 5);
  const b = a && braced(t, a.end);
  if (!b || b.end !== t.length) return null;
  return { pre: t.slice(0, m.index), N: a.body, D: b.body };
}
function splitTex(t, lim = LIM) {
  if (texWidth(t) <= lim) return [t];
  for (const types of [['eq'], ['add'], ['dot']]) {
    const cuts = breakPoints(t, types);
    if (!cuts.length) continue;
    const parts = pack(t, cuts, lim);
    if (parts.length < 2) continue;
    const out = parts.flatMap((p, i) => {
      const sub = splitTex(p, lim);
      return sub.map((q, j) => (j === 0 && i > 0 && !q.startsWith('=') ? `\\quad{}${q}` : q));
    });
    return out;
  }
  const f = fracTail(t);
  if (f) {
    return [
      `${f.pre}\\frac{\\text{čitatel}}{\\text{jmenovatel}}`,
      ...splitTex(`\\text{čitatel: }${f.N}`, lim),
      ...splitTex(`\\text{jmenovatel: }${f.D}`, lim),
    ];
  }
  return [t];
}
function fitLines(lines) {
  return lines.flatMap((l) => {
    if ((l.notes || []).some((n) => n.kind === 'doubleUnderline')) return [l];
    const parts = splitTex(l.tex);
    if (parts.length === 1) return [l];
    const have = (p) => classesIn(p).map((c) => `bt-${c}`);
    return parts.map((p) => {
      const notes = (l.notes || []).filter((n) => have(p).includes(n.target));
      return notes.length ? { tex: p, notes } : { tex: p };
    });
  });
}
const DOUBLE = [{ kind: 'doubleUnderline', target: 'bt-vysledek' }];
// Poslední řádek s výsledkem (dvojité podtržení); dlouhý součet se rozdělí na více řádků.
function resultLines(prefix, r) {
  const mark = (t) => cls('vysledek', t);
  const line = (t) => ({ tex: t, notes: DOUBLE });
  if (texWidth(prefix) + texWidth(r) <= LIM + 2) return [line(`${prefix}${mark(r)}`)];
  const cuts = breakPoints(r, ['add']);
  if (cuts.length) {
    const parts = pack(r, cuts, LIM - texWidth(prefix));
    if (parts.length > 1) return parts.map((p, i) => line(i ? `{}${mark(p)}` : `${prefix}${mark(p)}`));
  }
  return [{ tex: prefix }, line(`\\quad{}${mark(r)}`)];
}

// ---------- kroky ----------
const brace = (name, label, position) => ({ kind: 'brace', target: `bt-${name}`, label, ...(position ? { position } : {}) });
const prefixed = (pre, lines) => lines.map((l, i) => (i === 0 ? `${pre}${l}` : l));
const isTopF = (n, f) => n === f;

function ruleText(n) {
  const k = kindOf(n);
  switch (k) {
    case 'konst': return 'derivace konstanty je nula';
    case 'x': return "vzorec $(x)'=1$";
    case 'elem': { const o = outer(n); return `vzorec $(${sw(o.fT, 'x')})'=${sw(o.fpT, 'x')}$`; }
    case 'konstmul': return 'konstantu opíšeme a zderivujeme zbytek';
    case 'soucet': return 'derivace součtu člen po členu';
    case 'soucin': return 'pravidlo pro součin';
    case 'podil': return 'pravidlo pro podíl';
    default: { const o = outer(n); return `pravidlo pro složenou funkci (vnější funkce $${sw(o.fT, 'u')}$)`; }
  }
}

function rozbor(f, terms) {
  const marks = new Map();
  const notes = [];
  let text;
  const k = terms ? 'soucet' : kindOf(f);
  if (terms) {
    terms.forEach((t, i) => {
      if (i < 5) { marks.set(t.node, `t${i + 1}`); notes.push(brace(`t${i + 1}`, String(i + 1), i % 2 ? 'below' : 'above')); }
    });
    text = `Nejvyšší (naposled provedená) operace je sčítání nebo odčítání: funkce je součet ${terms.length} členů. Podle pravidla $(u\\pm v)'=u'\\pm v'$ zderivujeme každý člen zvlášť a výsledky pak sečteme. ${terms.map((t, i) => `Člen ${i + 1}: ${KIND_NAME[kindOf(t.node)]}.`).join(' ')}`;
  } else if (k === 'soucin') {
    const a = an(f);
    marks.set(a.u, 'u'); marks.set(a.v, 'v');
    notes.push(brace('u', 'u'), brace('v', 'v', 'below'));
    text = `Nejvyšší operace je součin: $u=${T(a.u)}$ a $v=${T(a.v)}$ (obě části obsahují $x$). Použijeme pravidlo $(u\\cdot v)'=u'\\cdot v+u\\cdot v'$.${kindOf(a.u) === 'soucin' ? ' Součin víc činitelů zderivujeme po částech: všechny činitele kromě posledního bereme jako jedno $u$ a jeho derivaci pak rozepíšeme stejným pravidlem.' : ''}`;
  } else if (k === 'podil') {
    const a = an(f);
    marks.set(a.u, 'u'); marks.set(a.v, 'v');
    notes.push(brace('u', 'u'), brace('v', 'v', 'below'));
    text = `Nejvyšší operace je podíl a ve jmenovateli je $x$: čitatel $u=${T(a.u)}$, jmenovatel $v=${T(a.v)}$. Použijeme pravidlo $\\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^{2}}$.`;
  } else if (k === 'slozena') {
    const a = an(f);
    marks.set(a.u, 'u');
    notes.push(brace('u', 'u', 'below'));
    text = `Nejvyšší operace je složená funkce: vnější funkce je ${a.o.name} $${sw(a.o.fT, 'u')}$, vnitřní funkce je $u=${T(a.u)}$. Použijeme pravidlo $\\left[f(u)\\right]'=f'(u)\\cdot u'$.`;
  } else if (k === 'konstmul') {
    const a = an(f);
    marks.set(a.parts[0], 'g'); notes.push(brace('g', 'g', 'below'));
    if (a.k) { marks.set(a.k, 'k'); notes.push(brace('k', 'k')); }
    text = a.form === 'neg'
      ? `Funkce je tvaru $-g(x)$, tedy konstantní násobek (−1). Konstantu opíšeme a zderivujeme zbytek: $(c\\cdot g)'=c\\cdot g'$. Část $g=${T(a.parts[0])}$ je ${KIND_NAME[kindOf(a.parts[0])]}.`
      : `Funkce je konstantní násobek: konstantu $${T(a.k)}$ opíšeme a zderivujeme zbytek $g=${T(a.parts[0])}$ (${KIND_NAME[kindOf(a.parts[0])]}). Pravidlo: $(c\\cdot g)'=c\\cdot g'$.`;
  } else if (k === 'konst') {
    text = 'Funkce neobsahuje proměnnou $x$, je to konstanta. Její derivace je nula.';
  } else if (k === 'x') {
    text = 'Funkce je jen proměnná $x$. Její derivace je $(x)\'=1$.';
  } else {
    const o = outer(f);
    text = `Funkce je základní: ${o.name} z $x$. Derivujeme ji přímo podle vzorce $(${sw(o.fT, 'x')})'=${sw(o.fpT, 'x')}$.`;
  }
  const board = [L(`f(x)=${T(f, { marks })}`, notes)];
  return { title: 'Rozbor funkce', text, board };
}

// Kroky pro jeden člen; vrací { steps, res, disp } (disp = zápis výsledku před úpravou při násobení konstantou).
function termSteps(n, f, pfx) {
  const k = kindOf(n);
  const top = isTopF(n, f);
  const lhs = top ? "f'(x)" : null;
  const t = (name) => `${pfx}${name}`;
  const P = T(n);
  if (k === 'konst') {
    return { steps: [{ title: t('Derivace konstanty'), text: `Výraz $${P}$ neobsahuje $x$, je to konstanta, a derivace konstanty je nula: $(c)'=0$.`, board: [L(`${prime(n)}=0`)] }], res: num(0) };
  }
  if (k === 'x') {
    return { steps: [{ title: t('Derivace proměnné x'), text: 'Derivace samotného $x$ je jedna: $(x)\'=1$.', board: [L("\\left(x\\right)'=1")] }], res: num(1) };
  }
  if (k === 'elem') {
    const o = outer(n);
    const res = simp(o.fp(X));
    const raw = T(o.fp(X));
    const lines = dedupe([`${prime(n)}=${raw}`, `=${T(res)}`]);
    return {
      steps: [{
        title: t(`Derivace: ${o.name}`),
        text: `Jde o ${o.name} přímo z $x$ (vnitřní funkce je jen $x$), proto stačí vzorec $(${sw(o.fT, 'x')})'=${sw(o.fpT, 'x')}$. Dosadíme a upravíme.`,
        board: lines.map((l) => L(l)),
      }],
      res,
    };
  }
  const a = an(n);
  if (k === 'konstmul') {
    const g = termSteps(a.parts[0], f, pfx);
    const gp = a.build([der(a.parts[0])]);
    const step = {
      title: t('Konstantní násobek'),
      text: 'Konstantu před funkcí (nebo konstantní jmenovatel, nebo znaménko mínus) při derivování opíšeme a zderivujeme jen zbylou část: $(c\\cdot g)\'=c\\cdot g\'$.',
      board: [L(`${prime(n)}=${T(gp)}`)],
    };
    const res = resOf(a, [g.res]);
    return { steps: [step, ...g.steps], res, disp: a.build([g.res]) };
  }
  if (k === 'soucet') {
    const c = cd(n);
    return {
      steps: [{ title: t('Derivace součtu'), text: 'Součet (rozdíl) derivujeme člen po členu: $(u\\pm v)\'=u\'\\pm v\'$.', board: c.lines.map((l) => L(l)) }],
      res: c.res,
    };
  }
  if (k === 'soucin' || k === 'podil') {
    const prod = k === 'soucin';
    const sub = a.parts.map(cd);
    const ds = sub.map((s) => s.res);
    const res = resOf(a, ds);
    const lines = [];
    const U1 = cls('u', T(a.u)); const V1 = cls('v', T(a.v));
    const uCompound = prod && kindOf(a.u) === 'soucin';
    const fl = `${lhs ? `${lhs}=` : ''}${prime(n)}=${T(a.build(a.parts.map(der)))}`;
    if (uCompound) lines.push(L(fl));
    else {
      lines.push(L(`u=${U1}`), L(`v=${V1}`));
    }
    prefixed("u'=", sub[0].lines).forEach((l) => lines.push(L(l)));
    prefixed("v'=", sub[1].lines).forEach((l) => lines.push(L(l)));
    lines.push(L(prod ? "\\left(u\\cdot v\\right)'=u'\\cdot v+u\\cdot v'" : "\\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^{2}}"));
    const marks = new Map();
    const md = ds.map((d, i) => { const c = { ...d }; marks.set(c, i ? 'dv' : 'du'); return c; });
    lines.push(L(`=${T(a.build(md), { marks })}`));
    lines.push(L(`=${T(res)}`));
    const text = prod
      ? `Součin dvou částí: $u=${T(a.u)}$, $v=${T(a.v)}$. Pravidlo: $(u\\cdot v)'=u'\\cdot v+u\\cdot v'$. Derivaci $u'$ najdeme takto: ${ruleText(a.u)}; derivaci $v'$ takto: ${ruleText(a.v)}. Potom vše dosadíme${uCompound ? ' (derivace $u$ je sama součin, proto se rozepisuje znovu pravidlem pro součin)' : ''} a upravíme.`
      : `Podíl: čitatel $u=${T(a.u)}$, jmenovatel $v=${T(a.v)}$. Pravidlo: $\\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^{2}}$. Derivaci $u'$ najdeme takto: ${ruleText(a.u)}; derivaci $v'$ takto: ${ruleText(a.v)}. Potom dosadíme do pravidla a čitatele upravíme (roznásobíme, sloučíme).`;
    return { steps: [{ title: t(prod ? 'Pravidlo pro součin' : 'Pravidlo pro podíl'), text, board: dedupe2(lines) }], res };
  }
  // složená funkce
  const o = a.o;
  const inner = cd(a.u);
  const res = resOf(a, [inner.res]);
  const lines = [
    L(`\\text{vnější: }f(u)=${sw(o.fT, 'u')}`),
    L(`\\text{vnitřní: }u=${cls('u', T(a.u))}`),
    L(`f'(u)=${sw(o.fpT, 'u')}`),
  ];
  prefixed("u'=", inner.lines).forEach((l) => lines.push(L(l)));
  lines.push(L("\\left[f(u)\\right]'=f'(u)\\cdot u'"));
  lines.push(L(`${lhs ? `${lhs}=` : `${prime(n)}=`}${T(a.build([inner.res]))}`));
  lines.push(L(`=${T(res)}`));
  return {
    steps: [{
      title: t(`Složená funkce: ${o.name}`),
      text: `Složená funkce: vnější funkce je ${o.name} $f(u)=${sw(o.fT, 'u')}$, vnitřní funkce je $u=${T(a.u)}$. Pravidlo: $\\left[f(u)\\right]'=f'(u)\\cdot u'$, tedy derivace vnější funkce (s dosazeným $u$) krát derivace vnitřní funkce. Vnější derivace je $f'(u)=${sw(o.fpT, 'u')}$; $u'$ najdeme takto: ${ruleText(a.u)}.`,
      board: dedupe2(lines),
    }],
    res,
  };
}
const dedupe2 = (lines) => lines.filter((l, i) => i === 0 || l.tex !== lines[i - 1].tex);

function derive(input) {
  const s = prepare(input);
  let node;
  try { node = parse(s); } catch { fail(READ_MSG); }
  const f = regroup(fromMath(node));
  if (size(f) > MAX_NODES) fail('Funkce je příliš dlouhá nebo složitá (nejvýše asi 40 částí). Zkus ji zkrátit.');
  const terms = f.t === 'add' ? f.a.map((it) => (it.t === 'neg' ? { s: -1, node: it.a } : { s: 1, node: it })) : null;
  const steps = [rozbor(f, terms)];
  let final; let raw;
  if (terms) {
    const parts = terms.map((t, i) => termSteps(t.node, f, `${i + 1}. člen: `));
    parts.forEach((p) => steps.push(...p.steps));
    const items = parts.map((p, i) => (terms[i].s < 0 ? neg(p.disp || p.res) : (p.disp || p.res)));
    raw = add(...items);
    final = simp(raw);
  } else {
    const p = termSteps(f, f, '');
    steps.push(...p.steps);
    raw = p.disp || p.res;
    final = p.res;
  }
  const rawTex = T(raw);
  const finTex = T(final);
  const board = [];
  if (rawTex !== finTex) {
    const lines = fitLines([L(`f'(x)=${rawTex}`)]);
    board.push(...lines);
    board.push(...resultLines('=', finTex));
  } else board.push(...resultLines("f'(x)=", finTex));
  steps.push({
    title: 'Výsledek',
    text: terms
      ? 'Derivace součtu je součet derivací jednotlivých členů. Sečteme je a výraz lehce upravíme (sloučíme stejné členy, vynecháme násobení jedničkou).'
      : 'Dosadíme do pravidla a výraz lehce upravíme (vynecháme násobení jedničkou a sčítání nuly, sloučíme čísla).',
    board,
  });
  // zalamování dlouhých řádků ve všech krocích kromě výsledku
  steps.forEach((st, i) => { if (i < steps.length - 1) st.board = fitLines(st.board); });
  return { fTex: T(f), answerTex: finTex, answerExpr: str(final), steps };
}

export function deriveWithSteps(input) {
  try {
    return derive(input);
  } catch (e) {
    if (e instanceof DeriveError) throw new Error(e.message);
    throw new Error('Tuhle funkci se nepodařilo zderivovat. Zkontroluj zápis nebo zkus jednodušší tvar.');
  }
}

// Náhled zadané funkce v TeXu (živý náhled pod polem); při chybě zápisu null.
export function previewTex(input) {
  try {
    const s = prepare(input);
    return T(regroup(fromMath(parse(s))));
  } catch { return null; }
}
