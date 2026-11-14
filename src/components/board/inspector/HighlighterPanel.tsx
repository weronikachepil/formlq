"use client";

import { HL_COLORS, HL_WIDTHS } from "../constants";
import { Icon } from "../icons";
import { useBoard } from "../useBoard";

/** Highlighter colour and width (for the tool or selected highlighter strokes). */
export function HighlighterPanel() {
  const { st, b } = useBoard();
  const sel = st.sel;
  const f = sel[0];
  const hc = f ? f.c : st.style.hc;
  const hs = f ? f.s : st.style.hs;
  return (
    <div className={"bd-insp" + (sel.length ? "" : " top")}>
      <div className="bd-sec">
        <span className="bd-lbl">Маркер</span>
        <div className="bd-colors">
          {HL_COLORS.map((c) => (
            <button
              key={c}
              className={"bd-sw" + (hc === c ? " on" : "")}
              style={{ background: c }}
              onClick={() => b()?.setHighlighter({ c })}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div className="bd-sec bd-line" title="Shift — рівна лінія для підкреслення. Маркер напівпрозорий і не закриває текст.">
        {HL_WIDTHS.map((w) => (
          <button
            key={w}
            className={"bd-w" + (hs === w ? " on" : "")}
            aria-label={`Товщина ${w}`}
            onClick={() => b()?.setHighlighter({ s: w })}
          >
            <i style={{ height: Math.max(4, w / 3) }} />
          </button>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="bd-sec bd-line bd-actions">
          <button className="bd-ibtn danger" title="Видалити (Delete)" onClick={() => b()?.deleteSelection()}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
