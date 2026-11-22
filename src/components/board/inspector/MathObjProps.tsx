"use client";

import { chartData, cplaneStats, fmtN, rawNumbers, statsLine, statsOf } from "@/lib/board/engine/mathobj";
import type {
  ArithSign,
  ChartObject,
  ColmathObject,
  CplaneObject,
  DiceObject,
  FmodelObject,
  Point,
  TrigObject,
} from "@/lib/board/engine/types";
import { DraftField } from "../controls";
import { uaNum } from "../constants";
import { useBoard, useSelection } from "../useBoard";

/** Numbers at the end of "label value" lines (bar and pie charts). */
const rowNumbers = (src: string) =>
  (src || "")
    .split("\n")
    .map((l) => (l.match(/(-?\d+(?:[.,]\d+)?)\s*$/) || [])[1])
    .filter((s): s is string => !!s)
    .map((s) => Number(s.replace(",", ".")));

type HistToggle = "rel" | "poly" | "mlines" | "gap" | "nov";

/** Chart: data, statistics, colours; histogram options. */
export function ChartProps({ o }: { o: ChartObject }) {
  const { b } = useBoard();
  const act = useSelection();
  const list = o.kind === "hist" ? rawNumbers(o.src) : rowNumbers(o.src);
  const tg = (key: HistToggle, label: string) => (
    <button className={"bd-chip-btn" + (o[key] ? " on" : "")} onClick={() => act.set<ChartObject>({ [key]: !o[key] })}>
      {label}
    </button>
  );
  const binW = o.kind === "hist" ? chartData(o).w || 1 : 1;
  const setW = (w: number) => act.set<ChartObject>({ bw: Math.max(0.1, Math.round(w * 100) / 100) });
  return (
    <div className="bd-sec">
      <div className="bd-line wrap">
        <button className="bd-chip-btn" onClick={() => b()?.editSrc(o.id)}>
          Змінити дані
        </button>
        {o.kind !== "pie" && (
          <button className={"bd-chip-btn" + (o.stats ? " on" : "")} onClick={() => act.set<ChartObject>({ stats: !o.stats })}>
            Статистика
          </button>
        )}
        <button
          className={"bd-chip-btn" + (!o.c && (o.kind !== "hist" || o.rb) ? " on" : "")}
          onClick={() => act.set<ChartObject>({ c: undefined, rb: true })}
        >
          Різнокольорова
        </button>
      </div>
      {o.kind === "hist" && (
        <>
          <div className="bd-line wrap">
            {tg("rel", "Частоти у %")}
            {tg("poly", "Полігон")}
            {tg("mlines", "Середнє й медіана")}
            {tg("gap", "Проміжки")}
            {tg("nov", "Без підписів")}
          </div>
          <div className="bd-line wrap">
            <span className="bd-lbl">Ширина інтервалу</span>
            <button className="bd-chip-btn" onClick={() => setW(binW / 2)}>
              −
            </button>
            <span className="bd-hint">
              {fmtN(binW)}
              {o.bw ? "" : " (авто)"}
            </span>
            <button className="bd-chip-btn" onClick={() => setW(binW * 2)}>
              +
            </button>
            {o.bw ? (
              <button className="bd-chip-btn" onClick={() => act.set<ChartObject>({ bw: undefined })}>
                Авто
              </button>
            ) : null}
          </div>
        </>
      )}
      {o.kind !== "pie" && <p className="bd-hint">{statsLine(statsOf(list))}</p>}
    </div>
  );
}

/** Die / coin: roll, reset, one or two dice. */
export function DiceProps({ o }: { o: DiceObject }) {
  const { b } = useBoard();
  const act = useSelection();
  const roll = (n: number) => b()?.rollDice(o.id, n);
  return (
    <div className="bd-sec">
      <div className="bd-line wrap">
        <button className="bd-chip-btn" onClick={() => roll(1)}>
          Кинути
        </button>
        <button className="bd-chip-btn" onClick={() => roll(10)}>
          ×10
        </button>
        <button className="bd-chip-btn" onClick={() => roll(100)}>
          ×100
        </button>
        <button className="bd-chip-btn" onClick={() => act.set<DiceObject>({ cur: [], freq: {}, tot: 0 })}>
          Скинути
        </button>
      </div>
      {o.kind === "die" && (
        <div className="bd-line wrap">
          {[1, 2].map((n) => (
            <button
              key={n}
              className={"bd-chip-btn" + (o.cnt === n ? " on" : "")}
              onClick={() => act.set<DiceObject>({ cnt: n, cur: [], freq: {}, tot: 0 })}
            >
              {n === 1 ? "1 кубик" : "2 кубики (сума)"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "x; y" per line → points (max 26). */
const parsePoints = (t: string): Point[] =>
  t
    .split("\n")
    .map((l) => (l.match(/-?\d+(?:[.,]\d+)?/g) || []).map((s) => Number(s.replace(",", "."))))
    .filter((a) => a.length >= 2)
    .map((a): Point => [a[0], a[1]])
    .slice(0, 26);

type CplaneToggle = "joined" | "closed" | "lens" | "names";

/** Coordinate plane: points, polyline options, axis range, perimeter / area. */
export function CplaneProps({ o }: { o: CplaneObject }) {
  const act = useSelection();
  const stats = cplaneStats(o);
  const tog = (k: CplaneToggle, label: string) => (
    <button className={"bd-chip-btn" + (o[k] ? " on" : "")} onClick={() => act.set<CplaneObject>({ [k]: !o[k] })}>
      {label}
    </button>
  );
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Точки (x; y — кожна з нового рядка)</span>
      <DraftField
        multiline
        value={o.pts.map((q) => `${fmtN(q[0])}; ${fmtN(q[1])}`).join("\n")}
        onType={(t) => act.live<CplaneObject>({ pts: parsePoints(t) }, 700)}
        onDone={() => act.end()}
      />
      <div className="bd-line wrap">
        {tog("joined", "З'єднати")}
        {tog("closed", "Замкнути")}
        {tog("lens", "Довжини")}
        {tog("names", "Назви")}
      </div>
      <div className="bd-line wrap">
        <span className="bd-lbl">Осі до ±</span>
        {[3, 5, 6, 8, 10, 15].map((r) => (
          <button key={r} className={"bd-chip-btn" + (o.R === r ? " on" : "")} onClick={() => act.set<CplaneObject>({ R: r })}>
            {r}
          </button>
        ))}
      </div>
      <p className="bd-hint">
        Периметр (довжина ліній): {fmtN(stats.per)}
        {stats.area !== null ? `, площа: ${fmtN(stats.area)}` : ""}. Торкніться площини двічі, щоб ставити точки (Esc —
        вийти).
      </p>
    </div>
  );
}

const SIGNS: ArithSign[] = ["+", "−", "×", "÷"];

/** Column arithmetic / fraction operation: operands and operator. */
export function ColmathProps({ o }: { o: ColmathObject }) {
  const act = useSelection();
  const frac = o.op === "frac";
  const clean = (v: string) => v.replace(frac ? /[^0-9/]/g : /[^0-9,.]/g, "").slice(0, frac ? 9 : 10);
  const field = (key: "a" | "b", ph: string) => (
    <input
      className="bd-input"
      style={{ width: 96 }}
      key={o.id + key}
      defaultValue={o[key]}
      placeholder={frac ? ph : "число"}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => act.live<ColmathObject>({ [key]: clean(e.target.value) }, 600)}
      onBlur={() => act.end()}
    />
  );
  return (
    <div className="bd-sec">
      <span className="bd-lbl">{frac ? "Дроби (напр. 1/2)" : "Числа"}</span>
      <div className="bd-line wrap">
        {field("a", "1/2")}
        <b>{frac ? o.fop : o.op}</b>
        {field("b", "1/3")}
      </div>
      {frac && (
        <div className="bd-line wrap">
          {SIGNS.map((s) => (
            <button
              key={s}
              className={"bd-chip-btn" + (o.fop === s ? " on" : "")}
              onClick={() => act.set<ColmathObject>({ fop: s })}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fraction model: number of parts, clear filling. */
export function FmodelProps({ o }: { o: FmodelObject }) {
  const act = useSelection();
  const n = o.n || 1;
  const set = (v: number) => {
    const m = Math.max(1, Math.min(24, v));
    act.set<FmodelObject>({ n: m, fill: (o.fill || []).filter((i) => i < m) });
  };
  return (
    <div className="bd-sec">
      <span className="bd-lbl">
        Частин: {n}, зафарбовано: {(o.fill || []).length}
      </span>
      <div className="bd-line wrap">
        <button className="bd-chip-btn" onClick={() => set(n - 1)}>
          −
        </button>
        <button className="bd-chip-btn" onClick={() => set(n + 1)}>
          +
        </button>
        <button className="bd-chip-btn" onClick={() => act.set<FmodelObject>({ fill: [] })}>
          Стерти зафарбування
        </button>
      </div>
      <p className="bd-hint">Торкніться моделі двічі, щоб зафарбовувати частки (Esc — вийти).</p>
    </div>
  );
}

const TRIG_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 270];
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Unit circle: angle slider, presets, ctg / radians / snapping, interactive mode. */
export function TrigProps({ o, inter }: { o: TrigObject; inter: boolean }) {
  const { b } = useBoard();
  const act = useSelection();
  const deg = Math.round(((o.ang * 180) / Math.PI) * 10) / 10;
  const tog = (k: "showCot" | "showRad" | "snap", label: string) => (
    <button className={"bd-chip-btn" + (o[k] ? " on" : "")} onClick={() => act.set<TrigObject>({ [k]: !o[k] })}>
      {label}
    </button>
  );
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Кут α = {uaNum(deg)}°</span>
      <input
        type="range"
        min="0"
        max="360"
        step="0.5"
        value={deg}
        onChange={(e) => act.live<TrigObject>({ ang: rad(Number(e.target.value)) })}
      />
      <div className="bd-line wrap">
        {TRIG_ANGLES.map((d) => (
          <button key={d} className="bd-chip-btn" onClick={() => act.set<TrigObject>({ ang: rad(d) })}>
            {d}°
          </button>
        ))}
      </div>
      <div className="bd-line wrap">
        {tog("showCot", "ctg")}
        {tog("showRad", "Радіани")}
        {tog("snap", "Прилипання до 15°")}
        <button
          className={"bd-chip-btn" + (inter ? " on" : "")}
          onClick={() => (inter ? b()?.exitInteractive() : b()?.enterInteractive(o.id))}
        >
          {inter ? "Готово" : "Крутити"}
        </button>
      </div>
      <p className="bd-hint">Торкніться кола двічі й ведіть точку.</p>
    </div>
  );
}
