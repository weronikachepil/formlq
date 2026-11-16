import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  documentId,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { docsOf } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";
import { getUserByEmail, getUserById } from "@/lib/users";
import { canTutor } from "@/lib/roles";
import { getTest, type TestQuestion, type ScoreRow, type ScaleType } from "@/lib/tests";

// --- Tutor ↔ Student link ---------------------------------------------------

export interface TutorStudent {
  id: string; // `${tutorId}_${studentId}`
  tutorId: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  createdAt: Timestamp | null;
}

/**
 * Link a student to a tutor by email. Returns the created (or existing) link.
 * Throws a user-facing message if no user with that email exists.
 */
export async function addStudentByEmail(
  tutorId: string,
  email: string,
): Promise<TutorStudent> {
  const student = await getUserByEmail(email);
  if (!student) throw new Error("Користувача з таким email не знайдено");
  if (student.uid === tutorId) throw new Error("Не можна додати себе як учня");
  if (canTutor(student.role)) throw new Error("Вчителя чи редактора не можна додати як учня");

  const id = `${tutorId}_${student.uid}`;
  const ref = doc(db, "tutorStudents", id);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("Цей учень вже доданий");

  const data = {
    tutorId,
    studentId: student.uid,
    studentEmail: student.email,
    studentName: student.displayName || student.email,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id, ...data, createdAt: null } as TutorStudent;
}

/** Create a tutor↔student link (editor-only). */
async function linkTutorStudent(
  tutorId: string,
  studentId: string,
): Promise<TutorStudent> {
  if (tutorId === studentId) throw new Error("Не можна призначити себе вчителем");
  const student = await getUserById(studentId);
  if (canTutor(student?.role)) throw new Error("Вчителю чи редактору не можна призначити вчителя");
  const id = `${tutorId}_${studentId}`;
  const ref = doc(db, "tutorStudents", id);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("Цей вчитель вже призначений");

  const data = {
    tutorId,
    studentId,
    studentEmail: student?.email ?? "",
    studentName: student?.displayName || student?.email || "Учень",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id, ...data, createdAt: null } as TutorStudent;
}

/** Assign a tutor (by id) to a student. Editor-only. */
export async function assignTutorById(
  studentId: string,
  tutorId: string,
): Promise<TutorStudent> {
  return linkTutorStudent(tutorId, studentId);
}

export async function removeStudent(linkId: string): Promise<void> {
  await deleteDoc(doc(db, "tutorStudents", linkId));
}

/** Uids among `uids` whose current role is tutor or editor. */
async function staffAmong(uids: string[]): Promise<Set<string>> {
  // Firestore `in` takes at most 30 values; the chunks are fetched in parallel.
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  const snaps = await Promise.all(
    chunks.map((ids) => getDocs(query(collection(db, "users"), where(documentId(), "in", ids)))),
  );
  const staff = new Set<string>();
  for (const snap of snaps) for (const d of snap.docs) if (canTutor(d.data().role)) staff.add(d.id);
  return staff;
}

/**
 * Tutors and editors never get homework or lessons as students, even if an old
 * link says so (e.g. the user was promoted later); hide such links.
 */
async function onlyStudents(links: TutorStudent[]): Promise<TutorStudent[]> {
  if (!links.length) return links;
  const staff = await staffAmong([...new Set(links.map((l) => l.studentId))]);
  return links.filter((l) => !staff.has(l.studentId));
}

export async function getTutorStudents(
  tutorId: string,
): Promise<TutorStudent[]> {
  const snap = await getDocs(
    query(collection(db, "tutorStudents"), where("tutorId", "==", tutorId)),
  );
  return onlyStudents(docsOf<TutorStudent>(snap));
}

/** Links where this user is the student — i.e. the tutors they belong to. */
export async function getStudentTutorLinks(
  studentId: string,
): Promise<TutorStudent[]> {
  const snap = await getDocs(
    query(collection(db, "tutorStudents"), where("studentId", "==", studentId)),
  );
  return docsOf<TutorStudent>(snap);
}

/**
 * Live list of a tutor's students. Staff accounts are filtered out unless
 * `includeStaff` (the admin view, so stale links can still be removed).
 */
export function subscribeTutorStudents(
  tutorId: string,
  cb: (list: TutorStudent[]) => void,
  { includeStaff = false }: { includeStaff?: boolean } = {},
): () => void {
  let seq = 0;
  return onSnapshot(
    query(collection(db, "tutorStudents"), where("tutorId", "==", tutorId)),
    (snap) => {
      const links = docsOf<TutorStudent>(snap);
      if (includeStaff) return cb(links);
      // Drop results of an older snapshot that resolves after a newer one.
      const mine = ++seq;
      onlyStudents(links)
        .then((list) => mine === seq && cb(list))
        .catch(() => mine === seq && cb(links));
    },
  );
}

// --- Homework ---------------------------------------------------------------

export type HomeworkSource = "test" | "custom";
export type HomeworkStatus = "assigned" | "in_progress" | "completed";

export interface Homework {
  id: string;
  tutorId: string;
  tutorName?: string;
  studentId: string;
  studentName?: string;
  title: string;
  note?: string;
  pdfUrl?: string; // optional конспект (PDF) shown to the student like reference materials
  source: HomeworkSource;
  testId?: string; // source === "test"
  /**
   * The questions the student solves: picked from the bank (source "custom"), or a copy of
   * the test taken when it was assigned (source "test"), so students never need to read the
   * test itself (drafts stay private to their authors). Old "test" homework may lack it.
   */
  questions?: TestQuestion[];
  /** The test's description, copied with its questions (source "test"). */
  subtitle?: string;
  scoreTable: ScoreRow[];
  scaleType: ScaleType;
  durationMinutes: number;
  assignedAt: Timestamp | null;
  dueAt?: Timestamp | null;
  status: HomeworkStatus;
  resultId?: string;
  /**
   * Given to a whole group: every member gets their own copy; the copies share `assignId`
   * (one column of the group's results table). Absent on homework for one student.
   */
  groupId?: string;
  groupName?: string;
  assignId?: string;
  // Saved while the student is mid-attempt — lets them resume later.
  progress?: {
    answers: Record<string, string>;
    answerImages?: Record<string, string>;
  };
}

export type NewHomework = Omit<
  Homework,
  "id" | "assignedAt" | "status" | "resultId"
>;

export async function assignHomework(data: NewHomework): Promise<string> {
  const ref = await addDoc(collection(db, "homework"), {
    ...data,
    status: "assigned" as HomeworkStatus,
    assignedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Gives the same homework to every member of a group in one batch: one copy per student
 * (so students' queries and rules are unchanged), linked by a shared `assignId`.
 * Returns the number of copies written.
 */
export async function assignHomeworkToGroup(
  data: Omit<NewHomework, "studentId" | "studentName" | "groupId" | "groupName" | "assignId">,
  group: { id: string; name: string },
  members: { studentId: string; studentName?: string }[],
): Promise<number> {
  const col = collection(db, "homework");
  const assignId = doc(col).id;
  // Firestore batches hold at most 500 writes.
  for (let i = 0; i < members.length; i += 500) {
    const batch = writeBatch(db);
    for (const m of members.slice(i, i + 500)) {
      batch.set(doc(col), {
        ...data,
        studentId: m.studentId,
        studentName: m.studentName,
        groupId: group.id,
        groupName: group.name,
        assignId,
        status: "assigned" as HomeworkStatus,
        assignedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return members.length;
}

export async function getHomework(id: string): Promise<Homework | null> {
  const snap = await getDoc(doc(db, "homework", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Homework;
}

export async function updateHomework(
  id: string,
  patch: Partial<Homework>,
): Promise<void> {
  await updateDoc(doc(db, "homework", id), patch);
}

/**
 * Changes the deadline (`null` removes it). With `wholeGroup`, every copy of a group
 * homework (same `assignId`) gets it. Returns the number of homework updated.
 */
export async function setHomeworkDue(
  hw: Pick<Homework, "id" | "tutorId" | "assignId">,
  dueAt: Timestamp | null,
  wholeGroup = false,
): Promise<number> {
  if (!wholeGroup || !hw.assignId) {
    await updateDoc(doc(db, "homework", hw.id), { dueAt });
    return 1;
  }
  // tutorId in the query too: the homework rules let tutors read only their own.
  const snap = await getDocs(
    query(collection(db, "homework"), where("tutorId", "==", hw.tutorId), where("assignId", "==", hw.assignId)),
  );
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + 500)) batch.update(d.ref, { dueAt });
    await batch.commit();
  }
  return snap.size;
}

/**
 * Homework given from a test before questions were copied into it: copies them now (once),
 * so students keep access after the rules stopped letting them read unpublished tests.
 * `tutorId` = that tutor's homework; `null` (editors) = everyone's. Returns how many were updated.
 */
export async function backfillHomeworkQuestions(tutorId: string | null): Promise<number> {
  const col = collection(db, "homework");
  const snap = await getDocs(
    tutorId ? query(col, where("tutorId", "==", tutorId), where("source", "==", "test")) : query(col, where("source", "==", "test")),
  );
  const todo = docsOf<Homework>(snap).filter((h) => h.testId && !h.questions?.length);
  if (!todo.length) return 0;
  const tests = new Map<string, Awaited<ReturnType<typeof getTest>>>();
  for (const id of new Set(todo.map((h) => h.testId!))) tests.set(id, await getTest(id).catch(() => null));
  let n = 0;
  let batch = writeBatch(db);
  for (const h of todo) {
    const t = tests.get(h.testId!);
    if (!t?.questions?.length) continue;
    batch.update(doc(col, h.id), { questions: t.questions, subtitle: t.subtitle ?? "" });
    if (++n % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (n % 500) await batch.commit();
  return n;
}

export async function deleteHomework(id: string): Promise<void> {
  await deleteDoc(doc(db, "homework", id));
}

function sortByAssigned(list: Homework[]): Homework[] {
  return [...list].sort(
    (a, b) => (b.assignedAt?.toMillis() ?? 0) - (a.assignedAt?.toMillis() ?? 0),
  );
}

export function subscribeTutorHomework(
  tutorId: string,
  cb: (list: Homework[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "homework"), where("tutorId", "==", tutorId)),
    (snap) =>
      cb(
        sortByAssigned(
          docsOf<Homework>(snap),
        ),
      ),
  );
}

/** One student's homework from this tutor (the tutor's student cabinet). */
export function subscribeTutorStudentHomework(
  tutorId: string,
  studentId: string,
  cb: (list: Homework[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, "homework"),
      where("tutorId", "==", tutorId),
      where("studentId", "==", studentId),
    ),
    (snap) => cb(sortByAssigned(docsOf<Homework>(snap))),
  );
}

export async function getStudentHomework(
  studentId: string,
): Promise<Homework[]> {
  const snap = await getDocs(
    query(collection(db, "homework"), where("studentId", "==", studentId)),
  );
  return sortByAssigned(
    docsOf<Homework>(snap),
  );
}

export function subscribeStudentHomework(
  studentId: string,
  cb: (list: Homework[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "homework"), where("studentId", "==", studentId)),
    (snap) =>
      cb(
        sortByAssigned(
          docsOf<Homework>(snap),
        ),
      ),
  );
}
