"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getResult, getTest, TestResult } from "@/lib/tests";
import { matchingPartialScore } from "@/lib/exam-scoring";
import { ScoreHeader } from "@/components/exam/ScoreHeader";
import { QuestionMap } from "@/components/exam/QuestionMap";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { SpinnerPage } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [testAvailable, setTestAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getResult(id).then(async (r) => {
      if (!r || r.userId !== user.uid) { router.replace("/dashboard/history"); return; }
      setResult(r);
      // Not readable (a teacher looking at a platform test) = not available to retake.
      const test = await getTest(r.testId).catch(() => null);
      setTestAvailable(!!test && test.published === true);
      setLoading(false);
    });
  }, [id, user, router]);

  if (authLoading || loading) return <SpinnerPage size="lg" />;
  if (!result) return null;

  // Enrich old results that were saved before partial-score logic existed
  const questions = (result.questions ?? []).map((q) => {
    if (q.type === "matching" && !q.isCorrect && q.partialScore === undefined && q.userAnswer) {
      try {
        const pairs = JSON.parse(q.userAnswer) as Record<string, string>;
        const { score } = matchingPartialScore(q.correctPairs ?? {}, pairs, q.points);
        return { ...q, partialScore: score };
      } catch { /* noop */ }
    }
    return q;
  });

  return (
    <div className="max-w-2xl space-y-6 pb-8">
      <ScoreHeader result={result} />

      <QuestionMap questions={questions} />

      {/* Question breakdown */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          // Anchor for the question map above.
          <div key={q.id ?? i} id={`q-${i}`} className="scroll-mt-24">
            <QuestionCard q={q} index={i} />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {testAvailable ? (
          <Link href={`/dashboard/exam/${result.testId}`} className="flex-1">
            <Button variant="outline" className="w-full">Ще раз</Button>
          </Link>
        ) : (
          <Button variant="outline" className="flex-1" disabled title="Тест більше недоступний">
            Ще раз
          </Button>
        )}
        <Link href="/dashboard/history" className="flex-1">
          <Button className="w-full">Історія</Button>
        </Link>
      </div>
    </div>
  );
}
