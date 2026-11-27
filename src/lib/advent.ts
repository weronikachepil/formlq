/**
 * «Відлік до НМТ» — the December advent calendar at /advent.
 *
 * 24 NMT-style problems, one per day (1–24 December, Kyiv time). Every answer is a number,
 * like the open-answer part of НМТ. Each solved day reveals one letter of PHRASE; all 24
 * letters together are the reward phrase shown on the final screen.
 *
 * Difficulty grows by week (★ → ★★ → ★★★); weekends (5–6, 12–13, 19–20 Dec 2026) are a
 * small game instead of a problem, and 6 December is also the St. Nicholas gift day.
 */

export const ADVENT_YEAR = 2026;
export const ADVENT_DAYS = 24;

/** Share of the calendar's revenue donated to the Armed Forces of Ukraine (shown on the page and buy cards). */
export const ZSU_SHARE = 20;

/** 24 letters, one per day. Spaces only group the reveal into words. */
/** «Веселого Різдва, вдачі на НМТ» — the calendar ends on Святвечір. */
export const PHRASE = "ВЕСЕЛОГО РІЗДВА ВДАЧІ НА НМТ";
export const PHRASE_LETTERS = PHRASE.replace(/ /g, "");

/**
 * The gift for all 24 windows: NMT imitations from formlq.
 *
 * The tests stay out of the catalog (unpublished) with link access «students», so they
 * open only from this gift; a student takes one at /dashboard/exam/<id> and the result
 * is saved. `anyone: true` (link access «anyone») links to /t/<id> instead: it opens without
 * an account too, and signed-in students are sent on to /dashboard/exam/<id>.
 * An empty id shows «Скоро». Source files of №1–3: docs/advent-imitations/.
 */
/** St. Nicholas gift (6 December): unlocked by winning that day's game. Served from /public. */
export const NICHOLAS_GIFT = {
  title: "Функції від А до Я",
  subtitle: "Різдвяний конспект formlq: теорія, 82 рисунки, 26 задач для практики й тренувальний тест у форматі НМТ",
  href: "/advent/funktsii-rizdvianyi-konspekt.pdf",
  fileName: "Функції від А до Я · різдвяний конспект formlq.pdf",
  meta: "PDF · 34 сторінки · 6 МБ",
};

export interface GiftTest { id: string; title: string; anyone?: boolean }
export const GIFT_TESTS: GiftTest[] = [
  { id: "RxxybsJNZwbN6nfqFYGI", title: "Імітація НМТ №1" },
  { id: "pPAaIP676uYALTVuoNcr", title: "Імітація НМТ №2" },
  { id: "uH8UVN2X5Qfqu80ERFku", title: "Імітація НМТ №3" },
  { id: "xLVdxeSkz8SHOMLfJKhu", title: "Імітація НМТ №4" },
  { id: "VDA7bP97ALXmA3xRgP9f", title: "Імітація НМТ №5" },
];

export type Level = 1 | 2 | 3;

interface DayBase {
  day: number;
  level: Level;
  /** Short topic label, e.g. «Відсотки». */
  topic: string;
  /** Problem text or game rules; `$…$` is rendered with KaTeX. */
  text: string;
  /** 6 December: the St. Nicholas gift. */
  gift?: boolean;
}

export interface ProblemDay extends DayBase {
  kind: "problem";
  /** The correct numeric answer. */
  answer: number;
  hint: string;
  solution: string;
}

/** Sundays: a small game instead of a problem. Winning it reveals the day's letter. */
export type GameId = "memory" | "snowballs" | "garland" | "snowman" | "tree" | "lake";
export interface GameDay extends DayBase {
  kind: "game";
  game: GameId;
}

export type AdventDay = ProblemDay | GameDay;

/**
 * «Ігротека»: bonus games outside the 24 windows. The first is open from the start (so the
 * page has something to play before 1 December); each next one unlocks after `unlockAt`
 * solved windows.
 */
export type BonusId = "sudoku" | "sleigh" | "lights" | "reindeer";
export interface Bonus { id: BonusId; title: string; text: string; unlockAt: number; icon: string }

export const BONUS: Bonus[] = [
  { id: "lights", title: "Вікна у Святвечір", icon: "candle", unlockAt: 0,
    text: "Засвіти всі вікна будинку. Торкання перемикає вікно і його сусідів." },
  { id: "sudoku", title: "Сніжне судоку", icon: "flake", unlockAt: 4,
    text: "Судоку 4×4: у кожному рядку, стовпці й квадраті 2×2 — числа від 1 до 4." },
  { id: "sleigh", title: "Сани Миколая", icon: "gift", unlockAt: 8,
    text: "Лови в сани лише подарунки з потрібними числами. Зайві перевантажують сани." },
  { id: "reindeer", title: "Шлях оленя", icon: "star", unlockAt: 12,
    text: "Доведи оленя від одного числа до іншого діями ×2, +3, ×10… за обмежену кількість ходів. Фінал — 2027." },
];

export const DAYS: AdventDay[] = [
  {
    kind: "problem",
    day: 1, level: 1, topic: "Відсотки",
    text: "Гірлянда коштувала 480 грн. На передсвятковому розпродажі її ціну знизили на 25 %. Скільки гривень коштує гірлянда зі знижкою?",
    answer: 360,
    hint: "25 % — це чверть ціни.",
    solution: "$480 \\cdot 0{,}75 = 360$ грн.",
  },
  {
    kind: "problem",
    day: 2, level: 1, topic: "Рівняння",
    text: "Розв'яжіть рівняння $3(x - 4) = x + 6$.",
    answer: 9,
    hint: "Розкрийте дужки й перенесіть $x$ в один бік.",
    solution: "$3x - 12 = x + 6 \\Rightarrow 2x = 18 \\Rightarrow x = 9$.",
  },
  {
    kind: "problem",
    day: 3, level: 1, topic: "Арифметична прогресія",
    text: "В арифметичній прогресії $a_1 = 5$, $d = 3$. Знайдіть $a_{10}$.",
    answer: 32,
    hint: "$a_n = a_1 + (n - 1)d$.",
    solution: "$a_{10} = 5 + 9 \\cdot 3 = 32$.",
  },
  {
    kind: "problem",
    day: 4, level: 1, topic: "Відношення",
    text: "У різдвяному подарунку цукерки й мандарини у відношенні $3 : 5$. Усього в подарунку 24 предмети. Скільки в ньому мандаринів?",
    answer: 15,
    hint: "Разом $3 + 5 = 8$ частин.",
    solution: "Одна частина: $24 : 8 = 3$. Мандаринів $5 \\cdot 3 = 15$.",
  },
  {
    kind: "game", game: "snowman",
    day: 5, level: 1, topic: "Гра «Сніговик»",
    text: "Відгадай математичний термін за підказкою. Кожна неправильна літера розтоплює частину сніговика — у тебе 6 спроб.",
  },
  {
    kind: "game", game: "memory", gift: true,
    day: 6, level: 1, topic: "Гра «Подарунки Миколая»",
    text: "Миколай сховав відповіді в подарунки. Відкривай по два й знаходь пари «вираз — його значення». Знайди всі 6 пар.",
  },
  {
    kind: "problem",
    day: 7, level: 1, topic: "Трикутник",
    text: "Ялинку на листівці намальовано як рівнобедрений трикутник з основою 10 см і бічною стороною 13 см. Знайдіть висоту, проведену до основи (у см).",
    answer: 12,
    hint: "Висота ділить основу навпіл. Далі — теорема Піфагора.",
    solution: "$h = \\sqrt{13^2 - 5^2} = \\sqrt{144} = 12$ см.",
  },
  {
    kind: "problem",
    day: 8, level: 2, topic: "Теорема Вієта",
    text: "Знайдіть суму квадратів коренів рівняння $x^2 - 5x + 3 = 0$.",
    answer: 19,
    hint: "$x_1^2 + x_2^2 = (x_1 + x_2)^2 - 2x_1x_2$.",
    solution: "$x_1 + x_2 = 5$, $x_1x_2 = 3$, отже $25 - 6 = 19$.",
  },
  {
    kind: "problem",
    day: 9, level: 2, topic: "Логарифми",
    text: "Обчисліть $\\log_2 48 - \\log_2 3$.",
    answer: 4,
    hint: "Різниця логарифмів — логарифм частки.",
    solution: "$\\log_2 \\dfrac{48}{3} = \\log_2 16 = 4$.",
  },
  {
    kind: "problem",
    day: 10, level: 2, topic: "Геометрична прогресія",
    text: "У геометричній прогресії $b_1 = 3$, $q = 2$. Знайдіть суму перших п'яти членів.",
    answer: 93,
    hint: "$S_n = b_1 \\cdot \\dfrac{q^n - 1}{q - 1}$.",
    solution: "$S_5 = 3 \\cdot \\dfrac{32 - 1}{1} = 93$.",
  },
  {
    kind: "problem",
    day: 11, level: 2, topic: "Ймовірність",
    text: "У коробці 20 ялинкових куль, 5 з них золоті. Навмання беруть одну кулю. Яка ймовірність, що вона золота? Відповідь запишіть десятковим дробом.",
    answer: 0.25,
    hint: "Сприятливі випадки поділіть на всі.",
    solution: "$P = \\dfrac{5}{20} = 0{,}25$.",
  },
  {
    kind: "game", game: "tree",
    day: 12, level: 2, topic: "Гра «Ялинка 2027»",
    text: "Вішай кулі на ялинку так, щоб сума чисел на них дорівнювала числу на зірці. Три ялинки — і остання на 2027.",
  },
  {
    kind: "game", game: "snowballs",
    day: 13, level: 1, topic: "Гра «Сніжинки»",
    text: "На кожній сніжинці приклад. Обери правильну відповідь, поки сніжинка не впала. Треба влучити 10 разів, помилитися можна двічі.",
  },
  {
    kind: "problem",
    day: 14, level: 2, topic: "Тригонометрія",
    text: "Обчисліть $8 \\sin 15^\\circ \\cos 15^\\circ$.",
    answer: 2,
    hint: "$2 \\sin \\alpha \\cos \\alpha = \\sin 2\\alpha$.",
    solution: "$4 \\cdot \\sin 30^\\circ = 4 \\cdot \\dfrac{1}{2} = 2$.",
  },
  {
    kind: "problem",
    day: 15, level: 3, topic: "Похідна",
    text: "Знайдіть найменше значення функції $f(x) = x^3 - 3x^2 + 5$ на відрізку $[1; 4]$.",
    answer: 1,
    hint: "Порівняйте значення в критичних точках усередині відрізка і на його кінцях.",
    solution: "$f'(x) = 3x^2 - 6x = 0 \\Rightarrow x = 0$ або $x = 2$; у відрізок потрапляє $x = 2$. $f(1) = 3$, $f(2) = 1$, $f(4) = 21$. Найменше — 1.",
  },
  {
    kind: "problem",
    day: 16, level: 3, topic: "Інтеграл",
    text: "Обчисліть $\\displaystyle\\int_0^2 (3x^2 + 2x)\\,dx$.",
    answer: 12,
    hint: "Первісна: $x^3 + x^2$.",
    solution: "$(x^3 + x^2)\\big|_0^2 = 8 + 4 = 12$.",
  },
  {
    kind: "problem",
    day: 17, level: 3, topic: "Стереометрія",
    text: "Ялинкова куля має радіус 3 см. Її об'єм дорівнює $V\\pi$ см³. Знайдіть $V$.",
    answer: 36,
    hint: "$V_{кулі} = \\dfrac{4}{3}\\pi R^3$.",
    solution: "$\\dfrac{4}{3} \\cdot 27 = 36$, тобто об'єм $36\\pi$ см³.",
  },
  {
    kind: "problem",
    day: 18, level: 3, topic: "Показникові рівняння",
    text: "Розв'яжіть рівняння $2^{x+3} - 2^x = 56$.",
    answer: 3,
    hint: "Винесіть $2^x$ за дужки.",
    solution: "$2^x(8 - 1) = 56 \\Rightarrow 2^x = 8 \\Rightarrow x = 3$.",
  },
  {
    kind: "game", game: "lake",
    day: 19, level: 2, topic: "Гра «Крига»",
    text: "Перейди замерзле озеро знизу догори. Ступати можна лише на крижини з простими числами і лише на сусідню (вгору, вниз, ліворуч чи праворуч). Складене число тріщить!",
  },
  {
    kind: "game", game: "garland",
    day: 20, level: 1, topic: "Гра «Гірлянда»",
    text: "Засвіти гірлянду: торкайся лампочок по черзі, від найменшого числа до найбільшого.",
  },
  {
    kind: "problem",
    day: 21, level: 3, topic: "Сніжинка Коха",
    text: "Сніжинку Коха будують з рівностороннього трикутника з периметром 27: на кожному кроці кожен відрізок ділять на три рівні частини й над середньою добудовують рівносторонній трикутник (а саму середню частину прибирають). Знайдіть периметр фігури після трьох кроків.",
    answer: 64,
    hint: "Як змінюється довжина одного відрізка за один крок?",
    solution: "Кожен відрізок перетворюється на 4 відрізки по $\\tfrac13$ довжини, тож периметр множиться на $\\tfrac43$: $27 \\cdot \\left(\\tfrac43\\right)^3 = 64$.",
  },
  {
    kind: "problem",
    day: 22, level: 3, topic: "Планіметрія",
    text: "У коло радіуса 5 вписано прямокутник, одна сторона якого дорівнює 6. Знайдіть площу прямокутника.",
    answer: 48,
    hint: "Діагональ вписаного прямокутника — діаметр кола.",
    solution: "Діагональ 10, друга сторона $\\sqrt{100 - 36} = 8$, площа $6 \\cdot 8 = 48$.",
  },
  {
    kind: "problem",
    day: 23, level: 3, topic: "Модуль",
    text: "Знайдіть суму всіх коренів рівняння $|x^2 - 4x| = 3$.",
    answer: 8,
    hint: "Розгляньте два рівняння: $x^2 - 4x = 3$ і $x^2 - 4x = -3$.",
    solution: "У кожного з двох рівнянь сума коренів 4 (за Вієта), обидва мають по два різні корені: $4 + 4 = 8$.",
  },
  {
    kind: "problem",
    day: 24, level: 2, topic: "Фінал",
    text: "Обчисліть $2027^2 - 2026^2$.",
    answer: 4053,
    hint: "Різниця квадратів.",
    solution: "$(2027 - 2026)(2027 + 2026) = 1 \\cdot 4053 = 4053$.",
  },
];

/** Parses «0,25», « 0.25 », «−3». Returns null when it isn't a number. */
export function parseAnswer(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "").replace(",", ".").replace(/[−–]/g, "-");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function isCorrect(problem: ProblemDay, value: number): boolean {
  return Math.abs(value - problem.answer) < 1e-9;
}

/** Today's date in Kyiv as { year, month (1–12), day }. */
export function kyivToday(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * How many days are open: 0 before 1 December, 24 from 24 December on.
 * Past days stay open, so anyone who missed a day can catch up.
 */
export function openedDays(now = new Date()): number {
  const t = kyivToday(now);
  if (t.year > ADVENT_YEAR) return ADVENT_DAYS;
  if (t.year < ADVENT_YEAR || t.month < 12) return 0;
  return Math.min(t.day, ADVENT_DAYS);
}

/** Days left until 1 December (Kyiv), for the pre-start countdown. */
export function daysUntilStart(now = new Date()): number {
  const t = kyivToday(now);
  const today = Date.UTC(t.year, t.month - 1, t.day);
  const start = Date.UTC(ADVENT_YEAR, 11, 1);
  return Math.max(0, Math.round((start - today) / 86_400_000));
}

/** Entry points to /advent (landing bar, cabinet card) show until Christmas holidays end: 7 Jan. */
export function adventPromoActive(now = new Date()): boolean {
  const t = kyivToday(now);
  if (t.year <= ADVENT_YEAR) return true;
  return t.year === ADVENT_YEAR + 1 && t.month === 1 && t.day <= 7;
}
