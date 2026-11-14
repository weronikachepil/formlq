"use client";

import { useEffect, useRef } from "react";

const LOADING = "[data-page-loading]";

/**
 * Brings the page into focus (a light blur clears as it fades in). Used by section
 * `template.tsx` files, which remount on every navigation. Most pages first show a
 * spinner (SpinnerPage) while their data loads, so the effect plays when the real
 * content appears: right away if there is no spinner, otherwise once it is gone.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reveal = () =>
      el.animate([{ opacity: 0, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0)" }], {
        duration: 320,
        easing: "ease-out",
      });
    if (!el.querySelector(LOADING)) {
      reveal();
      return;
    }
    const watch = new MutationObserver(() => {
      if (el.querySelector(LOADING)) return;
      watch.disconnect();
      reveal();
    });
    watch.observe(el, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
