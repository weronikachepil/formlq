"use client";

// Small board dialogs: hand out a sheet, chart / tree data, PDF pages, exercise generator.
import { useState } from "react";
import type { ExerciseKind, ExerciseOptions } from "@/lib/board/engine/exercises";
import { parsePageRange } from "@/lib/board/engine/images";
import { CHART_EXAMPLES, EX_KINDS, type SourceKind } from "../constants";
import type { PdfAskState } from "../types";
import { useBoard } from "../useBoard";
import { Modal } from "./Modal";

/** Copy the current sheet to the chosen students' personal sheets. */
export function AssignDialog({ onClose }: { onClose: () => void }) {
  const { st, b } = useBoard();
  const students = st.peers.filter((p) => !p.owner && p.uid);
  const [picked, setPicked] = useState(() => new Set(students.map((p) => p.uid)));
  const toggle = (u: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(u)) n.delete(u);
      else n.add(u);
      return n;
    });
  const cur = st.pages.find((p) => p.id === st.page);
  return (
    <Modal onClose={onClose} style={{ width: "min(520px,100%)" }}>
      <h2>Роздати аркуш учням</h2>
      <p className="sub">
        Аркуш «{cur?.name}» буде скопійований кожному вибраному учню в особистий аркуш. Учень пише на своєму аркуші; інші учні
        його не бачать. Умова (ваші об&apos;єкти) змінювати вони не зможуть.
      </p>
      {students.length === 0 && <p className="empty">Зараз на дошці немає учнів. Попросіть їх зайти за посиланням.</p>}
      {students.map((p) => (
        <label key={p.uid} className="board-item" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={picked.has(p.uid)} onChange={() => toggle(p.uid)} />
          <span className="title">{p.name}</span>
        </label>
      ))}
      <div className="row" style={{ marginTop: 14 }}>
        <button
          disabled={!picked.size}
          onClick={() => {
            b()?.assignTask(students.filter((p) => picked.has(p.uid)).map((p) => ({ uid: p.uid, name: p.name })));
            onClose();
          }}
        >
          Роздати ({picked.size})
        </button>
        <button className="ghost" onClick={onClose}>
          Скасувати
        </button>
      </div>
    </Modal>
  );
}

/** Data text of a chart or a probability tree. */
export function SourceDialog({
  kind,
  value,
  onClose,
  onDone,
}: {
  kind: SourceKind;
  value?: string;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [title, hint, example] = CHART_EXAMPLES[kind] || CHART_EXAMPLES.bar;
  const [txt, setTxt] = useState(value ?? example);
  return (
    <Modal onClose={onClose} className="nl-modal">
      <h2>{title}</h2>
      <textarea
        className="bd-input area"
        style={{ minHeight: 180, fontSize: 16 }}
        value={txt}
        spellCheck={false}
        autoFocus
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => setTxt(e.target.value)}
      />
      <p className="bd-hint">{hint}</p>
      <div className="nl-foot">
        <button className="bd-chip-btn" onClick={onClose}>
          Скасувати
        </button>
        <button disabled={!txt.trim()} onClick={() => onDone(txt)}>
          Готово
        </button>
      </div>
    </Modal>
  );
}

/** Which PDF pages to insert. */
export function PdfDialog({
  ask,
  onClose,
  onDone,
}: {
  ask: PdfAskState;
  onClose: () => void;
  onDone: (pages: number[]) => void;
}) {
  const first = Math.min(ask.start, ask.total);
  const [txt, setTxt] = useState(`${first}-${Math.min(ask.total, first + 4)}`);
  const pages = parsePageRange(txt, ask.total);
  const ok = !!pages && pages.length > 0 && pages.length <= 30;
  return (
    <Modal onClose={onClose} className="nl-modal">
      <h2>{ask.more ? "Додати ще сторінки PDF" : "Вставити сторінки PDF"}</h2>
      <p className="bd-hint">
        «{ask.name}» — сторінок: {ask.total}
      </p>
      <span className="bd-lbl">Які сторінки (напр. 1-3, 5, 8-10)</span>
      <div className="bd-line wrap">
        <input
          className="bd-input"
          style={{ width: 200 }}
          value={txt}
          autoFocus
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && ok && pages) onDone(pages);
          }}
          onChange={(e) => setTxt(e.target.value)}
        />
        <button className="bd-chip-btn" onClick={() => setTxt(`1-${ask.total}`)}>
          Усі
        </button>
      </div>
      <p className="bd-hint">
        {pages === null
          ? "Запишіть сторінки так: 1-3, 5"
          : pages.length === 0
            ? "Таких сторінок у файлі немає"
            : pages.length > 30
              ? "За раз можна вставити не більше 30 сторінок"
              : `Буде вставлено сторінок: ${pages.length}`}
      </p>
      <div className="nl-foot">
        <button className="bd-chip-btn" onClick={onClose}>
          Скасувати
        </button>
        <button disabled={!ok} onClick={() => pages && onDone(pages)}>
          Вставити
        </button>
      </div>
    </Modal>
  );
}

const COLUMN_KINDS: ExerciseKind[] = ["+", "−", "×", "÷"];

/** Random exercises for the class. */
export function ExerciseDialog({ onClose, onDone }: { onClose: () => void; onDone: (opts: ExerciseOptions) => void }) {
  const [kind, setKind] = useState<ExerciseKind>("+");
  const [digits, setDigits] = useState(3);
  const [count, setCount] = useState(6);
  const col = COLUMN_KINDS.includes(kind);
  return (
    <Modal onClose={onClose} className="nl-modal">
      <h2>Генератор вправ</h2>
      <span className="bd-lbl">Тип</span>
      <div className="bd-line wrap">
        {EX_KINDS.map(([k, nm]) => (
          <button key={k} className={"bd-chip-btn" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>
            {nm}
          </button>
        ))}
      </div>
      {col && (
        <>
          <span className="bd-lbl">Розрядність чисел</span>
          <div className="bd-line wrap">
            {[2, 3, 4].map((d) => (
              <button key={d} className={"bd-chip-btn" + (digits === d ? " on" : "")} onClick={() => setDigits(d)}>
                {d}-цифрові
              </button>
            ))}
          </div>
        </>
      )}
      <span className="bd-lbl">Кількість прикладів</span>
      <div className="bd-line wrap">
        {[3, 6, 9, 12].map((n) => (
          <button key={n} className={"bd-chip-btn" + (count === n ? " on" : "")} onClick={() => setCount(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="bd-hint">Приклади з&apos;являться на дошці випадковими. Створіть ще раз — буде новий набір.</p>
      <div className="nl-foot">
        <button className="bd-chip-btn" onClick={onClose}>
          Скасувати
        </button>
        <button onClick={() => onDone({ kind, digits, count })}>Створити</button>
      </div>
    </Modal>
  );
}
