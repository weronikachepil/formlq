"use client";

import { IconBtn } from "./controls";
import { GRID_NAMES } from "./constants";
import { useBoard } from "./useBoard";

/** Bottom-left bar: undo/redo, zoom, grid, snap, keep tool. */
export function BottomBar() {
  const { st, b } = useBoard();
  const edit = st.canEdit;
  const grid = st.prefs.grid;
  const paper = !!st.pages.find((p) => p.id === st.page)?.paper;
  return (
    <div className="bd-bottom">
      {edit && (
        <>
          <IconBtn name="undo" title="Скасувати (Ctrl+Z · дотик двома пальцями)" disabled={!st.canUndo} onClick={() => b()?.undo()} />
          <IconBtn name="redo" title="Повторити (Ctrl+Y · дотик трьома пальцями)" disabled={!st.canRedo} onClick={() => b()?.redo()} />
          <i className="sep v" />
        </>
      )}
      <IconBtn name="minus" title="Менше (−)" onClick={() => b()?.zoomBy(0.8)} />
      <button className="bd-zoom" title="Скинути масштаб (0)" onClick={() => b()?.resetZoom()}>
        {Math.round(st.zoom * 100)}%
      </button>
      <IconBtn name="plus" title="Більше (+)" onClick={() => b()?.zoomBy(1.25)} />
      <IconBtn
        name="fit"
        title={paper ? "За шириною аркуша (Shift+1)" : "Показати все (Shift+1)"}
        onClick={() => b()?.zoomToFit()}
      />
      <i className="sep v" />
      {st.isOwner && edit && (
        <IconBtn
          name="paper"
          title={paper ? "Аркуш як сторінка зошита (натисніть — нескінченна дошка)" : "Зробити аркуш сторінкою зошита"}
          toggle
          active={paper}
          onClick={() => b()?.setPaper(!paper)}
        />
      )}
      <IconBtn
        name={grid === "dots" ? "grid_dots" : "grid"}
        title={"Сітка: " + GRID_NAMES[grid] + " (натисніть, щоб змінити)"}
        active={grid !== "none"}
        onClick={() => b()?.setPrefs({ grid: grid === "squares" ? "dots" : grid === "dots" ? "none" : "squares" })}
      />
      {edit && (
        <IconBtn
          name="magnet"
          title="Прилипання до сітки"
          toggle
          active={st.prefs.snap}
          onClick={() => b()?.setPrefs({ snap: !st.prefs.snap })}
        />
      )}
      {edit && (
        <IconBtn
          name="stylus"
          title={
            st.prefs.stylusOnly
              ? "Малює лише стилус, палець рухає дошку (натисніть, щоб малювати й пальцем)"
              : "Малювати лише стилусом, а пальцем рухати дошку"
          }
          toggle
          active={st.prefs.stylusOnly}
          onClick={() => b()?.setPrefs({ stylusOnly: !st.prefs.stylusOnly })}
        />
      )}
      {edit && (
        <IconBtn
          name="pin"
          title="Залишати інструмент після малювання"
          toggle
          active={st.prefs.keep}
          onClick={() => b()?.setPrefs({ keep: !st.prefs.keep })}
        />
      )}
    </div>
  );
}
