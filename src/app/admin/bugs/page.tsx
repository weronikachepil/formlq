"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, ExternalLink, Monitor, RotateCcw, Trash2, UserRound } from "lucide-react";
import { usePageHeader } from "@/context/HeaderContext";
import { deleteBugReport, setBugStatus, subscribeBugReports, type BugReport } from "@/lib/bug-reports";
import { cn } from "@/lib/utils";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionLabel } from "@/components/ui/section-label";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ROLE_LABEL: Record<string, string> = { student: "учень", tutor: "викладач", editor: "редактор" };

/** Short device name from a user agent: enough to tell an iPad Safari from a desktop Chrome. */
function device(ua: string): string {
  const os = /iPad|Macintosh.*Mobile/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : "";
  return [os, browser].filter(Boolean).join(" · ") || "Невідомий пристрій";
}

function when(r: BugReport): string {
  const d = r.createdAt?.toDate();
  if (!d) return "щойно";
  return d.toLocaleString("uk", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Bug reports users sent from the app: new on top, resolved below. */
export default function AdminBugsPage() {
  const [reports, setReports] = useState<BugReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BugReport | null>(null);

  useEffect(() => subscribeBugReports(setReports, () => setFailed(true)), []);

  const [open, resolved] = useMemo(
    () => [(reports ?? []).filter((r) => r.status !== "resolved"), (reports ?? []).filter((r) => r.status === "resolved")],
    [reports],
  );

  usePageHeader("Помилки", open.length ? `Нових: ${open.length}` : "Повідомлення від користувачів");

  async function toggle(r: BugReport) {
    try {
      await setBugStatus(r.id, r.status === "resolved" ? "new" : "resolved");
    } catch {
      toast.error("Не вдалося змінити статус");
    }
  }

  async function remove(r: BugReport) {
    try {
      await deleteBugReport(r.id);
      toast.success("Повідомлення видалено");
    } catch {
      toast.error("Не вдалося видалити");
    }
  }

  if (failed) {
    return (
      <EmptyState
        emoji="🔒"
        title="Немає доступу до повідомлень"
        description="Опублікуйте оновлені правила Firestore (bugReports)."
      />
    );
  }
  if (!reports) return <SpinnerPage />;
  if (!reports.length) {
    return <EmptyState emoji="🐞" title="Повідомлень про помилки ще немає" description="Користувачі надсилають їх кнопкою 🐞 у шапці." />;
  }

  function renderCard(r: BugReport) {
    const done = r.status === "resolved";
    return (
      <div
        key={r.id}
        className={cn("rounded-2xl border bg-card p-4 space-y-3", done ? "border-border/30 opacity-70" : "border-border/50")}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <UserRound size={12} /> {r.reporterName || "Без імені"}
              </span>
              {r.reporterRole && <span>{ROLE_LABEL[r.reporterRole] ?? r.reporterRole}</span>}
              {r.reporterEmail && <span className="truncate">{r.reporterEmail}</span>}
              <span>{when(r)}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconButton label={done ? "Повернути в нові" : "Позначити виправленим"} tone="primary" onClick={() => toggle(r)}>
              {done ? <RotateCcw size={13} /> : <Check size={13} />}
            </IconButton>
            <IconButton label="Видалити" tone="danger" onClick={() => setConfirmDelete(r)}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        </div>

        <p className="text-sm whitespace-pre-wrap wrap-break-word">{r.text}</p>

        {r.imageUrl && (
          <a href={r.imageUrl} target="_blank" rel="noreferrer" className="block w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded screenshot */}
            <img src={r.imageUrl} alt="Скріншот" className="max-h-64 rounded-xl border border-border/50 hover:opacity-90" />
          </a>
        )}

        <p className="text-[11px] text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href={r.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground underline-offset-2 hover:underline">
            <ExternalLink size={11} /> {r.page}
          </a>
          <span className="inline-flex items-center gap-1" title={r.userAgent}>
            <Monitor size={11} /> {device(r.userAgent)} · {r.viewport}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <div className="space-y-2">
          <SectionLabel className="px-1">Нові · {open.length}</SectionLabel>
          {open.map(renderCard)}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <SectionLabel className="px-1">Виправлені · {resolved.length}</SectionLabel>
          {resolved.map(renderCard)}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Видалити повідомлення?"
        description="Його не можна буде відновити."
        confirmLabel="Видалити"
        onConfirm={() => {
          if (confirmDelete) remove(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
