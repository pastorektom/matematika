// Derivace funkce u(x)^v(x) logaritmickým derivováním (téma Derivace).
import { sumOf, dSum, sumTex, parenTex, sumStr, isZero, divTerm } from './derivace-lib.js';

const TOPIC = 'derivace';
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const resultLine = (pre, tex) => ({ tex: `${pre}${cls('vysledek', tex)}`, notes: [{ kind: 'doubleUnderline', target: 'bt-vysledek' }] });
const brace = (target, label, position) => ({ kind: 'brace', target: `bt-${target}`, label, ...(position ? { position } : {}) });
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const T = (c, p = 0, more = {}) => ({ c, ...(p ? { p } : {}), ...more });

const lnOf = (tex, isSingleAtom) => (isSingleAtom ? `\\ln ${tex}` : `\\ln(${tex})`);
// u, v: pole členů (data); funkce u^v, u > 0 tam, kde je definována
function solveLogder(data) {
  const u = sumOf(data.u); const v = sumOf(data.v);
  const du = dSum(u); const dv = dSum(v);
  const uT = sumTex(u); const vT = sumTex(v);
  const base = u.length === 1 && u[0].c.n === 1 && u[0].c.d === 1 && (u[0].S + u[0].C + u[0].L === 0) && isZero(u[0].p) === false && u[0].p.n === 1 && u[0].p.d === 1 ? 'x' : parenTex(u);
  const fTex = `${base === 'x' || u.length === 1 && u[0].S + u[0].C + u[0].L === 0 && u[0].c.n === 1 ? base : `(${uT})`}^{${vT}}`;
  const lnU = lnOf(base === 'x' ? 'x' : uT, base === 'x');
  const steps = [];
  steps.push({
    title: 'Proč logaritmická derivace',
    text: 'V základu i v exponentu je proměnná, takže to není ani mocnina $x^n$, ani exponenciála $a^x$. Funkci zlogaritmujeme: $\\ln(u^v)=v\\cdot\\ln u$ – exponent se tím dostane dolů.',
    board: [{ tex: `y=${fTex}` }, { tex: `\\ln y=${cls('v', parenTex(v))}\\cdot ${lnU}`, notes: [brace('v', 'exponent dolů')] }],
  });
  steps.push({
    title: 'Zderivujeme obě strany',
    text: 'Levou stranu derivujeme jako složenou funkci: $(\\ln y)\'=\\frac{y\'}{y}$. Pravou stranu derivujeme jako součin $v\\cdot\\ln u$, přitom $(\\ln u)\'=\\frac{u\'}{u}$.',
    board: [{ tex: `\\frac{y'}{y}=(${vT})'\\cdot ${lnU}+${parenTex(v)}\\cdot\\frac{(${uT})'}{${uT}}` }],
  });
  const dvP = parenTex(dv); const duP = sumTex(du);
  steps.push({
    title: 'Dosadíme derivace',
    text: `Dosadíme $v'=${sumTex(dv)}$ a $u'=${sumTex(du)}$.`,
    board: [{ tex: `\\frac{y'}{y}=${cls('dv', dvP)}\\cdot ${lnU}+${parenTex(v)}\\cdot\\frac{${cls('du', duP)}}{${uT}}`, notes: [brace('dv', "v′"), brace('du', "u′", 'below')] }],
  });
  const isOneSum = (s) => s.length === 1 && s[0].c.n === 1 && s[0].c.d === 1 && isZero(s[0].p) && !s[0].E && !s[0].S && !s[0].C && !s[0].L;
  const bracket = `${dvP}\\cdot ${lnU}+\\frac{${parenTex(v)}\\cdot ${parenTex(du)}}{${uT}}`;
  const first = isOneSum(dv) ? lnU : `${dv.length > 1 ? `(${sumTex(dv)})` : sumTex(dv)}\\,${lnU}`;
  let second;
  if (u.length === 1 && u[0].p.n === 1 && u[0].p.d === 1 && !u[0].S && !u[0].C && !u[0].L && !u[0].E && u[0].c.n === 1 && v.length === 1) {
    second = sumTex([divTerm(v[0], u[0])]); // v·(1/x)
  } else {
    const num = isOneSum(du) ? parenTex(v) : `${parenTex(v)}\\cdot ${parenTex(du)}`;
    second = `\\frac{${num}}{${uT}}`;
  }
  const bracket2 = `${first}${second.startsWith('-') ? '' : '+'}${second}`;
  // x^{ln x}: oba členy jsou stejné, sečteme je: ln x / x + ln x / x = 2 ln x / x
  const twin = u.length === 1 && v.length === 1 && u[0].p.n === 1 && u[0].p.d === 1 && !u[0].E && !u[0].S && !u[0].C && !u[0].L
    && u[0].c.n === 1 && u[0].c.d === 1 && isZero(v[0].p) && v[0].L === 1 && !v[0].E && !v[0].S && !v[0].C && v[0].c.n === 1 && v[0].c.d === 1;
  const twinSum = '\\frac{\\ln x}{x}+\\frac{\\ln x}{x}';
  const resTex = twin ? `${fTex}\\cdot\\frac{2\\ln x}{x}` : `${fTex}\\left(${bracket2}\\right)`;
  steps.push({
    title: 'Vyjádříme y′',
    text: 'Obě strany vynásobíme $y$ a za $y$ dosadíme původní funkci; závorku zjednodušíme (např. $x\\cdot\\frac{1}{x}=1$). Tím je derivace hotová.',
    board: [{ tex: `y'=y\\cdot\\left(${bracket}\\right)` }, { tex: `y'=${fTex}\\left(${bracket}\\right)` }, ...(twin ? [{ tex: `=${fTex}\\left(${twinSum}\\right)` }] : []), resultLine('=', resTex)].filter((l, i, a) => !(l.tex === (a[i + 1] || {}).tex)),
  });
  const str = `(${sumStr(u)})^(${sumStr(v)})*((${sumStr(dv)})*log(${sumStr(u)})+(${sumStr(v)})*(${sumStr(du)})/(${sumStr(u)}))`;
  return {
    id: idOf('logder', data), topic: TOPIC, type: 'logder', data,
    task: 'Derivuj logaritmickou derivací. Výsledek zapiš jako výraz v $x$, např. x^x*(log(x)+1). Přirozený logaritmus je log(x).',
    promptTex: `f(x)=${fTex}`,
    hint: 'Stačí jakýkoli rovnocenný tvar. Funkce piš se závorkou: sin(x), cos(x), log(x).',
    answerSpec: { kind: 'expression', value: str, variable: 'x' },
    answerTex: resTex,
    solution: steps,
  };
}
const U = [[T(1, 1)], [T(1, 1)], [T(1, 1), T(1)], [T(1, 0, { S: 1 })], [T(1, 0, { C: 1 })], [T(1, 0, { L: 1 })], [T(1, 1)]];
const V = [[T(1, 1)], [T(2, 1)], [T(1, 2)], [T(1, 0, { S: 1 })], [T(1, 0, { C: 1 })], [T(1, 0, { L: 1 })], [T(1), T(-1, 1)]];
function genLogder(rng) {
  for (;;) {
    const u = pick(rng, U); const v = pick(rng, V);
    const same = JSON.stringify(u) === JSON.stringify(v);
    if (same && !(u.length === 1 && u[0].p === 1)) continue;
    // u se v exponentu nesmí zhroutit na konstantu
    if (u[0].S || u[0].C || u[0].L) { if (v[0].S || v[0].C || v[0].L) continue; }
    return solveLogder({ u, v });
  }
}
export const elemTypes = [
  { id: 'logder', title: 'Logaritmická derivace u^v', generate: genLogder, solve: solveLogder },
];
