"use client";

import { useCallback, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import {
  Lesson,
  LessonStatus,
  NewLesson,
  createGroupLessons,
  createLesson,
  createLessonSeries,
  deleteLesson,
  deleteLessons,
  groupMembersOf,
  seriesFrom,
  setLessonsBoard,
  updateLesson,
  updateLessonsFrom,
} from "@/lib/lessons";
import { createBoard, getBoard } from "@/lib/boards";
import { updateGroup, type StudentGroup } from "@/lib/groups";
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
  /** New group lesson: one copy per member of this group (`studentId` is then empty). */
  groupId?: string;
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
  groups: StudentGroup[];
  askScope: AskScope;
}

/**
 * Every write the calendar makes. Moves and quick edits are applied optimistically
 * through `overrides` and dropped again once Firestore has the change (or reverted on error).
 */
export function useLessonActions({ tutorId, tutorName, serverLessons, students, groups, askScope }: Options) {
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
      // A group lesson moves with all its members' copies.
      const members = groupMembersOf(lessons, lesson);
      const own = conflictFor(members, shift, durationMin);
      if (own) {
        toast.error(conflictMessage(own));
        return;
      }
      const shifted = (list: Lesson[]): Overrides =>
        Object.fromEntries(list.map((l) => [l.id, { start: Timestamp.fromMillis(l.start.toMillis() + shift), durationMin }]));
      const moveOccurrence = () =>
        optimistic(
          shifted(members),
          () => updateLessonsFrom(members, lesson, { durationMin }, shift ? start : undefined),
          "Не вдалося перенести урок",
        );
      if (!lesson.seriesId) {
        await moveOccurrence();
        return;
      }
      // Keep the block where it was dropped while the tutor picks the scope.
      setPatches(shifted(members));
      const ids = members.map((l) => l.id);
      const scope = await askScope(shift ? "Перенести урок?" : "Змінити тривалість?");
      if (!scope) {
        clearPatches(ids);
        return;
      }
      if (scope === "one") {
        await moveOccurrence();
        return;
      }
      const targets = seriesFrom(lessons, lesson);
      const c = conflictFor(targets, shift, durationMin);
      if (c) {
        clearPatches(ids);
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

  /** Status of the whole occurrence (every member's copy of a group lesson). */
  const setStatus = useCallback(
    (lesson: Lesson, status: LessonStatus) => {
      const members = groupMembersOf(lessons, lesson);
      return optimistic(
        Object.fromEntries(members.map((l) => [l.id, { status }])),
        () => (members.length === 1 ? updateLesson(lesson.id, { status }) : updateLessonsFrom(members, lesson, { status })),
        "Не вдалося змінити статус",
      );
    },
    [lessons, optimistic],
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
      let ids = groupMembersOf(lessons, lesson).map((l) => l.id);
      if (lesson.seriesId) {
        const scope = await askScope("Видалити урок?", {
          description: lesson.groupId ? "Урок зникне з календаря у вас і в учнів групи." : "Урок зникне з календаря у вас і в учня.",
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

  /**
   * The student's board: one per student, shared by all their lessons. Older data may
   * have a board per lesson; then the most recent lesson's board becomes the student's.
   */
  const studentBoardId = useCallback(
    (studentId: string): string | undefined => {
      let latest: Lesson | undefined;
      for (const l of lessons) {
        // Group lessons use the group's board, not the student's own.
        if (l.groupId || l.studentId !== studentId || !l.boardId) continue;
        if (!latest || l.start.toMillis() > latest.start.toMillis()) latest = l;
      }
      return latest?.boardId;
    },
    [lessons],
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
        if (!v.id && v.groupId) {
          const group = groups.find((g) => g.id === v.groupId);
          const members = group ? students.filter((s) => group.studentIds.includes(s.studentId)) : [];
          if (!group || !members.length) {
            toast.error(group ? "У групі немає учнів" : "Групу не знайдено");
            return false;
          }
          const n = await createGroupLessons(
            {
              tutorId,
              tutorName,
              title: common.title,
              durationMin: v.durationMin,
              price: v.price,
              start: Timestamp.fromDate(v.start),
              note: v.note.trim() || undefined,
              meetingUrl: v.meetingUrl.trim() || undefined,
              groupId: group.id,
              groupName: group.name,
              boardId: group.boardId,
            },
            members.map((m) => ({ studentId: m.studentId, studentName: m.studentName })),
            v.repeatUntil,
          );
          toast.success(v.repeatUntil ? `Створено занять групи «${group.name}»: ${n}` : `Урок групи «${group.name}» створено`);
          return true;
        }
        if (!v.id) {
          const data: NewLesson = {
            ...common,
            tutorId,
            tutorName,
            start: Timestamp.fromDate(v.start),
            note: v.note.trim() || undefined,
            meetingUrl: v.meetingUrl.trim() || undefined,
            boardId: studentBoardId(v.studentId),
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
        if (lesson.groupId) {
          // Group lesson: the same edit for every member's copy (members can't be swapped here).
          const groupPatch: Partial<Lesson> = {
            title: common.title,
            durationMin: v.durationMin,
            price: v.price,
            note: v.note.trim(),
            meetingUrl: v.meetingUrl.trim(),
          };
          const gShift = v.start.getTime() - lesson.start.toMillis();
          const gScope = lesson.seriesId ? await askScope("Зберегти зміни?") : "one";
          if (!gScope) return false;
          const gTargets = gScope === "one" ? groupMembersOf(lessons, lesson) : seriesFrom(lessons, lesson);
          const gc = conflictFor(gTargets, gShift, v.durationMin);
          if (gc) {
            toast.error(conflictMessage(gc));
            return false;
          }
          await updateLessonsFrom(gTargets, lesson, groupPatch, gShift ? v.start : undefined);
          return true;
        }
        // Empty strings clear the fields (undefined would be skipped by Firestore).
        const patch: Partial<Lesson> = { ...common, note: v.note.trim(), meetingUrl: v.meetingUrl.trim() };
        // Moved to another student: the lesson now uses that student's board ("" = none yet).
        if (v.studentId !== lesson.studentId) patch.boardId = studentBoardId(v.studentId) ?? "";
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
    [askScope, conflictFor, groups, lessons, studentBoardId, students, tutorId, tutorName],
  );

  /** Opens the student's board in a new tab, creating it on first use, and links it to all their lessons. */
  const openBoard = useCallback(
    async (lesson: Lesson) => {
      // Open the tab synchronously (inside the click) so popup blockers allow it.
      const tab = window.open("about:blank", "_blank");
      setBoardBusy(lesson.id);
      try {
        // A group lesson opens the group's board (kept on the group), shared by its members.
        const group = lesson.groupId ? groups.find((g) => g.id === lesson.groupId) : undefined;
        const known = lesson.groupId ? (group?.boardId ?? lesson.boardId) : studentBoardId(lesson.studentId);
        // The board may have been deleted from the boards list since.
        let boardId = known && (await getBoard(known)) ? known : undefined;
        if (!boardId) {
          const who = lesson.groupId ? (group?.name ?? lesson.groupName ?? "група") : (lesson.studentName ?? "учень");
          boardId = await createBoard(tutorId, tutorName ?? "", `Уроки — ${who}`);
        }
        if (group && group.boardId !== boardId) await updateGroup(group.id, { boardId });
        if (tab) tab.location.href = `/board/${boardId}`;
        else window.open(`/board/${boardId}`, "_blank");

        const id = boardId;
        const unlinked = lessons.filter((l) =>
          l.boardId !== id && (lesson.groupId ? l.groupId === lesson.groupId : l.studentId === lesson.studentId && !l.groupId),
        );
        if (unlinked.length) {
          await optimistic(
            Object.fromEntries(unlinked.map((l) => [l.id, { boardId: id }])),
            () => setLessonsBoard(unlinked.map((l) => l.id), id),
            "Не вдалося привʼязати дошку до уроків",
          );
        }
      } catch {
        tab?.close();
        toast.error("Не вдалося відкрити дошку");
      } finally {
        setBoardBusy(null);
      }
    },
    [groups, lessons, optimistic, studentBoardId, tutorId, tutorName],
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
