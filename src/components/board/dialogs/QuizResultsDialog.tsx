"use client";

import { useState } from "react";
import type { QuizResultCell, QuizResults } from "@/lib/board/engine/board";
import type { QuizAnswerValue } from "@/lib/board/engine/types";
import { plural } from "@/lib/format";
import { uaNum } from "../constants";
import { useBoard } from "../useBoard";
import { ConfirmModal, Modal } from "./Modal";

type Question = QuizResults["quizzes"][number];

const keyText = (q: Question) =>
  q.qt === "choice"
    ? q.key?.correct
    : q.qt === "short"
      ? q.key?.answer
      : Object.entries(q.key?.pairs || {})
          .map(([n, l]) => `${n}${l}`)
          .join(" ");

const ansText = (q: Question, val: QuizAnswerValue | undefined) =>
  q.qt === "match" && val && typeof val === "object"
    ? Object.entries(val)
        .sort((x, y) => Number(x[0]) - Number(y[0]))
        .map(([n, l]) => `${n}${l}`)
        .join(" ")
    : String(val ?? "");

/** Correctness mark next to the answer: colour alone is not enough (colour-blind, print). */
const cellMark = (g: QuizResultCell | undefined) =>
  !g || g.state === "empty" ? "" : g.state === "full" ? " ✓" : g.state === "part" ? " ½" : " ✗";

const cellClass = (g: QuizResultCell | undefined) =>
  !g ? "q-none" : g.state === "full" ? "q-full" : g.state === "part" ? "q-part" : g.state === "empty" ? "q-none" : "q-bad";

function downloadCsv(res: QuizResults) {
  const rows = [["Учень", ...res.quizzes.map((q) => `№${q.n} (${q.pts})`), `Разом (з ${res.max})`, "Здано"]];
  for (const r of res.rows) {
    rows.push([
      r.name || "",
      ...res.quizzes.map((q) => uaNum(r.per[q.id]?.earned ?? "")),
      uaNum(r.total),
      r.submitted ? "так" : "ні",
    ]);
  }
  const text = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = "rezultaty-testu.csv";
  a.click();
}

type Ask = "end" | "reset" | null;

/** Teacher's test control: start / end / reveal, live results table, CSV. */
export function QuizResultsDialog({ onClose }: { onClose: () => void }) {
  const { st, b } = useBoard();
  const [mode, setMode] = useState<"answers" | "points">("answers");
  const [mins, setMins] = useState("");
  const [separate, setSeparate] = useState(true);
  const [ask, setAsk] = useState<Ask>(null);
  const bd = b();
  if (!bd) return null;
  const pageInfo = st.pages.find((p) => p.id === st.page);
  // recomputed on every state update, so the table is live
  const res = bd.quizResults(st.page);
  const firstQuiz = res.quizzes[0] ? bd.store.get(res.quizzes[0].id) : undefined;
  const revealed = firstQuiz?.type === "quiz" && !!firstQuiz.reveal;
  const submitted = res.rows.filter((r) => r.submitted).length;
  const endsText =
    res.endsAt && !res.closed ? new Date(res.endsAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : null;

  // confirms are siblings: the glass card (backdrop-filter) would trap a nested fixed backdrop
  return (
    <>
      <Modal onClose={onClose} style={{ width: "min(980px,100%)" }}>
        <div className="modal-head">
          <h2>Результати тесту</h2>
          <button className="ghost" onClick={onClose}>
            Закрити
          </button>
        </div>
        <div className="test-status">
          <span className={"status-pill " + (res.draft ? "draft" : res.closed ? "closed" : "live")}>
            {res.draft ? "Не запущено (учні не бачать)" : res.closed ? "Тест завершено" : "Тест іде"}
          </span>
          <span>
            Здали: <b>{submitted}</b> з <b>{res.rows.length}</b> {plural(res.rows.length, ["учня", "учнів", "учнів"])}, що
            відповідали
          </span>
          {endsText && (
            <span>
              Автозавершення о <b>{endsText}</b>
            </span>
          )}
        </div>

        <div className="tb-groups">
          <div className="tb-group">
            <span className="tb-label">1. Запуск</span>
            <div className="tb-row">
              <input
                type="number"
                min="0"
                max="240"
                placeholder="хв"
                value={mins}
                onChange={(e) => setMins(e.target.value)}
                className="mins"
                title="Ліміт часу в хвилинах (необовʼязково)"
              />
              <span className="tb-note">ліміт, хв (можна порожнім)</span>
            </div>
            <label className="tb-check">
              <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} /> Кожному учню окремий
              листок
              <small>учні не бачать роботи один одного</small>
            </label>
            <button
              disabled={!res.draft}
              title={res.draft ? undefined : "Тест уже запущено"}
              onClick={() => bd.startTest(res.templateId || st.page, Number(mins) || 0, separate)}
            >
              ▶ Запустити тест
            </button>
          </div>
          <div className="tb-group">
            <span className="tb-label">2. Завершення</span>
            <button
              className={pageInfo?.closed ? "" : "stop"}
              disabled={res.draft}
              title={res.draft ? "Спершу запустіть тест" : undefined}
              onClick={() => {
                if (pageInfo?.closed) bd.endTest(st.page, false);
                else setAsk("end");
              }}
            >
              {pageInfo?.closed ? "↺ Відновити тест" : "■ Завершити тест"}
            </button>
            <span className="tb-note">Якщо задано ліміт, сервер завершить тест сам.</span>
          </div>
          <div className="tb-group">
            <span className="tb-label">3. Відповіді</span>
            <button className={revealed ? "ghost" : ""} onClick={() => bd.revealTest(st.page, !revealed)}>
              {revealed ? "Сховати відповіді від учнів" : "Показати відповіді учням"}
            </button>
            <button className="ghost" onClick={() => bd.setShowKeys(!st.showKeys)}>
              {st.showKeys ? "Сховати ключ" : "Показати ключ"}
            </button>
          </div>
          <div className="tb-group">
            <span className="tb-label">Дані</span>
            <button className="ghost" onClick={() => downloadCsv(res)} disabled={!res.rows.length}>
              Завантажити CSV
            </button>
            <button className="ghost" onClick={() => setAsk("reset")}>
              Скинути відповіді
            </button>
          </div>
        </div>

        <div className="row" style={{ margin: "14px 0 10px" }}>
          <button className={"bd-chip-btn" + (mode === "answers" ? " on" : "")} onClick={() => setMode("answers")}>
            Що обрали
          </button>
          <button className={"bd-chip-btn" + (mode === "points" ? " on" : "")} onClick={() => setMode("points")}>
            Бали
          </button>
          <span className="bd-lbl">Таблиця оновлюється наживо. Клік по імені — перейти до учня.</span>
        </div>
        {res.rows.length === 0 ? (
          <p className="empty">Відповідей ще немає.</p>
        ) : (
          <div style={{ overflow: "auto", maxHeight: "44vh" }}>
            <table className="res-table">
              <thead>
                <tr>
                  <th>Учень</th>
                  <th>Відповіли</th>
                  {res.quizzes.map((q) => (
                    <th key={q.id} title={`${q.pts} б.`}>
                      {q.n}
                    </th>
                  ))}
                  <th>Разом / {uaNum(res.max)}</th>
                </tr>
              </thead>
              <tbody>
                {mode === "answers" && (
                  <tr className="res-key">
                    <td>Правильна</td>
                    <td />
                    {res.quizzes.map((q) => (
                      <td key={q.id}>{keyText(q)}</td>
                    ))}
                    <td />
                  </tr>
                )}
                {res.rows.map((r) => (
                  <tr key={r.uid}>
                    <td>
                      <a
                        href="#"
                        title="Перейти до цього учня"
                        onClick={(e) => {
                          e.preventDefault();
                          bd.goToStudent(r.uid);
                          onClose();
                        }}
                      >
                        {r.name}
                      </a>
                      {r.submitted ? " ✓" : ""}
                    </td>
                    <td>
                      {r.answered || 0}/{res.quizzes.length}
                    </td>
                    {res.quizzes.map((q) => {
                      const g = r.per[q.id];
                      return (
                        <td key={q.id} className={cellClass(g)} title={g ? `${g.earned} з ${g.max}` : "не відповів"}>
                          {!g ? "·" : mode === "points" ? uaNum(g.earned ?? "") : ansText(q, g.val) + cellMark(g)}
                        </td>
                      );
                    })}
                    <td>
                      <b>{uaNum(r.total)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="bd-hint">
          ✓ біля імені — учень здав тест. У клітинках: ✓ правильно, ½ частково, ✗ неправильно. Учні бачать правильні відповіді лише після «Показати відповіді учням», а свій
          підсумковий бал — одразу після здачі.
        </p>
      </Modal>
      {ask === "end" && (
        <ConfirmModal
          text="Завершити тест? Учні більше не зможуть відповідати, а хто ще не здав — здасться автоматично з підрахованим балом."
          confirmLabel="Завершити тест"
          danger
          onConfirm={() => bd.endTest(st.page, true)}
          onClose={() => setAsk(null)}
        />
      )}
      {ask === "reset" && (
        <ConfirmModal
          text="Видалити всі відповіді та відмітки «здано» на цьому аркуші?"
          confirmLabel="Скинути відповіді"
          danger
          onConfirm={() => bd.resetAnswers(st.page)}
          onClose={() => setAsk(null)}
        />
      )}
    </>
  );
}
