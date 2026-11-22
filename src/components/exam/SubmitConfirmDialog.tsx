"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLURAL, plural } from "@/lib/format";

interface SubmitConfirmDialogProps {
  open: boolean;
  /** Indexes (0-based) of the questions without an answer. */
  unanswered: number[];
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
  /** Close and open this question. */
  onJump: (index: number) => void;
}

const UNANSWERED_FORMS: [string, string, string] = [
  "завдання без відповіді",
  "завдання без відповіді",
  "завдань без відповіді",
];

/** Most question numbers listed before "+N". */
const MAX_LISTED = 24;

/**
 * "Finish the test?" — shown on every finish, since it can't be undone.
 * With gaps left, going back is the safe choice, so it's the main button and the
 * gaps are listed as shortcuts; finishing anyway stays one click away.
 */
export function SubmitConfirmDialog({ open, unanswered, total, onCancel, onConfirm, onJump }: SubmitConfirmDialogProps) {
  const left = unanswered.length;

  return (
    <Dialog open={open} onClose={onCancel} size="sm" className="rounded-[18px] p-6 space-y-4">
      <div className="space-y-1.5">
        <p className="font-heading font-bold text-lg">Завершити тест?</p>
        <p className="text-sm text-muted-foreground">
          {left > 0 ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {left} з {total}
              </span>{" "}
              {plural(left, UNANSWERED_FORMS)} — за них буде 0&nbsp;балів.
            </>
          ) : (
            <>Ви відповіли на всі {total} {plural(total, PLURAL.task)}. Після завершення змінити відповіді вже не вийде.</>
          )}
        </p>
      </div>

      {left > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Перейти до</p>
          <div className="flex flex-wrap gap-1.5">
            {unanswered.slice(0, MAX_LISTED).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => onJump(i)}
                aria-label={`Перейти до завдання ${i + 1}`}
                className="min-w-9 h-9 px-1.5 rounded-[10px] border border-border/60 bg-card text-xs font-bold tabular-nums text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {i + 1}
              </button>
            ))}
            {left > MAX_LISTED && (
              <span className="h-9 px-1.5 flex items-center text-xs text-muted-foreground">+{left - MAX_LISTED}</span>
            )}
          </div>
        </div>
      )}

      {left > 0 ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="ghost" onClick={onConfirm} className="text-muted-foreground hover:text-foreground">
            Завершити все одно
          </Button>
          <Button size="sm" onClick={onCancel}>
            Повернутися до тесту
          </Button>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Ще переглянути
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Завершити
          </Button>
        </div>
      )}
    </Dialog>
  );
}
