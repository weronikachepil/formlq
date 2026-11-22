"use client";

import type { BoardObject, PolygonObject } from "@/lib/board/engine/types";
import { colorName, COLORS, SHAPE_TOOLS, WIDTHS } from "../constants";
import { Icon } from "../icons";
import { useBoard } from "../useBoard";
import { AngleProps, LineProps } from "./AngleProps";
import { PollProps, QuizProps, StampPanel, TaskProps, TimerProps } from "./ClassroomProps";
import { GraphProps } from "./GraphProps";
import { HighlighterPanel } from "./HighlighterPanel";
import { ChartProps, ColmathProps, CplaneProps, DiceProps, FmodelProps, TrigProps } from "./MathObjProps";
import { CirclesProps, MarksToggle, PolygonProps, PolygonValues, QuadProps, TriangleProps } from "./PolygonProps";
import { MenuTabs, useMenuTab } from "../controls";
import { SolidProps } from "./SolidProps";
import { FontProps, NewSizeProps, TextStyleProps } from "./TextProps";

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
  if (tool === "eraser" && !sel.length) return <EraserPanel />;
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

  /** Pen, text and formula settings without a selection fit in one row: show them as a slim bar at the top. */
  const bar = !sel.length && (tool === "pen" || tool === "text" || tool === "formula");

  const styleBlock = (
    <>
      {hasColor && (
        <div className="bd-sec">
          <div className="bd-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={"bd-sw" + (curColor === c ? " on" : "")}
                style={{ background: c }}
                onClick={() => b()?.setStyle({ c })}
                aria-label={colorName(c)}
                title={colorName(c)}
                aria-pressed={curColor === c}
              />
            ))}
          </div>
        </div>
      )}

      {hasStroke && (
        <div className="bd-sec bd-line">
          {WIDTHS.map((w) => (
            <button
              key={w}
              className={"bd-w" + (curSize === w ? " on" : "")}
              title={`Товщина ${w}`}
              aria-label={`Товщина ${w}`}
              onClick={() => b()?.setStyle({ s: w })}
            >
              <i style={{ height: Math.max(2, w) }} />
            </button>
          ))}
        </div>
      )}

      {hasStroke && (sel.length ? typeIn(DASH_TYPES) : SHAPE_TOOLS.has(tool)) && (
        <Choice
          label="Лінія"
          options={[
            ["Суцільна", !curDash, () => b()?.setStyle({ dash: false })],
            ["Пунктир", !!curDash, () => b()?.setStyle({ dash: true })],
          ]}
        />
      )}

      {tool === "pen" && sel.length === 0 && (
        <div className="bd-sec bd-line">
          <button
            className={"bd-chip-btn" + (st.prefs.pressure ? " on" : "")}
            title="Лінія товща, коли сильніше натискаєте стилусом"
            aria-pressed={st.prefs.pressure}
            onClick={() => b()?.setPrefs({ pressure: !st.prefs.pressure })}
          >
            Натиск
          </button>
          <button
            className={"bd-chip-btn" + (st.prefs.recognize ? " on" : "")}
            title="Намалюйте коло, трикутник, прямокутник чи рівну лінію і затримайте ручку — фігура вирівняється. З лінійкою ручка малює вздовж її краю, Shift — рівна лінія."
            aria-pressed={st.prefs.recognize}
            onClick={() => b()?.setPrefs({ recognize: !st.prefs.recognize })}
          >
            Розпізнавати фігури
          </button>
        </div>
      )}

      {hasFill && (
        <Choice
          label="Заливка"
          options={[
            ["Немає", !curFill, () => b()?.setStyle({ f: null })],
            ["Колір", !!curFill, () => b()?.setStyle({ f: curColor })],
          ]}
        />
      )}
    </>
  );

  return (
    <div className={"bd-insp" + (bar ? " top" : "")}>
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
      {one?.type === "polygon" ? (
        <PolygonInspector o={one} style={styleBlock} />
      ) : one?.type === "solid" ? null : (
        styleBlock
      )}
      {one?.type === "line" && <LineProps o={one} />}
      {(one?.type === "text" || one?.type === "formula") && <FontProps o={one} />}
      {one?.type === "text" ? <TextStyleProps o={one} /> : tool === "text" && !sel.length && <TextStyleProps o={st.style} />}
      {tool === "text" && !sel.length && <NewSizeProps />}
      {tool === "formula" && !sel.length && <NewSizeProps kind="formula" />}
      {one?.type === "graph" && <GraphProps o={one} inter={st.inter === one.id} />}
      {one?.type === "solid" && <SolidProps o={one} secPick={st.secPick === one.id} style={styleBlock} />}
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
            {st.canEdit && !one.rot && !one.lock && (
              <button
                className={"bd-chip-btn" + (st.cropEdit === one.id ? " on" : "")}
                onClick={() => b()?.toggleCrop(one.id)}
                title="Тягніть ручки рамки, щоб сховати частину зображення; пізніше розширте рамку, щоб показати більше"
              >
                {st.cropEdit === one.id ? "Готово" : "Обрізати"}
              </button>
            )}
            {st.canEdit && !one.lock && one.crop && (
              <button className="bd-chip-btn" onClick={() => b()?.resetCrop(one.id)}>
                Показати все
              </button>
            )}
            <button className="bd-chip-btn" onClick={() => b()?.morePdf(one)}>
              {one.pdf ? "Додати ще сторінки" : "Додати сторінки з PDF"}
            </button>
          </div>
          {st.cropEdit === one.id && (
            <p className="bd-hint">Тягніть ручки, щоб обрізати; всередині рамки — щоб зсунути зображення. Esc — готово.</p>
          )}
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
    </div>
  );
}

const ERASER_SIZES: [px: number, name: string][] = [
  [6, "Мала"],
  [12, "Середня"],
  [24, "Велика"],
];

/** Eraser size, in a slim bar at the top like the pen's. */
function EraserPanel() {
  const { st, b } = useBoard();
  const cur = st.prefs.eraser || 10;
  return (
    <div className="bd-insp top">
      <div className="bd-sec bd-line">
        <span className="bd-lbl">Гумка</span>
        {ERASER_SIZES.map(([px, name]) => (
          <button
            key={px}
            className={"bd-w" + (Math.abs(cur - px) < 3 ? " on" : "")}
            title={name}
            aria-label={`${name} гумка`}
            aria-pressed={Math.abs(cur - px) < 3}
            onClick={() => b()?.setPrefs({ eraser: px })}
          >
            <i style={{ width: px, height: px, borderRadius: "50%" }} />
          </button>
        ))}
        <i className="sep v" />
        <button
          className={"bd-chip-btn" + (st.prefs.eraseParts ? " on" : "")}
          aria-pressed={st.prefs.eraseParts}
          title="Стирає лише те, що під гумкою"
          onClick={() => b()?.setPrefs({ eraseParts: true })}
        >
          Частину
        </button>
        <button
          className={"bd-chip-btn" + (!st.prefs.eraseParts ? " on" : "")}
          aria-pressed={!st.prefs.eraseParts}
          title="Стирає штрих повністю"
          onClick={() => b()?.setPrefs({ eraseParts: false })}
        >
          Штрих
        </button>
      </div>
    </div>
  );
}

type PolyTab = "style" | "labels" | "cons";

/**
 * A figure has many settings: style, labels and constructions go to tabs (as in the menus),
 * instead of one long list. The last tab is remembered.
 */
function PolygonInspector({ o, style }: { o: PolygonObject; style: React.ReactNode }) {
  const n = o.pts.length;
  const tabs: [PolyTab, string][] =
    n === 3 || n === 4
      ? [
          ["style", "Стиль"],
          ["labels", "Підписи"],
          ["cons", "Побудови"],
        ]
      : [
          ["style", "Стиль"],
          ["labels", "Підписи"],
        ];
  const [tab, pick] = useMenuTab<PolyTab>("mb-insp-poly", tabs, "style");
  return (
    <>
      <MenuTabs label="Налаштування фігури" tabs={tabs} tab={tab} onPick={pick} />
      {tab === "style" && style}
      {tab === "labels" && (
        <>
          <PolygonProps o={o} />
          <MarksToggle o={o} />
          <PolygonValues o={o} />
        </>
      )}
      {tab === "cons" && (
        <>
          {n === 3 && <TriangleProps o={o} />}
          {n === 4 && <QuadProps o={o} />}
          <CirclesProps o={o} />
        </>
      )}
    </>
  );
}

/** «Label: [A] [B]» — one of two (or more) options, the same look for every such setting. */
function Choice({ label, options }: { label: string; options: [name: string, on: boolean, pick: () => void][] }) {
  return (
    <div className="bd-sec bd-line" role="group" aria-label={label}>
      <span className="bd-lbl">{label}</span>
      {options.map(([name, on, pick]) => (
        <button key={name} className={"bd-chip-btn" + (on ? " on" : "")} aria-pressed={on} onClick={pick}>
          {name}
        </button>
      ))}
    </div>
  );
}
