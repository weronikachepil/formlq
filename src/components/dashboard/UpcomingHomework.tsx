"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, ClipboardCheck, FileText } from "lucide-react";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { getStudentHomework, Homework } from "@/lib/tutor";
import { formatDueCountdown, getHomeworkStatusMeta, isHomeworkOverdue } from "@/lib/homework-status";
import { cn } from "@/lib/utils";
import { useNow } from "@/components/calendar/tutor/useNow";
import { Spinner } from "@/components/ui/spinner";

/** The pending homework with the nearest deadline. */
export function UpcomingHomework({ userId }: { userId: string }) {
  const { data: list = [], isLoading } = useQuery<Homework[]>({
    queryKey: queryKeys.studentHomework(userId),
    queryFn: () => getStudentHomework(userId),
    staleTime: STALE.short,
  });
  const now = useNow();

  const next = useMemo(() => {
    const pending = list.filter((h) => h.status !== "completed");
    return pending.sort((a, b) => {
      const ad = a.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      const bd = b.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return (b.assignedAt?.toMillis() ?? 0) - (a.assignedAt?.toMillis() ?? 0);
    })[0];
  }, [list]);

  return (
    <section className="rounded-[18px] border border-border/50 bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-base">Найближче домашнє завдання</h2>
        <Link
          href="/dashboard/homework"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Усі <ArrowRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="w-5 h-5" />
        </div>
      ) : !next ? (
        <div className="flex flex-col items-center justify-center text-muted-foreground text-sm gap-1 py-8">
          <span className="text-2xl">✅</span>
          <p>Немає активних домашніх завдань</p>
        </div>
      ) : (
        <Link
          href={`/dashboard/homework/${next.id}`}
          className="group text-left rounded-[12px] border border-border/50 bg-background hover:border-primary/40 hover:bg-muted/30 transition-all p-4 flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate flex items-center gap-1.5">
              <span className="truncate">{next.title}</span>
              {next.pdfUrl && <FileText size={13} className="shrink-0 text-muted-foreground" aria-label="Є конспект" />}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              {next.status === "in_progress" && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {getHomeworkStatusMeta("in_progress", "student").label}
                </span>
              )}
              {next.dueAt ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    isHomeworkOverdue(next, now) && "text-red-600 dark:text-red-400 font-medium",
                  )}
                >
                  <CalendarClock size={11} /> {formatDueCountdown(next.dueAt.toMillis(), now)}
                </span>
              ) : (
                <span>Без дедлайну</span>
              )}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
            {next.status === "in_progress" ? "Продовжити" : "Почати"}
            <ArrowRight size={15} />
          </span>
        </Link>
      )}
    </section>
  );
}
