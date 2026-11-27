"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// Dark-on-white in both themes: scanners need the contrast.
const QR_OPTIONS = { margin: 2, errorCorrectionLevel: "M" as const, color: { dark: "#000000", light: "#ffffff" } };

/** Printable PNG: the QR with a title and a caption underneath (same layout as test QR codes). */
async function renderPrintable(url: string): Promise<string> {
  const size = 720;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, { ...QR_OPTIONS, width: size });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size + 130;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qr, 0, 0);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "600 36px system-ui, -apple-system, sans-serif";
  ctx.fillText("Адвент-календар «Відлік до НМТ»", size / 2, size + 40, size - 60);
  ctx.fillStyle = "#555555";
  ctx.font = "28px system-ui, -apple-system, sans-serif";
  ctx.fillText("Задача або гра щодня, 1–24 грудня", size / 2, size + 90, size - 60);
  return canvas.toDataURL("image/png");
}

const MESSAGE =
  "Адвент-календар з математики «Відлік до НМТ»: щодня з 1 до 24 грудня — задача в стилі НМТ або міні-гра. " +
  "Збери всю фразу, і відкриєш 5 імітацій НМТ у подарунок 🎄";

const noop = () => () => {};

/** Teachers and editors: hand the calendar to students by link, message or printed QR. */
export function AdventSharePanel() {
  // The public page works without an account; signed-in students are offered their cabinet.
  const url = useSyncExternalStore(noop, () => `${window.location.origin}/advent`, () => "");
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const link = useCopyToClipboard();
  const message = useCopyToClipboard();

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { ...QR_OPTIONS, width: 360 }).then((image) => { if (!cancelled) setQr({ url, image }); });
    return () => { cancelled = true; };
  }, [url]);

  async function downloadQr() {
    const a = document.createElement("a");
    a.href = await renderPrintable(url);
    a.download = "QR — Адвент-календар formlq.png";
    a.click();
  }

  async function share() {
    try { await navigator.share({ title: "Відлік до НМТ", text: MESSAGE, url }); } catch { /* cancelled */ }
  }

  return (
    <section className="rounded-[18px] bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold">Поділіться з учнями</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Календар відкривається без акаунта. Учні, які увійшли, бачать його у своєму кабінеті. Прогрес кожного учня зберігається в його браузері.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Посилання</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Посилання на календар"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <Button onClick={() => link.copy(url)} disabled={!url} className="h-11 rounded-xl">
                {link.copied ? <Check size={16} /> : <Copy size={16} />}
                {link.copied ? "Скопійовано" : "Скопіювати"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Повідомлення для учнів</p>
            <p className="rounded-xl bg-muted/60 p-3 text-sm">{MESSAGE} {url}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => message.copy(`${MESSAGE} ${url}`)} disabled={!url} className="h-11 rounded-xl">
                {message.copied ? <Check size={16} /> : <Copy size={16} />}
                {message.copied ? "Скопійовано" : "Скопіювати повідомлення"}
              </Button>
              {canShare && (
                <Button variant="outline" onClick={share} className="h-11 rounded-xl">
                  <Share2 size={16} /> Надіслати…
                </Button>
              )}
              <Button variant="outline" onClick={() => window.open("/advent", "_blank")} className="h-11 rounded-xl">
                <ExternalLink size={16} /> Відкрити як учень
              </Button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2 md:w-[200px]">
          <div className="grid size-[180px] place-items-center overflow-hidden rounded-xl border border-border bg-white">
            {qr?.url === url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.image} alt="QR-код календаря" width={180} height={180} />
            ) : (
              <div className="size-full animate-pulse bg-muted" />
            )}
          </div>
          <Button variant="outline" onClick={downloadQr} disabled={!url} className="h-11 w-full rounded-xl">
            <Download size={16} /> Завантажити QR
          </Button>
          <p className="text-center text-xs text-muted-foreground">Для класу чи друку</p>
        </div>
      </div>
    </section>
  );
}
