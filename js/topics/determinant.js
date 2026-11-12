// Téma 3: Determinant, adjungovaná matice (podle probírané látky; zdrojové soubory jsou jen lokálně).
// Typy příkladů podle materiálů (konkrétní příklady z nich jsou jen v content/, ne v gitu):
//  - det2        determinant 2. řádu křížovým pravidlem
//  - sarrus      determinant 3. řádu Sarrusovým pravidlem
//  - rozvoj      Laplaceův rozvoj podle řádku/sloupce s nejvíce nulami
//  - uprava      vyšší řád: nuly ve sloupci řádkovými úpravami + rozvoj
//  - schodovity  převod na schodovitý tvar, součin diagonály
//  - vlastnosti  jak úpravy matice mění determinant
//  - parametr    rovnice a nerovnice s determinantem
//  - adjungovana inverzní matice přes adjungovanou
//  - cramer      Cramerovo pravidlo
//  - aplikace    maticová rovnice AX = B v ekonomické úloze
// Vzor struktury: js/topics/vektory.js (theory, types s generate(rng) a solve(data)).
import { fr, mul, frTex, toNum, gcd } from '../lin.js';
import {
  minor, transpose, copy, detInt, cofactor, sarrusParts, sarrusViz,
  pAdd, pSub, pMul, pScale, pDeg, pTex, entryTex, rationalRoots, clearColumn, pickKey, zeroColumn, zeroRow,
  SARRUS_PLUS, SARRUS_MINUS,
} from './determinant-lib.js';

const TOPIC = 'determinant';
// Řádek tabule bez poznámek a mezer (stejně jako kontrola v testech).
const flatTex = (t) => String(t ?? '').replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '').replace(/\\[,;:! ]/g, '')
  .replace(/\\left|\\right/g, '').replace(/[{}\s]/g, '');

// ---------- zápis do TeXu ----------
const par = (x) => (x < 0 ? `(${x})` : `${x}`);
const cls = (name, tex) => `\\htmlClass{bt-${name}}{${tex}}`;
const RESULT = 'vysledek';
const resultLine = (pre, tex) => ({ tex: `${pre}${cls(RESULT, tex)}`, notes: [{ kind: 'doubleUnderline', target: `bt-${RESULT}` }] });
const signed = (nums) => nums.map((x, i) => (i === 0 ? `${x}` : x < 0 ? `-${-x}` : `+${x}`)).join('');
const minus = (s) => String(s).replace(/-/g, '−');
const cell = (v) => (typeof v === 'object' ? frTex(v) : String(v));
const env = (name, M, wrap) => `\\begin{${name}}${M.map((r, i) => r.map((v, j) => (wrap ? wrap(i, j, cell(v)) : cell(v))).join('&')).join('\\\\')}\\end{${name}}`;
const vm = (M, wrap) => env('vmatrix', M, wrap);
const pm = (M, wrap) => env('pmatrix', M, wrap);
const idOf = (type, data) => `${TOPIC}-${type}-${JSON.stringify(data).replace(/[^0-9a-z-]+/gi, '.')}`;
const ord = (k) => `${k}.`;
const regText = (v) => (v === 0 ? 'Determinant je nulový, matice je singulární (inverzní matice neexistuje).' : 'Determinant je nenulový, matice je regulární (inverzní matice existuje).');
// Součin čísel s „\cdot“, záporná v závorkách
const prodTex = (xs) => xs.map(par).join('\\cdot ');
// Koeficient (zlomek) před determinantem: 1 -> '', -1 -> '-', 1/2 -> '\frac{1}{2}\cdot '
function coefTex(c) {
  if (c.n === c.d) return '';
  if (c.n === -c.d) return '-';
  return `${frTex(c)}\\cdot `;
}
// Odstraní řádek tabule, který je (bez poznámek a mezer) stejný jako předchozí.
function finalize(steps) {
  let prev = null;
  for (const s of steps) {
    s.board = s.board.filter((l) => {
      const f = flatTex(l.tex);
      const dup = f === prev;
      prev = f;
      return !dup;
    });
  }
  return steps;
}

// ---------- pomůcky losování ----------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const rnz = (rng, lo, hi) => { let v = 0; while (v === 0) v = ri(rng, lo, hi); return v; };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const rmat = (rng, n, lo, hi) => Array.from({ length: n }, () => Array.from({ length: n }, () => ri(rng, lo, hi)));
const maxAbs = (M) => Math.max(...M.flat().map(Math.abs));
const hasZeroLine = (M) => zeroRow(M) >= 0 || zeroColumn(M) >= 0;

// ---------- společné kroky ----------
// Sarrusovo pravidlo krok za krokem (3 kroky: schéma, + diagonály, − diagonály) + výsledek.
function sarrusSteps(M, name = '|A|', { cellsViz } = {}) {
  const { P, Q, S1, S2, value } = sarrusParts(M);
  const diagLines = (D, vals, letter) => D.map((d, k) => ({ tex: `${letter}_{${k + 1}}=${prodTex(d.map(([i, j]) => M[i][j]))}=${vals[k]}` }));
  const steps = [
    {
      title: 'Sarrusovo pravidlo',
      text: 'Za determinant znovu opíšeme 1. a 2. sloupec (podbarvené). Součiny po třech číslech ve směru hlavní diagonály (oranžově, dolů doprava) se přičítají, součiny ve směru vedlejší diagonály (červeně, dolů doleva) se odečítají.',
      board: [{ tex: `${name}=${vm(M)}` }],
      viz: sarrusViz(cellsViz || M.map((r) => r.map((v) => minus(v)))),
    },
    {
      title: 'Součiny se znaménkem +',
      text: 'Vynásobíme trojice čísel na třech oranžových čarách. Záporná čísla píšeme do závorek. Na konci součiny sečteme.',
      board: [...diagLines(SARRUS_PLUS, P, 'p'), { tex: `p_1+p_2+p_3=${signed(P)}=${S1}` }],
    },
    {
      title: 'Součiny se znaménkem −',
      text: 'Stejně vynásobíme trojice na červených čarách a součiny sečteme. Tento součet se bude celý odečítat.',
      board: [...diagLines(SARRUS_MINUS, Q, 'q'), { tex: `q_1+q_2+q_3=${signed(Q)}=${S2}` }],
    },
  ];
  return { steps, value, S1, S2, last: [{ tex: `${name}=${S1}-${par(S2)}` }] };
}
// Krátký Sarrus pro subdeterminant: jen hodnoty součinů.
function sarrusShort(M) {
  const { P, Q, S1, S2, value } = sarrusParts(M);
  return { value, lines: [`(${signed(P)})-(${signed(Q)})`, `${S1}-${par(S2)}`] };
}
// Řádky tabule pro Sarrusův výpočet krátce: (součet +)  /  −(součet −)  /  S1−S2=hodnota.
function sarrusRows(M, pre, open = '', close = '') {
  const { P, Q, S1, S2, value } = sarrusParts(M);
  return [
    { tex: `${pre}${open}(${signed(P)})` },
    { tex: `\\quad-(${signed(Q)})${close}` },
    { tex: `\\quad=${S1}-${par(S2)}=${value}` },
  ];
}
// Hodnota determinantu 2. řádu jako text výpočtu.
const cross = (m) => `${prodTex([m[0][0], m[1][1]])}-${prodTex([m[0][1], m[1][0]])}`;

// =====================================================================
// Typ 1: determinant 2. řádu
function solveDet2(data) {
  const { M } = data;
  const [[a, b], [c, d]] = M;
  const p = a * d; const q = b * c; const v = p - q;
  const steps = [
    {
      title: 'Křížové pravidlo',
      text: 'Determinant matice 2×2 je součin čísel na hlavní diagonále (zleva shora doprava dolů) minus součin čísel na vedlejší diagonále (zprava shora doleva dolů).',
      board: [{ tex: `|A|=${vm(M)}` }, { tex: '=a_{11}a_{22}-a_{12}a_{21}' }],
    },
    {
      title: 'Dosazení',
      text: 'Dosadíme čísla, záporná do závorek. Oranžově je hodnota každého součinu.',
      board: [{
        tex: `=${cls('p1', prodTex([a, d]))}-${cls('p2', prodTex([b, c]))}`,
        notes: [{ kind: 'brace', target: 'bt-p1', label: minus(p) }, { kind: 'brace', target: 'bt-p2', label: minus(q), position: 'below' }],
      }],
    },
    {
      title: 'Výsledek',
      text: `Od prvního součinu odečteme druhý (pozor na odčítání záporného čísla). ${regText(v)}`,
      board: [{ tex: `=${p}-${par(q)}` }, resultLine('|A|=', String(v))],
    },
  ];
  return {
    id: idOf('det2', data), topic: TOPIC, type: 'det2', data,
    task: 'Vypočítej determinant matice $A$ (výsledek je celé číslo).',
    promptTex: `A=${pm(M)}`,
    answerSpec: { kind: 'number', value: v },
    answerTex: `|A|=${v}`,
    solution: finalize(steps),
  };
}
function genDet2(rng) {
  for (;;) {
    const M = rmat(rng, 2, -9, 9);
    if (M.flat().filter((x) => x === 0).length > 1 || detInt(M) === 0) continue;
    return solveDet2({ M });
  }
}

// =====================================================================
// Typ 2: Sarrusovo pravidlo
function solveSarrus(data) {
  const { M } = data;
  const s = sarrusSteps(M);
  const v = s.value;
  s.steps.push({
    title: 'Výsledek',
    text: `Od součtu „plusových“ součinů odečteme součet „minusových“. ${regText(v)}`,
    board: [...s.last, resultLine('|A|=', String(v))],
  });
  return {
    id: idOf('sarrus', data), topic: TOPIC, type: 'sarrus', data,
    task: 'Vypočítej determinant matice $A$ Sarrusovým pravidlem (výsledek je celé číslo).',
    promptTex: `A=${pm(M)}`,
    answerSpec: { kind: 'number', value: v },
    answerTex: `|A|=${v}`,
    conclusion: regText(v),
    solution: finalize(s.steps),
  };
}
function genSarrus(rng) {
  for (;;) {
    const M = rmat(rng, 3, -4, 5);
    if (M.flat().filter((x) => x === 0).length > 2 || hasZeroLine(M)) continue;
    const v = detInt(M);
    if ((v === 0 && rng() < 0.8) || Math.abs(v) > 150) continue;
    return solveSarrus({ M });
  }
}

// =====================================================================
// Typ 3: Laplaceův rozvoj podle řádku nebo sloupce s nejvíce nulami
function bestLine(M) {
  const n = M.length;
  let best = { kind: 'row', index: 0, zeros: -1 };
  for (let i = 0; i < n; i++) {
    const z = M[i].filter((x) => x === 0).length;
    if (z > best.zeros) best = { kind: 'row', index: i, zeros: z };
  }
  for (let j = 0; j < n; j++) {
    const z = M.filter((r) => r[j] === 0).length;
    if (z > best.zeros) best = { kind: 'col', index: j, zeros: z };
  }
  return best;
}
const signChar = (i, j) => ((i + j) % 2 ? '-' : '+');
function solveRozvoj(data) {
  const { M } = data;
  const n = M.length;
  const line = data.line || bestLine(M);
  const isRow = line.kind === 'row';
  const k = line.index;
  const pos = Array.from({ length: n }, (_, t) => (isRow ? [k, t] : [t, k]));
  const inLine = (i, j) => (isRow ? i === k : j === k);
  const lineName = `${ord(k + 1)} ${isRow ? 'řádku' : 'sloupce'}`;
  const zeros = pos.filter(([i, j]) => M[i][j] === 0).length;
  const terms = pos.filter(([i, j]) => M[i][j] !== 0).map(([i, j]) => ({ i, j, a: M[i][j], s: (i + j) % 2 ? -1 : 1, m: minor(M, i, j) }));
  terms.forEach((t) => { t.v = detInt(t.m); });
  const steps = [];
  const signs = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => signChar(i, j)));
  steps.push({
    title: 'Výběr řádku nebo sloupce',
    text: `Determinant můžeme rozvinout podle libovolného řádku nebo sloupce. Vybereme ${ord(k + 1)} ${isRow ? 'řádek' : 'sloupec'} (oranžově), protože má nejvíc nul (${zeros}) – každá nula znamená jeden subdeterminant, který nemusíme počítat. Znaménka $(-1)^{i+j}$ tvoří šachovnici: v levém horním rohu je +, pak se střídají.`,
    board: [
      { tex: `|A|=${vm(M, (i, j, t) => (inLine(i, j) ? cls('rad', t) : t))}`, notes: [{ kind: 'color', target: 'bt-rad' }] },
      { tex: `\\text{znaménka: }${env('matrix', signs, (i, j, t) => (inLine(i, j) ? cls('zn', t) : t))}`, notes: [{ kind: 'color', target: 'bt-zn' }] },
    ],
    viz: {
      kind: 'matrix',
      data: {
        rows: signs.map((r) => r.map((c) => (c === '-' ? '−' : '+'))),
        highlight: isRow ? { rows: [k] } : { cols: [k] },
        caption: `znaménka (−1)^(i+j), vybraný ${isRow ? 'řádek' : 'sloupec'}`,
        alt: 'Šachovnice znamének algebraických doplňků',
      },
    },
  });
  if (!terms.length) {
    steps.push({ title: 'Nulová řada', text: 'Celá vybraná řada je nulová, všechny členy rozvoje jsou nulové.', board: [{ tex: '|A|=0+0+\\dots' }] });
    steps.push({ title: 'Výsledek', text: 'Determinant s nulovým řádkem nebo sloupcem je roven nule.', board: [resultLine('|A|=', '0')] });
  } else {
    steps.push({
      title: `Rozvoj podle ${lineName}`,
      text: `Každý nenulový prvek vybrané řady vynásobíme znaménkem $(-1)^{i+j}$ (i = řádek, j = sloupec prvku) a subdeterminantem, který vznikne vynecháním řádku a sloupce tohoto prvku.${zeros ? ' Členy s nulou vynecháme – nula krát cokoli je nula.' : ''}`,
      board: terms.flatMap((t, q) => [
        { tex: `${q === 0 ? '|A|=' : '\\quad +'}${par(t.a)}\\cdot(-1)^{${t.i + t.j + 2}}\\cdot` },
        { tex: `\\qquad ${vm(t.m)}` },
      ]),
    });
    const sub = [];
    for (const t of terms) {
      if (t.m.length === 2) {
        sub.push({ tex: `${vm(t.m)}=` }, { tex: `\\quad=${cross(t.m)}` }, { tex: `\\quad=${t.v}` });
      } else {
        sub.push({ tex: `${vm(t.m)}=` }, ...sarrusRows(t.m, '\\quad='));
      }
    }
    steps.push({
      title: 'Subdeterminanty',
      text: t3Text(terms[0].m.length),
      board: sub,
    });
    const coefs = terms.map((t) => t.a * t.s);
    const prods = terms.map((t, q) => coefs[q] * t.v);
    const v = prods.reduce((x, y) => x + y, 0);
    const lines = terms.map((t, q) => ({ tex: `${q ? '\\quad +' : '|A|='}${par(t.a)}\\cdot(${t.s})\\cdot ${par(t.v)}` }));
    if (terms.length > 1) lines.push({ tex: `=${signed(prods)}` });
    lines.push(resultLine('|A|=', String(v)));
    steps.push({
      title: 'Sečtení',
      text: `Dosadíme hodnoty subdeterminantů a znaménka $(-1)^{i+j}$ a vše sečteme. ${regText(v)}`,
      board: lines,
    });
  }
  const v = detInt(M);
  return {
    id: idOf('rozvoj', data), topic: TOPIC, type: 'rozvoj', data,
    task: 'Vypočítej determinant matice $A$ rozvojem podle vhodného řádku nebo sloupce (výsledek je celé číslo).',
    promptTex: `A=${pm(M)}`,
    answerSpec: { kind: 'number', value: v },
    answerTex: `|A|=${v}`,
    solution: finalize(steps),
  };
}
const t3Text = (m) => (m === 2
  ? 'Subdeterminanty 2. řádu spočítáme křížovým pravidlem: součin na hlavní diagonále minus součin na vedlejší.'
  : 'Subdeterminanty 3. řádu spočítáme Sarrusovým pravidlem: v první závorce jsou součiny ve směru hlavní diagonály, ve druhé ve směru vedlejší.');
function genRozvoj(rng) {
  for (;;) {
    const n = rng() < 0.55 ? 3 : 4;
    const M = rmat(rng, n, n === 3 ? -4 : -3, n === 3 ? 5 : 4);
    const kind = rng() < 0.5 ? 'row' : 'col';
    const k = ri(rng, 0, n - 1);
    const nz = n === 3 ? pick(rng, [1, 1, 2]) : pick(rng, [2, 2, 3]);
    const idx = Array.from({ length: n }, (_, t) => t).sort(() => rng() - 0.5).slice(0, nz);
    for (let t = 0; t < n; t++) {
      const [i, j] = kind === 'row' ? [k, t] : [t, k];
      if (idx.includes(t)) M[i][j] = 0; else if (M[i][j] === 0) M[i][j] = rnz(rng, -3, 4);
    }
    const best = bestLine(M);
    if (best.zeros !== nz || hasZeroLine(M)) continue;
    const v = detInt(M);
    if (v === 0 || Math.abs(v) > 200) continue;
    return solveRozvoj({ M });
  }
}

// =====================================================================
// Typ 4: vyšší řád – nuly ve sloupci řádkovými úpravami a rozvoj (i opakovaně)
function solveUprava(data) {
  const steps = [];
  let M = copy(data.M);
  let coef = fr(1);
  let first = true;
  const pre = () => (first ? '|A|=' : '=');
  let value = null;
  while (M.length > 3 && value === null) {
    const zc = zeroColumn(M); const zr = zeroRow(M);
    if (zc >= 0 || zr >= 0) {
      const inZ = (i, j) => (zr >= 0 ? i === zr : j === zc);
      const zName = zr >= 0 ? `${ord(zr + 1)} řádek` : `${ord(zc + 1)} sloupec`;
      steps.push({
        title: 'Nulová řada',
        text: `${zName} ${first ? '' : 'zbylého determinantu '}obsahuje samé nuly${first ? ' (oranžově)' : ''}. To je vlastnost, kterou stačí poznat – nic se nemusí počítat.`,
        board: [first
          ? { tex: `|A|=${vm(M, (i, j, t) => (inZ(i, j) ? cls('nul', t) : t))}`, notes: [{ kind: 'color', target: 'bt-nul' }] }
          : { tex: `\\text{${zName}: samé nuly}` }],
      });
      steps.push({
        title: 'Rozvoj podle nulové řady',
        text: `Rozvineme determinant podle této řady: každý člen rozvoje je nula krát algebraický doplněk, takže je nulový a determinant je 0.`,
        board: [{ tex: `=${coefTex(coef)}(0\\cdot A_{1}+0\\cdot A_{2}+\\dots)` }, { tex: '=0' }],
      });
      value = 0;
      break;
    }
    const { p, c } = pickKey(M);
    const key = M[p][c];
    const r = clearColumn(M, p, c);
    const n = M.length;
    steps.push({
      title: `Klíčový prvek (řád ${n})`,
      text: `Pro determinant ${n}. řádu se Sarrusovo pravidlo nedá použít. Ve ${ord(c + 1)} sloupci zvolíme klíčový prvek ${minus(key)} (${ord(p + 1)} řádek, oranžově)${Math.abs(key) === 1 ? ' – jednička se hodí, protože jejími násobky vynulujeme ostatní čísla ve sloupci bez zlomků' : ''}. Klíčový řádek se opisuje beze změny a řádky nepřehazujeme.`,
      board: [first
        ? { tex: `${pre()}${coefTex(coef)}${vm(M, (i, j, t) => (i === p && j === c ? cls('klic', t) : t))}`, notes: [{ kind: 'color', target: 'bt-klic' }] }
        : { tex: `\\text{klíčový prvek: }a_{${p + 1}${c + 1}}=${cls('klic', String(key))}`, notes: [{ kind: 'color', target: 'bt-klic' }] }],
    });
    first = false;
    const scaled = r.factor.n !== r.factor.d;
    const newCoef = mul(coef, r.factor);
    const sMinor = minor(r.matrix, p, c);
    const sign = (p + c) % 2 ? -1 : 1;
    if (r.ops.length) {
      steps.push({
        title: 'Nuly ve sloupci',
        text: `K ostatním řádkům přičteme vhodné násobky klíčového řádku, aby ve ${ord(c + 1)} sloupci vznikly nuly. Přičtení násobku jiného řádku hodnotu determinantu nemění.${scaled ? ' Když musíme upravovaný řádek nejdřív vynásobit číslem, determinant se tím číslem zvětší – proto ho před determinantem zase vydělíme (zlomek vpředu).' : ''}`,
        board: [{ tex: `=${coefTex(newCoef)}${vm(r.matrix, (i, j, t) => (j === c ? cls('sl', t) : t))}`, notes: [{ kind: 'color', target: 'bt-sl' }] }],
        viz: {
          kind: 'gauss',
          data: {
            steps: [
              { matrix: M.map((row) => row.map(minus)), pivot: [p, c] },
              { op: r.ops.join(',  '), matrix: r.matrix.map((row) => row.map(minus)), pivot: [p, c], changed: r.changed },
            ],
            alt: 'Řádkové úpravy: nuly ve sloupci klíčového prvku',
          },
        },
      });
    }
    coef = mul(newCoef, fr(key * sign));
    steps.push({
      title: `Rozvoj podle ${ord(c + 1)} sloupce`,
      text: `Ve sloupci zbyl jediný nenulový prvek ${minus(key)}, takže rozvoj má jen jeden člen: prvek krát $(-1)^{${p + 1}+${c + 1}}$ krát subdeterminant bez ${ord(p + 1)} řádku a ${ord(c + 1)} sloupce.`,
      board: [
        { tex: `=${coefTex(newCoef)}${par(key)}\\cdot(-1)^{${p + c + 2}}\\cdot` },
        { tex: `\\qquad ${vm(sMinor)}` },
        { tex: `=${coefTex(coef)}${vm(sMinor)}` },
      ],
    });
    M = sMinor;
  }
  if (value === null) {
    const s = sarrusParts(M);
    value = s.value;
    const c = coefTex(coef);
    steps.push({
      title: 'Sarrusovo pravidlo',
      text: 'Zbyl determinant 3. řádu, spočítáme ho Sarrusovým pravidlem (opíšeme 1. a 2. sloupec; oranžové součiny přičítáme, červené odečítáme).',
      board: c
        ? [...sarrusRows(M, `=${c}`, '[', ']').slice(0, 2), { tex: `=${c}(${s.S1}-${par(s.S2)})` }, { tex: `=${c}${par(s.value)}` }]
        : [...sarrusRows(M, '=').slice(0, 2), { tex: `=${s.S1}-${par(s.S2)}` }, { tex: `=${s.value}` }],
      viz: sarrusViz(M.map((r) => r.map(minus))),
    });
  }
  const v = toNum(mul(coef, fr(value)));
  const vFinal = value === 0 ? 0 : v;
  steps.push({
    title: 'Výsledek',
    text: `Vynásobíme číslo před determinantem hodnotou determinantu. ${regText(vFinal)}`,
    board: [resultLine('|A|=', String(vFinal))],
  });
  return {
    id: idOf('uprava', data), topic: TOPIC, type: 'uprava', data,
    task: `Vypočítej determinant matice $A$ ${data.M.length}. řádu: vytvoř ve sloupci nuly řádkovými úpravami a rozviň (výsledek je celé číslo).`,
    promptTex: `A=${pm(data.M)}`,
    answerSpec: { kind: 'number', value: vFinal },
    answerTex: `|A|=${vFinal}`,
    solution: finalize(steps),
  };
}
// Projde celý postup (nuly ve sloupci a rozvoj, dokud nezbude řád 3) a vrátí největší prvek
// v mezikrocích, zda se někdy násobil upravovaný řádek (zlomek před determinantem) a zda
// někde nevznikla nulová řada (to by příklad zkrátilo).
function upravaChain(M0) {
  let M = copy(M0); let max = maxAbs(M); let scaled = false;
  while (M.length > 3) {
    if (hasZeroLine(M)) return { ok: false };
    const { p, c } = pickKey(M);
    const r = clearColumn(M, p, c);
    if (r.factor.n !== r.factor.d) scaled = true;
    max = Math.max(max, maxAbs(r.matrix));
    M = minor(r.matrix, p, c);
  }
  return { ok: true, max, scaled };
}
function genUprava(rng) {
  const u = rng();
  const mode = u < 0.1 ? 'five' : u < 0.3 ? 'scaled' : 'plain';
  for (let tries = 0; ; tries++) {
    const n = mode === 'five' ? 5 : 4;
    const M = mode === 'five' ? rmat(rng, 5, -2, 3) : rmat(rng, 4, -3, 4);
    const zeros = M.flat().filter((x) => x === 0).length;
    if (hasZeroLine(M)) continue;
    if (mode === 'plain' && !M.flat().some((x) => Math.abs(x) === 1)) continue;
    if (zeros > (mode === 'five' ? 9 : 4)) continue;
    if (mode === 'five' && (zeros < 5 || !M.flat().some((x) => Math.abs(x) === 1))) continue;
    const { p, c } = pickKey(M);
    const r = clearColumn(M, p, c);
    if (r.ops.length < (mode === 'five' ? 1 : 2)) continue;
    const ch = upravaChain(M);
    if (!ch.ok || ch.max > (mode === 'scaled' ? 20 : mode === 'five' ? 12 : 15)) continue;
    if (mode === 'scaled' && !ch.scaled) continue;
    if (mode === 'plain' && maxAbs(r.matrix) > 15) continue;
    const v = detInt(M);
    if (v === 0 || Math.abs(v) > (mode === 'five' ? 400 : 300)) continue;
    if (n === 5 && tries > 5000) return genUprava(rng);
    return solveUprava({ M });
  }
}

// =====================================================================
// Typ 5: schodovitý (trojúhelníkový) tvar, součin diagonály
function solveSchodovity(data) {
  let M = copy(data.M);
  const n = M.length;
  let coef = fr(1);
  const gsteps = [{ matrix: M.map((r) => r.map(minus)) }];
  const lines = [{ tex: `|A|=${vm(M)}` }];
  let swaps = 0; let scaled = false; let zeroAt = -1;
  for (let c = 0; c < n - 1; c++) {
    let p = -1;
    if (Math.abs(M[c][c]) === 1) p = c;
    else {
      for (let i = c; i < n; i++) if (Math.abs(M[i][c]) === 1) { p = i; break; }
      if (p < 0) for (let i = c; i < n; i++) if (M[i][c] !== 0 && (p < 0 || Math.abs(M[i][c]) < Math.abs(M[p][c]))) p = i;
    }
    if (p < 0) { zeroAt = c; break; }
    const ops = []; const changed = [];
    if (p !== c) {
      [M[p], M[c]] = [M[c], M[p]];
      coef = mul(coef, fr(-1));
      swaps++;
      ops.push(`R${c + 1} ↔ R${p + 1}`); changed.push(c, p);
    }
    const r = clearColumn(M, c, c, Array.from({ length: n - c }, (_, t) => c + t));
    if (r.factor.n !== r.factor.d) scaled = true;
    coef = mul(coef, r.factor);
    M = r.matrix;
    ops.push(...r.ops); changed.push(...r.changed);
    if (ops.length) {
      gsteps.push({ op: ops.join(',  '), matrix: M.map((row) => row.map(minus)), pivot: [c, c], changed: [...new Set(changed)] });
      lines.push({ tex: `=${coefTex(coef)}${vm(M)}` });
    }
  }
  const diag = M.map((r, i) => r[i]);
  if (zeroAt < 0 && diag.some((x) => x === 0)) zeroAt = diag.findIndex((x) => x === 0);
  const prodD = diag.reduce((a, b) => a * b, 1);
  const v = zeroAt >= 0 ? 0 : toNum(mul(coef, fr(prodD)));
  const steps = [
    {
      title: 'Cíl: schodovitý tvar',
      text: 'Determinant ve schodovitém (trojúhelníkovém) tvaru – pod hlavní diagonálou samé nuly – je roven součinu čísel na diagonále. Proto matici řádkovými úpravami převedeme na tento tvar a sledujeme, jak se přitom mění hodnota determinantu.',
      board: [lines[0]],
    },
    {
      title: 'Řádkové úpravy',
      text: `Pod každým pivotem (v rámečku) vytvoříme nuly přičítáním násobků řádku s pivotem – to determinant nemění.${swaps ? ' Výměna dvou řádků mění znaménko determinantu, proto před determinant připíšeme minus.' : ''}${scaled ? ' Vynásobení upravovaného řádku číslem determinant tím číslem zvětší, proto před determinantem tímto číslem dělíme.' : ''}`,
      board: lines.length > 1 ? lines.slice(1) : [{ tex: '\\text{matice už je ve schodovitém tvaru}' }],
      viz: { kind: 'gauss', data: { steps: gsteps, alt: 'Převod determinantu na schodovitý tvar' } },
    },
  ];
  if (zeroAt >= 0) {
    steps.push({
      title: 'Nula na diagonále',
      text: 'Na diagonále schodovitého tvaru je nula, takže součin diagonály (a tedy determinant) je nulový.',
      board: [resultLine('|A|=', '0')],
    });
  } else {
    steps.push({
      title: 'Součin na diagonále',
      text: `Vynásobíme čísla na hlavní diagonále (oranžově)${coefTex(coef) ? ' a nezapomeneme na číslo před determinantem (vzniklo z výměn nebo násobení řádků)' : ''}. ${regText(v)}`,
      board: [
        { tex: `=${coefTex(coef)}${vm(M, (i, j, t) => (i === j ? cls('dg', t) : t))}`, notes: [{ kind: 'color', target: 'bt-dg' }] },
        { tex: `=${coefTex(coef)}${coefTex(coef) ? '(' : ''}${prodTex(diag)}${coefTex(coef) ? ')' : ''}` },
        resultLine('|A|=', String(v)),
      ],
    });
  }
  return {
    id: idOf('schodovity', data), topic: TOPIC, type: 'schodovity', data,
    task: 'Vypočítej determinant matice $A$ převodem na schodovitý tvar (výsledek je celé číslo).',
    promptTex: `A=${pm(data.M)}`,
    answerSpec: { kind: 'number', value: v },
    answerTex: `|A|=${v}`,
    solution: finalize(steps),
  };
}
function genSchodovity(rng) {
  for (;;) {
    const n = rng() < 0.6 ? 4 : 3;
    // A = L·U, L s jedničkami na diagonále -> eliminace bez zlomků
    const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : j < i ? ri(rng, -2, 2) : 0)));
    const U = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? pick(rng, [1, 1, -1, 2, -2, 3]) : j > i ? ri(rng, -3, 3) : 0)));
    U[0][0] = pick(rng, [1, -1]);
    let M = L.map((r) => U[0].map((_, j) => r.reduce((s, x, k) => s + x * U[k][j], 0)));
    if (rng() < 0.4) { const a = ri(rng, 1, n - 1); [M[0], M[a]] = [M[a], M[0]]; }
    if (maxAbs(M) > 9 || hasZeroLine(M)) continue;
    if (M.flat().filter((x) => x === 0).length > n) continue;
    const p = solveSchodovity({ M });
    const big = p.solution[1].viz.data.steps.some((s) => s.matrix.flat().some((x) => Math.abs(Number(String(x).replace('−', '-'))) > 20));
    if (big || p.answerSpec.value === 0) continue;
    M = null;
    return p;
  }
}

// =====================================================================
// Typ 6: vlastnosti determinantu – jak úpravy mění hodnotu
const OPS = {
  swap: { tex: (o) => `R_{${o.i + 1}}\\leftrightarrow R_{${o.j + 1}}`, factor: () => -1, why: (o) => `výměnou ${o.i + 1}. a ${o.j + 1}. řádku se změní znaménko determinantu` },
  scale: { tex: (o) => `R_{${o.i + 1}}\\to ${o.k}R_{${o.i + 1}}`, factor: (o) => o.k, why: (o) => `vynásobením jednoho řádku číslem ${minus(o.k)} se determinant ${minus(o.k)}krát zvětší` },
  add: { tex: (o) => `R_{${o.i + 1}}\\to R_{${o.i + 1}}${o.k < 0 ? '-' : '+'}${Math.abs(o.k) === 1 ? '' : Math.abs(o.k)}R_{${o.j + 1}}`, factor: () => 1, why: () => 'přičtení násobku jiného řádku determinant nemění' },
  transpose: { tex: () => 'B\\to B^{T}', factor: () => 1, why: () => 'transpozice determinant nemění' },
  mult: { tex: (o) => `B\\to ${o.k}B`, factor: (o, n) => o.k ** n, why: (o, n) => `násobek celé matice ${minus(o.k)}·B násobí číslem ${minus(o.k)} každý z ${n} řádků, determinant se tedy násobí číslem $${par(o.k)}^{${n}}=${o.k ** n}$` },
};
function solveVlastnosti(data) {
  const { n, d, ops } = data;
  let val = d;
  const steps = [{
    title: 'Co víme',
    text: `Matici $A$ neznáme, známe jen její determinant. Každá úprava změní determinant předem známým způsobem, takže stačí sledovat, čím se hodnota násobí.`,
    board: [{ tex: `|A|=${d}` }],
  }];
  ops.forEach((o, q) => {
    const f = OPS[o.kind].factor(o, n);
    const prev = q === 0 ? 'A' : `B_{${q}}`;
    const nv = val * f;
    steps.push({
      title: `${q + 1}. úprava`,
      text: `$${OPS[o.kind].tex(o)}$: ${OPS[o.kind].why(o, n)}.`,
      board: [{ tex: `|B_{${q + 1}}|=${f === 1 ? '' : `${par(f)}\\cdot `}|${prev}|=${f === 1 ? '' : `${par(f)}\\cdot ${par(val)}=`}${nv}` }],
    });
    val = nv;
  });
  steps.push({
    title: 'Výsledek',
    text: 'Matice $B$ je matice po poslední úpravě.',
    board: [resultLine('|B|=', String(val))],
  });
  const list = ops.map((o, q) => `\\text{${q + 1})}\\ ${OPS[o.kind].tex(o)}`);
  return {
    id: idOf('vlastnosti', data), topic: TOPIC, type: 'vlastnosti', data,
    task: `Čtvercová matice $A$ řádu ${n} má determinant ${minus(d)}. Matice $B$ vznikne z $A$ postupně úpravami pod zadáním ($R_i$ = $i$-tý řádek, $B^T$ = transpozice, $kB$ = násobek celé matice). Urči $|B|$ (celé číslo).`,
    promptTex: `\\begin{gathered}|A|=${d},\\ A\\in\\mathbb{R}^{${n}\\times ${n}}\\\\ ${list.join('\\\\ ')}\\end{gathered}`,
    answerSpec: { kind: 'number', value: val },
    answerTex: `|B|=${val}`,
    solution: finalize(steps),
  };
}
function genVlastnosti(rng) {
  const n = pick(rng, [3, 3, 4]);
  const d = rnz(rng, -6, 6);
  const count = pick(rng, [2, 3, 3]);
  const kinds = ['swap', 'scale', 'add', 'transpose', 'mult'].sort(() => rng() - 0.5).slice(0, count);
  if (!kinds.some((k) => k === 'swap' || k === 'scale' || k === 'mult')) kinds[0] = pick(rng, ['swap', 'scale', 'mult']);
  const two = () => { const i = ri(rng, 0, n - 1); let j = ri(rng, 0, n - 1); while (j === i) j = ri(rng, 0, n - 1); return [i, j]; };
  const ops = kinds.map((kind) => {
    if (kind === 'swap') { const [i, j] = two(); return { kind, i: Math.min(i, j), j: Math.max(i, j) }; }
    if (kind === 'scale') return { kind, i: ri(rng, 0, n - 1), k: pick(rng, [2, 3, -2, 5, -1]) };
    if (kind === 'add') { const [i, j] = two(); return { kind, i, j, k: rnz(rng, -3, 3) }; }
    if (kind === 'mult') return { kind, k: pick(rng, [2, -1, 3, -2]) };
    return { kind };
  });
  return solveVlastnosti({ n, d, ops });
}

// =====================================================================
// Typ 7: determinant s parametrem x – rovnice |A| = 0 nebo nerovnice
const REL_TEX = { '=': '=', '<=': '\\le', '<': '<', '>=': '\\ge', '>': '>' };
const FLIP = { '<=': '>=', '<': '>', '>=': '<=', '>': '<', '=': '=' };
const ent = (e) => (Array.isArray(e) ? e : [e, 0]);
const entTexPar = (e) => {
  const [c, k] = ent(e);
  const t = entryTex([c, k]);
  return (k !== 0 && c !== 0) || t.startsWith('-') ? `(${t})` : t;
};
function intervalOf(roots, rel) {
  // a > 0 (normalizováno): mnohočlen je záporný mezi kořeny
  const closed = rel === '<=' || rel === '>=';
  const L = closed ? '<' : '('; const R = closed ? '>' : ')';
  const Lt = closed ? '\\langle ' : '('; const Rt = closed ? '\\rangle' : ')';
  const s = (f) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
  if (roots.length === 1) {
    const r = roots[0];
    if (rel === '<=' || rel === '<') return { str: `(-∞; ${s(r)}${R}`, tex: `(-\\infty;\\ ${frTex(r)}${Rt}` };
    return { str: `${L}${s(r)}; ∞)`, tex: `${Lt}${frTex(r)};\\ \\infty)` };
  }
  const [a, b] = roots;
  if (rel === '<=' || rel === '<') return { str: `${L}${s(a)}; ${s(b)}${R}`, tex: `${Lt}${frTex(a)};\\ ${frTex(b)}${Rt}` };
  return {
    str: `(-∞; ${s(a)}${R} ∪ ${L}${s(b)}; ∞)`,
    tex: `(-\\infty;\\ ${frTex(a)}${Rt}\\cup${Lt}${frTex(b)};\\ \\infty)`,
  };
}
function solveParametr(data) {
  const { rel } = data;
  const M = data.M.map((r) => r.map(ent));
  const n = M.length;
  const poly = (e) => [e[0], e[1]];
  const mTex = vm(M.map((r) => r.map((e) => entryTex(e))).map((r) => r.map((t) => t)), null);
  const steps = [];
  let P;
  if (n === 2) {
    const p1 = pMul(poly(M[0][0]), poly(M[1][1]));
    const q1 = pMul(poly(M[0][1]), poly(M[1][0]));
    P = pSub(p1, q1);
    steps.push({
      title: 'Křížové pravidlo',
      text: 'Determinant 2. řádu je součin na hlavní diagonále minus součin na vedlejší. Výrazy s $x$ dáme do závorek a roznásobíme.',
      board: [{ tex: `|A|=${mTex}` }, { tex: `=${entTexPar(M[0][0])}\\cdot ${entTexPar(M[1][1])}-${entTexPar(M[0][1])}\\cdot ${entTexPar(M[1][0])}` }],
    });
    steps.push({
      title: 'Roznásobení',
      text: 'Roznásobíme oba součiny (každý člen první závorky s každým členem druhé) a odečteme.',
      board: [{ tex: `=(${pTex(p1)})-(${pTex(q1)})` }, { tex: `=${pTex(P)}` }],
    });
  } else {
    const prod = (D) => D.reduce((s, [i, j]) => pMul(s, poly(M[i][j])), [1]);
    const P3 = SARRUS_PLUS.map(prod); const Q3 = SARRUS_MINUS.map(prod);
    const S1 = P3.reduce(pAdd, [0]); const S2 = Q3.reduce(pAdd, [0]);
    P = pSub(S1, S2);
    const dl = (D, vals, letter) => D.map((d, k) => ({ tex: `${letter}_{${k + 1}}=${d.map(([i, j]) => entTexPar(M[i][j])).join('\\cdot ')}=${pTex(vals[k])}` }));
    steps.push({
      title: 'Sarrusovo pravidlo',
      text: 'Determinant 3. řádu spočítáme Sarrusovým pravidlem stejně jako s čísly; výrazy s $x$ bereme jako celek (v závorce).',
      board: [{ tex: `|A|=${mTex}` }],
      viz: sarrusViz(M.map((r) => r.map((e) => minus(entryTex(e))))),
    });
    steps.push({
      title: 'Součiny se znaménkem +',
      text: 'Vynásobíme trojice ve směru hlavní diagonály, závorky roznásobíme a součiny sečteme (sloučíme členy se stejnou mocninou $x$).',
      board: [...dl(SARRUS_PLUS, P3, 'p'), { tex: `p_1+p_2+p_3=${pTex(S1)}` }],
    });
    steps.push({
      title: 'Součiny se znaménkem −',
      text: 'Totéž pro trojice ve směru vedlejší diagonály. Pak „plusový“ součet minus „minusový“ součet; minus před závorkou mění všechna znaménka.',
      board: [...dl(SARRUS_MINUS, Q3, 'q'), { tex: `q_1+q_2+q_3=${pTex(S2)}` }, { tex: `|A|=(${pTex(S1)})-(${pTex(S2)})` }, { tex: `=${pTex(P)}` }],
    });
  }
  if (pDeg(P) < 1 || pDeg(P) > 2) throw new Error('parametr: determinant není lineární ani kvadratický v x');
  // normalizace: kladný vedoucí koeficient, vydělení společným dělitelem
  let Q = P; let r = rel;
  const lead = P[P.length - 1];
  const g = P.reduce((s, c) => gcd(s, c), 0);
  const k = (lead < 0 ? -1 : 1) * g;
  const sol = [{ tex: `${pTex(P)}${REL_TEX[rel]}0` }];
  let normText = '';
  if (k !== 1) {
    Q = P.map((c) => c / k);
    if (k < 0) r = FLIP[rel];
    sol.push({ tex: `${pTex(Q)}${REL_TEX[r]}0` });
    normText = ` Celou ${rel === '=' ? 'rovnici' : 'nerovnici'} vydělíme číslem $${k}$, aby čísla byla menší a u nejvyšší mocniny bylo kladné číslo${k < 0 && rel !== '=' ? ' (dělení záporným číslem obrací znak nerovnosti)' : ''}.`;
  }
  const roots = rationalRoots(Q);
  if (!roots || !roots.length) throw new Error('parametr: kořeny nejsou racionální');
  const [c0, b1, a2] = [Q[0], Q[1], Q[2] || 0];
  let solveText;
  if (pDeg(Q) === 1) {
    solveText = 'Je to lineární výraz: převedeme absolutní člen na druhou stranu a vydělíme koeficientem u $x$.';
    sol.push({ tex: `${b1 === 1 ? '' : b1}x${REL_TEX[r]}${-c0}` });
  } else {
    const Dd = b1 * b1 - 4 * a2 * c0;
    const s = Math.round(Math.sqrt(Dd));
    solveText = 'Je to kvadratický výraz: najdeme jeho kořeny pomocí diskriminantu.';
    sol.push({ tex: `D=b^2-4ac=${par(b1)}^2-4\\cdot ${par(a2)}\\cdot ${par(c0)}=${Dd}` });
    if (Dd > 0) sol.push({ tex: `x_{1,2}=\\frac{${-b1}\\pm${s}}{${2 * a2}}` });
    sol.push({ tex: roots.length === 2 ? `x_1=${frTex(roots[0])},\\ x_2=${frTex(roots[1])}` : `x_{1}=${frTex(roots[0])}` });
  }
  let answerSpec; let answerTex; let lastText;
  if (rel === '=') {
    // 'system' (uspořádaná n-tice): 'list' neprojde sdíleným tests/helpers/verify.js (viz zpráva)
    answerSpec = { kind: 'system', value: roots.map(toNum) };
    answerTex = `x\\in\\{${roots.map(frTex).join(';\\ ')}\\}`;
    lastText = 'Determinant je nulový právě pro tato $x$.';
  } else {
    const iv = intervalOf(roots, r);
    answerSpec = { kind: 'interval', value: iv.str };
    answerTex = `x\\in ${iv.tex}`;
    lastText = pDeg(Q) === 1
      ? `Výsledek zapíšeme jako interval${r.includes('=') ? ' (krajní bod patří do řešení, proto lomená závorka)' : ' (krajní bod do řešení nepatří, kulatá závorka)'}.`
      : `Graf je parabola otevřená nahoru, takže výraz je záporný mezi kořeny a kladný vně nich.${r.includes('=') ? ' Kořeny do řešení patří (lomená závorka).' : ' Kořeny do řešení nepatří (kulatá závorka).'}`;
  }
  steps.push({
    title: rel === '=' ? 'Řešení rovnice' : 'Řešení nerovnice',
    text: `Hodnotu determinantu dosadíme do ${rel === '=' ? 'rovnice' : 'nerovnice'}.${normText} ${solveText}`,
    board: sol,
  });
  steps.push({ title: 'Výsledek', text: lastText, board: [resultLine('', answerTex)] });
  const task = rel === '='
    ? 'Řeš rovnici s determinantem (najdi všechna $x$, pro která platí). Kořeny zapiš vzestupně oddělené středníkem, např. -2; 1 (zlomek jako 1/2).'
    : 'Řeš nerovnici s determinantem. Výsledek zapiš jako interval, např. (-∞; 2> ∪ <3; ∞) – lomená závorka znamená, že krajní bod patří do řešení.';
  return {
    id: idOf('parametr', data), topic: TOPIC, type: 'parametr', data,
    task,
    promptTex: `${mTex}${REL_TEX[rel]}0`,
    answerSpec, answerTex,
    solution: finalize(steps),
  };
}
function genParametr(rng) {
  for (;;) {
    const n = rng() < 0.7 ? 3 : 2;
    const M = rmat(rng, n, -3, 4).map((r) => r.map((v) => [v, 0]));
    const cnt = n === 2 ? 2 : pick(rng, [1, 2, 2]);
    const cells = [];
    while (cells.length < cnt) {
      const c = [ri(rng, 0, n - 1), ri(rng, 0, n - 1)];
      if (!cells.some((x) => x[0] === c[0] && x[1] === c[1])) cells.push(c);
    }
    for (const [i, j] of cells) M[i][j][1] = pick(rng, [1, -1, 1, -1, 2]);
    const rel = rng() < 0.65 ? '=' : pick(rng, ['<=', '<', '>=', '>']);
    let p;
    try { p = solveParametr({ M: M.map((r) => r.map(([c, k]) => (k ? [c, k] : c))), rel }); } catch { continue; }
    const vals = rel === '=' ? p.answerSpec.value : null;
    const P = p.data;
    const roots = vals || [];
    if (roots.some((x) => Math.abs(x) > 8 || Math.abs(x * 2 - Math.round(x * 2)) > 1e-9)) continue;
    if (rel !== '=' && !/^[-(<0-9]/.test(p.answerSpec.value)) continue;
    if (rel !== '=' && /[0-9]{2,}\/|\/[3-9]/.test(p.answerSpec.value)) continue;
    // u nerovnice s parabolou chceme dva různé kořeny
    if (rel !== '=' && p.solution.some((s) => s.board.some((l) => /D=.*=0$/.test(l.tex) || /D=.*=-/.test(l.tex)))) continue;
    if (rel === '=' && p.solution.some((s) => s.board.some((l) => /D=.*=0$/.test(l.tex)))) continue;
    void P;
    return p;
  }
}

// =====================================================================
// Typ 8: inverzní matice pomocí adjungované matice
function cofLines(M, i, j) {
  const n = M.length;
  const s = (i + j) % 2 ? '-' : '+';
  const m = minor(M, i, j);
  const v = cofactor(M, i, j);
  const name = `A_{${i + 1}${j + 1}}`;
  if (n === 2) return [{ tex: `${name}=(-1)^{${i + j + 2}}\\cdot ${par(m[0][0])}=${v}` }];
  if (n === 3) return [{ tex: `${name}=${s}${vm(m)}` }, { tex: `\\quad=${s}(${cross(m)})` }, { tex: `\\quad=${v}` }];
  const sp = sarrusParts(m);
  return [{ tex: `${name}=${s}${vm(m)}` }, ...sarrusRows(m, '\\quad=', `${s}[`, ']').slice(0, 2), { tex: `\\quad=${s}[${sp.S1}-${par(sp.S2)}]` }, { tex: `\\quad=${v}` }];
}
function solveAdjungovana(data) {
  const { M } = data;
  const n = M.length;
  const C = M.map((r, i) => r.map((_, j) => cofactor(M, i, j)));
  const steps = [];
  const signs = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => ((i + j) % 2 ? '−' : '+')));
  for (let i = 0; i < n; i++) {
    const st = {
      title: `Algebraické doplňky ${i + 1}. řádku`,
      text: i === 0
        ? `Algebraický doplněk $A_{ij}$ je znaménko $(-1)^{i+j}$ (šachovnice: + v levém horním rohu, pak střídavě) krát subdeterminant, který vznikne vynecháním $i$-tého řádku a $j$-tého sloupce.${n === 2 ? ' U matice 2×2 zbude po vynechání jediné číslo.' : ''}`
        : `Stejně spočítáme doplňky prvků ${i + 1}. řádku – vynecháváme ${i + 1}. řádek a vždy jeden sloupec.`,
      board: M[i].flatMap((_, j) => cofLines(M, i, j)),
    };
    if (i === 0) st.viz = { kind: 'matrix', data: { rows: signs, caption: 'znaménka (−1)^(i+j)', alt: 'Šachovnice znamének algebraických doplňků' } };
    steps.push(st);
  }
  // determinant rozvojem podle řádku s nejvíce nulami pomocí už spočítaných doplňků
  let r = 0;
  M.forEach((row, i) => { if (row.filter((x) => x === 0).length > M[r].filter((x) => x === 0).length) r = i; });
  const det = M[r].reduce((s, a, j) => s + a * C[r][j], 0);
  if (det === 0) throw new Error('adjungovana: matice je singulární');
  const prods = M[r].map((a, j) => a * C[r][j]);
  steps.push({
    title: 'Determinant',
    text: `Inverzní matice existuje jen pro nenulový determinant. Doplňky už máme, proto determinant spočítáme rozvojem podle ${r + 1}. řádku: prvky řádku násobíme jejich algebraickými doplňky a sečteme${n === 3 ? ' (Sarrusovo pravidlo by dalo totéž)' : ''}. Vyšlo $${det}\\neq 0$, matice je regulární.`,
    board: [
      ...M[r].map((a, j) => ({ tex: `${j ? '\\quad +' : '|A|='}${par(a)}\\cdot ${par(C[r][j])}` })),
      { tex: `=${signed(prods)}=${det}` },
    ],
  });
  const adj = transpose(C);
  steps.push({
    title: 'Adjungovaná matice',
    text: 'Doplňky zapíšeme do matice $C$ na místa prvků. Adjungovaná matice je matice $C$ transponovaná (řádky se stanou sloupci): na místě $ij$ adjungované matice je doplněk $A_{ji}$.',
    board: [{ tex: `C=${pm(C)}` }, { tex: '\\mathrm{adj}\\,A=C^{T}' }, { tex: `=${pm(adj)}` }],
  });
  const s = det < 0 ? -1 : 1;
  const g = adj.flat().reduce((x, y) => gcd(x, y), Math.abs(det));
  const k = Math.abs(det) / g;
  const red = adj.map((row) => row.map((x) => (x * s) / g));
  const inv = adj.map((row) => row.map((x) => fr(x, det)));
  const ansTex = k === 1 ? pm(red) : `\\frac{1}{${k}}${pm(red)}`;
  const lines = [{ tex: '\\displaystyle A^{-1}=\\frac{1}{|A|}\\,\\mathrm{adj}\\,A' }];
  const aD = Math.abs(det);
  // Mezikroky: dosazení determinantu, vnoření znaménka do matice, vytknutí společného dělitele, zkrácení zlomku.
  const stages = [{ f: `${det < 0 ? '-' : ''}\\frac{1}{${aD}}`, M: adj }];
  if (s < 0) stages.push({ f: `\\frac{1}{${aD}}`, M: adj.map((row) => row.map((x) => -x)) });
  if (g > 1) {
    stages.push({ f: `\\frac{1}{${aD}}\\cdot ${g}`, M: red, dot: true });
    stages.push({ f: `\\frac{${g}}{${aD}}`, M: red });
  }
  const last = stages[stages.length - 1];
  if (flatTex(`=${last.f}${pm(last.M)}`) === flatTex(`=${ansTex}`)) stages.pop();
  for (const st of stages) {
    if (n >= 3) lines.push({ tex: `=${st.f}\\cdot` }, { tex: `\\qquad ${pm(st.M)}` });
    else lines.push({ tex: `=${st.f}${st.dot ? '\\cdot ' : ''}${pm(st.M)}` });
  }
  lines.push(resultLine('A^{-1}=', ansTex));
  steps.push({
    title: 'Inverzní matice',
    text: `Adjungovanou matici vynásobíme číslem $\\frac{1}{|A|}$.${s < 0 ? ' Záporné znaménko determinantu vnoříme do matice (změníme znaménka všech prvků), ve jmenovateli zůstane kladné číslo.' : ''}${g > 1 ? ` Všechny prvky matice i determinant jsou dělitelné číslem ${g}: ${g} vytkneme před matici a zlomek $\\frac{${g}}{${aD}}$ zkrátíme číslem ${g} na $\\frac{1}{${k}}$.` : ''} Zkouška: $A\\cdot A^{-1}$ musí dát jednotkovou matici.`,
    board: lines,
  });
  return {
    id: idOf('adjungovana', data), topic: TOPIC, type: 'adjungovana', data,
    task: 'Pomocí adjungované matice vypočítej inverzní matici $A^{-1}$. Prvky zapiš do políček, zlomky jako 1/4.',
    promptTex: `A=${pm(M)}`,
    hint: 'Nejdřív všechny algebraické doplňky, pak determinant, transpozice a vydělení determinantem.',
    answerSpec: { kind: 'matrix', value: inv.map((row) => row.map(toNum)) },
    answerTex: `A^{-1}=${ansTex}`,
    solution: finalize(steps),
  };
}
function genAdjungovana(rng) {
  const u = rng();
  for (;;) {
    const n = u < 0.1 ? 4 : u < 0.4 ? 2 : 3;
    const M = rmat(rng, n, n === 2 ? -6 : n === 3 ? -3 : -2, n === 2 ? 7 : n === 3 ? 4 : 3);
    if (hasZeroLine(M) || M.flat().filter((x) => x === 0).length > (n === 2 ? 1 : n === 3 ? 3 : 5)) continue;
    const d = detInt(M);
    if (d === 0 || Math.abs(d) > (n === 2 ? 20 : n === 3 ? 12 : 10)) continue;
    return solveAdjungovana({ M });
  }
}

// =====================================================================
// Typ 9: Cramerovo pravidlo
const VARS = ['x', 'y', 'z'];
function sysTex(A, b) {
  const row = (r, bi) => {
    const parts = [];
    r.forEach((c, j) => {
      if (c === 0) return;
      const a = Math.abs(c);
      const sg = c < 0 ? '-' : parts.length ? '+' : '';
      parts.push(`${sg}${a === 1 ? '' : a}${VARS[j]}`);
    });
    return `${parts.join('')}&=${bi}`;
  };
  return `\\begin{aligned}${A.map((r, i) => row(r, b[i])).join('\\\\')}\\end{aligned}`;
}
function detLines(name, M, wrap) {
  if (M.length === 2) return [{ tex: `${name}=${vm(M, wrap)}=${cross(M)}` }, { tex: `=${detInt(M)}` }];
  const sh = sarrusShort(M);
  return [{ tex: `${name}=${vm(M, wrap)}` }, { tex: `=${sh.lines[0]}` }, { tex: `=${sh.lines[1]}=${sh.value}` }];
}
function solveCramer(data) {
  const { A, b } = data;
  const n = A.length;
  const D = detInt(A);
  if (D === 0) throw new Error('cramer: singulární matice');
  const steps = [{
    title: 'Determinant soustavy',
    text: `Z koeficientů u neznámých sestavíme determinant soustavy $D$. Vyšlo $D=${D}\\neq 0$, matice soustavy je regulární, soustava má jediné řešení a Cramerovo pravidlo lze použít.`,
    board: detLines('D', A),
  }];
  const vals = [];
  for (let j = 0; j < n; j++) {
    const Mj = A.map((r, i) => r.map((v, c) => (c === j ? b[i] : v)));
    const Dj = detInt(Mj);
    vals.push(Dj);
    steps.push({
      title: `Determinant D_${VARS[j]}`,
      text: `V determinantu $D$ nahradíme ${j + 1}. sloupec (koeficienty u $${VARS[j]}$) sloupcem pravých stran (oranžově).`,
      board: detLines(`D_${VARS[j]}`, Mj, (i, c, t) => (c === j ? cls('ps', t) : t)).map((l, q) => (q === 0 ? { ...l, notes: [{ kind: 'color', target: 'bt-ps' }] } : l)),
    });
  }
  const sol = vals.map((v) => fr(v, D));
  const frLine = (v) => (D > 0 ? `\\frac{${v}}{${D}}` : `\\frac{${-v}}{${-D}}`);
  steps.push({
    title: 'Řešení',
    text: `Každou neznámou dostaneme jako podíl: $${VARS[0]}=\\frac{D_${VARS[0]}}{D}$ atd.${D < 0 ? ` Protože $D=${D}$ je záporné, zlomek rozšíříme číslem $-1$ (čitatel i jmenovatel změní znaménko) a na tabuli rovnou píšeme kladný jmenovatel.` : ''}`,
    board: [
      ...sol.map((v, j) => ({ tex: `${VARS[j]}=\\frac{D_${VARS[j]}}{D}=${frLine(vals[j])}=${frTex(v)}` })),
      resultLine(`(${VARS.slice(0, n).join(',\\ ')})=`, `(${sol.map(frTex).join(',\\ ')})`),
    ],
  });
  return {
    id: idOf('cramer', data), topic: TOPIC, type: 'cramer', data,
    task: `Vyřeš soustavu Cramerovým pravidlem. Zapiš hodnoty neznámých $${VARS.slice(0, n).join(',\\ ')}$ (zlomky jako 1/2).`,
    promptTex: sysTex(A, b),
    answerSpec: { kind: 'vector', value: sol.map(toNum) },
    answerTex: `(${VARS.slice(0, n).join(',\\ ')})=(${sol.map(frTex).join(',\\ ')})`,
    solution: finalize(steps),
  };
}
function genCramer(rng) {
  for (;;) {
    const n = rng() < 0.4 ? 2 : 3;
    const A = rmat(rng, n, -3, 4);
    if (hasZeroLine(A) || A.flat().filter((x) => x === 0).length > (n === 2 ? 0 : 2)) continue;
    const D = detInt(A);
    if (D === 0 || Math.abs(D) > 30) continue;
    const x = Array.from({ length: n }, () => ri(rng, -4, 5));
    const b = A.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
    if (b.some((v) => Math.abs(v) > 25)) continue;
    return solveCramer({ A, b });
  }
}

// =====================================================================
// Typ 10: aplikace – návratnost investic, A·X = B (2×2)
const big = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
const bigTxt = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function solveAplikace(data) {
  const { A, B } = data;
  const [[a, b], [c, d]] = A;
  const det = a * d - b * c;
  if (det === 0) throw new Error('aplikace: singulární matice');
  const n1 = d * B[0] - b * B[1];
  const n2 = -c * B[0] + a * B[1];
  const x = [fr(n1, det), fr(n2, det)];
  const sg = det < 0 ? -1 : 1;
  // x_i = 1/|det| · (k1·v1 + k2·v2) na dva řádky (telefon)
  const num2 = (i, k1, v1, k2, v2) => [
    { tex: `x_${i}=\\frac{1}{${sg * det}}\\big(${k1 < 0 ? '-' : ''}${Math.abs(k1)}\\cdot ${big(v1)}` },
    { tex: `\\quad${k2 < 0 ? '-' : '+'}${Math.abs(k2)}\\cdot ${big(v2)}\\big)` },
  ];
  const steps = [
    {
      title: 'Maticová rovnice',
      text: 'Neznámé počty kusů $x_1$, $x_2$ zapíšeme do sloupce $X$. Řádek matice $A$ = zisky jednoho podniku z jednoho kusu každého výrobku, $B$ = vložené investice. Zisk z $x_1$ a $x_2$ kusů má být roven investici, tedy $A\\cdot X=B$.',
      board: [{ tex: `${pm(A)}\\cdot\\begin{pmatrix}x_1\\\\x_2\\end{pmatrix}` }, { tex: `=\\begin{pmatrix}${big(B[0])}\\\\${big(B[1])}\\end{pmatrix}` }],
    },
    {
      title: 'Determinant a inverzní matice',
      text: `Determinant matice $A$ je nenulový, matice je regulární a rovnice má jediné řešení $X=A^{-1}B$. Inverzi matice 2×2 dostaneme z adjungované matice: prvky na hlavní diagonále prohodíme, u vedlejší změníme znaménka a vydělíme determinantem.`,
      board: [
        { tex: `|A|=${cross(A)}=${det}` },
        { tex: `\\mathrm{adj}\\,A=${pm([[d, -b], [-c, a]])}` },
        { tex: `A^{-1}=${det < 0 ? '-' : ''}\\frac{1}{${Math.abs(det)}}${pm([[d, -b], [-c, a]])}` },
      ],
    },
    {
      title: 'Součin A⁻¹·B',
      text: 'Vynásobíme adjungovanou matici sloupcem investic (řádek krát sloupec) a vydělíme determinantem.',
      board: [
        ...num2(1, sg * d, B[0], -sg * b, B[1]),
        { tex: `\\quad=\\frac{${big(sg * n1)}}{${big(sg * det)}}=${big(frTex(x[0]))}` },
        ...num2(2, -sg * c, B[0], sg * a, B[1]),
        { tex: `\\quad=\\frac{${big(sg * n2)}}{${big(sg * det)}}=${big(frTex(x[1]))}` },
      ],
    },
    {
      title: 'Výsledek',
      text: `Investice se oběma podnikům vrátí současně při výrobě ${bigTxt(toNum(x[0]))} kusů prvního a ${bigTxt(toNum(x[1]))} kusů druhého výrobku.`,
      board: [resultLine('X=', `(${x.map((v) => big(frTex(v))).join(',\\ ')})`)],
    },
  ];
  if (det < 0) steps[2].text += ' Determinant je záporný, proto jeho znaménko převedeme do čitatele (změní se znaménka v čitateli).';
  return {
    id: idOf('aplikace', data), topic: TOPIC, type: 'aplikace', data,
    task: `Firma vyrábí dva výrobky; na jednom kusu prvního má čistý zisk ${bigTxt(a)} Kč, na jednom kusu druhého ${bigTxt(b)} Kč. Dodavatel polotovarů vydělá na jednom kusu prvního výrobku ${bigTxt(c)} Kč a na jednom kusu druhého ${bigTxt(d)} Kč. Firma investovala ${bigTxt(B[0])} Kč, dodavatel ${bigTxt(B[1])} Kč. Kolik kusů $x_1$, $x_2$ obou výrobků je třeba vyrobit, aby se investice oběma vrátily současně? Řeš maticovou rovnici $A\\cdot X=B$ pomocí inverzní matice a zapiš $(x_1,\\ x_2)$.`,
    promptTex: `A=${pm(A)},\\quad B=\\begin{pmatrix}${big(B[0])}\\\\${big(B[1])}\\end{pmatrix}`,
    answerSpec: { kind: 'vector', value: x.map(toNum) },
    answerTex: `X=(${x.map((v) => big(frTex(v))).join(',\\ ')})`,
    solution: finalize(steps),
  };
}
function genAplikace(rng) {
  for (;;) {
    const A = [[ri(rng, 5, 50) * 10, ri(rng, 5, 50) * 10], [ri(rng, 1, 9), ri(rng, 1, 9)]];
    if (A[0][0] * A[1][1] - A[0][1] * A[1][0] === 0) continue;
    const x = [ri(rng, 10, 500) * 10, ri(rng, 10, 500) * 10];
    const B = [A[0][0] * x[0] + A[0][1] * x[1], A[1][0] * x[0] + A[1][1] * x[1]];
    return solveAplikace({ A, B });
  }
}

// =====================================================================
const theory = [
  {
    heading: 'Co je determinant',
    text: 'Determinant je číslo, které přiřadíme čtvercové matici (stejně řádků jako sloupců). Značí se $|A|$ nebo $\\det A$; svislé čáry tu neznamenají absolutní hodnotu – determinant může být záporný. Řád determinantu je počet řádků matice.\n\nNejdůležitější použití: matice je regulární (má inverzní matici), právě když je její determinant nenulový. Matice s nulovým determinantem je singulární. Determinanty dále slouží k řešení soustav (Cramerovo pravidlo) a k výpočtu inverzní matice přes adjungovanou matici.\n\nU matice $1\\times 1$ je determinant to jediné číslo: $|(7)| = 7$.',
    tex: 'A\\ \\text{regulární}\\iff |A|\\neq 0',
    mistakes: [
      'Počítat determinant obdélníkové matice – existuje jen pro čtvercové matice.',
      'Plést si $|A|$ s absolutní hodnotou a výsledek „opravit“ na kladný.',
      'Psát determinant s kulatými závorkami jako matici: matice je tabulka čísel, determinant je jedno číslo.',
    ],
  },
  {
    heading: 'Determinant 2. řádu – křížové pravidlo',
    text: 'U matice $2\\times 2$ vynásobíme čísla na hlavní diagonále (zleva shora doprava dolů) a odečteme součin čísel na vedlejší diagonále.\n\nPříklad: $\\begin{vmatrix}3&-2\\\\4&1\\end{vmatrix} = 3\\cdot 1-(-2)\\cdot 4 = 3+8 = 11$.',
    tex: '\\begin{vmatrix}a_{11}&a_{12}\\\\a_{21}&a_{22}\\end{vmatrix}=a_{11}a_{22}-a_{12}a_{21}',
    mistakes: [
      'Sečíst součiny místo odečíst.',
      'Ztratit znaménko: $-(-2)\\cdot 4 = +8$. Záporná čísla piš do závorek.',
    ],
  },
  {
    heading: 'Determinant 3. řádu – Sarrusovo pravidlo',
    text: 'Za determinant znovu opíšeme 1. a 2. sloupec. Pak vynásobíme vždy tři čísla na šikmé čáře: tři součiny ve směru hlavní diagonály (dolů doprava) bereme se znaménkem +, tři součiny ve směru vedlejší diagonály (dolů doleva) se znaménkem −. Místo opisování sloupců lze opsat pod determinant 1. a 2. řádek – vyjde totéž.\n\nPostup: 1) tři „plusové“ součiny sečti, 2) tři „minusové“ součiny sečti, 3) první součet minus druhý.\n\nSarrusovo pravidlo platí POUZE pro determinanty 3. řádu. Pro 4. a vyšší řád se nedá žádným způsobem zobecnit.',
    tex: '|A|=a_{11}a_{22}a_{33}+a_{12}a_{23}a_{31}+a_{13}a_{21}a_{32}-a_{13}a_{22}a_{31}-a_{12}a_{21}a_{33}-a_{11}a_{23}a_{32}',
    mistakes: [
      'Použít Sarrusovo pravidlo na determinant 4. řádu – nefunguje.',
      'Odečíst jen první „minusový“ součin: odečítá se celý součet $q_1+q_2+q_3$, proto ho dej do závorky.',
      'Přehlédnout nulu v součinu – celý součin je pak 0.',
    ],
  },
  {
    heading: 'Subdeterminant, algebraický doplněk a Laplaceův rozvoj',
    text: 'Subdeterminant (minor) $M_{ij}$ prvku $a_{ij}$ je determinant, který vznikne vynecháním $i$-tého řádku a $j$-tého sloupce. Algebraický doplněk je $A_{ij} = (-1)^{i+j}M_{ij}$. Znaménka $(-1)^{i+j}$ tvoří šachovnici, v levém horním rohu je +:\n\n$\\begin{matrix}+&-&+\\\\-&+&-\\\\+&-&+\\end{matrix}$\n\nLaplaceův rozvoj podle $i$-tého řádku: každý prvek řádku vynásobíme jeho algebraickým doplňkem a sečteme. Stejně to jde podle libovolného sloupce a výsledek je vždy stejný. Determinant $n$-tého řádu tak převedeme na determinanty řádu $n-1$.\n\nVybírej řádek nebo sloupec s nejvíce nulami – člen s nulou se nemusí počítat.',
    tex: '|A|=a_{i1}A_{i1}+a_{i2}A_{i2}+\\dots+a_{in}A_{in},\\qquad A_{ij}=(-1)^{i+j}M_{ij}',
    mistakes: [
      'Zapomenout na znaménko $(-1)^{i+j}$ – na místech, kde je součet indexů lichý, je minus.',
      'Vynechat v subdeterminantu jiný řádek či sloupec než ten, kde leží prvek.',
      'Rozvíjet podle řady bez nul – je to správně, ale zbytečně pracné.',
    ],
  },
  {
    heading: 'Vlastnosti determinantu',
    text: 'Hodnota determinantu se nezmění, když: k řádku přičteme násobek jiného řádku (nebo lineární kombinaci ostatních řádků); matici transponujeme ($|A^T| = |A|$). Totéž platí pro sloupce.\n\nHodnota se změní, když: vyměníme dva řádky – změní se znaménko; vynásobíme jeden řádek číslem $k$ – determinant se zvětší $k$-krát. Proto: chceme-li řádek vynásobit, musíme celý determinant tím číslem zase vydělit. Násobek celé matice $n$-tého řádu: $|kA| = k^n|A|$.\n\nDeterminant je nulový, když má matice nulový řádek (sloupec), dva stejné řádky nebo když je jeden řádek násobkem jiného (obecně lineární kombinací ostatních).\n\nDeterminant matice ve schodovitém (trojúhelníkovém) tvaru je součin prvků na hlavní diagonále. A pro součin matic platí $|A\\cdot B| = |A|\\cdot|B|$.',
    tex: '|A^T|=|A|,\\quad |kA|=k^n|A|,\\quad |A\\cdot B|=|A|\\cdot|B|',
    mistakes: [
      'Myslet si, že $|2A| = 2|A|$ – správně je $2^n|A|$, protože se násobí každý z $n$ řádků.',
      'Vyměnit řádky a zapomenout změnit znaménko determinantu.',
      'Vynásobit upravovaný řádek číslem (např. $2R_3 - R_1$) a nevydělit determinant dvěma.',
    ],
  },
  {
    heading: 'Determinanty vyšších řádů',
    text: 'Determinant 4. a vyššího řádu počítáme úpravami:\n\n1) Nuly ve sloupci a rozvoj: zvolíme klíčový prvek (nejlépe 1 nebo −1) a přičítáním jeho násobků k ostatním řádkům vynulujeme zbytek jeho sloupce. Rozvoj podle tohoto sloupce pak má jediný člen – determinant o řád menší. Opakujeme, dokud nezbude determinant 3. řádu (Sarrus).\n\n2) Schodovitý tvar: řádkovými úpravami (jako Gaussova eliminace) vyrobíme pod diagonálou nuly; determinant je součin diagonály, opravený o znaménko (výměny řádků) a o čísla, kterými jsme násobili řádky.\n\nPři úpravách determinantu neměníme pořadí řádků bez změny znaménka a klíčový řádek jen opisujeme.',
    mistakes: [
      'Upravovat řádek pomocí sebe sama (např. $R_2 := R_2 - 2R_2 = -R_2$ změní znaménko řádku, $R_2 := R_2 - R_2$ dokonce vyrobí nulový řádek) – přičítat se smí jen násobek jiného řádku.',
      'Zapomenout na číslo před determinantem (znaménko, zlomek) při závěrečném násobení.',
      'Zapomenout na znaménko $(-1)^{i+j}$ klíčového prvku při rozvoji.',
    ],
  },
  {
    heading: 'Determinant s parametrem',
    text: 'Když matice obsahuje neznámou $x$, spočítáme determinant obvyklým pravidlem a výrazy s $x$ bereme jako celek v závorce. Vyjde mnohočlen v $x$ (u úloh v kurzu lineární nebo kvadratický).\n\nRovnice $|A| = 0$: hledáme $x$, pro která je matice singulární – vyřešíme lineární nebo kvadratickou rovnici (diskriminant). Nerovnice $|A| \\le 0$ apod.: najdeme kořeny a podle znaménka výrazu mezi nimi zapíšeme interval. Je-li parabola otevřená nahoru, je výraz záporný mezi kořeny.',
    tex: '\\begin{vmatrix}1&1\\\\1&x\\end{vmatrix}=x-1=0\\ \\Rightarrow\\ x=1',
    mistakes: [
      'Neroznásobit závorky správně: $(1-x)(4+x) = 4+x-4x-x^2$.',
      'Při dělení nerovnice záporným číslem neotočit znak nerovnosti.',
      'U neostré nerovnosti ($\\le$, $\\ge$) zapomenout, že kořeny do řešení patří (lomená závorka).',
    ],
  },
  {
    heading: 'Adjungovaná matice a inverzní matice',
    text: 'Adjungovaná matice $\\mathrm{adj}\\,A$ vznikne tak, že každý prvek matice nahradíme jeho algebraickým doplňkem a výslednou matici transponujeme. Na místě $ij$ je tedy doplněk $A_{ji}$. Existuje pro každou čtvercovou matici (regulární i singulární).\n\nPro regulární matici ($|A| \\neq 0$) platí $A^{-1} = \\frac{1}{|A|}\\mathrm{adj}\\,A$. Postup: 1) všechny algebraické doplňky, 2) determinant (třeba rozvojem s už spočítanými doplňky), 3) transpozice, 4) vydělení determinantem.\n\nPro matici $2\\times 2$ je to rychlé: prvky na hlavní diagonále prohodíme, prvkům na vedlejší diagonále změníme znaménko a vydělíme determinantem. Výsledek si můžeš ověřit: $A\\cdot A^{-1} = E$ (jednotková matice).',
    tex: 'A^{-1}=\\frac{1}{|A|}\\,\\mathrm{adj}\\,A,\\qquad \\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}^{-1}=\\frac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}',
    mistakes: [
      'Zapomenout matici doplňků transponovat.',
      'Vynechat znaménka šachovnice u doplňků.',
      'Počítat inverzi singulární matice – při $|A| = 0$ inverzní matice neexistuje.',
    ],
  },
  {
    heading: 'Cramerovo pravidlo',
    text: 'Platí jen pro soustavu, ve které je stejně rovnic jako neznámých a matice soustavy je regulární ($D = |A| \\neq 0$) – taková soustava má jediné řešení. Determinant $D_i$ dostaneme z $D$ tak, že $i$-tý sloupec (koeficienty u $i$-té neznámé) nahradíme sloupcem pravých stran. Pak $x_i = \\frac{D_i}{D}$.\n\nPro soustavu tří rovnic tak počítáme čtyři determinanty 3. řádu.',
    tex: 'x_i=\\frac{D_i}{D},\\qquad D\\neq 0',
    mistakes: [
      'Nahradit pravými stranami řádek místo sloupce.',
      'Použít pravidlo při $D = 0$ – soustava pak nemá řešení nebo jich má nekonečně mnoho a řeší se Gaussovou eliminací.',
      'Zaměnit pořadí: $x = \\frac{D_x}{D}$, ne $\\frac{D}{D_x}$.',
    ],
  },
  {
    heading: 'Použití v ekonomii',
    text: 'Maticová rovnice $A\\cdot X = B$ s regulární maticí $A$ má jediné řešení $X = A^{-1}\\cdot B$ (inverzní matici násobíme zleva). Typická úloha: řádky matice $A$ jsou zisky podniků z jednoho kusu výrobků, $B$ jsou investice a $X$ hledané počty kusů, při kterých se investice vrátí. Determinant rozhodne, zda řešení existuje a je jediné.',
    tex: 'A\\cdot X=B\\ \\Rightarrow\\ X=A^{-1}\\cdot B',
    mistakes: [
      'Násobit inverzí zprava ($B\\cdot A^{-1}$) – u matic záleží na pořadí.',
      'Zapomenout vydělit determinantem po vynásobení adjungovanou maticí.',
    ],
  },
];

export default {
  id: TOPIC,
  title: 'Determinant, adjungovaná matice',
  order: 3,
  theory,
  types: [
    { id: 'det2', title: 'Determinant 2. řádu', generate: genDet2, solve: solveDet2 },
    { id: 'sarrus', title: 'Sarrusovo pravidlo', generate: genSarrus, solve: solveSarrus },
    { id: 'rozvoj', title: 'Laplaceův rozvoj', generate: genRozvoj, solve: solveRozvoj },
    { id: 'uprava', title: 'Vyšší řád: nuly a rozvoj', generate: genUprava, solve: solveUprava },
    { id: 'schodovity', title: 'Schodovitý tvar', generate: genSchodovity, solve: solveSchodovity },
    { id: 'vlastnosti', title: 'Vlastnosti determinantu', generate: genVlastnosti, solve: solveVlastnosti },
    { id: 'parametr', title: 'Determinant s parametrem', generate: genParametr, solve: solveParametr },
    { id: 'adjungovana', title: 'Inverzní matice přes adjungovanou', generate: genAdjungovana, solve: solveAdjungovana },
    { id: 'cramer', title: 'Cramerovo pravidlo', generate: genCramer, solve: solveCramer },
    { id: 'aplikace', title: 'Aplikace: návratnost investic', generate: genAplikace, solve: solveAplikace },
  ],
};
