# Interaktivní aplikace pro učení Matematiky E1 – návrh

## Účel a proč
Student 1. ročníku FaME UTB (předmět 1MAT1 Matematika E1, zimní semestr 2026/27) se chce z kurzu v Moodlu učit interaktivně a ne jen číst PDF. Aplikaci chce dát i spolužákům. Cíl: zvládnout dva zápočtové testy (≥ 50 % z každého; čisté výpočty) a písemnou zkoušku (A ≥ 92 %, E ≥ 60 %, pod 60 % FX; povolený je list vzorců). Formu zkoušky nikdo přesně nezná, proto se vychází z příkladů v Moodlu.

## Cíle
1. **Procvičování:** aplikace zadá (náhodně generovaný nebo ze zásoby) příklad, student zapíše výsledek, aplikace ho zkontroluje a řekne, zda je správně (výsledek se ověřuje matematicky, ne porovnáním textu – ekvivalentní tvary jsou správně).
2. **Postup krok za krokem:** řešený příklad, u každého kroku **grafika i textový popis** (co se dělá a proč). Student může krokovat vpřed/vzad.
3. **Výklad:** vysvětlení, jak se který typ příkladu dělá, bez zadání (teorie, vzorce, typické chyby).
4. **Pokrok po uživatelích:** přihlášení e-mailem a heslem (jako u portfolia), každý uživatel má vlastní pokrok; aplikace si pamatuje, co už procvičil a kde chybuje.
5. **Všech 12 témat kurzu:** aritmetické vektory; matice a operace, hodnost; determinant, inverzní matice, maticové rovnice; soustavy lineárních rovnic a Gaussova eliminace; funkce a vlastnosti; elementární funkce; limita a spojitost; derivace; derivace vyšších řádů; l'Hospitalovo pravidlo; geometrický význam derivace; průběh funkce (včetně definičního oboru, parity, inverzní funkce, asymptot, flexe).
6. Funguje na počítači, Androidu, iPhonu, tabletu i iPadu (responzivní, přidatelné na plochu), sdílitelné odkazem.
7. Vzorce povolené u zkoušky jsou v aplikaci po ruce.
8. Veškerý text v UI česky.

9. **Dvě tabule (rozhodnutí uživatele):** (a) *Tabule s řešením*: každý řešený postup se zobrazí jako na školní tabuli – tmavé pozadí, rukopisné písmo, postupné „psaní“ řádků, barevné poznámky (složené závorky, škrtání při krácení, dvojité podtržení výsledku) a pod ní popis kroku „Krok N z M“. (b) *Kreslicí tabule*: u každého příkladu, kde se počítá, si student může psát vlastní postup prstem, myší nebo perem.

## Mimo rozsah a nežádoucí výsledky
- **Žádné AI za běhu**, žádný klíč k AI, žádné průběžné náklady. Zadání, postupy i výklad jsou napsané předem.
- **Příklady smí vycházet přímo ze souborů v Moodlu** (rozhodnutí uživatele: jen osobní použití uživatele a pár spolužáků ze stejného cvičení). Protože jde o cizí materiály, aplikace nesmí být veřejná: soukromý repozitář, registrace jen pro pozvané e-maily a obsah příkladů se načítá až po přihlášení. Samotné stažené soubory (PDF, Word) se nenahrávají; do aplikace jdou přepsané příklady, výklad a postupy.
- **Pořadí témat je stejné jako v Moodlu:** Aritmetické vektory; Matice, hodnost, inverzní matice; Determinant, adjungovaná matice; Soustavy lineárních rovnic; Funkce a její vlastnosti; Limita funkce; Derivace, l'Hospitalovo pravidlo, průběh funkce.
- Nepřebírat testy z Moodlu (jsou interaktivní a patří škole).
- Neúspěch: špatně vyhodnocené správné řešení (např. jiný, ale ekvivalentní tvar), postupy s matematickými chybami, aplikace nepoužitelná na telefonu.

## Rozhodnutí uživatele
- Webová aplikace pro všechna zařízení, sdílená spolužákům.
- Přihlášení e-mailem a heslem, pokrok každého zvlášť.
- GitHub účet je k dispozici (už se používá pro portfolio tracker).
- Procvičování + postup krok za krokem (grafika + popis kroků) + samostatný výklad.
- Obsah má pocházet z kurzu v Moodlu.

## Moje volby (ať je uživatel zkontroluje)
- Statická webová aplikace (HTML/JS, bez vlastního serveru) hostovaná na GitHub Pages.
- Přihlášení a ukládání pokroku přes Supabase (nový projekt; v aplikaci jen veřejný „anon“ klíč a adresa, data chrání pravidla řádkové ochrany, každý vidí jen svůj pokrok). Tajné klíče a hesla se nikdy nevkládají do chatu ani do gitu.
- Kontrola výsledků a vykreslení vzorců běží v prohlížeči (knihovna na symbolickou/numerickou matematiku a na sazbu vzorců).
- Zadání se částečně generují náhodně (čísla), aby šlo cvičit opakovaně.
- Materiály jsou převážně PDF (56) a Word (2), část jsou nejspíš skeny ručně psaných přednášek; budou se číst i jako obrázky.

## Další moje volby po kontrole návrhu (ať je uživatel zkontroluje)
- Zdrojové soubory jsou ve složce `Matika\Moodle_Matematika` (58 souborů, podsložky podle témat); builder z nich zjistí typy příkladů. Obsah píše Claude; správnost řešení se v testech ověřuje výpočtem (každý generátor se kontroluje proti nezávislému výpočtu).
- Bez build kroku: prosté soubory HTML/JS/CSS, knihovny z CDN s pevnou verzí; základní offline režim (PWA) je bonus. Nasazení skriptované, popsané krok po kroku („klikni sem“), na stejném GitHub účtu jako portfolio.
- Kontrola výsledků ve v1: čísla, zlomky, vektory, matice, výrazy (ekvivalence), intervaly a definiční obory, limity včetně ±∞ a „neexistuje“, soustavy včetně parametrického řešení. Každý příklad má tlačítko „ukaž výsledek“. Na mobilu k zápisu výrazů pomůže panel s tlačítky.
- Pokrok: ukládá se každý pokus (příklad, odpověď, správně/špatně, čas) jen pro daného uživatele; nikdo jiný (ani majitel) jej nevidí. Doporučení „co procvičit příště“ podle chybovosti po tématech.
- Vzorce: vlastní přehled, označený jako neoficiální; oficiální list ke zkoušce se nekopíruje.
- Testování zařízení: v prohlížeči počítače s emulací telefonu a tabletu; uživatel pak ověří na svých zařízeních a pošle screenshot.

## Zbývá na builderovi
Rozložení stránek a vzhled, přesná sada typů příkladů v každém tématu a jejich generátory, způsob zápisu výsledků (tabulka políček pro matice, textový zápis výrazů s náhledem), grafické znázornění kroků (např. Gaussova eliminace, graf funkce, tečna, průběh funkce), struktura databáze pokroku, postup nasazení, testy.
