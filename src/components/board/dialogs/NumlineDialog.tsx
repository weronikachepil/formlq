"use client";

import { useState } from "react";
import { NL_COLORS, makeInterval } from "@/lib/board/engine/numline";
import type { NumlineInterval } from "@/lib/board/engine/types";
import { Icon } from "../icons";
import { Modal } from "./Modal";

const nlText = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace("-", "−").replace(".", ",");

/** "" / ±∞ → null (infinity), a number → number, anything else → undefined (error). */
const nlParse = (t: string): number | null | undefined => {
  const s = t.trim().replace(/\s/g, "");
  if (s === "" || /^[+\-−]?(∞|inf)$/i.test(s)) return null;
  const v = Number(s.replace("−", "-").replace(",", "."));
  return Number.isFinite(v) ? v : undefined;
};

type Row = NumlineInterval & { at: string; bt: string };

/** Intervals of a number line (new or existing). */
export function NumlineDialog({
  ivs,
  onClose,
  onDone,
}: {
  ivs?: NumlineInterval[];
  onClose: () => void;
  onDone: (ivs: NumlineInterval[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (ivs?.length ? ivs : [makeInterval(0)]).map((iv) => ({ ...iv, at: nlText(iv.a), bt: nlText(iv.b) })),
  );
  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const parsed = rows.map((r) => ({ a: nlParse(r.at), b: nlParse(r.bt) }));
  const bad = parsed.some((p) => p.a === undefined || p.b === undefined);

  function done() {
    onDone(
      rows.map((r, i) => {
        let a = parsed[i].a ?? null;
        let b = parsed[i].b ?? null;
        let ai = a === null ? true : r.ai;
        let bi = b === null ? true : r.bi;
        if (a !== null && b !== null && a > b) {
          [a, b] = [b, a];
          [ai, bi] = [bi, ai];
        }
        return { a, b, ai, bi, c: r.c };
      }),
    );
  }

  return (
    <Modal onClose={onClose} className="nl-modal">
      <h2>Числова пряма</h2>
      {rows.map((r, i) => (
        <div className="nl-row" key={i}>
          <button
            className="nl-dot"
            style={{ background: r.c }}
            title="Змінити колір"
            onClick={() => patch(i, { c: NL_COLORS[(NL_COLORS.indexOf(r.c) + 1) % NL_COLORS.length] })}
          />
          <span>від</span>
          <input
            className={"nl-in" + (parsed[i].a === undefined ? " err" : "")}
            value={r.at}
            placeholder="−∞"
            onChange={(e) => patch(i, { at: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <label className="nl-chk">
            <input
              type="checkbox"
              checked={parsed[i].a === null ? true : r.ai}
              disabled={parsed[i].a === null}
              onChange={(e) => patch(i, { ai: e.target.checked })}
            />
            включно
          </label>
          <span>до</span>
          <input
            className={"nl-in" + (parsed[i].b === undefined ? " err" : "")}
            value={r.bt}
            placeholder="+∞"
            onChange={(e) => patch(i, { bt: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <label className="nl-chk">
            <input
              type="checkbox"
              checked={parsed[i].b === null ? true : r.bi}
              disabled={parsed[i].b === null}
              onChange={(e) => patch(i, { bi: e.target.checked })}
            />
            включно
          </label>
          <button
            className="bd-ibtn"
            title="Видалити проміжок"
            disabled={rows.length < 2}
            onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
      <button className="bd-chip-btn" onClick={() => setRows((r) => [...r, { ...makeInterval(r.length), at: "", bt: "" }])}>
        + Ще проміжок
      </button>
      <p className="bd-hint">
        Порожнє поле — нескінченність: −∞ ліворуч, +∞ праворуч.
        <br />
        Уся пряма — впишіть −∞ і +∞.
        <br />
        Включно — число входить (зафарбована точка), без позначки — не входить (порожня).
        <br />
        Змінити проміжки потім — двічі по прямій.
      </p>
      <div className="nl-foot">
        <button className="bd-chip-btn" onClick={onClose}>
          Скасувати
        </button>
        <button disabled={bad} onClick={done}>
          Готово
        </button>
      </div>
    </Modal>
  );
}
