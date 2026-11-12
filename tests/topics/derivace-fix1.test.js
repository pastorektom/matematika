// Oprava po revizi (kolo 1): TeX na tabuli (znaménka, jmenovatele, šířka), mezikroky,
// l'Hospital, svislé asymptoty a řídké obsahové kontroly (jen když je content/ k dispozici).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as math from 'mathjs';
import derivace from '../../js/topics/derivace.js';
import { hydrateProblems } from '../../js/content.js';
import { fixedProblemsFile } from '../helpers/verify.js';
import { check } from '../../js/checker.js';
import { makeRng } from '../../js/rng.js';

const type = (id) => derivace.types.find((t) => t.id === id);
const ALL = derivace.types.map((t) => t.id);
const tex = (p) => p.solution.flatMap((s) => (s.board || []).map((l) => l.tex));

// druhá skupina za \frac{..}{..}
function denominators(t) {
  const s = t.replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '');
  const out = [];
  let idx = 0;
  while ((idx = s.indexOf('\\frac{', idx)) >= 0) {
    let i = idx + 5; let d = 0; const g = [];
    for (let k = 0; k < 2; k++) {
      const st = i;
      for (; i < s.length; i++) {
        if (s[i] === '{') d++;
        else if (s[i] === '}') { d--; if (d === 0) { i++; break; } }
      }
      g.push(s.slice(st + 1, i - 1));
    }
    out.push(g[1]);
    idx += 6;
  }
  return out;
}
// záporný jmenovatel včetně závorkového: -x, (-8), ale (-2)^{4} je kladné
const negativeDen = (den) => den.startsWith('-') || (/^\(-/.test(den) && !/^\(-[^)]*\)\^\{(2|4|6)\}/.test(den) && !/^\(-[^)]*\)\^\{\d*[02468]\}/.test(den));
const width = (t) => t
  .replace(/\\htmlClass\{bt-[a-z0-9-]+\}/g, '')
  .replace(/\\(?:left|right|big|text|operatorname|stackrel|mathbb)/g, '')
  .replace(/\\[,;:! ]/g, '')
  .replace(/\\[a-zA-Z]+/g, 'X')
  .replace(/[{}\s]/g, '').length;

test('tabule: žádné „--“ ani „+-“, žádný záporný jmenovatel, žádná zatoulaná čárka (300 seedů na typ)', () => {
  for (const id of ALL) {
    for (let seed = 1; seed <= 300; seed++) {
      const p = type(id).generate(makeRng(seed));
      for (const t of [p.answerTex, ...tex(p)]) {
        const plain = t.replace(/\\[a-zA-Z]+/g, '');
        assert.ok(!/--|\+-|-\+|\+\+/.test(plain), `${id} ${seed}: dvojí znaménko v ${t}`);
        for (const den of denominators(t)) assert.ok(!negativeDen(den), `${id} ${seed}: záporný jmenovatel ${den} v ${t}`);
      }
      if (id === 'logder') {
        // dřív se „\,“ v šabloně změnilo v čárku: x^{x²}(2x, ln x + …)
        for (const t of tex(p)) assert.ok(!/[^\\],/.test(t.replace(/\\left\(|\\right\)/g, '')), `logder ${seed}: čárka v ${t}`);
      }
    }
  }
});

test('tabule: řádky se vejdou na 360 px (podíl 23 %, mocniny 18 %, asymptoty 18 % → pod 3 %)', () => {
  for (const id of ['mocniny', 'podil', 'logder', 'konvexnost', 'asymptoty', 'asymptoty-svisle', 'prubeh', 'monotonie', 'extremy']) {
    let lines = 0; let wide = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (const t of tex(type(id).generate(makeRng(seed)))) { lines++; if (width(t) > 28) wide++; }
    }
    assert.ok(wide / lines < 0.03, `${id}: ${((100 * wide) / lines).toFixed(1)} % řádků je širších než 28 znaků`);
  }
});

test('l\'Hospital: „znovu neurčitý výraz“ jen tam, kde se pravidlo opravdu použije podruhé', () => {
  for (const id of ['lhospital', 'lhospital-nekonecno', 'lhospital-upravy']) {
    for (let seed = 1; seed <= 300; seed++) {
      const p = type(id).generate(makeRng(seed));
      p.solution.forEach((s, i) => {
        if (/znovu neurčitý/.test(s.text)) assert.ok(p.solution.slice(i + 1).some((q) => /použití/.test(q.title)), `${id} ${seed}: „znovu neurčitý“, ale další l'H nenásleduje`);
      });
    }
  }
  // (−4x + ln x)/(3x) pro x→∞: po prvním použití je (−4+1/x)/3 → −4/3, žádné další použití
  const p = type('lhospital-nekonecno').solve({ N: [{ c: -4, p: 1 }, { c: 1, L: 1 }], D: [{ c: 3, p: 1 }] });
  assert.equal(p.solution.filter((s) => /použití/.test(s.title)).length, 1);
  assert.ok(!p.solution.some((s) => /znovu neurčitý/.test(s.text)));
  assert.equal(check(p.answerSpec, '-4/3').ok, true);
});

test('druhá derivace a tečna: mezikroky z 4/x² přes 4x^{-2} a mocninové pravidlo na −8/x³', () => {
  const d = type('druha').solve({ terms: [{ c: 4, p: -1 }, { c: 1, p: 2 }], x0: 1 });
  const lines = d.solution.slice(0, 2).flatMap((s) => s.board.map((l) => l.tex));
  assert.ok(lines.some((l) => l.includes('4x^{-1}')), 'přepis na mocniny');
  assert.ok(lines.some((l) => l.includes('4\\cdot (-1)')), 'pravidlo (x^n)′ = n x^{n-1}');
  assert.ok(lines.some((l) => l.includes('-4x^{-2}')), 'výsledek v mocninách');
  assert.ok(lines.some((l) => l.includes('8x^{-3}')), 'druhá derivace v mocninách');
  const t = type('tecna').solve({ terms: [{ c: 4, p: -1 }], x0: 2 });
  const tl = t.solution.flatMap((s) => s.board.map((l) => l.tex));
  assert.ok(tl.some((l) => l.includes('4x^{-1}')) && tl.some((l) => l.includes('-4x^{-2}')));
  assert.equal(check(t.answerSpec, '-x+4').ok, true);
});

test('normála: bez záporného jmenovatele a bez opakovaného řádku, výsledek sedí', () => {
  const n = type('normala').solve({ terms: [{ c: 4, p: -1 }], x0: -4 }); // k = −1/4 → k_n = 4
  const lines = n.solution.flatMap((s) => s.board.map((l) => l.tex));
  assert.ok(lines.some((l) => /k_n=4$/.test(l)));
  for (const t of lines) for (const den of denominators(t)) assert.ok(!negativeDen(den), t);
  const m = type('normala').solve({ terms: [{ c: 1, p: 2 }], x0: 11 }); // k = 22 → k_n = −1/22
  const ml = m.solution.flatMap((s) => s.board.map((l) => l.tex));
  assert.ok(ml.some((l) => l === 'k_n=-\\frac{1}{22}'));
  assert.ok(!ml.some((l) => l === '=-\\frac{1}{22}'), 'opakovaný řádek');
});

test('složená funkce: žádný zlomek ve zlomku, když se dá sloučit (arcsin √x)', () => {
  const p = type('slozena').solve({ outer: 'asin', inner: [{ c: 1, p: '1/2' }] });
  assert.ok(!/\\frac\{\\frac/.test(p.answerTex), p.answerTex);
  assert.equal(check(p.answerSpec, '1/(2*sqrt(x)*sqrt(1-x))').ok, true);
});

test('logaritmická derivace x^{ln x}: stejné členy se sečtou na 2 ln x / x', () => {
  const p = type('logder').solve({ u: [{ c: 1, p: 1 }], v: [{ c: 1, L: 1 }] });
  assert.ok(p.answerTex.includes('\\frac{2\\ln x}{x}'), p.answerTex);
  assert.equal(check(p.answerSpec, 'x^(log(x))*2*log(x)/x').ok, true);
});

test('definiční obor: text závisí na funkci (polynom nemá jmenovatel)', () => {
  const poly = type('monotonie').solve({ fam: 'P1', s: 1, b: 1 });
  assert.ok(!/jmenovatel/.test(poly.solution[0].text), poly.solution[0].text);
  const rat = type('monotonie').solve({ fam: 'R1', d: 2, m: 1 });
  assert.match(rat.solution[0].text, /jmenovatel nesmí být nula/);
  const e = type('prubeh').solve({ fam: 'E1', s: 1, b: 0 });
  assert.ok(!/jmenovatel nesmí/.test(e.solution[0].text));
  const r2 = type('prubeh').solve({ fam: 'R2', k: 1, m: 2 });
  assert.match(r2.solution[0].text, /kladný/);
});

test('průběh: do grafu přibyly průsečíky s osami (zelené body)', () => {
  const p = type('prubeh').solve({ fam: 'P1', s: 1, b: 1 }); // x²(x−3): nuly 0 a 3, (0;0) je extrém
  const plot = p.solution.find((s) => s.viz && s.viz.kind === 'plot').viz.data;
  const green = plot.points.filter((q) => q.color === 'green');
  assert.ok(green.some((q) => q.x === 3 && q.y === 0), JSON.stringify(green));
  const q = type('prubeh').solve({ fam: 'E1', s: 1, b: 3 }); // (x−3)e^x: x-průsečík 3, y-průsečík −3
  const g2 = q.solution.find((s) => s.viz && s.viz.kind === 'plot').viz.data.points.filter((z) => z.color === 'green');
  assert.ok(g2.some((z) => z.x === 3 && z.y === 0) && g2.some((z) => z.x === 0 && Math.abs(z.y + 3) < 1e-9), JSON.stringify(g2));
  assert.match(q.solution.find((s) => s.viz && s.viz.kind === 'plot').text, /průsečíky s osami/);
});

test('průběh: shrnutí je po jedné položce na řádek a po slepení dává answerTex', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const p = type('prubeh').generate(makeRng(seed));
    const last = p.solution[p.solution.length - 1].board.map((l) => l.tex);
    const flat = (s) => s.replace(/\\[,;:! ]/g, '').replace(/[{}\s]/g, '');
    assert.equal(flat(last.join('')), flat(p.answerTex));
    for (const l of last) assert.ok(width(l) <= 28, l);
  }
});

test('asymptoty: zadání říká, co se hledá; svislé asymptoty jako seznam', () => {
  assert.match(type('asymptoty').generate(makeRng(1)).task, /šikmou asymptotu/);
  assert.match(type('asymptoty').generate(makeRng(1)).task, /y = kx \+ q/);
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const p = type('asymptoty-svisle').generate(makeRng(seed));
    assert.equal(p.answerSpec.kind, 'list');
    assert.match(p.task, /středník/);
    assert.equal(check(p.answerSpec, p.answerSpec.value.join('; ')).ok, true, `seed ${seed}`);
    assert.ok(p.solution.length >= 3);
    for (const s of p.solution) assert.ok(s.text.length > 10 && s.board.length > 0);
    const last = p.solution[p.solution.length - 1].board.map((l) => l.tex).join(' ');
    assert.ok(last.includes(p.answerTex), `seed ${seed}: poslední krok bez výsledku`);
    // nezávislý výpočet: póly jsou celá čísla, kde |f| u nich roste přes všechny meze
    const d = p.data;
    const fe = d.fam === 'A' ? `(${d.a}*x^2+${d.b}*x+${d.c})/(x-(${d.d}))` : `(${d.a}*x^3+${d.b}*x^2+${d.c}*x+${d.e})/(x^2+(${d.g}))`;
    const f = math.compile(fe);
    const poles = [];
    for (let x0 = -8; x0 <= 8; x0++) {
      if (Math.abs(f.evaluate({ x: x0 + 1e-7 })) > 1e5 && Math.abs(f.evaluate({ x: x0 - 1e-7 })) > 1e5) poles.push(x0);
    }
    assert.equal(check(p.answerSpec, poles.join('; ')).ok, true, `seed ${seed}: póly ${poles} ≠ ${p.answerSpec.value}`);
    seen.add(p.promptTex);
  }
  assert.ok(seen.size >= 20);
});

// ---------- obsah (jen když je content/ k dispozici) ----------
const RE_CTRL = /[\u0000-\u0009\u000b-\u001f]/;
function strings(v, path, out) {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) { out.push([`${path}.<klíč>`, k]); strings(v[k], `${path}.${k}`, out); }
}
test('content: žádné řídicí znaky v uložených řetězcích (derivace.json, derivace-checks.json)', (ctx) => {
  const files = ['derivace.json', 'derivace-checks.json'].map((f) => fileURLToPath(new URL(`../../content/problems/${f}`, import.meta.url)));
  if (!files.every((f) => existsSync(f))) { ctx.skip('content/problems/derivace*.json chybí'); return; }
  for (const f of files) {
    const out = [];
    strings(JSON.parse(readFileSync(f, 'utf8')), '$', out);
    for (const [p, s] of out) assert.ok(!RE_CTRL.test(s), `${f} ${p}: řídicí znak v ${JSON.stringify(s)}`);
  }
});

test('content: pevné příklady – žádné „--“, záporné jmenovatele ani řídicí znaky na tabuli', (ctx) => {
  const raw = fixedProblemsFile('derivace');
  if (!raw) { ctx.skip('content/problems/derivace.json chybí'); return; }
  for (const p of hydrateProblems(derivace, raw)) {
    for (const t of [p.answerTex ?? '', ...tex(p)]) {
      assert.ok(!RE_CTRL.test(t), `${p.id}: řídicí znak v ${JSON.stringify(t)}`);
      assert.ok(!/--|\+-/.test(t.replace(/\\[a-zA-Z]+/g, '')), `${p.id}: dvojí znaménko v ${t}`);
    }
    for (const s of p.solution) assert.ok(!RE_CTRL.test(s.text + s.title), `${p.id}: řídicí znak v textu kroku`);
    if (['normala', 'tecna'].includes(p.type)) {
      for (const t of tex(p)) for (const den of denominators(t)) assert.ok(!negativeDen(den), `${p.id}: záporný jmenovatel ${den}`);
    }
  }
});
