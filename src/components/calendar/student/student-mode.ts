import type { Lesson } from "@/lib/lessons";
import type { CalendarMode } from "../tutor/calendar-mode";

/**
 * Read-only calendar for a student: coloured per tutor, labelled with the
 * lesson title; tutor names only when there is more than one tutor.
 */
export function makeStudentMode(multiTutor: boolean): CalendarMode {
  return {
    readOnly: true,
    colorKey: (i) => i.tutorId,
    lessonTitle: (l) => l.title,
    lessonSubtitle: (l) => (multiTutor ? l.tutorName : undefined),
    deadlinePrefix: () => undefined,
    deadlineOwner: (hw) => (multiTutor ? hw.tutorName : undefined),
    homeworkHref: (hw) => `/dashboard/homework/${hw.id}`,
  };
}

/** Distinct tutors, in order of first appearance. */
export function tutorsOf(items: Pick<Lesson, "tutorId" | "tutorName">[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const it of items) {
    if (!map.has(it.tutorId) || (!map.get(it.tutorId) && it.tutorName)) map.set(it.tutorId, it.tutorName ?? "");
  }
  return [...map].map(([id, name]) => ({ id, name: name || "Вчитель" }));
}
