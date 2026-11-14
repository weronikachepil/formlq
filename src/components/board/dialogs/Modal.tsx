"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** mathboard modal shell: dimmed backdrop (click closes) + glass card. */
export function Modal({
  onClose,
  className,
  style,
  children,
}: {
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className={"card modal" + (className ? " " + className : "")}
        style={style}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Replacement for window.confirm in the mathboard look. */
export function ConfirmModal({
  text,
  confirmLabel = "Так",
  danger,
  onConfirm,
  onClose,
}: {
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => ok.current?.focus(), []);
  return (
    <Modal onClose={onClose} className="mb-ask">
      <p className="sub">{text}</p>
      <div className="row">
        <button
          ref={ok}
          className={danger ? "stop" : undefined}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
        <button className="ghost" onClick={onClose}>
          Скасувати
        </button>
      </div>
    </Modal>
  );
}

/** Replacement for window.prompt in the mathboard look. */
export function PromptModal({
  title,
  initial,
  maxLength,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  maxLength?: number;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Modal onClose={onClose} className="mb-ask">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value);
          onClose();
        }}
      >
        <h2>{title}</h2>
        <div className="row grow">
          <input
            type="text"
            value={value}
            maxLength={maxLength}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit" disabled={!value.trim()}>
            Зберегти
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Скасувати
          </button>
        </div>
      </form>
    </Modal>
  );
}
