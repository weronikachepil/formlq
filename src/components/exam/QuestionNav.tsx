"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { isAnswered } from "@/lib/exam-scoring";
import type { TestQuestion } from "@/lib/tests";

interface QuestionNavProps {
  questions: TestQuestion[];
  answers: Record<string, string>;
  currentIdx: number;
  onSelect: (index: number) => void;
}

/** Most tiles per row: wide screens / phones. */
const MAX_PER_ROW = 16;
const MAX_PER_ROW_PHONE = 8;

/** Tiles per row so all rows are (nearly) equal: 22 → 11 + 11, not 16 + 6. */
export const balanced = (n: number, max: number) => Math.ceil(n / Math.ceil(n / max));

/**
 * Numbered tiles: current / answered / untouched, in balanced full-width rows.
 */
export const QuestionNav = memo(function QuestionNav({
  questions,
  answers,
  currentIdx,
  onSelect,
}: QuestionNavProps) {
  return (
    <nav aria-label="Завдання">
      <ol
        // Full width, so the tiles line up with the question card below.
        className="grid gap-1.5 grid-cols-[repeat(var(--cols-phone),minmax(0,1fr))] sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        style={
          {
            "--cols": balanced(questions.length, MAX_PER_ROW),
            "--cols-phone": balanced(questions.length, MAX_PER_ROW_PHONE),
          } as React.CSSProperties
        }
      >
        {questions.map((q, i) => {
          const answered = isAnswered(q, answers[q.id]);
          const current = i === currentIdx;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "step" : undefined}
                aria-label={`Завдання ${i + 1}${answered ? ", відповідь дано" : ""}`}
                className={cn(
                  "relative w-full h-9 rounded-[10px] text-xs font-bold tabular-nums transition-colors border outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  current
                    ? "bg-primary text-primary-foreground border-primary shadow-pill-dark"
                    : answered
                      ? "bg-teal-500/15 border-teal-600/30 text-teal-800 dark:text-teal-200 dark:border-teal-300/30"
                      : "bg-card border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {i + 1}
                {/* Answered + current: keep the "done" mark visible. */}
                {current && answered && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-background" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
