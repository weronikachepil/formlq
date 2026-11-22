import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreColor, scoreColorPct, formatDuration, formatDate } from "@/lib/format";
import { maxScaledScore, isExamFailed, type TestResult } from "@/lib/tests";

interface ResultListItemProps {
  result: TestResult;
  href: string;
  /** On the test's own page: the title is already above, so the date leads. */
  hideTitle?: boolean;
}

/**
 * One attempt: score badge, what/when, correct count and time. Below the NMT
 * threshold the badge says "не зар." in grey — same wording as the result page,
 * no red cross, no gendered "не склав".
 */
export function ResultListItem({ result, href, hideTitle = false }: ResultListItemProps) {
  const isNmt = (result.scaleType ?? "nmt") === "nmt";
  const maxScaled = isNmt ? 200 : maxScaledScore(result.scoreTable ?? []);
  const scaledPct = maxScaled ? (result.nmtScore / maxScaled) * 100 : 0;
  const { text, bg } = isNmt ? scoreColor(result.nmtScore) : scoreColorPct(scaledPct);
  const questions = result.questions ?? [];
  const correct = questions.filter((q) => q.isCorrect).length;
  const failed = isExamFailed(result.rawScore, result.scaleType ?? "nmt");

  const stats = (
    <>
      <span className="tabular-nums">
        <b className="font-semibold text-foreground">{correct}</b> з {questions.length} вірно
      </span>
      {result.timeSpent ? (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock size={11} />
          {formatDuration(result.timeSpent)}
        </span>
      ) : null}
    </>
  );

  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-[14px] border border-border/50 bg-card px-4 py-3 outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div
        className={cn(
          "w-12 h-12 shrink-0 rounded-[10px] flex flex-col items-center justify-center",
          // Neutral, so it never reads like an amber 140–159 score.
          failed ? "bg-muted text-muted-foreground" : cn(bg, text),
        )}
      >
        <span className="font-heading text-lg font-bold leading-none tabular-nums">{failed ? "—" : result.nmtScore}</span>
        <span className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-wide">
          {failed ? "не зар." : isNmt ? "НМТ" : "бал"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {hideTitle ? (
          <p className="text-sm font-semibold tabular-nums">{formatDate(result.completedAt)}</p>
        ) : (
          <>
            <p className="truncate text-sm font-semibold">{result.testTitle || "Без назви"}</p>
            {result.testSubtitle && <p className="truncate text-xs text-muted-foreground">{result.testSubtitle}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatDate(result.completedAt)}</p>
          </>
        )}
        {/* Phones: stats under the text instead of a right column. */}
        <p className="mt-0.5 flex gap-3 text-xs text-muted-foreground sm:hidden">{stats}</p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground sm:flex">{stats}</div>

      <ChevronRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </Link>
  );
}
