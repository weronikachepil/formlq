"use client";

import { STAMPS } from "@/lib/board/engine/classroom";
import { TYPE_NAMES } from "@/lib/board/engine/quizparse";
import type { PollObject, QuizObject, StampKind, TaskObject, TimerObject } from "@/lib/board/engine/types";
import { useBoard, useSelection } from "../useBoard";

/** Poll: question, options, close / hide results / reset votes. */
export function PollProps({ o }: { o: PollObject }) {
  const { b } = useBoard();
  const act = useSelection();
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Питання</span>
      <textarea
        className="bd-input area"
        style={{ minHeight: 56 }}
        key={o.id + "q"}
        defaultValue={o.q}
        onChange={(e) => act.live<PollObject>({ q: e.target.value }, 600)}
        onBlur={() => act.end()}
      />
      <span className="bd-lbl">Варіанти (кожен з нового рядка, до 6)</span>
      <textarea
        className="bd-input area"
        key={o.id + "o"}
        defaultValue={(o.opts || []).join("\n")}
        onChange={(e) =>
          act.live<PollObject>(
            {
              opts: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 6),
            },
            600,
          )
        }
        onBlur={() => act.end()}
      />
      <div className="bd-line wrap">
        <button className={"bd-chip-btn" + (o.closed ? " on" : "")} onClick={() => act.set<PollObject>({ closed: !o.closed })}>
          {o.closed ? "Відкрити" : "Закрити"}
        </button>
        <button className={"bd-chip-btn" + (o.hide ? " on" : "")} onClick={() => act.set<PollObject>({ hide: !o.hide })}>
          Приховати результати від учнів
        </button>
        <button className="bd-chip-btn" onClick={() => b()?.pollReset(o.id)}>
          Скинути голоси
        </button>
      </div>
    </div>
  );
}

const minutesText = (ms: number) => String(+(ms / 60000).toFixed(2)).replace(".", ",");

/** Shared timer: start / pause / reset, duration, title. */
export function TimerProps({ o }: { o: TimerObject }) {
  const { b } = useBoard();
  const act = useSelection();
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Таймер</span>
      <div className="bd-line wrap">
        <button className="bd-chip-btn" onClick={() => (o.running ? b()?.timerPause(o.id) : b()?.timerStart(o.id))}>
          {o.running ? "⏸ Пауза" : "▶ Старт"}
        </button>
        <button className="bd-chip-btn" onClick={() => b()?.timerReset(o.id)}>
          ⟲ Спочатку
        </button>
      </div>
      <div className="bd-line wrap">
        <span className="bd-lbl">Тривалість</span>
        <input
          className="bd-input"
          style={{ width: 64, textAlign: "center", fontFamily: "inherit" }}
          inputMode="decimal"
          key={o.id + ":" + o.dur}
          defaultValue={minutesText(o.dur)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const m = parseFloat(e.target.value.replace(",", "."));
            if (Number.isFinite(m) && m > 0 && m <= 600) b()?.timerReset(o.id, Math.round(m * 60000));
            else e.target.value = minutesText(o.dur);
          }}
        />
        <span className="bd-lbl">хв</span>
      </div>
      <input
        className="bd-input"
        key={o.id}
        placeholder="Назва (необовʼязково)"
        defaultValue={o.title || ""}
        onChange={(e) => act.live<TimerObject>({ title: e.target.value }, 600)}
        onBlur={() => act.end()}
      />
      <p className="bd-hint">Таймер спільний: усі бачать однаковий час. Коли час вийде, у всіх пролунає сигнал.</p>
    </div>
  );
}

/** Task card: title, text, points badge. */
export function TaskProps({ o }: { o: TaskObject }) {
  const act = useSelection();
  const live = (patch: Partial<TaskObject>) => act.live<TaskObject>(patch, 600);
  return (
    <div className="bd-sec">
      <span className="bd-lbl">Завдання</span>
      <input
        className="bd-input"
        key={o.id + "t"}
        defaultValue={o.title}
        onChange={(e) => live({ title: e.target.value })}
        onBlur={() => act.end()}
      />
      <textarea
        className="bd-input area"
        key={o.id + "x"}
        defaultValue={o.text}
        onChange={(e) => live({ text: e.target.value })}
        onBlur={() => act.end()}
      />
      <input
        className="bd-input"
        key={o.id + "p"}
        placeholder="Бали, напр. «5 балів»"
        defaultValue={o.pts || ""}
        onChange={(e) => live({ pts: e.target.value })}
        onBlur={() => act.end()}
      />
    </div>
  );
}

const STAMP_KINDS = Object.keys(STAMPS) as StampKind[];

/** Grading stamp tool: kind and caption for the next stamp. */
export function StampPanel() {
  const { st, b } = useBoard();
  return (
    <div className="bd-insp">
      <div className="bd-sec">
        <span className="bd-lbl">Оцінка: клікніть по дошці</span>
        <div className="bd-line wrap">
          {STAMP_KINDS.map((k) => {
            const v = STAMPS[k];
            const on = st.stampKind === k;
            return (
              <button
                key={k}
                className={"bd-chip-btn" + (on ? " on" : "")}
                style={on ? { background: v.color } : undefined}
                onClick={() => b()?.setStamp(k)}
              >
                {v.glyph} {v.name}
              </button>
            );
          })}
        </div>
        <input
          className="bd-input"
          placeholder="Підпис біля оцінки, напр. 5/5 (необовʼязково)"
          value={st.stampText}
          onChange={(e) => b()?.setStamp(undefined, e.target.value)}
        />
      </div>
    </div>
  );
}

/** Test question card: show the key to the teacher, reveal answers to students. */
export function QuizProps({ o }: { o: QuizObject }) {
  const { st, b } = useBoard();
  return (
    <div className="bd-sec">
      <span className="bd-lbl">
        Питання {o.n} · {TYPE_NAMES[o.qt]} · {o.pts} б.
      </span>
      <div className="bd-line wrap">
        <button className={"bd-chip-btn" + (st.showKeys ? " on" : "")} onClick={() => b()?.setShowKeys(!st.showKeys)}>
          {st.showKeys ? "Ключ показано (лише вам)" : "Показати ключ мені"}
        </button>
        <button className={"bd-chip-btn" + (o.reveal ? " on" : "")} onClick={() => b()?.revealTest(o.pg || "p1", !o.reveal)}>
          {o.reveal ? "Сховати відповіді від учнів" : "Показати відповіді учням"}
        </button>
      </div>
      <p className="bd-hint">
        Відкрити правильні відповіді й пояснення можна для всього тесту одразу. Результати — в меню «Урок».
      </p>
    </div>
  );
}
