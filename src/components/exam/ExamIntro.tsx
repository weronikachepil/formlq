"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PLURAL, plural, pluralize } from "@/lib/format";
import { MathText } from "@/components/MathText";
import { ResultListItem } from "@/components/exam/ResultListItem";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { maxScaledScore, type TestQuestion, type TestResult } from "@/lib/tests";
import type { RunnerConfig } from "@/components/exam/ExamRunner";

interface ExamIntroProps {
  config: RunnerConfig;
  questions: TestQuestion[];
  maxRaw: number;
  isNmt: boolean;
  untimed: boolean;
  allowAnswerImages: boolean;
  photoOnAll?: boolean;
  introNote?: string;
  introEmoji: string;
  startLabel: string;
  /** null hides the "Назад" button (public attempts have nowhere to go back to). */
  backHref: string | null;
  history: TestResult[];
  onStart: () => void;
}

/** Pre-start screen: summary stats, rules, previous attempts. */
export function ExamIntro({
  config,
  questions,
  maxRaw,
  isNmt,
  untimed,
  allowAnswerImages,
  photoOnAll = false,
  introNote,
  introEmoji,
  startLabel,
  backHref,
  history,
  onStart,
}: ExamIntroProps) {
  const mcq = questions.filter((q) => q.type === "mcq");
  const open = questions.filter((q) => q.type === "open");
  // Matching, several-answer and ordering questions.
  const otherCount = questions.length - mcq.length - open.length;
  const mcqPoints = mcq.reduce((sum, q) => sum + (q.points ?? 1), 0);
  const openPoints = open.reduce((sum, q) => sum + (q.points ?? 2), 0);
  const otherPoints = Math.max(0, maxRaw - mcqPoints - openPoints);
  const maxScaled = maxScaledScore(config.scoreTable ?? []);

  // The three facts a student weighs before starting.
  const keyFacts: [string, string][] = [
    ...(untimed ? [] : ([[String(config.durationMinutes ?? 150), "хвилин"]] as [string, string][])),
    [String(questions.length), plural(questions.length, PLURAL.task)],
    [String(maxRaw), `${plural(maxRaw, PLURAL.point)} максимум`],
  ];

  // What the test is made of: words, not "15 × 1б" (which read as "15 × 16").
  const structure: [string, number, number][] = [
    ["Вибір однієї відповіді", mcq.length, mcqPoints],
    ["Відкрита відповідь", open.length, openPoints],
    ["Інші типи завдань", otherCount, otherPoints],
  ];

  const rules = [
    "Відповідь можна змінити до завершення",
    ...(untimed ? [] : ["Таймер запускається після «Почати»"]),
    ...(allowAnswerImages
      ? [`${photoOnAll ? "До кожного питання" : "До відкритих питань"} можна прикріпити фото розвʼязку`]
      : []),
    isNmt ? "Результат переводиться у бали НМТ (100–200)" : `Результат переводиться у бали за шкалою (до ${maxScaled})`,
  ];

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-5 py-8">
        <div className="text-center space-y-1.5">
          <div className="text-4xl" aria-hidden>
            {introEmoji}
          </div>
          <h1 className="font-heading text-2xl font-bold">{config.title}</h1>
          {config.subtitle && <p className="text-muted-foreground">{config.subtitle}</p>}
        </div>

        {introNote && (
          <div className="rounded-[18px] border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
              Від вчителя
            </p>
            <MathText text={introNote} className="text-foreground/90" />
          </div>
        )}

        <div className="rounded-[18px] border border-border/50 bg-card">
          <dl className="grid divide-x divide-border/60 py-5" style={{ gridTemplateColumns: `repeat(${keyFacts.length}, minmax(0, 1fr))` }}>
            {keyFacts.map(([val, label]) => (
              <div key={label} className="px-3 text-center">
                <dd className="font-heading text-3xl font-bold leading-none tabular-nums">{val}</dd>
                <dt className="mt-1.5 text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>

          <div className="border-t border-border/50 px-5 py-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Із чого складається</p>
            <ul className="space-y-1.5 text-sm">
              {structure
                .filter(([, count]) => count > 0)
                .map(([label, count, points]) => (
                  <li key={label} className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1">{label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {pluralize(count, PLURAL.task)}
                      {points > 0 && <span className="text-foreground font-medium"> · {pluralize(points, PLURAL.point)}</span>}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <ul className="border-t border-border/50 px-5 py-4 space-y-1.5 text-sm text-muted-foreground">
            {rules.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <Check size={14} className="mt-[3px] shrink-0 text-chart-2" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button size="lg" className="w-full h-12 text-base" onClick={onStart}>
            {startLabel}
          </Button>
          {backHref && (
            <Link href={backHref}>
              <Button variant="ghost" className="w-full text-muted-foreground">
                Назад
              </Button>
            </Link>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Мої спроби · {history.length}</SectionLabel>
            {history.map((r) => (
              <ResultListItem
                key={r.id}
                result={r}
                href={`/dashboard/results/${r.id}`}
                hideTitle
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
