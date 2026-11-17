import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  addDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { docsOf } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";
import type { QuestionResult, ScaleType, ScoreRow, TestDoc, TestQuestion } from "@/lib/tests";

/**
 * A test given by link for a set time window (like «На Урок»): anyone with the link
 * enters their name and takes it between `opensAt` and `closesAt`; the teacher sees
 * every attempt. The public doc holds only what the waiting screen needs; the
 * questions sit in `content/main`, readable by students only while it is open
 * (see firestore.rules).
 */
export interface Assignment {
  id: string;
  ownerId: string;
  ownerName: string;
  testId: string;
  title: string;
  questionCount: number;
  /** Minutes one attempt may last; also capped by `closesAt`. */
  durationMinutes: number;
  opensAt: Timestamp;
  closesAt: Timestamp;
  createdAt: Timestamp | null;
}

export interface AssignmentContent {
  subtitle: string;
  questions: TestQuestion[];
  scoreTable: ScoreRow[];
  scaleType: ScaleType;
}

/** One student's submitted attempt. */
export interface Attempt {
  id: string;
  firstName: string;
  lastName: string;
  /** Set when the student was signed in. */
  uid?: string;
  answers: Record<string, string>;
  /** Question id → photo of the written solution. */
  answerImages?: Record<string, string>;
  questions: QuestionResult[];
  rawScore: number;
  nmtScore: number;
  maxRaw: number;
  timeSpent: number;
  /** Submitted by the timer when the window closed. */
  auto: boolean;
  submittedAt: Timestamp | null;
}

export type AssignmentStatus = "scheduled" | "open" | "closed";

export function assignmentStatus(a: Pick<Assignment, "opensAt" | "closesAt">, now: number): AssignmentStatus {
  if (now < a.opensAt.toMillis()) return "scheduled";
  if (now < a.closesAt.toMillis()) return "open";
  return "closed";
}

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  scheduled: "Заплановано",
  open: "Триває",
  closed: "Завершено",
};

/** Status chip colours. */
export const STATUS_CLS: Record<AssignmentStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  open: "bg-green-500/10 text-green-700 dark:text-green-400",
  closed: "bg-muted text-muted-foreground",
};

export function formatWindow(a: Assignment): string {
  const o = a.opensAt.toDate();
  const c = a.closesAt.toDate();
  const day = (d: Date) => d.toLocaleDateString("uk", { day: "numeric", month: "short" });
  const hm = (d: Date) => d.toLocaleTimeString("uk", { hour: "2-digit", minute: "2-digit" });
  return day(o) === day(c) ? `${day(o)}, ${hm(o)}–${hm(c)}` : `${day(o)} ${hm(o)} – ${day(c)} ${hm(c)}`;
}

/** Where students open it. */
export function assignmentPath(id: string): string {
  return `/a/${id}`;
}

const col = collection(db, "testAssignments");
const contentRef = (id: string) => doc(db, "testAssignments", id, "content", "main");
const attemptsCol = (id: string) => collection(db, "testAssignments", id, "attempts");

export interface NewAssignment {
  ownerId: string;
  ownerName: string;
  test: TestDoc;
  title: string;
  durationMinutes: number;
  opensAt: Date;
  closesAt: Date;
}

/** Creates the assignment with a copy of the test's questions. Returns its id. */
export async function createAssignment(a: NewAssignment): Promise<string> {
  const ref = doc(col);
  const batch = writeBatch(db);
  batch.set(ref, {
    ownerId: a.ownerId,
    ownerName: a.ownerName,
    testId: a.test.id,
    title: a.title.trim() || a.test.title,
    questionCount: a.test.questions.length,
    durationMinutes: a.durationMinutes,
    opensAt: Timestamp.fromDate(a.opensAt),
    closesAt: Timestamp.fromDate(a.closesAt),
    createdAt: serverTimestamp(),
  });
  const content: AssignmentContent = {
    subtitle: a.test.subtitle ?? "",
    questions: a.test.questions,
    scoreTable: a.test.scoreTable ?? [],
    scaleType: a.test.scaleType ?? "nmt",
  };
  batch.set(contentRef(ref.id), content);
  await batch.commit();
  return ref.id;
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const snap = await getDoc(doc(col, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Assignment) : null;
}

/** The questions; readable by students only while the assignment is open. */
export async function getAssignmentContent(id: string): Promise<AssignmentContent | null> {
  const snap = await getDoc(contentRef(id));
  return snap.exists() ? (snap.data() as AssignmentContent) : null;
}

export function subscribeAssignment(id: string, cb: (a: Assignment | null) => void): () => void {
  return onSnapshot(
    doc(col, id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Assignment) : null),
    // Not readable (e.g. rules not published yet) counts as missing, not as loading forever.
    () => cb(null),
  );
}

/** The teacher's assignments, newest window first. */
export function subscribeMyAssignments(ownerId: string, cb: (list: Assignment[]) => void): () => void {
  return onSnapshot(
    query(col, where("ownerId", "==", ownerId)),
    (snap) => cb(docsOf<Assignment>(snap).sort((a, b) => b.opensAt.toMillis() - a.opensAt.toMillis())),
    (err) => {
      console.warn("[assignments] cannot read:", err.code);
      cb([]);
    },
  );
}

export async function setAssignmentTimes(id: string, opensAt: Date, closesAt: Date): Promise<void> {
  await updateDoc(doc(col, id), { opensAt: Timestamp.fromDate(opensAt), closesAt: Timestamp.fromDate(closesAt) });
}

/** Deletes the assignment with its questions and attempts. */
export async function deleteAssignment(id: string): Promise<void> {
  const attempts = await getDocs(attemptsCol(id));
  for (let i = 0; i < attempts.docs.length; i += 450) {
    const batch = writeBatch(db);
    for (const d of attempts.docs.slice(i, i + 450)) batch.delete(d.ref);
    await batch.commit();
  }
  await deleteDoc(contentRef(id));
  await deleteDoc(doc(col, id));
}

export function subscribeAttempts(id: string, cb: (list: Attempt[]) => void): () => void {
  return onSnapshot(
    attemptsCol(id),
    (snap) =>
      cb(
        docsOf<Attempt>(snap).sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "uk"),
        ),
      ),
    () => cb([]),
  );
}

export async function submitAttempt(id: string, attempt: Omit<Attempt, "id" | "submittedAt">): Promise<string> {
  const data: Record<string, unknown> = { ...attempt, submittedAt: serverTimestamp() };
  if (!attempt.uid) delete data.uid;
  const ref = await addDoc(attemptsCol(id), data);
  return ref.id;
}

export async function deleteAttempt(assignmentId: string, attemptId: string): Promise<void> {
  await deleteDoc(doc(db, "testAssignments", assignmentId, "attempts", attemptId));
}
