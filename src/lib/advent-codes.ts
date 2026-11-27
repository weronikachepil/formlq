import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { docsOf } from "@/lib/firestore-helpers";

/**
 * Personal access codes for the advent calendar (`adventCodes/{code}`, see firestore.rules).
 * A teacher creates codes and hands one to each student; a signed-in student claims a code
 * for their account, and from then on nobody else can use it. Teachers and editors always
 * have access. Deleting a code (even a used one) takes the access away.
 */

export interface AdventCode {
  id: string; // the code itself, normalized (8 chars)
  tutorId: string;
  createdAt: Timestamp | null;
  usedBy: string | null;
  usedName?: string;
  usedAt?: Timestamp | null;
}

// No 0/O, 1/I/L — codes are typed by hand (same alphabet as teacher invite codes).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;
const col = collection(db, "adventCodes");

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** "ab3k-7qxz", "AB3K 7QXZ" → "AB3K7QXZ". */
export function normalizeAdventCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "AB3K7QXZ" → "AB3K-7QXZ", easier to read and dictate. */
export function formatAdventCode(code: string): string {
  return code.length === LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Teacher: `count` new unused codes. */
export async function createAdventCodes(tutorId: string, count: number): Promise<string[]> {
  const made: string[] = [];
  while (made.length < count) {
    const code = randomCode();
    // A collision with an existing code is astronomically unlikely; check anyway.
    if ((await getDoc(doc(col, code))).exists()) continue;
    await setDoc(doc(col, code), { tutorId, createdAt: serverTimestamp(), usedBy: null });
    made.push(code);
  }
  return made;
}

/** Teacher: their codes, newest first. */
export async function getMyAdventCodes(tutorId: string): Promise<AdventCode[]> {
  const list = docsOf<AdventCode>(await getDocs(query(col, where("tutorId", "==", tutorId))));
  return list.sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity));
}

/** Teacher: remove a code; if a student used it, they lose access. */
export async function deleteAdventCode(code: string): Promise<void> {
  await deleteDoc(doc(col, code));
}

/** Student: whether they have claimed a code. */
export async function hasAdventCode(uid: string): Promise<boolean> {
  const snap = await getDocs(query(col, where("usedBy", "==", uid), limit(1)));
  return !snap.empty;
}

export type ClaimResult = "ok" | "not-found" | "used" | "invalid";

/** Student: claim a code for their account. */
export async function claimAdventCode(raw: string, uid: string, name: string): Promise<ClaimResult> {
  const code = normalizeAdventCode(raw);
  if (code.length !== LENGTH) return "invalid";
  const ref = doc(col, code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "not-found";
  const usedBy = snap.data().usedBy as string | null;
  if (usedBy === uid) return "ok";
  if (usedBy) return "used";
  try {
    // Rules accept this only while the code is unused and only for the caller.
    await updateDoc(ref, { usedBy: uid, usedName: name, usedAt: serverTimestamp() });
    return "ok";
  } catch {
    return "used";
  }
}
