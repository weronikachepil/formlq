"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getResult, TestResult } from "@/lib/tests";
import { ScoreHeader } from "@/components/exam/ScoreHeader";
import { QuestionMap } from "@/components/exam/QuestionMap";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { SpinnerPage } from "@/components/ui/spinner";
import { usePageHeader } from "@/context/HeaderContext";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft } from "lucide-react";

export default function AdminResultPage() {
  const { uid, resultId } = useParams<{ uid: string; resultId: string }>();
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getResult(resultId).then((r) => {
      setResult(r);
      setLoading(false);
    });
  }, [resultId]);

  usePageHeader(
    result ? result.testTitle || "Результат" : "",
    result ? "Перегляд адміном" : "",
  );

  if (loading) return <SpinnerPage />;

  if (!result) return <EmptyState emoji="🔍" title="Результат не знайдено" />;

  const questions = result.questions ?? [];

  return (
    <div className="max-w-2xl space-y-6 pb-8">
      <button
        onClick={() => router.push(`/admin/users/${uid}`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Назад до історії
      </button>

      <ScoreHeader result={result} />

      <QuestionMap questions={questions} />

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          // Anchor for the question map above.
          <div key={q.id ?? i} id={`q-${i}`} className="scroll-mt-24">
            <QuestionCard q={q} index={i} answerLabel="Відповідь:" />
          </div>
        ))}
      </div>
    </div>
  );
}
