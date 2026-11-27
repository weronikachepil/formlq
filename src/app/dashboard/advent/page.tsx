"use client";

import "@/components/landing/landing.css";
import "@/components/advent/advent.css";
import { usePageHeader } from "@/context/HeaderContext";
import { AdventCalendar } from "@/components/advent/AdventCalendar";
import { AdventSharePanel } from "@/components/advent/AdventSharePanel";
import { AdventOrdersAdmin } from "@/components/advent/AdventOrdersAdmin";
import { AdventLocked, useAdventAccess } from "@/components/advent/AdventAccess";

/**
 * The advent calendar inside the cabinet.
 * - Editors: orders to confirm, free codes, the calendar.
 * - Teachers who bought codes: their codes (with «buy more»), the calendar as a preview.
 * - Students with access: the calendar. Without access (anyone): the hero and how to buy.
 */
export default function CabinetAdventPage() {
  usePageHeader("Адвент-календар", "Відлік до НМТ · 1–24 грудня");
  const access = useAdventAccess();

  if (access === "loading" || access === "signed-out") {
    return <div className="h-[420px] animate-pulse rounded-[18px] bg-muted/60" />;
  }
  const locked = access === "none" || access === "teacher-none";

  return (
    <div className="space-y-6">
      {access === "admin" && <AdventOrdersAdmin />}
      {(access === "admin" || access === "teacher") && <AdventSharePanel canCreate={access === "admin"} />}
      {(access === "admin" || access === "teacher") && (
        <p className="text-sm text-muted-foreground">
          Так календар бачать учні з доступом. Можете розв&apos;язувати й грати теж — прогрес зберігається лише у вашому браузері.
        </p>
      )}
      <div className="landing adv-embed">
        <AdventCalendar locked={locked ? <AdventLocked access={access} /> : undefined} />
      </div>
    </div>
  );
}
