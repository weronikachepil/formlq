"use client";

import Link from "next/link";
import { ArrowRight, Clock, FileText, UserRound, Users } from "lucide-react";
import { pluralize, PLURAL, scoreColor, scoreColorPct } from "@/lib/format";
import { SUBJECT_LABEL, isExamFailed, type TestDoc, type TestResult } from "@/lib/tests";
import { cn } from "@/lib/utils";
import { Highlight } from "@/components/ui/highlight";

/** A below-threshold attempt still carries the scale's 100 but counts for nothing. */
const counted = (r: TestResult) => !isExamFailed(r.rawScore, r.scaleType ?? "nmt");

/** Rank: counted before not counted, then scaled score, then raw points. */
const rank = (r: TestResult): [number, number, number] => [counted(r) ? 1 : 0, r.nmtScore, r.rawScore];
const better = (a: TestResult, b: TestResult) => {
  const [x, y] = [rank(a), rank(b)];
  return x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];
};

/** Best attempt per test. */
export function bestByTest(results: TestResult[]): Map<string, TestResult> {
  const best = new Map<string, TestResult>();
  for (const r of results) {
    if (r.homeworkId) continue; // homework attempts belong to the homework, not the catalog
    const prev = best.get(r.testId);
    if (!prev || better(r, prev)) best.set(r.testId, r);
  }
  return best;
}

/**
 * Catalog card. Title leads; the author shows only for teachers' tests (platform
 * tests are the default, so a "НМТ" chip on every card said nothing); the best
 * score is labelled, not colour-only; the action is always visible.
 */
export function TestCard({ test, best, query = "" }: { test: TestDoc; best?: TestResult; query?: string }) {
  const nmt = (test.scaleType ?? "nmt") === "nmt";
  const notCounted = !!best && !counted(best);
  const score = best && !notCounted
    ? nmt
      ? scoreColor(best.nmtScore)
      : scoreColorPct(best.maxRaw ? (best.rawScore / best.maxRaw) * 100 : 0)
    : null;

  return (
    <Link
      href={`/dashboard/exam/${test.id}`}
      className="group rounded-[18px] border border-border/50 bg-card p-4 flex flex-col gap-3 outline-none hover:border-primary/30 hover:shadow-glass focus-visible:ring-3 focus-visible:ring-ring/40 transition-[border-color,box-shadow]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {test.personal && (
            <p className="mb-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
              <UserRound size={12} className="shrink-0" />
              <span className="truncate">
                <Highlight text={test.authorName || "Викладач"} query={query} />
              </span>
            </p>
          )}
          <p className="font-heading font-bold text-[15px] leading-snug line-clamp-2">
            <Highlight text={test.title} query={query} />
          </p>
          {test.subtitle && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              <Highlight text={test.subtitle} query={query} />
            </p>
          )}
        </div>
        {notCounted && (
          <div className="shrink-0 text-right" title="Жодна спроба не подолала поріг">
            <p className="font-heading text-lg font-bold leading-none text-muted-foreground">—</p>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground">не зараховано</p>
          </div>
        )}
        {best && score && (
          <div className="shrink-0 text-right" title="Ваш найкращий результат">
            <p className={cn("font-heading text-lg font-bold leading-none tabular-nums", score.text)}>
              {nmt ? best.nmtScore : `${best.rawScore}/${best.maxRaw}`}
            </p>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground">найкращий</p>
          </div>
        )}
      </div>

      {(test.grade || test.subject) && (
        <div className="flex flex-wrap gap-1.5">
          {test.grade && (
            <span className="rounded-[6px] bg-muted px-1.5 py-0.5 text-[11px] font-medium">{test.grade} клас</span>
          )}
          {test.subject && (
            <span className="rounded-[6px] bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              {SUBJECT_LABEL[test.subject]}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-border/50 pt-3 text-xs text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1">
          <FileText size={12} /> {pluralize(test.questions?.length ?? 0, PLURAL.question)}
        </span>
        {test.durationMinutes && (
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {test.durationMinutes} хв
          </span>
        )}
        {!!test.takers && (
          <span className="inline-flex items-center gap-1" title="Скільки людей уже пройшли цей тест">
            <Users size={12} /> {pluralize(test.takers, ["людина", "людини", "людей"])}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground/80 group-hover:text-foreground">
          {best ? "Ще раз" : "Почати"}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
