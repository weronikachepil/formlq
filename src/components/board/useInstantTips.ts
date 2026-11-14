"use client";

import { useEffect, type RefObject } from "react";

/**
 * Instant tooltips for `.bd [title]` elements instead of the native ones (those appear after ~1 s).
 * The `title` is moved to `data-tip` on first hover; the tip element lives inside `host`
 * so the scoped board styles apply to it.
 */
export function useInstantTips(host: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const tip = document.createElement("div");
    tip.className = "bd-tip";
    root.appendChild(tip);
    const hide = () => {
      tip.style.display = "none";
    };
    const over = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest<HTMLElement>(".bd [title], .bd [data-tip]");
      if (!el || !root.contains(el)) return hide();
      const title = el.getAttribute("title");
      if (title !== null) {
        el.dataset.tip = title;
        el.removeAttribute("title");
      }
      const text = el.dataset.tip;
      if (!text) return hide();
      tip.textContent = text;
      tip.style.display = "block";
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(6, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 6)) + "px";
      tip.style.top = (r.bottom + 6 + tip.offsetHeight > window.innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + "px";
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mousedown", hide);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mousedown", hide);
      tip.remove();
    };
  }, [host]);
}
