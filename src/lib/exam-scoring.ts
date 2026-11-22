import {
  normalizeOpenAnswer,
  parseListAnswer,
  scoreQuestion,
  type TestQuestion,
  type QuestionResult,
} from "@/lib/tests";

/** Parse a matching answer (JSON `{ leftId: rightId }`); `{}` when empty or malformed. */
export function parseMatchingAnswer(
  answer: string | undefined,
): Record<string, string> {
  if (!answer) return {};
  try {
    return JSON.parse(answer) as Record<string, string>;
  } catch {
    return {};
  }
}

export { parseListAnswer };

/** Matching counts as answered only when every left item has a pair; multi/order need a pick. */
export function isAnswered(q: TestQuestion, answer: string | undefined): boolean {
  if (!answer) return false;
  if (q.type === "matching") {
    const p = parseMatchingAnswer(answer);
    return q.leftItems.every((item) => !!p[item.id]);
  }
  if (q.type === "multi" || q.type === "order") return parseListAnswer(answer).length > 0;
  return answer.trim().length > 0;
}

export function countUnanswered(
  questions: TestQuestion[],
  answers: Record<string, string>,
): number {
  return questions.filter((q) => !isAnswered(q, answers[q.id])).length;
}

/** Open answers: ignore surrounding whitespace, treat "." and "," as the same decimal separator. */
// Re-exported so scoring (calcRawScore) and result display share one rule.
export { normalizeOpenAnswer };

/** Points for a matching answer: proportional to correctly matched pairs, rounded. */
export function matchingPartialScore(
  correctPairs: Record<string, string>,
  userPairs: Record<string, string>,
  points: number,
): { score: number; correctCount: number; totalPairs: number } {
  const totalPairs = Object.keys(correctPairs).length;
  const correctCount = Object.entries(correctPairs).filter(
    ([k, v]) => userPairs[k] === v,
  ).length;
  const score =
    totalPairs > 0 ? Math.round(correctCount * (points / totalPairs)) : 0;
  return { score, correctCount, totalPairs };
}

/** Snapshot of each question + the student's answer, stored with the result. */
export function buildQuestionResults(
  qs: TestQuestion[],
  ans: Record<string, string>,
): QuestionResult[] {
  return qs.map((q) => {
    const userAnswer = ans[q.id] ?? "";
    const { score, correct } = scoreQuestion(q, userAnswer);
    const base = {
      id: q.id,
      type: q.type,
      text: q.text,
      imageUrl: q.imageUrl ?? null,
      points: q.points,
      userAnswer,
      isCorrect: correct,
      explanation: q.explanation ?? "",
      explanationImageUrl: q.explanationImageUrl ?? null,
    };
    switch (q.type) {
      case "mcq":
        return { ...base, options: q.options, correctOptionId: q.correctOptionId };
      case "open":
        return {
          ...base,
          correctAnswer: q.correctAnswer,
          ...(q.tolerance ? { tolerance: q.tolerance } : {}),
        };
      case "matching":
        return {
          ...base,
          leftItems: q.leftItems,
          rightOptions: q.rightOptions,
          correctPairs: q.correctPairs,
          partialScore: score,
        };
      case "multi":
        return { ...base, options: q.options, correctOptionIds: q.correctOptionIds, partialScore: score };
      case "order":
        return { ...base, items: q.items, partialScore: score };
    }
  });
}
