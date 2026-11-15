"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { Lesson } from "@/lib/lessons";
import type { Homework } from "@/lib/tutor";
import {
  MONTHS,
  WEEKDAYS_FULL,
  addDays,
  addMonths,
  atMinutes,
  formatDayMonth,
  formatRangeTitle,
  startOfDay,
  startOfWeek,
  weekdayIndex,
} from "@/lib/calendar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarSidebar } from "./CalendarSidebar";
import { TimeGridView } from "./TimeGridView";
import { MonthGridView } from "./MonthGridView";
import { LessonPopover } from "./LessonPopover";
import { LessonDialog, lessonDraft, newLessonDraft, type LessonDraft } from "./LessonDialog";
import { useScopePrompt } from "./ScopeDialog";
import { useLessonActions } from "./useLessonActions";
import { lessonsInRange } from "./lesson-utils";
import { useMediaQuery, useNow } from "./useNow";
import { makeColorOf } from "./colors";
import { StudentColorsProvider } from "./student-colors";
import { cn } from "@/lib/utils";
import { ASIDE_FIT, DEFAULT_DURATION_MIN, GRID_FIT, type CalendarStudent, type CalendarView } from "./types";

const VIEW_KEY = "tutor-calendar-view";

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

export interface TutorCalendarViewProps {
  tutorId: string;
  tutorName?: string;
  lessons: Lesson[];
  homework: Homework[];
  students: CalendarStudent[];
  /** Preview/testing: start on this view instead of the remembered one. */
  defaultView?: CalendarView;
  /** Preview/testing: start on this date instead of today. */
  defaultDate?: Date;
}

/** Google-Calendar-style tutor schedule: week/day/month views, drag & drop, stats. */
export function TutorCalendarView({
  tutorId,
  tutorName,
  lessons: serverLessons,
  homework,
  students,
  defaultView,
  defaultDate,
}: TutorCalendarViewProps) {
  const now = useNow();
  const isPhone = useMediaQuery("(max-width: 639px)");
  const [view, setViewState] = useState<CalendarView>(() => defaultView ?? initialView());
  const [anchor, setAnchor] = useState(() => startOfDay(defaultDate ?? new Date()));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lesson | null>(null);

  const scope = useScopePrompt();
  const actions = useLessonActions({
    tutorId,
    tutorName,
    serverLessons,
    students,
    askScope: scope.ask,
  });
  const lessons = actions.lessons;
  const colorOf = useMemo(() => makeColorOf(students.map((s) => s.studentId)), [students]);

  const setView = (v: CalendarView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not critical: the view just won't be remembered.
    }
  };

  // Visible range [from, to) and its title.
  const { days, from, to, title } = useMemo(() => {
    if (view === "day") {
      return {
        days: [anchor],
        from: anchor,
        to: addDays(anchor, 1),
        title: `${WEEKDAYS_FULL[weekdayIndex(anchor)]}, ${formatDayMonth(anchor)} ${anchor.getFullYear()}`,
      };
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      const list = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { days: list, from: start, to: addDays(start, 7), title: formatRangeTitle(start, list[6]) };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { days: [], from: start, to: addMonths(start, 1), title: `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` };
  }, [view, anchor]);

  const visibleLessons = useMemo(
    () => (hidden.size ? lessons.filter((l) => !hidden.has(l.studentId)) : lessons),
    [lessons, hidden],
  );
  const visibleHomework = useMemo(
    () => (hidden.size ? homework.filter((h) => !hidden.has(h.studentId)) : homework),
    [homework, hidden],
  );
  const rangeLessons = useMemo(
    () => lessonsInRange(visibleLessons, from.getTime(), to.getTime()),
    [visibleLessons, from, to],
  );

  const step = (dir: 1 | -1) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(addMonths(anchor, dir));
  };

  const openDay = (d: Date) => {
    setAnchor(startOfDay(d));
    setView("day");
  };

  const create = (start: Date, durationMin: number) => {
    if (students.length === 0) {
      toast.error("Спершу додайте учнів, щоб планувати заняття");
      return;
    }
    setOpen(null);
    // With the filter narrowed to one student, new lessons default to them.
    const shown = students.filter((s) => !hidden.has(s.studentId));
    const studentId = (shown.length === 1 ? shown[0] : students[0]).studentId;
    setDraft(newLessonDraft(start, durationMin, studentId, lessons));
  };

  const createFromToolbar = () => {
    const t = new Date(now);
    if (t >= from && t < to) {
      // Next full hour today.
      t.setHours(t.getHours() + 1, 0, 0, 0);
      create(t, DEFAULT_DURATION_MIN);
    } else {
      create(atMinutes(anchor, 16 * 60), DEFAULT_DURATION_MIN);
    }
  };

  const openLesson = useCallback((l: Lesson, rect: DOMRect) => setOpen({ id: l.id, rect }), []);
  const closePopover = useCallback(() => setOpen(null), []);
  const openedLesson = open ? lessons.find((l) => l.id === open.id) : undefined;

  const removeOpened = (l: Lesson) => {
    setOpen(null);
    if (l.seriesId) void actions.removeLesson(l);
    else setConfirmDelete(l);
  };

  const rangeLabel =
    view === "day" ? "За день" : view === "week" ? `Тиждень: ${title}` : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <StudentColorsProvider value={colorOf}>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
        <aside className={cn("order-2 lg:order-1 lg:w-72 shrink-0", ASIDE_FIT)}>
          <CalendarSidebar
            anchor={anchor}
            onPickDate={(d) => setAnchor(startOfDay(d))}
            allLessons={visibleLessons}
            rangeLessons={rangeLessons}
            rangeLabel={rangeLabel}
            students={students}
            hidden={hidden}
            onHiddenChange={setHidden}
          />
        </aside>

        <section className="order-1 lg:order-2 flex-1 min-w-0 flex flex-col gap-3">
          <CalendarToolbar
            title={title}
            view={view}
            onView={setView}
            onToday={() => setAnchor(startOfDay(new Date()))}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onAdd={createFromToolbar}
            canAdd={students.length > 0}
          />
          {students.length === 0 && (
            <p className="text-sm text-muted-foreground">Додайте учнів, щоб планувати заняття.</p>
          )}

          <div className={cn("rounded-2xl border border-border/50 bg-card overflow-hidden", GRID_FIT)}>
            {view === "month" ? (
              <MonthGridView
                anchor={anchor}
                lessons={visibleLessons}
                homework={visibleHomework}
                now={now}
                onOpenLesson={openLesson}
                onDayClick={openDay}
                onCreateAt={(d) => create(atMinutes(d, 16 * 60), DEFAULT_DURATION_MIN)}
              />
            ) : (
              <TimeGridView
                days={days}
                lessons={visibleLessons}
                homework={visibleHomework}
                now={now}
                showSelection={!!draft && !draft.id}
                onOpenLesson={openLesson}
                onCreate={create}
                onMove={(l, start, dur) => void actions.moveLesson(l, start, dur)}
                onDayClick={openDay}
              />
            )}
          </div>
        </section>

        {open && openedLesson && (
          <LessonPopover
            lesson={openedLesson}
            anchor={open.rect}
            asDialog={isPhone}
            now={now}
            homework={homework}
            boardBusy={actions.boardBusy === openedLesson.id}
            onClose={closePopover}
            onStatus={(s) => void actions.setStatus(openedLesson, s)}
            onTogglePaid={() => void actions.togglePaid(openedLesson)}
            onEdit={() => {
              setOpen(null);
              setDraft(lessonDraft(openedLesson));
            }}
            onDelete={() => removeOpened(openedLesson)}
            onOpenBoard={() => void actions.openBoard(openedLesson)}
          />
        )}

        <LessonDialog
          draft={draft}
          students={students}
          lessons={lessons}
          onClose={() => setDraft(null)}
          onSave={actions.saveLesson}
        />

        <ConfirmDialog
          open={!!confirmDelete}
          title="Видалити урок?"
          description="Урок зникне з календаря у вас і в учня."
          onConfirm={() => {
            const l = confirmDelete;
            setConfirmDelete(null);
            if (l) void actions.removeLesson(l);
          }}
          onCancel={() => setConfirmDelete(null)}
        />

        {scope.dialog}
      </div>
    </StudentColorsProvider>
  );
}
