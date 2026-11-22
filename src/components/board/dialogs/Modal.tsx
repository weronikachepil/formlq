"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"]), math-field';

/**
 * mathboard modal shell: dimmed backdrop + glass card. Esc or a tap that starts and ends on the
 * backdrop closes it (a text selection dragged out of a field does not); Tab stays inside;
 * focus returns to where it was; the card's <h2> names the dialog for screen readers.
 * Board shortcuts are ignored while a dialog is open (engine onKey checks `.modal-back`).
 */
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
  const card = useRef<HTMLDivElement>(null);
  const downOnBack = useRef(false);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const titleId = useId();

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const back = el.parentElement;
    const prev = document.activeElement as HTMLElement | null;
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>("[autofocus]") || el).focus();
    const h2 = el.querySelector("h2");
    if (h2 && !h2.id) h2.id = titleId;
    if (h2) el.setAttribute("aria-labelledby", h2.id);
    const onKey = (e: KeyboardEvent) => {
      // Only the topmost dialog reacts (a picker may open on top of another dialog).
      const all = document.querySelectorAll(".modal-back");
      if (all[all.length - 1] !== back) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      } else if (e.key === "Tab") {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prev?.isConnected) prev.focus();
    };
  }, [titleId]);

  return (
    <div
      className="modal-back"
      onPointerDown={(e) => {
        downOnBack.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBack.current && e.target === e.currentTarget) onClose();
        downOnBack.current = false;
      }}
    >
      <div
        ref={card}
        className={"card modal" + (className ? " " + className : "")}
        style={style}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
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
  const cancel = useRef<HTMLButtonElement>(null);
  // A destructive action is never the default: a stray Enter must not confirm it.
  useEffect(() => (danger ? cancel : ok).current?.focus(), [danger]);
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
        <button ref={cancel} className="ghost" onClick={onClose}>
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
