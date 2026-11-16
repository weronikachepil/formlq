"use client";

import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

const CHANNEL_URL = "https://t.me/+QKzVYue4pR41YzE6";
/** Set once the tutor closes the card (× or «Не зараз»): it isn't shown again. It never closes by itself. */
const SEEN_KEY = "formlq-tg-promo-seen";
/** After the site intro (SiteIntro) has finished writing the logo. */
const SHOW_AFTER_MS = 3500;

/** A small card inviting tutors and editors (tutor and admin areas) to the formlq Telegram channel. */
export function TelegramPromo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return; // storage blocked: better not to show it on every page
    }
    const t = setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore: it just may show again next visit
    }
  }

  if (!open) return null;
  return (
    <div
      role="status"
      className="fixed z-70 bottom-4 right-4 left-4 sm:left-auto sm:w-88 rounded-3xl border border-glass-edge bg-popover shadow-glass-lg p-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрити"
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-glass-strong transition-colors"
      >
        <X size={15} />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="w-10 h-10 shrink-0 rounded-full bg-[#2aabee] text-white flex items-center justify-center">
          <Send size={18} className="-ml-0.5" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-sm">formlq у Telegram</p>
          <p className="text-sm text-muted-foreground leading-snug">
            Новини платформи, нові функції та ідеї для уроків — у нашому каналі для вчителів.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Не зараз
        </Button>
        <a
          href={CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "sm" })}
        >
          Приєднатися
        </a>
      </div>
    </div>
  );
}
