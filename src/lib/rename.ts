import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Firestore allows at most 500 writes per batch. */
const BATCH_LIMIT = 500;

type Patch = { ref: DocumentReference; data: Record<string, string> };

/** Docs of `coll` where `field == uid` whose `nameField` isn't `name` yet. */
async function stale(coll: string, field: string, uid: string, nameField: string, name: string) {
  const snap = await getDocs(query(collection(db, coll), where(field, "==", uid)));
  return snap.docs
    .filter((d) => d.get(nameField) !== name)
    .map<Patch>((d) => ({ ref: doc(db, coll, d.id), data: { [nameField]: name } }));
}

async function commit(patches: Patch[]) {
  for (let i = 0; i < patches.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    patches.slice(i, i + BATCH_LIMIT).forEach((p) => batch.update(p.ref, p.data));
    await batch.commit();
  }
}

/**
 * After a user renames themselves: rewrite the copies of their name saved in
 * other docs at creation time (student lists, lessons, homework, boards, and a
 * teacher's tests). Each place is independent; returns how many failed.
 */
export async function propagateDisplayName(
  uid: string,
  name: string,
  { teacher }: { teacher: boolean },
): Promise<number> {
  const jobs: Promise<unknown>[] = [
    // As a student.
    stale("tutorStudents", "studentId", uid, "studentName", name).then(commit),
    stale("lessons", "studentId", uid, "studentName", name).then(commit),
    stale("homework", "studentId", uid, "studentName", name).then(commit),
    // As a tutor / board owner.
    stale("lessons", "tutorId", uid, "tutorName", name).then(commit),
    stale("homework", "tutorId", uid, "tutorName", name).then(commit),
    stale("boards", "ownerId", uid, "ownerName", name).then(commit),
  ];
  // A teacher's tests are all personal (firestore.rules), each showing their name.
  if (teacher) jobs.push(stale("tests", "createdBy", uid, "authorName", name).then(commit));
  const results = await Promise.allSettled(jobs);
  return results.filter((r) => r.status === "rejected").length;
}
