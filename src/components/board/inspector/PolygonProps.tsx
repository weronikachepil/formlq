"use client";

import { useState } from "react";
import { angleDegrees, fmtLen, sideLengths } from "@/lib/board/engine/measure";
import {
  CONS_KINDS,
  QUAD_COLORS,
  addAll,
  circleInfo,
  clearKind,
  consTitle,
  quadTitle,
  toggleCons,
  toggleQuad,
} from "@/lib/board/engine/triangle";
import type {
  PolygonCircle,
  PolygonConstruction,
  PolygonObject,
  QuadConsKind,
  QuadConstruction,
  TriangleConsKind,
} from "@/lib/board/engine/types";
import { useSelection } from "../useBoard";

const LETTERS = "ABCDEFGHIJKL";

/** Vertex labels, side lengths, angles, area. */
export function PolygonProps({ o }: { o: PolygonObject }) {
  const act = useSelection();
  const hasLabs = !!o.labs;
  return (
    <div className="bd-sec bd-line">
      <button
        className={"bd-chip-btn" + (hasLabs ? " on" : "")}
        onClick={() => act.set<PolygonObject>({ labs: hasLabs ? "" : LETTERS.slice(0, o.pts.length) })}
      >
        Підписи вершин
      </button>
      <button className={"bd-chip-btn" + (o.lens ? " on" : "")} onClick={() => act.set<PolygonObject>({ lens: !o.lens })}>
        Довжини сторін
      </button>
      <button className={"bd-chip-btn" + (o.angs ? " on" : "")} onClick={() => act.set<PolygonObject>({ angs: !o.angs })}>
        Кути
      </button>
      <button className={"bd-chip-btn" + (o.area ? " on" : "")} onClick={() => act.set<PolygonObject>({ area: !o.area })}>
        Площа
      </button>
      {hasLabs && (
        <input
          className="bd-input short"
          key={o.id}
          defaultValue={o.labs}
          maxLength={12}
          onChange={(e) => act.live<PolygonObject>({ labs: e.target.value }, 600)}
          onBlur={() => act.end()}
        />
      )}
    </div>
  );
}

/** Custom side and angle labels: an empty field means the automatic value (or nothing when off). */
export function PolygonValues({ o }: { o: PolygonObject }) {
  const act = useSelection();
  const [open, setOpen] = useState(false);
  const n = o.pts.length;
  const v = (i: number) => o.labs?.[i % n] || LETTERS[i % n];
  const lens = sideLengths(o.pts);
  const degs = angleDegrees(o.pts);
  const setArr = (key: "sidet" | "angt", i: number, val: string) =>
    act.live<PolygonObject>((x) => {
      const arr = Array.from({ length: x.pts.length }, (_, k) => x[key]?.[k] ?? null);
      arr[i] = val === "" ? null : val;
      return { [key]: arr.some((q) => q !== null) ? arr : undefined };
    }, 600);
  const field = (key: "sidet" | "angt", i: number, label: string, ph: string) => (
    <label key={key + i} className="bd-val">
      <small>{label}</small>
      <input
        className="bd-input tiny"
        value={o[key]?.[i] ?? ""}
        placeholder={ph}
        maxLength={14}
        onChange={(e) => setArr(key, i, e.target.value)}
        onBlur={() => act.end()}
      />
    </label>
  );
  return (
    <div className="bd-sec">
      <div className="bd-line">
        <button className={"bd-chip-btn" + (open ? " on" : "")} onClick={() => setOpen(!open)}>
          Свої довжини та кути
        </button>
        {open && (
          <button className="bd-chip-btn" onClick={() => act.set<PolygonObject>({ sidet: undefined, angt: undefined })}>
            Скинути
          </button>
        )}
      </div>
      {open && (
        <>
          <span className="bd-lbl">Сторони (напр. 5 см, a, 3x)</span>
          <div className="bd-vals">
            {Array.from({ length: n }, (_, i) => field("sidet", i, `${v(i)}${v(i + 1)}`, fmtLen(lens[i])))}
          </div>
          <span className="bd-lbl">Кути (напр. 60°, α, 2x)</span>
          <div className="bd-vals">
            {Array.from({ length: n }, (_, i) => field("angt", i, `∠${v(i)}`, `${Math.round(degs[i] * 10) / 10}°`))}
          </div>
          <p className="bd-hint">
            Те, що ви впишете, показується замість виміряного значення. Поле порожнє — підпису немає (або автоматичне значення,
            якщо ввімкнено «Довжини сторін» / «Кути»).
          </p>
        </>
      )}
    </div>
  );
}

/** Live edit of one construction label. */
function useConsLabel() {
  const act = useSelection();
  return (j: number, lab: string) =>
    act.live<PolygonObject>((x) => ({ cons: (x.cons || []).map((q, n) => (n === j ? { ...q, lab } : q)) }), 600);
}

function MarksToggle({ o }: { o: PolygonObject }) {
  const act = useSelection();
  return (
    <div className="bd-line">
      <button className={"bd-chip-btn" + (o.marks ? " on" : "")} onClick={() => act.set<PolygonObject>({ marks: !o.marks })}>
        Позначки: рівні сторони, прямі кути
      </button>
    </div>
  );
}

/** Triangle constructions: altitudes, medians, bisectors, midlines, perpendicular bisectors. */
export function TriangleProps({ o }: { o: PolygonObject }) {
  const act = useSelection();
  const setLab = useConsLabel();
  const [open, setOpen] = useState<TriangleConsKind | null>(null);
  const cons = o.cons || [];
  const set = (next: PolygonConstruction[]) => act.set<PolygonObject>({ cons: next });
  const v = (i: number) => o.labs?.[i] || "ABC"[i];
  const choices = (k: TriangleConsKind) => {
    const by = CONS_KINDS.find((c) => c.k === k)?.by;
    return [0, 1, 2].map((i) => ({
      i,
      text: by === "vertex" ? v(i) : by === "apex" ? `∥ ${v((i + 1) % 3)}${v((i + 2) % 3)}` : `${v(i)}${v((i + 1) % 3)}`,
    }));
  };
  const shown = cons.filter((c) => c.k !== "ctr" || cons.filter((x) => x.k === c.of).length === 3);
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Побудови в трикутнику</span>
      <div className="bd-line wrap">
        {CONS_KINDS.map((c) => {
          const on = cons.some((x) => x.k === c.k);
          return (
            <button
              key={c.k}
              className={"bd-chip-btn" + (on ? " on" : "")}
              style={on ? { background: c.color } : undefined}
              onClick={() => setOpen(open === c.k ? null : c.k)}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="bd-line wrap bd-sub">
          {choices(open).map(({ i, text }) => (
            <button
              key={i}
              className={"bd-chip-btn" + (cons.some((x) => x.k === open && "i" in x && x.i === i) ? " on" : "")}
              onClick={() => set(toggleCons(cons, open, i))}
            >
              {text}
            </button>
          ))}
          <button className="bd-chip-btn" onClick={() => set(addAll(cons, open))}>
            Усі
          </button>
          <button className="bd-chip-btn" onClick={() => set(clearKind(cons, open))}>
            Прибрати
          </button>
        </div>
      )}
      {shown.map((c) => {
        const kind = CONS_KINDS.find((x) => x.k === (c.k === "ctr" ? c.of : c.k));
        const j = cons.indexOf(c);
        return (
          <div key={`${c.k}${c.k === "ctr" ? c.of : ""}${"i" in c ? c.i : ""}`} className="bd-cons">
            <i style={{ background: kind?.color }} />
            <span>{consTitle(c, o.labs)}</span>
            <input
              className="bd-input tiny"
              defaultValue={c.lab}
              maxLength={4}
              onChange={(e) => setLab(j, e.target.value)}
              onBlur={() => act.end()}
            />
            {c.k !== "ctr" && (
              <button className="bd-ibtn" title="Прибрати" onClick={() => set(cons.filter((_, n) => n !== j))}>
                ×
              </button>
            )}
          </div>
        );
      })}
      <CirclesProps o={o} />
      <MarksToggle o={o} />
    </div>
  );
}

const QUAD_KINDS: [QuadConsKind, string][] = [
  ["diag", "Діагоналі"],
  ["qalt", "Висота"],
  ["qmid", "Середня лінія"],
  ["qbis", "Бісектриса"],
];

const isQuadCons = (c: PolygonConstruction): c is QuadConstruction => c.k in QUAD_COLORS;

/** Quadrilateral constructions: diagonals, altitudes, midlines, bisectors. */
export function QuadProps({ o }: { o: PolygonObject }) {
  const act = useSelection();
  const setLab = useConsLabel();
  const [open, setOpen] = useState<QuadConsKind | null>(null);
  const all = o.cons || [];
  const cons = all.filter(isQuadCons);
  const set = (next: PolygonConstruction[]) => act.set<PolygonObject>({ cons: next });
  const v = (i: number) => o.labs?.[i % 4] || "ABCD"[i % 4];
  const has = (k: QuadConsKind, i: number, j = 0) => cons.some((c) => c.k === k && c.i === i && (c.j || 0) === j);
  const options = (k: QuadConsKind) => {
    if (k === "qalt") {
      const out: { i: number; j: number; text: string }[] = [];
      for (let i = 0; i < 4; i++) {
        out.push({ i, j: 0, text: `${v(i)}→${v(i + 2)}${v(i + 3)}` });
        out.push({ i, j: 1, text: `${v(i)}→${v(i + 1)}${v(i + 2)}` });
      }
      return out;
    }
    if (k === "qmid") return [0, 1].map((i) => ({ i, j: 0, text: `${v(i)}${v(i + 1)} · ${v(i + 2)}${v(i + 3)}` }));
    if (k === "qbis") return [0, 1, 2, 3].map((i) => ({ i, j: 0, text: v(i) }));
    return [];
  };
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Побудови в чотирикутнику</span>
      <div className="bd-line wrap">
        {QUAD_KINDS.map(([k, name]) => {
          const on = all.some((c) => c.k === k);
          return (
            <button
              key={k}
              className={"bd-chip-btn" + (on ? " on" : "")}
              style={on ? { background: QUAD_COLORS[k] } : undefined}
              onClick={() => (k === "diag" ? set(toggleQuad(all, "diag", 0)) : setOpen(open === k ? null : k))}
            >
              {name}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="bd-line wrap bd-sub">
          {options(open).map((op) => (
            <button
              key={`${op.i}${op.j}`}
              className={"bd-chip-btn" + (has(open, op.i, op.j) ? " on" : "")}
              onClick={() => set(toggleQuad(all, open, op.i, op.j))}
            >
              {op.text}
            </button>
          ))}
        </div>
      )}
      {cons.map((c) => {
        const j = all.indexOf(c);
        return (
          <div key={`${c.k}${c.i}${c.j || 0}`} className="bd-cons">
            <i style={{ background: QUAD_COLORS[c.k] }} />
            <span>{quadTitle(c, o.labs)}</span>
            <input
              className="bd-input tiny"
              defaultValue={c.lab}
              maxLength={4}
              onChange={(e) => setLab(j, e.target.value)}
              onBlur={() => act.end()}
            />
            <button className="bd-ibtn" title="Прибрати" onClick={() => set(all.filter((_, n) => n !== j))}>
              ×
            </button>
          </div>
        );
      })}
      <CirclesProps o={o} />
      <MarksToggle o={o} />
    </div>
  );
}

type CircleKey = "in" | "out";

/** Inscribed and circumscribed circles. */
function CirclesProps({ o }: { o: PolygonObject }) {
  const act = useSelection();
  const info = circleInfo(o.pts);
  const circs = o.circs || {};
  const set = (key: CircleKey, patch: PolygonCircle | null) =>
    act.set<PolygonObject>((x) => {
      const cur = { ...(x.circs || {}) };
      if (patch === null) delete cur[key];
      else cur[key] = { ...(cur[key] || { lab: key === "in" ? "I" : "O", rad: true }), ...patch };
      return { circs: Object.keys(cur).length ? cur : undefined };
    });
  const row = (key: CircleKey, title: string, exists: boolean) => {
    const c = circs[key];
    return (
      <div className="bd-line wrap" key={key}>
        <button
          className={"bd-chip-btn" + (c ? " on" : "")}
          disabled={!exists}
          title={exists ? "" : "Для цієї фігури такого кола не існує"}
          onClick={() => set(key, c ? null : {})}
        >
          {title}
        </button>
        {c && exists && (
          <>
            <input
              className="bd-input tiny"
              value={c.lab ?? ""}
              maxLength={3}
              onChange={(e) => set(key, { lab: e.target.value })}
              title="Буква центра"
            />
            <button className={"bd-chip-btn" + (c.rad !== false ? " on" : "")} onClick={() => set(key, { rad: c.rad === false })}>
              Радіус
            </button>
          </>
        )}
      </div>
    );
  };
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Кола</span>
      {row("in", "Вписане коло", !!info.inc)}
      {row("out", "Описане коло", !!info.out)}
    </div>
  );
}
