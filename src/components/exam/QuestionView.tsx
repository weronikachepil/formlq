"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/MathText";
import { pluralize, PLURAL } from "@/lib/format";
import { parseListAnswer, parseMatchingAnswer } from "@/lib/exam-scoring";
import { MatchingInput } from "@/components/exam/MatchingInput";
import { OrderInput } from "@/components/exam/OrderInput";
import { AnswerPhoto } from "@/components/exam/AnswerPhoto";
import type { TestQuestion } from "@/lib/tests";

const TYPE_LABEL: Record<TestQuestion["type"], string> = {
  mcq: "Вибір відповіді",
  matching: "Відповідність",
  open: "Коротка відповідь",
  multi: "Кілька правильних відповідей",
  order: "Послідовність",
};

interface QuestionViewProps {
  question: TestQuestion;
  index: number;
  answer: string | undefined;
  onAnswer: (questionId: string, answer: string) => void;
  /** Photo of the written solution: on open questions (homework), or on every question with `photoOnAll`. */
  allowAnswerImages?: boolean;
  photoOnAll?: boolean;
  answerImage?: string;
  uploading?: boolean;
  onUploadImage?: (questionId: string, file: File) => void;
  onRemoveImage?: (questionId: string) => void;
}

/** The current question card with its type-specific answer input. */
export function QuestionView({
  question,
  index,
  answer,
  onAnswer,
  allowAnswerImages = false,
  photoOnAll = false,
  answerImage,
  uploading = false,
  onUploadImage,
  onRemoveImage,
}: QuestionViewProps) {
  return (
    <div className="rounded-[18px] border border-border/50 bg-card p-5 sm:p-6 space-y-5">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Завдання {index + 1} · {TYPE_LABEL[question.type]} ·{" "}
          {pluralize(question.points, PLURAL.point)}
        </div>
        <MathText
          text={question.text}
          className="text-[17px] font-medium leading-relaxed"
        />
        {question.imageUrl && (
          <div className="rounded-[12px] overflow-hidden border border-border/50">
            <Image
              src={question.imageUrl}
              alt=""
              width={800}
              height={400}
              className="w-full object-contain max-h-64"
            />
          </div>
        )}
      </div>

      {question.type === "mcq" && (
        <div role="radiogroup" aria-label="Варіанти відповіді" className="space-y-2">
          {question.options.map((opt) => {
            const selected = answer === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAnswer(question.id, opt.id)}
                role="radio"
                aria-checked={selected}
                className={cn(
                  "group/opt w-full min-h-12 text-left px-3 py-2.5 rounded-[12px] border transition-colors text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary/[0.06] font-medium"
                    : "border-border/60 hover:border-primary/20 hover:bg-muted/30",
                )}
              >
                {opt.imageUrl ? (
                  <div className="flex flex-col gap-2">
                    <OptionLetter id={opt.id} selected={selected} />
                    <Image
                      src={opt.imageUrl}
                      alt={opt.id}
                      width={400}
                      height={200}
                      className="max-h-40 w-full object-contain rounded-lg"
                    />
                    {opt.text && (
                      <MathText
                        text={opt.text}
                        className="text-xs text-muted-foreground"
                      />
                    )}
                  </div>
                ) : (
                  <span className="flex items-center gap-3">
                    <OptionLetter id={opt.id} selected={selected} />
                    <MathText text={opt.text} className="min-w-0 flex-1" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "multi" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Оберіть усі правильні варіанти:</p>
          {question.options.map((opt) => {
            const picked = parseListAnswer(answer);
            const selected = picked.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() =>
                  onAnswer(
                    question.id,
                    JSON.stringify(
                      selected
                        ? picked.filter((id) => id !== opt.id)
                        : question.options.map((o) => o.id).filter((id) => id === opt.id || picked.includes(id)),
                    ),
                  )
                }
                className={cn(
                  "w-full min-h-12 text-left px-3.5 py-3 rounded-[12px] border transition-colors text-[15px] flex items-start gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary/[0.06] font-medium"
                    : "border-border/60 hover:border-primary/20 hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center text-[11px] font-bold",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                  aria-hidden
                >
                  {selected ? "✓" : ""}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-bold mr-2">{opt.id}</span>
                  {opt.text && <MathText text={opt.text} />}
                  {opt.imageUrl && (
                    <Image
                      src={opt.imageUrl}
                      alt={opt.id}
                      width={400}
                      height={200}
                      className="mt-2 max-h-40 w-full object-contain rounded-lg"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === "order" && (
        <OrderInput
          key={question.id}
          question={question}
          value={parseListAnswer(answer)}
          onChange={(ids) => onAnswer(question.id, JSON.stringify(ids))}
        />
      )}

      {question.type === "matching" && (
        <MatchingInput
          // Remount per question so a half-made selection doesn't carry over.
          key={question.id}
          question={question}
          value={parseMatchingAnswer(answer)}
          onChange={(pairs) => onAnswer(question.id, JSON.stringify(pairs))}
        />
      )}

      {question.type === "open" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Введіть числову відповідь:
          </p>
          <input
            type="text"
            // "decimal" so mobile keypads offer "," / "." (both accepted when scoring).
            inputMode="decimal"
            value={answer ?? ""}
            onChange={(e) => onAnswer(question.id, e.target.value)}
            placeholder="Ваша відповідь..."
            className="w-full h-12 px-4 rounded-[12px] border border-border/60 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 text-[15px] tabular-nums transition-colors"
          />
        </div>
      )}

      {allowAnswerImages && (photoOnAll || question.type === "open") && (
        <AnswerPhoto
          url={answerImage}
          uploading={uploading}
          onSelect={(file) => onUploadImage?.(question.id, file)}
          onRemove={() => onRemoveImage?.(question.id)}
        />
      )}
    </div>
  );
}

/** Option letter as a key-cap: grey at rest, filled when chosen. */
function OptionLetter({ id, selected }: { id: string; selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "w-7 h-7 shrink-0 rounded-[8px] flex items-center justify-center text-[13px] font-bold transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground/80 group-hover/opt:bg-primary/10",
      )}
    >
      {id}
    </span>
  );
}
