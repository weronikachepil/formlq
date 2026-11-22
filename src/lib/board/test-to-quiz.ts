// Turns a test from «Мої тести» (or the platform's tests) into board quiz questions.
import type { ImportedTest } from "./engine/board";
import type { QuizOption, QuizQuestion } from "./engine/types";
import type { TestDoc, TestQuestion } from "@/lib/tests";

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Є", "Ж"];

/** Board cards render inline `$…$` only: `$$…$$` blocks become inline formulas. */
const text = (s: string | undefined) => (s ?? "").replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => `$${m.trim()}$`).trim();

/**
 * Options keep their letter when it is one (А, Б…); otherwise they are lettered by position.
 * Returns the options and a map from the original id to the board letter.
 */
function letter(items: { id: string; text: string; imageUrl?: string }[]): [QuizOption[], Map<string, string>] {
  const ids = new Map<string, string>();
  const valid = items.every((x) => LETTERS.includes(x.id)) && new Set(items.map((x) => x.id)).size === items.length;
  const opts = items.map((x, i) => {
    const l = valid ? x.id : (LETTERS[i] ?? String(i + 1));
    ids.set(x.id, l);
    // Board options have no picture: an option that is only an image shows a note instead.
    return { l, t: text(x.text) || (x.imageUrl ? "(зображення)" : "") };
  });
  return [opts, ids];
}

function convert(q: TestQuestion, n: number): QuizQuestion {
  const base = { n, pts: q.points || 1, text: text(q.text), img: q.imageUrl ?? "", expl: text(q.explanation), explImg: q.explanationImageUrl ?? "" };
  if (q.type === "mcq") {
    const [opts, ids] = letter(q.options);
    return { ...base, qt: "choice", opts, left: [], right: [], key: { correct: ids.get(q.correctOptionId) ?? "" } };
  }
  if (q.type === "open") {
    return { ...base, qt: "short", opts: [], left: [], right: [], key: { answer: q.correctAnswer.trim() } };
  }
  // The board's cards know only choice / short / match: several correct options and ordering
  // become a short answer typed as numbers, with the options listed in the text.
  // Numbers, not letters: the board's answer field opens a numeric keypad on tablets.
  if (q.type === "multi") {
    const right = new Set(q.correctOptionIds);
    const list = q.options.map((o, k) => `${k + 1}) ${text(o.text) || (o.imageUrl ? "(зображення)" : "")}`).join("\n");
    const answer = q.options.flatMap((o, k) => (right.has(o.id) ? [k + 1] : [])).join("");
    return {
      ...base,
      text: `${base.text}\n${list}\n(Впишіть номери всіх правильних варіантів підряд, за зростанням, напр. 13)`,
      qt: "short",
      opts: [],
      left: [],
      right: [],
      key: { answer },
    };
  }
  if (q.type === "order") {
    // Shown shuffled (by a fixed rule, so every board shows the same), numbered 1…n.
    const shown = [...q.items].map((it, i) => ({ it, i })).sort((x, y) => ((x.i * 7 + 3) % 11) - ((y.i * 7 + 3) % 11));
    const num = new Map(shown.map((x, k) => [x.it.id, k + 1]));
    const list = shown.map((x, k) => `${k + 1}) ${text(x.it.text)}`).join("\n");
    return {
      ...base,
      text: `${base.text}\n${list}\n(Впишіть номери в правильному порядку підряд, напр. 3142)`,
      qt: "short",
      opts: [],
      left: [],
      right: [],
      key: { answer: q.items.map((it) => num.get(it.id)).join("") },
    };
  }
  const [right, ids] = letter(q.rightOptions);
  const pairs: Record<string, string> = {};
  const left = q.leftItems.map((x, i) => {
    const num = i + 1;
    const r = ids.get(q.correctPairs[x.id]);
    if (r) pairs[num] = r;
    return { n: num, t: text(x.text) };
  });
  return { ...base, qt: "match", opts: [], left, right, key: { pairs } };
}

/** A ready test as the board's import input: questions in order, images kept as URLs. */
export function testToBoard(t: TestDoc): ImportedTest {
  const qs = [...(t.questions ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const questions = qs.map((q, i) => convert(q, i + 1));
  // importTest resolves image names through this map; here the "names" are already URLs.
  const images = new Map<string, string>();
  for (const q of questions) for (const u of [q.img, q.explImg]) if (u) images.set(u, u);
  return { title: t.title || "Тест", questions, images };
}
