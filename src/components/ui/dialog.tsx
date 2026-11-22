"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  size?: keyof typeof sizes;
  /** Classes for the panel (padding, height, layout). */
  className?: string;
  /** Set false for dialogs that must not close on backdrop click (e.g. unsaved forms). */
  closeOnBackdrop?: boolean;
  /** Set false for forms where Escape would silently discard typed input. */
  closeOnEscape?: boolean;
  /** Round ✕ in the top-right corner. */
  showClose?: boolean;
  children: React.ReactNode;
}

/** Modal shell: backdrop, Escape to close, body scroll lock. */
export function Dialog({
  open,
  onClose,
  size = "md",
  className,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showClose = false,
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  return (
    <div
      // Above the sticky app header/sidebar (z-50), below the reference drawer (z-95+).
      // Sized to the visible area (VisualViewportVars), so the on-screen keyboard doesn't
      // cover the dialog; `-safe` keeps a dialog taller than that scrollable from its top.
      className="fixed inset-x-0 top-(--vv-top,0px) h-(--vv-h,100dvh) z-80 flex items-center-safe justify-center p-4 overflow-y-auto overscroll-contain"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className="fixed inset-0 bg-(--backdrop) backdrop-blur-md animate-in fade-in-0 duration-150" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // Opaque white card with a soft shadow over the blurred page.
          "relative z-10 w-full rounded-[22px] bg-popover shadow-glass-lg",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          sizes[size],
          className,
        )}
      >
        {children}
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <X size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
