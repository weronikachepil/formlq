import type { CSSProperties } from "react";

const LABEL_PROPS = {
  fontFamily: "Times New Roman,serif",
  fontStyle: "italic",
  fontSize: 18,
  fill: "#14262a",
} as const;

const AVATARS: { letter: string; color: string }[] = [
  { letter: "В", color: "#14262a" },
  { letter: "О", color: "#e0457b" },
  { letter: "М", color: "#3b8f86" },
];

/** Decorative preview of the collaborative math board shown in the hero. */
export function BoardMock() {
  return (
    <div className="card board-mock float" aria-hidden="true">
      <svg className="paper" viewBox="0 0 500 440" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="landing-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0V25" fill="none" stroke="#cfc6f7" strokeOpacity=".45" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="500" height="440" fill="url(#landing-grid)" />
        <path d="M60 330H470M200 40V400" stroke="#14262a" strokeWidth="2" fill="none" />
        <path
          d="M95 60 C 150 400, 250 400, 305 60"
          stroke="#e0457b"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          transform="translate(40,10) scale(.95,.9)"
        />
        <path
          d="M290 150 L420 150 L420 270 Z"
          fill="rgba(191,224,221,.55)"
          stroke="#14262a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text x="280" y="148" {...LABEL_PROPS}>A</text>
        <text x="424" y="146" {...LABEL_PROPS}>B</text>
        <text x="424" y="286" {...LABEL_PROPS}>C</text>
        <rect x="408" y="150" width="12" height="12" fill="none" stroke="#14262a" strokeWidth="1.8" />
        <circle cx="120" cy="160" r="5" fill="#e3b341" stroke="#14262a" />
      </svg>
      <div className="mock-tools">
        <i className="on">↖</i><i>✎</i><i>▭</i><i>∠</i><i>∫</i>
      </div>
      <div className="mock-people">
        {AVATARS.map((a) => (
          <span key={a.letter} className="av" style={{ background: a.color } satisfies CSSProperties}>
            {a.letter}
          </span>
        ))}
        {" 3 онлайн"}
      </div>
      <div className="mock-formula">y = x² − 4x + 3</div>
      <div className="cursor"><span>Оля</span></div>
    </div>
  );
}
