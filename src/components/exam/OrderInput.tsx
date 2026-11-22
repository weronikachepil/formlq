"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/MathText";
import type { OrderQuestion } from "@/lib/tests";

/**
 * The items as first shown: shuffled by a rule seeded from the question id, so the student
 * sees the same order on every visit and device — and never the answer itself.
 */
export function initialOrder(q: OrderQuestion): string[] {
  const ids = q.items.map((it) => it.id);
  let seed = 0;
  for (const ch of q.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Already in order (likely with 2–3 items): rotate by one.
  if (out.length > 1 && out.every((id, i) => id === ids[i])) out.push(out.shift()!);
  return out;
}

interface OrderInputProps {
  question: OrderQuestion;
  /** Current order of item ids; [] = not answered yet (the shuffled order is shown). */
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Arrange items with the up/down buttons; the first touch records the answer. */
export function OrderInput({ question, value, onChange }: OrderInputProps) {
  const known = new Set(question.items.map((it) => it.id));
  const order =
    value.length === question.items.length && value.every((id) => known.has(id)) ? value : initialOrder(question);
  const byId = new Map(question.items.map((it) => [it.id, it]));
  const answered = value.length > 0;

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Розставте у правильному порядку стрілками: перший — угорі.
      </p>
      <ol className="space-y-1.5">
        {order.map((id, i) => (
          <li
            key={id}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-background pl-3 pr-1.5 py-1.5"
          >
            <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground tabular-nums">{i + 1}.</span>
            <MathText text={byId.get(id)?.text ?? ""} className="flex-1 min-w-0 text-sm" />
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label="Вище"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="w-9 h-9 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label="Нижче"
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
                className="w-9 h-9 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!answered && (
        <button
          type="button"
          onClick={() => onChange(order)}
          className={cn(
            "text-xs font-semibold text-primary hover:underline underline-offset-4",
          )}
        >
          Порядок правильний — зберегти так
        </button>
      )}
    </div>
  );
}
