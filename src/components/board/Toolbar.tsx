"use client";

import { ToolBtn } from "./controls";
import { SHAPE_TOOLS } from "./constants";
import type { MenuControl } from "./menu";
import { ToolMenus } from "./ToolMenus";
import { useBoard } from "./useBoard";

/** Left tool column and its drop-down menus; viewers get only the hand and the laser. */
export function Toolbar({ mc }: { mc: MenuControl }) {
  const { st, b } = useBoard();
  const { menu, toggle, setTool } = mc;
  const tool = st.tool;
  const shapeActive = SHAPE_TOOLS.has(tool);
  // One highlighted button at a time: while a menu is open, only its button is.
  const on = (...names: string[]) => !menu && names.includes(tool);

  if (!st.canEdit) {
    return (
      <div className="bd-tools">
        <ToolBtn name="hand" title="Рука" active={tool === "hand"} onClick={() => setTool("hand")} />
        <ToolBtn name="laser" title="Лазерна указка" active={tool === "laser"} onClick={() => setTool("laser")} />
      </div>
    );
  }

  return (
    <>
      <div className="bd-tools">
        <ToolBtn name="select" title="Виділення (V)" active={on("select")} onClick={() => setTool("select")} />
        <ToolBtn name="hand" title="Рука (H / пробіл)" active={on("hand")} onClick={() => setTool("hand")} />
        <i className="sep" />
        <ToolBtn name="pen" title="Ручка (P)" active={on("pen")} onClick={() => setTool("pen")} />
        <ToolBtn name="highlighter" title="Маркер (M)" active={on("highlighter")} onClick={() => setTool("highlighter")} />
        <ToolBtn name="eraser" title="Гумка (E)" active={on("eraser")} onClick={() => setTool("eraser")} />
        <i className="sep" />
        <ToolBtn
          name={shapeActive ? tool : "shapes"}
          title="Фігури"
          active={menu === "shapes" || (!menu && shapeActive)}
          onClick={() => toggle("shapes")}
        />
        <ToolBtn name="text" title="Текст (T)" active={on("text")} onClick={() => setTool("text")} />
        <ToolBtn name="formula" title="Формула (F)" active={on("formula")} onClick={() => setTool("formula")} />
        <i className="sep" />
        <ToolBtn name="graph" title="Графіки та координатна площина" active={menu === "graph"} onClick={() => toggle("graph")} />
        <ToolBtn name="solid" title="Об'ємні фігури" active={menu === "solid"} onClick={() => toggle("solid")} />
        <i className="sep" />
        <ToolBtn
          name="image"
          title="Зображення або PDF (також Ctrl+V чи перетягування файлу)"
          active={false}
          onClick={() => {
            mc.close();
            b()?.pickImage();
          }}
        />
        <ToolBtn
          name={tool === "compass" ? "compass" : "ruler"}
          title="Лінійка, транспортир, циркуль"
          active={menu === "instr" || on("compass")}
          onClick={() => toggle("instr")}
        />
        <ToolBtn name="arith" title="Дія в стовпчик, моделі дробу" active={menu === "arith"} onClick={() => toggle("arith")} />
        <ToolBtn
          name="template"
          title="Шаблони: числова пряма, таблиця, діаграма Венна"
          active={menu === "tmpl"}
          onClick={() => toggle("tmpl")}
        />
        <ToolBtn name="laser" title="Лазерна указка (B)" active={on("laser")} onClick={() => setTool("laser")} />
        <ToolBtn
          name="lesson"
          title="Урок: коментарі, таймер, голосування, завдання"
          active={menu === "lesson" || on("comment", "stamp")}
          onClick={() => toggle("lesson")}
        />
      </div>
      <ToolMenus mc={mc} />
    </>
  );
}
