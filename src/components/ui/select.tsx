"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectContextValue {
  value: string;
  onValueChange: (v: string) => void;
  close: () => void;
}

const SelectCtx = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  close: () => {},
});

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function Select({ value, onValueChange, children, className, disabled }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  // The menu is drawn over the page (portal, fixed), so a dialog or a scrolling card never
  // clips it; it opens upward when there's no room below and never exceeds the screen.
  const [pos, setPos] = React.useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const vh = window.innerHeight;
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 220 && above > below;
      setPos({
        left: r.left,
        width: r.width,
        ...(up ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }),
        maxH: Math.max(140, Math.min(320, up ? above : below)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // The chosen item's content, also when items sit inside fragments (e.g. under a SelectLabel).
  const label = React.useMemo(() => {
    let found: React.ReactNode = value;
    const walk = (nodes: React.ReactNode) =>
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as { value?: string; children?: React.ReactNode };
        if (child.type === SelectItem && props.value === value) found = props.children ?? value;
        else if (child.type === React.Fragment) walk(props.children);
      });
    walk(children);
    return found;
  }, [children, value]);

  React.useEffect(() => {
    if (!open) return;
    // Only the button and the menu count as inside: the wrapper spans the whole column,
    // so a press beside a narrow button must still close the menu.
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <SelectCtx.Provider value={{ value, onValueChange, close: () => setOpen(false) }}>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center justify-between gap-2 rounded-full border border-glass-edge bg-glass px-4 py-2 shadow-pill",
            "text-sm text-foreground transition-colors cursor-pointer outline-none whitespace-nowrap",
            "hover:bg-glass-strong focus-visible:border-foreground/50",
            open && "bg-glass-strong border-foreground/40",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            size={14}
            className={cn("shrink-0 text-muted-foreground transition-transform duration-200 pointer-events-none", open && "rotate-180")}
          />
        </button>

        {open &&
          pos &&
          createPortal(
            <div
              ref={menuRef}
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width }}
              className={cn(
                "fixed z-[200] overflow-hidden rounded-[18px] border border-glass-edge bg-popover p-1.5 shadow-glass-lg",
                "animate-in fade-in-0 zoom-in-95 duration-100",
              )}
            >
              <div
                className="overflow-y-auto overscroll-contain space-y-0.5"
                style={{ maxHeight: pos.maxH }}
              >
                {children}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </SelectCtx.Provider>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

function SelectItem({ value, children, disabled, className }: SelectItemProps) {
  const { value: selectedValue, onValueChange, close } = React.useContext(SelectCtx);
  const selected = selectedValue === value;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => { onValueChange(value); close(); }}
      className={cn(
        "flex w-full items-center gap-2 rounded-[10px] pl-8 pr-3 py-2 text-sm text-left relative",
        "cursor-pointer transition-colors outline-none",
        "hover:bg-muted",
        selected && "font-semibold text-foreground",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {selected && (
        <span className="absolute left-2.5 flex items-center justify-center">
          <Check size={12} className="text-foreground" />
        </span>
      )}
      {children}
    </button>
  );
}

/** Non-selectable heading above a run of items. */
function SelectLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
      {children}
    </div>
  );
}

export { Select, SelectItem, SelectLabel };
