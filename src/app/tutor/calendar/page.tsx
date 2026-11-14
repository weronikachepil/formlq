"use client";

import { usePageHeader } from "@/context/HeaderContext";
import { TutorCalendar } from "@/components/calendar/tutor/TutorCalendar";

export default function TutorCalendarPage() {
  usePageHeader("Календар занять", "Розклад уроків з учнями");
  return <TutorCalendar />;
}
