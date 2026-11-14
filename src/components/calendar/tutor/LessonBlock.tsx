"use client";

import { Check, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lesson, lessonStatus } from "@/lib/lessons";
import { MINUTE_MS, formatHm } from "@/lib/calendar";
import { useStudentColor } from "./student-colors";
import { useCalendarMode } from "./calendar-mode";
import { needsStatus } from "./lesson-utils";

/** Diagonal red hatching for missed lessons. */
export const MISSED_HATCH =
  "repeating-linear-gradient(135deg, transparent 0 6px, rgba(239, 68, 68, 0.16) 6px 12px)";

interface LessonBlockProps {
  lesson: Lesson;
  /** Shown time (may differ from `lesson` while dragging). */
  startMs: number;
  durationMin: number;
  style: React.CSSProperties;
  now: number;
  dragging?: boolean;
  /** Week view: phones hide the status icons to leave room for the text. */
  narrow?: boolean;
  /** Drag start (editable calendar). Without it, a click just opens the lesson. */
  onPointerDown?: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onOpen: (anchor: DOMRect) => void;
}

/** A lesson positioned on the time grid. */
export function LessonBlock({
  lesson,
  startMs,
  durationMin,
  style,
  now,
  dragging,
  narrow,
  onPointerDown,
  onOpen,
}: LessonBlockProps) {
  const studentColor = useStudentColor();
  const mode = useCalendarMode();
  const editable = !mode.readOnly && !!onPointerDown;
  const color = studentColor(mode.colorKey(lesson));
  const status = lessonStatus(lesson);
  const start = new Date(startMs);
  const end = new Date(startMs + durationMin * MINUTE_MS);
  const short = durationMin < 45;
  const time = `${formatHm(start)}–${formatHm(end)}`;
  // Payment and "set the status" hints are for the tutor only.
  const unpaid = !mode.readOnly && status === "done" && !lesson.paid && !!lesson.price;
  const hint = !mode.readOnly && needsStatus(lesson, now);
  const title = mode.lessonTitle(lesson);
  const subtitle = mode.lessonSubtitle(lesson);

  return (
    <div
      data-lesson-block
      role="button"
      tabIndex={0}
      aria-label={`${time} ${title} ${subtitle ?? ""}`}
      title={hint ? "Урок минув — позначте статус" : undefined}
      onPointerDown={editable ? (e) => onPointerDown(e, "move") : undefined}
      onClick={editable ? undefined : (e) => onOpen(e.currentTarget.getBoundingClientRect())}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(e.currentTarget.getBoundingClientRect());
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={style}
      className={cn(
        "absolute rounded-lg bg-popover overflow-hidden select-none touch-manipulation [-webkit-touch-callout:none]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        editable ? "cursor-grab" : "cursor-pointer",
        dragging ? "z-30 shadow-glass-lg ring-2 ring-foreground/30 cursor-grabbing" : "z-10 hover:z-20 hover:shadow-glass",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 border-l-[3px] rounded-lg",
          color.block,
          status === "missed" ? "border-red-500" : color.edge,
          status === "canceled" && "opacity-45",
          hint && "outline-1 outline-dashed -outline-offset-1 outline-amber-500/70",
        )}
        style={status === "missed" ? { backgroundImage: MISSED_HATCH } : undefined}
      />
      <div
        className={cn(
          "relative h-full pl-2 pr-1 text-[11px] leading-tight",
          short ? "py-0.5 flex items-center gap-1 min-w-0" : "py-1 space-y-0.5",
          status === "canceled" && "opacity-60 line-through",
        )}
      >
        {short ? (
          <p className="truncate min-w-0">
            <span className="font-mono text-[10px] opacity-80">{formatHm(start)}</span>{" "}
            <span className="font-semibold">{title}</span>
          </p>
        ) : (
          <>
            <p className="font-mono text-[10px] opacity-80 truncate">{time}</p>
            <p className="font-semibold truncate">{title}</p>
            {durationMin >= 60 && subtitle && <p className="truncate opacity-80">{subtitle}</p>}
          </>
        )}
        <span className={cn("absolute top-1 right-1 flex items-center gap-0.5", narrow && "max-sm:hidden")}>
          {hint && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          {lesson.seriesId && <Repeat size={10} className="opacity-60" aria-label="Щотижня" />}
          {status === "done" && <Check size={12} strokeWidth={3} aria-label="Проведено" />}
          {unpaid && (
            <span
              className="px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-[14px]"
              title="Не оплачено"
            >
              ₴
            </span>
          )}
        </span>
      </div>
      {/* Bottom edge: drag to change the duration. */}
      {editable && (
        <div
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          onPointerDown={(e) => onPointerDown(e, "resize")}
        />
      )}
    </div>
  );
}
