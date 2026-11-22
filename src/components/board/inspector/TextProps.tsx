"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { TEXT_FONTS } from "@/lib/board/engine/shapes";
import type { DrawStyle, FormulaObject, TextFontId, TextObject } from "@/lib/board/engine/types";
import { Icon } from "../icons";
import { useBoard, useSelection } from "../useBoard";

const FONT_IDS = Object.keys(TEXT_FONTS) as TextFontId[];

/** Dropdown of the canvas text fonts; each name is drawn in its own face. */
function FontPicker({ value, onChange }: { value: TextFontId; onChange: (ff: TextFontId) => void }) {
  const [open, setOpen] = useState(false);
  // The list renders inside the board root so board styles apply, but outside the panel so it is not clipped.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = pop.current?.offsetHeight ?? 0;
    const below = r.bottom + 6 + h <= window.innerHeight;
    setPos({ left: r.left, top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - h), minWidth: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    // The list is positioned once on open; after a resize it would float in the wrong place.
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={"bd-font-btn" + (open ? " open" : "")}
        style={{ fontFamily: TEXT_FONTS[value]?.css }}
        title="Шрифт"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          setHost(e.currentTarget.closest<HTMLElement>(".mathboard"));
          setOpen((v) => !v);
        }}
      >
        <span>{TEXT_FONTS[value]?.name}</span>
        <ChevronDown size={14} />
      </button>
      {open &&
        host &&
        createPortal(
          <div
            ref={pop}
            className="bd-font-pop"
            role="listbox"
            aria-label="Шрифт"
            style={pos ? { left: pos.left, top: pos.top, minWidth: pos.minWidth } : { visibility: "hidden" }}
          >
            {FONT_IDS.map((k) => (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={k === value}
                className={"bd-font-opt" + (k === value ? " on" : "")}
                style={{ fontFamily: TEXT_FONTS[k].css }}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
              >
                {TEXT_FONTS[k].name}
              </button>
            ))}
          </div>,
          host,
        )}
    </>
  );
}

/** Font family, bold, italic: for the selected text or for new text. */
export function TextStyleProps({ o }: { o: TextObject | DrawStyle }) {
  const { b } = useBoard();
  const ff = (o.ff || "comfortaa") as TextFontId;
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Шрифт</span>
      <div className="bd-line">
        <FontPicker value={ff} onChange={(v) => b()?.setTextStyle({ ff: v })} />
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
      <p className="bd-hint">{"Формула в тексті — між знаками $, напр. $x^2$ чи $\\frac{1}{2}$"}</p>
      {/* The slim top bar has no room for the sentence: a short chip with the same hint on hover. */}
      <span className="bd-hint-short" title={"Формула в тексті — між знаками $, напр. $x^2$ чи $\\frac{1}{2}$"}>
        {"$x^2$ — формула"}
      </span>
    </div>
  );
}

const TEXT_SIZES = [12, 16, 20, 24, 28, 36, 48, 64, 80, 120];

/** Font size for new text or formulas (the tool with nothing selected). */
export function NewSizeProps({ kind = "text" }: { kind?: "text" | "formula" }) {
  const { st, b } = useBoard();
  const key = kind === "formula" ? "mfs" : "fs";
  const fs = st.style[key];
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? TEXT_SIZES.find((v) => v > fs) : [...TEXT_SIZES].reverse().find((v) => v < fs);
    if (next) b()?.setStyle({ [key]: next });
  };
  return (
    <div className="bd-sec bd-line" title={kind === "formula" ? "Розмір формули" : "Розмір тексту"}>
      <span className="bd-lbl">Розмір</span>
      <button className="bd-ibtn" aria-label={kind === "formula" ? "Менша формула" : "Менший текст"} disabled={fs <= TEXT_SIZES[0]} onClick={() => step(-1)}>
        <Icon name="minus" size={16} />
      </button>
      <span className="bd-num">{fs}</span>
      <button
        className="bd-ibtn"
        aria-label={kind === "formula" ? "Більша формула" : "Більший текст"}
        disabled={fs >= TEXT_SIZES[TEXT_SIZES.length - 1]}
        onClick={() => step(1)}
      >
        <Icon name="plus" size={16} />
      </button>
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
      <button className="bd-ibtn" aria-label="Зменшити" title="Зменшити" onClick={() => scale(0.85)}>
        <Icon name="minus" size={16} />
      </button>
      <span className="bd-num">{Math.round(o.fs)}</span>
      <button className="bd-ibtn" aria-label="Збільшити" title="Збільшити" onClick={() => scale(1.18)}>
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
