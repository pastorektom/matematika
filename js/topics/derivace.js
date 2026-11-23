// Téma 7: Derivace, l'Hospitalovo pravidlo, průběh funkce (podle přednášek, prezentací,
// cvičení a sbírek; konkrétní příklady z nich jsou jen v content/, ne v gitu).
// Počítání se členy c·x^p·e^{Ex}·sin^S·cos^C·ln^L dělá js/topics/derivace-lib.js,
// průběh funkce (rodiny funkcí s „hezkými“ body) je v js/topics/derivace-prubeh.js.
import {
  fr, add, sub, mul, div, isZero, toNum, frTex, frStr,
  dTerm, powTermTex, xTex, term, sumOf, termData, norm, scale, neg, mulSum, subSum, dSum, sumAt, sumNum,
  sumTex, powSumTex, parenTex, factorETex, substSumTex, sumStr, termTex, absTermTex,
  lineTex, xMinus, xPow, mulTerm, divTerm, limitInf, limitZeroPlus, parseFr, eTex, hasAtoms, constT,
} from './derivace-lib.js';
import { fitProblem, fracLines, rewriteLines, derivChain, rawDerivTex, minusTex, texWidth, LIM } from './derivace-fit.js';
import { prubehTypes } from './derivace-prubeh.js';
import { theory } from './derivace-teorie.js';
import { elemTypes } from './derivace-elem.js';
import { termsOf } from '../custom-input.js';

const TOPIC = 'derivace';
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const resultLine = (pre, tex, post = '') => ({ tex: `${pre}${cls('vysledek', tex)}${post}`, notes: [{ kind: 'doubleUnderline', target: 'bt-vysledek' }] });
const brace = (target, label, position) => ({ kind: 'brace', target: `bt-${target}`, label, ...(position ? { position } : {}) });
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const HINT_EXPR = 'Funkce piš se závorkou: sin(x), cos(x), sqrt(x) nebo √(x), e^x; násobení mezi písmeny hvězdičkou, např. 2*x*e^x. Přirozený logaritmus zapiš jako log(x) – v poli odpovědi znamená log přirozený logaritmus.';
const exprSpec = (s) => ({ kind: 'expression', value: s, variable: 'x' });

// ---------- losování ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const rnz = (rng, lo, hi) => { let v = 0; while (v === 0) v = ri(rng, lo, hi); return v; };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const T = (c, p = 0, more = {}) => ({ c, ...(p ? { p } : {}), ...more });
const texOf = (ts) => sumTex(sumOf(ts));

// Poslední řádek dostane dvojité podtržení výsledku.
function markLast(lines, pre = '=') {
  const last = lines[lines.length - 1];
  const body = last.tex.startsWith(pre) ? last.tex.slice(pre.length) : last.tex;
  lines[lines.length - 1] = resultLine(pre, body);
  return lines;
}
// Přidá řádek, jen když se liší od předchozího.
const pushNew = (lines, tex) => { if (!lines.length || lines[lines.length - 1].tex !== tex) lines.push({ tex }); };

// ---------- Typ 1: pomůcky pro podrobný postup ----------
const COL = { c: 'accent', n: 'accent', m: 'accent', p: 'warn', k: 'warn', n1: 'warn' };
const hl = (name, tex) => cls(name, tex);
// Řádek tabule; barevné poznámky vzniknou ze všech použitých tříd bt-… (kromě výsledku).
const mk = (tex) => {
  const names = [...new Set([...tex.matchAll(/bt-([a-z0-9-]+)/g)].map((m) => m[1]))].filter((n) => n !== 'vysledek');
  return names.length ? { tex, notes: names.map((n) => ({ kind: 'color', target: `bt-${n}`, color: COL[n] || 'accent' })) } : { tex };
};
const pushL = (lines, tex) => { if (!lines.length || lines[lines.length - 1].tex !== tex) lines.push(mk(tex)); };
const rootTex = (k, n, kk = (x) => x, nn = (x) => x) => {
  const inner = k === 1 ? 'x' : `x^{${kk(k)}}`;
  return n === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${nn(n)}]{${inner}}`;
};
const plainTitle = (t) => {
  const a = fr(Math.abs(t.c.n), t.c.d);
  const co = a.n === 1 && a.d === 1 ? '' : a.d === 1 ? String(a.n) : `(${frStr(a)})`;
  const xs = isZero(t.p) ? '' : t.p.n === 1 && t.p.d === 1 ? 'x' : `x^${t.p.d === 1 && t.p.n > 0 ? t.p.n : `(${frStr(t.p).replace('-', '−')})`}`;
  return `${t.c.n < 0 ? '−' : ''}${co}${xs || (co ? '' : '1')}`;
};
const needsRewrite = (t) => !isZero(t.p) && (t.p.n < 0 || t.p.d !== 1);

// Přepis jednoho členu z odmocniny / zlomku na mocninu: √[n]{x^k} = x^{k/n}, 1/x^n = x^{-n}
function toPowerLines(t) {
  const lines = [];
  if (t.c.d !== 1) { pushL(lines, `${termTex(t)}=${powTermTex(t)}`); return lines; }
  const sg = t.c.n < 0 ? '-' : '';
  const a = Math.abs(t.c.n);
  const co = a === 1 ? '' : String(a);
  const ap = fr(Math.abs(t.p.n), t.p.d);
  const k = ap.n; const n = ap.d;
  const w = Math.floor(k / n); const r = k - w * n;
  const xw = w === 1 ? 'x' : `x^{${w}}`;
  if (t.p.n < 0 && n === 1) {
    pushL(lines, `${sg}\\frac{${a}}{${hl('n', k === 1 ? 'x' : `x^{${k}}`)}}=${sg}${co}x^{-${hl('n', k)}}`);
  } else if (t.p.n > 0) {
    if (w === 0) {
      pushL(lines, `${sg}${co}${rootTex(k, n, (v) => hl('k', v), (v) => hl('n', v))}=${sg}${co}x^{\\frac{${hl('k', k)}}{${hl('n', n)}}}`);
    } else {
      pushL(lines, `${sg}${co}${xw}${hl('m', rootTex(r, n))}`);
      pushL(lines, `=${sg}${co}${xw}\\cdot ${hl('m', `x^{\\frac{${r}}{${n}}}`)}`);
      pushL(lines, `=${sg}${co}x^{${w}+\\frac{${r}}{${n}}}`);
      pushL(lines, `=${sg}${co}x^{\\frac{${k}}{${n}}}`);
    }
  } else {
    pushL(lines, `${sg}\\frac{${a}}{${hl('m', xTex(ap))}}`);
    pushL(lines, `=${sg}\\frac{${a}}{${hl('m', `x^{\\frac{${k}}{${n}}}`)}}`);
    pushL(lines, `=${sg}${co}x^{-${hl('m', `\\frac{${k}}{${n}}`)}}`);
  }
  return lines;
}
// Zpět: x^{-n} = 1/x^n, x^{k/n} = √[n]{x^k}, x^{-k/n} = 1/√[n]{x^k}
function fromPowerLines(t) {
  const lines = [];
  if (t.c.d !== 1) { pushL(lines, `${powTermTex(t)}=${termTex(t)}`); return lines; }
  const sg = t.c.n < 0 ? '-' : '';
  const a = Math.abs(t.c.n);
  const co = a === 1 ? '' : String(a);
  const ap = fr(Math.abs(t.p.n), t.p.d);
  const k = ap.n; const n = ap.d;
  const w = Math.floor(k / n);
  if (t.p.n < 0 && n === 1) {
    pushL(lines, `${sg}${co}x^{-${hl('n', k)}}=${sg}\\frac{${a}}{${hl('n', k === 1 ? 'x' : `x^{${k}}`)}}`);
  } else if (t.p.n > 0) {
    pushL(lines, `${sg}${co}x^{\\frac{${hl('k', k)}}{${hl('n', n)}}}=${sg}${co}${rootTex(k, n, (v) => hl('k', v), (v) => hl('n', v))}`);
    if (w > 0) pushL(lines, `=${termTex(t)}`);
  } else {
    pushL(lines, `${sg}${co}x^{-${hl('m', `\\frac{${k}}{${n}}`)}}`);
    pushL(lines, `=${sg}\\frac{${a}}{${hl('m', `x^{\\frac{${k}}{${n}}}`)}}`);
    pushL(lines, `=${sg}\\frac{${a}}{${hl('m', rootTex(k, n))}}`);
    if (w > 0) pushL(lines, `=${termTex(t)}`);
  }
  return lines;
}

// Derivace jednoho členu c·x^p po řádcích (pravidlo, exponent, koeficient, výsledek).
function termDerivStep(t) {
  const d = dTerm(t)[0] || null;
  const title = isZero(t.p) ? 'Derivace konstanty' : `Derivace členu ${plainTitle(t)}`;
  const lines = [];
  const c = t.c; const p = t.p;
  const cT = frTex(c);
  if (isZero(p)) {
    pushL(lines, `(${cT})'=0`);
    return { title, text: 'Konstanta se s $x$ nemění, její graf je vodorovná přímka se sklonem 0. Derivace každé konstanty je proto nula a člen z výsledku zmizí.', board: lines };
  }
  if (p.n === 1 && p.d === 1) {
    if (c.n === 1 && c.d === 1) pushL(lines, "x'=1");
    else {
      pushL(lines, `(${hl('c', cT)}x)'`);
      pushL(lines, `=${hl('c', cT)}\\cdot x'`);
      pushL(lines, `=${hl('c', cT)}\\cdot 1`);
      pushL(lines, `=${cT}`);
    }
    return { title, text: 'Člen $c\\cdot x$ je přímka se sklonem $c$. Podle pravidla $(c\\cdot f)\'=c\\cdot f\'$ konstantu opíšeme a $x\'=1$, takže výsledkem je samotné číslo $c$.', board: lines };
  }
  const pT = frTex(p);
  const pP = p.n < 0 ? `(${pT})` : pT;
  const unit = c.n === 1 && c.d === 1;
  const cA = unit ? '' : c.n === -1 && c.d === 1 ? '-' : hl('c', cT);
  pushL(lines, `(${cA}x^{${hl('p', pT)}})'`);
  pushL(lines, `=${unit ? '' : `${hl('c', cT)}\\cdot `}${hl('p', pP)}\\,x^{${hl('p', pT)}-1}`);
  const e = sub(p, fr(1));
  pushL(lines, p.d === 1 ? `${pT}-1=${frTex(e)}` : `${pT}-1=${pT}-\\frac{${p.d}}{${p.d}}=${frTex(e)}`);
  if (!unit) pushL(lines, `${cT}\\cdot ${pP}=${frTex(mul(c, p))}`);
  pushL(lines, `=${powTermTex(d, true)}`);
  const frac = p.d !== 1;
  return {
    title,
    text: `Použijeme $(x^n)'=n\\cdot x^{n-1}$ s $n=${pT}$: exponent $${pT}$ se objeví jako násobitel před $x$${unit ? '' : ' (vynásobí se s číslem před $x$)'} a z exponentu se odečte jednička. ${frac ? 'Zlomky odečítáme na společný jmenovatel: jedničku zapíšeme jako zlomek se stejným jmenovatelem, jako má exponent. ' : ''}Exponent a koeficient dopočítáme zvlášť, aby se nic nepletlo.`,
    board: lines,
  };
}

// Druhý, kratší postup „ze semináře“ (řetízek rovností na tabuli): odmocniny na mocniny v jednom zlomku,
// rozdělení zlomku a odečtení exponentů, derivace po členech, úprava a zpět na odmocniny.
const gcdN = (a, b) => (b ? gcdN(b, a % b) : Math.abs(a));
function exponentLines(a, d) {
  const e = sub(a, d);
  const dP = d.n < 0 ? `(${frTex(d)})` : frTex(d);
  const lines = [];
  pushL(lines, `${frTex(a)}-${dP}`);
  if (a.d !== d.d) {
    const L = (a.d * d.d) / gcdN(a.d, d.d);
    pushL(lines, `=\\frac{${a.n * (L / a.d)}}{${L}}-${d.n < 0 ? '(' : ''}\\frac{${d.n * (L / d.d)}}{${L}}${d.n < 0 ? ')' : ''}`);
  }
  pushL(lines, `=${frTex(e)}`);
  return lines;
}
function seminarVariant(num, den, S, D, post) {
  const steps = [];
  const xp = (q) => (q.n === 1 && q.d === 1 ? 'x' : `x^{${frTex(q)}}`);
  const wrap = (pre, tex) => `${pre}\\left(${tex}\\right)'`;
  // 1. mocniny v jednom zlomku
  const b1 = [];
  if (den) {
    const dRoot = absTermTex({ c: fr(1), p: den, E: 0, S: 0, C: 0, L: 0 });
    const one = (pre, N, Dn) => {
      const t = wrap(pre, `\\frac{${N}}{${Dn}}`);
      return texWidth(t) <= LIM ? [mk(t)] : fracLines(pre.replace(/'\\(x\\)=$/, '(x)='), N, Dn);
    };
    for (const l of one("f'(x)=", sumTex(num), dRoot)) pushL(b1, l.tex);
    for (const l of one('=', powSumTex(num), xp(den))) pushL(b1, l.tex);
    steps.push({ title: 'Zápis jako mocniny v jednom zlomku', text: 'Odmocniny přepíšeme na mocniny, $\\sqrt[n]{x^p}=x^{p/n}$, a celý výraz zapíšeme jako jeden zlomek v závorce s čárkou (derivace).', board: b1 });
    // 2. rozdělení a dělení mocnin
    const dp = xp(den);
    const parts = num.map((t, i) => `${t.c.n < 0 ? '-' : i ? '+' : ''}\\frac{${powSumTex([{ ...t, c: fr(Math.abs(t.c.n), t.c.d) }])}}{${dp}}`).join('');
    const b2 = [];
    pushL(b2, wrap('=', parts));
    pushL(b2, wrap('=', num.map((t, i) => {
      const sg = t.c.n < 0 ? '-' : i ? '+' : '';
      const co = Math.abs(t.c.n) === 1 && t.c.d === 1 ? '' : frTex(fr(Math.abs(t.c.n), t.c.d));
      return isZero(t.p) ? powTermTex({ ...t, p: sub(t.p, den) }, !i) : `${sg}${co}x^{${frTex(t.p)}-${frTex(den)}}`;
    }).join('')));
    for (const t of num) if (!isZero(t.p)) for (const l of exponentLines(t.p, den)) pushL(b2, l.tex);
    pushL(b2, wrap('=', powSumTex(S)));
    steps.push({ title: 'Rozdělení zlomku a dělení mocnin', text: 'Každý člen čitatele vydělíme jmenovatelem a mocniny dělíme odečtením exponentů: $\\frac{x^a}{x^b}=x^{a-b}$. Exponenty počítáme na společný jmenovatel.', board: b2 });
  } else {
    for (const l of [wrap("f'(x)=", sumTex(num)), wrap('=', powSumTex(S))]) pushL(b1, l);
    steps.push({ title: 'Zápis jako mocniny', text: 'Odmocniny a zlomky přepíšeme na mocniny, $\\sqrt[n]{x^p}=x^{p/n}$ a $\\frac{1}{x^n}=x^{-n}$, a celý výraz derivujeme po členech.', board: b1 });
  }
  // 3. derivace po členech
  const powBody = powSumTex(D);
  const x5 = (q) => xp(q);
  const body5 = D.map((t, i) => {
    const sg = t.c.n < 0 ? '-' : i ? '+' : '';
    return t.p.n < 0 ? `${sg}\\frac{${Math.abs(t.c.n)}}{${t.c.d !== 1 ? t.c.d : ''}${x5(fr(-t.p.n, t.p.d))}}` : powTermTex(t, !i);
  }).join('') || '0';
  const resBody = sumTex(D);
  const b3 = [];
  pushL(b3, `f'(x)=${rawDerivTex(S)}`);
  if (powBody !== resBody) pushL(b3, `=${powBody}`);
  steps.push({ title: 'Derivace po členech', text: 'Každý člen zderivujeme podle $(x^n)\'=n\\cdot x^{n-1}$: exponent se vynásobí s koeficientem a z exponentu odečteme jedničku. Konstanta se zderivuje na nulu.', board: b3 });
  // 4. úprava a zpět na odmocniny
  const b4 = [{ tex: '\\boxed{\\sqrt[n]{x^p}=x^{p/n}}' }];
  if (body5 !== powBody && body5 !== resBody) pushL(b4, `=${body5}`);
  b4.push(post(resBody));
  steps.push({ title: 'Úprava a zpět na odmocniny', text: 'Záporné exponenty zapíšeme jako zlomky a koeficienty vynásobíme. Nakonec mocniny vrátíme na odmocniny podle vzorce v rámečku.', board: b4 });
  return [{ id: 'seminar', title: 'Postup ze semináře', solution: steps }];
}

// =====================================================================
// Typ 1: derivace součtu mocnin (odmocniny, zlomky 1/x^n, dělení mocninou x)
// data = { terms: [{c, p}], den?: p }   f = (součet)/x^den
function solveMocniny(data) {
  const num = sumOf(data.terms);
  const den = data.den !== undefined ? parseFr(data.den) : null;
  const S = den ? norm(num.map((t) => ({ ...t, p: sub(t.p, den) })), { keepOrder: true }) : num;
  const denTex = den ? absTermTex({ c: fr(1), p: den, E: 0, S: 0, C: 0, L: 0 }) : '';
  const fTex = den ? `\\frac{${sumTex(num)}}{${denTex}}` : sumTex(num);
  const steps = [];

  // Postup začíná rovnou počítáním; pravidlo (x^n)' = n·x^(n-1) je připomenuto v textu u každého členu.

  // 2. přepis na mocniny
  const rootsNum = num.filter((t) => needsRewrite(t) && t.p.n > 0);
  const toRewrite = den ? rootsNum : S.filter(needsRewrite);
  const denRoot = den && den.d !== 1;
  if (toRewrite.length || denRoot) {
    const lines = [mk(`f(x)=${fTex}`)];
    if (denRoot) pushL(lines, `${rootTex(den.n, den.d)}=x^{\\frac{${den.n}}{${den.d}}}`);
    for (const t of toRewrite) for (const l of toPowerLines(t)) pushL(lines, l.tex);
    pushL(lines, den ? `f(x)=\\frac{${powSumTex(num)}}{x^{${frTex(den)}}}` : `f(x)=${powSumTex(S)}`);
    steps.push({
      title: 'Přepis odmocnin na mocniny',
      text: 'Vzorec pro mocninu umíme jen pro $x^p$, proto odmocniny a zlomky nejdřív přepíšeme: $\\sqrt[n]{x^k}=x^{\\frac{k}{n}}$ (čitatel exponentu je mocnina pod odmocninou, jmenovatel je stupeň odmocniny) a $\\frac{1}{x^n}=x^{-n}$ (zlomek s $x$ ve jmenovateli je záporný exponent). Členy, které už jsou mocniny, opíšeme beze změny. Nakonec je celá funkce součet členů $c\\cdot x^p$.',
      board: lines,
    });
  }
  if (den) {
    const dp = `x^{${frTex(den)}}`;
    steps.push({
      title: 'Rozdělení zlomku na členy',
      text: 'Zlomek se součtem v čitateli rozdělíme na samostatné zlomky: každý člen čitatele vydělíme jmenovatelem.',
      board: [mk(`=${num.map((t, i) => `${t.c.n < 0 ? '-' : i ? '+' : ''}\\frac{${powSumTex([{ ...t, c: fr(Math.abs(t.c.n), t.c.d) }])}}{${dp}}`).join('')}`)],
    });
    const dl = [];
    for (const t of num) {
      const sg = t.c.n < 0 ? '-' : '';
      const absT = { ...t, c: fr(Math.abs(t.c.n), t.c.d) };
      const st = { ...t, p: sub(t.p, den) };
      const left = `${sg}\\frac{${powSumTex([absT])}}{${dp}}`;
      if (isZero(t.p)) pushL(dl, `${left}=${powTermTex(st, true)}`);
      else {
        const co = absT.c.n === 1 && absT.c.d === 1 ? '' : frTex(absT.c);
        pushL(dl, `${left}=${sg}${co}x^{${frTex(t.p)}-${frTex(den)}}`);
        pushL(dl, `=${powTermTex(st, true)}`);
      }
    }
    pushL(dl, `f(x)=${powSumTex(S)}`);
    steps.push({
      title: 'Dělení mocnin odečtením exponentů',
      text: 'Mocniny se stejným základem dělíme tak, že exponenty odečteme: $\\frac{x^a}{x^b}=x^{a-b}$. Konstanta děleno $x^b$ je rovnou $x^{-b}$.',
      board: dl,
    });
  }

  // 3. derivace po členech
  for (const t of S) steps.push(termDerivStep(t));

  // 4. sečtení
  const D = dSum(S);
  const parts = S.map((t) => {
    const d = dTerm(t)[0];
    return d ? powTermTex(d, false) : '+0';
  });
  const sumLines = [];
  pushL(sumLines, `f'(x)=${parts.join('').replace(/^\+/, '')}`);
  pushL(sumLines, `f'(x)=${powSumTex(D)}`);
  steps.push({
    title: 'Sečtení členů',
    text: 'Derivace součtu je součet derivací, takže výsledky jednotlivých členů znovu sečteme. Nulové členy (z konstant) vynecháme. Zatím máme derivaci zapsanou pomocí mocnin se zlomkovými a zápornými exponenty.',
    board: sumLines,
  });

  // 5. zpět na odmocniny a zlomky
  const back = D.filter(needsRewrite);
  const post = (tex) => resultLine(texWidth(`f'(x)=${tex}`) <= LIM ? "f'(x)=" : '=', tex);
  if (back.length) {
    const lines = [];
    for (const t of back) for (const l of fromPowerLines(t)) pushL(lines, l.tex);
    lines.push(post(sumTex(D)));
    steps.push({
      title: 'Zpět na odmocniny a zlomky',
      text: 'Výsledek zapíšeme jako na začátku: $x^{-n}=\\frac{1}{x^n}$ (záporný exponent znamená zlomek), $x^{\\frac{k}{n}}=\\sqrt[n]{x^k}$ (jmenovatel exponentu je stupeň odmocniny) a $x^{-\\frac{k}{n}}=\\frac{1}{\\sqrt[n]{x^k}}$. Je-li exponent větší než 1, vytkneme celou část: $x^{\\frac{3}{2}}=x\\sqrt{x}$. Členy s kladným celým exponentem se nemění.',
      board: lines,
    });
  } else {
    const last = steps[steps.length - 1];
    last.board = [...last.board.slice(0, -1), post(powSumTex(D))];
  }
  return {
    id: idOf('mocniny', data), topic: TOPIC, type: 'mocniny', data,
    task: 'Urči derivaci $f\'(x)$. Výsledek zapiš jako výraz v $x$, např. 6x^2 - 1/x^2 + 3/(2*sqrt(x)).',
    promptTex: `f(x)=${fTex}`,
    hint: 'Odmocninu zapiš jako sqrt(x) nebo √(x), třetí odmocninu jako x^(1/3); stačí jakýkoli rovnocenný tvar.',
    answerSpec: exprSpec(sumStr(D)),
    answerTex: sumTex(D),
    solution: steps,
    variants: seminarVariant(num, den, S, D, post),
  };
}
const MOC_POOL = [
  (rng) => T(rnz(rng, -5, 5), ri(rng, 2, 5)),
  (rng) => T(rnz(rng, -6, 6), 1),
  (rng) => T(rnz(rng, -9, 9)),
  (rng) => T(pick(rng, [2, 4, 6, -2, -4, 1]), '1/2'),
  (rng) => T(pick(rng, [3, 6, -3, 9]), '2/3'),
  (rng) => T(pick(rng, [1, 3, -3]), '1/3'),
  (rng) => T(rnz(rng, -4, 4), -ri(rng, 1, 3)),
  (rng) => T(pick(rng, [2, 4, -2, -6]), '-1/2'),
  (rng) => T(pick(rng, [2, 4, -2]), '3/2'),
];
function genMocniny(rng) {
  for (;;) {
    if (rng() < 0.3) {
      // (členy)/x^den
      const den = pick(rng, [1, 2, '1/2']);
      const pool = [T(rnz(rng, -4, 4), ri(rng, 3, 4)), T(rnz(rng, -5, 5), 2), T(pick(rng, [1, 2, -3]), '3/2'), T(rnz(rng, -5, 5), 1), T(rnz(rng, -6, 6))];
      const terms = [];
      while (terms.length < 3) {
        const t = pick(rng, pool);
        if (!terms.some((u) => String(u.p ?? 0) === String(t.p ?? 0))) terms.push(t);
      }
      const data = { terms, den };
      const S = sumOf(terms).map((t) => sub(t.p, parseFr(den)));
      if (S.every((p) => isZero(p))) continue;
      return solveMocniny(data);
    }
    const n = pick(rng, [2, 3, 3]);
    const terms = [];
    while (terms.length < n) {
      const t = pick(rng, MOC_POOL)(rng);
      if (!terms.some((u) => String(u.p ?? 0) === String(t.p ?? 0))) terms.push(t);
    }
    const S = sumOf(terms);
    if (S.every((t) => t.p.d === 1 && t.p.n >= 0)) continue; // aspoň jeden člen k přepsání
    if (S.filter((t) => !isZero(t.p)).length < 2) continue;
    return solveMocniny({ terms });
  }
}

// =====================================================================
// Typ 2: derivace součinu  (u·v)' = u'v + uv'
// data = { u: [členy], v: [členy] }
function solveSoucin(data) {
  const u = sumOf(data.u); const v = sumOf(data.v);
  const du = dSum(u); const dv = dSum(v);
  const uT = sumTex(u); const vT = sumTex(v);
  const uP = parenTex(u); const vP = parenTex(v);
  const steps = [];
  steps.push({
    title: 'Pravidlo pro součin',
    text: 'Funkce je součin dvou činitelů: první označíme $u$, druhý $v$. Derivace součinu: $(u\\cdot v)\'=u\'\\cdot v+u\\cdot v\'$ – derivujeme vždy jen jeden činitel, druhý opíšeme.',
    board: [
      { tex: `f'(x)=\\big(${cls('u', uP)}\\cdot ${cls('v', vP)}\\big)'`, notes: [brace('u', 'u'), brace('v', 'v', 'below')] },
      { tex: `=(${uT})'\\cdot ${vP}+${uP}\\cdot(${vT})'` },
    ],
  });
  steps.push({
    title: 'Derivace činitelů',
    text: `Zderivujeme oba činitele podle vzorců: $u'=${sumTex(du)}$, $v'=${sumTex(dv)}$, a dosadíme je.`,
    board: [{
      tex: `=${cls('du', parenTex(du))}\\cdot ${vP}+${uP}\\cdot ${cls('dv', parenTex(dv))}`,
      notes: [brace('du', "u′"), brace('dv', "v′", 'below')],
    }],
  });
  const A = mulSum(du, v); const B = mulSum(u, dv);
  const total = norm([...A, ...B], { keepOrder: true });
  const lines = [];
  const expanded = `${sumTex(A)}${B.map((t) => termTex(t, false)).join('')}`;
  pushNew(lines, `=${expanded}`);
  pushNew(lines, `=${sumTex(total)}`);
  const fe = factorETex(total);
  if (fe) pushNew(lines, `=${fe}`);
  markLast(lines);
  steps.push({
    title: 'Roznásobení a úprava',
    text: fe ? 'Roznásobíme, sečteme stejné členy a vytkneme společný činitel $e^{x}$ (u $e^{-x}$ obdobně).' : 'Roznásobíme a sečteme stejné členy.',
    board: lines,
  });
  return {
    id: idOf('soucin', data), topic: TOPIC, type: 'soucin', data,
    task: 'Urči derivaci součinu $f\'(x)$. Výsledek zapiš jako výraz v $x$, např. (x^2+2*x)*e^x.',
    promptTex: `f(x)=${uP}\\cdot ${vP}`,
    hint: HINT_EXPR,
    answerSpec: exprSpec(sumStr(total)),
    answerTex: fe || sumTex(total),
    solution: steps,
  };
}
const U_POOL = [
  (rng) => [T(rnz(rng, -3, 3) || 1, ri(rng, 1, 4))],
  (rng) => [T(1, 2), T(rnz(rng, -4, 4), 1)],
  (rng) => [T(1, 2), T(rnz(rng, -5, 5))],
  (rng) => [T(rnz(rng, -3, 3), 1), T(rnz(rng, -5, 5))],
  (rng) => [T(1, 3), T(rnz(rng, -3, 3), 1)],
];
const V_POOL = [
  () => [T(1, 0, { E: 1 })], () => [T(1, 0, { E: -1 })], () => [T(1, 0, { E: 2 })],
  () => [T(1, 0, { S: 1 })], () => [T(1, 0, { C: 1 })], () => [T(1, 0, { L: 1 })],
];
function genSoucin(rng) {
  const u = pick(rng, U_POOL)(rng);
  let v = pick(rng, V_POOL)(rng);
  if (rng() < 0.15) return solveSoucin({ u: [T(1, 0, { E: 1 })], v: pick(rng, [[T(1, 0, { S: 1 })], [T(1, 0, { C: 1 })]]) });
  if (rng() < 0.15) v = [T(1, 0, { L: 1 })];
  return solveSoucin({ u, v });
}

// =====================================================================
// Typ 3: derivace podílu  (u/v)' = (u'v − uv')/v²
// data = { u, v }
function solvePodil(data) {
  const u = sumOf(data.u); const v = sumOf(data.v);
  const du = dSum(u); const dv = dSum(v);
  const uT = sumTex(u); const vT = sumTex(v);
  const uP = parenTex(u); const vP = parenTex(v);
  const vSq = `${v.length > 1 || v[0].c.n < 0 || v[0].c.d !== 1 || !isZero(v[0].p) && v[0].p.d !== 1 ? `(${vT})` : `(${vT})`}^{2}`;
  const steps = [];
  steps.push({
    title: 'Pravidlo pro podíl',
    text: 'Čitatel označíme $u$, jmenovatel $v$. Derivace podílu: $\\left(\\frac{u}{v}\\right)\'=\\frac{u\'\\cdot v-u\\cdot v\'}{v^2}$. Pozor na pořadí v čitateli – začíná se derivací čitatele a mezi členy je minus.',
    board: [
      { tex: `f'(x)=\\left(\\frac{${cls('u', uT)}}{${cls('v', vT)}}\\right)'`, notes: [brace('u', 'u'), brace('v', 'v', 'below')] },
      ...fracLines('=', `(${uT})'\\cdot ${vP}${minusTex(`${uP}\\cdot(${vT})'`)}`, vSq),
    ],
  });
  steps.push({
    title: 'Derivace čitatele a jmenovatele',
    text: `Zderivujeme: $u'=${sumTex(du)}$, $v'=${sumTex(dv)}$ a dosadíme do vzorce. Jmenovatel zatím jen opíšeme, neroznásobujeme ho.`,
    board: fracLines('=', `${cls('du', parenTex(du))}\\cdot ${vP}-${uP}\\cdot ${cls('dv', parenTex(dv))}`, vSq,
      [brace('du', "u′"), brace('dv', "v′", 'below')]),
  });
  const A = mulSum(du, v); const B = mulSum(u, dv);
  const N = subSum(A, B);
  const single = v.length === 1;
  const v2 = single ? mulTerm(v[0], v[0]) : null;
  const denT = single ? absTermTex(v2) : vSq;
  // dvojice čitatel/jmenovatel; poslední z nich je výsledek (dvojité podtržení)
  const pairs = [];
  const addPair = (Nt, Dt, notes) => {
    const k = `${Nt}|${Dt}`;
    if (!pairs.length || pairs[pairs.length - 1].k !== k) pairs.push({ k, Nt, Dt, notes });
  };
  addPair(`${sumTex(A)}-${parenTex(B)}`, denT);
  addPair(sumTex(N), denT);
  let ansN = N; let ansD = single ? [v2] : null;
  let text = 'Roznásobíme součiny v čitateli (druhý součin odečítáme celý, proto je v závorce) a sečteme stejné členy.';
  if (single) {
    // krácení společné mocniny x a e^{Ex}
    const g = Math.min(...N.map((t) => toNum(t.p)), toNum(v2.p));
    const gp = g > 0 ? fr(Math.round(g * 6), 6) : fr(0);
    const eN = N.every((t) => t.E === N[0].E) ? N[0].E : 0;
    const gE = eN > 0 && v2.E > 0 ? Math.min(eN, v2.E) : eN < 0 && v2.E < 0 ? Math.max(eN, v2.E) : 0;
    if (!isZero(gp) || gE) {
      const G = { c: fr(1), p: gp, E: gE, S: 0, C: 0, L: 0 };
      const rest = N.map((t) => divTerm(t, G));
      const dRest = divTerm(v2, G);
      const gT = absTermTex(G);
      const dRestT = absTermTex(dRest);
      const isOne = dRest.c.n === 1 && dRest.c.d === 1 && isZero(dRest.p) && !dRest.E;
      addPair(`${cls('krat', gT)}\\,${rest.length > 1 ? `(${sumTex(rest)})` : sumTex(rest)}`,
        `${cls('krat', gT)}${isOne ? '' : `\\cdot ${dRestT}`}`, [{ kind: 'strike', target: 'bt-krat' }]);
      ansN = rest; ansD = [dRest];
      if (isOne) pairs.push({ k: 'one', Nt: sumTex(rest), Dt: null });
      else addPair(sumTex(rest), dRestT);
      text += ` Čitatel i jmenovatel obsahují společný činitel $${gT}$ – vytkneme ho a zkrátíme.`;
    }
  }
  const lines = [];
  let finalBody = '';
  pairs.forEach((q, i) => {
    if (i < pairs.length - 1) lines.push(...fracLines('=', q.Nt, q.Dt, q.notes));
    else {
      finalBody = q.Dt === null ? q.Nt : `\\frac{${q.Nt}}{${q.Dt}}`;
      lines.push(resultLine('=', finalBody));
    }
  });
  steps.push({ title: 'Úprava čitatele', text, board: lines });
  const dStr = single ? sumStr(ansD) : `(${sumStr(v)})^2`;
  return {
    id: idOf('podil', data), topic: TOPIC, type: 'podil', data,
    task: 'Urči derivaci podílu $f\'(x)$. Výsledek zapiš jako výraz v $x$, např. (2*x+1)/(x^2+1)^2.',
    promptTex: `f(x)=\\frac{${uT}}{${vT}}`,
    hint: HINT_EXPR,
    answerSpec: exprSpec(`(${sumStr(ansN)})/(${dStr})`),
    answerTex: finalBody,
    solution: steps,
  };
}
function genPodil(rng) {
  const kind = pick(rng, ['poly', 'poly', 'poly', 'ln', 'exp', 'xexp', 'sin']);
  if (kind === 'ln') return solvePodil({ u: [T(1, 0, { L: 1 })], v: [T(1, ri(rng, 1, 4))] });
  if (kind === 'exp') return solvePodil({ u: [T(1, 0, { E: pick(rng, [1, 2]) })], v: [T(1, ri(rng, 1, 3))] });
  if (kind === 'xexp') return solvePodil({ u: [T(1, ri(rng, 1, 3))], v: [T(1, 0, { E: 1 })] });
  if (kind === 'sin') return solvePodil({ u: [T(1, 0, pick(rng, [{ S: 1 }, { C: 1 }]))], v: [T(1, ri(rng, 1, 2))] });
  for (;;) {
    const lin = () => [T(ri(rng, 1, 3), 1), T(rnz(rng, -5, 5))];
    const quad = () => [T(1, 2), T(ri(rng, -3, 3), 1), T(rnz(rng, -5, 5))];
    const u = rng() < 0.6 ? lin() : quad();
    const v = rng() < 0.5 ? lin() : quad();
    const us = sumOf(u); const vs = sumOf(v);
    // u není násobkem v (podíl by byl konstanta)
    if (us.length === vs.length && us.every((t, i) => toNum(t.p) === toNum(vs[i].p))
      && us.every((t, i) => Math.abs(toNum(t.c) / toNum(vs[i].c) - toNum(us[0].c) / toNum(vs[0].c)) < 1e-12)) continue;
    if (subSum(mulSum(dSum(us), vs), mulSum(us, dSum(vs))).length === 0) continue;
    return solvePodil({ u, v });
  }
}

// =====================================================================
// Typ 4: složená funkce (řetízkové pravidlo)
// data = { outer: 'pow'|'sqrt'|'exp'|'ln'|'sin'|'cos', n?, inner: [členy] }
function isAtom(s) {
  return s.length === 1 && s[0].c.n === 1 && s[0].c.d === 1 && isZero(s[0].p) && !s[0].E
    && (s[0].S + s[0].C + s[0].L) === 1;
}
const atomName = (t) => (t.S ? 'sin' : t.C ? 'cos' : 'ln');
function wrapTex(outer, n, inT, inner) {
  switch (outer) {
    case 'pow': return isAtom(inner) ? `\\${atomName(inner[0])}^{${n}}x` : `(${inT})^{${n}}`;
    case 'sqrt': return `\\sqrt{${inT}}`;
    case 'exp': return `e^{${inT}}`;
    case 'ln': return `\\ln(${inT})`;
    case 'tan': return `\\operatorname{tg}(${inT})`;
    case 'atan': return `\\operatorname{arctg}(${inT})`;
    case 'acot': return `\\operatorname{arccotg}(${inT})`;
    case 'asin': return `\\arcsin(${inT})`;
    case 'acos': return `\\arccos(${inT})`;
    case 'apow': return `${n}^{${inT}}`;
    case 'log': return `\\log_{${n}}(${inT})`;
    default: return `\\${outer}(${inT})`;
  }
}
function powPart(n, inner) { // (inner)^{n} pro n ≥ 1
  const inT = sumTex(inner);
  if (n === 1) return isAtom(inner) ? inT : `(${inT})`;
  return isAtom(inner) ? `\\${atomName(inner[0])}^{${n}}x` : `(${inT})^{${n}}`;
}
// Zlomek num/den bez vnořeného zlomku: je-li čitatel sám zlomek a/b, vyjde a/(b·den).
function matchEnd(s, i) { // index za uzavírací } skupiny začínající { na pozici i
  let d = 0;
  for (let k = i; k < s.length; k++) { if (s[k] === '{') d++; else if (s[k] === '}') { d--; if (d === 0) return k + 1; } }
  return -1;
}
function fracOf(num, den) {
  const head = '\\frac{';
  if (num.startsWith(head)) {
    const e1 = matchEnd(num, head.length - 1);
    if (e1 > 0 && num[e1] === '{' && matchEnd(num, e1) === num.length) {
      const a = num.slice(head.length, e1 - 1); const b = num.slice(e1 + 1, -1);
      let top = 0; let sum = false;
      for (const ch of den) { if ('{(['.includes(ch)) top++; else if ('})]'.includes(ch)) top--; else if (top === 0 && (ch === '+' || ch === '-')) sum = true; }
      return `\\frac{${a}}{${b}${sum ? `(${den})` : den}}`;
    }
  }
  return `\\frac{${num}}{${den}}`;
}
function solveSlozena(data) {
  const { outer } = data; const n = data.n | 0;
  const inner = sumOf(data.inner);
  const inT = sumTex(inner);
  const dIn = dSum(inner);
  const fTex = wrapTex(outer, n, cls('in', inT), inner);
  const fPlain = wrapTex(outer, n, inT, inner);
  const outerD = {
    pow: `${n}${powPart(n - 1, inner)}`,
    sqrt: `\\frac{1}{2\\sqrt{${inT}}}`,
    exp: `e^{${inT}}`,
    ln: `\\frac{1}{${inT}}`,
    sin: `\\cos(${inT})`,
    cos: `-\\sin(${inT})`,
    tan: `\\frac{1}{\\cos^{2}(${inT})}`,
    atan: `\\frac{1}{1+(${inT})^{2}}`,
    acot: `-\\frac{1}{1+(${inT})^{2}}`,
    asin: `\\frac{1}{\\sqrt{1-(${inT})^{2}}}`,
    acos: `-\\frac{1}{\\sqrt{1-(${inT})^{2}}}`,
    apow: `${n}^{${inT}}\\ln ${n}`,
    log: `\\frac{1}{${parenTex(inner)}\\ln ${n}}`,
  }[outer];
  const outerName = {
    pow: `mocnina $y^{${n}}$`, sqrt: 'odmocnina $\\sqrt{y}$', exp: 'exponenciála $e^{y}$', ln: 'logaritmus $\\ln y$',
    sin: 'sinus $\\sin y$', cos: 'kosinus $\\cos y$', tan: 'tangens $\\operatorname{tg}y$', atan: 'arkustangens $\\operatorname{arctg}y$',
    acot: 'arkuskotangens $\\operatorname{arccotg}y$', asin: 'arkussinus $\\arcsin y$', acos: 'arkuskosinus $\\arccos y$',
    apow: `exponenciála o základu ${n}: $${n}^{y}$`, log: `logaritmus o základu ${n}: $\\log_{${n}}y$`,
  }[outer];
  const outerRule = {
    pow: `(y^{${n}})'=${n}y^{${n - 1 === 1 ? '' : n - 1}}`.replace('y^{}', 'y'), sqrt: "(\\sqrt{y})'=\\frac{1}{2\\sqrt{y}}", exp: "(e^{y})'=e^{y}",
    ln: "(\\ln y)'=\\frac{1}{y}", sin: "(\\sin y)'=\\cos y", cos: "(\\cos y)'=-\\sin y",
    tan: "(\\operatorname{tg}y)'=\\frac{1}{\\cos^{2}y}", atan: "(\\operatorname{arctg}y)'=\\frac{1}{1+y^{2}}",
    acot: "(\\operatorname{arccotg}y)'=-\\frac{1}{1+y^{2}}", asin: "(\\arcsin y)'=\\frac{1}{\\sqrt{1-y^{2}}}",
    acos: "(\\arccos y)'=-\\frac{1}{\\sqrt{1-y^{2}}}", apow: `(${n}^{y})'=${n}^{y}\\ln ${n}`, log: `(\\log_{${n}}y)'=\\frac{1}{y\\ln ${n}}`,
  }[outer];
  const steps = [];
  steps.push({
    title: 'Vnější a vnitřní funkce',
    text: `Funkce je složená: vnější funkce je ${outerName}, do které je dosazena vnitřní funkce $y=${inT}$ (označená závorkou).`,
    board: [{ tex: `f(x)=${fTex}`, notes: [brace('in', 'vnitřní y', 'below')] }],
  });
  const dInP = parenTex(dIn);
  steps.push({
    title: 'Řetízkové pravidlo',
    text: `Derivujeme vnější funkci podle vzorce $${outerRule}$ a vnitřek přitom necháme beze změny; výsledek vynásobíme derivací vnitřní funkce $(${inT})'=${sumTex(dIn)}$.`,
    board: [
      { tex: `f'(x)=${cls('out', outerD)}\\cdot ${cls('din', `(${inT})'`)}`, notes: [brace('out', 'vnější derivace'), brace('din', 'vnitřní derivace', 'below')] },
      { tex: `=${outerD}\\cdot ${dInP}` },
    ],
  });
  // úprava
  let res; let str;
  const iS = sumStr(inner); const dS = sumStr(dIn);
  const single = dIn.length === 1;
  const lead = (s, rest) => { // člen s (jeden) krát zbytek: koeficient a x-část dopředu
    const t = s[0];
    const a = fr(Math.abs(t.c.n), t.c.d);
    const body = absTermTex({ ...t, c: fr(1, t.c.d) });
    const coef = a.n !== 1 || (body === '1' || body.startsWith('\\frac')) ? String(a.n === 1 && body !== '1' ? '' : a.n) : '';
    const bodyT = body === '1' ? '' : body;
    return `${t.c.n < 0 ? '-' : ''}${coef}${bodyT}${rest}`;
  };
  switch (outer) {
    case 'pow': {
      const K = scale(dIn, fr(n));
      res = single ? lead(K, powPart(n - 1, inner)) : `${n}(${sumTex(dIn)})${powPart(n - 1, inner)}`;
      str = `${n}*(${iS})^(${n - 1})*(${dS})`;
      break;
    }
    case 'sqrt': {
      const even = dIn.every((t) => t.c.d === 1 && t.c.n % 2 === 0);
      const top = even ? scale(dIn, fr(1, 2)) : dIn;
      const den = even ? `\\sqrt{${inT}}` : `2\\sqrt{${inT}}`;
      const negOne = top.length === 1 && top[0].c.n < 0;
      res = negOne ? `-${fracOf(sumTex(neg(top)), den)}` : fracOf(sumTex(top), den);
      str = `(${dS})/(2*sqrt(${iS}))`;
      break;
    }
    case 'exp': res = single ? lead(dIn, `e^{${inT}}`) : `(${sumTex(dIn)})e^{${inT}}`; str = `(${dS})*exp(${iS})`; break;
    case 'ln': {
      const negOne = single && dIn[0].c.n < 0;
      res = negOne ? `-${fracOf(sumTex(neg(dIn)), inT)}` : fracOf(sumTex(dIn), inT);
      str = `(${dS})/(${iS})`;
      break;
    }
    case 'sin': res = single ? lead(dIn, `\\cos(${inT})`) : `(${sumTex(dIn)})\\cos(${inT})`; str = `(${dS})*cos(${iS})`; break;
    case 'cos': res = single ? lead(neg(dIn), `\\sin(${inT})`) : `-(${sumTex(dIn)})\\sin(${inT})`; str = `-(${dS})*sin(${iS})`; break;
    case 'tan': res = fracOf(sumTex(dIn), `\\cos^{2}(${inT})`); str = `(${dS})/cos(${iS})^2`; break;
    case 'atan': case 'acot': case 'asin': case 'acos': {
      const sq = mulSum(inner, inner);
      const isTan = outer === 'atan' || outer === 'acot';
      const den1 = isTan ? `1+${sumTex(sq)}` : `\\sqrt{1-${parenTex(sq)}}`;
      const minus = outer === 'acot' || outer === 'acos';
      const top = minus ? neg(dIn) : dIn;
      const negOne = top.length === 1 && top[0].c.n < 0;
      res = negOne ? `-${fracOf(sumTex(neg(top)), den1)}` : fracOf(sumTex(top), den1);
      const sqS = `(${sumStr(sq)})`;
      str = `${minus ? '-' : ''}(${dS})/${isTan ? `(1+${sqS})` : `sqrt(1-${sqS})`}`;
      break;
    }
    case 'apow': res = single ? lead(dIn, `${n}^{${inT}}\\ln ${n}`) : `(${sumTex(dIn)})${n}^{${inT}}\\ln ${n}`; str = `(${dS})*${n}^(${iS})*log(${n})`; break;
    default: { // log
      const negOne = single && dIn[0].c.n < 0;
      const den = `${parenTex(inner)}\\ln ${n}`;
      res = negOne ? `-${fracOf(sumTex(neg(dIn)), den)}` : fracOf(sumTex(dIn), den);
      str = `(${dS})/((${iS})*log(${n}))`;
    }
  }
  steps.push({
    title: 'Úprava',
    text: 'Číselné činitele vynásobíme a derivaci vnitřní funkce zapíšeme dopředu (případně do čitatele zlomku).',
    board: [resultLine('=', res)],
  });
  return {
    id: idOf('slozena', data), topic: TOPIC, type: 'slozena', data,
    task: 'Urči derivaci složené funkce $f\'(x)$. Výsledek zapiš jako výraz v $x$, např. 6*x*(x^2+1)^2. Zápis: tg = tan, arctg = atan, arccotg = acot, arcsin = asin, arccos = acos, log_a(y) = log(y, a), přirozený logaritmus = log(y).',
    promptTex: `f(x)=${fPlain}`,
    hint: HINT_EXPR,
    answerSpec: exprSpec(str),
    answerTex: res,
    solution: steps,
  };
}
function genSlozena(rng) {
  const outer = pick(rng, ['pow', 'pow', 'sqrt', 'exp', 'ln', 'sin', 'cos', 'tan', 'atan', 'asin', 'acos', 'acot', 'apow', 'log']);
  const lin = (pos) => [T(pos ? ri(rng, 2, 4) : pick(rng, [2, 3, 4, -2, -3, -1]), 1), T(rnz(rng, -6, 6))];
  const quad = () => [T(1, 2), T(ri(rng, -5, 5), 1), T(ri(rng, 1, 6))];
  const cub = () => [T(rnz(rng, -2, 2), 3), T(rnz(rng, -3, 3), 1), T(rnz(rng, -6, 6))];
  switch (outer) {
    case 'pow': {
      const r = rng();
      if (r < 0.25) return solveSlozena({ outer, n: ri(rng, 2, 5), inner: [T(1, 0, pick(rng, [{ S: 1 }, { C: 1 }, { L: 1 }]))] });
      if (r < 0.6) return solveSlozena({ outer, n: ri(rng, 3, 6), inner: lin() });
      return solveSlozena({ outer, n: ri(rng, 2, 4), inner: rng() < 0.5 ? quad() : cub() });
    }
    case 'tan': return solveSlozena({ outer, inner: rng() < 0.6 ? lin(true) : [T(rnz(rng, 1, 3), 2)] });
    case 'atan': case 'acot': return solveSlozena({ outer, inner: rng() < 0.5 ? [T(ri(rng, 2, 5), 1)] : [T(1, 2)] });
    case 'asin': case 'acos': return solveSlozena({ outer, inner: pick(rng, [[T(1, 2)], [T(1, 3)], [T(-1, 2)]]) });
    case 'apow': return solveSlozena({ outer, n: pick(rng, [2, 3, 5, 10]), inner: rng() < 0.5 ? [T(pick(rng, [2, 3, -1, -2]), 1)] : [T(1, 2), T(rnz(rng, -3, 3), 1)] });
    case 'log': return solveSlozena({ outer, n: pick(rng, [2, 3, 5, 10]), inner: rng() < 0.5 ? lin(true) : [T(1, 2), T(ri(rng, 1, 5))] });
    case 'sqrt': return solveSlozena({ outer, inner: rng() < 0.5 ? lin(true) : quad() });
    case 'ln': return solveSlozena({ outer, inner: rng() < 0.4 ? lin(true) : quad() });
    default: {
      const r = rng();
      const inner = r < 0.4 ? [T(pick(rng, [2, 3, 4, 5, -2, -3]), 1)] : r < 0.7 ? [T(pick(rng, [1, 2, 3, -1]), 2)] : [T(1, 2), T(rnz(rng, -4, 4), 1)];
      return solveSlozena({ outer, inner });
    }
  }
}

// =====================================================================
// Typ 5: druhá derivace a její hodnota v bodě
// data = { terms: [jednoduché členy], x0 }
function solveDruha(data) {
  const f = sumOf(data.terms); const x0 = parseFr(data.x0);
  const d1 = dSum(f); const d2 = dSum(d1);
  const val = sumAt(d2, x0);
  if (val === null) throw new Error('druha: hodnotu nelze přesně dosadit');
  const steps = [
    {
      title: 'První derivace',
      text: 'Derivujeme člen po členu podle vzorců: $(x^n)\'=nx^{n-1}$, $(e^{kx})\'=ke^{kx}$, $(\\sin x)\'=\\cos x$, $(\\cos x)\'=-\\sin x$, $(\\ln x)\'=\\frac{1}{x}$.',
      board: [...rewriteLines(f), ...derivChain(f, "f'(x)", d1)],
    },
    {
      title: 'Druhá derivace',
      text: 'Druhá derivace je derivace první derivace – stejnými pravidly zderivujeme výsledek předchozího kroku (zlomky si představ jako záporné mocniny).',
      board: [...rewriteLines(d1, "f'(x)"), ...derivChain(d1, "f''(x)", d2)],
    },
    {
      title: 'Dosazení bodu',
      text: `Do druhé derivace dosadíme $x=${frTex(x0)}$ a dopočítáme.`,
      board: substSumTex(d2, x0) === frTex(val)
        ? [resultLine(`f''(${frTex(x0)})=`, frTex(val))]
        : [{ tex: `f''(${frTex(x0)})=${substSumTex(d2, x0)}` }, resultLine('=', frTex(val))],
    },
  ];
  return {
    id: idOf('druha', data), topic: TOPIC, type: 'druha', data,
    task: `Vypočítej druhou derivaci $f''(x)$ a její hodnotu v bodě $x_0=${frTex(x0)}$. Zapiš číslo $f''(${frTex(x0)})$ (zlomek jako 3/4).`,
    promptTex: `f(x)=${sumTex(f)}`,
    answerSpec: { kind: 'number', value: toNum(val) },
    answerTex: frTex(val),
    solution: steps,
  };
}
const ZERO_POOL = [(rng) => T(rnz(rng, -3, 3), ri(rng, 2, 4)), (rng) => T(rnz(rng, -5, 5), 1), (rng) => T(rnz(rng, -3, 3), 0, { E: pick(rng, [1, 2, -1, 3, -2]) }),
  (rng) => T(rnz(rng, -4, 4), 0, { S: 1 }), (rng) => T(rnz(rng, -4, 4), 0, { C: 1 })];
const ONE_POOL = [(rng) => T(rnz(rng, -3, 3), ri(rng, 2, 4)), (rng) => T(rnz(rng, -4, 4), -ri(rng, 1, 2)), (rng) => T(pick(rng, [4, 8, -4, 2]), '1/2'),
  (rng) => T(rnz(rng, -4, 4), 0, { L: 1 }), (rng) => T(pick(rng, [3, 9, -3]), '2/3')];
function basicTerms(rng, pool, n) {
  const out = [];
  while (out.length < n) {
    const t = pick(rng, pool)(rng);
    const k = JSON.stringify({ ...t, c: 0 });
    if (!out.some((u) => JSON.stringify({ ...u, c: 0 }) === k)) out.push(t);
  }
  return out;
}
function genDruha(rng) {
  for (;;) {
    const atZero = rng() < 0.5;
    const terms = basicTerms(rng, atZero ? ZERO_POOL : ONE_POOL, ri(rng, 2, 3));
    const s = sumOf(terms);
    const d2 = dSum(dSum(s));
    if (d2.length < 2) continue;
    let x0 = atZero ? 0 : 1;
    if (s.every((t) => !hasAtoms(t) && t.p.d === 1)) x0 = pick(rng, [1, 2, -1, -2]);
    else if (atZero && s.every((t) => !t.E && !t.S && !t.C)) x0 = pick(rng, [0, 1, -1]);
    if (sumAt(d2, fr(x0)) === null) continue;
    return solveDruha({ terms, x0 });
  }
}

// =====================================================================
// Typ 6 a 7: tečna a normála ke grafu v bodě
// data = { terms, x0 }
function tangentData(data) {
  const f = sumOf(data.terms); const x0 = parseFr(data.x0);
  const d1 = dSum(f);
  const y0 = sumAt(f, x0); const k = sumAt(d1, x0);
  if (y0 === null || k === null) throw new Error('tečna: hodnotu nelze přesně dosadit');
  return { f, x0, d1, y0, k };
}
const minusVal = (v) => (isZero(v) ? '' : v.n < 0 ? `+${frTex(fr(-v.n, v.d))}` : `-${frTex(v)}`);
const kTimes = (k, inner) => (k.n === k.d ? inner : k.n === -k.d ? `-${inner}` : `${frTex(k)}${inner}`);
function tangentSteps(t) {
  const { f, x0, d1, y0, k } = t;
  const x0T = frTex(x0);
  return [
    {
      title: 'Bod dotyku',
      text: `Tečna se grafu dotýká v bodě $T=[x_0;\\ f(x_0)]$. Dosadíme $x_0=${x0T}$ do funkce.`,
      board: substSumTex(f, x0) === frTex(y0)
        ? [{ tex: `f(${x0T})=${frTex(y0)}` }]
        : [{ tex: `f(${x0T})=${substSumTex(f, x0)}` }, { tex: `=${frTex(y0)}` }],
    },
    {
      title: 'Směrnice tečny',
      text: `Směrnice (sklon) tečny je hodnota derivace v bodě dotyku: $k=f'(x_0)$. Funkci zderivujeme a dosadíme $x_0=${x0T}$.`,
      board: [...rewriteLines(f), ...derivChain(f, "f'(x)", d1), ...(substSumTex(d1, x0) === frTex(k)
        ? [{ tex: `k=f'(${x0T})=${frTex(k)}` }]
        : [{ tex: `k=f'(${x0T})=${substSumTex(d1, x0)}` }, { tex: `=${frTex(k)}` }])],
    },
  ];
}
const pointLabel = (x0, y0) => `[${frStr(x0).replace('-', '−')}; ${frStr(y0).replace('-', '−')}]`;
function plotDomain(f, x0) {
  const pos = f.some((t) => t.L || t.p.d !== 1 || toNum(t.p) < 0);
  const x = toNum(x0);
  if (pos) return [Math.max(0.02, x - 3), x + 3];
  return [x - 3, x + 3];
}
function solveTecna(data) {
  const t = tangentData(data);
  const { x0, y0, k } = t;
  const q = sub(y0, mul(k, x0));
  const steps = tangentSteps(t);
  const lt = lineTex(k, q);
  steps.push({
    title: 'Rovnice tečny',
    text: 'Přímka se směrnicí $k$ procházející bodem $[x_0;\\ y_0]$ má rovnici $y-y_0=k(x-x_0)$. Dosadíme, roznásobíme a převedeme do tvaru $y=kx+q$.',
    board: [{ tex: `y${minusVal(y0)}=${kTimes(k, `(${xMinus(x0)})`)}` }, resultLine('y=', lt)],
    viz: {
      kind: 'tangent',
      data: { expr: sumStr(t.f), x0: toNum(x0), domain: plotDomain(t.f, x0), slope: toNum(k), label: `y = ${lineTex(k, q).replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '$1/$2').replace(/-/g, '−')}`, pointLabel: pointLabel(x0, y0), alt: 'Graf funkce s tečnou v bodě dotyku' },
    },
  });
  return {
    id: idOf('tecna', data), topic: TOPIC, type: 'tecna', data,
    task: `Napiš rovnici tečny ke grafu funkce v bodě $x_0=${frTex(x0)}$. Zapiš ji ve tvaru y = kx + q (stačí pravá strana), např. y = 2x - 3.`,
    promptTex: `f(x)=${sumTex(t.f)},\\quad x_0=${frTex(x0)}`,
    answerSpec: exprSpec(`(${frStr(k)})*x+(${frStr(q)})`),
    answerTex: lt,
    conclusion: `Tečna: $y=${lt}$.`,
    solution: steps,
  };
}
// k_n = −1/k bez záporného jmenovatele a bez opakovaných řádků
function knLines(k, kn) {
  const kT = frTex(k);
  if (k.n > 0 && k.d === 1) {
    const l1 = { tex: `k_n=-\\frac{1}{${kT}}` };
    return k.n === 1 ? [l1, { tex: `=${frTex(kn)}` }] : [l1];
  }
  const lines = [{ tex: `${kT}\\cdot k_n=-1` }];
  const a = fr(Math.abs(k.n), k.d);
  if (k.n < 0 && !(a.n === 1 && a.d === 1)) lines.push({ tex: `${frTex(a)}\\,k_n=1` });
  lines.push({ tex: `k_n=${frTex(kn)}` });
  return lines;
}
function solveNormala(data) {
  const t = tangentData(data);
  const { x0, y0, k } = t;
  if (isZero(k)) throw new Error('normála: tečna je vodorovná');
  const kn = div(fr(-1), k);
  const q = sub(y0, mul(kn, x0));
  const steps = tangentSteps(t);
  steps.push({
    title: 'Směrnice normály',
    text: 'Normála je kolmá k tečně v bodě dotyku. Kolmé přímky mají součin směrnic $-1$, takže $k\\cdot k_n=-1$, tedy $k_n=-\\frac{1}{k}$. Dosadíme směrnici tečny $k$ a vyjádříme $k_n$ (záporný jmenovatel nepíšeme, znaménko převedeme na druhou stranu).',
    board: knLines(k, kn),
  });
  const lt = lineTex(kn, q);
  const qt = sub(y0, mul(k, x0));
  steps.push({
    title: 'Rovnice normály',
    text: 'Normála prochází bodem dotyku: $y-y_0=k_n(x-x_0)$. Dosadíme a upravíme na tvar $y=kx+q$.',
    board: [{ tex: `y${minusVal(y0)}=${kTimes(kn, `(${xMinus(x0)})`)}` }, resultLine('y=', lt)],
    viz: {
      kind: 'plot',
      data: {
        domain: plotDomain(t.f, x0), functions: [{ expr: sumStr(t.f) }],
        lines: [{ k: toNum(k), q: toNum(qt), tangent: true, label: 'tečna' }, { k: toNum(kn), q: toNum(q), label: 'normála' }],
        points: [{ x: toNum(x0), y: toNum(y0), label: pointLabel(x0, y0), style: 'closed' }],
        range: [toNum(y0) - 4, toNum(y0) + 4],
        alt: 'Graf funkce s tečnou a normálou',
      },
    },
  });
  return {
    id: idOf('normala', data), topic: TOPIC, type: 'normala', data,
    task: `Napiš rovnici normály ke grafu funkce v bodě $x_0=${frTex(x0)}$. Zapiš ji ve tvaru y = kx + q (stačí pravá strana), např. y = -x/2 + 3.`,
    promptTex: `f(x)=${sumTex(t.f)},\\quad x_0=${frTex(x0)}`,
    answerSpec: exprSpec(`(${frStr(kn)})*x+(${frStr(q)})`),
    answerTex: lt,
    conclusion: `Normála: $y=${lt}$.`,
    solution: steps,
  };
}
function genTangentData(rng, needSlope) {
  for (;;) {
    const r = rng();
    let terms; let x0;
    if (r < 0.45) { terms = basicTerms(rng, [ZERO_POOL[0], ZERO_POOL[1], (g) => T(rnz(g, -5, 5))], ri(rng, 2, 3)); x0 = ri(rng, -2, 2); }
    else if (r < 0.7) { terms = basicTerms(rng, [ZERO_POOL[0], ZERO_POOL[1], ZERO_POOL[2], ZERO_POOL[3], ZERO_POOL[4]], 2); x0 = 0; }
    else { terms = basicTerms(rng, ONE_POOL, 2); x0 = 1; if (terms.every((t) => !t.L && String(t.p).includes('1/2') === false && String(t.p).includes('/') === false) && rng() < 0.5) x0 = pick(rng, [2, -1]); }
    try {
      const t = tangentData({ terms, x0 });
      if (needSlope && isZero(t.k)) continue;
      if (Math.abs(toNum(t.k)) > 20 || Math.abs(toNum(t.y0)) > 30) continue;
      return { terms, x0 };
    } catch { /* bod mimo obor nebo nepřesná hodnota */ }
  }
}
const genTecna = (rng) => solveTecna(genTangentData(rng, false));
const genNormala = (rng) => solveNormala(genTangentData(rng, true));

// =====================================================================
// l'Hospitalovo pravidlo: obecný postup pro podíl dvou součtů
// at = { kind: 'num', x0 } | { kind: 'inf' } | { kind: 'zero+' }
const limHead = (at) => (at.kind === 'inf' ? '\\lim_{x\\to\\infty}' : at.kind === 'zero+' ? '\\lim_{x\\to0^+}' : `\\lim_{x\\to${frTex(at.x0)}}`);
function valueAt(s, at) {
  if (at.kind === 'inf') return limitInf(s);
  if (at.kind === 'zero+') return limitZeroPlus(s);
  const v = sumAt(s, at.x0);
  if (v === null) throw new Error('limita: nelze přesně dosadit');
  return { fin: v };
}
const valTex = (v) => (v.inf ? (v.inf > 0 ? '\\infty' : '-\\infty') : frTex(v.fin));
const indeterminate = (a, b) => (a.inf && b.inf) || (a.fin && b.fin && isZero(a.fin) && isZero(b.fin));
const formTex = (a, b) => `\\left|\\frac{${valTex(a)}}{${valTex(b)}}\\right|`;
// N/D; začíná-li jmenovatel minusem, vytkne se minus před zlomek (žádný záporný jmenovatel).
const fracTex = (N, D, wn = (t) => t, wd = (t) => t) => (D[0] && D[0].c.n < 0
  ? `-\\frac{${wn(sumTex(N))}}{${wd(sumTex(neg(D)))}}`
  : `\\frac{${wn(sumTex(N))}}{${wd(sumTex(D))}}`);
// Odstranění záporných mocnin x: čitatel i jmenovatel vynásobíme x^m.
function clearNeg(N, D) {
  const m = Math.max(0, ...[...N, ...D].map((t) => -toNum(t.p)));
  if (m <= 0) return null;
  const mf = fr(Math.round(m * 6), 6);
  const X = [{ c: fr(1), p: mf, E: 0, S: 0, C: 0, L: 0 }];
  return { N: mulSum(N, X), D: mulSum(D, X), m: mf };
}
function lhSteps(N0, D0, at, firstLines = [], eq = false) {
  const head = limHead(at);
  let N = N0; let D = D0;
  const steps = [];
  let a = valueAt(N, at); let b = valueAt(D, at);
  if (!indeterminate(a, b)) throw new Error("l'H: není neurčitý výraz");
  const kindTxt = a.inf ? '\\frac{\\infty}{\\infty}' : '\\frac{0}{0}';
  steps.push({
    title: 'Typ limity',
    text: at.kind === 'inf'
      ? `Pro $x\\to\\infty$ jde čitatel i jmenovatel do nekonečna – je to neurčitý výraz typu $${kindTxt}$, a tak smíme použít l'Hospitalovo pravidlo.`
      : `Dosadíme limitní bod do čitatele i jmenovatele: vyjde neurčitý výraz typu $${kindTxt}$, a tak smíme použít l'Hospitalovo pravidlo.`,
    board: [...firstLines, { tex: `${firstLines.length || eq ? '=' : ''}${head}${fracTex(N, D)}` }, { tex: `=${formTex(a, b)}` }],
  });
  for (let it = 1; it <= 5; it++) {
    N = dSum(N); D = dSum(D);
    const lines = [{
      tex: `\\stackrel{\\text{l'H}}{=}${head}${fracTex(N, D, (t) => cls(`c${it}`, t), (t) => cls(`j${it}`, t))}`,
      notes: [brace(`c${it}`, '(čitatel)′'), brace(`j${it}`, '(jmenovatel)′', 'below')],
    }];
    let text = "Podle l'Hospitalova pravidla zderivujeme zvlášť čitatel a zvlášť jmenovatel (není to derivace podílu!).";
    let cl = clearNeg(N, D);
    let noClear = false;
    if (cl) {
      // Zlomky se odstraňují jen kvůli dalšímu l'Hospitalovi; je-li výraz už určitý, stačí dosadit.
      let pre = null;
      try { pre = [valueAt(N, at), valueAt(D, at)]; } catch { /* nelze přesně dosadit */ }
      if (pre && !indeterminate(pre[0], pre[1])) {
        const post = [valueAt(cl.N, at), valueAt(cl.D, at)];
        if (indeterminate(post[0], post[1])) { cl = null; noClear = true; }
      }
    }
    if (noClear) text += ' Po zderivování už výraz není neurčitý: členy typu $\\frac{1}{x}$ jdou k 0, a tak limitu určíme dosazením.';
    if (cl) {
      N = cl.N; D = cl.D;
      lines.push({ tex: `=${head}${fracTex(N, D)}` });
      text += ` Zlomky odstraníme tak, že čitatel i jmenovatel vynásobíme $${absTermTex({ c: fr(1), p: cl.m, E: 0, S: 0, C: 0, L: 0 })}$.`;
    }
    const Q1 = N.length === 1 && D.length === 1 ? divTerm(N[0], D[0]) : null;
    if (Q1 && at.kind !== 'num' && Q1.L === 0 && Q1.E === 0) {
      const Q = [Q1];
      pushNew(lines, `=${head}${sumTex(Q)}`);
      text += ' Zlomek zkrátíme.';
      const v = valueAt(Q, at);
      steps.push({ title: `${it}. použití l'Hospitalova pravidla`, text, board: lines });
      steps.push({ title: 'Výsledek', text: 'Teď už limitu určíme přímo.', board: [resultLine('=', valTex(v))] });
      return { steps, value: v };
    }
    a = valueAt(N, at); b = valueAt(D, at);
    if (indeterminate(a, b)) {
      lines.push({ tex: `=${formTex(a, b)}` });
      text += ' Po dosazení vyjde znovu neurčitý výraz, pravidlo použijeme ještě jednou.';
      steps.push({ title: `${it}. použití l'Hospitalova pravidla`, text, board: lines });
      continue;
    }
    steps.push({ title: `${it}. použití l'Hospitalova pravidla`, text, board: lines });
    let v;
    if (a.fin && b.fin) {
      if (isZero(b.fin)) throw new Error("l'H: dělení nulou");
      v = { fin: div(a.fin, b.fin) };
    } else if (a.inf) v = { inf: a.inf * (b.fin && b.fin.n < 0 ? -1 : 1) };
    else v = { fin: fr(0) };
    steps.push({
      title: 'Výsledek',
      text: a.inf || b.inf ? 'Výraz už není neurčitý: číslo dělené nekonečnem dává 0, nekonečno dělené číslem dává nekonečno.' : 'Výraz už není neurčitý, dosadíme a dopočítáme.',
      board: (() => {
        const first = a.fin && b.fin ? `=\\frac{${frTex(b.fin.n < 0 ? mul(a.fin, fr(-1)) : a.fin)}}{${frTex(b.fin.n < 0 ? mul(b.fin, fr(-1)) : b.fin)}}` : `=${formTex(a, b)}`;
        return first === `=${valTex(v)}` || (b.fin && b.fin.n === 1 && b.fin.d === 1) ? [resultLine('=', valTex(v))] : [{ tex: first }, resultLine('=', valTex(v))];
      })(),
    });
    return { steps, value: v };
  }
  throw new Error("l'H: příliš mnoho kroků");
}
const limitSpec = (v) => ({ kind: 'limit', value: v.inf ? (v.inf > 0 ? '∞' : '-∞') : frStr(v.fin) });
const LIM_HINT = 'Výsledek zapiš jako číslo nebo zlomek (např. 3/2), nekonečno jako ∞ nebo -∞.';

// Typ 8: 0/0 ve vlastním bodě; data = { N, D, x0 }
function solveLhospital(data) {
  const N = sumOf(data.N); const D = sumOf(data.D); const x0 = parseFr(data.x0);
  const at = { kind: 'num', x0 };
  const { steps, value } = lhSteps(N, D, at);
  return {
    id: idOf('lhospital', data), topic: TOPIC, type: 'lhospital', data,
    task: `Vypočítej limitu pomocí l'Hospitalova pravidla. ${LIM_HINT}`,
    promptTex: `${limHead(at)}${fracTex(N, D)}`,
    answerSpec: limitSpec(value), answerTex: valTex(value), solution: steps,
  };
}
function genLhospital(rng) {
  for (;;) {
    const fam = pick(rng, ['exp1', 'exp2', 'cos', 'sin3', 'poly', 'poly', 'ln1', 'ln2', 'expexp']);
    let data;
    const a = rnz(rng, -3, 3); const b = ri(rng, 1, 4);
    switch (fam) {
      case 'exp1': data = { N: [T(1, 0, { E: a }), T(-1)], D: [T(b, 1)], x0: 0 }; break;
      case 'exp2': data = { N: [T(1, 0, { E: a }), T(-1), T(-a, 1)], D: [T(b, 2)], x0: 0 }; break;
      case 'cos': data = { N: [T(b), T(-b, 0, { C: 1 })], D: [T(ri(rng, 1, 4), 2)], x0: 0 }; break;
      case 'sin3': data = { N: [T(1, 1), T(-1, 0, { S: 1 })], D: [T(b, 3)], x0: 0 }; break;
      case 'expexp': { const c = rnz(rng, -3, 3); if (c === a) continue; data = { N: [T(1, 0, { E: a }), T(-1, 0, { E: c })], D: [T(b, 1)], x0: 0 }; break; }
      case 'ln1': data = { N: [T(b, 0, { L: 1 })], D: [T(1, ri(rng, 1, 3)), T(-1)], x0: 1 }; break;
      case 'ln2': data = { N: [T(1, 1), T(-1), T(-1, 0, { L: 1 })], D: [T(b, 2), T(-2 * b, 1), T(b)], x0: 1 }; break;
      default: {
        const r = rnz(rng, -3, 3); const s = ri(rng, -4, 4); const t = ri(rng, -4, 4);
        if (s === r || t === r || s === t) continue;
        const k = pick(rng, [1, 1, 2, -1]);
        // N = k(x-r)(x-s), D = (x-r)(x-t)
        data = { N: [T(k, 2), T(-k * (r + s), 1), T(k * r * s)], D: [T(1, 2), T(-(r + t), 1), T(r * t)], x0: r };
      }
    }
    return solveLhospital(data);
  }
}

// Typ 9: ∞/∞ pro x → ∞; data = { N, D }
function solveLhNekonecno(data) {
  const N = sumOf(data.N); const D = sumOf(data.D);
  const at = { kind: 'inf' };
  const { steps, value } = lhSteps(N, D, at);
  return {
    id: idOf('lhospital-nekonecno', data), topic: TOPIC, type: 'lhospital-nekonecno', data,
    task: `Vypočítej limitu pomocí l'Hospitalova pravidla. ${LIM_HINT}`,
    promptTex: `${limHead(at)}${fracTex(N, D)}`,
    answerSpec: limitSpec(value), answerTex: valTex(value), solution: steps,
  };
}
function genLhNekonecno(rng) {
  const fam = pick(rng, ['xe', 'xe', 'ex', 'lnx', 'lin', 'ln2', 'poly']);
  const n = ri(rng, 1, 3); const k = ri(rng, 1, 2); const c = ri(rng, 1, 4);
  switch (fam) {
    case 'xe': return solveLhNekonecno({ N: [T(c, n)], D: [T(1, 0, { E: k })] });
    case 'ex': return solveLhNekonecno({ N: [T(1, 0, { E: k })], D: [T(c, n)] });
    case 'lnx': return solveLhNekonecno({ N: [T(1, 0, { L: 1 })], D: [T(c, pick(rng, [1, 2, 3, '1/2']))] });
    case 'lin': return solveLhNekonecno({ N: [T(rnz(rng, -4, 4), 1), T(1, 0, { L: 1 })], D: [T(c, 1)] });
    case 'ln2': return solveLhNekonecno({ N: [T(1, 0, { L: 2 })], D: [T(c, 1)] });
    default: return solveLhNekonecno({ N: [T(1, 2), T(rnz(rng, -5, 5), 1)], D: [T(1, 0, { E: 1 })] });
  }
}

// Typ 10: úpravy 0·∞ a ∞−∞
// data = { form: 'soucin', c, n }            lim_{x→0+} c·x^n·ln x
//      | { form: 'rozdil', kind: 'exp'|'sin'|'ln', a, k? }
function solveLhUpravy(data) {
  let steps; let value; let promptTex;
  if (data.form === 'soucin') {
    const c = parseFr(data.c); const n = parseFr(data.n);
    const f = [{ c, p: n, E: 0, S: 0, C: 0, L: 1 }];
    promptTex = `\\lim_{x\\to0^+}${sumTex(f)}`;
    const N = [{ c, p: fr(0), E: 0, S: 0, C: 0, L: 1 }];
    const D = [{ c: fr(1), p: fr(-n.n, n.d), E: 0, S: 0, C: 0, L: 0 }];
    const lnSign = c.n > 0 ? '-' : '';
    const intro = {
      title: 'Typ součinu',
      text: `Pro $x\\to0^+$ jde $${absTermTex({ ...f[0], c: fr(1), L: 0 })}\\to0$ a $\\ln x\\to-\\infty$: neurčitý výraz typu $0\\cdot\\infty$. Přepíšeme ho na zlomek – činitel $${absTermTex({ ...f[0], c: fr(1), L: 0 })}$ dáme do jmenovatele jako $\\frac{1}{${absTermTex({ ...f[0], c: fr(1), L: 0 })}}$.`,
      board: [{ tex: `${promptTex}=\\left|0\\cdot(${lnSign}\\infty)\\right|` }],
    };
    const r = lhSteps(N, D, { kind: 'zero+' }, [], true);
    r.steps[0].title = 'Přepis na zlomek';
    r.steps[0].text = 'Teď je to neurčitý výraz typu $\\frac{\\infty}{\\infty}$ (se znaménky), smíme použít l\'Hospitalovo pravidlo. Jmenovatel si pro derivování představ jako mocninu se záporným exponentem.';
    steps = [intro, ...r.steps]; value = r.value;
  } else {
    const a = data.a | 0; const k = data.k | 0;
    let A; let B; let P; let Q; let x0; let fT;
    if (data.kind === 'exp') { // a/x − ak/(e^{kx} − 1)
      A = [T(1, 1)]; B = [T(1, 0, { E: k }), T(-1)]; P = a; Q = a * k; x0 = 0;
    } else if (data.kind === 'sin') { A = [T(1, 1)]; B = [T(1, 0, { S: 1 })]; P = a; Q = a; x0 = 0; }
    else { A = [T(1, 0, { L: 1 })]; B = [T(1, 1), T(-1)]; P = a; Q = a; x0 = 1; }
    A = sumOf(A); B = sumOf(B);
    fT = `\\frac{${P}}{${sumTex(A)}}-\\frac{${Q}}{${sumTex(B)}}`;
    const at = { kind: 'num', x0: fr(x0) };
    promptTex = `${limHead(at)}\\left(${fT}\\right)`;
    const N = subSum(scale(B, fr(P)), scale(A, fr(Q)));
    const D = mulSum(A, B);
    const AB = `${A.length > 1 ? `(${sumTex(A)})` : sumTex(A)}${B.length > 1 ? `(${sumTex(B)})` : `\\,${sumTex(B)}`}`;
    const intro = {
      title: 'Typ rozdílu',
      text: 'Oba zlomky jdou v limitním bodě do nekonečna: neurčitý výraz typu $\\infty-\\infty$. Převedeme je na společný jmenovatel a dostaneme jeden zlomek.',
      board: [{ tex: `${promptTex}=|\\infty-\\infty|` }, { tex: `=${limHead(at)}\\frac{${P}${B.length > 1 ? `(${sumTex(B)})` : sumTex(B)}-${Q}${A.length > 1 ? `(${sumTex(A)})` : sumTex(A)}}{${AB}}` }],
    };
    const r = lhSteps(N, D, at);
    steps = [intro, ...r.steps]; value = r.value;
  }
  return {
    id: idOf('lhospital-upravy', data), topic: TOPIC, type: 'lhospital-upravy', data,
    task: `Vypočítej limitu: nejdřív výraz uprav na podíl a pak použij l'Hospitalovo pravidlo. ${LIM_HINT}`,
    promptTex, answerSpec: limitSpec(value), answerTex: valTex(value), solution: steps,
  };
}
function genLhUpravy(rng) {
  if (rng() < 0.5) return solveLhUpravy({ form: 'soucin', c: rnz(rng, -4, 4), n: pick(rng, [1, 2, 3, '1/2']) });
  const kind = pick(rng, ['exp', 'exp', 'sin', 'ln']);
  return solveLhUpravy({ form: 'rozdil', kind, a: ri(rng, 1, 4), ...(kind === 'exp' ? { k: ri(rng, 1, 3) } : {}) });
}

// =====================================================================
// Každý příklad projde dělením dlouhých řádků tabule (360 px).
const fitType = (t) => ({ ...t, generate: (rng) => fitProblem(t.generate(rng)), solve: (d) => fitProblem(t.solve(d)) });

export default {
  id: TOPIC,
  title: "Derivace, l'Hospitalovo pravidlo, průběh funkce",
  order: 7,
  theory,
  types: [
    { id: 'mocniny', test: { part: 'der1', level: 1 }, title: 'Derivace mocnin a odmocnin', generate: genMocniny, solve: solveMocniny, custom: { fields: [{ id: 'f', label: 'f(x) =', kind: 'expr', hint: 'Např. 3x^2-5x+1/x nebo sqrt(x)+2' }], build: (v) => ({ terms: termsOf(v.f) }) } },
    { id: 'soucin', test: { part: 'der1', level: 1 }, title: 'Derivace součinu', generate: genSoucin, solve: solveSoucin, custom: { fields: [{ id: 'u', label: 'První činitel u(x) =', kind: 'expr', hint: 'Např. 3x^2-5x+1/x nebo sqrt(x)+2' }, { id: 'v', label: 'Druhý činitel v(x) =', kind: 'expr', hint: 'Např. 3x^2-5x+1/x nebo sqrt(x)+2' }], build: (v) => ({ u: termsOf(v.u), v: termsOf(v.v) }) } },
    { id: 'podil', test: { part: 'der1', level: 2 }, title: 'Derivace podílu', generate: genPodil, solve: solvePodil, custom: { fields: [{ id: 'u', label: 'Čitatel u(x) =', kind: 'expr', hint: 'Např. 3x^2-5x+1/x nebo sqrt(x)+2' }, { id: 'v', label: 'Jmenovatel v(x) =', kind: 'expr', hint: 'Např. 3x^2-5x+1/x nebo sqrt(x)+2' }], build: (v) => ({ u: termsOf(v.u), v: termsOf(v.v) }) } },
    { id: 'slozena', test: { part: 'der1', level: 2 }, title: 'Derivace složené funkce', generate: genSlozena, solve: solveSlozena },
    { id: 'druha', test: { part: 'der2', level: 0 }, title: 'Druhá derivace', generate: genDruha, solve: solveDruha },
    { id: 'tecna', title: 'Tečna ke grafu', generate: genTecna, solve: solveTecna },
    { id: 'normala', title: 'Normála ke grafu', generate: genNormala, solve: solveNormala },
    { id: 'lhospital', test: { part: 'limity', level: 2 }, title: "l'Hospitalovo pravidlo: typ 0/0", generate: genLhospital, solve: solveLhospital },
    { id: 'lhospital-nekonecno', test: { part: 'limity', level: 2 }, title: "l'Hospitalovo pravidlo: typ ∞/∞", generate: genLhNekonecno, solve: solveLhNekonecno },
    { id: 'lhospital-upravy', test: { part: 'limity', level: 2 }, title: "l'Hospital: úpravy 0·∞ a ∞−∞", generate: genLhUpravy, solve: solveLhUpravy },
    ...elemTypes,
    ...prubehTypes,
  ].map(fitType),
};

// pro testy a průběh funkce
export { termData, constT, xPow, eTex, sumNum, add, mul };
