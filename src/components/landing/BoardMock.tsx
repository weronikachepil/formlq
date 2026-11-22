import type { CSSProperties, ReactNode } from "react";

const AVATARS: { letter: string; color: string }[] = [
  { letter: "В", color: "#14262a" },
  { letter: "О", color: "#e0457b" },
  { letter: "М", color: "#3b8f86" },
];

// Board coordinates: origin at (200, 300) in a 500×440 viewBox, 1 unit = 50px
// (two 25px grid cells), so the drawing matches the maths exactly.
const O = { x: 200, y: 300 };
const U = 50;
const sx = (x: number) => O.x + x * U;
const sy = (y: number) => O.y - y * U;

/** y = x² − 4x + 3: zeros 1 and 3, vertex (2; −1), y-intercept 3. */
const f = (x: number) => x * x - 4 * x + 3;
const CURVE = Array.from({ length: 91 }, (_, i) => -0.15 + (4.3 * i) / 90)
  .map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(f(x)).toFixed(1)}`)
  .join(" ");

const POINTS: { x: number; y: number; label: string; dx: number; dy: number; anchor?: "end" }[] = [
  { x: 1, y: 0, label: "1", dx: -8, dy: 20, anchor: "end" },
  { x: 3, y: 0, label: "3", dx: 8, dy: 20 },
  { x: 2, y: -1, label: "(2; −1)", dx: 12, dy: 22 },
  { x: 0, y: 3, label: "(0; 3)", dx: -10, dy: -8, anchor: "end" },
];

const TOOLS: { key: string; on?: boolean; icon: ReactNode }[] = [
  { key: "select", icon: <path d="M6 4l12 7-5.5 1.5L10 18z" /> },
  { key: "pen", icon: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" /> },
  { key: "shapes", icon: <><rect x="4" y="4" width="9" height="9" rx="1.5" /><circle cx="16" cy="16" r="4.5" /></> },
  { key: "graph", on: true, icon: <path d="M4 4v16h16M7 6c2 9 5 11 7 11s4-4 5-9" /> },
  { key: "text", icon: <path d="M6 6h12M12 6v13" /> },
];

/** Decorative preview of the collaborative math board: a function graph with its analysis. */
export function BoardMock({ patternId = "landing-grid" }: { patternId?: string }) {
  return (
    <div className="card board-mock" aria-hidden="true">
      <svg className="paper" viewBox="0 0 500 440" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={patternId} width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0V25" fill="none" stroke="#14262a" strokeOpacity=".07" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="500" height="440" fill={`url(#${patternId})`} />

        {/* axes */}
        <g stroke="#14262a" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d={`M60 ${O.y}H486M480 ${O.y - 5}l6 5-6 5`} />
          <path d={`M${O.x} 352V24M${O.x - 5} 30l5-6 5 6`} />
        </g>
        <g className="bm-axis">
          <text x="482" y={O.y + 20} textAnchor="end">x</text>
          <text x={O.x + 10} y="34">y</text>
          <text x={O.x - 8} y={O.y + 18} textAnchor="end">0</text>
        </g>

        {/* axis of symmetry */}
        <path d={`M${sx(2)} ${sy(4)}V${sy(-1)}`} stroke="#8b7fd6" strokeWidth="1.4" strokeDasharray="5 5" />

        <path d={CURVE} fill="none" stroke="#e0457b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {POINTS.map((p) => (
          <g key={p.label}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="5" fill="#fff" stroke="#e0457b" strokeWidth="2.5" />
            <text className="bm-label" x={sx(p.x) + p.dx} y={sy(p.y) + p.dy} textAnchor={p.anchor ?? "start"}>
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mock-tools">
        {TOOLS.map((t) => (
          <i key={t.key} className={t.on ? "on" : undefined}>
            <svg viewBox="0 0 24 24">{t.icon}</svg>
          </i>
        ))}
      </div>

      <div className="mock-people">
        {AVATARS.map((a) => (
          <span key={a.letter} className="av" style={{ background: a.color } satisfies CSSProperties}>
            {a.letter}
          </span>
        ))}
        {" 3 онлайн"}
      </div>

      <div className="mock-formula">
        <p><i className="swatch" />y = x² − 4x + 3</p>
        <small>Нулі: 1 і 3 · вершина (2; −1)</small>
      </div>

      <div className="cursor"><span>Оля</span></div>
    </div>
  );
}
