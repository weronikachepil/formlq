import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, FileText, GraduationCap } from "lucide-react";
import type { Homework } from "@/lib/tutor";
import { formatDueCountdown } from "@/lib/homework-status";
import { isExamFailed, maxScaledScore, type TestResult } from "@/lib/tests";
import { formatDate, pluralize, PLURAL, scoreColor, scoreColorPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StudentHomeworkItemProps {
  hw: Homework;
  now: number;
  /** Saved attempt of completed homework (for the score), if loaded. */
  result?: TestResult;
  /** Show the tutor's name (student has several tutors). */
  showTutor?: boolean;
  overdue?: boolean;
  /** Mistakes in the attempt — shown in the «Робота над помилками» list. */
  mistakes?: number;
}

/** Score chip for a completed attempt: "172 НМТ" / "9 / 12". */
function ScoreChip({ result }: { result: TestResult }) {
  const isNmt = (result.scaleType ?? "nmt") === "nmt";
  if (isExamFailed(result.rawScore, result.scaleType ?? "nmt")) {
    return (
      <span className="shrink-0 inline-flex flex-col items-center justify-center w-14 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
        <span className="text-sm font-bold leading-none">✕</span>
        <span className="text-[9px] font-semibold mt-0.5">НЕ СКЛАВ</span>
      </span>
    );
  }
  const max = isNmt ? 200 : maxScaledScore(result.scoreTable ?? []);
  const pct = max ? (result.nmtScore / max) * 100 : 0;
  const { text, bg } = isNmt ? scoreColor(result.nmtScore) : scoreColorPct(pct);
  return (
    <span
      className={cn("shrink-0 inline-flex flex-col items-center justify-center min-w-14 h-11 px-2 rounded-xl", bg, text)}
      title="Результат"
    >
      <span className="text-base font-bold leading-none tabular-nums font-mono">
        {result.nmtScore}
        {!isNmt && max ? <span className="text-[10px] font-semibold opacity-70">/{max}</span> : null}
      </span>
      <span className="text-[9px] font-semibold mt-0.5">{isNmt ? "НМТ" : "БАЛ"}</span>
    </span>
  );
}

/** Homework row in the student's cabinet: countdown, tutor, конспект badge, CTA or score. */
export function StudentHomeworkItem({ hw, now, result, showTutor, overdue, mistakes }: StudentHomeworkItemProps) {
  const done = hw.status === "completed";
  const due = hw.dueAt?.toMillis();
  const when = done
    ? result?.completedAt
      ? `Здано ${formatDate(result.completedAt, { day: "numeric", month: "short" })}`
      : "Виконано"
    : due !== undefined
      ? formatDueCountdown(due, now)
      : "Без дедлайну";
  // Deadline today → amber, so it stands out from the far ones.
  const soon = !done && !overdue && due !== undefined && due - now < 24 * 3600000;

  return (
    <Link
      href={`/dashboard/homework/${hw.id}`}
      className={cn(
        "group w-full rounded-2xl border bg-card px-4 py-3 flex items-center gap-3 transition-all",
        overdue
          ? "border-red-500/30 hover:border-red-500/50"
          : "border-border/50 hover:border-border/80 hover:bg-muted/30",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate">{hw.title}</span>
          {hw.pdfUrl && (
            <span
              title="Є конспект (PDF)"
              className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-semibold"
            >
              <FileText size={10} /> PDF
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              overdue && "text-red-600 dark:text-red-400",
              soon && "text-amber-600 dark:text-amber-400",
            )}
          >
            {done ? <CheckCircle2 size={11} /> : <CalendarClock size={11} />}
            {when}
          </span>
          {!!mistakes && (
            <span className="font-medium text-red-600 dark:text-red-400">
              {pluralize(mistakes, PLURAL.mistake)}
            </span>
          )}
          {showTutor && hw.tutorName && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <GraduationCap size={12} className="shrink-0" />
              <span className="truncate">{hw.tutorName}</span>
            </span>
          )}
        </p>
      </div>

      {done ? (
        result ? (
          <ScoreChip result={result} />
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-green-600 dark:text-green-400 bg-green-500/10">
            <CheckCircle2 size={12} /> <span className="hidden sm:inline">Переглянути</span>
          </span>
        )
      ) : (
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-xs font-semibold transition-all group-hover:gap-1.5",
            hw.status === "in_progress"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-primary text-primary-foreground shadow-pill-dark",
          )}
        >
          {hw.status === "in_progress" ? "Продовжити" : "Почати"}
          <ArrowRight size={13} />
        </span>
      )}
    </Link>
  );
}
