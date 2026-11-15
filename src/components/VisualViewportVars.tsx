"use client";

import { useEffect } from "react";

/**
 * Publishes the visible part of the screen as CSS variables on <html>:
 * `--vv-h` (height) and `--vv-top` (offset from the layout viewport's top).
 *
 * On tablets and phones the on-screen keyboard covers the page instead of resizing
 * it, so a dialog centred in `inset: 0` ends up under the keyboard. Overlays sized
 * with these variables stay centred in the area above it.
 */
export function VisualViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.setProperty("--vv-h", `${vv.height}px`);
        root.setProperty("--vv-top", `${vv.offsetTop}px`);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.removeProperty("--vv-h");
      root.removeProperty("--vv-top");
    };
  }, []);
  return null;
}
