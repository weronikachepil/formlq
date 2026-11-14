"use client";

import { useMemo, useRef, useState } from "react";
import { fileToImage } from "@/lib/board/engine/images";
import { TYPE_NAMES, parseTest } from "@/lib/board/engine/quizparse";
import { QUIZ_PROMPT } from "@/lib/board/engine/quizprompt";
import type { QuizQuestionType } from "@/lib/board/engine/types";
import { useBoard } from "../useBoard";
import { Modal } from "./Modal";

const QT: QuizQuestionType[] = ["choice", "match", "short"];
/** File name without folders, lower-cased: how image references are matched to picked files. */
const base = (n: string) => (n.split(/[\\/]/).pop() || "").trim().toLowerCase();

/** Create a test sheet from the AI-generated plain-text format. */
export function TestImportDialog({ onClose }: { onClose: () => void }) {
  const { b } = useBoard();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Тест");
  const [files, setFiles] = useState<File[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const parsed = useMemo(() => (text.trim() ? parseTest(text) : null), [text]);
  const fileMap = useMemo(() => new Map(files.map((f) => [base(f.name), f])), [files]);
  const missing = parsed ? parsed.images.filter((n) => !fileMap.has(base(n))) : [];
  const ready = !!parsed && parsed.questions.length > 0 && parsed.errors.length === 0 && !busy;

  async function create() {
    if (!parsed) return;
    setBusy(true);
    const images = new Map<string, string>();
    for (const name of parsed.images) {
      const f = fileMap.get(base(name));
      if (!f) continue;
      try {
        images.set(name, (await fileToImage(f, 1200)).src);
      } catch {
        // skip images that fail to load: the card is created without them
      }
    }
    b()?.importTest({ title, questions: parsed.questions, images });
    onClose();
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(QUIZ_PROMPT);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable: the prompt can still be shown and copied by hand
    }
  }

  return (
    <Modal onClose={onClose} style={{ width: "min(760px,100%)" }}>
      <h2>Імпорт тесту</h2>
      <div className="step">
        <span className="step-n">1</span>
        <div>
          <b>Згенеруйте файл за допомогою ШІ</b>
          <p className="sub" style={{ margin: "4px 0 10px" }}>
            Скопіюйте промпт, вставте в ChatGPT, Claude чи Gemini і додайте тест — текстом, PDF або фото.
          </p>
          <div className="row">
            <button onClick={copyPrompt}>{copied ? "Скопійовано ✓" : "Скопіювати промпт"}</button>
            <button className="ghost" onClick={() => setShowPrompt(!showPrompt)}>
              {showPrompt ? "Сховати промпт" : "Показати промпт"}
            </button>
          </div>
          {showPrompt && <pre className="prompt-box">{QUIZ_PROMPT}</pre>}
        </div>
      </div>
      <div className="step">
        <span className="step-n">2</span>
        <div style={{ flex: 1 }}>
          <b>Вставте відповідь ШІ</b>
          <textarea
            className="prompt-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"### 1 | Вибір відповіді | 1\nТЕКСТ: …"}
            spellCheck={false}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              Завантажити .txt
              <input
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setText(await f.text());
                }}
              />
            </label>
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              Малюнки (папка images)
              <input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...(e.target.files || [])])} />
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Назва аркуша"
              style={{ flex: 1, minWidth: 140 }}
            />
          </div>
        </div>
      </div>
      {parsed && (
        <div className="parse-box">
          <b>Знайдено питань: {parsed.questions.length}</b> (
          {QT.map((t) => `${TYPE_NAMES[t]}: ${parsed.questions.filter((q) => q.qt === t).length}`).join(", ")})
          {parsed.errors.map((e, i) => (
            <p key={"e" + i} className="err">
              ✗ {e}
            </p>
          ))}
          {parsed.warnings.map((e, i) => (
            <p key={"w" + i} className="warn">
              ! {e}
            </p>
          ))}
          {parsed.images.length > 0 && (
            <p className={missing.length ? "warn" : "toast"}>
              Малюнки: {parsed.images.length - missing.length} з {parsed.images.length}
              {missing.length > 0 && <> · не вибрано: {missing.join(", ")} (картку буде створено без них)</>}
            </p>
          )}
        </div>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        <button disabled={!ready} onClick={create}>
          {busy ? "Створюю…" : "Створити тест"}
        </button>
        <button className="ghost" onClick={onClose}>
          Скасувати
        </button>
      </div>
    </Modal>
  );
}
