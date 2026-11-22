"use client";

import { useMemo, useState } from "react";
import type { UserProfile } from "@/types";
import { addDays, startOfDay } from "@/lib/calendar";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

interface Day {
  start: Date;
  total: number;
  students: number;
  teachers: number;
}

const SIGNUPS = ["реєстрація", "реєстрації", "реєстрацій"] as const;
const dayLabel = (d: Date) => d.toLocaleDateString("uk", { weekday: "short", day: "numeric", month: "short" });
const shortDate = (d: Date) => d.toLocaleDateString("uk", { day: "numeric", month: "short" });

/** Sign-ups per calendar day for the last `count` days (today last). */
function perDay(users: UserProfile[], count: number, today: Date): Day[] {
  const first = addDays(today, -(count - 1));
  const days: Day[] = Array.from({ length: count }, (_, i) => ({
    start: addDays(first, i),
    total: 0,
    students: 0,
    teachers: 0,
  }));
  const from = first.getTime();
  for (const u of users) {
    const ms = u.createdAt ? u.createdAt.seconds * 1000 : NaN;
    if (!(ms >= from)) continue;
    const i = Math.round((startOfDay(new Date(ms)).getTime() - from) / 86_400_000);
    const d = days[i];
    if (!d) continue;
    d.total++;
    if (u.role === "student") d.students++;
    else d.teachers++;
  }
  return days;
}

/**
 * Admin analytics: how many people registered per day. Hero numbers for today, yesterday
 * and the week (compared with the week before), then a bar per day for the chosen range.
 * Counts come from the user list the page already holds — no extra reads.
 */
export function SignupsChart({ users }: { users: UserProfile[] }) {
  const [range, setRange] = useState<Range>(30);
  // One "today" per render pass; the page re-renders on every user change anyway.
  const [today] = useState(() => startOfDay(new Date()));

  const last90 = useMemo(() => perDay(users, 90, today), [users, today]);
  const days = last90.slice(-range);
  const sum = (list: Day[]) => list.reduce((a, d) => a + d.total, 0);
  const todayN = last90[89].total;
  const yesterdayN = last90[88].total;
  const week = sum(last90.slice(-7));
  const weekBefore = sum(last90.slice(-14, -7));
  const rangeTotal = sum(days);
  const max = Math.max(1, ...days.map((d) => d.total));
  const weekDiff = week - weekBefore;

  const tiles = [
    { label: "Сьогодні", value: todayN },
    { label: "Вчора", value: yesterdayN },
    {
      label: "За 7 днів",
      value: week,
      note:
        weekDiff === 0
          ? "як тиждень тому"
          : `на ${Math.abs(weekDiff)} ${weekDiff > 0 ? "більше" : "менше"}, ніж тиждень тому`,
    },
    { label: `За ${range} днів`, value: rangeTotal },
  ];

  return (
    <section className="rounded-[18px] bg-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">Реєстрації</h2>
        <div role="tablist" aria-label="Період" className="inline-flex rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "h-8 rounded-full px-3.5 text-sm font-semibold transition-colors",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r} днів
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[12px] bg-muted/70 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="font-heading text-2xl font-bold leading-tight">{t.value}</p>
            {t.note && <p className="text-[11px] text-muted-foreground">{t.note}</p>}
          </div>
        ))}
      </div>

      {/* Bars per day: one series, so no legend — the title names it. Top room for the tooltip. */}
      <div className="flex gap-2 pt-10">
        <div className="relative h-40 w-6 shrink-0 text-right text-[11px] text-muted-foreground" aria-hidden>
          <span className="absolute right-0 top-0 -translate-y-1/2">{max}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-40">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" aria-hidden />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/60" aria-hidden />
            <div
              className={cn("relative flex h-full items-end border-b border-border", range === 90 ? "gap-px" : "gap-0.5")}
              role="list"
              aria-label="Реєстрації по днях"
            >
              {days.map((d, i) => {
                const isToday = i === days.length - 1;
                return (
                  <div
                    key={d.start.getTime()}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${dayLabel(d.start)}: ${d.total} ${plural(d.total, [...SIGNUPS])}`}
                    className="group relative flex h-full flex-1 items-end outline-none"
                  >
                    {/* Hit target is the whole column, bigger than the bar. */}
                    <span
                      className={cn(
                        "relative w-full rounded-t-[4px] transition-opacity",
                        "bg-[#8f80e0] dark:bg-[#8a7bdd]",
                        "group-hover:opacity-80 group-focus-visible:opacity-80",
                      )}
                      style={{ height: d.total ? `${(d.total / max) * 100}%` : 0 }}
                    >
                      {/* Selective direct label: today only. */}
                      {isToday && d.total > 0 && (
                        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-semibold group-hover:invisible">
                          {d.total}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-[10px] bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-glass-lg group-hover:block group-focus-visible:block",
                        i < days.length / 2 ? "left-0" : "right-0",
                      )}
                    >
                      <span className="block font-semibold first-letter:uppercase">{dayLabel(d.start)}</span>
                      <span className="block text-muted-foreground">
                        {d.total} {plural(d.total, [...SIGNUPS])}
                        {d.total > 0 && ` · учнів ${d.students} · вчителів ${d.teachers}`}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground" aria-hidden>
            <span>{shortDate(days[0].start)}</span>
            <span>{shortDate(days[Math.floor(days.length / 2)].start)}</span>
            <span>сьогодні</span>
          </div>
        </div>
      </div>

      {/* The same numbers as a table, for screen readers and exact values. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
          Показати таблицею
        </summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">День</th>
              <th className="py-1 text-right font-medium">Усього</th>
              <th className="py-1 text-right font-medium">Учнів</th>
              <th className="py-1 text-right font-medium">Вчителів</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().filter((d) => d.total > 0).map((d) => (
              <tr key={d.start.getTime()} className="border-t border-border/60">
                <td className="py-1 first-letter:uppercase">{dayLabel(d.start)}</td>
                <td className="py-1 text-right font-semibold">{d.total}</td>
                <td className="py-1 text-right">{d.students}</td>
                <td className="py-1 text-right">{d.teachers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
