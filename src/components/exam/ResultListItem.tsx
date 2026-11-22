import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreColor, scoreColorPct, formatDuration, formatDate } from "@/lib/format";
import { maxScaledScore, isExamFailed, type TestResult } from "@/lib/tests";

interface ResultListItemProps {
  result: TestResult;
  href: string;
  /** On the test's own page: the title is already above, so the date leads. */
  hideTitle?: boolean;
  /** Inside a white group card (history): a soft grey row instead of a white card. */
  inset?: boolean;
}

/** "22 лист., 12:24" — the year only when it isn't this year. */
function shortDate(result: TestResult): string {
  const d = result.completedAt?.toDate();
  if (!d) return formatDate(result.completedAt);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("uk", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * One attempt as a list row: the score in a coloured circle, what and when, how many
 * were right and how long it took. Below the NMT threshold the circle shows «—» in grey
 * and a grey «Не зараховано» badge explains it (no red cross, no gendered «не склав»).
 */
export function ResultListItem({ result, href, hideTitle = false, inset = false }: ResultListItemProps) {
  const isNmt = (result.scaleType ?? "nmt") === "nmt";
  const maxScaled = isNmt ? 200 : maxScaledScore(result.scoreTable ?? []);
  const scaledPct = maxScaled ? (result.nmtScore / maxScaled) * 100 : 0;
  const { text, bg } = isNmt ? scoreColor(result.nmtScore) : scoreColorPct(scaledPct);
  const questions = result.questions ?? [];
  const correct = questions.filter((q) => q.isCorrect).length;
  const failed = isExamFailed(result.rawScore, result.scaleType ?? "nmt");

  const facts = [
    hideTitle ? null : shortDate(result),
    `${correct} з ${questions.length} вірно`,
    result.timeSpent ? formatDuration(result.timeSpent) : null,
  ].filter(Boolean);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-[14px] px-4 py-3 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
        inset ? "bg-muted/50 hover:bg-muted" : "bg-card hover:shadow-[0_8px_28px_rgba(20,38,42,0.08)]",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full font-heading text-[15px] font-bold",
          // Neutral, so it never reads like an amber 140–159 score.
          failed ? (inset ? "bg-card text-muted-foreground" : "bg-muted text-muted-foreground") : cn(bg, text),
        )}
        title={failed ? "Не зараховано" : isNmt ? "Бал НМТ" : "Бал"}
      >
        {failed ? "—" : result.nmtScore}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {hideTitle ? shortDate(result) : result.testTitle || "Без назви"}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{facts.join(" · ")}</span>
      </span>

      {failed && (
        <span
          className={cn(
            "hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline",
            inset ? "bg-card" : "bg-muted",
          )}
        >
          Не зараховано
        </span>
      )}

      <ChevronRight
        size={18}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </Link>
  );
}
