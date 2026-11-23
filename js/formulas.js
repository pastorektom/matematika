// Vlastní přehled vzorců po tématech (vlastní výběr a formulace, nejde o kopii žádného
// školního dokumentu). Skupiny jdou v pořadí témat z Moodlu; za nimi algebra a goniometrie.
// Položka = { tex, note? }; tex se vykresluje KaTeXem, note je krátká poznámka (smí obsahovat $…$).

export const OWN_NOTE = 'Vlastní přehled, nejde o oficiální list ke zkoušce';

export const formulaGroups = [
  {
    id: 'vektory', topic: 'vektory', title: 'Aritmetické vektory',
    items: [
      { tex: '\\mathbf{u}\\cdot\\mathbf{v}=u_1v_1+u_2v_2+\\dots+u_nv_n', note: 'Skalární součin: násobíme po složkách a sečteme.' },
      { tex: '\\|\\mathbf{u}\\|=\\sqrt{\\mathbf{u}\\cdot\\mathbf{u}}=\\sqrt{u_1^2+\\dots+u_n^2}', note: 'Velikost vektoru.' },
      { tex: '\\cos\\varphi=\\dfrac{\\mathbf{u}\\cdot\\mathbf{v}}{\\|\\mathbf{u}\\|\\,\\|\\mathbf{v}\\|}', note: 'Úhel dvou nenulových vektorů, $\\varphi\\in\\langle 0,\\pi\\rangle$.' },
      { tex: '\\mathbf{u}\\perp\\mathbf{v}\\iff\\mathbf{u}\\cdot\\mathbf{v}=0', note: 'Kolmost vektorů.' },
      { tex: '\\|\\mathbf{u}+\\mathbf{v}\\|\\le\\|\\mathbf{u}\\|+\\|\\mathbf{v}\\|', note: 'Trojúhelníková nerovnost.' },
    ],
  },
  {
    id: 'matice', topic: 'matice', title: 'Matice, hodnost, inverzní matice',
    items: [
      { tex: '(AB)_{ij}=\\sum_{k=1}^{n}a_{ik}\\,b_{kj}', note: 'Součin matic: řádek první matice krát sloupec druhé. Počet sloupců $A$ = počet řádků $B$.' },
      { tex: 'AB\\ne BA\\ \\text{(obecně)},\\qquad (AB)^T=B^TA^T', note: 'Násobení matic není komutativní.' },
      { tex: 'A=\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix},\\ ad-bc\\ne0\\ \\Rightarrow\\ A^{-1}=\\dfrac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}', note: 'Inverzní matice 2×2: vyměníme diagonálu, u vedlejší změníme znaménko.' },
      { tex: '(A\\,|\\,E)\\sim(E\\,|\\,A^{-1})', note: 'Inverzní matice Gaussovou eliminací (úpravy řádků).' },
      { tex: '(AB)^{-1}=B^{-1}A^{-1}', note: 'Pořadí se u inverze součinu obrací.' },
      { tex: 'h(A)=\\text{počet nenulových řádků ve schodovitém tvaru}', note: 'Hodnost matice. Řádkové úpravy ji nemění.' },
    ],
  },
  {
    id: 'determinant', topic: 'determinant', title: 'Determinant, adjungovaná matice',
    items: [
      { tex: '\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}=ad-bc', note: 'Determinant 2×2.' },
      { tex: '\\det A=a_{11}a_{22}a_{33}+a_{12}a_{23}a_{31}+a_{13}a_{21}a_{32}-a_{13}a_{22}a_{31}-a_{11}a_{23}a_{32}-a_{12}a_{21}a_{33}', note: 'Sarrusovo pravidlo (jen pro matice 3×3).' },
      { tex: '\\det A=\\sum_{j=1}^{n}(-1)^{i+j}a_{ij}\\,M_{ij}', note: 'Rozvoj podle $i$-tého řádku. $M_{ij}$ je subdeterminant po vynechání řádku $i$ a sloupce $j$. Vyplatí se rozvíjet podle řádku s nejvíce nulami.' },
      { tex: 'A_{ij}=(-1)^{i+j}M_{ij}', note: 'Algebraický doplněk.' },
      { tex: '\\operatorname{adj}A=(A_{ij})^{T}', note: 'Adjungovaná matice: matice doplňků, transponovaná.' },
      { tex: 'A^{-1}=\\dfrac{1}{\\det A}\\operatorname{adj}A,\\qquad \\det A\\ne0', note: 'Inverzní matice pomocí adjungované.' },
      { tex: '\\det(AB)=\\det A\\cdot\\det B,\\qquad \\det A^{T}=\\det A', note: 'Základní vlastnosti determinantu.' },
      { tex: 'x_i=\\dfrac{\\det A_i}{\\det A}', note: 'Cramerovo pravidlo: $A_i$ vznikne z $A$ nahrazením $i$-tého sloupce pravou stranou. Platí pro $\\det A\\ne0$.' },
    ],
  },
  {
    id: 'soustavy', topic: 'soustavy', title: 'Soustavy lineárních rovnic',
    items: [
      { tex: 'h(A)=h(A\\,|\\,\\mathbf b)\\iff\\text{soustava má řešení}', note: 'Frobeniova věta.' },
      { tex: 'h(A)=h(A\\,|\\,\\mathbf b)=n\\ \\Rightarrow\\ \\text{právě jedno řešení}', note: '$n$ je počet neznámých.' },
      { tex: 'h(A)=h(A\\,|\\,\\mathbf b)=h<n\\ \\Rightarrow\\ \\text{nekonečně mnoho řešení}', note: 'Volíme $n-h$ parametrů.' },
      { tex: 'h(A)<h(A\\,|\\,\\mathbf b)\\ \\Rightarrow\\ \\text{žádné řešení}', note: 'Soustava je sporná.' },
      { tex: 'A\\mathbf x=\\mathbf o\\ \\text{má vždy řešení } \\mathbf x=\\mathbf o', note: 'Homogenní soustava. Nenulové řešení má právě když $h(A)<n$.' },
    ],
  },
  {
    id: 'funkce', topic: 'funkce', title: 'Funkce a její vlastnosti',
    items: [
      { tex: 'f(-x)=f(x)\\ \\text{(sudá)},\\qquad f(-x)=-f(x)\\ \\text{(lichá)}', note: 'Parita. Definiční obor musí být souměrný podle nuly; graf sudé funkce je souměrný podle osy $y$, liché podle počátku.' },
      { tex: 'f(x+p)=f(x)', note: 'Periodická funkce s periodou $p$.' },
      { tex: 'f^{-1}(f(x))=x,\\qquad f(f^{-1}(y))=y', note: 'Inverzní funkce existuje jen pro prostou funkci. Postup: zamění se $x$ a $y$ a vyjádří se $y$.' },
      { tex: 'D(f^{-1})=H(f),\\qquad H(f^{-1})=D(f)', note: 'Grafy $f$ a $f^{-1}$ jsou souměrné podle přímky $y=x$.' },
      { tex: '\\dfrac{A}{B}:\\ B\\ne0,\\qquad \\sqrt{A}:\\ A\\ge0', note: 'Definiční obor: jmenovatel nesmí být nula, pod sudou odmocninou nesmí být záporné číslo.' },
      { tex: '\\ln A:\\ A>0,\\qquad \\log_a A:\\ A>0', note: 'Definiční obor: argument logaritmu musí být kladný.' },
      { tex: '\\operatorname{tg}A:\\ A\\ne\\tfrac{\\pi}{2}+k\\pi', note: 'Definiční obor tangenty.' },
      { tex: '(f\\circ g)(x)=f(g(x))', note: 'Složená funkce: nejdřív se použije vnitřní $g$.' },
    ],
  },
  {
    id: 'limita', topic: 'limita', title: 'Limita funkce',
    items: [
      { tex: '\\lim_{x\\to a}\\bigl(f\\pm g\\bigr)=\\lim f\\pm\\lim g,\\quad \\lim (f\\cdot g)=\\lim f\\cdot\\lim g,\\quad \\lim\\dfrac fg=\\dfrac{\\lim f}{\\lim g}', note: 'Limity počítáme po částech, pokud jednotlivé limity existují (u podílu je limita jmenovatele nenulová).' },
      { tex: '\\lim_{x\\to\\infty}\\dfrac1x=0,\\qquad \\lim_{x\\to0^+}\\dfrac1x=+\\infty,\\qquad \\lim_{x\\to0^-}\\dfrac1x=-\\infty', note: 'Základní limity s nekonečnem; u $1/x$ v nule se liší jednostranné limity.' },
      { tex: '\\lim_{x\\to\\infty}\\dfrac{a_nx^n+\\dots+a_0}{b_mx^m+\\dots+b_0}=\\begin{cases}0&n<m\\\\ a_n/b_m&n=m\\\\ \\pm\\infty&n>m\\end{cases}', note: 'Limita podílu polynomů v nekonečnu rozhoduje nejvyšší mocnina.' },
      { tex: '\\infty+\\infty=\\infty,\\quad \\infty\\cdot\\infty=\\infty,\\quad \\dfrac{c}{\\pm\\infty}=0', note: 'Počítání s nekonečnem. Neurčité výrazy jsou $\\infty-\\infty$, $0\\cdot\\infty$, $\\tfrac00$, $\\tfrac\\infty\\infty$, $1^\\infty$.' },
      { tex: '\\lim_{x\\to0}\\dfrac{\\sin x}{x}=1,\\qquad \\lim_{x\\to0}\\dfrac{\\operatorname{tg}x}{x}=1', note: 'Goniometrické limity.' },
      { tex: '\\lim_{x\\to0}\\dfrac{1-\\cos x}{x^2}=\\dfrac12', note: 'Užitečné při úpravách s kosinem.' },
      { tex: '\\lim_{x\\to\\pm\\infty}\\Bigl(1+\\dfrac1x\\Bigr)^{x}=e,\\qquad \\lim_{x\\to0}(1+x)^{1/x}=e', note: 'Limita s Eulerovým číslem.' },
      { tex: '\\lim_{x\\to0}\\dfrac{e^x-1}{x}=1,\\qquad \\lim_{x\\to0}\\dfrac{\\ln(1+x)}{x}=1', note: 'Další základní limity.' },
    ],
  },
  {
    id: 'derivace', topic: 'derivace', title: "Derivace, l'Hospital, průběh funkce",
    items: [
      { tex: "c'=0,\\quad (x^n)'=nx^{n-1},\\quad (\\sqrt x)'=\\dfrac{1}{2\\sqrt x},\\quad \\Bigl(\\dfrac1x\\Bigr)'=-\\dfrac1{x^2}", note: 'Tabulka derivací: konstanta a mocniny.' },
      { tex: "(e^x)'=e^x,\\quad (a^x)'=a^x\\ln a,\\quad (\\ln x)'=\\dfrac1x,\\quad (\\log_a x)'=\\dfrac1{x\\ln a}", note: 'Tabulka derivací: exponenciála a logaritmus.' },
      { tex: "(\\sin x)'=\\cos x,\\quad (\\cos x)'=-\\sin x,\\quad (\\operatorname{tg}x)'=\\dfrac1{\\cos^2x}", note: 'Tabulka derivací: goniometrické funkce.' },
      { tex: "(\\operatorname{arctg}x)'=\\dfrac1{1+x^2},\\quad (\\arcsin x)'=\\dfrac1{\\sqrt{1-x^2}}", note: 'Tabulka derivací: cyklometrické funkce.' },
      { tex: "(f\\pm g)'=f'\\pm g',\\quad (cf)'=cf',\\quad (fg)'=f'g+fg'", note: 'Pravidla derivování: součet, násobek, součin.' },
      { tex: "\\Bigl(\\dfrac fg\\Bigr)'=\\dfrac{f'g-fg'}{g^2},\\qquad h(x)=f(g(x)),\\ h'(x)=f'(g(x))\\cdot g'(x)", note: 'Pravidla derivování: podíl a složená funkce (vnější funkce $f$, vnitřní funkce $g$).' },
      { tex: "(u^v)'=u^v\\Bigl(v'\\ln u+v\\dfrac{u'}{u}\\Bigr)", note: 'Logaritmická derivace: nejdřív zlogaritmujeme obě strany.' },
      { tex: "\\lim_{x\\to a}\\dfrac{f(x)}{g(x)}=\\lim_{x\\to a}\\dfrac{f'(x)}{g'(x)}", note: "l'Hospitalovo pravidlo: jen pro tvar $\\tfrac00$ nebo $\\tfrac\\infty\\infty$; derivujeme zvlášť čitatel a jmenovatel (ne podíl)." },
      { tex: "y-f(x_0)=f'(x_0)\\,(x-x_0)", note: "Tečna ke grafu v bodě $x_0$. Směrnice je $f'(x_0)$." },
      { tex: "y-f(x_0)=-\\dfrac{1}{f'(x_0)}(x-x_0)", note: "Normála (kolmice k tečně), pro $f'(x_0)\\ne0$." },
    ],
  },
  {
    id: 'prubeh', topic: 'derivace', title: 'Průběh funkce',
    items: [
      { tex: "D(f)\\to\\text{parita}\\to\\text{průsečíky}\\to f'\\to f''\\to\\text{asymptoty}\\to\\text{graf}", note: 'Postup: definiční obor, parita, průsečíky s osami, první a druhá derivace, asymptoty, náčrt grafu.' },
      { tex: "f'>0\\Rightarrow f\\ \\text{roste},\\qquad f'<0\\Rightarrow f\\ \\text{klesá}", note: "První derivace určuje monotonii. Lokální extrém je tam, kde $f'$ mění znaménko." },
      { tex: "f'(x_0)=0,\\ f''(x_0)>0\\Rightarrow\\text{minimum},\\qquad f''(x_0)<0\\Rightarrow\\text{maximum}", note: 'Lokální extrém pomocí druhé derivace.' },
      { tex: "f''>0\\Rightarrow f\\ \\text{konvexní},\\qquad f''<0\\Rightarrow f\\ \\text{konkávní}", note: "Druhá derivace určuje konvexnost. Inflexní bod je tam, kde $f''$ mění znaménko." },
      { tex: '\\lim_{x\\to a^\\pm}f(x)=\\pm\\infty\\ \\Rightarrow\\ x=a\\ \\text{je svislá asymptota}', note: 'Svislé asymptoty hledáme v bodech, kde funkce není definovaná.' },
      { tex: 'k=\\lim_{x\\to\\pm\\infty}\\dfrac{f(x)}{x},\\qquad q=\\lim_{x\\to\\pm\\infty}\\bigl(f(x)-kx\\bigr)', note: 'Asymptota se směrnicí $y=kx+q$. Počítá se zvlášť pro $+\\infty$ a $-\\infty$; $k$ i $q$ musí být konečná čísla.' },
    ],
  },
  {
    id: 'algebra', topic: null, title: 'Algebraické vzorce',
    items: [
      { tex: '(a\\pm b)^2=a^2\\pm2ab+b^2', note: 'Druhá mocnina dvojčlenu.' },
      { tex: 'a^2-b^2=(a-b)(a+b)', note: 'Rozdíl čtverců.' },
      { tex: 'a^3\\pm b^3=(a\\pm b)(a^2\\mp ab+b^2)', note: 'Součet a rozdíl třetích mocnin.' },
      { tex: '(a\\pm b)^3=a^3\\pm3a^2b+3ab^2\\pm b^3', note: 'Třetí mocnina dvojčlenu.' },
      { tex: 'ax^2+bx+c=0\\ \\Rightarrow\\ x_{1,2}=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}', note: 'Kvadratická rovnice; znaménko diskriminantu $D=b^2-4ac$ rozhoduje o počtu reálných kořenů.' },
      { tex: 'a^{m}a^{n}=a^{m+n},\\quad \\dfrac{a^m}{a^n}=a^{m-n},\\quad (a^m)^n=a^{mn},\\quad a^{-n}=\\dfrac1{a^n},\\quad a^{1/n}=\\sqrt[n]{a}', note: 'Počítání s mocninami.' },
      { tex: '\\ln(ab)=\\ln a+\\ln b,\\quad \\ln\\dfrac ab=\\ln a-\\ln b,\\quad \\ln a^r=r\\ln a,\\quad \\log_a b=\\dfrac{\\ln b}{\\ln a}', note: 'Počítání s logaritmy ($a,b>0$).' },
      { tex: '|x|<a\\iff-a<x<a,\\qquad |x|>a\\iff x<-a\\ \\vee\\ x>a', note: 'Nerovnice s absolutní hodnotou ($a>0$).' },
    ],
  },
  {
    id: 'goniometrie', topic: null, title: 'Goniometrické vzorce',
    items: [
      { tex: '\\sin^2x+\\cos^2x=1', note: 'Základní vztah.' },
      { tex: '\\operatorname{tg}x=\\dfrac{\\sin x}{\\cos x},\\qquad \\operatorname{cotg}x=\\dfrac{\\cos x}{\\sin x}', note: 'Tangens a kotangens.' },
      { tex: '\\sin2x=2\\sin x\\cos x,\\qquad \\cos2x=\\cos^2x-\\sin^2x=1-2\\sin^2x', note: 'Dvojnásobný argument.' },
      { tex: '\\sin(x\\pm y)=\\sin x\\cos y\\pm\\cos x\\sin y', note: 'Součtový vzorec pro sinus.' },
      { tex: '\\cos(x\\pm y)=\\cos x\\cos y\\mp\\sin x\\sin y', note: 'Součtový vzorec pro kosinus.' },
      { tex: '\\sin^2x=\\dfrac{1-\\cos2x}{2},\\qquad \\cos^2x=\\dfrac{1+\\cos2x}{2}', note: 'Snížení mocniny.' },
      { tex: '\\sin(-x)=-\\sin x,\\quad \\cos(-x)=\\cos x,\\quad \\sin(x+2\\pi)=\\sin x', note: 'Parita a periodicita.' },
      { tex: '\\begin{array}{c|ccccc}x&0&\\tfrac\\pi6&\\tfrac\\pi4&\\tfrac\\pi3&\\tfrac\\pi2\\\\\\hline\\sin x&0&\\tfrac12&\\tfrac{\\sqrt2}2&\\tfrac{\\sqrt3}2&1\\\\\\cos x&1&\\tfrac{\\sqrt3}2&\\tfrac{\\sqrt2}2&\\tfrac12&0\\end{array}', note: 'Hodnoty pro základní úhly.' },
    ],
  },
];

// Bez diakritiky a velikosti písmen.
function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
// Poznámka bez značek $ a TeXových příkazů.
function plain(s) { return norm(String(s ?? '').replace(/\$/g, '').replace(/\\[a-zA-Z]+/g, ' ')); }

// Čistá funkce: skupiny, jejichž název odpovídá dotazu, zůstanou celé; jinak jen položky,
// jejichž poznámka dotaz obsahuje. Prázdný dotaz vrátí vše. Vstup se nemění.
export function filterGroups(groups, query) {
  const q = norm(query).trim();
  if (!q) return groups.slice();
  const out = [];
  for (const g of groups) {
    if (norm(g.title).includes(q)) { out.push(g); continue; }
    const items = g.items.filter((f) => plain(f.note).includes(q));
    if (items.length) out.push({ ...g, items });
  }
  return out;
}
