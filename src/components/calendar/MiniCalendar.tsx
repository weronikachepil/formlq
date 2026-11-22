"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTHS, WEEKDAYS, dayKey, monthCells, sameDay } from "@/lib/calendar";
import { IconButton } from "@/components/ui/icon-button";

export type MiniCalendarTone = "danger" | "active" | "done";

const DOT: Record<MiniCalendarTone, string> = {
  danger: "bg-red-500",
  active: "bg-blue-500",
  done: "bg-green-500",
};

interface MiniCalendarProps {
  /** Dots per day, keyed by `dayKey`. */
  marks: Map<string, MiniCalendarTone[]>;
  selected: Date | null;
  onSelect: (day: Date | null) => void;
  /** Short legend under the grid. */
  legend?: { tone: MiniCalendarTone; label: string }[];
  /** Month shown first (default: the current month). */
  initialMonth?: Date;
}

/** Compact month grid with coloured dots under marked days; click a day to select it. */
export function MiniCalendar({ marks, selected, onSelect, legend, initialMonth }: MiniCalendarProps) {
  const today = new Date();
  const [view, setView] = useState(() => {
    const m = initialMonth ?? today;
    return new Date(m.getFullYear(), m.getMonth(), 1);
  });
  const year = view.getFullYear();
  const month = view.getMonth();

  return (
    <div className="rounded-[18px] border border-border/50 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <IconButton label="Попередній місяць" onClick={() => setView(new Date(year, month - 1, 1))}>
          <ChevronLeft size={16} />
        </IconButton>
        <p className="text-xs font-semibold">
          {MONTHS[month]} {year}
        </p>
        <IconButton label="Наступний місяць" onClick={() => setView(new Date(year, month + 1, 1))}>
          <ChevronRight size={16} />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[9px] font-semibold uppercase text-muted-foreground py-1">
            {w}
          </span>
        ))}
        {monthCells(year, month).map((date, i) => {
          if (!date) return <span key={i} />;
          const dots = marks.get(dayKey(date)) ?? [];
          const isSelected = !!selected && sameDay(date, selected);
          const isToday = sameDay(date, today);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(isSelected ? null : date)}
              aria-pressed={isSelected}
              className={cn(
                "h-9 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                    ? "ring-1 ring-primary/50 font-semibold"
                    : dots.length
                      ? "font-semibold hover:bg-muted"
                      : "text-muted-foreground hover:bg-muted",
              )}
            >
              {date.getDate()}
              <span className="flex gap-0.5 h-1">
                {[...new Set(dots)].slice(0, 3).map((t) => (
                  <span key={t} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-primary-foreground" : DOT[t])} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {legend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-1">
          {legend.map((l) => (
            <span key={l.tone} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn("w-1.5 h-1.5 rounded-full", DOT[l.tone])} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
