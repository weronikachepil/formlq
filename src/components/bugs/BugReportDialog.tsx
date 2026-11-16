"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createBugReport } from "@/lib/bug-reports";
import { uploadBugScreenshot } from "@/lib/storage";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/text-field";
import { SectionLabel } from "@/components/ui/section-label";

const MAX_IMAGE = 8 * 1024 * 1024;

/** «Повідомити про помилку»: a description, an optional screenshot; the page and device are added. */
export function BugReportDialog({ onClose }: { onClose: () => void }) {
  const { user, userProfile } = useAuth();
  const pathname = usePathname();
  const [text, setText] = useState("");
  // The picked screenshot and its local preview URL (revoked when replaced or on close).
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  function pick(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Можна додати лише зображення");
    if (file.size > MAX_IMAGE) return toast.error("Зображення завелике (до 8 МБ)");
    setImage({ file, url: URL.createObjectURL(file) });
  }

  // A screenshot pasted anywhere in the dialog (⌘V) is attached.
  function onPaste(e: React.ClipboardEvent) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      pick(file);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      const imageUrl = image ? await uploadBugScreenshot(image.file) : undefined;
      await createBugReport({
        reporterId: user.uid,
        reporterName: userProfile?.displayName || user.displayName || "",
        reporterEmail: userProfile?.email || user.email || "",
        reporterRole: userProfile?.role ?? null,
        text: text.trim(),
        imageUrl,
        page: pathname + window.location.search,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
      });
      toast.success("Дякуємо! Ми отримали ваше повідомлення");
      onClose();
    } catch {
      toast.error("Не вдалося надіслати. Спробуйте ще раз");
      setSending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} size="md" className="p-6" closeOnBackdrop={false} closeOnEscape={!text}>
      <form onSubmit={send} onPaste={onPaste} className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl">Повідомити про помилку</h2>
          <p className="text-sm text-muted-foreground">
            Опишіть, що сталося і що ви робили перед цим. Сторінку й пристрій ми додамо самі.
          </p>
        </div>

        <div className="space-y-2">
          <SectionLabel as="label" htmlFor="bug-text">
            Що пішло не так?
          </SectionLabel>
          <Textarea
            id="bug-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напр. на дошці не зберігається малюнок після перезавантаження"
            rows={5}
            maxLength={3000}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <SectionLabel>Скріншот (необовʼязково)</SectionLabel>
          {image ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={image.url} alt="Скріншот" className="max-h-48 rounded-xl border border-border/50" />
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="Прибрати скріншот"
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-pill-dark"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 rounded-2xl border border-dashed border-foreground/20 px-4 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-glass-strong transition-colors">
              <ImagePlus size={16} />
              Додати зображення<span className="hidden md:inline"> або вставити ⌘V</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={sending || !text.trim()}>
            {sending ? "Надсилаю…" : "Надіслати"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
