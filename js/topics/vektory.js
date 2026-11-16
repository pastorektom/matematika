// Téma 1: Aritmetické vektory (podle probírané látky; zdrojové soubory jsou jen lokálně; konkrétní příklady z nich jsou jen v content/, ne v gitu).
//
// VZOR PRO DALŠÍ TÉMATA:
//  - theory: [{ heading, text, tex?, mistakes?: string[] }] – výklad vlastními slovy + časté chyby,
//  - types: [{ id, title, generate(rng), solve(data) }]
//      generate(rng) vylosuje data s „hezkými“ čísly a vrátí solve(data),
//      solve(data) z dat sestaví celý příklad: { id, topic, type, data, task, promptTex, hint?,
//      answerSpec, answerTex, conclusion?, solution: Step[] }. Stejný solve() staví i postupy
//      pevných příkladů ze cvičení (content/problems/<téma>.json, viz js/content.js).
//      task = česká věta se zadáním (zalamuje se), promptTex = vzorce zadání pod ní,
//      conclusion = slovní závěr, který se ukáže po správné odpovědi.
//  - Step = { title, text, board: BoardLine[], viz? } – tabule (js/viz/board.js); co popisuje
//    text, musí být vidět na tabuli. Poslední krok obsahuje výsledek s dvojitým podtržením.
//    Dlouhé řádky se lámou na víc řádků (telefon 360 px).
import {
  fr, isZero, toNum, frTex, frStr, gaussInt, solveEchelon, paramStr, paramTex, gcd, rowEqTex,
} from '../lin.js';
import { intVector, fail } from '../custom-input.js';

const TOPIC = 'vektory';

// ---------- zápis do TeXu ----------
// 'a' -> \mathbf{a}, 'a1' -> \mathbf{a}_{1}, 'o' = nulový vektor
export const vn = (name) => (name.length > 1 ? `\\mathbf{${name[0]}}_{${name.slice(1)}}` : `\\mathbf{${name}}`);
const num = (x) => (typeof x === 'object' ? frTex(x) : String(x));
export const tup = (v) => `(${v.map(num).join(',\\ ')})`;
const par = (x) => (x < 0 ? `(${x})` : `${x}`);
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const RESULT = 'vysledek';
const resultLine = (pre, tex, post = '') => ({ tex: `${pre}${cls(RESULT, tex)}${post}`, notes: [{ kind: 'doubleUnderline', target: `bt-${RESULT}` }] });
// Výsledek „levá = pravá“; dlouhý se rozdělí na dva řádky (pravá strana s dvojitým podtržením).
const resultLines = (lhs, tex) => (texLen(lhs) + texLen(tex) > 18 ? [{ tex: lhs }, resultLine('=', tex)] : [resultLine(`${lhs}=`, tex)]);
const signed = (nums) => nums.map((x, i) => (i === 0 ? `${x}` : x < 0 ? `-${-x}` : `+${x}`)).join('');
const label = (k, name) => `${k === 1 ? '' : k === -1 ? '−' : String(k).replace('-', '−')}${name}`;
const minus = (s) => String(s).replace(/-/g, '−');

// Kolik členů (vektorů v závorce) se vejde na jeden řádek tabule na telefonu.
const perLine = (dim) => (dim >= 3 ? 1 : 2);
// Přibližný počet znaků, které vzorec zabere na tabuli (\mathbf{a}_{1} = 2 znaky).
const texLen = (t) => String(t).replace(/\\htmlClass\{[^}]*\}/g, '').replace(/\\mathbf\{(\w)\}/g, '$1')
  .replace(/_\{(\w+)\}/g, '$1').replace(/\\[a-z]+/gi, 'x').replace(/[{}\\ ]/g, '').length;
// Rovnice L = R; dlouhá se rozdělí na dva řádky „L“ a „= R“.
const eqLines = (l, r) => (texLen(l) + texLen(r) > 15 ? [{ tex: l }, { tex: `=${r}` }] : [{ tex: `${l}=${r}` }]);
// Sečtení po složkách; dlouhý zápis se rozdělí po složkách do více řádků (telefon 360 px).
const LINE_CHARS = 14; // přibližně tolik znaků „křídou“ se vejde na řádek tabule na telefonu
function sumLines(comps, pre, post) {
  const raw = comps.map(signed);
  const parts = raw.map((s, i) => (i === 0 ? cls('s1', s) : s));
  const groups = [[]];
  let len = pre ? 6 : 0;
  raw.forEach((s, i) => {
    if (groups[groups.length - 1].length && len + s.length + 2 > LINE_CHARS) { groups.push([]); len = 0; }
    groups[groups.length - 1].push(i);
    len += s.length + 2;
  });
  return groups.map((g, gi) => {
    const body = g.map((i) => parts[i]).join(',\\ ');
    const first = gi === 0;
    const last = gi === groups.length - 1;
    const tex = `${first ? `=${pre}(` : '\\quad '}${body}${last ? `)${post}` : ','}`;
    return first ? { tex, notes: [{ kind: 'underline', target: 'bt-s1', label: '1. složky' }] } : { tex };
  });
}
// Rozdělí členy do řádků: první řádek začíná prefixem, další jsou odsazené.
function chunkLines(prefix, parts, n, notesFor = () => []) {
  const lines = [];
  for (let i = 0; i < parts.length; i += n) {
    const chunk = parts.slice(i, i + n);
    let tex = chunk.join('');
    if (i === 0) tex = `${prefix}${tex}`;
    else tex = `\\quad ${/^[+-]/.test(tex) ? '' : '+'}${tex}`;
    const notes = chunk.flatMap((_, j) => notesFor(i + j));
    lines.push(notes.length ? { tex, notes } : { tex });
  }
  return lines;
}

// 2a - b + 3c  (terms = [[k, name]], k celé číslo)
export function linTex(terms) {
  if (!terms.length) return '\\mathbf{o}';
  return terms.map(([k, n], i) => {
    const s = k < 0 ? '-' : i ? '+' : '';
    const a = Math.abs(k);
    return `${s}${a === 1 ? '' : a}${vn(n)}`;
  }).join('');
}

// Skupina { k, terms } = k·(součet členů); strana rovnice = pole skupin.
function groupTex(g, first) {
  if (g.terms.length === 1) {
    const [c, n] = g.terms[0];
    const t = linTex([[g.k * c, n]]);
    return first || t.startsWith('-') ? t : `+${t}`;
  }
  const inner = linTex(g.terms);
  if (g.k === 1) return first || inner.startsWith('-') ? inner : `+${inner}`;
  const a = Math.abs(g.k);
  const s = g.k < 0 ? '-' : first ? '' : '+';
  return `${s}${a === 1 ? '' : a}(${inner})`;
}
export const sideTex = (groups) => (groups.length ? groups.map((g, i) => groupTex(g, i === 0)).join('') : '\\mathbf{o}');
const expand = (groups) => groups.flatMap((g) => g.terms.map(([c, n]) => [g.k * c, n]));
function collect(terms) {
  const out = [];
  for (const [k, n] of terms) {
    const e = out.find((t) => t[1] === n);
    if (e) e[0] += k; else out.push([k, n]);
  }
  return out.filter(([k]) => k !== 0);
}
const needsExpand = (groups) => groups.some((g) => g.terms.length > 1 || g.k !== 1)
  || new Set(expand(groups).map((t) => t[1])).size !== expand(groups).length;

// Vzorce zadání: případný první řádek a pod ním jeden vektor na řádek.
function promptOf(head, vectors, names) {
  const rows = names.map((n) => `${vn(n)}=${tup(vectors[n])}`);
  return `\\begin{gathered}${[head, ...rows].filter(Boolean).join('\\\\ ')}\\end{gathered}`;
}
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;

// ---------- výpočet lineární kombinace po složkách (sdílí kombinace a rovnice) ----------
// terms = [[k, name]] (sebrané), vrací { steps, sum } – sum je celočíselný vektor.
function comboSteps(vectors, terms, { lhs = '', pre = '', post = '', finish = true } = {}) {
  const dim = vectors[terms[0][1]].length;
  const scaled = terms.map(([k, n]) => vectors[n].map((v) => k * v));
  const sum = Array.from({ length: dim }, (_, i) => scaled.reduce((s, v) => s + v[i], 0));
  const steps = [];
  const n = perLine(dim);
  const endLine = (tex) => (finish ? resultLine('=', tex) : { tex: `=${pre}${tex}${post}` });
  const endLines = (tex) => (!finish && texLen(pre + tex) > 20 ? [{ tex: `=${pre}` }, { tex: `\\quad ${tex}${post}` }] : [endLine(tex)]);
  const substParts = terms.map(([k, nm], i) => {
    const a = Math.abs(k);
    const s = k < 0 ? '-' : i ? '+' : '';
    return `${s}${a === 1 ? '' : `${a}\\cdot`}${tup(vectors[nm])}`;
  });
  // Jediný vektor s koeficientem 1: dosazením je hotovo.
  if (terms.length === 1 && terms[0][0] === 1) {
    steps.push({
      title: finish ? 'Dosazení a výsledek' : 'Dosazení',
      text: 'Za písmeno dosadíme složky vektoru.',
      board: endLines(tup(sum)),
    });
    return { steps, sum };
  }
  // dlouhá levá strana (celý výraz) na samostatný řádek
  const longLhs = texLen(lhs) > 4;
  const subst = [...(longLhs ? [{ tex: lhs }] : []), ...chunkLines(`${longLhs ? '' : lhs}=${pre}`, substParts, n)];
  if (post) subst[subst.length - 1].tex += post;
  steps.push({
    title: 'Dosazení vektorů',
    text: 'Za každé písmeno dosadíme složky vektoru. Číslo před vektorem zatím jen opíšeme.',
    board: subst,
  });
  const multNote = (i) => [{ kind: 'brace', target: `bt-n${i + 1}`, label: label(terms[i][0], terms[i][1]), position: i % 2 ? 'below' : 'above' }];
  if (terms.length === 1) {
    // jeden vektor krát číslo: vynásobením je hotovo
    steps.push({
      title: finish ? 'Násobek a výsledek' : 'Násobek vektoru',
      text: 'Každou složku vektoru vynásobíme číslem před ním (minus = násobení číslem $-1$).',
      board: endLines(tup(sum)),
    });
    return { steps, sum };
  }
  const multParts = scaled.map((v, i) => `${i ? '+' : ''}${cls(`n${i + 1}`, tup(v))}`);
  const mults = chunkLines(`=${pre}`, multParts, n, multNote);
  if (post) mults[mults.length - 1].tex += post;
  // samé koeficienty 1: násobit není co
  if (terms.some(([k]) => k !== 1)) steps.push({
    title: 'Násobky vektorů',
    text: 'Každou složku vektoru vynásobíme číslem, které stojí před ním. Minus před vektorem znamená násobení číslem $-1$, tedy změnu znaménka u všech složek. Oranžově je napsáno, ze kterého vektoru závorka vznikla.',
    board: mults,
  });
  const comps = Array.from({ length: dim }, (_, i) => scaled.map((v) => v[i]));
  steps.push({
    title: 'Sečtení po složkách',
    text: 'Sčítáme vždy čísla na stejném místě: první složky dohromady, druhé složky dohromady atd. Podtržená je první složka výsledku.',
    board: sumLines(comps, pre, post),
  });
  steps.push({
    title: finish ? 'Výsledek' : 'Výsledek v závorce',
    text: finish
      ? 'Spočítáme každou složku. Výsledkem lineární kombinace je opět vektor se stejným počtem složek.'
      : 'Spočítáme každou složku vektoru v závorce.',
    board: endLines(tup(sum)),
  });
  return { steps, sum };
}

// ---------- soustava lineárních rovnic p1·v1 + … + pk·vk = rhs (sdílí 3 typy) ----------
const pn = (i) => `p_{${i + 1}}`;
function arrayTex(rows, nVars) {
  const spec = `${'c'.repeat(nVars)}|c`;
  return `\\left(\\begin{array}{${spec}}${rows.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{array}\\right)`;
}
// Některá složka je u všech vektorů nulová -> rovnice 0 = … (generátory se jí vyhýbají).
const hasZeroRow = (vecs) => vecs[0].some((_, i) => vecs.every((v) => v[i] === 0));
// Dvě stejné rovnice soustavy (stejné složky všech vektorů i pravé strany).
const hasSameRows = (vecs, rhs) => {
  const rows = rhs.map((r, i) => [...vecs.map((v) => v[i]), r].join(','));
  return new Set(rows).size !== rows.length;
};

// vecs = vektory (sloupce), names = jejich jména, rhs/rhsName = pravá strana
function systemSteps(vecs, names, rhs, rhsName) {
  const k = vecs.length;
  const dim = rhs.length;
  const rows = Array.from({ length: dim }, (_, i) => [...vecs.map((v) => v[i]), rhs[i]]);
  const steps = [];
  const lc = names.map((n, i) => `${pn(i)}${vn(n)}`).join('+');
  const lcParts = vecs.map((v, i) => `${i ? '+' : ''}${pn(i)}${tup(v)}`);
  steps.push({
    title: 'Rovnice pro koeficienty',
    text: `Hledáme čísla $${names.map((_, i) => pn(i)).join(',\\ ')}$, pro která platí rovnost níže. Za vektory dosadíme jejich složky.`,
    board: [{ tex: `${lc}=${vn(rhsName)}` }, ...chunkLines('', lcParts, perLine(dim)), { tex: `=${tup(rhs)}` }],
  });
  steps.push({
    title: 'Soustava rovnic',
    text: 'Dva vektory se rovnají, když se rovnají všechny jejich složky. Porovnáme první složky, druhé složky atd. a dostaneme soustavu lineárních rovnic: každý vektor je jeden sloupec koeficientů. Oranžová je rovnice z prvních složek.',
    board: rows.map((r, i) => (i === 0
      ? { tex: cls('rov1', rowEqTex(r, k)), notes: [{ kind: 'color', target: 'bt-rov1' }] }
      : { tex: rowEqTex(r, k) })),
  });
  const g = gaussInt(rows, k);
  steps.push({
    title: 'Gaussova eliminace',
    text: 'Soustavu zapíšeme jako rozšířenou matici (za svislou čarou je pravá strana) a řádkovými úpravami vyrobíme pod úhlopříčkou nuly. Pivot je zvýrazněný, změněné řádky podbarvené.',
    board: [{ tex: arrayTex(rows, k) }],
    viz: { kind: 'gauss', data: { augmented: 1, steps: g.steps, alt: 'Gaussova eliminace rozšířené matice soustavy' } },
  });
  const sol = solveEchelon(g.rows, k);
  const nonzero = g.rows.filter((r) => r.some((v) => v !== 0));
  return { steps, sol, nonzero, k };
}

// Krok se zpětným dosazením: volba parametrů a výpočet jedné neznámé po druhé (sol.lines).
function backStep(sol, k) {
  const free = sol.kind === 'param' ? sol.free : [];
  let text = 'Rovnice ze schodovitého tvaru řešíme odspodu: z poslední vypočítáme její neznámou, dosadíme ji do rovnice nad ní a tak dál – vždy jen jednu neznámou.';
  if (free.length) {
    const fp = free.map((j) => `$${pn(j)}$`).join(', ');
    const names = sol.names.map((n) => `$${n}$`).join(', ');
    const scaled = sol.scales.some((s) => s !== 1);
    const one = free.length === 1;
    const hint = scaled ? ' – násobek parametru volíme vhodně, aby se výpočet zjednodušil (zlomky se mohou objevit i tak)' : '';
    text = `${one ? `Neznámá ${fp} nemá ve schodovitém tvaru pivot, proto ji zvolíme jako parametr` : `Neznámé ${fp} nemají ve schodovitém tvaru pivot, proto je zvolíme jako parametry`} (${names})${hint}. Pak rovnice řešíme odspodu: do každé dosadíme už známé hodnoty a vypočítáme jednu neznámou. Řešení je nekonečně mnoho.`;
  }
  const lines = sol.lines.map((tex) => ({ tex }));
  free.forEach((_, q) => { lines[q] = { tex: cls(`par${q + 1}`, lines[q].tex), notes: [{ kind: 'brace', target: `bt-par${q + 1}`, label: 'volíme', position: 'below' }] }; });
  return { title: free.length ? 'Řešení s parametrem' : 'Zpětné dosazení', text, board: lines };
}

// Lineární kombinace se zlomkovými koeficienty (např. -1/2·a2); nulové členy vynechá.
function combTex(vals, names) {
  const parts = [];
  vals.forEach((v, i) => {
    if (isZero(v)) return;
    const a = fr(Math.abs(v.n), v.d);
    const s = v.n < 0 ? '-' : parts.length ? '+' : '';
    parts.push(`${s}${a.n === a.d ? '' : frTex(a)}${vn(names[i])}`);
  });
  return parts.length ? parts.join('') : '\\mathbf{o}';
}
const valueOf = (f) => (f.d === 1 ? f.n : frStr(f));

// ---------- pomůcky losování ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const rnz = (rng, lo, hi) => { let v = 0; while (v === 0) v = ri(rng, lo, hi); return v; };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const rvec = (rng, dim, lo = -4, hi = 5) => Array.from({ length: dim }, () => ri(rng, lo, hi));
const nonzeroVec = (rng, dim, lo, hi) => { let v; do v = rvec(rng, dim, lo, hi); while (v.every((x) => x === 0)); return v; };
const parallel = (u, v) => {
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) if (u[i] * v[j] - u[j] * v[i] !== 0) return false;
  return true;
};
const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - b[0] * (a[1] * c[2] - a[2] * c[1]) + c[0] * (a[1] * b[2] - a[2] * b[1]);

// =====================================================================
// Typ 1: lineární kombinace (součet a násobek)
// data = { vectors: {a: [...]}, expr: [{ k, terms: [[c, name]] }], target?: 'd' }
function solveKombinace(data) {
  const { vectors, expr } = data;
  const names = Object.keys(vectors);
  const left = data.target ? `${vn(data.target)}` : '';
  const steps = [];
  const exprT = sideTex(expr);
  const terms = collect(expand(expr));
  if (needsExpand(expr)) {
    const raw = expand(expr);
    const lines = [{ tex: `${left}=${exprT}` }, { tex: `=${linTex(raw)}` }];
    const collected = linTex(terms);
    if (collected !== linTex(raw)) lines.push({ tex: `=${cls('sebrano', collected)}`, notes: [{ kind: 'underline', target: 'bt-sebrano', label: 'sečteno' }] });
    steps.push({
      title: 'Roznásobení závorek',
      text: 'Nejdřív upravíme výraz jako v algebře: roznásobíme závorky (pozor na minus před závorkou) a sečteme členy se stejným vektorem.',
      board: lines,
    });
  }
  const c = comboSteps(vectors, terms, { lhs: steps.length ? '' : left || exprT });
  steps.push(...c.steps);
  return {
    id: idOf('kombinace', data), topic: TOPIC, type: 'kombinace', data,
    task: data.target ? `Urči vektor $${vn(data.target)}$.` : 'Vypočítej lineární kombinaci vektorů (první řádek zadání).',
    promptTex: promptOf(data.target ? `${vn(data.target)}=${exprT}` : exprT, vectors, names),
    answerSpec: { kind: 'vector', value: c.sum },
    answerTex: tup(c.sum),
    solution: steps,
  };
}

function genKombinace(rng) {
  for (;;) {
    const dim = pick(rng, [3, 3, 4]);
    const three = rng() < 0.6;
    const names = three ? ['a', 'b', 'c'] : ['a', 'b'];
    const vectors = Object.fromEntries(names.map((n) => [n, rvec(rng, dim)]));
    let expr;
    if (rng() < 0.55) {
      expr = names.map((n) => ({ k: 1, terms: [[rnz(rng, -3, 3), n]] }));
    } else {
      expr = [
        { k: 1, terms: [[rnz(rng, -2, 3), 'a']] },
        { k: pick(rng, [2, 3, -2, -3]), terms: [[1, 'b'], [rnz(rng, -3, 3), three ? 'c' : 'a']] },
      ];
      if (three && rng() < 0.6) expr.push({ k: pick(rng, [2, -2, 3, -3, -1]), terms: [[1, 'c'], [rnz(rng, -2, 2), 'a']] });
    }
    const terms = collect(expand(expr));
    if (terms.length < 2) continue;
    const data = { vectors, expr };
    if (expr.every((g) => g.terms.length === 1)) data.target = 'd';
    return solveKombinace(data);
  }
}

// =====================================================================
// Typ 2: vektorová rovnice s neznámým vektorem x
// data = { vectors, left: groups, right: groups }  (neznámá se jmenuje 'x')
const fracSigned = (v, d) => {
  // v/d se znaménkem v čitateli, jmenovatel kladný
  const n = d < 0 ? -v : v;
  const den = Math.abs(d);
  return `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${den}}`;
};
function solveRovnice(data) {
  const { vectors, left, right } = data;
  const names = Object.keys(vectors);
  const dim = vectors[names[0]].length;
  const L = expand(left); const R = expand(right);
  const dx = L.filter((t) => t[1] === 'x').reduce((s, t) => s + t[0], 0) - R.filter((t) => t[1] === 'x').reduce((s, t) => s + t[0], 0);
  if (dx === 0) throw new Error('rovnice: x se vyruší');
  const rhs = collect([...R.filter((t) => t[1] !== 'x'), ...L.filter((t) => t[1] !== 'x').map(([k, n]) => [-k, n])]);
  const eq = `${sideTex(left)}=${sideTex(right)}`;
  const expanded = `${linTex(L)}=${linTex(R)}`;
  const hasBrackets = expanded !== eq;
  const steps = [{
    title: hasBrackets ? 'Roznásobení závorek' : 'Zápis rovnice',
    text: hasBrackets
      ? 'S vektorovou rovnicí zacházíme stejně jako s obyčejnou lineární rovnicí. Nejdřív roznásobíme všechny závorky.'
      : 'S vektorovou rovnicí zacházíme stejně jako s obyčejnou lineární rovnicí. Závorky tu nejsou, můžeme rovnou převádět.',
    board: [...eqLines(sideTex(left), sideTex(right)), ...(hasBrackets ? eqLines(linTex(L), linTex(R)) : [])],
  }];
  const xTerm = `${dx === 1 ? '' : dx === -1 ? '-' : dx}\\mathbf{x}`;
  const moved = {
    title: 'Neznámou na jednu stranu',
    text: `Členy s $\\mathbf{x}$ převedeme na levou stranu, ostatní na pravou (při převodu na druhou stranu se mění znaménko). Na levé straně zbude $${xTerm}$.`,
    board: [{ tex: `${cls('x', xTerm)}=${linTex(rhs)}`, notes: [{ kind: 'brace', target: 'bt-x', label: 'x dohromady' }] }],
  };
  steps.push(moved);
  const zero = Array(dim).fill(0);
  if (rhs.length === 0) {
    steps.push({ title: 'Výsledek', text: 'Pravá strana je nulový vektor, takže i $\\mathbf{x}$ je nulový vektor.', board: [resultLine('\\mathbf{x}=', tup(zero))] });
    return finishRovnice(data, names, zero.map((v) => fr(v)), steps);
  }
  if (Math.abs(dx) === 1) {
    const terms = rhs.map(([k, n]) => [k * dx, n]);
    if (dx === -1) {
      moved.board.push({ tex: `\\mathbf{x}=${linTex(terms)}` });
      moved.text += ' Celou rovnici vynásobíme číslem $-1$ (u všech členů se změní znaménko).';
    }
    const c = comboSteps(vectors, terms, { lhs: '\\mathbf{x}' });
    steps.push(...c.steps);
    return finishRovnice(data, names, c.sum.map((v) => fr(v)), steps);
  }
  const pre = `${dx < 0 ? '-' : ''}\\frac{1}{${Math.abs(dx)}}\\Big[`;
  steps.push({
    title: 'Vyjádření neznámé',
    text: `Obě strany vydělíme číslem $${dx}$ – to je totéž jako násobit číslem $${fracSigned(1, dx)}$. Vektorem se dělit nedá, číslem ano.`,
    board: [{ tex: `\\mathbf{x}=${pre}${linTex(rhs)}\\Big]` }],
  });
  const c = comboSteps(vectors, rhs, { pre, post: '\\Big]', finish: false });
  steps.push(...c.steps);
  const res = c.sum.map((v) => fr(v, dx));
  const divided = `=(${c.sum.map((v) => fracSigned(v, dx)).join(',\\ ')})`;
  steps.push({
    title: 'Vydělení a výsledek',
    text: `Každou složku vydělíme číslem $${dx}$ (znaménko mínus dáme do čitatele) a zlomky zkrátíme.`,
    board: [{ tex: divided }, resultLine('\\mathbf{x}=', tup(res))],
  });
  return finishRovnice(data, names, res, steps);
}
function finishRovnice(data, names, res, steps) {
  const frac = res.some((f) => f.d !== 1);
  return {
    id: idOf('rovnice', data), topic: TOPIC, type: 'rovnice', data,
    task: 'Vyřeš vektorovou rovnici (první řádek zadání) s neznámým vektorem $\\mathbf{x}$.',
    promptTex: promptOf(`${sideTex(data.left)}=${sideTex(data.right)}`, data.vectors, names),
    hint: frac ? 'Některé složky vyjdou jako zlomky – zapiš je třeba jako 2/3.' : 'Složky mohou vyjít i jako zlomky – zapiš je třeba jako 2/3.',
    answerSpec: { kind: 'vector', value: res.map(toNum) },
    answerTex: tup(res),
    solution: steps,
  };
}

// Šablony k(a + s·x) = m(b + r·x) [+ q·a], seskupené podle výsledného koeficientu u x.
let rovniceCombos = null;
function buildRovniceCombos() {
  const by = {};
  for (const k1 of [1, 2, 3, 4]) for (const s1 of [1, -1]) for (const k2 of [1, 2, 3, -1, -2]) for (const s2 of [1, -1]) {
    const dx = k1 * s1 - k2 * s2;
    if (dx !== 0 && Math.abs(dx) <= 6) (by[dx] ||= []).push({ k1, s1, k2, s2 });
  }
  return by;
}
function genRovnice(rng) {
  rovniceCombos ||= buildRovniceCombos();
  const dxs = Object.keys(rovniceCombos).map(Number).sort((x, y) => x - y);
  for (let attempt = 0; ; attempt++) {
    const dx = pick(rng, dxs);
    const { k1, s1, k2, s2 } = pick(rng, rovniceCombos[dx]);
    const dim = pick(rng, [3, 4]);
    const m = rng() < 0.5 ? 0 : rnz(rng, -2, 2);
    const wantFrac = Math.abs(dx) > 1 && rng() < 0.25;
    const a = rvec(rng, dim); const b = rvec(rng, dim);
    const rhs = a.map((v, i) => k2 * b[i] + (m - k1) * v);
    if (m - k1 === 0 || rhs.every((v) => v === 0)) continue; // na pravé straně aspoň dva vektory
    const divisible = rhs.every((v) => v % dx === 0);
    if (attempt < 200 && (wantFrac ? divisible : !divisible)) continue;
    const left = [{ k: k1, terms: [[1, 'a'], [s1, 'x']] }];
    const right = [{ k: k2, terms: [[1, 'b'], [s2, 'x']] }];
    if (m) right.push({ k: 1, terms: [[m, 'a']] });
    return solveRovnice({ vectors: { a, b }, left, right });
  }
}

// =====================================================================
// Typ 3: skalární součin
function solveSkalarni(data) {
  const { a, b } = data;
  const prods = a.map((v, i) => v * b[i]);
  const dot = prods.reduce((s, v) => s + v, 0);
  const formula = a.map((_, i) => `${i ? '+' : ''}a_{${i + 1}}b_{${i + 1}}`);
  const prodParts = a.map((v, i) => `${i ? '+' : ''}${cls(`p${i + 1}`, `${par(v)}\\cdot ${par(b[i])}`)}`);
  const steps = [
    {
      title: 'Vzorec',
      text: 'Skalární součin dostaneme tak, že vynásobíme odpovídající si složky (první s první, druhou s druhou, …) a součiny sečteme.',
      board: chunkLines('\\mathbf{a}\\cdot\\mathbf{b}=', formula, 3),
    },
    {
      title: 'Dosazení',
      text: 'Dosadíme složky. Záporná čísla píšeme do závorek. Oranžově je hodnota každého součinu.',
      board: chunkLines('=', prodParts, 2, (i) => [{ kind: 'brace', target: `bt-p${i + 1}`, label: minus(prods[i]), position: i % 2 ? 'below' : 'above' }]),
    },
    {
      title: 'Součiny',
      text: 'Napíšeme hodnoty součinů za sebou i se znaménky.',
      board: [{ tex: `=${signed(prods)}` }],
    },
    {
      title: 'Výsledek',
      text: `Sečteme. Skalární součin je číslo, ne vektor.${dot === 0 ? ' Vyšla nula, takže vektory jsou navzájem kolmé.' : ''}`,
      board: [resultLine('\\mathbf{a}\\cdot\\mathbf{b}=', String(dot))],
    },
  ];
  return {
    id: idOf('skalarni-soucin', data), topic: TOPIC, type: 'skalarni-soucin', data,
    task: 'Urči skalární součin $\\mathbf{a}\\cdot\\mathbf{b}$.',
    promptTex: promptOf('', { a, b }, ['a', 'b']),
    answerSpec: { kind: 'number', value: dot },
    answerTex: `\\mathbf{a}\\cdot\\mathbf{b}=${dot}`,
    solution: steps,
  };
}
function genSkalarni(rng) {
  const dim = pick(rng, [2, 3, 3, 4, 4]);
  for (;;) {
    const a = rvec(rng, dim, -5, 5); const b = rvec(rng, dim, -5, 5);
    if (a.filter((v, i) => v * b[i] !== 0).length < 2) continue;
    return solveSkalarni({ a, b });
  }
}

// =====================================================================
// Typ 4: kolmost – parametr t, aby a ⊥ b. data = { a, b, j } (a[j] je parametr t)
function solveKolmost(data) {
  const { a, b, j } = data;
  const aT = a.map((v, i) => (i === j ? 't' : String(v)));
  const S = a.reduce((s, v, i) => (i === j ? s : s + v * b[i]), 0);
  const bj = b[j];
  if (bj === 0) throw new Error('kolmost: parametr se vyruší');
  const t = fr(-S, bj);
  const tTerm = `${bj === 1 ? '' : bj === -1 ? '-' : bj}t`;
  const prodParts = aT.map((v, i) => `${i ? '+' : ''}${cls(`p${i + 1}`, `${i === j ? 't' : par(Number(v))}\\cdot ${par(b[i])}`)}`);
  const prodNotes = (i) => [{ kind: 'brace', target: `bt-p${i + 1}`, label: i === j ? minus(tTerm) : minus(a[i] * b[i]), position: i % 2 ? 'below' : 'above' }];
  const prodLines = chunkLines('', prodParts, 2, prodNotes);
  prodLines[prodLines.length - 1].tex += '=0';
  const eqLines = [{ tex: `${S === 0 ? '' : S}${S !== 0 && bj > 0 ? '+' : ''}${tTerm}=0` }];
  if (S !== 0 && bj !== 1) eqLines.push({ tex: `${tTerm}=${-S}` });
  const steps = [
    {
      title: 'Podmínka kolmosti',
      text: 'Dva nenulové vektory jsou kolmé právě tehdy, když je jejich skalární součin roven nule.',
      board: [{ tex: '\\mathbf{a}\\perp\\mathbf{b}\\iff\\mathbf{a}\\cdot\\mathbf{b}=0' }],
    },
    {
      title: 'Skalární součin s parametrem',
      text: 'Vynásobíme odpovídající si složky a sečteme. Jeden součin obsahuje neznámou $t$, ostatní jsou čísla (oranžově).',
      board: prodLines,
    },
    eqLines[eqLines.length - 1].tex === `t=${frTex(t)}` ? null : {
      title: 'Lineární rovnice pro t',
      text: S === 0 ? 'Čísla dají dohromady nulu, zůstane jen člen s $t$.' : 'Čísla sečteme a převedeme na pravou stranu (změní se znaménko).',
      board: eqLines,
    },
    {
      title: 'Výsledek',
      text: bj === 1 ? 'Neznámou $t$ osamostatníme.' : `Obě strany vydělíme číslem $${bj}$.`,
      board: [resultLine('t=', frTex(t))],
    },
  ].filter(Boolean);
  return {
    id: idOf('kolmost', data), topic: TOPIC, type: 'kolmost', data,
    task: 'Urči číslo $t$ tak, aby vektory $\\mathbf{a}$ a $\\mathbf{b}$ byly navzájem kolmé.',
    promptTex: `\\begin{gathered}\\mathbf{a}=(${aT.join(',\\ ')})\\\\ \\mathbf{b}=${tup(b)}\\end{gathered}`,
    answerSpec: { kind: 'number', value: toNum(t) },
    answerTex: `t=${frTex(t)}`,
    solution: steps,
  };
}
function genKolmost(rng) {
  for (;;) {
    const dim = pick(rng, [2, 3, 3, 4]);
    const j = ri(rng, 0, dim - 1);
    const a = rvec(rng, dim, -4, 4); const b = rvec(rng, dim, -4, 4);
    b[j] = pick(rng, [1, -1, 2, -2, 3]);
    a[j] = 0;
    const S = a.reduce((s, v, i) => s + v * b[i], 0);
    if (S === 0 || S % b[j] !== 0 || Math.abs(S / b[j]) > 9) continue;
    return solveKolmost({ a, b, j });
  }
}

// =====================================================================
// Typ 5: úhel dvou vektorů (velikosti jsou mezivýsledek postupu)
// n = k²·m (m bez čtverců)
function rootParts(n) {
  let k = 1; let m = n;
  for (let f = 2; f * f <= m; f++) while (m % (f * f) === 0) { m /= f * f; k *= f; }
  return { k, m };
}
function sqrtTex(n) {
  const { k, m } = rootParts(n);
  if (m === 1) return String(k);
  return `${k === 1 ? '' : k}\\sqrt{${m}}`;
}
// ±n/(d·√m) v TeXu (m = 1 bez odmocniny)
function fracRoot(n, d, m) {
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  const den = m === 1 ? `${d}` : `${d === 1 ? '' : d}\\sqrt{${m}}`;
  if (m === 1 && d === 1) return `${n}`;
  return `${s}\\frac{${a}}{${den}}`;
}
const NICE = [ // 4·cos² -> [úhel pro kladný a záporný kosinus, TeX hodnoty kosinu]
  { q: 0, deg: [90, 90], tex: '0' },
  { q: 1, deg: [60, 120], tex: '\\frac{1}{2}' },
  { q: 2, deg: [45, 135], tex: '\\frac{\\sqrt{2}}{2}' },
  { q: 3, deg: [30, 150], tex: '\\frac{\\sqrt{3}}{2}' },
  { q: 4, deg: [0, 180], tex: '1' },
];
function niceCos(dot, na, nb) {
  const q = (4 * dot * dot) / (na * nb);
  const e = NICE.find((x) => Math.abs(x.q - q) < 1e-12);
  if (!e) return null;
  const neg = dot < 0;
  return { deg: e.deg[neg ? 1 : 0], tex: `${neg && e.q ? '-' : ''}${e.tex}` };
}
function normLines(v, name) {
  const n = v.reduce((s, x) => s + x * x, 0);
  const sq = sqrtTex(n);
  // nejdřív druhá mocnina velikosti (součet čtverců), pak odmocnina – kratší řádky na telefonu
  const lines = chunkLines(`|${vn(name)}|^2=`, v.map((x, i) => `${i ? '+' : ''}${par(x)}^2`), 2);
  lines[lines.length - 1].tex += `=${n}`;
  lines.push({ tex: `|${vn(name)}|=\\sqrt{${n}}${sq === `\\sqrt{${n}}` ? '' : `=${sq}`}` });
  return { n, lines };
}
// Zlomek s odmocninami krok za krokem: √a·√b = √(ab), částečné odmocnění, krácení, usměrnění.
function cosLines(dot, na, nb, cTex) {
  const lines = [
    { tex: '\\cos\\varphi=\\frac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{a}|\\cdot|\\mathbf{b}|}' },
    { tex: `=\\frac{${dot}}{\\sqrt{${na}}\\cdot\\sqrt{${nb}}}` },
  ];
  const plain = [];
  if (dot !== 0) {
    const same = na === nb; // √n·√n = n přímo (ne √(n²))
    const P = na * nb;
    lines.push({
      tex: `=\\frac{${dot}}{${cls('spoj', same ? `${na}` : `\\sqrt{${P}}`)}}`,
      notes: [{ kind: 'brace', target: 'bt-spoj', label: same ? `√${na}·√${na} = ${na}` : `√${na}·√${nb} = √${P}`, position: 'below' }],
    });
    const { k, m } = same ? { k: na, m: 1 } : rootParts(P);
    if (k !== 1 && !same) {
      const den = m === 1 ? `${k}` : `${k}\\sqrt{${m}}`;
      lines.push({ tex: `=\\frac{${dot}}{${cls('odm', den)}}`, notes: [{ kind: 'brace', target: 'bt-odm', label: m === 1 ? `√${P} = ${k}` : `√${P} = √(${k * k}·${m}) = ${k}√${m}`, position: 'below' }] });
    }
    const g = gcd(Math.abs(dot), k);
    const n = dot / g; const d = k / g;
    if (g > 1) plain.push({ tex: `=${fracRoot(n, d, m)}`, label: `krátíme ${g}` });
    if (m > 1) {
      const g2 = gcd(Math.abs(n), d * m);
      const n2 = n / g2; const d2 = (d * m) / g2;
      const s = n < 0 ? '-' : '';
      plain.push({ tex: `=${s}\\frac{${Math.abs(n)}\\cdot\\sqrt{${m}}}{${d === 1 ? '' : `${d}\\cdot `}\\sqrt{${m}}\\cdot\\sqrt{${m}}}`, label: `rozšíříme √${m}` });
      const topOf = (q) => `${Math.abs(q) === 1 ? '' : Math.abs(q)}\\sqrt{${m}}`;
      plain.push({ tex: `=${s}\\frac{${topOf(n)}}{${d * m}}`, label: `√${m}·√${m} = ${m}` });
      const top = topOf(n2);
      if (g2 > 1) plain.push({ tex: `=${d2 === 1 ? `${s}${top}` : `${s}\\frac{${top}}{${d2}}`}`, label: `krátíme ${g2}` });
    }
  }
  // poslední řádek = tabulková hodnota s poznámkou (nezdvojovat stejný řádek)
  let carried = '';
  const last = plain[plain.length - 1];
  if (last && last.tex === `=${cTex}`) { plain.pop(); carried = last.label ? `${last.label}, ` : ''; }
  for (const p of plain) {
    if (p.label) {
      const id = p.label.startsWith('krátíme') ? 'kr' : p.label.startsWith('√') ? 'mn' : 'us';
      lines.push({ tex: `=${cls(id, p.tex.slice(1))}`, notes: [{ kind: 'brace', target: `bt-${id}`, label: p.label, position: 'below' }] });
    } else lines.push({ tex: p.tex });
  }
  const flat = (t) => t.replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '').replace(/[{}\s]/g, '');
  const finalLine = { tex: `=${cls('cos', cTex)}`, notes: [{ kind: 'brace', target: 'bt-cos', label: dot === 0 ? 'čitatel je 0' : `${carried}tabulková hodnota`, position: 'below' }] };
  // předchozí řádek už je tabulková hodnota (např. 1/2 po odmocnění) -> nový řádek nepsat
  if (flat(lines[lines.length - 1].tex) !== flat(finalLine.tex)) lines.push(finalLine);
  return lines;
}
function solveUhel(data) {
  const { a, b } = data;
  const A = normLines(a, 'a'); const B = normLines(b, 'b');
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const c = niceCos(dot, A.n, B.n);
  if (!c) throw new Error('úhel: není tabulková hodnota');
  const prodParts = a.map((v, i) => `${i ? '+' : ''}${par(v)}\\cdot ${par(b[i])}`);
  const dotLines = chunkLines('\\mathbf{a}\\cdot\\mathbf{b}=', prodParts, 1);
  dotLines.push({ tex: `=${dot}` });
  const steps = [
    {
      title: 'Velikosti vektorů',
      text: 'Velikost vektoru je odmocnina ze součtu druhých mocnin jeho složek (stejně jako Pythagorova věta). Pozor: $(-2)^2 = 4$. Odmocninu částečně odmocníme, pokud to jde.',
      board: [...A.lines, ...B.lines],
    },
    {
      title: 'Skalární součin',
      text: 'Vynásobíme odpovídající si složky a sečteme.',
      board: dotLines,
    },
    {
      title: 'Kosinus úhlu',
      text: 'Do vzorce dosadíme skalární součin a obě velikosti (jako odmocniny). Pak zlomek upravujeme po jednom kroku: dvě odmocniny spojíme pod jednu, z ní vytkneme, co jde, zkrátíme a odmocninu ze jmenovatele odstraníme rozšířením. Oranžově je, co se v kterém řádku stalo.',
      board: cosLines(dot, A.n, B.n, c.tex),
    },
    {
      title: 'Úhel',
      text: `Z tabulky hodnot kosinu najdeme úhel z intervalu $\\langle 0^\\circ;\\ 180^\\circ\\rangle$, jehož kosinus je $${c.tex}$.${c.deg > 90 ? ' Záporný kosinus znamená tupý úhel.' : c.deg === 90 ? ' Nulový kosinus znamená pravý úhel – vektory jsou kolmé.' : ''}`,
      board: [{ tex: `\\varphi=\\arccos\\left(${c.tex}\\right)` }, resultLine('\\varphi=', `${c.deg}^\\circ`)],
    },
  ];
  return {
    id: idOf('velikost-uhel', data), topic: TOPIC, type: 'velikost-uhel', data,
    task: 'Urči úhel $\\varphi$, který svírají vektory $\\mathbf{a}$ a $\\mathbf{b}$. Úhel zapiš ve stupních (např. 60 nebo 60°) nebo v radiánech (např. π/3).',
    promptTex: promptOf('', { a, b }, ['a', 'b']),
    answerSpec: { kind: 'number', value: c.deg, unit: 'deg' },
    answerTex: `\\varphi=${c.deg}^\\circ`,
    solution: steps,
  };
}
let anglePool = null;
function buildAnglePool() {
  const vecs = [];
  for (const dim of [2, 3]) {
    const r = [-3, -2, -1, 0, 1, 2, 3];
    const all = dim === 2 ? r.flatMap((x) => r.map((y) => [x, y])) : r.flatMap((x) => r.flatMap((y) => r.map((z) => [x, y, z])));
    vecs.push(...all.filter((v) => v.some((x) => x !== 0) && v.filter((x) => x !== 0).length >= Math.min(2, dim)));
  }
  const pool = {};
  for (const a of vecs) for (const b of vecs) {
    if (a.length !== b.length || a === b) continue;
    const na = a.reduce((s, x) => s + x * x, 0); const nb = b.reduce((s, x) => s + x * x, 0);
    const dot = a.reduce((s, x, i) => s + x * b[i], 0);
    const c = niceCos(dot, na, nb);
    if (!c || c.deg === 0 || c.deg === 180) continue;
    (pool[c.deg] ||= []).push([a, b]);
  }
  return pool;
}
function genUhel(rng) {
  anglePool ||= buildAnglePool();
  const degs = Object.keys(anglePool);
  const list = anglePool[pick(rng, degs)];
  const [a, b] = list[Math.floor(rng() * list.length)];
  return solveUhel({ a: [...a], b: [...b] });
}

// =====================================================================
// Typ 6: lineární závislost (Gaussova eliminace homogenní soustavy), 2 až 6 vektorů
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const answerExample = (k) => `(${['2t', 't', '-3t', '0', 't', '-t'].slice(0, k).join(',\\ ')})`;
function solveZavislost(data) {
  const vecs = data.vectors;
  if (!Array.isArray(vecs) || vecs.length < 2 || vecs.length > LETTERS.length) throw new Error('závislost: 2 až 6 vektorů');
  const k = vecs.length;
  const names = LETTERS.slice(0, k);
  const vectors = Object.fromEntries(names.map((n, i) => [n, vecs[i]]));
  const zero = vecs[0].map(() => 0);
  const { steps, sol } = systemSteps(vecs, names, zero, 'o');
  const ps = `(${names.map((_, i) => pn(i)).join(',')})`;
  steps.push(backStep(sol, k));
  let answerSpec; let answerTex; let conclusion; let last;
  if (sol.kind === 'unique') {
    answerSpec = { kind: 'system', value: Array(k).fill(0) };
    answerTex = `${ps}=${tup(Array(k).fill(0))}`;
    conclusion = 'Rovnost platí jen pro nulové koeficienty, takže vektory jsou lineárně nezávislé.';
    last = {
      title: 'Závěr',
      text: 'Rovnost platí jen pro nulové (triviální) koeficienty. Podle definice jsou tedy vektory lineárně nezávislé.',
      board: [resultLine(`${ps}=`, tup(Array(k).fill(0))), { tex: '\\text{lineárně nezávislé}' }],
    };
  } else {
    const vals = sol.values; // homogenní: c = 0, koeficienty u parametrů celé
    answerSpec = { kind: 'system', value: paramStr(vals, sol.names) };
    answerTex = `${ps}=${paramTex(vals, sol.names)}`;
    const coefs = vals.map((v) => toNum(v.t[0]));
    const choice = sol.names.map((n, q) => `${n}=${q === 0 ? 1 : 0}`).join(',\\ ');
    conclusion = 'Existuje i nenulové řešení, takže vektory jsou lineárně závislé.';
    last = {
      title: 'Závěr',
      text: `Existuje i nenulové (netriviální) řešení, například pro $${choice}$. Vektory jsou proto lineárně závislé a jeden z nich jde vyjádřit pomocí ostatních.`,
      board: [
        ...resultLines(ps, paramTex(vals, sol.names)),
        { tex: `${choice}:` },
        { tex: `${linTex(coefs.map((c, i) => [c, names[i]]).filter(([c]) => c !== 0))}=\\mathbf{o}` },
        { tex: '\\text{lineárně závislé}' },
      ],
    };
  }
  steps.push(last);
  const eq = `${names.map((n, i) => `${pn(i)}${vn(n)}`).join('+')}=\\mathbf{o}`;
  return {
    id: idOf('zavislost', data), topic: TOPIC, type: 'zavislost', data,
    task: `Vyřeš rovnici $${eq}$ a rozhodni, zda jsou vektory lineárně závislé. Jako odpověď zapiš všechna řešení $${ps}$: vyjde-li jen $${tup(Array(k).fill(0))}$, jsou vektory nezávislé; je-li řešení nekonečně mnoho, zapiš ho s parametrem, např. $${answerExample(k)}$ – pak jsou závislé.`,
    promptTex: promptOf('', vectors, names),
    answerSpec,
    answerTex,
    conclusion,
    solution: steps,
  };
}
function genZavislost(rng) {
  for (;;) {
    let vecs;
    if (rng() < 0.5) {
      const a = nonzeroVec(rng, 3, -3, 4); const b = nonzeroVec(rng, 3, -3, 4);
      if (parallel(a, b)) continue;
      const p = pick(rng, [1, 2, -1, -2, 3]); const q = pick(rng, [1, -1, 2, -2]);
      const c = a.map((v, i) => p * v + q * b[i]);
      if (c.some((v) => Math.abs(v) > 9)) continue;
      vecs = [a, b, c];
      const pos = ri(rng, 0, 2);
      [vecs[pos], vecs[2]] = [vecs[2], vecs[pos]];
    } else {
      vecs = [nonzeroVec(rng, 3, -3, 4), nonzeroVec(rng, 3, -3, 4), nonzeroVec(rng, 3, -3, 4)];
      const d = det3(...vecs);
      if (d === 0 || Math.abs(d) > 60) continue;
    }
    if (hasZeroRow(vecs) || hasSameRows(vecs, vecs[0].map(() => 0))) continue;
    return solveZavislost({ vectors: vecs });
  }
}

// =====================================================================
// Typ 7: je vektor b lineární kombinací vektorů a1, a2, …?
function solveJeKombinace(data) {
  const { b, vecs } = data;
  const names = vecs.map((_, i) => `a${i + 1}`);
  const vectors = { b, ...Object.fromEntries(names.map((n, i) => [n, vecs[i]])) };
  const { steps, sol, nonzero } = systemSteps(vecs, names, b, 'b');
  const k = vecs.length;
  const ps = `(${names.map((_, i) => pn(i)).join(',')})`;
  const list = names.map(vn).join(',\\ ');
  let answerSpec; let answerTex; let conclusion; let last;
  if (sol.kind === 'none') {
    answerSpec = { kind: 'system', value: 'none' };
    answerTex = '\\text{nemá řešení}';
    conclusion = 'Soustava nemá řešení, takže b není lineární kombinací daných vektorů.';
    const eqs = nonzero.map((r) => rowEqTex(r, k));
    steps.push({
      title: 'Spor',
      text: 'Přepíšeme schodovitý tvar zpět na rovnice. V posledním nenulovém řádku jsou u neznámých samé nuly, ale vpravo nenulové číslo – rovnice typu $0 = 5$ nikdy neplatí (je přeškrtnutá).',
      board: eqs.map((t, i) => (i === eqs.length - 1 ? { tex: cls('spor', t), notes: [{ kind: 'strike', target: 'bt-spor' }] } : { tex: t })),
    });
    last = {
      title: 'Závěr',
      text: `Soustava nemá řešení, takže taková čísla neexistují: $\\mathbf{b}$ není lineární kombinací vektorů $${list}$.`,
      board: [resultLine('', answerTex), { tex: '\\mathbf{b}\\text{ není lineární kombinací}' }],
    };
  } else if (sol.kind === 'unique') {
    const vals = sol.values;
    answerSpec = { kind: 'system', value: vals.map(valueOf) };
    answerTex = `${ps}=${tup(vals)}`;
    conclusion = 'Řešení je právě jedno: b je lineární kombinací, a to jediným způsobem.';
    steps.push(backStep(sol, k));
    last = {
      title: 'Závěr',
      text: 'Soustava má právě jedno řešení, takže $\\mathbf{b}$ je lineární kombinací a koeficienty jsou určené jednoznačně.',
      board: [resultLine(`${ps}=`, tup(vals)), { tex: `\\mathbf{b}=${combTex(vals, names)}` }],
    };
  } else {
    answerSpec = { kind: 'system', value: paramStr(sol.values, sol.names) };
    const tt = paramTex(sol.values, sol.names);
    answerTex = `${ps}=${tt}`;
    conclusion = 'Řešení je nekonečně mnoho: b je lineární kombinací, a to nekonečně mnoha způsoby.';
    steps.push(backStep(sol, k));
    last = {
      title: 'Závěr',
      text: `Soustava má nekonečně mnoho řešení: $\\mathbf{b}$ je lineární kombinací, a to nekonečně mnoha způsoby (pro každou hodnotu parametru jinak).`,
      board: [...resultLines(ps, tt), { tex: '\\text{nekonečně mnoho řešení}' }],
    };
  }
  steps.push(last);
  const sum = names.map((n, i) => `${pn(i)}${vn(n)}`).join('+');
  return {
    id: idOf('je-kombinace', data), topic: TOPIC, type: 'je-kombinace', data,
    task: `Rozhodni, zda je $\\mathbf{b}$ lineární kombinací vektorů $${list}$. Zapiš koeficienty $${ps}$, pro které $\\mathbf{b}=${sum}$. Když neexistují, napiš „nemá řešení“; když jich je nekonečně mnoho, zapiš je s parametrem $t$.`,
    promptTex: promptOf('', vectors, ['b', ...names]),
    answerSpec,
    answerTex,
    conclusion,
    solution: steps,
  };
}
function genJeKombinace(rng) {
  for (;;) {
    const r = rng();
    const want = r < 0.55 ? 'unique' : r < 0.85 ? 'none' : 'param';
    const dim = want === 'none' ? pick(rng, [2, 3, 3]) : pick(rng, [2, 3]);
    let a1 = nonzeroVec(rng, dim, -3, 4); let a2; let b;
    if (want === 'unique') {
      a2 = nonzeroVec(rng, dim, -3, 4);
      if (parallel(a1, a2)) continue;
      const p1 = rnz(rng, -3, 3); const p2 = rnz(rng, -3, 3);
      b = a1.map((v, i) => p1 * v + p2 * a2[i]);
    } else if (want === 'param') {
      const m = pick(rng, [2, -2, 3, -1]);
      a2 = a1.map((v) => m * v);
      const q = rnz(rng, -2, 3);
      b = a1.map((v) => q * v);
    } else if (dim === 2) {
      a2 = a1.map((v) => pick(rng, [2, -2, 3]) * v);
      b = nonzeroVec(rng, 2, -4, 6);
    } else {
      a2 = nonzeroVec(rng, dim, -3, 4);
      if (parallel(a1, a2)) continue;
      b = a1.map((v, i) => v + a2[i]);
      b[ri(rng, 0, dim - 1)] += rnz(rng, -2, 2);
    }
    if (b.some((v) => Math.abs(v) > 12) || a2.some((v) => Math.abs(v) > 12)) continue;
    if (hasZeroRow([a1, a2]) || hasSameRows([a1, a2], b)) continue; // žádná rovnice 0 = c ani dvakrát táž
    if (rng() < 0.3) [a1, a2] = [a2, a1];
    const p = solveJeKombinace({ b, vecs: [a1, a2] });
    const kind = p.answerSpec.value === 'none' ? 'none' : typeof p.answerSpec.value === 'string' ? 'param' : 'unique';
    if (kind !== want) continue;
    return p;
  }
}

// =====================================================================
// Typ 8: souřadnice vektoru vzhledem k bázi
function solveSouradnice(data) {
  const { basis, u } = data;
  const names = basis.map((_, i) => `b${i + 1}`);
  const vectors = { u, ...Object.fromEntries(names.map((n, i) => [n, basis[i]])) };
  const { steps, sol } = systemSteps(basis, names, u, 'u');
  if (sol.kind !== 'unique') throw new Error('souřadnice: vektory nejsou báze');
  const vals = sol.values;
  steps.push(backStep(sol, basis.length));
  const ps = `(${names.map((_, i) => pn(i)).join(',')})`;
  steps.push({
    title: 'Souřadnice',
    text: 'Koeficienty lineární kombinace jsou souřadnice vektoru $\\mathbf{u}$ vzhledem k dané bázi. Protože jde o bázi, vyjdou vždy právě jednou.',
    board: [resultLine(`${ps}=`, tup(vals)), { tex: `\\mathbf{u}=${combTex(vals, names)}` }],
  });
  return {
    id: idOf('souradnice', data), topic: TOPIC, type: 'souradnice', data,
    task: `Urči souřadnice vektoru $\\mathbf{u}$ vzhledem k bázi $${names.map(vn).join(',\\ ')}$, tedy čísla $${ps}$, pro která $\\mathbf{u}=${names.map((n, i) => `${pn(i)}${vn(n)}`).join('+')}$.`,
    promptTex: promptOf('', vectors, ['u', ...names]),
    answerSpec: { kind: 'vector', value: vals.map(toNum) },
    answerTex: tup(vals),
    solution: steps,
  };
}
function genSouradnice(rng) {
  for (;;) {
    const b1 = nonzeroVec(rng, 2, -3, 3); const b2 = nonzeroVec(rng, 2, -3, 3);
    if (parallel(b1, b2) || hasZeroRow([b1, b2])) continue;
    const p1 = ri(rng, -4, 4); const p2 = ri(rng, -4, 4);
    if (p1 === 0 && p2 === 0) continue;
    const u = b1.map((v, i) => p1 * v + p2 * b2[i]);
    return solveSouradnice({ basis: [b1, b2], u });
  }
}

// =====================================================================
const theory = [
  {
    heading: 'Co je aritmetický vektor',
    text: 'Aritmetický vektor je uspořádaná $n$-tice reálných čísel, například $\\mathbf{a} = (2,\\ -1,\\ 4)$. Čísla uvnitř se jmenují složky (souřadnice) a jejich počet $n$ je dimenze (rozměr) vektoru. Množinu všech takových vektorů značíme $\\mathbb{R}^n$, takže náš vektor patří do $\\mathbb{R}^3$.\n\nZáleží na pořadí: $(1,\\ 2)$ a $(2,\\ 1)$ jsou dva různé vektory. Někdy se vektor píše do sloupce místo do řádku – je to pořád tentýž vektor.\n\nVektory se hodí všude, kde jedno číslo nestačí: poloha bodu, barva v RGB, ceny tří výrobků, stav zásob.',
    tex: '\\mathbb{R}^n=\\{(a_1,a_2,\\dots,a_n);\\ a_i\\in\\mathbb{R}\\}',
    mistakes: [
      'Dimenze je počet složek, ne velikost čísel: $(100,\\ 200)$ má dimenzi 2.',
      'Dva vektory se rovnají jen tehdy, když se rovnají všechny složky na stejných místech.',
    ],
  },
  {
    heading: 'Sčítání, odčítání a násobení číslem',
    text: 'Vektory stejné dimenze sčítáme po složkách: první složka s první, druhá s druhou atd. Číslem (skalárem) vektor násobíme tak, že tím číslem vynásobíme každou složku.\n\nNulový vektor $\\mathbf{o} = (0,\\ 0,\\ \\dots,\\ 0)$ hraje roli nuly: $\\mathbf{a} + \\mathbf{o} = \\mathbf{a}$. Opačný vektor $-\\mathbf{a}$ má všechna znaménka obrácená a rozdíl je přičtení opačného vektoru: $\\mathbf{a} - \\mathbf{b} = \\mathbf{a} + (-\\mathbf{b})$.\n\nPočítá se tu jako s obyčejnými čísly: můžeme roznásobovat závorky, přehazovat sčítance i vytýkat.',
    tex: '\\mathbf{a}+\\mathbf{b}=(a_1+b_1,\\ \\dots,\\ a_n+b_n),\\qquad k\\cdot\\mathbf{a}=(k a_1,\\ \\dots,\\ k a_n)',
    mistakes: [
      'Sčítat jde jen vektory stejné dimenze. Součet $(1,\\ 2,\\ 3) + (1,\\ 2,\\ 3,\\ 4)$ není definovaný.',
      'Při násobení číslem se zapomene na některou složku – číslem se násobí všechny.',
      'Minus před závorkou mění znaménko u všech členů v závorce: $-(\\mathbf{b} - 2\\mathbf{a}) = -\\mathbf{b} + 2\\mathbf{a}$.',
      'Vektorem se nedělí. Dělit jde jen číslem: $\\frac{\\mathbf{a}}{3} = \\frac{1}{3}\\mathbf{a}$.',
    ],
  },
  {
    heading: 'Lineární kombinace a vektorové rovnice',
    text: 'Výraz $p_1\\mathbf{u}_1 + p_2\\mathbf{u}_2 + \\dots + p_k\\mathbf{u}_k$ (čísla krát vektory, sečtené) je lineární kombinace vektorů; čísla $p_i$ jsou její koeficienty.\n\nJak ji spočítat: 1) roznásobíme závorky a sečteme členy se stejným vektorem, 2) dosadíme složky, 3) vynásobíme, 4) sečteme po složkách.\n\nVektorová rovnice s neznámým vektorem $\\mathbf{x}$ se řeší přesně jako lineární rovnice s jednou neznámou: roznásobit, převést $\\mathbf{x}$ na jednu stranu, vydělit číslem u $\\mathbf{x}$ a teprve nakonec dosadit čísla.',
    tex: '3(\\mathbf{a}+\\mathbf{x})=\\mathbf{x}+\\mathbf{b}\\ \\Rightarrow\\ 2\\mathbf{x}=\\mathbf{b}-3\\mathbf{a}\\ \\Rightarrow\\ \\mathbf{x}=\\tfrac{1}{2}(\\mathbf{b}-3\\mathbf{a})',
    mistakes: [
      'Dosazovat čísla hned na začátku – výraz se zbytečně prodlouží. Nejdřív upravit písmena, pak dosadit.',
      'Při převodu členu na druhou stranu rovnice zapomenout změnit znaménko.',
      'Výsledek rovnice smí mít zlomky (např. $\\frac{2}{3}$); nezaokrouhlovat na desetinná čísla.',
    ],
  },
  {
    heading: 'Je vektor lineární kombinací jiných?',
    text: 'Ptáme se, jestli existují čísla $p_1, p_2, \\dots$ taková, že $\\mathbf{b} = p_1\\mathbf{a}_1 + p_2\\mathbf{a}_2 + \\dots$. Rozepíšeme rovnost po složkách a dostaneme soustavu lineárních rovnic – každý vektor $\\mathbf{a}_i$ tvoří jeden sloupec, vektor $\\mathbf{b}$ pravou stranu. Soustavu vyřešíme Gaussovou eliminací a zpětným dosazením.\n\nMohou nastat tři případy: soustava má jedno řešení ($\\mathbf{b}$ je lineární kombinací, jediným způsobem), nekonečně mnoho řešení (je kombinací nekonečně mnoha způsoby; volné neznámé označíme parametry $t, s, \\dots$) nebo žádné řešení ($\\mathbf{b}$ lineární kombinací není – v eliminaci vyjde spor $0 = c$, kde $c \\neq 0$).',
    mistakes: [
      'Zapsat vektory do soustavy po řádcích místo po sloupcích – koeficienty u $p_1$ jsou složky vektoru $\\mathbf{a}_1$.',
      'Řádek $(0\\ 0 \\mid 0)$ není spor, jen se vynechá. Spor je až $(0\\ 0 \\mid 5)$.',
      'Zapomenout zkoušku: dosazené koeficienty musí dát přesně vektor $\\mathbf{b}$.',
    ],
  },
  {
    heading: 'Lineární závislost a nezávislost',
    text: 'Vektory $\\mathbf{u}_1, \\dots, \\mathbf{u}_k$ jsou lineárně nezávislé, když rovnost $p_1\\mathbf{u}_1 + \\dots + p_k\\mathbf{u}_k = \\mathbf{o}$ platí jen pro $p_1 = \\dots = p_k = 0$. Jinak jsou lineárně závislé – pak aspoň jeden z nich jde vyjádřit jako lineární kombinaci ostatních.\n\nPostup: sestavíme soustavu s nulovou pravou stranou a vyřešíme ji Gaussovou eliminací. Jen nulové řešení → nezávislé. Nekonečně mnoho řešení (s parametrem) → závislé.\n\nRychlá pravidla, kdy počítat nemusíme – vektory jsou určitě závislé, když: je mezi nimi nulový vektor; jeden je násobkem jiného; je jich víc, než je dimenze (např. tři vektory v $\\mathbb{R}^2$). Dva vektory jsou závislé právě tehdy, když je jeden násobkem druhého.',
    tex: 'p_1\\mathbf{u}_1+p_2\\mathbf{u}_2+\\dots+p_k\\mathbf{u}_k=\\mathbf{o}',
    mistakes: [
      'Nulové řešení má soustava vždy. Rozhoduje, jestli je jediné.',
      'Myslet si, že tři vektory jsou nezávislé, protože žádný není násobkem jiného – třetí může být součtem prvních dvou. U tří a více vektorů je potřeba eliminace.',
      'Splést si závěr: nekonečně mnoho řešení znamená závislé, ne „nezávislé“.',
    ],
  },
  {
    heading: 'Báze, dimenze a souřadnice',
    text: 'Vektory generují prostor $\\mathbb{R}^n$, když z nich jde lineární kombinací poskládat každý vektor prostoru. Báze je skupina lineárně nezávislých generátorů; v $\\mathbb{R}^n$ má každá báze přesně $n$ vektorů a to číslo je dimenze prostoru.\n\nNejjednodušší je standardní báze $\\mathbf{e}_1 = (1,\\ 0)$, $\\mathbf{e}_2 = (0,\\ 1)$: vektor $(a,\\ b)$ je pak $a\\mathbf{e}_1 + b\\mathbf{e}_2$. V jiné bázi se koeficienty liší.\n\nSouřadnice vektoru vzhledem k bázi jsou koeficienty, kterými vektor z bázových vektorů složíme. Najdeme je stejně jako u lineární kombinace – vyřešením soustavy; u báze vyjde vždy právě jedno řešení.',
    tex: '\\mathbf{u}=p_1\\mathbf{b}_1+p_2\\mathbf{b}_2+\\dots+p_n\\mathbf{b}_n',
    mistakes: [
      'Souřadnice vzhledem k jiné bázi nejsou složky vektoru – vektor $(3,\\ 1)$ má v bázi $(1,\\ 1),\\ (1,\\ -1)$ souřadnice $(2,\\ 1)$, protože $2\\cdot(1,\\ 1) + 1\\cdot(1,\\ -1) = (3,\\ 1)$.',
      'Za bázi považovat vektory, které jsou závislé nebo jich je málo (dva vektory nemohou být bází $\\mathbb{R}^3$).',
    ],
  },
  {
    heading: 'Skalární součin a kolmost',
    text: 'Skalární součin dvou vektorů stejné dimenze dostaneme tak, že vynásobíme odpovídající si složky a součiny sečteme. Výsledkem je číslo, ne vektor.\n\nNenulové vektory jsou kolmé, právě když je jejich skalární součin roven nule. Toho se využívá v úlohách „urči parametr $t$ tak, aby vektory byly kolmé“: skalární součin položíme rovný nule a vyřešíme lineární rovnici pro $t$.\n\nSkalární součin nepatří mezi operace vektorového prostoru – z dvou vektorů nevyrobí vektor.',
    tex: '\\mathbf{a}\\cdot\\mathbf{b}=a_1b_1+a_2b_2+\\dots+a_nb_n,\\qquad \\mathbf{a}\\perp\\mathbf{b}\\iff\\mathbf{a}\\cdot\\mathbf{b}=0',
    mistakes: [
      'Zapsat výsledek jako vektor $(a_1b_1,\\ a_2b_2,\\ \\dots)$ – součiny je potřeba ještě sečíst.',
      'Ztratit znaménko u záporné složky: $(-1)\\cdot 2 = -2$. Záporná čísla piš do závorek.',
      'Násobit „křížem“ (první složku s druhou). Násobí se vždy složky na stejném místě.',
    ],
  },
  {
    heading: 'Velikost vektoru a úhel dvou vektorů',
    text: 'Tato část v přednášce kurzu přímo není, ale přirozeně navazuje na skalární součin (a ze střední školy ji znáš u geometrických vektorů).\n\nVelikost (délka, norma) vektoru je odmocnina ze skalárního součinu vektoru se sebou samým, tedy ze součtu druhých mocnin složek. Úhel $\\varphi$ dvou nenulových vektorů spočítáme přes kosinus; vychází z intervalu $\\langle 0^\\circ;\\ 180^\\circ\\rangle$. Kladný kosinus znamená ostrý úhel, nula pravý (vektory jsou kolmé), záporný tupý.\n\nTabulkové hodnoty: $\\cos 0^\\circ = 1$, $\\cos 30^\\circ = \\frac{\\sqrt{3}}{2}$, $\\cos 45^\\circ = \\frac{\\sqrt{2}}{2}$, $\\cos 60^\\circ = \\frac{1}{2}$, $\\cos 90^\\circ = 0$, $\\cos 120^\\circ = -\\frac{1}{2}$, $\\cos 135^\\circ = -\\frac{\\sqrt{2}}{2}$, $\\cos 150^\\circ = -\\frac{\\sqrt{3}}{2}$, $\\cos 180^\\circ = -1$.\n\nÚhel můžeš zapsat ve stupních i v radiánech: $180^\\circ = \\pi$, takže třeba $60^\\circ = \\frac{\\pi}{3}$.',
    tex: '|\\mathbf{a}|=\\sqrt{a_1^2+a_2^2+\\dots+a_n^2},\\qquad \\cos\\varphi=\\frac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{a}|\\cdot|\\mathbf{b}|}',
    mistakes: [
      'Zapomenout odmocninu: velikost $(3,\\ 4)$ je $5$, ne $25$.',
      'Umocnit záporné číslo bez závorky: $(-2)^2 = 4$, kdežto $-2^2 = -4$.',
      'Nechat odmocninu ve jmenovateli: $\\frac{1}{\\sqrt{2}}$ je totéž co $\\frac{\\sqrt{2}}{2}$ – v tabulce hledej až upravený tvar.',
      'Mít kalkulačku v radiánech, když chceš úhel ve stupních.',
    ],
  },
];

export default {
  id: TOPIC,
  title: 'Aritmetické vektory',
  order: 1,
  theory,
  types: [
    { id: 'kombinace', title: 'Součet a násobek (lineární kombinace)', generate: genKombinace, solve: solveKombinace },
    { id: 'rovnice', title: 'Vektorová rovnice', generate: genRovnice, solve: solveRovnice },
    { id: 'skalarni-soucin', title: 'Skalární součin', generate: genSkalarni, solve: solveSkalarni, custom: { fields: [{ id: 'a', label: 'Vektor a', kind: 'vector', rows: 3 }, { id: 'b', label: 'Vektor b', kind: 'vector', rows: 3 }], build: (v) => {
      const a = intVector(v.a); const b = intVector(v.b);
      if (a.length !== b.length) fail('Vektory musí mít stejný počet složek.');
      return { a, b };
    } } },
    { id: 'kolmost', title: 'Kolmost vektorů', generate: genKolmost, solve: solveKolmost },
    { id: 'je-kombinace', title: 'Je vektor lineární kombinací?', generate: genJeKombinace, solve: solveJeKombinace },
    { id: 'zavislost', title: 'Lineární závislost', generate: genZavislost, solve: solveZavislost },
    { id: 'souradnice', title: 'Souřadnice v bázi', generate: genSouradnice, solve: solveSouradnice },
    { id: 'velikost-uhel', title: 'Úhel dvou vektorů', generate: genUhel, solve: solveUhel },
  ],
};
