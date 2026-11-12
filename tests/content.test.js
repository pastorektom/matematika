import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadFixedProblems, hydrateProblems, clearContentCache } from '../js/content.js';
import { mountPractice } from '../js/ui/practice.js';
import { toSql, sqlString } from '../tools/problems-to-sql.mjs';
import vektory from '../js/topics/vektory.js';

const RAW = [
  { id: 'cv-x', type: 'skalarni-soucin', data: { a: [1, 2], b: [3, 4] }, source: 'Sbírka, příklad 1' },
  { id: 'cv-y', type: 'jiny', promptTex: '1+1', answerSpec: { kind: 'number', value: 2 }, source: 'Sbírka, příklad 2' },
  { id: 'cv-bad', type: 'jiny' },
];

test('hydrateProblems: postup ze solve(data), cizí typ zůstane, neúplný se vynechá', () => {
  const list = hydrateProblems(vektory, RAW);
  assert.equal(list.length, 2);
  assert.equal(list[0].answerSpec.value, 11);
  assert.ok(list[0].solution.length >= 3);
  assert.equal(list[0].source, 'Sbírka, příklad 1');
  assert.equal(list[0].id, 'cv-x');
  assert.deepEqual(list[1].solution, []);
});

test('loadFixedProblems: bez Supabase čte content/problems/<id>.json, 404 = prázdné pole', async () => {
  clearContentCache();
  const urls = [];
  const ok = async (url) => { urls.push(url); return { ok: true, json: async () => RAW }; };
  const list = await loadFixedProblems('vektory', { fetchImpl: ok });
  assert.equal(urls[0], 'content/problems/vektory.json');
  assert.equal(list.length, 2);
  clearContentCache();
  assert.deepEqual(await loadFixedProblems('vektory', { fetchImpl: async () => ({ ok: false, status: 404 }) }), []);
  assert.deepEqual(await loadFixedProblems('vektory', { fetchImpl: async () => { throw new Error('offline'); } }), []);
  assert.deepEqual(await loadFixedProblems('neni', { fetchImpl: ok }), []);
});

test('Procvičování: „Příklady ze cvičení“ jen s pevnými příklady, jdou popořadě a zapisují se jako cviceni', () => {
  const { window } = new JSDOM('<!doctype html><div id="r"></div>');
  const el = window.document.getElementById('r');
  const calls = []; const nav = [];
  const p = mountPractice(el, vektory, { record: (a) => { calls.push(a); return Promise.resolve(); }, navigate: (r) => nav.push(r) });
  assert.equal(el.querySelector('[data-role="type-cviceni"]'), null);
  p.setFixed([]);
  assert.equal(el.querySelector('[data-role="type-cviceni"]'), null);
  p.setFixed(hydrateProblems(vektory, RAW));
  el.querySelector('[data-role="type-cviceni"]').click();
  assert.match(el.querySelector('.prompt-label').textContent, /Příklady ze cvičení: 1 z 2 · Sbírka, příklad 1/);
  el.querySelector('[data-role="answer"] input').value = '11';
  el.querySelector('[data-role="check"]').click();
  assert.equal(calls[0].correct, true);
  assert.equal(calls[0].type, 'cviceni');
  assert.equal(calls[0].seed, 0);
  el.querySelector('[data-role="solution"]').click();
  assert.deepEqual(nav[0], { id: 'vektory', seed: 0, type: 'cviceni' });
  el.querySelector('[data-role="next"]').click();
  assert.match(el.querySelector('.prompt-label').textContent, /2 z 2/);
  el.querySelector('[data-role="next"]').click();
  assert.match(el.querySelector('.prompt-label').textContent, /1 z 2/);
});

test('problems-to-sql: insert s on conflict do nothing a escapované apostrofy', () => {
  assert.equal(sqlString("it's"), "'it''s'");
  const sql = toSql([{ topic: 'vektory', problems: [{ id: 'a', type: 'kombinace', promptTex: "x'" }, { id: 'b' }] }]);
  assert.match(sql, /values \('vektory', 'kombinace', 1, '\{"id":"a","type":"kombinace","promptTex":"x''"\}'::jsonb\) on conflict do nothing;/);
  assert.match(sql, /'vektory', 'cviceni', 2,/);
  assert.match(sql, /^-- .*\nbegin;[\s\S]*commit;\n$/);
});

test('zástupné téma _ukazka je pryč (soubor ani větev ?ukazka v app.js)', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  assert.equal(existsSync(new URL('../js/topics/_ukazka.js', import.meta.url)), false);
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /ukazka/);
});
