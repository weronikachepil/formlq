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
