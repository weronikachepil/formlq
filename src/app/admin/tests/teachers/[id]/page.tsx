"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, FileText, UserRound } from "lucide-react";
import { getTest, maxRawScore, SUBJECT_LABEL, type TestQuestion } from "@/lib/tests";
import { pluralize, PLURAL } from "@/lib/format";
import { usePageHeader } from "@/context/HeaderContext";
import { MathText } from "@/components/MathText";
import { EmptyState } from "@/components/ui/empty-state";
import { SpinnerPage } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * A teacher's test, read-only, for editors: every question with its options, the right
 * answer and the explanation. Editors don't edit teachers' tests (see TeacherTestsList).
 */
export default function TeacherTestPage() {
  const { id } = useParams<{ id: string }>();
  const { data: test, isLoading } = useQuery({ queryKey: ["test", id], queryFn: () => getTest(id) });
  usePageHeader(test?.title || "Тест викладача", test?.authorName ? `Автор: ${test.authorName}` : undefined);

  if (isLoading) return <SpinnerPage />;
  if (!test) return <EmptyState emoji="🫥" title="Тест не знайдено" description="Можливо, його видалили." />;

  const questions = [...(test.questions ?? [])].sort((a, b) => a.order - b.order);
  const meta = [
    test.grade ? `${test.grade} клас` : null,
    test.subject ? SUBJECT_LABEL[test.subject] : null,
    (test.scaleType ?? "nmt") === "nmt" ? "Шкала НМТ" : "Своя шкала",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <Link
        href="/admin/tests?tab=teachers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Тести викладачів
      </Link>

      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading font-bold text-xl">{test.title || "Без назви"}</h1>
          <span
            className={cn(
              "shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full",
              test.published ? "bg-green-500/12 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground",
            )}
          >
            {test.published ? "У каталозі" : "Чернетка"}
          </span>
        </div>
        {test.subtitle && <p className="text-sm text-muted-foreground">{test.subtitle}</p>}
        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <UserRound size={12} /> {test.authorName || "Без імені"}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText size={12} /> {pluralize(questions.length, PLURAL.task)} · {pluralize(maxRawScore(questions), PLURAL.point)}
          </span>
          {test.durationMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {test.durationMinutes} хв
            </span>
          ) : null}
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </p>
      </div>

      {questions.length === 0 ? (
        <EmptyState emoji="📝" title="У тесті ще немає завдань" description="Викладач створив тест, але ще не додав питань." />
      ) : (
        questions.map((q, i) => <QuestionPreview key={q.id} q={q} index={i} />)
      )}
    </div>
  );
}

function QuestionPreview({ q, index }: { q: TestQuestion; index: number }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">
          Завдання {index + 1}
          <span className="mx-1.5 opacity-40">·</span>
          {pluralize(q.points, PLURAL.point)}
        </p>
        <MathText text={q.text || "—"} className="text-sm leading-relaxed" />
        {q.imageUrl && <Picture src={q.imageUrl} />}
      </div>

      {q.type === "mcq" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => {
            const right = o.id === q.correctOptionId;
            return (
              <div
                key={o.id}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm flex gap-2",
                  right ? "border-green-500/50 bg-green-500/10" : "border-border/50",
                )}
              >
                <span className={cn("font-semibold shrink-0", right && "text-green-700 dark:text-green-400")}>{o.id}</span>
                <div className="min-w-0">
                  {o.text && <MathText text={o.text} />}
                  {o.imageUrl && <Picture src={o.imageUrl} small />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {q.type === "open" && (
        <p className="text-sm flex items-baseline gap-2">
          <span className="text-muted-foreground text-xs shrink-0">Правильна відповідь</span>
          <MathText text={q.correctAnswer || "—"} className="font-medium text-green-700 dark:text-green-400" />
          {q.tolerance ? <span className="text-xs text-muted-foreground">± {String(q.tolerance).replace(".", ",")}</span> : null}
        </p>
      )}

      {q.type === "multi" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => {
            const right = q.correctOptionIds.includes(o.id);
            return (
              <div
                key={o.id}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm flex gap-2",
                  right ? "border-green-500/50 bg-green-500/10" : "border-border/50",
                )}
              >
                <span className={cn("font-semibold shrink-0", right && "text-green-700 dark:text-green-400")}>{o.id}</span>
                <div className="min-w-0">
                  {o.text && <MathText text={o.text} />}
                  {o.imageUrl && <Picture src={o.imageUrl} small />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {q.type === "order" && (
        <ol className="space-y-1.5 text-sm">
          {q.items.map((it, i) => (
            <li key={it.id} className="flex gap-2">
              <span className="font-semibold shrink-0 tabular-nums">{i + 1}.</span>
              <MathText text={it.text} className="min-w-0" />
            </li>
          ))}
        </ol>
      )}

      {q.type === "matching" && (
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div className="space-y-1.5">
            {q.leftItems.map((l) => {
              const r = q.rightOptions.find((x) => x.id === q.correctPairs[l.id]);
              return (
                <div key={l.id} className="flex gap-2">
                  <span className="font-semibold shrink-0">{l.id}</span>
                  <MathText text={l.text} className="min-w-0" />
                  <span className="shrink-0 font-semibold text-green-700 dark:text-green-400">→ {r?.id ?? "—"}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5">
            {q.rightOptions.map((r) => (
              <div key={r.id} className="flex gap-2">
                <span className="font-semibold shrink-0">{r.id}</span>
                <MathText text={r.text} className="min-w-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {(q.explanation || q.explanationImageUrl) && (
        <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
          <p className="text-xs text-muted-foreground mb-1">Пояснення</p>
          {q.explanation && <MathText text={q.explanation} />}
          {q.explanationImageUrl && <Picture src={q.explanationImageUrl} />}
        </div>
      )}
    </div>
  );
}

function Picture({ src, small = false }: { src: string; small?: boolean }) {
  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-border/50">
      <Image src={src} alt="" width={800} height={400} className={cn("w-full object-contain", small ? "max-h-32" : "max-h-64")} />
    </div>
  );
}
