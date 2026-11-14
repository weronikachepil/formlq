"use client";

import { useCallback, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import {
  Lesson,
  LessonStatus,
  NewLesson,
  createLesson,
  createLessonSeries,
  deleteLesson,
  deleteLessons,
  seriesFrom,
  updateLesson,
  updateLessonsFrom,
} from "@/lib/lessons";
import { createBoard } from "@/lib/boards";
import { formatShortDate } from "@/lib/calendar";
import { conflictMessage, findConflict } from "./lesson-utils";
import type { CalendarStudent, SeriesScope } from "./types";

type Overrides = Record<string, Partial<Lesson>>;
type AskScope = (
  title: string,
  opts?: { description?: string; destructive?: boolean },
) => Promise<SeriesScope | null>;

/** Values produced by the lesson dialog. */
export interface LessonFormValues {
  id?: string;
  studentId: string;
  title: string;
  start: Date;
  durationMin: number;
  price?: number;
  note: string;
  meetingUrl: string;
  /** New lessons only: repeat weekly until this date (inclusive). */
  repeatUntil?: Date;
}

interface Options {
  tutorId: string;
  tutorName?: string;
  /** Lessons from the Firestore snapshot. */
  serverLessons: Lesson[];
  students: CalendarStudent[];
  askScope: AskScope;
}

/**
 * Every write the calendar makes. Moves and quick edits are applied optimistically
 * through `overrides` and dropped again once Firestore has the change (or reverted on error).
 */
export function useLessonActions({ tutorId, tutorName, serverLessons, students, askScope }: Options) {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [boardBusy, setBoardBusy] = useState<string | null>(null);

  /** Lessons as displayed: snapshot + optimistic patches. */
  const lessons = useMemo(
    () =>
      Object.keys(overrides).length === 0
        ? serverLessons
        : serverLessons.map((l) => (overrides[l.id] ? { ...l, ...overrides[l.id] } : l)),
    [serverLessons, overrides],
  );

  const setPatches = useCallback((patches: Overrides) => {
    setOverrides((prev) => ({ ...prev, ...patches }));
  }, []);
  const clearPatches = useCallback((ids: string[]) => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  /** Shows `patches` right away, runs `write`, then hands display back to the snapshot. */
  const optimistic = useCallback(
    async (patches: Overrides, write: () => Promise<void>, error: string): Promise<boolean> => {
      setPatches(patches);
      try {
        await write();
        return true;
      } catch {
        toast.error(error);
        return false;
      } finally {
        clearPatches(Object.keys(patches));
      }
    },
    [setPatches, clearPatches],
  );

  /** First conflict of `targets` shifted by `shiftMs` (new duration optional), or null. */
  const conflictFor = useCallback(
    (targets: Lesson[], shiftMs: number, durationMin?: number) => {
      const ids = new Set(targets.map((l) => l.id));
      for (const l of targets) {
        const s = l.start.toMillis() + shiftMs;
        const c = findConflict(lessons, s, s + (durationMin ?? l.durationMin) * 60000, ids);
        if (c) return c;
      }
      return null;
    },
    [lessons],
  );

  /** Drag-and-drop move/resize. */
  const moveLesson = useCallback(
    async (lesson: Lesson, start: Date, durationMin: number) => {
      const shift = start.getTime() - lesson.start.toMillis();
      if (!shift && durationMin === lesson.durationMin) return;
      const own = conflictFor([lesson], shift, durationMin);
      if (own) {
        toast.error(conflictMessage(own));
        return;
      }
      const patch: Partial<Lesson> = { start: Timestamp.fromDate(start), durationMin };
      if (!lesson.seriesId) {
        await optimistic({ [lesson.id]: patch }, () => updateLesson(lesson.id, patch), "Не вдалося перенести урок");
        return;
      }
      // Keep the block where it was dropped while the tutor picks the scope.
      setPatches({ [lesson.id]: patch });
      const scope = await askScope(shift ? "Перенести урок?" : "Змінити тривалість?");
      if (!scope) {
        clearPatches([lesson.id]);
        return;
      }
      if (scope === "one") {
        await optimistic({ [lesson.id]: patch }, () => updateLesson(lesson.id, patch), "Не вдалося перенести урок");
        return;
      }
      const targets = seriesFrom(lessons, lesson);
      const c = conflictFor(targets, shift, durationMin);
      if (c) {
        clearPatches([lesson.id]);
        toast.error(conflictMessage(c));
        return;
      }
      const patches: Overrides = {};
      for (const l of targets) {
        patches[l.id] = { start: Timestamp.fromMillis(l.start.toMillis() + shift), durationMin };
      }
      await optimistic(
        patches,
        () => updateLessonsFrom(targets, lesson, { durationMin }, shift ? start : undefined),
        "Не вдалося перенести уроки",
      );
    },
    [askScope, clearPatches, conflictFor, lessons, optimistic, setPatches],
  );

  const setStatus = useCallback(
    (lesson: Lesson, status: LessonStatus) =>
      optimistic({ [lesson.id]: { status } }, () => updateLesson(lesson.id, { status }), "Не вдалося змінити статус"),
    [optimistic],
  );

  const togglePaid = useCallback(
    (lesson: Lesson) => {
      const paid = !lesson.paid;
      return optimistic({ [lesson.id]: { paid } }, () => updateLesson(lesson.id, { paid }), "Не вдалося зберегти оплату");
    },
    [optimistic],
  );

  /** Returns true when something was deleted. Non-series lessons are confirmed by the caller. */
  const removeLesson = useCallback(
    async (lesson: Lesson): Promise<boolean> => {
      let ids = [lesson.id];
      if (lesson.seriesId) {
        const scope = await askScope("Видалити урок?", {
          description: "Урок зникне з календаря у вас і в учня.",
          destructive: true,
        });
        if (!scope) return false;
        if (scope === "following") ids = seriesFrom(lessons, lesson).map((l) => l.id);
      }
      try {
        if (ids.length === 1) await deleteLesson(ids[0]);
        else await deleteLessons(ids);
        return true;
      } catch {
        toast.error("Не вдалося видалити урок. Спробуйте ще раз");
        return false;
      }
    },
    [askScope, lessons],
  );

  /** Create or edit from the dialog. Returns true when the dialog may close. */
  const saveLesson = useCallback(
    async (v: LessonFormValues): Promise<boolean> => {
      const student = students.find((s) => s.studentId === v.studentId);
      const common = {
        studentId: v.studentId,
        studentName: student?.studentName,
        title: v.title.trim() || "Урок",
        durationMin: v.durationMin,
        price: v.price,
      };
      try {
        if (!v.id) {
          const data: NewLesson = {
            ...common,
            tutorId,
            tutorName,
            start: Timestamp.fromDate(v.start),
            note: v.note.trim() || undefined,
            meetingUrl: v.meetingUrl.trim() || undefined,
          };
          if (v.repeatUntil) {
            const n = await createLessonSeries(data, v.repeatUntil);
            toast.success(`Створено уроків: ${n}`);
          } else {
            await createLesson(data);
          }
          return true;
        }

        const lesson = lessons.find((l) => l.id === v.id);
        if (!lesson) return true;
        // Empty strings clear the fields (undefined would be skipped by Firestore).
        const patch = { ...common, note: v.note.trim(), meetingUrl: v.meetingUrl.trim() };
        const shift = v.start.getTime() - lesson.start.toMillis();
        const scope = lesson.seriesId ? await askScope("Зберегти зміни?") : "one";
        if (!scope) return false;
        const targets = scope === "one" ? [lesson] : seriesFrom(lessons, lesson);
        const c = conflictFor(targets, shift, v.durationMin);
        if (c) {
          toast.error(conflictMessage(c));
          return false;
        }
        if (scope === "one") {
          await updateLesson(lesson.id, { ...patch, start: Timestamp.fromDate(v.start) });
        } else {
          await updateLessonsFrom(targets, lesson, patch, shift ? v.start : undefined);
        }
        return true;
      } catch {
        // Keep the form open with what was typed.
        toast.error("Не вдалося зберегти урок. Спробуйте ще раз");
        return false;
      }
    },
    [askScope, conflictFor, lessons, students, tutorId, tutorName],
  );

  /** Opens the lesson's whiteboard in a new tab, creating (and linking) it on first use. */
  const openBoard = useCallback(
    async (lesson: Lesson) => {
      if (lesson.boardId) {
        window.open(`/board/${lesson.boardId}`, "_blank", "noopener");
        return;
      }
      // Open the tab synchronously (inside the click) so popup blockers allow it.
      const tab = window.open("about:blank", "_blank");
      setBoardBusy(lesson.id);
      try {
        const title = `${lesson.title} — ${lesson.studentName ?? "учень"}, ${formatShortDate(lesson.start.toDate())}`;
        const boardId = await createBoard(tutorId, tutorName ?? "", title);
        await optimistic({ [lesson.id]: { boardId } }, () => updateLesson(lesson.id, { boardId }), "Не вдалося привʼязати дошку");
        if (tab) tab.location.href = `/board/${boardId}`;
        else window.open(`/board/${boardId}`, "_blank");
      } catch {
        tab?.close();
        toast.error("Не вдалося створити дошку");
      } finally {
        setBoardBusy(null);
      }
    },
    [optimistic, tutorId, tutorName],
  );

  return {
    lessons,
    boardBusy,
    moveLesson,
    setStatus,
    togglePaid,
    removeLesson,
    saveLesson,
    openBoard,
    conflictFor,
  };
}
