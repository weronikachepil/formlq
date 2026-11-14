"use client";

import { TEXT_FONTS } from "@/lib/board/engine/shapes";
import type { DrawStyle, FormulaObject, TextFontId, TextObject } from "@/lib/board/engine/types";
import { Icon } from "../icons";
import { useBoard, useSelection } from "../useBoard";

const FONT_IDS = Object.keys(TEXT_FONTS) as TextFontId[];

/** Font family, bold, italic: for the selected text or for new text. */
export function TextStyleProps({ o }: { o: TextObject | DrawStyle }) {
  const { b } = useBoard();
  const ff = o.ff || "comfortaa";
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Шрифт</span>
      <select
        className="bd-input"
        style={{ fontFamily: TEXT_FONTS[ff]?.css, fontSize: 14 }}
        value={ff}
        onChange={(e) => b()?.setTextStyle({ ff: e.target.value as TextFontId })}
      >
        {FONT_IDS.map((k) => (
          <option key={k} value={k} style={{ fontFamily: TEXT_FONTS[k].css }}>
            {TEXT_FONTS[k].name}
          </option>
        ))}
      </select>
      <div className="bd-line">
        <button
          className={"bd-chip-btn" + (o.b ? " on" : "")}
          style={{ fontWeight: 700 }}
          title="Жирний"
          onClick={() => b()?.setTextStyle({ b: !o.b })}
        >
          Ж
        </button>
        <button
          className={"bd-chip-btn" + (o.i ? " on" : "")}
          style={{ fontStyle: "italic" }}
          title="Курсив"
          onClick={() => b()?.setTextStyle({ i: !o.i })}
        >
          К
        </button>
      </div>
    </div>
  );
}

/** Font size and "edit" for text and formulas. */
export function FontProps({ o }: { o: TextObject | FormulaObject }) {
  const { b } = useBoard();
  const act = useSelection();
  const scale = (k: number) =>
    act.set<TextObject | FormulaObject>((x) => {
      const fs = Math.max(8, Math.round(x.fs * k));
      const r = fs / x.fs;
      return { fs, w: Math.round(x.w * r), h: Math.round(x.h * r) };
    });
  return (
    <div className="bd-sec bd-line">
      <span className="bd-lbl">Розмір</span>
      <button className="bd-ibtn" onClick={() => scale(0.85)}>
        <Icon name="minus" size={16} />
      </button>
      <span className="bd-num">{Math.round(o.fs)}</span>
      <button className="bd-ibtn" onClick={() => scale(1.18)}>
        <Icon name="plus" size={16} />
      </button>
      {o.type === "formula" && (
        <button className="bd-chip-btn" onClick={() => b()?.editFormula(o.id)}>
          Редагувати
        </button>
      )}
      {o.type === "text" && (
        <button className="bd-chip-btn" onClick={() => b()?.editText({ id: o.id })}>
          Редагувати
        </button>
      )}
    </div>
  );
}
