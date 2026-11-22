// Static data for the board UI: palettes, tool menus, hints.
import type { ExerciseKind } from "@/lib/board/engine/exercises";

export const COLORS = ["#1d1b2e", "#e03131", "#e8590c", "#f08c00", "#2f9e44", "#1971c2", "#6d3df0", "#c2255c"];
export const WIDTHS = [2, 4, 7, 12, 20];
/** Spoken / tooltip names of the swatches: a colour is never told by its hex code alone. */
export const COLOR_NAMES: Record<string, string> = {
  "#1d1b2e": "Чорний", "#e03131": "Червоний", "#e8590c": "Помаранчевий", "#f08c00": "Жовтогарячий",
  "#2f9e44": "Зелений", "#1971c2": "Синій", "#6d3df0": "Фіолетовий", "#c2255c": "Малиновий",
  "#ffd43b": "Жовтий", "#94d82d": "Салатовий", "#ff8787": "Рожевий", "#ffa94d": "Помаранчевий",
  "#74c0fc": "Блакитний", "#da77f2": "Бузковий", "#63e6be": "Бірюзовий", "#ced4da": "Сірий", "#7048e8": "Фіолетовий",
};
export const colorName = (c: string) => COLOR_NAMES[c.toLowerCase()] || c;
export const HL_COLORS = ["#ffd43b", "#94d82d", "#ff8787", "#ffa94d", "#74c0fc", "#da77f2", "#63e6be", "#ced4da"];
export const HL_WIDTHS = [12, 24, 36, 52];

/** [tool id, label] or [tool id, label, description]. */
export type MenuEntry = readonly [id: string, label: string, desc?: string];

export const TRI_ITEMS: MenuEntry[] = [
  ["tri_scalene", "Різносторонній"],
  ["tri_eq", "Рівносторонній"],
  ["triangle", "Рівнобедрений"],
  ["rtriangle", "Прямокутний"],
  ["tri_obt", "Тупокутний"],
];
export const QUAD_ITEMS: MenuEntry[] = [
  ["q_square", "Квадрат"],
  ["q_rect", "Прямокутник"],
  ["q_rhombus", "Ромб"],
  ["q_para", "Паралелограм"],
  ["q_trap_iso", "Трапеція рівнобічна"],
  ["q_trap_right", "Трапеція прямокутна"],
  ["q_trap", "Трапеція"],
  ["q_quad", "Чотирикутник"],
];
export const SHAPE_ITEMS: MenuEntry[] = [
  ["line", "Відрізок"],
  ["arrow", "Вектор"],
  ["ellipse", "Коло, еліпс"],
  ["rect", "Рамка"],
  ["pentagon", "П'ятикутник"],
  ["hexagon", "Шестикутник"],
  ["polygon", "Многокутник"],
  ["angle", "Кут"],
];
export const PT_ITEMS: MenuEntry[] = [
  ["dot", "Точка"],
  ["odot", "Порожня точка"],
  ["arrow2", "Подвійна стрілка"],
];
export const BR_ITEMS: MenuEntry[] = [
  ["brace", "Всього"],
  ["curvearr", "Порівняння"],
  ["cornerarr", "Ніж"],
  ["bracket", "Скоба"],
];
export const CONSTR_ITEMS: MenuEntry[] = [
  ["midpt", "Середина відрізка", "Торкніться двох кінців відрізка"],
  ["bisect", "Бісектриса кута", "Торкніться: точка, вершина, точка"],
  ["circ3", "Коло через три точки", "Торкніться трьох точок"],
  ["circum", "Описане коло", "Торкніться трикутника"],
  ["incirc", "Вписане коло", "Торкніться трикутника"],
];
export const VECTOR_ITEMS: MenuEntry[] = [
  ["vcopy", "Відкласти вектор від точки", "Торкніться вектора, потім точки"],
  ["vsum_t", "Сума векторів: правило трикутника", "Торкніться двох векторів"],
  ["vsum_p", "Сума векторів: правило паралелограма", "Обидва вектори — зі спільного початку"],
  ["vdiff", "Різниця векторів", "Торкніться зменшуваного, потім від'ємника"],
  ["vscale", "Вектор × число", "Торкніться вектора, далі число"],
];
export const MARK_ITEMS: MenuEntry[] = [
  ["eqs1", "Рівні відрізки: 1 риска", "Торкніться відрізка чи сторони"],
  ["eqs2", "Рівні відрізки: 2 риски", "Торкніться відрізка чи сторони"],
  ["eqs3", "Рівні відрізки: 3 риски", "Торкніться відрізка чи сторони"],
  ["par1", "Паралельні: 1 стрілочка", "Торкніться відрізка чи сторони"],
  ["par2", "Паралельні: 2 стрілочки", "Торкніться відрізка чи сторони"],
  ["eqa1", "Рівні кути: 1 дуга", "Торкніться: точка, вершина, точка"],
  ["eqa2", "Рівні кути: 2 дуги", "Торкніться: точка, вершина, точка"],
  ["rang", "Прямий кут", "Торкніться: точка, вершина, точка"],
];

/** «Фігури» menu tabs: id, tab name, and its groups (a title is shown only when a tab has several). */
export const SHAPE_TABS: [id: string, name: string, groups: [title: string, items: MenuEntry[]][]][] = [
  ["basic", "Основні", [["", SHAPE_ITEMS]]],
  ["tri", "Трикутники", [["", TRI_ITEMS]]],
  ["quad", "Чотирикутники", [["", QUAD_ITEMS]]],
  [
    "marks",
    "Стрілки",
    [
      ["Точки й стрілки", PT_ITEMS],
      ["Дужки", BR_ITEMS],
    ],
  ],
];

/** Tools that draw a shape (the "Фігури" button shows the active one). */
export const SHAPE_TOOLS = new Set<string>(
  [...SHAPE_ITEMS, ...TRI_ITEMS, ...QUAD_ITEMS, ...PT_ITEMS, ...BR_ITEMS, ...MARK_ITEMS].map((s) => s[0]),
);

export const GRAPH_ICONS: Record<string, string> = {
  plane: "g_plane",
  line: "g_line",
  parabola: "g_parab",
  hyper: "g_hyper",
  sin: "g_sin",
  exp: "g_exp",
  circle: "g_circle",
  system: "g_system",
  ineq: "g_ineq",
};
export const GRAPH_DESC: Record<string, string> = {
  plane: "Порожні осі для власних побудов",
  line: "Повзунки k та b",
  parabola: "Повзунки a, b, c",
  hyper: "Повзунок k",
  sin: "Амплітуда, частота, зсув",
  exp: "Основа a",
  circle: "Повзунок радіуса r",
  system: "Дві прямі та точка перетину",
  ineq: "Заштрихована область",
};
export const SOLID_DESC: Record<string, string> = {
  cube: "Усі ребра рівні",
  cuboid: "Три різні виміри",
  prism: "Правильна, з перерізами",
  pyramid: "Основа та вершина",
  cylinder: "Два круги та твірна",
  cone: "Круг та вершина",
  sphere: "Центр і радіус",
};

export type SourceKind = "bar" | "pie" | "hist" | "tree";

/** [title, hint, example] for the chart / probability-tree data dialog. */
export const CHART_EXAMPLES: Record<SourceKind, [string, string, string]> = {
  bar: ["Стовпчаста діаграма", "Кожен рядок: назва і число.", "Січень 12\nЛютий 8\nБерезень 15\nКвітень 10"],
  pie: ["Кругова діаграма", "Кожен рядок: назва і число. Відсотки порахуються самі.", "Футбол 12\nШахи 5\nМалювання 8\nМузика 7"],
  hist: [
    "Гістограма",
    "Числа вибірки через пробіл або з нового рядка. Інтервали й частоти порахуються самі.",
    "4 7 5 7 9 6 8 7 5 6 10 7 8 4 6 9 7 5 8 6",
  ],
  tree: [
    "Дерево ймовірностей",
    "Кожен рівень — окремий блок, блоки розділяйте порожнім рядком. Рядок: назва і ймовірність (0,4 або 2/5 або 40%). Без числа — ймовірності рівні.",
    "Ч 0,4\nБ 0,6\n\nЧ 0,5\nБ 0,5",
  ],
};

export const EX_KINDS: [ExerciseKind, string][] = [
  ["+", "Додавання"],
  ["−", "Віднімання"],
  ["×", "Множення"],
  ["÷", "Ділення"],
  ["frac", "Дроби"],
  ["eq", "Рівняння"],
];

export const GRID_NAMES = { squares: "клітинка", dots: "крапки", none: "немає" } as const;

/** Decimal comma for numbers shown to the user. */
export const uaNum = (v: number | string) => String(v).replace(".", ",");
