// Exercise generator: random column arithmetic, fractions and linear equations.
import { makeColmath, colmathBox } from "./arith";
import { measureText } from "./shapes";
import type { ArithSign, ColmathObject, ObjectDraft, Point, TextObject } from "./types";

export type ExerciseKind = ArithSign | "frac" | "eq";

export interface ExerciseOptions {
  kind: ExerciseKind;
  /** Operand size in digits (column arithmetic). */
  digits?: number;
  /** Number of exercises, clamped to 1–12. */
  count?: number;
}

export type ExerciseObject = ObjectDraft<TextObject | ColmathObject>;

const rnd = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));
const nd = (d: number): number => rnd(10 ** (d - 1), 10 ** d - 1);

function columnPair(kind: ArithSign, d: number): [number, number] {
  if (kind === "+") return [nd(d), nd(Math.max(1, d - rnd(0, 1)))];
  if (kind === "−") { const a = nd(d), b = nd(Math.max(1, d - rnd(0, 1))); return a >= b ? [a, b] : [b, a]; }
  if (kind === "×") return [nd(d), d >= 3 && Math.random() < 0.4 ? nd(2) : nd(1)];
  const b = d >= 3 ? rnd(2, 12) : rnd(2, 9);
  return [b * nd(Math.max(1, d - 1)), b]; // exact division
}

function fracPair(): [string, string] {
  const f = () => { const q = rnd(2, 9); return `${rnd(1, q - 1)}/${q}`; };
  const a = f();
  let b = f();
  while (b === a) b = f();
  return [a, b];
}

export function buildExercises({ kind, digits = 3, count = 6 }: ExerciseOptions, c: Point, k = 1): ExerciseObject[] {
  const out: ExerciseObject[] = [];
  const n = Math.max(1, Math.min(12, count));
  if (kind === "eq") {
    const fs = Math.round(28 * k);
    const rows = Math.ceil(n / 2);
    const colW = Math.round(300 * k), rowH = Math.round(56 * k);
    const x0 = c[0] - colW, y0 = c[1] - (rows * rowH) / 2;
    for (let i = 0; i < n; i++) {
      const x = rnd(1, 12), a = rnd(2, 9), b = rnd(1, 20);
      const sign = Math.random() < 0.5 ? "+" : "−";
      const rhs = sign === "+" ? a * x + b : a * x - b;
      const t = `${i + 1}) ${a}x ${sign} ${b} = ${rhs}`;
      const m = measureText(t, fs);
      out.push({ type: "text", text: t, fs, c: "#1d1b2e", x: Math.round(x0 + (i % 2) * colW), y: Math.round(y0 + Math.floor(i / 2) * rowH), w: m.w, h: m.h });
    }
    return out;
  }
  const cell = Math.round(38 * k);
  const cols = Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const objs: ObjectDraft<ColmathObject>[] = [];
  const fops: ArithSign[] = ["+", "−"];
  for (let i = 0; i < n; i++) {
    if (kind === "frac") { const [a, b] = fracPair(); objs.push(makeColmath("frac", { a, b, fop: fops[rnd(0, 1)], cell })); }
    else { const [a, b] = columnPair(kind, digits); objs.push(makeColmath(kind, { a: String(a), b: String(b), cell })); }
  }
  const gap = Math.round(34 * k);
  const sizes = objs.map((o) => colmathBox(o));
  const cw = Math.max(...sizes.map((s) => s.w)) + gap;
  const rh = Math.max(...sizes.map((s) => s.h)) + gap;
  const x0 = c[0] - (cols * cw - gap) / 2, y0 = c[1] - (rows * rh - gap) / 2;
  objs.forEach((o, i) => out.push({ ...o, x: Math.round(x0 + (i % cols) * cw), y: Math.round(y0 + Math.floor(i / cols) * rh) }));
  return out;
}
