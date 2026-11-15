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

/*
 * Calendar page layout. Both columns fit the viewport, so the page itself doesn't scroll
 * and the sticky app header never slides over the toolbar; only the grid scrolls.
 * `svh` (not `dvh`): mobile Safari changes `dvh` while its toolbar collapses, which
 * re-laid out the whole grid mid-scroll (lag on tablets).
 * Header 4rem + main padding 3rem + toolbar and gap ≈ 11rem.
 */
export const GRID_FIT = "h-[calc(100svh-14rem)] sm:h-[calc(100svh-11rem)] min-h-[460px]";
/**
 * Desktop/tablet side column: scrolls on its own instead of stretching the page.
 * `p-3 -m-3` leaves room for the cards' glass shadow, which the scroll box would clip.
 */
export const ASIDE_FIT =
  "lg:sticky lg:top-[4.75rem] lg:self-start lg:max-h-[calc(100svh-5.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:-m-3 lg:p-3";

/** Opens the quick-view card for a lesson, anchored to the clicked element. */
export type OpenLesson = (lesson: Lesson, anchor: DOMRect) => void;
