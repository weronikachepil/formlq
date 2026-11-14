import { CheckCircle2, Hourglass, Play, type LucideIcon } from "lucide-react";
import type { HomeworkStatus } from "@/lib/tutor";
import { calendarDaysBetween, formatHm } from "@/lib/calendar";
import { pluralize } from "@/lib/format";

/** Who is looking at the homework — wording/icons differ for students vs tutors. */
export type HomeworkAudience = "student" | "tutor";

interface StatusMeta {
  label: string;
  cls: string;
  Icon: LucideIcon;
}

const TONE: Record<HomeworkStatus, string> = {
  assigned: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  in_progress: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  completed: "text-green-600 dark:text-green-400 bg-green-500/10",
};

const COPY: Record<HomeworkAudience, Record<HomeworkStatus, { label: string; Icon: LucideIcon }>> = {
  // Student: a call to action ("start / continue").
  student: {
    assigned: { label: "До виконання", Icon: Play },
    in_progress: { label: "Розпочато", Icon: Play },
    completed: { label: "Завершено", Icon: CheckCircle2 },
  },
  // Tutor / editor: waiting on the student.
  tutor: {
    assigned: { label: "Призначено", Icon: Hourglass },
    in_progress: { label: "Виконується", Icon: Hourglass },
    completed: { label: "Завершено", Icon: CheckCircle2 },
  },
};

export function getHomeworkStatusMeta(
  status: HomeworkStatus,
  audience: HomeworkAudience,
): StatusMeta {
  const copy = COPY[audience][status] ?? COPY[audience].assigned;
  return { ...copy, cls: TONE[status] ?? TONE.assigned };
}

/** Not completed and past its deadline. */
export function isHomeworkOverdue(
  hw: { status: HomeworkStatus; dueAt?: { toMillis(): number } | null },
  now: number,
): boolean {
  return hw.status !== "completed" && !!hw.dueAt && hw.dueAt.toMillis() < now;
}

/** Per-student homework counters for a tutor's student cabinet. */
export interface HomeworkSummary {
  total: number;
  /** Assigned or in progress, not overdue. */
  active: number;
  overdue: number;
  done: number;
  /** Earliest deadline among unfinished homework, ms. */
  nextDueMs: number | null;
}

type SummaryInput = { status: HomeworkStatus; dueAt?: { toMillis(): number } | null };

export function summarizeHomework(list: SummaryInput[], now: number): HomeworkSummary {
  const s: HomeworkSummary = { total: list.length, active: 0, overdue: 0, done: 0, nextDueMs: null };
  for (const hw of list) {
    if (hw.status === "completed") {
      s.done++;
      continue;
    }
    if (isHomeworkOverdue(hw, now)) s.overdue++;
    else s.active++;
    const due = hw.dueAt?.toMillis();
    if (due !== undefined && (s.nextDueMs === null || due < s.nextDueMs)) s.nextDueMs = due;
  }
  return s;
}

/** Splits a student's homework into the cabinet's sections. */
export function groupHomework<T extends SummaryInput>(
  list: T[],
  now: number,
): { overdue: T[]; active: T[]; done: T[] } {
  const dueMs = (hw: T) => hw.dueAt?.toMillis() ?? Infinity;
  const overdue: T[] = [];
  const active: T[] = [];
  const done: T[] = [];
  for (const hw of list) {
    if (hw.status === "completed") done.push(hw);
    else if (isHomeworkOverdue(hw, now)) overdue.push(hw);
    else active.push(hw);
  }
  overdue.sort((a, b) => dueMs(a) - dueMs(b));
  active.sort((a, b) => dueMs(a) - dueMs(b));
  return { overdue, active, done };
}

const DAY_FORMS: [string, string, string] = ["день", "дні", "днів"];
const HOUR_FORMS: [string, string, string] = ["годину", "години", "годин"];

/**
 * Relative deadline for students: "сьогодні до 18:00", "завтра до 18:00",
 * "залишилось 3 дні", "прострочено на 2 дні" / "прострочено на 5 годин".
 */
export function formatDueCountdown(dueMs: number, now: number): string {
  const due = new Date(dueMs);
  const days = calendarDaysBetween(new Date(now), due);
  if (dueMs < now) {
    const late = -days;
    if (late >= 1) return `прострочено на ${pluralize(late, DAY_FORMS)}`;
    const hours = Math.max(1, Math.floor((now - dueMs) / 3600000));
    return `прострочено на ${pluralize(hours, HOUR_FORMS)}`;
  }
  if (days === 0) return `сьогодні до ${formatHm(due)}`;
  if (days === 1) return `завтра до ${formatHm(due)}`;
  return `${days % 10 === 1 && days % 100 !== 11 ? "залишився" : "залишилось"} ${pluralize(days, DAY_FORMS)}`;
}
