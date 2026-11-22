"use client";

import { useMemo } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { Homework } from "@/lib/tutor";
import { isExamFailed, maxScaledScore, type TestResult } from "@/lib/tests";
import { cn } from "@/lib/utils";

/** How many latest results the chart shows. */
const CHART_LIMIT = 12;
/** Size of the two windows compared for the trend (latest N vs the N before). */
const TREND_WINDOW = 3;

interface Point {
  id: string;
  title: string;
  /** Share of the maximum raw score, 0–100 — comparable across scales. */
  pct: number;
  score: string;
  at: number;
  href: string;
}

interface ResultsProgressProps {
  homework: Homework[];
  /** Saved attempts by result id. */
  results: Map<string, TestResult>;
  /** Where a bar leads for a given homework. */
  hrefOf: (hw: Homework) => string;
}

function scoreLabel(r: TestResult): string {
  const scale = r.scaleType ?? "nmt";
  if (isExamFailed(r.rawScore, scale)) return "не зараховано";
  if (scale === "nmt") return `${r.nmtScore} НМТ`;
  const max = maxScaledScore(r.scoreTable ?? []);
  return max ? `${r.nmtScore} / ${max}` : `${r.nmtScore}`;
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Progress over completed homework: average, best, trend and a per-attempt chart. */
export function ResultsProgress({ homework, results, hrefOf }: ResultsProgressProps) {
  const points = useMemo<Point[]>(() => {
    const list: Point[] = [];
    for (const hw of homework) {
      if (hw.status !== "completed" || !hw.resultId) continue;
      const r = results.get(hw.resultId);
      if (!r || !r.maxRaw) continue;
      list.push({
        id: hw.id,
        title: hw.title,
        pct: Math.max(0, Math.min(100, Math.round((r.rawScore / r.maxRaw) * 100))),
        score: scoreLabel(r),
        at: r.completedAt?.toMillis() ?? hw.dueAt?.toMillis() ?? 0,
        href: hrefOf(hw),
      });
    }
    return list.sort((a, b) => a.at - b.at);
  }, [homework, results, hrefOf]);

  if (points.length === 0) return null;

  const pcts = points.map((p) => p.pct);
  const average = Math.round(avg(pcts));
  const best = Math.max(...pcts);
  const trend =
    points.length >= TREND_WINDOW * 2
      ? Math.round(avg(pcts.slice(-TREND_WINDOW)) - avg(pcts.slice(-TREND_WINDOW * 2, -TREND_WINDOW)))
      : null;
  const shown = points.slice(-CHART_LIMIT);

  const last = shown[shown.length - 1];

  return (
    <div className="rounded-[18px] border border-border/50 bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-heading font-bold text-base leading-tight">Прогрес за результатами</p>
          <p className="text-xs text-muted-foreground mt-1">Частка набраних балів у виконаних завданнях</p>
        </div>
        <div className="flex gap-6 text-center">
          <Stat value={`${average}%`} label="середній" />
          <Stat value={`${best}%`} label="найкращий" />
          {trend !== null && (
            <div title={`Середнє останніх ${TREND_WINDOW} проти ${TREND_WINDOW} попередніх, у відсоткових пунктах`}>
              <p
                className={cn(
                  "inline-flex items-center gap-1 font-heading text-2xl font-bold leading-none tabular-nums",
                  trend > 0 && "text-green-600 dark:text-green-400",
                  trend < 0 && "text-red-600 dark:text-red-400",
                  trend === 0 && "text-muted-foreground",
                )}
              >
                {trend > 0 ? <TrendingUp size={16} /> : trend < 0 ? <TrendingDown size={16} /> : null}
                {trend === 0 ? "=" : `${trend > 0 ? "+" : "−"}${Math.abs(trend)}`}
              </p>
              {/* A bare "0" read as "no progress at all"; say what it measures. */}
              <p className="text-[11px] text-muted-foreground mt-1">
                {trend === 0 ? "без змін" : "зміна, п.п."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {/* Recessive y-axis: only the guides that carry meaning. */}
        <div className="relative h-36 w-8 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums" aria-hidden>
          {/* Fixed ticks give way to the average when they'd collide with it. */}
          {average < 92 && <span className="absolute right-0 top-0 -translate-y-1/2">100%</span>}
          {Math.abs(average - 50) >= 8 && <span className="absolute right-0 top-1/2 -translate-y-1/2">50%</span>}
          <span className="absolute right-0 translate-y-1/2 font-semibold text-foreground" style={{ bottom: `${average}%` }}>
            сер.
          </span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-border/60" aria-hidden />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/40" aria-hidden />
          {/* Average as a reference line, labelled at the right end. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed border-foreground/60"
            style={{ bottom: `${average}%` }}
            aria-hidden
          />
          <div
            className="relative h-36 flex items-end gap-1.5 border-b border-border"
            role="list"
            aria-label="Результати по завданнях"
          >
            {shown.map((p) => {
              const isLast = p === last;
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  role="listitem"
                  aria-label={`${p.title}: ${p.score}, ${p.pct}%`}
                  className="group relative flex-1 max-w-24 h-full flex items-end outline-none"
                >
                  <span
                    className={cn(
                      "relative w-full rounded-t-[6px] transition-colors group-hover:bg-primary group-focus-visible:bg-primary",
                      // Soft lavender history, the latest result in ink.
                      isLast ? "bg-primary" : "bg-lavender",
                    )}
                    style={{ height: `${Math.max(p.pct, 2)}%` }}
                  >
                    {/* Selective direct label: only the latest result. */}
                    {isLast && (
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-semibold tabular-nums group-hover:invisible">
                        {p.pct}%
                      </span>
                    )}
                  </span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 hidden group-hover:block group-focus-visible:block w-max max-w-48 rounded-[10px] border border-border/60 bg-popover text-popover-foreground px-2.5 py-1.5 text-[11px] shadow-md">
                    <span className="block font-semibold truncate">{p.title}</span>
                    <span className="block text-muted-foreground tabular-nums">
                      {p.score} · {p.pct}%{p.at ? ` · ${shortDate(p.at)}` : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 tabular-nums">
            <span>
              {shown[0].at ? shortDate(shown[0].at) : "Раніше"}
              {shown.length < points.length && ` · останні ${shown.length} з ${points.length}`}
            </span>
            <span>{last.at ? shortDate(last.at) : "Нещодавно"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString("uk", { day: "numeric", month: "short" });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-heading text-2xl font-bold leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
