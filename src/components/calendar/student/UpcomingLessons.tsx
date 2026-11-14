"use client";

import { cn } from "@/lib/utils";
import { Lesson, lessonEndMs, lessonStatus } from "@/lib/lessons";
import { formatHm, formatRelativeDay } from "@/lib/calendar";
import { LessonActions } from "@/components/calendar/LessonViewModal";
import { useStudentColor } from "../tutor/student-colors";

/** Planned lessons that haven't ended yet, soonest first. */
export function upcomingLessons(lessons: Lesson[], now: number, limit: number): Lesson[] {
  return lessons
    .filter((l) => lessonStatus(l) === "planned" && lessonEndMs(l) >= now)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis())
    .slice(0, limit);
}

/** "сьогодні о 16:00", "зараз · до 17:00", "пн, 17 листопада о 16:00". */
export function relativeLessonTime(l: Lesson, now: number): string {
  const start = l.start.toDate();
  if (start.getTime() <= now) return `зараз · до ${formatHm(new Date(lessonEndMs(l)))}`;
  return `${formatRelativeDay(start, now)} о ${formatHm(start)}`;
}

interface UpcomingLessonsProps {
  lessons: Lesson[];
  now: number;
  /** Show the tutor's name under each lesson. */
  showTutor: boolean;
  /** Tutors see (and colour by) the student instead of the tutor. */
  viewer?: "student" | "tutor";
  onOpen?: (l: Lesson) => void;
}

/** Compact list of the next lessons with join / board shortcuts. */
export function UpcomingLessons({ lessons, now, showTutor, viewer = "student", onOpen }: UpcomingLessonsProps) {
  const colorOf = useStudentColor();
  const isTutor = viewer === "tutor";
  return (
    <ul className="space-y-1">
      {lessons.map((l) => {
        const live = l.start.toMillis() <= now;
        return (
          <li key={l.id} className="rounded-xl hover:bg-glass-strong transition-colors">
            <button
              type="button"
              onClick={() => onOpen?.(l)}
              disabled={!onOpen}
              className="w-full flex items-start gap-2.5 px-2 py-2 text-left"
            >
              <span className={cn("mt-1.5 w-2.5 h-2.5 rounded-[4px] shrink-0", colorOf(isTutor ? l.studentId : l.tutorId).dot)} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{l.title}</span>
                <span
                  className={cn(
                    "block text-xs truncate first-letter:uppercase",
                    live ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground",
                  )}
                >
                  {relativeLessonTime(l, now)}
                  {isTutor
                    ? l.studentName
                      ? ` · ${l.studentName}`
                      : ""
                    : showTutor && l.tutorName
                      ? ` · ${l.tutorName}`
                      : ""}
                </span>
              </span>
            </button>
            <LessonActions lesson={l} now={now} size="sm" className="pl-7 pr-2 pb-2 -mt-1 empty:hidden" />
          </li>
        );
      })}
    </ul>
  );
}
