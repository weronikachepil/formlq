"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { VIEW_LABEL, type CalendarView } from "./types";

const VIEWS: CalendarView[] = ["day", "week", "month"];

interface CalendarToolbarProps {
  title: string;
  view: CalendarView;
  onView: (v: CalendarView) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** "+ Урок" button; omitted on read-only calendars. */
  onAdd?: () => void;
  canAdd?: boolean;
}

export function CalendarToolbar({
  title,
  view,
  onView,
  onToday,
  onPrev,
  onNext,
  onAdd,
  canAdd,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onToday}>
        Сьогодні
      </Button>
      <div className="flex items-center">
        <IconButton size="md" label="Назад" onClick={onPrev}>
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton size="md" label="Вперед" onClick={onNext}>
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <h2 className="font-heading font-bold text-sm sm:text-lg leading-tight min-w-0 flex-1 truncate first-letter:uppercase">
        {title}
      </h2>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div
          role="tablist"
          aria-label="Вигляд календаря"
          className="flex flex-1 sm:flex-none rounded-full border border-glass-edge bg-glass p-0.5 shadow-pill"
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => onView(v)}
              className={cn(
                "flex-1 sm:flex-none h-7 px-3.5 rounded-full text-xs font-semibold transition-all",
                view === v
                  ? "bg-primary text-primary-foreground shadow-pill-dark"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        {onAdd && (
          <Button size="sm" onClick={onAdd} disabled={!canAdd} className="gap-1">
            <Plus size={15} /> Урок
          </Button>
        )}
      </div>
    </div>
  );
}
