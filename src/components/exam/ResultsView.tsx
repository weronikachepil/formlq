"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { pluralize, PLURAL } from "@/lib/format";
import type { TestResult } from "@/lib/tests";
import { ScoreHeader } from "@/components/exam/ScoreHeader";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { QuestionMap } from "@/components/exam/QuestionMap";

interface EditableField {
  value: string;
  onSave: (v: string) => void;
}

interface ResultsViewProps {
  result: TestResult;
  answerLabel?: string;
  answerImages?: Record<string, string>;
  flagged?: string[];
  /** Student: makes the duck a toggle. */
  onToggleFlag?: (questionId: string) => void;
  /** Read-only overall tutor note (student view). */
  tutorNote?: string;
  /** Editable overall note (tutor review). */
  editableNote?: EditableField;
  /** Read-only per-question tutor comments (student view). */
  tutorComments?: Record<string, string>;
  /** Editable per-question comment (tutor review). */
  editableComment?: (questionId: string) => EditableField;
  /** Show the "student flagged N questions" banner (tutor). */
  flaggedBanner?: boolean;
}

export function ResultsView({
  result,
  answerLabel = "Ваша відповідь",
  answerImages,
  flagged = [],
  onToggleFlag,
  tutorNote,
  editableNote,
  tutorComments,
  editableComment,
  flaggedBanner = false,
}: ResultsViewProps) {
  const questions = result.questions ?? [];
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scrollToQuestion(i: number) {
    refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightIdx(i);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlightIdx(null), 1600);
  }

  const [noteDraft, setNoteDraft] = useState(editableNote?.value ?? "");

  return (
    <div className="space-y-6">
      <ScoreHeader result={result} />

      {flaggedBanner && flagged.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            🦆 Учень позначив {pluralize(flagged.length, PLURAL.question)} для
            обговорення
          </p>
        </div>
      )}

      {/* Overall note */}
      {editableNote ? (
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Загальний коментар учневі
          </label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={(e) => editableNote.onSave(e.target.value)}
            rows={2}
            placeholder="Напишіть відгук для учня..."
            className="w-full px-3 py-2 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>
      ) : (
        tutorNote && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
              Коментар вчителя
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {tutorNote}
            </p>
          </div>
        )
      )}

      <QuestionMap questions={questions} onSelect={scrollToQuestion} highlightIdx={highlightIdx} flagged={flagged} />

      {/* Question cards */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div
            key={q.id ?? i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={cn(
              "scroll-mt-20 rounded-[18px] transition-all duration-500",
              highlightIdx === i &&
                "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg",
            )}
          >
            <QuestionCard
              q={q}
              index={i}
              answerLabel={answerLabel}
              photo={answerImages?.[q.id]}
              flagged={flagged.includes(q.id)}
              onToggleFlag={onToggleFlag ? () => onToggleFlag(q.id) : undefined}
              comment={tutorComments?.[q.id]}
              editableComment={
                editableComment ? editableComment(q.id) : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
