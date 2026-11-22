"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, History, Presentation, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const TONES = {
  lavender: "bg-lavender/35 dark:bg-lavender/20",
  mint: "bg-mint/45 dark:bg-mint/25",
  peach: "bg-peach/50 dark:bg-peach/20",
  gold: "bg-gold/20 dark:bg-gold/15",
} as const;

/** A big tinted action card: what the teacher most often does next. */
export function QuickAction({
  href,
  Icon,
  label,
  hint,
  tone,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
  tone: keyof typeof TONES;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[104px] flex-col justify-between gap-3 rounded-[18px] p-4 transition-transform hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        TONES[tone],
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-white/80 text-foreground dark:bg-white/10">
        <Icon size={19} />
      </span>
      <span>
        <span className="flex items-center gap-1 font-semibold">
          {label}
          <ArrowRight size={15} className="opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
        </span>
        <span className="block text-xs text-foreground/65">{hint}</span>
      </span>
    </Link>
  );
}


/** A student's main actions: tests always, homework only with a teacher. */
export function StudentActions({ withTutor }: { withTutor: boolean }) {
  return (
    <div className={cn("grid gap-3", withTutor ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
      <QuickAction href="/dashboard/tests" Icon={FileText} label="Пройти тест" hint="НМТ і тести від викладачів" tone="lavender" />
      {withTutor && (
        <QuickAction href="/dashboard/homework" Icon={ClipboardCheck} label="Домашні" hint="Завдання від викладача" tone="mint" />
      )}
      <QuickAction href="/dashboard/boards" Icon={Presentation} label="Мої дошки" hint="Конспекти й розв’язки" tone="peach" />
      <QuickAction href="/dashboard/history" Icon={History} label="Мої результати" hint="Бали й розбір помилок" tone="gold" />
    </div>
  );
}
