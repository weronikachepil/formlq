import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canTutor } from "@/lib/roles";
import type { UserProfile } from "@/types";

/**
 * Teacher invites: every teacher gets a short code (stored as `users.inviteCode`)
 * and a link `/join/<code>`. A student enters the code or opens the link and,
 * after confirming the teacher's name, becomes their student (a tutorStudents link
 * the student creates themselves — see firestore.rules).
 */

// No 0/O, 1/I/L — codes are typed by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Upper-cases and drops spaces/dashes, so "ab3-k7q" and "AB3K7Q" match. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function inviteLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/join/${code}`;
}

async function usersWithCode(code: string): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), where("inviteCode", "==", code)));
  return snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id }));
}

/** The teacher's code, created on first use. */
export async function ensureInviteCode(profile: UserProfile): Promise<string> {
  if (profile.inviteCode) return profile.inviteCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    if ((await usersWithCode(code)).length) continue;
    await updateDoc(doc(db, "users", profile.uid), { inviteCode: code });
    return code;
  }
  throw new Error("Не вдалося створити код запрошення");
}

/** The teacher a code belongs to, or null. Only tutors/editors count. */
export async function findTutorByCode(raw: string): Promise<UserProfile | null> {
  const code = normalizeInviteCode(raw);
  if (code.length !== CODE_LENGTH) return null;
  const found = await usersWithCode(code);
  return found.find((u) => canTutor(u.role)) ?? null;
}

/** The student joins the teacher. Returns false if they were already linked. */
export async function joinTutor(student: UserProfile, tutorId: string): Promise<boolean> {
  if (canTutor(student.role)) throw new Error("Вчитель не може приєднатися як учень");
  if (student.uid === tutorId) throw new Error("Не можна приєднатися до себе");
  const ref = doc(db, "tutorStudents", `${tutorId}_${student.uid}`);
  if ((await getDoc(ref)).exists()) return false;
  await setDoc(ref, {
    tutorId,
    studentId: student.uid,
    studentEmail: student.email,
    studentName: student.displayName || student.email,
    createdAt: serverTimestamp(),
  });
  return true;
}
