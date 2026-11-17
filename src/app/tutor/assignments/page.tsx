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
import { SectionLabel } from "@/components/ui/section-label";
import { SpinnerPage } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** The teacher's tests given by link for a time window. */
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
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex justify-end">
        <Button size="lg" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus size={16} /> Нове тестування
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          emoji="⏱️"
          title="Тестувань ще немає"
          description="Оберіть тест і час: учні відкриють його за посиланням, введуть імʼя та прізвище, а ви побачите результати."
        />
      ) : (
        groups
          .filter(([, items]) => items.length)
          .map(([status, items]) => (
            <section key={status} className="space-y-2">
              <SectionLabel className="px-1">
                {STATUS_LABEL[status]} · {items.length}
              </SectionLabel>
              {items.map((a) => (
                <Link
                  key={a.id}
                  href={`/tutor/assignments/${a.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 hover:border-foreground/25 transition-colors"
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
