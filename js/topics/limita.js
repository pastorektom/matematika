// Téma 6: Limita funkce (podle přednášky, ručně psané přednášky „Limita funkce“, řešených
// příkladů, prezentace a sbírek v Moodlu; konkrétní příklady z nich jsou jen v content/).
// Vzor tématu: js/topics/vektory.js. Mnohočleny a zápis: js/topics/limita-lib.js.
//
// Typy: dosazení (spojitost), rozklad 0/0 (závorky s hodnotami, krácení jako na tabuli),
// jednostranné limity k/0, odmocniny (sdružený výraz), limita v nekonečnu, sin x / x, z grafu.
import { fr, mul, div, isZero, frTex, gcd } from '../lin.js';
import {
  trim, deg, lead, evalP, mulP, addP, scaleP, rootP, divRoot, polyTex, nTerms, wrap, substTex,
  rootTex, aTex, lbl, limTex, resultTex, resultValue, formulaName, substStages,
} from './limita-lib.js';
import { polyOf, intOf, fail } from '../custom-input.js';

const TOPIC = 'limita';
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const RES = 'vysledek';
const DU = { kind: 'doubleUnderline', target: `bt-${RES}` };
const resLine = (pre, tex, post = '') => ({ tex: `${pre}${cls(RES, tex)}${post}`, notes: [DU] });
const FORMAT = 'Výsledek zapiš jako číslo nebo zlomek (např. -3/2), nekonečno jako ∞ nebo -∞ (lze psát i inf) a limitu, která neexistuje, slovem neexistuje.';
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const parseA = (a) => {
  if (typeof a === 'string') { const [n, d] = a.split('/').map(Number); return fr(n, d ?? 1); }
  return fr(a);
};
const sgn = (v) => (v.n > 0 ? 1 : v.n < 0 ? -1 : 0);
const absF = (v) => fr(Math.abs(v.n), v.d);
// zlomek n/d se znaménkem před zlomkovou čarou (nikdy záporný jmenovatel)
function signedFrac(n, d) {
  const neg = (n < 0) !== (d < 0) && n !== 0;
  const an = Math.abs(n); const ad = Math.abs(d);
  return `${neg ? '-' : ''}${ad === 1 ? an : `\\frac{${an}}{${ad}}`}`;
}
const parT = (v) => (v.n < 0 ? `\\left(${frTex(v)}\\right)` : frTex(v));
const infT = (s) => (s > 0 ? '\\infty' : '-\\infty');
const infP = (s) => (s > 0 ? '(+\\infty)' : '(-\\infty)');
const zeroT = (s) => `0^{${s < 0 ? '-' : '+'}}`;
const supChar = { 1: '', 2: '²', 3: '³', 4: '⁴' };
const plain = (tex) => tex.replace(/-/g, '−');

function answer(r) {
  return { answerSpec: { kind: 'limit', value: resultValue(r) }, answerTex: resultTex(r) };
}
const isOne = (p) => deg(p) === 0 && trim(p)[0] === 1;
// přibližná šířka zápisu (počet znaků bez TeXového balastu), pro rozhodnutí o zalomení řádku
const tlen = (tex) => tex.replace(/\\htmlClass\{[^}]*\}/g, '').replace(/\\[a-z]+/g, 'c').replace(/[\\{}^_ ]/g, '').length;
const MAXW = 22;
// x^e bez zbytečné jedničky v exponentu
const xp = (e) => (e === 1 ? 'x' : `x^{${e}}`);
// (p):(lt)=q; dlouhý řádek se zalomí za „=“. Pro a = 0 a jednočlen se dělení nezobrazuje (x je vidět na první pohled).
function divLines(p, q, lt, asc = false) {
  const l = `(${polyTex(p, asc)}):(${lt})`;
  const r = polyTex(q);
  if (tlen(l) + tlen(r) + 1 <= MAXW) return [{ tex: `${l}=${r}` }];
  return [{ tex: `${l}=` }, { tex: `\\qquad ${r}` }];
}
const trivialDiv = (p, lt) => lt === 'x' && nTerms(p) === 1;
// mocnina kořenového činitele (x pro a = 0 bez závorek)
const ltPower = (lt, m, wrapOne) => (lt === 'x' ? (m === 1 ? 'x' : `x^{${m}}`) : m === 1 ? (wrapOne ? `(${lt})` : lt) : `(${lt})^{${m}}`);
const fracTex = (num, den, asc) => (isOne(den)
  ? (nTerms(num) > 1 ? `(${polyTex(num, asc)})` : polyTex(num, asc))
  : `\\frac{${polyTex(num, asc)}}{${polyTex(den, asc)}}`);
const substFrac = (num, den, a, asc) => (isOne(den) ? substTex(num, a, asc) : `\\frac{${substTex(num, a, asc)}}{${substTex(den, a, asc)}}`);

// ---------- rozložená strana zlomku: k·(x−a)·zbytky ----------
// F = { k: celé číslo ≠ 0, rests: [{ tex, val, mono }] }
function toF(q, a) {
  const t = trim(q);
  if (deg(t) === 0) return { k: t[0], rests: [] };
  const s = lead(t) < 0 ? -1 : 1;
  const r = scaleP(t, s);
  return { k: s, rests: [{ tex: polyTex(r), val: evalP(r, a), mono: nTerms(r) === 1 }] };
}
function sideTex(F, lt, isNum, braces, notes) {
  const rests = F.rests.map((r, i) => {
    const t = r.mono ? r.tex : `(${r.tex})`;
    if (!braces) return t;
    const c = `${isNum ? 'zc' : 'zj'}${i + 1}`;
    notes.push(isNum ? { kind: 'brace', target: `bt-${c}`, label: lbl(r.val) } : { kind: 'brace', target: `bt-${c}`, label: lbl(r.val), position: 'below' });
    return cls(c, t);
  });
  const k = Math.abs(F.k);
  const ltT = lt === 'x' || (!rests.length && k === 1) ? lt : `(${lt})`;
  const kT = k === 1 ? '' : String(k);
  if (isNum) {
    const monos = rests.filter((_, i) => F.rests[i].mono);
    const others = rests.filter((_, i) => !F.rests[i].mono);
    return `${kT}${monos.join('')}${ltT}${others.join('')}`;
  }
  return `${kT}${rests.join('')}${ltT}`;
}
// Tři kroky jako na tabuli: rozklad se závorkami (hodnoty v bodě), vytknutí hodnot a krácení, výsledek.
const fmtF = (v) => (v.n < 0 ? `(${frTex(v)})` : frTex(v));
// řetěz „=a=b=c“ zalomený podle šířky; poslední člen je výsledek (dvojité podtržení)
function chainLines(pieces, result) {
  const all = [...pieces.filter((p, i) => i === 0 || p !== pieces[i - 1]), cls(RES, result)];
  if (all.length > 1 && all[all.length - 2] === result) all.splice(all.length - 2, 1);
  const lines = []; let cur = `=${all[0]}`;
  for (const p of all.slice(1)) {
    if (tlen(cur) + tlen(p) + 1 <= MAXW) cur += `=${p}`;
    else { lines.push({ tex: cur }); cur = `=${p}`; }
  }
  lines.push({ tex: cur, notes: [DU] });
  return lines;
}
function addDiv(pre, p, q, lt, asc = false) {
  if (trivialDiv(p, lt) || (deg(p) === 1 && isOne(q))) return;
  const g = divLines(p, q, lt, asc);
  const key = g.map((l) => l.tex).join('|');
  if (!pre.seen) pre.seen = new Set();
  if (pre.seen.has(key)) return;
  pre.seen.add(key);
  pre.push(...g);
}
function cancelSteps(N, D, lt, L, { pre = [], title = 'Rozklad', text }) {
  const notes = [];
  const sgT = Math.sign(N.k) * Math.sign(D.k);
  const sg = sgT < 0 ? '-' : '';
  const fl = { tex: `=${sg}${L}\\frac{${sideTex(N, lt, true, true, notes)}}{${sideTex(D, lt, false, true, notes)}}` };
  if (notes.length) fl.notes = notes;
  // činitelé: |k| a hodnoty závorek (se znaménkem); jedničky se nepíší
  const facs = (F) => [fr(Math.abs(F.k)), ...F.rests.map((r) => r.val)];
  const prod = (F) => facs(F).reduce((s, v) => mul(s, v), fr(1));
  const PN = prod(N); const PD = prod(D);
  const C = div(mul(fr(sgT), PN), PD);
  // záporný činitel ve jmenovateli: znaménko se přesune před zlomek, jmenovatel zůstane v absolutní hodnotě
  const denNeg = D.rests.some((r) => r.val.n < 0);
  const dFacs = denNeg ? facs(D).map(absF) : facs(D);
  const sgC = denNeg ? sgT * sgn(PD) : sgT;
  const sgE = sgC < 0 ? '-' : '';
  const facTex = (f, den) => {
    const g = f.filter((v) => !(v.n === 1 && v.d === 1));
    return g.length ? g.map((v, i) => (i === 0 && !den ? frTex(v) : fmtF(v))).join('\\cdot ') : '1';
  };
  const fn = facTex(facs(N), false); const fd = facTex(dFacs, true);
  const coefA = `${sgE}${fd === '1' ? (sgE && fn.startsWith('-') ? `(${fn})` : fn) : `\\frac{${fn}}{${fd}}`}`;
  const ints = [PN, PD].every((v) => v.d === 1);
  const s = sgT * sgn(PN) * sgn(PD) < 0 ? '-' : '';
  const evalTex = ints ? `${s}${Math.abs(PD.n) === 1 ? Math.abs(PN.n) : Math.abs(PN.n) === Math.abs(PD.n) ? 1 : `\\frac{${Math.abs(PN.n)}}{${Math.abs(PD.n)}}`}` : frTex(C);
  const k = cls('krat', lt);
  return {
    C,
    steps: [
      { title, text, board: [...pre, fl] },
      {
        title: 'Vytknutí a krácení',
        text: 'Hodnoty závorek, které v bodě nevycházejí nulové (oranžová čísla), vytkneme před limitu jako čísla (záporná v závorce). Pod limitou zbude stejný činitel v čitateli i ve jmenovateli – ten vykrátíme (pro $x$ různé od bodu je nenulový).'
          + (denNeg ? ' Záporná čísla ve jmenovateli zlomku nepíšeme: jejich znaménko napíšeme před zlomek (záporný jmenovatel i záporný čitatel se tak zkrátí).' : ''),
        board: [{ tex: `=${coefA}\\,${L}\\frac{${k}}{${k}}`, notes: [{ kind: 'strike', target: 'bt-krat' }] }],
      },
      {
        title: 'Výsledek',
        text: `Po vykrácení zbude pod limitou $1$ a limita jedničky je $1$. Čísla vynásobíme (znaménka se sloučí) a zlomek zkrátíme. Výsledek je $${frTex(C)}$.`,
        board: chainLines([`${coefA}\\cdot 1`, evalTex], frTex(C)),
      },
    ],
  };
}
function divText(ps, a, lt) {
  const names = ps.map(formulaName).filter(Boolean);
  const f = names.length ? ` Pomůže i vzorec – ${[...new Set(names)].join(', ')}.` : '';
  return `Když mnohočlen v bodě $${aTex(a)}$ dává nulu, je dělitelný kořenovým činitelem $${lt}$. Podíl najdeme dělením mnohočlenů (nebo Hornerovým schématem) – řádky s dvojtečkou na tabuli.${f} Každou závorku, která v bodě nulová není, rovnou vyčíslíme: oranžová čísla jsou hodnoty závorek pro $x=${aTex(a)}$.`;
}

// ---------- k/0: znaménko jmenovatele a jednostranné limity ----------
function oneSidedSteps(cn, cd, a, side, asc) {
  const lt = rootTex(a);
  const L = limTex(a, side);
  let r = trim(cd); let m = 0;
  const pre = [];
  while (isZero(evalP(r, a))) {
    const q = divRoot(r, a);
    addDiv(pre, r, q, lt);
    r = q; m++;
  }
  const kN = evalP(cn, a);
  const rv = evalP(r, a);
  const C = div(kN, rv);
  const notes = [];
  const nonConstN = deg(cn) > 0;
  const nT = nonConstN ? cls('cit', polyTex(cn, asc)) : polyTex(cn);
  if (nonConstN) notes.push({ kind: 'brace', target: 'bt-cit', label: lbl(kN) });
  const sR = lead(r) < 0 ? -1 : 1;
  const rn = scaleP(r, sR);
  let rT = '';
  if (deg(rn) > 0) {
    rT = cls('zb', nTerms(rn) > 1 ? `(${polyTex(rn)})` : polyTex(rn));
    notes.push({ kind: 'brace', target: 'bt-zb', label: lbl(evalP(rn, a)), position: 'below' });
  } else if (rn[0] !== 1) rT = String(rn[0]);
  const ltPow = ltPower(lt, m, !!rT);
  const fl = { tex: `=${sR < 0 ? '-' : ''}${L}\\frac{${nT}}{${rT}${ltPow}}` };
  if (notes.length) fl.notes = notes;
  const powT = ltPower(lt, m, true);
  const sL = m % 2 ? -1 : 1;
  const sgC = sgn(C);
  const steps = [{
    title: 'Rozklad jmenovatele',
    text: `Jmenovatel je v bodě nulový, proto obsahuje činitel $${lt}$${m > 1 ? ` – dokonce ${m === 2 ? 'dvakrát' : `${m}krát`}` : ''}. Rozložíme ho a hodnotu zbytku (oranžově) i hodnotu čitatele vytkneme před limitu. Zbude limita zlomku $\\frac{1}{${powT}}$, jejíž jmenovatel se blíží k nule.`,
    board: [...pre, fl, { tex: `=${frTex(C)}\\cdot ${L}\\frac{1}{${powT}}` }],
  }];
  const pLabel = `(${plain(lt)})${supChar[m] ?? `^${m}`}`;
  const sc = (s) => (s < 0 ? '−' : '+');
  steps.push({
    title: 'Znaménko jmenovatele',
    text: `Rozhoduje, z které strany se jmenovatel blíží k nule. Pro $x$ trochu menší než $${aTex(a)}$ je $${lt}$ záporné, pro $x$ trochu větší kladné.${m % 2 ? ' Lichá mocnina znaménko zachová' : ' Sudá mocnina je vždy kladná'}. Tabulka ukazuje znaménka jmenovatele a celé funkce po obou stranách bodu.`,
    board: [
      { tex: `x\\to ${aTex(a)}^{-}:\\ ${powT}\\to ${zeroT(sL)}` },
      { tex: `x\\to ${aTex(a)}^{+}:\\ ${powT}\\to ${zeroT(1)}` },
    ],
    viz: {
      kind: 'signchart',
      data: {
        points: [lbl(a)],
        rows: [
          { label: pLabel, cells: [sc(sL), '+'], at: ['0'] },
          { label: 'f', cells: [sc(sgC * sL), sc(sgC)] },
        ],
        alt: `Znaménka jmenovatele a funkce kolem bodu ${lbl(a)}`,
      },
    },
  });
  const sideLine = (sd, s) => `${limTex(a, sd)}f(x)=${parT(C)}\\cdot\\frac{1}{${zeroT(s)}}`;
  let result;
  if (side) {
    const s = side === '-' ? sL : 1;
    result = { kind: 'inf', s: sgC * s };
    steps.push({
      title: side === '-' ? 'Limita zleva' : 'Limita zprava',
      text: `Číslo $1$ dělené čím dál menším ${s < 0 ? 'záporným' : 'kladným'} číslem roste nade všechny meze (${s < 0 ? 'do $-\\infty$' : 'do $+\\infty$'}). Násobením číslem $${frTex(C)}$ se ${sgC < 0 ? 'znaménko obrátí' : 'znaménko nezmění'}.`,
      board: [{ tex: sideLine(side, s) }, resLine('=', infT(sgC * s))],
    });
  } else {
    steps.push({
      title: 'Jednostranné limity',
      text: `Spočítáme limitu zleva i zprava: $\\frac{1}{0^-}=-\\infty$, $\\frac{1}{0^+}=+\\infty$ a číslo $${frTex(C)}$ před limitou ${sgC < 0 ? 'obrátí znaménko' : 'znaménko nemění'}.`,
      board: [
        { tex: sideLine('-', sL) }, { tex: `=${infT(sgC * sL)}` },
        { tex: sideLine('+', 1) }, { tex: `=${infT(sgC)}` },
      ],
    });
    const same = sL === 1;
    result = same ? { kind: 'inf', s: sgC } : { kind: 'dne' };
    steps.push({
      title: 'Výsledek',
      text: same
        ? `Obě jednostranné limity jsou stejné, takže limita existuje a je rovna $${infT(sgC)}$ (nevlastní limita).`
        : 'Limita zleva a limita zprava se liší, proto (oboustranná) limita v tomto bodě neexistuje.',
      board: [same ? resLine(`${L}f(x)=`, infT(sgC)) : { tex: `${L}f(x)\\ ${cls(RES, '\\text{neexistuje}')}`, notes: [DU] }],
    });
  }
  return { steps, result };
}

// ---------- racionální funkce ve vlastním bodě (sdílí dosazení, rozklad, jednostranné) ----------
// data = { num, den, a (celé číslo nebo 'p/q'), side?: ''|'-'|'+', asc?: zápis od absolutního členu }
function rationalAt(data) {
  const a = parseA(data.a);
  const asc = !!data.asc;
  const side = data.side || '';
  const num = trim(data.num); const den = trim(data.den);
  const L = limTex(a, side);
  const f = fracTex(num, den, asc);
  const lt = rootTex(a);
  const nA = evalP(num, a); const dA = evalP(den, a);
  const steps = [];
  const first = { tex: `${L}${f}` };
  if (!isZero(dA)) {
    const poly = isOne(den);
    steps.push({
      title: 'Spojitost',
      text: poly
        ? `Mnohočlen je spojitý v každém bodě, proto se limita rovná funkční hodnotě: stačí dosadit $x=${aTex(a)}$.`
        : `Podíl mnohočlenů je spojitý všude, kde je jmenovatel nenulový. Ověříme jmenovatel v bodě $${aTex(a)}$: nula nevyšla, takže limitu spočítáme prostým dosazením.`,
      board: poly ? [first] : [first, { tex: `\\text{jmenovatel:}\\ ${substTex(den, a, asc)}` }, { tex: `=${frTex(dA)}\\neq 0` }],
    });
    steps.push({
      title: 'Dosazení',
      text: `Za každé $x$ dosadíme číslo $${aTex(a)}$ (záporná čísla a zlomky do závorek).`,
      board: [{ tex: `=${substFrac(num, den, a, asc)}` }],
    });
    const v = div(nA, dA);
    // řádky: mocniny, součiny, součet (čitatel a jmenovatel po částech), potom případné zkrácení
    const sN = substStages(num, a, asc);
    const sD = poly ? null : substStages(den, a, asc);
    const rows = [];
    // záporný jmenovatel by na tabuli stál pod zlomkovou čarou: čitatel a jmenovatel se pak počítají zvlášť
    const negDen = !poly && sD.some((t) => t.startsWith('-'));
    const labelled = (lab, st) => {
      const out = [{ tex: `\\text{${lab}:}\\ ${st[0]}` }];
      st.slice(1).forEach((t, i) => { if (t !== st[i]) out.push({ tex: `=${t}` }); });
      return out;
    };
    if (negDen) {
      rows.push(...labelled('čitatel', sN), ...labelled('jmenovatel', sD));
      const fin = nA.d === 1 && dA.d === 1 ? signedFrac(nA.n, dA.n) : frTex(v);
      if (fin !== frTex(v)) rows.push({ tex: `=${fin}` });
    } else {
      let prev = poly ? sN[0] : `\\frac{${sN[0]}}{${sD[0]}}`;
      for (let i = 1; i < 4; i++) {
        let row = poly ? sN[i] : `\\frac{${sN[i]}}{${sD[i]}}`;
        if (!poly && i === 3 && nA.d === 1 && dA.d === 1) row = signedFrac(nA.n, dA.n);
        if (row !== prev) { rows.push({ tex: `=${row}` }); prev = row; }
      }
      if (rows.length && rows[rows.length - 1].tex === `=${frTex(v)}`) rows.pop();
    }
    steps.push({
      title: 'Výsledek',
      text: poly
        ? 'Dopočítáme mocniny, součiny a součet – řádek po řádku.'
        : negDen
          ? `${dA.n < 0 ? 'Jmenovatel vychází záporný' : 'Jmenovatel začíná záporným číslem'}, proto čitatel a jmenovatel dopočítáme zvlášť (mocniny, součiny, součet). Záporné znaménko pak nepíšeme do jmenovatele: záporný jmenovatel a kladný čitatel dají záporný zlomek (znaménko před zlomkovou čarou), záporné znaménko jmenovatele i čitatele se zkrátí. Nakonec zlomek zkrátíme.`
          : 'Dopočítáme čitatel a jmenovatel zvlášť (mocniny, součiny, součet) a zlomek případně zkrátíme.',
      board: [...rows, resLine(rows.length && rows[rows.length - 1].tex === `=${frTex(v)}` ? '\\text{limita:}\\ ' : '=', frTex(v))],
    });
    return { steps, result: { kind: 'num', v }, L, f };
  }
  const zero = isZero(nA);
  steps.push({
    title: 'Dosazení',
    text: zero
      ? `Dosadíme $x=${aTex(a)}$: čitatel i jmenovatel vyjdou nulové. Výraz $\\frac{0}{0}$ je neurčitý – limita může vyjít jakkoli, proto funkci nejdřív upravíme.`
      : `Dosadíme $x=${aTex(a)}$: čitatel je nenulový, jmenovatel nulový. Výraz $\\frac{${frTex(nA)}}{0}$ znamená, že limita je nevlastní ($+\\infty$ nebo $-\\infty$), nebo neexistuje – rozhodne znaménko jmenovatele.`,
    board: [first, { tex: substFrac(num, den, a, asc) }, { tex: `=${cls('typ', `\\frac{${frTex(nA)}}{0}`)}`, notes: [{ kind: 'color', target: 'bt-typ' }] }],
  });
  let cn = num; let cd = den;
  if (zero) {
    for (let round = 1; ; round++) {
      const qn = divRoot(cn, a); const qd = divRoot(cd, a);
      const vn = evalP(qn, a); const vd = evalP(qd, a);
      const pre = [];
      addDiv(pre, cn, qn, lt, asc && round === 1);
      addDiv(pre, cd, qd, lt, asc && round === 1);
      const text = divText([cn, cd], a, lt);
      if (!(isZero(vn) && isZero(vd)) && !isZero(vd)) {
        const c = cancelSteps(toF(qn, a), toF(qd, a), lt, L, { pre, title: round > 1 ? 'Další rozklad' : 'Rozklad', text });
        steps.push(...c.steps);
        return { steps, result: { kind: 'num', v: c.C }, L, f };
      }
      const k = cls('krat', `(${lt})`);
      const w = (q) => (isOne(q) ? '' : nTerms(q) > 1 ? `(${polyTex(q)})` : polyTex(q));
      steps.push({
        title: round > 1 ? 'Další rozklad a krácení' : 'Rozklad a krácení',
        text: `${divText([cn, cd], a, lt).split(' Každou')[0]} Společný činitel $${lt}$ vykrátíme.`,
        board: [...pre,
          { tex: `=${L}\\frac{${k}${w(qn)}}{${w(qd)}${k}}`, notes: [{ kind: 'strike', target: 'bt-krat' }] },
          { tex: `=${L}${fracTex(qn, qd)}` }],
      });
      cn = qn; cd = qd;
      if (isZero(vn)) {
        steps.push({
          title: 'Znovu dosazení',
          text: 'Po krácení dosadíme znovu – a zase vyjde $\\frac{0}{0}$. Bod je dvojnásobným kořenem čitatele i jmenovatele, proto rozklad a krácení zopakujeme.',
          board: [{ tex: substFrac(cn, cd, a) }, { tex: `=\\frac{0}{0}` }],
        });
        continue;
      }
      steps.push({
        title: 'Znovu dosazení',
        text: `Po krácení dosadíme znovu: čitatel vyjde $${frTex(vn)}$, jmenovatel $0$. Je to typ $\\frac{k}{0}$ s nenulovým $k$ – rozhoduje znaménko jmenovatele.`,
        board: [{ tex: substFrac(cn, cd, a) }, { tex: `=\\frac{${frTex(vn)}}{0}` }],
      });
      break;
    }
  }
  const o = oneSidedSteps(cn, cd, a, side, asc && cn === num);
  steps.push(...o.steps);
  return { steps, result: o.result, L, f };
}

function buildRational(type, data, task) {
  const r = rationalAt(data);
  return {
    id: idOf(type, data), topic: TOPIC, type, data,
    task: `${task} ${FORMAT}`,
    promptTex: `${r.L}${r.f}`,
    ...answer(r.result),
    solution: r.steps,
  };
}

// ---------- pomůcky losování ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const rnz = (rng, lo, hi) => { let v = 0; while (v === 0) v = ri(rng, lo, hi); return v; };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randPoly = (rng, d, leadPos = false) => {
  const p = Array.from({ length: d + 1 }, (_, i) => (i === d ? (leadPos ? ri(rng, 1, 3) : rnz(rng, -3, 3)) : rng() < 0.25 ? 0 : ri(rng, -5, 5)));
  return trim(p);
};

// =====================================================================
// Typ 1: dosazení
const solveDosazeni = (data) => buildRational('dosazeni', data, 'Vypočítej limitu.');
function genDosazeni(rng) {
  for (;;) {
    const a = ri(rng, -3, 3);
    const poly = rng() < 0.3;
    const num = randPoly(rng, poly ? ri(rng, 2, 3) : ri(rng, 1, 2));
    const den = poly ? [1] : randPoly(rng, ri(rng, 1, 2), true);
    if (deg(num) < 1 || nTerms(num) < 2) continue;
    if (!poly && (nTerms(den) < 2 || isZero(evalP(den, fr(a))))) continue;
    return solveDosazeni({ num, den, a });
  }
}

// Typ 2: rozklad a krácení (0/0)
const solveRozklad = (data) => buildRational('rozklad', data, 'Vypočítej limitu.');
function genRozklad(rng) {
  for (;;) {
    const a = rnz(rng, -4, 5);
    const opt = () => {
      const k = pick(rng, ['lin', 'lin', 'sum', 'cub', 'lin2', 'const']);
      if (k === 'lin') return [-ri(rng, -6, 6), 1];
      if (k === 'sum') return [a, 1];
      if (k === 'cub') return [a * a, a, 1];
      if (k === 'lin2') return [ri(rng, -6, 6), pick(rng, [2, 3, 4])];
      return [pick(rng, [1, 2, 3, 4])];
    };
    const sn = opt(); let sd = opt();
    if (deg(sd) === 0 && rng() < 0.7) sd = [-ri(rng, -6, 6), 1];
    const aF = fr(a);
    if (isZero(evalP(sn, aF)) || isZero(evalP(sd, aF))) continue;
    if (sn.join() === sd.join() || deg(sn) + deg(sd) === 0) continue;
    // žádný další společný kořen
    if (deg(sn) === 1 && deg(sd) >= 1 && sn[1] === 1 && isZero(evalP(sd, fr(-sn[0])))) continue;
    if (deg(sd) === 1 && deg(sn) >= 1 && sd[1] === 1 && isZero(evalP(sn, fr(-sd[0])))) continue;
    const num = mulP(rootP(aF), sn); const den = mulP(rootP(aF), sd);
    if (lead(den) < 0) continue;
    return solveRozklad({ num, den, a });
  }
}

// Typ 3: jednostranné limity (k/0)
const solveJednostranne = (data) => buildRational('jednostranne', data,
  data.side ? `Vypočítej limitu ${data.side === '-' ? 'zleva' : 'zprava'}.` : 'Vypočítej limitu (oboustrannou). Pokud se liší limita zleva a zprava, limita neexistuje.');
function genJednostranne(rng) {
  for (;;) {
    const a = ri(rng, -4, 4);
    const aF = fr(a);
    const num = rng() < 0.35 ? [rnz(rng, -6, 6)] : [ri(rng, -6, 6), pick(rng, [1, 1, -1, 2, 3])];
    const m = rng() < 0.65 ? 1 : 2;
    let den = [1];
    for (let i = 0; i < m; i++) den = mulP(den, rootP(aF));
    let b = null;
    if (m === 1 || rng() < 0.3) { b = ri(rng, -5, 5); if (b === a) continue; den = mulP(den, [-b, 1]); }
    if (isZero(evalP(num, aF))) continue;
    if (deg(num) === 1 && b !== null && isZero(evalP(num, fr(b)))) continue;
    return solveJednostranne({ num: trim(num), den, a, side: pick(rng, ['', '', '-', '+']) });
  }
}

// =====================================================================
// Typ 4: odmocniny – rozšíření sdruženým výrazem
// data = { a, num: T, den: T }, T = { poly } | { rad, c, neg } (neg: c − √R, jinak √R − c)
const sqrtT = (t) => `\\sqrt{${polyTex(t.rad)}}`;
const termTex = (t) => (t.poly ? polyTex(t.poly) : t.neg ? `${t.c}-${sqrtT(t)}` : `${sqrtT(t)}-${t.c}`);
const conjTex = (t) => (t.neg ? `${t.c}+${sqrtT(t)}` : `${sqrtT(t)}+${t.c}`);
const sqTex = (t) => (t.neg ? `${t.c}^{2}-(${sqrtT(t)})^{2}` : `(${sqrtT(t)})^{2}-${t.c}^{2}`);
const sqPoly = (t) => (t.neg ? addP([t.c * t.c], scaleP(t.rad, -1)) : addP(t.rad, [-t.c * t.c]));
const substTerm = (t, a) => (t.poly ? substTex(t.poly, a) : t.neg ? `${t.c}-\\sqrt{${substTex(t.rad, a)}}` : `\\sqrt{${substTex(t.rad, a)}}-${t.c}`);

function solveOdmocnina(data) {
  const a = fr(data.a);
  const { num, den } = data;
  const L = limTex(a);
  const lt = rootTex(a);
  for (const t of [num, den]) {
    if (t.poly && !isZero(evalP(t.poly, a))) throw new Error('odmocnina: mnohočlen není v bodě nulový');
    if (t.rad && evalP(t.rad, a).n !== t.c * t.c) throw new Error('odmocnina: odmocnina nedává c');
  }
  const f = `\\frac{${termTex(num)}}{${termTex(den)}}`;
  const steps = [];
  steps.push({
    title: 'Dosazení',
    text: `Dosadíme $x=${aTex(a)}$: pod odmocninou vyjde druhá mocnina, odmocnina se odečte a čitatel i jmenovatel jsou nulové. Typ $\\frac{0}{0}$ je neurčitý.`,
    board: [{ tex: `${L}${f}` }, { tex: `${substTerm(num, a)}=0` }, { tex: `${substTerm(den, a)}=0` }, { tex: '\\Rightarrow\\ \\frac{0}{0}' }],
  });
  const roots = [num, den].filter((t) => t.rad);
  const conjF = (t) => `\\qquad\\cdot\\frac{${conjTex(t)}}{${conjTex(t)}}`;
  const ext = [{ tex: `=${L}${f}` }, ...roots.map((t) => ({ tex: conjF(t) }))];
  steps.push({
    title: 'Rozšíření sdruženým výrazem',
    text: `Odmocnina zabraňuje krácení. Zlomek rozšíříme výrazem, který se od rozdílu s odmocninou liší jen znaménkem (sdružený výraz) – násobíme vlastně jedničkou.${roots.length === 2 ? ' Odmocniny jsou nahoře i dole, rozšíříme tedy oběma sdruženými výrazy.' : ''}`,
    board: ext,
  });
  // po vynásobení: čitatel = (num.poly | sq(num)) · (conj den), jmenovatel = (den.poly | sq(den)) · (conj num)
  // záporný vedoucí koeficient jmenovatele: znaménko se napíše před zlomek, jmenovatel je kladný
  const denMain = den.poly ?? sqPoly(den);
  const flipD = lead(denMain) < 0;
  const sideA = (t, other, raw, flip = false) => {
    const k = flip ? -1 : 1;
    const main = t.poly ? wrap(scaleP(t.poly, k)) : raw ? `(${sqTex(t)})` : wrap(scaleP(sqPoly(t), k));
    return other.rad ? `${main}(${conjTex(other)})` : (t.poly ? polyTex(scaleP(t.poly, k)) : raw ? sqTex(t) : polyTex(scaleP(sqPoly(t), k)));
  };
  steps.push({
    title: 'Vzorec (A − B)(A + B)',
    text: 'Rozdíl s odmocninou krát sdružený výraz dá podle vzorce $(A-B)(A+B)=A^2-B^2$ výraz bez odmocniny: $(\\sqrt{R})^2=R$. Pak výraz zjednodušíme. Sdružený výraz, který zůstane, zatím jen opíšeme.'
      + (flipD ? ' Jmenovatel vyšel se záporným vedoucím členem, proto znaménko mínus napíšeme před limitu a jmenovatel zapíšeme s opačnými znaménky (hodnota zlomku se nezmění).' : ''),
    board: [
      ...roots.flatMap((t) => {
        const fin = polyTex(sqPoly(t));
        const mid = t.neg ? `${t.c * t.c}-${wrap(t.rad)}` : `${wrap(t.rad)}-${t.c * t.c}`;
        return [
          { tex: `(${termTex(t)})(${conjTex(t)})` },
          { tex: `=${sqTex(t)}` },
          ...(mid !== fin ? [{ tex: `=${mid}` }] : []),
          { tex: `=${fin}` },
        ];
      }),
      { tex: `=${flipD ? '-' : ''}${L}\\frac{${sideA(num, den, false)}}{${sideA(den, num, false, flipD)}}` },
    ],
  });
  const np = num.poly ?? sqPoly(num); const dp = den.poly ?? sqPoly(den);
  const NF = toF(divRoot(np, a), a); const DF = toF(divRoot(dp, a), a);
  if (den.rad) NF.rests.push({ tex: conjTex(den), val: fr(2 * den.c), mono: false });
  if (num.rad) DF.rests.push({ tex: conjTex(num), val: fr(2 * num.c), mono: false });
  for (const r of [...NF.rests, ...DF.rests]) if (isZero(r.val)) throw new Error('odmocnina: dvojnásobný kořen');
  const pre = [];
  addDiv(pre, np, divRoot(np, a), lt);
  addDiv(pre, dp, divRoot(dp, a), lt);
  const c = cancelSteps(NF, DF, lt, L, {
    pre,
    title: 'Rozklad',
    text: `Čitatel i jmenovatel teď obsahují činitel $${lt}$ (případně ho získáme dělením nebo vytknutím). Sdružený výraz v bodě $${aTex(a)}$ nulový není: $\\sqrt{c^2}+c=2c$. Hodnoty závorek jsou oranžově.`,
  });
  // je-li zjednodušený řádek totožný s rozkladem (bez závorek), zjednodušení ukáže až rozklad
  const strip = (t) => t.replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '').replace(/[{}()\s]/g, '');
  const sq = steps[steps.length - 1].board;
  const fl = c.steps[0].board[c.steps[0].board.length - 1].tex;
  if (strip(sq[sq.length - 1].tex) === strip(fl)) sq.pop();
  steps.push(...c.steps);
  const r = { kind: 'num', v: c.C };
  return {
    id: idOf('odmocnina', data), topic: TOPIC, type: 'odmocnina', data,
    task: `Vypočítej limitu. ${FORMAT}`,
    promptTex: `${L}${f}`,
    ...answer(r),
    solution: steps,
  };
}
function genOdmocnina(rng) {
  for (;;) {
    const a = ri(rng, -3, 8);
    const aF = fr(a);
    const root = () => {
      const c = ri(rng, 1, 3);
      if (rng() < 0.2) { const k = c * c - a * a; return { rad: [k, 0, 1], c, neg: rng() < 0.4 }; }
      const p = pick(rng, [1, 1, 1, 2, 3, 4, -1, -2]);
      return { rad: [c * c - p * a, p], c, neg: rng() < 0.4 };
    };
    const poly = () => {
      const k = pick(rng, ['lin', 'lin', 'k', 'quad']);
      if (k === 'lin') return { poly: [-a, 1] };
      if (k === 'k') { const m = pick(rng, [2, 3]); return { poly: [-m * a, m] }; }
      const b = ri(rng, -5, 5);
      return { poly: mulP([-a, 1], [-b, 1]) };
    };
    const mode = rng();
    const num = mode < 0.45 ? root() : poly();
    const den = mode < 0.45 ? (rng() < 0.3 ? root() : poly()) : root();
    if (!num.rad && !den.rad) continue;
    if ([num, den].some((t) => t.rad && (Math.abs(t.rad[0]) > 12 || (t.rad[2] && t.rad[0] === 0)))) continue;
    if (num.rad && den.rad && num.rad.join() === den.rad.join()) continue;
    const bad = [num, den].some((t) => (t.poly ? isZero(evalP(divRoot(t.poly, aF), aF)) : t.rad[2] && isZero(evalP(divRoot(sqPoly(t), aF), aF))));
    if (bad) continue;
    if (den.poly && lead(den.poly) < 0) continue;
    return solveOdmocnina({ a, num, den });
  }
}

// =====================================================================
// Typ 5: limita v nekonečnu
// data = { num, den, to: 1 | -1 } (den = [1]: mnohočlen)
function divTerm(c, e, first, zc) {
  const s = c < 0 ? '-' : first ? '' : '+';
  const m = Math.abs(c);
  if (e > 0) return `${s}${m === 1 ? '' : m}${e === 1 ? 'x' : `x^{${e}}`}`;
  if (e === 0) return `${s}${m}`;
  return `${s}${cls(zc, `\\frac{${m}}{${-e === 1 ? 'x' : `x^{${-e}}`}}`)}`;
}
function solveNekonecno(data) {
  const num = trim(data.num); const den = trim(data.den);
  const dir = data.to < 0 ? -1 : 1;
  const L = limTex(infT(dir));
  const n = deg(num); const m = deg(den);
  const an = lead(num); const bm = lead(den);
  // záporný vedoucí koeficient jmenovatele: znaménko mínus se napíše před limitu, jmenovatel zůstane kladný
  const negD = m > 0 && bm < 0;
  const sgL = negD ? '-' : '';
  const den2 = negD ? scaleP(den, -1) : den;
  const bm2 = Math.abs(bm);
  const xs = (k) => (dir > 0 || k % 2 === 0 ? 1 : -1); // x^k -> +-∞
  const steps = [];
  let result;
  const terms = (p, shift, zc) => {
    const out = [];
    for (let i = p.length - 1; i >= 0; i--) if (p[i] !== 0) out.push(divTerm(p[i], i - shift, out.length === 0, zc));
    return out.join('');
  };
  const zeroNotes = (zc, below) => ({ kind: 'brace', target: `bt-${zc}`, label: '0', ...(below ? { position: 'below' } : {}) });
  if (m === 0) {
    const f = nTerms(num) > 1 ? `(${polyTex(num)})` : polyTex(num);
    steps.push({
      title: 'Mnohočlen v nekonečnu',
      text: `Dosadit nekonečno nejde a jednotlivé členy by mohly dát neurčitý výraz $\\infty-\\infty$. U mnohočlenu proto vytkneme nejvyšší mocninu $x^{${n}}$.`,
      board: [{ tex: `${L}${f}` }],
    });
    const inner = terms(num, n, 'nula');
    const has0 = /bt-nula/.test(inner);
    const l = { tex: `\\left(${inner}\\right)` };
    if (has0) l.notes = [zeroNotes('nula', false)];
    const head = `=${L}${xp(n)}`;
    steps.push({
      title: 'Vytknutí nejvyšší mocniny',
      text: `Každý člen vydělíme $${xp(n)}$. Zlomky s $x$ ve jmenovateli jdou pro $x\\to${infT(dir)}$ k nule (oranžová nula), v závorce zbude jen číslo $${an}$.`,
      board: tlen(head) + tlen(inner) + 2 <= MAXW + 4 ? [{ ...l, tex: `${head}${l.tex}` }] : [{ tex: `${head}\\cdot` }, { ...l, tex: `\\qquad${l.tex}` }],
    });
    const s = Math.sign(an) * xs(n);
    result = { kind: 'inf', s };
    steps.push({
      title: 'Výsledek',
      text: `Mocnina $x^{${n}}$ jde pro $x\\to${infT(dir)}$ k $${infT(xs(n))}$ (${dir < 0 ? (n % 2 ? 'lichá mocnina záporného čísla je záporná' : 'sudá mocnina je kladná') : 'velké kladné číslo'}). Vynásobíme číslem $${an}$.`,
      board: [resLine(`=${an < 0 ? `(${an})` : an}\\cdot${infP(xs(n))}=`, infT(s))],
    });
  } else {
    const f = `\\frac{${polyTex(num)}}{${polyTex(den2)}}`;
    const xm = m === 1 ? 'x' : `x^{${m}}`;
    steps.push({
      title: 'Typ ∞/∞',
      text: 'Čitatel i jmenovatel rostou nade všechny meze, dosazením by vyšel neurčitý výraz $\\frac{\\infty}{\\infty}$. Čitatel i jmenovatel vydělíme nejvyšší mocninou jmenovatele.'
        + (negD ? ' Jmenovatel začíná záporným číslem, proto znaménko mínus napíšeme před zlomek (jmenovatel pak zůstane kladný, výraz se nezmění) a počítáme dál s ním.' : ''),
      board: [{ tex: `${negD ? '=' : ''}${sgL}${L}${f}` }],
    });
    const nt = terms(num, m, 'nula'); const dt = terms(den2, m, 'nulaj');
    const nn = [];
    if (/bt-nula\}/.test(nt)) nn.push(zeroNotes('nula', false));
    if (/bt-nulaj/.test(dt)) nn.push(zeroNotes('nulaj', true));
    const l2 = { tex: `=${sgL}${L}\\frac{${nt}}{${dt}}` };
    if (nn.length) l2.notes = nn;
    steps.push({
      title: `Dělení mocninou x${supChar[m]}`,
      text: `Zlomek rozšíříme výrazem $\\frac{1}{${xm}}$ (násobíme jedničkou), tj. každý člen vydělíme $${xm}$. Členy se zlomkem $\\frac{c}{x^k}$ jdou k nule – oranžové nuly.`,
      board: [{ tex: `\\text{vše dělíme }${xm}` }, l2],
    });
    if (n < m) {
      result = { kind: 'num', v: fr(0) };
      steps.push({
        title: 'Výsledek',
        text: `Stupeň čitatele (${n}) je menší než stupeň jmenovatele (${m}): v čitateli zbudou jen nuly, ve jmenovateli číslo $${bm}$. Limita je $0$.`,
        board: [resLine(`=${sgL}\\frac{0}{${bm2}}=`, '0')],
      });
    } else if (n === m) {
      const v = fr(an, bm);
      const u = signedFrac(an, bm);
      result = { kind: 'num', v };
      steps.push({
        title: 'Výsledek',
        text: `Stupně čitatele i jmenovatele jsou stejné (${n}): zbude podíl koeficientů u nejvyšších mocnin $${an}$ a $${bm}$.`,
        board: [resLine(u === frTex(v) ? '=' : `=${u}=`, frTex(v))],
      });
    } else {
      const e = n - m;
      const C = fr(an, bm);
      const s = sgn(C) * xs(e);
      result = { kind: 'inf', s };
      const nt2 = terms(num, n, 'nz'); const dt2 = terms(den2, m, 'nzj');
      const nn2 = [];
      if (/bt-nz\}/.test(nt2)) nn2.push(zeroNotes('nz', false));
      if (/bt-nzj/.test(dt2)) nn2.push(zeroNotes('nzj', true));
      const lx = { tex: `=${sgL}${L}\\frac{${xp(e)}\\left(${nt2}\\right)}{${dt2}}` };
      if (nn2.length) lx.notes = nn2;
      steps.push({
        title: `Vytknutí ${xp(e)} v čitateli`,
        text: `Stupeň čitatele (${n}) je větší než stupeň jmenovatele (${m}). V čitateli je po dělení nejvyšší mocnina $${xp(e)}$ (protože $${n}-${m}=${e}$), kterou vytkneme: zbylé členy $\\frac{c}{x^k}$ jdou k nule (oranžové nuly) a v závorce zůstane jen číslo $${an}$. Ve jmenovateli zůstane číslo $${bm}$.`,
        board: [lx, { tex: `=${Math.abs(an) % bm === 0 ? frTex(C) : signedFrac(an, bm)}\\cdot ${L}${xp(e)}` }],
      });
      steps.push({
        title: 'Výsledek',
        text: `Mocnina $${xp(e)}$ jde pro $x\\to${infT(dir)}$ k $${infT(xs(e))}$${dir < 0 ? (e % 2 ? ' (lichá mocnina záporného čísla je záporná)' : ' (sudá mocnina je kladná)') : ''}. Vynásobíme číslem $${frTex(C)}$ – záporné číslo obrátí znaménko.`,
        board: [resLine(`=${parT(C)}\\cdot${infP(xs(e))}=`, infT(s))],
      });
    }
  }
  const promptTex = m === 0 ? `${L}${nTerms(num) > 1 ? `(${polyTex(num)})` : polyTex(num)}` : `${L}\\frac{${polyTex(num)}}{${polyTex(den)}}`;
  return {
    id: idOf('nekonecno', data), topic: TOPIC, type: 'nekonecno', data,
    task: `Vypočítej limitu. ${FORMAT}`,
    promptTex,
    ...answer(result),
    solution: steps,
  };
}
function genNekonecno(rng) {
  for (;;) {
    const c = pick(rng, ['poly', '<', '=', '>']);
    const to = rng() < 0.5 ? 1 : -1;
    let n; let m;
    if (c === 'poly') { n = ri(rng, 2, 4); m = 0; } else if (c === '<') { m = ri(rng, 2, 3); n = ri(rng, 1, m - 1); } else if (c === '=') { n = m = ri(rng, 1, 3); } else { m = ri(rng, 1, 2); n = ri(rng, m + 1, 3); }
    const mk = (d, pos) => {
      const p = Array.from({ length: d + 1 }, (_, i) => (i === d ? (pos ? ri(rng, 1, 5) : rnz(rng, -5, 5)) : rng() < 0.35 ? 0 : ri(rng, -6, 6)));
      return p;
    };
    const num = mk(n, false); const den = m ? mk(m, true) : [1];
    if (nTerms(num) < 2 || (m && nTerms(den) < 2)) continue;
    return solveNekonecno({ num, den, to });
  }
}

// =====================================================================
// Typ 6: základní limita sin x / x
// data = { form: 'sx'|'xs'|'ss'|'tx', a, b, m? }
const ax = (k) => (k === 1 ? 'x' : `${k}x`);
const sinT = (k) => `\\sin ${ax(k)}`;
function solveSinx(data) {
  const { form, a, b } = data;
  const mm = data.m ?? 1;
  const mp = mm === 1 ? '' : String(mm);
  const mc = mm === 1 ? '' : `${mm}\\cdot `;
  const L = limTex(fr(0));
  const tg = `\\operatorname{tg} ${ax(a)}`;
  const f = {
    sx: `\\frac{${mp}${sinT(a)}}{${ax(b)}}`,
    xs: `\\frac{${ax(b)}}{${sinT(a)}}`,
    ss: `\\frac{${mp}${sinT(a)}}{${sinT(b)}}`,
    tx: `\\frac{${mp}${tg}}{${ax(b)}}`,
  }[form];
  const fz = {
    sx: `\\frac{${mp}\\sin 0}{0}`,
    xs: '\\frac{0}{\\sin 0}',
    ss: `\\frac{${mp}\\sin 0}{\\sin 0}`,
    tx: `\\frac{${mp}\\operatorname{tg} 0}{0}`,
  }[form];
  const one = (t) => `\\frac{${sinT(t)}}{${ax(t)}}`;
  let num; let den; let lines; let text;
  const brace = (c, below) => ({ kind: 'brace', target: `bt-${c}`, label: '1', ...(below ? { position: 'below' } : {}) });
  if (form === 'sx') {
    num = mm * a; den = b;
    lines = [{ tex: `=${L}\\frac{${mc}${a}}{${b}}\\cdot ${cls('z1', one(a))}`, notes: [brace('z1')] }];
    text = a === 1 ? 'Číslo ve jmenovateli vytkneme před zlomek; zbude základní limita $\\frac{\\sin x}{x}$.' : `Aby se argument sinu shodoval se jmenovatelem, zlomek rozšíříme číslem $${a}$: ve jmenovateli bude $${ax(a)}$. Čísla vytkneme před zlomek.`;
  } else if (form === 'xs') {
    num = b; den = a;
    lines = [{ tex: `=${L}\\frac{${b}}{${a}}\\cdot\\frac{1}{${cls('z1', one(a))}}`, notes: [brace('z1', true)] }];
    text = `Zlomek obrátíme na tvar se základní limitou ve jmenovateli: $\\frac{${ax(b)}}{${sinT(a)}}=\\frac{${b}}{${a}}\\cdot\\frac{1}{\\frac{${sinT(a)}}{${ax(a)}}}$.`;
  } else if (form === 'ss') {
    num = mm * a; den = b;
    lines = [
      { tex: `=${L}\\frac{${mc}${one(a)}\\cdot ${ax(a)}}{${one(b)}\\cdot ${ax(b)}}` },
      { tex: `=${L}\\frac{${mc}${a}}{${b}}\\cdot\\frac{${cls('z1', one(a))}}{${cls('z2', one(b))}}`, notes: [brace('z1'), brace('z2', true)] },
    ];
    text = `Čitatel i jmenovatel doplníme na základní limitu: $${sinT(a)}=\\frac{${sinT(a)}}{${ax(a)}}\\cdot ${ax(a)}$ a podobně dole. Proměnná $x$ se pak vykrátí a zbude $\\frac{${mm * a}}{${b}}$.`;
  } else {
    num = mm * a; den = b;
    lines = [
      { tex: `=${L}\\frac{${mp}${sinT(a)}}{${ax(b)}\\cos ${ax(a)}}` },
      { tex: `=${L}\\frac{${mc}${a}}{${b}}\\cdot ${cls('z1', one(a))}\\cdot ${cls('z2', `\\frac{1}{\\cos ${ax(a)}}`)}`, notes: [brace('z1'), brace('z2')] },
    ];
    text = `Tangens přepíšeme jako $\\operatorname{tg} t=\\frac{\\sin t}{\\cos t}$, zlomek rozšíříme číslem $${a}$ a vytkneme čísla. Kosinus je spojitý a $\\cos 0=1$.`;
  }
  const g = gcd(num, den);
  const v = fr(num, den);
  const unr = signedFrac(num, den);
  const steps = [
    {
      title: 'Dosazení',
      text: 'Dosazením $x=0$ vyjde $\\frac{0}{0}$ (sinus i tangens nuly je nula). Využijeme základní limitu $\\lim_{t\\to 0}\\frac{\\sin t}{t}=1$, která platí pro jakýkoli výraz $t$ jdoucí k nule, např. $t=3x$.',
      board: [{ tex: `${L}${f}` }, { tex: `${fz}=\\frac{0}{0}` }, { tex: `\\lim_{t\\to 0}\\frac{\\sin t}{t}=1` }],
    },
    { title: 'Úprava na základní limitu', text: `${text} Oranžová jednička je hodnota základní limity.`, board: lines },
    {
      title: 'Výsledek',
      text: `Limita součinu je součin limit: číslo před limitou krát $1$.${g > 1 && den !== 1 ? ' Zlomek zkrátíme.' : ''}`,
      board: [resLine(`=${den === 1 ? num : unr}\\cdot 1=`, frTex(v))],
    },
  ];
  return {
    id: idOf('sinx', data), topic: TOPIC, type: 'sinx', data,
    task: `Vypočítej limitu. ${FORMAT}`,
    promptTex: `${L}${f}`,
    ...answer({ kind: 'num', v }),
    solution: steps,
  };
}
function genSinx(rng) {
  const form = pick(rng, ['sx', 'sx', 'xs', 'ss', 'tx', 'tx']);
  for (;;) {
    const a = ri(rng, 1, 9); const b = ri(rng, 1, 9);
    const m = form !== 'xs' && rng() < 0.7 ? pick(rng, [-3, -2, 2, 3, 4, 5, 6]) : 1;
    // hodnota 1 (např. 5·tg x / 5x) a zlomek typu a/a by byly nezajímavé
    if ((form === 'xs' ? b === a : m * a === b) || (a === 1 && b === 1)) continue;
    const data = { form, a, b };
    if (m > 1) data.m = m;
    return solveSinx(data);
  }
}

// =====================================================================
// Typ 7: limity z grafu
// data = { pieces: [{ expr, tex, lo, hi, loIn, hiIn, kind, k?, s?, d?, c? }], dots: [{x, y}],
//          at: číslo | 'inf' | '-inf', side: ''|'-'|'+', b }
const lineTex = (k, q) => polyTex([q, k]);
const plusC = (d) => (d === 0 ? '' : d > 0 ? `+${d}` : `${d}`);
function piece(kind, b, val, prm, right) {
  if (kind === 'lin') {
    const { k } = prm;
    return { kind, k, expr: `${k}*(x-(${b}))+(${val})`, tex: lineTex(k, val - k * b) };
  }
  if (kind === 'quad') {
    const { s } = prm;
    const sq = b === 0 ? 'x^{2}' : `(${rootTex(fr(b))})^{2}`;
    return { kind, s, expr: `${s}*(x-(${b}))^2+(${val})`, tex: `${s < 0 ? '-' : ''}${sq}${plusC(val)}` };
  }
  if (kind === 'hyp') {
    const { s } = prm;
    const c = b - 1; const d = val - s;
    return { kind, s, c, d, expr: `${s}/(x-(${c}))+(${d})`, tex: `${s < 0 ? '-' : ''}\\frac{1}{${rootTex(fr(c))}}${plusC(d)}`, right };
  }
  return { kind: 'const', expr: `${val}`, tex: String(val), d: val };
}
// limita větve v ±∞: { kind, s } nebo číslo
function pieceInf(p, dir) {
  if (p.kind === 'lin') return { kind: 'inf', s: Math.sign(p.k) * dir };
  if (p.kind === 'quad') return { kind: 'inf', s: p.s };
  return { kind: 'num', v: fr(p.d) };
}
function solveGraf(data) {
  const { pieces, dots = [], at, side = '', b } = data;
  const [Lp, Rp] = pieces;
  const [LV, RV] = data.vals;
  const cond = (p, left) => (left ? `x${p.hiIn ? '\\le' : '<'}${b}` : `x${p.loIn ? '\\ge' : '>'}${b}`);
  const rows = [`${Lp.tex} & \\text{pro } ${cond(Lp, true)}`, `${Rp.tex} & \\text{pro } ${cond(Rp, false)}`];
  dots.forEach((d) => rows.push(`${d.y} & \\text{pro } x=${d.x}`));
  const def = `f(x)=\\begin{cases}${rows.join('\\\\ ')}\\end{cases}`;
  // graf
  const pts = [];
  const lClosed = !!Lp.hiIn; const rClosed = !!Rp.loIn;
  if (LV === RV) pts.push({ x: b, y: LV, style: lClosed || rClosed ? 'closed' : 'open' });
  else {
    pts.push({ x: b, y: LV, style: lClosed ? 'closed' : 'open' });
    pts.push({ x: b, y: RV, style: rClosed ? 'closed' : 'open' });
  }
  dots.forEach((d) => pts.push({ x: d.x, y: d.y, style: 'closed' }));
  const asym = [];
  if (Lp.kind === 'hyp') { asym.push({ kind: 'vertical', x: Lp.c, label: `x = ${plain(String(Lp.c))}` }); asym.push({ kind: 'horizontal', y: Lp.d, label: `y = ${plain(String(Lp.d))}` }); }
  if (Rp.kind === 'hyp' && !(Lp.kind === 'hyp' && Lp.d === Rp.d)) asym.push({ kind: 'horizontal', y: Rp.d, label: `y = ${plain(String(Rp.d))}` });
  const viz = {
    kind: 'plot',
    data: {
      domain: [b - 5, b + 4], range: [-5, 6],
      functions: [{ expr: `x < ${b} ? (${Lp.expr}) : NaN`, color: 'chalk' }, { expr: `x > ${b} ? (${Rp.expr}) : NaN`, color: 'chalk' }],
      asymptotes: asym, points: pts,
      alt: 'Graf funkce zadané po částech s plnými a prázdnými body',
    },
  };
  const fb = dots.length ? dots[0].y : lClosed ? LV : rClosed ? RV : null;
  const steps = [{
    title: 'Graf funkce',
    text: `Nakreslíme obě větve: levou pro $x$ vlevo od $${b}$, pravou vpravo. Plné kolečko je bod, který ke grafu patří (funkční hodnota), prázdné kolečko bod, který ke grafu nepatří – větev se k němu jen blíží.${asym.length ? ' Čárkovaně jsou asymptoty.' : ''}`,
    board: [{ tex: `${Lp.tex},\\ ${cond(Lp, true)}` }, { tex: `${Rp.tex},\\ ${cond(Rp, false)}` }, ...dots.map((d) => ({ tex: `${d.y},\\ x=${d.x}` }))],
    viz,
  }];
  let result;
  const L = typeof at === 'number' ? limTex(fr(at), side) : limTex(at === 'inf' ? '\\infty' : '-\\infty');
  if (at === b) {
    const lLine = `${limTex(fr(b), '-')}\\left(${Lp.tex}\\right)`;
    const rLine = `${limTex(fr(b), '+')}\\left(${Rp.tex}\\right)`;
    const fbLine = { tex: fb === null ? `f(${b})\\ \\text{není definována}` : `f(${b})=${fb}` };
    const cont = (lim) => (fb === null ? `Funkce v bodě $${b}$ není definovaná, takže tam spojitá není – limita na tom ale nezávisí.`
      : lim !== null && lim === fb ? `Navíc $f(${b})=${fb}$ se rovná limitě, takže funkce je v bodě $${b}$ spojitá.`
        : `Funkční hodnota $f(${b})=${fb}$ na limitu nemá vliv${lim === null ? '' : ' (funkce v bodě není spojitá, protože se od limity liší)'}.`);
    if (side) {
      const v = side === '-' ? LV : RV;
      result = { kind: 'num', v: fr(v) };
      steps.push({
        title: side === '-' ? 'Blížíme se zleva' : 'Blížíme se zprava',
        text: `Po ${side === '-' ? 'levé' : 'pravé'} větvi jdeme k bodu $x=${b}$ a sledujeme, k jaké výšce $y$ se graf blíží. Výpočtem: do ${side === '-' ? 'levé' : 'pravé'} větve dosadíme $x=${b}$ (větev je spojitá).`,
        board: [{ tex: side === '-' ? lLine : rLine }],
      });
      steps.push({
        title: 'Výsledek',
        text: `Graf se blíží k výšce $${v}$. ${cont(null)}`,
        board: [resLine('=', String(v)), fbLine],
      });
    } else {
      steps.push({
        title: 'Limita zleva a zprava',
        text: `K bodu $x=${b}$ se blížíme po levé větvi (limita zleva) a po pravé větvi (limita zprava). Do každé větve dosadíme $x=${b}$.`,
        board: [{ tex: lLine }, { tex: `=${LV}` }, { tex: rLine }, { tex: `=${RV}` }],
      });
      const same = LV === RV;
      result = same ? { kind: 'num', v: fr(LV) } : { kind: 'dne' };
      steps.push({
        title: 'Výsledek',
        text: same
          ? `Obě jednostranné limity jsou stejné, limita v bodě $${b}$ existuje a je $${LV}$. ${cont(LV)}`
          : `Limita zleva ($${LV}$) a limita zprava ($${RV}$) se liší – graf má v bodě $${b}$ skok, takže limita neexistuje. ${cont(null)}`,
        board: [same ? resLine(`${L}f(x)=`, String(LV)) : { tex: `${L}f(x)\\ ${cls(RES, '\\text{neexistuje}')}`, notes: [DU] }, fbLine],
      });
    }
  } else if (typeof at === 'number') {
    // pól levé větve s/(x − c) + d
    const { s, c } = Lp;
    const lt = rootTex(fr(c));
    steps.push({
      title: 'Blížíme se k asymptotě',
      text: `V bodě $x=${c}$ má levá větev svislou asymptotu: jmenovatel $${lt}$ jde k nule, zlomek $\\frac{${s < 0 ? '-' : ''}1}{${lt}}$ roste nade všechny meze. Znaménko určí, z které strany se k nule blížíme.`,
      board: [
        { tex: `x\\to ${c}^{-}:\\ ${lt}\\to 0^{-}` }, { tex: `\\Rightarrow\\ f(x)\\to ${infT(-s)}` },
        { tex: `x\\to ${c}^{+}:\\ ${lt}\\to 0^{+}` }, { tex: `\\Rightarrow\\ f(x)\\to ${infT(s)}` },
      ],
    });
    if (side) {
      const sv = side === '-' ? -s : s;
      result = { kind: 'inf', s: sv };
      steps.push({ title: 'Výsledek', text: `Graf u asymptoty ${sv > 0 ? 'stoupá vzhůru' : 'klesá dolů'}.`, board: [resLine(`${L}f(x)=`, infT(sv))] });
    } else {
      result = { kind: 'dne' };
      steps.push({
        title: 'Výsledek',
        text: 'Zleva graf jde do jednoho nekonečna, zprava do opačného. Jednostranné limity se liší, proto limita neexistuje.',
        board: [{ tex: `${L}f(x)\\ ${cls(RES, '\\text{neexistuje}')}`, notes: [DU] }],
      });
    }
  } else {
    const dir = at === 'inf' ? 1 : -1;
    const p = dir > 0 ? Rp : Lp;
    result = pieceInf(p, dir);
    const why = {
      lin: 'Přímka s kladnou směrnicí roste, se zápornou klesá – nad všechny meze.',
      quad: 'Parabola je pro velká $|x|$ určena členem $(x-b)^2$, který roste nade všechny meze; znaménko před ním určí směr.',
      hyp: 'Zlomek $\\frac{1}{x-c}$ jde pro $x\\to\\pm\\infty$ k nule, graf se přimyká k vodorovné asymptotě.',
      const: 'Větev je konstantní, graf je vodorovná přímka.',
    }[p.kind];
    steps.push({
      title: dir > 0 ? 'Doprava do nekonečna' : 'Doleva do nekonečna',
      text: `Pro $x\\to${infT(dir)}$ rozhoduje jen ${dir > 0 ? 'pravá' : 'levá'} větev. ${why}`,
      board: [{ tex: `${L}\\left(${p.tex}\\right)` }],
    });
    steps.push({ title: 'Výsledek', text: 'Výsledek čteme z konce grafu (nebo dosazením nekonečna do větve).', board: [resLine('=', resultTex(result))] });
  }
  return {
    id: idOf('z-grafu', data), topic: TOPIC, type: 'z-grafu', data,
    task: `Funkce $f$ je zadaná po částech. Načrtni si její graf (je i v prvním kroku postupu) a urči z něj limitu ve druhém řádku zadání. ${FORMAT}`,
    promptTex: `\\begin{gathered}${def}\\\\ ${L}f(x)\\end{gathered}`,
    promptViz: viz,
    ...answer(result),
    solution: steps,
  };
}
function genGraf(rng) {
  const b = ri(rng, -1, 2);
  const LV = ri(rng, -2, 3);
  let RV = LV;
  if (rng() > 0.35) while (RV === LV) RV = ri(rng, -2, 3);
  const lk = pick(rng, ['lin', 'quad', 'hyp']);
  const rk = pick(rng, ['lin', 'quad', 'hyp', 'const']);
  const prm = () => ({ k: pick(rng, [-2, -1, 1, 2]), s: pick(rng, [1, -1]) });
  const Lp = { ...piece(lk, b, LV, prm(), false), lo: null, hi: b };
  const Rp = { ...piece(rk, b, RV, prm(), true), lo: b, hi: null };
  if (Lp.tex === Rp.tex) return genGraf(rng); // stejný vzorec na obou větvích by byl umělé rozdělení
  const mode = pick(rng, ['left', 'right', 'dot', 'none']);
  if (mode === 'left') Lp.hiIn = true;
  if (mode === 'right') Rp.loIn = true;
  const dots = [];
  if (mode === 'dot') { let V = ri(rng, -2, 4); while (V === LV || V === RV) V = ri(rng, -2, 4); dots.push({ x: b, y: V }); }
  const q = rng();
  let at = b; let side = pick(rng, ['', '', '-', '+']);
  if (lk === 'hyp' && q < 0.2) { at = Lp.c; side = pick(rng, ['', '-', '+']); } else if (q > 0.72) { at = rng() < 0.5 ? 'inf' : '-inf'; side = ''; }
  return solveGraf({ b, vals: [LV, RV], pieces: [Lp, Rp], dots, at, side });
}

// =====================================================================
const theory = [
  {
    heading: 'Co je limita',
    text: 'Limita popisuje, k jaké hodnotě se blíží funkční hodnoty $f(x)$, když se $x$ blíží k bodu $a$. Zápis $\\lim_{x\\to a} f(x) = L$ čteme „limita funkce $f$ pro $x$ jdoucí k $a$ je $L$“.\n\nDůležité: na samotné hodnotě $f(a)$ nezáleží. Funkce v bodě $a$ ani nemusí být definovaná (třeba $\\frac{\\sin x}{x}$ v nule), musí být ale definovaná v okolí bodu.\n\nK bodu se můžeme blížit zleva ($x\\to a^-$, čísla menší než $a$) nebo zprava ($x\\to a^+$). To jsou jednostranné limity. (Oboustranná) limita existuje, právě když existují obě jednostranné a jsou si rovny.\n\nLimita může být číslo (vlastní limita) nebo $\\pm\\infty$ (nevlastní limita). Bod $a$ může být číslo nebo $\\pm\\infty$ (limita v nevlastním bodě).',
    tex: '\\lim_{x\\to a}f(x)=L\\iff\\lim_{x\\to a^-}f(x)=L=\\lim_{x\\to a^+}f(x)',
    mistakes: [
      'Plést si limitu s funkční hodnotou: limita v bodě může existovat, i když $f(a)$ neexistuje nebo je jiná.',
      'Zapomenout, že $\\lim$ se píše na každém řádku, dokud jsme limitu opravdu nespočítali.',
    ],
  },
  {
    heading: 'Dosazení a spojitost',
    text: 'Funkce je v bodě $a$ spojitá, když je tam definovaná a $\\lim_{x\\to a}f(x)=f(a)$ – graf v bodě „nepřerušíme tužkou“. Mnohočleny, podíly mnohočlenů (kde je jmenovatel nenulový), odmocniny, $\\sin$, $\\cos$, $e^x$, $\\ln x$ a další elementární funkce jsou spojité všude ve svém definičním oboru. Proto limitu nejdřív vždy zkusíme spočítat dosazením.\n\nLimita součtu, rozdílu, součinu a podílu je součet, rozdíl, součin a podíl limit – pokud výsledek dává smysl. S nekonečnem počítáme: $a+\\infty=\\infty$, $a\\cdot\\infty=\\infty$ pro $a>0$ (pro $a<0$ je to $-\\infty$), $\\frac{a}{\\pm\\infty}=0$.\n\nKdyž dosazení dá neurčitý výraz $\\frac{0}{0}$, $\\frac{\\infty}{\\infty}$, $\\infty-\\infty$ nebo $0\\cdot\\infty$, výsledek z něj nepoznáme a funkci musíme upravit.',
    tex: '\\frac{0}{0},\\ \\frac{\\infty}{\\infty},\\ \\infty-\\infty,\\ 0\\cdot\\infty\\ \\text{ jsou neurčité výrazy}',
    mistakes: [
      'Napsat $\\frac{0}{0}=0$ nebo $\\frac{0}{0}=1$. Neurčitý výraz není číslo – je to pokyn „uprav a počítej dál“.',
      'Zapomenout na závorky při dosazení záporného čísla: $(-2)^2=4$, ale $-2^2=-4$.',
    ],
  },
  {
    heading: 'Typ 0/0: rozklad a krácení',
    text: 'Vyjde-li u podílu mnohočlenů po dosazení $x=a$ výraz $\\frac{0}{0}$, je $a$ kořenem čitatele i jmenovatele. Oba mnohočleny jsou tedy dělitelné kořenovým činitelem $(x-a)$. Rozložíme je – vzorcem, rozkladem kvadratického trojčlenu nebo dělením mnohočlenů – a činitel $(x-a)$ vykrátíme (pro $x\\neq a$ je nenulový, takže krátit smíme).\n\nOstatní závorky v bodě $a$ nulové nejsou: jejich hodnoty (na tabuli oranžově nad závorkou) vytkneme před limitu jako číslo. Pokud po krácení vyjde opět $\\frac{0}{0}$, rozklad zopakujeme.\n\nUžitečné vzorce: $a^2-b^2=(a-b)(a+b)$, $a^3-b^3=(a-b)(a^2+ab+b^2)$, $a^3+b^3=(a+b)(a^2-ab+b^2)$. Je-li bod zlomek $\\frac{p}{q}$, dělíme výrazem $(qx-p)$.',
    tex: '\\lim_{x\\to a}\\frac{(x-a)\\,P(x)}{(x-a)\\,Q(x)}=\\frac{P(a)}{Q(a)}',
    mistakes: [
      'Krátit sčítance místo činitelů: v $\\frac{x^2-1}{x-1}$ nelze škrtnout $x$ ani $1$. Nejdřív rozložit na součin.',
      'Ve vzorci pro součet třetích mocnin napsat $a^2+ab+b^2$ – u součtu je uprostřed minus.',
      'Po vykrácení zapomenout dosadit: výsledkem je číslo, ne výraz.',
    ],
  },
  {
    heading: 'Odmocniny: rozšíření sdruženým výrazem',
    text: 'Obsahuje-li zlomek rozdíl s odmocninou, např. $\\sqrt{x+7}-4$, a dosazení dá $\\frac{0}{0}$, rozšíříme zlomek sdruženým výrazem $\\sqrt{x+7}+4$ (stejný výraz se znaménkem plus). Podle vzorce $(A-B)(A+B)=A^2-B^2$ odmocnina zmizí: $(\\sqrt{x+7}-4)(\\sqrt{x+7}+4)=(x+7)-16=x-9$. Pak už jen krátíme jako u mnohočlenů.\n\nSdružený výraz v bodě nulový není – je roven dvojnásobku čísla za odmocninou – a jeho hodnotu vytkneme před limitu. Jsou-li odmocniny v čitateli i ve jmenovateli, rozšíříme oběma sdruženými výrazy.',
    tex: '\\left(\\sqrt{R}-c\\right)\\left(\\sqrt{R}+c\\right)=R-c^2',
    mistakes: [
      'Roznásobit sdružený výraz i tam, kde ho nepotřebujeme – zbylý sdružený výraz stačí opsat a na konci vyčíslit.',
      'Zapomenout závorku: $3-(x+1)=2-x$, ne $3-x+1$.',
      'Myslet si, že $\\sqrt{a+b}=\\sqrt{a}+\\sqrt{b}$. To neplatí.',
    ],
  },
  {
    heading: 'Typ k/0: jednostranné limity a znaménko',
    text: 'Dá-li dosazení nenulové číslo děleno nulou ($\\frac{k}{0}$, $k\\neq 0$), limita je nekonečná nebo neexistuje. Rozhoduje znaménko jmenovatele těsně vlevo a vpravo od bodu: $\\frac{1}{0^+}=+\\infty$ (dělíme malým kladným číslem), $\\frac{1}{0^-}=-\\infty$.\n\nPostup: jmenovatel rozložíme, ostatní činitele vyčíslíme a vytkneme (číslo $C$), zbude $C\\cdot\\lim\\frac{1}{(x-a)^m}$. Pro $x\\to a^-$ je $x-a<0$, pro $x\\to a^+$ je $x-a>0$. Lichá mocnina znaménko zachová, sudá ho udělá kladným. Pomůže tabulka znamének.\n\nVyjdou-li jednostranné limity různé (např. $-\\infty$ a $+\\infty$), limita neexistuje. U sudé mocniny vyjdou stejné a limita je $+\\infty$ nebo $-\\infty$. Bod, kde se to děje, je svislá asymptota grafu.',
    tex: '\\lim_{x\\to 0^+}\\frac{1}{x}=+\\infty,\\quad\\lim_{x\\to 0^-}\\frac{1}{x}=-\\infty,\\quad\\lim_{x\\to 0}\\frac{1}{x^2}=+\\infty',
    mistakes: [
      'Psát $\\frac{k}{0}=\\infty$ bez rozboru znaménka. Je potřeba zjistit, z které strany jde jmenovatel k nule.',
      'Zapomenout na znaménko čísla před limitou: $-2\\cdot(+\\infty)=-\\infty$.',
      'Prohlásit „neexistuje“ i u sudé mocniny – tam vychází stejné nekonečno z obou stran.',
    ],
  },
  {
    heading: 'Limita v nekonečnu',
    text: 'U mnohočlenu pro $x\\to\\pm\\infty$ vytkneme nejvyšší mocninu: $2x^4-5x^2+9=x^4\\left(2-\\frac{5}{x^2}+\\frac{9}{x^4}\\right)$. Zlomky jdou k nule ($\\frac{c}{x^k}\\to 0$), rozhoduje člen s nejvyšší mocninou. Pozor u $-\\infty$: lichá mocnina je záporná, sudá kladná.\n\nU podílu mnohočlenů vydělíme čitatel i jmenovatel nejvyšší mocninou jmenovatele. Podle stupňů $n$ (čitatel) a $m$ (jmenovatel) jsou tři případy: $n<m$ – limita je $0$; $n=m$ – limita je podíl koeficientů u nejvyšších mocnin; $n>m$ – limita je $+\\infty$ nebo $-\\infty$ (znaménko podle koeficientů a směru).\n\nDalší užitečné limity: $\\lim_{x\\to\\infty}e^x=\\infty$, $\\lim_{x\\to-\\infty}e^x=0$, $\\lim_{x\\to\\infty}\\ln x=\\infty$, $\\lim_{x\\to 0^+}\\ln x=-\\infty$, $\\lim_{x\\to\\pm\\infty}\\operatorname{arctg}x=\\pm\\frac{\\pi}{2}$. Příklady s nimi: $\\lim_{x\\to\\infty}e^{-x}=0$ (exponent jde do $-\\infty$), $\\lim_{x\\to-\\infty}\\left(4-e^{x}\\right)=4-0=4$, $\\lim_{x\\to\\infty}\\left(3+\\operatorname{arctg}x\\right)=3+\\frac{\\pi}{2}$.',
    tex: '\\lim_{x\\to\\pm\\infty}\\frac{c}{x^k}=0\\quad(k>0)',
    mistakes: [
      'Dělit mocninou čitatele místo jmenovatele – jde to také, ale snadno se pak splete výsledek. Držme se jmenovatele.',
      'U $x\\to-\\infty$ zapomenout, že $x^3\\to-\\infty$, ale $x^2\\to+\\infty$.',
      'Myslet si, že $\\infty-\\infty=0$. Je to neurčitý výraz.',
    ],
  },
  {
    heading: 'Číslo e: limita (1 + 1/x)^x',
    text: 'Důležitá limita definuje Eulerovo číslo $e\\approx 2{,}718$: $\\lim_{x\\to\\infty}\\left(1+\\frac{1}{x}\\right)^{x}=e$. Je to neurčitý výraz typu $1^{\\infty}$: základ se blíží k $1$, exponent roste nade všechny meze, a proto výsledek není $1$ (ani $\\infty$). Dosadit nejde, limitu známe.\n\nObecněji pro číslo $k$ platí $\\lim_{x\\to\\infty}\\left(1+\\frac{k}{x}\\right)^{x}=e^{k}$. Příklady: $\\lim_{x\\to\\infty}\\left(1+\\frac{3}{x}\\right)^{x}=e^{3}$, $\\lim_{x\\to\\infty}\\left(1-\\frac{2}{x}\\right)^{x}=e^{-2}$ a pro exponent $2x$: $\\left(1+\\frac{1}{x}\\right)^{2x}=\\left[\\left(1+\\frac{1}{x}\\right)^{x}\\right]^{2}\\to e^{2}$.\n\nPodobná je limita pro $x\\to 0$: $\\lim_{x\\to 0}(1+x)^{1/x}=e$. Spolu s limitami $e^x$, $\\ln x$ a $\\operatorname{arctg}x$ z předchozí části patří k základním limitám, které se používají bez dalšího odvozování.',
    tex: '\\lim_{x\\to\\infty}\\left(1+\\frac{k}{x}\\right)^{x}=e^{k}',
    mistakes: [
      'Napsat $1^{\\infty}=1$. Neurčitý výraz $1^{\\infty}$ může mít jakoukoli hodnotu, tady vyjde $e^k$.',
      'Zapomenout na číslo $k$ v čitateli: $\\left(1+\\frac{3}{x}\\right)^x$ se blíží k $e^3$, ne k $e$.',
    ],
  },
  {
    heading: 'Základní limita sin x / x',
    text: 'Platí $\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$, a to i když místo $x$ stojí jiný výraz jdoucí k nule: $\\lim_{x\\to 0}\\frac{\\sin 3x}{3x}=1$. Zlomek proto upravíme tak, aby argument sinu stál i ve jmenovateli: $\\frac{\\sin 3x}{5x}=\\frac{3}{5}\\cdot\\frac{\\sin 3x}{3x}\\to\\frac{3}{5}$.\n\nTangens přepíšeme jako $\\frac{\\sin x}{\\cos x}$ a využijeme $\\cos 0=1$. Podíl dvou sinů rozšíříme tak, aby vznikly dvě základní limity.',
    tex: '\\lim_{x\\to 0}\\frac{\\sin ax}{bx}=\\frac{a}{b},\\qquad\\lim_{x\\to 0}\\frac{\\operatorname{tg} x}{x}=1',
    mistakes: [
      'Krátit $\\frac{\\sin 3x}{x}$ na $\\sin 3$. Sinus je funkce, ne násobení – $x$ z argumentu nevytkneme.',
      'Použít základní limitu, když $x$ nejde k nule: $\\lim_{x\\to\\infty}\\frac{\\sin x}{x}=0$, ne $1$.',
    ],
  },
  {
    heading: 'Limity z grafu',
    text: 'Limitu zprava v bodě $a$ přečteme z grafu takto: položíme tužku na graf kousek vpravo od $a$ a posouváme ji po grafu k bodu $a$. Výška $y$, ke které se tužka blíží, je limita zprava. Stejně zleva.\n\nPrázdné kolečko znamená, že bod ke grafu nepatří (větev se k němu jen blíží), plné kolečko je skutečná funkční hodnota. Na plných kolečkách při čtení limity nezáleží. Skok grafu znamená, že se jednostranné limity liší a limita neexistuje. Svislá asymptota znamená nekonečnou limitu, vodorovná asymptota $y=d$ limitu $d$ v $\\pm\\infty$.\n\nFunkce je v bodě spojitá, když se obě jednostranné limity rovnají funkční hodnotě (plné kolečko leží přesně tam, kam se graf blíží).',
    mistakes: [
      'Odpovědět funkční hodnotou (plným kolečkem) místo limity.',
      'U skoku napsat jednu z jednostranných limit – oboustranná limita tam neexistuje.',
    ],
  },
];

export default {
  id: TOPIC,
  title: 'Limita funkce',
  order: 6,
  theory,
  types: [
    { id: 'dosazeni', test: { part: 'limity', level: 1 }, title: 'Dosazení (spojitost)', generate: genDosazeni, solve: solveDosazeni, custom: { fields: [{ id: 'num', label: 'Čitatel', kind: 'expr', hint: 'Mnohočlen, např. x^2-1' }, { id: 'den', label: 'Jmenovatel', kind: 'expr', hint: 'Mnohočlen; prázdné = 1' }, { id: 'a', label: 'x → a, kde a =', kind: 'number', hint: 'Celé číslo' }], build: (v) => {
      const num = polyOf(v.num); const den = polyOf(v.den, [1]); const a = intOf(v.a, 'Bod a');
      const at = (p) => p.reduce((s, c, i) => s + c * a ** i, 0);
      const nz = at(num) === 0; const dz = at(den) === 0;
      if (dz) fail('Ve jmenovateli vyšla v bodě a nula, to je jiný typ limity (0/0 nebo k/0).');
      return { num, den, a };
    } } },
    { id: 'rozklad', test: { part: 'limity', level: 1 }, title: 'Typ 0/0: rozklad a krácení', generate: genRozklad, solve: solveRozklad, custom: { fields: [{ id: 'num', label: 'Čitatel', kind: 'expr', hint: 'Mnohočlen, např. x^2-1' }, { id: 'den', label: 'Jmenovatel', kind: 'expr', hint: 'Mnohočlen; prázdné = 1' }, { id: 'a', label: 'x → a, kde a =', kind: 'number', hint: 'Celé číslo' }], build: (v) => {
      const num = polyOf(v.num); const den = polyOf(v.den, [1]); const a = intOf(v.a, 'Bod a');
      const at = (p) => p.reduce((s, c, i) => s + c * a ** i, 0);
      const nz = at(num) === 0; const dz = at(den) === 0;
      if (!nz || !dz) fail('Pro tento typ musí být čitatel i jmenovatel v bodě a rovny nule (typ 0/0).');
      return { num, den, a };
    } } },
    { id: 'jednostranne', test: { part: 'limity', level: 2 }, title: 'Typ k/0: jednostranné limity', generate: genJednostranne, solve: solveJednostranne },
    { id: 'odmocnina', test: { part: 'limity', level: 2 }, title: 'Odmocniny: sdružený výraz', generate: genOdmocnina, solve: solveOdmocnina },
    { id: 'nekonecno', test: { part: 'limity', level: 1 }, title: 'Limita v nekonečnu', generate: genNekonecno, solve: solveNekonecno },
    { id: 'sinx', test: { part: 'limity', level: 2 }, title: 'Limita se sin x / x', generate: genSinx, solve: solveSinx },
    { id: 'z-grafu', title: 'Limity z grafu', generate: genGraf, solve: solveGraf },
  ],
};
