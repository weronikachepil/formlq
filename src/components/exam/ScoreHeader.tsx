"use client";

import { formatTimer, pluralize, PLURAL } from "@/lib/format";
import { maxScaledScore, isExamFailed, type TestResult } from "@/lib/tests";

interface Props {
  result: TestResult;
}

/** Raw points the NMT requires for a test to count (see `isExamFailed`). */
const NMT_PASS_RAW = 5;

/**
 * Result headline. Below the NMT threshold it says so plainly — no red cross, no
 * gendered "не склав" — and how many points were missing; otherwise the scaled
 * score leads. Raw points and time sit underneath.
 */
export function ScoreHeader({ result }: Props) {
  const isNmt = (result.scaleType ?? "nmt") === "nmt";
  const maxScaled = isNmt ? 200 : maxScaledScore(result.scoreTable ?? []);
  const failed = isExamFailed(result.rawScore, result.scaleType ?? "nmt");
  const missing = Math.max(0, NMT_PASS_RAW - result.rawScore);

  return (
    <div className="rounded-[18px] border border-border/50 bg-card px-6 py-6 text-center">
      {failed ? (
        <>
          <span className="inline-flex items-center rounded-[6px] bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            Не зараховано
          </span>
          <p className="mt-2 font-heading text-2xl font-bold">Поріг не подолано</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Потрібно щонайменше {pluralize(NMT_PASS_RAW, PLURAL.point)} — бракує{" "}
            <b className="text-foreground tabular-nums">{pluralize(missing, PLURAL.point)}</b>
          </p>
        </>
      ) : (
        <>
          <p className="font-heading text-5xl font-bold leading-none tabular-nums">{result.nmtScore}</p>
          <p className="mt-2 text-sm text-muted-foreground">{isNmt ? "балів НМТ з 200" : `балів з ${maxScaled}`}</p>
        </>
      )}
      <dl className="mx-auto mt-5 grid max-w-xs grid-cols-2 divide-x divide-border/60 border-t border-border/50 pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Тестовий бал</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {result.rawScore} <span className="font-normal text-muted-foreground">з {result.maxRaw}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Час</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatTimer(result.timeSpent)}</dd>
        </div>
      </dl>
    </div>
  );
}
