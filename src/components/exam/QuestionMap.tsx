"use client";

import { cn } from "@/lib/utils";
import { balanced } from "@/components/exam/QuestionNav";

interface Question {
  id?: string;
  isCorrect?: boolean;
  userAnswer?: string;
  partialScore?: number;
  points?: number;
}

export type QuestionStatus = "correct" | "partial" | "wrong" | "skipped";

export function questionStatus(q: Question): QuestionStatus {
  if (q.isCorrect) return "correct";
  if ((q.partialScore ?? 0) > 0) return "partial";
  if (!q.userAnswer) return "skipped";
  return "wrong";
}

const STATUS_ORDER: QuestionStatus[] = ["correct", "partial", "wrong", "skipped"];
// Same words as the status chips on the question cards.
const STATUS_LABEL: Record<QuestionStatus, string> = {
  correct: "Вірно",
  partial: "Частково",
  wrong: "Невірно",
  skipped: "Пропущено",
};
const STATUS_STYLE: Record<QuestionStatus, string> = {
  correct: "bg-green-500/15 border-green-600/30 text-green-700 dark:text-green-300",
  partial: "bg-amber-500/15 border-amber-600/30 text-amber-700 dark:text-amber-300",
  wrong: "bg-red-500/12 border-red-500/35 text-red-600 dark:text-red-300",
  skipped: "bg-card border-border/60 text-muted-foreground",
};

interface QuestionMapProps {
  questions: Question[];
  /** Default: scroll to the element with id `q-<index>`. */
  onSelect?: (index: number) => void;
  highlightIdx?: number | null;
  /** Question ids marked with the duck. */
  flagged?: string[];
}

/**
 * Result map: a legend with counts (colour is never the only cue), then the
 * numbered tiles in balanced full-width rows — the same tiles as during the test.
 */
export function QuestionMap({ questions, onSelect, highlightIdx = null, flagged = [] }: QuestionMapProps) {
  const counts: Record<QuestionStatus, number> = { correct: 0, partial: 0, wrong: 0, skipped: 0 };
  for (const q of questions) counts[questionStatus(q)]++;

  const select =
    onSelect ??
    ((i: number) => document.getElementById(`q-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));

  return (
    <div className="space-y-2.5">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STATUS_ORDER.filter((st) => counts[st] > 0).map((st) => (
          <li key={st} className="inline-flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-[3px] border", STATUS_STYLE[st])} />
            {STATUS_LABEL[st]} <b className="text-foreground tabular-nums">{counts[st]}</b>
          </li>
        ))}
      </ul>
      <ol
        aria-label="Завдання"
        className="grid gap-1.5 grid-cols-[repeat(var(--cols-phone),minmax(0,1fr))] sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        style={
          {
            "--cols": balanced(questions.length, 16),
            "--cols-phone": balanced(questions.length, 8),
          } as React.CSSProperties
        }
      >
        {questions.map((q, i) => {
          const st = questionStatus(q);
          return (
            <li key={q.id ?? i}>
              <button
                type="button"
                onClick={() => select(i)}
                aria-label={`Завдання ${i + 1}: ${STATUS_LABEL[st].toLowerCase()}`}
                className={cn(
                  "relative w-full h-9 rounded-[10px] border text-xs font-bold tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  STATUS_STYLE[st],
                  highlightIdx === i && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {i + 1}
                {q.id && flagged.includes(q.id) && <span className="absolute -top-1.5 -right-1.5 text-[10px]">🦆</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
