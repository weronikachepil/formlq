"use client";

import { useEffect, useRef } from "react";

/** Gentle snow on a canvas that fills its parent. Paused when `on` is false. */
export function Snowfall({ on }: { on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !on) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    type F = { x: number; y: number; r: number; s: number; d: number; p: number };
    let flakes: F[] = [];

    const make = (y?: number): F => ({
      x: Math.random() * w, y: y ?? Math.random() * h,
      r: 0.8 + Math.random() * 2.4, s: 0.25 + Math.random() * 0.7,
      d: 0.3 + Math.random() * 0.8, p: Math.random() * Math.PI * 2,
    });
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = Array.from({ length: Math.round(Math.min(140, w / 9)) }, () => make());
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const f of flakes) {
        f.p += 0.01; f.y += f.s; f.x += Math.sin(f.p) * f.d * 0.4;
        if (f.y > h + 4) Object.assign(f, make(-4));
        ctx.globalAlpha = 0.35 + f.r / 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); ctx.clearRect(0, 0, w, h); };
  }, [on]);

  return <canvas ref={ref} className="adv-snow" aria-hidden />;
}

const BULBS = ["#f4c430", "#cfc6f7", "#bfe0dd", "#ffb48a"];

/** String of lights across the top of the hero. */
export function Garland() {
  const swags = 12, n = 24, W = 1200, seg = W / swags;
  const d = Array.from({ length: swags }, (_, i) => `Q ${i * seg + seg / 2} 44 ${(i + 1) * seg} 6`).join(" ");
  return (
    <svg className="adv-garland" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden>
      <path d={`M0 6 ${d}`} />
      {Array.from({ length: n }, (_, i) => {
        // Two bulbs per swag, at t = 1/3 and 2/3 of each quadratic curve: y = 6 + 76·t(1−t).
        const t = i % 2 ? 2 / 3 : 1 / 3;
        const x = Math.floor(i / 2) * seg + t * seg;
        const y = 6 + 76 * t * (1 - t);
        return <ellipse key={i} cx={x} cy={y + 9} rx="5.5" ry="8.5" fill={BULBS[i % 4]} style={{ color: BULBS[i % 4], animationDelay: `${(i % 5) * 0.45}s` }} />;
      })}
    </svg>
  );
}

/** Snowy hills with pines and the formlq duckling in a winter hat. */
export function Hills() {
  return (
    <svg className="adv-hills" viewBox="0 0 1200 140" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path className="far" d="M0 90 C 180 40 340 60 520 80 S 860 30 1200 70 V140 H0z" />
      {[[90, 78, 1], [150, 70, 0.8], [470, 76, 0.75], [520, 80, 0.6], [980, 52, 1.1], [1050, 60, 0.85], [1110, 64, 0.7]].map(([x, y, k], i) => (
        <g key={i} className="pine" transform={`translate(${x} ${y}) scale(${k})`}>
          <path d="M0 -46 L16 -16 H8 L22 8 H-22 L-8 -16 H-16z" />
          <path className="tip" d="M0 -46 L7 -33 Q0 -30 -7 -33z" />
          <rect x="-3" y="8" width="6" height="8" />
        </g>
      ))}
      <path className="near" d="M0 120 C 220 80 420 96 640 112 S 1000 90 1200 104 V140 H0z" />
      <g className="duck" transform="translate(690 104)">
        <path d="M-18 4c0-8 10-10 18-6 5 2 8 0 11-2l3 3c0 11-10 19-21 17-7-1-11-6-11-12z" fill="#f4c430" />
        <circle cx="12" cy="-9" r="9" fill="#f4c430" />
        <path d="M20 -11l9 3.5-9 3.5z" fill="#ef8a2b" />
        <circle cx="14" cy="-11" r="1.5" fill="#14262a" />
        <path d="M2 -14 Q 12 -30 22 -14z" fill="#ff8d6b" />
        <circle cx="13" cy="-27" r="3.6" fill="#fff" />
        <path d="M2 -14 H22" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M4 -1 Q 13 3 20 -2 L 22 8 L17 7 L 16 1 Q 10 3 4 1z" fill="#cfc6f7" />
      </g>
    </svg>
  );
}

/* ---------- small festive icons for the calendar windows ---------- */

const ICON_PATHS: Record<string, string> = {
  tree: "M12 2 L17 9 H14 L18 15 H14 L17.5 20 H6.5 L10 15 H6 L10 9 H7 Z M12 20 V23",
  flake: "M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  gift: "M4 10h16v11H4zM3 7h18v3H3zM12 7v14M12 7C10 3 6 3 6 5.5S12 7 12 7zm0 0c2-4 6-4 6-1.5S12 7 12 7z",
  ball: "M12 8a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 5h4v3h-4zM12 5V2.5M5.8 13.5h12.4",
  bell: "M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21a2 2 0 0 0 4 0M12 3v2",
  mitten: "M7.5 21h9v-3.5c2-2 3.4-5 2.4-7-.8-1.5-2.6-1.2-3.2.4V7a4 4 0 0 0-8 0zM7.5 17.5h9",
  snowman: "M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM6.5 13L3 11M17.5 13l3.5-2",
  cane: "M9 22V8a4 4 0 0 1 8 0v1.5M9 12.5l2.5-2M9 17l2.5-2M9 21.5l2.5-2M12.5 5.5l1.5 2.5",
  candle: "M9 10h6v12H9zM12 10V7.5M12 2c1.6 2 1.6 3.6 0 4.6-1.6-1-1.6-2.6 0-4.6z",
  sock: "M8 2h7v9l3 4a3.5 3.5 0 0 1-5 5l-5-6zM8 6h7",
  cocoa: "M5 9h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4",
};

/** One icon per day, 1–24. 6 Dec is the St. Nicholas sock, 24 Dec the star. */
export const DAY_ICONS = [
  "flake", "ball", "mitten", "bell", "snowman", "sock", "tree", "candle", "cocoa", "cane", "ball", "tree",
  "flake", "bell", "mitten", "candle", "gift", "cocoa", "snowman", "cane", "ball", "bell", "gift", "star",
];

export function TileIcon({ name }: { name: string }) {
  return (
    <svg className="ticon" viewBox="0 0 24 24" aria-hidden>
      <path d={ICON_PATHS[name] ?? ICON_PATHS.flake} />
    </svg>
  );
}

export function TileBow() {
  return (
    <svg className="tbow" viewBox="0 0 40 24" aria-hidden>
      <path d="M20 12C14 2 4 2 6 9s10 5 14 3zM20 12c6-10 16-10 14-3s-10 5-14 3z" />
      <circle cx="20" cy="12" r="3.4" />
    </svg>
  );
}
