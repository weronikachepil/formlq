"use client";

import { useEffect, useRef, useState } from "react";
import type { CommentState } from "./types";
import { useBoard } from "./useBoard";

/** Thread popover next to an open comment pin. */
export function CommentPanel({ c }: { c: CommentState }) {
  const { st, b } = useBoard();
  const o = c.obj;
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [o.id]);
  const send = () => {
    if (!text.trim()) return;
    b()?.commentReply(o.id, text);
    setText("");
  };
  const left = Math.min(Math.max(8, c.sx + 18), window.innerWidth - 340);
  const top = Math.max(8, c.sy - 30);
  return (
    <div className="bd-comment" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="bd-line" style={{ justifyContent: "space-between" }}>
        <b style={{ fontSize: 14 }}>{o.vis === "teacher" ? "Нотатка (бачите лише ви)" : "Коментар"}</b>
        <span className="bd-line">
          {st.isOwner && (
            <button
              className={"bd-chip-btn" + (o.vis === "teacher" ? " on" : "")}
              onClick={() => b()?.commentPatch(o.id, { vis: o.vis === "teacher" ? "all" : "teacher" })}
              title="Приватна нотатка для вчителя"
            >
              Лише я
            </button>
          )}
          <button
            className={"bd-chip-btn" + (o.resolved ? " on" : "")}
            onClick={() => b()?.commentPatch(o.id, { resolved: !o.resolved })}
          >
            {o.resolved ? "Вирішено" : "Вирішити"}
          </button>
          <button className="bd-ibtn" title="Закрити" onClick={() => b()?.closeComment()}>
            ×
          </button>
        </span>
      </div>
      <div className="bd-thread">
        {(o.thread || []).length === 0 && st.canEdit && <p className="bd-hint">Напишіть перше повідомлення.</p>}
        {(o.thread || []).map((m, i) => (
          <div key={i} className="bd-msg">
            <b>{m.name}</b> <small>{new Date(m.t).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</small>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
      {st.canEdit ? (
        <>
          <textarea
            ref={ref}
            className="bd-input"
            style={{ minHeight: 54 }}
            placeholder="Повідомлення… (Enter — надіслати)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
              if (e.key === "Escape") b()?.closeComment();
            }}
          />
          <div className="bd-line" style={{ justifyContent: "space-between" }}>
            <button className="bd-chip-btn on" onClick={send}>
              Надіслати
            </button>
            {c.canModify && (
              <button className="bd-chip-btn" onClick={() => b()?.commentDelete(o.id)}>
                Видалити
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="bd-hint">Дошку закрито: коментарі можна лише читати.</p>
      )}
    </div>
  );
}
