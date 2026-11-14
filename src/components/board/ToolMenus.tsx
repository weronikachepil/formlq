"use client";

import { GRAPH_PRESETS } from "@/lib/board/engine/board";
import { SOLID_KINDS } from "@/lib/board/engine/solid";
import { MenuItem, TimerRow } from "./controls";
import { CONSTR_ITEMS, GRAPH_DESC, GRAPH_ICONS, MARK_ITEMS, SHAPE_GROUPS, SOLID_DESC, VECTOR_ITEMS } from "./constants";
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
  const { st, b } = useBoard();
  const { menu, close, setTool, openDialog } = mc;
  const tool = st.tool;
  if (!menu || menu === "export" || menu === "peers") return null;

  /** Run an engine action, then close the menu. */
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const isTest = !!st.pages.find((p) => p.id === st.page)?.test;

  return (
    <div className="bd-menus">
      {menu === "shapes" && (
        <div className="bd-menu bd-shapes">
          {SHAPE_GROUPS.map(([ttl, items]) => (
            <div key={ttl}>
              <div className="bd-menu-title">{ttl}</div>
              <div className="bd-pgrid">
                {items.map(([id, label]) => (
                  <button key={id} className={"bd-shape" + (tool === id ? " on" : "")} onClick={() => setTool(id)}>
                    <Icon name={id} size={22} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="bd-hint">Перетягніть на дошці · Shift — рівні сторони · подвійний клік — редагувати вершини</p>
        </div>
      )}

      {menu === "graph" && (
        <div className="bd-menu wide">
          <div className="bd-menu-title">Графіки</div>
          {GRAPH_PRESETS.map((p) => (
            <MenuItem
              key={p.id}
              icon={GRAPH_ICONS[p.id]}
              title={p.label}
              desc={GRAPH_DESC[p.id]}
              onClick={run(() => b()?.insertGraph(p.id))}
            />
          ))}
        </div>
      )}

      {menu === "lesson" && (
        <div className="bd-menu wide">
          <div className="bd-menu-title">Урок</div>
          <MenuItem icon="comment" title="Коментар" desc="Клік по дошці — залишити нотатку" onClick={() => setTool("comment")} />
          {st.isOwner && (
            <>
              <div className="bd-menu-title">Під час уроку</div>
              <MenuItem
                icon="task"
                title="Картка завдання"
                desc="Умова з балами для учнів"
                onClick={run(() => b()?.insertTask())}
              />
              <MenuItem icon="poll" title="Голосування" desc="Швидке опитування класу" onClick={run(() => b()?.insertPoll())} />
              <TimerRow onAdd={(m) => run(() => b()?.insertTimer(m))()} />
              <MenuItem icon="stamp" title="Оцінки" desc="Клік по дошці ставить ✓ ✗ ½ ?" onClick={() => setTool("stamp")} />
              <div className="bd-menu-title">Учні й тести</div>
              <MenuItem
                icon="lesson"
                title="Роздати аркуш"
                desc="Особисте завдання вибраним учням"
                onClick={run(() => openDialog({ kind: "assign" }))}
              />
              <MenuItem
                icon="task"
                title="Імпорт тесту"
                desc="Створити тест із тексту"
                onClick={run(() => openDialog({ kind: "testImport" }))}
              />
              {isTest && (
                <>
                  <MenuItem
                    icon="lesson"
                    title="Запустити тест"
                    desc="Перевести учнів на цей аркуш"
                    onClick={run(() => b()?.startTest(st.page))}
                  />
                  <MenuItem
                    icon="poll"
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
      )}

      {menu === "instr" && (
        <div className="bd-menu wide">
          <div className="bd-menu-title">Прилади</div>
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
            onClick={() => setTool("compass")}
          />
          <div className="bd-menu-title">Побудови</div>
          <MenuItem
            icon="parallel"
            title="Паралельна пряма"
            desc="Через точку паралельно відрізку"
            active={tool === "parallel"}
            onClick={() => setTool("parallel")}
          />
          <MenuItem
            icon="perpicon"
            title="Перпендикуляр"
            desc="Через точку перпендикулярно прямій"
            active={tool === "perp"}
            onClick={() => setTool("perp")}
          />
          {CONSTR_ITEMS.map(([id, nm, ds]) => (
            <MenuItem key={id} icon={id} title={nm} desc={ds} active={tool === id} onClick={() => setTool(id)} />
          ))}
          <div className="bd-menu-title">Позначки на фігурах</div>
          {MARK_ITEMS.map(([id, nm, ds]) => (
            <MenuItem key={id} icon={id} title={nm} desc={ds} active={tool === id} onClick={() => setTool(id)} />
          ))}
          <div className="bd-menu-title">Дії з векторами</div>
          {VECTOR_ITEMS.map(([id, nm, ds]) => (
            <MenuItem key={id} icon={id} title={nm} desc={ds} active={tool === id} onClick={() => setTool(id)} />
          ))}
        </div>
      )}

      {menu === "arith" && (
        <div className="bd-menu wide">
          <div className="bd-menu-title">Дія в стовпчик</div>
          {ARITH_SIGNS.map(([sg, nm]) => (
            <MenuItem
              key={sg}
              icon={<b style={{ fontSize: 20 }}>{sg}</b>}
              title={nm}
              onClick={run(() => b()?.insertColmath(sg === "½" ? "frac" : sg))}
            />
          ))}
          <p className="bd-hint">Наберіть числа — знак і риска стануть самі. Учні вписують відповідь під рискою.</p>
          <p className="bd-hint">Дроби: дріб займає дві клітинки. Учні розв&apos;язують кроками, рядок за рядком.</p>
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
            onClick={run(() => b()?.insertFmodel("circle"))}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="8" width="20" height="8" />
                <path d="M7 8v8M12 8v8M17 8v8" />
              </svg>
            }
            title="Смуга"
            onClick={run(() => b()?.insertFmodel("strip"))}
          />
          <p className="bd-hint">Дотик по частці — зафарбувати чи стерти. Смуги склеюються краями.</p>
        </div>
      )}

      {menu === "tmpl" && (
        <div className="bd-menu wide">
          <div className="bd-menu-title">Шаблони</div>
          <MenuItem
            icon="numline"
            title="Числова пряма"
            desc="З поділками та проміжками"
            onClick={run(() => openDialog({ kind: "numline" }))}
          />
          <MenuItem icon="trig" title="Тригонометричне коло" desc="Кути, sin, cos, tg" onClick={run(() => b()?.insertTrig())} />
          <MenuItem icon="venn" title="Діаграма Венна" desc="2 множини" onClick={run(() => b()?.insertTemplate("venn2"))} />
          <MenuItem icon="venn" title="Діаграма Венна" desc="3 множини" onClick={run(() => b()?.insertTemplate("venn3"))} />
          <MenuItem
            icon="cplane"
            title="Координатна площина"
            desc="Клік ставить точку, повторний клік — прибирає"
            onClick={run(() => b()?.insertCplane())}
          />
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
        </div>
      )}

      {menu === "solid" && (
        <div className="bd-menu wide">
          <div className="bd-menu-title">Об&apos;ємні фігури</div>
          {SOLID_KINDS.map((s) => (
            <MenuItem
              key={s.kind}
              icon={"s_" + s.kind}
              title={s.name}
              desc={SOLID_DESC[s.kind]}
              onClick={run(() => b()?.insertSolid(s.kind))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
