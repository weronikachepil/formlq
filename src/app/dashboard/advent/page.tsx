"use client";

import "@/components/landing/landing.css";
import "@/components/advent/advent.css";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { canTutor } from "@/lib/roles";
import { AdventCalendar } from "@/components/advent/AdventCalendar";
import { AdventSharePanel } from "@/components/advent/AdventSharePanel";

/**
 * The advent calendar inside the cabinet. Students play here; teachers and editors get a
 * share panel (link + QR for their students) above the same calendar as a preview.
 */
export default function CabinetAdventPage() {
  const { userProfile } = useAuth();
  const tutor = canTutor(userProfile?.role);
  usePageHeader("Адвент-календар", "Відлік до НМТ · 1–24 грудня");

  return (
    <div className="space-y-6">
      {tutor && <AdventSharePanel />}
      {tutor && (
        <p className="text-sm text-muted-foreground">
          Так календар бачать учні. Можете розв&apos;язувати й грати теж — прогрес зберігається лише у вашому браузері.
        </p>
      )}
      <div className="landing adv-embed">
        <AdventCalendar />
      </div>
    </div>
  );
}
