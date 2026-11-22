"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { subscribeStudentLessons, Lesson } from "@/lib/lessons";
import { LessonViewModal } from "@/components/calendar/LessonViewModal";
import { UpcomingLessons, upcomingLessons } from "@/components/calendar/student/UpcomingLessons";
import { tutorsOf } from "@/components/calendar/student/student-mode";
import { makeColorOf } from "@/components/calendar/tutor/colors";
import { StudentColorsProvider } from "@/components/calendar/tutor/student-colors";
import { useNow } from "@/components/calendar/tutor/useNow";

const LIMIT = 4;

/** Dashboard card: the student's next lessons + link to the full calendar. */
export function CalendarWidget({ userId }: { userId: string }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => subscribeStudentLessons(userId, setLessons), [userId]);
  return <UpcomingLessonsCard lessons={lessons} />;
}

/** Presentational part of `CalendarWidget` (`null` lessons = loading). */
export function UpcomingLessonsCard({
  lessons,
  viewer = "student",
}: {
  lessons: Lesson[] | null;
  /** Tutors see students' names and go to their own calendar. */
  viewer?: "student" | "tutor";
}) {
  const isTutor = viewer === "tutor";
  const now = useNow(30000);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const tutors = useMemo(() => tutorsOf(lessons ?? []), [lessons]);
  const colorOf = useMemo(
    () => makeColorOf(isTutor ? (lessons ?? []).map((l) => l.studentId) : tutors.map((t) => t.id)),
    [isTutor, lessons, tutors],
  );
  const next = useMemo(() => upcomingLessons(lessons ?? [], now, LIMIT), [lessons, now]);

  return (
    <StudentColorsProvider value={colorOf}>
      <section className="rounded-[18px] border border-border/50 bg-card p-4 space-y-2">
        <h2 className="font-heading font-bold text-base px-1.5">Найближчі заняття</h2>
        {lessons === null ? (
          <div className="space-y-2 py-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-11 rounded-xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : next.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">Немає запланованих занять</p>
        ) : (
          <div className="-mx-1">
            <UpcomingLessons
              lessons={next}
              now={now}
              showTutor={tutors.length > 1}
              viewer={viewer}
              onOpen={setSelected}
            />
          </div>
        )}
        <Link
          href={isTutor ? "/tutor/calendar" : "/dashboard/calendar"}
          className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-glass-strong transition-colors"
        >
          Увесь календар <ArrowRight size={13} />
        </Link>
      </section>
      <LessonViewModal
        lesson={selected}
        onClose={() => setSelected(null)}
        colorDot={selected ? colorOf(isTutor ? selected.studentId : selected.tutorId).dot : undefined}
        hideStudent={!isTutor}
      />
    </StudentColorsProvider>
  );
}
