"use client";

import "@/components/landing/landing.css";
import "@/components/advent/advent.css";
import { usePageHeader } from "@/context/HeaderContext";
import { AdventCalendar } from "@/components/advent/AdventCalendar";
import { AdventSharePanel } from "@/components/advent/AdventSharePanel";
import { AdventCodeEntry, useAdventAccess } from "@/components/advent/AdventAccess";

/**
 * The advent calendar inside the cabinet. Teachers and editors manage personal codes for
 * their students above a preview of the calendar; a student opens it with their code.
 */
export default function CabinetAdventPage() {
  usePageHeader("Адвент-календар", "Відлік до НМТ · 1–24 грудня");
  const access = useAdventAccess();

  if (access === "loading" || access === "signed-out") {
    return <div className="h-[420px] animate-pulse rounded-[18px] bg-muted/60" />;
  }

  return (
    <div className="space-y-6">
      {access === "staff" && <AdventSharePanel />}
      {access === "staff" && (
        <p className="text-sm text-muted-foreground">
          Так календар бачать учні з кодом. Можете розв&apos;язувати й грати теж — прогрес зберігається лише у вашому браузері.
        </p>
      )}
      <div className="landing adv-embed">
        <AdventCalendar locked={access === "none" ? <AdventCodeEntry /> : undefined} />
      </div>
    </div>
  );
}
