"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { ArrowLeft, Check, Copy, Download, ExternalLink, Pencil, Square, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { isEditor } from "@/lib/roles";
import {
  STATUS_CLS,
  STATUS_LABEL,
  assignmentPath,
  assignmentStatus,
  deleteAssignment,
  deleteAttempt,
  formatWindow,
  setAssignmentTimes,
  subscribeAssignment,
  subscribeAttempts,
  type Assignment,
  type Attempt,
} from "@/lib/assignments";
import type { TestResult } from "@/lib/tests";
import { formatDuration, pluralize, PLURAL } from "@/lib/format";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { ResultsView } from "@/components/exam/ResultsView";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { SectionLabel } from "@/components/ui/section-label";
import { SpinnerPage } from "@/components/ui/spinner";
import { DateTimePicker, toLocalValue } from "@/components/ui/date-time-picker";
import { cn } from "@/lib/utils";

/** An attempt in the shape ResultsView reads. */
function asResult(a: Attempt, as: Assignment): TestResult {
  return {
    id: a.id,
    userId: a.uid ?? "",
    testId: as.testId,
    testTitle: as.title,
    testSubtitle: "",
    completedAt: a.submittedAt,
    timeSpent: a.timeSpent,
    rawScore: a.rawScore,
    nmtScore: a.nmtScore,
    maxRaw: a.maxRaw,
    answers: a.answers,
    questions: a.questions,
    scoreTable: [],
  };
}

/** One time-boxed test: its link and QR, its window, and every student's result. */
export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [a, setA] = useState<Assignment | null | undefined>(undefined);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "stop" | Attempt | null>(null);

  usePageHeader(a?.title ?? "Тестування", a ? formatWindow(a) : undefined);

  useEffect(() => subscribeAssignment(id, setA), [id]);
  useEffect(() => subscribeAttempts(id, setAttempts), [id]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    if (!attempts?.length) return null;
    const pct = attempts.map((t) => (t.maxRaw ? t.rawScore / t.maxRaw : 0));
    return { avg: Math.round((pct.reduce((s, x) => s + x, 0) / pct.length) * 100) };
  }, [attempts]);

  if (a === undefined) return <SpinnerPage />;
  if (a === null || (user && a.ownerId !== user.uid && !isEditor(userProfile?.role))) {
    return <EmptyState emoji="🫥" title="Тестування не знайдено" description="Можливо, його видалили." />;
  }

  const status = assignmentStatus(a, now);
  const url = typeof window === "undefined" ? assignmentPath(a.id) : `${window.location.origin}${assignmentPath(a.id)}`;

  async function stopNow() {
    if (!a) return;
    try {
      const n = new Date();
      // Opening time must stay before closing time.
      await setAssignmentTimes(a.id, a.opensAt.toDate() < n ? a.opensAt.toDate() : new Date(n.getTime() - 60_000), n);
      toast.success("Тестування завершено");
    } catch {
      toast.error("Не вдалося завершити");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8">
      <Link href="/tutor/assignments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Усі тестування
      </Link>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLS[status])}>
                {STATUS_LABEL[status]}
              </span>
              <p className="text-sm text-muted-foreground">
                {formatWindow(a)} · {pluralize(a.questionCount, PLURAL.question)} · до {a.durationMinutes} хв на учня
              </p>
            </div>
            <IconButton label="Змінити час" size="md" onClick={() => setEditing(!editing)}>
              <Pencil size={14} />
            </IconButton>
            <IconButton label="Видалити тестування" size="md" tone="danger" onClick={() => setConfirm("delete")}>
              <Trash2 size={14} />
            </IconButton>
          </div>

          {editing && <TimesEditor a={a} onDone={() => setEditing(false)} />}

          <div className="space-y-2">
            <SectionLabel>Посилання для учнів</SectionLabel>
            <LinkRow url={url} />
          </div>

          {status === "open" && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirm("stop")}>
              <Square size={12} /> Завершити зараз
            </Button>
          )}
        </div>
        <QrCard url={url} title={a.title} />
      </div>

      <section className="space-y-2">
        <SectionLabel className="px-1">
          Результати{attempts ? ` · ${attempts.length}` : ""}
          {stats ? ` · середній ${stats.avg}%` : ""}
        </SectionLabel>
        {!attempts ? (
          <SpinnerPage />
        ) : attempts.length === 0 ? (
          <EmptyState
            emoji="📭"
            title="Ще ніхто не здав"
            description={status === "scheduled" ? "Тест ще не відкрився." : "Результати зʼявляться тут одразу після здачі."}
          />
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/40">
            {attempts.map((t) => (
              <div key={t.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpen(open === t.id ? null : t.id)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-sm truncate">
                        {t.lastName} {t.firstName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.submittedAt?.toDate().toLocaleTimeString("uk", { hour: "2-digit", minute: "2-digit" }) ?? "щойно"} ·{" "}
                        {formatDuration(t.timeSpent)}
                        {t.auto && " · здано автоматично"}
                        {t.answerImages && Object.keys(t.answerImages).length > 0 &&
                          ` · 📷 ${Object.keys(t.answerImages).length}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums">
                        {t.rawScore}/{t.maxRaw}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {t.maxRaw ? Math.round((t.rawScore / t.maxRaw) * 100) : 0}%
                      </span>
                    </span>
                  </button>
                  <IconButton label="Видалити результат" tone="danger" onClick={() => setConfirm(t)}>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
                {open === t.id && (
                  <div className="px-4 pb-4">
                    <ResultsView result={asResult(t, a)} answerLabel="Відповідь учня" answerImages={t.answerImages} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === "delete"
            ? "Видалити тестування?"
            : confirm === "stop"
              ? "Завершити тестування зараз?"
              : `Видалити результат ${confirm ? `${confirm.lastName} ${confirm.firstName}` : ""}?`
        }
        description={
          confirm === "delete"
            ? "Посилання перестане працювати, а всі результати буде видалено."
            : confirm === "stop"
              ? "Учні, які ще пишуть, автоматично здадуть роботу, нові не зможуть почати."
              : "Учень зможе пройти тест ще раз з іншого пристрою."
        }
        confirmLabel={confirm === "stop" ? "Завершити" : "Видалити"}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (c === "delete") {
            try {
              await deleteAssignment(a.id);
              router.replace("/tutor/assignments");
            } catch {
              toast.error("Не вдалося видалити");
            }
          } else if (c === "stop") await stopNow();
          else if (c) await deleteAttempt(a.id, c.id).catch(() => toast.error("Не вдалося видалити"));
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function LinkRow({ url }: { url: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate rounded-full bg-glass px-4 py-2 text-xs shadow-pill">{url}</code>
      <IconButton label={copied ? "Скопійовано" : "Скопіювати"} size="md" onClick={() => copy(url)}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </IconButton>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Відкрити як учень"
        title="Відкрити як учень"
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-glass-strong hover:shadow-pill transition-all"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}

function QrCard({ url, title }: { url: string; title: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480 }).then(setSrc).catch(() => setSrc(""));
  }, [url]);
  if (!src) return null;
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 flex md:flex-col items-center gap-3 md:w-52">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
      <img src={src} alt="QR-код тестування" className="w-28 md:w-full rounded-xl bg-white p-1" />
      <a
        href={src}
        download={`${title || "тестування"}-qr.png`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Download size={13} /> Завантажити QR
      </a>
    </div>
  );
}

function TimesEditor({ a, onDone }: { a: Assignment; onDone: () => void }) {
  const [opens, setOpens] = useState(() => toLocalValue(a.opensAt.toDate()));
  const [closes, setCloses] = useState(() => toLocalValue(a.closesAt.toDate()));
  const [saving, setSaving] = useState(false);
  const o = new Date(opens);
  const c = new Date(closes);
  const bad = !(c > o);

  async function save() {
    setSaving(true);
    try {
      await setAssignmentTimes(a.id, o, c);
      toast.success("Час змінено");
      onDone();
    } catch {
      toast.error("Не вдалося змінити час");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/50 p-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <SectionLabel size="2xs">Відкривається</SectionLabel>
          <DateTimePicker size="sm" value={opens} onChange={setOpens} clearable={false} />
        </div>
        <div className="space-y-1">
          <SectionLabel size="2xs">Закривається</SectionLabel>
          <DateTimePicker size="sm" value={closes} onChange={setCloses} clearable={false} />
        </div>
      </div>
      {bad && <p className="text-xs text-red-600 dark:text-red-400">Тест має закриватися пізніше, ніж відкривається.</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={bad || saving} onClick={save}>
          {saving ? "Зберігаю…" : "Зберегти"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}
