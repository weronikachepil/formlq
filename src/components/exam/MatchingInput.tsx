"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/MathText";
import type { MatchingItem, MatchingQuestion } from "@/lib/tests";

interface MatchingInputProps {
  question: MatchingQuestion;
  value: Record<string, string>;
  onChange: (pairs: Record<string, string>) => void;
}

const DRAG_TYPE = "text/x-match-option";

/**
 * Laid out like the real NMT: each item → its slot, the unused options in a pool
 * beside them. Drag an option into a slot (or back to the pool); × returns it.
 * Tap works too (phones): tap an option, then a slot — or a slot, then an option.
 * Each option goes to one slot at most, as on the exam.
 */
export function MatchingInput({ question, value, onChange }: MatchingInputProps) {
  // Tap-to-place: the option or the slot tapped first.
  const [picked, setPicked] = useState<{ option?: string; slot?: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const optionById = new Map(question.rightOptions.map((o) => [o.id, o]));
  const placed = new Set(Object.values(value));
  const pool = question.rightOptions.filter((o) => !placed.has(o.id));

  function place(itemId: string, optId: string) {
    const next: Record<string, string> = {};
    // An option lives in one slot: moving it empties the old one.
    for (const [k, v] of Object.entries(value)) if (v !== optId && k !== itemId) next[k] = v;
    next[itemId] = optId;
    onChange(next);
    setPicked(null);
  }
  function clear(itemId: string) {
    const next = { ...value };
    delete next[itemId];
    onChange(next);
  }

  function tapOption(optId: string) {
    if (picked?.slot) place(picked.slot, optId);
    else setPicked(picked?.option === optId ? null : { option: optId });
  }
  function tapSlot(itemId: string) {
    if (picked?.option) place(itemId, picked.option);
    else setPicked(picked?.slot === itemId ? null : { slot: itemId });
  }

  const dragProps = (optId: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, optId);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => setOver(null),
  });
  const dropProps = (key: string, onDrop: (optId: string) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      if (over !== key) setOver(key);
    },
    onDragLeave: () => setOver((k) => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(DRAG_TYPE);
      setOver(null);
      if (id) onDrop(id);
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Перетягніть варіант у рамку — або натисніть варіант, а потім рамку.
      </p>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem] md:items-start">
        {/* Pairs: item → slot. */}
        <ol className="space-y-2">
          {question.leftItems.map((item) => {
            const opt = value[item.id] ? optionById.get(value[item.id]) : undefined;
            const slotActive = picked?.slot === item.id;
            const canTake = !!picked?.option;
            return (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                <div className="flex items-start gap-2 rounded-[12px] bg-muted/50 px-3 py-2.5">
                  <span className="shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">{item.id}.</span>
                  <MathText text={item.text} className="min-w-0 text-[15px] leading-snug" />
                </div>
                <ArrowRight size={16} className="self-center text-muted-foreground/70" aria-hidden />
                {opt ? (
                  <div
                    {...dragProps(opt.id)}
                    {...dropProps(item.id, (id) => place(item.id, id))}
                    className={cn(
                      "group/slot flex cursor-grab items-start gap-2 rounded-[12px] border border-primary/40 bg-primary/[0.05] py-2 pl-3 pr-1.5 active:cursor-grabbing",
                      over === item.id && "ring-2 ring-ring/40",
                    )}
                  >
                    <OptionBody opt={opt} />
                    <button
                      type="button"
                      onClick={() => clear(item.id)}
                      aria-label={`Прибрати ${opt.id} з ${item.id}`}
                      className="ml-auto -my-0.5 w-7 h-7 shrink-0 rounded-[8px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => tapSlot(item.id)}
                    aria-label={`Рамка для ${item.id}`}
                    aria-pressed={slotActive}
                    {...dropProps(item.id, (id) => place(item.id, id))}
                    className={cn(
                      "min-h-12 rounded-[12px] border-[1.5px] border-dashed px-3 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      over === item.id || slotActive
                        ? "border-primary bg-primary/[0.06] text-foreground"
                        : canTake
                          ? "border-primary/50 text-foreground/70 hover:bg-primary/[0.04]"
                          : "border-foreground/20 text-muted-foreground/70 hover:border-primary/40",
                    )}
                  >
                    {slotActive ? "Тепер оберіть варіант" : canTake ? "Сюди" : ""}
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        {/* Pool of options not placed yet; drop here to take one back. */}
        <div
          {...dropProps("pool", (id) => {
            const itemId = Object.keys(value).find((k) => value[k] === id);
            if (itemId) clear(itemId);
          })}
          className={cn(
            "rounded-[12px] border border-border/60 p-2 transition-colors md:min-h-full",
            over === "pool" && "border-primary/50 bg-primary/[0.04]",
          )}
        >
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Варіанти</p>
          {pool.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Усі варіанти розставлено</p>
          ) : (
            <ul className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
              {pool.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    {...dragProps(opt.id)}
                    onClick={() => tapOption(opt.id)}
                    aria-pressed={picked?.option === opt.id}
                    className={cn(
                      "w-full min-h-11 flex items-start gap-2 rounded-[10px] border bg-card px-3 py-2 text-left cursor-grab active:cursor-grabbing transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      picked?.option === opt.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/60 hover:border-primary/30 shadow-pill",
                    )}
                  >
                    <OptionBody opt={opt} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionBody({ opt }: { opt: MatchingItem }) {
  return (
    <span className="flex min-w-0 items-start gap-2 text-[15px] leading-snug">
      <span className="shrink-0 font-bold">{opt.id}.</span>
      {opt.text && <MathText text={opt.text} className="min-w-0" />}
    </span>
  );
}
