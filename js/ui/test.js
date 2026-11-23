// Stránka „Test“ (#/test): nastavení -> test na jedné stránce (bez nápověd) -> výsledek s postupy.
// Logika (zadání, bodování, čas) je v js/test.js. Odpovědi se zrcadlí do sessionStorage.
import { h, renderTex, renderText } from '../render.js';
import { check as defaultCheck } from '../checker.js';
import { recordAttempt } from '../progress.js';
import { randomSeed } from '../rng.js';
import { createAnswerInput, symbolPanel } from './inputs.js';
import { mountSolution } from './stepper.js';
import { stepVisual, disposeStepVisual } from '../viz/step.js';
import {
  PARTS, LEVELS, COUNTS, LIMITS, PASS_PERCENT, buildTest, normalizeConfig, encodeConfig, decodeConfig,
  percent, isPassed, remainingMs, formatClock, isWarning, announceMark, partLabel,
} from '../test.js';

const CFG_KEY = 'matika.test.cfg';
const sKey = (seed, c) => `matika.test.${seed}.${c}`;
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
export const testHref = (seed, cfg) => (seed == null ? '#/test' : `#/test/${seed}?c=${encodeURIComponent(encodeConfig(cfg))}`);

// opts: { seed, c } z adresy; testovací závislosti check, record, now, session, local, setHash, setInterval, clearInterval, coarse
export function mountTest(el, topics, opts = {}) {
  const doc = el.ownerDocument;
  const check = opts.check ?? defaultCheck;
  const record = opts.record ?? recordAttempt;
  const now = opts.now ?? Date.now;
  const session = opts.session ?? safe(() => sessionStorage);
  const local = opts.local ?? safe(() => localStorage);
  const setHash = opts.setHash ?? ((hash) => safe(() => history.replaceState(null, '', hash)));
  const every = opts.setInterval ?? ((f, ms) => setInterval(f, ms));
  const stop = opts.clearInterval ?? ((id) => clearInterval(id));
  let timer = null; let steppers = [];
  const root = h(doc, 'div', { class: 'test-page' });
  el.appendChild(root);

  const getSaved = (k) => safe(() => JSON.parse(session?.getItem(k) ?? 'null'));
  const putSaved = (k, v) => safe(() => session?.setItem(k, JSON.stringify(v)));
  const lastCfg = () => normalizeConfig(safe(() => JSON.parse(local?.getItem(CFG_KEY) ?? 'null')) ?? undefined);

  function cleanup() {
    if (timer != null) { stop(timer); timer = null; }
    steppers.forEach((s) => s.destroy());
    steppers = [];
  }
  function show(...nodes) { cleanup(); root.textContent = ''; root.append(...nodes); }

  // ---------- nastavení ----------
  function setup(cfg0) {
    const cfg = normalizeConfig(cfg0);
    const err = h(doc, 'p', { class: 'feedback', role: 'alert', 'data-role': 'test-error' });
    const partBoxes = PARTS.map((p) => h(doc, 'input', { type: 'checkbox', name: 'part', value: p.id, checked: cfg.parts.includes(p.id) || null }));
    const radio = (name, items, cur, fmt) => items.map((it) => {
      const v = String(it.id ?? it);
      const i = h(doc, 'input', { type: 'radio', name, value: v, checked: v === String(cur) || null });
      return { i, label: h(doc, 'label', { class: 'test-opt' }, [i, ` ${fmt(it)}`]) };
    });
    const lv = radio('level', LEVELS, cfg.level, (l) => l.label);
    const cn = radio('count', COUNTS, cfg.count, (n) => String(n));
    const lm = radio('limit', LIMITS, cfg.limit, (m) => (m ? `${m} min` : 'Bez limitu'));
    const group = (title, items) => h(doc, 'fieldset', { class: 'test-group' }, [h(doc, 'legend', { text: title }), h(doc, 'div', { class: 'test-opts' }, items)]);
    const read = () => ({
      parts: partBoxes.filter((b) => b.checked).map((b) => b.value),
      level: lv.find((r) => r.i.checked)?.i.value, count: cn.find((r) => r.i.checked)?.i.value, limit: lm.find((r) => r.i.checked)?.i.value,
    });
    const start = () => {
      const r = read();
      if (!r.parts.length) { err.className = 'feedback wrong'; err.textContent = 'Vyber aspoň jednu část testu.'; return; }
      const c = normalizeConfig(r);
      safe(() => local?.setItem(CFG_KEY, JSON.stringify(c)));
      begin(opts.newSeed ? opts.newSeed() : randomSeed(), c);
    };
    show(
      h(doc, 'p', { class: 'lede', text: 'Procvičovací test jako zápočtový: samé výpočty, bez nápověd. Postupy uvidíš až po odevzdání.' }),
      group('Části testu', PARTS.map((p, i) => h(doc, 'label', { class: 'test-opt' }, [partBoxes[i], ` ${p.label}`]))),
      group('Obtížnost', lv.map((r) => r.label)),
      group('Počet příkladů', cn.map((r) => r.label)),
      group('Časový limit', lm.map((r) => r.label)),
      err,
      h(doc, 'div', { class: 'actions' }, [h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'test-start', text: 'Začít test', onclick: start })]),
    );
  }

  function begin(seed, cfg) {
    const c = encodeConfig(cfg);
    putSaved(sKey(seed, c), { answers: [], startedAt: now() });
    setHash(testHref(seed, cfg));
    run(seed, cfg);
  }

  // ---------- test ----------
  function run(seed, cfg0) {
    const cfg = normalizeConfig(cfg0);
    const c = encodeConfig(cfg);
    const key = sKey(seed, c);
    let st = getSaved(key);
    if (!st) { st = { answers: [], startedAt: now() }; putSaved(key, st); }
    let questions;
    try { questions = buildTest(topics, seed, cfg); } catch { return fail(); }
    if (st.submittedAt) { result(seed, cfg, questions, st, key); return; }
    const n = questions.length;
    const inputs = []; const dots = [];
    const answers = () => inputs.map((a) => String(a.getValue()));
    const save = () => { st.answers = answers(); putSaved(key, st); };
    const status = h(doc, 'span', { 'data-role': 'test-progress' });
    const clock = h(doc, 'span', { class: 'test-clock', 'data-role': 'test-clock' });
    const live = h(doc, 'p', { class: 'sr-only', 'aria-live': 'polite', 'data-role': 'test-live' });
    const strip = h(doc, 'ol', { class: 'test-strip', 'aria-hidden': 'true' });
    const confirmBox = h(doc, 'div', { class: 'feedback hint', role: 'alert', hidden: true, 'data-role': 'test-confirm' });
    const refresh = () => {
      const done = inputs.filter((a) => !a.isEmpty()).length;
      status.textContent = `Zodpovězeno ${done} z ${n}`;
      dots.forEach((d, i) => { d.dataset.done = String(!inputs[i].isEmpty()); });
    };
    const submit = (auto) => {
      save();
      st.submittedAt = now();
      st.auto = !!auto;
      putSaved(key, st);
      result(seed, cfg, questions, st, key);
    };
    const tryEnd = () => {
      save();
      const missing = inputs.filter((a) => a.isEmpty()).length;
      if (!missing) { submit(false); return; }
      confirmBox.hidden = false;
      confirmBox.textContent = '';
      confirmBox.append(
        `Nezodpovězeno: ${missing}. Opravdu odevzdat? `,
        h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'test-confirm-yes', text: 'Odevzdat', onclick: () => submit(false) }), ' ',
        h(doc, 'button', { type: 'button', class: 'btn btn-quiet', text: 'Pokračovat v testu', onclick: () => { confirmBox.hidden = true; } }),
      );
    };
    const submitBtn = h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'test-submit', text: 'Odevzdat test', onclick: tryEnd });
    const cards = questions.map((q, i) => {
      const input = createAnswerInput(doc, q.problem.answerSpec, {
        onSubmit: () => { (inputs[i + 1] ? inputs[i + 1].focus() : submitBtn.focus()); },
      });
      inputs.push(input);
      input.inputs.forEach((x) => { x.value = st.answers?.[i] ?? ''; x.addEventListener('input', () => { save(); refresh(); }); });
      const sym = symbolPanel(doc, input.inputs, { coarse: opts.coarse, kind: q.problem.answerSpec?.kind });
      const f = h(doc, 'div', { class: 'formula' });
      renderTex(f, q.problem.promptTex, { display: true });
      dots.push(h(doc, 'li', { 'data-done': 'false' }));
      return h(doc, 'section', { class: 'test-q', 'aria-label': `Příklad ${i + 1} z ${n}` }, [
        h(doc, 'p', { class: 'prompt-label', text: `Příklad ${i + 1} / ${n} · ${partLabel(q.part)}` }),
        q.problem.task ? renderText(h(doc, 'div', { class: 'prompt-task prose' }), q.problem.task) : null,
        f,
        h(doc, 'div', { class: 'answer-row' }, [h(doc, 'div', { class: 'answer-field', 'data-role': 'answer' }, input.el), sym.toggle]),
        sym.panel,
      ]);
    });
    strip.append(...dots);
    show(
      h(doc, 'div', { class: 'test-bar' }, [status, cfg.limit ? clock : null, strip]), live, ...cards,
      confirmBox, h(doc, 'div', { class: 'actions' }, [submitBtn]),
    );
    refresh();
    if (cfg.limit) {
      let prev = remainingMs(st.startedAt, cfg.limit, now());
      const tick = () => {
        const rem = remainingMs(st.startedAt, cfg.limit, now());
        clock.textContent = `Zbývá ${formatClock(rem)}`;
        clock.dataset.warn = String(isWarning(rem));
        const m = announceMark(prev, rem);
        prev = rem;
        if (rem === 0) { submit(true); return; }
        if (m != null) live.textContent = `Zbývá ${m / 60000} min.`;
      };
      tick();
      if (!st.submittedAt) timer = every(tick, 1000);
    }
  }

  function fail() {
    show(h(doc, 'p', { class: 'feedback wrong', text: 'Test se nepodařilo sestavit. Zkus to znovu.' }),
      h(doc, 'button', { type: 'button', class: 'btn btn-primary', text: 'Změnit nastavení', onclick: () => { setHash('#/test'); setup(lastCfg()); } }));
  }

  // ---------- výsledek ----------
  function result(seed, cfg, questions, st, key) {
    const rows = questions.map((q, i) => {
      const ans = String(st.answers?.[i] ?? '');
      const blank = ans.trim() === '';
      const correct = !blank && check(q.problem.answerSpec, ans).ok === true;
      return { q, ans, blank, correct };
    });
    const ok = rows.filter((r) => r.correct).length;
    const pct = percent(ok, rows.length);
    const spent = Math.max(0, (st.submittedAt ?? now()) - st.startedAt);
    if (!st.recorded) {
      st.recorded = true;
      putSaved(key, st);
      const each = spent / (rows.length || 1);
      rows.forEach((r) => Promise.resolve(record({
        topic: r.q.problem.topic, type: r.q.problem.type, seed: r.q.seed,
        answer: JSON.stringify({ test: true, testSeed: seed, answer: r.ans }), correct: r.correct, ms: each,
      })).catch(() => {}));
    }
    const passed = isPassed(pct);
    const mins = Math.floor(spent / 60000); const secs = Math.floor((spent % 60000) / 1000);
    const list = rows.map((r, i) => {
      const f = h(doc, 'div', { class: 'formula' });
      renderTex(f, r.q.problem.promptTex, { display: true });
      const a = h(doc, 'span', { class: 'formula' });
      renderTex(a, r.q.problem.answerTex ?? String(r.q.problem.answerSpec.value));
      const slot = h(doc, 'div', { class: 'test-solution' });
      const det = h(doc, 'details', { class: 'test-detail', 'data-role': 'test-detail' }, [h(doc, 'summary', { text: 'Ukaž postup' }), slot]);
      det.addEventListener('toggle', () => {
        if (det.open && !slot.childElementCount) steppers.push(mountSolution(slot, r.q.problem, { renderStepVisual: stepVisual, disposeStepVisual }));
      });
      return h(doc, 'li', { class: 'test-result', 'data-correct': String(r.correct) }, [
        h(doc, 'p', { class: 'prompt-label', text: `Příklad ${i + 1} / ${rows.length} · ${partLabel(r.q.part)}` }),
        r.q.problem.task ? renderText(h(doc, 'div', { class: 'prompt-task prose' }), r.q.problem.task) : null,
        f,
        h(doc, 'p', { class: `feedback ${r.correct ? 'ok' : 'wrong'}`, text: r.correct ? 'Správně' : r.blank ? 'Nezodpovězeno' : 'Špatně' }),
        h(doc, 'p', {}, [`Tvoje odpověď: ${r.blank ? '—' : r.ans} · Správně: `, a]),
        det,
      ]);
    });
    show(
      h(doc, 'div', { class: 'test-summary' }, [
        h(doc, 'p', { class: 'test-score', 'data-role': 'test-score', text: `${ok} / ${rows.length} (${pct} %)` }),
        h(doc, 'p', { class: `feedback ${passed ? 'ok' : 'wrong'}`, 'data-role': 'test-pass', text: passed ? 'Splněno' : 'Nesplněno' }),
        h(doc, 'p', { class: 'prompt-label', text: `Zápočtový test: potřebuješ aspoň ${PASS_PERCENT} %. Čas: ${mins} min ${secs} s${st.auto ? ' (čas vypršel, test se odevzdal sám)' : ''}.` }),
      ]),
      h(doc, 'ol', { class: 'test-results' }, list),
      h(doc, 'div', { class: 'actions' }, [
        h(doc, 'button', { type: 'button', class: 'btn btn-primary', 'data-role': 'test-again', text: 'Nový test se stejným nastavením', onclick: () => begin(opts.newSeed ? opts.newSeed() : randomSeed(), cfg) }),
        h(doc, 'button', { type: 'button', class: 'btn btn-quiet', 'data-role': 'test-change', text: 'Změnit nastavení', onclick: () => { setHash('#/test'); setup(cfg); } }),
      ]),
    );
  }

  const seed0 = opts.seed;
  if (Number.isInteger(seed0)) run(seed0, decodeConfig(opts.c)); else setup(lastCfg());
  return { destroy() { cleanup(); } };
}
