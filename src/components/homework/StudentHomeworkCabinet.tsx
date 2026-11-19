"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Homework } from "@/lib/tutor";
import type { TestResult } from "@/lib/tests";
import { remainingMistakes } from "@/lib/homework-runner";
import { groupHomework, isHomeworkOverdue, summarizeHomework } from "@/lib/homework-status";
import { dayKey, sameDay } from "@/lib/calendar";
import { plural, pluralize, PLURAL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionLabel } from "@/components/ui/section-label";
import { MiniCalendar, type MiniCalendarTone } from "@/components/calendar/MiniCalendar";
import { StudentHomeworkItem } from "./StudentHomeworkItem";
import { ResultsProgress } from "./ResultsProgress";

const studentHomeworkHref = (hw: Homework) => `/dashboard/homework/${hw.id}`;

type Filter = "open" | "done" | "mistakes" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "До виконання" },
  { id: "done", label: "Виконані" },
  { id: "mistakes", label: "Робота над помилками" },
  { id: "all", label: "Усі" },
];

interface StudentHomeworkCabinetProps {
  homework: Homework[];
  /** Saved attempts by result id (for scores of completed homework). */
  results: Map<string, TestResult>;
  now: number;
}

/** Student's homework cabinet: counters, filters, deadline calendar, grouped list. */
export function StudentHomeworkCabinet({ homework, results, now }: StudentHomeworkCabinetProps) {
  const [filter, setFilter] = useState<Filter>("open");
  const [day, setDay] = useState<Date | null>(null);

  const multiTutor = useMemo(() => new Set(homework.map((h) => h.tutorId)).size > 1, [homework]);
  const summary = useMemo(() => summarizeHomework(homework, now), [homework, now]);
  const resultOf = (hw: Homework) => (hw.resultId ? results.get(hw.resultId) : undefined);
  const mistakesOf = (hw: Homework) => remainingMistakes(hw, results);

  // A picked calendar day narrows the list to homework due that day (any state).
  const groups = useMemo(() => {
    const list = day ? homework.filter((h) => h.dueAt && sameDay(h.dueAt.toDate(), day)) : homework;
    const g = groupHomework(list, now);
    // Completed: newest first (submission time, else deadline / assignment).
    const doneAt = (h: Homework) =>
      (h.resultId ? results.get(h.resultId)?.completedAt?.toMillis() : undefined) ??
      h.dueAt?.toMillis() ??
      h.assignedAt?.toMillis() ??
      0;
    g.done.sort((a, b) => doneAt(b) - doneAt(a));
    return g;
  }, [homework, now, day, results]);

  const marks = useMemo(() => {
    const map = new Map<string, MiniCalendarTone[]>();
    for (const hw of homework) {
      if (!hw.dueAt) continue;
      const tone: MiniCalendarTone =
        hw.status === "completed" ? "done" : isHomeworkOverdue(hw, now) ? "danger" : "active";
      const key = dayKey(hw.dueAt.toDate());
      map.set(key, [...(map.get(key) ?? []), tone]);
    }
    return map;
  }, [homework, now]);

  const sections: { key: string; label: string; items: Homework[]; overdue?: boolean }[] = [];
  const effective: Filter = day ? "all" : filter;
  if (effective === "mistakes") {
    sections.push({
      key: "mistakes",
      label: "Робота над помилками",
      items: groups.done.filter((hw) => mistakesOf(hw) > 0),
    });
  } else if (effective !== "done") {
    sections.push({ key: "overdue", label: "Прострочені", items: groups.overdue, overdue: true });
    sections.push({ key: "active", label: "До виконання", items: groups.active });
  }
  if (effective === "done" || effective === "all") sections.push({ key: "done", label: "Виконані", items: groups.done });
  const shown = sections.filter((s) => s.items.length);

  const pending = summary.active + summary.overdue;
  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  if (homework.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          emoji="📭"
          title="Немає домашніх завдань"
          description="Коли вчитель призначить завдання, воно зʼявиться тут."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-lg leading-tight">
              {pending === 0
                ? "Усе виконано 🎉"
                : `${pluralize(pending, PLURAL.task)} ${plural(pending, ["чекає", "чекають", "чекають"])} на вас`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Виконано {summary.done} з {summary.total}
            </p>
          </div>
          <div className="flex gap-5 text-center">
            <Counter value={summary.active} label="до виконання" />
            <Counter value={summary.overdue} label="прострочені" danger={summary.overdue > 0} />
            <Counter value={summary.done} label="виконані" />
          </div>
        </div>
        <div
          className="h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Виконано"
        >
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ResultsProgress homework={homework} results={results} hrefOf={studentHomeworkHref} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] items-start">
        <div className="space-y-5 min-w-0">
          {day ? (
            <button
              type="button"
              onClick={() => setDay(null)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              Дедлайн {day.toLocaleDateString("uk", { day: "numeric", month: "long" })}
              <X size={13} />
            </button>
          ) : (
            <div className="inline-flex flex-wrap rounded-full bg-muted p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={cn(
                    "px-3.5 h-8 rounded-full text-xs font-semibold transition-colors",
                    filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            day ? (
              <EmptyState
                emoji="📅"
                title="На цей день завдань немає"
                description="Оберіть інший день або зніміть фільтр."
              />
            ) : (
              <EmptyState
                emoji={filter === "open" ? "🎉" : filter === "mistakes" ? "💪" : "📭"}
                title={
                  filter === "open"
                    ? "Усе виконано"
                    : filter === "mistakes"
                      ? "Помилок немає"
                      : "Виконаних ще немає"
                }
                description={
                  filter === "open"
                    ? "Нових завдань поки немає — гарна робота!"
                    : filter === "mistakes"
                      ? "Тут зʼявляться виконані тести, у яких є помилки."
                      : undefined
                }
              />
            )
          ) : (
            shown.map((s) => (
              <div key={s.key} className="space-y-2">
                <SectionLabel size="2xs" className={s.overdue ? "text-red-600 dark:text-red-400" : undefined}>
                  {s.label} ({s.items.length})
                </SectionLabel>
                {s.items.map((hw) => (
                  <StudentHomeworkItem
                    key={hw.id}
                    hw={hw}
                    now={now}
                    result={resultOf(hw)}
                    showTutor={multiTutor}
                    overdue={s.overdue}
                    mistakes={s.key === "mistakes" ? mistakesOf(hw) : undefined}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-20 order-first lg:order-none">
          <MiniCalendar
            marks={marks}
            selected={day}
            onSelect={setDay}
            legend={[
              { tone: "active", label: "до виконання" },
              { tone: "danger", label: "прострочене" },
              { tone: "done", label: "виконане" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Counter({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return (
    <div>
      <p className={cn("text-xl font-bold font-mono leading-none", danger && "text-red-600 dark:text-red-400")}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
