"use client";

import type { GraphObject } from "@/lib/board/engine/types";
import { MenuTabs, useMenuTab } from "../controls";
import { Icon } from "../icons";
import { useBoard, useSelection } from "../useBoard";

type GraphTab = "fx" | "analysis" | "view";
const GRAPH_TABS: [GraphTab, string][] = [
  ["fx", "Функції"],
  ["analysis", "Аналіз"],
  ["view", "Вигляд"],
];

/** Function graph in tabs: expressions · analysis of the first function · view. */
export function GraphProps({ o, inter }: { o: GraphObject; inter: boolean }) {
  const { b } = useBoard();
  const act = useSelection();
  const [tab, pick] = useMenuTab<GraphTab>("mb-insp-graph", GRAPH_TABS, "fx");
  return (
    <>
      <MenuTabs label="Налаштування графіка" tabs={GRAPH_TABS} tab={tab} onPick={pick} />
      {tab === "fx" && (
        <div className="bd-sec">
          <span className="bd-lbl">Кожен вираз з нового рядка</span>
          <textarea
            className="bd-input area"
            key={o.id}
            defaultValue={o.exprs}
            spellCheck={false}
            placeholder={"y = x^2 - 2\nx^2 + y^2 = 9\ny > x + 1\n(2, 3)"}
            onChange={(e) => act.live<GraphObject>({ exprs: e.target.value }, 800)}
            onBlur={() => act.end()}
          />
          <p className="bd-hint">Літери a, b, k… стануть повзунками.</p>
        </div>
      )}
      {tab === "view" && (
        <div className="bd-sec bd-line">
          <button
            className="bd-ibtn"
            title="Збільшити графік"
            aria-label="Збільшити графік"
            onClick={() => {
              b()?.zoomGraph(o.id, 1.3);
              act.end();
            }}
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            className="bd-ibtn"
            title="Зменшити графік"
            aria-label="Зменшити графік"
            onClick={() => {
              b()?.zoomGraph(o.id, 0.77);
              act.end();
            }}
          >
            <Icon name="minus" size={16} />
          </button>
          <button className="bd-chip-btn" onClick={() => b()?.resetGraphView(o.id)}>
            Скинути вигляд
          </button>
          <button
            className={"bd-chip-btn" + (inter ? " on" : "")}
            onClick={() => (inter ? b()?.exitInteractive() : b()?.enterInteractive(o.id))}
          >
            {inter ? "Готово" : "Рухати"}
          </button>
          <button className={"bd-chip-btn" + (o.legend ? " on" : "")} onClick={() => act.set<GraphObject>({ legend: !o.legend })}>
            Легенда
          </button>
        </div>
      )}
      {tab === "analysis" && <GraphAnalysis o={o} />}
    </>
  );
}

const fix2 = (v: number) => Number(v.toFixed(2));

function GraphAnalysis({ o }: { o: GraphObject }) {
  const { b } = useBoard();
  const act = useSelection();
  const half = o.w / (2 * o.v.sx);
  const lo = o.v.cx - half;
  const hi = o.v.cx + half;
  const step = (hi - lo) / 400;
  const mid = (lo + hi) / 2;
  const live = (patch: Partial<GraphObject>) => act.live<GraphObject>(patch);
  const toggle = (key: "zeros" | "ext" | "inter" | "deriv" | "anti", label: string) => (
    <button className={"bd-chip-btn" + (o[key] ? " on" : "")} onClick={() => act.set<GraphObject>({ [key]: !o[key] })}>
      {label}
    </button>
  );
  const range = (label: string, value: number, onChange: (v: number) => void) => (
    <label className="bd-slide">
      <i>{label}</i>
      <input type="range" min={lo} max={hi} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Для першої функції</span>
      <div className="bd-line wrap">
        {toggle("zeros", "Нулі")}
        {toggle("ext", "Екстремуми")}
        {toggle("inter", "Перетини")}
        <button
          className={"bd-chip-btn" + (o.tan != null ? " on" : "")}
          onClick={() => act.set<GraphObject>({ tan: o.tan != null ? null : fix2(mid) })}
        >
          Дотична
        </button>
        <button
          className={"bd-chip-btn" + (o.area ? " on" : "")}
          onClick={() => act.set<GraphObject>({ area: o.area ? null : [fix2(mid - 1), fix2(mid + 1)] })}
        >
          Площа
        </button>
        {toggle("deriv", "Похідна f′")}
        {toggle("anti", "Первісна F")}
        <button className="bd-chip-btn" onClick={() => b()?.insertValueTable(o.id)}>
          Таблиця значень
        </button>
      </div>
      {o.tan != null && range("x₀", o.tan, (v) => live({ tan: v }))}
      {o.area && (
        <>
          {range("від a", o.area[0], (v) => o.area && live({ area: [v, o.area[1]] }))}
          {range("до b", o.area[1], (v) => o.area && live({ area: [o.area[0], v] }))}
        </>
      )}
    </div>
  );
}
