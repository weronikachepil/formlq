"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, KeyRound, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/context/AuthContext";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";
import {
  createAdventCodes,
  deleteAdventCode,
  formatAdventCode,
  getMyAdventCodes,
  type AdventCode,
} from "@/lib/advent-codes";
import { AdventBuy } from "./AdventAccess";

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
  ctx.fillText("Увійди й введи свій особистий код", size / 2, size + 90, size - 60);
  return canvas.toDataURL("image/png");
}

const noop = () => () => {};
const codesKey = (uid?: string) => ["adventCodes", uid] as const;

function messageFor(code: string, url: string) {
  return (
    `Адвент-календар з математики «Відлік до НМТ»: щодня з 1 до 24 грудня — задача в стилі НМТ або міні-гра, ` +
    `а в кінці 5 імітацій НМТ у подарунок 🎄\n` +
    `Твій особистий код: ${formatAdventCode(code)}\n` +
    `Увійди на formlq (${url}) і введи код. Він працює лише для одного акаунта, тож нікому його не передавай.`
  );
}

function usedLabel(c: AdventCode) {
  const date = c.usedAt?.toDate().toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  return `${c.usedName || "Учень"}${date ? ` · ${date}` : ""}`;
}

/**
 * A teacher's (or editor's) personal codes for students — one code, one student — plus the
 * link and a printable QR. Teachers get codes by buying a pack; editors may also create free
 * codes by hand (`canCreate`).
 */
export function AdventSharePanel({ canCreate = false }: { canCreate?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const url = useSyncExternalStore(noop, () => `${window.location.origin}/advent`, () => "");
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const [count, setCount] = useState(5);
  const [toDelete, setToDelete] = useState<AdventCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const link = useCopyToClipboard();
  const all = useCopyToClipboard();

  const { data: codes = [], isLoading } = useQuery({
    queryKey: codesKey(user?.uid),
    queryFn: () => getMyAdventCodes(user!.uid),
    enabled: !!user,
  });
  const free = codes.filter((c) => !c.usedBy);
  const used = codes.length - free.length;

  const create = useMutation({
    mutationFn: (n: number) => createAdventCodes(user!.uid, n),
    onSuccess: (made) => {
      toast.success(`Створено ${made.length} ${made.length === 1 ? "код" : made.length < 5 ? "коди" : "кодів"}`);
      qc.invalidateQueries({ queryKey: codesKey(user?.uid) });
    },
    onError: () => toast.error("Не вдалося створити коди"),
  });
  const remove = useMutation({
    mutationFn: (code: string) => deleteAdventCode(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: codesKey(user?.uid) }),
    onError: () => toast.error("Не вдалося видалити код"),
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { ...QR_OPTIONS, width: 320 }).then((image) => { if (!cancelled) setQr({ url, image }); });
    return () => { cancelled = true; };
  }, [url]);

  async function copyMessage(code: string) {
    try {
      await navigator.clipboard.writeText(messageFor(code, url));
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  async function downloadQr() {
    const a = document.createElement("a");
    a.href = await renderPrintable(url);
    a.download = "QR — Адвент-календар formlq.png";
    a.click();
  }

  return (
    <section className="rounded-[18px] bg-card p-5 sm:p-6 space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold">Доступ для учнів</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Учень входить на formlq і вводить свій особистий код. Кожен код — для одного учня: після введення він
              прив&apos;язується до акаунта учня, і ніхто інший ним не скористається.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Посилання на календар</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Посилання на календар"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <Button variant="outline" onClick={() => link.copy(url)} disabled={!url} className="h-11 rounded-xl">
                {link.copied ? <Check size={16} /> : <Copy size={16} />}
                {link.copied ? "Скопійовано" : "Скопіювати"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2 md:w-[180px]">
          <div className="grid size-[160px] place-items-center overflow-hidden rounded-xl border border-border bg-white">
            {qr?.url === url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.image} alt="QR-код календаря" width={160} height={160} />
            ) : (
              <div className="size-full animate-pulse bg-muted" />
            )}
          </div>
          <Button variant="outline" onClick={downloadQr} disabled={!url} className="h-11 w-full rounded-xl">
            <Download size={16} /> QR для друку
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/50 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-bold">Особисті коди</h3>
            <p className="text-sm text-muted-foreground">
              {codes.length ? `Усього ${codes.length}: вільних ${free.length}, використано ${used}` : "По коду на кожного учня"}
            </p>
          </div>
          {!canCreate && (
            <Button variant="outline" onClick={() => setBuying(!buying)} className="h-11 rounded-xl">
              <ShoppingBag size={16} /> {buying ? "Сховати" : "Купити ще коди"}
            </Button>
          )}
          {canCreate && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); create.mutate(count); }}
          >
            <label htmlFor="adv-count" className="text-sm text-muted-foreground">Кількість</label>
            <input
              id="adv-count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="h-11 w-20 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <Button type="submit" disabled={create.isPending || !user} className="h-11 rounded-xl">
              <Plus size={16} /> {create.isPending ? "Створюю…" : "Створити безкоштовні коди"}
            </Button>
          </form>
          )}
        </div>

        {buying && (
          <div className="landing adv-embed adv-embed-buy">
            <AdventBuy kind="pack" onDone={() => setBuying(false)} />
          </div>
        )}

        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        ) : codes.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <KeyRound size={18} className="shrink-0" />
            Кодів ще немає.
          </div>
        ) : (
          <>
            {free.length > 1 && (
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => all.copy(free.map((c) => formatAdventCode(c.id)).join("\n"))}
              >
                {all.copied ? <Check size={16} /> : <Copy size={16} />}
                {all.copied ? "Скопійовано" : `Скопіювати всі вільні (${free.length})`}
              </Button>
            )}
            <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
              {codes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="font-mono text-base font-bold tracking-wider">{formatAdventCode(c.id)}</span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-semibold",
                      c.usedBy ? "bg-mint/60 text-[#14262a]" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.usedBy ? usedLabel(c) : "вільний"}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {!c.usedBy && (
                      <Button variant="ghost" className="h-10 rounded-xl" onClick={() => copyMessage(c.id)}>
                        {copiedCode === c.id ? <Check size={16} /> : <Copy size={16} />}
                        {copiedCode === c.id ? "Скопійовано" : "Повідомлення з кодом"}
                      </Button>
                    )}
                    {canCreate && (
                      <Button
                        variant="ghost"
                        className="h-10 rounded-xl text-muted-foreground"
                        aria-label={`Видалити код ${formatAdventCode(c.id)}`}
                        onClick={() => setToDelete(c)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`Видалити код ${toDelete ? formatAdventCode(toDelete.id) : ""}?`}
        description={
          toDelete?.usedBy
            ? `${toDelete.usedName || "Учень"} втратить доступ до календаря.`
            : "Код перестане працювати."
        }
        onConfirm={() => { if (toDelete) remove.mutate(toDelete.id); setToDelete(null); }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
