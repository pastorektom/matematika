// Průběh funkce (téma Derivace): rodiny funkcí s „hezkými“ význačnými body a z nich
// typy monotonie, extrémy, konvexnost, asymptoty a celý průběh funkce.
//
// Rodina = data { fam, …parametry } -> analýza { fTex, fStr, f/d1/d2 (čísla), definiční obor,
// parita, průsečíky, limity, řádky derivací, nulové body f′ a f″, asymptoty }.
// Znaménka f′ a f″ mezi význačnými body se určí dosazením (funkce jsou na intervalech spojité),
// z nich vzniknou tabulky znamének, intervaly a extrémy obecným kódem.
import { fracLines, minusTex, texWidth, LIM } from './derivace-fit.js';
import {
  fr, sub, mul, isZero, toNum, frTex, frStr, sumOf, sumTex, dSum, sumAt, sumNum, termTex,
  xMinus, eTex, lineTex,
} from './derivace-lib.js';

const TOPIC = 'derivace';
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const resultLine = (pre, tex, post = '') => ({ tex: `${pre}${cls('vysledek', tex)}${post}`, notes: [{ kind: 'doubleUnderline', target: 'bt-vysledek' }] });
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const T = (c, p = 0, more = {}) => ({ c, ...(p ? { p } : {}), ...more });
const S = (arr) => sumOf(arr);

// ---------- body na ose ----------
// pt = { v: číslo, tex, str (math.js / kontrola), txt (popisek v tabulce) }
const ptFr = (f) => ({ v: toNum(f), tex: frTex(f), str: frStr(f), txt: frStr(f).replace('-', '−') });
const ptInt = (n) => ptFr(fr(n));
function ptSqrt3(k) { // k·√3
  const a = Math.abs(k); const s = k < 0 ? '-' : '';
  return { v: k * Math.sqrt(3), tex: `${s}${a === 1 ? '' : a}\\sqrt{3}`, str: `${k}*sqrt(3)`, txt: `${s ? '−' : ''}${a === 1 ? '' : a}√3` };
}
function ptSqrt(n) { // √n, n > 0 celé
  const r = Math.round(Math.sqrt(n));
  if (r * r === n) return ptInt(r);
  return { v: Math.sqrt(n), tex: `\\sqrt{${n}}`, str: `sqrt(${n})`, txt: `√${n}` };
}
const negPt = (p) => ({ v: -p.v, tex: `-${p.tex}`, str: `-(${p.str})`, txt: `−${p.txt}` });
// hodnota a·√3/b
function valSqrt3(f) {
  const a = Math.abs(f.n); const s = f.n < 0 ? '-' : '';
  const top = `${a === 1 ? '' : a}\\sqrt{3}`;
  return { v: toNum(f) * Math.sqrt(3), tex: f.d === 1 ? `${s}${top}` : `${s}\\frac{${top}}{${f.d}}` };
}
// hodnota c·e^n
function valExp(c, n) {
  const e = n === 0 ? '' : n === 1 ? 'e' : `e^{${n}}`;
  const a = Math.abs(c); const s = c < 0 ? '-' : '';
  return { v: c * Math.exp(n), tex: e ? `${s}${a === 1 ? '' : a}${e}` : String(c) };
}
const valFr = (f) => ({ v: toNum(f), tex: frTex(f) });
const ivTex = (a, b) => `(${a ? a.tex : '-\\infty'};\\ ${b ? b.tex : '\\infty'})`;
const ivStr = (a, b) => `(${a ? a.str : '-∞'}; ${b ? b.str : '∞'})`;
const pw2 = (base, n) => (base === 'x' ? `x^{${n}}` : `(${base})^{${n}}`);
const coefTex = (k) => (k === 1 ? '' : k === -1 ? '-' : String(k));
const parenNeg = (k) => (k < 0 ? `(${k})` : String(k));

// ---------- rodiny ----------
function polyFamily(data, f, fFact, zeros, d1Fact, crit, d2Fact, crit2) {
  const d1 = dSum(f); const d2 = dSum(d1);
  const fneg = f.map((t) => (t.p.n % 2 ? { ...t, c: fr(-t.c.n, t.c.d) } : t));
  const lead = f[0]; const deg = lead.p.n; const sgnL = lead.c.n > 0 ? 1 : -1;
  const inf = (s) => (s > 0 ? '\\infty' : '-\\infty');
  const ptsTex = (ps) => ps.map((p) => `x=${p.tex}`).join(',\\ ');
  return {
    data, fTex: sumTex(f), fStr: f.map((t) => `(${t.c.n}/${t.c.d})*x^${t.p.n}`).join('+'),
    f: (x) => sumNum(f, x), n1: (x) => sumNum(d1, x), n2: (x) => sumNum(d2, x),
    yAt: (p) => valFr(sumAt(f, fr(Math.round(p.v)))),
    domain: 'D_f=\\mathbb{R}', breaks: [],
    domText: 'Polynom je definovaný pro každé reálné číslo, takže definiční obor je celé $\\mathbb{R}$.',
    xz: zeros.map((z) => z.v), // x-ové souřadnice průsečíků s osou x
    parity: { lines: [{ tex: `f(-x)=${sumTex(fneg)}` }], text: 'Polynom obsahuje sudé i liché mocniny, takže $f(-x)$ se nerovná ani $f(x)$, ani $-f(x)$: funkce není sudá ani lichá.' },
    intercepts: {
      lines: [{ tex: `f(x)=0:\\ ${fFact}=0` }, { tex: ptsTex(zeros) }, { tex: `f(0)=${frTex(sumAt(f, fr(0)))}` }],
      text: 'Průsečíky s osou $x$ jsou nulové body funkce – polynom rozložíme na součin. Průsečík s osou $y$ dostaneme dosazením $x=0$.',
    },
    limits: {
      lines: [{ tex: `\\lim_{x\\to\\infty}(${sumTex(f)})=${inf(sgnL)}` }, { tex: `\\lim_{x\\to-\\infty}(${sumTex(f)})=${inf(sgnL * (deg % 2 ? -1 : 1))}` }],
      text: 'Definiční obor je celé $\\mathbb{R}$, limity počítáme jen v $\\pm\\infty$. U polynomu rozhoduje člen s nejvyšší mocninou.',
    },
    d1: {
      lines: [{ tex: `f'(x)=${sumTex(d1)}` }, { tex: `=${d1Fact}` }, { tex: `f'(x)=0:\\ ${ptsTex(crit)}` }],
      text: 'Derivujeme člen po členu, derivaci rozložíme na součin a najdeme její nulové body (stacionární body).',
    },
    crit,
    d2: {
      lines: [{ tex: `f''(x)=${sumTex(d2)}` }, { tex: `=${d2Fact}` }, { tex: `f''(x)=0:\\ ${ptsTex(crit2)}` }],
      text: 'Druhou derivaci dostaneme zderivováním první derivace; najdeme její nulové body.',
    },
    crit2,
    asym: {
      lines: [
        { tex: `k_1=\\lim_{x\\to\\infty}\\frac{f(x)}{x}=${inf(sgnL)}` },
        { tex: `k_2=\\lim_{x\\to-\\infty}\\frac{f(x)}{x}=${inf(sgnL * ((deg - 1) % 2 ? -1 : 1))}` },
      ],
      text: 'Směrnice $k=\\lim\\frac{f(x)}{x}$ vychází nekonečná, asymptoty se směrnicí tedy nejsou. Asymptoty bez směrnice také ne – funkce je spojitá na celém $\\mathbb{R}$. Polynom stupně aspoň 2 nemá nikdy žádnou asymptotu.',
      vertical: [], lines2: [],
    },
  };
}

function famP1({ s, b }) { // s·x²(x − 3b)
  const f = S([T(s, 3), T(-3 * b * s, 2)]);
  return polyFamily({ fam: 'P1', s, b }, f, `${coefTex(s)}x^{2}(${xMinus(3 * b)})`, [ptInt(0), ptInt(3 * b)],
    `${coefTex(3 * s)}x(${xMinus(2 * b)})`, [ptInt(Math.min(0, 2 * b)), ptInt(Math.max(0, 2 * b))],
    `${coefTex(6 * s)}(${xMinus(b)})`, [ptInt(b)]);
}
function famP2({ s, b }) { // s·x(x − 3b)²
  const f = S([T(s, 3), T(-6 * b * s, 2), T(9 * b * b * s, 1)]);
  const lo = Math.min(b, 3 * b); const hi = Math.max(b, 3 * b);
  return polyFamily({ fam: 'P2', s, b }, f, `${coefTex(s)}x(${xMinus(3 * b)})^{2}`, [ptInt(Math.min(0, 3 * b)), ptInt(Math.max(0, 3 * b))],
    `${coefTex(3 * s)}(${xMinus(lo)})(${xMinus(hi)})`, [ptInt(lo), ptInt(hi)],
    `${coefTex(6 * s)}(${xMinus(2 * b)})`, [ptInt(2 * b)]);
}
function famP3({ b }) { // x³(x − 4b), b > 0
  const f = S([T(1, 4), T(-4 * b, 3)]);
  return polyFamily({ fam: 'P3', b }, f, `x^{3}(${xMinus(4 * b)})`, [ptInt(0), ptInt(4 * b)],
    `4x^{2}(${xMinus(3 * b)})`, [ptInt(0), ptInt(3 * b)],
    `12x(${xMinus(2 * b)})`, [ptInt(0), ptInt(2 * b)]);
}

function famR1({ d, m }) { // (x² + c)/(x − d), c = m² − d²
  const c = m * m - d * d;
  const num = S([T(1, 2), T(c)]);
  const numT = sumTex(num);
  const den = xMinus(d);
  const f = (x) => (x * x + c) / (x - d);
  const d1 = (x) => ((x - d) ** 2 - m * m) / (x - d) ** 2;
  const d2 = (x) => 2 * m * m / (x - d) ** 3;
  const xInt = -c > 0 ? [negPt(ptSqrt(-c)), ptSqrt(-c)] : -c === 0 ? [ptInt(0)] : [];
  const p1 = S([T(1, 2), T(-2 * d, 1), T(-c)]);
  const parity = d === 0
    ? { lines: [{ tex: `f(-x)=-\\frac{(-x)^{2}${c === 0 ? '' : c < 0 ? c : `+${c}`}}{x}` }, { tex: `=-\\frac{${numT}}{x}=-f(x)` }], text: 'Definiční obor je souměrný podle nuly a platí $f(-x)=-f(x)$ (záporný jmenovatel $-x$ zapisujeme jako minus před zlomkem): funkce je lichá, graf je souměrný podle počátku.' }
    : { lines: [{ tex: `f(-x)=-\\frac{(-x)^{2}${c === 0 ? '' : c < 0 ? c : `+${c}`}}{${xMinus(-d)}}` }, { tex: `=-\\frac{${numT}}{${xMinus(-d)}}` }], text: `Definiční obor není souměrný podle nuly (chybí jen bod ${d}), a $f(-x)$ se nerovná ani $f(x)$, ani $-f(x)$: funkce není sudá ani lichá. (Záporný jmenovatel $-x${d > 0 ? '-' : '+'}${Math.abs(d)}$ zapisujeme jako minus před zlomkem.)` };
  return {
    data: { fam: 'R1', d, m },
    fTex: `\\frac{${numT}}{${den}}`, fStr: `(x^2+(${c}))/(x-(${d}))`, f, n1: d1, n2: d2,
    yAt: (p) => {
      const t = Math.round(p.v) - d;
      return valFr(fr(t * t + 2 * d * t + d * d + c, t));
    },
    domain: `D_f=\\mathbb{R}\\setminus\\{${d}\\}`, breaks: [ptInt(d)],
    domText: `Funkce je zlomek, jmenovatel nesmí být nula: $${den}\\neq0$, tedy $x\\neq${d}$.`, domLine: `${den}\\neq0`,
    xz: xInt.map((z) => z.v), // x-ové souřadnice průsečíků s osou x
    parity,
    intercepts: {
      lines: [
        { tex: `f(x)=0:\\ ${numT}=0` },
        { tex: xInt.length ? xInt.map((p) => `x=${p.tex}`).join(',\\ ') : '\\text{nemá řešení}' },
        { tex: d === 0 ? 'x=0\\notin D_f' : `f(0)=${frTex(fr(c, -d))}` },
      ],
      text: `Zlomek je nulový, když je nulový čitatel. ${d === 0 ? 'Bod $x=0$ do definičního oboru nepatří, s osou $y$ se graf neprotne.' : 'Průsečík s osou $y$ dostaneme dosazením $x=0$.'}`,
    },
    limits: {
      lines: [
        { tex: `\\lim_{x\\to\\infty}\\frac{${numT}}{${den}}=\\infty` },
        { tex: `\\lim_{x\\to-\\infty}\\frac{${numT}}{${den}}=-\\infty` },
        { tex: `\\lim_{x\\to${d}^{-}}f(x)=\\left|\\frac{${m * m}}{0^{-}}\\right|=-\\infty` },
        { tex: `\\lim_{x\\to${d}^{+}}f(x)=\\left|\\frac{${m * m}}{0^{+}}\\right|=\\infty` },
      ],
      text: `V nekonečnu má čitatel vyšší stupeň než jmenovatel. V bodě ${d} je čitatel roven ${m * m} a jmenovatel jde k nule – zleva přes záporná čísla, zprava přes kladná.`,
    },
    d1: {
      lines: [
        ...fracLines("f'(x)=", `2x(${den})-(${numT})\\cdot 1`, pw2(den, 2)),
        ...fracLines('=', sumTex(p1), pw2(den, 2)),
        ...fracLines('=', `(${xMinus(d - m)})(${xMinus(d + m)})`, pw2(den, 2)),
        { tex: `f'(x)=0:\\ x=${d - m},\\ x=${d + m}` },
      ],
      text: 'Derivujeme podle vzorce pro podíl, čitatel upravíme a rozložíme. Nulové body derivace jsou nulové body čitatele; v bodě, kde funkce není definována, derivace také neexistuje.',
    },
    crit: [ptInt(d - m), ptInt(d + m)],
    d2: {
      lines: [
        ...fracLines("f''(x)=", `(${sumTex(S([T(2, 1), T(-2 * d)]))})${pw2(den, 2)}-(${sumTex(p1)})\\cdot 2(${den})`, pw2(den, 4)),
        ...fracLines('=', `2${pw2(den, 2)}-2(${sumTex(p1)})`, pw2(den, 3)),
        ...fracLines('=', `${2 * m * m}`, pw2(den, 3)),
        { tex: `f''(x)\\neq 0` },
      ],
      text: `Opět vzorec pro podíl; v čitateli i jmenovateli vykrátíme jeden činitel $${den}$. Čitatel druhé derivace je kladné číslo, nulové body nemá – znaménko určuje jen jmenovatel.`,
    },
    crit2: [],
    asym: {
      lines: [
        { tex: `x=${d}` },
        ...limLines('k=', '\\lim_{x\\to\\pm\\infty}', `\\frac{${numT}}{x(${den})}`, '=1'),
        ...limLines('q=', '\\lim_{x\\to\\pm\\infty}', `\\left(\\frac{${numT}}{${den}}-x\\right)`),
        ...limLines('=', '\\lim_{x\\to\\pm\\infty}', `\\frac{${sumTex(S([T(d, 1), T(c)]))}}{${den}}`, `=${d}`),
        { tex: `y=${lineTex(fr(1), fr(d))}` },
      ],
      text: `Asymptota bez směrnice je $x=${d}$ (tam jsou limity nekonečné). Asymptota se směrnicí $y=kx+q$: $k$ je limita $\\frac{f(x)}{x}$, $q$ je limita $f(x)-kx$; pro $x\\to\\infty$ i $x\\to-\\infty$ vyjde totéž.`,
      vertical: [d], lines2: [{ k: 1, q: d }],
    },
  };
}

function famR2({ k, m }) { // k·x/(x² + m²)
  const M = m * m;
  const den = `x^{2}+${M}`;
  const u = S([T(-k, 2), T(k * M)]); // čitatel f′
  return {
    data: { fam: 'R2', k, m },
    fTex: `\\frac{${coefTex(k)}x}{${den}}`, fStr: `(${k})*x/(x^2+${M})`,
    f: (x) => k * x / (x * x + M), n1: (x) => k * (M - x * x) / (x * x + M) ** 2, n2: (x) => 2 * k * x * (x * x - 3 * M) / (x * x + M) ** 3,
    yAt: (p) => (p.str.includes('sqrt') ? valSqrt3(fr(k * Math.sign(p.v), 4 * m)) : valFr(fr(k * Math.round(p.v), Math.round(p.v) ** 2 + M))),
    domain: 'D_f=\\mathbb{R}', breaks: [],
    domText: `Jmenovatel $${den}$ je vždy kladný, nikdy není nulový, takže definiční obor je celé $\\mathbb{R}$.`, domLine: `${den}>0`,
    xz: [0], // x-ové souřadnice průsečíků s osou x
    parity: { lines: [{ tex: `f(-x)=\\frac{${coefTex(k)}(-x)}{(-x)^{2}+${M}}=-f(x)` }], text: 'Jmenovatel je vždy kladný, definiční obor je $\\mathbb{R}$. Platí $f(-x)=-f(x)$: funkce je lichá.' },
    intercepts: { lines: [{ tex: `f(x)=0:\\ ${coefTex(k)}x=0` }, { tex: 'x=0' }, { tex: 'f(0)=0' }], text: 'Jediný průsečík s osami je počátek $[0;\\ 0]$.' },
    limits: { lines: [{ tex: `\\lim_{x\\to\\pm\\infty}\\frac{${coefTex(k)}x}{${den}}=0` }], text: 'Jmenovatel má vyšší stupeň než čitatel, v $\\pm\\infty$ jde zlomek k nule.' },
    d1: {
      lines: [
        ...fracLines("f'(x)=", `${k}(${den})${minusTex(`${coefTex(k)}x`)}\\cdot 2x`, `(${den})^{2}`),
        ...fracLines('=', sumTex(u), `(${den})^{2}`),
        ...fracLines('=', `${coefTex(k)}(${m}-x)(${m}+x)`, `(${den})^{2}`),
        { tex: `f'(x)=0:\\ x=-${m},\\ x=${m}` },
      ],
      text: 'Derivujeme podle vzorce pro podíl. Čitatel rozložíme podle vzorce $a^2-b^2=(a-b)(a+b)$.',
    },
    crit: [ptInt(-m), ptInt(m)],
    d2: {
      lines: [
        ...fracLines("f''(x)=", `${termTex({ c: fr(-2 * k), p: fr(1), E: 0, S: 0, C: 0, L: 0 })}(${den})^{2}-(${sumTex(u)})\\cdot 2(${den})\\cdot 2x`, `(${den})^{4}`),
        ...fracLines('=', `${termTex({ c: fr(-2 * k), p: fr(1), E: 0, S: 0, C: 0, L: 0 })}(${den})-4x(${sumTex(u)})`, `(${den})^{3}`),
        ...fracLines('=', sumTex(S([T(2 * k, 3), T(-6 * k * M, 1)])), `(${den})^{3}`),
        ...fracLines('=', `${coefTex(2 * k)}x(x^{2}-${3 * M})`, `(${den})^{3}`),
        { tex: `f''(x)=0:\\ x=0,\\ x=\\pm${m === 1 ? '' : m}\\sqrt{3}` },
      ],
      text: `Zderivujeme podíl ještě jednou, vykrátíme jeden činitel $(${den})$ a čitatel vytkneme. Rovnice $x^2=${3 * M}$ dává $x=\\pm${m === 1 ? '' : m}\\sqrt{3}$.`,
    },
    crit2: [ptSqrt3(-m), ptInt(0), ptSqrt3(m)],
    asym: {
      lines: [
        ...limLines('k=', '\\lim_{x\\to\\pm\\infty}', `\\frac{${coefTex(k)}x}{x(${den})}`, '=0'),
        ...limLines('q=', '\\lim_{x\\to\\pm\\infty}', `\\frac{${coefTex(k)}x}{${den}}`, '=0'),
        { tex: 'y=0' },
      ],
      text: 'Asymptoty bez směrnice nejsou (funkce je spojitá na $\\mathbb{R}$). Asymptota se směrnicí: $k=0$, $q=0$, tedy osa $x$, přímka $y=0$ – vodorovná asymptota.',
      vertical: [], lines2: [{ k: 0, q: 0 }],
    },
  };
}

function famR3({ k, m }) { // k·x²/(x² − m²)
  const M = m * m;
  const den = `x^{2}-${M}`;
  const A = -2 * k * M;
  const sg = (v) => (v > 0 ? '\\infty' : '-\\infty');
  const kx2 = S([T(k, 2)]);
  return {
    data: { fam: 'R3', k, m },
    fTex: `\\frac{${coefTex(k)}x^{2}}{${den}}`, fStr: `(${k})*x^2/(x^2-${M})`,
    f: (x) => k * x * x / (x * x - M), n1: (x) => A * x / (x * x - M) ** 2, n2: (x) => 2 * k * M * (3 * x * x + M) / (x * x - M) ** 3,
    yAt: () => valFr(fr(0)),
    domain: `D_f=\\mathbb{R}\\setminus\\{-${m};\\ ${m}\\}`, breaks: [ptInt(-m), ptInt(m)],
    domText: `Funkce je zlomek, jmenovatel nesmí být nula: $${den}\\neq0$, tedy $x\\neq-${m}$ a $x\\neq${m}$.`, domLine: `${den}\\neq0`,
    xz: [0], // x-ové souřadnice průsečíků s osou x
    parity: { lines: [{ tex: `f(-x)=\\frac{${coefTex(k)}(-x)^{2}}{(-x)^{2}-${M}}=f(x)` }], text: 'Definiční obor je souměrný podle nuly a $f(-x)=f(x)$: funkce je sudá (graf je souměrný podle osy $y$).' },
    intercepts: { lines: [{ tex: `f(x)=0:\\ ${coefTex(k)}x^{2}=0` }, { tex: 'x=0' }, { tex: 'f(0)=0' }], text: 'Jediný průsečík s osami je počátek $[0;\\ 0]$.' },
    limits: {
      lines: [
        { tex: `\\lim_{x\\to\\pm\\infty}\\frac{${coefTex(k)}x^{2}}{${den}}=${k}` },
        { tex: `\\lim_{x\\to-${m}^{-}}f(x)=\\left|\\frac{${k * M}}{0^{+}}\\right|=${sg(k)}` },
        { tex: `\\lim_{x\\to-${m}^{+}}f(x)=\\left|\\frac{${k * M}}{0^{-}}\\right|=${sg(-k)}` },
        { tex: `\\lim_{x\\to${m}^{-}}f(x)=\\left|\\frac{${k * M}}{0^{-}}\\right|=${sg(-k)}` },
        { tex: `\\lim_{x\\to${m}^{+}}f(x)=\\left|\\frac{${k * M}}{0^{+}}\\right|=${sg(k)}` },
      ],
      text: `V $\\pm\\infty$ mají čitatel i jmenovatel stejný stupeň – limita je podíl koeficientů u $x^2$. V bodech $\\pm${m}$ je čitatel ${k * M} a jmenovatel jde k nule; jeho znaménko zjistíme dosazením čísla kousek vlevo a vpravo.`,
    },
    d1: {
      lines: [
        ...fracLines("f'(x)=", `${termTex({ c: fr(2 * k), p: fr(1), E: 0, S: 0, C: 0, L: 0 })}(${den})${minusTex(sumTex(kx2))}\\cdot 2x`, `(${den})^{2}`),
        ...fracLines('=', `${coefTex(A)}x`, `(${den})^{2}`),
        { tex: 'f\'(x)=0:\\ x=0' },
      ],
      text: 'Derivujeme podle vzorce pro podíl; členy s $x^3$ se v čitateli odečtou.',
    },
    crit: [ptInt(0)],
    d2: {
      lines: [
        ...fracLines("f''(x)=", `${A}(${den})^{2}${minusTex(`${coefTex(A)}x`)}\\cdot 2(${den})\\cdot 2x`, `(${den})^{4}`),
        ...fracLines('=', `${A}(${den})-${parenNeg(4 * A)}x^{2}`, `(${den})^{3}`),
        ...fracLines('=', sumTex(S([T(-3 * A, 2), T(-A * M)])), `(${den})^{3}`),
        ...fracLines('=', `${2 * k * M}(3x^{2}+${M})`, `(${den})^{3}`),
        { tex: 'f\'\'(x)\\neq 0' },
      ],
      text: `Zderivujeme podíl, vykrátíme jeden činitel $(${den})$ a vytkneme. Výraz $3x^2+${M}$ je vždy kladný, znaménko se mění jen v bodech $\\pm${m}$, kde funkce není definována.`,
    },
    crit2: [],
    asym: {
      lines: [
        { tex: `x=-${m},\\ x=${m}` },
        ...limLines('k=', '\\lim_{x\\to\\pm\\infty}', `\\frac{${coefTex(k)}x^{2}}{x(${den})}`, '=0'),
        ...limLines('q=', '\\lim_{x\\to\\pm\\infty}', `\\frac{${coefTex(k)}x^{2}}{${den}}`, `=${k}`),
        { tex: `y=${k}` },
      ],
      text: `Asymptoty bez směrnice jsou $x=-${m}$ a $x=${m}$ (nekonečné jednostranné limity). Se směrnicí: $k=0$ a $q=${k}$, tedy vodorovná asymptota $y=${k}$.`,
      vertical: [-m, m], lines2: [{ k: 0, q: k }],
    },
  };
}

function famE1({ s, b }) { // (x − b)·e^{sx}
  const lin = b === 0 ? 'x' : `(${xMinus(b)})`;
  const L1 = S([T(s, 1), T(1 - s * b)]);
  const L2 = S([T(1, 1), T(-b + 2 * s)]);
  const crit = b - s; const infl = b - 2 * s;
  const eNeg = s > 0 ? 'e^{x}' : '(-e^{-x})';
  const limitLines = s > 0
    ? [
      { tex: `\\lim_{x\\to\\infty}${lin}e^{x}=\\infty` },
      { tex: `\\lim_{x\\to-\\infty}${lin}e^{x}` },
      ...limFrac('=', '\\lim_{x\\to-\\infty}', xMinus(b), 'e^{-x}'),
      { tex: '=\\left|\\frac{-\\infty}{\\infty}\\right|' },
      { tex: '\\stackrel{\\text{l\'H}}{=}\\lim_{x\\to-\\infty}-\\frac{1}{e^{-x}}=0' },
    ]
    : [
      { tex: `\\lim_{x\\to\\infty}${lin}e^{-x}` },
      ...limFrac('=', '\\lim_{x\\to\\infty}', xMinus(b), 'e^{x}'),
      { tex: '=\\left|\\frac{\\infty}{\\infty}\\right|' },
      { tex: '\\stackrel{\\text{l\'H}}{=}\\lim_{x\\to\\infty}\\frac{1}{e^{x}}=0' },
      { tex: `\\lim_{x\\to-\\infty}${lin}e^{-x}=-\\infty` },
    ];
  const side = s > 0 ? '-\\infty' : '\\infty';
  return {
    data: { fam: 'E1', s, b },
    fTex: `${lin}${eTex(s)}`, fStr: `(x-(${b}))*exp(${s}*x)`,
    f: (x) => (x - b) * Math.exp(s * x), n1: (x) => (s * x + 1 - s * b) * Math.exp(s * x), n2: (x) => (x - b + 2 * s) * s * s * Math.exp(s * x),
    yAt: (p) => { const x = Math.round(p.v); return valExp(x - b, s * x); },
    domain: 'D_f=\\mathbb{R}', breaks: [],
    domText: 'Součin polynomu a exponenciály je definovaný pro každé reálné číslo, definiční obor je celé $\\mathbb{R}$.',
    xz: [b], // x-ové souřadnice průsečíků s osou x
    parity: { lines: [{ tex: `f(-x)=(${sumTex(S([T(-1, 1), T(-b)]))})${eTex(-s)}` }], text: 'Výraz $f(-x)$ se nerovná ani $f(x)$, ani $-f(x)$: funkce není sudá ani lichá.' },
    intercepts: { lines: [{ tex: `f(x)=0:\\ ${xMinus(b)}=0` }, { tex: `x=${b}` }, { tex: `f(0)=${-b}` }], text: `Exponenciála je vždy kladná, nulová může být jen závorka. Průsečík s osou $y$: $f(0)=(0${b > 0 ? '-' : '+'}${Math.abs(b)})\\cdot e^{0}$.`.replace('(0+0)', '(0)').replace('(0-0)', '(0)') },
    limits: { lines: limitLines, text: 'Exponenciála roste rychleji než jakýkoli polynom. Součin typu $\\infty\\cdot0$ přepíšeme na zlomek a použijeme l\'Hospitalovo pravidlo.' },
    d1: {
      lines: [
        { tex: `f'(x)=1\\cdot ${eTex(s)}+${lin === 'x' ? 'x' : lin}\\cdot ${eNeg}` },
        { tex: `=(${sumTex(L1)})${eTex(s)}` },
        { tex: `f'(x)=0:\\ x=${crit}` },
      ],
      text: 'Derivujeme jako součin, pak vytkneme exponenciálu. Ta je vždy kladná, takže znaménko derivace určuje jen závorka.',
    },
    crit: [ptInt(crit)],
    d2: {
      lines: [
        { tex: `f''(x)=${s > 0 ? '1' : '-1'}\\cdot ${eTex(s)}+(${sumTex(L1)})\\cdot ${eNeg}` },
        { tex: `=(${sumTex(L2)})${eTex(s)}` },
        { tex: `f''(x)=0:\\ x=${infl}` },
      ],
      text: 'Znovu derivujeme součin a vytkneme exponenciálu.',
    },
    crit2: [ptInt(infl)],
    asym: {
      lines: [
        ...limFrac('k=', `\\lim_{x\\to${side}}`, `${lin}${eTex(s)}`, 'x', '=0'),
        ...limLines('q=', `\\lim_{x\\to${side}}`, `${lin}${eTex(s)}`, '=0'),
        { tex: `y=0\\ \\text{pro}\\ x\\to${side}` },
        ...limFrac('', `\\lim_{x\\to${s > 0 ? '\\infty' : '-\\infty'}}`, 'f(x)', 'x', '=\\infty'),
      ],
      text: `Pro $x\\to${side}$ je $k=0$ a $q=0$ (limitu jsme už spočítali): asymptota $y=0$. Na druhé straně je $\\frac{f(x)}{x}$ nekonečná, asymptota tam není. Asymptoty bez směrnice nejsou, funkce je spojitá.`,
      vertical: [], lines2: [{ k: 0, q: 0 }],
    },
  };
}

// lim s předponou a koncem; nevejde-li se řádek, limita je na prvním řádku a výraz na druhém
const limLines = (pre, head, body, post = '') => {
  const one = `${pre}${head}${body}${post}`;
  return texWidth(one) <= LIM ? [{ tex: one }] : [{ tex: `${pre}${head}` }, { tex: `\\quad ${body}${post}` }];
};

const FAMS = { P1: famP1, P2: famP2, P3: famP3, R1: famR1, R2: famR2, R3: famR3, E1: famE1 };
export const family = (data) => FAMS[data.fam](data);

function genFamilyData(rng) {
  for (;;) {
    const fam = pick(rng, ['P1', 'P2', 'P3', 'R1', 'R1', 'R2', 'R3', 'E1']);
    switch (fam) {
      case 'P1': return { fam, s: pick(rng, [1, -1]), b: pick(rng, [-2, -1, 1, 2]) };
      case 'P2': { const s = pick(rng, [1, -1]); const b = pick(rng, [-2, -1, 1, 2]); if (s === 1 && b === 1) continue; return { fam, s, b }; }
      case 'P3': return { fam, b: pick(rng, [1, 2]) };
      case 'R1': {
        const d = ri(rng, -2, 2); const m = ri(rng, 1, 3);
        if (d === 1 && m === 1) continue;
        const nc = d * d - m * m; // −c
        if (nc > 0 && Math.round(Math.sqrt(nc)) ** 2 !== nc) continue; // jen hezké průsečíky
        return { fam, d, m };
      }
      case 'R2': { const k = pick(rng, [1, 2, 4, -1, -2, -4]); const m = ri(rng, 1, 3); if (k === 1 && m === 1) continue; return { fam, k, m }; }
      case 'R3': return { fam, k: pick(rng, [1, 2, 3, -1, -2]), m: ri(rng, 1, 3) };
      default: return { fam, s: pick(rng, [1, -1]), b: ri(rng, -2, 2) };
    }
  }
}

// ---------- obecný rozbor znamének ----------
function segments(A, sign, crit) {
  const pts = [...crit, ...A.breaks].sort((a, b) => a.v - b.v);
  const ends = [null, ...pts, null];
  const segs = [];
  for (let i = 0; i + 1 < ends.length; i++) {
    const a = ends[i]; const b = ends[i + 1];
    const mid = !a ? b ? b.v - 1 : 0 : !b ? a.v + 1 : (a.v + b.v) / 2;
    segs.push({ a, b, s: sign(mid) > 0 ? 1 : -1 });
  }
  return { pts, segs };
}
const isBreak = (A, p) => A.breaks.some((q) => q.v === p.v);
// Intervaly, kde je znaménko kladné; sousední se spojí přes bod, který patří do D_f.
function positive(A, R) {
  const out = [];
  for (const sg of R.segs) {
    if (sg.s <= 0) continue;
    const last = out[out.length - 1];
    if (last && sg.a && last.b === sg.a && !isBreak(A, sg.a)) last.b = sg.b; else out.push({ a: sg.a, b: sg.b });
  }
  return out;
}
const negative = (A, R) => positive(A, { segs: R.segs.map((s) => ({ ...s, s: -s.s })) });
const ivsTex = (ivs) => (ivs.length ? ivs.map((i) => ivTex(i.a, i.b)).join('\\cup') : '\\emptyset');
const ivsStr = (ivs) => ivs.map((i) => ivStr(i.a, i.b)).join(' ∪ ');
// Body, kde se znaménko mění (a funkce je tam definovaná).
function changes(A, R) {
  const out = [];
  R.pts.forEach((p, i) => {
    if (isBreak(A, p)) return;
    const l = R.segs[i].s; const r = R.segs[i + 1].s;
    if (l !== r) out.push({ p, kind: l > 0 ? 'max' : 'min' });
  });
  return out;
}
function chart(A, R, label, up, down, atCrit, atChange) {
  const ch = changes(A, R);
  return {
    kind: 'signchart',
    data: {
      points: R.pts.map((p) => p.txt),
      rows: [
        { label, cells: R.segs.map((s) => (s.s > 0 ? '+' : '−')), at: R.pts.map((p) => (isBreak(A, p) ? 'nedef.' : atCrit)) },
        { label: 'f', cells: R.segs.map((s) => (s.s > 0 ? up : down)), at: R.pts.map((p) => { const c = ch.find((q) => q.p === p); return c ? atChange(c.kind) : ''; }) },
      ],
      alt: `Tabulka znamének ${label} a chování funkce f`,
    },
  };
}
function monoInfo(A) {
  const R = segments(A, A.n1, A.crit);
  const inc = positive(A, R); const dec = negative(A, R);
  const ext = changes(A, R).map((c) => ({ ...c, y: A.yAt(c.p) }));
  return { R, inc, dec, ext };
}
function convInfo(A) {
  const R = segments(A, A.n2, A.crit2);
  const conv = positive(A, R); const conc = negative(A, R);
  const infl = changes(A, R).map((c) => ({ ...c, y: A.yAt(c.p) }));
  return { R, conv, conc, infl };
}
const pointTex = (p, y) => `[${p.tex};\\ ${y.tex}]`;

// ---------- kroky ----------
function stepDomain(A, withParity = true) {
  return {
    title: withParity ? 'Definiční obor a parita' : 'Definiční obor',
    text: withParity
      ? `Nejdřív zjistíme, kde je funkce definovaná. ${A.domText} Potom určíme, zda je sudá ($f(-x)=f(x)$) nebo lichá ($f(-x)=-f(x)$). ${A.parity.text}`
      : `Nejdřív zjistíme, kde je funkce definovaná. ${A.domText}${A.breaks.length ? ' Body mimo definiční obor rozdělují osu na intervaly stejně jako nulové body derivace.' : ''}`,
    board: [{ tex: `f(x)=${A.fTex}` }, ...(A.domLine ? [{ tex: A.domLine }] : []), { tex: A.domain }, ...(withParity ? A.parity.lines : [])],
  };
}
const stepD1 = (A) => ({ title: 'První derivace', text: A.d1.text, board: A.d1.lines });
const stepD2 = (A) => ({ title: 'Druhá derivace', text: A.d2.text, board: A.d2.lines });
function stepMono(A, M, final) {
  const lines = [];
  if (final === 'inc') lines.push(resultLine('\\text{rostoucí: }', ivsTex(M.inc)));
  else lines.push({ tex: `\\text{rostoucí: }${ivsTex(M.inc)}` });
  lines.push({ tex: `\\text{klesající: }${ivsTex(M.dec)}` });
  M.ext.forEach((e) => lines.push({ tex: `\\text{lok. ${e.kind}: }${pointTex(e.p, e.y)}` }));
  if (final === 'ext') lines.push(resultLine('x=', M.ext.map((e) => e.p.tex).join(';\\ ')));
  return {
    title: 'Monotonie a extrémy',
    text: 'Nulové body derivace a body mimo definiční obor rozdělí osu na intervaly. Na každém zjistíme znaménko $f\'$ dosazením libovolného čísla z intervalu: $f\'>0$ znamená, že funkce roste, $f\'<0$, že klesá. Kde se rostoucí mění v klesající, je lokální maximum, opačně lokální minimum; jeho $y$ dopočítáme dosazením do $f$.',
    board: lines,
    viz: chart(A, M.R, 'f′', '↗', '↘', '0', (k) => k),
  };
}
function stepConv(A, C, final) {
  const lines = [];
  if (final) lines.push(resultLine('\\text{konvexní: }', ivsTex(C.conv)));
  else lines.push({ tex: `\\text{konvexní: }${ivsTex(C.conv)}` });
  lines.push({ tex: `\\text{konkávní: }${ivsTex(C.conc)}` });
  if (C.infl.length) C.infl.forEach((e) => lines.push({ tex: `\\text{inflexe: }${pointTex(e.p, e.y)}` }));
  else lines.push({ tex: '\\text{inflexní body nejsou}' });
  return {
    title: 'Konvexnost a inflexní body',
    text: 'Stejně jako u monotonie určíme znaménko druhé derivace na intervalech: $f\'\'>0$ – funkce je konvexní (tvar $\\cup$), $f\'\'<0$ – konkávní (tvar $\\cap$). Inflexní bod je tam, kde se konvexnost mění a funkce je definovaná.',
    board: lines,
    viz: chart(A, C.R, 'f″', '∪', '∩', '0', () => 'infl.'),
  };
}
function plotData(A, M, C) {
  const xs = [...A.crit, ...A.crit2, ...A.breaks].map((p) => p.v);
  let lo = Math.min(...xs, 0) - 3; let hi = Math.max(...xs, 0) + 3;
  if (hi - lo < 8) { const c = (lo + hi) / 2; lo = c - 4; hi = c + 4; }
  const ys = [...M.ext.map((e) => e.y.v), ...C.infl.map((e) => e.y.v), ...A.asym.lines2.filter((l) => l.k === 0).map((l) => l.q), 0];
  let ylo = Math.min(...ys); let yhi = Math.max(...ys);
  const pad = Math.max(2, (yhi - ylo) * 0.5);
  ylo -= pad; yhi += pad;
  const asymptotes = [
    ...A.asym.vertical.map((x) => ({ kind: 'vertical', x, label: `x = ${String(x).replace('-', '−')}` })),
    ...A.asym.lines2.map((l) => (l.k === 0 ? { kind: 'horizontal', y: l.q, label: `y = ${String(l.q).replace('-', '−')}` }
      : { kind: 'oblique', k: l.k, q: l.q, label: `y = ${lineTex(fr(l.k), fr(l.q)).replace('-', '−')}` })),
  ];
  // průsečíky s osami (zeleně), kromě těch, které splývají s extrémem nebo inflexním bodem
  const taken = [...M.ext, ...C.infl].map((e) => [e.p.v, e.y.v]);
  const free = (x, y) => !taken.some(([a, b]) => Math.abs(a - x) < 1e-9 && Math.abs(b - y) < 1e-9);
  const cut = [];
  for (const x of A.xz) if (free(x, 0)) cut.push({ x, y: 0 });
  const y0 = A.f(0);
  if (Number.isFinite(y0) && !cut.some((q) => q.x === 0 && q.y === y0) && free(0, y0)) cut.push({ x: 0, y: y0 });
  return {
    domain: [lo, hi], range: [ylo, yhi],
    functions: [{ expr: A.fStr }],
    asymptotes,
    points: [
      ...M.ext.map((e) => ({ x: e.p.v, y: e.y.v, label: e.kind, style: 'closed' })),
      ...C.infl.map((e) => ({ x: e.p.v, y: e.y.v, label: 'inflexe', style: 'closed', color: 'blue' })),
      ...cut.map((q) => ({ x: q.x, y: q.y, style: 'open', color: 'green' })),
    ],
    alt: 'Graf funkce s extrémy, inflexními body a asymptotami',
  };
}
function summaryParts(M, C, A) {
  const parts = [];
  M.ext.forEach((e) => parts.push(`\\text{${e.kind} }${pointTex(e.p, e.y)}`));
  C.infl.forEach((e) => parts.push(`\\text{infl. }${pointTex(e.p, e.y)}`));
  const as = [...A.asym.vertical.map((x) => `x=${x}`), ...A.asym.lines2.map((l) => `y=${lineTex(fr(l.k), fr(l.q))}`)];
  if (as.length) parts.push(`\\text{asympt. }${as.join(',\\ ')}`);
  return parts;
}
const summaryTex = (M, C, A) => summaryParts(M, C, A).join(',\\ ');
// jedna položka na řádek (čárky na konci řádků dají po slepení stejný zápis jako summaryTex)
const summaryLines = (M, C, A) => summaryParts(M, C, A).map((t, i, a) => ({ tex: i < a.length - 1 ? `${t},` : t }));

// ---------- typy ----------
function base(type, data, A) {
  return { id: idOf(type, data), topic: TOPIC, type, data, promptTex: `f(x)=${A.fTex}` };
}
export function solveMonotonie(data) {
  const A = family(data); const M = monoInfo(A);
  return {
    ...base('monotonie', data, A),
    task: 'Urči intervaly, na kterých je funkce rostoucí. Zapiš je jako sjednocení otevřených intervalů, např. (-∞; -1) ∪ (2; ∞); odmocninu jako √3.',
    answerSpec: { kind: 'interval', value: ivsStr(M.inc) },
    answerTex: ivsTex(M.inc),
    solution: [stepDomain(A, false), stepD1(A), stepMono(A, M, 'inc')],
  };
}
export function solveExtremy(data) {
  const A = family(data); const M = monoInfo(A);
  return {
    ...base('extremy', data, A),
    task: 'Najdi lokální extrémy funkce. Zapiš $x$-ové souřadnice všech lokálních extrémů oddělené středníkem, např. -1; 3.',
    answerSpec: { kind: 'list', value: M.ext.map((e) => e.p.v) },
    answerTex: M.ext.map((e) => e.p.tex).join(';\\ '),
    conclusion: M.ext.map((e) => `lokální ${e.kind === 'max' ? 'maximum' : 'minimum'} $${pointTex(e.p, e.y)}$`).join(', ').replace(/^./, (c) => c.toUpperCase()) + '.',
    solution: [stepDomain(A, false), stepD1(A), stepMono(A, M, 'ext')],
  };
}
export function solveKonvexnost(data) {
  const A = family(data); const C = convInfo(A);
  return {
    ...base('konvexnost', data, A),
    task: 'Urči intervaly, na kterých je funkce konvexní. Zapiš je jako sjednocení otevřených intervalů, např. (-∞; 0) ∪ (2; ∞); odmocninu jako √3.',
    answerSpec: { kind: 'interval', value: ivsStr(C.conv) },
    answerTex: ivsTex(C.conv),
    conclusion: C.infl.length ? `Inflexní body: ${C.infl.map((e) => `$${pointTex(e.p, e.y)}$`).join(', ')}.` : 'Inflexní body funkce nemá.',
    solution: [stepDomain(A, false), stepD1(A), stepD2(A), stepConv(A, C, true)],
  };
}
export function solvePrubeh(data) {
  const A = family(data); const M = monoInfo(A); const C = convInfo(A);
  const sum = summaryTex(M, C, A);
  return {
    ...base('prubeh', data, A),
    task: 'Vyšetři průběh funkce (definiční obor, parita, průsečíky, limity, monotonie a extrémy, konvexnost a inflexe, asymptoty) a načrtni graf. Počítej na tabuli, pak porovnej s postupem a ohodnoť se.',
    hint: 'Postup: 1. D_f a parita, 2. průsečíky, 3. limity v krajních bodech, 4. f′ a monotonie, 5. f″ a konvexnost, 6. asymptoty, 7. graf.',
    answerSpec: { kind: 'whiteboard' },
    answerTex: sum,
    solution: [
      stepDomain(A, true),
      { title: 'Průsečíky s osami', text: A.intercepts.text, board: A.intercepts.lines },
      { title: 'Limity v krajních bodech', text: A.limits.text, board: A.limits.lines },
      stepD1(A),
      stepMono(A, M, null),
      stepD2(A),
      stepConv(A, C, false),
      { title: 'Asymptoty', text: A.asym.text, board: A.asym.lines },
      {
        title: 'Graf',
        text: 'Do grafu zakreslíme asymptoty (čárkovaně), průsečíky s osami (zelené prázdné body), extrémy a inflexní body a spojíme je podle tabulek: kde funkce roste a klesá, kde je konvexní a konkávní, a jak se blíží k asymptotám.',
        board: summaryLines(M, C, A),
        viz: { kind: 'plot', data: plotData(A, M, C) },
      },
    ],
  };
}

// ---------- asymptoty racionálních funkcí ----------
// data = { fam: 'A', a, b, c, d }      f = (ax² + bx + c)/(x − d)
//      | { fam: 'B', a, b, c, e, g }   f = (ax³ + bx² + cx + e)/(x² + g)
const LIMPM = '\\lim_{x\\to\\pm\\infty}';
// lim zlomku: vejde-li se, jeden řádek; jinak limita na prvním řádku a zlomek na dalších
function limFrac(pre, head, N, D, post = '') {
  const one = `${pre}${head}\\frac{${N}}{${D}}${post}`;
  if (texWidth(one) <= LIM) return [{ tex: one }];
  const two = `\\quad\\frac{${N}}{${D}}${post}`;
  if (texWidth(two) <= LIM) return [{ tex: `${pre}${head}` }, { tex: two }];
  return [{ tex: `${pre}${head}` }, ...fracLines('\\quad ', N, D), ...(post ? [{ tex: post }] : [])];
}
function asymAnalysis(data) {
  const { a, b } = data;
  const kx = a < 0 ? `+${coefTex(-a)}x` : `-${coefTex(a)}x`; // f(x) − kx bez dvojitého znaménka
  let num; let den; let numVals; let vertical; let q; let kLines; let qLines; let fExpr; let denZero;
  if (data.fam === 'A') {
    const { c, d } = data;
    num = S([T(a, 2), T(b, 1), T(c)]); den = xMinus(d);
    vertical = [d]; numVals = [a * d * d + b * d + c];
    q = b + a * d;
    denZero = [`${den}=0`];
    kLines = limFrac('k=', LIMPM, sumTex(num), sumTex(S([T(1, 2), T(-d, 1)])), `=${a}`);
    qLines = [
      ...limLines('q=', LIMPM, `\\left(\\frac{${sumTex(num)}}{${den}}${kx}\\right)`),
      ...limFrac('=', LIMPM, `${sumTex(num)}-(${sumTex(S([T(a, 2), T(-a * d, 1)]))})`, den),
      ...limFrac('=', LIMPM, sumTex(S([T(q, 1), T(c)])), den, `=${q}`),
    ];
    fExpr = `(${a}*x^2+${b}*x+${c})/(x-${d})`;
  } else {
    const { c, e, g } = data;
    num = S([T(a, 3), T(b, 2), T(c, 1), T(e)]); den = sumTex(S([T(1, 2), T(g)]));
    const m = Math.round(Math.sqrt(-g));
    vertical = g < 0 ? [-m, m] : [];
    numVals = vertical.map((x) => a * x ** 3 + b * x * x + c * x + e);
    q = b;
    denZero = g < 0 ? [`${den}=0`] : [`x^{2}+${g}>0\\ \\Rightarrow\\ D_f=\\mathbb{R}`];
    kLines = limFrac('k=', LIMPM, sumTex(num), sumTex(S([T(1, 3), T(g, 1)])), `=${a}`);
    qLines = [
      ...limLines('q=', LIMPM, `\\left(\\frac{${sumTex(num)}}{${den}}${kx}\\right)`),
      ...limFrac('=', LIMPM, `${sumTex(num)}-(${sumTex(S([T(a, 3), T(a * g, 1)]))})`, den),
      ...limFrac('=', LIMPM, sumTex(S([T(b, 2), T(c - a * g, 1), T(e)])), den, `=${q}`),
    ];
    fExpr = `(${a}*x^3+${b}*x^2+${c}*x+${e})/(x^2+${g})`;
  }
  if (numVals.some((v) => v === 0)) throw new Error('asymptoty: čitatel v bodě nespojitosti nulový');
  const fTex = `\\frac{${sumTex(num)}}{${den}}`;
  const ans = lineTex(fr(a), fr(q));
  const vLims = vertical.map((x, i) => `\\lim_{x\\to${x}^{\\pm}}f(x)=\\left|\\frac{${numVals[i]}}{0}\\right|=\\pm\\infty`);
  const plot = {
    kind: 'plot',
    data: {
      domain: [Math.min(-6, ...vertical.map((x) => x - 4)), Math.max(6, ...vertical.map((x) => x + 4))],
      range: [-12 + q, 12 + q],
      functions: [{ expr: fExpr }],
      asymptotes: [...vertical.map((x) => ({ kind: 'vertical', x, label: `x = ${String(x).replace('-', '−')}` })), { kind: 'oblique', k: a, q, label: `y = ${ans.replace('-', '−')}` }],
      alt: 'Graf funkce s asymptotami',
    },
  };
  return { a, q, num, den, vertical, numVals, kLines, qLines, fTex, ans, vLims, denZero, plot };
}
const vertText = (A) => (A.vertical.length
  ? 'Hledáme body, kde funkce není definovaná (nulový jmenovatel). Čitatel tam není nulový, takže jednostranné limity jsou nekonečné a přímky $x=\\ldots$ jsou asymptoty bez směrnice.'
  : 'Jmenovatel je vždy kladný, funkce je spojitá na celém $\\mathbb{R}$ – asymptoty bez směrnice nejsou.');
const candTex = (A) => A.vertical.map((x) => `x=${x}`).join(',\\ ');
const vertBoard = (A) => [{ tex: `f(x)=${A.fTex}` }, ...A.denZero.map((tex) => ({ tex })), ...A.vLims.map((tex) => ({ tex })), ...(A.vertical.length ? [{ tex: candTex(A) }] : [])];

export function solveAsymptoty(data) {
  const A = asymAnalysis(data);
  return {
    id: idOf('asymptoty', data), topic: TOPIC, type: 'asymptoty', data,
    task: 'Najdi šikmou asymptotu grafu funkce (pro $x\\to\\pm\\infty$). Zapiš ji ve tvaru y = kx + q (stačí pravá strana), např. y = 2x + 1.',
    promptTex: `f(x)=${A.fTex}`,
    answerSpec: { kind: 'expression', value: `(${A.a})*x+(${A.q})`, variable: 'x' },
    answerTex: A.ans,
    conclusion: `${A.vertical.length ? `Asymptoty bez směrnice: ${A.vertical.map((x) => `$x=${x}$`).join(', ')}. ` : 'Asymptoty bez směrnice nejsou. '}Asymptota se směrnicí: $y=${A.ans}$.`,
    solution: [
      { title: 'Asymptoty bez směrnice', text: vertText(A), board: vertBoard(A) },
      {
        title: 'Směrnice k',
        text: 'Asymptota se směrnicí $y=kx+q$ má $k=\\lim\\frac{f(x)}{x}$. Čitatel i jmenovatel vydělíme nejvyšší mocninou $x$ ve jmenovateli – zůstane podíl koeficientů u nejvyšších mocnin.',
        board: A.kLines,
      },
      {
        title: 'Posun q',
        text: 'Potom $q=\\lim\\left(f(x)-kx\\right)$: převedeme na společný jmenovatel, nejvyšší mocniny se odečtou a zbude podíl koeficientů.',
        board: A.qLines,
      },
      { title: 'Asymptota se směrnicí', text: 'Pro $x\\to\\infty$ i $x\\to-\\infty$ vyšly stejné hodnoty, asymptota je jediná.', board: [resultLine('y=', A.ans)], viz: A.plot },
    ],
  };
}
// Svislé asymptoty (asymptoty bez směrnice) – odpověď je seznam $x$-ových souřadnic
export function solveAsymptotySvisle(data) {
  const A = asymAnalysis(data);
  if (!A.vertical.length) throw new Error('asymptoty-svisle: funkce nemá svislou asymptotu');
  const list = A.vertical.join(';\\ ');
  return {
    id: idOf('asymptoty-svisle', data), topic: TOPIC, type: 'asymptoty-svisle', data,
    task: 'Najdi svislé asymptoty (asymptoty bez směrnice) grafu funkce. Zapiš jejich $x$-ové souřadnice oddělené středníkem, např. -1; 3 (jediná asymptota: jen číslo).',
    promptTex: `f(x)=${A.fTex}`,
    answerSpec: { kind: 'list', value: A.vertical },
    answerTex: list,
    conclusion: `Svislé asymptoty: ${A.vertical.map((x) => `$x=${x}$`).join(', ')}.`,
    solution: [
      {
        title: 'Kde funkce není definovaná',
        text: 'Svislá asymptota může být jen v bodě, kde je jmenovatel nulový a funkce proto není definovaná. Najdeme tyto body.',
        board: [{ tex: `f(x)=${A.fTex}` }, ...A.denZero.map((tex) => ({ tex })), { tex: candTex(A) }],
      },
      {
        title: 'Jednostranné limity',
        text: 'V takovém bodě je čitatel nenulový a jmenovatel jde k nule, takže funkce roste nade všechny meze (nebo klesá pod všechny meze) – limity jsou nekonečné.',
        board: A.vLims.map((tex) => ({ tex })),
      },
      {
        title: 'Svislé asymptoty',
        text: 'Každý bod s nekonečnou jednostrannou limitou určuje svislou asymptotu $x=\\ldots$.',
        board: [resultLine('x=', list)],
        viz: A.plot,
      },
    ],
  };
}
function genAsymptoty(rng) {
  for (;;) {
    const a = pick(rng, [1, 2, -1, 3, -2]); const b = ri(rng, -4, 4); const c = ri(rng, -6, 6);
    try {
      if (rng() < 0.6) return solveAsymptoty({ fam: 'A', a, b, c, d: ri(rng, -3, 3) });
      return solveAsymptoty({ fam: 'B', a, b, c, e: ri(rng, -5, 5), g: pick(rng, [1, 4, -1, -4, 9]) });
    } catch { /* nulový čitatel v bodě nespojitosti */ }
  }
}

function genAsymptotySvisle(rng) {
  for (;;) {
    const a = pick(rng, [1, 2, -1, 3, -2]); const b = ri(rng, -4, 4); const c = ri(rng, -6, 6);
    try {
      if (rng() < 0.5) return solveAsymptotySvisle({ fam: 'A', a, b, c, d: ri(rng, -3, 3) });
      return solveAsymptotySvisle({ fam: 'B', a, b, c, e: ri(rng, -5, 5), g: pick(rng, [-1, -4, -9]) });
    } catch { /* nulový čitatel v bodě nespojitosti */ }
  }
}

export const prubehTypes = [
  { id: 'monotonie', title: 'Monotonie (rostoucí intervaly)', generate: (rng) => solveMonotonie(genFamilyData(rng)), solve: solveMonotonie },
  { id: 'extremy', title: 'Lokální extrémy', generate: (rng) => solveExtremy(genFamilyData(rng)), solve: solveExtremy },
  { id: 'konvexnost', title: 'Konvexnost a inflexní body', generate: (rng) => solveKonvexnost(genFamilyData(rng)), solve: solveKonvexnost },
  { id: 'asymptoty', title: 'Asymptoty', generate: genAsymptoty, solve: solveAsymptoty },
  { id: 'asymptoty-svisle', title: 'Svislé asymptoty', generate: genAsymptotySvisle, solve: solveAsymptotySvisle },
  { id: 'prubeh', title: 'Průběh funkce (celý, s grafem)', generate: (rng) => solvePrubeh(genFamilyData(rng)), solve: solvePrubeh },
];
// pro testy
export { sub, mul, isZero, frStr };
