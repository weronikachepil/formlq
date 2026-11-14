"use client";

import { useState } from "react";
import { Repeat, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lesson, MAX_SERIES_LESSONS } from "@/lib/lessons";
import { addDays, addMonths, weeklyOccurrences } from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { SelectNative } from "@/components/ui/select-native";
import { TextInput } from "@/components/ui/text-field";
import { conflictMessage, findConflict, lastPriceFor } from "./lesson-utils";
import type { LessonFormValues } from "./useLessonActions";
import type { CalendarStudent } from "./types";

/** Form state: strings as the inputs hold them. */
export interface LessonDraft {
  id?: string;
  seriesId?: string;
  studentId: string;
  title: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  durationMin: number;
  price: string;
  note: string;
  meetingUrl: string;
  repeat: boolean;
  until: string; // yyyy-mm-dd
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseDraftStart(d: LessonDraft): Date | null {
  const t = new Date(`${d.date}T${d.time || "00:00"}`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** End of the "until" day, so a lesson on that date is included. */
function parseUntil(s: string): Date | null {
  const t = new Date(`${s}T23:59:59`);
  return Number.isNaN(t.getTime()) ? null : t;
}

export function newLessonDraft(
  start: Date,
  durationMin: number,
  studentId: string,
  lessons: Lesson[],
): LessonDraft {
  const price = studentId ? lastPriceFor(lessons, studentId) : undefined;
  // Default series end: three months ahead.
  const until = addMonths(start, 3);
  until.setDate(start.getDate());
  return {
    studentId,
    title: "Урок",
    date: toDateInput(start),
    time: toTimeInput(start),
    durationMin,
    price: price !== undefined ? String(price) : "",
    note: "",
    meetingUrl: "",
    repeat: false,
    until: toDateInput(until),
  };
}

export function lessonDraft(l: Lesson): LessonDraft {
  const start = l.start.toDate();
  return {
    id: l.id,
    seriesId: l.seriesId,
    studentId: l.studentId,
    title: l.title,
    date: toDateInput(start),
    time: toTimeInput(start),
    durationMin: l.durationMin,
    price: l.price !== undefined ? String(l.price) : "",
    note: l.note ?? "",
    meetingUrl: l.meetingUrl ?? "",
    repeat: false,
    until: toDateInput(addMonths(start, 3)),
  };
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="block text-xs font-semibold text-muted-foreground px-1">{label}</span>
      {children}
    </label>
  );
}

interface LessonDialogProps {
  draft: LessonDraft | null;
  students: CalendarStudent[];
  lessons: Lesson[];
  onClose: () => void;
  onSave: (v: LessonFormValues) => Promise<boolean>;
}

export function LessonDialog({ draft, ...rest }: LessonDialogProps) {
  return (
    <Dialog
      open={!!draft}
      onClose={rest.onClose}
      size="sm"
      // A stray click/Escape must not discard a half-filled lesson.
      closeOnEscape={false}
      closeOnBackdrop={false}
      className="p-5 max-h-[92dvh] overflow-y-auto"
    >
      {/* Keyed so each opening starts from its own draft. */}
      {draft && <LessonForm key={draft.id ?? `${draft.date}T${draft.time}`} initial={draft} {...rest} />}
    </Dialog>
  );
}

function LessonForm({
  initial,
  students,
  lessons,
  onClose,
  onSave,
}: Omit<LessonDialogProps, "draft"> & { initial: LessonDraft }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<LessonDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const isNew = !d.id;

  const start = parseDraftStart(d);
  const until = d.repeat && isNew ? parseUntil(d.until) : null;
  const count = start && until ? weeklyOccurrences(start, until, MAX_SERIES_LESSONS) : 1;

  // Anti-overlap: every occurrence the save would create/move (series: weekly).
  let conflict: Lesson | null = null;
  if (start) {
    const exclude = new Set(d.id ? [d.id] : []);
    for (let i = 0; i < count && !conflict; i++) {
      const s = addDays(start, i * 7).getTime();
      conflict = findConflict(lessons, s, s + d.durationMin * 60000, exclude);
    }
  }

  const priceNum = d.price.trim() === "" ? undefined : Number(d.price);
  const priceInvalid = priceNum !== undefined && (!Number.isFinite(priceNum) || priceNum < 0);
  const canSave = !busy && !!d.studentId && !!start && !conflict && !priceInvalid && (!d.repeat || !isNew || !!until);

  async function save() {
    if (!canSave || !start) return;
    setBusy(true);
    const ok = await onSave({
      id: d.id,
      studentId: d.studentId,
      title: d.title,
      start,
      durationMin: d.durationMin,
      price: priceNum,
      note: d.note,
      meetingUrl: d.meetingUrl,
      repeatUntil: until ?? undefined,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-bold">{isNew ? "Новий урок" : "Редагувати урок"}</p>
          {d.seriesId && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Repeat size={11} /> Урок щотижневої серії
            </p>
          )}
        </div>
        <IconButton label="Закрити" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>

      <div className="space-y-2.5">
        <Field label="Учень">
          <SelectNative
            value={d.studentId}
            onChange={(e) => {
              const studentId = e.target.value;
              const patch: Partial<LessonDraft> = { studentId };
              // New lesson: prefill this student's usual price.
              if (isNew) {
                const p = lastPriceFor(lessons, studentId);
                patch.price = p !== undefined ? String(p) : "";
              }
              set(patch);
            }}
          >
            <option value="">Оберіть...</option>
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.studentName}
              </option>
            ))}
          </SelectNative>
        </Field>
        <Field label="Назва">
          <TextInput value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <Field label="Дата">
            <TextInput type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className="px-3" />
          </Field>
          <Field label="Час">
            <TextInput type="time" step={900} value={d.time} onChange={(e) => set({ time: e.target.value })} className="px-3" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Тривалість (хв)">
            <TextInput
              type="number"
              min={15}
              step={15}
              value={d.durationMin}
              onChange={(e) => set({ durationMin: Math.max(15, Number(e.target.value) || 60) })}
            />
          </Field>
          <Field label="Ціна, ₴">
            <TextInput
              type="number"
              min={0}
              step={50}
              inputMode="numeric"
              placeholder="—"
              value={d.price}
              onChange={(e) => set({ price: e.target.value })}
              aria-invalid={priceInvalid}
            />
          </Field>
        </div>

        {isNew && (
          <div className="rounded-2xl border border-border/60 px-3 py-2.5 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={d.repeat}
                onChange={(e) => set({ repeat: e.target.checked })}
                className="w-4 h-4 accent-(--primary)"
              />
              <Repeat size={14} className="text-muted-foreground" /> Повторювати щотижня
            </label>
            {d.repeat && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">до</span>
                <TextInput
                  type="date"
                  size="sm"
                  min={d.date}
                  value={d.until}
                  onChange={(e) => set({ until: e.target.value })}
                  className="w-auto flex-1"
                />
              </div>
            )}
            {d.repeat && until && (
              <p className="text-xs text-muted-foreground">
                Буде створено уроків: <b className="text-foreground">{count}</b>
                {count >= MAX_SERIES_LESSONS && ` (максимум ${MAX_SERIES_LESSONS})`}
              </p>
            )}
          </div>
        )}

        <Field label="Нотатка (необовʼязково)">
          <TextInput value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        <Field label="Посилання на онлайн-кімнату (необовʼязково)">
          <TextInput
            type="url"
            value={d.meetingUrl}
            onChange={(e) => set({ meetingUrl: e.target.value })}
            placeholder="https://meet.google.com/..."
          />
        </Field>
      </div>

      {conflict && <p className="text-xs text-red-500 px-1">{conflictMessage(conflict)}.</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Скасувати
        </Button>
        <Button size="sm" onClick={save} disabled={!canSave}>
          {busy ? "Збереження…" : isNew && d.repeat ? `Створити ${count}` : "Зберегти"}
        </Button>
      </div>
    </div>
  );
}
