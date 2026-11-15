"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  PenLine,
  Presentation,
  Repeat,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LESSON_STATUS_LABEL, Lesson, LessonStatus, lessonStatus } from "@/lib/lessons";
import type { Homework } from "@/lib/tutor";
import { getHomeworkStatusMeta, isHomeworkOverdue } from "@/lib/homework-status";
import { MINUTE_MS, WEEKDAYS_FULL, formatDayMonth, formatHm, weekdayIndex } from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { useStudentColor } from "./student-colors";
import { needsStatus } from "./lesson-utils";

const POPOVER_W = 340;
const STATUSES: LessonStatus[] = ["done", "canceled", "missed", "planned"];
const STATUS_ACTIVE: Record<LessonStatus, string> = {
  done: "bg-green-600 text-white",
  canceled: "bg-foreground/70 text-background",
  missed: "bg-red-500 text-white",
  planned: "bg-primary text-primary-foreground",
};

export interface LessonPopoverProps {
  lesson: Lesson;
  /** Group lesson: every member's copy of this occurrence (payment is per member). */
  members?: Lesson[];
  /** Current name of the lesson's group. */
  groupName?: string;
  anchor: DOMRect;
  /** Phones: show as a dialog instead of a floating card. */
  asDialog: boolean;
  now: number;
  /** Tutor's homework (filtered to the lesson's student here). */
  homework: Homework[];
  boardBusy: boolean;
  onClose: () => void;
  onStatus: (s: LessonStatus) => void;
  onTogglePaid: (l: Lesson) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBoard: () => void;
}

/** Google-Calendar-like quick view of a lesson with status / payment / board actions. */
export function LessonPopover(props: LessonPopoverProps) {
  const { asDialog, onClose } = props;
  if (asDialog) {
    return (
      <Dialog open onClose={onClose} size="sm" className="p-5 max-h-[90dvh] overflow-y-auto">
        <PopoverBody {...props} />
      </Dialog>
    );
  }
  return <FloatingCard {...props} />;
}

function FloatingCard(props: LessonPopoverProps) {
  const { anchor, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);

  // Place beside the block (right, else left), clamped to the viewport. Mutates
  // style directly: the card's height is only known after layout.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = el.offsetHeight;
    let left = anchor.right + 8;
    if (left + POPOVER_W > vw - 8) left = anchor.left - POPOVER_W - 8;
    if (left < 8) left = Math.max(8, Math.min(vw - POPOVER_W - 8, anchor.left));
    const top = Math.max(8, Math.min(vh - h - 8, anchor.top));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  });

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={props.lesson.title}
      style={{ width: POPOVER_W, visibility: "hidden" }}
      className="fixed z-70 max-h-[calc(100dvh-16px)] overflow-y-auto rounded-[1.75rem] border border-glass-edge bg-popover shadow-glass-lg p-5 animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <PopoverBody {...props} />
    </div>
  );
}

function PopoverBody({
  lesson,
  members,
  groupName,
  now,
  homework,
  boardBusy,
  onClose,
  onStatus,
  onTogglePaid,
  onEdit,
  onDelete,
  onOpenBoard,
}: LessonPopoverProps) {
  const studentColor = useStudentColor();
  const color = studentColor(lesson.groupId ?? lesson.studentId);
  const group = lesson.groupId ? (members ?? [lesson]) : null;
  const status = lessonStatus(lesson);
  const start = lesson.start.toDate();
  const end = new Date(start.getTime() + lesson.durationMin * MINUTE_MS);
  const studentHw = homework.filter((h) => h.studentId === lesson.studentId);
  // Homework arrives sorted by assignment date, newest first.
  const latest = studentHw[0];
  const overdue = studentHw.filter((h) => isHomeworkOverdue(h, now)).length;
  const hwMeta = latest ? getHomeworkStatusMeta(latest.status, "tutor") : null;
  const live = now >= start.getTime() - 10 * MINUTE_MS && now <= end.getTime();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className={cn("mt-1.5 w-3.5 h-3.5 rounded-[5px] shrink-0", color.dot)} />
        <div className="flex-1 min-w-0">
          <p className={cn("font-heading font-bold text-lg leading-snug", status === "canceled" && "line-through opacity-60")}>
            {lesson.title}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-start gap-1.5">
            <CalendarClock size={13} className="shrink-0 mt-[3px]" />
            <span>
              {WEEKDAYS_FULL[weekdayIndex(start)]}, {formatDayMonth(start)} ·{" "}
              <span className="whitespace-nowrap">
                {formatHm(start)}–{formatHm(end)}
              </span>
            </span>
          </p>
          {lesson.seriesId && (
            <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <Repeat size={11} /> Щотижня
            </p>
          )}
        </div>
        <div className="flex items-center -mr-2 -mt-1">
          <IconButton label="Редагувати" onClick={onEdit}>
            <PenLine size={14} />
          </IconButton>
          <IconButton label="Видалити" tone="danger" onClick={onDelete}>
            <Trash2 size={14} />
          </IconButton>
          <IconButton label="Закрити" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Link
          href={group ? `/tutor/groups/${lesson.groupId}` : `/tutor/students/${lesson.studentId}`}
          className="inline-flex items-center gap-1.5 font-semibold hover:underline underline-offset-4"
        >
          {group ? `👥 ${groupName ?? "Група"} · ${group.length} уч.` : (lesson.studentName ?? "Учень")}
          <ChevronRight size={13} className="text-muted-foreground" />
        </Link>
        {lesson.note && (
          <p className="text-foreground/80 border-l-2 border-border pl-2 whitespace-pre-line">{lesson.note}</p>
        )}
      </div>

      {needsStatus(lesson, now) && (
        <p className="flex items-center gap-1.5 rounded-[1rem] bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs font-medium">
          <AlertCircle size={13} /> Урок минув — позначте статус
        </p>
      )}

      <div className="flex gap-0.5 rounded-full bg-muted/70 p-0.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "h-7 flex-1 rounded-full px-1.5 text-[11px] font-semibold transition-all",
              status === s ? cn(STATUS_ACTIVE[s], "shadow-pill") : "text-muted-foreground hover:bg-glass-strong hover:text-foreground",
            )}
          >
            {LESSON_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {group ? (
        <div className="rounded-[1rem] border border-border/60 py-1.5 px-3 space-y-1">
          <p className="flex items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Оплата
            <span className="normal-case tracking-normal text-[11px]">
              {lesson.price !== undefined ? `${lesson.price.toLocaleString("uk")} ₴ з учня` : "ціну не вказано"}
            </span>
          </p>
          <ul className="max-h-48 overflow-y-auto -mr-1.5 pr-1.5">
            {[...group]
              .sort((a, b) => (a.studentName ?? "").localeCompare(b.studentName ?? "", "uk"))
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-0.5">
                  <Link href={`/tutor/students/${m.studentId}`} className="text-sm truncate hover:underline underline-offset-4">
                    {m.studentName ?? "Учень"}
                  </Link>
                  <PaidSwitch paid={!!m.paid} onToggle={() => onTogglePaid(m)} />
                </li>
              ))}
          </ul>
        </div>
      ) : (
      <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/60 py-1.5 pl-3 pr-1.5">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ціна</span>
          <span className="text-sm font-semibold tabular-nums">
            {lesson.price !== undefined ? `${lesson.price.toLocaleString("uk")} ₴` : "не вказано"}
          </span>
        </p>
        <PaidSwitch paid={!!lesson.paid} onToggle={() => onTogglePaid(lesson)} />
      </div>
      )}

      {!group && (
      <div className="rounded-[1rem] border border-border/60 px-3 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Домашні
            {overdue > 0 && (
              <span className="normal-case tracking-normal text-[11px] text-red-600 dark:text-red-400">прострочено: {overdue}</span>
            )}
          </p>
          <Link
            href={`/tutor/students/${lesson.studentId}`}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Кабінет учня <ChevronRight size={12} />
          </Link>
        </div>
        {latest && hwMeta ? (
          <Link href={`/tutor/homework/${latest.id}`} className="block group">
            <p className="text-sm font-medium truncate group-hover:underline underline-offset-4">{latest.title}</p>
            <p className="flex items-center gap-2 mt-0.5 text-[11px]">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", hwMeta.cls)}>
                <hwMeta.Icon size={10} /> {hwMeta.label}
              </span>
              {latest.dueAt && (
                <span className={cn("text-muted-foreground", isHomeworkOverdue(latest, now) && "text-red-600 dark:text-red-400")}>
                  до {formatDayMonth(latest.dueAt.toDate())}
                </span>
              )}
            </p>
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Домашніх ще не задано</p>
        )}
      </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={onOpenBoard} disabled={boardBusy}>
          {boardBusy ? <Spinner size="sm" /> : <Presentation size={15} />}
          Відкрити дошку
        </Button>
        {lesson.meetingUrl && (
          <a
            href={lesson.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-sm font-semibold transition-all",
              live
                ? "bg-primary text-primary-foreground shadow-pill-dark hover:bg-(--primary-hover)"
                : "border border-glass-edge bg-glass shadow-pill hover:bg-glass-strong",
            )}
          >
            <Video size={15} /> Приєднатися
          </a>
        )}
      </div>
    </div>
  );
}

function PaidSwitch({ paid, onToggle }: { paid: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={paid}
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full text-xs font-semibold transition-colors",
        paid ? "bg-green-600/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
          paid ? "bg-green-600 text-white" : "bg-glass-strong shadow-pill",
        )}
      >
        ₴
      </span>
      {paid ? "Оплачено" : "Не оплачено"}
    </button>
  );
}
