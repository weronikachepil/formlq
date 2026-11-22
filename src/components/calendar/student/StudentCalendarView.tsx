"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/lessons";
import type { Homework } from "@/lib/tutor";
import { formatDueCountdown, isHomeworkOverdue } from "@/lib/homework-status";
import {
  MONTHS,
  WEEKDAYS_FULL,
  addDays,
  addMonths,
  dayKey,
  formatDayMonth,
  formatRangeTitle,
  startOfDay,
  startOfWeek,
  weekdayIndex,
} from "@/lib/calendar";
import { MiniCalendar, type MiniCalendarTone } from "@/components/calendar/MiniCalendar";
import { LessonViewModal } from "@/components/calendar/LessonViewModal";
import { CalendarToolbar } from "../tutor/CalendarToolbar";
import { TimeGridView } from "../tutor/TimeGridView";
import { MonthGridView } from "../tutor/MonthGridView";
import { makeColorOf } from "../tutor/colors";
import { StudentColorsProvider } from "../tutor/student-colors";
import { CalendarModeProvider } from "../tutor/calendar-mode";
import { useNow } from "../tutor/useNow";
import { ASIDE_FIT, GRID_FIT, type CalendarView } from "../tutor/types";
import { makeStudentMode, tutorsOf } from "./student-mode";
import { UpcomingLessons, upcomingLessons } from "./UpcomingLessons";

const VIEW_KEY = "student-calendar-view";

function initialView(): CalendarView {
  if (typeof window === "undefined") return "week";
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "week" || saved === "day" || saved === "month") return saved;
  } catch {
    // Storage unavailable (private mode) — fall through to the default.
  }
  // Seven columns are too narrow on phones.
  return window.matchMedia("(max-width: 639px)").matches ? "day" : "week";
}

export interface StudentCalendarViewProps {
  lessons: Lesson[];
  homework: Homework[];
  /** Preview/testing: start on this view instead of the remembered one. */
  defaultView?: CalendarView;
  /** Preview/testing: start on this date instead of today. */
  defaultDate?: Date;
}

/** Student's read-only schedule: the tutor calendar grid without editing, coloured per tutor. */
export function StudentCalendarView({ lessons, homework, defaultView, defaultDate }: StudentCalendarViewProps) {
  const now = useNow();
  const [view, setViewState] = useState<CalendarView>(() => defaultView ?? initialView());
  const [anchor, setAnchor] = useState(() => startOfDay(defaultDate ?? new Date()));
  const [opened, setOpened] = useState<string | null>(null);

  const tutors = useMemo(() => tutorsOf([...lessons, ...homework]), [lessons, homework]);
  const multiTutor = tutors.length > 1;
  const mode = useMemo(() => makeStudentMode(multiTutor), [multiTutor]);
  const colorOf = useMemo(() => makeColorOf(tutors.map((t) => t.id)), [tutors]);

  const setView = (v: CalendarView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not critical: the view just won't be remembered.
    }
  };

  const { days, title } = useMemo(() => {
    if (view === "day") {
      return {
        days: [anchor],
        title: `${WEEKDAYS_FULL[weekdayIndex(anchor)]}, ${formatDayMonth(anchor)} ${anchor.getFullYear()}`,
      };
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      const list = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { days: list, title: formatRangeTitle(start, list[6]) };
    }
    return { days: [], title: `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` };
  }, [view, anchor]);

  const step = (dir: 1 | -1) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(addMonths(anchor, dir));
  };

  const openDay = (d: Date) => {
    setAnchor(startOfDay(d));
    setView("day");
  };

  const openLesson = useCallback((l: Lesson) => setOpened(l.id), []);
  const openedLesson = opened ? lessons.find((l) => l.id === opened) ?? null : null;

  const marks = useMemo(() => {
    const m = new Map<string, MiniCalendarTone[]>();
    const add = (d: Date, t: MiniCalendarTone) => {
      const k = dayKey(d);
      m.set(k, [...(m.get(k) ?? []), t]);
    };
    for (const l of lessons) add(l.start.toDate(), "active");
    for (const hw of homework) if (hw.dueAt && isHomeworkOverdue(hw, now)) add(hw.dueAt.toDate(), "danger");
    return m;
  }, [lessons, homework, now]);

  const next = useMemo(() => upcomingLessons(lessons, now, 3), [lessons, now]);
  const pending = homework.filter((h) => h.status !== "completed" && h.dueAt);
  const overdueCount = pending.filter((h) => isHomeworkOverdue(h, now)).length;
  const nextDeadline = pending
    .filter((h) => h.dueAt!.toMillis() >= now)
    .sort((a, b) => a.dueAt!.toMillis() - b.dueAt!.toMillis())[0];

  return (
    <CalendarModeProvider value={mode}>
      <StudentColorsProvider value={colorOf}>
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
          <aside className={cn("order-2 lg:order-1 lg:w-72 shrink-0 space-y-4", ASIDE_FIT)}>
            <MiniCalendar
              // Follow the main calendar when it moves to another month.
              key={`${anchor.getFullYear()}-${anchor.getMonth()}`}
              initialMonth={anchor}
              marks={marks}
              selected={anchor}
              onSelect={(d) => d && setAnchor(startOfDay(d))}
              legend={[
                { tone: "active", label: "заняття" },
                { tone: "danger", label: "прострочене ДЗ" },
              ]}
            />

            <div className="rounded-2xl border border-border/50 bg-card p-3 space-y-2">
              <p className="px-2 pt-1 text-[13px] font-semibold text-muted-foreground">
                Найближчі
              </p>
              {next.length ? (
                <UpcomingLessons lessons={next} now={now} showTutor={multiTutor} onOpen={openLesson} />
              ) : (
                <p className="px-2 pb-1 text-sm text-muted-foreground">Запланованих занять немає</p>
              )}

              {(nextDeadline || overdueCount > 0) && (
                <div className="border-t border-border/50 pt-2 space-y-1">
                  {nextDeadline && (
                    <Link
                      href={`/dashboard/homework/${nextDeadline.id}`}
                      className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-glass-strong transition-colors"
                    >
                      <ClipboardList size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{nextDeadline.title}</span>
                        <span className="block text-xs text-muted-foreground first-letter:uppercase">
                          Дедлайн: {formatDueCountdown(nextDeadline.dueAt!.toMillis(), now)}
                        </span>
                      </span>
                    </Link>
                  )}
                  {overdueCount > 0 && (
                    <Link
                      href="/dashboard/homework"
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <AlertCircle size={14} /> Прострочено завдань: {overdueCount}
                      <ArrowRight size={13} className="ml-auto" />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {multiTutor && (
              <div className="rounded-2xl border border-border/50 bg-card p-3 space-y-1.5">
                <p className="px-2 pt-1 text-[13px] font-semibold text-muted-foreground">
                  Вчителі
                </p>
                {tutors.map((t) => (
                  <p key={t.id} className="flex items-center gap-2.5 px-2 py-1 text-sm">
                    <span className={cn("w-3 h-3 rounded-full shrink-0", colorOf(t.id).dot)} />
                    <span className="truncate">{t.name}</span>
                  </p>
                ))}
              </div>
            )}
          </aside>

          <section className="order-1 lg:order-2 flex-1 min-w-0 flex flex-col gap-3">
            <CalendarToolbar
              title={title}
              view={view}
              onView={setView}
              onToday={() => setAnchor(startOfDay(new Date()))}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
            />

            <div className={cn("rounded-2xl border border-border/50 bg-card overflow-hidden", GRID_FIT)}>
              {view === "month" ? (
                <MonthGridView
                  anchor={anchor}
                  lessons={lessons}
                  homework={homework}
                  now={now}
                  onOpenLesson={openLesson}
                  onDayClick={openDay}
                />
              ) : (
                <TimeGridView
                  days={days}
                  lessons={lessons}
                  homework={homework}
                  now={now}
                  onOpenLesson={openLesson}
                  onDayClick={openDay}
                />
              )}
            </div>
          </section>

          <LessonViewModal
            lesson={openedLesson}
            onClose={() => setOpened(null)}
            colorDot={openedLesson ? colorOf(openedLesson.tutorId).dot : undefined}
            hideStudent
          />
        </div>
      </StudentColorsProvider>
    </CalendarModeProvider>
  );
}
