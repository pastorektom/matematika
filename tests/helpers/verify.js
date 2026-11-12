// Společná kontrola tématu: pro každý typ vygeneruje n příkladů (seed 1..n) a ověří, že
//  - check(answerSpec, answerSpec.value) projde (zadaná správná odpověď se uzná),
//  - postup má aspoň 3 kroky a každý krok má český text a řádky na tabuli,
//  - poslední krok obsahuje výsledek (answerTex),
//  - nezávislý výpočet (oracles[typ](data), psaný v testu přes math.js) dá stejnou hodnotu.
// Totéž se ověří u pevných příkladů ze cvičení (content/problems/<id>.json), pokud soubor existuje
// (na jiných počítačích a v CI chybí, protože content/ není v gitu), nebo předaných ve volbě `fixed`.
// Typy bez generate() (jen pevné příklady) se při generování přeskočí. Hotový pevný příklad bez `data`
// nemá nezávislý výpočet: ověří se jen, že jeho zadaná odpověď projde kontrolou.
// Druh 'whiteboard' (kreslení na tabuli) se kontrolou odpovědi neověřuje, postup s výsledkem ano.
//
// Volby verify: oracles, fixed (pole pevných příkladů místo souboru), strictDenominators – hlídá
// i závorkovaný záporný jmenovatel \frac{x}{(-3)}; výchozí false, zapnuto u referenčního tématu vektory.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';
import { hydrateProblems } from '../../js/content.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Hodnota -> vstup, jaký by zapsal student (čísla jako text; soustava je jedno textové pole).
export function asInput(v, kind) {
  if (kind === 'system' && Array.isArray(v)) return `(${v.map(String).join('; ')})`;
  if (kind === 'list' && Array.isArray(v)) return v.map(String).join('; ');
  if (Array.isArray(v)) return v.map((x) => asInput(x));
  if (typeof v === 'number') return String(v);
  return v;
}

// TeX bez poznámek tabule, závorek a mezer: '=\htmlClass{bt-v}{(1,\ 2)}' -> '=(1,2)'
export function flatTex(s) {
  return String(s ?? '')
    .replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '')
    .replace(/\\[,;:! ]/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/[{}\s]/g, '');
}

// Obsah složené závorky začínající na s[i] === '{' -> { body, end } (end = index za '}'), jinak null.
function braced(s, i) {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

// Kulatá závorka na začátku uzavírá celý výraz: '(-3)' ano, '(-3)^2+1' ne.
function closesAtEnd(t) {
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')' && --depth === 0) return i === t.length - 1;
  }
  return false;
}

// Záporné jmenovatele ve zlomcích \frac, \dfrac, \tfrac (i vnořených):
// [{ den, parenthesised }] – parenthesised = jmenovatel tvaru (-…), \left(-…\right), (-(…)).
export function negativeDenominators(tex) {
  const s = String(tex ?? '');
  const out = [];
  const re = /\\[dt]?frac\s*(?=\{)/g;
  while (re.exec(s)) {
    const num = braced(s, re.lastIndex);
    if (!num) continue;
    let k = num.end;
    while (s[k] === ' ') k++;
    const den = braced(s, k);
    if (!den) continue;
    const flat = den.body
      .replace(/\\htmlClass\{[^{}]*\}/g, '')
      .replace(/\\(left|right|bigl|bigr|Bigl|Bigr|big|Big)/g, '')
      .replace(/\\[,;:! ]/g, '')
      .replace(/[{}\s]/g, '')
      .replace(/^[−–]/, '-')
      .replace(/^\([−–]/, '(-');
    if (flat.startsWith('-')) out.push({ den: den.body, parenthesised: false });
    else if (flat.startsWith('(-') && closesAtEnd(flat)) out.push({ den: den.body, parenthesised: true });
  }
  return out;
}

function stepContent(step) {
  const lines = Array.isArray(step.board) ? step.board.map((l) => l.tex) : [];
  return [step.text, step.tex, ...lines].join(' ');
}

// opts: { strictDenominators?: boolean, raw?: boolean (pevný příklad: bez data se nezávislý výpočet vynechá) }
export function checkProblem(p, oracles = {}, label = '', opts = {}) {
  const at = `${label} (${p.type}, ${p.promptTex})`;
  assert.ok(p.answerSpec && p.answerSpec.kind, `${at}: chybí answerSpec`);
  assert.equal(typeof p.promptTex, 'string', `${at}: chybí promptTex`);
  const board = p.answerSpec.kind === 'whiteboard';
  if (!board) {
    const self = check(p.answerSpec, asInput(p.answerSpec.value, p.answerSpec.kind));
    assert.equal(self.ok, true, `${at}: správná odpověď neprošla kontrolou: ${JSON.stringify(self)}`);
  }

  assert.ok(Array.isArray(p.solution) && p.solution.length >= 3, `${at}: postup má méně než 3 kroky`);
  for (const [i, s] of p.solution.entries()) {
    assert.ok(typeof s.text === 'string' && s.text.length > 10, `${at}: krok ${i + 1} nemá text`);
    assert.ok(Array.isArray(s.board) && s.board.length > 0, `${at}: krok ${i + 1} nemá tabuli`);
  }
  // tabule: žádný řádek dvakrát po sobě, žádný záporný jmenovatel
  const all = p.solution.flatMap((st) => (st.board || []).map((l) => flatTex(l.tex)));
  all.forEach((l, i) => assert.notEqual(l, all[i - 1], `${at}: řádek tabule se opakuje: ${l}`));
  for (const st of p.solution) {
    for (const l of st.board || []) {
      // mírná kontrola (výchozí): jen čitatel bez složených závorek a jmenovatel začínající „-“;
      // přísná: závorkový skener – libovolný čitatel, i (-…), \left(-…\right), (-(…))
      const bad = opts.strictDenominators ? negativeDenominators(l.tex).length > 0 : /\\frac\{[^{}]*\}\{-/.test(l.tex);
      assert.ok(!bad, `${at}: záporný jmenovatel: ${l.tex}`);
    }
  }
  assert.equal(typeof p.answerTex, 'string', `${at}: chybí answerTex`);
  const last = flatTex(stepContent(p.solution[p.solution.length - 1]));
  assert.ok(last.includes(flatTex(p.answerTex)), `${at}: poslední krok neobsahuje výsledek ${p.answerTex}`);

  if (board || (opts.raw && p.data === undefined)) return;
  const oracle = oracles[p.type];
  assert.equal(typeof oracle, 'function', `${at}: chybí nezávislý výpočet pro typ ${p.type}`);
  const expected = oracle(p.data);
  const r = check(p.answerSpec, asInput(expected, p.answerSpec.kind));
  assert.equal(r.ok, true, `${at}: nezávislý výpočet ${JSON.stringify(expected)} ≠ ${JSON.stringify(p.answerSpec.value)}`);
}

export function fixedProblemsFile(topicId) {
  const file = `${ROOT}content/problems/${topicId}.json`;
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function verify(topic, n = 200, { oracles = {}, strictDenominators = false, fixed: fixedList } = {}) {
  const types = Array.isArray(topic.types) ? topic.types : [];
  const raw = fixedList ?? fixedProblemsFile(topic.id);
  assert.ok(types.length > 0 || raw, 'téma nemá typy příkladů');
  const opts = { strictDenominators };
  let count = 0;
  for (const type of types) {
    if (typeof type.generate !== 'function') continue;
    const seen = new Set();
    for (let seed = 1; seed <= n; seed++) {
      const p = type.generate(makeRng(seed));
      assert.equal(p.type, type.id, `${type.id}: příklad má jiný typ`);
      checkProblem(p, oracles, `${type.id} seed ${seed}`, opts);
      seen.add(p.promptTex);
      count++;
    }
    assert.ok(seen.size >= Math.min(20, n / 4), `${type.id}: málo různých zadání (${seen.size})`);
  }
  let fixed = 0;
  if (raw) {
    const hydrated = hydrateProblems(topic, raw);
    assert.equal(hydrated.length, raw.length, 'některý pevný příklad nemá zadání nebo odpověď');
    for (const p of hydrated) {
      assert.ok(p.source, `${p.id}: chybí zdroj`);
      checkProblem(p, oracles, `pevný ${p.id}`, { ...opts, raw: true });
      fixed++;
    }
  }
  return { generated: count, fixed };
}
