import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { docsOf } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";
import type { UserRole } from "@/types";

export type BugStatus = "new" | "resolved";

/** A problem a user reported from the app; editors read them in «Помилки». */
export interface BugReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: UserRole | null;
  text: string;
  /** Uploaded screenshot, if attached. */
  imageUrl?: string;
  /** Page the report was sent from, and the device it was sent on. */
  page: string;
  userAgent: string;
  viewport: string;
  status: BugStatus;
  createdAt: Timestamp | null;
}

export type BugReportDraft = Omit<BugReport, "id" | "status" | "createdAt">;

const col = collection(db, "bugReports");

export async function createBugReport(draft: BugReportDraft): Promise<void> {
  const data: Record<string, unknown> = { ...draft, status: "new", createdAt: serverTimestamp() };
  if (!draft.imageUrl) delete data.imageUrl;
  await addDoc(col, data);
}

export async function setBugStatus(id: string, status: BugStatus): Promise<void> {
  await updateDoc(doc(db, "bugReports", id), { status });
}

export async function deleteBugReport(id: string): Promise<void> {
  await deleteDoc(doc(db, "bugReports", id));
}

/** All reports, newest first (editors only). */
export function subscribeBugReports(cb: (list: BugReport[]) => void, onError?: () => void): () => void {
  return onSnapshot(
    query(col, orderBy("createdAt", "desc")),
    (snap) => cb(docsOf<BugReport>(snap)),
    (err) => {
      console.warn("[bugReports] cannot read:", err.code);
      onError?.();
    },
  );
}
