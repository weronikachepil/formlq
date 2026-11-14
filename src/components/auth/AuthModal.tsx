"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Sign-in / sign-up form over the blurred landing; closing goes back to the page underneath. */
export function AuthModal({ label, children }: { label: string; children: ReactNode }) {
  const router = useRouter();
  const close = () => router.back();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[100] overflow-y-auto bg-background/30 backdrop-blur-md animate-in fade-in-0 duration-200"
    >
      {/* Fills the overlay, so a click on it (not on the card) means "outside". */}
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="relative w-full max-w-[420px] animate-in zoom-in-95 fade-in-0 duration-200">
          {children}
          <button
            type="button"
            aria-label="Закрити"
            onClick={close}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-glass-strong text-foreground shadow-pill transition-colors hover:bg-background"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
