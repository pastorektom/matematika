import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../sw-rules.js';
import { canRegister } from '../js/pwa.js';

const { classify } = globalThis.SWRules;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SCOPE = 'https://user.github.io/matematika/';

test('vlastní soubory: index nejdřív ze sítě, ostatní z cache', () => {
  assert.equal(classify(SCOPE, SCOPE, 'GET'), 'shell');
  assert.equal(classify(`${SCOPE}index.html`, SCOPE, 'GET'), 'shell');
  assert.equal(classify(`${SCOPE}js/app.js`, SCOPE, 'GET'), 'static');
  assert.equal(classify(`${SCOPE}css/app.css?v=2`, SCOPE, 'GET'), 'static');
  assert.equal(classify(`${SCOPE}icons/icon-192.png`, SCOPE, 'GET'), 'static');
});

test('nikdy se nesahá na Supabase, content/ ani sw.js', () => {
  assert.equal(classify('https://abcd.supabase.co/rest/v1/attempts', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://abcd.supabase.co/auth/v1/token', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://abcd.supabase.in/rest/v1/x', SCOPE, 'GET'), 'skip');
  assert.equal(classify(`${SCOPE}content/problems/limita.json`, SCOPE, 'GET'), 'skip');
  assert.equal(classify(`${SCOPE}sw.js`, SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm', SCOPE, 'GET'), 'cdn');
});

test('zápisy a cizí adresy se přeskočí', () => {
  assert.equal(classify(`${SCOPE}js/app.js`, SCOPE, 'POST'), 'skip');
  assert.equal(classify('https://example.com/a.js', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://github.io/jinde/js/app.js', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://user.github.io/jina-appka/x.js', SCOPE, 'GET'), 'skip');
  assert.equal(classify('chrome-extension://abc/x.js', SCOPE, 'GET'), 'skip');
  assert.equal(classify('neplatne', SCOPE, 'GET'), 'skip');
});

test('CDN: jen jsDelivr s přesnou verzí', () => {
  assert.equal(classify('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css', SCOPE, 'GET'), 'cdn');
  assert.equal(classify('https://cdn.jsdelivr.net/npm/mathjs@13.2.0/+esm', SCOPE, 'GET'), 'cdn');
  assert.equal(classify('https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://cdn.jsdelivr.net/npm/katex@latest/x.js', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://cdn.jsdelivr.net/npm/katex@0.16/x.js', SCOPE, 'GET'), 'skip');
  assert.equal(classify('https://cdnjs.cloudflare.com/ajax/libs/x@1.2.3/x.js', SCOPE, 'GET'), 'skip');
});

test('koření funguje i v kořeni domény', () => {
  assert.equal(classify('http://localhost:8521/js/app.js', 'http://localhost:8521/', 'GET'), 'static');
  assert.equal(classify('http://localhost:8521/content/problems/a.json', 'http://localhost:8521/', 'GET'), 'skip');
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(relative(ROOT, p).split(sep).join('/'));
  }
  return out;
}

test('sw.js předukládá všechny vlastní soubory a žádný neexistující', () => {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const listed = [...src.slice(src.indexOf('var PRECACHE'), src.indexOf('];')).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const files = [...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'css')), ...walk(join(ROOT, 'icons'))];
  for (const f of files) assert.ok(listed.includes(f), `chybí v PRECACHE: ${f}`);
  for (const f of listed) if (f !== './') assert.ok(existsSync(join(ROOT, f)), `neexistuje: ${f}`);
});

test('manifest je platný a odkazuje na existující ikony', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Matematika E1');
  assert.equal(m.lang, 'cs');
  assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, i.src)), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

test('registrace jen na https nebo localhost', () => {
  const nav = { serviceWorker: {} };
  assert.equal(canRegister({ protocol: 'https:', hostname: 'a.github.io' }, nav), true);
  assert.equal(canRegister({ protocol: 'http:', hostname: 'localhost' }, nav), true);
  assert.equal(canRegister({ protocol: 'http:', hostname: '192.168.1.5' }, nav), false);
  assert.equal(canRegister({ protocol: 'https:', hostname: 'a.cz' }, {}), false);
});
