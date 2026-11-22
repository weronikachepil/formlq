"use client";

import { useState } from "react";
import type { PageSummary } from "@/lib/board/engine/types";
import { ConfirmModal, PromptModal } from "./dialogs/Modal";
import { Icon } from "./icons";
import { useBoard } from "./useBoard";

type Ask = { kind: "rename"; page: PageSummary } | { kind: "delete" } | { kind: "submit"; answered: number; total: number };

/** Bottom-centre page tabs, "new page", "delete page" and the student's "submit work". */
export function PagesBar() {
  const { st, b } = useBoard();
  const [ask, setAsk] = useState<Ask | null>(null);
  const cur = st.pages.find((p) => p.id === st.page);
  const done = st.donePages.includes(st.page);
  const canSubmit = !st.isOwner && (cur?.for === st.uid || cur?.test);

  return (
    <>
      <div className="bd-pages">
        {st.pages.map((p) => (
          <button
            key={p.id}
            className={"bd-page" + (p.id === st.page ? " on" : "")}
            disabled={st.follow && !st.isOwner}
            aria-current={p.id === st.page ? "page" : undefined}
            title={
              st.follow && !st.isOwner
                ? "Ви слідкуєте за вчителем — вимкніть це вгорі, щоб гортати самостійно"
                : st.isOwner
                  ? p.id === st.page
                    ? "Натисніть ще раз, щоб перейменувати"
                    : p.name
                  : p.name
            }
            onClick={() => {
              // Tapping the current tab renames it: double-click is unreliable on touch screens.
              if (st.isOwner && p.id === st.page) setAsk({ kind: "rename", page: p });
              else b()?.setPage(p.id);
            }}
          >
            {st.donePages.includes(p.id) ? "✓ " : ""}
            {p.name}
          </button>
        ))}
        {st.isOwner && (
          <button className="bd-ibtn" title="Новий аркуш" aria-label="Новий аркуш" onClick={() => b()?.addPage()}>
            <Icon name="plus" size={18} />
          </button>
        )}
        {canSubmit && (
          <button
            className={"bd-chip-btn" + (done ? " on" : "")}
            disabled={done && !!cur?.test}
            onClick={() => {
              if (!done && st.quiz && st.quiz.answered < st.quiz.total) {
                setAsk({ kind: "submit", answered: st.quiz.answered, total: st.quiz.total });
                return;
              }
              b()?.submitPage();
            }}
          >
            {done ? (cur?.test ? "Здано ✓" : "Здано ✓ (скасувати)") : "Здати роботу"}
          </button>
        )}
        {st.isOwner && st.page !== "p1" && (
          <button className="bd-ibtn danger" title="Видалити аркуш" aria-label="Видалити аркуш" onClick={() => setAsk({ kind: "delete" })}>
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>

      {ask?.kind === "rename" && (
        <PromptModal
          title="Назва аркуша"
          initial={ask.page.name || ""}
          maxLength={40}
          onSubmit={(n) => b()?.renamePage(ask.page.id, n)}
          onClose={() => setAsk(null)}
        />
      )}
      {ask?.kind === "delete" && (
        <ConfirmModal
          text="Видалити цей аркуш разом із усім, що на ньому?"
          confirmLabel="Видалити"
          danger
          onConfirm={() => b()?.deletePage(st.page)}
          onClose={() => setAsk(null)}
        />
      )}
      {ask?.kind === "submit" && (
        <ConfirmModal
          text={`Ви відповіли на ${ask.answered} з ${ask.total} питань. Здати роботу?`}
          confirmLabel="Здати роботу"
          onConfirm={() => b()?.submitPage()}
          onClose={() => setAsk(null)}
        />
      )}
    </>
  );
}
