"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Homework } from "@/lib/tutor";
import { isHomeworkOverdue } from "@/lib/homework-status";
import { useStudentColor } from "./student-colors";
import { useCalendarMode } from "./calendar-mode";

/** Homework deadline marker (all-day row / month cell) → opens the homework. */
export function DeadlineChip({ hw, now, className }: { hw: Homework; now: number; className?: string }) {
  const studentColor = useStudentColor();
  const mode = useCalendarMode();
  const overdue = isHomeworkOverdue(hw, now);
  const done = hw.status === "completed";
  const color = studentColor(mode.colorKey(hw));
  const prefix = mode.deadlinePrefix(hw);
  const owner = mode.deadlineOwner(hw);
  const Icon = done ? CheckCircle2 : ClipboardList;
  return (
    <Link
      href={mode.homeworkHref(hw)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      title={`Дедлайн: ${hw.title}${owner ? ` — ${owner}` : ""}${overdue ? " (прострочено)" : done ? " (виконано)" : ""}`}
      className={cn(
        "flex items-center gap-1 min-w-0 rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-medium transition-opacity hover:opacity-80",
        overdue
          ? "bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-500/40"
          : color.block,
        done && "opacity-60",
        className,
      )}
    >
      <Icon size={10} className="shrink-0" />
      <span className="truncate">
        {prefix ? `${prefix}: ` : ""}
        {hw.title}
      </span>
    </Link>
  );
}
