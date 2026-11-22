"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTHS, WEEKDAYS, addDays, monthCells, sameDay, startOfDay } from "@/lib/calendar";
import { fieldClass } from "@/components/ui/text-field";
import { IconButton } from "@/components/ui/icon-button";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

/** `YYYY-MM-DDTHH:mm` (the `datetime-local` format), in local time. */
export function toLocalValue(d: Date): string {
  return `${toDateValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** `YYYY-MM-DD` (the `date` input format), in local time. */
export function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) : null;
}

type Size = "sm" | "md";

// ---------------------------------------------------------------------------
// Shared pieces

/**
 * Trigger + floating panel. The panel is `position: fixed` under (or above) the trigger,
 * so scrolling dialogs don't clip it.
 */
function Picker({
  icon,
  label,
  placeholder,
  onClear,
  size = "md",
  className,
  panelWidth,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  onClear?: () => void;
  size?: Size;
  className?: string;
  panelWidth: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const h = panelRef.current?.offsetHeight ?? 420;
      const w = Math.min(panelWidth, vw - 16);
      const left = Math.max(8, Math.min(r.left, vw - w - 8));
      // Below when it fits (or fits better), otherwise above.
      setPos(vh - r.bottom - 6 >= h || vh - r.bottom >= r.top ? { left, top: r.bottom + 6 } : { left, bottom: vh - r.top + 6 });
    };
    place();
    // Scrolling inside the panel (the time columns) must not move it.
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, panelWidth]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Capture: Escape closes the picker, not the dialog around it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setPos(null);
          setOpen(!open);
        }}
        aria-expanded={open}
        className={cn(
          fieldClass,
          "flex items-center gap-2 text-left",
          size === "sm" ? "h-8 px-3.5" : "h-10 px-4",
          onClear && label && "pr-10",
          open && "bg-glass-strong border-foreground/50",
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className={cn("truncate", !label && "text-muted-foreground/70")}>{label || placeholder}</span>
      </button>
      {onClear && label && (
        <IconButton
          label="Очистити"
          className="absolute right-1.5 top-1/2 -translate-y-1/2"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
        >
          <X size={13} />
        </IconButton>
      )}

      {open && (
        <div
          ref={panelRef}
          style={{ position: "fixed", width: panelWidth, maxWidth: "calc(100vw - 16px)", ...(pos ?? { left: -9999, top: 0 }) }}
          // Inside a <label> (form fields), a click on empty panel space would re-click the trigger.
          onClick={(e) => e.preventDefault()}
          className="z-200 rounded-3xl border border-glass-edge bg-popover p-3 shadow-glass-lg space-y-3"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
        active ? "bg-primary text-primary-foreground shadow-pill-dark" : "bg-glass shadow-pill hover:bg-glass-strong",
      )}
    >
      {children}
    </button>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold shadow-pill-dark hover:opacity-90"
      >
        Готово
      </button>
    </div>
  );
}

/** Quick days + a Ukrainian month grid (Monday first). */
function CalendarPanel({ selected, min, onPick }: { selected: Date | null; min?: Date | null; onPick: (day: Date) => void }) {
  const today = new Date();
  const [view, setView] = useState(() => {
    const d = selected ?? today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = view.getFullYear();
  const month = view.getMonth();
  const minDay = min ? startOfDay(min) : null;
  const quick = [
    { label: "Сьогодні", day: today },
    { label: "Завтра", day: addDays(today, 1) },
    { label: "Через тиждень", day: addDays(today, 7) },
  ].filter((q) => !minDay || startOfDay(q.day) >= minDay);

  return (
    <>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <Chip key={q.label} active={!!selected && sameDay(selected, q.day)} onClick={() => onPick(q.day)}>
              {q.label}
            </Chip>
          ))}
        </div>
      )}
      <div>
        <div className="flex items-center justify-between pb-1">
          <IconButton label="Попередній місяць" onClick={() => setView(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </IconButton>
          <p className="text-sm font-semibold">
            {MONTHS[month]} {year}
          </p>
          <IconButton label="Наступний місяць" onClick={() => setView(new Date(year, month + 1, 1))}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-[10px] font-semibold uppercase text-muted-foreground py-1">
              {w}
            </span>
          ))}
          {monthCells(year, month).map((date, i) => {
            if (!date) return <span key={i} />;
            const isSelected = !!selected && sameDay(date, selected);
            const isToday = sameDay(date, today);
            const disabled = !!minDay && date < minDay;
            const past = date < startOfDay(today);
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => onPick(date)}
                aria-pressed={isSelected}
                className={cn(
                  "h-9 rounded-full text-sm transition-colors disabled:opacity-25 disabled:pointer-events-none",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-pill-dark"
                    : isToday
                      ? "ring-1 ring-foreground/40 font-semibold hover:bg-glass-strong"
                      : past
                        ? "text-muted-foreground/50 hover:bg-glass-strong"
                        : "hover:bg-glass-strong",
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** One scrollable column of values; the selected one is scrolled into the middle on open. */
function Column({ items, value, onPick, label }: { items: string[]; value: string; onPick: (v: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
    // Only on mount: picking a value must not scroll the list under the pointer.
  }, []);
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center pb-1">{label}</p>
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 px-0.5 [scrollbar-width:none]">
        {items.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onPick(v)}
            className={cn(
              "w-full h-8 rounded-full text-sm tabular-nums transition-colors",
              v === value ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-glass-strong",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Hours | minutes columns. `step` = minute step (5, 15…). */
function TimeColumns({ time, onTime, step, className }: { time: string; onTime: (t: string) => void; step: number; className?: string }) {
  const [hh, mm] = time.split(":");
  const base = Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step));
  // Keep the current minute listed even when it is off the step (e.g. 23:59).
  const minutes = [...new Set([...base, mm])].sort();
  return (
    <div className={cn("flex gap-1", className)}>
      <Column label="Год" items={HOURS} value={hh} onPick={(h) => onTime(`${h}:${mm}`)} />
      <Column label="Хв" items={minutes} value={mm} onPick={(m) => onTime(`${hh}:${m}`)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public pickers

interface BaseProps {
  placeholder?: string;
  size?: Size;
  className?: string;
}

/** Date and time in one field (value `YYYY-MM-DDTHH:mm`, "" = none). */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Оберіть дату",
  defaultTime = "18:00",
  clearable = true,
  size,
  className,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  /** Time a newly picked day gets when nothing was set. */
  defaultTime?: string;
  clearable?: boolean;
}) {
  const current = parseDate(value);
  const time = current ? `${pad(current.getHours())}:${pad(current.getMinutes())}` : defaultTime;
  const at = (day: Date, t: string) => {
    const [h, m] = t.split(":").map(Number);
    onChange(toLocalValue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)));
  };
  const label = current
    ? // Short month so date and time fit a half-width field: «нд, 22 лист. о 20:50».
      current.toLocaleString("uk", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Picker
      icon={<CalendarClock size={15} />}
      label={label}
      placeholder={placeholder}
      onClear={clearable ? () => onChange("") : undefined}
      size={size}
      className={className}
      panelWidth={440}
    >
      {(close) => (
        <>
          {/* Calendar and time side by side; stacked when the screen is narrow. */}
          <div className="flex flex-wrap gap-3">
            <div className="basis-[272px] grow space-y-3">
              <CalendarPanel selected={current} onPick={(day) => at(day, time)} />
            </div>
            <TimeColumns
              time={time}
              onTime={(t) => at(current ?? new Date(), t)}
              step={5}
              className="basis-[120px] grow h-[300px]"
            />
          </div>
          <DoneButton onClick={close} />
        </>
      )}
    </Picker>
  );
}

/** A day (value `YYYY-MM-DD`). Picking a day closes the panel. */
export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Оберіть дату",
  size,
  className,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day, `YYYY-MM-DD`. */
  min?: string;
}) {
  const current = parseDate(value);
  // The year only when it is not this year.
  const label = current
    ? current.toLocaleDateString("uk", {
        weekday: "short",
        day: "numeric",
        month: "long",
        ...(current.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
      })
    : "";
  return (
    <Picker
      icon={<CalendarDays size={15} />}
      label={label}
      placeholder={placeholder}
      size={size}
      className={className}
      panelWidth={304}
    >
      {(close) => (
        <CalendarPanel
          selected={current}
          min={min ? parseDate(min) : null}
          onPick={(day) => {
            onChange(toDateValue(day));
            close();
          }}
        />
      )}
    </Picker>
  );
}

/** A time of day (value `HH:mm`). */
export function TimePicker({
  value,
  onChange,
  step = 15,
  placeholder = "Час",
  size,
  className,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  /** Minute step of the list. */
  step?: number;
}) {
  const valid = /^\d{2}:\d{2}$/.test(value);
  return (
    <Picker
      icon={<Clock size={15} />}
      label={valid ? value : ""}
      placeholder={placeholder}
      size={size}
      className={className}
      panelWidth={200}
    >
      {(close) => (
        <>
          <TimeColumns time={valid ? value : "16:00"} onTime={onChange} step={step} className="h-[232px]" />
          <DoneButton onClick={close} />
        </>
      )}
    </Picker>
  );
}
