/**
 * «Різдвяна справа»: who hid the Christmas star? A whodunit across the adventure map —
 * every stop (lib/advent-map.ts) gives one clue, the player crosses out suspects on a board
 * and, once all twelve clues are found, names the culprit.
 *
 * Each clue has a `test`, so the puzzle can be checked: applying CLUES in order to SUSPECTS
 * narrows the field 12 → 11 → … → 2, only the eleventh clue leaves exactly one suspect, and
 * the culprit fits every clue. Re-check this whenever a suspect or a clue changes.
 */

export interface Suspect {
  id: string;
  emoji: string;
  name: string;
  /** Height, cm. */
  height: number;
  legs: number;
  /** Favourite number. */
  num: number;
  scarf: "червоний" | "синій" | "зелений" | "жовтий";
  /** Where they were at midnight. */
  place: string;
}

export const SUSPECTS: Suspect[] = [
  { id: "snowman", emoji: "☃️", name: "Сніговик Тимко", height: 180, legs: 0, num: 7, scarf: "червоний", place: "на подвір'ї" },
  { id: "deer", emoji: "🦌", name: "Олень Северин", height: 150, legs: 4, num: 12, scarf: "синій", place: "у лісі" },
  { id: "cat", emoji: "🐈", name: "Кіт Мурчик", height: 30, legs: 4, num: 9, scarf: "зелений", place: "на горищі" },
  { id: "gnome", emoji: "🧝", name: "Гном Остап", height: 60, legs: 2, num: 8, scarf: "червоний", place: "у майстерні" },
  { id: "owl", emoji: "🦉", name: "Сова Мудра", height: 40, legs: 2, num: 5, scarf: "синій", place: "на старому дубі" },
  { id: "penguin", emoji: "🐧", name: "Пінгвін Пиріжок", height: 70, legs: 2, num: 6, scarf: "зелений", place: "на ковзанці" },
  { id: "bear", emoji: "🐻", name: "Ведмідь Бурмило", height: 200, legs: 4, num: 10, scarf: "жовтий", place: "у барлозі" },
  { id: "squirrel", emoji: "🐿️", name: "Білка Шишка", height: 25, legs: 4, num: 16, scarf: "червоний", place: "у дуплі" },
  { id: "hedgehog", emoji: "🦔", name: "Їжак Колючка", height: 20, legs: 4, num: 4, scarf: "жовтий", place: "у нірці" },
  { id: "fox", emoji: "🦊", name: "Лисичка Руда", height: 50, legs: 4, num: 8, scarf: "синій", place: "біля пекарні" },
  { id: "hare", emoji: "🐇", name: "Заєць Стрибунець", height: 45, legs: 4, num: 2, scarf: "зелений", place: "у полі" },
  { id: "robot", emoji: "🤖", name: "Робот Біп", height: 90, legs: 0, num: 32, scarf: "червоний", place: "у майстерні" },
];

export const CULPRIT = "gnome";

const isPrime = (n: number) => n > 1 && [...Array(n).keys()].slice(2).every((d) => n % d !== 0);
const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
const maxH = Math.max(...SUSPECTS.map((s) => s.height));
const minH = Math.min(...SUSPECTS.map((s) => s.height));

export interface Clue {
  /** Stop number on the map (1–12). */
  n: number;
  text: string;
  /** Whether a suspect fits this clue. */
  test: (s: Suspect) => boolean;
}

export const CLUES: Clue[] = [
  { n: 1, text: "Злодій — не найвищий з усіх підозрюваних.", test: (s) => s.height < maxH },
  { n: 2, text: "Злодій — і не найнижчий.", test: (s) => s.height > minH },
  { n: 3, text: "Улюблене число злодія не є додатним розв'язком рівняння x² = 49.", test: (s) => s.num !== 7 },
  { n: 4, text: "Улюблене число злодія не є простим.", test: (s) => !isPrime(s.num) },
  { n: 5, text: "Шарф злодія не синій.", test: (s) => s.scarf !== "синій" },
  { n: 6, text: "Опівночі злодія не було на горищі.", test: (s) => s.place !== "на горищі" },
  { n: 7, text: "У злодія є ноги — на снігу знайшли сліди.", test: (s) => s.legs > 0 },
  { n: 8, text: "Сліди глибокі: зріст злодія більший за 30 см.", test: (s) => s.height > 30 },
  { n: 9, text: "Кількість ніг злодія — розв'язок рівняння 3x − 4 = 2.", test: (s) => 3 * s.legs - 4 === 2 },
  { n: 10, text: "Зріст злодія в сантиметрах ділиться на 10.", test: (s) => s.height % 10 === 0 },
  { n: 11, text: "Улюблене число злодія — натуральний степінь числа 2.", test: (s) => isPow2(s.num) && s.num > 1 },
  { n: 12, text: "На зірці лишилася червона ворсинка, а пахла вона мастилом для інструментів.", test: (s) => s.scarf === "червоний" && s.place === "у майстерні" },
];

export const CASE_INTRO =
  "Напередодні Святвечора з верхівки головної ялинки зникла Різдвяна зірка. Каченя-детектив вирушає мапою пригод: " +
  "кожен математик дає йому один доказ. Закреслюй підозрюваних, які не підходять, — і назви того, хто сховав зірку.";

export const CASE_ENDING =
  "Так, це Гном Остап! Він потай забрав зірку до майстерні, щоб відполірувати її до Святвечора — вона трохи потьмяніла. " +
  "Тепер зірка сяє на ялинці яскравіше, ніж будь-коли. Справу розкрито — з Різдвом!";
