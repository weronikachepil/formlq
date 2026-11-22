"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/lessons";
import { dayKey } from "@/lib/calendar";
import {
  MiniCalendar,
  type MiniCalendarTone,
} from "@/components/calendar/MiniCalendar";
import { useStudentColor } from "./student-colors";
import { StatsCard } from "./StatsCard";
import type { CalendarStudent } from "./types";

interface CalendarSidebarProps {
  anchor: Date;
  onPickDate: (d: Date) => void;
  /** All lessons (for the mini-calendar dots). */
  allLessons: Lesson[];
  /** Lessons of the visible range after filtering (for the stats). */
  rangeLessons: Lesson[];
  rangeLabel: string;
  students: CalendarStudent[];
  hidden: Set<string>;
  onHiddenChange: (next: Set<string>) => void;
}

function Checkbox({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors",
        checked
          ? "border-transparent text-white"
          : "border-foreground/25 bg-glass",
        className,
      )}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

export function CalendarSidebar({
  anchor,
  onPickDate,
  allLessons,
  rangeLessons,
  rangeLabel,
  students,
  hidden,
  onHiddenChange,
}: CalendarSidebarProps) {
  const studentColor = useStudentColor();
  const marks = useMemo(() => {
    const m = new Map<string, MiniCalendarTone[]>();
    for (const l of allLessons) m.set(dayKey(l.start.toDate()), ["active"]);
    return m;
  }, [allLessons]);

  const allShown = hidden.size === 0;
  // Collapsed by default so the stats fit under the mini calendar.
  const [open, setOpen] = useState(false);
  const shownCount = students.filter((s) => !hidden.has(s.studentId)).length;
  const summary = allShown
    ? "Усі"
    : shownCount === 0
      ? "Нікого"
      : `${shownCount} з ${students.length}`;

  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onHiddenChange(next);
  };

  return (
    <div className="space-y-3">
      <MiniCalendar
        // Follow the main calendar when it moves to another month.
        key={`${anchor.getFullYear()}-${anchor.getMonth()}`}
        initialMonth={anchor}
        marks={marks}
        selected={anchor}
        onSelect={(d) => d && onPickDate(d)}
      />

      {students.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-1.5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-glass-strong transition-colors"
          >
            <span className="text-[13px] font-semibold text-muted-foreground">
              Учні
            </span>
            {/* Colours of the students currently shown. */}
            <span className="flex -space-x-1 min-w-0 overflow-hidden">
              {students
                .filter((st) => !hidden.has(st.studentId))
                .slice(0, 6)
                .map((st) => (
                  <span
                    key={st.studentId}
                    className={cn(
                      "w-3 h-3 rounded-full ring-2 ring-card shrink-0",
                      studentColor(st.studentId).dot,
                    )}
                  />
                ))}
            </span>
            <span className="ml-auto text-sm font-semibold">{summary}</span>
            <ChevronDown
              size={15}
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>

          {open && (
            <div className="mt-1 pt-1 border-t border-border/50 space-y-0.5 max-h-64 overflow-y-auto overscroll-contain">
              <button
                type="button"
                role="checkbox"
                aria-checked={allShown}
                onClick={() =>
                  onHiddenChange(
                    allShown
                      ? new Set(students.map((s) => s.studentId))
                      : new Set(),
                  )
                }
                className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-semibold hover:bg-glass-strong transition-colors"
              >
                <Checkbox
                  checked={allShown}
                  className={
                    allShown ? "bg-primary text-primary-foreground" : undefined
                  }
                />
                Усі
              </button>
              {students.map((s) => {
                const on = !hidden.has(s.studentId);
                const color = studentColor(s.studentId);
                return (
                  <button
                    key={s.studentId}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(s.studentId)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-left hover:bg-glass-strong transition-colors"
                  >
                    <Checkbox
                      checked={on}
                      className={on ? color.dot : undefined}
                    />
                    <span className="truncate">{s.studentName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <StatsCard
        lessons={rangeLessons}
        rangeLabel={rangeLabel}
        onPickStudent={(id) =>
          onHiddenChange(
            new Set(students.map((s) => s.studentId).filter((x) => x !== id)),
          )
        }
      />
    </div>
  );
}
