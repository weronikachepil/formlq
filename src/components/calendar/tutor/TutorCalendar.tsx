"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { Lesson, subscribeTutorLessons } from "@/lib/lessons";
import { Homework, getTutorStudents, subscribeTutorHomework } from "@/lib/tutor";
import { TutorCalendarView } from "./TutorCalendarView";

/** Signed-in tutor's calendar: live lessons + homework, students list. */
export function TutorCalendar() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeTutorLessons(user.uid, setLessons);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeTutorHomework(user.uid, setHomework);
  }, [user]);

  const { data: links = [] } = useQuery({
    queryKey: queryKeys.tutorStudents(user?.uid),
    queryFn: () => getTutorStudents(user!.uid),
    enabled: !!user,
  });
  const students = useMemo(
    () => links.map((s) => ({ studentId: s.studentId, studentName: s.studentName })),
    [links],
  );

  if (!user) return null;
  return (
    <TutorCalendarView
      tutorId={user.uid}
      tutorName={user.displayName ?? undefined}
      lessons={lessons}
      homework={homework}
      students={students}
    />
  );
}
