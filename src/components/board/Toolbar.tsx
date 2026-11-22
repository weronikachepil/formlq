"use client";

import { ToolBtn } from "./controls";
import { SHAPE_TOOLS } from "./constants";
import type { MenuControl } from "./menu";
import { ToolMenus } from "./ToolMenus";
import { useBoard } from "./useBoard";

/**
 * Left tool column, grouped as in note apps: navigate · write · type/shapes · geometry & insert ·
 * lesson. Viewers get only the hand and the laser.
 */
export function Toolbar({ mc }: { mc: MenuControl }) {
  const { st } = useBoard();
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
          open={menu === "shapes"}
          onClick={() => toggle("shapes")}
        />
        <ToolBtn name="text" title="Текст (T)" active={on("text")} onClick={() => setTool("text")} />
        <ToolBtn name="formula" title="Формула (F)" active={on("formula")} onClick={() => setTool("formula")} />
        <i className="sep" />
        <ToolBtn
          name={tool === "compass" ? "compass" : "ruler"}
          title="Геометрія: лінійка, циркуль, побудови"
          active={menu === "instr" || on("compass")}
          open={menu === "instr"}
          onClick={() => toggle("instr")}
        />
        <ToolBtn
          name="insert"
          title="Вставити: фото, графік, об'ємна фігура, числова пряма, діаграма (Ctrl+V — з буфера)"
          active={menu === "insert"}
          open={menu === "insert"}
          onClick={() => toggle("insert")}
        />
        <i className="sep" />
        <ToolBtn name="laser" title="Лазерна указка (B)" active={on("laser")} onClick={() => setTool("laser")} />
        <ToolBtn
          name="lesson"
          title="Урок: коментарі, таймер, голосування, завдання"
          active={menu === "lesson" || on("comment", "stamp")}
          open={menu === "lesson"}
          onClick={() => toggle("lesson")}
        />
      </div>
      <ToolMenus mc={mc} />
    </>
  );
}
