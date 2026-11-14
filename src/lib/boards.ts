import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import {
  get,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { db, rtdb } from "@/lib/firebase";
import { docsOf } from "@/lib/firestore-helpers";
import { decode, isEnvelope, layout } from "@/lib/board/buckets";
import type { BoardObject } from "@/lib/board/engine/types";

// Board listing lives in Firestore (`boards/{id}`); the live board itself lives
// in the Realtime Database under the same id (see src/lib/board/sync.ts).

export interface Board {
  id: string;
  ownerId: string;
  ownerName?: string;
  title: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BoardSettings {
  /** Students may draw on shared pages. */
  studentEdit: boolean;
  /** Students may change / delete only their own objects. */
  studentProtect: boolean;
}

export interface BoardVersion {
  id: string;
  ts: number;
  label: string;
  count: number;
}

export const DEFAULT_BOARD_TITLE = "Нова дошка";
/** Automatic versions are taken at most this often. */
export const VERSION_EVERY_MS = 10 * 60 * 1000;
const MAX_VERSIONS = 40;

const rtBoard = (id: string) => ref(rtdb, `boards/${id}`);

// --- Listing (Firestore) ----------------------------------------------------

export async function createBoard(
  ownerId: string,
  ownerName: string,
  title: string,
): Promise<string> {
  const ref = doc(collection(db, "boards"));
  // Realtime part first: the rules let only the owner write it afterwards.
  await set(rtBoardMeta(ref.id), { owner: ownerId, edit: true, protect: true });
  await setDoc(ref, {
    ownerId,
    ownerName,
    title: title.trim().slice(0, 100) || DEFAULT_BOARD_TITLE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getBoard(id: string): Promise<Board | null> {
  const snap = await getDoc(doc(db, "boards", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Board) : null;
}

export async function renameBoard(id: string, title: string): Promise<void> {
  const clean = title.trim().slice(0, 100);
  if (!clean) throw new Error("Порожня назва");
  await updateDoc(doc(db, "boards", id), { title: clean });
}

export async function touchBoard(id: string): Promise<void> {
  await updateDoc(doc(db, "boards", id), { updatedAt: serverTimestamp() });
}

export async function deleteBoard(id: string): Promise<void> {
  await Promise.all([
    remove(ref(rtdb, `boardVersions/${id}`)),
    remove(ref(rtdb, `boardSnapshots/${id}`)),
  ]);
  await remove(rtBoard(id));
  await deleteDoc(doc(db, "boards", id));
}

export function subscribeOwnerBoards(
  ownerId: string,
  cb: (list: Board[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "boards"), where("ownerId", "==", ownerId)),
    (snap) =>
      cb(
        docsOf<Board>(snap).sort(
          (a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0),
        ),
      ),
    onError,
  );
}

/** User-facing reason for a failed Firebase call. */
export function boardErrorMessage(e: unknown, fallback: string): string {
  const code = (e as { code?: string } | null)?.code ?? "";
  const text = String(e);
  // Realtime Database says "PERMISSION_DENIED", Firestore "permission-denied" /
  // "Missing or insufficient permissions" — name which rules to fix.
  if (/PERMISSION_DENIED/.test(code) || /PERMISSION_DENIED/.test(text)) {
    return "Немає доступу: правила Realtime Database для дошок не опубліковані";
  }
  if (/permission[-_]denied/i.test(code) || /permission/i.test(text)) {
    return "Немає доступу: правила Firestore для дошок не опубліковані";
  }
  return fallback;
}

// --- Boards I opened (someone else's) --------------------------------------

export interface BoardVisit {
  id: string; // board id
  title: string;
  ownerName?: string;
  visitedAt: Timestamp | null;
}

const visitsOf = (uid: string) => collection(db, "users", uid, "boardVisits");

/** Remembers a board someone else owns, so it shows up in this user's «Дошки». */
export async function recordBoardVisit(uid: string, board: Board): Promise<void> {
  await setDoc(doc(visitsOf(uid), board.id), {
    title: board.title,
    ownerName: board.ownerName ?? "",
    visitedAt: serverTimestamp(),
  });
}

export async function forgetBoardVisit(uid: string, boardId: string): Promise<void> {
  await deleteDoc(doc(visitsOf(uid), boardId));
}

/**
 * Boards this user opened, newest first, with titles refreshed from the boards
 * themselves; boards that were deleted since are left out.
 */
export function subscribeBoardVisits(
  uid: string,
  cb: (list: BoardVisit[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let seq = 0;
  return onSnapshot(
    visitsOf(uid),
    (snap) => {
      const visits = docsOf<BoardVisit>(snap);
      const mine = ++seq;
      refreshVisits(visits)
        .then((list) => mine === seq && cb(list))
        .catch(() => mine === seq && cb(visits));
    },
    onError,
  );
}

async function refreshVisits(visits: BoardVisit[]): Promise<BoardVisit[]> {
  // Firestore `in` takes at most 30 values; the chunks are fetched in parallel.
  const chunks: string[][] = [];
  for (let i = 0; i < visits.length; i += 30) chunks.push(visits.slice(i, i + 30).map((v) => v.id));
  const snaps = await Promise.all(
    chunks.map((ids) => getDocs(query(collection(db, "boards"), where(documentId(), "in", ids)))),
  );
  const live = new Map<string, Board>();
  for (const snap of snaps) for (const d of snap.docs) live.set(d.id, { id: d.id, ...d.data() } as Board);
  return visits
    .filter((v) => live.has(v.id))
    .map((v) => ({ ...v, title: live.get(v.id)?.title ?? v.title }))
    .sort((a, b) => (b.visitedAt?.toMillis() ?? 0) - (a.visitedAt?.toMillis() ?? 0));
}

export const boardLink = (id: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/board/${id}`;

// --- Settings (Realtime Database) ------------------------------------------

function rtBoardMeta(id: string) {
  return ref(rtdb, `boards/${id}/meta`);
}

export async function getBoardSettings(id: string): Promise<BoardSettings> {
  const m = (await get(rtBoardMeta(id))).val() as { edit?: boolean; protect?: boolean } | null;
  return { studentEdit: m?.edit !== false, studentProtect: m?.protect !== false };
}

export async function updateBoardSettings(
  id: string,
  patch: Partial<BoardSettings>,
): Promise<void> {
  const out: Record<string, boolean> = {};
  if (patch.studentEdit !== undefined) out.edit = patch.studentEdit;
  if (patch.studentProtect !== undefined) out.protect = patch.studentProtect;
  await update(rtBoardMeta(id), out);
}

// --- Versions (owner only) --------------------------------------------------

/** Every object on the board, as the owner sees it (keys merged in). */
async function readAllObjects(id: string): Promise<BoardObject[]> {
  const snap = (await get(rtBoard(id))).val() as {
    objs?: Record<string, unknown>;
    hidden?: Record<string, unknown>;
    own?: Record<string, Record<string, unknown>>;
    keys?: Record<string, Parameters<typeof decode>[2]>;
  } | null;
  if (!snap) return [];
  const keys = snap.keys ?? {};
  const envs: [string, unknown][] = [
    ...Object.entries(snap.objs ?? {}),
    ...Object.entries(snap.hidden ?? {}),
    ...Object.values(snap.own ?? {}).flatMap((m) => Object.entries(m)),
  ];
  const out: BoardObject[] = [];
  for (const [oid, env] of envs) {
    if (!isEnvelope(env)) continue;
    const o = decode(oid, env, keys[oid]);
    if (o) out.push(o);
  }
  return out;
}

export async function listVersions(id: string): Promise<BoardVersion[]> {
  const v = (await get(ref(rtdb, `boardVersions/${id}`))).val() as Record<
    string,
    Omit<BoardVersion, "id">
  > | null;
  return Object.entries(v ?? {})
    .map(([vid, x]) => ({ id: vid, ...x }))
    .sort((a, b) => b.ts - a.ts);
}

export async function saveVersion(id: string, label: string): Promise<void> {
  const objs = await readAllObjects(id);
  const vid = push(ref(rtdb, `boardVersions/${id}`)).key;
  if (!vid) return;
  await update(ref(rtdb), {
    [`boardSnapshots/${id}/${vid}`]: JSON.stringify(objs),
    [`boardVersions/${id}/${vid}`]: { ts: Date.now(), label: label.slice(0, 60), count: objs.length },
  });
  await pruneVersions(id);
}

async function pruneVersions(id: string): Promise<void> {
  const list = await listVersions(id);
  const stale = list.slice(MAX_VERSIONS);
  if (!stale.length) return;
  const updates: Record<string, null> = {};
  for (const v of stale) {
    updates[`boardVersions/${id}/${v.id}`] = null;
    updates[`boardSnapshots/${id}/${v.id}`] = null;
  }
  await update(ref(rtdb), updates);
}

/** Restores a version. The current state is saved as a version first. */
export async function restoreVersion(id: string, vid: string): Promise<void> {
  const raw = (await get(ref(rtdb, `boardSnapshots/${id}/${vid}`))).val() as string | null;
  if (!raw) throw new Error("Версію не знайдено");
  await saveVersion(id, "Перед відновленням");
  const objs = JSON.parse(raw) as BoardObject[];
  const tree = layout(objs);
  await update(rtBoard(id), {
    objs: tree.objs,
    hidden: tree.hidden,
    own: tree.own,
    keys: tree.keys,
  });
}

/** Last version time, for deciding when to take an automatic one. */
export async function lastVersionAt(id: string): Promise<number> {
  return (await listVersions(id))[0]?.ts ?? 0;
}

// --- Participants -----------------------------------------------------------

const USER_COLORS = ["#3b5bdb", "#e8590c", "#2f9e44", "#c2255c", "#7048e8", "#0c8599"];

/** Stable cursor / author colour for a user. */
export function userColor(uid: string): string {
  const sum = [...uid].reduce((a, c) => a + c.charCodeAt(0), 0);
  return USER_COLORS[sum % USER_COLORS.length];
}
