"use client";

import type { AngleObject, LineObject, Point } from "@/lib/board/engine/types";
import { DraftField } from "../controls";
import { useSelection } from "../useBoard";

/** Segment: arrow head, length label, custom length text. */
export function LineProps({ o }: { o: LineObject }) {
  const act = useSelection();
  return (
    <div className="bd-sec bd-line">
      <button className={"bd-chip-btn" + (o.arrow ? " on" : "")} onClick={() => act.set<LineObject>({ arrow: !o.arrow })}>
        Стрілка (вектор)
      </button>
      <button className={"bd-chip-btn" + (o.lens ? " on" : "")} onClick={() => act.set<LineObject>({ lens: !o.lens })}>
        Довжина
      </button>
      <input
        className="bd-input tiny"
        style={{ width: 96 }}
        key={o.id}
        defaultValue={o.lent ?? ""}
        placeholder="своя: 5 см"
        maxLength={14}
        onChange={(e) => act.live<LineObject>({ lent: e.target.value === "" ? undefined : e.target.value }, 600)}
        onBlur={() => act.end()}
      />
    </div>
  );
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Angle: exact degree value, value label, point letters. */
export function AngleProps({ o }: { o: AngleObject }) {
  const act = useSelection();
  const show = o.angs !== false;
  const custom = o.angt !== undefined && o.angt !== null && o.angt !== "";
  const [A, B, C] = o.pts;
  const a1 = Math.atan2(A[1] - B[1], A[0] - B[0]);
  let d = Math.atan2(C[1] - B[1], C[0] - B[0]) - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const curDeg = Math.round((Math.abs(d) * 1800) / Math.PI) / 10;
  // set an exact measure: rotate the second ray about the vertex
  const setDeg = (txt: string) => {
    const v = parseFloat(txt.replace(",", "."));
    if (!isFinite(v) || v <= 0 || v >= 360) return;
    const len = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const ang = a1 + ((d < 0 ? -1 : 1) * (v * Math.PI)) / 180;
    const c2: Point = [r3(B[0] + Math.cos(ang) * len), r3(B[1] + Math.sin(ang) * len)];
    act.live<AngleObject>({ pts: [A, B, c2] }, 600);
  };
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Величина кута, °</span>
      <DraftField key={o.id + "d"} value={String(curDeg)} placeholder="Напр. 60" onType={setDeg} onDone={() => act.end()} />
      <span className="bd-lbl">Підпис кута</span>
      <div className="bd-line wrap">
        <button className={"bd-chip-btn" + (show ? " on" : "")} onClick={() => act.set<AngleObject>({ angs: !show })}>
          {show ? "Показано" : "Приховано"}
        </button>
        <button
          className={"bd-chip-btn" + (show && !custom ? " on" : "")}
          disabled={!show}
          onClick={() => act.set<AngleObject>({ angt: "" })}
        >
          Градуси
        </button>
        <button
          className={"bd-chip-btn" + (show && custom ? " on" : "")}
          disabled={!show}
          onClick={() => act.set<AngleObject>({ angt: custom ? o.angt : "α" })}
        >
          Свій текст
        </button>
      </div>
      {show && custom && (
        <input
          className="bd-input"
          key={o.id + "t"}
          placeholder="Напр. α, 60° або x"
          defaultValue={o.angt}
          maxLength={12}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => act.live<AngleObject>({ angt: e.target.value || "α" }, 600)}
          onBlur={() => act.end()}
        />
      )}
      <span className="bd-lbl">Букви точок (A, вершина, C)</span>
      <input
        className="bd-input"
        key={o.id + "l"}
        defaultValue={o.labs || ""}
        maxLength={3}
        placeholder="ABC"
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => act.live<AngleObject>({ labs: e.target.value }, 600)}
        onBlur={() => act.end()}
      />
      <p className="bd-hint">
        Букви пишіть підряд: перша — на першому промені, друга — у вершині, третя — на другому. Порожнє поле — без букв.
      </p>
    </div>
  );
}
