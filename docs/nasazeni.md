# Nasazení aplikace na internet – návod krok za krokem (Windows)

Cíl: aplikace poběží na adrese typu `https://tvojejmeno.github.io/matematika/`, přihlásí se do ní jen pozvaní spolužáci a půjde ji přidat na plochu telefonu. Celé to zabere asi 45 minut. Vše je zdarma.

> **Tři pravidla, která platí vždy**
> 1. Klíč **service_role** a **heslo k databázi** NIKDY nikomu neposílej, nevkládej do souborů ani do chatu.
> 2. Do aplikace (`js\config.js`) patří jen **Project URL** a klíč **anon public**.
> 3. Žádné tokeny ani hesla k GitHubu nikam nevkládej a nepiš do chatu. Přihlášení k GitHubu proběhne v okně prohlížeče.

Podrobnější popis samotného Supabase najdeš i v `docs\supabase-navod.md`. Tady je vše pohromadě.

---

## A. Založení projektu v Supabase a tabulky

1. Otevři v Opeře <https://supabase.com> a klikni na **Start your project**. Přihlas se přes GitHub (nebo e-mailem).
2. Klikni na **New project**. Pokud po tobě chce založit organizaci, potvrď výchozí hodnoty (plán **Free**).
3. Vyplň:
   - **Name**: `matematika-e1`
   - **Database Password**: klikni na **Generate a password** a heslo ulož do správce hesel. Nikam ho nevkládej.
   - **Region**: vyber **Central EU (Frankfurt)** (nebo jiný region v EU).
4. Klikni na **Create new project** a počkej pár minut, než se vytvoří.
5. V levém sloupci klikni na **SQL Editor**, pak na **New query**.
6. Na počítači otevři v Poznámkovém bloku soubor `supabase\schema.sql` (ve složce projektu), stiskni **Ctrl+A**, **Ctrl+C**. Vrať se do okna prohlížeče, klikni do editoru, **Ctrl+V** a klikni na **Run**.
   Dole má být **Success. No rows returned**.
7. Totéž udělej se souborem `supabase\002_problems_unique.sql`: **New query**, vložit, **Run**. Opět **Success**.

Oba soubory lze spustit i opakovaně, nic se nerozbije.

## B. Test zabezpečení (rls_test.sql)

Tento test ověří, že každý uživatel vidí jen své výsledky a že se nemůže zaregistrovat nikdo cizí.

1. **SQL Editor** → **New query**.
2. Vlož obsah souboru `supabase\rls_test.sql` (**Ctrl+A**, **Ctrl+C**, **Ctrl+V**) a klikni na **Run**.
3. V dolní části klikni na záložku **Messages** (nebo **Results**, podle verze editoru).
   - **Správný výsledek:** několik řádků začínajících `OK: ...` a na konci řádek **`VSE PRESLO`**.
   - **Chyba:** pokud uvidíš `FAIL: ...` nebo červenou chybu, soubor `schema.sql` se nespustil celý. Spusť ho znovu (viz A.6) a test zopakuj.
4. Test nic trvale nezapíše (na konci je `rollback`).

## C. Pozvané e-maily

Zaregistrovat se smějí jen e-maily, které přidáš ty.

1. **SQL Editor** → **New query**.
2. Vlož a uprav (e-maily piš **malými písmeny**; databáze je sice převede sama, ale ať nedojde k překlepu):
   ```sql
   insert into public.allowed_emails (email) values
     ('ja@example.com'),
     ('spoluzak1@example.com'),
     ('spoluzak2@example.com')
   on conflict do nothing;
   ```
3. Klikni na **Run**. Kontrola: spusť `select * from public.allowed_emails;` – uvidíš seznam.

## D. Adresa aplikace a potvrzování e-mailů

Adresu GitHub Pages znáš už teď: `https://TVOJE-UZIVATELSKE-JMENO.github.io/NAZEV-REPOZITARE/` (např. `https://jannovak.github.io/matematika/`). Uživatelské jméno je to, pod kterým jsi na GitHubu, název repozitáře zvolíš v kroku G. Piš ji **malými písmeny** a s lomítkem na konci.

1. V Supabase klikni vlevo na **Authentication**, pak **URL Configuration**.
2. **Site URL**: vlož adresu aplikace. Klikni **Save changes**.
3. **Redirect URLs** → **Add URL**: vlož stejnou adresu. Přidej i `http://localhost:8521/` (pro zkoušení na počítači). **Save changes**.

### Potvrzovací e-maily a jejich limit

Bezplatný e-mail Supabase pošle jen asi **3–4 e-maily za hodinu** pro celý projekt. Když se spolužáci registrují najednou, část z nich e-mail nedostane a uvidí hlášku „Příliš mnoho pokusů“. Máš dvě cesty:

**Cesta 1 (nejjednodušší, doporučená pro malou uzavřenou skupinu): vypnout potvrzování.**
1. **Authentication** → **Providers** (u novějších verzí **Sign In / Providers**) → **Email**.
2. Vypni **Confirm email** a klikni na **Save**.
3. Registrace pak funguje hned, bez e-mailu.

Rizika: nikdo se neověří, že e-mail opravdu vlastní. Pokud někdo zná e-mail pozvaného spolužáka, může se na něj dřív zaregistrovat se svým heslem (e-mail musí být ale na tvém seznamu, cizí se nedostane dovnitř). Zmírnění: přidávej e-maily do seznamu (krok C) až v okamžiku, kdy se daný spolužák chystá registrovat, a požádej je, ať se zaregistrují hned. Zapomenuté heslo se obnovuje e-mailem, takže ho limit stále omezuje (málo lidí, ojedinělé).

**Cesta 2 (čistší, ale složitější): vlastní SMTP.**
1. Založ si bezplatný účet u e-mailové služby (např. Brevo nebo Resend), ověř odesílací adresu a zkopíruj SMTP údaje.
2. V Supabase: **Project Settings** → **Authentication** → **SMTP Settings** → zapni **Enable Custom SMTP** a vyplň údaje služby. **Save**.
3. **Confirm email** nech zapnuté. Limit je pak daný tvou e-mailovou službou (stovky e-mailů denně).

## E. Vložení Project URL a anon klíče do aplikace

1. V Supabase klikni vlevo dole na ozubené kolo **Project Settings** → **API** (nebo **Data API** / **API Keys**).
2. Zkopíruj **Project URL** (začíná `https://`, končí `.supabase.co`).
3. Zkopíruj klíč **anon** / **public**. **NEKOPÍRUJ `service_role`!**
4. Na počítači otevři v Poznámkovém bloku soubor `js\config.js` a vlož hodnoty mezi uvozovky:
   ```js
   export const SUPABASE_URL = 'https://tvuj-projekt.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...tvuj-anon-klic...';
   ```
5. Ulož (**Ctrl+S**). Klíč **anon** je veřejný z principu – bezpečnost zajišťují pravidla v databázi (kroky A a B).

## F. Nahrání příkladů ze cvičení do databáze

Příklady z cvičení (složka `content\`) jsou jen na tvém disku a do GitHubu se nikdy nenahrávají. Nahraješ je do Supabase, kde je uvidí jen přihlášení pozvaní.

1. Otevři **PowerShell** (klikni na Start, napiš `PowerShell`, Enter) a přejdi do složky projektu:
   ```powershell
   cd C:\Users\pasto\Documents\Claude\Matika
   ```
2. Vygeneruj SQL:
   ```powershell
   node tools/problems-to-sql.mjs | Out-File -Encoding utf8 problems.sql
   ```
   (Soubor `problems.sql` je v `.gitignore`, na GitHub se nedostane.)
3. Otevři `problems.sql` v Poznámkovém bloku, **Ctrl+A**, **Ctrl+C**.
4. V Supabase: **SQL Editor** → **New query** → **Ctrl+V** → **Run**. Má být **Success**. Opakované spuštění nic nezdvojí.
5. Kontrola: `select topic, count(*) from public.problems group by topic;`

## G. GitHub repozitář a nahrání kódu

**Veřejný, nebo soukromý repozitář?** Doporučuji **veřejný (Public)**:
- GitHub Pages z **privátního** repozitáře vyžaduje placený plán, veřejný je zdarma.
- Kód aplikace neobsahuje žádný obsah z Moodlu: složka `content\` a `Moodle_Matematika\` jsou v `.gitignore` a nikdy se nenahrají. Příklady ze cvičení leží jen v Supabase a vidí je pouze přihlášení pozvaní.
- V kódu je jen veřejný klíč `anon`, který je veřejný z principu. Tajné údaje (`service_role`, heslo k databázi) v repozitáři nikdy nejsou.

**Před nahráním zkontroluj**, že v gitu nejsou žádné soubory z kurzu. V PowerShellu ve složce projektu:
```powershell
git ls-files | Select-String -Pattern "moodle|content/|\.pdf|\.doc"
```
Příkaz **nesmí nic vypsat**. Když něco vypíše, nepokračuj a napiš to správci projektu.

### Vytvoření repozitáře
1. Otevři <https://github.com> a přihlas se.
2. Vpravo nahoře klikni na **+** → **New repository**.
3. **Repository name**: `matematika` (nebo jiný název; musí odpovídat adrese z kroku D).
4. Vyber **Public**. **Nezaškrtávej** *Add a README*, *.gitignore* ani *license* (repozitář musí být prázdný).
5. Klikni na **Create repository**. Zobrazí se stránka s adresou repozitáře (`https://github.com/TVOJE-JMENO/matematika.git`).

### Odeslání z PowerShellu
1. V PowerShellu ve složce projektu (viz F.1) nejdřív ulož změnu v `js\config.js`:
   ```powershell
   git add js/config.js
   git commit -m "Připojení k Supabase"
   ```
2. Propoj složku s GitHubem (adresu nahraď svou):
   ```powershell
   git remote add origin https://github.com/TVOJE-JMENO/matematika.git
   git push -u origin main
   ```
3. Při prvním odeslání se otevře okno **Git Credential Manager** nebo prohlížeč: klikni na **Sign in with your browser** a potvrď přihlášení k GitHubu. Nic nekopíruj a žádný token nikam nevkládej. (Alternativa, pokud máš GitHub CLI: `gh auth login` a postupuj podle průvodce.)
4. Až příkaz doběhne, obnov stránku repozitáře na GitHubu – uvidíš soubory aplikace. Zkontroluj, že tam **není** složka `content` ani `Moodle_Matematika`.

### Zapnutí GitHub Pages
1. V repozitáři na GitHubu klikni na **Settings** (ozubené kolo, horní lišta).
2. V levém menu klikni na **Pages**.
3. U **Source** vyber **GitHub Actions**. (Nic dalšího nevypisuj.)
4. Klikni na záložku **Actions**. Běží workflow „Nasazení na GitHub Pages“: nejdřív testy, pak sestavení a nasazení. Trvá to 1–3 minuty; zelená fajfka znamená hotovo.
5. Vrať se do **Settings** → **Pages**: nahoře se objeví adresa tvé aplikace. Ta musí být stejná jako v kroku D. Pokud ne, oprav **Site URL** a **Redirect URLs** v Supabase.

## H. Ověření

1. Otevři adresu aplikace v Opeře. Má se zobrazit přihlašovací obrazovka.
2. Klikni na **Nemám účet, zaregistrovat se** a zaregistruj se e-mailem z kroku C. (Při zapnutém potvrzování klikni na odkaz v e-mailu.)
3. Přihlas se, zkus příklad a zkontroluj, že se ukládá pokrok (po obnovení stránky zůstane).
4. Zkus nepovolený e-mail: má se ukázat „Tento e-mail není na seznamu povolených“.
5. **Telefon s Androidem (Chrome):** otevři adresu → vpravo nahoře tři tečky → **Přidat na plochu** (nebo **Nainstalovat aplikaci**) → **Přidat**. Ikona Σ se objeví na ploše.
6. **iPhone (Safari):** otevři adresu v Safari → tlačítko **Sdílet** (čtvereček se šipkou) → **Přidat na plochu** → **Přidat**.
7. **Offline:** po prvním otevření a přihlášení zapni v telefonu letecký režim a aplikaci otevři znovu. Témata a výklad se načtou. Přihlášení a ukládání pokroku bez internetu nefunguje (po připojení se odeslání nedokončené práce zkusí znovu).

## I. Pozvání spolužáků

1. Přidej jejich e-maily (viz krok C, v SQL Editoru).
2. Pošli jim adresu aplikace **soukromě** (např. zprávou) a napiš jim, ať se zaregistrují přes **Nemám účet, zaregistrovat se** přesně s tím e-mailem, který jsi přidal.
3. Odebrání přístupu: `delete from public.allowed_emails where email = 'spoluzak@example.com';` (existující účet zůstane, ale příklady ze cvičení už neuvidí). Úplné smazání účtu: **Authentication** → **Users** → tři tečky u uživatele → **Delete user**.

## J. Když něco nefunguje

| Příznak | Příčina a řešení |
|---|---|
| Po otevření adresy je chyba 404 | Pages ještě neběží. Zkontroluj **Settings → Pages → Source = GitHub Actions** a v **Actions** zelenou fajfku. Adresa musí mít správný název repozitáře. |
| V **Actions** je červený křížek | Klikni na něj a na červený krok. Chyba v kroku „npm test“ znamená selhání testů, pošli výpis správci. |
| Aplikace se nepřihlásí, není vidět přihlášení | `js\config.js` má prázdné nebo špatné hodnoty. Zkontroluj, že jsi je vložil a změnu odeslal (`git add`, `git commit`, `git push`). |
| „Tento e-mail není na seznamu povolených“ | E-mail není v `allowed_emails` nebo je v něm překlep. Zkontroluj `select * from public.allowed_emails;`. |
| „Příliš mnoho pokusů“ | Limit e-mailů Supabase. Počkej hodinu, vypni **Confirm email** nebo nastav vlastní SMTP (krok D). |
| Odkaz z e-mailu vede na `localhost` nebo na špatnou stránku | **Authentication → URL Configuration**: špatný **Site URL** nebo chybí **Redirect URLs** (krok D). |
| Po přihlášení nejsou vidět příklady ze cvičení | Nenahrály se do tabulky `problems` (krok F) nebo e-mail není v `allowed_emails`. |
| `git push` hlásí `Authentication failed` | Přihlas se znovu přes okno prohlížeče. Případně v PowerShellu `gh auth login`. |
| `git push` hlásí `remote origin already exists` | Spusť `git remote set-url origin https://github.com/TVOJE-JMENO/matematika.git` a znovu `git push -u origin main`. |
| Po změně se na telefonu stále ukazuje stará verze | Zavři aplikaci úplně a otevři ji znovu; objeví se lišta **Nová verze – obnovit**, klepni na ni. |

## K. Aktualizace aplikace

Po každé změně v souborech stačí v PowerShellu ve složce projektu:
```powershell
git add -A
git commit -m "Stručný popis změny"
git push
```
GitHub sám spustí testy a nasadí novou verzi (1–3 minuty). Uživatelům se při dalším otevření ukáže lišta **Nová verze – obnovit**.

## L. Soukromí a autorská práva

- Příklady ze cvičení pocházejí z materiálů kurzu a jsou určeny **jen pro uzavřenou skupinu** spolužáků. Odkaz na aplikaci **nesdílej veřejně** (sociální sítě, veřejné skupiny).
- Příklady jsou v Supabase za přihlášením a pravidla databáze je ukážou jen e-mailům ze seznamu `allowed_emails`. Na GitHubu žádné nejsou.
- Samotná aplikace je veřejně dostupná jako adresa, ale bez přihlášení ukáže jen vlastní výklad a generované příklady.
- Nikdy nenahrávej na GitHub složky `content\`, `Moodle_Matematika\` ani soubor `problems.sql` (jsou v `.gitignore`).
