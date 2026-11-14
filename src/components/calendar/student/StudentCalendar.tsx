"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Lesson, subscribeStudentLessons } from "@/lib/lessons";
import { Homework, subscribeStudentHomework } from "@/lib/tutor";
import { StudentCalendarView } from "./StudentCalendarView";

/** Signed-in student's calendar: live lessons + homework deadlines. */
export function StudentCalendar() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeStudentLessons(user.uid, setLessons);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeStudentHomework(user.uid, setHomework);
  }, [user]);

  if (!user) return null;
  return <StudentCalendarView lessons={lessons} homework={homework} />;
}
