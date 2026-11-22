"use client";

import { useMemo, useState } from "react";
import type { TestDoc } from "@/lib/tests";
import { testToBoard } from "@/lib/board/test-to-quiz";
import { pluralize, PLURAL } from "@/lib/format";
import { useTestLibrary, type TestGroup } from "@/hooks/useTestLibrary";
import { useBoard } from "../useBoard";
import { Modal } from "./Modal";

type Tab = "mine" | "catalog";

/** Puts a ready test on the board as a test sheet: one of the user's own, or any from the catalog. */
export function TestLibraryDialog({ onClose }: { onClose: () => void }) {
  const { b } = useBoard();
  const lib = useTestLibrary();
  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // Folders the user opened by hand (all open while searching or when there is one).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const groups = tab === "mine" ? lib.mineGroups : lib.catalogGroups;
  const loading = tab === "mine" ? lib.mineLoading : lib.catalogLoading;
  const failed = tab === "mine" ? lib.mineError : lib.catalogError;

  const q = search.trim().toLowerCase();
  const shown = useMemo<TestGroup[]>(() => {
    if (!q) return groups;
    return groups
      .map((g) =>
        g.name.toLowerCase().includes(q)
          ? g
          : { ...g, tests: g.tests.filter((t) => [t.title, t.subtitle].some((s) => (s ?? "").toLowerCase().includes(q))) },
      )
      .filter((g) => g.tests.length);
  }, [groups, q]);

  const isOpen = (g: TestGroup) => !!q || shown.length === 1 || expanded.has(g.key);
  const all = [...lib.mine, ...lib.published];
  const chosen = all.find((t) => t.id === picked);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function put(t: TestDoc) {
    b()?.importTest(testToBoard(t));
    onClose();
  }

  function switchTab(next: Tab) {
    setTab(next);
    setPicked(null);
  }

  const meta = (t: TestDoc) =>
    [pluralize(t.questions.length, PLURAL.question), tab === "mine" && t.published ? "у каталозі" : ""].filter(Boolean).join(" · ");

  return (
    <Modal onClose={onClose} className="lib-modal" style={{ width: "min(620px,100%)" }}>
      <h2>Тест із готових</h2>
      <p className="sub" style={{ margin: "4px 0 12px" }}>
        Тест зʼявиться окремим аркушем — учні побачать його після «Запустити тест».
      </p>
      <div className="lib-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => switchTab("mine")}>
          {lib.editor ? "Тести платформи" : "Мої тести"}
        </button>
        <button type="button" role="tab" aria-selected={tab === "catalog"} className={tab === "catalog" ? "on" : ""} onClick={() => switchTab("catalog")}>
          Каталог
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tab === "mine" ? "Пошук за назвою, описом чи папкою" : "Пошук за назвою, описом чи автором"}
        autoFocus
        style={{ width: "100%", marginTop: 10 }}
      />
      <div className="lib-list">
        {loading ? (
          <p className="sub">Завантаження…</p>
        ) : failed ? (
          <p className="err">Не вдалося завантажити тести</p>
        ) : shown.length === 0 ? (
          <p className="sub">
            {q
              ? "Нічого не знайдено"
              : tab === "mine"
                ? "У вас ще немає тестів із питаннями. Створіть тест у розділі «Мої тести»."
                : "У каталозі поки немає інших тестів"}
          </p>
        ) : (
          shown.map((g) => {
            const open = isOpen(g);
            return (
              <div key={g.key} className="lib-group">
                <button type="button" className="lib-folder" aria-expanded={open} onClick={() => toggle(g.key)}>
                  <span className="lib-caret">{open ? "▾" : "▸"}</span>
                  <span className="lib-folder-name">{g.name}</span>
                  <span className="lib-count">{g.tests.length}</span>
                </button>
                {open &&
                  g.tests.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={"lib-item" + (t.id === picked ? " on" : "")}
                      onClick={() => setPicked(t.id)}
                      onDoubleClick={() => put(t)}
                    >
                      <b>{t.title || "Без назви"}</b>
                      {t.subtitle && <span className="lib-desc">{t.subtitle}</span>}
                      <span>{meta(t)}</span>
                    </button>
                  ))}
              </div>
            );
          })
        )}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button disabled={!chosen} onClick={() => chosen && put(chosen)}>
          Додати на дошку
        </button>
        <button className="ghost" onClick={onClose}>
          Скасувати
        </button>
      </div>
    </Modal>
  );
}
