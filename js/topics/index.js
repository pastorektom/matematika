// Seznam témat v pořadí jako v Moodlu. Každé téma je modul js/topics/<id>.js
// s výchozím exportem { id, title, order, theory, types }. Vzorem je js/topics/vektory.js.
import vektory from './vektory.js';
import matice from './matice.js';
import determinant from './determinant.js';
import soustavy from './soustavy.js';
import funkce from './funkce.js';
import limita from './limita.js';
import derivace from './derivace.js';

export const topics = [vektory, matice, determinant, soustavy, funkce, limita, derivace];
export default topics;

export function sortTopics(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
