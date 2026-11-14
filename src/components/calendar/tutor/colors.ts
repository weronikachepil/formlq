/**
 * Deterministic per-student colours. Class strings are spelled out in full so
 * Tailwind picks them up; text shades are chosen to read on the tinted block in
 * both light and dark mode.
 */
export interface StudentColor {
  /** Solid swatch (dots, left edge). */
  dot: string;
  /** Tinted event surface + readable text. */
  block: string;
  /** Left accent edge of a block. */
  edge: string;
}

const PALETTE: StudentColor[] = [
  { dot: "bg-sky-500", edge: "border-sky-500", block: "bg-sky-500/15 text-sky-950 dark:bg-sky-400/20 dark:text-sky-50" },
  { dot: "bg-emerald-500", edge: "border-emerald-500", block: "bg-emerald-500/15 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-50" },
  { dot: "bg-violet-500", edge: "border-violet-500", block: "bg-violet-500/15 text-violet-950 dark:bg-violet-400/20 dark:text-violet-50" },
  { dot: "bg-amber-500", edge: "border-amber-500", block: "bg-amber-500/20 text-amber-950 dark:bg-amber-400/20 dark:text-amber-50" },
  { dot: "bg-rose-500", edge: "border-rose-500", block: "bg-rose-500/15 text-rose-950 dark:bg-rose-400/20 dark:text-rose-50" },
  { dot: "bg-teal-500", edge: "border-teal-500", block: "bg-teal-500/15 text-teal-950 dark:bg-teal-400/20 dark:text-teal-50" },
  { dot: "bg-indigo-500", edge: "border-indigo-500", block: "bg-indigo-500/15 text-indigo-950 dark:bg-indigo-400/20 dark:text-indigo-50" },
  { dot: "bg-orange-500", edge: "border-orange-500", block: "bg-orange-500/15 text-orange-950 dark:bg-orange-400/20 dark:text-orange-50" },
  { dot: "bg-lime-600", edge: "border-lime-600", block: "bg-lime-500/20 text-lime-950 dark:bg-lime-400/20 dark:text-lime-50" },
  { dot: "bg-fuchsia-500", edge: "border-fuchsia-500", block: "bg-fuchsia-500/15 text-fuchsia-950 dark:bg-fuchsia-400/20 dark:text-fuchsia-50" },
  { dot: "bg-cyan-500", edge: "border-cyan-500", block: "bg-cyan-500/15 text-cyan-950 dark:bg-cyan-400/20 dark:text-cyan-50" },
  { dot: "bg-pink-500", edge: "border-pink-500", block: "bg-pink-500/15 text-pink-950 dark:bg-pink-400/20 dark:text-pink-50" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Hash-based colour (stable, but two students may share one). */
export function studentColor(studentId: string): StudentColor {
  return PALETTE[hash(studentId) % PALETTE.length];
}

export type ColorOf = (studentId: string) => StudentColor;

/**
 * Distinct colours for a known set of students: ids sorted, then dealt from the
 * palette in order (so up to 12 students never share a colour, independent of
 * list order). Unknown ids fall back to the hash.
 */
export function makeColorOf(studentIds: string[]): ColorOf {
  const map = new Map<string, StudentColor>();
  [...new Set(studentIds)].sort().forEach((id, i) => map.set(id, PALETTE[i % PALETTE.length]));
  return (id) => map.get(id) ?? studentColor(id);
}
