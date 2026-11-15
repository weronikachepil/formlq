import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { docsOf } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";

/**
 * A tutor's group of students (a class, an evening NMT group…). Membership is a list on
 * the group; a student may be in several groups. Homework and lessons for a group are
 * copied to each member (see docs/tutoring.md), so students' own queries stay unchanged.
 */
export interface StudentGroup {
  id: string;
  tutorId: string;
  name: string;
  studentIds: string[];
  /** The group's shared whiteboard, created on the first group lesson. */
  boardId?: string;
  createdAt: Timestamp | null;
}

export type GroupDraft = Pick<StudentGroup, "name" | "studentIds">;

const groupsCol = collection(db, "groups");

export async function createGroup(tutorId: string, draft: GroupDraft): Promise<string> {
  const ref = await addDoc(groupsCol, {
    tutorId,
    name: draft.name.trim(),
    studentIds: [...new Set(draft.studentIds)],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGroup(id: string, patch: Partial<GroupDraft & { boardId: string }>): Promise<void> {
  const data: Record<string, unknown> = { ...patch };
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.studentIds) data.studentIds = [...new Set(patch.studentIds)];
  await updateDoc(doc(db, "groups", id), data);
}

/** Deletes the group only; homework and lessons already given to its members stay. */
export async function deleteGroup(id: string): Promise<void> {
  await deleteDoc(doc(db, "groups", id));
}

/** The tutor's groups, sorted by name. */
export function subscribeTutorGroups(tutorId: string, cb: (groups: StudentGroup[]) => void): () => void {
  return onSnapshot(
    query(groupsCol, where("tutorId", "==", tutorId)),
    (snap) => cb(docsOf<StudentGroup>(snap).sort((a, b) => a.name.localeCompare(b.name, "uk"))),
    // E.g. the `groups` rules are not published yet: pages work on without groups.
    (err) => {
      console.warn("[groups] cannot read groups:", err.code);
      cb([]);
    },
  );
}
