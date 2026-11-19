"use client";

import { queryKeys } from "@/lib/queryKeys";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  saveTestResult,
  getResult,
  updateResult,
  countMistakes,
  TestResult,
} from "@/lib/tests";
import { homeworkRunnerConfig } from "@/lib/homework-runner";
import { pluralize, PLURAL } from "@/lib/format";
import { getHomework, updateHomework, Homework } from "@/lib/tutor";
import { uploadQuestionImage } from "@/lib/storage";
import { useReferenceDrawer } from "@/context/ReferenceDrawerContext";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { CalendarClock, FileText, RotateCcw } from "lucide-react";
import { SpinnerScreen } from "@/components/ui/spinner";
import {
  ExamRunner,
  RunnerConfig,
  SubmitPayload,
} from "@/components/exam/ExamRunner";

export default function HomeworkRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openDrawer } = useReferenceDrawer();

  const [homework, setHomework] = useState<Homework | null>(null);
  const [config, setConfig] = useState<RunnerConfig | null>(null);
  const [completedResult, setCompletedResult] = useState<TestResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const hw = await getHomework(id);
      if (!hw || hw.studentId !== user.uid) {
        router.replace("/dashboard/homework");
        return;
      }
      setHomework(hw);

      // The questions and (if completed) the saved attempts are independent → fetch together.
      const [cfg, res, mistakesRes] = await Promise.all([
        homeworkRunnerConfig(hw),
        hw.status === "completed" && hw.resultId ? getResult(hw.resultId) : null,
        hw.status === "completed" && hw.mistakesResultId
          ? getResult(hw.mistakesResultId).catch(() => null)
          : null,
      ]);
      if (!cfg) {
        router.replace("/dashboard/homework");
        return;
      }
      // Mistakes still to fix: of the latest «Робота над помилками» attempt, else of the result.
      const base = mistakesRes ?? res;
      setMistakes(base ? countMistakes(base) : 0);
      setConfig(cfg);

      // Completed → review mode.
      if (res) setCompletedResult(res);
      setLoading(false);
    })();
  }, [id, user, router]);

  async function uploadImage(questionId: string, file: File): Promise<string> {
    return uploadQuestionImage(id, questionId, file);
  }

  async function handleSubmit(payload: SubmitPayload): Promise<string> {
    if (!homework || !user || !config) return "";
    const resultId = await saveTestResult({
      userId: user.uid,
      testId: homework.testId ?? homework.id,
      testTitle: homework.title,
      testSubtitle: config.subtitle ?? "",
      timeSpent: payload.timeSpent,
      rawScore: payload.rawScore,
      nmtScore: payload.nmtScore,
      maxRaw: payload.maxRaw,
      answers: payload.answers,
      questions: payload.questions,
      scoreTable: config.scoreTable,
      scaleType: config.scaleType ?? "custom",
      homeworkId: homework.id,
      answerImages: payload.answerImages,
      flaggedQuestions: payload.flaggedQuestions,
    });
    await updateHomework(homework.id, { status: "completed", resultId });
    queryClient.invalidateQueries({ queryKey: queryKeys.results(user.uid) });
    queryClient.invalidateQueries({ queryKey: queryKeys.studentHomework(user.uid) });
    return resultId;
  }

  async function handleToggleFlag(
    resultId: string,
    flagged: string[],
  ): Promise<void> {
    await updateResult(resultId, { flaggedQuestions: flagged });
  }

  async function handleProgress(
    answers: Record<string, string>,
    answerImages: Record<string, string>,
  ): Promise<void> {
    if (!homework) return;
    await updateHomework(homework.id, {
      status: "in_progress",
      progress: { answers, answerImages },
    });
  }

  if (authLoading || loading || !config) return <SpinnerScreen />;

  const detailsCard = homework && (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-2">
      <h1 className="text-lg font-bold">{homework.title}</h1>
      {homework.tutorName && (
        <p className="text-sm text-muted-foreground">Вчитель: {homework.tutorName}</p>
      )}
      {homework.dueAt && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <CalendarClock size={12} /> Дедлайн: {formatDate(homework.dueAt)}
        </p>
      )}
      {homework.note && (
        <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
          {homework.note}
        </p>
      )}
      {homework.pdfUrl && (
        <button
          onClick={() => openDrawer({ url: homework.pdfUrl, title: "Конспект" })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <FileText size={13} /> Переглянути конспект
        </button>
      )}
      {completedResult && mistakes > 0 && (
        <Link
          href={`/dashboard/homework/${homework.id}/mistakes`}
          className="mt-1 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm hover:bg-amber-500/15 transition-colors"
        >
          <RotateCcw size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1 min-w-0">
            <span className="font-semibold">Робота над помилками</span>
            <span className="text-muted-foreground"> · {pluralize(mistakes, PLURAL.mistake)}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Виправити →
          </span>
        </Link>
      )}
    </div>
  );

  return (
    <ExamRunner
      config={config}
      backHref="/dashboard/homework"
      introNote={homework?.note}
      headerSlot={detailsCard}
      untimed
      notesPdfUrl={homework?.pdfUrl}
      hideReference
      allowAnswerImages
      allowFlags
      uploadImage={uploadImage}
      onSubmit={handleSubmit}
      onToggleFlag={handleToggleFlag}
      onProgress={handleProgress}
      initialAnswers={homework?.progress?.answers}
      initialAnswerImages={homework?.progress?.answerImages}
      resultsHref="/dashboard/homework"
      resultsLabel="До завдань"
      introEmoji="📚"
      startLabel={
        homework?.progress && Object.keys(homework.progress.answers).length > 0
          ? "Продовжити →"
          : "Почати →"
      }
      initialResult={
        completedResult
          ? {
              resultId: completedResult.id,
              answers: completedResult.answers,
              answerImages: completedResult.answerImages,
              flaggedQuestions: completedResult.flaggedQuestions,
              timeSpent: completedResult.timeSpent,
              tutorComments: completedResult.tutorComments,
              tutorNote: completedResult.tutorNote,
            }
          : undefined
      }
    />
  );
}
