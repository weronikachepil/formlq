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

interface UpcomingLessonsProps {
  lessons: Lesson[];
  now: number;
  /** Show the tutor's name under each lesson. */
  showTutor: boolean;
  /** Tutors see (and colour by) the student instead of the tutor. */
  viewer?: "student" | "tutor";
  onOpen?: (l: Lesson) => void;
}

/** Time line next to a date tile: "Завтра · 18:00–19:00", "16:00–17:00", "зараз · до 17:00". */
function tileTime(l: Lesson, now: number): string {
  const start = l.start.toDate();
  const end = new Date(lessonEndMs(l));
  if (start.getTime() <= now) return `зараз · до ${formatHm(end)}`;
  const day = formatRelativeDay(start, now);
  const range = `${formatHm(start)}–${formatHm(end)}`;
  return day === "сьогодні" || day === "завтра" ? `${day} · ${range}` : range;
}

/** Compact list of the next lessons: date tile, who and when, board / join on the right. */
export function UpcomingLessons({ lessons, now, showTutor, viewer = "student", onOpen }: UpcomingLessonsProps) {
  const colorOf = useStudentColor();
  const isTutor = viewer === "tutor";
  return (
    <ul className="space-y-1">
      {lessons.map((l) => {
        const live = l.start.toMillis() <= now;
        const start = l.start.toDate();
        // A tutor thinks in students: the name leads; a non-default subject joins the time line.
        const heading = isTutor ? (l.groupId ? (l.groupName ?? l.studentName ?? "Група") : (l.studentName ?? l.title)) : l.title;
        const subject = isTutor && l.title && l.title !== "Урок" ? ` · ${l.title}` : "";
        return (
          <li key={l.id} className="flex items-center gap-2 rounded-[12px] pr-1.5 hover:bg-glass-strong transition-colors">
            <button
              type="button"
              onClick={() => onOpen?.(l)}
              disabled={!onOpen}
              className="flex min-w-0 flex-1 items-center gap-3 px-1.5 py-1.5 text-left"
            >
              {/* Date tile tinted in the student's (or tutor's) calendar colour. */}
              <span
                className={cn(
                  "grid w-11 shrink-0 place-items-center rounded-[10px] py-1.5 leading-none",
                  colorOf(isTutor ? (l.groupId ?? l.studentId) : l.tutorId).block,
                )}
              >
                <span className="text-[10px] font-semibold opacity-70">
                  {start.toLocaleDateString("uk-UA", { weekday: "short" })}
                </span>
                <span className="mt-0.5 text-base font-bold">{start.getDate()}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{heading}</span>
                <span
                  className={cn(
                    "block text-xs truncate first-letter:uppercase",
                    live ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground",
                  )}
                >
                  {tileTime(l, now)}
                  {isTutor
                    ? subject
                    : showTutor && l.tutorName
                      ? ` · ${l.tutorName}`
                      : ""}
                </span>
              </span>
            </button>
            <LessonActions lesson={l} now={now} size="icon" className="shrink-0 empty:hidden" />
          </li>
        );
      })}
    </ul>
  );
}
