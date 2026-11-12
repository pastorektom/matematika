# Matematika E1

Česká studijní aplikace k předmětu Matematika E1: výklad, procvičování generovaných příkladů s kontrolou ekvivalence výrazů, řešené postupy krok za krokem, vzorce, tabule (i v okně na druhém displeji) a ukládání pokroku. Běží v prohlížeči a po prvním otevření i offline (PWA). Čisté ES moduly a CSS, bez sestavování.

## Spuštění na počítači

```powershell
npm install
npx http-server -p 8521 -c-1
```

Otevři `http://localhost:8521`. Bez vyplněného `js\config.js` běží aplikace bez přihlášení a pokrok se neukládá.

## Testy

```powershell
npm test
```

## Struktura

- `index.html`, `css/` – stránka a styly (tokeny v `css/app.css`)
- `js/app.js` – vstup, navigace, přihlášení; `js/router.js`, `js/auth.js`, `js/progress.js`, `js/content.js`
- `js/topics/` – jedno téma na soubor (generátory příkladů, řešené kroky, teorie)
- `js/ui/`, `js/viz/` – komponenty a vizualizace (tabule, grafy, matice)
- `sw.js`, `sw-rules.js`, `js/pwa.js`, `manifest.webmanifest`, `icons/` – offline a instalace na plochu
- `supabase/` – SQL schéma, migrace a test zabezpečení
- `tools/` – `problems-to-sql.mjs` (příklady ze cvičení do SQL), `make-icons.mjs` (ikony)
- `tests/` – testy (`node --test`)
- `content/` a `Moodle_Matematika/` – soukromé materiály, jsou v `.gitignore` a nikdy se nenahrávají

## Přidání nového tématu

1. Vytvoř `js/topics/<tema>.js` podle existujícího tématu (např. `matice.js`) a zaregistruj ho v `js/topics/index.js`.
2. Přidej soubor do seznamu `PRECACHE` v `sw.js` (test `tests/pwa.test.js` na to upozorní, když ho zapomeneš).
3. Přidej testy do `tests/topics/` a spusť `npm test`.
4. Pevné příklady ze cvičení patří do `content/problems/<tema>.json` (jen na tvém disku); do databáze je nahraješ podle `docs/nasazeni.md`, krok F.

## Nasazení

Kompletní návod (Supabase, GitHub, GitHub Pages, pozvání spolužáků, řešení potíží) je v [docs/nasazeni.md](docs/nasazeni.md). Po každém `git push` do větve `main` se aplikace sama otestuje a nasadí.
