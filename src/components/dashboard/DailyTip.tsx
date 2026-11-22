"use client";

import { useMemo } from "react";
import type { Tip } from "@/lib/tips";
import { getDayIndex } from "@/lib/format";
import { SectionLabel } from "@/components/ui/section-label";

/** Rotating tip: the first active tip starting from today's index. */
export function DailyTip({ tips }: { tips: Tip[] }) {
  const tip = useMemo(() => {
    if (!tips.length) return null;
    const baseIdx = getDayIndex() % tips.length;
    for (let i = 0; i < tips.length; i++) {
      const t = tips[(baseIdx + i) % tips.length];
      if (t.active) return t;
    }
    return null;
  }, [tips]);

  if (!tip) return null;

  return (
    <section className="rounded-[18px] bg-gold/12 dark:bg-gold/10 px-5 py-4 text-sm flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/80 text-xl dark:bg-white/10">{tip.emoji}</span>
      <div>
        <SectionLabel className="mb-1">Порада дня</SectionLabel>
        <p className="text-foreground/80 leading-relaxed">{tip.text}</p>
      </div>
    </section>
  );
}
