"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, Repeat, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lesson, MAX_SERIES_LESSONS, groupMembersOf } from "@/lib/lessons";
import type { StudentGroup } from "@/lib/groups";
import { addDays, addMonths, weeklyOccurrences } from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectItem, SelectLabel } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-field";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { conflictMessage, findConflict, lastPriceFor } from "./lesson-utils";
import type { LessonFormValues } from "./useLessonActions";
import type { CalendarStudent } from "./types";

/** Form state: strings as the inputs hold them. */
export interface LessonDraft {
  id?: string;
  seriesId?: string;
  studentId: string;
  /** Group lesson (then `studentId` is empty): new ones go to every member. */
  groupId: string;
  /** Name shown when the group no longer exists. */
  groupName?: string;
  /** Edited group lesson: its members' copies, which must not count as conflicts. */
  excludeIds?: string[];
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

/** The usual lengths: one tap instead of typing. */
const DURATIONS = [45, 60, 90];

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
    groupId: "",
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

export function lessonDraft(l: Lesson, all: Lesson[]): LessonDraft {
  const start = l.start.toDate();
  return {
    id: l.id,
    seriesId: l.seriesId,
    studentId: l.groupId ? "" : l.studentId,
    groupId: l.groupId ?? "",
    groupName: l.groupName,
    excludeIds: l.groupId ? groupMembersOf(all, l).map((x) => x.id) : undefined,
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
  groups: StudentGroup[];
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
      className="max-w-md p-6 max-h-[92dvh] overflow-y-auto"
    >
      {/* Keyed so each opening starts from its own draft. */}
      {draft && <LessonForm key={draft.id ?? `${draft.date}T${draft.time}`} initial={draft} {...rest} />}
    </Dialog>
  );
}

function LessonForm({
  initial,
  students,
  groups,
  lessons,
  onClose,
  onSave,
}: Omit<LessonDialogProps, "draft"> & { initial: LessonDraft }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Typed text of the "other" length, so "120" can be typed digit by digit.
  const [otherDur, setOtherDur] = useState(() => (DURATIONS.includes(initial.durationMin) ? "" : String(initial.durationMin)));
  const set = (patch: Partial<LessonDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const isNew = !d.id;

  const start = parseDraftStart(d);
  const until = d.repeat && isNew ? parseUntil(d.until) : null;
  const count = start && until ? weeklyOccurrences(start, until, MAX_SERIES_LESSONS) : 1;

  // Anti-overlap: every occurrence the save would create/move (series: weekly).
  let conflict: Lesson | null = null;
  if (start) {
    const exclude = new Set(d.excludeIds ?? (d.id ? [d.id] : []));
    for (let i = 0; i < count && !conflict; i++) {
      const s = addDays(start, i * 7).getTime();
      conflict = findConflict(lessons, s, s + d.durationMin * 60000, exclude);
    }
  }

  const priceNum = d.price.trim() === "" ? undefined : Number(d.price);
  const priceInvalid = priceNum !== undefined && (!Number.isFinite(priceNum) || priceNum < 0);
  const group = d.groupId ? groups.find((g) => g.id === d.groupId) : undefined;
  const groupSize = group ? students.filter((s) => group.studentIds.includes(s.studentId)).length : 0;
  const canSave = !busy && (!!d.studentId || (!!d.groupId && (!isNew || groupSize > 0))) && !!start && !conflict && !priceInvalid && (!d.repeat || !isNew || !!until);

  async function save() {
    if (!canSave || !start) return;
    setBusy(true);
    const ok = await onSave({
      id: d.id,
      studentId: d.studentId,
      groupId: d.groupId || undefined,
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint/60 text-[#14262a] dark:bg-mint/25 dark:text-foreground">
          {isNew ? <CalendarPlus size={20} /> : <Pencil size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-bold leading-tight">{isNew ? "Новий урок" : "Редагувати урок"}</p>
          {d.seriesId && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Repeat size={11} /> Урок щотижневої серії
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Закрити"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <X size={17} />
        </button>
      </div>

      <div className="space-y-2.5">
        <Field label={groups.length && (isNew || d.groupId) ? "Учень або група" : "Учень"}>
          <Select
            value={d.groupId ? `g:${d.groupId}` : d.studentId}
            // An existing group lesson stays with its group (members are separate copies).
            disabled={!isNew && !!d.groupId}
            className="w-full"
            onValueChange={(v) => {
              const groupId = v.startsWith("g:") ? v.slice(2) : "";
              const studentId = groupId ? "" : v;
              const patch: Partial<LessonDraft> = { studentId, groupId };
              // New lesson: prefill this student's (or group's) usual price.
              if (isNew) {
                const p = groupId ? lastPriceFor(lessons, groupId, true) : lastPriceFor(lessons, studentId);
                patch.price = p !== undefined ? String(p) : "";
              }
              set(patch);
            }}
          >
            <SelectItem value="">
              <span className="text-muted-foreground">Оберіть...</span>
            </SelectItem>
            {(isNew || d.groupId) && (groups.length > 0 || !!d.groupId) && (
              <>
                <SelectLabel>Групи</SelectLabel>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={`g:${g.id}`}>
                    <Users size={13} className="inline -mt-0.5 mr-1.5 text-muted-foreground" />
                    {g.name} <span className="text-muted-foreground">· {g.studentIds.length}</span>
                  </SelectItem>
                ))}
                {d.groupId && !group && <SelectItem value={`g:${d.groupId}`}>
                    <Users size={13} className="inline -mt-0.5 mr-1.5 text-muted-foreground" />
                    {d.groupName ?? "Група"}
                  </SelectItem>}
              </>
            )}
            {(!d.groupId || isNew) && (
              <>
                {groups.length > 0 && <SelectLabel>Учні</SelectLabel>}
                {students.map((s) => (
                  <SelectItem key={s.studentId} value={s.studentId}>
                    {s.studentName}
                  </SelectItem>
                ))}
              </>
            )}
          </Select>
          {group && isNew && (
            <span className="block text-xs text-muted-foreground px-1 pt-0.5">
              {groupSize
                ? `Урок зʼявиться в календарі кожного учня групи (${groupSize}); ціна — за кожного.`
                : "У групі немає учнів — додайте їх на сторінці «Учні»."}
            </span>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_7.5rem] gap-2">
          <Field label="Предмет / тема">
            <TextInput value={d.title} onChange={(e) => set({ title: e.target.value })} />
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
              className="tabular-nums"
            />
          </Field>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <Field label="Дата">
            <DatePicker value={d.date} onChange={(date) => set({ date })} />
          </Field>
          <Field label="Час">
            <TimePicker value={d.time} onChange={(time) => set({ time })} />
          </Field>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-semibold text-muted-foreground px-1">Тривалість</span>
          <div role="radiogroup" aria-label="Тривалість" className="grid grid-cols-4 gap-1.5">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={d.durationMin === m}
                onClick={() => {
                  setOtherDur("");
                  set({ durationMin: m });
                }}
                className={cn(
                  "h-10 rounded-[12px] text-sm font-semibold tabular-nums transition-colors",
                  d.durationMin === m
                    ? "bg-primary text-primary-foreground shadow-pill-dark"
                    : "border border-glass-edge bg-glass shadow-pill hover:bg-glass-strong",
                )}
              >
                {m} хв
              </button>
            ))}
            <label className="relative">
              <span className="sr-only">Інша тривалість, хв</span>
              <TextInput
                type="number"
                min={15}
                step={15}
                placeholder="інша"
                value={otherDur}
                onChange={(e) => {
                  setOtherDur(e.target.value);
                  const n = Math.round(Number(e.target.value));
                  if (n >= 15) set({ durationMin: n });
                }}
                onBlur={() => {
                  if (otherDur && Math.round(Number(otherDur)) < 15) setOtherDur("");
                }}
                className={cn("tabular-nums text-center", !DURATIONS.includes(d.durationMin) && "ring-2 ring-ring/40")}
              />
            </label>
          </div>
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
                <DatePicker size="sm" min={d.date} value={d.until} onChange={(until) => set({ until })} className="flex-1" />
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

      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button variant="ghost" size="lg" className="bg-muted hover:bg-muted/70" onClick={onClose}>
          Скасувати
        </Button>
        <Button size="lg" onClick={save} disabled={!canSave}>
          {busy ? "Збереження…" : isNew && d.repeat ? `Створити ${count}` : "Зберегти"}
        </Button>
      </div>
    </div>
  );
}
