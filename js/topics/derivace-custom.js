// „Derivace libovolné funkce“ pro stránku Vlastní příklad: student zadá f(x) (součet, součin, podíl,
// složená funkce, sin, cos, tg, ln, e^x, odmocnina, arcsin, arctg …) a dostane derivaci s postupem
// krok za krokem. Výpočet je v js/derive-steps.js.
import { deriveWithSteps, previewTex } from '../derive-steps.js';

const HINT = 'Např. x^2*sin(x), e^x*cos(x), ln(x)/x, sqrt(1+x^2)';

export const derivAnyType = {
  id: 'libovolna',
  title: 'Derivace libovolné funkce',
  solve(data) {
    const r = deriveWithSteps(data.f);
    return {
      id: `derivace-libovolna-${String(data.f).replace(/[^0-9a-z]+/gi, '.')}`,
      topic: 'derivace',
      type: 'libovolna',
      data,
      task: 'Urči derivaci $f\'(x)$ zadané funkce.',
      promptTex: `f(x)=${r.fTex}`,
      hint: HINT,
      answerSpec: { kind: 'expression', value: r.answerExpr, variable: 'x' },
      answerTex: r.answerTex,
      solution: r.steps,
    };
  },
  custom: {
    keypad: 'function',
    fields: [{ id: 'expr', label: 'f(x) =', kind: 'expr', hint: HINT, tex: previewTex }],
    build: (v) => ({ f: String(v.expr ?? '') }),
  },
};
