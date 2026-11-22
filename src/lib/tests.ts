import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  writeBatch,
  Timestamp,
  deleteField,
  increment,
  runTransaction,
} from "firebase/firestore";
import { docsOf } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface MCQQuestion {
  id: string;
  type: "mcq";
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  explanationImageUrl?: string;
  points: number;
  order: number;
}

export interface OpenQuestion {
  id: string;
  type: "open";
  text: string;
  imageUrl?: string;
  correctAnswer: string;
  /** Numeric answers: accepted within ± this much of `correctAnswer` (absent = exact). */
  tolerance?: number;
  explanation: string;
  explanationImageUrl?: string;
  points: number;
  order: number;
}

export interface MatchingItem {
  id: string;
  text: string;
}

export interface MatchingQuestion {
  id: string;
  type: "matching";
  text: string;
  imageUrl?: string;
  leftItems: MatchingItem[];
  rightOptions: MatchingItem[];
  correctPairs: Record<string, string>; // leftId → rightId
  explanation: string;
  explanationImageUrl?: string;
  points: number;
  order: number;
}

/** Several correct options; answer = JSON array of option ids. */
export interface MultiQuestion {
  id: string;
  type: "multi";
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
  explanationImageUrl?: string;
  points: number;
  order: number;
}

/** Put items in order; `items` are stored in the correct order. Answer = JSON array of item ids. */
export interface OrderQuestion {
  id: string;
  type: "order";
  text: string;
  imageUrl?: string;
  items: MatchingItem[];
  explanation: string;
  explanationImageUrl?: string;
  points: number;
  order: number;
}

export type TestQuestion =
  | MCQQuestion
  | OpenQuestion
  | MatchingQuestion
  | MultiQuestion
  | OrderQuestion;

type BankMeta = {
  topicId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  status?: "draft" | "approved" | "rejected";
  reviewNote?: string;
  dailyOrder?: number;
};

export type BankMCQQuestion = Omit<MCQQuestion, "points" | "order"> & BankMeta;
export type BankOpenQuestion = Omit<OpenQuestion, "points" | "order"> &
  BankMeta;
export type BankMatchingQuestion = Omit<MatchingQuestion, "points" | "order"> &
  BankMeta;
export type BankQuestion =
  | BankMCQQuestion
  | BankOpenQuestion
  | BankMatchingQuestion;

/** Default points per question type (НМТ convention): mcq 1, open 2, matching 3. */
export const DEFAULT_POINTS = { mcq: 1, open: 2, matching: 3, multi: 2, order: 2 } as const;

/** Convert a bank question into a test question (strips bank meta, adds points + order). */
export function bankToTestQuestion(
  bq: BankQuestion,
  order: number,
): TestQuestion {
  const {
    topicId: _t,
    difficulty: _d,
    status: _s,
    reviewNote: _r,
    dailyOrder: _o,
    ...rest
  } = bq as BankQuestion & { dailyOrder?: number };
  return { ...rest, points: DEFAULT_POINTS[rest.type], order } as TestQuestion;
}

export function makeEmptyBankMCQ(topicId: string): BankMCQQuestion {
  return {
    id: crypto.randomUUID(),
    type: "mcq",
    topicId,
    text: "",
    options: [
      { id: "А", text: "" },
      { id: "Б", text: "" },
      { id: "В", text: "" },
      { id: "Г", text: "" },
      { id: "Д", text: "" },
    ],
    correctOptionId: "А",
    explanation: "",
    difficulty: 1,
    status: "draft",
  };
}

export function makeEmptyBankOpen(topicId: string): BankOpenQuestion {
  return {
    id: crypto.randomUUID(),
    type: "open",
    topicId,
    text: "",
    correctAnswer: "",
    explanation: "",
    difficulty: 1,
    status: "draft",
  };
}

export function makeEmptyBankMatching(topicId: string): BankMatchingQuestion {
  return {
    id: crypto.randomUUID(),
    type: "matching",
    topicId,
    text: "",
    leftItems: [
      { id: "1", text: "" },
      { id: "2", text: "" },
      { id: "3", text: "" },
    ],
    rightOptions: [
      { id: "А", text: "" },
      { id: "Б", text: "" },
      { id: "В", text: "" },
      { id: "Г", text: "" },
      { id: "Д", text: "" },
    ],
    correctPairs: { "1": "А", "2": "Б", "3": "В" },
    explanation: "",
    difficulty: 1,
    status: "draft",
  };
}

// raw score → scaled score (NMT 100–200, or a custom scale)
export interface ScoreRow {
  raw: number;
  nmt: number; // scaled score for this raw bracket
}

/** Which part of the maths course a test covers. */
export type TestSubject = "algebra" | "geometry" | "mixed";

export const SUBJECT_LABEL: Record<TestSubject, string> = {
  algebra: "Алгебра",
  geometry: "Геометрія",
  mixed: "Алгебра і геометрія",
};

/** School grades a test can be marked for. */
export const GRADES = [5, 6, 7, 8, 9, 10, 11] as const;

// "nmt" = official НМТ scale (100–200, ≥5 raw to pass);
// "custom" = teacher-defined scale, any numbers, no minimum
export type ScaleType = "nmt" | "custom";

export interface TestDoc {
  id: string;
  title: string;
  subtitle: string;
  published: boolean;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  questions: TestQuestion[];
  scoreTable: ScoreRow[];
  scaleType?: ScaleType; // defaults to "nmt" when absent
  durationMinutes?: number;
  order?: number;
  folderId?: string | null; // testFolders doc id; absent/null = not in a folder
  linkAccess?: LinkAccess; // who can open it by link/QR, independent of `published`
  /** @deprecated Early boolean form of linkAccess "anyone"; cleared on the next save. */
  publicAccess?: boolean;
  /**
   * A teacher's own test (`createdBy` is the teacher): only they edit it. They may
   * publish it to the catalog, with a description (`subtitle`) and their name shown.
   */
  personal?: boolean;
  /** Teacher's name shown in the catalog (personal tests). */
  authorName?: string;
  /** School grade (5–11) the test is for; null/absent = not set. */
  grade?: number | null;
  /** Algebra, geometry or both; null/absent = not set. */
  subject?: TestSubject | null;
  /** When the test was first published to the catalog (the catalog lists newest first). */
  publishedAt?: Timestamp | null;
  /** How many different people have finished it (from the catalog); see markTestTaken. */
  takers?: number;
}

/**
 * Who can open a test by its link/QR (like Google Docs link sharing):
 * "off" — nobody beyond the catalog; "students" — any signed-in user;
 * "anyone" — no account needed (the result isn't saved).
 * `published` is separate: it only controls the student catalog.
 */
export type LinkAccess = "off" | "students" | "anyone";

/** Stored link access, falling back to the legacy `publicAccess` flag. */
export function getLinkAccess(
  t: Pick<TestDoc, "linkAccess" | "publicAccess">,
): LinkAccess {
  return t.linkAccess ?? (t.publicAccess ? "anyone" : "off");
}

/** What actually works: a published test is always open to signed-in students. */
export function effectiveLinkAccess(
  t: Pick<TestDoc, "published" | "linkAccess" | "publicAccess">,
): LinkAccess {
  const stored = getLinkAccess(t);
  return t.published && stored === "off" ? "students" : stored;
}

/** Where a signed-in student takes a test (result is saved to their history). */
export function studentTestPath(id: string): string {
  return `/dashboard/exam/${id}`;
}

/** Account-free attempt; works only with linkAccess "anyone". */
export function publicTestPath(id: string): string {
  return `/t/${id}`;
}

export interface TestFolder {
  id: string;
  name: string;
  order: number;
  createdAt: Timestamp | null;
  /** Set on a teacher's own folders; absent = a platform folder. */
  ownerId?: string;
}

export interface QuestionResult {
  id: string;
  type: TestQuestion["type"];
  text: string;
  imageUrl?: string | null;
  explanationImageUrl?: string | null;
  points: number;
  userAnswer: string;
  isCorrect: boolean;
  partialScore?: number; // earned points for partial matching (0 < partialScore < points)
  explanation?: string;
  // MCQ
  options?: QuestionOption[];
  correctOptionId?: string;
  // Open
  correctAnswer?: string;
  tolerance?: number;
  // Matching
  leftItems?: MatchingItem[];
  rightOptions?: MatchingItem[];
  correctPairs?: Record<string, string>;
  // Multi
  correctOptionIds?: string[];
  // Order (items in the correct order)
  items?: MatchingItem[];
}

export interface TestResult {
  id: string;
  userId: string;
  testId: string;
  testTitle: string;
  testSubtitle: string;
  completedAt: Timestamp | null;
  timeSpent: number;
  rawScore: number;
  nmtScore: number; // scaled score
  maxRaw: number;
  answers: Record<string, string>;
  questions: QuestionResult[];
  scoreTable: ScoreRow[];
  scaleType?: ScaleType; // defaults to "nmt" when absent
  // --- Homework extensions (absent on regular self-taken tests) ---
  homeworkId?: string; // set when this result came from a tutor assignment
  answerImages?: Record<string, string>; // questionId → uploaded photo url (open answers)
  flaggedQuestions?: string[]; // questionIds the student flagged with a duck 🦆
  tutorComments?: Record<string, string>; // questionId → tutor's note
  tutorNote?: string; // overall tutor note on the attempt
  reviewedAt?: Timestamp | null; // set when tutor has reviewed
}

export async function saveTestResult(
  data: Omit<TestResult, "id" | "completedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "testResults"), {
    ...data,
    completedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getResult(id: string): Promise<TestResult | null> {
  const snap = await getDoc(doc(db, "testResults", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TestResult;
}

export async function updateResult(
  id: string,
  patch: Partial<TestResult>,
): Promise<void> {
  await updateDoc(doc(db, "testResults", id), patch);
}

export async function getUserResults(userId: string): Promise<TestResult[]> {
  const q = query(collection(db, "testResults"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return docsOf<TestResult>(snap).sort((a, b) => {
    const ta = a.completedAt?.toMillis() ?? 0;
    const tb = b.completedAt?.toMillis() ?? 0;
    return tb - ta;
  });
}

/** Questions answered wrong, partly or skipped in a saved attempt. */
export function countMistakes(r: Pick<TestResult, "questions">): number {
  return (r.questions ?? []).filter((q) => !q.isCorrect).length;
}

/** Open-answer comparison key: trimmed, "." and "," treated as the same decimal separator. */
export function normalizeOpenAnswer(s: string): string {
  return s.trim().replace(/\./g, ",");
}

/** A number typed with "," or "." and optional spaces ("1 000,5"); NaN when not a number. */
function parseNumber(s: string): number {
  const t = s.trim().replace(/\s+/g, "").replace(",", ".").replace(/[−–]/, "-");
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
}

/**
 * Whether an open answer matches. "." and "," are the same decimal separator; numbers are
 * compared as numbers (1,50 = 1.5 = 1,5; .5 = 0,5), within `tolerance` when set.
 * Anything else is compared as text, ignoring case and surrounding spaces.
 */
export function openAnswerCorrect(answer: string, correct: string, tolerance?: number): boolean {
  const a = parseNumber(answer);
  const c = parseNumber(correct);
  if (Number.isFinite(a) && Number.isFinite(c)) {
    // A tiny epsilon so 0.1 + 0.2-style float noise doesn't reject a boundary answer.
    return Math.abs(a - c) <= Math.max(0, tolerance ?? 0) + 1e-9;
  }
  return normalizeOpenAnswer(answer).toLowerCase() === normalizeOpenAnswer(correct).toLowerCase();
}

/** A JSON-array answer (multi / order); [] when empty or malformed. */
export function parseListAnswer(answer: string | undefined): string[] {
  if (!answer) return [];
  try {
    const v = JSON.parse(answer);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Points for one answer. `correct` = full marks; partial credit for matching (share of
 * pairs), multi (right picks minus wrong picks, over the right ones) and order (items
 * in their place).
 */
export function scoreQuestion(q: TestQuestion, answer: string | undefined): { score: number; correct: boolean } {
  const a = answer ?? "";
  const share = (got: number, of: number) => {
    const k = of > 0 ? Math.max(0, got) / of : 0;
    return { score: Math.round(q.points * Math.min(1, k)), correct: of > 0 && got >= of };
  };
  switch (q.type) {
    case "mcq": {
      const ok = !!a && a === q.correctOptionId;
      return { score: ok ? q.points : 0, correct: ok };
    }
    case "open": {
      const ok = !!a.trim() && openAnswerCorrect(a, q.correctAnswer, q.tolerance);
      return { score: ok ? q.points : 0, correct: ok };
    }
    case "matching": {
      let pairs: Record<string, string> = {};
      try {
        pairs = a ? (JSON.parse(a) as Record<string, string>) : {};
      } catch {
        /* invalid json */
      }
      const keys = Object.keys(q.correctPairs);
      return share(keys.filter((k) => pairs[k] === q.correctPairs[k]).length, keys.length);
    }
    case "multi": {
      const picked = new Set(parseListAnswer(a));
      const right = new Set(q.correctOptionIds);
      let hits = 0;
      let wrong = 0;
      for (const id of picked) {
        if (right.has(id)) hits++;
        else wrong++;
      }
      const r = share(hits - wrong, right.size);
      return { score: r.score, correct: r.correct && wrong === 0 };
    }
    case "order": {
      const got = parseListAnswer(a);
      if (got.length === 0) return { score: 0, correct: false };
      return share(q.items.filter((it, i) => got[i] === it.id).length, q.items.length);
    }
  }
}

export function calcRawScore(
  questions: TestQuestion[],
  answers: Record<string, string>,
): number {
  return questions.reduce((sum, q) => sum + scoreQuestion(q, answers[q.id]).score, 0);
}

export function rawToNMT(raw: number, scoreTable: ScoreRow[]): number {
  if (!scoreTable.length) return 100;
  const sorted = [...scoreTable].sort((a, b) => a.raw - b.raw);
  const match = sorted.findLast((r) => r.raw <= raw);
  return match?.nmt ?? sorted[0].nmt;
}

export function maxRawScore(questions: TestQuestion[]): number {
  return questions.reduce((s, q) => s + q.points, 0);
}

/** Top scaled score in a table (denominator for the result, e.g. 200 for НМТ). */
export function maxScaledScore(scoreTable: ScoreRow[]): number {
  if (!scoreTable.length) return 0;
  return Math.max(...scoreTable.map((r) => r.nmt));
}

/** Identity scale: each raw point maps to itself (0..maxRaw). Default for custom. */
export function makeLinearTable(maxRaw: number): ScoreRow[] {
  const top = Math.max(0, maxRaw);
  return Array.from({ length: top + 1 }, (_, r) => ({ raw: r, nmt: r }));
}

/** НМТ counts a test as failed below 5 raw points; custom scales have no minimum. */
export function isExamFailed(
  rawScore: number,
  scaleType: ScaleType = "nmt",
): boolean {
  return scaleType === "nmt" && rawScore < 5;
}

/** Publication time used for the catalog order: tests published before it was stored use createdAt. */
export const publishedMillis = (t: Pick<TestDoc, "publishedAt" | "createdAt">): number =>
  (t.publishedAt ?? t.createdAt)?.toMillis() ?? 0;

export async function getPublishedTests(): Promise<TestDoc[]> {
  // Server-side filter: drafts (with their full question arrays) are never downloaded.
  const snap = await getDocs(
    query(collection(db, "tests"), where("published", "==", true)),
  );
  // Newest first.
  return docsOf<TestDoc>(snap).sort((a, b) => publishedMillis(b) - publishedMillis(a));
}

/**
 * Counts a person who finished a test — from the catalog, by link or as homework made from
 * it — once per person: a marker doc
 * tests/{id}/takers/{uid} plus `takers + 1`, in one transaction (firestore.rules allow
 * exactly this). Never throws: counting must not get in the way of saving a result.
 */
export async function markTestTaken(testId: string, uid: string): Promise<void> {
  try {
    const marker = doc(db, "tests", testId, "takers", uid);
    await runTransaction(db, async (tx) => {
      if ((await tx.get(marker)).exists()) return;
      tx.set(marker, { at: serverTimestamp() });
      tx.update(doc(db, "tests", testId), { takers: increment(1) });
    });
  } catch (e) {
    console.warn("[tests] не вдалося врахувати проходження", e);
  }
}

/**
 * Editors: counts the people who have already finished each test (results saved before the
 * counter existed), homework made from the test included, and writes the markers, so their
 * next attempts are not counted again.
 */
export async function recountTestTakers(): Promise<{ tests: number; people: number }> {
  const snap = await getDocs(collection(db, "testResults"));
  const byTest = new Map<string, Set<string>>();
  for (const d of snap.docs) {
    const r = d.data() as Partial<TestResult>;
    // homework not made from a test carries its own id as testId: no such test, skipped below
    if (!r.testId || !r.userId) continue;
    if (!byTest.has(r.testId)) byTest.set(r.testId, new Set());
    byTest.get(r.testId)!.add(r.userId);
  }
  let people = 0;
  let tests = 0;
  for (const [testId, users] of byTest) {
    const testSnap = await getDoc(doc(db, "tests", testId)).catch(() => null);
    if (!testSnap?.exists()) continue;
    const ids = [...users];
    // markers in chunks (a batch holds at most 500 writes), then the total
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db);
      for (const uid of ids.slice(i, i + 450)) batch.set(doc(db, "tests", testId, "takers", uid), { at: serverTimestamp() });
      await batch.commit();
    }
    await updateDoc(doc(db, "tests", testId), { takers: ids.length });
    tests++;
    people += ids.length;
  }
  return { tests, people };
}

/**
 * Whose tests a list shows: `null` = the platform's own tests (editors),
 * a uid = that teacher's personal tests (only theirs, see firestore.rules).
 */
export type TestOwner = string | null;

/** Platform tests (editors): everything except teachers' personal tests. */
export async function getAllTests(): Promise<TestDoc[]> {
  const snap = await getDocs(collection(db, "tests"));
  return docsOf<TestDoc>(snap).filter((t) => !t.personal);
}

/** Every teacher's test (editors only — moderation of the catalog). */
export async function getTeacherTests(): Promise<TestDoc[]> {
  const snap = await getDocs(
    query(collection(db, "tests"), where("personal", "==", true)),
  );
  return docsOf<TestDoc>(snap);
}

/** The tests a list for `owner` shows (see `TestOwner`). */
export async function getTests(owner: TestOwner): Promise<TestDoc[]> {
  if (!owner) return getAllTests();
  const snap = await getDocs(
    query(collection(db, "tests"), where("createdBy", "==", owner)),
  );
  return docsOf<TestDoc>(snap);
}

export async function getTest(id: string): Promise<TestDoc | null> {
  const snap = await getDoc(doc(db, "tests", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TestDoc;
}

export async function createTest(
  createdBy: string,
  folderId: string | null = null,
  order?: number,
  /** A teacher's own test: only they edit it; see `TestDoc.personal`. */
  personal = false,
  authorName?: string,
): Promise<string> {
  const ref = await addDoc(collection(db, "tests"), {
    title: "Новий тест",
    subtitle: "",
    published: false,
    ...(personal && { personal: true }),
    ...(personal && authorName && { authorName }),
    folderId,
    ...(order !== undefined && { order }),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    questions: [],
    scoreTable: NMT_2025_TABLE,
    scaleType: "nmt",
  });
  return ref.id;
}

export async function updateTest(
  id: string,
  data: Partial<Omit<TestDoc, "id" | "createdAt">>,
): Promise<void> {
  // The first publication is remembered (saving a published test again keeps the date).
  let publishedAt: Record<string, unknown> = {};
  if (data.published === true) {
    const prev = (await getDoc(doc(db, "tests", id)).catch(() => null))?.data() as Partial<TestDoc> | undefined;
    if (!prev?.publishedAt) publishedAt = { publishedAt: serverTimestamp() };
  }
  await updateDoc(doc(db, "tests", id), {
    ...data,
    ...publishedAt,
    // linkAccess supersedes the legacy flag, which the rules would otherwise still honour.
    ...("linkAccess" in data && { publicAccess: deleteField() }),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTest(id: string): Promise<void> {
  await deleteDoc(doc(db, "tests", id));
}

// ── Test folders ──────────────────────────────────────────────

/** Folders of the platform (`null`) or of one teacher (see `TestOwner`). */
export async function getTestFolders(owner: TestOwner = null): Promise<TestFolder[]> {
  const snap = await getDocs(
    owner
      ? query(collection(db, "testFolders"), where("ownerId", "==", owner))
      : collection(db, "testFolders"),
  );
  return docsOf<TestFolder>(snap)
    .filter((f) => (owner ? true : !f.ownerId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function createTestFolder(
  name: string,
  order: number,
  owner: TestOwner = null,
): Promise<string> {
  const ref = await addDoc(collection(db, "testFolders"), {
    name,
    order,
    ...(owner && { ownerId: owner }),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameTestFolder(
  id: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, "testFolders", id), { name });
}

/** Deletes the folder; its tests are kept and moved out of it. */
export async function deleteTestFolder(
  id: string,
  testIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  testIds.forEach((tid) =>
    batch.update(doc(db, "tests", tid), { folderId: null }),
  );
  batch.delete(doc(db, "testFolders", id));
  await batch.commit();
}

/** Persists folder order and test placement (folderId + order) in one batch. */
export async function saveTestLayout(
  folders: { id: string; order: number }[],
  tests: { id: string; order: number; folderId: string | null }[],
): Promise<void> {
  const batch = writeBatch(db);
  folders.forEach((f) =>
    batch.update(doc(db, "testFolders", f.id), { order: f.order }),
  );
  tests.forEach((t) =>
    batch.update(doc(db, "tests", t.id), {
      order: t.order,
      folderId: t.folderId,
    }),
  );
  await batch.commit();
}

export function makeEmptyMCQ(order: number): MCQQuestion {
  return {
    id: crypto.randomUUID(),
    type: "mcq",
    text: "",
    options: [
      { id: "А", text: "" },
      { id: "Б", text: "" },
      { id: "В", text: "" },
      { id: "Г", text: "" },
      { id: "Д", text: "" },
    ],
    correctOptionId: "А",
    explanation: "",
    points: 1,
    order,
  };
}

export function makeEmptyMatching(order: number): MatchingQuestion {
  return {
    id: crypto.randomUUID(),
    type: "matching",
    text: "",
    leftItems: [
      { id: "1", text: "" },
      { id: "2", text: "" },
      { id: "3", text: "" },
    ],
    rightOptions: [
      { id: "А", text: "" },
      { id: "Б", text: "" },
      { id: "В", text: "" },
      { id: "Г", text: "" },
      { id: "Д", text: "" },
    ],
    correctPairs: { "1": "А", "2": "Б", "3": "В" },
    explanation: "",
    points: 3,
    order,
  };
}

export function makeEmptyMulti(order: number): MultiQuestion {
  return {
    id: crypto.randomUUID(),
    type: "multi",
    text: "",
    options: [
      { id: "А", text: "" },
      { id: "Б", text: "" },
      { id: "В", text: "" },
      { id: "Г", text: "" },
      { id: "Д", text: "" },
    ],
    correctOptionIds: ["А", "Б"],
    explanation: "",
    points: DEFAULT_POINTS.multi,
    order,
  };
}

export function makeEmptyOrder(order: number): OrderQuestion {
  return {
    id: crypto.randomUUID(),
    type: "order",
    text: "",
    items: [
      { id: "1", text: "" },
      { id: "2", text: "" },
      { id: "3", text: "" },
      { id: "4", text: "" },
    ],
    explanation: "",
    points: DEFAULT_POINTS.order,
    order,
  };
}

/** «Так / Ні»: a two-option choice question. */
export function makeEmptyTrueFalse(order: number): MCQQuestion {
  return {
    id: crypto.randomUUID(),
    type: "mcq",
    text: "",
    options: [
      { id: "А", text: "Так" },
      { id: "Б", text: "Ні" },
    ],
    correctOptionId: "А",
    explanation: "",
    points: 1,
    order,
  };
}

export function makeEmptyOpen(order: number): OpenQuestion {
  return {
    id: crypto.randomUUID(),
    type: "open",
    text: "",
    correctAnswer: "",
    explanation: "",
    points: 2,
    order,
  };
}

// НМТ-2025 default table (raw 0–4 → 100, 5 → 100, ..., 32 → 200)
export const NMT_2025_TABLE: ScoreRow[] = [
  { raw: 0, nmt: 100 },
  { raw: 5, nmt: 100 },
  { raw: 6, nmt: 108 },
  { raw: 7, nmt: 115 },
  { raw: 8, nmt: 123 },
  { raw: 9, nmt: 131 },
  { raw: 10, nmt: 134 },
  { raw: 11, nmt: 137 },
  { raw: 12, nmt: 140 },
  { raw: 13, nmt: 143 },
  { raw: 14, nmt: 145 },
  { raw: 15, nmt: 147 },
  { raw: 16, nmt: 148 },
  { raw: 17, nmt: 149 },
  { raw: 18, nmt: 150 },
  { raw: 19, nmt: 151 },
  { raw: 20, nmt: 152 },
  { raw: 21, nmt: 155 },
  { raw: 22, nmt: 159 },
  { raw: 23, nmt: 163 },
  { raw: 24, nmt: 167 },
  { raw: 25, nmt: 170 },
  { raw: 26, nmt: 173 },
  { raw: 27, nmt: 176 },
  { raw: 28, nmt: 180 },
  { raw: 29, nmt: 184 },
  { raw: 30, nmt: 189 },
  { raw: 31, nmt: 194 },
  { raw: 32, nmt: 200 },
];
