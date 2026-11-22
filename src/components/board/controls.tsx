"use client";

// Small mathboard buttons shared by the toolbar, menus and inspector.
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";

/**
 * Menu row: icon + title only. `desc` is a desktop tooltip — menus stay short (Krug: halve the
 * words); how to use a tool is told when it is picked (see ToolMenus `howTo`).
 */
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
    <button className={"bd-item" + (active ? " on" : "")} title={tip ?? desc} onClick={onClick}>
      <span className="bd-item-ic">{typeof icon === "string" ? <Icon name={icon} size={20} /> : icon}</span>
      <span className="bd-item-tx">
        <b>{title}</b>
      </span>
    </button>
  );
}

/** Tool button; `open` (defined) marks one that opens a drop-down and says whether it is open. */
export function ToolBtn({
  name,
  title,
  active,
  open,
  onClick,
}: {
  name: string;
  title: string;
  active: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={"bd-btn" + (active ? " on" : "")}
      title={title}
      aria-label={title}
      {...(open === undefined ? { "aria-pressed": active } : { "aria-haspopup": "menu" as const, "aria-expanded": open })}
      onClick={onClick}
    >
      <Icon name={name} />
    </button>
  );
}

export function IconBtn({
  name,
  title,
  active,
  toggle,
  menu,
  disabled,
  onClick,
}: {
  name: string;
  title: string;
  active?: boolean;
  /** An on/off switch: exposes `active` as aria-pressed. */
  toggle?: boolean;
  /** Opens a drop-down: exposes `active` as aria-expanded. */
  menu?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={"bd-ibtn" + (active ? " on" : "")}
      title={title}
      aria-label={title}
      aria-pressed={toggle ? !!active : undefined}
      aria-haspopup={menu ? "menu" : undefined}
      aria-expanded={menu ? !!active : undefined}
      disabled={disabled}
      onClick={onClick}
    >
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
      aria-pressed={on === undefined ? undefined : on}
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

/** The open tab of a tabbed menu, remembered per menu (falls back quietly without storage). */
export function useMenuTab<T extends string>(key: string, tabs: [T, string][], def: T): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(() => {
    try {
      const t = localStorage.getItem(key) as T | null;
      return t && tabs.some(([id]) => id === t) ? t : def;
    } catch {
      return def;
    }
  });
  const pick = (t: T) => {
    setTab(t);
    try {
      localStorage.setItem(key, t);
    } catch {}
  };
  // a remembered tab may be hidden now (e.g. «Тест» for a student)
  return [tabs.some(([id]) => id === tab) ? tab : def, pick];
}

export function MenuTabs<T extends string>({ label, tabs, tab, onPick }: { label: string; tabs: [T, string][]; tab: T; onPick: (t: T) => void }) {
  if (tabs.length < 2) return null;
  return (
    <div className="bd-tabs" role="tablist" aria-label={label}>
      {tabs.map(([id, name]) => (
        <button key={id} role="tab" aria-selected={tab === id} className={"bd-tab" + (tab === id ? " on" : "")} onClick={() => onPick(id)}>
          {name}
        </button>
      ))}
    </div>
  );
}
