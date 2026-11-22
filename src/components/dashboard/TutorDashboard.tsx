"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  ClipboardPlus,
  FilePlus,
  Presentation,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Lesson, collapseGroupLessons, lessonStatus, subscribeTutorLessons } from "@/lib/lessons";
import { Homework, TutorStudent, subscribeTutorHomework, subscribeTutorStudents } from "@/lib/tutor";
import { formatDueCountdown, isHomeworkOverdue, summarizeHomework } from "@/lib/homework-status";
import { addDays, formatHm, formatRelativeDay, startOfDay, startOfWeek } from "@/lib/calendar";
import { pluralize } from "@/lib/format";
import { computeStats } from "@/components/calendar/tutor/StatsCard";
import { useNow } from "@/components/calendar/tutor/useNow";
import { UpcomingLessonsCard } from "./CalendarWidget";
import { QuickAction } from "./QuickAction";
import { StudentCabinetCard } from "@/components/homework/StudentCabinetCard";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Unfinished homework due within this window is worth a look. */
const SOON_MS = 2 * DAY_MS;
const ATTENTION_LIMIT = 5;
/** Students shown on the home page; the rest are one click away. */
const STUDENTS_LIMIT = 6;

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

  // Who needs the teacher first: overdue homework, then the soonest lesson, then by name.
  const cabinets = useMemo(() => {
    return (students ?? [])
      .map((st) => {
        const next = (lessons ?? [])
          .filter((l) => l.studentId === st.studentId && lessonStatus(l) === "planned" && l.start.toMillis() >= now)
          .reduce<Lesson | null>((a, l) => (!a || l.start.toMillis() < a.start.toMillis() ? l : a), null);
        const summary = summarizeHomework((homework ?? []).filter((h) => h.studentId === st.studentId), now);
        let subtitle = "Уроків не заплановано";
        if (next) {
          const d = next.start.toDate();
          const rel = formatRelativeDay(d, now);
          // Short enough for the card: "завтра о 18:00", "24 лист. о 16:30".
          const day = rel === "сьогодні" || rel === "завтра" ? rel : d.toLocaleDateString("uk", { day: "numeric", month: "short" });
          subtitle = `Урок ${day} о ${formatHm(d)}`;
        }
        return { studentId: st.studentId, name: st.studentName, subtitle, summary, nextMs: next?.start.toMillis() ?? Infinity };
      })
      .sort(
        (a, b) =>
          Number(b.summary.overdue > 0) - Number(a.summary.overdue > 0) ||
          a.nextMs - b.nextMs ||
          a.name.localeCompare(b.name, "uk"),
      );
  }, [students, lessons, homework, now]);

  const tiles: { label: string; value: string; href: string; Icon: typeof Users; alert?: boolean }[] = [
    { label: "Учнів", value: String(students?.length ?? 0), href: "/tutor/students", Icon: Users },
    { label: "Уроків цього тижня", value: String(week.count), href: "/tutor/calendar", Icon: CalendarDays },
    { label: "ДЗ у роботі", value: String(hw.active + hw.overdue), href: "/tutor/students", Icon: ClipboardList },
    { label: "Не оплачено", value: uah(unpaid), href: "/tutor/calendar", Icon: Wallet, alert: unpaid > 0 },
  ];

  if (!loading && students!.length === 0) return <FirstStudentCard />;

  return (
    <>
      <div className={cn("grid gap-3", ownTests ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
        <QuickAction href="/tutor/homework/new" Icon={ClipboardPlus} label="Призначити ДЗ" hint="Тест або завдання з дедлайном" tone="lavender" />
        {ownTests && <QuickAction href="/tutor/tests" Icon={FilePlus} label="Створити тест" hint="Власний тест для учнів" tone="gold" />}
        <QuickAction href="/tutor/calendar" Icon={CalendarPlus} label="Запланувати урок" hint="Додати в календар" tone="mint" />
        <QuickAction href="/tutor/boards" Icon={Presentation} label="Відкрити дошку" hint="Для уроку чи пояснення" tone="peach" />
      </div>

      <section className="rounded-[18px] border border-border/50 bg-card p-5 space-y-4">
        <div>
          <h2 className="font-heading font-bold text-base">Огляд</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading
              ? "Завантаження…"
              : todayLeft > 0
                ? `Сьогодні ще ${pluralize(todayLeft, ["урок", "уроки", "уроків"])}`
                : "На сьогодні уроків більше немає"}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tiles.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="group rounded-[12px] bg-muted/70 px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.Icon size={13} className="shrink-0" />
                <span className="truncate">{t.label}</span>
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
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading font-bold text-base flex items-center gap-2">
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
              <div key={i} className="h-12 rounded-[12px] bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : attention.length === 0 ? (
          // Nothing to do = one quiet line, not half a screen.
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="shrink-0 text-green-600 dark:text-green-400" />
            Усе під контролем — найближчих дедлайнів немає
          </p>
        ) : (
          <ul className="space-y-1 -mx-1">
            {attention.map((h) => {
              const overdue = isHomeworkOverdue(h, now);
              return (
                <li key={h.id}>
                  <Link
                    href={`/tutor/students/${h.studentId}`}
                    className="flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-glass-strong transition-colors"
                  >
                    <span
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
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

      {cabinets.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-heading font-bold text-base">Мої учні</h2>
            <Link
              href="/tutor/students"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Усі учні <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cabinets.slice(0, STUDENTS_LIMIT).map(({ nextMs: _nextMs, ...c }) => (
              <StudentCabinetCard key={c.studentId} {...c} />
            ))}
          </div>
        </section>
      )}
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

/** A brand-new tutor: point at the one thing that unlocks everything else. */
function FirstStudentCard() {
  return (
    <section className="rounded-[18px] border border-border/50 bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
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
