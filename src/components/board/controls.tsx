"use client";

// Small mathboard buttons shared by the toolbar, menus and inspector.
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";

export function MenuItem({
  icon,
  title,
  desc,
  active,
  tip,
  onClick,
}: {
  icon: string | ReactNode;
  title: string;
  desc?: string;
  active?: boolean;
  tip?: string;
  onClick: () => void;
}) {
  return (
    <button className={"bd-item" + (active ? " on" : "")} title={tip} onClick={onClick}>
      <span className="bd-item-ic">{typeof icon === "string" ? <Icon name={icon} size={20} /> : icon}</span>
      <span className="bd-item-tx">
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </span>
    </button>
  );
}

export function ToolBtn({ name, title, active, onClick }: { name: string; title: string; active: boolean; onClick: () => void }) {
  return (
    <button className={"bd-btn" + (active ? " on" : "")} title={title} onClick={onClick}>
      <Icon name={name} />
    </button>
  );
}

export function IconBtn({
  name,
  title,
  active,
  disabled,
  onClick,
}: {
  name: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={"bd-ibtn" + (active ? " on" : "")} title={title} disabled={disabled} onClick={onClick}>
      <Icon name={name} size={19} />
    </button>
  );
}

/** Toggle chip (`bd-chip-btn`), `on` adds the active class. */
export function Chip({
  on,
  title,
  disabled,
  style,
  className,
  children,
  onClick,
}: {
  on?: boolean;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={"bd-chip-btn" + (on ? " on" : "") + (className ? " " + className : "")}
      title={title}
      disabled={disabled}
      style={style}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** "Таймер N хв [Додати]" row of the lesson menu. */
export function TimerRow({ onAdd }: { onAdd: (minutes: number) => void }) {
  const [min, setMin] = useState("5");
  const m = parseFloat(min.replace(",", "."));
  const ok = Number.isFinite(m) && m > 0 && m <= 600;
  return (
    <div className="bd-item bd-item-static">
      <span className="bd-item-ic">
        <Icon name="timer" size={20} />
      </span>
      <span className="bd-item-tx">
        <b>Таймер</b>
        <small className="bd-timer-row">
          <input
            className="bd-input"
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && ok) onAdd(m);
            }}
          />
          хв
          <button className="bd-chip-btn" disabled={!ok} onClick={() => onAdd(m)}>
            Додати
          </button>
        </small>
      </span>
    </div>
  );
}

/**
 * Field bound to a value the board can change from outside (a rotated angle, points placed by
 * click): shows the outside value, except while focused, so typing is never overwritten.
 */
export function DraftField({
  value,
  multiline,
  placeholder,
  onType,
  onDone,
}: {
  value: string;
  multiline?: boolean;
  placeholder?: string;
  onType: (text: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const props = {
    value: draft ?? value,
    placeholder,
    spellCheck: false,
    onFocus: () => setDraft(value),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      onType(e.target.value);
    },
    onBlur: () => {
      setDraft(null);
      onDone();
    },
  };
  if (multiline) return <textarea className="bd-input area" {...props} onKeyDown={(e) => e.stopPropagation()} />;
  return (
    <input
      className="bd-input"
      type="text"
      inputMode="decimal"
      {...props}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
