"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Clock, FileText, UserRound, Users } from "lucide-react";
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
      className="group rounded-[18px] bg-card p-5 flex flex-col gap-3 outline-none hover:shadow-[0_8px_28px_rgba(20,38,42,0.08)] focus-visible:ring-3 focus-visible:ring-ring/40 transition-shadow"
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
          <span
            className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
            title="Жодна спроба не подолала поріг"
          >
            Не зараховано
          </span>
        )}
        {best && score && (
          <span
            className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums", score.bg, score.text)}
            title="Ваш найкращий результат"
          >
            {nmt ? best.nmtScore : `${best.rawScore}/${best.maxRaw}`} · найкращий
          </span>
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

      {/* Facts wrap as whole items on narrow cards; «Почати» stays inside the card on the right. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <FileText size={12} className="shrink-0" /> {pluralize(test.questions?.length ?? 0, PLURAL.question)}
        </span>
        {test.durationMinutes && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock size={12} className="shrink-0" /> {test.durationMinutes} хв
          </span>
        )}
        {!!test.takers && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Скільки людей уже пройшли цей тест">
            <Users size={12} className="shrink-0" /> {pluralize(test.takers, ["людина", "людини", "людей"])}
          </span>
        )}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-foreground/80 group-hover:text-foreground">
          {best ? "Ще раз" : "Почати"}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * One test as a numbered list row (catalog grouped lists): number, title, facts,
 * the best score as a coloured badge, chevron.
 */
export function TestRow({
  test,
  index,
  best,
  query = "",
}: {
  test: TestDoc;
  index: number;
  best?: TestResult;
  query?: string;
}) {
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
      className="group flex items-center gap-4 rounded-[14px] bg-muted/50 px-4 py-3.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-sm font-semibold tabular-nums">
        {index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          <Highlight text={test.title} query={query} />
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {test.personal && (
            <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
              <UserRound size={12} />
              <Highlight text={test.authorName || "Викладач"} query={query} />
            </span>
          )}
          <span>{pluralize(test.questions?.length ?? 0, PLURAL.question)}</span>
          {test.durationMinutes && <span>{test.durationMinutes} хв</span>}
          {test.grade && <span>{test.grade} клас</span>}
          {test.subject && <span>{SUBJECT_LABEL[test.subject]}</span>}
          {!!test.takers && (
            <span className="inline-flex items-center gap-1" title="Скільки людей уже пройшли цей тест">
              <Users size={12} /> {pluralize(test.takers, ["людина", "людини", "людей"])}
            </span>
          )}
        </span>
      </span>
      {notCounted && (
        <span
          className="hidden shrink-0 rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline"
          title="Жодна спроба не подолала поріг"
        >
          Не зараховано
        </span>
      )}
      {best && score && (
        <span
          className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums", score.bg, score.text)}
          title="Ваш найкращий результат"
        >
          {nmt ? best.nmtScore : `${best.rawScore}/${best.maxRaw}`}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
