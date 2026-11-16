// Pomůcky pro „Vlastní příklad“: čtení a kontrola zadání uživatele. Typy příkladů v js/topics/*.js
// mají volitelné `custom: { fields, build(values) }`; build vrátí `data` pro solve(data)
// nebo vyhodí Error s českou hláškou. Hodnoty polí: matice = pole polí řetězců, vektor = pole řetězců,
// výraz a číslo = řetězec. Pole: { id, label, kind: 'matrix'|'vector'|'expr'|'number', rows?, cols?, fixed?, square?, hint? }.
import { parse, normalize } from './checker-core.js';
import { fr, mul, add, frStr } from './lin.js';

export const MAX_DIM = 5;
const MAX_ABS = 99;
export const fail = (msg) => { throw new Error(msg); };

export function intOf(raw, what = 'Hodnota') {
  const s = normalize(String(raw ?? ''), { decimalComma: false });
  if (!s) fail(`${what}: vyplň všechna pole.`);
  if (!/^-?\d+$/.test(s)) fail(`${what}: „${String(raw).trim()}“ není celé číslo (zadej např. 3 nebo -2).`);
  const v = Number(s);
  if (Math.abs(v) > MAX_ABS) fail(`${what}: číslo ${v} je příliš velké (nejvýše ${MAX_ABS} v absolutní hodnotě).`);
  return v;
}

export function intMatrix(values, { square = false, minN = 1 } = {}) {
  if (!Array.isArray(values) || !values.length) fail('Matice je prázdná.');
  const M = values.map((r) => r.map((x) => intOf(x, 'Matice')));
  if (M.length > MAX_DIM || M[0].length > MAX_DIM) fail(`Matice může mít nejvýše ${MAX_DIM} řádků a sloupců.`);
  if (square && M.length !== M[0].length) fail('Matice musí být čtvercová (stejný počet řádků a sloupců).');
  if (M.length < minN) fail(`Matice musí mít aspoň ${minN} řádky.`);
  return M;
}
export const intVector = (values) => {
  if (!Array.isArray(values) || !values.length) fail('Vektor je prázdný.');
  return values.map((x) => intOf(x, 'Vektor'));
};

// determinant rozvojem (jen pro kontrolu regularity, matice je nejvýše 5×5)
export function detOf(M) {
  if (M.length === 1) return M[0][0];
  return M[0].reduce((s, a, j) => s + (a === 0 ? 0 : (j % 2 ? -1 : 1) * a * detOf(M.slice(1).map((r) => r.filter((_, k) => k !== j)))), 0);
}
export function regularMatrix(values, minN = 2) {
  const M = intMatrix(values, { square: true, minN });
  if (detOf(M) === 0) fail('Matice je singulární (determinant je 0), takže tady nejde použít. Zkus jinou matici.');
  return M;
}

// ---------- výrazy ----------
export function parseExpr(str) {
  const s = normalize(String(str ?? ''));
  if (!s) fail('Zadej výraz.');
  try { return parse(s); } catch { return fail('Výraz se nepodařilo přečíst. Zkontroluj závorky a násobení (např. 2*x nebo 2x).'); }
}
// TeX pro živý náhled; při chybě vrací null
export function exprTex(str) {
  try { return parseExpr(str).toTex({ parenthesis: 'keep' }); } catch { return null; }
}

// Výraz v x -> součet členů c·x^p (c, p zlomky): + − · / konstantou, mocnina, sqrt(x), závorky.
const one = fr(1);
const norm = (ts) => {
  const m = new Map();
  for (const t of ts) { const k = frStr(t.p); m.set(k, m.has(k) ? { p: t.p, c: add(m.get(k).c, t.c) } : t); }
  return [...m.values()].filter((t) => t.c.n !== 0);
};
const mulT = (A, B) => norm(A.flatMap((a) => B.map((b) => ({ c: mul(a.c, b.c), p: add(a.p, b.p) }))));
const isConst = (A) => A.length === 0 || (A.length === 1 && A[0].p.n === 0);
function termsOfNode(n) {
  switch (n.type) {
    case 'ParenthesisNode': return termsOfNode(n.content);
    case 'ConstantNode':
      if (!Number.isInteger(n.value)) fail('Používej jen celá čísla; zlomky zapiš pomocí /, např. 1/2.');
      return norm([{ c: fr(n.value), p: fr(0) }]);
    case 'SymbolNode':
      if (n.name !== 'x') fail(`Neznámý symbol „${n.name}“. Používej jen proměnnou x.`);
      return [{ c: one, p: one }];
    case 'FunctionNode': {
      if (n.fn?.name !== 'sqrt' || n.args.length !== 1) fail('Tady jsou povoleny jen mocniny a odmocnina sqrt(…) z mocniny x.');
      const a = termsOfNode(n.args[0]);
      if (a.length !== 1 || a[0].c.n !== 1 || a[0].c.d !== 1) fail('Odmocnina je povolena jen z mocniny x (např. sqrt(x) nebo sqrt(x^3)).');
      return [{ c: one, p: mul(a[0].p, fr(1, 2)) }];
    }
    case 'OperatorNode': {
      const [a, b] = n.args;
      if (n.fn === 'unaryMinus') return termsOfNode(a).map((t) => ({ ...t, c: mul(t.c, fr(-1)) }));
      if (n.fn === 'unaryPlus') return termsOfNode(a);
      const A = termsOfNode(a); const B = termsOfNode(b);
      if (n.fn === 'add') return norm([...A, ...B]);
      if (n.fn === 'subtract') return norm([...A, ...B.map((t) => ({ ...t, c: mul(t.c, fr(-1)) }))]);
      if (n.fn === 'multiply') return mulT(A, B);
      if (n.fn === 'divide') {
        if (B.length !== 1) fail('Dělit lze jen jedním členem (číslem nebo mocninou x). Podíl funkcí zadej v typu „Derivace podílu“.');
        return mulT(A, [{ c: fr(B[0].c.d, B[0].c.n), p: mul(B[0].p, fr(-1)) }]);
      }
      if (n.fn === 'pow') {
        if (!isConst(B) || !B.length) fail('Exponent musí být číslo (např. x^2 nebo x^(1/2)).');
        const k = B[0].c;
        if (A.length === 1 && (k.d === 1 || (A[0].c.n === 1 && A[0].c.d === 1))) {
          const c = k.d === 1 ? { n: A[0].c.n ** Math.abs(k.n), d: A[0].c.d ** Math.abs(k.n) } : one;
          return [{ c: k.n < 0 ? fr(c.d, c.n) : fr(c.n, c.d), p: mul(A[0].p, k) }];
        }
        if (k.d !== 1 || k.n < 0 || k.n > 6) fail('Víceclennou závorku lze umocnit jen na celé číslo 0 až 6.');
        let r = [{ c: one, p: fr(0) }];
        for (let i = 0; i < k.n; i++) r = mulT(r, A);
        return r;
      }
      return fail('Nepodporovaná operace ve výrazu.');
    }
    default: return fail('Výraz obsahuje nepodporovaný zápis. Povoleno: čísla, x, + − * / ^ a sqrt.');
  }
}
export function termsOf(str) {
  const T = termsOfNode(parseExpr(str));
  if (!T.length) fail('Výraz je po úpravě nulový.');
  return T.sort((a, b) => b.p.n / b.p.d - a.p.n / a.p.d).map((t) => ({ c: frStr(t.c), p: frStr(t.p) }));
}
// Mnohočlen s celočíselnými koeficienty -> pole od absolutního členu (jako v limita-lib).
export function polyOf(str, empty) {
  if (empty !== undefined && !String(str ?? '').trim()) return empty;
  const T = termsOfNode(parseExpr(str));
  if (!T.length) return [0];
  const out = [];
  for (const t of T) {
    if (t.p.d !== 1 || t.p.n < 0 || t.p.n > 6 || t.c.d !== 1) fail('Tady je potřeba mnohočlen s celými koeficienty a celými nezápornými mocninami x (např. x^2-3x+2).');
    out[t.p.n] = t.c.n;
  }
  return Array.from(out, (v) => v || 0);
}
