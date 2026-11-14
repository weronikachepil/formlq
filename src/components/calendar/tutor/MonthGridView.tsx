"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lesson, lessonStatus } from "@/lib/lessons";
import type { Homework } from "@/lib/tutor";
import { isHomeworkOverdue } from "@/lib/homework-status";
import { WEEKDAYS, dayKey, formatHm, monthGridDays, sameDay } from "@/lib/calendar";
import { useStudentColor } from "./student-colors";
import { useCalendarMode } from "./calendar-mode";
import type { OpenLesson } from "./types";

const MAX_CHIPS = 3;
const MAX_MARKERS = 3;

interface MonthGridViewProps {
  /** Any day of the shown month. */
  anchor: Date;
  lessons: Lesson[];
  homework: Homework[];
  now: number;
  onOpenLesson: OpenLesson;
  onDayClick: (day: Date) => void;
  /** Click on a cell's empty space. Read-only calendars open the day instead. */
  onCreateAt?: (day: Date) => void;
}

function groupByDay<T>(items: T[], date: (t: T) => Date | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const d = date(it);
    if (!d) continue;
    const k = dayKey(d);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  return map;
}

/** Month grid: coloured lesson chips per day, deadline markers, overflow → day view. */
export function MonthGridView({
  anchor,
  lessons,
  homework,
  now,
  onOpenLesson,
  onDayClick,
  onCreateAt,
}: MonthGridViewProps) {
  const studentColor = useStudentColor();
  const mode = useCalendarMode();
  const onCellClick = !mode.readOnly && onCreateAt ? onCreateAt : onDayClick;
  const month = anchor.getMonth();
  const days = useMemo(() => monthGridDays(anchor.getFullYear(), month), [anchor, month]);
  const lessonsByDay = useMemo(() => groupByDay(lessons, (l) => l.start.toDate()), [lessons]);
  const hwByDay = useMemo(() => groupByDay(homework, (h) => h.dueAt?.toDate() ?? null), [homework]);
  const today = new Date(now);

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
      >
        {days.map((d) => {
          const k = dayKey(d);
          const dayLessons = lessonsByDay.get(k) ?? [];
          const deadlines = hwByDay.get(k) ?? [];
          const isToday = sameDay(d, today);
          const outside = d.getMonth() !== month;
          const hidden = dayLessons.length - MAX_CHIPS;
          return (
            <div
              key={k}
              role="button"
              tabIndex={-1}
              onClick={() => onCellClick(d)}
              className={cn(
                "min-h-16 sm:min-h-24 min-w-0 border-b border-l border-border/60 [&:nth-child(7n+1)]:border-l-0 p-1 flex flex-col gap-0.5 cursor-pointer transition-colors hover:bg-muted/40",
                outside && "bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayClick(d);
                  }}
                  className={cn(
                    "w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[11px] sm:text-xs font-semibold flex items-center justify-center transition-colors",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-pill-dark"
                      : outside
                        ? "text-muted-foreground/60 hover:bg-glass-strong"
                        : "hover:bg-glass-strong",
                  )}
                  aria-label={`Відкрити день ${d.getDate()}`}
                >
                  {d.getDate()}
                </button>
                <span className="flex items-center gap-0.5 min-w-0">
                  {deadlines.slice(0, MAX_MARKERS).map((hw) => {
                    const overdue = isHomeworkOverdue(hw, now);
                    const done = hw.status === "completed";
                    const Icon = done ? CheckCircle2 : ClipboardList;
                    return (
                      <Link
                        key={hw.id}
                        href={mode.homeworkHref(hw)}
                        onClick={(e) => e.stopPropagation()}
                        title={`Дедлайн: ${hw.title}${mode.deadlineOwner(hw) ? ` — ${mode.deadlineOwner(hw)}` : ""}`}
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-white hover:opacity-80",
                          overdue ? "bg-red-500" : studentColor(mode.colorKey(hw)).dot,
                          done && "opacity-50",
                        )}
                      >
                        <Icon size={11} />
                      </Link>
                    );
                  })}
                  {deadlines.length > MAX_MARKERS && (
                    <span className="text-[9px] text-muted-foreground">+{deadlines.length - MAX_MARKERS}</span>
                  )}
                </span>
              </div>

              {/* Phones: just coloured dots. */}
              <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                {dayLessons.map((l) => (
                  <span
                    key={l.id}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      studentColor(mode.colorKey(l)).dot,
                      lessonStatus(l) === "canceled" && "opacity-30",
                    )}
                  />
                ))}
              </div>

              <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                {dayLessons.slice(0, MAX_CHIPS).map((l) => {
                  const status = lessonStatus(l);
                  const color = studentColor(mode.colorKey(l));
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLesson(l, e.currentTarget.getBoundingClientRect());
                      }}
                      className={cn(
                        "flex items-center gap-1 min-w-0 rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-left border-l-2 transition-opacity hover:opacity-80",
                        color.block,
                        status === "missed" ? "border-red-500" : color.edge,
                        status === "canceled" && "opacity-50 line-through",
                      )}
                    >
                      <span className="font-mono text-[10px] opacity-80 shrink-0">{formatHm(l.start.toDate())}</span>
                      <span className="truncate font-medium">{mode.lessonTitle(l)}</span>
                      {status === "done" && <Check size={10} strokeWidth={3} className="shrink-0 ml-auto" />}
                    </button>
                  );
                })}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(d);
                    }}
                    className="text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground px-1.5"
                  >
                    +{hidden} ще
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
