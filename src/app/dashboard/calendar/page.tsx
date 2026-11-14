"use client";

import { usePageHeader } from "@/context/HeaderContext";
import { StudentCalendar } from "@/components/calendar/student/StudentCalendar";

export default function StudentCalendarPage() {
  usePageHeader("Календар занять", "Розклад уроків і дедлайни домашніх");
  return <StudentCalendar />;
}
