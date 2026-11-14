import type { Lesson } from "@/lib/lessons";

export type CalendarView = "week" | "day" | "month";

export const VIEW_LABEL: Record<CalendarView, string> = {
  week: "Тиждень",
  day: "День",
  month: "Місяць",
};

/** Series edit scope: only the clicked occurrence, or it and all later ones. */
export type SeriesScope = "one" | "following";

export interface CalendarStudent {
  studentId: string;
  studentName: string;
}

/** Time grid geometry. */
export const HOUR_H = 56;
export const DEFAULT_START_HOUR = 7;
export const DEFAULT_END_HOUR = 23;
export const SNAP_MIN = 15;
export const DEFAULT_DURATION_MIN = 60;

/** Opens the quick-view card for a lesson, anchored to the clicked element. */
export type OpenLesson = (lesson: Lesson, anchor: DOMRect) => void;
