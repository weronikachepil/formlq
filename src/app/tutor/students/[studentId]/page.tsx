"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardPlus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { queryKeys } from "@/lib/queryKeys";
import {
  getTutorStudents,
  subscribeTutorStudentHomework,
  type Homework,
} from "@/lib/tutor";
import {
  groupHomework,
  isHomeworkOverdue,
  summarizeHomework,
} from "@/lib/homework-status";
import { dayKey, sameDay } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { HomeworkListItem } from "@/components/homework/HomeworkListItem";
import {
  MiniCalendar,
  type MiniCalendarTone,
} from "@/components/calendar/MiniCalendar";

type Filter = "open" | "done" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "Активні" },
  { id: "done", label: "Виконані" },
  { id: "all", label: "Усі" },
];

/** A tutor's cabinet for one student: their homework grouped by state. */
export default function TutorStudentCabinetPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [day, setDay] = useState<Date | null>(null);
  const [now] = useState(() => Date.now());

  const { data: students = [] } = useQuery({
    queryKey: queryKeys.tutorStudents(user?.uid),
    queryFn: () => getTutorStudents(user!.uid),
    enabled: !!user,
  });
  const link = students.find((s) => s.studentId === studentId);
  const name = link?.studentName || homework?.[0]?.studentName || "Учень";

  usePageHeader(name, link?.studentEmail ?? "Кабінет учня");

  useEffect(() => {
    if (!user) return;
    return subscribeTutorStudentHomework(user.uid, studentId, setHomework);
  }, [user, studentId]);

  const summary = useMemo(
    () => summarizeHomework(homework ?? [], now),
    [homework, now],
  );
  // A picked calendar day narrows the list to homework due that day (any state).
  const groups = useMemo(() => {
    const list = day
      ? (homework ?? []).filter(
          (h) => h.dueAt && sameDay(h.dueAt.toDate(), day),
        )
      : (homework ?? []);
    return groupHomework(list, now);
  }, [homework, now, day]);
  const marks = useMemo(() => {
    const map = new Map<string, MiniCalendarTone[]>();
    for (const hw of homework ?? []) {
      if (!hw.dueAt) continue;
      const tone: MiniCalendarTone =
        hw.status === "completed"
          ? "done"
          : isHomeworkOverdue(hw, now)
            ? "danger"
            : "active";
      const key = dayKey(hw.dueAt.toDate());
      map.set(key, [...(map.get(key) ?? []), tone]);
    }
    return map;
  }, [homework, now]);
  const assign = () => router.push(`/tutor/homework/new?student=${studentId}`);

  const sections: {
    key: string;
    label: string;
    items: Homework[];
    overdue?: boolean;
  }[] = [];
  const effective: Filter = day ? "all" : filter;
  if (effective !== "done") {
    sections.push({
      key: "overdue",
      label: "Прострочені",
      items: groups.overdue,
      overdue: true,
    });
    sections.push({ key: "active", label: "Активні", items: groups.active });
  }
  if (effective !== "open")
    sections.push({ key: "done", label: "Виконані", items: groups.done });
  const shown = sections.filter((s) => s.items.length);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link
        href="/tutor/students"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Усі учні
      </Link>

      <div className="rounded-2xl border border-border/50 bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
            {name[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{name}</p>
            {link?.studentEmail && (
              <p className="text-xs text-muted-foreground truncate">
                {link.studentEmail}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-center">
          <Counter value={summary.active} label="активні" />
          <Counter
            value={summary.overdue}
            label="прострочені"
            danger={summary.overdue > 0}
          />
          <Counter value={summary.done} label="виконані" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] items-start">
        <div className="space-y-5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            {day ? (
              <button
                type="button"
                onClick={() => setDay(null)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
              >
                Дедлайн{" "}
                {day.toLocaleDateString("uk", {
                  day: "numeric",
                  month: "long",
                })}
                <X size={13} />
              </button>
            ) : (
              <div className="inline-flex rounded-full bg-muted p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "px-3.5 h-8 rounded-full text-xs font-semibold transition-colors",
                      filter === f.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <Button className="gap-1.5" onClick={assign}>
              <ClipboardPlus size={14} /> Нове завдання
            </Button>
          </div>

          {!homework ? (
            <SpinnerPage />
          ) : homework.length === 0 ? (
            <EmptyState
              emoji="📚"
              title="Немає завдань"
              description="Призначте цьому учневі перше домашнє завдання."
            />
          ) : shown.length === 0 ? (
            day ? (
              <EmptyState
                emoji="📅"
                title="На цей день завдань немає"
                description="Оберіть інший день або зніміть фільтр."
              />
            ) : (
              <EmptyState
                emoji={filter === "open" ? "🎉" : "📭"}
                title={
                  filter === "open" ? "Усе виконано" : "Виконаних ще немає"
                }
                description={
                  filter === "open"
                    ? "Активних завдань немає — можна задати нове."
                    : undefined
                }
              />
            )
          ) : (
            shown.map((s) => (
              <div key={s.key} className="space-y-2">
                <SectionLabel
                  size="2xs"
                  className={
                    s.overdue ? "text-red-600 dark:text-red-400" : undefined
                  }
                >
                  {s.label} ({s.items.length})
                </SectionLabel>
                {s.items.map((hw) => (
                  <HomeworkListItem
                    key={hw.id}
                    hw={hw}
                    href={`/tutor/homework/${hw.id}`}
                    audience="tutor"
                    overdue={s.overdue}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-20 order-first lg:order-none">
          <MiniCalendar
            marks={marks}
            selected={day}
            onSelect={setDay}
            legend={[
              { tone: "active", label: "активне" },
              { tone: "danger", label: "прострочене" },
              { tone: "done", label: "виконане" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Counter({
  value,
  label,
  danger,
}: {
  value: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-xl font-bold font-mono leading-none",
          danger && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
