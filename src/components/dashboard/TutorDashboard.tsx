"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  ClipboardPlus,
  FilePlus,
  Presentation,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Lesson, collapseGroupLessons, lessonStatus, subscribeTutorLessons } from "@/lib/lessons";
import { Homework, TutorStudent, subscribeTutorHomework, subscribeTutorStudents } from "@/lib/tutor";
import { formatDueCountdown, isHomeworkOverdue, summarizeHomework } from "@/lib/homework-status";
import { addDays, startOfDay, startOfWeek } from "@/lib/calendar";
import { pluralize } from "@/lib/format";
import { computeStats } from "@/components/calendar/tutor/StatsCard";
import { useNow } from "@/components/calendar/tutor/useNow";
import { SectionLabel } from "@/components/ui/section-label";
import { UpcomingLessonsCard } from "./CalendarWidget";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Unfinished homework due within this window is worth a look. */
const SOON_MS = 2 * DAY_MS;
const ATTENTION_LIMIT = 5;

const uah = (n: number) => `${n.toLocaleString("uk")} ₴`;

/** Live data for the tutor's home page (`null` = still loading). */
function useTutorData(tutorId: string) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [students, setStudents] = useState<TutorStudent[] | null>(null);
  useEffect(() => subscribeTutorLessons(tutorId, setLessons), [tutorId]);
  useEffect(() => subscribeTutorHomework(tutorId, setHomework), [tutorId]);
  useEffect(() => subscribeTutorStudents(tutorId, setStudents), [tutorId]);
  return { lessons, homework, students };
}

/** Main column of the tutor's home: week stats, quick actions, what needs attention. */
export function TutorOverview({
  tutorId,
  ownTests = false,
}: {
  tutorId: string;
  /** A teacher (not an editor): offer their own tests among the quick actions. */
  ownTests?: boolean;
}) {
  const { lessons, homework, students } = useTutorData(tutorId);
  const now = useNow();
  const loading = lessons === null || homework === null || students === null;

  const week = useMemo(() => {
    const from = startOfWeek(new Date(now)).getTime();
    const to = addDays(new Date(from), 7).getTime();
    return computeStats(
      (lessons ?? []).filter((l) => {
        const t = l.start.toMillis();
        return t >= from && t < to;
      }),
    );
  }, [lessons, now]);

  // Debt counts over all time: an unpaid lesson from last month is still unpaid.
  const unpaid = useMemo(() => computeStats(lessons ?? []).unpaid, [lessons]);
  const hw = useMemo(() => summarizeHomework(homework ?? [], now), [homework, now]);

  const attention = useMemo(
    () =>
      (homework ?? [])
        .filter((h) => {
          if (h.status === "completed" || !h.dueAt) return false;
          return h.dueAt.toMillis() - now < SOON_MS;
        })
        .sort((a, b) => a.dueAt!.toMillis() - b.dueAt!.toMillis())
        .slice(0, ATTENTION_LIMIT),
    [homework, now],
  );

  const todayLeft = useMemo(() => {
    const end = addDays(startOfDay(new Date(now)), 1).getTime();
    return (lessons ?? []).filter(
      (l) => lessonStatus(l) === "planned" && l.start.toMillis() >= now && l.start.toMillis() < end,
    ).length;
  }, [lessons, now]);

  const tiles: { label: string; value: string; alert?: boolean }[] = [
    { label: "Учнів", value: String(students?.length ?? 0) },
    { label: "Уроків цього тижня", value: String(week.count) },
    { label: "ДЗ у роботі", value: String(hw.active + hw.overdue) },
    { label: "Не оплачено", value: uah(unpaid), alert: unpaid > 0 },
  ];

  if (!loading && students!.length === 0) return <FirstStudentCard />;

  return (
    <>
      <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionLabel>Огляд</SectionLabel>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "Завантаження…"
                : todayLeft > 0
                  ? `Сьогодні ще ${pluralize(todayLeft, ["урок", "уроки", "уроків"])}`
                  : "На сьогодні уроків більше немає"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickAction href="/tutor/homework/new" Icon={ClipboardPlus} label="Призначити ДЗ" />
            {ownTests && <QuickAction href="/tutor/tests" Icon={FilePlus} label="Тест" />}
            <QuickAction href="/tutor/calendar" Icon={CalendarPlus} label="Урок" />
            <QuickAction href="/tutor/boards" Icon={Presentation} label="Дошка" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-muted/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {t.label}
              </p>
              {loading ? (
                <div className="h-7 mt-0.5 w-10 rounded-md bg-muted animate-pulse" />
              ) : (
                <p
                  className={cn(
                    "font-heading font-bold text-xl leading-tight tabular-nums",
                    t.alert && "text-red-600 dark:text-red-400",
                  )}
                >
                  {t.value}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-base flex items-center gap-2">
            Потребує уваги
            {hw.overdue > 0 && (
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 text-red-600 dark:text-red-400 bg-red-500/10">
                {hw.overdue} прострочено
              </span>
            )}
          </h2>
          <Link
            href="/tutor/students"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Учні <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : attention.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground text-sm gap-1 py-6">
            <span className="text-2xl">✨</span>
            <p>Усе під контролем — найближчих дедлайнів немає</p>
          </div>
        ) : (
          <ul className="space-y-1 -mx-1">
            {attention.map((h) => {
              const overdue = isHomeworkOverdue(h, now);
              return (
                <li key={h.id}>
                  <Link
                    href={`/tutor/students/${h.studentId}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-glass-strong transition-colors"
                  >
                    <span
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        overdue
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {overdue ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{h.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {h.studentName ?? "Учень"} ·{" "}
                        <span className={cn(overdue && "text-red-600 dark:text-red-400 font-medium")}>
                          {formatDueCountdown(h.dueAt!.toMillis(), now)}
                        </span>
                        {h.status === "in_progress" && " · виконується"}
                      </span>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/** Right column of the tutor's home: the next lessons. */
export function TutorLessonsWidget({ tutorId }: { tutorId: string }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => subscribeTutorLessons(tutorId, setLessons), [tutorId]);
  // A group lesson is one entry, not one per member.
  const shown = useMemo(() => (lessons ? collapseGroupLessons(lessons) : null), [lessons]);
  return <UpcomingLessonsCard lessons={shown} viewer="tutor" />;
}

function QuickAction({ href, Icon, label }: { href: string; Icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-semibold border border-glass-edge bg-glass shadow-pill hover:bg-glass-strong transition-colors"
    >
      <Icon size={15} /> {label}
    </Link>
  );
}

/** A brand-new tutor: point at the one thing that unlocks everything else. */
function FirstStudentCard() {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <UserPlus size={22} />
      </div>
      <div className="flex-1">
        <h2 className="font-semibold text-base">Додайте першого учня</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Після цього тут з’являться ваші уроки, домашні завдання та статистика.
        </p>
      </div>
      <Link
        href="/tutor/students"
        className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        До учнів <ArrowRight size={15} />
      </Link>
    </section>
  );
}
