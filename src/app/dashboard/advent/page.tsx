"use client";

import "@/components/landing/landing.css";
import "@/components/advent/advent.css";
import { usePageHeader } from "@/context/HeaderContext";
import { AdventCalendar } from "@/components/advent/AdventCalendar";
import { AdventSharePanel } from "@/components/advent/AdventSharePanel";
import { AdventLocked, AdventTeacherWaiting, useAdventAccess } from "@/components/advent/AdventAccess";

/**
 * The advent calendar inside the cabinet.
 * - Editors: create codes (for themselves or for a teacher) and see the calendar.
 * - Teachers who bought codes: their codes (with «buy more»); the calendar opens for them
 *   once a student has used one of their codes.
 * - Students with access: the calendar. Without access (anyone): the hero and how to buy.
 */
export default function CabinetAdventPage() {
  usePageHeader("Адвент-календар", "Відлік до НМТ · 1–24 грудня");
  const access = useAdventAccess();

  if (access === "loading" || access === "signed-out") {
    return <div className="h-[420px] animate-pulse rounded-[18px] bg-muted/60" />;
  }
  const locked = access === "none" || access === "teacher-none" || access === "teacher-waiting";
  const teacherSide = access === "admin" || access === "teacher" || access === "teacher-waiting";

  return (
    <div className="space-y-6">
      {teacherSide && <AdventSharePanel canCreate={access === "admin"} />}
      {access === "admin" && (
        <p className="text-sm text-muted-foreground">
          Режим редактора: усі 24 віконця й Ігротека відкриті вже зараз, щоб перевірити задачі та ігри. Учні отримують
          віконця по днях. Прогрес зберігається лише у вашому браузері.
        </p>
      )}
      {access === "teacher" && (
        <p className="text-sm text-muted-foreground">
          Так календар бачать учні з доступом. Можете розв&apos;язувати й грати теж — прогрес зберігається лише у вашому браузері.
        </p>
      )}
      <div className="landing adv-embed">
        <AdventCalendar
          allOpen={access === "admin"}
          locked={
            access === "teacher-waiting" ? <AdventTeacherWaiting />
            : locked ? <AdventLocked access={access} />
            : undefined
          }
        />
      </div>
    </div>
  );
}
