"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { adventPromoActive } from "@/lib/advent";
import "./site-winter.css";

/**
 * Seasonal winter look for the whole site (until 7 Jan, with the advent promo): a garland
 * along the top edge and light snow. Off where it would get in the way (exams, the board)
 * and on the advent pages, which have their own snow. The snow can be switched off and is
 * off by default with «reduce motion».
 */

const OFF_PREFIXES = ["/board", "/dashboard/exam", "/t/", "/a/", "/advent", "/dashboard/advent", "/admin/questions"];
const SNOW_KEY = "formlq-snow";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => { listeners.delete(cb); mq.removeEventListener("change", cb); };
}
function readSnow(): boolean {
  try {
    const v = localStorage.getItem(SNOW_KEY);
    if (v !== null) return v === "on";
  } catch { /* private mode */ }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function writeSnow(on: boolean) {
  try { localStorage.setItem(SNOW_KEY, on ? "on" : "off"); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

const noop = () => () => {};

export function SiteWinter() {
  const pathname = usePathname() ?? "";
  const active = useSyncExternalStore(noop, () => adventPromoActive(), () => false);
  const snow = useSyncExternalStore(subscribe, readSnow, () => false);
  if (!active || OFF_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return (
    <>
      <SiteGarland />
      {snow && <SiteSnow />}
      <button
        type="button"
        className="site-snow-toggle"
        aria-pressed={snow}
        aria-label={snow ? "Вимкнути сніг" : "Увімкнути сніг"}
        title={snow ? "Вимкнути сніг" : "Увімкнути сніг"}
        onClick={() => writeSnow(!snow)}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5" />
        </svg>
      </button>
    </>
  );
}

const BULBS = ["#f4c430", "#cfc6f7", "#bfe0dd", "#ffb48a"];

function SiteGarland() {
  const swags = 16, W = 1600, seg = W / swags;
  const d = Array.from({ length: swags }, (_, i) => `Q ${i * seg + seg / 2} 20 ${(i + 1) * seg} 2`).join(" ");
  return (
    <svg className="site-garland" viewBox="0 0 1600 34" preserveAspectRatio="none" aria-hidden>
      <path d={`M0 2 ${d}`} />
      {Array.from({ length: swags * 2 }, (_, i) => {
        const t = i % 2 ? 2 / 3 : 1 / 3;
        const x = Math.floor(i / 2) * seg + t * seg;
        const y = 2 + 36 * t * (1 - t);
        return (
          <ellipse key={i} cx={x} cy={y + 8} rx="5" ry="7.5" fill={BULBS[i % 4]}
            style={{ color: BULBS[i % 4], animationDelay: `${(i % 5) * 0.45}s` }} />
        );
      })}
    </svg>
  );
}

function SiteSnow() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    type F = { x: number; y: number; r: number; s: number; d: number; p: number };
    let flakes: F[] = [];
    const make = (y?: number): F => ({
      x: Math.random() * w, y: y ?? Math.random() * h,
      r: 0.8 + Math.random() * 2, s: 0.2 + Math.random() * 0.5, d: 0.3 + Math.random() * 0.7, p: Math.random() * 6.28,
    });
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Lighter than the advent hero: it falls over content people read.
      flakes = Array.from({ length: Math.round(Math.min(70, w / 22)) }, () => make());
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.classList.contains("dark");
      ctx.fillStyle = dark ? "rgba(255,255,255,.75)" : "rgba(140,172,194,.6)";
      for (const f of flakes) {
        f.p += 0.01; f.y += f.s; f.x += Math.sin(f.p) * f.d * 0.4;
        if (f.y > h + 4) Object.assign(f, make(-4));
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="site-snow" aria-hidden />;
}
