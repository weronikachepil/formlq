"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Lesson, lessonEndMs, lessonStatus } from "@/lib/lessons";
import type { Homework } from "@/lib/tutor";
import {
  MINUTE_MS,
  WEEKDAYS,
  addDays,
  atMinutes,
  dayKey,
  formatHm,
  layoutOverlaps,
  minutesOfDay,
  sameDay,
  type TimedItem,
} from "@/lib/calendar";
import { LessonBlock } from "./LessonBlock";
import { DeadlineChip } from "./DeadlineChip";
import { useLessonDrag, type DragPreview } from "./useLessonDrag";
import { useSlotSelect } from "./useSlotSelect";
import { useCalendarMode } from "./calendar-mode";
import { DEFAULT_END_HOUR, DEFAULT_START_HOUR, HOUR_H, type OpenLesson } from "./types";

const GUTTER = "w-12 sm:w-14";
const MAX_DEADLINES = 3;

/** "1 урок", "3 уроки", "5 уроків". */
function lessonsWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return "урок";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "уроки";
  return "уроків";
}
const noop = () => {};

interface TimeGridViewProps {
  days: Date[];
  lessons: Lesson[];
  homework: Homework[];
  now: number;
  /** Keep the click/drag-selected slot highlighted (while the new-lesson dialog is open). */
  showSelection?: boolean;
  onOpenLesson: OpenLesson;
  /** Editable calendar only (ignored in read-only mode). */
  onCreate?: (start: Date, durationMin: number) => void;
  onMove?: (lesson: Lesson, start: Date, durationMin: number) => void;
  onDayClick: (day: Date) => void;
}

/** Shown position of a lesson: its own, or the drag preview's. */
function placed(l: Lesson, preview: DragPreview | null, days: Date[]) {
  if (preview?.lessonId === l.id) {
    const startMs = atMinutes(days[preview.dayIndex], preview.startMin).getTime();
    return { dayIndex: preview.dayIndex, startMs, endMs: startMs + preview.durationMin * MINUTE_MS };
  }
  const start = l.start.toDate();
  return { dayIndex: days.findIndex((d) => sameDay(d, start)), startMs: start.getTime(), endMs: lessonEndMs(l) };
}

/** Week / day time grid with an all-day deadlines row. */
export function TimeGridView({
  days,
  lessons,
  homework,
  now,
  showSelection,
  onOpenLesson,
  onCreate,
  onMove,
  onDayClick,
}: TimeGridViewProps) {
  const { readOnly } = useCalendarMode();
  const editable = !readOnly && !!onCreate && !!onMove;
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rangeStart = days[0].getTime();
  const rangeEnd = addDays(days[days.length - 1], 1).getTime();

  const inRange = useMemo(
    () => lessons.filter((l) => l.start.toMillis() < rangeEnd && lessonEndMs(l) > rangeStart),
    [lessons, rangeStart, rangeEnd],
  );

  // Grow the default 07–23 window when a lesson falls outside it.
  const { startHour, endHour } = useMemo(() => {
    let s = DEFAULT_START_HOUR;
    let e = DEFAULT_END_HOUR;
    for (const l of inRange) {
      const d = l.start.toDate();
      s = Math.min(s, d.getHours());
      const endMin = Math.min(24 * 60, minutesOfDay(d) + l.durationMin);
      e = Math.max(e, Math.ceil(endMin / 60));
    }
    return { startHour: s, endHour: e };
  }, [inRange]);
  const hours = endHour - startHour;

  const geo = { gridRef, scrollRef, days, startHour };
  const drag = useLessonDrag({ ...geo, onCommit: onMove ?? noop, onClick: onOpenLesson });
  const slot = useSlotSelect({ ...geo, onCreate: onCreate ?? noop });
  const preview = drag.preview;

  const columns = useMemo(() => {
    const cols: TimedItem<Lesson>[][] = days.map(() => []);
    for (const l of inRange) {
      const p = placed(l, preview, days);
      if (p.dayIndex >= 0) cols[p.dayIndex].push({ item: l, startMs: p.startMs, endMs: p.endMs });
    }
    return cols.map((c) => layoutOverlaps(c));
  }, [days, inRange, preview]);

  // Header load line per day: "3 уроки" (cancelled ones don't count).
  const dayLoad = useMemo(
    () => days.map((d) => inRange.filter((l) => lessonStatus(l) !== "canceled" && sameDay(l.start.toDate(), d)).length),
    [days, inRange],
  );

  const deadlines = useMemo(() => {
    const map = new Map<string, Homework[]>();
    for (const hw of homework) {
      if (!hw.dueAt) continue;
      const ms = hw.dueAt.toMillis();
      if (ms < rangeStart || ms >= rangeEnd) continue;
      const k = dayKey(hw.dueAt.toDate());
      map.set(k, [...(map.get(k) ?? []), hw]);
    }
    return map;
  }, [homework, rangeStart, rangeEnd]);

  // Scroll once per range: ~1h before now (today visible) or before the first lesson.
  const nowInRange = now >= rangeStart && now < rangeEnd;
  const firstHour = inRange.length
    ? Math.min(...inRange.map((l) => l.start.toDate().getHours()))
    : 8;
  const targetHour = (nowInRange ? new Date(now).getHours() : firstHour) - 1;
  const rangeKey = `${rangeStart}:${days.length}`;
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledFor.current === rangeKey) return;
    scrolledFor.current = rangeKey;
    el.scrollTop = Math.max(0, (targetHour - startHour) * HOUR_H);
  }, [rangeKey, targetHour, startHour]);

  const today = new Date(now);
  const nowTop = ((minutesOfDay(today) - startHour * 60) / 60) * HOUR_H;
  const colTemplate = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  const single = days.length === 1;
  const todayIndex = days.findIndex((d) => sameDay(d, today));
  const nowVisible = todayIndex >= 0 && nowTop >= 0 && nowTop <= hours * HOUR_H;

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto overscroll-contain">
      {/* Sticky header: weekday + date, then the deadlines row. */}
      <div className="sticky top-0 z-40 bg-popover border-b border-border">
        <div className="flex">
          <div className={cn(GUTTER, "shrink-0")} />
          <div className="grid flex-1" style={colTemplate}>
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              const load = dayLoad[i];
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  onClick={() => onDayClick(d)}
                  disabled={single}
                  className={cn(
                    "flex flex-col items-center gap-0.5 pt-2 pb-1.5 border-l border-border/60 first:border-l-0 transition-colors",
                    !single && "hover:bg-muted/60",
                    single && "items-start pl-3",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.14em]",
                      isToday ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-heading text-base font-bold",
                      isToday ? "bg-primary text-primary-foreground shadow-pill-dark" : "text-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <span className="h-3.5 text-[10px] leading-3.5 tabular-nums text-muted-foreground truncate max-w-full px-1">
                    {load > 0 && (
                      <>
                        {load}
                        <span className={single ? undefined : "max-lg:hidden"}> {lessonsWord(load)}</span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {deadlines.size > 0 && (
          <div className="flex border-t border-border/60">
            <div
              className={cn(
                GUTTER,
                "shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-right pr-1.5 pt-1.5",
              )}
            >
              ДЗ
            </div>
            <div className="grid flex-1" style={colTemplate}>
              {days.map((d) => {
                const list = deadlines.get(dayKey(d)) ?? [];
                return (
                  <div key={d.getTime()} className="min-w-0 p-1 space-y-0.5 border-l border-border/60 first:border-l-0">
                    {list.slice(0, MAX_DEADLINES).map((hw) => (
                      <DeadlineChip key={hw.id} hw={hw} now={now} />
                    ))}
                    {list.length > MAX_DEADLINES && (
                      <button
                        type="button"
                        onClick={() => onDayClick(d)}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                      >
                        +{list.length - MAX_DEADLINES}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex" style={{ height: hours * HOUR_H }}>
        {/* Hour labels */}
        <div className={cn(GUTTER, "shrink-0 relative")}>
          {Array.from({ length: hours }, (_, i) => (
            <span
              key={i}
              className="absolute right-2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground/90"
              style={{ top: i * HOUR_H }}
            >
              {i === 0 ? "" : `${String(startHour + i).padStart(2, "0")}:00`}
            </span>
          ))}
          {nowVisible && (
            <span
              className="absolute right-1 z-10 -translate-y-1/2 rounded-[6px] bg-chart-5 px-1 py-px text-[10px] font-semibold tabular-nums text-white shadow-sm"
              style={{ top: nowTop }}
            >
              {formatHm(today)}
            </span>
          )}
        </div>

        <div
          ref={gridRef}
          className="relative grid flex-1"
          style={{
            ...colTemplate,
            // Hour lines + fainter half-hour lines.
            backgroundImage: `linear-gradient(to bottom, var(--border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 45%, transparent) 1px, transparent 1px)`,
            backgroundSize: `100% ${HOUR_H}px, 100% ${HOUR_H / 2}px`,
          }}
        >
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            const sel = showSelection && slot.selection?.dayIndex === i ? slot.selection : null;
            return (
              <div
                key={d.getTime()}
                className={cn(
                  "relative border-l border-border/60 first:border-l-0 touch-pan-y",
                  editable && "cursor-cell",
                )}
                onPointerDown={editable ? slot.onPointerDown : undefined}
              >
                {/* Past time recedes, so the eye goes to what's ahead. */}
                {(d.getTime() + 86400000 <= now || isToday) && (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 bg-foreground/[0.025] pointer-events-none"
                    style={{ height: isToday ? Math.max(0, Math.min(hours * HOUR_H, nowTop)) : "100%" }}
                  />
                )}
                {sel && (
                  <div
                    className="absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-foreground/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] pointer-events-none"
                    style={{
                      top: ((sel.startMin - startHour * 60) / 60) * HOUR_H,
                      height: (sel.durationMin / 60) * HOUR_H,
                    }}
                  >
                    {formatHm(atMinutes(d, sel.startMin))}–{formatHm(atMinutes(d, sel.startMin + sel.durationMin))}
                  </div>
                )}

                {columns[i].map((e) => {
                  const startMin = minutesOfDay(new Date(e.startMs));
                  const dur = (e.endMs - e.startMs) / MINUTE_MS;
                  return (
                    <LessonBlock
                      key={e.item.id}
                      lesson={e.item}
                      startMs={e.startMs}
                      durationMin={dur}
                      now={now}
                      dragging={preview?.lessonId === e.item.id}
                      narrow={!single}
                      onPointerDown={editable ? (ev, mode) => drag.onPointerDown(ev, e.item, mode) : undefined}
                      onOpen={(rect) => onOpenLesson(e.item, rect)}
                      style={{
                        top: ((startMin - startHour * 60) / 60) * HOUR_H + 1,
                        height: Math.max(18, (dur / 60) * HOUR_H - 2),
                        left: `calc(${(e.col / e.cols) * 100}% + 2px)`,
                        width: `calc(${100 / e.cols}% - 4px)`,
                      }}
                    />
                  );
                })}

                {isToday && nowVisible && (
                  <div className="absolute inset-x-0 z-30 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-[1.5px] -translate-y-1/2 bg-chart-5" />
                    <div className="absolute -left-[5px] -top-[5px] w-2.5 h-2.5 rounded-full bg-chart-5 ring-2 ring-popover" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
