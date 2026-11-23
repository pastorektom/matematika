// Procvičovací test (#/test): čistá logika – zadání z existujících generátorů, bodování a čas.
// Typy příkladů značí `test: { part, level }` (level 0 = obě úrovně) v js/topics/*.js.
import { makeRng } from './rng.js';

export const PARTS = [
  { id: 'limity', label: 'Limity' },
  { id: 'der1', label: 'Derivace 1. řádu' },
  { id: 'der2', label: 'Derivace 2. řádu' },
];
export const LEVELS = [
  { id: 'easy', label: 'Snazší' },
  { id: 'hard', label: 'Složitější' },
  { id: 'mix', label: 'Mix' },
];
export const COUNTS = [5, 10, 15, 20];
export const LIMITS = [0, 20, 30, 45, 60]; // minuty, 0 = bez limitu
export const PASS_PERCENT = 50;
export const DEFAULT_CONFIG = { parts: ['limity', 'der1', 'der2'], level: 'mix', count: 10, limit: 0 };
const AUTO_KINDS = new Set(['limit', 'expression', 'number']);

export const partLabel = (id) => PARTS.find((p) => p.id === id)?.label ?? id;

// Typy použitelné v testu: [{ topic, type, part, level }] (level 0 platí pro obě úrovně).
export function testPool(topics) {
  const out = [];
  for (const t of topics) for (const type of t.types || []) if (type.test) out.push({ topic: t, type, part: type.test.part, level: type.test.level });
  return out;
}

export function normalizeConfig(c) {
  const parts = PARTS.map((p) => p.id).filter((id) => (c?.parts ?? DEFAULT_CONFIG.parts).includes(id));
  return {
    parts: parts.length ? parts : [...DEFAULT_CONFIG.parts],
    level: LEVELS.some((l) => l.id === c?.level) ? c.level : DEFAULT_CONFIG.level,
    count: COUNTS.includes(Number(c?.count)) ? Number(c.count) : DEFAULT_CONFIG.count,
    limit: LIMITS.includes(Number(c?.limit)) ? Number(c.limit) : DEFAULT_CONFIG.limit,
  };
}
export const encodeConfig = (c) => { const n = normalizeConfig(c); return `${n.parts.join(',')}~${n.level}~${n.count}~${n.limit}`; };
export function decodeConfig(s) {
  const [parts, level, count, limit] = String(s ?? '').split('~');
  return normalizeConfig({ parts: (parts || '').split(','), level, count, limit });
}

const mulberryPick = (rng, n) => Math.floor(rng() * n);

// Seed + nastavení -> přesně `count` otázek: { n, part, level, topic, type, seed, problem }.
// Části se střídají rovnoměrně, úroveň v režimu Mix střídá, typy v dané části/úrovni se točí v náhodném pořadí.
export function buildTest(topics, seed, config) {
  const cfg = normalizeConfig(config);
  const pool = testPool(topics);
  const rng = makeRng(seed);
  const orders = new Map(); // klíč část|úroveň -> zamíchané typy
  const used = new Map();   // klíč -> kolikátý typ je na řadě
  const seen = new Set();
  const out = [];
  for (let i = 0; i < cfg.count; i++) {
    const part = cfg.parts[i % cfg.parts.length];
    const j = Math.floor(i / cfg.parts.length);
    const level = cfg.level === 'easy' ? 1 : cfg.level === 'hard' ? 2 : (j % 2 === 0 ? 1 : 2);
    const key = `${part}|${level}`;
    if (!orders.has(key)) {
      const list = pool.filter((p) => p.part === part && (p.level === level || p.level === 0));
      for (let k = list.length - 1; k > 0; k--) { const r = mulberryPick(rng, k + 1); [list[k], list[r]] = [list[r], list[k]]; }
      orders.set(key, list); used.set(key, 0);
    }
    const list = orders.get(key);
    if (!list.length) throw new Error(`test: žádné typy pro ${key}`);
    const entry = list[used.get(key) % list.length];
    used.set(key, used.get(key) + 1);
    let q = null;
    for (let tries = 0; tries < 40 && !q; tries++) {
      const qseed = Math.floor(rng() * 4294967296) >>> 0;
      const problem = entry.type.generate(makeRng(qseed));
      if (!AUTO_KINDS.has(problem.answerSpec?.kind)) continue;
      const sig = `${entry.type.id}|${problem.promptTex}|${problem.task ?? ''}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      q = { n: i + 1, part, level, topic: entry.topic.id, type: entry.type.id, seed: qseed,
        problem: { ...problem, topic: problem.topic ?? entry.topic.id, type: entry.type.id, seed: qseed } };
    }
    if (!q) throw new Error(`test: nepodařilo se vytvořit příklad ${entry.type.id}`);
    out.push(q);
  }
  return out;
}

// ---------- bodování a čas ----------
export const percent = (correct, total) => (total > 0 ? Math.round((100 * correct) / total) : 0);
export const isPassed = (pct) => pct >= PASS_PERCENT;
// Zbývající milisekundy; null = bez limitu.
export function remainingMs(startedAt, limitMin, now) {
  if (!limitMin) return null;
  return Math.max(0, startedAt + limitMin * 60000 - now);
}
export const isExpired = (startedAt, limitMin, now) => remainingMs(startedAt, limitMin, now) === 0;
export function formatClock(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const mm = Math.floor(s / 60); const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
export const isWarning = (ms) => ms !== null && ms <= 5 * 60000;
// Který ohlašovaný mezník (5 min, 1 min, 0) právě přešel čas z `prev` na `cur`; jinak null.
export function announceMark(prev, cur) {
  for (const m of [0, 60000, 300000]) if (prev > m && cur <= m) return m;
  return null;
}
