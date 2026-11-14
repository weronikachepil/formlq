// Owner-side authority for a board.
//
// The original MathBoard ran this logic on its own Node server. Here there is no
// server, so the board owner's client performs it: grading submitted tests,
// auto-submitting when a test closes, closing timed tests, and handing out
// per-student copies of a test page. Security rules still guarantee that students
// cannot answer after a test is closed or past its deadline; the host only fills
// in the derived data (flags, scores, copies). When the owner opens the board it
// also catches up on anything that happened while they were away.
import { gradeQuiz } from "@/lib/board/engine/quiz";
import { uid as newId } from "@/lib/board/engine/shapes";
import type { BoardObject, FlagObject, Op, PageObject, ScoreObject } from "@/lib/board/engine/types";
import type { PeerInfo } from "@/lib/board/engine/transport";
import { MAIN_PAGE } from "@/lib/board/buckets";

export interface HostContext {
  get(id: string): BoardObject | undefined;
  all(): Iterable<BoardObject>;
  /** Students currently on the board. */
  students(): PeerInfo[];
  /** Applies ops both to the local engine and to the database. */
  write(ops: Op[]): void;
  now(): number;
}

/** Object types that are never copied into a student's personal test sheet. */
const NOT_COPIED = new Set<BoardObject["type"]>(["page", "comment", "vote", "answer", "flag", "score"]);

const round2 = (v: number) => Math.round(v * 100) / 100;
const pageOf = (o: BoardObject) => o.pg ?? MAIN_PAGE;

export class BoardHost {
  private closers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private ctx: HostContext) {}

  /** Runs once the owner has the full board state. */
  start(): void {
    const out: Op[] = [];
    for (const o of this.ctx.all()) {
      if (o.type === "page" && o.endsAt && !o.closed) {
        if (o.endsAt <= this.ctx.now()) out.push(...this.close(o));
        else this.scheduleClose(o);
      }
    }
    // Submissions made while the owner was offline have no score yet.
    for (const o of this.ctx.all()) {
      if (o.type === "flag" && o.kind === "done" && !this.ctx.get(scoreId(pageOf(o), o.by))) {
        const sc = this.makeScore(o.by, o.name ?? "", pageOf(o));
        if (sc) out.push(sc);
      }
    }
    out.push(...this.ensureCopies());
    this.ctx.write(out);
  }

  stop(): void {
    for (const t of this.closers.values()) clearTimeout(t);
    this.closers.clear();
  }

  /** After the owner's own changes. `olds` holds the previous versions. */
  afterOwnerOps(ops: Op[], olds: Map<string, BoardObject | undefined>): void {
    const out: Op[] = [];
    let copies = false;
    for (const [id, obj] of ops) {
      if (obj?.type !== "page") continue;
      this.scheduleClose(obj);
      const old = olds.get(id);
      if (obj.closed && !(old?.type === "page" && old.closed)) out.push(...this.closeTest(id));
      if (obj.perStudent) copies = true;
    }
    if (copies) out.push(...this.ensureCopies());
    this.ctx.write(out);
  }

  /** After changes made by students. */
  afterRemoteOps(ops: Op[], olds: Map<string, BoardObject | undefined>): void {
    const out: Op[] = [];
    for (const [id, obj] of ops) {
      const old = olds.get(id);
      if (obj?.type === "flag" && obj.kind === "done" && !old) {
        const sc = this.makeScore(obj.by, obj.name ?? "", pageOf(obj));
        if (sc) out.push(sc);
      } else if (!obj && old?.type === "flag") {
        const sid = scoreId(pageOf(old), old.by);
        if (this.ctx.get(sid)) out.push([sid, null]);
      }
    }
    this.ctx.write(out);
  }

  onStudentJoin(peer: PeerInfo): void {
    this.ctx.write(this.ensureCopies(peer));
  }

  // ---------- tests ----------

  /** Total score of a student on a test page; computed only by the owner. */
  private makeScore(uid: string, name: string, pg: string): Op | null {
    const quizzes = [...this.ctx.all()].filter((q) => q.type === "quiz" && pageOf(q) === pg);
    if (!quizzes.length) return null;
    let earned = 0;
    let max = 0;
    for (const q of quizzes) {
      if (q.type !== "quiz") continue;
      const a = this.ctx.get(answerId(q.id, uid));
      const g = gradeQuiz(q, a?.type === "answer" ? a.val : undefined);
      if (!g) continue; // no key: the owner always has it
      earned += g.earned;
      max += g.max;
    }
    const id = scoreId(pg, uid);
    const score: ScoreObject = {
      id, type: "score", by: uid, pg, name, earned: round2(earned), max: round2(max), z: 0, t: this.ctx.now(),
    };
    return [id, score];
  }

  /** Auto-submits for everyone who answered but did not hand in, and scores them. */
  private closeTest(pg: string): Op[] {
    const quizIds = new Set(
      [...this.ctx.all()].filter((q) => q.type === "quiz" && pageOf(q) === pg).map((q) => q.id),
    );
    if (!quizIds.size) return [];
    const who = new Map<string, string>();
    for (const a of this.ctx.all()) {
      if (a.type === "answer" && quizIds.has(a.quiz)) who.set(a.by, a.name ?? "");
    }
    const out: Op[] = [];
    for (const [uid, name] of who) {
      const fid = flagId(pg, uid);
      if (!this.ctx.get(fid)) {
        const flag: FlagObject = {
          id: fid, type: "flag", kind: "done", by: uid, pg, name, z: 0, t: this.ctx.now(), auto: true,
        };
        out.push([fid, flag]);
      }
      const sc = this.makeScore(uid, name, pg);
      if (sc) out.push(sc);
    }
    return out;
  }

  private close(page: PageObject): Op[] {
    return [[page.id, { ...page, closed: true }], ...this.closeTest(page.id)];
  }

  private scheduleClose(page: PageObject): void {
    clearTimeout(this.closers.get(page.id));
    this.closers.delete(page.id);
    if (!page.endsAt || page.closed) return;
    const endsAt = page.endsAt;
    const ms = Math.max(0, endsAt - this.ctx.now()) + 300;
    this.closers.set(
      page.id,
      setTimeout(() => {
        this.closers.delete(page.id);
        const cur = this.ctx.get(page.id);
        if (cur?.type !== "page" || cur.closed || cur.endsAt !== endsAt) return;
        this.ctx.write(this.close(cur));
      }, ms),
    );
  }

  // ---------- per-student sheets ----------

  /** A personal copy of a template page for one student ("each gets their own sheet"). */
  private copyPageFor(tpl: PageObject, peer: PeerInfo): Op[] {
    const all = [...this.ctx.all()];
    if (all.some((o) => o.type === "page" && o.from === tpl.id && o.for === peer.uid)) return [];
    const pid = "pg_" + newId();
    const maxZ = Math.max(0, ...all.map((o) => o.z || 0));
    const page: PageObject = {
      id: pid, type: "page", name: `${peer.name} — ${tpl.name ?? ""}`.slice(0, 40), for: peer.uid, priv: true,
      test: !!tpl.test, from: tpl.id, endsAt: tpl.endsAt ?? null, closed: !!tpl.closed, z: maxZ + 1,
    };
    const out: Op[] = [[pid, page]];
    const groups = new Map<string, string>();
    for (const o of all) {
      if (pageOf(o) !== tpl.id || NOT_COPIED.has(o.type)) continue;
      const c = { ...o, id: newId(), pg: pid, by: "owner" } as BoardObject;
      if (c.type === "quiz") c.reveal = false;
      if (o.grp) {
        if (!groups.has(o.grp)) groups.set(o.grp, "g_" + newId());
        c.grp = groups.get(o.grp);
      }
      out.push([c.id, c]);
    }
    return out;
  }

  private ensureCopies(only?: PeerInfo): Op[] {
    const out: Op[] = [];
    const templates = [...this.ctx.all()].filter(
      (o): o is PageObject => o.type === "page" && !!o.perStudent && !o.closed,
    );
    for (const tpl of templates) {
      for (const peer of only ? [only] : this.ctx.students()) out.push(...this.copyPageFor(tpl, peer));
    }
    return out;
  }
}

export const answerId = (quizId: string, uid: string) => `ans_${quizId}_${uid}`;
export const flagId = (pg: string, uid: string) => `flag_${pg}_${uid}`;
export const scoreId = (pg: string, uid: string) => `score_${pg}_${uid}`;
