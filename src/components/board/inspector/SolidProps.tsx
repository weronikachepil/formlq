"use client";

import { useState } from "react";
import { SOLID_KINDS, SOLID_VIEWS, solidLabelFields } from "@/lib/board/engine/solid";
import type { SolidKind, SolidMarks, SolidObject, SolidSection } from "@/lib/board/engine/types";
import { MenuTabs, useMenuTab } from "../controls";
import { Icon } from "../icons";
import { useBoard, useSelection } from "../useBoard";

type MarkKey = keyof SolidMarks;
const MARKS: Record<SolidKind, [MarkKey, string][]> = {
  pyramid: [
    ["h", "Висота"],
    ["ap", "Апофема"],
  ],
  prism: [["h", "Висота"]],
  cube: [
    ["diag", "Діагональ тіла"],
    ["bdiag", "Діагональ основи"],
  ],
  cuboid: [
    ["diag", "Діагональ тіла"],
    ["bdiag", "Діагональ основи"],
  ],
  cylinder: [
    ["h", "Висота"],
    ["r", "Радіус"],
  ],
  cone: [
    ["h", "Висота"],
    ["l", "Твірна"],
    ["r", "Радіус"],
  ],
  sphere: [["r", "Радіус"]],
};

type SecMode = SolidSection["mode"];
const SEC_DEFAULTS: Record<Exclude<SecMode, "pts">, SolidSection> = {
  horiz: { mode: "horiz", t: 0.5 },
  axial: { mode: "axial", a: 0 },
  tilt: { mode: "tilt", a: 0.6, tilt: 0.6, off: 0 },
};
const VIEWS: [keyof typeof SOLID_VIEWS, string][] = [
  ["iso", "Ізометрія"],
  ["front", "Спереду"],
  ["side", "Збоку"],
  ["top", "Зверху"],
];
const TAU = Math.PI * 2;
/** Angle wrapped into (-π, π] for the rotation sliders. */
const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

const KIND_DEFAULTS: Partial<Record<SolidKind, Partial<SolidObject>>> = {
  prism: { n: 3, hr: 1.6 },
  pyramid: { n: 4, hr: 1.7 },
  cylinder: { hr: 1.8 },
  cone: { hr: 1.8 },
};
const switchKind = (kind: SolidKind): Partial<SolidObject> => ({
  kind,
  sec: null,
  marks: {},
  names: undefined,
  tags: undefined,
  ...(KIND_DEFAULTS[kind] || {}),
});

function Slide({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="bd-slide">
      <i>{label}</i>
      {children}
    </label>
  );
}

type SolidTab = "shape" | "view" | "cons" | "labels";
const SOLID_TABS: [SolidTab, string][] = [
  ["shape", "Фігура"],
  ["view", "Вигляд"],
  ["cons", "Побудови"],
  ["labels", "Підписи"],
];

/**
 * 3D solid in tabs, as a flat figure: shape (kind, base, height, colour) · view (rotation) ·
 * constructions (segments, section) · labels (letters).
 */
export function SolidProps({ o, secPick, style }: { o: SolidObject; secPick: boolean; style?: React.ReactNode }) {
  // picking section points: stay on the «Переріз» tab
  const [saved, pick] = useMenuTab<SolidTab>("mb-insp-solid", SOLID_TABS, "shape");
  const tab = secPick ? "cons" : saved;
  const { b } = useBoard();
  const act = useSelection();
  const poly = o.kind === "prism" || o.kind === "pyramid";
  const round = o.kind === "cylinder" || o.kind === "cone" || o.kind === "sphere";
  const sec = o.sec;
  const live = (patch: Partial<SolidObject> | ((x: SolidObject) => Partial<SolidObject>)) => act.live<SolidObject>(patch);
  /** Live change of the current section fields. */
  const liveSec = (patch: Record<string, number>) => live((x) => (x.sec ? { sec: { ...x.sec, ...patch } as SolidSection } : {}));
  const setSec = (mode: SecMode | null) => {
    if (!mode) {
      b()?.stopSecPick();
      act.set<SolidObject>({ sec: null });
      return;
    }
    if (mode === "pts") {
      act.set<SolidObject>({ sec: { mode: "pts", pts: [] } });
      b()?.startSecPick(o.id);
      return;
    }
    b()?.stopSecPick();
    act.set<SolidObject>({ sec: { ...SEC_DEFAULTS[mode] } });
  };
  const modes: [SecMode | null, string][] = [
    [null, "Немає"],
    ...(!round ? ([["pts", "По 3 точках"]] as [SecMode, string][]) : []),
    ["horiz", "Паралельний основі"],
    ["axial", "Осьовий"],
    ["tilt", "Похилий"],
  ];
  const marks = MARKS[o.kind] || [];
  const setN = (n: number) => act.set<SolidObject>({ names: undefined, n, sec: o.sec?.mode === "pts" ? null : o.sec });

  const chip = (on: boolean, name: string, patch: Partial<SolidObject>) => (
    <button className={"bd-chip-btn" + (on ? " on" : "")} aria-pressed={on} onClick={() => act.set<SolidObject>(patch)}>
      {name}
    </button>
  );

  return (
    <>
      <MenuTabs label="Налаштування фігури" tabs={SOLID_TABS} tab={tab} onPick={pick} />
      {tab === "shape" && (
        <>
          <div className="bd-sec bd-line wrap">
            {SOLID_KINDS.map((s) => (
              <button
                key={s.kind}
                className={"bd-chip-btn" + (o.kind === s.kind ? " on" : "")}
                onClick={() => act.set<SolidObject>(switchKind(s.kind))}
              >
                {s.name}
              </button>
            ))}
          </div>
          {poly && (
            <div className="bd-sec bd-line">
              <span className="bd-lbl">Кутів у основі</span>
              <button className="bd-ibtn" aria-label="Менше кутів" title="Менше кутів" disabled={(o.n || 4) <= 3} onClick={() => setN(Math.max(3, (o.n || 4) - 1))}>
                <Icon name="minus" size={16} />
              </button>
              <span className="bd-num">{o.n || 4}</span>
              <button className="bd-ibtn" aria-label="Більше кутів" title="Більше кутів" disabled={(o.n || 4) >= 12} onClick={() => setN(Math.min(12, (o.n || 4) + 1))}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          )}
          {(poly || round) && o.kind !== "sphere" && (
            <div className="bd-sec bd-line">
              <span className="bd-lbl">Висота</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={o.hr || 1.7}
                onChange={(e) => live({ hr: Number(e.target.value) })}
              />
            </div>
          )}
          {style}
          <div className="bd-sec bd-line wrap">{chip(!!o.f, "Заливка", { f: o.f ? null : "#6d3df0" })}</div>
        </>
      )}
      {tab === "view" && (
        <>
          <div className="bd-sec">
            <div className="bd-line wrap">
              {VIEWS.map(([k, name]) => (
                <button key={k} className="bd-chip-btn" onClick={() => act.set<SolidObject>({ ...SOLID_VIEWS[k], school: false })}>
                  {name}
                </button>
              ))}
            </div>
            <Slide label="Поворот">
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step="0.01"
                value={wrap(o.yaw)}
                onChange={(e) => live({ yaw: Number(e.target.value), school: false })}
              />
            </Slide>
            <Slide label="Нахил">
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step="0.01"
                value={wrap(o.pitch)}
                onChange={(e) => live({ pitch: Number(e.target.value), school: false })}
              />
            </Slide>
          </div>
          <div className="bd-sec bd-line wrap">
            {chip(!!o.school, "Шкільна проєкція", { school: !o.school })}
            {chip(!!o.hidden, "Невидимі ребра", { hidden: !o.hidden })}
          </div>
          <p className="bd-hint">Подвійний дотик по фігурі — крутити в будь-який бік.</p>
        </>
      )}
      {tab === "cons" && marks.length > 0 && (
        <div className="bd-sec">
          <span className="bd-lbl">Відрізки</span>
          <div className="bd-line wrap">
            {marks.map(([k, name]) => (
              <button
                key={k}
                className={"bd-chip-btn" + (o.marks?.[k] ? " on" : "")}
                aria-pressed={!!o.marks?.[k]}
                onClick={() => act.set<SolidObject>((x) => ({ marks: { ...(x.marks || {}), [k]: !x.marks?.[k] } }))}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === "cons" && (
        <div className="bd-sec">
          <span className="bd-lbl">Переріз</span>
          <div className="bd-line wrap">
            {modes.map(([k, name]) => (
              <button
                key={String(k)}
                className={"bd-chip-btn" + ((sec?.mode || null) === k ? " on" : "")}
                onClick={() => setSec(k)}
              >
                {name}
              </button>
            ))}
          </div>
          {sec?.mode === "pts" && (
            <>
              <div className="bd-line">
                <button
                  className={"bd-chip-btn" + (secPick ? " on" : "")}
                  onClick={() => (secPick ? b()?.stopSecPick() : b()?.startSecPick(o.id))}
                >
                  {secPick ? "Готово" : "Позначити точки"}
                </button>
                <span className="bd-lbl">{(sec.pts || []).length}/3 точок</span>
              </div>
              <p className="bd-hint">Торкніться трьох ребер — точки M, N, K. Їх можна тягнути вздовж ребер.</p>
            </>
          )}
          {sec?.mode === "horiz" && (
            <Slide label="Висота">
              <input
                type="range"
                min="0.03"
                max="0.97"
                step="0.01"
                value={sec.t ?? 0.5}
                onChange={(e) => liveSec({ t: Number(e.target.value) })}
              />
            </Slide>
          )}
          {sec?.mode === "axial" && (
            <Slide label="Кут">
              <input
                type="range"
                min="0"
                max={Math.PI}
                step="0.01"
                value={sec.a ?? 0}
                onChange={(e) => liveSec({ a: Number(e.target.value) })}
              />
            </Slide>
          )}
          {sec?.mode === "tilt" && (
            <>
              <Slide label="Напрям">
                <input
                  type="range"
                  min="0"
                  max={TAU}
                  step="0.01"
                  value={sec.a ?? 0}
                  onChange={(e) => liveSec({ a: Number(e.target.value) })}
                />
              </Slide>
              <Slide label="Нахил">
                <input
                  type="range"
                  min="0.05"
                  max="1.5"
                  step="0.01"
                  value={sec.tilt ?? 0.6}
                  onChange={(e) => liveSec({ tilt: Number(e.target.value) })}
                />
              </Slide>
              <Slide label="Зсув">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={sec.off ?? 0}
                  onChange={(e) => liveSec({ off: Number(e.target.value) })}
                />
              </Slide>
            </>
          )}
        </div>
      )}
      {tab === "labels" && <SolidNames o={o} />}
    </>
  );
}

/** Custom vertex letters and point / segment tags of a solid. */
function SolidNames({ o }: { o: SolidObject }) {
  const act = useSelection();
  const [open, setOpen] = useState(false);
  const fields = solidLabelFields(o);
  const setV = (i: number, val: string) =>
    act.live<SolidObject>((x) => {
      const names = [...(x.names || [])];
      const defs = solidLabelFields(x)
        .filter((f) => f.vertex !== undefined)
        .map((f) => f.def);
      for (let k = 0; k < defs.length; k++) if (names[k] === undefined) names[k] = defs[k];
      names[i] = val;
      return { names };
    }, 600);
  const setT = (key: string, val: string) => act.live<SolidObject>((x) => ({ tags: { ...(x.tags || {}), [key]: val } }), 600);
  return (
    <div className="bd-sec">
      <div className="bd-line wrap">
        <button
          className={"bd-chip-btn" + (o.labs ? " on" : "")}
          aria-pressed={!!o.labs}
          onClick={() => act.set<SolidObject>({ labs: !o.labs })}
        >
          Букви вершин
        </button>
        <button className={"bd-chip-btn" + (open ? " on" : "")} aria-expanded={open} onClick={() => setOpen(!open)}>
          Змінити букви
        </button>
        {open && (
          <button className="bd-chip-btn" onClick={() => act.set<SolidObject>({ names: undefined, tags: undefined })}>
            Скинути
          </button>
        )}
      </div>
      {open && (
        <div className="bd-names">
          {fields.map((f) => {
            const vertex = f.vertex;
            const cur = vertex !== undefined ? (o.names?.[vertex] ?? f.def) : (o.tags?.[f.key ?? ""] ?? f.def);
            return (
              <label key={f.key || "v" + vertex} title={f.label}>
                <small>{vertex !== undefined ? f.def : f.label}</small>
                <input
                  className="bd-input tiny"
                  value={cur}
                  maxLength={4}
                  onChange={(e) => (vertex !== undefined ? setV(vertex, e.target.value) : setT(f.key ?? "", e.target.value))}
                  onBlur={() => act.end()}
                />
              </label>
            );
          })}
          <p className="bd-hint">Порожнє поле ховає букву.</p>
        </div>
      )}
    </div>
  );
}
