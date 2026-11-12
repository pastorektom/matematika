// Téma 4: Soustavy lineárních rovnic a maticové rovnice (podle probírané látky; zdrojové
// soubory jsou jen lokálně, konkrétní příklady z nich jsou jen v content/, ne v gitu).
//
// Typy příkladů v látce -> typ zde:
//  - Gaussova eliminace (jedno / žádné / nekonečně mnoho řešení), Frobeniova věta, Cramerovo
//    pravidlo, homogenní soustavy, eliminace s 1 a 2 parametry   -> gauss, frobenius
//  - příklady k procvičení: Gaussova eliminace -> gauss, úplná (Jordanova) eliminace -> jordan,
//    Cramerovy vzorce -> cramer, urči k, aby soustava měla řešení -> parametr-k
//  - sbírka příkladů: gauss, homogenní soustavy -> homogenni
//  - maticové rovnice AX = B, XA = B, AXB = C, soustava přes inverzní matici -> maticova-rovnice
//
// Šablona tématu viz js/topics/vektory.js: types [{ id, title, generate(rng), solve(data) }].
import {
  fr, frTex, frStr, toNum, gaussInt, solveEchelon, paramStr, paramTex,
} from '../lin.js';
import {
  varTex, varsTuple, renameVars, lhsTex, systemTex, arrayTex, pmatrix, ranks, jordanInt,
  detInt, detLines, adjugate, productEntryLines, splitLine, chainLines, texWidth, frM, mulM, subM, addM, eye, intM, dedupe, par,
} from './soustavy-lib.js';

const TOPIC = 'soustavy';

// ---------- zápis ----------
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const RESULT = 'vysledek';
const resultLine = (pre, tex, post = '') => ({ tex: `${pre}${cls(RESULT, tex)}${post}`, notes: [{ kind: 'doubleUnderline', target: `bt-${RESULT}` }] });
const texLen = (t) => String(t).replace(/\\htmlClass\{[^}]*\}/g, '').replace(/_\{(\w+)\}/g, '$1')
  .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1$2').replace(/\\[a-z]+/gi, 'x').replace(/[{}\\ ]/g, '').length;
const resultLines = (lhs, tex) => (texLen(lhs) + texLen(tex) > 20 ? [{ tex: lhs }, resultLine('=', tex)] : [resultLine(`${lhs}=`, tex)]);
const tupTex = (vals) => `(${vals.map((v) => (typeof v === 'object' ? frTex(v) : String(v))).join(',\\ ')})`;
const valueOf = (f) => (f.d === 1 ? f.n : frStr(f));
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const paramWord = (k) => (k === 1 ? 'parametr' : k < 5 ? 'parametry' : 'parametrů');
const EXAMPLES = { unique: ['1', '-2', '3', '0', '2'], param: ['2-t', 't', '1', '3t', '0'] };
const exampleTuple = (kind, n) => `(${EXAMPLES[kind].slice(0, n).join('; ')})`;
const formatText = (n) => `Řešení zapiš jako uspořádanou ${n}-tici v pořadí neznámých, např. ${exampleTuple('unique', n)}. Má-li soustava nekonečně mnoho řešení, zapiš je s parametrem $t$ (případně i $s$), např. ${exampleTuple('param', n)}. Nemá-li soustava řešení, napiš „nemá řešení“.`;

// ---------- společné kroky soustav ----------
function augmentedStep(M, n, extra = '') {
  return {
    title: 'Rozšířená matice',
    text: `Koeficienty u neznámých opíšeme po řádcích do matice soustavy $A$ a pravé strany za svislou čáru. Vznikne rozšířená matice $A_r$. Chybí-li v rovnici některá neznámá, píšeme na její místo 0.${extra}`,
    board: [{ tex: `A_r=${arrayTex(M, n)}` }],
  };
}
function eliminationStep(g, n, title = 'Gaussova eliminace') {
  const nonzero = g.rows.filter((r) => r.some((v) => v !== 0));
  const dropped = g.rows.length - nonzero.length;
  return {
    step: {
      title,
      text: `Řádkovými úpravami (výměna řádků, násobení řádku nenulovým číslem, přičtení násobku jiného řádku) vyrobíme pod pivoty nuly – matice přejde do schodovitého tvaru. Pivot je zvýrazněný, změněné řádky podbarvené.${dropped ? ' Nulový řádek (rovnice $0 = 0$) nic neříká, proto ho vynecháme.' : ''}`,
      board: [{ tex: `A_r\\sim${arrayTex(nonzero, n)}` }],
      viz: { kind: 'gauss', data: { augmented: 1, steps: g.steps, alt: 'Gaussova eliminace rozšířené matice soustavy' } },
    },
    nonzero,
  };
}
// Frobeniova věta: řádky tabule a slovní závěr.
function frobLines(hA, hAr, n) {
  const lines = [{ tex: `h(A)=${hA}` }, { tex: `h(A_r)=${hAr}` }];
  let kind; let words;
  if (hA < hAr) {
    kind = 'none';
    lines.push({ tex: 'h(A)<h(A_r)' }, { tex: '\\Rightarrow\\ \\text{nemá řešení}' });
    words = `Podle Frobeniovy věty: $h(A) = ${hA} < h(A_r) = ${hAr}$, soustava nemá řešení.`;
  } else if (hA === n) {
    kind = 'unique';
    lines.push({ tex: `h(A)=h(A_r)=n=${n}` }, { tex: '\\Rightarrow\\ \\text{právě jedno řešení}' });
    words = `Podle Frobeniovy věty: $h(A) = h(A_r) = ${hA}$ a to je rovno počtu neznámých $n = ${n}$, soustava má právě jedno řešení.`;
  } else {
    kind = 'param';
    lines.push({ tex: `h(A)=h(A_r)=${hA}<n=${n}` }, { tex: '\\Rightarrow\\ \\text{nekonečně mnoho řešení}' }, { tex: `n-h(A)=${n - hA}\\ \\text{${paramWord(n - hA)}}` });
    words = `Podle Frobeniovy věty: $h(A) = h(A_r) = ${hA}$ je menší než počet neznámých $n = ${n}$, soustava má nekonečně mnoho řešení s $n - h(A) = ${n - hA}$ ${n - hA === 1 ? 'parametrem' : 'parametry'}.`;
  }
  return { lines, kind, words };
}
function frobStep(hA, hAr, n, extra = '') {
  const f = frobLines(hA, hAr, n);
  return {
    f,
    step: {
      title: 'Frobeniova věta',
      text: `Hodnost je počet nenulových řádků schodovitého tvaru. $h(A)$ počítáme jen z části vlevo od čáry, $h(A_r)$ z celých řádků. ${f.words}${extra}`,
      board: f.lines,
    },
  };
}
function sporStep(nonzero, n, vars) {
  const eqs = nonzero.map((r) => `${lhsTex(r.slice(0, n), vars)}=${r[n]}`);
  return {
    title: 'Spor',
    text: 'Přepíšeme schodovitý tvar zpět na rovnice. V posledním řádku jsou u neznámých samé nuly, ale vpravo nenulové číslo. Rovnice typu $0 = 1$ neplatí pro žádná čísla (je přeškrtnutá), proto soustava nemá řešení.',
    board: [
      ...eqs.map((t, i) => (i === eqs.length - 1 ? { tex: cls('spor', t), notes: [{ kind: 'strike', target: 'bt-spor' }] } : { tex: t })),
      resultLine('', '\\text{nemá řešení}'),
    ],
  };
}
function backStep(sol, vars, { reduced = false } = {}) {
  const free = sol.kind === 'param' ? sol.free : [];
  let text = reduced
    ? 'Řádky přepíšeme na rovnice. V každé zbývá jediná vedoucí neznámá, kterou rovnou vypočítáme.'
    : 'Ze schodovitého tvaru napíšeme rovnice a řešíme je odspodu: z poslední vypočítáme její neznámou, dosadíme ji do rovnice nad ní a tak dál – vždy jen jednu neznámou.';
  if (free.length) {
    const fp = free.map((j) => `$${varTex(vars, j)}$`).join(', ');
    const names = sol.names.map((nm) => `$${nm}$`).join(', ');
    const scaled = sol.scales.some((s) => s !== 1);
    const one = free.length === 1;
    text = `${one ? 'Neznámá' : 'Neznámé'} ${fp} ${one ? 'nemá' : 'nemají'} ve schodovitém tvaru pivot – ${one ? 'je volná, proto za ni zvolíme parametr' : 'jsou volné, proto za ně zvolíme parametry'} (${names})${scaled ? '; násobek parametru volíme tak, aby u parametru nevycházely zlomky' : ''}. ${reduced ? 'Pak do každé rovnice dosadíme za volné neznámé jejich vyjádření pomocí parametrů a vyjádříme vedoucí neznámou.' : 'Pak rovnice řešíme odspodu: do každé dosadíme už známé hodnoty a vypočítáme jednu neznámou.'}`;
  }
  const lines = sol.lines.flatMap((tex) => splitLine(renameVars(tex, vars)).map((t) => ({ tex: t })));
  free.forEach((_, q) => { lines[q] = { tex: cls(`par${q + 1}`, lines[q].tex), notes: [{ kind: 'brace', target: `bt-par${q + 1}`, label: 'volíme', position: 'below' }] }; });
  return { title: free.length ? 'Řešení s parametrem' : 'Zpětné dosazení', text, board: lines };
}
// Výsledek řešitelné soustavy -> { answerSpec, answerTex, step }
function resultStep(sol, n, vars, words) {
  const lhs = varsTuple(vars, n);
  if (sol.kind === 'unique') {
    const tt = tupTex(sol.values);
    return {
      answerSpec: { kind: 'system', value: sol.values.map(valueOf) },
      answerTex: `${lhs}=${tt}`,
      step: { title: 'Výsledek', text: `${words} Řešení zapíšeme jako uspořádanou ${n}-tici. Zkouška: dosazením do všech rovnic musí každá platit.`, board: resultLines(lhs, tt) },
    };
  }
  const tt = paramTex(sol.values, sol.names);
  return {
    answerSpec: { kind: 'system', value: paramStr(sol.values, sol.names) },
    answerTex: `${lhs}=${tt}`,
    step: {
      title: 'Výsledek',
      text: `${words} Každá volba ${sol.names.length === 1 ? 'parametru' : 'parametrů'} ($${sol.names.join(',\\ ')} \\in \\mathbb{R}$) dá jedno řešení.`,
      board: [...resultLines(lhs, tt), { tex: `${sol.names.join(',')}\\in\\mathbb{R}` }],
    },
  };
}

// =====================================================================
// Typ 1: Gaussova eliminace (jedno / nekonečně mnoho / žádné řešení)
// data = { A: [[…]], b: […], vars?: ['x', 'y', …] }
function solveGauss(data) {
  const { A, b, vars } = data;
  const n = A[0].length;
  const M = A.map((r, i) => [...r, b[i]]);
  const steps = [augmentedStep(M, n)];
  const g = gaussInt(M, n);
  const e = eliminationStep(g, n);
  steps.push(e.step);
  const { hA, hAr } = ranks(g.rows, n);
  const { f, step } = frobStep(hA, hAr, n);
  steps.push(step);
  let answerSpec; let answerTex; let conclusion;
  if (f.kind === 'none') {
    steps.push(sporStep(e.nonzero, n, vars));
    answerSpec = { kind: 'system', value: 'none' };
    answerTex = '\\text{nemá řešení}';
    conclusion = `Soustava nemá řešení: h(A) = ${hA} < h(A_r) = ${hAr}.`;
  } else {
    const sol = solveEchelon(g.rows, n);
    steps.push(backStep(sol, vars));
    const r = resultStep(sol, n, vars, f.words);
    steps.push(r.step);
    ({ answerSpec, answerTex } = r);
    conclusion = f.kind === 'unique' ? `Soustava má právě jedno řešení: h(A) = h(A_r) = n = ${n}.` : `Soustava má nekonečně mnoho řešení: h(A) = h(A_r) = ${hA} < n = ${n}.`;
  }
  return {
    id: idOf('gauss', data), topic: TOPIC, type: 'gauss', data,
    task: `Vyřeš soustavu lineárních rovnic Gaussovou eliminací. ${formatText(n)}`,
    promptTex: systemTex(A, b, vars),
    answerSpec, answerTex, conclusion,
    solution: steps,
  };
}

// ---------- losování soustav ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rankOf = (rows, n) => gaussInt(rows.map((r) => [...r]), n).pivots.length;
const maxAbs = (steps) => Math.max(...steps.flatMap((s) => s.matrix.flat().map((c) => Math.abs(Number(String(c).replace('−', '-'))) || 0)));

function indepRows(rng, r, n) {
  for (;;) {
    const rows = Array.from({ length: r }, () => Array.from({ length: n }, () => ri(rng, -3, 4)));
    if (rows.some((row) => row.filter((v) => v !== 0).length < 2)) continue;
    if (rankOf(rows, n) === r) return rows;
  }
}
// Soustava m rovnic o n neznámých s hodností matice r; consistent = false přidá spor.
function buildSystem(rng, { n, m, r, consistent = true, zero = false }) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const base = indepRows(rng, r, n);
    const dep = Array.from({ length: m - r }, () => {
      const i = ri(rng, 0, r - 1);
      const j = r > 1 ? (i + ri(rng, 1, r - 1)) % r : i;
      const al = pick(rng, [1, -1, 2, -2, 1]); const be = i === j ? 0 : pick(rng, [1, -1, 2, 1]);
      return base[i].map((v, k) => al * v + be * base[j][k]);
    });
    const x0 = zero ? Array(n).fill(0) : Array.from({ length: n }, () => ri(rng, -3, 4));
    let rows = [...base, ...dep].map((row) => [row, row.reduce((s, v, k) => s + v * x0[k], 0)]);
    if (!consistent) rows[r + ri(rng, 0, m - r - 1)][1] += pick(rng, [1, -1, 2, 3, -2]);
    rows = shuffle(rng, rows);
    const A = rows.map((x) => x[0]); const b = rows.map((x) => x[1]);
    if (A.flat().some((v) => Math.abs(v) > 9) || b.some((v) => Math.abs(v) > 30)) continue;
    if (A.some((row) => row.every((v) => v === 0))) continue;
    if (A[0].some((_, k) => A.every((row) => row[k] === 0))) continue;
    const keys = A.map((row, i) => `${row}|${b[i]}`);
    if (new Set(keys).size !== keys.length) continue;
    const M = A.map((row, i) => [...row, b[i]]);
    const g = gaussInt(M, n);
    if (g.steps.length < 2 || maxAbs(g.steps) > 99) continue;
    const { hA, hAr } = ranks(g.rows, n);
    if (hA !== r || hAr !== (consistent ? r : r + 1)) continue;
    if (consistent && r < n) {
      const sol = solveEchelon(g.rows, n);
      if (sol.values.some((v) => v.c.d > 3 || v.t.some((t) => t.d > 1 || Math.abs(t.n) > 9))) continue;
    }
    return { A, b };
  }
  throw new Error('buildSystem: nepodařilo se vylosovat');
}
const pickVars = (rng, n) => (rng() < 0.25 ? ['x', 'y', 'z', 'u'].slice(0, n) : undefined);
function mixedShape(rng) {
  const x = rng();
  if (x < 0.4) { const n = pick(rng, [3, 3, 4]); return { n, m: rng() < 0.75 ? n : n + 1, r: n, consistent: true }; }
  if (x < 0.75) {
    const n = pick(rng, [3, 4]);
    const r = n === 4 && rng() < 0.3 ? 2 : n - 1;
    return { n, m: Math.max(2, r + ri(rng, 0, 1)), r, consistent: true };
  }
  const n = pick(rng, [3, 4]); const r = rng() < 0.6 ? n - 1 : n;
  return { n, m: r + 1, r, consistent: false };
}
function genGauss(rng) {
  const s = mixedShape(rng);
  const data = buildSystem(rng, s);
  const vars = pickVars(rng, s.n);
  return solveGauss(vars ? { ...data, vars } : data);
}

// =====================================================================
// Typ 2: úplná (Jordanova) eliminace
function solveJordan(data) {
  const { A, b, vars } = data;
  const n = A[0].length;
  const M = A.map((r, i) => [...r, b[i]]);
  const steps = [augmentedStep(M, n)];
  const pre = gaussInt(M, n);
  const { hA, hAr } = ranks(pre.rows, n);
  const unique = hA === hAr && hA === n;
  const J = jordanInt(M, n, { normalize: unique });
  const e = eliminationStep(pre, n, 'Přímý chod (Gauss)');
  e.step.text = `Nejdřív jako u Gaussovy metody vyrobíme nuly pod pivoty (přímý chod). ${e.step.text.split('. ').slice(1).join('. ')}`;
  steps.push(e.step);
  const { f, step } = frobStep(hA, hAr, n);
  steps.push(step);
  let answerSpec; let answerTex; let conclusion;
  if (f.kind === 'none') {
    steps.push(sporStep(e.nonzero, n, vars));
    answerSpec = { kind: 'system', value: 'none' };
    answerTex = '\\text{nemá řešení}';
    conclusion = `Soustava nemá řešení: h(A) = ${hA} < h(A_r) = ${hAr}.`;
    return finishJordan(data, steps, answerSpec, answerTex, conclusion, n);
  }
  const finalRows = (unique ? J.frRows : J.rows.map((r) => r.map((x) => fr(x)))).filter((r) => r.some((x) => x.n !== 0));
  steps.push({
    title: 'Zpětný chod (Jordan)',
    text: unique
      ? 'Teď nulujeme i nad pivoty, postupně od posledního pivotu nahoru. Nakonec každý řádek vydělíme jeho pivotem – vlevo vznikne jednotková matice a vpravo rovnou čteme řešení.'
      : 'Teď nulujeme i nad pivoty, postupně od posledního pivotu nahoru. V každé rovnici pak zůstane jediná vedoucí (nevolná) neznámá a volné neznámé.',
    board: [{ tex: `A_r\\sim${arrayTex(finalRows, n)}` }],
    viz: { kind: 'gauss', data: { augmented: 1, steps: J.backward, alt: 'Zpětný chod Jordanovy eliminace' } },
  });
  let sol;
  if (unique) {
    const values = Array(n);
    J.pivots.forEach(([pr, pc]) => { values[pc] = J.frRows[pr][n]; });
    sol = { kind: 'unique', values };
    steps.push({
      title: 'Čtení řešení',
      text: 'Každý řádek jednotkové matice je rovnice tvaru „neznámá = číslo“, takže řešení opíšeme z posledního sloupce.',
      board: values.map((v, k) => ({ tex: `${varTex(vars, k)}=${frTex(v)}` })),
    });
  } else {
    sol = solveEchelon(J.rows, n);
    steps.push(backStep(sol, vars, { reduced: true }));
  }
  const r = resultStep(sol, n, vars, f.words);
  steps.push(r.step);
  conclusion = unique ? `Soustava má právě jedno řešení: h(A) = h(A_r) = n = ${n}.` : `Soustava má nekonečně mnoho řešení: h(A) = h(A_r) = ${hA} < n = ${n}.`;
  return finishJordan(data, steps, r.answerSpec, r.answerTex, conclusion, n);
}
function finishJordan(data, steps, answerSpec, answerTex, conclusion, n) {
  return {
    id: idOf('jordan', data), topic: TOPIC, type: 'jordan', data,
    task: `Vyřeš soustavu úplnou (Jordanovou) eliminací. ${formatText(n)}`,
    promptTex: systemTex(data.A, data.b, data.vars),
    answerSpec, answerTex, conclusion,
    solution: steps,
  };
}
function genJordan(rng) {
  for (;;) {
    const s = rng() < 0.7 ? { n: pick(rng, [3, 3, 4]), r: 0, m: 0 } : { n: pick(rng, [3, 4]), r: -1, m: 0 };
    s.r += s.n; s.m = s.r === s.n ? s.n : s.r + ri(rng, 0, 1);
    const data = buildSystem(rng, { ...s, consistent: true });
    const p = solveJordan(data);
    const big = p.solution.some((st) => st.viz?.kind === 'gauss' && maxAbs(st.viz.data.steps.filter((x) => !String(x.matrix.flat()).includes('/'))) > 99);
    if (big) continue;
    if (p.answerSpec.value !== 'none' && Array.isArray(p.answerSpec.value) && p.answerSpec.value.some((v) => typeof v === 'string' && Number(v.split('/')[1]) > 6)) continue;
    return p;
  }
}

// =====================================================================
// Typ 3: homogenní soustava (A·x = o)
function solveHomogenni(data) {
  const { A, vars } = data;
  const n = A[0].length;
  const M = A.map((r) => [...r, 0]);
  const steps = [augmentedStep(M, n, ' U homogenní soustavy jsou všechny pravé strany nulové.')];
  const g = gaussInt(M, n);
  const e = eliminationStep(g, n);
  e.step.text += ' Sloupec pravých stran zůstává nulový – žádnou úpravou se nezmění.';
  steps.push(e.step);
  const { hA, hAr } = ranks(g.rows, n);
  const { f, step } = frobStep(hA, hAr, n, ' Homogenní soustava je vždy řešitelná ($h(A) = h(A_r)$), má aspoň triviální řešení – samé nuly.');
  steps.push(step);
  const sol = solveEchelon(g.rows, n);
  const lhs = varsTuple(vars, n);
  let answerSpec; let answerTex; let conclusion;
  if (f.kind === 'unique') {
    const zeros = Array(n).fill(0);
    answerSpec = { kind: 'system', value: zeros };
    answerTex = `${lhs}=${tupTex(zeros)}`;
    conclusion = 'Soustava má jen triviální řešení (samé nuly).';
    steps.push({ title: 'Výsledek', text: `${f.words} Protože triviální řešení (samé nuly) homogenní soustava má vždy, je to právě ono – zpětné dosazení by dávalo jen nuly.`, board: [...resultLines(lhs, tupTex(zeros)), { tex: '\\text{jen triviální řešení}' }] });
  } else {
    steps.push(backStep(sol, vars));
    const r = resultStep(sol, n, vars, `${f.words} Kromě triviálního řešení existují i netriviální.`);
    steps.push(r.step);
    ({ answerSpec, answerTex } = r);
    conclusion = 'Soustava má nekonečně mnoho řešení (i netriviální).';
  }
  return {
    id: idOf('homogenni', data), topic: TOPIC, type: 'homogenni', data,
    task: `Vyřeš homogenní soustavu. Má-li jen triviální řešení, zapiš ${exampleTuple('unique', n).replace(/[^;() ]+/g, '0')}; jinak zapiš všechna řešení s parametrem $t$ (případně i $s$), např. ${exampleTuple('param', n).replace('2-t', '-t').replace('1', '2t').replace('3t', 't')}.`,
    promptTex: systemTex(A, A.map(() => 0), vars),
    answerSpec, answerTex, conclusion,
    solution: steps,
  };
}
function genHomogenni(rng) {
  const n = pick(rng, [3, 3, 4]);
  const r = rng() < 0.4 ? n : n === 4 && rng() < 0.3 ? 2 : n - 1;
  const m = r === n ? n : Math.min(n, r + ri(rng, 0, 1));
  const data = buildSystem(rng, { n, m: Math.max(m, 2), r, zero: true });
  const vars = pickVars(rng, n);
  return solveHomogenni(vars ? { A: data.A, vars } : { A: data.A });
}

// =====================================================================
// Typ 4: Frobeniova věta – hodnosti a počet řešení
function solveFrobenius(data) {
  const { A, b, vars } = data;
  const n = A[0].length;
  const M = A.map((r, i) => [...r, b[i]]);
  const steps = [augmentedStep(M, n)];
  const g = gaussInt(M, n);
  steps.push(eliminationStep(g, n).step);
  const { hA, hAr } = ranks(g.rows, n);
  const f = frobLines(hA, hAr, n);
  const tt = tupTex([hA, hAr]);
  steps.push({
    title: 'Hodnosti a Frobeniova věta',
    text: `Hodnost je počet nenulových řádků schodovitého tvaru: $h(A)$ počítáme jen vlevo od čáry, $h(A_r)$ z celých řádků (i s pravou stranou). ${f.words}`,
    board: [resultLine('(h(A),h(A_r))=', tt), ...f.lines.slice(2)],
  });
  const conclusion = f.words.replace(/\$/g, '');
  return {
    id: idOf('frobenius', data), topic: TOPIC, type: 'frobenius', data,
    task: 'Urči hodnost $h(A)$ matice soustavy a hodnost $h(A_r)$ rozšířené matice. Do prvního políčka napiš číslo $h(A)$, do druhého číslo $h(A_r)$ (např. 2 a 3). Počet řešení z nich poznáš podle Frobeniovy věty – jen ho nezapisuj.',
    promptTex: systemTex(A, b, vars),
    answerSpec: { kind: 'vector', value: [hA, hAr] },
    answerTex: `(h(A),h(A_r))=${tt}`,
    conclusion,
    solution: steps,
  };
}
function genFrobenius(rng) {
  const s = mixedShape(rng);
  return solveFrobenius(buildSystem(rng, s));
}

// =====================================================================
// Typ 5: soustava s parametrem k na pravé straně – kdy je řešitelná
// data = { A, b } kde v b je jedno políčko 'k'
const kExpr = (c0, ck) => {
  if (ck === 0) return String(c0);
  const kt = `${Math.abs(ck) === 1 ? '' : Math.abs(ck)}k`;
  if (c0 === 0) return `${ck < 0 ? '-' : ''}${kt}`;
  return `${c0}${ck < 0 ? '-' : '+'}${kt}`;
};
// Pravá strana: číslo, nebo výraz s k ('k', '-k', '2k', '3+k', '3-2k') -> [c0, ck]
function parseK(v) {
  if (typeof v === 'number') return [v, 0];
  let m = /^(-?\d+)([+-])(\d*)k$/.exec(v);
  if (m) return [Number(m[1]), (m[2] === '-' ? -1 : 1) * Number(m[3] || 1)];
  m = /^(-?)(\d*)k$/.exec(v);
  if (m) return [0, (m[1] ? -1 : 1) * Number(m[2] || 1)];
  throw new Error(`parametr-k: neznámá pravá strana ${v}`);
}
function solveParametrK(data) {
  const { A, b, vars } = data;
  const n = A[0].length;
  const M = A.map((r, i) => [...r, ...parseK(b[i])]);
  const g = gaussInt(M, n);
  const comb = (rows) => rows.map((r) => [...r.slice(0, n), kExpr(r[n], r[n + 1])]);
  const numRows = (mat) => mat.map((r) => r.map((c) => Number(String(c).replace('−', '-'))));
  const vizSteps = g.steps.map((s) => ({ ...s, matrix: comb(numRows(s.matrix)).map((r) => r.map((c) => String(c).replace(/-/g, '−'))) }));
  const shown = comb(g.rows.filter((r) => r.some((v) => v !== 0)));
  const zeroRows = g.rows.filter((r) => r.slice(0, n).every((v) => v === 0) && (r[n] !== 0 || r[n + 1] !== 0));
  if (zeroRows.length !== 1 || zeroRows[0][n + 1] === 0) throw new Error('parametr-k: čekám jednu podmínku s k');
  const [c0, ck] = [zeroRows[0][n], zeroRows[0][n + 1]];
  const k0 = fr(-c0, ck);
  const hA = g.pivots.length;
  const steps = [
    {
      title: 'Rozšířená matice s parametrem',
      text: 'Soustavu zapíšeme jako rozšířenou matici. Parametr $k$ je na pravé straně a s výrazy s $k$ počítáme při úpravách stejně jako s čísly.',
      board: [{ tex: `A_r=${arrayTex(A.map((r, i) => [...r, b[i]]), n)}` }],
    },
    {
      title: 'Gaussova eliminace',
      text: 'Řádkovými úpravami převedeme matici na schodovitý tvar. Vlevo vznikne nulový řádek – o řešitelnosti pak rozhoduje jen výraz s $k$ za čarou.',
      board: [{ tex: `A_r\\sim${arrayTex(shown, n)}` }],
      viz: { kind: 'gauss', data: { augmented: 1, steps: vizSteps, alt: 'Gaussova eliminace soustavy s parametrem k' } },
    },
    {
      title: 'Frobeniova věta',
      text: `Vlevo jsou ${hA} nenulové řádky, takže $h(A) = ${hA}$. Řádek s nulami vlevo je rovnice $0 = ${kExpr(c0, ck)}$. Když výraz vpravo není nula, je $h(A_r) = ${hA + 1} > h(A)$ a soustava nemá řešení. Řešení existuje jen tehdy, když je výraz nulový.`,
      board: [{ tex: `h(A)=${hA}` }, { tex: `0=${kExpr(c0, ck)}` }, { tex: `h(A_r)=h(A)\\iff ${kExpr(c0, ck)}=0` }],
    },
  ];
  const lines = [];
  const kt = `${ck === 1 ? '' : ck === -1 ? '-' : ck}k`;
  if (ck !== 1) lines.push({ tex: `${kt}=${-c0}` }); // pro ck = 1 je to rovnou výsledek
  const count = hA === n ? 'právě jedno řešení' : `nekonečně mnoho řešení (${n - hA} ${paramWord(n - hA)})`;
  lines.push(resultLine('k=', frTex(k0)));
  lines.push({ tex: `k=${frTex(k0)}:\\ h(A)=h(A_r)=${hA}` }, { tex: `k\\neq ${frTex(k0)}:\\ h(A)<h(A_r)` });
  steps.push({
    title: 'Hodnota k',
    text: `Vyřešíme lineární rovnici pro $k$. Pro $k = ${frTex(k0)}$ je $h(A) = h(A_r) = ${hA}$ a soustava má ${count}${hA === n ? '' : ', protože počet neznámých je $n = ' + n + '$'}; pro každé jiné $k$ řešení nemá.`,
    board: dedupe(lines),
  });
  return {
    id: idOf('parametr-k', data), topic: TOPIC, type: 'parametr-k', data,
    task: 'Urči hodnotu parametru $k$, pro kterou má soustava řešení. Napiš číslo $k$ (zlomek jako 3/4).',
    promptTex: systemTex(A, b, vars),
    answerSpec: { kind: 'number', value: toNum(k0) },
    answerTex: `k=${frTex(k0)}`,
    conclusion: `Řešitelná je jen pro k = ${frStr(k0)}, pak má ${count}.`,
    solution: steps,
  };
}
function genParametrK(rng) {
  for (;;) {
    const n = pick(rng, [3, 4]);
    const m = n === 4 && rng() < 0.4 ? 4 : 3;
    const base = indepRows(rng, m - 1, n);
    const i = ri(rng, 0, m - 2); const j = (i + 1) % (m - 1);
    const al = pick(rng, [1, 2, -1, 1]); const be = pick(rng, [1, -1, 2, 3]);
    const depRow = base[i].map((v, k) => al * v + be * base[j][k]);
    if (depRow.some((v) => Math.abs(v) > 11) || depRow.filter((v) => v !== 0).length < 2) continue;
    // pravé strany c + d·k: klasicky jen poslední řádek závisí na k, jinak k i ve víc řádcích
    const varied = rng() < 0.6;
    const c = base.map(() => ri(rng, -4, 6));
    const d = base.map(() => 0);
    let e = 1; let f = 0;
    if (varied) {
      const many = ri(rng, 1, Math.min(2, m - 1));
      shuffle(rng, base.map((_, q) => q)).slice(0, many).forEach((q) => { d[q] = pick(rng, [1, -1, 2]); });
      e = pick(rng, [1, 1, -1, 2, -2]); f = ri(rng, -3, 3);
    }
    const Ck = e - al * d[i] - be * d[j];
    const Cc = f - al * c[i] - be * c[j];
    if (Ck === 0) continue;
    const k0 = fr(-Cc, Ck);
    if (k0.d > 3 || Math.abs(k0.n) > 15) continue;
    const cell = (cc, dd) => (dd === 0 ? cc : kExpr(cc, dd));
    const rows = shuffle(rng, [...base.map((r, q) => [r, cell(c[q], d[q])]), [depRow, kExpr(f, e)]]);
    const A = rows.map((x) => x[0]); const b = rows.map((x) => x[1]);
    if (A[0].some((_, k) => A.every((row) => row[k] === 0))) continue;
    let p;
    try { p = solveParametrK({ A, b }); } catch { continue; }
    if (maxAbs(gaussInt(A.map((r, q) => [...r, ...parseK(b[q])]), n).steps) > 60) continue;
    if (p.solution.some((st) => (st.board || []).some((l) => texWidth(l.tex) > 26))) continue;
    return p;
  }
}

// =====================================================================
// Typ 6: Cramerovo pravidlo (soustava n × n s nenulovým determinantem, n = 2, 3)
function solveCramer(data) {
  const { A, b, vars } = data;
  const n = A.length;
  const D = detInt(A);
  if (D === 0) throw new Error('cramer: D = 0');
  const steps = [];
  const d0 = detLines(A, 'D');
  steps.push({
    title: 'Determinant soustavy',
    text: `Spočítáme determinant matice soustavy${n === 3 ? ' Sarrusovým pravidlem (dopíšeme první dva sloupce; součiny po oranžových úhlopříčkách přičteme, po červených odečteme)' : ' (součin na hlavní úhlopříčce minus součin na vedlejší)'}. Vyšlo $D = ${D} \\neq 0$, matice je regulární, $h(A) = h(A_r) = n = ${n}$ a soustava má podle Frobeniovy věty právě jedno řešení – Cramerovo pravidlo lze použít.`,
    board: d0.lines,
    ...(d0.viz ? { viz: d0.viz } : {}),
  });
  const Ds = [];
  for (let k = 0; k < n; k++) {
    const Ak = A.map((r, i) => r.map((v, j) => (j === k ? b[i] : v)));
    const dk = detLines(Ak, `D_{${k + 1}}`, { highlightCol: k });
    Ds.push(dk.value);
    steps.push({
      title: `Determinant D${k + 1}`,
      text: `V determinantu $D$ nahradíme ${k + 1}. sloupec (u neznámé $${varTex(vars, k)}$) sloupcem pravých stran – je barevně – a determinant spočítáme stejně.`,
      board: dk.lines,
      ...(dk.viz ? { viz: { ...dk.viz, data: { ...dk.viz.data, highlight: { cols: [k] } } } } : {}),
    });
  }
  const values = Ds.map((v) => fr(v, D));
  const lhs = varsTuple(vars, n);
  const tt = tupTex(values);
  steps.push({
    title: 'Výsledek',
    text: `Každou neznámou dostaneme jako podíl: $x_k = \\frac{D_k}{D}$. Zlomky zkrátíme.${D < 0 ? ' Determinant $D$ je záporný, proto znaménko ve jmenovateli přesuneme do čitatele (čitatel i jmenovatel vynásobíme číslem $-1$), aby byl jmenovatel kladný.' : ''}`,
    board: [
      ...values.map((v, k) => {
        const shown = `\\frac{${D < 0 ? -Ds[k] : Ds[k]}}{${Math.abs(D)}}`;
        return { tex: `${varTex(vars, k)}=\\frac{D_{${k + 1}}}{D}=${shown}${shown === frTex(v) ? '' : `=${frTex(v)}`}` };
      }),
      ...resultLines(lhs, tt),
    ],
  });
  return {
    id: idOf('cramer', data), topic: TOPIC, type: 'cramer', data,
    task: `Vyřeš soustavu pomocí Cramerova pravidla. Řešení zapiš jako uspořádanou ${n}-tici, např. ${exampleTuple('unique', n)}; zlomky jako 3/4.`,
    promptTex: systemTex(A, b, vars),
    answerSpec: { kind: 'system', value: values.map(valueOf) },
    answerTex: `${lhs}=${tt}`,
    solution: steps,
  };
}
function genCramer(rng) {
  for (;;) {
    const n = rng() < 0.4 ? 2 : 3;
    const A = Array.from({ length: n }, () => Array.from({ length: n }, () => ri(rng, -3, 4)));
    if (A.some((r) => r.filter((v) => v !== 0).length < (n === 2 ? 1 : 2))) continue;
    if (A[0].some((_, k) => A.every((row) => row[k] === 0))) continue;
    const D = detInt(A);
    if (D === 0 || Math.abs(D) > 40) continue;
    let b;
    if (rng() < 0.8) {
      const x = Array.from({ length: n }, () => ri(rng, -3, 4));
      b = A.map((r) => r.reduce((s, v, k) => s + v * x[k], 0));
    } else {
      if (Math.abs(D) > 12) continue;
      b = Array.from({ length: n }, () => ri(rng, -5, 8));
    }
    if (b.some((v) => Math.abs(v) > 25)) continue;
    const vars = n === 2 ? (rng() < 0.5 ? ['x', 'y'] : undefined) : pickVars(rng, n);
    return solveCramer(vars ? { A, b, vars } : { A, b });
  }
}

// =====================================================================
// Typ 7: maticové rovnice
// data = { form, A, B, C? }, form: 'AX=B' | 'XA=B' | 'AX+B=C' | 'XA+B=C' | 'AX=B+X' | 'XA=B+X' | 'AXB=C'
const D_ = '\\cdot ';
const FORMS = {
  'AX=B': { eq: `A${D_}X=B`, side: 'L', alg: [`A${D_}X=B\\quad\\big|\\ A^{-1}${D_}\\ \\text{zleva}`, `A^{-1}${D_}A${D_}X=A^{-1}${D_}B`, `E${D_}X=A^{-1}${D_}B`, `X=A^{-1}${D_}B`] },
  'XA=B': { eq: `X${D_}A=B`, side: 'R', alg: [`X${D_}A=B\\quad\\big|\\ ${D_}A^{-1}\\ \\text{zprava}`, `X${D_}A${D_}A^{-1}=B${D_}A^{-1}`, `X${D_}E=B${D_}A^{-1}`, `X=B${D_}A^{-1}`] },
  'AX+B=C': { eq: `A${D_}X+B=C`, side: 'L', alg: [`A${D_}X+B=C`, `A${D_}X=C-B\\quad\\big|\\ A^{-1}${D_}\\ \\text{zleva}`, `A^{-1}${D_}A${D_}X=A^{-1}${D_}(C-B)`, `E${D_}X=A^{-1}${D_}(C-B)`, `X=A^{-1}${D_}(C-B)`] },
  'XA+B=C': { eq: `X${D_}A+B=C`, side: 'R', alg: [`X${D_}A+B=C`, `X${D_}A=C-B\\quad\\big|\\ ${D_}A^{-1}\\ \\text{zprava}`, `X${D_}A${D_}A^{-1}=(C-B)${D_}A^{-1}`, `X${D_}E=(C-B)${D_}A^{-1}`, `X=(C-B)${D_}A^{-1}`] },
  'AX=B+X': { eq: `A${D_}X=B+X`, side: 'L', alg: [`A${D_}X=B+X`, `A${D_}X-X=B`, `A${D_}X-E${D_}X=B`, `(A-E)${D_}X=B\\quad\\big|\\ (A-E)^{-1}${D_}\\ \\text{zleva}`, `X=(A-E)^{-1}${D_}B`] },
  'XA=B+X': { eq: `X${D_}A=B+X`, side: 'R', alg: [`X${D_}A=B+X`, `X${D_}A-X=B`, `X${D_}A-X${D_}E=B`, `X${D_}(A-E)=B\\quad\\big|\\ ${D_}(A-E)^{-1}\\ \\text{zprava}`, `X=B${D_}(A-E)^{-1}`] },
  'AXB=C': { eq: `A${D_}X${D_}B=C`, side: 'LR', alg: [`A${D_}X${D_}B=C\\quad\\big|\\ A^{-1}${D_}\\ \\text{zleva}`, `E${D_}X${D_}B=A^{-1}${D_}C\\quad\\big|\\ ${D_}B^{-1}\\ \\text{zprava}`, `X${D_}E=A^{-1}${D_}C${D_}B^{-1}`, `X=A^{-1}${D_}C${D_}B^{-1}`] },
};
const factorTex = (d) => (d === 1 ? '' : d === -1 ? '-' : `${d < 0 ? '-' : ''}\\frac{1}{${Math.abs(d)}}`);
const algText = {
  L: 'Matice $A$ stojí u $X$ zleva, proto obě strany rovnice vynásobíme inverzní maticí ZLEVA: $A^{-1}A = E$ a $EX = X$. Násobení matic není komutativní – $A^{-1}B$ a $BA^{-1}$ jsou obecně různé matice, a kdybychom jednu stranu násobili zleva a druhou zprava, rovnost by přestala platit. Maticí se nedá dělit, proto nepíšeme $X = \\frac{B}{A}$.',
  R: 'Matice $A$ stojí u $X$ zprava, proto obě strany rovnice vynásobíme inverzní maticí ZPRAVA: $AA^{-1} = E$ a $XE = X$. Násobení matic není komutativní – $BA^{-1}$ a $A^{-1}B$ jsou obecně různé matice, takže pořadí v součinu musí zůstat. Maticí se nedá dělit, proto nepíšeme $X = \\frac{B}{A}$.',
  LR: 'Matice $A$ je u $X$ zleva a $B$ zprava. Obě strany proto násobíme maticí $A^{-1}$ zleva a pak maticí $B^{-1}$ zprava. Násobení matic není komutativní, takže výsledek je $A^{-1}CB^{-1}$ přesně v tomto pořadí.',
};
const algTextE = {
  L: 'Nejdřív převedeme všechna $X$ na jednu stranu a vytkneme je: $AX - X = (A - E)X$ (místo čísla 1 píšeme jednotkovou matici $E$). Matice $(A - E)$ stojí u $X$ zleva, proto obě strany vynásobíme inverzní maticí $(A - E)^{-1}$ ZLEVA. Pozor: inverzní matici tedy počítáme z matice $A - E$, ne z $A$. Násobení matic není komutativní, proto pořadí v součinu musí zůstat.',
  R: 'Nejdřív převedeme všechna $X$ na jednu stranu a vytkneme je: $XA - X = X(A - E)$ (místo čísla 1 píšeme jednotkovou matici $E$). Matice $(A - E)$ stojí u $X$ zprava, proto obě strany vynásobíme inverzní maticí $(A - E)^{-1}$ ZPRAVA. Pozor: inverzní matici tedy počítáme z matice $A - E$, ne z $A$. Násobení matic není komutativní, proto pořadí v součinu musí zůstat.',
};
function inverseStep(Mi, name, detName) {
  const n = Mi.length;
  const d = detInt(Mi);
  if (d === 0) throw new Error('maticová rovnice: singulární matice');
  const { adj, lines: cof } = adjugate(Mi, name === 'A' ? 'A' : name === 'B' ? 'B' : 'M');
  const inv = `${name.length > 1 ? name : name}^{-1}`;
  let board; let viz;
  if (n === 2) {
    board = [
      { tex: `${detName}=${par(Mi[0][0])}\\cdot ${par(Mi[1][1])}-${par(Mi[0][1])}\\cdot ${par(Mi[1][0])}=${d}` },
      { tex: `${inv}=\\frac{1}{${detName}}\\begin{pmatrix}${Mi[1][1]}&-${par(Mi[0][1])}\\\\-${par(Mi[1][0])}&${Mi[0][0]}\\end{pmatrix}` },
      { tex: `=${factorTex(d)}${pmatrix(adj)}` },
    ];
  } else {
    const dl = detLines(Mi, detName);
    viz = dl.viz;
    board = [...dl.lines, ...cof, { tex: `${inv}=\\frac{1}{${detName}}\\,\\mathrm{adj}` }, { tex: `=${factorTex(d)}${pmatrix(adj)}` }];
  }
  return {
    d, adj,
    step: {
      title: `Inverzní matice ${name.replace(/[\\{}]/g, '')}⁻¹`,
      text: n === 2
        ? `Determinant je $${d} \\neq 0$, matice je regulární a inverzní existuje. U matice 2. řádu prohodíme prvky na hlavní úhlopříčce, u prvků na vedlejší změníme znaménko a vše vynásobíme číslem $\\frac{1}{\\text{det}}$ (zlomek zatím necháme před maticí).`
        : `Determinant (Sarrus) je $${d} \\neq 0$, matice je regulární. Inverzní matici spočítáme přes adjungovanou matici: algebraické doplňky $${name === 'A' || name === 'B' ? name : 'M'}_{ij} = (-1)^{i+j}\\cdot$ subdeterminant zapíšeme do matice transponovaně (doplněk $_{ij}$ na místo $_{ji}$) a vynásobíme číslem $\\frac{1}{\\text{det}}$.`,
      board: dedupe(board),
      ...(viz ? { viz } : {}),
    },
  };
}
function solveMaticova(data) {
  const { form } = data;
  const F = FORMS[form];
  if (!F) throw new Error(`maticová rovnice: neznámý tvar ${form}`);
  const A = data.A; const n = A.length;
  const steps = [{
    title: 'Vyjádření neznámé X',
    text: form.includes('=B+X') ? algTextE[F.side] : algText[F.side],
    board: F.alg.map((t, i) => (i === F.alg.length - 1 ? { tex: cls('vzorec', t), notes: [{ kind: 'underline', target: 'bt-vzorec', label: 'pořadí!' }] } : { tex: t })),
  }];
  let Mi = A; let mName = 'A'; let detName = '|A|'; let R;
  if (form === 'AX+B=C' || form === 'XA+B=C') {
    R = intM(subM(frM(data.C), frM(data.B)));
    steps.push({ title: 'Rozdíl C − B', text: 'Matice odečítáme prvek po prvku (stejné pozice).', board: [{ tex: `C-B=${pmatrix(data.C)}-${pmatrix(data.B)}` }, { tex: `=${pmatrix(R)}` }] });
  } else if (form === 'AX=B+X' || form === 'XA=B+X') {
    Mi = intM(subM(frM(A), eye(n)));
    mName = '(A-E)'; detName = '|A-E|';
    R = data.B;
    steps.push({ title: 'Matice A − E', text: 'Jednotková matice $E$ má jedničky na hlavní úhlopříčce, jinde nuly. Odečíst $E$ znamená odečíst 1 od prvků na hlavní úhlopříčce.', board: [{ tex: `A-E=${pmatrix(A)}-${pmatrix(intM(eye(n)))}` }, { tex: `=${pmatrix(Mi)}` }] });
  } else if (form === 'AXB=C') R = data.C;
  else R = data.B;
  const I1 = inverseStep(Mi, mName, detName);
  steps.push(I1.step);
  let factorD = I1.d; let prodLines; let raw;
  // záporný činitel uprostřed součinu patří do závorky
  const parF = (d) => (d > 0 ? factorTex(d) : d === -1 ? '(-1)' : `\\left(${factorTex(d)}\\right)`);
  if (F.side === 'LR') {
    const I2 = inverseStep(data.B, 'B', '|B|');
    steps.push(I2.step);
    factorD = I1.d * I2.d;
    const f = factorTex(factorD);
    const e1 = productEntryLines(I1.adj, data.C, 'p');
    const e2 = productEntryLines(e1.val, I2.adj, 'q');
    prodLines = [
      ...chainLines('X=', [`${factorTex(I1.d)}${pmatrix(I1.adj)}`, pmatrix(data.C), `${parF(I2.d)}${pmatrix(I2.adj)}`]).map((t) => ({ tex: t })),
      ...(I1.d === 1 && I2.d === 1 ? [] : chainLines(`=${f}`, [pmatrix(I1.adj), pmatrix(data.C), pmatrix(I2.adj)]).map((t) => ({ tex: t }))),
      ...e1.lines,
      { tex: `P=${pmatrix(e1.val)}` },
      ...e2.lines,
      { tex: `=${f}${pmatrix(e2.val)}` },
    ];
    raw = e2.val;
  } else {
    const L = F.side === 'L';
    const e = L ? productEntryLines(I1.adj, R, 'p') : productEntryLines(R, I1.adj, 'p');
    const f = factorTex(I1.d);
    const inv = `${f}${pmatrix(I1.adj)}`;
    prodLines = [
      ...chainLines('X=', L ? [inv, pmatrix(R)] : [pmatrix(R), `${parF(I1.d)}${pmatrix(I1.adj)}`]).map((t) => ({ tex: t })),
      ...e.lines,
      { tex: `=${f}${pmatrix(e.val)}` },
    ];
    raw = e.val;
  }
  steps.push({
    title: 'Násobení matic',
    text: `Dosadíme do vzorce a násobíme v pořadí ze vzorce. Součin matic počítáme po prvcích: prvek $p_{ij}$ na pozici $(i, j)$ je součet součinů $i$-tého řádku levé matice a $j$-tého sloupce pravé matice – jeden prvek na jeden řádek tabule.${F.side === 'LR' ? ' Nejdřív spočítáme $P = $ součin prvních dvou matic ($p_{ij}$), pak $P$ vynásobíme třetí maticí ($q_{ij}$).' : ''}${factorD === 1 ? '' : ' Číslo před maticí vytkneme a vynásobíme jím až na konci.'}`,
    board: dedupe(prodLines),
  });
  const X = raw.map((r) => r.map((v) => fr(v, factorD)));
  const xt = pmatrix(X);
  steps.push({
    title: 'Výsledek',
    text: factorD === 1 ? 'Matice $X$ je hotová. Zkouška: dosazením do původní rovnice musí obě strany vyjít stejně.' : `Každý prvek vynásobíme číslem před maticí a zlomky zkrátíme. Zkouška: dosazením do původní rovnice musí obě strany vyjít stejně.`,
    board: [resultLine('X=', xt)],
  });
  const given = [['A', data.A], ['B', data.B], ['C', data.C]].filter(([, m]) => m);
  const rowsTex = given.map(([nm, m]) => `${nm}=${pmatrix(m)}`);
  const promptRows = n <= 2 && given.every(([, m]) => m[0].length <= 2) ? [rowsTex.slice(0, 2).join(',\\ '), ...rowsTex.slice(2)] : rowsTex;
  return {
    id: idOf('maticova-rovnice', data), topic: TOPIC, type: 'maticova-rovnice', data,
    task: 'Vyřeš maticovou rovnici s neznámou maticí $X$ (první řádek zadání). Prvky matice $X$ zapiš do mřížky, zlomky jako 3/4.',
    promptTex: `\\begin{gathered}${[F.eq, ...promptRows].join('\\\\ ')}\\end{gathered}`,
    answerSpec: { kind: 'matrix', value: X.map((r) => r.map(toNum)) },
    answerTex: `X=${xt}`,
    solution: steps,
  };
}
function randInvertible(rng, dets) {
  for (;;) {
    const M = [[ri(rng, -3, 4), ri(rng, -3, 4)], [ri(rng, -3, 4), ri(rng, -3, 4)]];
    if (M.flat().filter((v) => v !== 0).length < 3) continue;
    if (dets.includes(detInt(M))) return M;
  }
}
const randM = (rng, lo = -3, hi = 4) => [[ri(rng, lo, hi), ri(rng, lo, hi)], [ri(rng, lo, hi), ri(rng, lo, hi)]];
function genMaticova(rng) {
  const form = pick(rng, ['AX=B', 'XA=B', 'AX=B', 'XA=B', 'AX+B=C', 'XA+B=C', 'AX=B+X', 'XA=B+X', 'AXB=C']);
  for (;;) {
    const frac = rng() < 0.2;
    if (form === 'AXB=C') {
      const A = randInvertible(rng, [1, -1, 2, -2]); const B = randInvertible(rng, [1, -1]);
      const X = randM(rng, -2, 3);
      if (X.flat().every((v) => v === 0)) continue;
      const C = intM(mulM(mulM(frM(A), frM(X)), frM(B)));
      if (C.flat().some((v) => Math.abs(v) > 30)) continue;
      return solveMaticova({ form, A, B, C });
    }
    const M = randInvertible(rng, frac ? [2, -2, 3, -3] : [1, -1, 2, -2]);
    let R;
    if (frac) {
      R = randM(rng);
      const Xf = F_side(form) === 'L' ? mulM(invFr(M), frM(R)) : mulM(frM(R), invFr(M));
      if (Xf.every((r) => r.every((x) => x.d === 1))) continue;
    } else {
      const X = randM(rng);
      if (X.flat().filter((v) => v !== 0).length < 2) continue;
      R = intM(F_side(form) === 'L' ? mulM(frM(M), frM(X)) : mulM(frM(X), frM(M)));
    }
    if (R.flat().some((v) => Math.abs(v) > 25) || R.flat().every((v) => v === 0)) continue;
    if (form === 'AX=B' || form === 'XA=B') return solveMaticova({ form, A: M, B: R });
    if (form === 'AX=B+X' || form === 'XA=B+X') return solveMaticova({ form, A: intM(addM(frM(M), eye(2))), B: R });
    const B = randM(rng);
    return solveMaticova({ form, A: M, B, C: intM(addM(frM(R), frM(B))) });
  }
}
const F_side = (form) => FORMS[form].side;
const invFr = (M) => { const d = detInt(M); return [[fr(M[1][1], d), fr(-M[0][1], d)], [fr(-M[1][0], d), fr(M[0][0], d)]]; };

// =====================================================================
const theory = [
  {
    heading: 'Soustava lineárních rovnic a její matice',
    text: 'Soustava $m$ lineárních rovnic o $n$ neznámých má v každé rovnici neznámé jen v první mocnině, násobené čísly (koeficienty), a vpravo číslo (pravou stranu). Řešením je uspořádaná $n$-tice čísel, která po dosazení splní všechny rovnice najednou.\n\nKoeficienty zapíšeme po řádcích do matice soustavy $A$ (jeden řádek = jedna rovnice, jeden sloupec = jedna neznámá). Když za svislou čáru připíšeme sloupec pravých stran $\\mathbf{b}$, vznikne rozšířená matice soustavy $A_r = (A\\,|\\,\\mathbf{b})$. Chybí-li v rovnici neznámá, má koeficient 0.\n\nSoustava, která má všechny pravé strany nulové, se jmenuje homogenní.',
    tex: '\\begin{gathered}\\begin{aligned}x_1+2x_2-x_3&=4\\\\ 3x_1-x_3&=1\\end{aligned}\\\\[4pt] A_r=\\left(\\begin{array}{rrr|r}1&2&-1&4\\\\ 3&0&-1&1\\end{array}\\right)\\end{gathered}',
    mistakes: [
      'Vynechat chybějící neznámou místo zapsání nuly – sloupce se pak posunou a matice neodpovídá soustavě.',
      'Zapomenout znaménko: u $-x_3$ je koeficient $-1$, ne 1.',
      'Rovnice musí mít neznámé ve stejném pořadí; rovnici $x_2 + x_1 = 3$ zapíšeme jako řádek $(1\\ 1 \\mid 3)$ ve správných sloupcích.',
    ],
  },
  {
    heading: 'Frobeniova věta – kolik má soustava řešení',
    text: 'Soustava je řešitelná právě tehdy, když matice soustavy a rozšířená matice mají stejnou hodnost: $h(A) = h(A_r)$. Hodnost je počet nenulových řádků po převedení na schodovitý tvar.\n\nMohou nastat tři případy ($n$ = počet neznámých):\n• $h(A) < h(A_r)$ – soustava nemá řešení (ve schodovitém tvaru je řádek $0\\ 0 \\dots 0 \\mid c$ s $c \\neq 0$),\n• $h(A) = h(A_r) = n$ – právě jedno řešení,\n• $h(A) = h(A_r) < n$ – nekonečně mnoho řešení; vyjádříme je pomocí $n - h(A)$ parametrů (volných neznámých).\n\nHodnost $h(A_r)$ je vždy buď stejná jako $h(A)$, nebo o 1 větší (přibyl jen jeden sloupec).',
    tex: '\\text{řešitelná}\\iff h(A)=h(A_r)',
    mistakes: [
      'Počítat $h(A)$ včetně sloupce pravých stran. Pro $h(A)$ se díváme jen vlevo od čáry.',
      'Řádek $(0\\ 0\\ 0 \\mid 0)$ považovat za spor. Je to rovnice $0 = 0$, která vždy platí – jen se vynechá.',
      'Srovnávat hodnost s počtem rovnic místo s počtem neznámých $n$.',
    ],
  },
  {
    heading: 'Gaussova eliminační metoda',
    text: 'Rozšířenou matici převedeme řádkovými úpravami na schodovitý tvar (pod každým pivotem jsou nuly a každý další řádek začíná víc vpravo). Povolené úpravy: výměna dvou řádků, vynásobení řádku nenulovým číslem, přičtení násobku jiného řádku. Se sloupci nehýbeme – každý sloupec patří jedné neznámé.\n\nPak rozhodneme podle Frobeniovy věty a pokud je soustava řešitelná, přepíšeme řádky zpět na rovnice a řešíme je odspodu (zpětné dosazení): z poslední rovnice spočítáme jednu neznámou, dosadíme ji do rovnice nad ní atd.\n\nNeznámé, které ve schodovitém tvaru nemají pivot, jsou volné: za každou zvolíme parametr ($t$, $s$, …) a ostatní neznámé vyjádříme pomocí něj. Výsledek pak zapíšeme jako $n$-tici s parametrem, např. $(3-t,\\ 1+2t,\\ t)$, $t \\in \\mathbb{R}$. Parametry lze zvolit i jinak – zápis vypadá jinak, ale popisuje stejnou množinu řešení.',
    mistakes: [
      'Měnit při úpravě jen část řádku – násobí se a sčítá celý řádek včetně pravé strany.',
      'Vynásobit řádek nulou nebo prohazovat sloupce.',
      'Při dosazování parametru do rovnice zapomenout závorku: $x_1 - 2(1+t) = 3$, ne $x_1 - 2 + t = 3$.',
      'U nekonečně mnoha řešení napsat jen jedno konkrétní řešení – je potřeba celé řešení s parametrem.',
    ],
  },
  {
    heading: 'Úplná (Jordanova) eliminace',
    text: 'Jordanova metoda pokračuje tam, kde Gaussova skončí. Po přímém chodu (nuly pod pivoty) nulujeme i nad pivoty, postupně od posledního pivotu nahoru (zpětný chod).\n\nMá-li soustava jedno řešení, na konci každý řádek vydělíme jeho pivotem, vznikne vlevo jednotková matice a řešení přečteme přímo ve sloupci pravých stran – žádné dosazování. Má-li nekonečně mnoho řešení, dělit pivoty nemusíme: každá rovnice obsahuje jen jednu vedoucí neznámou a volné neznámé (parametry), takže vedoucí neznámou rovnou vyjádříme.\n\nStejný postup slouží k výpočtu inverzní matice: $(A \\mid E) \\sim \\dots \\sim (E \\mid A^{-1})$.',
    mistakes: [
      'Nulovat nad pivoty dřív, než je hotový schodovitý tvar – zbytečně přibydou výpočty.',
      'U soustavy s jediným řešením na konci zapomenout vydělit řádky pivotem; výsledek je pak násobek správného čísla.',
    ],
  },
  {
    heading: 'Homogenní soustavy',
    text: 'Homogenní soustava má všechny pravé strany rovné nule. Je vždy řešitelná: matice $A$ a $A_r$ se liší jen nulovým sloupcem, takže $h(A) = h(A_r)$, a $n$-tice samých nul je vždy řešením (triviální řešení).\n\nZbývají dvě možnosti: je-li $h(A) = n$, má soustava jen triviální řešení; je-li $h(A) < n$, má nekonečně mnoho řešení (i netriviální) s $n - h(A)$ parametry. Toho se využívá při rozhodování o lineární závislosti vektorů.\n\nPři eliminaci zůstává nulový sloupec pravých stran pořád nulový, proto se někdy ani nepíše.',
    tex: 'A\\cdot\\mathbf{x}=\\mathbf{o}',
    mistakes: [
      'Psát „nemá řešení“ – homogenní soustava řešení vždy má, aspoň samé nuly.',
      'Při nekonečně mnoha řešeních zapsat jen triviální řešení $(0, 0, 0)$.',
    ],
  },
  {
    heading: 'Soustava s parametrem',
    text: 'Je-li v soustavě neznámé číslo – parametr $k$ – ptáme se, pro které hodnoty $k$ má soustava řešení. Postupujeme jako obvykle: rozšířenou matici upravíme na schodovitý tvar a s výrazy obsahujícími $k$ počítáme stejně jako s čísly.\n\nVyjde-li vlevo nulový řádek a vpravo výraz s $k$ (např. $0 \\mid 6 - 2k$), je soustava podle Frobeniovy věty řešitelná jen tehdy, když je tento výraz nulový – jinak by bylo $h(A) < h(A_r)$. Řešením lineární rovnice dostaneme hledané $k$. Pro ně pak podle hodnosti určíme, zda má soustava jedno, nebo nekonečně mnoho řešení.',
    mistakes: [
      'Dělit řádek výrazem s $k$ – ten může být nulový. Násobit a dělit se smí jen nenulovým číslem.',
      'Zapomenout, že pro ostatní hodnoty $k$ soustava řešení nemá.',
    ],
  },
  {
    heading: 'Cramerovo pravidlo',
    text: 'Pro soustavu $n$ rovnic o $n$ neznámých se čtvercovou maticí $A$, jejíž determinant $D = |A| \\neq 0$ (matice je regulární), existuje právě jedno řešení a dá se spočítat pomocí determinantů:\n\n$x_k = \\frac{D_k}{D}$, kde $D_k$ vznikne z $D$ tak, že $k$-tý sloupec nahradíme sloupcem pravých stran.\n\nPro soustavu tří rovnic tedy spočítáme čtyři determinanty 3. řádu (Sarrusovým pravidlem). Pro velké soustavy je Gaussova eliminace rychlejší.',
    tex: 'x_k=\\frac{D_k}{D},\\qquad D=|A|\\neq 0',
    mistakes: [
      'Použít Cramerovo pravidlo při $D = 0$. Pak soustava buď nemá řešení, nebo jich má nekonečně mnoho – rozhodne Gaussova eliminace.',
      'Nahradit řádek místo sloupce, nebo nahradit jiný sloupec, než patří k počítané neznámé.',
      'Prohodit čitatel a jmenovatel: dělí se vždy determinantem soustavy $D$.',
    ],
  },
  {
    heading: 'Maticové rovnice',
    text: 'V maticové rovnici je neznámou matice $X$. Řešíme ji podobně jako rovnici s čísly, jen místo dělení násobíme inverzní maticí. Využíváme $A^{-1}A = AA^{-1} = E$ a $EX = XE = X$ ($E$ je jednotková matice). Inverzní matice existuje jen k regulární matici ($|A| \\neq 0$).\n\nNásobení matic není komutativní ($AB \\neq BA$), proto záleží na straně:\n• $A X = B$: násobíme maticí $A^{-1}$ zleva, $X = A^{-1} B$,\n• $X A = B$: násobíme maticí $A^{-1}$ zprava, $X = B A^{-1}$,\n• $A X B = C$: zleva $A^{-1}$ a zprava $B^{-1}$, $X = A^{-1} C B^{-1}$.\n\nNejdřív výraz upravíme jako v algebře: $AX + B = C \\Rightarrow AX = C - B$. Je-li $X$ ve více členech, vytkneme ho na správnou stranu a místo čísla 1 napíšeme $E$: $AX - X = (A - E)X$, ale $XA - X = X(A - E)$.\n\nInverzní matici 2. řádu získáme rychle: $\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}$. Pro 3. řád použijeme adjungovanou matici nebo Jordanovu metodu.',
    tex: 'A X=B\\ \\Rightarrow\\ X=A^{-1}B,\\qquad XA=B\\ \\Rightarrow\\ X=BA^{-1}',
    mistakes: [
      'Napsat $X = BA^{-1}$ u rovnice $AX = B$ (nebo naopak). Strana násobení musí odpovídat straně, kde u $X$ stojí $A$.',
      'Dělit maticí, např. $X = \\frac{B}{A}$ – maticí dělit nelze.',
      'Vytknout $X$ jako $(A - 1)X$ – od matice nelze odečíst číslo, správně je $(A - E)X$.',
      'Násobit jednu stranu rovnice zleva a druhou zprava.',
    ],
  },
];

export default {
  id: TOPIC,
  title: 'Soustavy lineárních rovnic',
  order: 4,
  theory,
  types: [
    { id: 'gauss', title: 'Gaussova eliminace', generate: genGauss, solve: solveGauss },
    { id: 'frobenius', title: 'Frobeniova věta (hodnosti)', generate: genFrobenius, solve: solveFrobenius },
    { id: 'homogenni', title: 'Homogenní soustava', generate: genHomogenni, solve: solveHomogenni },
    { id: 'jordan', title: 'Úplná (Jordanova) eliminace', generate: genJordan, solve: solveJordan },
    { id: 'parametr-k', title: 'Soustava s parametrem k', generate: genParametrK, solve: solveParametrK },
    { id: 'cramer', title: 'Cramerovo pravidlo', generate: genCramer, solve: solveCramer },
    { id: 'maticova-rovnice', title: 'Maticové rovnice', generate: genMaticova, solve: solveMaticova },
  ],
};
