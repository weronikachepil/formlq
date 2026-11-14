"use client";

import { IconBtn } from "./controls";
import { GRID_NAMES } from "./constants";
import { useBoard } from "./useBoard";

/** Bottom-left bar: undo/redo, zoom, grid, snap, keep tool. */
export function BottomBar() {
  const { st, b } = useBoard();
  const edit = st.canEdit;
  const grid = st.prefs.grid;
  return (
    <div className="bd-bottom">
      {edit && (
        <>
          <IconBtn name="undo" title="Скасувати (Ctrl+Z)" disabled={!st.canUndo} onClick={() => b()?.undo()} />
          <IconBtn name="redo" title="Повторити (Ctrl+Y)" disabled={!st.canRedo} onClick={() => b()?.redo()} />
          <i className="sep v" />
        </>
      )}
      <IconBtn name="minus" title="Менше (−)" onClick={() => b()?.zoomBy(0.8)} />
      <button className="bd-zoom" title="Скинути масштаб (0)" onClick={() => b()?.resetZoom()}>
        {Math.round(st.zoom * 100)}%
      </button>
      <IconBtn name="plus" title="Більше (+)" onClick={() => b()?.zoomBy(1.25)} />
      <IconBtn name="fit" title="Показати все (Shift+1)" onClick={() => b()?.zoomToFit()} />
      <i className="sep v" />
      <IconBtn
        name="grid"
        title={"Сітка: " + GRID_NAMES[grid]}
        active={grid !== "none"}
        onClick={() => b()?.setPrefs({ grid: grid === "squares" ? "dots" : grid === "dots" ? "none" : "squares" })}
      />
      {edit && (
        <IconBtn
          name="magnet"
          title="Прилипання до сітки"
          active={st.prefs.snap}
          onClick={() => b()?.setPrefs({ snap: !st.prefs.snap })}
        />
      )}
      {edit && (
        <IconBtn
          name="pin"
          title="Залишати інструмент після малювання"
          active={st.prefs.keep}
          onClick={() => b()?.setPrefs({ keep: !st.prefs.keep })}
        />
      )}
    </div>
  );
}
