// Téma 5: Funkce a její vlastnosti (podle přednášky, ručně psané přednášky „Funkce a definiční
// obory“ a sbírek v Moodlu; konkrétní příklady z nich jsou jen v content/, ne v gitu).
// Typy: definiční obor (zlomky, odmocniny, logaritmy, podíly, arkussinus, kombinace,
// goniometrické funkce), parita, inverzní funkce, obor hodnot transformované elementární funkce.
// Vzor struktury: js/topics/vektory.js. Pomůcky (množiny, rozklady, znaménka): funkce-lib.js.
import {
  fr, frTex, frStr, toNum, ep, INF, NINF, iv, point, REALS, normalize, intersect, without,
  setTex, setStr, setLines, polyTex, linTex, factorPoly, productTex, relTex, flipRel, signSolve,
  meetChart,
} from './funkce-lib.js';
import { gcd } from '../lin.js';

const TOPIC = 'funkce';
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const RESULT = 'vysledek';
const resultLine = (pre, tex) => ({ tex: `${pre}${cls(RESULT, tex)}`, notes: [{ kind: 'doubleUnderline', target: `bt-${RESULT}` }] });
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const flat = (t) => String(t).replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '').replace(/[{}\s]|\\ /g, '');
// odstraní dva stejné řádky po sobě
const dedupe = (lines) => lines.filter((l, i) => i === 0 || flat(l.tex) !== flat(lines[i - 1].tex));

// ---------- pomůcky losování ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const rnz = (rng, lo, hi) => { let v = 0; while (v === 0) v = ri(rng, lo, hi); return v; };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
// (p1 x - n1)(p2 x - n2)
const quadFrom = (p1, n1, p2, n2) => [p1 * p2, -(p1 * n2 + p2 * n1), n1 * n2];
const scale = (c, k) => c.map((a) => a * k);

const INTERVAL_FORMAT = 'Výsledek zapiš jako interval nebo sjednocení intervalů, např. (-∞; 2) ∪ <3; ∞) – ostrá závorka < > znamená, že krajní bod patří do množiny, ∞ můžeš psát i jako inf; jediné číslo zapiš jako {3}.';

// =====================================================================
// DEFINIČNÍ OBOR – části předpisu a podmínky
// Část: { k, s?: -1 (odečítá se), ... }
//   frac {num?, poly}        zlomek num/poly            poly ≠ 0
//   sqrt {poly, n?}          sudá odmocnina              poly ≥ 0
//   sqrtDen {poly, n?, num?} 1/odmocnina                 poly > 0
//   ln {poly, f?: 'log'}     logaritmus                  poly > 0
//   lnDen {poly (lineární), f?}  1/ln(poly)              poly > 0, poly ≠ 1
//   sqrtQuot {num, den}      √(lineární/lineární)        podíl ≥ 0
//   lnQuot {num, den, f?}    ln(lineární/lineární)       podíl > 0
//   asin {lin, c, fn?: 'acos'}  arcsin((ax+b)/c)         −1 ≤ (ax+b)/c ≤ 1
//   cbrt {poly}              lichá odmocnina             bez podmínky
//   cbrtDen {poly}           ∛(1/poly)                   poly ≠ 0
const lnName = (p) => (p.f === 'log' ? '\\log' : '\\ln');
const rootTex = (n, t) => (n && n !== 2 ? `\\sqrt[${n}]{${t}}` : `\\sqrt{${t}}`);
const quotTex = (num, den) => `\\frac{${polyTex(num)}}{${polyTex(den)}}`;
function partTex(p) {
  const P = p.poly ? polyTex(p.poly) : '';
  switch (p.k) {
    case 'frac': return `\\frac{${polyTex(p.num || [1])}}{${P}}`;
    case 'sqrt': return `${p.a ? p.a : ''}${rootTex(p.n, P)}`;
    case 'sqrtDen': return `\\frac{${polyTex(p.num || [1])}}{${rootTex(p.n, P)}}`;
    case 'ln': return `${lnName(p)}(${P})`;
    case 'lnDen': return `\\frac{1}{${lnName(p)}(${P})}`;
    case 'sqrtQuot': return `\\sqrt{${quotTex(p.num, p.den)}}`;
    case 'lnQuot': return `${lnName(p)}${quotTex(p.num, p.den)}`;
    case 'asin': {
      const arg = p.c === 1 ? `(${polyTex(p.lin)})` : `\\frac{${polyTex(p.lin)}}{${p.c}}`;
      return `${p.fn === 'acos' ? '\\arccos' : '\\arcsin'}${arg}`;
    }
    case 'cbrt': return `\\sqrt[3]{${P}}`;
    case 'cbrtDen': return `\\sqrt[3]{\\frac{1}{${P}}}`;
    default: throw new Error(`neznámá část ${p.k}`);
  }
}
export const domainFnTex = (parts) => parts.map((p, i) => `${p.s === -1 ? '-' : i ? '+' : ''}${partTex(p)}`).join('');

// Podmínky z částí: { t: 'poly'|'quot'|'ne1'|'asin', ..., label, tex }
function conditionsOf(parts) {
  const out = [];
  for (const p of parts) {
    const P = p.poly ? polyTex(p.poly) : '';
    switch (p.k) {
      case 'frac': case 'cbrtDen':
        out.push({ t: 'poly', c: p.poly, rel: '!=', label: 'jmenovatel', tex: `${P}\\mathrel{\\char"2260} 0` }); break;
      case 'sqrt':
        out.push({ t: 'poly', c: p.poly, rel: '>=', label: 'sudá odmocnina', tex: `${P}\\ge 0` }); break;
      case 'sqrtDen':
        out.push({ t: 'poly', c: p.poly, rel: '>', label: 'odmocnina ve jmenovateli', tex: `${P}>0` }); break;
      case 'ln':
        out.push({ t: 'poly', c: p.poly, rel: '>', label: 'logaritmus', tex: `${P}>0` }); break;
      case 'lnDen':
        out.push({ t: 'poly', c: p.poly, rel: '>', label: 'logaritmus', tex: `${P}>0` });
        out.push({ t: 'ne1', c: p.poly, label: 'ln ve jmenovateli', tex: `${lnName(p)}(${P})\\mathrel{\\char"2260} 0` }); break;
      case 'sqrtQuot':
        out.push({ t: 'quot', num: p.num, den: p.den, rel: '>=', label: 'sudá odmocnina', tex: `${quotTex(p.num, p.den)}\\ge 0` }); break;
      case 'lnQuot':
        out.push({ t: 'quot', num: p.num, den: p.den, rel: '>', label: 'logaritmus', tex: `${quotTex(p.num, p.den)}>0` }); break;
      case 'asin':
        out.push({
          t: 'asin', lin: p.lin, c: p.c, label: p.fn === 'acos' ? 'arkuskosinus' : 'arkussinus',
          tex: `-1\\le ${p.c === 1 ? polyTex(p.lin) : `\\frac{${polyTex(p.lin)}}{${p.c}}`}\\le 1`,
        }); break;
      case 'cbrt': break;
      default: throw new Error(`neznámá část ${p.k}`);
    }
  }
  // stejná podmínka ze dvou částí se píše jen jednou
  const uniq = [];
  for (const c of out) {
    const e = uniq.find((u) => u.tex === c.tex);
    if (e) { if (!e.label.includes(c.label)) e.label += ` + ${c.label}`; } else uniq.push(c);
  }
  return uniq;
}
const RULES = {
  frac: 'Ve jmenovateli zlomku nesmí být nula.',
  cbrtDen: 'Pod lichou odmocninou může být cokoli, ale je tam zlomek – jeho jmenovatel nesmí být nula.',
  sqrt: 'Pod sudou odmocninou (druhou, čtvrtou, …) nesmí být záporné číslo, nula smí.',
  sqrtDen: 'Odmocnina ve jmenovateli: výraz pod ní musí být kladný (záporný kvůli odmocnině, nula kvůli dělení).',
  ln: 'Logaritmovat lze jen kladná čísla.',
  lnDen: 'Logaritmus ve jmenovateli: argument musí být kladný a logaritmus nesmí být nulový – a ten je nulový právě pro argument 1.',
  sqrtQuot: 'Pod sudou odmocninou je zlomek: musí být nezáporný a jeho jmenovatel nesmí být nula.',
  lnQuot: 'Logaritmus zlomku: zlomek musí být kladný.',
  asin: 'Arkussinus a arkuskosinus jsou definované jen pro čísla od −1 do 1 (včetně).',
  cbrt: 'Lichá (třetí) odmocnina je definovaná pro všechna reálná čísla, podmínku nedává.',
};

const halfLine = (rel, r) => {
  const e = ep(r);
  if (rel === '>') return [iv(e, INF)];
  if (rel === '>=') return [iv(e, INF, true)];
  if (rel === '<') return [iv(NINF, e)];
  return [iv(NINF, e, false, true)];
};
const monoX = (p) => (p === 1 ? 'x' : p === -1 ? '-x' : `${p}x`);

// Řešení jedné podmínky: { lines, viz?, set, text }
function solveCond(cond, restate) {
  const lines = restate ? [{ tex: cond.tex }] : [];
  let viz = null; let set; let text;
  if (cond.t === 'poly' && cond.c.length === 2) {
    const [p, q] = cond.c;
    const r = fr(-q, p);
    if (cond.rel === '!=') {
      if (q !== 0) lines.push({ tex: `${monoX(p)}\\mathrel{\\char"2260} ${-q}` });
      lines.push({ tex: `x\\mathrel{\\char"2260} ${frTex(r)}` });
      set = without([ep(r)]);
      text = 'Najdeme číslo, pro které by byl výraz nulový, a to vyloučíme.';
    } else {
      if (q !== 0) lines.push({ tex: `${monoX(p)}${relTex(cond.rel)}${-q}` });
      const rel2 = p < 0 ? flipRel(cond.rel) : cond.rel;
      if (p !== 1) {
        lines.push(p < 0
          ? { tex: `x${cls('obrat', relTex(rel2))}${frTex(r)}`, notes: [{ kind: 'brace', target: 'bt-obrat', label: `:(${p}) obrátí znak`, position: 'below' }] }
          : { tex: `x${relTex(rel2)}${frTex(r)}` });
      }
      set = halfLine(rel2, r);
      text = `Lineární nerovnici řešíme jako rovnici: číslo převedeme na druhou stranu a vydělíme číslem u $x$.${p < 0 ? ' Dělíme záporným číslem, proto se znak nerovnosti obrátí.' : ''}`;
    }
  } else if (cond.t === 'poly') {
    let c = cond.c; let rel = cond.rel;
    const pre = [];
    if (c[0] < 0) {
      c = scale(c, -1); rel = flipRel(rel);
      lines.push({ tex: `${cls('krat', `${polyTex(c)}${relTex(rel)}0`)}`, notes: [{ kind: 'brace', target: 'bt-krat', label: rel === '!=' ? '·(−1)' : '·(−1), znak se obrátí', position: 'below' }] });
      pre.push(rel === '!=' ? 'Vynásobíme $-1$, aby u nejvyšší mocniny bylo kladné číslo.' : 'Nejdřív celou nerovnici vynásobíme číslem $-1$, aby u nejvyšší mocniny bylo kladné číslo – znak nerovnosti se přitom obrátí.');
    }
    const F = factorPoly(c);
    lines.push(...F.lines);
    const roots = F.factors.map((f) => ep(f.root));
    if (F.none) {
      set = rel === '<' || rel === '<=' ? [] : REALS;
      pre.push('Kvadratický výraz nemá reálné kořeny, takže má všude stejné znaménko jako číslo u $x^2$ – je pořád kladný.');
    } else if (rel === '!=') {
      lines.push({ tex: roots.map((e) => `x\\mathrel{\\char"2260} ${e.tex}`).join(',\\ ') });
      set = without(roots);
      pre.push(c.length === 4
        ? 'Jmenovatel je třetího stupně: rozložíme ho vytknutím nebo seskupením členů na součin a najdeme všechna čísla, pro která je nulový. Ta vyloučíme.'
        : 'Najdeme kořeny výrazu (rozkladem nebo přes diskriminant) – v nich by se dělilo nulou, proto je vyloučíme.');
    } else {
      const prod = F.extraTex
        ? `${F.factors.length === 1 && F.k === 1 ? `(${productTex(1, F.factors)})` : productTex(F.k, F.factors)}${F.extraTex}`
        : productTex(F.k, F.factors);
      lines.push({ tex: `${prod}${relTex(rel)}0` });
      const s = signSolve(F.factors, [], rel);
      set = s.set;
      viz = { kind: 'signchart', data: { ...s.chart, alt: 'Tabulka znamének součinu' } };
      if (F.extraTex) pre.push('Kvadratický činitel nemá reálné kořeny a je stále kladný, proto o znaménku součinu nerozhoduje a v tabulce ho nemusíme psát.');
      pre.push(`Výraz rozložíme na součin kořenových činitelů (kořeny najdeme rozkladem nebo přes diskriminant). V tabulce znamének je každý činitel jeden řádek a poslední řádek V je celý součin; vybereme intervaly se znaménkem ${rel === '>' || rel === '>=' ? '+' : '−'}.${rel === '>=' || rel === '<=' ? ' Nulové body do výsledku patří, nerovnost je neostrá.' : ' Nulové body do výsledku nepatří, nerovnost je ostrá.'}`);
    }
    text = pre.join(' ');
  } else if (cond.t === 'quot') {
    let [p1, q1] = cond.num; let [p2, q2] = cond.den; let rel = cond.rel;
    const flips = (p1 < 0 ? 1 : 0) + (p2 < 0 ? 1 : 0);
    if (p1 < 0) { p1 = -p1; q1 = -q1; }
    if (p2 < 0) { p2 = -p2; q2 = -q2; }
    if (flips) {
      if (flips === 1) rel = flipRel(rel);
      lines.push({ tex: cls('krat', `\\frac{${linTex(p1, q1)}}{${linTex(p2, q2)}}${relTex(rel)}0`), notes: [{ kind: 'brace', target: 'bt-krat', label: flips === 1 ? '·(−1), znak se obrátí' : 'čitatel i jmenovatel ·(−1)', position: 'below' }] });
    }
    const r1 = fr(-q1, p1); const r2 = fr(-q2, p2);
    lines.push({ tex: `\\text{čitatel: }x=${frTex(r1)}` }, { tex: `\\text{jmenovatel: }x=${frTex(r2)}` });
    const s = signSolve([{ p: r1.d, q: -r1.n, root: r1, m: 1 }], [{ p: r2.d, q: -r2.n, root: r2, m: 1 }], rel);
    set = s.set;
    viz = { kind: 'signchart', data: { ...s.chart, alt: 'Tabulka znamének podílu' } };
    text = `${flips ? 'Nejdřív zařídíme kladná čísla u $x$ (násobení $-1$; když jen v čitateli nebo jen ve jmenovateli, znak nerovnosti se obrátí). ' : ''}Nerovnici s podílem nenásobíme jmenovatelem – neznáme jeho znaménko. Najdeme nulové body čitatele a jmenovatele a v tabulce znamének určíme znaménko podílu (řádek V). Nulový bod jmenovatele do výsledku nikdy nepatří (✗).`;
  } else if (cond.t === 'ne1') {
    const [p, q] = cond.c;
    lines.push({ tex: `${polyTex(cond.c)}\\mathrel{\\char"2260} 1` });
    if (q !== 0) lines.push({ tex: `${monoX(p)}\\mathrel{\\char"2260} ${1 - q}` });
    const r = fr(1 - q, p);
    lines.push({ tex: `x\\mathrel{\\char"2260} ${frTex(r)}` });
    set = without([ep(r)]);
    text = 'Logaritmus je nulový jen pro argument 1 ($\\ln 1 = 0$), proto argument nesmí být roven jedné.';
  } else if (cond.t === 'asin') {
    const [a, b] = cond.lin; const c = cond.c;
    if (c !== 1) lines.push({ tex: `-${c}\\le ${polyTex(cond.lin)}\\le ${c}` });
    if (b !== 0) lines.push({ tex: `${-c - b}\\le ${monoX(a)}\\le ${c - b}` });
    const lo = fr(-c - b, a); const hi = fr(c - b, a);
    if (a !== 1) {
      if (a < 0) lines.push({ tex: `${frTex(lo)}${cls('obrat', '\\ge')} x\\ge ${frTex(hi)}`, notes: [{ kind: 'brace', target: 'bt-obrat', label: `:(${a}) obrátí znaky`, position: 'below' }] });
      lines.push({ tex: `${frTex(a < 0 ? hi : lo)}\\le x\\le ${frTex(a < 0 ? lo : hi)}` });
    }
    set = [iv(ep(a < 0 ? hi : lo), ep(a < 0 ? lo : hi), true, true)];
    text = `Dvojitou nerovnici upravujeme ve všech třech částech najednou: ${c !== 1 ? `vynásobíme číslem ${c}, ` : ''}${b !== 0 ? 'odečteme číslo u výrazu, ' : ''}vydělíme číslem u $x$${a < 0 ? ' – je záporné, takže se oba znaky nerovnosti obrátí' : ''}. Krajní body patří do výsledku.`;
  }
  lines.push(...setLines('x\\in ', set));
  return { lines: dedupe(lines), viz, set, text };
}

export function solveDomain(type, data) {
  const parts = data.parts;
  const conds = conditionsOf(parts);
  if (!conds.length) throw new Error('definiční obor: žádná podmínka');
  const fTex = `f(x)=${domainFnTex(parts)}`;
  const kinds = [...new Set(parts.map((p) => p.k))];
  const multi = conds.length > 1;
  const steps = [];
  const condLines = conds.map((c, i) => ({ tex: cls(`c${i + 1}`, c.tex), notes: [{ kind: 'brace', target: `bt-c${i + 1}`, label: `${multi ? `${i + 1}. ` : ''}${c.label}`, position: 'below' }] }));
  for (const p of parts) if (p.k === 'cbrt') condLines.push({ tex: `\\sqrt[3]{${polyTex(p.poly)}}:\\ \\text{bez podmínky}` });
  steps.push({
    title: multi ? 'Podmínky' : 'Podmínka',
    text: `Hledáme všechna čísla $x$, pro která má předpis smysl. ${kinds.map((k) => RULES[k]).join(' ')}${multi ? ' Všechny podmínky musí platit zároveň.' : ''}`,
    board: condLines,
  });
  const sets = [];
  conds.forEach((c, i) => {
    const r = solveCond(c, multi);
    sets.push(r.set);
    steps.push({ title: multi ? `Podmínka ${i + 1}` : 'Řešení podmínky', text: r.text, board: r.lines, ...(r.viz ? { viz: r.viz } : {}) });
  });
  const D = sets.reduce((A, B) => intersect(A, B), REALS);
  if (!D.length) throw new Error('definiční obor: prázdná množina');
  steps.push({
    title: 'Definiční obor',
    text: multi
      ? 'Definiční obor je průnik: čísla, která splňují všechny podmínky současně. Na obrázku je každá podmínka jeden řádek (✓ splněno, ● krajní bod patří, ○ nepatří), poslední řádek D je výsledek.'
      : 'Definiční obor tvoří čísla, která podmínku splňují. Zapíšeme je jako interval nebo sjednocení intervalů.',
    board: setLines('D(f)=', D, { result: true }),
    ...(multi ? { viz: { kind: 'signchart', data: meetChart(sets, sets.map((_, i) => `${i + 1}.`), D) } } : {}),
  });
  return {
    id: idOf(type, data), topic: TOPIC, type, data,
    task: `Urči definiční obor funkce $f$. ${INTERVAL_FORMAT}`,
    promptTex: fTex,
    answerSpec: { kind: 'interval', value: setStr(D) },
    answerTex: setTex(D),
    solution: steps,
  };
}

// ---------- generátory definičních oborů ----------
// krajní body výsledku v rozumném rozsahu (|x| ≤ 8, zlomky se jmenovatelem nejvýš 6)
const niceStr = (s) => (s.match(/\d+(\/\d+)?/g) || []).every((t) => { const [n, d = 1] = t.split('/').map(Number); return n / d <= 8 && d <= 6; });
// Jmenovatel nezačíná minusem: −1/Q zapíšeme jako −(1/(−Q)), u podílu rozšíříme číslem −1.
function fixDen(p) {
  const neg = (c) => polyTex(c).startsWith('-');
  if ((p.k === 'frac' || p.k === 'cbrtDen') && neg(p.poly)) {
    p.poly = scale(p.poly, -1);
    if (p.s === -1) delete p.s; else p.s = -1;
  }
  if ((p.k === 'sqrtQuot' || p.k === 'lnQuot') && neg(p.den)) { p.den = scale(p.den, -1); p.num = scale(p.num, -1); }
  return p;
}
function tryDomain(type, data) {
  data.parts.forEach(fixDen);
  if (data.parts[0].s === -1 && data.parts.length > 1) [data.parts[0], data.parts[1]] = [data.parts[1], data.parts[0]];
  try {
    const p = solveDomain(type, data);
    const D = p.answerSpec.value;
    if (D === '(-∞; ∞)' && data.parts.length > 1) return null;
    return niceStr(D) ? p : null;
  } catch { return null; }
}
// náhodný kvadratický výraz s racionálními kořeny (nebo bez kořenů)
function randQuad(rng) {
  const r = rng();
  const sgn = pick(rng, [1, -1]);
  if (r < 0.45) { const a = rnz(rng, -5, 5); let b = rnz(rng, -5, 5); if (a === b) b = a + 1; return scale(quadFrom(1, a, 1, b), sgn); }
  if (r < 0.6) { const p = pick(rng, [2, 3]); let n = rnz(rng, -5, 5); if (gcd(p, n) !== 1) n += 1; if (n === 0) n = 1; return scale(quadFrom(1, rnz(rng, -4, 4), p, n), sgn); }
  if (r < 0.75) { const t = ri(rng, 1, 6); return sgn > 0 ? [1, 0, -t * t] : [-1, 0, t * t]; }
  if (r < 0.88) { const a = rnz(rng, -5, 5); return scale([1, -a, 0], sgn); }
  return [1, ri(rng, -2, 2) * 2, ri(rng, 6, 12)]; // bez reálných kořenů (D < 0)
}
const randLin = (rng) => { const p = pick(rng, [1, 1, 1, 2, -1, -1, 3, -2]); return [p, ri(rng, -6, 6)]; };

function genZlomek(rng) {
  for (;;) {
    const r = rng();
    let poly;
    if (r < 0.45) { const a = rnz(rng, -6, 6); let b = ri(rng, -6, 6); if (a === b) b = -a; poly = quadFrom(1, a, 1, b); }
    else if (r < 0.6) { const p = pick(rng, [2, 3]); const n = pick(rng, [1, -1, 5, -5, 7]); poly = quadFrom(1, rnz(rng, -4, 4), p, n); }
    else if (r < 0.7) { const a = rnz(rng, -4, 4); poly = quadFrom(1, a, 1, a); }
    else if (r < 0.85) { const a = rnz(rng, -4, 4); let b = rnz(rng, -4, 4); if (a === b) b = -a; poly = [1, -(a + b), a * b, 0]; }
    else { const b = rnz(rng, -4, 4); const t = ri(rng, 1, 4); poly = [1, b, -t * t, -b * t * t]; if (Math.abs(b) === t) continue; }
    if (rng() < 0.3) poly = scale(poly, -1);
    const num = pick(rng, [[1], [1, rnz(rng, -5, 5)], [2, rnz(rng, -5, 5)], [1, 0, rnz(rng, -4, 4)], [3]]);
    const p = tryDomain('obor-zlomek', { parts: [{ k: 'frac', num, poly }] });
    if (p) return p;
  }
}
function genOdmocnina(rng) {
  for (;;) {
    const poly = randQuad(rng);
    const k = rng() < 0.3 ? 'sqrtDen' : 'sqrt';
    const part = { k, poly };
    if (rng() < 0.25) part.n = 4;
    if (k === 'sqrtDen' && rng() < 0.4) part.num = [1, rnz(rng, -4, 4)];
    const p = tryDomain('obor-odmocnina', { parts: [part] });
    if (p && p.answerSpec.value !== '(-∞; ∞)' ? true : p && rng() < 0.15) return p;
  }
}
function genPodil(rng) {
  for (;;) {
    const num = randLin(rng); const den = randLin(rng);
    if (num[0] * den[1] === num[1] * den[0]) continue;
    const k = rng() < 0.5 ? 'lnQuot' : 'sqrtQuot';
    const part = { k, num, den };
    if (k === 'lnQuot' && rng() < 0.3) part.f = 'log';
    const p = tryDomain('obor-podil', { parts: [part] });
    if (p) return p;
  }
}
function genArcsin(rng) {
  for (;;) {
    const c = pick(rng, [1, 1, 2, 3, 4, 5, 6]);
    const a = pick(rng, [1, 2, -1, 3, -2, 4, -5]);
    const b = ri(rng, -6, 6);
    const parts = [{ k: 'asin', lin: [a, b], c, ...(rng() < 0.4 ? { fn: 'acos' } : {}) }];
    if (rng() < 0.6) {
      const lin = randLin(rng);
      parts.push(pick(rng, [{ k: 'ln', poly: lin, s: -1 }, { k: 'sqrt', poly: lin }, { k: 'frac', poly: lin }]));
    }
    const p = tryDomain('obor-arcsin', { parts });
    if (!p) continue;
    if (parts.length > 1) {
      const solo = solveDomain('obor-arcsin', { parts: [parts[0]] });
      if (solo.answerSpec.value === p.answerSpec.value) continue; // druhá část musí obor změnit
    }
    return p;
  }
}
function randPart(rng) {
  const kind = pick(rng, ['sqrt', 'sqrt', 'sqrtDen', 'ln', 'ln', 'lnDen', 'frac', 'frac', 'cbrt', 'cbrtDen']);
  const lin = randLin(rng);
  const poly = kind === 'lnDen' || rng() < 0.55 ? lin : randQuad(rng);
  const part = { k: kind, poly };
  if (kind === 'ln' && rng() < 0.3) part.f = 'log';
  if (rng() < 0.3) part.s = -1;
  return part;
}
function genKombinace(rng) {
  for (;;) {
    const parts = [randPart(rng), randPart(rng)];
    if (rng() < 0.2) parts.push(randPart(rng));
    if (parts.every((p) => p.k === 'cbrt')) continue;
    if (parts[0].s === -1) delete parts[0].s;
    const p = tryDomain('obor-kombinace', { parts });
    if (!p) continue;
    // každá podmínka musí výsledek opravdu ovlivnit
    const conds = conditionsOf(parts);
    if (conds.length < 2) continue;
    return p;
  }
}

// =====================================================================
// DEFINIČNÍ OBOR s goniometrickou funkcí na omezeném intervalu
// data = { r, rad: 'sqrt'|'sqrtDen'|'ln', g: 'tg'|'cotg'|'sqrtsin'|'sqrtcos' }
// f(x) = √(r² − x²) (nebo 1/√…) + g(x)
const G_TEX = { tg: '\\operatorname{tg}x', cotg: '\\operatorname{cotg}x', sqrtsin: '\\sqrt{\\sin x}', sqrtcos: '\\sqrt{\\cos x}' };
const piPt = (k) => ep(fr(0), k); // k·π/2
function gonioSet(g) {
  // množina z druhé podmínky v okolí nuly (pokryje |x| ≤ 12)
  if (g === 'tg') return without(Array.from({ length: 9 }, (_, i) => piPt(2 * (i - 4) + 1)));
  if (g === 'cotg') return without(Array.from({ length: 9 }, (_, i) => piPt(2 * (i - 4))));
  const out = [];
  for (let k = -3; k <= 3; k++) {
    if (g === 'sqrtsin') out.push(iv(piPt(4 * k), piPt(4 * k + 2), true, true));
    else out.push(iv(piPt(4 * k - 1), piPt(4 * k + 1), true, true));
  }
  return normalize(out);
}
export function solveGonio(data) {
  const { r, rad, g } = data;
  const r2 = r * r;
  const isLn = rad === 'ln';
  const strict = rad === 'sqrtDen' || isLn;
  const radTex = isLn ? `\\ln(${r2}-x^2)` : strict ? `\\frac{1}{\\sqrt{${r2}-x^2}}` : `\\sqrt{${r2}-x^2}`;
  const fTex = `f(x)=${radTex}+${G_TEX[g]}`;
  const rel = strict ? '>' : '\\ge';
  const c2 = { tg: '\\cos x\\mathrel{\\char"2260} 0', cotg: '\\sin x\\mathrel{\\char"2260} 0', sqrtsin: '\\sin x\\ge 0', sqrtcos: '\\cos x\\ge 0' }[g];
  const label2 = { tg: 'tg x = sin x / cos x', cotg: 'cotg x = cos x / sin x', sqrtsin: 'sudá odmocnina', sqrtcos: 'sudá odmocnina' }[g];
  const steps = [{
    title: 'Podmínky',
    text: `${isLn ? 'Argument logaritmu musí být kladný.' : strict ? 'Odmocnina ve jmenovateli: výraz pod ní musí být kladný.' : 'Pod sudou odmocninou nesmí být záporné číslo.'} ${g === 'tg' || g === 'cotg' ? `Funkce ${g === 'tg' ? 'tangens je podíl $\\frac{\\sin x}{\\cos x}$, takže kosinus' : 'kotangens je podíl $\\frac{\\cos x}{\\sin x}$, takže sinus'} nesmí být nula.` : `Také ${g === 'sqrtsin' ? 'sinus' : 'kosinus'} pod odmocninou musí být nezáporný.`} Obě podmínky musí platit zároveň.`,
    board: [
      { tex: cls('c1', `${r2}-x^2${rel}0`), notes: [{ kind: 'brace', target: 'bt-c1', label: `1. ${isLn ? 'argument logaritmu' : strict ? 'odmocnina ve jmenovateli' : 'sudá odmocnina'}`, position: 'below' }] },
      { tex: cls('c2', c2), notes: [{ kind: 'brace', target: 'bt-c2', label: `2. ${label2}`, position: 'below' }] },
    ],
  }];
  const S1 = [iv(ep(-r), ep(r), !strict, !strict)];
  steps.push({
    title: 'Podmínka 1',
    text: `Převedeme $x^2$ na druhou stranu. Nerovnost $x^2${strict ? '<' : '\\le'} ${r2}$ splňují čísla, jejichž vzdálenost od nuly (absolutní hodnota) je ${strict ? 'menší než' : 'nejvýš'} $${r}$.`,
    board: [
      { tex: `${r2}-x^2${rel}0` },
      { tex: `x^2${strict ? '<' : '\\le'}${r2}` },
      { tex: `|x|${strict ? '<' : '\\le'}${r}` },
      ...setLines('x\\in ', S1),
    ],
  });
  const S2 = gonioSet(g);
  const inside = intersect(S2, [iv(ep(-r), ep(r), true, true)]);
  let lines2; let text2; let viz2;
  const R = r + 0.6;
  if (g === 'tg' || g === 'cotg') {
    const pts = (g === 'tg' ? [-7, -5, -3, -1, 1, 3, 5, 7] : [-6, -4, -2, 0, 2, 4, 6]).map(piPt).filter((e) => Math.abs(e.v) < r);
    lines2 = [
      { tex: c2 },
      { tex: g === 'tg' ? 'x\\mathrel{\\char"2260}\\frac{\\pi}{2}+k\\pi,\\ k\\in\\mathbb{Z}' : 'x\\mathrel{\\char"2260} k\\pi,\\ k\\in\\mathbb{Z}' },
      { tex: `\\text{v }(-${r};\\ ${r}):` },
      { tex: `x\\mathrel{\\char"2260} ${pts.map((e) => e.tex).join(',\\ ')}` },
    ];
    text2 = `${g === 'tg' ? 'Kosinus je nulový v bodech $\\frac{\\pi}{2} + k\\pi$' : 'Sinus je nulový v bodech $k\\pi$'} ($k$ je celé číslo). Z nich nás zajímají jen ty, které leží v intervalu z podmínky 1 (připomeň si $\\pi \\approx 3{,}14$, $\\frac{\\pi}{2} \\approx 1{,}57$). Na grafu jsou to svislé asymptoty.`;
    viz2 = {
      kind: 'plot',
      data: {
        domain: [-R, R], range: [-4, 4],
        functions: [{ expr: g === 'tg' ? 'tan(x)' : 'cos(x)/sin(x)' }],
        asymptotes: pts.map((e) => ({ kind: 'vertical', x: e.v })),
        alt: g === 'tg' ? 'Graf funkce tangens' : 'Graf funkce kotangens',
      },
    };
  } else {
    lines2 = [
      { tex: c2 },
      { tex: g === 'sqrtsin' ? 'x\\in\\langle 2k\\pi;\\ \\pi+2k\\pi\\rangle' : 'x\\in\\langle -\\frac{\\pi}{2}+2k\\pi;\\ \\frac{\\pi}{2}+2k\\pi\\rangle' },
      { tex: `\\text{v }\\langle -${r};\\ ${r}\\rangle:` },
      ...setLines('x\\in ', inside),
    ];
    text2 = `${g === 'sqrtsin' ? 'Sinus je nezáporný na intervalech $\\langle 0;\\ \\pi\\rangle$, $\\langle 2\\pi;\\ 3\\pi\\rangle$, $\\langle -2\\pi;\\ -\\pi\\rangle$ atd.' : 'Kosinus je nezáporný na intervalech $\\langle -\\frac{\\pi}{2};\\ \\frac{\\pi}{2}\\rangle$, $\\langle \\frac{3\\pi}{2};\\ \\frac{5\\pi}{2}\\rangle$ atd.'} (perioda $2\\pi$, $k$ je celé číslo). Na grafu jsou to místa, kde je křivka nad osou $x$. Vypíšeme jen části, které zasahují do intervalu z podmínky 1 ($\\pi \\approx 3{,}14$).`;
    viz2 = {
      kind: 'plot',
      data: {
        domain: [-R, R], range: [-1.5, 1.5],
        functions: [{ expr: g === 'sqrtsin' ? 'sin(x)' : 'cos(x)' }],
        asymptotes: [{ kind: 'vertical', x: -r, label: `−${r}` }, { kind: 'vertical', x: r, label: `${r}` }],
        alt: g === 'sqrtsin' ? 'Graf funkce sinus' : 'Graf funkce kosinus',
      },
    };
  }
  steps.push({ title: 'Podmínka 2', text: text2, board: lines2, viz: viz2 });
  const D = intersect(S1, S2);
  steps.push({
    title: 'Definiční obor',
    text: 'Definiční obor je průnik obou podmínek. Na obrázku je každá podmínka jeden řádek (✓ splněno, ● krajní bod patří, ○ nepatří), poslední řádek D je výsledek.',
    board: setLines('D(f)=', D, { result: true, max: 20 }),
    viz: { kind: 'signchart', data: meetChart([S1, inside], ['1.', '2.'], D) },
  });
  return {
    id: idOf('obor-goniometricke', data), topic: TOPIC, type: 'obor-goniometricke', data,
    task: `Urči definiční obor funkce $f$. ${INTERVAL_FORMAT} Číslo π zapiš jako pi nebo π, např. 3pi/2.`,
    promptTex: fTex,
    answerSpec: { kind: 'interval', value: setStr(D) },
    answerTex: setTex(D),
    solution: steps,
  };
}
function genGonio(rng) {
  const g = pick(rng, ['tg', 'cotg', 'sqrtsin', 'sqrtcos']);
  const r = ri(rng, g === 'cotg' ? 3 : 2, 9);
  const u = rng();
  return solveGonio({ r, rad: u < 0.2 ? 'sqrtDen' : u < 0.4 ? 'ln' : 'sqrt', g });
}

// =====================================================================
// PARITA
// data = { kind: 'sum', num: Term[], den?: Term[] } | { kind: 'root', a } | { kind: 'logq', a, inv? }
// Term = { c, n, g }: c·x^n·g(x), g ∈ one | sin | cos | tg | cotg | abs | exp (e^x) | expm (e^{−x})
const G_ODD = { one: 1, sin: -1, cos: 1, tg: -1, cotg: -1, abs: 1, exp: 0, expm: 0 };
const G_ATOM = { one: '', sin: '\\sin x', cos: '\\cos x', tg: '\\operatorname{tg}x', cotg: '\\operatorname{cotg}x', abs: '|x|', exp: 'e^{x}', expm: 'e^{-x}' };
const G_SUB = { one: '', sin: '\\sin(-x)', cos: '\\cos(-x)', tg: '\\operatorname{tg}(-x)', cotg: '\\operatorname{cotg}(-x)', abs: '|-x|', exp: 'e^{-x}', expm: 'e^{-(-x)}' };
const SWAP = { exp: 'expm', expm: 'exp' };
function termTex(t, first, sub = false) {
  const s = t.c < 0 ? '-' : first ? '' : '+';
  const a = Math.abs(t.c);
  const xp = t.n === 0 ? '' : sub ? (t.n === 1 ? '(-x)' : `(-x)^${t.n}`) : (t.n === 1 ? 'x' : `x^${t.n}`);
  const g = sub ? G_SUB[t.g] : G_ATOM[t.g];
  const body = `${xp}${g}`;
  if (!body) return `${s}${a}`;
  return `${s}${a === 1 ? '' : a}${body}`;
}
const sumTex = (ts, sub = false) => ts.map((t, i) => termTex(t, i === 0, sub)).join('');
// člen po dosazení −x a úpravě
const subTerm = (t) => (G_ODD[t.g] === 0
  ? { c: t.c * (t.n % 2 ? -1 : 1), n: t.n, g: SWAP[t.g] }
  : { c: t.c * (t.n % 2 ? -1 : 1) * G_ODD[t.g], n: t.n, g: t.g });
const keyOf = (ts) => ts.map((t) => `${t.c}|${t.n}|${t.g}`).sort().join(';');
function sumParity(ts) {
  const s = ts.map(subTerm);
  if (keyOf(s) === keyOf(ts)) return 1;
  if (keyOf(s) === keyOf(ts.map((t) => ({ ...t, c: -t.c })))) return -1;
  return 0;
}
// jmenovatel začínající minusem se dá do závorky (minus se pak vytkne)
const fracOrSum = (num, den, sub = false) => {
  if (!den) return sumTex(num, sub);
  // záporný první člen jmenovatele: minus se přesune před zlomek (jmenovatel nikdy nezačíná minusem)
  if (den[0].c < 0) return `-\\frac{${sumTex(num, sub)}}{${sumTex(den.map((t) => ({ ...t, c: -t.c })), sub)}}`;
  return `\\frac{${sumTex(num, sub)}}{${sumTex(den, sub)}}`;
};
const isPoly = (ts) => ts.every((t) => t.g === 'one');
const polyOf = (ts) => {
  const d = Math.max(...ts.map((t) => t.n));
  const c = Array(d + 1).fill(0);
  for (const t of ts) c[d - t.n] += t.c;
  return c;
};
// hodnota součtu (jen mocniny, |x|) v celém čísle x jako zlomek
const sumAt = (ts, x) => ts.reduce((s, t) => s + t.c * x ** t.n * (t.g === 'abs' ? Math.abs(x) : 1), 0);

// definiční obor jmenovatele: { lines, roots? (celočíselné kořeny mnohočlenu) }
function denDomain(den) {
  if (isPoly(den)) {
    const c = polyOf(den);
    const roots = [];
    for (let x = -12; x <= 12; x++) if (c.reduce((s, a) => s * x + a, 0) === 0) roots.push(x);
    const lines = [{ tex: `${sumTex(den)}\\mathrel{\\char"2260} 0` }];
    lines.push({ tex: roots.length ? `D(f)=\\mathbb{R}\\setminus\\{${roots.join(',\\ ')}\\}` : 'D(f)=\\mathbb{R}' });
    return { lines, roots };
  }
  const k = keyOf(den.map((t) => ({ ...t, c: Math.sign(t.c) })));
  const map = {
    '1|0|cos': ['\\cos x\\mathrel{\\char"2260} 0', 'x\\mathrel{\\char"2260}\\frac{\\pi}{2}+k\\pi'],
    '1|0|sin': ['\\sin x\\mathrel{\\char"2260} 0', 'x\\mathrel{\\char"2260} k\\pi'],
    '1|0|abs': ['|x|\\mathrel{\\char"2260} 0', 'x\\mathrel{\\char"2260} 0'],
    '1|0|cotg': ['\\operatorname{cotg}x\\ \\text{existuje a}\\mathrel{\\char"2260} 0', 'x\\mathrel{\\char"2260} k\\frac{\\pi}{2}'],
    '1|0|cos;1|0|one': ['1+\\cos x\\mathrel{\\char"2260} 0', 'x\\mathrel{\\char"2260}\\pi+2k\\pi'],
    '-1|0|cos;1|0|one': ['1-\\cos x\\mathrel{\\char"2260} 0', 'x\\mathrel{\\char"2260} 2k\\pi'],
    '1|0|exp;1|0|expm': ['e^{x}+e^{-x}>0', 'D(f)=\\mathbb{R}'],
  };
  const m = map[k];
  if (!m) throw new Error(`parita: nepodporovaný jmenovatel ${k}`);
  return { lines: m.map((tex) => ({ tex })), roots: [] };
}
const PAR_WORD = { 1: 'sudá', '-1': 'lichá', 0: 'ani sudá, ani lichá' };
const parTex = (p) => `\\text{${PAR_WORD[p]}}`;
// závěr na dvou řádcích pro dlouhé „ani sudá, ani lichá“ (úzká tabule)
const verdictLines = (p) => (p === 0 ? [{ tex: '\\text{funkce je}' }, resultLine('', parTex(p))] : [resultLine('\\text{funkce je }', parTex(p))]);

export function solveParita(data) {
  const steps = [];
  let fTex; let p;
  if (data.kind === 'root') {
    const { a } = data;
    fTex = `\\sqrt{${linTex(1, a)}}`;
    const v = Math.abs(a) + 1;
    p = 0;
    steps.push({
      title: 'Definiční obor',
      text: 'Sudá nebo lichá může být jen funkce, jejíž definiční obor je souměrný podle nuly: s každým číslem $x$ v něm musí ležet i $-x$. Pod odmocninou nesmí být záporné číslo.',
      board: [{ tex: `${linTex(1, a)}\\ge 0` }, { tex: `D(f)=\\langle ${-a};\\ \\infty)` }],
    });
    steps.push({
      title: 'Souměrnost oboru',
      text: `Definiční obor není souměrný podle nuly: číslo $${v}$ do něj patří, ale $${-v}$ ne. Funkce proto nemůže být ani sudá, ani lichá – rovnost s $f(-x)$ ani nemá smysl ověřovat.`,
      board: [{ tex: `${v}\\in D(f),\\ ${-v}\\notin D(f)` }],
    });
  } else if (data.kind === 'logq') {
    const { a, inv } = data;
    const top = inv ? linTex(1, a) : `${a}-x`; const bot = inv ? `${a}-x` : linTex(1, a);
    fTex = `\\ln\\frac{${top}}{${bot}}`;
    p = -1;
    steps.push({
      title: 'Definiční obor',
      text: `Logaritmus potřebuje kladný argument. Podíl je kladný právě mezi nulovými body $-${a}$ a $${a}$ (tabulka znamének jako u definičních oborů), takže obor je souměrný podle nuly.`,
      board: [{ tex: `\\frac{${top}}{${bot}}>0` }, { tex: `D(f)=(-${a};\\ ${a})` }],
    });
    steps.push({
      title: 'Dosazení −x',
      text: 'Za každé $x$ dosadíme $-x$. Po úpravě se čitatel a jmenovatel prohodí – zlomek se převrátí.',
      board: [{ tex: `f(-x)=\\ln\\frac{${inv ? `${a}-x` : linTex(1, a)}}{${inv ? linTex(1, a) : `${a}-x`}}` }],
    });
    steps.push({
      title: 'Porovnání',
      text: 'Převrácený zlomek je mocnina s exponentem $-1$ a exponent jde podle pravidla $\\ln a^k = k\\ln a$ před logaritmus. Vyšlo $-f(x)$.',
      board: [
        { tex: `=\\ln\\left(\\frac{${top}}{${bot}}\\right)^{-1}` },
        { tex: `=-\\ln\\frac{${top}}{${bot}}=-f(x)` },
        ...verdictLines(p),
      ],
    });
  } else {
    const { num, den } = data;
    fTex = fracOrSum(num, den);
    const pn = sumParity(num); const pd = den ? sumParity(den) : 1;
    let asym = null;
    if (den) {
      const dd = denDomain(den);
      if (dd.roots.length && dd.roots.some((r) => !dd.roots.includes(-r))) asym = dd.roots.find((r) => !dd.roots.includes(-r));
      steps.push({
        title: 'Definiční obor',
        text: `Sudá nebo lichá může být jen funkce, jejíž definiční obor je souměrný podle nuly (s každým $x$ obsahuje i $-x$). Jmenovatel nesmí být nulový.${asym === null ? ' Vyloučená čísla leží souměrně podle nuly, obor je tedy souměrný.' : ''}`,
        board: dd.lines,
      });
    } else {
      steps.push({
        title: 'Definiční obor',
        text: num.some((t) => t.g === 'tg')
          ? 'Sudá nebo lichá může být jen funkce, jejíž definiční obor je souměrný podle nuly. Tangens je podíl $\\frac{\\sin x}{\\cos x}$, vylučujeme body, kde je kosinus nulový – leží souměrně podle nuly.'
          : 'Sudá nebo lichá může být jen funkce, jejíž definiční obor je souměrný podle nuly. Tady není žádný zlomek ani odmocnina, předpis má smysl pro každé $x$.',
        board: num.some((t) => t.g === 'tg')
          ? [{ tex: '\\cos x\\mathrel{\\char"2260} 0' }, { tex: 'x\\mathrel{\\char"2260}\\frac{\\pi}{2}+k\\pi' }]
          : [{ tex: 'D(f)=\\mathbb{R}' }],
      });
    }
    if (asym !== null) {
      p = 0;
      steps.push({
        title: 'Souměrnost oboru',
        text: `Definiční obor není souměrný: číslo $${-asym}$ do něj patří, ale opačné číslo $${asym}$ ne. Funkce proto není ani sudá, ani lichá.`,
        board: [{ tex: `${-asym}\\in D(f),\\ ${asym}\\notin D(f)` }],
      });
    } else {
      p = pn !== 0 && pd !== 0 ? pn * pd : 0;
      const sN = num.map(subTerm); const sD = den ? den.map(subTerm) : null;
      steps.push({
        title: 'Dosazení −x',
        text: 'Za každé $x$ v předpisu dosadíme $-x$ (do závorky).',
        board: [{ tex: `f(-x)=${fracOrSum(num, den, true)}` }],
      });
      const rules = [];
      if ([...num, ...(den || [])].some((t) => t.n > 0)) rules.push('$(-x)^n$ je $x^n$ pro sudé $n$ a $-x^n$ pro liché $n$');
      const gs = new Set([...num, ...(den || [])].map((t) => t.g));
      if (gs.has('sin')) rules.push('$\\sin(-x) = -\\sin x$');
      if (gs.has('cos')) rules.push('$\\cos(-x) = \\cos x$');
      if (gs.has('tg')) rules.push('$\\operatorname{tg}(-x) = -\\operatorname{tg} x$');
      if (gs.has('cotg')) rules.push('$\\operatorname{cotg}(-x) = -\\operatorname{cotg} x$');
      if (gs.has('abs')) rules.push('$|-x| = |x|$');
      if (gs.has('exp') || gs.has('expm')) rules.push('$e^{-(-x)} = e^{x}$');
      // jednočlenný jmenovatel se záporným znaménkem: minus přesuneme do čitatele
      const moveSign = sD && sD.length === 1 && sD[0].c < 0;
      const lines = [{ tex: `f(-x)=${moveSign ? fracOrSum(sN.map((t) => ({ ...t, c: -t.c })), sD.map((t) => ({ ...t, c: -t.c }))) : fracOrSum(sN, sD)}` }];
      let text = `Upravíme podle pravidel: ${rules.join(', ')}.`;
      if (p !== 0) {
        const negN = pn === -1 && num.length > 1; const negD = den && pd === -1 && den.length > 1;
        if (negN || negD) {
          const nT = pn === -1 ? `-(${sumTex(num)})` : sumTex(num);
          // minus z jmenovatele se napíše před zlomek
          lines.push({ tex: `=${den ? `${pd === -1 ? '-' : ''}\\frac{${nT}}{${sumTex(den)}}` : nT}` });
        }
        if (p === 1) {
          if (flat(lines[lines.length - 1].tex) === flat(`f(-x)=${fTex}`)) lines[lines.length - 1].tex += '=f(x)';
          else lines.push({ tex: `=${fTex}=f(x)` });
        } else {
          const wrapped = den ? fTex : num.length > 1 || num[0].c < 0 ? `(${fTex})` : fTex;
          if (!den && negN) lines[lines.length - 1].tex += '=-f(x)'; // −(…) už je hotový tvar
          else if (flat(lines[lines.length - 1].tex) === flat(`=-${wrapped}`)) lines[lines.length - 1].tex += '=-f(x)';
          else lines.push({ tex: `=-${wrapped}=-f(x)` });
        }
        text += p === 1
          ? ` Po úpravě${pn === -1 ? ' (minus v čitateli i ve jmenovateli se zkrátí)' : ''} vyšel původní předpis: $f(-x) = f(x)$.`
          : ` Z čitatele${den ? ' (nebo jmenovatele)' : ''} vytkneme minus a dostaneme původní předpis s opačným znaménkem: $f(-x) = -f(x)$.`;
      } else {
        lines.push({ tex: 'f(-x)\\mathrel{\\char"2260} f(x)' }, { tex: 'f(-x)\\mathrel{\\char"2260} -f(x)' });
        text += ' Výsledek není roven ani $f(x)$, ani $-f(x)$ (některé členy změnily znaménko a jiné ne).';
        const pts = [1, 2, 3].filter((x) => {
          if (!isPoly(num) && !num.every((t) => t.g === 'one' || t.g === 'abs')) return false;
          const dv = den ? [x, -x].map((y) => sumAt(den, y)) : [1, 1];
          if (dv.some((v) => v === 0)) return false;
          const f1 = sumAt(num, x) / dv[0]; const f2 = sumAt(num, -x) / dv[1];
          return Math.abs(f1 - f2) > 1e-9 && Math.abs(f1 + f2) > 1e-9;
        });
        if (pts.length && (!den || isPoly(den) || den.every((t) => t.g === 'one' || t.g === 'abs'))) {
          const x = pts[0];
          const val = (y) => { const n = sumAt(num, y); const d = den ? sumAt(den, y) : 1; return frTex(fr(n, d)); };
          lines.push({ tex: `\\text{např. }f(${x})=${val(x)},\\ f(${-x})=${val(-x)}` });
          text += ` Ověříme to na čísle: $f(${x})$ a $f(${-x})$ nejsou stejné ani opačné.`;
        }
      }
      steps.push({ title: 'Úprava a porovnání', text, board: lines });
    }
    steps.push({
      title: 'Závěr',
      text: p === 1 ? 'Platí $f(-x) = f(x)$, funkce je sudá – její graf je souměrný podle osy $y$.'
        : p === -1 ? 'Platí $f(-x) = -f(x)$, funkce je lichá – její graf je souměrný podle počátku.'
          : 'Neplatí ani $f(-x) = f(x)$, ani $f(-x) = -f(x)$ pro všechna $x$, funkce není ani sudá, ani lichá.',
      board: verdictLines(p),
    });
  }
  if (data.kind === 'root') {
    steps.push({ title: 'Závěr', text: 'Funkce s nesouměrným definičním oborem není ani sudá, ani lichá.', board: verdictLines(p) });
  }
  return {
    id: idOf('parita', data), topic: TOPIC, type: 'parita', data,
    task: 'Rozhodni, zda je funkce $f$ sudá, lichá, nebo ani sudá, ani lichá. Odpověz číslem: 1 = sudá ($f(-x) = f(x)$), −1 = lichá ($f(-x) = -f(x)$), 0 = ani sudá, ani lichá.',
    promptTex: `f(x)=${fTex}`,
    answerSpec: { kind: 'number', value: p },
    answerTex: parTex(p),
    conclusion: `Funkce je ${PAR_WORD[p]}.`,
    solution: steps,
  };
}

const T = (c, n, g = 'one') => ({ c, n, g });
function randPolySum(rng, kind) {
  const ns = kind === 'even' ? [0, 2, 4] : kind === 'odd' ? [1, 3, 5] : [0, 1, 2, 3];
  for (;;) {
    const k = pick(rng, [1, 2, 2]);
    const chosen = [...ns].sort(() => rng() - 0.5).slice(0, k + (kind === 'mixed' ? 1 : 0)).sort((a, b) => b - a);
    const ts = chosen.map((n) => T(rnz(rng, -4, 4), n));
    if (kind === 'mixed' && sumParity(ts) !== 0) continue;
    return ts;
  }
}
function genParita(rng) {
  const r = rng();
  if (r < 0.1) return solveParita({ kind: 'root', a: rnz(rng, -3, 3) });
  if (r < 0.18) return solveParita({ kind: 'logq', a: ri(rng, 1, 5), inv: rng() < 0.5 });
  if (r < 0.55) {
    const num = randPolySum(rng, pick(rng, ['even', 'odd', 'mixed']));
    const t = ri(rng, 1, 4);
    const den = pick(rng, [null, null, [T(1, 2), T(ri(rng, 1, 5), 0)], [T(1, 2), T(-t * t, 0)], [T(1, 1)], [T(1, 3), T(-t * t, 1)], [T(1, 1), T(rnz(rng, -3, 3), 0)]]);
    return solveParita({ kind: 'sum', num, ...(den ? { den } : {}) });
  }
  const g = pick(rng, ['sin', 'cos', 'tg', 'abs']);
  const forms = [
    () => ({ num: [T(rnz(rng, -3, 3), ri(rng, 1, 3), g)] }),
    () => ({ num: [T(1, 1), T(pick(rng, [1, -1, 2]), 0, 'sin')] }),
    () => ({ num: [T(1, 2), T(pick(rng, [1, -1, 3]), 0, 'cos')] }),
    () => ({ num: [T(1, 0), T(-1, 0, 'cos')], den: [T(1, 0), T(1, 0, 'cos')] }),
    () => ({ num: [T(1, ri(rng, 1, 3))], den: [T(1, 0, pick(rng, ['abs', 'cos', 'sin']))] }),
    () => ({ num: [T(1, 1), T(1, 0, 'sin')], den: [T(1, 0, 'cotg')] }),
    () => ({ num: [T(1, 0, 'exp'), T(pick(rng, [1, -1]), 0, 'expm')] }),
    () => ({ num: [T(1, ri(rng, 1, 2))], den: [T(1, 0, 'exp'), T(1, 0, 'expm')] }),
    () => ({ num: [T(rnz(rng, -3, 3), 0, 'sin'), T(rnz(rng, -3, 3), 2)] }),
  ];
  return solveParita({ kind: 'sum', ...pick(rng, forms)() });
}

// =====================================================================
// INVERZNÍ FUNKCE
// data = { kind: 'lin', a, b }            y = ax + b
//      | { kind: 'mob', a, b, c, d }      y = (ax + b)/(cx + d)
//      | { kind: 'exp', k, m, n }         y = k·e^(x+m) + n
//      | { kind: 'ln', a, m, n }          y = a·ln(x+m) + n
//      | { kind: 'sqrt', s, m, n }        y = n + s·√(x+m), s = ±1
const coefV = (a, v) => (a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`);
// a·v1 + b·v2 + … (nulové členy vynechá), terms = [[koeficient, proměnná nebo '']]
function combo(terms) {
  const out = terms.filter(([a]) => a !== 0).map(([a, v], i) => {
    const t = v ? coefV(a, v) : String(a);
    return i === 0 || t.startsWith('-') ? t : `+${t}`;
  }).join('');
  return out || '0';
}
const plusN = (n) => (n === 0 ? '' : n > 0 ? `+${n}` : `${n}`);
const shift = (v, m) => (m === 0 ? v : `${v}${m > 0 ? '+' : '-'}${Math.abs(m)}`); // v + m
const minusN = (v, n) => shift(v, -n); // v − n
const S = (v) => `(${v})`; // pro výrazy math.js

export function solveInverzni(data) {
  const steps = [];
  let fTex; let invTex; let invExpr; let fExpr; let Dtex; let Htex; let mono; let plot = {};
  if (data.kind === 'lin') {
    const { a, b } = data;
    fTex = combo([[a, 'x'], [b, '']]);
    fExpr = `${S(a)}*x+${S(b)}`;
    Dtex = '\\mathbb{R}'; Htex = '\\mathbb{R}';
    mono = a > 0 ? 'rostoucí' : 'klesající';
    const lines = [];
    if (b !== 0) lines.push({ tex: `${coefV(a, 'y')}=${minusN('x', b)}` });
    if (a === 1) invTex = minusN('x', b);
    else if (a === -1) invTex = b === 0 ? '-x' : `${b}-x`;
    else if (a > 0) invTex = `\\frac{${minusN('x', b)}}{${a}}`;
    else invTex = b === 0 ? `-\\frac{x}{${-a}}` : `\\frac{${b}-x}{${-a}}`;
    lines.push({ tex: `y=${invTex}` });
    invExpr = `(x-${S(b)})/${S(a)}`;
    steps.push({ title: 'Je funkce prostá?', text: `Lineární funkce s nenulovým číslem u $x$ je ${mono} na celém $\\mathbb{R}$, takže je prostá a inverzní funkce existuje. Definiční obor i obor hodnot jsou celá $\\mathbb{R}$.`, board: [{ tex: `D(f)=\\mathbb{R},\\ H(f)=\\mathbb{R}` }, { tex: `\\text{${mono}}\\Rightarrow\\text{prostá}` }] });
    steps.push({ title: 'Záměna x a y', text: 'Do předpisu $y = f(x)$ zapíšeme místo $x$ písmeno $y$ a naopak.', board: [{ tex: `x=${combo([[a, 'y'], [b, '']])}` }] });
    steps.push({ title: 'Vyjádření y', text: `Rovnici vyřešíme pro $y$: ${b !== 0 ? 'číslo převedeme na levou stranu' : ''}${b !== 0 && a !== 1 ? ' a ' : ''}${a !== 1 ? `vydělíme číslem $${a}$` : ''}.`, board: lines });
  } else if (data.kind === 'mob') {
    let { a, b, c, d } = data;
    const orig = `\\frac{${combo([[a, 'x'], [b, '']])}}{${c < 0 && d > 0 ? `${d}${coefV(c, 'x')}` : combo([[c, 'x'], [d, '']])}}`;
    fTex = orig;
    fExpr = `(${S(a)}*x+${S(b)})/(${S(c)}*x+${S(d)})`;
    const flipped = c < 0;
    if (flipped) { a = -a; b = -b; c = -c; d = -d; }
    const pole = fr(-d, c); const hor = fr(a, c);
    Dtex = `\\mathbb{R}\\setminus\\{${frTex(pole)}\\}`; Htex = `\\mathbb{R}\\setminus\\{${frTex(hor)}\\}`;
    steps.push({
      title: 'Je funkce prostá?',
      text: `Jmenovatel nesmí být nula, proto $x \\mathrel{\\char"2260} ${frTex(pole)}$. Grafem je hyperbola s asymptotami $x = ${frTex(pole)}$ a $y = ${frTex(hor)}$; každou hodnotu kromě $${frTex(hor)}$ nabývá právě jednou, takže je prostá a $H(f) = \\mathbb{R}\\setminus\\{${frTex(hor)}\\}$.`,
      board: [{ tex: `D(f)=${Dtex}` }, { tex: `H(f)=${Htex}` }],
    });
    steps.push({
      title: 'Záměna x a y',
      text: `Místo $x$ napíšeme $y$ a naopak.${flipped ? ' Zlomek jsme ještě rozšířili číslem $-1$, aby u $y$ ve jmenovateli bylo kladné číslo.' : ''}`,
      board: [{ tex: `x=\\frac{${combo([[a, 'y'], [b, '']])}}{${combo([[c, 'y'], [d, '']])}}` }],
    });
    const lines = [
      { tex: `x(${combo([[c, 'y'], [d, '']])})=${combo([[a, 'y'], [b, '']])}` },
      { tex: `${combo([[c, 'xy'], [d, 'x']])}=${combo([[a, 'y'], [b, '']])}` },
      { tex: `${combo([[c, 'xy'], [-a, 'y']])}=${combo([[b, ''], [-d, 'x']])}` },
    ];
    if (a !== 0) lines.push({ tex: `y(${combo([[c, 'x'], [-a, '']])})=${combo([[b, ''], [-d, 'x']])}` });
    invTex = `\\frac{${combo([[b, ''], [-d, 'x']])}}{${combo([[c, 'x'], [-a, '']])}}`;
    lines.push({ tex: `y=${invTex}` });
    invExpr = `(${S(b)}-${S(d)}*x)/(${S(c)}*x-${S(a)})`;
    steps.push({ title: 'Vyjádření y', text: 'Celou rovnici vynásobíme jmenovatelem, roznásobíme, členy s $y$ dáme na levou stranu a ostatní na pravou. Na levé straně vytkneme $y$ a vydělíme závorkou.', board: dedupe(lines) });
    plot = { asymptotes: [{ kind: 'vertical', x: toNum(pole) }, { kind: 'horizontal', y: toNum(hor) }, { kind: 'vertical', x: toNum(hor) }, { kind: 'horizontal', y: toNum(pole) }] };
  } else if (data.kind === 'exp') {
    const { k, m, n } = data;
    const ex = `e^{${shift('x', m)}}`;
    fTex = `${coefV(k, ex)}${plusN(n)}`;
    fExpr = `${S(k)}*exp(x+${S(m)})+${S(n)}`;
    Dtex = '\\mathbb{R}'; Htex = k > 0 ? `(${n};\\ \\infty)` : `(-\\infty;\\ ${n})`;
    mono = k > 0 ? 'rostoucí' : 'klesající';
    steps.push({ title: 'Je funkce prostá?', text: `Exponenciála $e^x$ je rostoucí a nabývá všech kladných hodnot. ${k < 0 ? 'Násobení záporným číslem ji převrátí (klesající, hodnoty záporné), ' : k !== 1 ? `Násobení číslem $${k}$ hodnoty jen natáhne, ` : ''}${n !== 0 ? `přičtení $${n}$ posune hodnoty o $${n}$.` : 'posun není žádný.'} Funkce je ${mono}, tedy prostá.`, board: [{ tex: `D(f)=\\mathbb{R}` }, { tex: `H(f)=${Htex}` }, { tex: `\\text{${mono}}\\Rightarrow\\text{prostá}` }] });
    const ey = `e^{${shift('y', m)}}`;
    steps.push({ title: 'Záměna x a y', text: 'Místo $x$ napíšeme $y$ a naopak.', board: [{ tex: `x=${coefV(k, ey)}${plusN(n)}` }] });
    const lines = [];
    if (n !== 0) lines.push({ tex: `${coefV(k, ey)}=${minusN('x', n)}` });
    let arg;
    if (k === 1) arg = minusN('x', n);
    else if (k > 0) arg = `\\frac{${minusN('x', n)}}{${k}}`;
    else arg = k === -1 ? `${n}-x` : `\\frac{${n}-x}{${-k}}`;
    if (k !== 1) lines.push({ tex: `${ey}=${arg}` });
    const lnArg = k === 1 || k === -1 ? `(${arg})` : arg;
    lines.push({ tex: `${shift('y', m)}=\\ln${lnArg}` });
    invTex = `\\ln${lnArg}${plusN(-m)}`;
    if (m !== 0) lines.push({ tex: `y=${invTex}` });
    invExpr = `log((x-${S(n)})/${S(k)})-${S(m)}`;
    steps.push({ title: 'Vyjádření y', text: `Osamostatníme exponenciálu (odečteme číslo${k !== 1 ? ' a vydělíme koeficientem' : ''}) a obě strany zlogaritmujeme: logaritmus je inverzní k exponenciále, $\\ln e^{t} = t$.${m !== 0 ? ' Nakonec převedeme číslo od $y$.' : ''}`, board: lines });
    plot = { asymptotes: [{ kind: 'horizontal', y: n }, { kind: 'vertical', x: n }] };
  } else if (data.kind === 'ln') {
    const { a, m, n } = data;
    const lx = `\\ln(${shift('x', m)})`;
    fTex = `${coefV(a, lx)}${plusN(n)}`;
    fExpr = `${S(a)}*log(x+${S(m)})+${S(n)}`;
    Dtex = `(${-m};\\ \\infty)`; Htex = '\\mathbb{R}';
    mono = a > 0 ? 'rostoucí' : 'klesající';
    steps.push({ title: 'Je funkce prostá?', text: `Logaritmus potřebuje kladný argument, proto $x > ${-m}$. Logaritmus je rostoucí a nabývá všech reálných hodnot; ${a < 0 ? 'záporný koeficient ho převrátí na klesající' : 'násobení kladným číslem a posun to nezmění'}. Funkce je ${mono}, tedy prostá.`, board: [{ tex: `D(f)=${Dtex}` }, { tex: 'H(f)=\\mathbb{R}' }, { tex: `\\text{${mono}}\\Rightarrow\\text{prostá}` }] });
    const ly = `\\ln(${shift('y', m)})`;
    steps.push({ title: 'Záměna x a y', text: 'Místo $x$ napíšeme $y$ a naopak.', board: [{ tex: `x=${coefV(a, ly)}${plusN(n)}` }] });
    const lines = [];
    if (n !== 0) lines.push({ tex: `${coefV(a, ly)}=${minusN('x', n)}` });
    let ex;
    if (a === 1) ex = minusN('x', n);
    else if (a > 0) ex = `\\frac{${minusN('x', n)}}{${a}}`;
    else ex = a === -1 ? `${n}-x` : `\\frac{${n}-x}{${-a}}`;
    if (a !== 1) lines.push({ tex: `${ly}=${ex}` });
    lines.push({ tex: `${shift('y', m)}=e^{${ex}}` });
    invTex = `e^{${ex}}${plusN(-m)}`;
    if (m !== 0) lines.push({ tex: `y=${invTex}` });
    invExpr = `exp((x-${S(n)})/${S(a)})-${S(m)}`;
    steps.push({ title: 'Vyjádření y', text: `Osamostatníme logaritmus a obě strany dáme do exponentu čísla $e$ (odlogaritmujeme): $e^{\\ln t} = t$.${m !== 0 ? ' Nakonec převedeme číslo od $y$.' : ''}`, board: lines });
    plot = { asymptotes: [{ kind: 'vertical', x: -m }, { kind: 'horizontal', y: -m }] };
  } else if (data.kind === 'sqrt') {
    const { s, m, n } = data;
    const rx = `\\sqrt{${shift('x', m)}}`;
    fTex = n === 0 ? coefV(s, rx) : `${n}${s < 0 ? '-' : '+'}${rx}`;
    fExpr = `${S(n)}+${S(s)}*sqrt(x+${S(m)})`;
    Dtex = `\\langle ${-m};\\ \\infty)`; Htex = s > 0 ? `\\langle ${n};\\ \\infty)` : `(-\\infty;\\ ${n}\\rangle`;
    mono = s > 0 ? 'rostoucí' : 'klesající';
    steps.push({ title: 'Je funkce prostá?', text: `Pod odmocninou nesmí být záporné číslo, proto $x \\ge ${-m}$. Odmocnina je rostoucí a nabývá všech nezáporných hodnot; ${s < 0 ? 'minus před ní funkci převrátí na klesající' : 'přičtení čísla ji jen posune'}. Funkce je ${mono}, tedy prostá.`, board: [{ tex: `D(f)=${Dtex}` }, { tex: `H(f)=${Htex}` }, { tex: `\\text{${mono}}\\Rightarrow\\text{prostá}` }] });
    const ry = `\\sqrt{${shift('y', m)}}`;
    steps.push({ title: 'Záměna x a y', text: 'Místo $x$ napíšeme $y$ a naopak.', board: [{ tex: `x=${n === 0 ? coefV(s, ry) : `${n}${s < 0 ? '-' : '+'}${ry}`}` }] });
    const rhs = s > 0 ? minusN('x', n) : n === 0 ? '-x' : `${n}-x`;
    const lines = [{ tex: `${ry}=${rhs}` }, { tex: `${shift('y', m)}=(${rhs})^2` }];
    invTex = `(${rhs})^2${plusN(-m)}`;
    if (m !== 0) lines.push({ tex: `y=${invTex}` });
    invExpr = `(x-${S(n)})^2-${S(m)}`;
    steps.push({ title: 'Vyjádření y', text: 'Osamostatníme odmocninu a obě strany umocníme na druhou. Umocnění je v pořádku, protože pracujeme jen s $x$ z oboru hodnot původní funkce (tam je pravá strana nezáporná).', board: lines });
    plot = { restrict: s > 0 ? `x>=${S(n)}` : `x<=${S(n)}` };
  } else throw new Error('inverzní: neznámý druh');
  const invPlotExpr = plot.restrict ? `${plot.restrict} ? ${invExpr} : NaN` : invExpr;
  steps.push({
    title: 'Inverzní funkce',
    text: 'Výsledek zapíšeme jako $f^{-1}(x)$. Definiční obor a obor hodnot se prohodí: $D(f^{-1}) = H(f)$ a $H(f^{-1}) = D(f)$. Grafy $f$ a $f^{-1}$ jsou souměrné podle přímky $y = x$ (čárkovaně).',
    board: [resultLine('f^{-1}(x)=', invTex), { tex: `D(f^{-1})=${Htex}` }, { tex: `H(f^{-1})=${Dtex}` }],
    viz: {
      kind: 'plot',
      data: {
        domain: [-6, 6], range: [-6, 6],
        functions: [{ expr: fExpr }, { expr: invPlotExpr, color: 'blue' }],
        lines: [{ k: 1, q: 0, label: 'y = x' }],
        asymptotes: plot.asymptotes || [],
        alt: 'Graf funkce a funkce inverzní, souměrné podle přímky y = x',
      },
    },
  });
  return {
    id: idOf('inverzni', data), topic: TOPIC, type: 'inverzni', data,
    task: 'Urči inverzní funkci $f^{-1}$ k funkci $f$. Zapiš předpis $f^{-1}(x)$ v proměnné $x$, např. (x-5)/2, (x-1)^2+3 nebo e^(x-2)-1. Přirozený logaritmus zapiš jako log(…), např. log(x-1)+2.',
    promptTex: `f(x)=${fTex}`,
    answerSpec: { kind: 'expression', value: invExpr, variable: 'x' },
    answerTex: `f^{-1}(x)=${invTex}`,
    solution: steps,
  };
}
function genInverzni(rng) {
  const kind = pick(rng, ['lin', 'mob', 'mob', 'exp', 'ln', 'sqrt']);
  if (kind === 'lin') return solveInverzni({ kind, a: pick(rng, [2, 3, 4, 5, -2, -3, -1, 7]), b: rnz(rng, -7, 7) });
  if (kind === 'mob') {
    for (;;) {
      const a = ri(rng, -3, 3); const b = ri(rng, -5, 5); const c = pick(rng, [1, 1, 2, -1]); const d = ri(rng, -4, 4);
      if (a * d - b * c === 0 || (a === 0 && b === 0) || (c < 0 && d <= 0)) continue;
      return solveInverzni({ kind, a, b, c, d });
    }
  }
  // obor inverzní funkce musí zasahovat do ⟨−3; 3⟩, kde kontrola výrazů dosazuje (viz zpráva)
  if (kind === 'exp') { const k = pick(rng, [1, 1, 2, 3, -1]); return solveInverzni({ kind, k, m: ri(rng, -3, 3), n: k > 0 ? ri(rng, -3, -1) : ri(rng, 1, 3) }); }
  if (kind === 'ln') return solveInverzni({ kind, a: pick(rng, [1, 1, 2, 3, -1]), m: ri(rng, -3, 3), n: ri(rng, -3, 3) });
  const s = pick(rng, [1, 1, -1]);
  return solveInverzni({ kind, s, m: ri(rng, -4, 4), n: s > 0 ? ri(rng, -3, 0) : ri(rng, 1, 3) });
}

// =====================================================================
// OBOR HODNOT transformované elementární funkce y = a·g(x − m) + n
// data = { g, a, m, n }, g ∈ sq | sqrt | exp | ln | sin | cos | arctg | arcsin | arccos
const BASE = {
  sq: { tex: (u) => (u === 'x' ? 'x^2' : `(${u})^2`), expr: 'X^2', H: () => [iv(ep(0), INF, true)], name: 'parabola $y = x^2$', desc: 'Druhá mocnina je vždy nezáporná a nabývá všech hodnot od nuly výš.' },
  sqrt: { tex: (u) => `\\sqrt{${u}}`, expr: 'sqrt(X)', H: () => [iv(ep(0), INF, true)], name: 'odmocnina $y = \\sqrt{x}$', desc: 'Odmocnina nabývá všech nezáporných hodnot.' },
  exp: { tex: (u) => `e^{${u}}`, expr: 'exp(X)', H: () => [iv(ep(0), INF)], name: 'exponenciála $y = e^x$', desc: 'Exponenciála nabývá všech kladných hodnot, nulu nikdy (osa $x$ je asymptota).' },
  ln: { tex: (u) => `\\ln(${u})`, expr: 'log(X)', H: () => REALS, name: 'logaritmus $y = \\ln x$', desc: 'Logaritmus nabývá všech reálných hodnot.' },
  sin: { tex: (u) => `\\sin(${u})`, expr: 'sin(X)', H: () => [iv(ep(-1), ep(1), true, true)], name: 'sinusoida $y = \\sin x$', desc: 'Sinus nabývá hodnot od $-1$ do $1$ včetně.' },
  cos: { tex: (u) => `\\cos(${u})`, expr: 'cos(X)', H: () => [iv(ep(-1), ep(1), true, true)], name: 'kosinusoida $y = \\cos x$', desc: 'Kosinus nabývá hodnot od $-1$ do $1$ včetně.' },
  arctg: { tex: (u) => `\\operatorname{arctg}(${u})`, expr: 'atan(X)', H: () => [iv(ep(0, -1), ep(0, 1))], name: 'arkustangens $y = \\operatorname{arctg} x$', desc: 'Arkustangens nabývá hodnot mezi $-\\frac{\\pi}{2}$ a $\\frac{\\pi}{2}$, krajních hodnot nikdy (vodorovné asymptoty).' },
  arcsin: { tex: (u) => `\\arcsin(${u})`, expr: 'asin(X)', H: () => [iv(ep(0, -1), ep(0, 1), true, true)], name: 'arkussinus $y = \\arcsin x$', desc: 'Arkussinus nabývá hodnot od $-\\frac{\\pi}{2}$ do $\\frac{\\pi}{2}$ včetně.' },
  arccos: { tex: (u) => `\\arccos(${u})`, expr: 'acos(X)', H: () => [iv(ep(0), ep(0, 2), true, true)], name: 'arkuskosinus $y = \\arccos x$', desc: 'Arkuskosinus nabývá hodnot od $0$ do $\\pi$ včetně.' },
};
const scaleEp = (e, a) => (Number.isFinite(e.v) ? ep(fr(e.r.n * a, e.r.d), e.k * a) : a > 0 ? e : e === INF ? NINF : INF);
const shiftEp = (e, n) => (Number.isFinite(e.v) ? ep(fr(e.r.n + n * e.r.d, e.r.d), e.k) : e);
const scaleSet = (Sx, a) => normalize(Sx.map((i) => (a > 0
  ? { lo: scaleEp(i.lo, a), hi: scaleEp(i.hi, a), lc: i.lc, hc: i.hc }
  : { lo: scaleEp(i.hi, a), hi: scaleEp(i.lo, a), lc: i.hc, hc: i.lc })));
const shiftSet = (Sx, n) => Sx.map((i) => ({ lo: shiftEp(i.lo, n), hi: shiftEp(i.hi, n), lc: i.lc, hc: i.hc }));
const hTex = setTex;

export function solveObor(data) {
  const { g, a, m, n } = data;
  const B = BASE[g];
  const u = shift('x', -m);
  const mExpr = (X) => B.expr.replace('X', X);
  const inner = B.tex(u);
  const scaled = coefV(a, inner);
  const fTex = `${scaled}${plusN(n)}`;
  const steps = [];
  let H = B.H();
  steps.push({
    title: 'Základní funkce',
    text: `Vyjdeme ze základní funkce – ${B.name}. ${B.desc} Na obrázku je její graf.`,
    board: [{ tex: `y=${B.tex('x')}` }, { tex: `H=${hTex(H)}` }],
    viz: { kind: 'plot', data: { domain: g.startsWith('arc') && g !== 'arctg' ? [-1.5, 1.5] : [-6, 6], functions: [{ expr: mExpr('x') }], alt: 'Graf základní funkce' } },
  });
  if (m !== 0) {
    steps.push({
      title: 'Posun podél osy x',
      text: `Místo $x$ je v předpisu $${u}$: graf se posune o $${Math.abs(m)}$ ${m > 0 ? 'doprava' : 'doleva'}. Posun do strany hodnoty funkce nemění, obor hodnot zůstává.`,
      board: [{ tex: `y=${inner}` }, { tex: `H=${hTex(H)}` }],
    });
  }
  if (a !== 1) {
    H = scaleSet(H, a);
    steps.push({
      title: 'Násobení číslem',
      text: a < 0
        ? `Násobení číslem $${a}$ graf překlopí podle osy $x$${a !== -1 ? ` a natáhne ${-a}krát` : ''}: každá hodnota se vynásobí $${a}$, takže se krajní body oboru hodnot vynásobí a prohodí (z největší hodnoty je nejmenší).`
        : `Násobení číslem $${a}$ graf natáhne ve směru osy $y$: každá hodnota, a tedy i krajní body oboru hodnot, se vynásobí číslem $${a}$.`,
      board: [{ tex: `y=${scaled}` }, { tex: `H=${hTex(H)}` }],
    });
  }
  if (n !== 0) {
    H = shiftSet(H, n);
    steps.push({
      title: 'Posun podél osy y',
      text: `Přičtení čísla $${n}$ posune graf o $${Math.abs(n)}$ ${n > 0 ? 'nahoru' : 'dolů'}; ke krajním bodům oboru hodnot přičteme $${n}$ (nekonečno zůstává nekonečnem).`,
      board: [{ tex: `y=${fTex}` }, { tex: `H=${hTex(H)}` }],
    });
  }
  const X = `(x-${S(m)})`;
  const fExpr = `${S(a)}*${mExpr(X)}+${S(n)}`;
  const isArc = g === 'arcsin' || g === 'arccos';
  const dom = isArc ? [m - 1.5, m + 1.5] : [m - 6, m + 6];
  const asym = g === 'exp' ? [{ kind: 'horizontal', y: n }] : g === 'arctg' ? [{ kind: 'horizontal', y: n + a * Math.PI / 2 }, { kind: 'horizontal', y: n - a * Math.PI / 2 }] : [];
  steps.push({
    title: 'Obor hodnot',
    text: 'Obor hodnot je množina všech hodnot, kterých funkce nabývá – na grafu průmět křivky na osu $y$. Modře je základní funkce, bíle posunutá a natažená.',
    board: setLines('H(f)=', H, { result: true }),
    viz: { kind: 'plot', data: { domain: dom, functions: [{ expr: fExpr }, { expr: mExpr('x'), color: 'blue' }], asymptotes: asym, alt: 'Graf transformované funkce a základní funkce' } },
  });
  const pi = /π/.test(setStr(H));
  return {
    id: idOf('obor-hodnot', data), topic: TOPIC, type: 'obor-hodnot', data,
    task: `Urči obor hodnot $H(f)$ funkce $f$ pomocí transformace grafu základní funkce. ${INTERVAL_FORMAT}${pi ? ' Číslo π zapiš jako pi nebo π, např. 2+pi/2.' : ''}`,
    promptTex: `f(x)=${fTex}`,
    answerSpec: { kind: 'interval', value: setStr(H) },
    answerTex: setTex(H),
    solution: steps,
  };
}
function genObor(rng) {
  for (;;) {
    const g = pick(rng, ['sq', 'sq', 'sqrt', 'sqrt', 'exp', 'exp', 'ln', 'sin', 'cos', 'arctg', 'arcsin', 'arccos']);
    const a = pick(rng, [1, 1, 2, 3, -1, -1, -2, -3]);
    const m = ri(rng, -3, 3); const n = ri(rng, -4, 4);
    if ([m !== 0, a !== 1, n !== 0].filter(Boolean).length < 2) continue;
    return solveObor({ g, a, m, n });
  }
}

// =====================================================================
// NÁČRT GRAFU transformované elementární funkce y = a·g(x − m) + n (tabule, sebehodnocení)
// data = { g, a, m, n } jako u oboru hodnot.
const BASE_NOTE = {
  sq: 'vrchol v počátku, větve nahoru', sqrt: 'začíná v počátku a roste', exp: 'prochází bodem $[0;\\ 1]$, osa $x$ je asymptota',
  ln: 'prochází bodem $[1;\\ 0]$, osa $y$ je asymptota', sin: 'vlna mezi $-1$ a $1$, prochází počátkem', cos: 'vlna mezi $-1$ a $1$, v nule má maximum 1',
  arctg: 'roste mezi vodorovnými asymptotami $\\pm\\frac{\\pi}{2}$', arcsin: 'roste z $-\\frac{\\pi}{2}$ do $\\frac{\\pi}{2}$ na intervalu $\\langle -1;\\ 1\\rangle$',
  arccos: 'klesá z $\\pi$ do $0$ na intervalu $\\langle -1;\\ 1\\rangle$',
};
export function solveNacrt(data) {
  const { g, a, m, n } = data;
  const B = BASE[g];
  const u = shift('x', -m);
  const mExpr = (X) => B.expr.replace('X', X);
  const inner = B.tex(u);
  const scaled = coefV(a, inner);
  const fTex = `${scaled}${plusN(n)}`;
  const isArc = g === 'arcsin' || g === 'arccos';
  const dom = isArc ? [m - 1.5, m + 1.5] : [m - 6, m + 6];
  const steps = [{
    title: 'Základní funkce',
    text: `Začneme ze základní funkce – ${B.name}: ${BASE_NOTE[g]}. Její graf je na obrázku.`,
    board: [{ tex: `y=${B.tex('x')}` }],
    viz: { kind: 'plot', data: { domain: isArc ? [-1.5, 1.5] : [-6, 6], functions: [{ expr: mExpr('x') }], alt: 'Graf základní funkce' } },
  }];
  if (m !== 0) {
    steps.push({ title: 'Posun podél osy x', text: `Místo $x$ je v předpisu $${u}$: celý graf posuneme o $${Math.abs(m)}$ ${m > 0 ? 'doprava' : 'doleva'}.`, board: [{ tex: `y=${inner}` }] });
  }
  if (a !== 1) {
    steps.push({
      title: 'Násobení číslem',
      text: a < 0
        ? `Násobení číslem $${a}$: graf překlopíme podle osy $x$${a !== -1 ? ` a natáhneme ${-a}krát ve směru osy $y$` : ''}.`
        : `Násobení číslem $${a}$: každou hodnotu na ose $y$ vynásobíme číslem $${a}$, graf se natáhne ve směru osy $y$.`,
      board: [{ tex: `y=${scaled}` }],
    });
  }
  if (n !== 0) {
    steps.push({ title: 'Posun podél osy y', text: `Přičtení čísla $${n}$ posune celý graf o $${Math.abs(n)}$ ${n > 0 ? 'nahoru' : 'dolů'}.`, board: [{ tex: `y=${fTex}` }] });
  }
  const asym = g === 'exp' ? [{ kind: 'horizontal', y: n }] : g === 'ln' ? [{ kind: 'vertical', x: m }] : g === 'arctg' ? [{ kind: 'horizontal', y: n + a * Math.PI / 2 }, { kind: 'horizontal', y: n - a * Math.PI / 2 }] : [];
  steps.push({
    title: 'Výsledný graf',
    text: 'Hotový graf (bíle) porovnej se svým náčrtem; základní funkce je pro srovnání modře. Důležité je, aby souhlasily průsečíky s osami, asymptoty a tvar křivky.',
    board: [resultLine('y=', fTex)],
    viz: { kind: 'plot', data: { domain: dom, functions: [{ expr: `${S(a)}*${mExpr(`(x-${S(m)})`)}+${S(n)}` }, { expr: mExpr('x'), color: 'blue' }], asymptotes: asym, alt: 'Graf transformované funkce a základní funkce' } },
  });
  return {
    id: idOf('nacrt-graf', data), topic: TOPIC, type: 'nacrt-graf', data,
    task: 'Načrtni graf funkce na tabuli: vyjdi z grafu základní funkce a postupně ho posuň, překlop nebo natáhni. Potom klikni na „Ukaž výsledek“ a posuď se sám.',
    promptTex: `f(x)=${fTex}`,
    answerSpec: { kind: 'whiteboard' },
    answerTex: `y=${fTex}`,
    solution: steps,
  };
}
function genNacrt(rng) {
  for (;;) {
    const g = pick(rng, ['sq', 'sqrt', 'exp', 'ln', 'sin', 'cos', 'arctg', 'arcsin']);
    const a = pick(rng, [1, 1, 2, -1, -2, 3]);
    const m = ri(rng, -3, 3); const n = ri(rng, -3, 3);
    if ([m !== 0, a !== 1, n !== 0].filter(Boolean).length < 2) continue;
    return solveNacrt({ g, a, m, n });
  }
}

// =====================================================================
// VÝKLAD (vlastními slovy). Položka viz = graf pro výklad; js/ui/theory.js ho zatím nekreslí
// (viz zpráva), grafy elementárních funkcí jsou proto i v postupech typu „Obor hodnot“.
const plotOf = (fns, domain, alt, extra = {}) => ({ kind: 'plot', data: { domain, functions: fns.map((expr, i) => ({ expr, ...(i ? { color: ['blue', 'green', 'warn'][(i - 1) % 3] } : {}) })), alt, ...extra } });
const theory = [
  {
    heading: 'Co je funkce',
    text: 'Funkce je předpis, který každému číslu $x$ z jisté množiny přiřadí právě jedno číslo $y = f(x)$. Číslo $x$ je nezávislá proměnná (vstup), $y$ závislá proměnná (výstup, hodnota funkce).\n\nDefiniční obor $D(f)$ je množina všech $x$, pro která funkci počítáme. Když není výslovně zadaný, bereme největší množinu, pro kterou má předpis smysl. Obor hodnot $H(f)$ je množina všech hodnot, které funkce opravdu nabude.\n\nGraf funkce je množina bodů $[x;\\ f(x)]$ v rovině. Křivka je grafem funkce, jen když ji každá svislá přímka protne nejvýš jednou (kružnice grafem funkce není).\n\nDvě funkce se rovnají, jen když mají stejný definiční obor a na něm stejné hodnoty: $f(x) = x$ a $g(x) = \\frac{x^2}{x}$ se liší v bodě $0$, kde $g$ není definovaná.',
    tex: 'f:\\ y=f(x),\\quad x\\in D(f),\\quad H(f)=\\{f(x);\\ x\\in D(f)\\}',
    mistakes: [
      'Zkrátit zlomek a zapomenout, že původní předpis v bodě nebyl definovaný: $\\frac{x^2}{x}$ má definiční obor $\\mathbb{R}\\setminus\\{0\\}$.',
      'Zaměnit definiční obor (osa $x$) a obor hodnot (osa $y$).',
    ],
  },
  {
    heading: 'Definiční obor: podmínky',
    text: 'Definiční obor hledáme tak, že za každou „nebezpečnou“ část předpisu zapíšeme podmínku a všechny podmínky vyřešíme současně (průnik):\n\n• zlomek – jmenovatel $\\mathrel{\\char"2260} 0$,\n• sudá odmocnina ($\\sqrt{\\ }$, $\\sqrt[4]{\\ }$) – výraz pod ní $\\ge 0$; je-li odmocnina ve jmenovateli, pak $> 0$,\n• lichá odmocnina ($\\sqrt[3]{\\ }$) – žádná podmínka,\n• logaritmus $\\ln$, $\\log$ – argument $> 0$; je-li logaritmus ve jmenovateli, navíc argument $\\mathrel{\\char"2260} 1$,\n• $\\arcsin$, $\\arccos$ – argument mezi $-1$ a $1$ včetně,\n• $\\operatorname{tg} x$ – $\\cos x \\mathrel{\\char"2260} 0$, tedy $x \\mathrel{\\char"2260} \\frac{\\pi}{2} + k\\pi$; $\\operatorname{cotg} x$ – $\\sin x \\mathrel{\\char"2260} 0$, tedy $x \\mathrel{\\char"2260} k\\pi$.\n\nVýsledek zapisujeme jako interval nebo sjednocení intervalů. Kulatá závorka znamená, že krajní bod nepatří do množiny, ostrá $\\langle\\ \\rangle$, že patří. U nekonečna je vždy kulatá.',
    tex: 'D\\Big(\\tfrac{\\sqrt{5-x}}{\\ln x}\\Big):\\ 5-x\\ge 0\\ \\wedge\\ x>0\\ \\wedge\\ x\\mathrel{\\char"2260} 1\\ \\Rightarrow\\ (0;\\ 1)\\cup(1;\\ 5\\rangle',
    mistakes: [
      'Zapomenout na některou část předpisu – podmínky se píší za všechny zlomky, odmocniny a logaritmy, i ty vnořené.',
      'U logaritmu napsat $\\ge 0$ místo $> 0$: $\\ln 0$ neexistuje.',
      'Výsledky podmínek sjednotit místo průniku – musí platit všechny současně.',
      'Napsat ostrou závorku u nekonečna: $\\langle 2;\\ \\infty\\rangle$ je chybně, správně $\\langle 2;\\ \\infty)$.',
    ],
  },
  {
    heading: 'Nerovnice a tabulka znamének',
    text: 'Lineární nerovnici řešíme jako rovnici; jen při násobení nebo dělení záporným číslem se obrátí znak nerovnosti.\n\nKvadratickou nerovnici (a nerovnici se součinem nebo podílem) řešíme metodou nulových bodů: výraz rozložíme na součin činitelů tvaru $(x - x_1)$ – kořeny najdeme vytknutím, rozkladem podle vzorce $a^2 - b^2 = (a-b)(a+b)$ nebo přes diskriminant $D = b^2 - 4ac$ a $x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a}$. Nulové body rozdělí osu na intervaly a na každém má každý činitel stálé znaménko. Do tabulky zapíšeme znaménka činitelů a vynásobíme je.\n\nU podílu nikdy nenásobíme jmenovatelem (neznáme jeho znaménko) – nulový bod jmenovatele zapíšeme do tabulky také, ale do výsledku nikdy nepatří.\n\nNemá-li kvadratický výraz reálné kořeny ($D < 0$), má všude znaménko čísla u $x^2$.',
    tex: 'x^2+x-12\\ge 0\\iff(x+4)(x-3)\\ge 0\\iff x\\in(-\\infty;\\ -4\\rangle\\cup\\langle 3;\\ \\infty)',
    mistakes: [
      'Vydělit nerovnici záporným číslem a neobrátit znak.',
      'Vynásobit nerovnici jmenovatelem, jako by byl kladný.',
      'Zahrnout do výsledku nulový bod jmenovatele u neostré nerovnosti.',
      'Z $x^2 > 9$ vyvodit jen $x > 3$ – správně $|x| > 3$, tedy i $x < -3$.',
    ],
  },
  {
    heading: 'Ohraničenost a monotonie',
    text: 'Funkce je zdola ohraničená, když existuje číslo $d$, pod které její hodnoty nikdy neklesnou (graf leží celý nad nějakou vodorovnou přímkou); shora ohraničená obdobně. Ohraničená je, když je ohraničená zdola i shora – například $\\sin x$ leží mezi $-1$ a $1$.\n\nFunkce je rostoucí na množině $M$, když pro $x_1 < x_2$ z $M$ platí $f(x_1) < f(x_2)$ (větší vstup dává větší hodnotu), klesající, když $f(x_1) > f(x_2)$. S neostrými nerovnostmi mluvíme o neklesající a nerostoucí funkci. Souhrnně jde o monotonní funkce.\n\nFunkce je prostá, když různým $x$ přiřadí různé hodnoty – každá vodorovná přímka protne graf nejvýš jednou. Každá rostoucí nebo klesající funkce je prostá (obráceně to neplatí: $\\frac{1}{x}$ je prostá, ale na celém definičním oboru není monotonní).\n\nPeriodická funkce se opakuje: $f(x + p) = f(x)$; nejmenší takové kladné $p$ je základní perioda ($2\\pi$ u sinu a kosinu, $\\pi$ u tangens a kotangens).',
    tex: 'x_1<x_2\\ \\Rightarrow\\ f(x_1)<f(x_2)\\quad\\text{(rostoucí)}',
    mistakes: [
      'Říct, že $\\frac{1}{x}$ je klesající na celém $\\mathbb{R}\\setminus\\{0\\}$ – je klesající zvlášť na $(-\\infty;\\ 0)$ a na $(0;\\ \\infty)$, ale $-1 < 1$ a $f(-1) < f(1)$.',
      'Považovat $x^2$ za prostou – $f(-2) = f(2)$.',
    ],
  },
  {
    heading: 'Sudá a lichá funkce',
    text: 'Funkce je sudá, když $f(-x) = f(x)$ pro každé $x$ z definičního oboru – graf je souměrný podle osy $y$. Lichá je, když $f(-x) = -f(x)$ – graf je souměrný podle počátku. Obě definice předpokládají, že definiční obor je souměrný podle nuly (s každým $x$ obsahuje i $-x$); když není, funkce není ani sudá, ani lichá.\n\nPostup: 1) ověříme souměrnost definičního oboru, 2) do předpisu dosadíme $-x$, 3) upravíme a porovnáme s $f(x)$ a s $-f(x)$.\n\nPomůcky: $(-x)^n = x^n$ pro sudé $n$, $(-x)^n = -x^n$ pro liché $n$; $\\sin$, $\\operatorname{tg}$, $\\operatorname{cotg}$ jsou liché, $\\cos$ a $|x|$ sudé. Podíl nebo součin dvou lichých funkcí je sudý, liché a sudé dává lichou. Většina funkcí není ani sudá, ani lichá (například $x^2 + x$, $e^x$, $\\ln x$).',
    tex: 'f(-x)=f(x)\\ \\text{(sudá)},\\qquad f(-x)=-f(x)\\ \\text{(lichá)}',
    mistakes: [
      'Dosadit $-x$ bez závorky: $-x^2$ místo $(-x)^2 = x^2$.',
      'Zapomenout na definiční obor: $\\sqrt{x+1}$ není sudá ani lichá, protože obor $\\langle -1;\\ \\infty)$ není souměrný.',
      'Myslet si, že „není sudá“ znamená „je lichá“ – může být ani jedno.',
      'Ukázat „ani sudá, ani lichá“ jen obecně – nejjistější je konkrétní číslo, např. $f(1) = 2$, $f(-1) = 0$.',
    ],
  },
  {
    heading: 'Operace s funkcemi a složená funkce',
    text: 'Funkce můžeme sčítat, odčítat, násobit a dělit. Definiční obor výsledku je průnik definičních oborů obou funkcí; u podílu $\\frac{f}{g}$ navíc vyloučíme body, kde $g(x) = 0$.\n\nSložená funkce $f(g(x))$ vznikne tak, že výsledek vnitřní funkce $g$ dosadíme do vnější funkce $f$. Do jejího definičního oboru patří jen ta $x$, pro která existuje $g(x)$ a zároveň $g(x)$ leží v definičním oboru $f$ – proto vznikají podmínky jako „argument logaritmu $> 0$“.',
    tex: 'f(x)=\\sqrt{x},\\ g(x)=5+3x\\ \\Rightarrow\\ f(g(x))=\\sqrt{5+3x},\\ x\\ge -\\tfrac{5}{3}',
    mistakes: [
      'Zaměnit pořadí: $f(g(x))$ a $g(f(x))$ jsou obecně různé funkce.',
      'U podílu zapomenout vyloučit nulové body jmenovatele.',
    ],
  },
  {
    heading: 'Inverzní funkce',
    text: 'K prosté funkci $f$ existuje inverzní funkce $f^{-1}$, která „vrací“ výsledek zpět: je-li $f(a) = b$, pak $f^{-1}(b) = a$. Funkce, která není prostá (například $x^2$ na $\\mathbb{R}$), inverzní funkci nemá – lze ji ale zúžit na interval, kde prostá je.\n\nPostup: 1) ověříme, že $f$ je prostá (nejčastěji je rostoucí nebo klesající), a určíme $D(f)$ a $H(f)$; 2) v rovnici $y = f(x)$ zaměníme $x$ a $y$; 3) z nové rovnice vyjádříme $y$; 4) prohodíme obory: $D(f^{-1}) = H(f)$, $H(f^{-1}) = D(f)$.\n\nGrafy $f$ a $f^{-1}$ jsou souměrné podle přímky $y = x$. Dvojice navzájem inverzních funkcí: $e^x$ a $\\ln x$, $x^2$ (pro $x \\ge 0$) a $\\sqrt{x}$, $\\sin x$ (na $\\langle -\\frac{\\pi}{2};\\ \\frac{\\pi}{2}\\rangle$) a $\\arcsin x$.',
    tex: 'y=2x+5\\ \\to\\ x=2y+5\\ \\to\\ y=\\frac{x-5}{2}=f^{-1}(x)',
    mistakes: [
      'Plést si $f^{-1}(x)$ s $\\frac{1}{f(x)}$ – to je převrácená hodnota, ne inverzní funkce.',
      'Zapomenout prohodit definiční obor a obor hodnot.',
      'Hledat inverzní funkci k funkci, která není prostá.',
    ],
    viz: plotOf(['exp(x)', 'log(x)'], [-4, 4], 'Exponenciála a logaritmus souměrné podle y = x', { range: [-4, 4], lines: [{ k: 1, q: 0, label: 'y = x' }] }),
  },
  {
    heading: 'Mocninné funkce a polynomy',
    text: 'Mocninná funkce $y = x^n$: pro sudé $n$ je sudá, zdola ohraničená, graf je „parabola“ s vrcholem v počátku; pro liché $n$ je lichá, rostoucí a nabývá všech hodnot. Se záporným exponentem ($y = \\frac{1}{x}$, $y = \\frac{1}{x^2}$) není definovaná v nule a graf má asymptoty – osy souřadnic.\n\nOdmocnina $y = \\sqrt[n]{x}$ je pro sudé $n$ definovaná na $\\langle 0;\\ \\infty)$, pro liché $n$ na celém $\\mathbb{R}$; je rostoucí.\n\nPolynom je součet násobků mocnin: lineární funkce (graf přímka), kvadratická funkce (parabola s vrcholem). Podíl dvou polynomů je racionální lomená funkce; není definovaná v nulových bodech jmenovatele.',
    tex: 'y=x^n,\\qquad y=\\sqrt[n]{x},\\qquad y=\\frac{P(x)}{Q(x)}',
    mistakes: [
      'Myslet si, že $\\sqrt[3]{x}$ potřebuje $x \\ge 0$ – třetí odmocnina ze záporného čísla existuje: $\\sqrt[3]{-8} = -2$.',
      'Zapomenout, že $\\sqrt{x^2} = |x|$, ne $x$.',
    ],
    viz: plotOf(['x^2', 'x^3', 'sqrt(x)'], [-2.5, 2.5], 'Grafy x², x³ a odmocniny', { range: [-4, 4] }),
  },
  {
    heading: 'Exponenciální a logaritmické funkce',
    text: 'Exponenciální funkce $y = a^x$ ($a > 0$, $a \\mathrel{\\char"2260} 1$) je definovaná na celém $\\mathbb{R}$, nabývá jen kladných hodnot, $H = (0;\\ \\infty)$, a prochází bodem $[0;\\ 1]$. Pro $a > 1$ je rostoucí, pro $0 < a < 1$ klesající. Nejdůležitější je $y = e^x$ s Eulerovým číslem $e \\approx 2{,}718$.\n\nLogaritmická funkce $y = \\log_a x$ je k ní inverzní: $D = (0;\\ \\infty)$, $H = \\mathbb{R}$, prochází bodem $[1;\\ 0]$. Přirozený logaritmus je $\\ln x = \\log_e x$, dekadický $\\log x = \\log_{10} x$. Platí $e^{\\ln x} = x$ a $\\ln e^x = x$.\n\nPravidla: $\\ln(ab) = \\ln a + \\ln b$, $\\ln\\frac{a}{b} = \\ln a - \\ln b$, $\\ln a^k = k \\ln a$.',
    tex: 'e^{\\ln x}=x\\ (x>0),\\qquad \\ln e^{x}=x,\\qquad \\ln 1=0',
    mistakes: [
      'Logaritmovat nulu nebo záporné číslo.',
      '$\\ln(a + b)$ rozepsat jako $\\ln a + \\ln b$ – takové pravidlo neexistuje.',
      'Myslet si, že $e^x$ může být nula – osa $x$ je jen asymptota.',
    ],
    viz: plotOf(['exp(x)', '2^x', 'log(x)'], [-3, 4], 'Grafy exponenciálních a logaritmické funkce', { range: [-3, 5] }),
  },
  {
    heading: 'Goniometrické funkce',
    text: 'Sinus a kosinus jsou definované na celém $\\mathbb{R}$, nabývají hodnot z $\\langle -1;\\ 1\\rangle$ a mají periodu $2\\pi$. Sinus je lichý, kosinus sudý. Důležité hodnoty: $\\sin 0 = 0$, $\\sin\\frac{\\pi}{2} = 1$, $\\cos 0 = 1$, $\\cos\\frac{\\pi}{2} = 0$, $\\cos\\pi = -1$.\n\nTangens $\\operatorname{tg} x = \\frac{\\sin x}{\\cos x}$ není definovaný tam, kde $\\cos x = 0$, tedy v $\\frac{\\pi}{2} + k\\pi$; kotangens $\\operatorname{cotg} x = \\frac{\\cos x}{\\sin x}$ tam, kde $\\sin x = 0$, tedy v $k\\pi$. Oba jsou liché, mají periodu $\\pi$ a nabývají všech reálných hodnot.\n\nVzorce: $\\sin^2 x + \\cos^2 x = 1$, $\\sin 2x = 2\\sin x \\cos x$, $\\cos 2x = \\cos^2 x - \\sin^2 x$. Úhly měříme v radiánech: $180^\\circ = \\pi$.',
    tex: '\\operatorname{tg}x=\\frac{\\sin x}{\\cos x},\\qquad \\sin^2x+\\cos^2x=1',
    mistakes: [
      'Zapomenout na periodu: $\\sin x = 0$ neplatí jen pro $x = 0$, ale pro všechna $x = k\\pi$.',
      'Počítat ve stupních tam, kde se čekají radiány ($\\pi \\approx 3{,}14$).',
    ],
    viz: plotOf(['sin(x)', 'cos(x)'], [-7, 7], 'Grafy sinu a kosinu', { range: [-1.6, 1.6] }),
  },
  {
    heading: 'Cyklometrické funkce',
    text: 'Goniometrické funkce nejsou prosté, ale po zúžení na vhodný interval k nim existují inverzní funkce – cyklometrické (arkussinus, arkuskosinus, arkustangens a arkuskotangens):\n\n• $\\arcsin x$: $D = \\langle -1;\\ 1\\rangle$, $H = \\langle -\\frac{\\pi}{2};\\ \\frac{\\pi}{2}\\rangle$, rostoucí, lichá,\n• $\\arccos x$: $D = \\langle -1;\\ 1\\rangle$, $H = \\langle 0;\\ \\pi\\rangle$, klesající,\n• $\\operatorname{arctg} x$: $D = \\mathbb{R}$, $H = (-\\frac{\\pi}{2};\\ \\frac{\\pi}{2})$, rostoucí, lichá, vodorovné asymptoty $y = \\pm\\frac{\\pi}{2}$,\n• $\\operatorname{arccotg} x$: $D = \\mathbb{R}$, $H = (0;\\ \\pi)$, klesající.\n\n$\\arcsin a$ je úhel z $\\langle -\\frac{\\pi}{2};\\ \\frac{\\pi}{2}\\rangle$, jehož sinus je $a$; například $\\arcsin 1 = \\frac{\\pi}{2}$, $\\arccos 0 = \\frac{\\pi}{2}$, $\\operatorname{arctg} 1 = \\frac{\\pi}{4}$.',
    tex: '-1\\le u(x)\\le 1\\quad\\text{(podmínka pro }\\arcsin u(x),\\ \\arccos u(x))',
    mistakes: [
      'Napsat $\\arcsin x = \\frac{1}{\\sin x}$ – arkussinus je inverzní funkce, ne převrácená hodnota.',
      'Zapomenout, že $\\arcsin$ a $\\arccos$ potřebují argument z $\\langle -1;\\ 1\\rangle$.',
    ],
    viz: plotOf(['asin(x)', 'acos(x)', 'atan(x)'], [-3, 3], 'Grafy cyklometrických funkcí', { range: [-2, 3.5] }),
  },
  {
    heading: 'Transformace grafu',
    text: 'Z grafu základní funkce $y = f(x)$ odvodíme grafy příbuzných funkcí:\n\n• $y = f(x) + n$ – posun o $n$ nahoru (pro $n < 0$ dolů); obor hodnot se posune o $n$,\n• $y = f(x - m)$ – posun o $m$ doprava (pro $m < 0$ doleva); obor hodnot se nezmění,\n• $y = k \\cdot f(x)$ – natažení ve směru osy $y$ ($k$-krát); pro $k < 0$ navíc překlopení podle osy $x$,\n• $y = f(k x)$ – stlačení ve směru osy $x$,\n• $y = -f(x)$ – překlopení podle osy $x$, $y = f(-x)$ – podle osy $y$,\n• $y = |f(x)|$ – části pod osou $x$ se překlopí nahoru, $y = f(|x|)$ – pravá polovina grafu se zrcadlí doleva.\n\nTak například $y = 2(x-1)^2 - 3$ je parabola $y = x^2$ posunutá o $1$ doprava, dvakrát natažená a posunutá o $3$ dolů; její obor hodnot je $\\langle -3;\\ \\infty)$.',
    tex: 'y=k\\cdot f(x-m)+n',
    mistakes: [
      'Posouvat opačně: $f(x - 2)$ je posun doprava, ne doleva.',
      'Zapomenout, že násobení záporným číslem prohodí krajní body oboru hodnot: $-2\\cdot\\langle 0;\\ \\infty) = (-\\infty;\\ 0\\rangle$.',
    ],
    viz: plotOf(['2*(x-1)^2-3', 'x^2'], [-3, 4], 'Parabola a její posunutá a natažená kopie', { range: [-4, 6] }),
  },
];

export default {
  id: TOPIC,
  title: 'Funkce a její vlastnosti',
  order: 5,
  theory,
  types: [
    { id: 'obor-zlomek', title: 'Definiční obor: zlomek', generate: genZlomek, solve: (d) => solveDomain('obor-zlomek', d) },
    { id: 'obor-odmocnina', title: 'Definiční obor: odmocnina z kvadratického výrazu', generate: genOdmocnina, solve: (d) => solveDomain('obor-odmocnina', d) },
    { id: 'obor-podil', title: 'Definiční obor: logaritmus nebo odmocnina z podílu', generate: genPodil, solve: (d) => solveDomain('obor-podil', d) },
    { id: 'obor-arcsin', title: 'Definiční obor: arkussinus a arkuskosinus', generate: genArcsin, solve: (d) => solveDomain('obor-arcsin', d) },
    { id: 'obor-kombinace', title: 'Definiční obor: kombinace podmínek', generate: genKombinace, solve: (d) => solveDomain('obor-kombinace', d) },
    { id: 'obor-goniometricke', title: 'Definiční obor s goniometrickou funkcí', generate: genGonio, solve: solveGonio },
    { id: 'parita', title: 'Sudá, nebo lichá?', generate: genParita, solve: solveParita },
    { id: 'inverzni', title: 'Inverzní funkce', generate: genInverzni, solve: solveInverzni },
    { id: 'obor-hodnot', title: 'Obor hodnot a transformace grafu', generate: genObor, solve: solveObor },
    { id: 'nacrt-graf', title: 'Načrtni graf (tabule)', generate: genNacrt, solve: solveNacrt },
  ],
};
