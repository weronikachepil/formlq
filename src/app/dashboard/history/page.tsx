"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { useAuth } from "@/context/AuthContext";
import { getUserResults, isExamFailed, type TestResult } from "@/lib/tests";
import { addDays, startOfDay, startOfWeek } from "@/lib/calendar";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ResultListItem } from "@/components/exam/ResultListItem";

/** «Сьогодні», «Вчора», «Цього тижня», then the month: «Жовтень 2026». */
function groupName(ms: number, now: Date): string {
  const today = startOfDay(now).getTime();
  if (ms >= today) return "Сьогодні";
  if (ms >= addDays(new Date(today), -1).getTime()) return "Вчора";
  if (ms >= startOfWeek(now).getTime()) return "Цього тижня";
  const month = new Date(ms).toLocaleDateString("uk", { month: "long", year: "numeric" }).replace(" р.", "");
  return month.charAt(0).toUpperCase() + month.slice(1);
}

/** Attempts (newest first) split into date groups, in order. */
function groupByDate(results: TestResult[]): { name: string; items: TestResult[] }[] {
  const now = new Date();
  const map = new Map<string, TestResult[]>();
  for (const r of results) {
    const name = groupName(r.completedAt?.toMillis() ?? 0, now);
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(r);
  }
  return [...map].map(([name, items]) => ({ name, items }));
}

export default function HistoryPage() {
  const { user } = useAuth();

  const { data: results = [], isLoading } = useQuery({
    queryKey: queryKeys.results(user?.uid),
    queryFn: () => getUserResults(user!.uid),
    enabled: !!user,
    staleTime: STALE.short,
  });

  const groups = useMemo(() => groupByDate(results), [results]);
  const stats = useMemo(() => {
    // Counted NMT attempts only: below the threshold the 100 means nothing.
    const nmt = results
      .filter((r) => (r.scaleType ?? "nmt") === "nmt" && !isExamFailed(r.rawScore, "nmt"))
      .map((r) => r.nmtScore);
    return [
      { label: "Спроб", value: String(results.length) },
      { label: "Різних тестів", value: String(new Set(results.map((r) => r.testId)).size) },
      { label: "Найкращий бал НМТ", value: nmt.length ? String(Math.max(...nmt)) : "—" },
      {
        label: "Середній бал НМТ",
        value: nmt.length ? String(Math.round(nmt.reduce((a, b) => a + b, 0) / nmt.length)) : "—",
      },
    ];
  }, [results]);

  if (isLoading) return <SpinnerPage />;
  if (results.length === 0) {
    return (
      <EmptyState emoji="📋" title="Ще немає результатів" description="Пройдіть перший тест і він з'явиться тут" />
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <section className="rounded-[18px] bg-card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-mint text-[#14262a]">
            <History size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-bold sm:text-2xl">Мої результати</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Бал, кількість правильних відповідей і час кожної спроби</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[12px] bg-muted/70 px-3 py-2.5">
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              <p className="font-heading text-xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.name} className="space-y-3 rounded-[18px] bg-card p-4 sm:p-6">
          <h2 className="px-1 font-heading text-lg font-bold">
            {g.name}
            <span className="ml-2 text-sm font-medium text-muted-foreground">{g.items.length}</span>
          </h2>
          <div className="space-y-2">
            {g.items.map((r) => (
              <ResultListItem key={r.id} result={r} href={`/dashboard/results/${r.id}`} inset />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
