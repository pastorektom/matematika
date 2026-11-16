// Vstup aplikace: načte KaTeX, témata a obsluhuje adresy (#/, #/tema/<id>/<záložka>).
import { setTexEngine, renderTex, renderText, h } from './render.js';
import { parseRoute, routeHref, TABS } from './router.js';
import { mountSolution } from './ui/stepper.js';
import { stepVisual, disposeStepVisual } from './viz/step.js';
import { renderTheory } from './ui/theory.js';
import { mountPractice, buildFixedProblem, FIXED_TYPE, FIXED_TITLE } from './ui/practice.js';
import { initContent, loadFixedProblems } from './content.js';
import { makeRng, randomSeed } from './rng.js';
import { topics as courseTopics, sortTopics } from './topics/index.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { initAuth, currentUser, signOut, onAuthEvent } from './auth.js';
import { initProgress, setProgressUser, flushQueue, topicStats } from './progress.js';
import { renderHome } from './ui/home.js';
import { renderFormulas } from './ui/formulas.js';
import { mountCustom } from './ui/custom.js';
import { renderLogin, renderNewPassword } from './ui/login.js';
import { createTypePicker } from './ui/typepicker.js';
import { getHub, openPopout, stepMessage, POPOUT_HINT } from './ui/board-link.js';
import { mountPopout } from './ui/popout.js';
import { createShell } from './ui/shell.js';
import { registerServiceWorker } from './pwa.js';
import { authErrorFromHash, initialScreen, finishPasswordChange } from './boot.js';

let shell = null;
import { boardForStep } from './viz/board.js';

const doc = document;
const $ = (sel) => doc.querySelector(sel);
const topics = sortTopics(courseTopics);

const TAB_ICONS = {
  vyklad: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13z',
  procvicovani: 'M15.2 4.8l4 4L9 19H5v-4zM13 7l4 4',
  postup: 'M4 19h5v-5h5V9h6M4 19v1M20 9V4',
};

function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', TAB_ICONS[name]);
  svg.appendChild(path);
  return svg;
}

function renderTopicList(route) {
  const list = $('#topic-list');
  list.textContent = '';
  if (topics.length === 0) {
    list.appendChild(h(doc, 'li', { class: 'empty' }, 'Témata se připravují.'));
    return;
  }
  topics.forEach((t, i) => {
    const current = route.name === 'topic' && route.id === t.id;
    list.appendChild(h(doc, 'li', {}, [
      h(doc, 'a', { href: routeHref(t.id, current ? route.tab : 'vyklad'), 'aria-current': current ? 'page' : null }, [
        h(doc, 'span', { class: 'topic-num', text: String(i + 1) }),
        h(doc, 'span', { class: 'topic-name', text: t.title }),
      ]),
    ]));
  });
}

// Na telefonu je to spodní lišta, na počítači řada záložek pod nadpisem tématu.
function renderTabs(route) {
  const nav = h(doc, 'nav', { class: 'tabs', 'aria-label': 'Části tématu' });
  for (const tab of TABS) {
    nav.appendChild(h(doc, 'a', {
      href: routeHref(route.id, tab.id),
      class: 'tab',
      'aria-current': route.tab === tab.id ? 'page' : null,
    }, [icon(tab.id), h(doc, 'span', { text: tab.label })]));
  }
  return nav;
}

function viewHome(main) {
  const box = h(doc, 'div');
  main.appendChild(box);
  renderHome(box, { topics, stats: null, guest: isGuest });
  if (isGuest || topics.length === 0) return;
  topicStats().then((stats) => {
    if (box.isConnected && stats.length) renderHome(box, { topics, stats, guest: false });
  });
}

function viewFormulas(main) {
  main.appendChild(h(doc, 'h1', { class: 'page-title', text: 'Přehled vzorců' }));
  const body = h(doc, 'div');
  main.appendChild(body);
  renderFormulas(body);
}

function viewCustom(main) {
  main.appendChild(h(doc, 'h1', { class: 'page-title', text: 'Vlastní příklad' }));
  main.appendChild(h(doc, 'p', { class: 'lede', text: 'Zadej vlastní příklad a aplikace ho vyřeší krok za krokem. Čísla v maticích zadávej celá.' }));
  const body = h(doc, 'div');
  main.appendChild(body);
  const c = mountCustom(body, topics);
  activeStepper = { destroy: () => c.destroy(), next() {}, prev() {} };
}

function viewNotFound(main) {
  main.appendChild(h(doc, 'h1', { class: 'page-title', text: 'Stránka neexistuje' }));
  main.appendChild(h(doc, 'p', {}, [
    'Adresa neodpovídá žádnému tématu. ',
    h(doc, 'a', { href: '#/', text: 'Zpět na seznam témat' }),
  ]));
}

// Grafika kroku (js/viz/step.js): řádky na tabuli (step.board) a/nebo pomůcka step.viz = {kind, data};
// bez obojího krokovač ukáže step.tex jako dosud.
let activeStepper = null; // krokovač v Postupu; při novém příkladu nebo odchodu se uvolní

function viewPostup(body, topic, query = {}) {
  const types = Array.isArray(topic.types) ? topic.types : [];
  if (types.length === 0) {
    body.appendChild(h(doc, 'p', { class: 'empty', text: 'Řešené postupy k tomuto tématu se připravují.' }));
    return;
  }
  // Režim: typ generátoru, nebo příklady ze cvičení (FIXED_TYPE, seed = pořadí v seznamu).
  let type = types.find((t) => t.id === query.type) || types[0];
  let fixedMode = query.type === FIXED_TYPE;
  let fixed = [];
  let fixedIndex = fixedMode && Number.isInteger(query.seed) ? query.seed : 0;
  let fixedSeed = !fixedMode && Number.isInteger(query.seed) ? query.seed : null; // příklad z procvičování (jen poprvé)
  const hub = getHub(window);
  const choices = () => [
    ...types.map((t) => ({ id: t.id, title: t.title })),
    ...(fixed.length ? [{ id: FIXED_TYPE, title: FIXED_TITLE, group: 'Příklady ze cvičení' }] : []),
  ];
  const picker = createTypePicker(doc, {
    choices: choices(), value: type.id,
    onSelect: (c) => {
      if (c.id === FIXED_TYPE) { fixedMode = true; fixedIndex = 0; } else { type = types.find((t) => t.id === c.id) || type; fixedMode = false; }
      show();
    },
  });
  const prompt = h(doc, 'div', { class: 'prompt' });
  const stepperEl = h(doc, 'div');
  const again = h(doc, 'button', { type: 'button', class: 'btn btn-quiet', text: 'Jiný příklad' });

  function mark() { picker.setValue(fixedMode ? FIXED_TYPE : type.id); }

  const popBtn = hub.supported ? h(doc, 'button', {
    type: 'button', class: 'btn btn-quiet', 'data-role': 'popout', text: 'Na druhý displej',
    'aria-label': 'Otevřít tabuli v samostatném okně na druhém displeji',
    onclick: async () => {
      const r = await openPopout(window);
      hint.textContent = r.blocked ? 'Okno se nepodařilo otevřít. Povol pro tuto stránku vyskakovací okna.' : r.placed ? '' : POPOUT_HINT;
    },
  }) : null;
  const hint = h(doc, 'p', { class: 'popout-hint', role: 'status' });
  const unNav = hub.onNav((dir) => {
    if (!body.isConnected) { unNav(); return; }
    if (dir === 'next') activeStepper?.next(); else activeStepper?.prev();
  });

  function show() {
    let problem;
    let label;
    try {
      if (fixedMode) {
        if (!fixed.length) { prompt.textContent = 'Načítám příklady ze cvičení…'; stepperEl.textContent = ''; mark(); return; }
        problem = buildFixedProblem(topic, fixed, fixedIndex);
        label = `${FIXED_TITLE}: ${problem.seed + 1} z ${fixed.length}${problem.source ? ` · ${problem.source}` : ''}`;
      } else {
        const seed = fixedSeed ?? randomSeed();
        fixedSeed = null;
        problem = type.generate(makeRng(seed));
        label = type.title;
      }
    } catch {
      prompt.textContent = 'Příklad se nepodařilo vytvořit. Zkuste „Jiný příklad“.';
      stepperEl.textContent = '';
      return;
    }
    prompt.textContent = '';
    prompt.appendChild(h(doc, 'p', { class: 'prompt-label', text: label }));
    const f = h(doc, 'div', { class: 'formula' });
    renderTex(f, problem.promptTex, { display: true });
    if (problem.task) prompt.appendChild(renderText(h(doc, 'div', { class: 'prompt-task prose' }), problem.task));
    prompt.appendChild(f);
    activeStepper?.destroy();
    hub.setProblem({
      id: `${topic.id}:${fixedMode ? FIXED_TYPE : type.id}:${problem.seed}`, promptTex: String(problem.promptTex ?? ''),
      topicTitle: topic.title, typeTitle: label, selfGraded: false,
    });
    activeStepper = mountSolution(stepperEl, problem, {
      renderStepVisual: stepVisual, disposeStepVisual,
      onChange: (i, steps) => hub.setStep(stepMessage(steps, i, boardForStep)),
    });
    mark();
  }
  again.addEventListener('click', () => {
    if (fixedMode && fixed.length) fixedIndex = (fixedIndex + 1) % fixed.length;
    show();
  });
  body.append(...[types.length > 1 || fixed.length ? picker.el : null, prompt, stepperEl, h(doc, 'div', { class: 'actions' }, [again, popBtn]), hint].filter(Boolean));
  show();
  // Pevné příklady ze cvičení (jen když nějaké jsou) přibudou jako další volba.
  loadFixedProblems(topic.id).then((list) => {
    if (!body.isConnected) return;
    fixed = list;
    if (!list.length) { if (fixedMode) { fixedMode = false; show(); } return; }
    picker.setChoices(choices(), fixedMode ? FIXED_TYPE : type.id);
    if (!picker.el.isConnected) body.insertBefore(picker.el, prompt);
    if (fixedMode) show(); else mark();
  });
}

function viewTopic(main, route) {
  const topic = topics.find((t) => t.id === route.id);
  if (!topic) return viewNotFound(main);
  main.appendChild(h(doc, 'a', { href: '#/', class: 'back' }, 'Všechna témata'));
  main.appendChild(h(doc, 'h1', { class: 'page-title', text: topic.title }));
  const tabs = renderTabs(route);
  if (route.tab === 'vyklad') main.appendChild(tabs);
  else {
    main.appendChild(h(doc, 'div', { class: 'tab-row' }, [tabs, h(doc, 'button', {
      type: 'button', class: 'btn btn-quiet focus-toggle', 'data-role': 'focus-toggle', 'aria-pressed': 'false',
      title: 'Skryje menu a záhlaví, tabule dostane celou šířku (Esc ukončí)', text: 'Focus režim',
      onclick: () => shell?.toggleFocus(),
    })]));
  }
  const body = h(doc, 'div', { class: 'tab-body' });
  main.appendChild(body);
  if (route.tab === 'vyklad') renderTheory(body, topic);
  else if (route.tab === 'postup') viewPostup(body, topic, route.query);
  else {
    const practice = mountPractice(body, topic);
    loadFixedProblems(topic.id).then((list) => { if (body.isConnected) practice.setFixed(list); });
  }
}

function render() {
  const route = parseRoute(location.hash);
  const main = $('#main');
  activeStepper?.destroy();
  activeStepper = null;
  main.textContent = '';
  doc.body.dataset.route = route.name;
  renderTopicList(route);
  const fl = $('#nav-formulas');
  if (route.name === 'formulas') fl?.setAttribute('aria-current', 'page'); else fl?.removeAttribute('aria-current');
  const cu = $('#nav-custom');
  if (route.name === 'custom') cu?.setAttribute('aria-current', 'page'); else cu?.removeAttribute('aria-current');
  if (route.name === 'home') viewHome(main);
  else if (route.name === 'topic') viewTopic(main, route);
  else if (route.name === 'formulas') viewFormulas(main);
  else if (route.name === 'custom') viewCustom(main);
  else viewNotFound(main);
  const t = route.name === 'topic' ? topics.find((x) => x.id === route.id)?.title : route.name === 'formulas' ? 'Přehled vzorců' : route.name === 'custom' ? 'Vlastní příklad' : null;
  doc.title = t ? `${t} – Matematika E1` : 'Matematika E1';
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  shell?.refresh();
}

let signedIn = false; // přihlášený uživatel, nebo host bez ukládání pokroku
let isGuest = true;   // host: pokrok se neukládá a na úvodní stránce se nezobrazuje

function renderAccount(user) {
  const box = $('#account');
  box.textContent = '';
  if (!user) return;
  box.append(
    h(doc, 'span', { class: 'account-mail', text: user.email }),
    h(doc, 'button', {
      type: 'button', class: 'link-btn', text: 'Odhlásit se',
      onclick: async () => { await signOut(); location.reload(); },
    }),
  );
}

function enterApp(user) {
  signedIn = true;
  isGuest = !user;
  setProgressUser(user?.id ?? null); // host (null): nic se neukládá ani nefrontuje
  delete doc.body.dataset.auth;
  renderAccount(user);
  render();
}

function showNewPassword() {
  signedIn = false;
  doc.body.dataset.auth = 'login';
  doc.title = 'Nové heslo – Matematika E1';
  const main = $('#main');
  renderNewPassword(main, {
    onDone: () => finishPasswordChange({
      setHash: () => { location.hash = '#/'; }, getUser: currentUser, enterApp, flush: flushQueue,
    }),
  });
  main.focus({ preventScroll: true });
}

function showLogin(configured, notice = '') {
  signedIn = false;
  doc.body.dataset.auth = 'login';
  doc.title = 'Přihlášení – Matematika E1';
  const main = $('#main');
  renderLogin(main, {
    configured, notice,
    onLogin: async () => { const u = await currentUser(); setProgressUser(u?.id); await flushQueue(); enterApp(u); },
    onGuest: () => enterApp(null),
  });
  main.focus({ preventScroll: true });
}

// Bez vyplněného js/config.js se klient nevytváří a aplikace nabídne režim bez přihlášení.
async function setupAccount() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    initProgress(null);
    return initialScreen(false) === 'guest' ? enterApp(null) : showLogin(false);
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initAuth(client);
    initProgress(client);
    initContent(client);
    window.addEventListener('online', flushQueue);
    let recovering = false;
    onAuthEvent((event) => { if (event === 'PASSWORD_RECOVERY') { recovering = true; showNewPassword(); } });
    const linkError = authErrorFromHash(location.hash);
    if (linkError) location.hash = '#/';
    const user = await currentUser();
    if (recovering) return;
    if (user) { setProgressUser(user.id); flushQueue(); return enterApp(user); }
    showLogin(true, linkError);
  } catch {
    initProgress(null);
    showLogin(false);
  }
}

function startPopout() {
  doc.body.dataset.route = 'popout';
  doc.title = 'Tabule – Matematika E1';
  mountPopout($('#main'), {});
}

// Na užších displejích je seznam témat v rozbalovací nabídce pod horní lištou.
function initNavToggle() {
  const btn = $('#nav-toggle');
  const side = $('.sidebar');
  if (!btn || !side) return;
  const set = (open) => { side.dataset.open = String(open); btn.setAttribute('aria-expanded', String(open)); };
  set(false);
  btn.addEventListener('click', () => set(side.dataset.open !== 'true'));
  side.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && side.dataset.open === 'true') { set(false); btn.focus(); } });
  window.addEventListener('hashchange', () => set(false));
}

async function start() {
  try {
    const katex = await import('katex');
    setTexEngine(katex.default || katex);
  } catch { /* bez KaTeX se vzorce ukážou jako text */ }
  // Okno tabule na druhém displeji se otevírá bez přihlášení: nic nenačítá, jen mluví s hlavním oknem.
  if (parseRoute(location.hash).name === 'popout') return startPopout();
  window.addEventListener('hashchange', () => { if (signedIn) render(); });
  initNavToggle();
  shell = createShell(doc);
  await setupAccount();
}

start();
registerServiceWorker();
