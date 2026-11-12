// Téma 2: Matice, hodnost, inverzní matice (podle probírané látky;
// zdrojové soubory jsou jen lokálně). Konkrétní příklady z materiálů jsou jen v content/, ne v gitu.
//
// Typy příkladů: kombinace, rovnice, rovnost, soucin, typ-vysledku, mocnina, polynom,
// hodnost, hodnost-parametr, inverzni, regularita.
// Inverzní matice přes adjungovanou matici patří do tématu „Determinant, adjungovaná matice“.
// Symbolické úlohy (matice s písmeny a goniometrickými funkcemi) se nepřepisují.
import { fr, frTex, toNum, gcd, gaussInt } from '../lin.js';

const TOPIC = 'matice';

// ---------- zápis do TeXu ----------
const num = (x) => (typeof x === 'object' && x !== null ? frTex(x) : String(x));
const pm = (M) => `\\begin{pmatrix}${M.map((r) => r.map(num).join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
// rozšířená matice se svislou čarou před posledními k sloupci
const augTex = (M, k) => {
  const n = M[0].length;
  return `\\left(\\begin{array}{${'c'.repeat(n - k)}|${'c'.repeat(k)}}${M.map((r) => r.map(num).join(' & ')).join(' \\\\ ')}\\end{array}\\right)`;
};
const par = (x) => (x < 0 ? `(${x})` : `${x}`);
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const RESULT = 'vysledek';
const resultLine = (pre, tex, post = '') => ({ tex: `${pre}${cls(RESULT, tex)}${post}`, notes: [{ kind: 'doubleUnderline', target: `bt-${RESULT}` }] });
const signed = (nums) => nums.map((x, i) => (i === 0 ? `${x}` : x < 0 ? `-${-x}` : `+${x}`)).join('');
const typTex = (M) => `(${M.length},\\ ${M[0].length})`;
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const minus = (s) => String(s).replace(/-/g, '−');
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

// ---------- maticové operace (celá čísla) ----------
const transpose = (M) => M[0].map((_, j) => M.map((r) => r[j]));
const mmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const scale = (M, k) => M.map((r) => r.map((v) => k * v));
const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
const maxAbs = (M) => Math.max(...M.flat().map((v) => Math.abs(v)));
const sameType = (A, B) => A.length === B.length && A[0].length === B[0].length;

// ---------- pomůcky losování ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const rnz = (rng, lo, hi) => { let v = 0; while (v === 0) v = ri(rng, lo, hi); return v; };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const rmat = (rng, m, n, lo = -3, hi = 5) => Array.from({ length: m }, () => Array.from({ length: n }, () => ri(rng, lo, hi)));
const shuffle = (rng, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- lineární kombinace matic ----------
// člen [c, jméno, T?]; skupina { k, terms }
const nameTex = (n, t) => `${n}${t ? '^{T}' : ''}`;
function linTex(terms) {
  if (!terms.length) return 'O';
  return terms.map(([k, n, t], i) => {
    const s = k < 0 ? '-' : i ? '+' : '';
    const a = Math.abs(k);
    return `${s}${a === 1 ? '' : a}${nameTex(n, t)}`;
  }).join('');
}
function groupTex(g, first) {
  if (g.terms.length === 1) {
    const [c, n, t] = g.terms[0];
    const s = linTex([[g.k * c, n, t]]);
    return first || s.startsWith('-') ? s : `+${s}`;
  }
  const inner = linTex(g.terms);
  if (g.k === 1) return first || inner.startsWith('-') ? inner : `+${inner}`;
  const a = Math.abs(g.k);
  const s = g.k < 0 ? '-' : first ? '' : '+';
  return `${s}${a === 1 ? '' : a}(${inner})`;
}
const sideTex = (groups) => (groups.length ? groups.map((g, i) => groupTex(g, i === 0)).join('') : 'O');
const expand = (groups) => groups.flatMap((g) => g.terms.map(([c, n, t]) => (t ? [g.k * c, n, 1] : [g.k * c, n])));
function collect(terms) {
  const out = [];
  for (const [k, n, t] of terms) {
    const e = out.find((x) => x[1] === n && !!x[2] === !!t);
    if (e) e[0] += k; else out.push(t ? [k, n, 1] : [k, n]);
  }
  return out.filter(([k]) => k !== 0);
}
const needsExpand = (groups) => groups.some((g) => g.terms.length > 1 || g.k !== 1)
  || collect(expand(groups)).length !== expand(groups).length;

// Výpočet c1·M1 + c2·M2 + … po prvcích. terms sebrané. -> { steps, sum }
function comboSteps(mats, terms, { lhs, finish = true } = {}) {
  const steps = [];
  const get = ([, n, t]) => (t ? transpose(mats[n]) : mats[n]);
  const trans = terms.filter((x) => x[2]);
  if (trans.length) {
    steps.push({
      title: 'Transpozice',
      text: 'Transponovanou matici dostaneme tak, že řádky zapíšeme jako sloupce: první řádek se stane prvním sloupcem atd. Z matice typu $(m,\\ n)$ vznikne matice typu $(n,\\ m)$.',
      board: trans.map((x) => ({ tex: `${nameTex(x[1], 1)}=${pm(get(x))}` })),
    });
  }
  const Ms = terms.map(get);
  const scaled = terms.map(([k], i) => scale(Ms[i], k));
  const sum = scaled.reduce((acc, M) => acc.map((r, i) => r.map((v, j) => v + M[i][j])));
  const end = (tex) => (finish ? resultLine(`${lhs}=`, tex) : { tex: `${lhs}=${tex}` });
  if (terms.length === 1 && terms[0][0] === 1) {
    steps.push({ title: finish ? 'Výsledek' : 'Dosazení', text: 'Za písmeno dosadíme matici.', board: [end(pm(sum))] });
    return { steps, sum };
  }
  steps.push({
    title: 'Dosazení matic',
    text: 'Za každé písmeno dosadíme matici. Číslo před maticí zatím jen opíšeme.',
    board: terms.map(([k], i) => {
      const a = Math.abs(k);
      const s = k < 0 ? '-' : i ? '+' : '';
      return { tex: `${i === 0 ? `${lhs}=` : '\\quad '}${s}${a === 1 ? '' : `${a}\\cdot `}${pm(Ms[i])}` };
    }),
  });
  if (terms.length === 1) {
    steps.push({ title: finish ? 'Násobek a výsledek' : 'Násobek matice', text: 'Číslem vynásobíme každý prvek matice.', board: [end(pm(sum))] });
    return { steps, sum };
  }
  if (terms.some(([k]) => k !== 1)) {
    steps.push({
      title: 'Násobky matic',
      text: 'Každý prvek matice vynásobíme číslem, které stojí před ní. Minus před maticí znamená násobení číslem $-1$ – změní se znaménka všech prvků.',
      board: scaled.map((M, i) => ({ tex: `${i === 0 ? '=' : '\\quad +'}${pm(M)}` })),
    });
  }
  const entries = sum.map((r, i) => r.map((_, j) => signed(scaled.map((M) => M[i][j]))));
  steps.push({
    title: 'Sečtení po prvcích',
    text: 'Sčítáme prvky na stejných pozicích: prvek v 1. řádku a 1. sloupci s prvkem v 1. řádku a 1. sloupci atd.',
    board: [{ tex: `=${pm(entries)}` }],
  });
  steps.push({
    title: finish ? 'Výsledek' : 'Matice v závorce',
    text: 'Spočítáme každý prvek. Výsledek je matice stejného typu jako sčítané matice.',
    board: [end(pm(sum))],
  });
  return { steps, sum };
}

// =====================================================================
// Typ 1: lineární kombinace matic (součet, násobek, transpozice)
// data = { mats: {A, B, C?}, expr: groups, target?: 'D' }
function solveKombinace(data) {
  const { mats, expr } = data;
  const terms = collect(expand(expr));
  for (const [, n, t] of terms) {
    const M = t ? transpose(mats[n]) : mats[n];
    const first = terms[0][2] ? transpose(mats[terms[0][1]]) : mats[terms[0][1]];
    if (!sameType(M, first)) throw new Error('kombinace: matice nejsou stejného typu');
  }
  const target = data.target || 'D';
  const steps = [];
  const exprT = sideTex(expr);
  if (needsExpand(expr)) {
    const raw = expand(expr);
    const lines = [{ tex: `${target}=${exprT}` }, { tex: `=${linTex(raw)}` }];
    const collected = linTex(terms);
    if (collected !== linTex(raw)) lines.push({ tex: `=${cls('sebrano', collected)}`, notes: [{ kind: 'underline', target: 'bt-sebrano', label: 'sečteno' }] });
    steps.push({
      title: 'Roznásobení závorek',
      text: 'Nejdřív upravíme výraz jako v algebře: roznásobíme závorky (pozor na minus před závorkou) a sečteme členy se stejnou maticí. Čísla dosadíme až potom.',
      board: lines,
    });
  }
  const c = comboSteps(mats, terms, { lhs: target });
  steps.push(...c.steps);
  if (steps.length < 3) steps.unshift({ title: 'Zadání', text: 'Sčítat a odčítat jde jen matice stejného typu; tady jsou všechny stejného typu.', board: [{ tex: `${target}=${exprT}` }] });
  const names = Object.keys(mats);
  return {
    id: idOf('kombinace', data), topic: TOPIC, type: 'kombinace', data,
    task: `Urči matici $${target}=${exprT}$. Prvky zapiš do mřížky.`,
    promptTex: `\\begin{gathered}${names.map((n) => `${n}=${pm(mats[n])}`).join('\\\\ ')}\\end{gathered}`,
    answerSpec: { kind: 'matrix', value: c.sum },
    answerTex: pm(c.sum),
    solution: steps,
  };
}
function genKombinace(rng) {
  for (;;) {
    const [m, n] = pick(rng, [[2, 2], [2, 3], [3, 2], [3, 3], [2, 2]]);
    const three = rng() < 0.6;
    const names = three ? ['A', 'B', 'C'] : ['A', 'B'];
    const useT = m !== n && rng() < 0.35;
    const mats = {};
    for (const nm of names) mats[nm] = rmat(rng, m, n, -4, 6);
    let expr;
    if (useT) {
      mats.B = rmat(rng, n, m, -4, 6);
      expr = [{ k: 1, terms: [[rnz(rng, -2, 3), 'A']] }, { k: 1, terms: [[rnz(rng, -3, 3), 'B', 1]] }];
      if (three) expr.push({ k: 1, terms: [[rnz(rng, -2, 2), 'C']] });
    } else if (rng() < 0.5) {
      expr = names.map((nm) => ({ k: 1, terms: [[rnz(rng, -3, 3), nm]] }));
    } else {
      expr = [
        { k: 1, terms: [[rnz(rng, -2, 2), 'A']] },
        { k: pick(rng, [2, 3, -2, -1]), terms: [[1, 'B'], [rnz(rng, -3, 3), three ? 'C' : 'A']] },
      ];
    }
    if (collect(expand(expr)).length < 2) continue;
    const p = solveKombinace({ mats, expr });
    if (maxAbs(p.answerSpec.value) > 40) continue;
    return p;
  }
}

// =====================================================================
// Typ 2: maticová rovnice s neznámou maticí X
// data = { mats: {A, B}, left: groups, right: groups }   (neznámá 'X')
function solveRovnice(data) {
  const { mats, left, right } = data;
  const L = expand(left); const R = expand(right);
  const xc = (T) => T.filter((t) => t[1] === 'X').reduce((s, t) => s + t[0], 0);
  const dx = xc(L) - xc(R);
  if (dx === 0) throw new Error('rovnice: X se vyruší');
  const rhs = collect([...R.filter((t) => t[1] !== 'X'), ...L.filter((t) => t[1] !== 'X').map(([k, n, t]) => (t ? [-k, n, 1] : [-k, n]))]);
  if (!rhs.length) throw new Error('rovnice: pravá strana je nulová');
  const eq = `${sideTex(left)}=${sideTex(right)}`;
  const expanded = `${linTex(L)}=${linTex(R)}`;
  const steps = [{
    title: eq === expanded ? 'Zápis rovnice' : 'Roznásobení závorek',
    text: 'S maticovou rovnicí zacházíme jako s lineární rovnicí s jednou neznámou: nejdřív upravíme písmena, čísla dosadíme až nakonec.',
    board: [{ tex: eq }, ...(eq === expanded ? [] : [{ tex: expanded }])],
  }];
  const xTerm = `${dx === 1 ? '' : dx === -1 ? '-' : dx}X`;
  steps.push({
    title: 'Neznámou na jednu stranu',
    text: `Členy s $X$ převedeme na levou stranu, ostatní na pravou (při převodu se mění znaménko). Na levé straně zbude $${xTerm}$.`,
    board: [{ tex: `${cls('x', xTerm)}=${linTex(rhs)}`, notes: [{ kind: 'brace', target: 'bt-x', label: 'X dohromady' }] }],
  });
  let res;
  if (dx === 1 || dx === -1) {
    const terms = rhs.map(([k, n, t]) => (t ? [k * dx, n, 1] : [k * dx, n]));
    if (dx === -1) steps[1].board.push({ tex: `X=${linTex(terms)}` });
    if (dx === -1) steps[1].text += ' Celou rovnici vynásobíme číslem $-1$.';
    const c = comboSteps(mats, terms, { lhs: 'X' });
    steps.push(...c.steps);
    res = c.sum.map((r) => r.map((v) => fr(v)));
  } else {
    const inner = linTex(rhs);
    const pre = `${dx < 0 ? '-' : ''}\\frac{1}{${Math.abs(dx)}}`;
    steps.push({
      title: 'Vyjádření neznámé',
      text: `Obě strany vydělíme číslem $${dx}$, tedy vynásobíme číslem $${pre}$. Maticí dělit nejde, číslem ano. Matici v závorce si označíme $S$ a spočítáme ji zvlášť.`,
      board: [{ tex: `X=${pre}(${inner})` }, { tex: `S=${inner}` }],
    });
    const c = comboSteps(mats, rhs, { lhs: 'S', finish: false });
    steps.push(...c.steps);
    res = c.sum.map((r) => r.map((v) => fr(v, dx)));
    steps.push({
      title: 'Vydělení a výsledek',
      text: `Každý prvek matice $S$ vydělíme číslem $${dx}$ a zlomky zkrátíme (minus píšeme do čitatele).`,
      board: [{ tex: `X=${pre}\\cdot ${pm(c.sum)}` }, resultLine('=', pm(res))],
    });
  }
  const names = Object.keys(mats);
  return {
    id: idOf('rovnice', data), topic: TOPIC, type: 'rovnice', data,
    task: `Urči matici $X$, pro kterou platí $${eq}$. Prvky zapiš do mřížky, zlomky jako 3/4.`,
    promptTex: `\\begin{gathered}${names.map((n) => `${n}=${pm(mats[n])}`).join('\\\\ ')}\\end{gathered}`,
    answerSpec: { kind: 'matrix', value: res.map((r) => r.map(toNum)) },
    answerTex: pm(res),
    solution: steps,
  };
}
function genRovnice(rng) {
  for (;;) {
    const n = pick(rng, [2, 2, 3]);
    const A = rmat(rng, n, n, -3, 5); const B = rmat(rng, n, n, -3, 5);
    // p·A + s1·X = k(s2·X + q·B)
    const p = rnz(rng, -3, 3); const s1 = pick(rng, [1, -1, 2, -2]);
    const k = pick(rng, [1, 2, 3, -1, -2]); const s2 = pick(rng, [1, -1]); const q = pick(rng, [1, -1, 2]);
    const left = [{ k: 1, terms: [[p, 'A']] }, { k: 1, terms: [[s1, 'X']] }];
    const right = [{ k, terms: [[s2, 'X'], [q, 'B']] }];
    const dx = s1 - k * s2;
    if (dx === 0 || Math.abs(dx) > 5) continue;
    if (k === -1 && s2 === -1) continue; // umělé −(−X + …)
    const pr = solveRovnice({ mats: { A, B }, left, right });
    const frac = pr.answerSpec.value.flat().some((v) => !Number.isInteger(v));
    if (frac && rng() < 0.5) continue; // zlomky ano, ale ne vždy
    if (maxAbs(pr.answerSpec.value) > 30) continue;
    return pr;
  }
}

// =====================================================================
// Typ 3: rovnost matic s neznámými prvky
// data = { vars: ['x', …], left: [{ k, M }], right: [{ k, M }] }, prvky M jsou čísla nebo
// lineární výrazy jako '2x+5y', 'u-10', '10-v'.
function parseLin(s) {
  const str = String(s).replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (!/^[+-]?(\d*[a-z]|\d+)([+-](\d*[a-z]|\d+))*$/.test(str)) throw new Error(`rovnost: nečitelný prvek ${s}`);
  const e = { c: 0, v: {} };
  for (const t of str.match(/[+-]?[^+-]+/g)) {
    const m = /^([+-]?)(\d*)([a-z]?)$/.exec(t);
    const sg = m[1] === '-' ? -1 : 1;
    if (m[3]) e.v[m[3]] = (e.v[m[3]] || 0) + sg * (m[2] ? Number(m[2]) : 1);
    else e.c += sg * Number(m[2]);
  }
  return e;
}
const linS = (e, k) => ({ c: e.c * k, v: Object.fromEntries(Object.entries(e.v).map(([x, a]) => [x, a * k])) });
const linAdd = (a, b) => {
  const v = { ...a.v };
  for (const [x, k] of Object.entries(b.v)) v[x] = (v[x] || 0) + k;
  return { c: a.c + b.c, v };
};
// TeX lineárního výrazu: proměnné v pořadí vars, konstanta na konci
function linExprTex(e, vars) {
  const parts = [];
  for (const x of vars) {
    const a = e.v[x] || 0;
    if (!a) continue;
    const abs = Math.abs(a);
    parts.push(`${a < 0 ? '-' : parts.length ? '+' : ''}${abs === 1 ? '' : abs}${x}`);
  }
  if (e.c || !parts.length) parts.push(parts.length ? (e.c < 0 ? `-${-e.c}` : `+${e.c}`) : String(e.c));
  return parts.join('');
}
const rawTex = (s) => String(s).replace(/-/g, '-');
function sideOf(groups) {
  const parsed = groups.map((g) => ({ k: g.k, M: g.M.map((r) => r.map(parseLin)) }));
  return parsed.map((g) => g.M.map((r) => r.map((e) => linS(e, g.k)))).reduce((a, b) => a.map((r, i) => r.map((e, j) => linAdd(e, b[i][j]))));
}
const groupsTex = (groups) => groups.map((g, i) => {
  const a = Math.abs(g.k);
  const s = g.k < 0 ? '-' : i ? '+' : '';
  return `${s}${a === 1 ? '' : a}${pm(g.M.map((r) => r.map(rawTex)))}`;
}).join('');
const frVal = (f) => (f.d === 1 ? String(f.n) : frTex(f));
function solveRovnost(data) {
  const { vars, left, right } = data;
  const L = sideOf(left); const R = sideOf(right);
  const steps = [];
  const simple = (groups) => groups.length === 1 && groups[0].k === 1;
  for (const [side, groups, M, acc] of [['Levá', left, L, 'Levou'], ['Pravá', right, R, 'Pravou']]) {
    if (simple(groups)) continue;
    // každá matice na vlastním řádku (telefon)
    const lines = groups.map((g, i) => ({ tex: `${i ? '\\quad ' : ''}${groupsTex([g]).replace(/^(?=[^-])/, i ? '+' : '')}` }));
    if (groups.some((g) => g.k !== 1)) {
      groups.forEach((g, i) => lines.push({ tex: `${i ? '\\quad +' : '='}${pm(g.M.map((r) => r.map((e) => linExprTex(linS(parseLin(e), g.k), vars))))}` }));
    }
    lines.push({ tex: `=${pm(M.map((r) => r.map((e) => linExprTex(e, vars))))}` });
    steps.push({
      title: `${side} strana`,
      text: `${acc} stranu upravíme na jedinou matici: čísla před maticemi vynásobíme do všech prvků a matice sečteme po prvcích.`,
      board: lines,
    });
  }
  // rovnice prvků: Σ a·var = b
  const eqs = [];
  L.forEach((r, i) => r.forEach((e, j) => {
    const d = linAdd(e, linS(R[i][j], -1));
    eqs.push({ i, j, orig: `${linExprTex(e, vars)}=${linExprTex(R[i][j], vars)}`, a: d.v, b: -d.c, eL: e, eR: R[i][j] });
  }));
  steps.push({
    title: 'Rovnost prvků',
    text: 'Dvě matice se rovnají, právě když se rovnají prvky na stejných pozicích. Z každé pozice dostaneme jednu rovnici.',
    board: eqs.map((q) => ({ tex: q.orig })),
  });
  const known = {};
  const left0 = (q) => vars.filter((x) => (q.a[x] || 0) !== 0 && !(x in known));
  const done = new Set();
  for (let round = 0; round < eqs.length + 1; round++) {
    const q = eqs.find((e, idx) => !done.has(idx) && left0(e).length === 1);
    if (!q) break;
    done.add(eqs.indexOf(q));
    const x = left0(q)[0];
    const lines = [{ tex: q.orig }];
    // neznámé převedeme na tu stranu, kde má hledaná neznámá kladný koeficient (3x = 9, ne −3x = −9)
    const sg = q.a[x] < 0 ? -1 : 1;
    const qa = Object.fromEntries(Object.entries(q.a).map(([y, a]) => [y, sg * a]));
    const qb = sg * q.b;
    const normal = `${linExprTex({ c: 0, v: qa }, vars)}=${qb}`;
    if (normal !== q.orig) lines.push({ tex: normal });
    const others = vars.filter((y) => y !== x && (qa[y] || 0) !== 0);
    let rhs = fr(qb);
    if (others.length) {
      const ax = qa[x];
      const lead = `${ax === 1 ? '' : ax}${x}`;
      const sub = others.map((y) => {
        const a = qa[y]; const v = known[y];
        const vt = v.n < 0 || v.d !== 1 ? `\\left(${frVal(v)}\\right)` : frVal(v);
        return `${a < 0 ? '-' : '+'}${Math.abs(a) === 1 ? '' : `${Math.abs(a)}\\cdot `}${vt}`;
      }).join('');
      lines.push({ tex: `${lead}${sub}=${qb}` });
      for (const y of others) rhs = fr(rhs.n * known[y].d - qa[y] * known[y].n * rhs.d, rhs.d * known[y].d);
      lines.push({ tex: `${lead}=${frVal(rhs)}` });
    }
    known[x] = fr(rhs.n, rhs.d * qa[x]);
    const fin = `${x}=${frVal(known[x])}`;
    if (lines[lines.length - 1].tex !== fin) lines.push({ tex: fin });
    steps.push({
      title: `Neznámá ${x}`,
      text: others.length
        ? `V rovnici z pozice (${q.i + 1}, ${q.j + 1}) už známe ${others.map((y) => `$${y}$`).join(', ')}, dosadíme a vypočítáme $${x}$.`
        : `Rovnice z pozice (${q.i + 1}, ${q.j + 1}) obsahuje jen neznámou $${x}$: převedeme ji na jednu stranu a vydělíme koeficientem.`,
      board: lines,
    });
  }
  if (vars.some((x) => !(x in known))) throw new Error('rovnost: neznámé nejdou určit postupně');
  const val = (e) => vars.reduce((s, x) => {
    const a = e.a[x] || 0; const v = known[x];
    return fr(s.n * v.d + a * v.n * s.d, s.d * v.d);
  }, fr(0));
  const rest = eqs.filter((_, idx) => !done.has(idx));
  const checks = [];
  for (const q of rest) {
    const v = val(q);
    if (v.n * 1 !== q.b * v.d) throw new Error('rovnost: rovnice si odporují');
    // dosazení do obou stran původní rovnice
    const sub = (e) => {
      const parts = [];
      for (const x of vars) {
        const a = e.v[x] || 0;
        if (!a) continue;
        const kv = known[x];
        const vt = kv.n < 0 || kv.d !== 1 ? `\\left(${frVal(kv)}\\right)` : frVal(kv);
        parts.push(`${a < 0 ? '-' : parts.length ? '+' : ''}${Math.abs(a) === 1 ? '' : `${Math.abs(a)}\\cdot `}${vt}`);
      }
      if (e.c || !parts.length) parts.push(parts.length ? (e.c < 0 ? `-${-e.c}` : `+${e.c}`) : String(e.c));
      return parts.join('');
    };
    const ev = (e) => vars.reduce((s, x) => {
      const kv = known[x]; const a = e.v[x] || 0;
      return fr(s.n * kv.d + a * kv.n * s.d, s.d * kv.d);
    }, fr(e.c));
    checks.push({ tex: `(${q.i + 1},${q.j + 1}):\\ ${sub(q.eL)}=${sub(q.eR)}` });
    checks.push({ tex: `\\quad ${frVal(ev(q.eL))}=${frVal(ev(q.eR))}\\ \\checkmark` });
  }
  const tuple = `(${vars.join(',')})`;
  const resT = `(${vars.map((x) => frVal(known[x])).join(',\\ ')})`;
  steps.push({
    title: 'Ověření a výsledek',
    text: rest.length
      ? 'Zbylé rovnice už neznámou nemají navíc – dosadíme do nich nalezené hodnoty a ověříme, že platí. Kdyby některá neplatila, rovnost by nešla splnit.'
      : 'Všechny rovnice jsme použili, nalezené hodnoty zapíšeme dohromady.',
    board: [...checks, ...(vars.length > 3 ? [{ tex: tuple }, resultLine('=', resT)] : [resultLine(`${tuple}=`, resT)])],
  });
  return {
    id: idOf('rovnost', data), topic: TOPIC, type: 'rovnost', data,
    task: `Urči čísla $${vars.join(',\\ ')}$ tak, aby platila rovnost matic. Výsledek zapiš do polí v pořadí $${vars.join(',\\ ')}$, zlomky jako 2/5.`,
    promptTex: `${groupsTex(left)}=${groupsTex(right)}`,
    answerSpec: { kind: 'vector', value: vars.map((x) => toNum(known[x])) },
    answerTex: `${tuple}=${resT}`,
    solution: steps,
  };
}
const affStr = (e) => {
  const parts = [];
  for (const [x, a] of Object.entries(e.v)) {
    if (!a) continue;
    parts.push(`${a < 0 ? '-' : parts.length ? '+' : ''}${Math.abs(a) === 1 ? '' : Math.abs(a)}${x}`);
  }
  if (e.c || !parts.length) parts.push(parts.length ? (e.c < 0 ? `-${-e.c}` : `+${e.c}`) : String(e.c));
  return parts.join('');
};
function genRovnost(rng) {
  for (;;) {
    const vars = rng() < 0.5 ? ['x', 'y', 'u'] : ['x', 'y', 'u', 'v'];
    const two = rng() < 0.5; // levá strana k1·P + k2·Q
    const k1 = two ? pick(rng, [2, 3, -2]) : 1; const k2 = two ? pick(rng, [-1, -2, 2, 3]) : 0;
    const vals = Object.fromEntries(vars.map((x) => [x, rng() < 0.15 ? 0 : rnz(rng, -5, 5)]));
    const pos = shuffle(rng, [[0, 0], [0, 1], [1, 0], [1, 1]]);
    const P = [[0, 0], [0, 0]].map((r) => r.map(() => ({ c: ri(rng, -4, 6), v: {} })));
    const Q = [[0, 0], [0, 0]].map((r) => r.map(() => ({ c: ri(rng, -4, 6), v: {} })));
    const Rr = [[0, 0], [0, 0]].map((r) => r.map(() => ({ c: 0, v: {} })));
    vars.forEach((x, idx) => {
      const [i, j] = pos[idx];
      const slot = pick(rng, two ? ['P', 'Q', 'R'] : ['P', 'PR', 'R']);
      if (slot === 'P' || slot === 'PR') P[i][j].v[x] = pick(rng, [1, 2, -1, 3]);
      if (slot === 'Q') Q[i][j].v[x] = pick(rng, [1, -1, 2]);
      if (slot === 'R' || slot === 'PR') Rr[i][j].v[x] = pick(rng, [1, -1, 3, 4]);
    });
    // 3 neznámé: volná pozice ověřuje některou neznámou
    if (vars.length === 3) { const [i, j] = pos[3]; P[i][j].v[pick(rng, vars)] = pick(rng, [1, 2]); }
    // občas druhá (už známá) neznámá v rovnici
    if (!two && rng() < 0.5) { const [i, j] = pos[0]; const y = vars[vars.length - 1]; if (!P[i][j].v[y]) P[i][j].v[y] = pick(rng, [2, 3, 5]); }
    const ev = (e) => e.c + Object.entries(e.v).reduce((s, [x, a]) => s + a * vals[x], 0);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const Lv = ev(P[i][j]) * k1 + (two ? ev(Q[i][j]) * k2 : 0);
      const Rv = Object.entries(Rr[i][j].v).reduce((s, [x, a]) => s + a * vals[x], 0);
      Rr[i][j].c = Lv - Rv;
    }
    const toS = (M) => M.map((r) => r.map(affStr));
    const left = two ? [{ k: k1, M: toS(P) }, { k: k2, M: toS(Q) }] : [{ k: 1, M: toS(P) }];
    const data = { vars, left, right: [{ k: 1, M: toS(Rr) }] };
    let p;
    try { p = solveRovnost(data); } catch { continue; }
    const eqLines = p.solution.find((s) => s.title === 'Rovnost prvků').board.map((l) => l.tex);
    if (new Set(eqLines).size !== eqLines.length) continue; // dvě stejné rovnice
    if (p.solution.length < 3 || Rr.flat().some((e) => Math.abs(e.c) > 30)) continue;
    return p;
  }
}

// =====================================================================
// Součin matic: řádek krát sloupec
// -> { steps, C } ; lname/rname = TeX názvy činitelů, resName = TeX výsledku
function productLines(L, R, letter = 'c') {
  return L.map((row, i) => R[0].map((_, j) => {
    const prods = row.map((v, k) => `${par(v)}\\cdot ${par(R[k][j])}`);
    const val = row.reduce((s, v, k) => s + v * R[k][j], 0);
    const head = `${letter}_{${i + 1}${j + 1}}=`;
    const chunks = [];
    for (let q = 0; q < prods.length; q += 2) chunks.push(prods.slice(q, q + 2).join('+'));
    const lines = chunks.map((ch, q) => ({ tex: q === 0 ? `${head}${i === 0 && j === 0 ? cls('rs', ch) : ch}` : `\\quad +${ch}` }));
    if (i === 0 && j === 0) lines[0].notes = [{ kind: 'brace', target: 'bt-rs', label: '1. řádek · 1. sloupec', position: 'below' }];
    // výsledek prvku na samostatný řádek, když by byl řádek na telefonu moc dlouhý
    const plain = (s) => s.replace(/\\htmlClass\{[^}]*\}/g, '').replace(/\\cdot/g, '·').replace(/\\quad/g, '  ').replace(/[{}\s_]/g, '');
    const lastLine = lines[lines.length - 1];
    if (plain(lastLine.tex).length + String(val).length + 1 > 21) lines.push({ tex: `\\quad =${val}` });
    else lastLine.tex += `=${val}`;
    return lines;
  }));
}
function productSteps(L, R, { lname, rname, resName, finish = true, types = true, letter = 'c' }) {
  const C = mmul(L, R);
  const steps = [];
  if (types) {
    steps.push({
      title: 'Typy matic',
      text: `Součin $${lname}\\cdot ${rname}$ je definován, protože první matice má tolik sloupců, kolik má druhá matice řádků (${L[0].length}). Výsledek má tolik řádků jako první matice a tolik sloupců jako druhá.`,
      board: [
        { tex: `${lname}\\ ${typTex(L)},\\quad ${rname}\\ ${typTex(R)}` },
        { tex: `${lname}\\cdot ${rname}\\ (${L.length},\\ ${R[0].length})` },
      ],
    });
  }
  const lines = productLines(L, R, letter);
  const perRow = L.length >= 3 || R[0].length >= 3;
  const text0 = `Prvek v $i$-tém řádku a $j$-tém sloupci výsledku je skalární součin $i$-tého řádku matice $${lname}$ a $j$-tého sloupce matice $${rname}$: vynásobíme odpovídající si čísla a součiny sečteme.`;
  if (perRow) {
    lines.forEach((rowLines, i) => steps.push({
      title: `${i + 1}. řádek výsledku`,
      text: i === 0 ? `${text0} Na obrázku je zvýrazněný řádek, se kterým právě počítáme.` : `${i + 1}. řádek matice $${lname}$ násobíme postupně všemi sloupci matice $${rname}$.`,
      board: rowLines.flat(),
      viz: { kind: 'matrix', data: { rows: L.map((r) => r.map(minus)), highlight: { rows: [i] }, caption: `${i + 1}. řádek matice ${lname.replace(/[\\{}^]/g, '').replace('cdot', '·')}`, alt: `${i + 1}. řádek první matice` } },
    }));
  } else {
    steps.push({ title: 'Řádek krát sloupec', text: text0, board: lines.flat().flat() });
  }
  steps.push({
    title: finish ? 'Výsledek' : 'Mezivýsledek',
    text: 'Vypočítané prvky zapíšeme na jejich místa do výsledné matice.',
    board: [finish ? resultLine(`${resName}=`, pm(C)) : { tex: `${resName}=${pm(C)}` }],
  });
  return { steps, C };
}

// =====================================================================
// Typ 4: součin matic (2 nebo 3 činitelé, případně + k·C nebo k·Cᵀ)
// data = { mats: {A, B, C?}, factors: ['A', 'B'(, 'C')], add?: { k, name, t? } }
function solveSoucin(data) {
  const { mats, factors } = data;
  const steps = [];
  let P = mats[factors[0]];
  let pname = factors[0];
  for (let f = 1; f < factors.length; f++) {
    const R = mats[factors[f]];
    if (P[0].length !== R.length) throw new Error('součin: není definován');
    const last = f === factors.length - 1 && !data.add;
    const resName = last ? factors.join('\\cdot ') : f === 1 && factors.length > 2 ? 'D' : `${pname}\\cdot ${factors[f]}`;
    const r = productSteps(P, R, { lname: pname, rname: factors[f], resName, finish: last, letter: f === 1 && factors.length > 2 ? 'd' : 'c' });
    steps.push(...r.steps);
    P = r.C; pname = resName;
  }
  if (factors.length > 2) {
    steps[0].text += ' Násobení matic je asociativní, ale ne komutativní: můžeme nejdřív spočítat $D = ' + `${factors[0]}\\cdot ${factors[1]}$` + ', pořadí matic ale měnit nesmíme.';
    steps[0].board.push({ tex: `${factors.join('\\cdot ')}=(${factors[0]}\\cdot ${factors[1]})\\cdot ${factors[2]}=D\\cdot ${factors[2]}` });
  }
  let res = P;
  const expr = `${factors.join('\\cdot ')}${data.add ? linTex([[data.add.k, data.add.name, data.add.t]]).replace(/^(?=[^-])/, '+') : ''}`;
  if (data.add) {
    const { k, name, t } = data.add;
    const M = t ? transpose(mats[name]) : mats[name];
    if (!sameType(M, P)) throw new Error('součin: sčítané matice nejsou stejného typu');
    const add = scale(M, k);
    res = P.map((r, i) => r.map((v, j) => v + add[i][j]));
    const ab = Math.abs(k);
    steps.push({
      title: t ? 'Transpozice a násobek' : 'Násobek matice',
      text: t ? `Matici $${name}$ transponujeme (řádky zapíšeme jako sloupce) a každý prvek vynásobíme číslem $${k}$.` : `Každý prvek matice $${name}$ vynásobíme číslem $${k}$.`,
      board: [...(t ? [{ tex: `${name}^{T}=${pm(M)}` }] : []), { tex: `${k < 0 ? '-' : ''}${ab === 1 ? '' : ab}${nameTex(name, t)}=${pm(add)}` }],
    });
    steps.push({
      title: 'Sečtení a výsledek',
      text: 'Obě matice jsou stejného typu, sečteme je po prvcích.',
      board: [{ tex: `${expr}=` }, { tex: `\\quad ${pm(P)}` }, { tex: `\\quad +${pm(add)}` }, { tex: `=${pm(P.map((r, i) => r.map((v, j) => signed([v, add[i][j]]))))}` }, resultLine('=', pm(res))],
    });
  }
  return {
    id: idOf('soucin', data), topic: TOPIC, type: 'soucin', data,
    task: `Vypočítej $${expr}$. Prvky zapiš do mřížky.`,
    promptTex: `\\begin{gathered}${Object.keys(mats).map((n) => `${n}=${pm(mats[n])}`).join('\\\\ ')}\\end{gathered}`,
    answerSpec: { kind: 'matrix', value: res },
    answerTex: pm(res),
    solution: steps,
  };
}
function genSoucin(rng) {
  for (;;) {
    const r = rng();
    let data;
    if (r < 0.65) {
      const [m, n, p] = pick(rng, [[2, 3, 2], [3, 3, 3], [2, 2, 3], [3, 2, 3], [2, 2, 2], [3, 2, 2], [2, 3, 3], [1, 3, 2]]);
      data = { mats: { A: rmat(rng, m, n, -3, 4), B: rmat(rng, n, p, -3, 4) }, factors: ['A', 'B'] };
    } else if (r < 0.82) {
      data = { mats: { A: rmat(rng, 2, 2, -2, 3), B: rmat(rng, 2, 2, -2, 3), C: rmat(rng, 2, 2, -2, 3) }, factors: ['A', 'B', 'C'] };
    } else {
      const [m, n] = pick(rng, [[2, 3], [2, 2], [3, 2]]);
      const t = rng() < 0.6;
      data = {
        mats: { A: rmat(rng, m, n, -3, 4), B: rmat(rng, n, m, -3, 4), C: rmat(rng, m, m, -3, 4) },
        factors: ['A', 'B'], add: { k: pick(rng, [-3, -2, 2, 3, -1]), name: 'C', ...(t ? { t: 1 } : {}) },
      };
    }
    const flat = Object.values(data.mats).flat(2);
    if (flat.filter((v) => v === 0).length > flat.length / 3) continue;
    const p = solveSoucin(data);
    if (maxAbs(p.answerSpec.value) > 60 || p.answerSpec.value.flat().every((v) => v === 0)) continue;
    return p;
  }
}

// =====================================================================
// Typ 5: je výraz definován? Typ výsledku
// data = { l, r, lt?, rt?, op: 'mul' | 'add' } (l = matice A, r = matice B)
function solveTyp(data) {
  const A = data.l; const B = data.r;
  const L = data.lt ? transpose(A) : A; const R = data.rt ? transpose(B) : B;
  // names: jak se matice v zadání jmenují (výchozí l = A, r = B)
  const [na, nb] = Array.isArray(data.names) ? data.names : ['A', 'B'];
  const ln = nameTex(na, data.lt); const rn = nameTex(nb, data.rt);
  const expr = data.op === 'mul' ? `${ln}\\cdot ${rn}` : `${ln}+${rn}`;
  const steps = [{
    title: 'Typy matic',
    text: 'Typ matice je dvojice (počet řádků, počet sloupců). Spočítáme řádky a sloupce obou matic.',
    board: [{ tex: `${na}\\ \\text{je typu}\\ ${typTex(A)}` }, { tex: `${nb}\\ \\text{je typu}\\ ${typTex(B)}` }],
  }];
  if (data.lt || data.rt) {
    steps.push({
      title: 'Typ transponované matice',
      text: 'Transpozicí se řádky stanou sloupci, takže se počty řádků a sloupců prohodí.',
      board: [...(data.lt ? [{ tex: `${na}^{T}\\ \\text{je typu}\\ ${typTex(L)}` }] : []), ...(data.rt ? [{ tex: `${nb}^{T}\\ \\text{je typu}\\ ${typTex(R)}` }] : [])],
    });
  }
  let ok; let res; let cond;
  if (data.op === 'mul') {
    ok = L[0].length === R.length;
    cond = {
      title: 'Podmínka pro součin',
      text: `Součin je definován, jen když má první matice tolik sloupců, kolik má druhá matice řádků. Tady má $${ln}$ ${plural(L[0].length, 'sloupec', 'sloupce', 'sloupců')} a $${rn}$ ${plural(R.length, 'řádek', 'řádky', 'řádků')}.`,
      board: [{ tex: `${typTex(L)}\\cdot ${typTex(R)}` }, { tex: `${L[0].length}${ok ? '=' : '\\neq '}${R.length}` }],
    };
    res = [L.length, R[0].length];
  } else {
    ok = sameType(L, R);
    cond = {
      title: 'Podmínka pro součet',
      text: 'Sčítat jde jen matice stejného typu – musí mít stejný počet řádků i stejný počet sloupců.',
      board: [{ tex: `${typTex(L)}${ok ? '=' : '\\neq '}${typTex(R)}` }],
    };
    res = [L.length, L[0].length];
  }
  steps.push(cond);
  const answerTex = ok ? `(${res[0]},\\ ${res[1]})` : '\\text{není definován}';
  steps.push({
    title: 'Závěr',
    text: ok
      ? (data.op === 'mul' ? 'Podmínka je splněná. Výsledek má tolik řádků jako první matice a tolik sloupců jako druhá.' : 'Matice jsou stejného typu, součet je matice téhož typu.')
      : 'Podmínka splněná není, takže výraz nemá smysl – výsledná matice neexistuje.',
    board: [resultLine(`${expr}:\\ `, answerTex)],
  });
  return {
    id: idOf('typ-vysledku', data), topic: TOPIC, type: 'typ-vysledku', data,
    task: `Je výraz $${expr}$ definován? Pokud ano, zapiš typ výsledné matice jako (počet řádků; počet sloupců), např. (4; 1). Pokud definován není, napiš „neexistuje“.`,
    promptTex: na < nb ? `${na}=${pm(A)},\\quad ${nb}=${pm(B)}` : `${nb}=${pm(B)},\\quad ${na}=${pm(A)}`,
    answerSpec: { kind: 'system', value: ok ? res : 'none' },
    answerTex,
    conclusion: ok ? `Výsledkem je matice typu (${res[0]}, ${res[1]}).` : 'Výraz není definován.',
    solution: steps,
  };
}
function genTyp(rng) {
  const dims = [1, 2, 3, 4];
  const wantDef = rng() < 0.5; // půl na půl definované a nedefinované
  for (;;) {
    const m = pick(rng, dims); const n = pick(rng, dims); const p = pick(rng, dims); const q = pick(rng, dims);
    if (m * n === 1 || p * q === 1) continue;
    const data = { l: rmat(rng, m, n, -3, 5), r: rmat(rng, p, q, -3, 5), op: rng() < 0.7 ? 'mul' : 'add' };
    if (rng() < 0.3) data[pick(rng, ['lt', 'rt'])] = 1;
    const pr = solveTyp(data);
    const def = pr.answerSpec.value !== 'none';
    if (def !== wantDef) continue;
    return pr;
  }
}

// =====================================================================
// Typ 6: mocnina matice A², A³
function solveMocnina(data) {
  const { A, n } = data;
  if (A.length !== A[0].length) throw new Error('mocnina: jen čtvercová matice');
  const steps = [{
    title: 'Mocnina jako součin',
    text: `Mocnina matice je opakované násobení matice sebou samou. Mocninu má smysl počítat jen u čtvercové matice. ${n === 3 ? 'Nejdřív spočítáme $A^2$ (její prvky značíme $c_{ij}$) a tu pak vynásobíme ještě jednou maticí $A$ (prvky $A^3$ značíme $d_{ij}$).' : 'Prvky matice $A^2$ značíme $c_{ij}$.'}`,
    board: [{ tex: n === 2 ? 'A^{2}=A\\cdot A' : 'A^{3}=A^{2}\\cdot A=(A\\cdot A)\\cdot A' }],
  }];
  const r1 = productSteps(A, A, { lname: 'A', rname: 'A', resName: 'A^{2}', finish: n === 2, types: false });
  steps.push(...r1.steps);
  let P = r1.C;
  if (n === 3) {
    const r2 = productSteps(P, A, { lname: 'A^{2}', rname: 'A', resName: 'A^{3}', finish: true, types: false, letter: 'd' });
    steps.push(...r2.steps);
    P = r2.C;
  }
  return {
    id: idOf('mocnina', data), topic: TOPIC, type: 'mocnina', data,
    task: `Vypočítej $A^{${n}}$. Prvky zapiš do mřížky.`,
    promptTex: `A=${pm(A)}`,
    answerSpec: { kind: 'matrix', value: P },
    answerTex: pm(P),
    solution: steps,
  };
}
function genMocnina(rng) {
  for (;;) {
    const three = rng() < 0.35;
    const A = three ? rmat(rng, 3, 3, -2, 3) : rmat(rng, 2, 2, -4, 5);
    const n = three ? 2 : pick(rng, [2, 3, 3]);
    if (A.flat().filter((v) => v === 0).length > 3) continue;
    const p = solveMocnina({ A, n });
    if (maxAbs(p.answerSpec.value) > 80 || p.answerSpec.value.flat().every((v) => v === 0)) continue;
    return p;
  }
}

// =====================================================================
// Typ 7: maticový polynom X = a·A² + b·A + c·E
function polyTex([a, b, c]) {
  return linTex([[a, 'A^{2}'], [b, 'A'], [c, 'E']].filter(([k]) => k !== 0));
}
function solvePolynom(data) {
  const { A, coefs } = data;
  const n = A.length;
  if (n !== A[0].length) throw new Error('polynom: jen čtvercová matice');
  const steps = [{
    title: 'Postup',
    text: `Do výrazu dosadíme za $A$ matici a za $E$ jednotkovou matici řádu ${n} (jedničky na hlavní diagonále, jinde nuly). Číslo $c$ se v maticovém polynomu nahrazuje maticí $c\\cdot E$, protože matici a číslo sečíst nejde. Nejdřív spočítáme $A^2 = A\\cdot A$.`,
    board: [{ tex: `X=${polyTex(coefs)}` }, { tex: `E=${pm(identity(n))}` }],
  }];
  const r = productSteps(A, A, { lname: 'A', rname: 'A', resName: 'A^{2}', finish: false, types: false });
  steps.push(...r.steps);
  const terms = [[coefs[0], 'A^{2}'], [coefs[1], 'A'], [coefs[2], 'E']].filter(([k]) => k !== 0);
  const c = comboSteps({ 'A^{2}': r.C, A, E: identity(n) }, terms, { lhs: 'X' });
  steps.push(...c.steps);
  return {
    id: idOf('polynom', data), topic: TOPIC, type: 'polynom', data,
    task: `Urči matici $X=${polyTex(coefs)}$, kde $E$ je jednotková matice. Prvky zapiš do mřížky.`,
    promptTex: `A=${pm(A)}`,
    answerSpec: { kind: 'matrix', value: c.sum },
    answerTex: pm(c.sum),
    solution: steps,
  };
}
function genPolynom(rng) {
  for (;;) {
    const n = rng() < 0.6 ? 2 : 3;
    const A = rmat(rng, n, n, -2, 3);
    const coefs = [pick(rng, [1, 2, 3, -1, -2]), rnz(rng, -3, 3), rnz(rng, -4, 5)];
    if (A.flat().filter((v) => v === 0).length > n) continue;
    const p = solvePolynom({ A, coefs });
    if (maxAbs(p.answerSpec.value) > 80 || p.answerSpec.value.flat().every((v) => v === 0)) continue;
    return p;
  }
}

// =====================================================================
// Typ 8: hodnost matice Gaussovou eliminací
const nonzeroRows = (rows, upto = rows[0].length) => rows.filter((r) => r.slice(0, upto).some((v) => v !== 0));
function solveHodnost(data) {
  const { rows } = data;
  const g = gaussInt(rows);
  const nz = nonzeroRows(g.rows);
  const h = nz.length;
  const last = g.rows;
  const steps = [
    {
      title: 'Zadaná matice',
      text: 'Hodnost je největší počet lineárně nezávislých řádků. Nejsnáze ji zjistíme ze schodovitého tvaru, na který matici převedeme elementárními řádkovými úpravami (výměna řádků, vynásobení řádku nenulovým číslem, přičtení násobku jiného řádku). Tyto úpravy hodnost nemění.',
      board: [{ tex: `A=${pm(rows)}` }],
    },
    {
      title: 'Gaussova eliminace',
      text: 'Postupujeme po sloupcích: zvolíme pivot (nejlépe ±1) a pod ním vyrobíme nuly. Pivot je zvýrazněný, změněné řádky podbarvené. Řádek, který vyjde celý nulový, hodnost nezvyšuje.',
      board: [{ tex: `A\\sim${pm(last)}` }],
      viz: { kind: 'gauss', data: { steps: g.steps, alt: 'Gaussova eliminace matice na schodovitý tvar' } },
    },
  ];
  const fin = [];
  if (nz.length < last.length) fin.push({ tex: `\\sim${pm(nz)}`, notes: [] });
  fin.push({ tex: `\\text{nenulových řádků: }${h}` });
  fin.push(resultLine('h(A)=', String(h)));
  steps.push({
    title: 'Hodnost',
    text: `Matice je ve schodovitém tvaru${nz.length < last.length ? ', nulové řádky vynecháme' : ''}. Hodnost je počet nenulových řádků.${h === Math.min(rows.length, rows[0].length) ? ' Matice má plnou hodnost (rovnou menšímu z počtu řádků a sloupců).' : ''}`,
    board: fin.map(({ notes, ...l }) => l),
  });
  return {
    id: idOf('hodnost', data), topic: TOPIC, type: 'hodnost', data,
    task: 'Urči hodnost $h(A)$ matice $A$. Odpověď je přirozené číslo.',
    promptTex: `A=${pm(rows)}`,
    answerSpec: { kind: 'number', value: h },
    answerTex: `h(A)=${h}`,
    solution: steps,
  };
}
function randomRankRows(rng, m, n, r, lo = -3, hi = 4) {
  const base = [];
  while (base.length < r) {
    const v = Array.from({ length: n }, () => ri(rng, lo, hi));
    if (v.every((x) => x === 0)) continue;
    base.push(v);
  }
  const rows = [...base];
  while (rows.length < m) {
    const co = base.map(() => pick(rng, [-2, -1, 0, 1, 1, 2]));
    if (co.every((x) => x === 0)) continue;
    rows.push(base[0].map((_, j) => base.reduce((s, b, i) => s + co[i] * b[j], 0)));
  }
  return shuffle(rng, rows);
}
const realRank = (rows) => nonzeroRows(gaussInt(rows).rows).length;
function genHodnost(rng) {
  for (;;) {
    const [m, n] = pick(rng, [[3, 3], [3, 4], [4, 4], [4, 5], [3, 5], [4, 3]]);
    const full = Math.min(m, n);
    const r = rng() < 0.3 ? full : ri(rng, Math.max(1, full - 2), full - 1);
    if (r < 2 && rng() < 0.7) continue;
    const rows = randomRankRows(rng, m, n, r);
    if (realRank(rows) !== r) continue;
    if (maxAbs(rows) > 12 || rows.some((row) => row.every((v) => v === 0))) continue;
    if (new Set(rows.map(String)).size !== rows.length) continue;
    const g = gaussInt(rows);
    if (g.steps.some((s) => s.matrix.flat().some((v) => Math.abs(Number(String(v).replace('−', '-'))) > 99))) continue;
    return solveHodnost({ rows });
  }
}

// =====================================================================
// Typ 9: hodnost s parametrem a – číslo a, pro které má matice danou hodnost
// data = { rows: (3 řádky, prvek 'a' ve 3. řádku, ve 3. nebo dalším sloupci), target: 2 }
const affT = ({ c, k }) => {
  if (!k) return String(c);
  const kt = k === 1 ? 'a' : k === -1 ? '-a' : `${k}a`;
  return c ? `${kt}${c < 0 ? '-' : '+'}${Math.abs(c)}` : kt;
};
function solveParametr(data) {
  const { rows, target } = data;
  if (rows.length !== 3 || target !== 2) throw new Error('parametr: jen 3 řádky a hodnost 2');
  const at = [];
  rows.forEach((r, i) => r.forEach((v, j) => { if (v === 'a') at.push([i, j]); }));
  if (at.length !== 1 || at[0][0] !== 2 || at[0][1] < 2) throw new Error('parametr: a musí být ve 3. řádku, ve 3. nebo dalším sloupci');
  let M = rows.map((r) => r.map((v) => (v === 'a' ? { c: 0, k: 1 } : { c: v, k: 0 })));
  const cell = (M2) => M2.map((r) => r.map((e) => minus(affT(e))));
  const vsteps = [{ matrix: cell(M) }];
  const op = (i, p, col) => {
    const pv = M[p][col].c; const v = M[i][col].c;
    if (v === 0 && M[i][col].k === 0) return null;
    if (M[i][col].k !== 0) throw new Error('parametr: a v pivotním sloupci');
    let a; let b;
    if (v % pv === 0) { a = 1; b = v / pv; } else { const g = gcd(pv, v); a = Math.abs(pv / g); b = (v / g) * Math.sign(pv); }
    M[i] = M[i].map((e, j) => ({ c: a * e.c - b * M[p][j].c, k: a * e.k - b * M[p][j].k }));
    const left = a === 1 ? `R${i + 1}` : `${a}·R${i + 1}`;
    let label = `${left} ${b > 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : `${Math.abs(b)}·`}R${p + 1}`;
    const g = M[i].reduce((s, e) => gcd(gcd(s, e.c), e.k), 0);
    if (g > 1) { M[i] = M[i].map((e) => ({ c: e.c / g, k: e.k / g })); label += `,  R${i + 1} : ${g}`; }
    return label;
  };
  if (M[0][0].c === 0) throw new Error('parametr: nulový pivot');
  const o11 = op(1, 0, 0); const o12 = op(2, 0, 0);
  const ops1 = [o11, o12].filter(Boolean);
  if (ops1.length) vsteps.push({ op: ops1.join(',  '), matrix: cell(M), pivot: [0, 0], changed: [o11 ? 1 : -1, o12 ? 2 : -1].filter((i) => i > 0) });
  else vsteps[0].pivot = [0, 0];
  if (M[1][1].c === 0 || M[1][1].k !== 0) throw new Error('parametr: druhý pivot');
  const o2 = op(2, 1, 1);
  if (o2) vsteps.push({ op: o2, matrix: cell(M), pivot: [1, 1], changed: [2] });
  const last = M[2];
  const j = at[0][1];
  if (last.some((e, q) => q !== j && (e.c !== 0 || e.k !== 0)) || last[j].k === 0) throw new Error('parametr: třetí řádek není nulový mimo a');
  const { c, k } = last[j];
  const aVal = fr(-c, k);
  const lines = [{ tex: `\\text{3. řádek: }(${last.map(affT).join(',\\ ')})` }];
  if (!(c === 0 && k === 1)) lines.push({ tex: `${affT({ c, k })}=0` });
  if (c !== 0 && k !== 1) lines.push({ tex: `${k === -1 ? '-' : k}a=${-c}` });
  const steps = [
    {
      title: 'Plán',
      text: 'Matici převedeme na schodovitý tvar. První dva řádky jsou nezávislé, takže hodnost je aspoň 2. Hodnost bude právě 2, když třetí řádek po eliminaci vyjde celý nulový – z toho dostaneme rovnici pro $a$.',
      board: [{ tex: `A=${pm(rows)}` }],
    },
    {
      title: 'Gaussova eliminace',
      text: 'S parametrem počítáme jako s písmenem: řádkové úpravy provádíme i s výrazy obsahujícími $a$. Pivoty volíme v řádcích bez parametru.',
      board: [{ tex: `A\\sim${pm(M.map((r) => r.map(affT)))}` }],
      viz: { kind: 'gauss', data: { steps: vsteps, alt: 'Gaussova eliminace matice s parametrem' } },
    },
    {
      title: 'Podmínka pro hodnost 2',
      text: 'Ve třetím řádku je jediný prvek, který může být nenulový. Aby byl řádek nulový (a hodnost 2), musí být tento prvek roven nule.',
      board: lines,
    },
    {
      title: 'Výsledek',
      text: `Pro tuto hodnotu je třetí řádek nulový a $h(A) = 2$. Pro každé jiné $a$ je ve třetím řádku nenulové číslo a hodnost je 3.`,
      board: [resultLine('a=', frTex(aVal)), { tex: `a\\neq ${frTex(aVal)}:\\ h(A)=3` }],
    },
  ];
  return {
    id: idOf('hodnost-parametr', data), topic: TOPIC, type: 'hodnost-parametr', data,
    task: 'Urči číslo $a$ tak, aby matice $A$ měla hodnost $h(A) = 2$.',
    promptTex: `A=${pm(rows)}`,
    answerSpec: { kind: 'number', value: toNum(aVal) },
    answerTex: `a=${frTex(aVal)}`,
    solution: steps,
  };
}
function genParametr(rng) {
  for (;;) {
    const n = pick(rng, [3, 3, 4]);
    const r0 = [pick(rng, [1, 1, -1, 2]), ...Array.from({ length: n - 1 }, () => ri(rng, -3, 4))];
    const r1 = Array.from({ length: n }, () => ri(rng, -3, 4));
    const p = rnz(rng, -2, 2); const q = rnz(rng, -2, 2);
    const r2 = r0.map((v, j) => p * v + q * r1[j]);
    const j = ri(rng, 2, n - 1);
    if (Math.abs(r2[j]) > 12 || r2.some((v) => Math.abs(v) > 15)) continue;
    const rows = [r0, r1, r2.map((v, idx) => (idx === j ? 'a' : v))];
    try {
      const pr = solveParametr({ rows, target: 2 });
      if (pr.data.rows[2].filter((v) => v === 0).length > 1) continue;
      return pr;
    } catch { /* jiné čísla */ }
  }
}

// =====================================================================
// Gauss–Jordanova eliminace dvojmatice (A|E) celočíselnými úpravami
const opLabel = (i, p, a, b) => `${a === 1 ? `R${i + 1}` : `${a}·R${i + 1}`} ${b > 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : `${Math.abs(b)}·`}R${p + 1}`;
const cells = (rows) => rows.map((r) => r.map((v) => (typeof v === 'object' ? frStrCell(v) : minus(v))));
const frStrCell = (f) => minus(f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
function gaussJordan(A) {
  const n = A.length;
  const start = A.map((r, i) => [...r, ...identity(n)[i]]);
  const fwd = gaussInt(start, n);
  const rows = fwd.rows.map((r) => [...r]);
  const rank = nonzeroRows(rows, n).length;
  if (rank < n) return { singular: true, fwd, rank };
  const back = [{ matrix: cells(rows) }];
  for (let c = n - 1; c >= 1; c--) {
    const ops = []; const changed = [];
    for (let i = 0; i < c; i++) {
      const v = rows[i][c];
      if (!v) continue;
      const pv = rows[c][c];
      let a; let b;
      if (v % pv === 0) { a = 1; b = v / pv; } else { const g = gcd(pv, v); a = Math.abs(pv / g); b = (v / g) * Math.sign(pv); }
      rows[i] = rows[i].map((x, j) => a * x - b * rows[c][j]);
      ops.push(opLabel(i, c, a, b));
      const g = rows[i].reduce((s, x) => gcd(s, x), 0);
      if (g > 1) { rows[i] = rows[i].map((x) => x / g); ops.push(`R${i + 1} : ${g}`); }
      changed.push(i);
    }
    if (ops.length) back.push({ op: ops.join(',  '), matrix: cells(rows), pivot: [c, c], changed });
  }
  const diag = rows.map((r, i) => r[i]);
  const scaled = rows.map((r, i) => r.map((x) => fr(x, diag[i])));
  const scaleOps = diag.map((d, i) => (d === 1 ? null : `R${i + 1} : ${d < 0 ? `(${minus(d)})` : d}`)).filter(Boolean);
  const inv = scaled.map((r) => r.slice(n));
  return { singular: false, fwd, back, rows, diag, scaled, scaleOps, inv, rank };
}

// =====================================================================
// Typ 10: inverzní matice Gauss–Jordanovou metodou (A|E) ~ (E|A⁻¹)
function solveInverzni(data) {
  const { A } = data;
  const n = A.length;
  if (!A.every((r) => r.length === n)) throw new Error('inverze: jen čtvercová matice');
  const gj = gaussJordan(A);
  if (gj.singular) throw new Error('inverze: matice je singulární');
  const start = A.map((r, i) => [...r, ...identity(n)[i]]);
  const steps = [
    {
      title: 'Dvojmatice (A|E)',
      text: `K matici $A$ připíšeme za svislou čáru jednotkovou matici řádu ${n}. Řádkovými úpravami (jen řádkovými!) budeme levou část převádět na jednotkovou matici; stejné úpravy se přitom provedou i v pravé části, ze které se tak stane $A^{-1}$.`,
      board: [{ tex: '(A|E)=' }, { tex: augTex(start, n) }],
    },
    {
      title: 'Nuly pod diagonálou',
      text: 'Nejdřív jako při Gaussově eliminaci vyrobíme nuly pod hlavní diagonálou. Kdyby se v levé části vynuloval celý řádek, matice by byla singulární a inverzní matice by neexistovala. Tady se to nestane – matice je regulární.',
      board: [{ tex: `\\sim${augTex(gj.fwd.rows, n)}` }],
      viz: { kind: 'gauss', data: { augmented: n, steps: gj.fwd.steps, alt: 'Eliminace pod diagonálou v dvojmatici (A|E)' } },
    },
  ];
  if (gj.back.length > 1) {
    steps.push({
      title: 'Nuly nad diagonálou',
      text: 'Teď postupujeme od posledního řádku nahoru: násobky spodních řádků přičítáme k horním tak, aby vznikly nuly i nad diagonálou. Řádky už nevyměňujeme.',
      board: [{ tex: `\\sim${augTex(gj.rows, n)}` }],
      viz: { kind: 'gauss', data: { augmented: n, steps: gj.back, alt: 'Eliminace nad diagonálou v dvojmatici' } },
    });
  }
  const D = gj.inv.flat().reduce((L, f) => (L * f.d) / gcd(L, f.d), 1);
  const Mint = gj.inv.map((r) => r.map((f) => (f.n * D) / f.d));
  if (gj.scaleOps.length) {
    steps.push({
      title: 'Jedničky na diagonále',
      text: 'Každý řádek vydělíme číslem, které v něm stojí na diagonále. Vlevo vznikne jednotková matice, vpravo je inverzní matice. Zlomky vznikají až teď, na konci.',
      board: [{ tex: `\\sim${augTex(gj.scaled, n)}` }, { tex: '=(E|A^{-1})' }],
      viz: { kind: 'gauss', data: { augmented: n, steps: [{ matrix: cells(gj.rows) }, { op: gj.scaleOps.join(',  '), matrix: cells(gj.scaled), changed: gj.diag.map((d, i) => (d === 1 ? -1 : i)).filter((i) => i >= 0) }], alt: 'Vydělení řádků diagonálními prvky' } },
    });
  }
  const AM = mmul(A, Mint);
  const check = D === 1
    ? [{ tex: 'A\\cdot A^{-1}=' }, { tex: `\\quad ${pm(A)}` }, { tex: `\\quad\\cdot ${pm(Mint)}` }, { tex: `=${pm(AM)}=E` }]
    : [{ tex: `A\\cdot A^{-1}=\\frac{1}{${D}}\\,A\\cdot M` }, { tex: `\\quad ${pm(A)}` }, { tex: `\\quad\\cdot ${pm(Mint)}` }, { tex: `=\\frac{1}{${D}}${pm(AM)}=E` }];
  const res = [resultLine('A^{-1}=', pm(gj.inv))];
  if (D > 1) res.push({ tex: `=\\frac{1}{${D}}${pm(Mint)}` });
  steps.push({
    title: 'Zkouška a výsledek',
    text: `Zkouška: musí platit $A\\cdot A^{-1} = E$. ${D > 1 ? `Zlomky vytkneme: $A^{-1} = \\frac{1}{${D}}M$, kde $M$ je celočíselná matice (druhá matice na tabuli), takže násobíme jen celá čísla.` : ''} Vyšla jednotková matice, výpočet je správně.`,
    board: [...check, ...res],
  });
  return {
    id: idOf('inverzni', data), topic: TOPIC, type: 'inverzni', data,
    task: 'Urči inverzní matici $A^{-1}$ Gauss–Jordanovou metodou (úpravou dvojmatice $(A|E)$). Prvky zapiš do mřížky, zlomky jako 1/2.',
    promptTex: `A=${pm(A)}`,
    answerSpec: { kind: 'matrix', value: gj.inv.map((r) => r.map(toNum)) },
    answerTex: `A^{-1}=${pm(gj.inv)}`,
    solution: steps,
  };
}
const det = (M) => {
  if (M.length === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  return M[0].reduce((s, v, j) => s + (j % 2 ? -1 : 1) * v * det(M.slice(1).map((r) => r.filter((_, q) => q !== j))), 0);
};
const tooBig = (gj, lim) => [...gj.fwd.steps, ...(gj.back || [])].some((s) => s.matrix.flat().some((v) => Math.abs(Number(String(v).replace('−', '-'))) > lim));
function genInverzni(rng) {
  for (;;) {
    const n = rng() < 0.35 ? 2 : 3;
    const A = n === 2 ? rmat(rng, 2, 2, -4, 6) : rmat(rng, 3, 3, -3, 4);
    const d = Math.abs(det(A));
    if (d === 0 || d > (n === 2 ? 6 : 9)) continue;
    if (A.flat().filter((v) => v === 0).length > n) continue;
    const gj = gaussJordan(A);
    if (tooBig(gj, 60)) continue;
    return solveInverzni({ A });
  }
}

// =====================================================================
// Typ 11: existuje inverzní matice? (regulární / singulární)
function solveRegularita(data) {
  const { A } = data;
  const n = A.length;
  if (!A.every((r) => r.length === n)) throw new Error('regularita: jen čtvercová matice');
  const gj = gaussJordan(A);
  const h = gj.rank;
  const start = A.map((r, i) => [...r, ...identity(n)[i]]);
  const sing = h < n;
  const steps = [
    {
      title: 'Dvojmatice (A|E)',
      text: 'Začneme jako při hledání inverzní matice: k matici $A$ připíšeme jednotkovou matici. První část Gauss–Jordanovy metody zároveň prozradí, zda je matice regulární.',
      board: [{ tex: '(A|E)=' }, { tex: augTex(start, n) }],
    },
    {
      title: 'Eliminace pod diagonálou',
      text: 'Levou část převedeme řádkovými úpravami na schodovitý tvar. Sledujeme, jestli se v levé části neobjeví řádek ze samých nul.',
      board: [{ tex: `\\sim${augTex(gj.fwd.rows, n)}` }],
      viz: { kind: 'gauss', data: { augmented: n, steps: gj.fwd.steps, alt: 'Eliminace v dvojmatici (A|E)' } },
    },
    {
      title: 'Hodnost a závěr',
      text: sing
        ? `V levé části vyšel nulový řádek, takže levá část nejde převést na jednotkovou matici. Hodnost je menší než řád matice: matice je singulární a inverzní matice neexistuje.`
        : 'V levé části není žádný nulový řádek, na diagonále jsou nenulová čísla. Hodnost je rovna řádu matice: matice je regulární a inverzní matice existuje (dopočítali bychom ji nulami nad diagonálou a vydělením řádků).',
      board: [
        { tex: `\\text{nenulových řádků vlevo: }${h}` },
        resultLine('h(A)=', String(h), sing ? `<${n}` : `=${n}`),
        { tex: sing ? 'A\\ \\text{je singulární}' : 'A\\ \\text{je regulární}' },
        { tex: sing ? 'A^{-1}\\ \\text{neexistuje}' : 'A^{-1}\\ \\text{existuje}' },
      ],
    },
  ];
  return {
    id: idOf('regularita', data), topic: TOPIC, type: 'regularita', data,
    task: 'Úpravou dvojmatice $(A|E)$ zjisti hodnost matice $A$ a rozhodni, zda k ní existuje inverzní matice. Do pole zapiš hodnost $h(A)$; závěr se ukáže po kontrole.',
    promptTex: `A=${pm(A)}`,
    answerSpec: { kind: 'number', value: h },
    answerTex: `h(A)=${h}`,
    conclusion: sing
      ? `h(A) = ${h} < ${n}, matice je singulární – inverzní matice neexistuje.`
      : `h(A) = ${n}, matice je regulární – inverzní matice existuje.`,
    solution: steps,
  };
}
function genRegularita(rng) {
  for (;;) {
    const n = rng() < 0.25 ? 2 : 3;
    const sing = rng() < 0.62;
    const A = sing ? randomRankRows(rng, n, n, n === 2 ? 1 : pick(rng, [2, 2, 1]), -3, 4) : rmat(rng, n, n, -3, 4);
    if (maxAbs(A) > 12 || A.some((r) => r.every((v) => v === 0))) continue;
    if (!sing && det(A) === 0) continue;
    if (sing && new Set(A.map(String)).size !== n) continue;
    const gj = gaussJordan(A);
    if (tooBig({ fwd: gj.fwd }, 60)) continue;
    return solveRegularita({ A });
  }
}

// =====================================================================
const theory = [
  {
    heading: 'Co je matice',
    text: 'Matice typu $(m,\\ n)$ je obdélníková tabulka reálných čísel s $m$ řádky a $n$ sloupci. Prvek $a_{ij}$ leží v $i$-tém řádku a $j$-tém sloupci (nejdřív řádek, pak sloupec). Řádky i sloupce matice si můžeme představit jako vektory.\n\nDůležité druhy matic: čtvercová ($m = n$, má hlavní diagonálu $a_{11}, a_{22}, \\dots$), nulová $O$ (samé nuly), jednotková $E$ (čtvercová, jedničky na hlavní diagonále, jinde nuly), diagonální (mimo diagonálu nuly), horní a dolní trojúhelníková, symetrická ($a_{ij} = a_{ji}$), opačná $-A$ (všechna znaménka obrácená).\n\nMatice je ve schodovitém tvaru, když každý další řádek začíná zleva víc nulami než předchozí a nulové řádky jsou až dole.\n\nDvě matice se rovnají, když jsou stejného typu a mají stejné prvky na stejných pozicích. Z rovnosti matic s neznámými prvky tak dostaneme soustavu rovnic – jednu za každou pozici.',
    tex: 'A=\\begin{pmatrix}a_{11}&a_{12}&\\dots&a_{1n}\\\\ \\vdots&&&\\vdots\\\\ a_{m1}&a_{m2}&\\dots&a_{mn}\\end{pmatrix},\\qquad E=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}',
    mistakes: [
      'Plést si pořadí v typu: $(2,\\ 3)$ znamená 2 řádky a 3 sloupce, ne obráceně.',
      'Jednotková matice není matice ze samých jedniček – jedničky jsou jen na hlavní diagonále.',
      'U rovnosti matic zapomenout některou pozici: rovnice je potřeba sepsat pro všechny prvky a ty nevyužité ověřit.',
    ],
  },
  {
    heading: 'Součet, násobek a transpozice',
    text: 'Matice stejného typu sčítáme po prvcích: sečteme čísla na stejných pozicích. Matici číslem vynásobíme tak, že tím číslem vynásobíme každý prvek. Lineární kombinace matic (např. $2P + 3(Q - R)$) se počítá jako u vektorů: nejdřív upravit písmena, pak dosadit.\n\nTransponovaná matice $A^T$ vznikne z $A$ záměnou řádků za sloupce: první řádek se stane prvním sloupcem atd. Z matice typu $(m,\\ n)$ je matice typu $(n,\\ m)$ a platí $(A^T)^T = A$.\n\nMaticové rovnice typu $P + 2X = 4(X - Q)$ řešíme jako lineární rovnice: roznásobit, převést $X$ na jednu stranu, vydělit číslem u $X$ a teprve nakonec dosadit matice.',
    tex: 'A+B=(a_{ij}+b_{ij}),\\qquad k\\cdot A=(k\\,a_{ij}),\\qquad A^T=(a_{ji})',
    mistakes: [
      'Sčítat matice různého typu – takový součet není definován.',
      'Při násobení číslem vynásobit jen některé prvky (třeba jen první řádek).',
      'Při transpozici jen „otočit“ čísla v řádku místo záměny řádků za sloupce.',
    ],
  },
  {
    heading: 'Násobení matic',
    text: 'Součin $A\\cdot B$ je definován, jen když má matice $A$ tolik sloupců, kolik má matice $B$ řádků. Z typů $(m,\\ n)\\cdot(n,\\ p)$ vznikne matice typu $(m,\\ p)$ – „vnitřní“ čísla se musí shodovat, „vnější“ dají typ výsledku.\n\nPrvek $c_{ij}$ výsledku je skalární součin $i$-tého řádku matice $A$ a $j$-tého sloupce matice $B$: vynásobíme první prvek řádku s prvním prvkem sloupce, druhý s druhým atd. a sečteme.\n\nNásobení matic není komutativní: obecně $A\\cdot B \\neq B\\cdot A$ a často je definován jen jeden z těchto součinů. Platí ale asociativita $A(BC) = (AB)C$ a distributivita $A(B + C) = AB + AC$. Jednotková matice se chová jako jednička: $A\\cdot E = E\\cdot A = A$.',
    tex: 'c_{ij}=a_{i1}b_{1j}+a_{i2}b_{2j}+\\dots+a_{in}b_{nj}',
    mistakes: [
      'Násobit matice „po prvcích“ jako při sčítání – součin se počítá řádek krát sloupec.',
      'Prohodit pořadí činitelů: $A\\cdot B$ a $B\\cdot A$ jsou obecně různé matice (nebo jedna z nich neexistuje).',
      'Spočítat typ výsledku špatně: z $(2,\\ 3)\\cdot(3,\\ 4)$ je matice $(2,\\ 4)$.',
    ],
  },
  {
    heading: 'Mocniny a maticové polynomy',
    text: 'Mocnina čtvercové matice je opakovaný součin: $A^2 = A\\cdot A$, $A^3 = A^2\\cdot A$. Nesčítáme ani neumocňujeme jednotlivé prvky!\n\nV maticovém polynomu, např. $X = 2A^2 + 4A - 3E$, nahrazuje jednotková matice $E$ „samotné číslo“: k matici nejde přičíst číslo 3, ale matici $3E$ (trojky na diagonále) ano. Postup: spočítat $A^2$, pak násobky a nakonec sečíst po prvcích.',
    tex: 'A^2=A\\cdot A,\\qquad 2A^2+4A-3E',
    mistakes: [
      'Umocnit každý prvek zvlášť: $A^2$ není matice druhých mocnin prvků.',
      'Přičíst číslo ke všem prvkům místo k diagonále (správně se přičítá $c\\cdot E$).',
    ],
  },
  {
    heading: 'Hodnost matice',
    text: 'Hodnost $h(A)$ je největší počet lineárně nezávislých řádků matice. Platí $h(A) = h(A^T)$, takže je to i největší počet nezávislých sloupců, a $h(A) \\le \\min(m,\\ n)$. Když nastane rovnost, má matice plnou hodnost.\n\nHodnost matice ve schodovitém tvaru je počet jejích nenulových řádků. Každou matici na schodovitý tvar převedeme Gaussovou eliminací pomocí elementárních řádkových úprav, které hodnost nemění: výměna řádků, vynásobení řádku nenulovým číslem, přičtení násobku jiného řádku, vynechání nulového řádku (a z několika stejných nebo násobných řádků stačí nechat jeden).\n\nHodnost s parametrem: matici eliminujeme i s písmenem a ptáme se, kdy vyjde řádek celý nulový. Hodnost také rozhoduje o závislosti vektorů: vektory zapsané do řádků matice jsou lineárně nezávislé, právě když je hodnost rovna jejich počtu.',
    tex: 'h(A)=\\text{počet nenulových řádků schodovitého tvaru}',
    mistakes: [
      'Počítat hodnost z matice, která ještě není ve schodovitém tvaru.',
      'Násobit řádek nulou – to není povolená úprava, ztratí se informace.',
      'Myslet si, že hodnost je počet řádků původní matice. Nulové řádky po eliminaci se nepočítají.',
    ],
  },
  {
    heading: 'Regulární a singulární matice',
    text: 'Čtvercová matice řádu $n$ je regulární, když $h(A) = n$ – její řádky (i sloupce) jsou lineárně nezávislé. Jinak ($h(A) < n$) je singulární.\n\nPoznat to jde při eliminaci: když se v levé části dvojmatice $(A|E)$ objeví řádek ze samých nul, matice je singulární.',
    tex: 'A\\ \\text{regulární}\\iff h(A)=n',
    mistakes: [
      'Mluvit o regularitě u obdélníkové matice – pojem je jen pro čtvercové matice.',
      'Rozhodnout o regularitě podle toho, že v matici nejsou nuly – rozhoduje hodnost.',
    ],
  },
  {
    heading: 'Inverzní matice',
    text: 'Inverzní matice $A^{-1}$ ke čtvercové matici $A$ je matice, pro kterou platí $A\\cdot A^{-1} = A^{-1}\\cdot A = E$. Existuje právě tehdy, když je $A$ regulární, a pak je jediná. K singulární matici inverzní matice neexistuje.\n\nGauss–Jordanova metoda: napíšeme dvojmatici $(A|E)$ a jen řádkovými úpravami ji převedeme na $(E|A^{-1})$. Postup: 1) nuly pod diagonálou (jako při Gaussově eliminaci), 2) nuly nad diagonálou, odspodu nahoru, 3) každý řádek vydělíme jeho diagonálním prvkem. Když vlevo vyjde nulový řádek, inverzní matice neexistuje.\n\nVýsledek je dobré ověřit zkouškou $A\\cdot A^{-1} = E$. Zlomky v inverzní matici můžeme vytknout, např. $\\frac{1}{7}\\begin{pmatrix}3&-1\\\\2&4\\end{pmatrix}$ místo zlomků v každém prvku.\n\nDruhý způsob výpočtu, přes determinant a adjungovanou matici, je v tématu Determinant, adjungovaná matice.',
    tex: '(A|E)\\sim\\dots\\sim(E|A^{-1}),\\qquad A\\cdot A^{-1}=A^{-1}\\cdot A=E',
    mistakes: [
      'Použít sloupcové úpravy nebo je míchat s řádkovými – u $(A|E)$ jen řádkové úpravy.',
      'Upravovat jen levou část a zapomenout stejnou úpravu provést i v pravé části.',
      'Myslet si, že $A^{-1}$ je matice převrácených hodnot prvků $\\frac{1}{a_{ij}}$.',
      'Hledat inverzní matici k singulární matici – vyjde nulový řádek a $A^{-1}$ neexistuje.',
    ],
  },
];

export default {
  id: TOPIC,
  title: 'Matice, hodnost, inverzní matice',
  order: 2,
  theory,
  types: [
    { id: 'kombinace', title: 'Součet, násobek a transpozice', generate: genKombinace, solve: solveKombinace },
    { id: 'rovnice', title: 'Maticová rovnice', generate: genRovnice, solve: solveRovnice },
    { id: 'rovnost', title: 'Rovnost matic s neznámými', generate: genRovnost, solve: solveRovnost },
    { id: 'soucin', title: 'Součin matic', generate: genSoucin, solve: solveSoucin },
    { id: 'typ-vysledku', title: 'Je součin definován? Typ výsledku', generate: genTyp, solve: solveTyp },
    { id: 'mocnina', title: 'Mocnina matice', generate: genMocnina, solve: solveMocnina },
    { id: 'polynom', title: 'Maticový polynom', generate: genPolynom, solve: solvePolynom },
    { id: 'hodnost', title: 'Hodnost matice', generate: genHodnost, solve: solveHodnost },
    { id: 'hodnost-parametr', title: 'Hodnost s parametrem', generate: genParametr, solve: solveParametr },
    { id: 'inverzni', title: 'Inverzní matice (Gauss–Jordan)', generate: genInverzni, solve: solveInverzni },
    { id: 'regularita', title: 'Hodnost a regularita (existuje A⁻¹?)', generate: genRegularita, solve: solveRegularita },
  ],
};
