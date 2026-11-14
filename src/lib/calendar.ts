/** Monday-first weekday captions. */
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export const MONTHS = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local-day key for grouping by calendar day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Cells of a Monday-first month grid; `null` pads the first and last weeks. */
export function monthCells(year: number, month: number): (Date | null)[] {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Genitive month names for dates ("10 листопада"). */
export const MONTHS_GEN = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

/** Full weekday names, Monday-first (index = `weekdayIndex`). */
export const WEEKDAYS_FULL = [
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "Пʼятниця",
  "Субота",
  "Неділя",
];

export const MINUTE_MS = 60000;

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-day arithmetic (DST-safe: keeps the wall-clock time). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -weekdayIndex(d));
}

/** Minutes since local midnight. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Date at `minutes` after local midnight of `day`. */
export function atMinutes(day: Date, minutes: number): Date {
  const r = startOfDay(day);
  r.setMinutes(minutes);
  return r;
}

export function snapMinutes(min: number, step = 15): number {
  return Math.round(min / step) * step;
}

/** "16:00" */
export function formatHm(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "14 листопада" */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** "14.11.2026" */
export function formatShortDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Title of a date range, end inclusive: "10 – 16 листопада 2026",
 * "27 жовтня – 2 листопада 2026", "29 грудня 2025 – 4 січня 2026".
 */
export function formatRangeTitle(from: Date, to: Date): string {
  if (from.getFullYear() !== to.getFullYear()) {
    return `${formatDayMonth(from)} ${from.getFullYear()} – ${formatDayMonth(to)} ${to.getFullYear()}`;
  }
  if (from.getMonth() !== to.getMonth()) {
    return `${formatDayMonth(from)} – ${formatDayMonth(to)} ${to.getFullYear()}`;
  }
  return `${from.getDate()} – ${to.getDate()} ${MONTHS_GEN[to.getMonth()]} ${to.getFullYear()}`;
}

/** Monday-first month grid including the adjacent months' days (whole weeks). */
export function monthGridDays(year: number, month: number): Date[] {
  const first = startOfWeek(new Date(year, month, 1));
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = first; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Number of weekly occurrences from `start` to `until` (inclusive), capped at `max`. */
export function weeklyOccurrences(start: Date, until: Date, max: number): number {
  let n = 0;
  while (n < max && addDays(start, n * 7).getTime() <= until.getTime()) n++;
  return n;
}

export interface TimedItem<T> {
  item: T;
  startMs: number;
  endMs: number;
}

export interface LaidOut<T> extends TimedItem<T> {
  /** Column inside the overlap cluster. */
  col: number;
  /** Columns in the cluster (the item's width is 1/cols). */
  cols: number;
}

/**
 * Side-by-side layout for overlapping timed events (Google Calendar style):
 * events that transitively overlap form a cluster; each gets the first free
 * column, and every event of the cluster shares the cluster's column count.
 */
export function layoutOverlaps<T>(items: TimedItem<T>[]): LaidOut<T>[] {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);
  const out: LaidOut<T>[] = [];
  let cluster: LaidOut<T>[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const e of cluster) e.cols = colEnds.length;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const it of sorted) {
    if (it.startMs >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.startMs);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMs);
    } else {
      colEnds[col] = it.endMs;
    }
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, it.endMs);
  }
  flush();
  return out;
}

/** Whole calendar days from `from`'s day to `to`'s day (DST-safe). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** "сьогодні", "завтра", "вчора", else "пн, 17 листопада". */
export function formatRelativeDay(d: Date, now: number): string {
  const diff = calendarDaysBetween(new Date(now), d);
  if (diff === 0) return "сьогодні";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчора";
  return `${WEEKDAYS[weekdayIndex(d)].toLowerCase()}, ${formatDayMonth(d)}`;
}
