import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { docsOf } from "@/lib/firestore-helpers";
import { createAdventCodes } from "@/lib/advent-codes";

/**
 * Buying the advent calendar without a merchant account: the buyer pays into a Monobank
 * jar with their order reference in the comment and presses «Я оплатив(ла)»; an editor
 * checks the jar statement and confirms the order (`adventOrders`, see firestore.rules).
 * Confirming grants access: a student gets a code already claimed for their account, a
 * teacher gets `qty` codes for their students (owning codes also opens the calendar for them).
 */

/**
 * TODO(owner): the Monobank jar link, e.g. "https://send.monobank.ua/jar/AbCdEf123".
 * Until it is set, the «Оплатити» button is hidden and buyers see «Оплата скоро».
 */
export const JAR_URL = "";

export const PRICE_STUDENT = 149;

/** Teachers pay per student code, cheaper in bulk; their own access comes free with any pack. */
export function teacherCodePrice(qty: number): number {
  return qty >= 20 ? 79 : 99;
}
export const TEACHER_MAX_CODES = 100;

export type OrderKind = "self" | "pack";
export type OrderStatus = "pending" | "paid" | "rejected";

export interface AdventOrder {
  id: string;
  uid: string;
  name: string;
  email: string;
  kind: OrderKind;
  qty: number;
  amount: number;
  ref: string;
  status: OrderStatus;
  createdAt: Timestamp | null;
  decidedAt?: Timestamp | null;
}

const col = collection(db, "adventOrders");

// No 0/O, 1/I/L: the buyer types the reference into the jar comment.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newOrderRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return "ADV-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function orderAmount(kind: OrderKind, qty: number): number {
  return kind === "self" ? PRICE_STUDENT : qty * teacherCodePrice(qty);
}

/** Jar link with the amount and the comment filled in. */
export function jarPayUrl(amount: number, ref: string): string {
  if (!JAR_URL) return "";
  const u = new URL(JAR_URL);
  u.searchParams.set("a", String(amount));
  u.searchParams.set("t", ref);
  return u.toString();
}

/** Buyer: «Я оплатив(ла)». */
export async function placeOrder(o: {
  uid: string; name: string; email: string; kind: OrderKind; qty: number; ref: string;
}): Promise<void> {
  await addDoc(col, {
    ...o,
    qty: o.kind === "self" ? 1 : o.qty,
    amount: orderAmount(o.kind, o.qty),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

const newestFirst = (a: AdventOrder, b: AdventOrder) =>
  (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity);

export async function getMyOrders(uid: string): Promise<AdventOrder[]> {
  return docsOf<AdventOrder>(await getDocs(query(col, where("uid", "==", uid)))).sort(newestFirst);
}

/** Editor: every order, newest first. */
export async function getAllOrders(): Promise<AdventOrder[]> {
  return docsOf<AdventOrder>(await getDocs(col)).sort(newestFirst);
}

/** Editor: the money arrived — grant access, then mark the order paid. */
export async function approveOrder(o: AdventOrder, editorUid: string): Promise<void> {
  if (o.kind === "self") {
    // A code that is already the student's: same access check as a claimed teacher code.
    const code = `S${o.id.slice(0, 7).toUpperCase()}`;
    await setDoc(doc(db, "adventCodes", code), {
      tutorId: editorUid,
      createdAt: serverTimestamp(),
      usedBy: o.uid,
      usedName: o.name,
      usedAt: serverTimestamp(),
      orderId: o.id,
    });
  } else {
    await createAdventCodes(o.uid, o.qty, o.id);
  }
  await updateDoc(doc(col, o.id), { status: "paid", decidedAt: serverTimestamp() });
}

/** Editor: no matching payment in the jar. */
export async function rejectOrder(o: AdventOrder): Promise<void> {
  await updateDoc(doc(col, o.id), { status: "rejected", decidedAt: serverTimestamp() });
}
