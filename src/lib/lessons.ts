import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { docsOf } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";
import { addDays, weeklyOccurrences } from "@/lib/calendar";

/** planned → happened (`done`) / tutor cancelled (`canceled`) / student didn't come (`missed`). */
export type LessonStatus = "planned" | "done" | "canceled" | "missed";

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  planned: "Заплановано",
  done: "Проведено",
  canceled: "Скасовано",
  missed: "Пропущено",
};

export interface Lesson {
  id: string;
  tutorId: string;
  tutorName?: string;
  studentId: string;
  studentName?: string;
  title: string;
  start: Timestamp;
  durationMin: number;
  note?: string;
  meetingUrl?: string; // Zoom / Google Meet link
  /** Shared by every occurrence of a weekly lesson. */
  seriesId?: string;
  /** Missing on older lessons = "planned". */
  status?: LessonStatus;
  /** Price in UAH. */
  price?: number;
  paid?: boolean;
  /** The student's whiteboard (src/lib/boards.ts): the same one on every lesson with them. */
  boardId?: string;
}

export const lessonStatus = (l: Pick<Lesson, "status">): LessonStatus => l.status ?? "planned";
export const lessonEndMs = (l: Pick<Lesson, "start" | "durationMin">) =>
  l.start.toMillis() + l.durationMin * 60000;

export type NewLesson = Omit<Lesson, "id">;

export async function createLesson(data: NewLesson): Promise<string> {
  const ref = await addDoc(collection(db, "lessons"), data);
  return ref.id;
}

export async function updateLesson(
  id: string,
  patch: Partial<Lesson>,
): Promise<void> {
  await updateDoc(doc(db, "lessons", id), patch);
}

export async function deleteLesson(id: string): Promise<void> {
  await deleteDoc(doc(db, "lessons", id));
}

function sortByStart(list: Lesson[]): Lesson[] {
  return [...list].sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

export function subscribeTutorLessons(
  tutorId: string,
  cb: (list: Lesson[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "lessons"), where("tutorId", "==", tutorId)),
    (snap) =>
      cb(
        sortByStart(
          docsOf<Lesson>(snap),
        ),
      ),
  );
}

export function subscribeStudentLessons(
  studentId: string,
  cb: (list: Lesson[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "lessons"), where("studentId", "==", studentId)),
    (snap) =>
      cb(
        sortByStart(
          docsOf<Lesson>(snap),
        ),
      ),
  );
}

// --- Weekly series ----------------------------------------------------------

/** Upper bound for one series, so a typo in the end date can't create thousands of docs. */
export const MAX_SERIES_LESSONS = 52;

/**
 * Creates a lesson every week from `data.start` until `until` (inclusive), each a
 * separate document sharing a `seriesId`, so any single one can be moved,
 * cancelled or marked paid on its own. Returns the number created.
 */
export async function createLessonSeries(data: NewLesson, until: Date): Promise<number> {
  const seriesId = doc(collection(db, "lessons")).id;
  const first = data.start.toDate();
  const batch = writeBatch(db);
  // Same wall-clock time every week, also across DST changes; the count matches
  // the preview in the lesson dialog.
  const n = weeklyOccurrences(first, until, MAX_SERIES_LESSONS);
  for (let i = 0; i < n; i++) {
    const start = Timestamp.fromDate(addDays(first, i * 7));
    batch.set(doc(collection(db, "lessons")), { ...data, seriesId, start });
  }
  await batch.commit();
  return n;
}

/** Points the given lessons at one board: all lessons with a student share theirs. */
export async function setLessonsBoard(ids: string[], boardId: string): Promise<void> {
  // A batch holds at most 500 writes.
  for (let i = 0; i < ids.length; i += 500) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 500)) batch.update(doc(db, "lessons", id), { boardId });
    await batch.commit();
  }
}

/** Lessons of the same series starting at or after `from` (incl. `from` itself). */
export function seriesFrom(all: Lesson[], from: Lesson): Lesson[] {
  if (!from.seriesId) return [from];
  const t = from.start.toMillis();
  return all.filter((l) => l.seriesId === from.seriesId && l.start.toMillis() >= t);
}

/**
 * Applies an edit to this and the following lessons of a series. A time change is
 * applied as a shift (same weekday offset / clock change for every occurrence).
 */
export async function updateLessonsFrom(
  lessons: Lesson[],
  anchor: Lesson,
  patch: Partial<Omit<Lesson, "id" | "start">>,
  newStart?: Date,
): Promise<void> {
  const shift = newStart ? newStart.getTime() - anchor.start.toMillis() : 0;
  const batch = writeBatch(db);
  for (const l of lessons) {
    const next: Partial<Lesson> = { ...patch };
    if (shift) next.start = Timestamp.fromMillis(l.start.toMillis() + shift);
    batch.update(doc(db, "lessons", l.id), next);
  }
  await batch.commit();
}

export async function deleteLessons(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids) batch.delete(doc(db, "lessons", id));
  await batch.commit();
}
