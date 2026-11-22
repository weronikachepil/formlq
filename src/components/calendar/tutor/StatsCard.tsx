"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Lesson, groupLessonKey, lessonStatus } from "@/lib/lessons";
import { useStudentColor } from "./student-colors";

export interface RangeStats {
  count: number;
  hours: number;
  earned: number;
  unpaid: number;
  debtors: { studentId: string; studentName: string; amount: number; lessons: number }[];
}

/**
 * Totals for the lessons of the visible range (cancelled ones don't count). A group lesson
 * counts once for lessons and hours; its money is per member's copy (each pays separately).
 */
export function computeStats(lessons: Lesson[]): RangeStats {
  const s: RangeStats = { count: 0, hours: 0, earned: 0, unpaid: 0, debtors: [] };
  const debt = new Map<string, RangeStats["debtors"][number]>();
  const counted = new Set<string>();
  for (const l of lessons) {
    const status = lessonStatus(l);
    if (status === "canceled") continue;
    const key = groupLessonKey(l);
    if (!key || !counted.has(key)) {
      if (key) counted.add(key);
      s.count++;
      s.hours += l.durationMin / 60;
    }
    if (status !== "done") continue;
    const price = l.price ?? 0;
    s.earned += price;
    if (l.paid || !price) continue;
    s.unpaid += price;
    const d = debt.get(l.studentId) ?? {
      studentId: l.studentId,
      studentName: l.studentName ?? "Учень",
      amount: 0,
      lessons: 0,
    };
    d.amount += price;
    d.lessons++;
    debt.set(l.studentId, d);
  }
  s.debtors = [...debt.values()].sort((a, b) => b.amount - a.amount);
  return s;
}

const uah = (n: number) => `${n.toLocaleString("uk")} ₴`;
const hoursLabel = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ","));

interface StatsCardProps {
  lessons: Lesson[];
  rangeLabel: string;
  onPickStudent: (studentId: string) => void;
}

export function StatsCard({ lessons, rangeLabel, onPickStudent }: StatsCardProps) {
  const studentColor = useStudentColor();
  const s = useMemo(() => computeStats(lessons), [lessons]);
  const tiles = [
    { label: "Уроків", value: String(s.count) },
    { label: "Годин", value: hoursLabel(s.hours) },
    { label: "Зароблено", value: uah(s.earned) },
    { label: "Не оплачено", value: uah(s.unpaid), alert: s.unpaid > 0 },
  ];

  return (
    <div className="rounded-[18px] border border-border/50 bg-card p-3.5 space-y-2.5">
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-bold">Статистика</h2>
        <p className="text-xs text-muted-foreground first-letter:uppercase">{rangeLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[10px] bg-muted/70 px-2.5 py-1.5">
            <p className="text-[11px] text-muted-foreground">{t.label}</p>
            <p
              className={cn(
                "font-heading font-bold text-base leading-tight tabular-nums",
                t.alert && "text-red-600 dark:text-red-400",
              )}
            >
              {t.value}
            </p>
          </div>
        ))}
      </div>
      {s.debtors.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground px-1">Хто винен</p>
          {s.debtors.map((d) => (
            <button
              key={d.studentId}
              type="button"
              onClick={() => onPickStudent(d.studentId)}
              title="Показати лише цього учня"
              className="w-full flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-glass-strong transition-colors"
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", studentColor(d.studentId).dot)} />
              <span className="flex-1 truncate">{d.studentName}</span>
              <span className="text-[11px] text-muted-foreground">{d.lessons} ур.</span>
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{uah(d.amount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
