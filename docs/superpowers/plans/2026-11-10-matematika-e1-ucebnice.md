# Matematika E1 – učebnice: plán implementace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sdílená webová aplikace (PC, Android, iOS, tablet) pro učení Matematiky E1: procvičování s kontrolou výsledku, řešené příklady krok za krokem (grafika + popis), výklad, přihlášení e-mailem a heslem a pokrok každého uživatele zvlášť.

**Architecture:** Statické soubory (HTML/CSS/ES moduly, bez build kroku) na GitHub Pages. Každé téma je jeden modul s výkladem, generátory příkladů a řešenými kroky; společné jádro (kontrola odpovědí, vykreslení, krokovač, přihlášení, pokrok) je oddělené. Supabase řeší jen přihlášení a ukládání pokusů s řádkovou ochranou.

**Tech Stack:** JavaScript (ES moduly), math.js (výpočty a ekvivalence výrazů), KaTeX (vzorce), SVG (grafika kroků), Supabase JS (auth + Postgres), Node `node --test` (testy), Service Worker (offline, bonus). Knihovny v prohlížeči z CDN s pevnou verzí.

**Spec:** `docs/superpowers/specs/2026-11-10-matematika-e1-ucebnice-design.md`

## Global Constraints

- Veškerý text v UI česky.
- Žádná AI za běhu, žádný klíč k AI, žádné průběžné náklady.
- Příklady smí vycházet přímo z materiálů v Moodlu (jen osobní použití uživatele a spolužáků ze cvičení), proto obsah není veřejný: příklady nejsou v repozitáři ani ve statických souborech (GitHub Pages z privátního repozitáře vyžaduje placený plán, kód tak může být veřejný), jsou jen v Supabase tabulce `problems`; registrace jen pro pozvané e-maily (seznam povolených v Supabase), obsah příkladů se načítá až po přihlášení. Složka `Moodle_Matematika` ani PDF/Word soubory se nikdy nenahrávají do gitu ani na hosting (`.gitignore`); nahrávají se jen přepsané příklady.
- Pořadí témat odpovídá Moodlu: 1 Aritmetické vektory; 2 Matice, hodnost, inverzní matice; 3 Determinant, adjungovaná matice; 4 Soustavy lineárních rovnic; 5 Funkce a její vlastnosti; 6 Limita funkce; 7 Derivace, l'Hospitalovo pravidlo, průběh funkce.
- V prohlížeči jen veřejný Supabase „anon“ klíč a adresa projektu; žádné tajné klíče ani hesla v kódu, chatu ani gitu.
- Funguje na šířce 360 px až desktop; bez horizontálního posunu.
- Správnost řešení se ověřuje nezávislým výpočtem v testech (žádný generátor bez takového testu).
- Kontrola výsledku je matematická (ekvivalentní tvary jsou správně), ne textová.

## Předpoklady plánu (moje odhady, k potvrzení)

1. Pořadí témat je jako v Moodlu (potvrzeno uživatelem). Termíny testů neznám.
2. Registrace je jen pro pozvané e-maily (seznam spolužáků z cvičení) s potvrzením e-mailu; obsah příkladů je dostupný jen přihlášeným. Úkol 4 to řeší tabulkou `allowed_emails` a řádkovou ochranou tabulky `problems`.
3. Supabase zdarma může po delší nečinnosti projekt uspat; je to přijatelné.

## Review Focus

- Student zadá výsledek v jiném, ale ekvivalentním tvaru (`2/4`, `0,5`, `1/2`, `x*(x+1)` vs. `x^2+x`): musí být uznán. Test v úkolu 1.
- Čárka jako desetinná čárka (`0,5`) a mezery navíc: musí se přijmout. Test v úkolu 1.
- Odpověď „neexistuje“ / `±∞` u limity a „nekonečně mnoho řešení“ u soustavy: musí jít zadat a vyhodnotit. Test v úkolu 2.
- Prázdná nebo nesmyslná odpověď (`abc((`) nesmí shodit aplikaci, jen hlásit „nerozumím zápisu“. Test v úkolu 1.
- Uživatel bez připojení nebo s vypršelým přihlášením: aplikace se nesmí zhroutit, pokus se nezapíše dvakrát. Test v úkolu 4.
- Uživatel A nikdy nevidí pokrok uživatele B. Test v úkolu 4 (SQL test řádkové ochrany).

---

## Struktura souborů

```
matika-ucebnice/
  index.html, manifest.webmanifest, sw.js
  css/app.css
  js/app.js              router a navigace
  js/auth.js             přihlášení, odhlášení, session
  js/progress.js         zápis a čtení pokusů, doporučení
  js/checker.js          kontrola odpovědí podle answerSpec
  js/render.js           KaTeX, bezpečné vkládání textu
  js/ui/practice.js      obrazovka Procvičování
  js/ui/stepper.js       obrazovka Postup krok za krokem
  js/ui/theory.js        obrazovka Výklad
  js/ui/inputs.js        políčka pro matice/vektory, panel tlačítek pro výrazy
  js/viz/*.js            SVG pomůcky (graf funkce, tečna, Gauss, matice)
  js/topics/<id>.js      téma: výklad, generátory, kroky
  js/topics/index.js     seznam témat
  js/formulas.js         vlastní přehled vzorců
  supabase/schema.sql    tabulky a řádková ochrana
  tests/*.test.js
```

## Společná rozhraní

```js
// js/topics/<id>.js  default export:
{ id: 'matice', title: 'Matice', order: 2,
  theory: [{ heading, tex?, text }],
  types: [{ id, title, generate(rng): Problem }] }

// Problem
{ id, topic, type, seed, promptTex, hint?,
  answerSpec,            // viz checker
  solution: Step[] }     // vždy neprázdné

// Step
{ title, text, tex?, viz?: { kind, data } }

// answerSpec
{ kind: 'number'|'expression'|'vector'|'matrix'|'interval'|'limit'|'system'|'list',
  value, variable?: 'x' }

// js/checker.js
check(answerSpec, userInput: string|string[][]): { ok: boolean, reason?: 'syntax'|'wrong', normalized?: string }
```

---

### Task 1: Základ projektu a kontrola čísel a výrazů

**Files:** Create `package.json` (jen pro testy), `.gitignore`, `js/checker.js`, `tests/checker.test.js`

**Interfaces:**
- Produces: `check(answerSpec, input)` pro `number` a `expression`.

- [ ] **Step 1:** Ověřit, že je nainstalovaný Node (`node --version`); pokud ne, popsat uživateli instalaci krok po kroku. `git init`, `.gitignore` obsahuje `Moodle_Matematika/`, `node_modules/`, `.env`.
- [ ] **Step 2: Failing testy** v `tests/checker.test.js`: `check({kind:'number',value:0.5}, '2/4').ok === true`; `'0,5'` ok; `' 1/2 '` ok; `'0.51'` ne; `check({kind:'expression',value:'x^2+x',variable:'x'}, 'x*(x+1)').ok === true`; `'x^2+x+1'` ne; `check(..., 'abc((')` vrací `{ok:false, reason:'syntax'}` a nehodí výjimku; prázdný řetězec `reason:'syntax'`.
- [ ] **Step 3:** Spustit `node --test tests/` a vidět selhání.
- [ ] **Step 4:** Implementovat `check` pro `number` (tolerance 1e-9, čárka na tečku) a `expression` (rozdíl se vyhodnotí v několika náhodných bodech definičního oboru, pomocí math.js).
- [ ] **Step 5:** Testy projdou. Commit.

### Task 2: Kontrola vektorů, matic, intervalů, limit a soustav

**Files:** Modify `js/checker.js`; Test `tests/checker-structured.test.js`

**Interfaces:**
- Consumes: `check` z úkolu 1.
- Produces: podpora pro `vector`, `matrix` (vstup `string[][]`), `interval` (např. `(-∞,2>∪(3,∞)`), `limit` (`∞`, `-∞`, `neexistuje`), `system` (jedno řešení, `nekonečně mnoho` + parametrický tvar, `nemá řešení`), `list` (množina čísel bez ohledu na pořadí).

- [ ] **Step 1: Failing testy:** matice `[[1,2],[3,4]]` vs. `[['1','2'],['6/2','4']]` ok; jiný rozměr ne; limita `neexistuje` ok pro hodnotu `'DNE'`; `∞` zadané jako `inf`, `oo` i `∞` ok; interval `<-1,2)` shodný s `[-1,2)`; soustava s parametrem: řešení `(t, 2t)` uznáno i pro `(s/2*2, s*2)`; `list` `[3,1]` ok pro `1,3`.
- [ ] **Step 2–4:** Spustit (fail), implementovat, spustit (pass).
- [ ] **Step 5:** Commit.

### Task 3: Kostra aplikace, vykreslení a krokovač

**Files:** Create `index.html`, `css/app.css`, `js/app.js`, `js/render.js`, `js/ui/stepper.js`, `js/ui/theory.js`, `js/topics/index.js`; Test `tests/render.test.js`

**Interfaces:**
- Produces: `renderTex(el, tex)`, `renderText(el, text)` (text se nikdy nevkládá jako HTML), `mountStepper(el, steps)` (vpřed/vzad, počítadlo „Krok 2 z 5“, u každého kroku popis + grafika), router s adresami `#/`, `#/tema/<id>/vyklad|procvicovani|postup`.

- [ ] **Step 1: Failing test:** `renderText` s vstupem `<img onerror=x>` nevytvoří žádný element `img`.
- [ ] **Step 2–4:** Implementace; responzivní rozložení (menu jako spodní lišta na telefonu); světlý i tmavý režim.
- [ ] **Step 5:** Ověřit v prohlížeči (náhled) na šířce 360 px a 1280 px. Commit.

### Task 4: Přihlášení a pokrok (Supabase)

**Files:** Create `supabase/schema.sql`, `js/auth.js`, `js/progress.js`, `js/config.js` (jen URL a anon klíč, uživatel doplní); Test `tests/progress.test.js`, `supabase/rls_test.sql`

**Interfaces:**
- Produces: `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `currentUser()`; `recordAttempt({topic,type,seed,answer,correct,ms})` (idempotentní podle `seed`+čas), `topicStats(): {topic, tried, correctRate}[]`, `recommendNext(stats): topicId`.

- [ ] **Step 1:** Popsat uživateli krok po kroku („klikni sem“) založení nového Supabase projektu a vložení adresy a anon klíče do `js/config.js`. Tajný klíč nikdy nechtít.
- [ ] **Step 2:** `schema.sql`: tabulka `attempts(user_id uuid default auth.uid(), topic, type, seed, answer, correct, ms, created_at)`, zapnutá řádková ochrana, politiky jen `user_id = auth.uid()` pro select a insert.
- [ ] **Step 2b:** Do `schema.sql` přidat `allowed_emails(email primary key)` a tabulku `problems(topic, type, ord, payload jsonb)` čitelnou jen přihlášeným uživatelům, jejichž e-mail je v `allowed_emails`; registrace nepovoleného e-mailu se odmítne (trigger nad `auth.users`). Obsah příkladů se tak do prohlížeče dostane až po přihlášení.
- [ ] **Step 3: Failing testy:** nepovolený e-mail se nezaregistruje a `problems` nevrátí řádky bez přihlášení; `recommendNext` vybere téma s nejnižší úspěšností a aspoň 3 pokusy, bez dat první téma v pořadí; `recordAttempt` při selhání sítě zařadí zápis do fronty a po obnovení jej provede jednou. SQL test: uživatel A nevidí řádky uživatele B.
- [ ] **Step 4–5:** Implementace, testy, commit.

### Task 5: Obrazovka Procvičování a zadávání odpovědí

**Files:** Create `js/ui/practice.js`, `js/ui/inputs.js`; Test `tests/practice.test.js`

**Interfaces:**
- Consumes: `check`, `recordAttempt`, `Topic.types[].generate`.
- Produces: `mountPractice(el, topic)`; tlačítka „Zkontrolovat“, „Ukaž výsledek“, „Další příklad“, „Ukaž postup“ (přepne na krokovač téhož příkladu); `matrixInput(rows, cols)` (mřížka políček), panel tlačítek pro výrazy (`^`, `√`, `/`, `π`, závorky) na dotykových zařízeních.

- [ ] **Step 1: Failing test:** po špatné odpovědi se zapíše pokus `correct:false` a příklad zůstane; po „Ukaž výsledek“ se pokus zapíše jako nezodpovězený a ne jako správný.
- [ ] **Step 2–4:** Implementace; při hlášce `syntax` se pokus nezapisuje.
- [ ] **Step 5:** Commit.

### Task 5b: Kreslicí tabule u každého počítání

**Files:** Create `js/ui/whiteboard.js`; Test `tests/whiteboard.test.js`

**Interfaces:**
- Produces: `mountWhiteboard(el, {onChange})` – plátno pro psaní prstem, myší nebo Apple Pencilem (pero, guma, 3 barvy, krok zpět, smazat vše, mřížka); `exportPng(): string`. Tlačítko „Tabule“ je **u každého příkladu**, kde se počítá (ne jen u některých): student si na ni píše vlastní postup vedle zadání. U příkladů s `answerSpec.kind === 'whiteboard'` (např. náčrt grafu, tabulka znamének) tabule nahradí textové pole; po „Ukaž výsledek“ se vedle ní zobrazí správné řešení a student sám označí „Zvládl jsem / Nezvládl jsem“ (zapíše se jako `selfGraded:true`). Kresba se neukládá na server, jen v paměti stránky.

- [ ] **Step 1: Failing testy:** `undo` po dvou tazích zruší jen poslední tah; `clear` + `undo` vrátí smazané tahy; `selfGraded` pokus se zapíše s `correct` podle volby studenta.
- [ ] **Step 2–4:** Implementace přes Pointer Events (funguje stejně pro dotyk, myš i pero), `touch-action:none` na plátně, aby se stránka při kreslení neposouvala. Na šířce 360 px a na iPadu ověřit v náhledu.
- [ ] **Step 5:** Commit.

### Task 5c: Řešení na tabuli (postup napsaný jako na školní tabuli)

**Files:** Create `js/viz/board.js`, `css/board.css`; Test `tests/board.test.js`

**Interfaces:**
- Consumes: `Step` z krokovače (úkol 3).
- Produces: `Step` dostane volitelné pole `board: BoardLine[]`, kde `BoardLine = { tex: string, notes?: Note[] }` a `Note = { kind: 'brace'|'strike'|'underline'|'doubleUnderline'|'color', target: string, label?: string, color?: 'accent'|'warn' }` (např. složená závorka nad `x²−x+1` s popiskem „3“, přeškrtnutí `x+1` v čitateli i jmenovateli, dvojité podtržení výsledku). `drawBoard(el, lines, upTo: number)` vykreslí řádky 1..`upTo` na tmavou tabuli rukopisným písmem (vzorce KaTeX ve stylu křídy), nové řádky se při krokování postupně „napíšou“ (animace, vypnutá při `prefers-reduced-motion`). Pod tabulí je popisek „Krok N z M“ s textem kroku. Krokovač (úkol 3) používá `drawBoard` všude, kde krok má `board`; jinak se použije grafika z `viz/*`. Pro tabuli s vyobrazením vzhledu je vzorem snímek obrazovky od uživatele (tmavá tabule, rukopisné vzorce, oranžové poznámky, výsledek dvojitě podtržen, přepínač příkladů nad tabulí).

- [ ] **Step 1: Failing testy:** `drawBoard` s `upTo=2` vykreslí přesně 2 řádky; `Note` s neexistujícím `target` se přeskočí bez výjimky; prázdné `lines` nic nevykreslí a nehodí chybu; text poznámky se vkládá jako text, ne jako HTML.
- [ ] **Step 2–4:** Implementace (SVG vrstva nad KaTeX pro závorky, škrtání a podtržení; měření pozic přes `getBoundingClientRect` podle `target`); ověřit v náhledu na šířce 360 px (vzorce se zalamují po řádcích, tabule se posouvá jen uvnitř sebe) a na desktopu.
- [ ] **Step 5:** Commit.

### Task 6: Grafické pomůcky pro kroky

**Files:** Create `js/viz/matrix.js`, `js/viz/gauss.js`, `js/viz/plot.js`, `js/viz/tangent.js`, `js/viz/signchart.js`; Test `tests/viz.test.js`

**Interfaces:**
- Produces: každý `draw(svgEl, data)`; `data` je čistá data (žádný HTML řetězec). `plot` kreslí graf funkce s asymptotami a body, `tangent` tečnu, `gauss` řádkové úpravy se zvýrazněným pivotem, `signchart` znaménka derivace a monotonii.

- [ ] **Step 1: Failing testy:** `plot` pro `1/x` nevykreslí čáru přes pól (přeruší křivku); `draw` s prázdnými daty nehodí výjimku.
- [ ] **Step 2–4:** Implementace, testy. Zobrazení na šířce 360 px ověřit v náhledu.
- [ ] **Step 5:** Commit.

### Task 7: Šablona tématu a první téma (vektory) jako svislý řez

**Files:** Create `js/topics/vektory.js`, `tests/topics/vektory.test.js`, `tests/helpers/verify.js`

**Interfaces:**
- Produces: vzor, který následující témata kopírují: `theory`, aspoň 4 typy příkladů (součet a násobek, skalární součin, lineární závislost, velikost a úhel), každý s `generate(rng)`, `answerSpec` a `solution` o 3 a více krocích; `verify(topic, n=200)` v `tests/helpers/verify.js` vygeneruje `n` příkladů a pro každý ověří: `check(answerSpec, answerSpec.value)` je ok, `solution` je neprázdné, poslední krok obsahuje výsledek, a nezávislý výpočet (math.js) dá stejnou hodnotu.

- [ ] **Step 1: Failing test:** `verify(vektory)` projde pro 200 různých `seed`.
- [ ] **Step 2–4:** Implementace tématu včetně výkladu vlastními slovy podle osnovy témat; spuštění testu.
- [ ] **Step 5:** Ověřit v prohlížeči všechny tři obrazovky tématu. Projít s uživatelem, zda je styl vysvětlení srozumitelný, než se vyrobí ostatní témata. Commit.

### Task 8: Témata 2–4 podle Moodlu (paralelizovatelné po úkolu 7)

**Files:** Create `js/topics/matice.js` (Matice, hodnost, inverzní matice), `determinant.js` (Determinant, adjungovaná matice), `soustavy.js` (Soustavy lineárních rovnic, maticové rovnice) a `tests/topics/*.test.js`

**Interfaces:** podle šablony z úkolu 7; každé téma je samostatný úkol pro jednoho subagenta (různé soubory, žádné sdílené). Pořadí a názvy jako v Moodlu.

- [ ] **Step 1:** Pro každé téma projít příslušné soubory ve `Moodle_Matematika` (přednášky, cvičení, příklady k procvičení, řešené příklady, prezentace; skeny číst jako obrázky). Příklady se přepíšou ze souborů přímo (ve stejném zadání, kde to jde generovat, doplnit náhodnými variantami); typy příkladů a odkaz na zdrojový soubor sepsat do hlavičky souboru tématu. Výsledky ze sbírky (`07_vysledky`) použít jako kontrolu, ale vždy ověřit i vlastním výpočtem.
- [ ] **Step 2:** Failing `verify(téma)`; implementace; pass. Fixní příklady ze souborů mají `seed` = jejich pořadí.
- [ ] **Step 3:** Obsah: součin, transpozice, hodnost Gaussovou eliminací s grafikou řádkových úprav, inverzní matice (adjungovaná i Gauss–Jordan); determinant (Sarrus, rozvoj); soustavy (jediné, nekonečně mnoho, žádné řešení; Frobeniova věta), maticové rovnice `AX=B`.
- [ ] **Step 4:** Commit po každém tématu.

### Task 9: Témata 5–7 podle Moodlu

**Files:** Create `js/topics/funkce.js` (Funkce a její vlastnosti: definiční obor, parita, inverzní funkce, elementární funkce), `limita.js` (Limita funkce), `derivace.js` (Derivace, l'Hospitalovo pravidlo, průběh funkce) a `tests/topics/*.test.js`

**Interfaces:** podle šablony; subagent na každé téma. Průběh funkce využívá `viz/plot`, `viz/tangent`, `viz/signchart`.

- [ ] **Step 1–2:** Jako v úkolu 8 (průzkum souborů a přepis příkladů, failing `verify`, implementace, pass).
- [ ] **Step 3:** Obsah: definiční obor (zlomky, odmocniny, logaritmy, kombinace), parita, inverzní funkce, grafy elementárních funkcí; limity (dosazení, rozklad, odmocniny, nekonečno, jednostranné, z grafu); derivace všech pravidel a druhá derivace; l'Hospital se zdůvodněním, kdy jej lze použít; průběh funkce celý (obor, parita, průsečíky, limity a asymptoty, monotonie, extrémy, konvexnost, inflexe, graf).
- [ ] **Step 4:** Commit po každém tématu.

### Task 10: Přehled vzorců a domovská obrazovka

**Files:** Create `js/formulas.js`, `js/ui/home.js`; Test `tests/formulas.test.js`

**Interfaces:**
- Produces: vlastní přehled vzorců po tématech označený „Vlastní přehled, nejde o oficiální list ke zkoušce“; domovská stránka s kartami témat, ukazatelem pokroku a doporučením z `recommendNext`.

- [ ] **Step 1: Failing test:** každý vzorec se vykreslí KaTeXem bez chyby.
- [ ] **Step 2–4:** Implementace, pass. Commit.

### Task 11: Offline, nasazení a kontrola na zařízeních

**Files:** Create `manifest.webmanifest`, `sw.js`, `README.md`, `.github/workflows/pages.yml`

- [ ] **Step 1:** Service Worker uloží jen vlastní soubory; přihlášení a zápis pokroku vyžadují připojení.
- [ ] **Step 2:** Popsat krok po kroku („klikni sem“) vytvoření repozitáře na GitHubu, zapnutí GitHub Pages a vložení klíčů do `js/config.js`. Před nahráním ověřit, že `Moodle_Matematika` není v gitu (`git ls-files | findstr Moodle` nevrátí nic).
- [ ] **Step 3:** Spustit celou sadu testů (`node --test tests/`), všechny projdou.
- [ ] **Step 4:** Kontrola v prohlížeči s emulací telefonu a tabletu; seznam ručních kontrol pro uživatele (Android, iPhone, iPad, přidání na plochu) a čekání na jeho screenshoty.
- [ ] **Step 5:** Commit a nasazení po výslovném souhlasu uživatele (zveřejnění je vnější akce).

---

## Kontrola proti návrhu

- Procvičování, kroky, výklad, pokrok, 12 témat, vzorce, zařízení, čeština: úkoly 3, 5, 7–10, 4, 11.
- Matematická kontrola ekvivalence: úkoly 1–2. Ověření generátorů nezávislým výpočtem: úkol 7 a všechna témata.
- Soukromí obsahu (příklady ze souborů jen pro pozvané): globální omezení, `allowed_emails` a řádková ochrana v úkolu 4, `.gitignore` v úkolu 1, kontrola v úkolu 11.
- Rizika zbývající po plánu: kvalita ručního čtení skenů (úkol 8–9 krok 1) a zápis výrazů na mobilu (úkol 5).
