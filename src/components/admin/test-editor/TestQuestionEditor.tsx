import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Lightbulb, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SectionLabel } from "@/components/ui/section-label";
import { Textarea } from "@/components/ui/text-field";
import { MathText } from "@/components/MathText";
import {
  QuestionImageUpload,
  MCQEditor,
  OpenEditor,
  MatchingEditor,
  MultiEditor,
  OrderEditor,
} from "@/components/admin/QuestionEditorPanel";
import type { TestQuestion } from "@/lib/tests";
import { TYPE_ICON, TYPE_LABELS_LONG } from "./constants";
import { pluralize, PLURAL } from "@/lib/format";
import { StepButton } from "./primitives";

const textareaClass = "resize-y py-3 text-sm";

/** Full editor for the active test question. */
export function TestQuestionEditor({
  contextId,
  question: q,
  index,
  onChange,
  onMove,
  onDelete,
  onPrev,
  onNext,
  onAddSame,
}: {
  /** Storage folder for uploaded images (the test id). */
  contextId: string;
  question: TestQuestion;
  index: number;
  onChange: (patch: Partial<TestQuestion>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  /** Open the neighbouring question; absent at the ends. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Add another question of the same kind (offered on the last one). */
  onAddSame: () => void;
}) {
  const TypeIcon = TYPE_ICON[q.type];
  // Opened per question: shown when it already has content or the teacher asked for it.
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const setExplaining = (v: boolean) => setExplainingId(v ? q.id : null);
  const showExplanation = !!q.explanation || !!q.explanationImageUrl || explainingId === q.id;
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          <TypeIcon size={16} />
        </span>
        <div className="min-w-0 mr-auto">
          <p className="font-heading font-bold leading-tight">Завдання {index + 1}</p>
          <p className="text-xs text-muted-foreground">{TYPE_LABELS_LONG[q.type]}</p>
        </div>

        <div className="flex items-center gap-1.5" title="Балів за правильну відповідь">
          <StepButton
            size="sm"
            aria-label="Менше балів"
            disabled={q.points <= 1}
            onClick={() => onChange({ points: Math.max(1, q.points - 1) })}
          >
            −
          </StepButton>
          <span className="min-w-14 text-center text-sm font-semibold tabular-nums">
            {pluralize(q.points, PLURAL.point)}
          </span>
          <StepButton size="sm" aria-label="Більше балів" onClick={() => onChange({ points: q.points + 1 })}>
            +
          </StepButton>
        </div>

        <div className="flex items-center gap-0.5 pl-2 border-l border-border/60">
          <IconButton label="Перемістити вгору" size="md" className="pointer-coarse:w-10 pointer-coarse:h-10" onClick={() => onMove(-1)}>
            <ChevronUp size={16} />
          </IconButton>
          <IconButton label="Перемістити вниз" size="md" className="pointer-coarse:w-10 pointer-coarse:h-10" onClick={() => onMove(1)}>
            <ChevronDown size={16} />
          </IconButton>
          <IconButton
            label="Видалити завдання"
            size="md"
            tone="danger"
            className="text-destructive pointer-coarse:w-10 pointer-coarse:h-10"
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      {/* Question text */}
      <div className="space-y-1.5">
        <SectionLabel as="label" htmlFor={`q-text-${q.id}`}>
          Умова
        </SectionLabel>
        <Textarea
          id={`q-text-${q.id}`}
          value={q.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Напр.: Розвʼяжіть рівняння $x^2 - 5x + 6 = 0$"
          rows={3}
          className={textareaClass}
        />
        {q.text.includes("$") ? (
          <div className="px-4 py-3 rounded-xl bg-muted/40 text-sm leading-relaxed">
            <MathText text={q.text} />
          </div>
        ) : (
          <p className="px-1 text-[11px] text-muted-foreground">Формулу пишіть між знаками $, напр. $x^2$</p>
        )}
        <QuestionImageUpload
          contextId={contextId}
          slotId={q.id}
          imageUrl={q.imageUrl}
          onUploaded={(url) => onChange({ imageUrl: url })}
          onRemoved={() => onChange({ imageUrl: undefined })}
          label="Зображення"
        />
      </div>

      {q.type === "mcq" && (
        <MCQEditor
          contextId={contextId}
          question={q}
          onOptionChange={(optId, text) =>
            onChange({
              options: q.options.map((o) => (o.id === optId ? { ...o, text } : o)),
            })
          }
          onCorrectChange={(optId) => onChange({ correctOptionId: optId })}
          onOptionImageChange={(optId, url) =>
            onChange({
              options: q.options.map((o) =>
                o.id === optId ? { ...o, imageUrl: url } : o,
              ),
            })
          }
        />
      )}

      {q.type === "matching" && <MatchingEditor question={q} onChange={onChange} />}

      {q.type === "open" && (
        <OpenEditor
          key={q.id}
          question={q}
          onChange={(correctAnswer) => onChange({ correctAnswer })}
          onToleranceChange={(tolerance) => onChange({ tolerance })}
        />
      )}

      {q.type === "multi" && <MultiEditor contextId={contextId} question={q} onChange={onChange} />}

      {q.type === "order" && <OrderEditor question={q} onChange={onChange} />}

      {/* Optional: hidden behind one clear button until it is wanted. */}
      {showExplanation ? (
        <div className="space-y-1.5">
          <SectionLabel as="label" htmlFor={`q-expl-${q.id}`}>
            Пояснення до відповіді
          </SectionLabel>
          <Textarea
            id={`q-expl-${q.id}`}
            autoFocus={!q.explanation}
            value={q.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Учень побачить його після тесту"
            rows={2}
            className={textareaClass}
          />
          {q.explanation.includes("$") && (
            <div className="px-4 py-3 rounded-xl bg-muted/40 text-sm leading-relaxed">
              <MathText text={q.explanation} />
            </div>
          )}
          <QuestionImageUpload
            contextId={contextId}
            slotId={`${q.id}-explanation`}
            imageUrl={q.explanationImageUrl}
            onUploaded={(url) => onChange({ explanationImageUrl: url })}
            onRemoved={() => onChange({ explanationImageUrl: undefined })}
            label="Зображення до пояснення"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExplaining(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Lightbulb size={15} /> + Пояснення до відповіді
        </button>
      )}

      {/* The obvious next step, right where editing ends: no trip back to the list. */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-border/50">
        {onPrev ? (
          <Button variant="ghost" onClick={onPrev} className="gap-1.5">
            <ArrowLeft size={15} /> Завдання {index}
          </Button>
        ) : (
          <span />
        )}
        {onNext ? (
          <Button variant="outline" onClick={onNext} className="gap-1.5">
            Завдання {index + 2} <ArrowRight size={15} />
          </Button>
        ) : (
          <Button variant="outline" onClick={onAddSame} className="gap-1.5">
            <Plus size={15} /> Ще одне таке завдання
          </Button>
        )}
      </div>
    </div>
  );
}
