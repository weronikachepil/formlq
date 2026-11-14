"use client";

import type { BoardObject } from "@/lib/board/engine/types";
import { COLORS, SHAPE_TOOLS, WIDTHS } from "../constants";
import { Icon } from "../icons";
import { useBoard } from "../useBoard";
import { AngleProps, LineProps } from "./AngleProps";
import { PollProps, QuizProps, StampPanel, TaskProps, TimerProps } from "./ClassroomProps";
import { GraphProps } from "./GraphProps";
import { HighlighterPanel } from "./HighlighterPanel";
import { ChartProps, ColmathProps, CplaneProps, DiceProps, FmodelProps, TrigProps } from "./MathObjProps";
import { PolygonProps, PolygonValues, QuadProps, TriangleProps } from "./PolygonProps";
import { SolidProps } from "./SolidProps";
import { FontProps, TextStyleProps } from "./TextProps";

const STROKE_TYPES = ["stroke", "line", "ellipse", "polygon", "angle", "fmodel", "colmath"];
const DASH_TYPES = ["line", "ellipse", "polygon", "angle"];
const FILL_TYPES = ["ellipse", "polygon"];

/** Construction points (solid ellipses) only have a colour. */
const isDot = (o: BoardObject) => o.type === "ellipse" && !!o.solid;

/** Right panel: properties of the selection or of the current drawing tool. */
export function Inspector() {
  const { st, b } = useBoard();
  const sel = st.sel;
  const one = sel.length === 1 ? sel[0] : null;
  const tool = st.tool;
  const drawing = tool === "pen" || tool === "highlighter" || SHAPE_TOOLS.has(tool) || tool === "text" || tool === "formula";
  if (tool === "stamp" && st.isOwner) return <StampPanel />;
  if (!sel.length && !drawing) return null;

  const hlMode = tool === "highlighter" || (sel.length > 0 && sel.every((o) => o.type === "stroke" && o.hl));
  if (hlMode) return <HighlighterPanel />;

  const types = new Set(sel.map((o) => o.type));
  const typeIn = (list: string[]) => [...types].some((t) => list.includes(t));
  const dot = sel.length ? sel.every(isDot) : tool === "dot" || tool === "odot";
  const hasStroke = !dot && (sel.length ? typeIn(STROKE_TYPES) : tool !== "text" && tool !== "formula");
  const hasFill = !dot && (sel.length ? typeIn(FILL_TYPES) : SHAPE_TOOLS.has(tool) && tool !== "line" && tool !== "arrow");
  const hasColor = sel.length ? [...types].some((t) => t !== "graph") : true;
  const first = one || sel[0];
  const curColor = first?.c || st.style.c;
  const curSize = first?.type === "stroke" && first.hl ? Math.round(first.s / 4) : first?.s || st.style.s;
  const curFill = first && "f" in first ? first.f : st.style.f;
  const curDash = first?.dash ?? st.style.dash;
  const allLocked = sel.every((o) => o.lock);

  return (
    <div className="bd-insp">
      {hasColor && (
        <div className="bd-sec">
          <div className="bd-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={"bd-sw" + (curColor === c ? " on" : "")}
                style={{ background: c }}
                onClick={() => b()?.setStyle({ c })}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      )}

      {hasStroke && (
        <div className="bd-sec bd-line">
          <span className="bd-lbl">Товщина</span>
          {WIDTHS.map((w) => (
            <button key={w} className={"bd-w" + (curSize === w ? " on" : "")} onClick={() => b()?.setStyle({ s: w })}>
              <i style={{ height: Math.max(2, w) }} />
            </button>
          ))}
          {(sel.length ? typeIn(DASH_TYPES) : SHAPE_TOOLS.has(tool)) && (
            <button className={"bd-chip-btn" + (curDash ? " on" : "")} onClick={() => b()?.setStyle({ dash: !curDash })}>
              Пунктир
            </button>
          )}
        </div>
      )}

      {tool === "pen" && sel.length === 0 && (
        <div className="bd-sec">
          <button
            className={"bd-chip-btn" + (st.prefs.recognize ? " on" : "")}
            onClick={() => b()?.setPrefs({ recognize: !st.prefs.recognize })}
          >
            Розпізнавати фігури
          </button>
          <p className="bd-hint">
            Намалюйте коло, трикутник, прямокутник чи рівну лінію і затримайте ручку — фігура вирівняється. З лінійкою ручка малює
            вздовж її краю, Shift — рівна лінія.
          </p>
        </div>
      )}

      {hasFill && (
        <div className="bd-sec bd-line">
          <span className="bd-lbl">Заливка</span>
          <button className={"bd-chip-btn" + (!curFill ? " on" : "")} onClick={() => b()?.setStyle({ f: null })}>
            Немає
          </button>
          <button className={"bd-chip-btn" + (curFill ? " on" : "")} onClick={() => b()?.setStyle({ f: curColor })}>
            Колір
          </button>
        </div>
      )}

      {one?.type === "line" && <LineProps o={one} />}
      {one?.type === "polygon" && (
        <>
          <PolygonProps o={one} />
          <PolygonValues o={one} />
          {one.pts.length === 3 && <TriangleProps o={one} />}
          {one.pts.length === 4 && <QuadProps o={one} />}
        </>
      )}
      {(one?.type === "text" || one?.type === "formula") && <FontProps o={one} />}
      {one?.type === "text" ? <TextStyleProps o={one} /> : tool === "text" && !sel.length && <TextStyleProps o={st.style} />}
      {one?.type === "graph" && <GraphProps o={one} inter={st.inter === one.id} />}
      {one?.type === "solid" && <SolidProps o={one} secPick={st.secPick === one.id} />}
      {one?.type === "quiz" && <QuizProps o={one} />}
      {one?.type === "angle" && <AngleProps o={one} />}
      {one?.type === "poll" && <PollProps o={one} />}
      {one?.type === "timer" && <TimerProps o={one} />}
      {one?.type === "task" && <TaskProps o={one} />}
      {one?.type === "image" && (
        <div className="bd-sec">
          {one.pdf && (
            <p className="bd-hint">
              PDF «{one.pdf}», сторінка {one.pdfPage}
            </p>
          )}
          <div className="bd-line wrap">
            <button className="bd-chip-btn" onClick={() => b()?.morePdf(one)}>
              {one.pdf ? "Довставити сторінки" : "Додати сторінки з PDF"}
            </button>
          </div>
        </div>
      )}
      {one?.type === "chart" && <ChartProps o={one} />}
      {one?.type === "dice" && <DiceProps o={one} />}
      {one?.type === "ptree" && (
        <div className="bd-sec bd-line wrap">
          <button className="bd-chip-btn" onClick={() => b()?.editSrc(one.id)}>
            Змінити дерево
          </button>
        </div>
      )}
      {one?.type === "cplane" && <CplaneProps o={one} />}
      {one?.type === "colmath" && <ColmathProps o={one} />}
      {one?.type === "fmodel" && <FmodelProps o={one} />}
      {one?.type === "numline" && (
        <div className="bd-sec bd-line wrap">
          <button className="bd-chip-btn" onClick={() => b()?.editNumline(one.id)}>
            Змінити проміжки
          </button>
        </div>
      )}
      {one?.type === "trig" && <TrigProps o={one} inter={st.inter === one.id} />}

      {sel.length > 0 && (
        <div className="bd-sec bd-line bd-actions">
          {sel.length > 1 && (
            <button className="bd-ibtn" title="Згрупувати (Ctrl+G)" onClick={() => b()?.groupSelected()}>
              <Icon name="group" size={18} />
            </button>
          )}
          {sel.some((o) => o.grp) && (
            <button className="bd-ibtn" title="Розгрупувати (Ctrl+Shift+G)" onClick={() => b()?.ungroupSelected()}>
              <Icon name="ungroup" size={18} />
            </button>
          )}
          {st.isOwner && (
            <button
              className={"bd-ibtn" + (allLocked ? " on" : "")}
              title={allLocked ? "Розблокувати" : "Заблокувати: ніхто не зможе змістити чи видалити"}
              onClick={() => b()?.setLock(!allLocked)}
            >
              <Icon name={allLocked ? "unlock" : "lock"} size={18} />
            </button>
          )}
          <button
            className="bd-ibtn"
            title="Дублювати (Ctrl+D)"
            onClick={() => {
              const bb = b();
              if (!bb) return;
              const t = bb.tx();
              bb.duplicateSelection(t);
              t.done();
            }}
          >
            <Icon name="copy" size={18} />
          </button>
          <button className="bd-ibtn" title="На передній план" onClick={() => b()?.reorder(true)}>
            <Icon name="front" size={18} />
          </button>
          <button className="bd-ibtn" title="На задній план" onClick={() => b()?.reorder(false)}>
            <Icon name="back" size={18} />
          </button>
          <button className="bd-ibtn danger" title="Видалити (Delete)" onClick={() => b()?.deleteSelection()}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
