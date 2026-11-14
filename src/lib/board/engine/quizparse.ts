// Parses a test from the plain-text format (produced by an AI from the import window prompt).
import type { QuizQuestion, QuizQuestionType } from "./types";

export interface ParsedTest {
  questions: QuizQuestion[];
  /** Image file names referenced by the test. */
  images: string[];
  errors: string[];
  warnings: string[];
}

export const TYPE_NAMES: Record<QuizQuestionType, string> = {
  choice: "Вибір відповіді",
  match: "Відповідність",
  short: "Вписати відповідь",
};
const DEFAULT_POINTS: Record<QuizQuestionType, number> = { choice: 1, match: 3, short: 2 };
const CYR = ["А", "Б", "В", "Г", "Д", "Е"];
// Positional: A→А, B→Б …
const LAT: Record<string, string> = { A: "А", B: "Б", C: "В", D: "Г", E: "Д", F: "Е" };

// Option letter: Latin maps by position, Cyrillic is kept.
function letter(ch: string | null | undefined): string {
  const c = String(ch || "").trim().toUpperCase().replace(/[.)]/g, "");
  if (CYR.includes(c)) return c;
  if (Object.prototype.hasOwnProperty.call(LAT, c)) return LAT[c];
  return "";
}

const LABELS = [
  "ЗОБРАЖЕННЯ ДО ПОЯСНЕННЯ", "ЗОБРАЖЕННЯ", "ТЕКСТ", "ПРАВИЛЬНА ВІДПОВІДЬ", "ПРАВИЛЬНІ ПАРИ", "ПРАВИЛЬНА",
  "ПОЯСНЕННЯ", "ЛІВА КОЛОНКА", "ПРАВА КОЛОНКА",
];
const LABEL_RE = new RegExp(`^\\s*(${LABELS.join("|")})\\s*:\\s*(.*)$`, "i");
const HEADER_RE = /^\s*###\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([\d.,]+)\s*$/;
const OPT_RE = /^\s*([А-ЕA-F])\s*[).]\s*(.*)$/i;
const LEFT_RE = /^\s*(\d+)\s*[.)]\s*(.*)$/;

function typeOf(name: string): QuizQuestionType | null {
  const n = name.trim().toLowerCase();
  if (n.startsWith("вибір")) return "choice";
  if (n.startsWith("відповід")) return "match";
  if (n.startsWith("вписат")) return "short";
  return null;
}

interface Block {
  n: number;
  typeName: string;
  points: number;
  lines: string[];
}

/** A labelled field: label → multi-line value. */
interface Field {
  label: string;
  value: string[];
  /** Option letter (ВАРІАНТ). */
  letter?: string;
  /** Left item number or right item letter (ЛІВИЙ / ПРАВИЙ). */
  key?: string;
}

export function parseTest(source: string | null | undefined): ParsedTest {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = String(source || "").replace(/\r\n?/g, "\n").replace(/^```[a-z]*\n?|```\s*$/gim, "");
  const lines = text.split("\n");
  const preamble: string[] = [];
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const line of lines) {
    const h = line.match(HEADER_RE);
    if (h) {
      cur = { n: Number(h[1]), typeName: h[2], points: Number(h[3].replace(",", ".")), lines: [] };
      blocks.push(cur);
    } else if (cur) cur.lines.push(line);
    else preamble.push(line);
  }
  if (!blocks.length) {
    errors.push("Не знайдено жодного питання. Кожне має починатися з рядка «### 1 | Вибір відповіді | 1».");
    return { questions: [], images: [], errors, warnings };
  }

  const images = new Set<string>();
  for (const l of preamble) {
    const m = l.match(/([\w\-. ]+\.(?:png|jpe?g|gif|webp|svg))/i);
    if (m) images.add(m[1].trim());
  }

  const questions: QuizQuestion[] = [];
  for (const b of blocks) {
    const type = typeOf(b.typeName);
    const where = `Питання ${b.n}`;
    if (!type) { errors.push(`${where}: невідомий тип «${b.typeName}».`); continue; }
    const q: QuizQuestion = {
      n: b.n, qt: type, pts: Number.isFinite(b.points) && b.points > 0 ? b.points : DEFAULT_POINTS[type],
      text: "", img: "", opts: [], left: [], right: [], key: {}, expl: "", explImg: "",
    };

    const fields: Field[] = [];
    let f: Field | null = null;
    let section: string | null = null; // options / columns
    for (const raw of b.lines) {
      const lm = raw.match(LABEL_RE);
      if (lm) {
        const label = lm[1].toUpperCase();
        f = { label, value: [lm[2]] };
        fields.push(f);
        section = label === "ЛІВА КОЛОНКА" || label === "ПРАВА КОЛОНКА" ? label : null;
        continue;
      }
      const om = type === "choice" ? raw.match(OPT_RE) : null;
      if (om && fields.some((x) => x.label === "ТЕКСТ")) {
        f = { label: "ВАРІАНТ", letter: letter(om[1]), value: [om[2]] };
        if (!f.letter) warnings.push(`${where}: незрозуміла літера варіанта «${om[1]}».`);
        fields.push(f);
        section = null;
        continue;
      }
      if (type === "match" && section) {
        const m = section === "ЛІВА КОЛОНКА" ? raw.match(LEFT_RE) : raw.match(OPT_RE);
        if (m && (section === "ЛІВА КОЛОНКА" || /^[А-ЕA-F]$/i.test(m[1]))) {
          f = { label: section === "ЛІВА КОЛОНКА" ? "ЛІВИЙ" : "ПРАВИЙ", key: m[1], value: [m[2]] };
          fields.push(f);
          continue;
        }
      }
      if (f) f.value.push(raw);
    }
    const val = (f2: Field) => f2.value.join("\n").trim();
    const get = (label: string) => fields.find((x) => x.label === label);

    const textField = get("ТЕКСТ");
    q.text = textField ? val(textField) : "";
    if (!q.text) errors.push(`${where}: немає поля ТЕКСТ.`);
    const imgField = get("ЗОБРАЖЕННЯ");
    if (imgField) { q.img = val(imgField); images.add(q.img); }
    const explImgField = get("ЗОБРАЖЕННЯ ДО ПОЯСНЕННЯ");
    if (explImgField) { q.explImg = val(explImgField); images.add(q.explImg); }
    const explField = get("ПОЯСНЕННЯ");
    q.expl = explField ? val(explField) : "";
    if (!q.expl) warnings.push(`${where}: немає пояснення.`);

    if (type === "choice") {
      q.opts = fields.filter((x) => x.label === "ВАРІАНТ" && x.letter).map((x) => ({ l: x.letter ?? "", t: val(x) }));
      if (q.opts.length < 2) errors.push(`${where}: потрібно щонайменше 2 варіанти (А), Б)…).`);
      const c = get("ПРАВИЛЬНА");
      const L = c ? letter(val(c).slice(0, 3)) : "";
      if (!L) errors.push(`${where}: не вказано ПРАВИЛЬНА відповідь.`);
      else if (!q.opts.some((o) => o.l === L)) errors.push(`${where}: правильна відповідь ${L} відсутня серед варіантів.`);
      q.key = { correct: L };
    } else if (type === "match") {
      q.left = fields.filter((x) => x.label === "ЛІВИЙ").map((x) => ({ n: Number(x.key), t: val(x) }));
      q.right = fields.filter((x) => x.label === "ПРАВИЙ").map((x) => ({ l: letter(x.key), t: val(x) })).filter((x) => x.l);
      if (q.left.length < 2) errors.push(`${where}: у лівій колонці має бути щонайменше 2 пункти.`);
      if (q.right.length < 2) errors.push(`${where}: у правій колонці має бути щонайменше 2 варіанти.`);
      const pf = get("ПРАВИЛЬНІ ПАРИ");
      const pairs: Record<string, string> = {};
      if (pf) for (const m of val(pf).matchAll(/(\d+)\s*[-–—=:]\s*([А-ЕA-F])/gi)) pairs[Number(m[1])] = letter(m[2]);
      for (const l of q.left) {
        if (!pairs[l.n]) errors.push(`${where}: немає правильної пари для пункту ${l.n}.`);
        else if (!q.right.some((r) => r.l === pairs[l.n])) errors.push(`${where}: пара ${l.n}-${pairs[l.n]} вказує на відсутній варіант.`);
      }
      q.key = { pairs };
    } else {
      const a = get("ПРАВИЛЬНА ВІДПОВІДЬ");
      const v = a ? val(a) : "";
      if (!v) errors.push(`${where}: немає ПРАВИЛЬНА ВІДПОВІДЬ.`);
      if (v && !/^[-−–+]?\s*\d+([.,]\d+)?$/.test(v.replace(/\s/g, ""))) warnings.push(`${where}: відповідь «${v}» не схожа на число; порівнюватиметься як текст.`);
      q.key = { answer: v.replace("−", "-").replace("–", "-") };
    }
    questions.push(q);
  }

  const nums = questions.map((q) => q.n);
  if (new Set(nums).size !== nums.length) warnings.push("Є питання з однаковими номерами.");
  return { questions, images: [...images], errors, warnings };
}
