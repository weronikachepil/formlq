"use client";

import { uaNum } from "./constants";
import { useBoard } from "./useBoard";

/** Centre banners: engine notice, viewing a student's answers, quiz progress / result, errors. */
export function StatusBanners({ notice }: { notice: string }) {
  const { st, b } = useBoard();
  const cur = st.pages.find((p) => p.id === st.page);
  return (
    <>
      <div className="bd-live" role="status" aria-live="polite">
        {notice && <div className="bd-notice">{notice}</div>}
      </div>
      {st.viewing && (
        <div className="bd-viewing">
          <span>
            Відповіді учня: <b>{st.viewing.name}</b> · {st.viewing.answered} з {st.viewing.total} питань ·{" "}
            <b>{uaNum(st.viewing.earned)}</b> з {uaNum(st.viewing.max)} б.{st.viewing.submitted ? " · здано ✓" : ""}
          </span>
          <button className="bd-chip-btn" onClick={() => b()?.setViewStudent(null)}>
            Вийти з перегляду
          </button>
        </div>
      )}
      {st.quiz && !st.isOwner && (
        <div className="bd-progress" title="Скільки питань тесту ви вже відповіли">
          <span>
            {st.quiz.submitted
              ? "Роботу здано"
              : st.quiz.closed
                ? "Тест завершено"
                : `Відповіли: ${st.quiz.answered} з ${st.quiz.total}`}
          </span>
          <i>
            <b style={{ width: `${Math.round((st.quiz.answered / (st.quiz.total || 1)) * 100)}%` }} />
          </i>
        </div>
      )}
      {!st.isOwner && !st.score && cur?.closed && (
        <div className="bd-score closed" role="status">
          Тест завершено вчителем
        </div>
      )}
      {st.score && !st.isOwner && (
        <div className="bd-score" role="status">
          Ваш результат: <b>{uaNum(st.score.earned)}</b> з {uaNum(st.score.max)} (
          {Math.round((st.score.earned / (st.score.max || 1)) * 100)}%)
        </div>
      )}
      {st.mathError && (
        <div className="bd-error" role="alert">
          Редактор формул не завантажився. Оновіть сторінку. <small>({st.mathError})</small>
        </div>
      )}
    </>
  );
}
