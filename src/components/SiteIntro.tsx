"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Set for the browser session after the intro has played once. */
const SEEN_KEY = "formlq-intro-seen";
/** Writing (0.2 s delay + 2.2 s) plus a pause to read it, then the overlay fades out. */
const PLAY_MS = 2900;
const LEAVE_MS = 800;

/** Where the site is "opened": the landing and the signed-in app (not the board, login or shared tests). */
const shownOn = (path: string) => path === "/" || /^\/(dashboard|tutor|admin)(\/|$)/.test(path);

// Runs while the HTML is parsed, before first paint: on later visits in the same
// session the intro is hidden by CSS right away instead of flashing in.
const PRE_PAINT = `try{if(sessionStorage.getItem("${SEEN_KEY}"))document.documentElement.setAttribute("data-intro-seen","")}catch(e){}`;

/**
 * First open of the site in a browser session (landing or the signed-in app): the page
 * is blurred and «formlq» is written out in the logo's script font, then the overlay
 * fades away. A click or Esc skips it. Lives in the root layout, so it keeps playing
 * through the landing → dashboard redirect of a signed-in user.
 */
export function SiteIntro() {
  const path = usePathname();
  // Decided once, on the page the site was opened at.
  const [eligible] = useState(() => shownOn(path));
  const [phase, setPhase] = useState<"play" | "leave" | "done">("play");
  const leave = useCallback(() => setPhase((p) => (p === "play" ? "leave" : p)), []);

  useEffect(() => {
    if (!eligible) return;
    const skip =
      document.documentElement.hasAttribute("data-intro-seen") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked: the intro may play again on the next visit.
    }
    // Already hidden by CSS (seen this session / reduced motion): nothing to play.
    if (skip) return;
    const t = setTimeout(leave, PLAY_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leave();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [eligible, leave]);

  useEffect(() => {
    if (phase !== "leave") return;
    const t = setTimeout(() => setPhase("done"), LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (!eligible || phase === "done") return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      <div className={"site-intro" + (phase === "leave" ? " leave" : "")} aria-hidden="true" onClick={leave}>
        {/* The mask sits on the padded wrapper so the script's flourishes and the duck are not cut off. */}
        <span className="site-intro-ink">
          <span className="mb-logo">formlq</span>
        </span>
      </div>
    </>
  );
}
