"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import {
  STATUS_CLS,
  STATUS_LABEL,
  assignmentStatus,
  formatWindow,
  subscribeMyAssignments,
  type Assignment,
  type AssignmentStatus,
} from "@/lib/assignments";
import { pluralize, PLURAL } from "@/lib/format";
import { NewAssignmentDialog } from "@/components/tutor/NewAssignmentDialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SpinnerPage } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** The teacher's tests given by link for a time window. */
const HOW_IT_WORKS = [
  { title: "Оберіть тест і час", text: "Коли тест відкриється і скільки триватиме.", tone: "bg-lavender" },
  { title: "Надішліть посилання", text: "Учні відкривають його й вводять імʼя та прізвище.", tone: "bg-mint" },
  { title: "Дивіться результати", text: "Бали всіх учнів — в одній таблиці.", tone: "bg-peach" },
];

export default function AssignmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<Assignment[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  usePageHeader("Тестування", "Тест за посиланням у заданий час");

  useEffect(() => {
    if (!user) return;
    return subscribeMyAssignments(user.uid, setList);
  }, [user]);
  // Statuses change on their own (scheduled → open → closed).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!list) return <SpinnerPage />;

  const groups: [AssignmentStatus, Assignment[]][] = (["open", "scheduled", "closed"] as const).map((s) => [
    s,
    list.filter((a) => assignmentStatus(a, now) === s),
  ]);

  return (
    <div className="space-y-5">
      {list.length > 0 && (
        <div className="flex justify-end">
          <Button size="lg" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus size={16} /> Нове тестування
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          emoji="⏱️"
          title="Тестувань ще немає"
          description="Контрольна для класу за посиланням: без реєстрації учнів і з результатами в одній таблиці."
          action={
            <Button size="lg" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus size={16} /> Нове тестування
            </Button>
          }
        >
          <ol className="mt-10 grid gap-3 text-left sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="rounded-[14px] bg-muted/50 p-4">
                <span className={cn("grid size-8 place-items-center rounded-full text-sm font-bold text-[#14262a]", step.tone)}>
                  {i + 1}
                </span>
                <p className="mt-3 text-sm font-semibold">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </EmptyState>
      ) : (
        groups
          .filter(([, items]) => items.length)
          .map(([status, items]) => (
            <section key={status} className="space-y-2">
              <h2 className="px-1 font-heading text-lg font-bold">
                {STATUS_LABEL[status]}
                <span className="ml-2 text-sm font-medium text-muted-foreground">{items.length}</span>
              </h2>
              {items.map((a) => (
                <Link
                  key={a.id}
                  href={`/tutor/assignments/${a.id}`}
                  className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3.5 transition-shadow hover:shadow-[0_8px_28px_rgba(20,38,42,0.08)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <CalendarClock size={12} /> {formatWindow(a)} · {pluralize(a.questionCount, PLURAL.question)}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLS[status])}>
                    {STATUS_LABEL[status]}
                  </span>
                </Link>
              ))}
            </section>
          ))
      )}

      {creating && (
        <NewAssignmentDialog onClose={() => setCreating(false)} onCreated={(id) => router.push(`/tutor/assignments/${id}`)} />
      )}
    </div>
  );
}
