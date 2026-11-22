"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { isEditor } from "@/lib/roles";
import { IconButton } from "@/components/ui/icon-button";
import { getResult, updateResult, TestResult } from "@/lib/tests";
import { getHomework, deleteHomework, setHomeworkDue, Homework } from "@/lib/tutor";
import { DueEditor } from "@/components/homework/DueEditor";
import { ResultsView } from "@/components/exam/ResultsView";
import { SpinnerPage } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useReferenceDrawer } from "@/context/ReferenceDrawerContext";
import Link from "next/link";
import { Trash2, FileText, ChevronRight } from "lucide-react";
import { getHomeworkStatusMeta, isHomeworkOverdue } from "@/lib/homework-status";
import { pluralize, PLURAL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNow } from "@/components/calendar/tutor/useNow";

export default function TutorHomeworkReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const { openDrawer } = useReferenceDrawer();
  const router = useRouter();

  const [homework, setHomework] = useState<Homework | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = useNow();

  // The homework's own name is the page title; the student is one line below it.
  usePageHeader(homework?.title ?? "Завдання", homework?.studentName ?? "");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const hw = await getHomework(id);
      // Owner tutor or any editor may review.
      if (!hw || (hw.tutorId !== user.uid && !isEditor(userProfile?.role))) {
        router.replace("/tutor/students");
        return;
      }
      setHomework(hw);
      if (hw.status === "completed" && hw.resultId) {
        const res = await getResult(hw.resultId);
        if (res) {
          setResult(res);
          setComments(res.tutorComments ?? {});
          setNote(res.tutorNote ?? "");
        }
      }
      setLoading(false);
    })();
  }, [id, user, userProfile, router]);

  async function saveComment(questionId: string, value: string) {
    if (!result) return;
    const next = { ...comments, [questionId]: value };
    setComments(next);
    await updateResult(result.id, { tutorComments: next });
  }

  async function saveNote(value: string) {
    if (!result) return;
    await updateResult(result.id, { tutorNote: value });
  }

  async function handleDelete() {
    await deleteHomework(id);
    router.replace(homework ? `/tutor/students/${homework.studentId}` : "/tutor/students");
  }

  if (loading) return <SpinnerPage />;
  if (!homework) return null;

  const status = getHomeworkStatusMeta(homework.status, "tutor");
  const overdue = isHomeworkOverdue(homework, now);
  const total = homework.questions?.length ?? 0;
  const answered = Object.values(homework.progress?.answers ?? {}).filter((a) => a !== "").length;
  const facts = [
    total ? pluralize(total, PLURAL.question) : null,
    homework.durationMinutes ? `${homework.durationMinutes} хв` : null,
    homework.assignId && homework.groupName ? `група «${homework.groupName}»` : null,
  ].filter(Boolean);

  return (
    <div className="max-w-3xl space-y-5 pb-8">
      {/* What was assigned, to whom, by when. */}
      <div className="rounded-[18px] bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/tutor/students/${homework.studentId}`}
            className="group inline-flex min-w-0 items-center gap-3 rounded-[14px] -m-1 p-1 hover:bg-muted/60"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {(homework.studentName ?? "У")[0].toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{homework.studentName ?? "Учень"}</span>
              <span className="block truncate text-xs text-muted-foreground">Кабінет учня</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                overdue ? "bg-red-500/10 text-red-600 dark:text-red-400" : status.cls,
              )}
            >
              <status.Icon size={12} />
              {overdue ? "Прострочено" : status.label}
            </span>
            <IconButton size="md" tone="danger" label="Видалити завдання" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4">
          {facts.length > 0 && <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>}
          <DueEditor
            dueAt={homework.dueAt ?? null}
            groupName={homework.assignId ? homework.groupName : undefined}
            onSave={async (dueAt, wholeGroup) => {
              const n = await setHomeworkDue(homework, dueAt, wholeGroup);
              setHomework({ ...homework, dueAt });
              return n;
            }}
          />
          {homework.note && (
            <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{homework.note}</p>
          )}
          {homework.pdfUrl && (
            <button
              onClick={() => openDrawer({ url: homework.pdfUrl, title: "Конспект" })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <FileText size={14} /> Переглянути конспект
            </button>
          )}
        </div>
      </div>

      {homework.status !== "completed" || !result ? (
        // Not done yet: one calm card saying how far the student got.
        <div className="rounded-[18px] bg-card p-5 sm:p-6">
          <p className="font-semibold">
            {homework.status === "in_progress" ? "Учень виконує завдання" : "Учень ще не починав"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {homework.status === "in_progress" && total
              ? `Відповів на ${answered} з ${total}. Результати з’являться, коли учень завершить.`
              : "Результати з’являться тут, коли учень завершить завдання."}
          </p>
          {homework.status === "in_progress" && total > 0 && (
            <div className="mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((answered / total) * 100)}%` }} />
            </div>
          )}
        </div>
      ) : (
        <ResultsView
          result={result}
          answerLabel="Відповідь учня"
          answerImages={result.answerImages}
          flagged={result.flaggedQuestions ?? []}
          flaggedBanner
          editableNote={{ value: note, onSave: (v) => { setNote(v); saveNote(v); } }}
          editableComment={(qId) => ({
            value: comments[qId] ?? "",
            onSave: (v) => saveComment(qId, v),
          })}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Видалити завдання?"
        description="Завдання та його результат буде видалено для учня."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
