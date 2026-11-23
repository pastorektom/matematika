// Výklad k tématu Derivace, l'Hospitalovo pravidlo, průběh funkce – vlastními slovy.
export const theory = [
  {
    heading: 'Co je derivace',
    text: 'Derivace funkce $f$ v bodě $x_0$ říká, jak rychle se funkce v tom bodě mění. Geometricky je to směrnice (sklon) tečny ke grafu v bodě $[x_0;\\ f(x_0)]$: kladná derivace znamená, že graf stoupá, záporná, že klesá, nulová, že tečna je vodorovná.\n\nPřesně je derivace limita podílu přírůstků $\\frac{f(x_0+h)-f(x_0)}{h}$ pro $h\\to0$. V praxi ji ale počítáme podle vzorců a pravidel, ne z definice.\n\nDerivaci značíme čárkou: $f\'(x)$, případně $(\\ldots)\'$ za výrazem v závorce. Výsledkem je zase funkce, kterou můžeme derivovat dál.',
    tex: "f'(x_0)=\\lim_{h\\to0}\\frac{f(x_0+h)-f(x_0)}{h}",
    mistakes: [
      'Plést si hodnotu funkce $f(x_0)$ a hodnotu derivace $f\'(x_0)$ – první je výška bodu na grafu, druhá sklon tečny.',
      'Derivace konstanty je 0, ne ta konstanta: $(5)\'=0$.',
    ],
  },
  {
    heading: 'Vzorce pro základní funkce',
    text: 'Tyto vzorce je potřeba znát (jsou i na povoleném listu vzorců):\n\n$(c)\'=0$, $(x^n)\'=n\\,x^{n-1}$ (platí pro každý reálný exponent, tedy i pro odmocniny a zlomky), $(e^x)\'=e^x$, $(a^x)\'=a^x\\ln a$, $(\\ln x)\'=\\frac{1}{x}$, $(\\log_a x)\'=\\frac{1}{x\\ln a}$, $(\\sin x)\'=\\cos x$, $(\\cos x)\'=-\\sin x$, $(\\operatorname{tg} x)\'=\\frac{1}{\\cos^2 x}$, $(\\operatorname{cotg} x)\'=-\\frac{1}{\\sin^2 x}$, $(\\arcsin x)\'=\\frac{1}{\\sqrt{1-x^2}}$, $(\\arccos x)\'=-\\frac{1}{\\sqrt{1-x^2}}$, $(\\operatorname{arctg} x)\'=\\frac{1}{1+x^2}$, $(\\operatorname{arccotg} x)\'=-\\frac{1}{1+x^2}$.\n\nOdmocniny a zlomky s $x$ ve jmenovateli před derivováním přepiš na mocniny: $\\sqrt{x}=x^{\\frac12}$, $\\sqrt[3]{x^2}=x^{\\frac23}$, $\\frac{1}{x^3}=x^{-3}$. Pak stačí jediný vzorec pro mocninu. Výsledek nakonec zapiš zpátky jako zlomek nebo odmocninu.',
    tex: "(x^n)'=n\\,x^{n-1},\\qquad (\\sqrt{x})'=\\frac{1}{2\\sqrt{x}},\\qquad \\left(\\frac{1}{x}\\right)'=-\\frac{1}{x^2}",
    mistakes: [
      'U záporného exponentu se při odečtení jedničky „zvětší“ absolutní hodnota: $(x^{-2})\'=-2x^{-3}$, ne $-2x^{-1}$.',
      'Vzorec pro mocninu nepoužívat na $e^x$ nebo $2^x$: $(2^x)\'=2^x\\ln 2$, ne $x\\cdot2^{x-1}$.',
      'Znaménko u kosinu: $(\\cos x)\'=-\\sin x$.',
    ],
  },
  {
    heading: 'Součet, násobek, součin a podíl',
    text: 'Součet a rozdíl derivujeme člen po členu, konstantu před funkcí opíšeme: $(c\\cdot f)\'=c\\cdot f\'$.\n\nSoučin dvou funkcí: první činitel označíme $u$, druhý $v$. Platí $(u\\cdot v)\'=u\'v+uv\'$ – v každém sčítanci derivujeme jen jeden činitel. Na tabuli si nad činitele napiš $u$, $v$ a nad jejich derivace $u\'$, $v\'$.\n\nPodíl: $\\left(\\frac{u}{v}\\right)\'=\\frac{u\'v-uv\'}{v^2}$. V čitateli záleží na pořadí (začíná se $u\'v$) a je tam minus; jmenovatel se jen umocní, neroznásobuje se.\n\nKdyž je ve jmenovateli jen mocnina $x$ (např. $\\frac{x^3-2x}{\\sqrt{x}}$), je rychlejší zlomek rozdělit na členy a derivovat mocniny.',
    tex: "(u\\cdot v)'=u'v+uv',\\qquad \\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^2}",
    mistakes: [
      'Derivovat součin jako součin derivací: $(x^2e^x)\'\\neq 2x\\cdot e^x$.',
      'Prohodit pořadí v čitateli podílu – vyjde opačné znaménko.',
      'Zapomenout závorku u odečítaného součinu $uv\'$, když má více členů.',
    ],
  },
  {
    heading: 'Složená funkce (řetízkové pravidlo)',
    text: 'Složená funkce vznikne dosazením jedné funkce (vnitřní funkce $g$) do druhé (vnější funkce $f$): $h(x)=f(g(x))$. Např. u $\\sqrt{x^2+1}$ je vnější funkce $f(y)=\\sqrt{y}$ a vnitřní funkce $g(x)=x^2+1$.\n\nDerivace je $h\'(x)=f\'(g(x))\\cdot g\'(x)$: derivaci vnější funkce $f\'$ spočteme v bodě $g(x)$ (vnitřek opíšeme beze změny) a vynásobíme derivací vnitřní funkce $g\'(x)$. Je-li vnoření víc, násobíme derivacemi všech vrstev.\n\nPříklady: $(\\sin 3x)\'=3\\cos 3x$, $(e^{x^2})\'=2x\\,e^{x^2}$, $(\\ln(x^2+1))\'=\\frac{2x}{x^2+1}$, $(\\sin^3x)\'=3\\sin^2x\\cos x$.',
    tex: "h(x)=f(g(x)),\\ h'(x)=f'(g(x))\\cdot g'(x)",
    mistakes: [
      'Zapomenout vynásobit derivací vnitřní funkce $g\'(x)$ – nejčastější chyba vůbec.',
      '$f\'$ se počítá v bodě $g(x)$: vnitřek se opisuje beze změny, nesmí se přepsat ani zjednodušit.',
      'Derivovat vnitřní funkci uvnitř vnější: $(\\sin x^2)\'$ není $\\cos 2x$, ale $2x\\cos x^2$.',
      'U $\\ln$ složené funkce nezapomenout, že výsledek je zlomek: $\\frac{\\text{derivace vnitřku}}{\\text{vnitřek}}$.',
    ],
  },
  {
    heading: 'Logaritmická derivace (proměnná v základu i exponentu)',
    text: 'Funkci tvaru $u(x)^{v(x)}$, třeba $x^x$, nejde derivovat ani jako mocninu, ani jako exponenciálu. Pomůže logaritmus: označíme $y=u^v$, zlogaritmujeme $\\ln y=v\\cdot\\ln u$ a derivujeme obě strany. Vlevo vzniká $\\frac{y\'}{y}$, vpravo součin. Nakonec obě strany vynásobíme $y$.',
    tex: "y=u^v\\ \\Rightarrow\\ y'=u^v\\left(v'\\ln u+v\\,\\frac{u'}{u}\\right)",
    mistakes: [
      'Použít vzorec $(x^n)\'=nx^{n-1}$ i na $x^x$ – vyjde $x\\cdot x^{x-1}=x^x$, což je chyba, chybí $\\ln x$.',
      'Po zlogaritmování zapomenout, že $(\\ln y)\'=\\frac{y\'}{y}$, a na konci nevynásobit $y$.',
    ],
  },
  {
    heading: 'Druhá derivace',
    text: 'Druhá derivace $f\'\'$ je derivace první derivace; třetí derivace je derivace druhé atd. Počítá se stejnými pravidly – nejdřív si první derivaci uprav (vytkni, zkrať), ať se dál derivuje snadno.\n\nZnaménko druhé derivace říká, jak je graf zakřivený: $f\'\'>0$ – konvexní (tvar $\\cup$), $f\'\'<0$ – konkávní (tvar $\\cap$).',
    tex: "f''(x)=\\big(f'(x)\\big)'",
    mistakes: [
      'Derivovat znovu původní funkci místo první derivace.',
      'Při dosazování do $f\'\'$ splést hodnoty: $e^0=1$, $\\ln 1=0$, $\\sin 0=0$, $\\cos 0=1$.',
    ],
  },
  {
    heading: 'Tečna a normála',
    text: 'Tečna ke grafu v bodě $T=[x_0;\\ y_0]$, kde $y_0=f(x_0)$, má směrnici $k=f\'(x_0)$. Její rovnice je $y-y_0=k(x-x_0)$, kterou upravíme na tvar $y=kx+q$.\n\nNormála je přímka kolmá k tečně ve stejném bodě. Směrnice kolmých přímek mají součin $-1$, takže normála má směrnici $k_n=-\\frac{1}{k}$ (pro $k\\neq0$). Je-li tečna vodorovná ($k=0$), normála je svislá přímka $x=x_0$.\n\nPostup: 1) $y_0=f(x_0)$, 2) $f\'(x)$ a $k=f\'(x_0)$, 3) dosadit do rovnice přímky.',
    tex: "t:\\ y-y_0=f'(x_0)(x-x_0),\\qquad n:\\ y-y_0=-\\frac{1}{f'(x_0)}(x-x_0)",
    mistakes: [
      'Dosadit do rovnice tečny celou derivaci $f\'(x)$ místo čísla $f\'(x_0)$.',
      'U normály zapomenout znaménko minus nebo převrácenou hodnotu.',
      'Vzít za $y_0$ hodnotu derivace místo hodnoty funkce.',
    ],
  },
  {
    heading: "l'Hospitalovo pravidlo",
    text: 'Pravidlo pomáhá s limitami podílu, které vedou na neurčitý výraz typu $\\frac{0}{0}$ nebo $\\frac{\\infty}{\\infty}$. Pak platí $\\lim\\frac{f(x)}{g(x)}=\\lim\\frac{f\'(x)}{g\'(x)}$, pokud limita vpravo existuje.\n\nPostup: 1) dosazením ověř, že jde opravdu o typ $\\frac{0}{0}$ nebo $\\frac{\\infty}{\\infty}$ (zapisuje se třeba $\\left|\\frac{0}{0}\\right|$), 2) zderivuj zvlášť čitatel a zvlášť jmenovatel, 3) znovu dosaď. Vyjde-li zase neurčitý výraz, pravidlo použij znovu; mezitím je dobré výraz upravit (zkrátit, odstranit zlomky).\n\nPravidlo ukazuje, že $e^x$ roste rychleji než každá mocnina $x^n$ a ta zase rychleji než $\\ln x$: $\\lim_{x\\to\\infty}\\frac{x^n}{e^x}=0$, $\\lim_{x\\to\\infty}\\frac{\\ln x}{x^n}=0$.',
    tex: "\\lim_{x\\to a}\\frac{f(x)}{g(x)}=\\left|\\frac{0}{0}\\right|\\stackrel{\\text{l'H}}{=}\\lim_{x\\to a}\\frac{f'(x)}{g'(x)}",
    mistakes: [
      'Použít pravidlo, i když výraz neurčitý není – např. $\\lim_{x\\to0}\\frac{x+1}{x+2}=\\frac12$ prostým dosazením, s pravidlem by vyšlo chybně 1.',
      'Derivovat celý zlomek podle vzorce pro podíl. Čitatel a jmenovatel se derivují každý zvlášť.',
      'Nekontrolovat typ výrazu před každým dalším použitím pravidla.',
    ],
  },
  {
    heading: "Úpravy na podíl: 0·∞ a ∞−∞",
    text: 'Neurčité výrazy jiných typů převedeme na podíl a teprve pak použijeme l\'Hospitalovo pravidlo.\n\nSoučin typu $0\\cdot\\infty$: jeden činitel přesuneme do jmenovatele jako převrácenou hodnotu, např. $x^2\\ln x=\\frac{\\ln x}{\\frac{1}{x^2}}$ (typ $\\frac{\\infty}{\\infty}$). Do jmenovatele dáváme obvykle tu část, která se snadno derivuje – logaritmus necháváme v čitateli.\n\nRozdíl typu $\\infty-\\infty$ (typicky dva zlomky): převedeme na společný jmenovatel, vznikne jeden zlomek typu $\\frac{0}{0}$.',
    tex: "0\\cdot\\infty:\\ f\\cdot g=\\frac{f}{\\frac{1}{g}},\\qquad \\infty-\\infty:\\ \\frac{1}{a}-\\frac{1}{b}=\\frac{b-a}{ab}",
    mistakes: [
      'Myslet si, že $0\\cdot\\infty=0$ nebo $\\infty-\\infty=0$ – výsledek může být jakékoli číslo.',
      'Při převodu na společný jmenovatel zapomenout vynásobit čitatele.',
    ],
  },
  {
    heading: 'Monotonie a lokální extrémy',
    text: 'Funkce je na intervalu rostoucí, je-li tam $f\'>0$, a klesající, je-li $f\'<0$.\n\nPostup: najdi nulové body $f\'$ (stacionární body) a body, kde $f\'$ nebo $f$ neexistuje. Rozdělí osu $x$ na intervaly; na každém dosaď libovolné číslo do $f\'$ a zjisti znaménko. Výsledek zapiš do tabulky znamének (šipky $\\nearrow$, $\\searrow$).\n\nLokální maximum je tam, kde se rostoucí mění v klesající ($+$ na $-$), lokální minimum naopak. Nulová derivace sama o sobě extrém nezaručuje: $x^3$ má $f\'(0)=0$, ale je všude rostoucí. Souřadnici $y$ extrému dopočítáš dosazením do původní funkce $f$.',
    tex: "f'>0\\ \\Rightarrow\\ f\\nearrow,\\qquad f'<0\\ \\Rightarrow\\ f\\searrow",
    mistakes: [
      'Zapomenout do tabulky body mimo definiční obor – i tam se může měnit znaménko, ale extrém tam není.',
      'Za extrém považovat každý nulový bod derivace bez kontroly změny znaménka.',
      'Dosadit hodnotu extrému do $f\'$ místo do $f$.',
    ],
  },
  {
    heading: 'Konvexnost, konkávnost a inflexní body',
    text: 'Funkce je konvexní na intervalu, kde $f\'\'>0$ (graf se prohýbá nahoru, leží nad tečnou, tvar $\\cup$), a konkávní, kde $f\'\'<0$ (graf pod tečnou, tvar $\\cap$).\n\nInflexní bod je bod definičního oboru, kde se konvexnost mění v konkávnost nebo naopak – druhá derivace tam mění znaménko. Postup je stejný jako u monotonie, jen s druhou derivací.\n\nPozor: $f\'\'(x_0)=0$ ještě inflexi neznamená (u $x^4$ je $f\'\'(0)=0$, ale funkce je konvexní všude).',
    tex: "f''>0\\ \\Rightarrow\\ \\cup\\ (\\text{konvexní}),\\qquad f''<0\\ \\Rightarrow\\ \\cap\\ (\\text{konkávní})",
    mistakes: [
      'Plést si konvexní a konkávní: konvexní je „miska“ $\\cup$.',
      'Prohlásit za inflexní bod místo, kde funkce není definovaná.',
    ],
  },
  {
    heading: 'Asymptoty',
    text: 'Asymptota bez směrnice (svislá) $x=x_0$ je v bodě, kde má funkce aspoň jednu jednostrannou limitu nekonečnou – typicky v nulovém bodě jmenovatele, který není nulovým bodem čitatele. Hledáme ji v konečných krajních bodech definičního oboru.\n\nAsymptota se směrnicí $y=kx+q$ (šikmá, pro $k=0$ vodorovná) se počítá zvlášť pro $x\\to\\infty$ a $x\\to-\\infty$: $k=\\lim\\frac{f(x)}{x}$, $q=\\lim\\big(f(x)-kx\\big)$. Obě limity musí vyjít jako čísla; vyjde-li některá nekonečná, asymptota na té straně není.\n\nU racionální funkce: je-li stupeň čitatele o 1 větší než jmenovatele, je asymptota šikmá; stejný stupeň dává vodorovnou $y=\\frac{\\text{koef. čitatele}}{\\text{koef. jmenovatele}}$; menší stupeň čitatele dává $y=0$. Polynom stupně aspoň 2 žádnou asymptotu nemá.',
    tex: "k=\\lim_{x\\to\\pm\\infty}\\frac{f(x)}{x},\\qquad q=\\lim_{x\\to\\pm\\infty}\\big(f(x)-kx\\big)",
    mistakes: [
      'Počítat $q$ jako $\\lim f(x)$ i u šikmé asymptoty – je třeba odečíst $kx$.',
      'Prohlásit za svislou asymptotu bod, kde se zlomek dá zkrátit (limita je tam konečná).',
      'Zapomenout zkontrolovat obě strany $\\pm\\infty$ (např. u $e^x$ se liší).',
    ],
  },
  {
    heading: 'Průběh funkce – celý postup',
    text: 'Vyšetřit průběh funkce znamená zjistit o ní vše potřebné k náčrtu grafu. Doporučené pořadí:\n\n1. Definiční obor; zda je funkce sudá, lichá (periodická).\n2. Průsečíky s osami $x$ ($f(x)=0$) a $y$ ($f(0)$).\n3. Limity v krajních bodech definičního oboru (v $\\pm\\infty$ a jednostranné v bodech, kde funkce není definovaná).\n4. První derivace, její nulové body; intervaly monotonie a lokální extrémy.\n5. Druhá derivace, její nulové body; intervaly konvexnosti, konkávnosti a inflexní body.\n6. Asymptoty bez směrnice a se směrnicí.\n7. Graf: nejdřív asymptoty (čárkovaně), průsečíky, extrémy a inflexe, pak je spoj podle tabulek znamének.\n\nVýsledky mají souhlasit: sudá funkce má graf souměrný podle osy $y$, lichá podle počátku; limity musí odpovídat asymptotám.',
    mistakes: [
      'Zapomenout na body mimo definiční obor v tabulkách znamének.',
      'Graf neodpovídá tabulkám (např. roste tam, kde vyšla záporná derivace) – na konci vše porovnej.',
      'Nevypočítat $y$-ové souřadnice extrémů a inflexních bodů, bez nich graf správně nenakreslíš.',
    ],
  },
];
