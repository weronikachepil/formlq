import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GIFT_TESTS } from "@/lib/advent";
import { getTest, type TestDoc } from "@/lib/tests";

/**
 * The advent gift in the cabinet: once someone with access solves all 24 windows, their
 * profile gets `adventGiftAt`, and the gift imitations (GIFT_TESTS) appear in «Тести»
 * on any device. The tests stay out of the catalog (link access «students»), so only
 * people with the mark see them listed.
 */

export const GIFT_GROUP = "🎁 Подарунок адвент-календаря";
export const GIFT_TEST_IDS = new Set(GIFT_TESTS.map((t) => t.id).filter(Boolean));

/** Owner's own profile; users may update their doc as long as the role stays (firestore.rules). */
export async function markAdventFinished(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { adventGiftAt: serverTimestamp() });
}

/** The gift tests that exist and can be read, in GIFT_TESTS order. */
export async function getGiftTests(): Promise<TestDoc[]> {
  const tests = await Promise.all(
    GIFT_TESTS.filter((t) => t.id).map((t) => getTest(t.id).catch(() => null)),
  );
  return tests.filter((t): t is TestDoc => !!t);
}
