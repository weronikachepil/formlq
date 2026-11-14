// Where each board object lives in the Realtime Database, and how it is encoded.
//
// RTDB rules cannot filter children or hide fields, so visibility is expressed
// through the path an object is stored under (relative to `boards/{boardId}`):
//
//   objs/{id}         — visible to every participant
//   own/{uid}/{id}    — visible to that student and the owner: answers, "done"
//                       flags, scores, and everything on the student's private page
//   hidden/{id}       — owner only: draft / per-student template pages and their
//                       contents, teacher-only comments
//   keys/{quizId}     — owner only: answer keys of quizzes that are not revealed
//
// Objects are stored as an envelope: the fields the security rules need, plus
// the full object as a JSON string in `d` (RTDB would otherwise mangle arrays,
// drop empty arrays/objects and reject some keys).
import type { BoardObject, ObjectType, PageObject, QuizObject } from "@/lib/board/engine/types";

export type Bucket = "objs" | "hidden" | `own/${string}`;

/** Default page id; it has no page object of its own. */
export const MAIN_PAGE = "p1";

export interface Envelope {
  t: ObjectType;
  z: number;
  d: string;
  by?: string;
  pg?: string;
  lock?: true;
  vis?: string;
  // page-only fields used by the rules
  for?: string;
  test?: true;
  closed?: true;
  endsAt?: number;
}

/** The secret part of a quiz, stored under `keys/` until the owner reveals it. */
export type QuizSecret = Pick<QuizObject, "key" | "expl" | "explImg">;

export function pageBucket(p: PageObject): Bucket {
  if (p.draft || p.perStudent) return "hidden";
  if (p.for && p.priv) return `own/${p.for}`;
  return "objs";
}

export function bucketOf(
  o: BoardObject,
  getPage: (id: string) => BoardObject | undefined,
): Bucket {
  switch (o.type) {
    case "answer":
    case "flag":
    case "score":
      return `own/${o.by}`;
    case "page":
      return pageBucket(o);
    case "comment":
      if (o.vis === "teacher") return "hidden";
      break;
  }
  const page = getPage(o.pg ?? MAIN_PAGE);
  return page?.type === "page" ? pageBucket(page) : "objs";
}

/** Splits an object into its envelope and (for unrevealed quizzes) the secret part. */
export function encode(o: BoardObject): { env: Envelope; secret: QuizSecret | null } {
  let body: BoardObject = o;
  let secret: QuizSecret | null = null;
  if (o.type === "quiz" && !o.reveal) {
    const { key, expl, explImg, ...rest } = o;
    secret = withoutUndefined({ key, expl, explImg });
    body = rest as QuizObject;
  }

  const env: Envelope = { t: o.type, z: o.z, d: JSON.stringify(body) };
  if (o.by !== undefined) env.by = o.by;
  if (o.pg !== undefined) env.pg = o.pg;
  if (o.lock) env.lock = true;
  if (o.type === "comment" && o.vis) env.vis = o.vis;
  if (o.type === "page") {
    if (o.for) env.for = o.for;
    if (o.test) env.test = true;
    if (o.closed) env.closed = true;
    if (o.endsAt) env.endsAt = o.endsAt;
  }
  return { env, secret };
}

/**
 * Rebuilds an object from its envelope. Rule-checked envelope fields win over
 * whatever the JSON body claims, so a client cannot forge `by` / `pg` / `type`.
 */
export function decode(id: string, env: Envelope, secret?: QuizSecret | null): BoardObject | null {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(env.d) as Record<string, unknown>;
  } catch {
    return null;
  }
  const o = { ...body, ...secret, id, type: env.t, z: env.z } as Record<string, unknown>;
  if (env.by !== undefined) o.by = env.by;
  else delete o.by;
  if (env.pg !== undefined) o.pg = env.pg;
  else delete o.pg;
  if (!env.lock) delete o.lock;
  return o as unknown as BoardObject;
}

export function isEnvelope(v: unknown): v is Envelope {
  if (!v || typeof v !== "object") return false;
  const e = v as Partial<Envelope>;
  return typeof e.t === "string" && typeof e.d === "string" && typeof e.z === "number";
}

/** RTDB rejects `undefined` values. */
export function withoutUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Lays out a full list of objects into bucket trees, e.g. for restoring a version.
 * Returns the value to write at `boards/{id}/{objs|hidden|own|keys}`.
 */
export function layout(objs: BoardObject[]): {
  objs: Record<string, Envelope>;
  hidden: Record<string, Envelope>;
  own: Record<string, Record<string, Envelope>>;
  keys: Record<string, QuizSecret>;
} {
  const byId = new Map(objs.map((o) => [o.id, o]));
  const out = {
    objs: {} as Record<string, Envelope>,
    hidden: {} as Record<string, Envelope>,
    own: {} as Record<string, Record<string, Envelope>>,
    keys: {} as Record<string, QuizSecret>,
  };
  for (const o of objs) {
    const { env, secret } = encode(o);
    if (secret) out.keys[o.id] = secret;
    const b = bucketOf(o, (id) => byId.get(id));
    if (b === "objs") out.objs[o.id] = env;
    else if (b === "hidden") out.hidden[o.id] = env;
    else {
      const uid = b.slice(4);
      (out.own[uid] ??= {})[o.id] = env;
    }
  }
  return out;
}
