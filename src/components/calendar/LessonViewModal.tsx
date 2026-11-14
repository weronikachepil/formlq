"use client";

import { useEffect, useState } from "react";
import { CalendarClock, GraduationCap, Presentation, Repeat, User, Video, X } from "lucide-react";
import { LESSON_STATUS_LABEL, Lesson, LessonStatus, lessonEndMs, lessonStatus } from "@/lib/lessons";
import { MINUTE_MS, WEEKDAYS_FULL, formatDayMonth, formatHm, weekdayIndex } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";

const STATUS_BADGE: Record<Exclude<LessonStatus, "planned">, string> = {
  done: "bg-green-500/10 text-green-700 dark:text-green-400",
  canceled: "bg-muted text-muted-foreground",
  missed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

/** Join is available from this long before the start until the lesson ends. */
const JOIN_EARLY_MS = 5 * MINUTE_MS;

/** "Відкрити дошку" / "Приєднатися" buttons, shared by the modal and the upcoming lists. */
export function LessonActions({
  lesson,
  now,
  size = "md",
  className,
}: {
  lesson: Lesson;
  now: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const status = lessonStatus(lesson);
  const off = status === "canceled" || status === "missed";
  const start = lesson.start.toMillis();
  const end = lessonEndMs(lesson);
  const canJoin = !off && now >= start - JOIN_EARLY_MS && now <= end;
  // The board stays useful after the lesson (notes); the call link doesn't.
  const showJoin = !!lesson.meetingUrl && !off && now <= end;
  if (!lesson.boardId && !showJoin) return null;

  const h = size === "sm" ? "h-7 text-xs px-3" : "flex-1 h-10 text-sm px-4";
  return (
    <div className={cn("flex gap-2", className)}>
      {lesson.boardId && (
        <a
          href={`/board/${lesson.boardId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold border border-glass-edge bg-glass shadow-pill hover:bg-glass-strong transition-colors",
            h,
          )}
        >
          <Presentation size={size === "sm" ? 13 : 15} /> {size === "sm" ? "Дошка" : "Відкрити дошку"}
        </a>
      )}
      {showJoin &&
        (canJoin ? (
          <a
            href={lesson.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold bg-primary text-primary-foreground shadow-pill-dark hover:bg-(--primary-hover) transition-all",
              h,
            )}
          >
            <Video size={size === "sm" ? 13 : 15} /> Приєднатися
          </a>
        ) : (
          size === "md" && (
            <span
              title="Кнопка стане активною за 5 хв до початку"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold bg-muted text-muted-foreground cursor-not-allowed",
                h,
              )}
            >
              <Video size={15} /> Приєднатися
            </span>
          )
        ))}
    </div>
  );
}

/**
 * Lesson details popup used by the student calendar, the dashboard and admin.
 * The "join" button is time-gated: active from 5 min before start until the lesson ends.
 */
export function LessonViewModal({
  lesson,
  onClose,
  colorDot,
  hideStudent,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  /** Colour swatch class of the lesson (calendar colour); defaults to the primary colour. */
  colorDot?: string;
  /** The viewer is the student — don't repeat their own name. */
  hideStudent?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!lesson) return null;

  const start = lesson.start.toDate();
  const end = new Date(lessonEndMs(lesson));
  const status = lessonStatus(lesson);
  const upcoming = status === "planned" && end.getTime() >= now && lesson.meetingUrl;
  const joinSoon = upcoming && now < start.getTime() - JOIN_EARLY_MS;

  return (
    <Dialog open onClose={onClose} size="sm" className="p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
      <div className="flex items-start gap-3">
        <span className={cn("mt-1.5 w-3.5 h-3.5 rounded-[5px] shrink-0", colorDot ?? "bg-primary")} />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-heading font-bold text-lg leading-snug",
              status === "canceled" && "line-through opacity-60",
            )}
          >
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
        <IconButton label="Закрити" onClick={onClose} className="-mr-2 -mt-1">
          <X size={15} />
        </IconButton>
      </div>

      {status !== "planned" && (
        <p className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_BADGE[status])}>
          {LESSON_STATUS_LABEL[status]}
        </p>
      )}

      {(lesson.tutorName || (lesson.studentName && !hideStudent) || lesson.note) && (
        <div className="space-y-1.5 text-sm">
          {lesson.tutorName && (
            <p className="flex items-center gap-2">
              <GraduationCap size={15} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Вчитель:</span>
              <span className="font-semibold truncate">{lesson.tutorName}</span>
            </p>
          )}
          {lesson.studentName && !hideStudent && (
            <p className="flex items-center gap-2">
              <User size={15} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Учень:</span>
              <span className="font-semibold truncate">{lesson.studentName}</span>
            </p>
          )}
          {lesson.note && (
            <p className="text-foreground/80 border-l-2 border-border pl-2 whitespace-pre-line">{lesson.note}</p>
          )}
        </div>
      )}

      <LessonActions lesson={lesson} now={now} />
      {joinSoon && (
        <p className="-mt-2 text-center text-[11px] text-muted-foreground">
          Кнопка «Приєднатися» стане активною за 5 хв до початку
        </p>
      )}
    </Dialog>
  );
}
