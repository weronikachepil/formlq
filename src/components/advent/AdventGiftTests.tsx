"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gift, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STALE } from "@/lib/queryKeys";
import { getGiftTests } from "@/lib/advent-gift";
import { maxRawScore, studentTestPath, type TestDoc } from "@/lib/tests";
import { useAdventAccess } from "./AdventAccess";

/**
 * The gift imitations for a teacher whose calendar is open (a student used one of their
 * codes): to take them and to set them as homework. Empty for everyone else.
 */
export function useTeacherGiftTests(): TestDoc[] {
  const access = useAdventAccess();
  const { data = [] } = useQuery({
    queryKey: ["adventGiftTests"],
    queryFn: getGiftTests,
    enabled: access === "teacher",
    staleTime: STALE.long,
  });
  return access === "teacher" ? data : [];
}

/** «Мої тести»: the imitations from the advent calendar, above the teacher's own tests. */
export function AdventGiftTestsCard() {
  const tests = useTeacherGiftTests();
  if (!tests.length) return null;
  return (
    <section className="rounded-[18px] bg-card p-4 sm:p-6 space-y-3">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fdf3d3] text-[#14262a]">
          <Gift size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold">Імітації з адвент-календаря</h2>
          <p className="text-sm text-muted-foreground">Пройдіть самі або задайте учням як домашнє.</p>
        </div>
      </div>
      <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
        {tests.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold truncate">{t.title}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {t.questions?.length ?? 0} завдань · {maxRawScore(t.questions ?? [])} балів · шкала НМТ 100–200
              </span>
            </span>
            <span className="flex gap-2">
              <Link href={studentTestPath(t.id)}>
                <Button variant="outline" className="h-10 rounded-xl"><Play size={16} /> Пройти</Button>
              </Link>
              <Link href={`/tutor/homework/new?test=${t.id}`}>
                <Button className="h-10 rounded-xl"><Send size={16} /> Задати як домашнє</Button>
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
