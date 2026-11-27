"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { adventPromoActive } from "@/lib/advent";

const noop = () => () => {};

/** True while the calendar is promoted (until 7 Jan, Kyiv). Server render assumes yes. */
function usePromo() {
  return useSyncExternalStore(noop, () => adventPromoActive(), () => true);
}

/** Festive strip above the landing nav. Styled by ./advent-promo.css (scoped under .landing). */
export function AdventLandingBar() {
  if (!usePromo()) return null;
  return (
    <Link href="/advent" className="adv-bar-promo">
      <span aria-hidden>🎄</span>
      <span>
        <b>Адвент-календар «Відлік до НМТ»</b>
        <span className="sub"> — задача або гра щодня до Святвечора, а в кінці 5 імітацій НМТ у подарунок</span>
      </span>
      <span className="go" aria-hidden>→</span>
    </Link>
  );
}

/** «Адвент» item in the landing nav. */
export function AdventNavLink() {
  if (!usePromo()) return null;
  return <li><Link href="/advent">Адвент 🎄</Link></li>;
}

/** Card in the cabinet: students play, teachers and editors share it with students. */
export function AdventDashboardCard({ forTutor = false }: { forTutor?: boolean }) {
  if (!usePromo()) return null;
  return (
    <Link
      href="/advent"
      className="group flex items-center gap-4 rounded-[18px] bg-[#14262a] p-5 text-white transition-colors hover:bg-[#1d3a40]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#f4c430] text-2xl" aria-hidden>🎄</span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg font-bold leading-tight">Адвент-календар «Відлік до НМТ»</span>
        <span className="mt-0.5 block text-sm text-white/75">
          {forTutor
            ? "Поділіться з учнями: задача або міні-гра щодня до Святвечора, а в кінці 5 імітацій НМТ у подарунок."
            : "Задача або міні-гра щодня до Святвечора. Збери фразу — і відкриєш 5 імітацій НМТ."}
        </span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#14262a] sm:block">Відкрити</span>
    </Link>
  );
}
