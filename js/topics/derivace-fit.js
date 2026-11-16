// Pomůcky tématu Derivace pro tabuli: šířka řádků (360 px), dělení dlouhých řádků,
// zlomek na samostatných řádcích, přepis na mocniny a derivace člen po členu.
import { fr, isZero, frTex, sumTex, powSumTex, eTex, dSum } from './derivace-lib.js';

export const LIM = 28;
// Hrubá šířka řádku: příkazy TeXu (\cdot, \frac, \infty …) se počítají jako jeden znak,
// složené závorky, mezery a obaly poznámek se nepočítají.
export const texWidth = (tex) => String(tex)
  .replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '')
  .replace(/\\(?:left|right|big|text|operatorname|stackrel|mathbb)/g, '')
  .replace(/\\[,;:! ]/g, '')
  .replace(/\\[a-zA-Z]+/g, 'X')
  .replace(/[{}\s]/g, '').length;

// Rozdělí výraz v nejvyšší úrovni (mimo závorky a složené závorky) před znaménkem + nebo −.
// Nevejde-li se řádek ani tak a obsahuje závorku \left( … \right), rozdělí se uvnitř ní
// (závorka se změní na \Bigl( … \Bigr), které mohou být každá na jiném řádku).
export function splitTop(tex, lim = LIM) {
  if (texWidth(tex) <= lim) return [tex];
  const flat = splitFlat(tex, lim);
  if (flat.length > 1 && flat.every((p) => texWidth(p) <= lim)) return flat;
  const g = tex.indexOf('\\left(');
  if (g >= 0) {
    let d = 0; let end = -1;
    for (let i = g; i < tex.length; i++) {
      if (tex.startsWith('\\left(', i)) d++;
      else if (tex.startsWith('\\right)', i)) { d--; if (d === 0) { end = i; break; } }
    }
    if (end > 0) {
      const conv = `${tex.slice(0, g)}\\Bigl(${tex.slice(g + 6, end)}\\Bigr)${tex.slice(end + 7)}`;
      const p2 = splitFlat(conv, lim);
      if (p2.length > 1) return p2;
    }
  }
  return flat;
}
function splitFlat(tex, lim) {
  if (texWidth(tex) <= lim) return [tex];
  let depth = 0;
  const cands = [];
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '(' && tex.slice(i - 5, i) === '\\Bigl') continue;
    if (ch === ')' && tex.slice(i - 5, i) === '\\Bigr') continue;
    if ('{(['.includes(ch)) depth++;
    else if ('})]'.includes(ch)) depth--;
    else if ((ch === '+' || ch === '-') && depth === 0 && i > 0) {
      const prev = tex.slice(0, i).replace(/\s+$/, '');
      if (/[0-9a-zA-Z)}\]]$/.test(prev) && !/\\(?:cdot|to|times|pm)$/.test(prev)) cands.push(i);
    }
  }
  if (!cands.length) return [tex];
  const pieces = [];
  let start = 0; let last = -1;
  for (const c of cands) {
    if (texWidth(tex.slice(start, c)) > lim && last > start) { pieces.push(tex.slice(start, last)); start = last; }
    last = c;
  }
  if (texWidth(tex.slice(start)) > lim && last > start) { pieces.push(tex.slice(start, last)); start = last; }
  pieces.push(tex.slice(start));
  return pieces;
}
const classesOf = (tex) => [...String(tex).matchAll(/bt-([a-z0-9-]+)/g)].map((m) => `bt-${m[1]}`);
const notesFor = (notes, tex) => {
  const cl = classesOf(tex);
  const n = (notes || []).filter((x) => cl.includes(x.target));
  return n.length ? { notes: n } : {};
};

// Dlouhé řádky bez dvojitého podtržení (výsledky) se rozdělí; poznámky přejdou ke svému kousku.
export function fitBoard(lines, lim = LIM) {
  const out = [];
  for (const l of lines) {
    if ((l.notes || []).some((n) => n.kind === 'doubleUnderline')) { out.push(l); continue; }
    const parts = splitTop(l.tex, lim);
    if (parts.length === 1) { out.push(l); continue; }
    parts.forEach((p, i) => out.push({ tex: i ? `\\quad{}${p}` : p, ...notesFor(l.notes, p) }));
  }
  return out;
}
export const fitProblem = (p) => ({
  ...p,
  solution: p.solution.map((st) => (st.board ? { ...st, board: fitBoard(st.board) } : st)),
  ...(p.variants ? { variants: p.variants.map((v) => ({ ...v, solution: v.solution.map((st) => (st.board ? { ...st, board: fitBoard(st.board) } : st)) })) } : {}),
});

// Zlomek N/D s předponou; když se řádek nevejde, jdou čitatel a jmenovatel na zvláštní řádky.
export function fracLines(pre, N, D, notes) {
  const one = `${pre}\\frac{${N}}{${D}}`;
  if (texWidth(one) <= LIM) return [{ tex: one, ...notesFor(notes, one) }];
  const a = `\\text{čitatel: }${N}`; const b = `\\text{jmenovatel: }${D}`;
  const head = `${pre}\\frac{\\text{čitatel}}{\\text{jmenovatel}}`;
  return [{ tex: head }, { tex: a, ...notesFor(notes, a) }, { tex: b, ...notesFor(notes, b) }];
}

// ---------- znaménka bez „--“ a „+-“ ----------
// a − b, kde b může začínat minusem: a-(-2x·2x)
export const minusTex = (b) => (String(b).startsWith('-') ? `-(${b})` : `-${b}`);
// a + b, kde b může začínat minusem: a-2x místo a+-2x
export const plusTex = (b) => (String(b).startsWith('-') ? b : `+${b}`);

// ---------- přepis před derivováním a derivace člen po členu ----------
// Člen po členu podle pravidla (x^n)′ = n·x^{n−1} (členy tvaru c·x^p nebo c·atom); jinak null.
export function rawDerivTex(S) {
  const out = [];
  for (let i = 0; i < S.length; i++) {
    const t = S[i];
    const sign = t.c.n < 0 ? '-' : i ? '+' : '';
    const a = fr(Math.abs(t.c.n), t.c.d);
    const unit = a.n === 1 && a.d === 1;
    const coef = unit ? '' : `${frTex(a)}\\cdot `;
    const atoms = (t.E ? 1 : 0) + (t.S ? 1 : 0) + (t.C ? 1 : 0) + (t.L ? 1 : 0);
    if (atoms > 1 || (atoms === 1 && !isZero(t.p))) return null;
    if (atoms === 0) {
      if (isZero(t.p)) { out.push(`${i ? '+' : ''}0`); continue; }
      if (t.p.n === 1 && t.p.d === 1) { out.push(`${sign}${frTex(a)}\\cdot 1`); continue; }
      const pt = t.p.n < 0 ? `(${frTex(t.p)})` : frTex(t.p);
      out.push(`${sign}${unit ? pt : `${frTex(a)}\\cdot ${pt}`}\\,x^{${frTex(t.p)}-1}`);
    } else if (t.E) out.push(`${sign}${coef}${t.E === 1 ? '' : `${t.E < 0 ? `(${t.E})` : t.E}\\cdot `}${eTex(t.E)}`);
    else if (t.S) out.push(`${sign}${coef}\\cos x`);
    else if (t.C) out.push(`${sign}${coef}(-\\sin x)`);
    else out.push(`${sign}${coef}\\frac{1}{x}`);
  }
  return out.join('');
}
// f(x)=… a případně přepis na mocniny (4/x² → 4x^{-2})
export function rewriteLines(S, label = 'f(x)') {
  const a = sumTex(S); const b = powSumTex(S);
  return a === b ? [{ tex: `${label}=${a}` }] : [{ tex: `${label}=${a}` }, { tex: `=${b}` }];
}
// derivace člen po členu: f′(x)=pravidlo, =mocniny, =výsledek (bez opakování)
export function derivChain(S, label, D = dSum(S)) {
  const lines = [];
  const push = (tex) => { if (!lines.length || lines[lines.length - 1].tex !== tex) lines.push({ tex }); };
  const raw = rawDerivTex(S);
  if (raw) lines.push({ tex: `${label}=${raw}` });
  push(`${lines.length ? '=' : `${label}=`}${powSumTex(D)}`);
  push(`=${sumTex(D)}`);
  return lines;
}
