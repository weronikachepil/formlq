"use client";

import { createContext, useContext } from "react";
import type { Lesson } from "@/lib/lessons";
import type { Homework } from "@/lib/tutor";

/**
 * Who is looking at the calendar grid. The tutor (default) edits lessons and
 * sees them per student; a student sees a read-only schedule coloured and
 * labelled per tutor. Grid components read this instead of taking many props.
 */
export interface CalendarMode {
  /** No drag / resize / slot-select / create; tutor-only badges hidden. */
  readOnly: boolean;
  /** Key passed to the colour lookup (`useStudentColor`). */
  colorKey: (item: Pick<Lesson, "studentId" | "tutorId">) => string;
  /** Main line of a lesson block (and the only one on short blocks). */
  lessonTitle: (l: Lesson) => string;
  /** Secondary line on tall blocks; omitted when undefined. */
  lessonSubtitle: (l: Lesson) => string | undefined;
  /** Prefix of a deadline chip ("Оля: …"); omitted when undefined. */
  deadlinePrefix: (hw: Homework) => string | undefined;
  /** Who the deadline belongs to, for the tooltip. */
  deadlineOwner: (hw: Homework) => string | undefined;
  homeworkHref: (hw: Homework) => string;
}

export const TUTOR_MODE: CalendarMode = {
  readOnly: false,
  colorKey: (i) => i.studentId,
  lessonTitle: (l) => l.studentName ?? l.title,
  lessonSubtitle: (l) => l.title,
  deadlinePrefix: (hw) => hw.studentName?.split(" ")[0],
  deadlineOwner: (hw) => hw.studentName ?? "учень",
  homeworkHref: (hw) => `/tutor/homework/${hw.id}`,
};

const CalendarModeContext = createContext<CalendarMode>(TUTOR_MODE);

export const CalendarModeProvider = CalendarModeContext.Provider;

export function useCalendarMode(): CalendarMode {
  return useContext(CalendarModeContext);
}
