"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileText, GraduationCap, UserRound } from "lucide-react";
import { pluralize, PLURAL, scoreColor, scoreColorPct } from "@/lib/format";
import { SUBJECT_LABEL, type TestDoc, type TestResult } from "@/lib/tests";
import { cn } from "@/lib/utils";
import { Highlight } from "@/components/ui/highlight";

/** Best attempt per test (by scaled score). */
export function bestByTest(results: TestResult[]): Map<string, TestResult> {
  const best = new Map<string, TestResult>();
  for (const r of results) {
    if (r.homeworkId) continue; // homework attempts belong to the homework, not the catalog
    const prev = best.get(r.testId);
    if (!prev || r.nmtScore > prev.nmtScore) best.set(r.testId, r);
  }
  return best;
}

/** Catalog card: source/author, title, description, grade/subject, best score. */
export function TestCard({ test, best, query = "" }: { test: TestDoc; best?: TestResult; query?: string }) {
  const nmt = (test.scaleType ?? "nmt") === "nmt";
  const score = best
    ? nmt
      ? scoreColor(best.nmtScore)
      : scoreColorPct(best.maxRaw ? (best.rawScore / best.maxRaw) * 100 : 0)
    : null;

  return (
    <Link
      href={`/dashboard/exam/${test.id}`}
      className="group rounded-3xl border border-border/50 bg-card p-5 flex flex-col gap-3 min-h-44 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-glass transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            test.personal ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-primary/10 text-primary",
          )}
        >
          {test.personal ? <UserRound size={12} /> : <GraduationCap size={12} />}
          <span className="truncate max-w-40">
            {test.personal ? <Highlight text={test.authorName || "Викладач"} query={query} /> : "НМТ"}
          </span>
        </span>
        {best && score && (
          <span
            className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", score.bg, score.text)}
            title="Ваш найкращий результат"
          >
            <CheckCircle2 size={12} />
            {nmt ? best.nmtScore : `${best.rawScore}/${best.maxRaw}`}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-base leading-snug line-clamp-2">
          <Highlight text={test.title} query={query} />
        </p>
        {test.subtitle && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            <Highlight text={test.subtitle} query={query} />
          </p>
        )}
      </div>

      {(test.grade || test.subject) && (
        <div className="flex flex-wrap gap-1.5">
          {test.grade && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{test.grade} клас</span>
          )}
          {test.subject && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {SUBJECT_LABEL[test.subject]}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileText size={12} /> {pluralize(test.questions?.length ?? 0, PLURAL.question)}
        </span>
        {test.durationMinutes && (
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {test.durationMinutes} хв
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-x-0">
          {best ? "Ще раз" : "Почати"} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}
