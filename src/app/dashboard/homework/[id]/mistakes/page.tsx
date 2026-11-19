"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { getResult, saveTestResult, type TestResult } from "@/lib/tests";
import { getHomework, updateHomework, type Homework } from "@/lib/tutor";
import { homeworkRunnerConfig, mistakesRunnerConfig } from "@/lib/homework-runner";
import { uploadQuestionImage } from "@/lib/storage";
import { pluralize, PLURAL } from "@/lib/format";
import { SpinnerScreen } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ExamRunner, type RunnerConfig, type SubmitPayload } from "@/components/exam/ExamRunner";

/**
 * «Робота над помилками»: the student re-solves only the questions of a completed homework
 * that are still wrong. Each run is saved as its own result; the homework's score stays.
 */
export default function HomeworkMistakesPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [homework, setHomework] = useState<Homework | null>(null);
  const [base, setBase] = useState<TestResult | null>(null);
  const [config, setConfig] = useState<RunnerConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const hw = await getHomework(id);
      if (!hw || hw.studentId !== user.uid || hw.status !== "completed" || !hw.resultId) {
        router.replace(`/dashboard/homework/${id}`);
        return;
      }
      const [full, res, mistakesRes] = await Promise.all([
        homeworkRunnerConfig(hw),
        getResult(hw.resultId),
        hw.mistakesResultId ? getResult(hw.mistakesResultId).catch(() => null) : null,
      ]);
      const last = mistakesRes ?? res;
      if (!full || !last) {
        router.replace(`/dashboard/homework/${id}`);
        return;
      }
      setHomework(hw);
      setBase(last);
      setConfig(mistakesRunnerConfig(full, last));
      setLoading(false);
    })();
  }, [id, user, router]);

  async function handleSubmit(payload: SubmitPayload): Promise<string> {
    if (!homework || !user || !config || !base) return "";
    const resultId = await saveTestResult({
      userId: user.uid,
      testId: homework.testId ?? homework.id,
      testTitle: config.title,
      testSubtitle: "",
      timeSpent: payload.timeSpent,
      rawScore: payload.rawScore,
      nmtScore: payload.nmtScore,
      maxRaw: payload.maxRaw,
      answers: payload.answers,
      questions: payload.questions,
      scoreTable: config.scoreTable,
      scaleType: "custom",
      homeworkId: homework.id,
      answerImages: payload.answerImages,
      mistakesOf: homework.resultId,
    });
    await updateHomework(homework.id, { mistakesResultId: resultId });
    queryClient.invalidateQueries({ queryKey: queryKeys.results(user.uid) });
    queryClient.invalidateQueries({ queryKey: queryKeys.studentHomework(user.uid) });
    return resultId;
  }

  if (authLoading || loading || !config || !homework) return <SpinnerScreen />;

  if (config.questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 py-6">
        <Link
          href={`/dashboard/homework/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> До завдання
        </Link>
        <EmptyState emoji="🎉" title="Помилок немає" description="Усі питання цього завдання розвʼязано правильно." />
      </div>
    );
  }

  const count = config.questions.length;
  return (
    <ExamRunner
      config={config}
      backHref={`/dashboard/homework/${id}`}
      introNote={`${pluralize(count, PLURAL.question)} з помилками. Розвʼяжи їх ще раз — бал за завдання не зміниться, а вчитель побачить, що ти виправив(-ла).`}
      untimed
      notesPdfUrl={homework.pdfUrl}
      hideReference
      allowAnswerImages
      uploadImage={(questionId, file) => uploadQuestionImage(id, questionId, file)}
      onSubmit={handleSubmit}
      resultsHref="/dashboard/homework"
      resultsLabel="До завдань"
      introEmoji="💪"
      startLabel="Виправити →"
    />
  );
}
