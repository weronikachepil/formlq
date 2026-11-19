import type { RunnerConfig } from "@/components/exam/ExamRunner";
import { getTest, makeLinearTable, maxRawScore, mistakeIds, type TestResult } from "@/lib/tests";
import type { Homework } from "@/lib/tutor";

/**
 * What the student solves for a homework: its own copy of the questions, or — for old
 * test homework without a copy — the referenced test. null when the test is gone.
 */
export async function homeworkRunnerConfig(hw: Homework): Promise<RunnerConfig | null> {
  if (hw.source === "test" && hw.testId && !hw.questions?.length) {
    const test = await getTest(hw.testId).catch(() => null);
    if (!test) return null;
    return {
      id: hw.id,
      title: hw.title,
      subtitle: test.subtitle,
      questions: test.questions ?? [],
      scoreTable: test.scoreTable ?? [],
      scaleType: test.scaleType ?? "nmt",
      durationMinutes: test.durationMinutes ?? 150,
    };
  }
  const isTest = hw.source === "test";
  return {
    id: hw.id,
    title: hw.title,
    subtitle: isTest ? hw.subtitle : undefined,
    questions: hw.questions ?? [],
    scoreTable: hw.scoreTable ?? [],
    scaleType: hw.scaleType ?? (isTest ? "nmt" : "custom"),
    durationMinutes: hw.durationMinutes ?? (isTest ? 150 : 30),
  };
}

/**
 * The attempt whose mistakes are still to fix: the latest «Робота над помилками» one,
 * else the homework's own result. undefined until it is loaded.
 */
export function mistakesBase(
  hw: Pick<Homework, "status" | "resultId" | "mistakesResultId">,
  results: Map<string, TestResult> | undefined,
): TestResult | undefined {
  if (hw.status !== "completed" || !results) return undefined;
  return (
    (hw.mistakesResultId ? results.get(hw.mistakesResultId) : undefined) ??
    (hw.resultId ? results.get(hw.resultId) : undefined)
  );
}

/** Questions still answered wrong for a completed homework (0 when unknown). */
export function remainingMistakes(
  hw: Pick<Homework, "status" | "resultId" | "mistakesResultId">,
  results: Map<string, TestResult> | undefined,
): number {
  const base = mistakesBase(hw, results);
  return base ? mistakeIds(base).length : 0;
}

/**
 * A «Робота над помилками» run: only the questions still wrong, scored on their own
 * points (a plain «x / y» — an НМТ table makes no sense for a part of the test).
 */
export function mistakesRunnerConfig(full: RunnerConfig, base: TestResult): RunnerConfig {
  const wrong = new Set(mistakeIds(base));
  const questions = full.questions.filter((q) => wrong.has(q.id));
  return {
    id: full.id,
    title: `Робота над помилками: ${full.title}`,
    questions,
    scoreTable: makeLinearTable(maxRawScore(questions)),
    scaleType: "custom",
    durationMinutes: full.durationMinutes,
  };
}
