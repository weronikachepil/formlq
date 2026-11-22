"use client";

import { useState } from "react";
import { GRAPH_PRESETS, type MathBoard } from "@/lib/board/engine/board";
import { SOLID_KINDS } from "@/lib/board/engine/solid";
import { MenuItem, MenuTabs, TimerRow, useMenuTab } from "./controls";
import { CONSTR_ITEMS, GRAPH_DESC, GRAPH_ICONS, MARK_ITEMS, SHAPE_TABS, SOLID_DESC, VECTOR_ITEMS, type MenuEntry } from "./constants";
import { Icon } from "./icons";
import type { MenuControl } from "./menu";
import { useBoard } from "./useBoard";

const ARITH_SIGNS: [sign: "+" | "−" | "×" | "÷" | "½", name: string][] = [
  ["+", "Додавання"],
  ["−", "Віднімання"],
  ["×", "Множення"],
  ["÷", "Ділення"],
  ["½", "Дроби"],
];
const TABLE_SIZES: [rows: number, cols: number][] = [
  [3, 3],
  [4, 4],
  [2, 6],
  [6, 3],
];

/** Drop-down menus of the left toolbar (outside it, so its scrolling never clips them). */
export function ToolMenus({ mc }: { mc: MenuControl }) {
  const { st } = useBoard();
  const { menu, close, openDialog } = mc;
  if (!menu || menu === "export" || menu === "peers") return null;

  /** Run an engine action, then close the menu. */
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const isTest = !!st.pages.find((p) => p.id === st.page)?.test;

  return (
    <div className="bd-menus">
      {menu === "insert" && <InsertMenu run={run} openDialog={openDialog} />}

      {menu === "shapes" && <ShapesMenu mc={mc} />}

      {menu === "lesson" && <LessonMenu run={run} mc={mc} isTest={isTest} />}

      {menu === "instr" && <GeometryMenu run={run} mc={mc} />}

    </div>
  );
}

type InsertTab = "image" | "graph" | "solid" | "num" | "data";
const INSERT_TABS: [InsertTab, string][] = [
  ["image", "Фото"],
  ["graph", "Графіки"],
  ["solid", "Об'ємні"],
  ["num", "Числа"],
  ["data", "Дані"],
];
const TAB_KEY = "mb-insert-tab";

/**
 * «Вставити»: everything that is placed on the board, sorted by school topic in tabs
 * (was five separate toolbar buttons). The last tab is remembered.
 */
function InsertMenu({ run, openDialog }: { run: (fn: () => void) => () => void; openDialog: MenuControl["openDialog"] }) {
  const { b } = useBoard();
  const [tab, pick] = useMenuTab(TAB_KEY, INSERT_TABS, "image");
  return (
    <div className="bd-menu wide bd-tabbed">
      <MenuTabs label="Що вставити" tabs={INSERT_TABS} tab={tab} onPick={pick} />
      <div className="bd-tabpanel" role="tabpanel">
        {tab === "image" && (
          <>
            <MenuItem
              icon="copy"
              title="Вставити з буфера"
              desc="Скопійований скріншот чи картинка (Ctrl+V / ⌘V)"
              onClick={run(() => void b()?.pasteClipboard())}
            />
            <MenuItem
              icon="image"
              title="Файл, фото або PDF"
              desc="З галереї, документів чи камери"
              onClick={run(() => b()?.pickImage())}
            />
          </>
        )}
        {tab === "graph" && (
          <>
            {GRAPH_PRESETS.map((p) => (
              <MenuItem
                key={p.id}
                icon={GRAPH_ICONS[p.id]}
                title={p.label}
                desc={GRAPH_DESC[p.id]}
                onClick={run(() => b()?.insertGraph(p.id))}
              />
            ))}          <div className="bd-menu-title">Для вправ</div>
            <MenuItem
              icon="cplane"
              title="Площина з точками"
              desc="Дотик ставить точку, повторний — прибирає"
              onClick={run(() => b()?.insertCplane())}
            />
            <MenuItem icon="trig" title="Тригонометричне коло" desc="Кути, sin, cos, tg" onClick={run(() => b()?.insertTrig())} />
          </>
        )}
        {tab === "solid" && (
          <>
            {SOLID_KINDS.map((s) => (
              <MenuItem
                key={s.kind}
                icon={"s_" + s.kind}
                title={s.name}
                desc={SOLID_DESC[s.kind]}
                onClick={run(() => b()?.insertSolid(s.kind))}
              />
            ))}
          </>
        )}
        {tab === "num" && (
          <>
            <div className="bd-menu-title">Числова пряма</div>
            <MenuItem
              icon="numline"
              title="Числова пряма"
              desc="З поділками та проміжками"
              onClick={run(() => openDialog({ kind: "numline" }))}
            />
            <div className="bd-menu-title">Дія в стовпчик</div>
            {ARITH_SIGNS.map(([sg, nm]) => (
              <MenuItem
                key={sg}
                icon={<b style={{ fontSize: 20 }}>{sg}</b>}
                title={nm}
                onClick={run(() => {
                  b()?.insertColmath(sg === "½" ? "frac" : sg);
                  howTo(b, "Наберіть числа — знак і риска стануть самі");
                })}
              />
            ))}
            <MenuItem
              icon="exgen"
              title="Генератор вправ"
              desc="Випадкові приклади для класу"
              onClick={run(() => openDialog({ kind: "exercises" }))}
            />
            <div className="bd-menu-title">Модель дробу</div>
            <MenuItem
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18M3 12h18" />
                </svg>
              }
              title="Коло"
              onClick={run(() => {
                b()?.insertFmodel("circle");
                howTo(b, "Торкніться частки, щоб зафарбувати чи стерти");
              })}
            />
            <MenuItem
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="8" width="20" height="8" />
                  <path d="M7 8v8M12 8v8M17 8v8" />
                </svg>
              }
              title="Смуга"
              onClick={run(() => {
                b()?.insertFmodel("strip");
                howTo(b, "Торкніться частки, щоб зафарбувати чи стерти");
              })}
            />
          </>
        )}
        {tab === "data" && (
          <>
            <div className="bd-menu-title">Діаграми та статистика</div>
            <MenuItem
              icon="chart_bar"
              title="Стовпчаста діаграма"
              onClick={run(() => openDialog({ kind: "source", src: "bar" }))}
            />
            <MenuItem icon="chart_pie" title="Кругова діаграма" onClick={run(() => openDialog({ kind: "source", src: "pie" }))} />
            <MenuItem
              icon="chart_hist"
              title="Гістограма"
              desc="Середнє, мода, медіана, розмах"
              onClick={run(() => openDialog({ kind: "source", src: "hist" }))}
            />
            <div className="bd-menu-title">Ймовірність</div>
            <MenuItem icon="ptree" title="Дерево ймовірностей" onClick={run(() => openDialog({ kind: "source", src: "tree" }))} />
            <MenuItem icon="die" title="Гральний кубик" desc="Кидки та частоти" onClick={run(() => b()?.insertDice("die"))} />
            <MenuItem icon="coin" title="Монета" desc="Герб / цифра, частоти" onClick={run(() => b()?.insertDice("coin"))} />
            <div className="bd-menu-title">Множини</div>
            <MenuItem icon="venn" title="Венн: 2 множини" onClick={run(() => b()?.insertTemplate("venn2"))} />
            <MenuItem icon="venn" title="Венн: 3 множини" onClick={run(() => b()?.insertTemplate("venn3"))} />
            <div className="bd-menu-title">Таблиця</div>
            <div className="bd-chips">
              {TABLE_SIZES.map(([r, c]) => (
                <button
                  key={`${r}x${c}`}
                  className="bd-chip-btn"
                  title={`${r} рядки × ${c} стовпці`}
                  onClick={run(() => b()?.insertTemplate("table", { rows: r, cols: c }))}
                >
                  {r} × {c}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type GeoTab = "instr" | "constr" | "marks" | "vectors";
const GEO_TABS: [GeoTab, string][] = [
  ["instr", "Прилади"],
  ["constr", "Побудови"],
  ["marks", "Позначки"],
  ["vectors", "Вектори"],
];

/** «Геометрія»: instruments, constructions, marks and vector actions in tabs (was one 23-item list). */
function GeometryMenu({ run, mc }: { run: (fn: () => void) => () => void; mc: MenuControl }) {
  const { st, b } = useBoard();
  const tool = st.tool;
  const [tab, pick] = useMenuTab("mb-geo-tab", GEO_TABS, "instr");
  // How to use the tool is told when it is picked, not printed under every menu row.
  const setTool = (id: string, how?: string) => {
    mc.setTool(id);
    if (how) howTo(b, how);
  };
  const items = (list: readonly MenuEntry[]) =>
    list.map(([id, nm, ds]) => <MenuItem key={id} icon={id} title={nm} desc={ds} active={tool === id} onClick={() => setTool(id, ds)} />);
  return (
    <div className="bd-menu wide bd-tabbed">
      <MenuTabs label="Геометрія" tabs={GEO_TABS} tab={tab} onPick={pick} />
      <div className="bd-tabpanel" role="tabpanel">
        {tab === "instr" && (
          <>
            <MenuItem
              icon="ruler"
              title="Лінійка"
              desc="Вирівнює лінію, проведену вздовж краю"
              onClick={run(() => b()?.insertInstrument("ruler"))}
            />
            <MenuItem
              icon="protractor"
              title="Транспортир"
              desc="Вимірювання та побудова кутів"
              onClick={run(() => b()?.insertInstrument("protractor"))}
            />
            <MenuItem
              icon="compass"
              title="Циркуль"
              desc="Тягніть від центру — радіус, далі дуга"
              active={tool === "compass"}
              onClick={() => setTool("compass", "Тягніть від центру — радіус, далі ведіть дугу")}
            />
          </>
        )}
        {tab === "constr" && (
          <>
            <MenuItem
              icon="parallel"
              title="Паралельна пряма"
              desc="Через точку паралельно відрізку"
              active={tool === "parallel"}
              onClick={() => setTool("parallel", "Торкніться відрізка, потім точки")}
            />
            <MenuItem
              icon="perpicon"
              title="Перпендикуляр"
              desc="Через точку перпендикулярно прямій"
              active={tool === "perp"}
              onClick={() => setTool("perp", "Торкніться прямої, потім точки")}
            />
            {items(CONSTR_ITEMS)}
          </>
        )}
        {tab === "marks" && items(MARK_ITEMS)}
        {tab === "vectors" && items(VECTOR_ITEMS)}
      </div>
    </div>
  );
}

type LessonTab = "lesson" | "test";

/** «Урок»: in-lesson tools and tests apart (tests only for the board's owner). */
function LessonMenu({ run, mc, isTest }: { run: (fn: () => void) => () => void; mc: MenuControl; isTest: boolean }) {
  const { st, b } = useBoard();
  const { openDialog } = mc;
  const setTool = (id: string, how: string) => {
    mc.setTool(id);
    howTo(b, how);
  };
  const tabs: [LessonTab, string][] = st.isOwner
    ? [
        ["lesson", "Урок"],
        ["test", "Тест"],
      ]
    : [["lesson", "Урок"]];
  const [tab, pick] = useMenuTab("mb-lesson-tab", tabs, "lesson");
  return (
    <div className="bd-menu wide bd-tabbed">
      <MenuTabs label="Урок і тести" tabs={tabs} tab={tab} onPick={pick} />
      <div className="bd-tabpanel" role="tabpanel">
        {tab === "lesson" && (
          <>
            <MenuItem icon="comment" title="Коментар" desc="Торкніться дошки — залишити нотатку" onClick={() => setTool("comment", "Торкніться дошки, щоб залишити нотатку")} />
            {st.isOwner && (
              <>
                <MenuItem icon="task" title="Картка завдання" desc="Умова з балами для учнів" onClick={run(() => b()?.insertTask())} />
                <MenuItem icon="poll" title="Голосування" desc="Швидке опитування класу" onClick={run(() => b()?.insertPoll())} />
                <TimerRow onAdd={(m) => run(() => b()?.insertTimer(m))()} />
                <MenuItem icon="stamp" title="Оцінки" desc="Дотик по дошці ставить ✓ ✗ ½ ?" onClick={() => setTool("stamp", "Торкніться дошки — поставити ✓ ✗ ½ ?")} />
                <MenuItem
                  icon="copy"
                  title="Роздати аркуш"
                  desc="Особисте завдання вибраним учням"
                  onClick={run(() => openDialog({ kind: "assign" }))}
                />
              </>
            )}
          </>
        )}
        {tab === "test" && (
          <>
            <MenuItem
              icon="lesson"
              title="Тест із готових"
              desc="Додати тест із «Мої тести»"
              onClick={run(() => openDialog({ kind: "testLibrary" }))}
            />
            <MenuItem icon="task" title="Імпорт тесту" desc="Створити тест із тексту" onClick={run(() => openDialog({ kind: "testImport" }))} />
            {isTest && (
              <>
                <MenuItem
                  icon="timer"
                  title="Запустити тест"
                  desc="Перевести учнів на цей аркуш"
                  onClick={run(() => b()?.startTest(st.page))}
                />
                <MenuItem
                  icon="history"
                  title="Результати тесту"
                  desc="Бали та відповіді учнів"
                  onClick={run(() => openDialog({ kind: "results" }))}
                />
                <MenuItem
                  icon="eye"
                  title={st.showKeys ? "Сховати ключ" : "Показати ключ"}
                  desc="Правильні відповіді лише для вас"
                  onClick={run(() => b()?.setShowKeys(!st.showKeys))}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A short just-in-time hint at the bottom of the board (instead of text in the menus). */
function howTo(b: () => MathBoard | null, text: string) {
  b()?.opts.onNotice?.(text);
}

type ShapeTab = (typeof SHAPE_TABS)[number][0];
const SHAPE_TAB_NAMES = SHAPE_TABS.map(([id, name]) => [id, name] as [ShapeTab, string]);

/** «Фігури» in tabs (was one long scroll of five groups). */
function ShapesMenu({ mc }: { mc: MenuControl }) {
  const { st } = useBoard();
  const tool = st.tool;
  // open on the tab of the shape in use
  const current = SHAPE_TABS.find(([, , groups]) => groups.some(([, items]) => items.some(([id]) => id === tool)))?.[0];
  const [saved, pick] = useMenuTab<ShapeTab>("mb-shape-tab", SHAPE_TAB_NAMES, "basic");
  const [tab, setTab] = useState<ShapeTab>(current ?? saved);
  const groups = SHAPE_TABS.find(([id]) => id === tab)?.[2] ?? [];
  return (
    <div className="bd-menu bd-shapes bd-tabbed">
      <MenuTabs
        label="Фігури"
        tabs={SHAPE_TAB_NAMES}
        tab={tab}
        onPick={(t) => {
          setTab(t);
          pick(t);
        }}
      />
      <div className="bd-tabpanel" role="tabpanel">
        {groups.map(([ttl, items]) => (
          <div key={ttl || "all"}>
            {ttl && <div className="bd-menu-title">{ttl}</div>}
            <div className="bd-pgrid">
              {items.map(([id, label]) => (
                <button key={id} className={"bd-shape" + (tool === id ? " on" : "")} onClick={() => mc.setTool(id)}>
                  <Icon name={id} size={22} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
