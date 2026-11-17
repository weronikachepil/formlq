"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { isEditor } from "@/lib/roles";
import { getPublishedTests, getTestFolders, getTests, type TestDoc } from "@/lib/tests";
import { testToBoard } from "@/lib/board/test-to-quiz";
import { pluralize, PLURAL } from "@/lib/format";
import { useBoard } from "../useBoard";
import { Modal } from "./Modal";

type Tab = "mine" | "catalog";

interface Row {
  t: TestDoc;
  /** Group the row sorts under: a folder (own tests) or the author (catalog). */
  group: string;
}

/** Puts a ready test on the board as a test sheet: one of the user's own, or any from the catalog. */
export function TestLibraryDialog({ onClose }: { onClose: () => void }) {
  const { b } = useBoard();
  const { user, userProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const editor = isEditor(userProfile?.role);
  // «Мої»: same source as homework — a teacher's own tests, or the platform's for editors.
  const owner = editor ? null : (user?.uid ?? null);
  const ready = !!user && !!userProfile;

  const mine = useQuery({
    queryKey: queryKeys.tests.of(owner),
    queryFn: () => getTests(owner),
    enabled: ready,
    staleTime: STALE.long,
  });
  const { data: folders = [] } = useQuery({
    queryKey: queryKeys.tests.foldersOf(owner),
    queryFn: () => getTestFolders(owner),
    enabled: ready,
    staleTime: STALE.long,
  });
  const catalog = useQuery({
    queryKey: queryKeys.tests.published,
    queryFn: getPublishedTests,
    enabled: ready && tab === "catalog",
    staleTime: STALE.long,
  });
  const active = tab === "mine" ? mine : catalog;
  const tests = useMemo(() => active.data ?? [], [active.data]);

  const q = search.trim().toLowerCase();
  const list = useMemo<Row[]>(() => {
    const folderName = new Map(folders.map((f) => [f.id, f.name]));
    const rows: Row[] = tests
      .filter((t) => (t.questions?.length ?? 0) > 0)
      // The catalog skips the user's own tests: they are under «Мої».
      .filter((t) => tab === "mine" || t.createdBy !== user?.uid)
      .map((t) => ({
        t,
        group:
          tab === "mine"
            ? (t.folderId && folderName.get(t.folderId)) || ""
            : t.personal
              ? t.authorName || "Викладач"
              : "",
      }));
    return (
      rows
        .filter(({ t, group }) => !q || [t.title, t.subtitle, group].some((s) => (s ?? "").toLowerCase().includes(q)))
        // «Мої»: folders by name, tests without a folder last. Catalog: formlq's own first, then by author.
        .sort((a, c) =>
          tab === "mine"
            ? Number(!a.group) - Number(!c.group) || a.group.localeCompare(c.group, "uk") || (a.t.order ?? 0) - (c.t.order ?? 0)
            : Number(!!a.group) - Number(!!c.group) || a.group.localeCompare(c.group, "uk") || (a.t.order ?? 0) - (c.t.order ?? 0),
        )
    );
  }, [tests, folders, q, tab, user?.uid]);

  const chosen = list.find((r) => r.t.id === picked)?.t;

  function put(t: TestDoc) {
    b()?.importTest(testToBoard(t));
    onClose();
  }

  function switchTab(next: Tab) {
    setTab(next);
    setPicked(null);
  }

  const meta = ({ t, group }: Row) =>
    [
      tab === "catalog" ? group || "formlq" : group,
      pluralize(t.questions.length, PLURAL.question),
      tab === "mine" && t.published ? "у каталозі" : "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Modal onClose={onClose} className="lib-modal" style={{ width: "min(620px,100%)" }}>
      <h2>Тест із готових</h2>
      <p className="sub" style={{ margin: "4px 0 12px" }}>
        Тест зʼявиться окремим аркушем — учні побачать його після «Запустити тест».
      </p>
      <div className="lib-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => switchTab("mine")}>
          {editor ? "Тести платформи" : "Мої тести"}
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
        {active.isLoading ? (
          <p className="sub">Завантаження…</p>
        ) : active.isError ? (
          <p className="err">Не вдалося завантажити тести</p>
        ) : list.length === 0 ? (
          <p className="sub">
            {q
              ? "Нічого не знайдено"
              : tab === "mine"
                ? "У вас ще немає тестів із питаннями. Створіть тест у «Мої тести»."
                : "У каталозі поки немає інших тестів"}
          </p>
        ) : (
          list.map((r) => (
            <button
              key={r.t.id}
              type="button"
              className={"lib-item" + (r.t.id === picked ? " on" : "")}
              onClick={() => setPicked(r.t.id)}
              onDoubleClick={() => put(r.t)}
            >
              <b>{r.t.title || "Без назви"}</b>
              {r.t.subtitle && <span className="lib-desc">{r.t.subtitle}</span>}
              <span>{meta(r)}</span>
            </button>
          ))
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
