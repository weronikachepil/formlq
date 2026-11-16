// Realtime board sync over Firebase Realtime Database.
//
// Layout under `boards/{boardId}` (see buckets.ts for objects):
//   meta                 { owner, edit, protect }       — board permissions
//   objs | own | hidden | keys                          — board objects
//   live/peers/{cid}     { uid, name, color, owner }    — who is here (removed on disconnect)
//   live/cur/{cid}       { x, y }                       — cursors
//   live/laser/{cid}     { x, y, d }                    — laser pointer
//   live/view            ViewRect                       — owner's view ("follow me")
//   live/pview/{cid}     ViewRect                       — students' views (owner only)
//   live/goto            { pg, t }                      — owner sends everyone to a page
//
// RTDB applies local writes optimistically and reverts them if the rules reject
// them, so this client only has to skip the echo of its own writes and pass
// everything else to the engine.
import {
  get,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type DataSnapshot,
  type Unsubscribe,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { BoardObject, Op, ViewRect } from "@/lib/board/engine/types";
import type {
  BoardTransport,
  PeerInfo,
  SyncCallbacks,
  TransportFactory,
} from "@/lib/board/engine/transport";
import {
  bucketOf,
  decode,
  encode,
  isEnvelope,
  MAIN_PAGE,
  type Bucket,
  type QuizSecret,
} from "@/lib/board/buckets";
import { BoardHost } from "@/lib/board/host";
import { lastVersionAt, saveVersion, touchBoard, VERSION_EVERY_MS } from "@/lib/boards";

export interface BoardMeta {
  owner: string;
  edit: boolean;
  protect: boolean;
}

export interface BoardUser {
  uid: string;
  name: string;
  color: string;
}

interface Known {
  bucket: Bucket;
  /** Encoded body last seen / written, used to skip our own echoes. */
  d: string;
}

/** Max paths in one multi-location update. */
const MAX_PATHS = 400;
/** Owner: bump the board's `updatedAt` in Firestore at most this often. */
const TOUCH_EVERY_MS = 60_000;
/**
 * Per-client live nodes, in removal order: `peers` last, because the rules for
 * the others check `live/peers/{cid}`.
 */
const LIVE_CHANNELS = ["cur", "laser", "pview", "peers"] as const;

export const boardPath = (boardId: string) => `boards/${boardId}`;

export function createBoardSync(boardId: string, user: BoardUser): TransportFactory {
  return (cb) => new FirebaseBoardSync(boardId, user, cb);
}

class FirebaseBoardSync implements BoardTransport {
  private base: string;
  private cid = "";
  private isOwner = false;
  private meta: BoardMeta | null = null;
  private loaded = false;
  private closed = false;
  /** RTDB `.info/connected`; tracked separately because it fires before the board has loaded. */
  private connected = false;
  private unsubs: Unsubscribe[] = [];
  private ownBuckets = new Set<string>();

  /** Mirror of every object this client can see, keyed by id. */
  private objs = new Map<string, BoardObject>();
  private known = new Map<string, Known>();
  private secrets = new Map<string, QuizSecret>();
  private peers = new Map<string, PeerInfo>();

  private incoming: Op[] = [];
  private incomingOlds = new Map<string, BoardObject | undefined>();
  private flushQueued = false;

  private timeOffset = 0;
  private lastGoto: string | null = null;
  private lastMoves = new Map<string, string>();
  private lastTouch = 0;
  private host: BoardHost | null = null;
  /** Owner: unsaved-in-a-version changes and the automatic version timer. */
  private dirty = false;
  private lastVersion = 0;
  private versionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private boardId: string,
    private user: BoardUser,
    private cb: SyncCallbacks,
  ) {
    this.base = boardPath(boardId);
  }

  private r(path: string) {
    return ref(rtdb, `${this.base}/${path}`);
  }

  // ---------- lifecycle ----------

  connect(): void {
    this.cb.onStatus("connecting");
    void this.start().catch((e: unknown) => {
      // Usually permission-denied (rules not deployed / no access) or a missing board.
      console.error("[board] could not connect:", e);
      this.cb.onStatus("offline");
    });
  }

  private async start(): Promise<void> {
    const metaSnap = await get(this.r("meta"));
    if (this.closed) return;
    const meta = metaSnap.val() as BoardMeta | null;
    if (!meta) throw new Error("Board not found");
    this.meta = meta;
    this.isOwner = meta.owner === this.user.uid;
    this.cid = push(this.r("live/peers")).key ?? `c${Date.now()}`;

    this.listenConnection();
    this.listenObjects();
    await this.loadAll();
    if (this.closed) return;
    await this.listenLive();
    if (this.closed) return;

    this.loaded = true;
    this.incoming = [];
    this.incomingOlds.clear();
    this.cb.onInit({
      cid: this.cid,
      objs: [...this.objs.values()],
      peers: [...this.peers.values()],
      canEdit: this.isOwner || meta.edit,
      protect: meta.protect,
      isOwner: this.isOwner,
      view: null,
      goto: this.isOwner ? null : this.lastGoto,
    });
    this.cb.onStatus(this.connected ? "online" : "offline");

    if (this.isOwner) {
      this.host = new BoardHost({
        get: (id) => this.objs.get(id),
        all: () => this.objs.values(),
        students: () => [...this.peers.values()].filter((p) => !p.owner),
        write: (ops) => this.hostWrite(ops),
        now: () => Date.now() + this.timeOffset,
      });
      this.host.start();
      this.lastVersion = await lastVersionAt(this.boardId).catch(() => Date.now());
      this.versionTimer = setInterval(() => this.autoVersion(), 60_000);
    }
  }

  private autoVersion(): void {
    if (!this.dirty || Date.now() - this.lastVersion < VERSION_EVERY_MS) return;
    this.dirty = false;
    this.lastVersion = Date.now();
    saveVersion(this.boardId, "Автоматично").catch(() => {
      this.dirty = true;
    });
  }

  close(): void {
    this.closed = true;
    this.host?.stop();
    if (this.versionTimer) clearInterval(this.versionTimer);
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.cid) {
      for (const p of LIVE_CHANNELS) {
        remove(this.r(`live/${p}/${this.cid}`)).catch(() => {});
      }
    }
  }

  private listenConnection(): void {
    const me = this.r(`live/peers/${this.cid}`);
    this.unsubs.push(
      onValue(ref(rtdb, ".info/connected"), (snap) => {
        if (this.closed) return;
        this.connected = snap.val() === true;
        if (!this.connected) {
          this.cb.onStatus("offline");
          return;
        }
        // The rules for cur/laser/pview (and the peer's own removal) look at
        // `live/peers/{cid}`, so it must exist before the disconnect handlers are
        // registered, and must be removed last.
        set(me, {
          uid: this.user.uid,
          name: this.user.name,
          color: this.user.color,
          owner: this.isOwner,
          at: serverTimestamp(),
        })
          .then(() => {
            if (this.closed) return;
            for (const p of LIVE_CHANNELS) {
              onDisconnect(this.r(`live/${p}/${this.cid}`)).remove().catch(() => {});
            }
          })
          .catch(() => {});
        if (this.loaded) this.cb.onStatus("online");
      }),
      onValue(ref(rtdb, ".info/serverTimeOffset"), (snap) => {
        this.timeOffset = Number(snap.val()) || 0;
        this.cb.onTime(this.timeOffset);
      }),
    );
  }

  // ---------- objects ----------

  private buckets(): string[] {
    return this.isOwner ? ["objs", "hidden"] : ["objs", `own/${this.user.uid}`];
  }

  private listenObjects(): void {
    for (const b of this.buckets()) this.listenBucket(b as Bucket);
    if (!this.isOwner) return;

    // Owner: every student's private bucket, plus quiz keys.
    const own = this.r("own");
    this.unsubs.push(
      onChildAdded(own, (s) => s.key && this.listenBucket(`own/${s.key}`)),
    );
    const keys = this.r("keys");
    const onKey = (s: DataSnapshot) => {
      if (!s.key) return;
      const v = s.val() as QuizSecret | null;
      if (v) this.secrets.set(s.key, v);
      else this.secrets.delete(s.key);
      const cur = this.known.get(s.key);
      if (!cur) return;
      // Re-decode the quiz with its key merged in.
      const obj = this.objs.get(s.key);
      if (!obj) return;
      const merged = { ...obj, ...(v ?? { key: undefined, expl: undefined, explImg: undefined }) } as BoardObject;
      this.receive(s.key, merged);
    };
    this.unsubs.push(onChildAdded(keys, onKey), onChildChanged(keys, onKey), onChildRemoved(keys, (s) => {
      if (s.key) this.secrets.delete(s.key);
    }));
  }

  private listenBucket(bucket: Bucket): void {
    if (this.ownBuckets.has(bucket)) return;
    this.ownBuckets.add(bucket);
    const r = this.r(bucket);
    const onSet = (s: DataSnapshot) => {
      const id = s.key;
      const env = s.val() as unknown;
      if (!id || !isEnvelope(env)) return;
      const cur = this.known.get(id);
      if (cur && cur.bucket === bucket && cur.d === env.d) return; // our own echo
      const obj = decode(id, env, this.secrets.get(id));
      if (!obj) return;
      this.known.set(id, { bucket, d: env.d });
      this.receive(id, obj);
    };
    this.unsubs.push(
      onChildAdded(r, onSet),
      onChildChanged(r, onSet),
      onChildRemoved(r, (s) => {
        const id = s.key;
        if (!id) return;
        const cur = this.known.get(id);
        // Ignore removals from a bucket the object has already moved out of.
        if (!cur || cur.bucket !== bucket) return;
        this.known.delete(id);
        this.receive(id, null);
      }),
    );
  }

  /** Waits until the initial contents of every bucket have arrived. */
  private async loadAll(): Promise<void> {
    if (this.isOwner) {
      await Promise.all([get(this.r("keys")), get(this.r("own"))]);
    }
    await Promise.all(this.buckets().map((b) => get(this.r(b))));
    if (this.isOwner) {
      // Students' buckets are attached from the `own` listener; read them directly
      // so nothing is missing from the initial state.
      const own = await get(this.r("own"));
      if (this.closed) return;
      own.forEach((userSnap) => {
        const bucket = `own/${userSnap.key}` as Bucket;
        this.listenBucket(bucket);
        userSnap.forEach((s) => {
          const env = s.val() as unknown;
          if (!s.key || !isEnvelope(env) || this.known.has(s.key)) return;
          const obj = decode(s.key, env, this.secrets.get(s.key));
          if (!obj) return;
          this.known.set(s.key, { bucket, d: env.d });
          this.objs.set(s.key, obj);
        });
      });
    }
  }

  /** A remote change: update the mirror and pass it to the engine (batched). */
  private receive(id: string, obj: BoardObject | null): void {
    const old = this.objs.get(id);
    if (obj) this.objs.set(id, obj);
    else this.objs.delete(id);
    if (!this.loaded) return;
    if (this.isOwner) this.dirty = true;
    if (!this.incomingOlds.has(id)) this.incomingOlds.set(id, old);
    this.incoming.push([id, obj]);
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      const ops = this.incoming;
      const olds = this.incomingOlds;
      this.incoming = [];
      this.incomingOlds = new Map();
      if (!ops.length || this.closed) return;
      this.cb.onRemoteOps(ops);
      this.host?.afterRemoteOps(ops, olds);
    });
  }

  send(ops: Op[]): void {
    if (!ops.length || this.closed) return;
    const olds = new Map<string, BoardObject | undefined>();
    for (const [id] of ops) if (!olds.has(id)) olds.set(id, this.objs.get(id));
    this.write(ops.map(([id, obj]) => [id, obj && this.normalize(obj, olds.get(id))]));
    this.host?.afterOwnerOps(ops, olds);
    this.touch();
  }

  /** Host-generated changes: the engine has not seen them yet. */
  private hostWrite(ops: Op[]): void {
    if (!ops.length) return;
    this.write(ops);
    this.cb.onRemoteOps(ops);
  }

  /** Students cannot change who authored an object; new objects are theirs. */
  private normalize(obj: BoardObject, old: BoardObject | undefined): BoardObject {
    if (this.isOwner) return old ? obj : { ...obj, by: obj.by ?? "owner" };
    if (obj.type === "answer" || obj.type === "flag" || obj.type === "vote") return obj;
    return { ...obj, by: old ? old.by : this.user.uid } as BoardObject;
  }

  private write(ops: Op[]): void {
    for (const [id, obj] of ops) {
      if (obj) this.objs.set(id, obj);
      else this.objs.delete(id);
    }

    const updates: Record<string, unknown> = {};
    const place = (id: string, obj: BoardObject | null) => {
      const prev = this.known.get(id);
      if (!obj) {
        if (prev) updates[`${prev.bucket}/${id}`] = null;
        this.known.delete(id);
        if (this.isOwner && this.secrets.delete(id)) updates[`keys/${id}`] = null;
        return;
      }
      const bucket = bucketOf(obj, (pid) => this.objs.get(pid));
      const { env, secret } = encode(obj);
      if (prev && prev.bucket !== bucket) updates[`${prev.bucket}/${id}`] = null;
      updates[`${bucket}/${id}`] = env;
      this.known.set(id, { bucket, d: env.d });
      if (this.isOwner && obj.type === "quiz") {
        if (secret) this.secrets.set(id, secret);
        else this.secrets.delete(id);
        updates[`keys/${id}`] = secret;
      }
    };

    const touched = new Set<string>();
    for (const [id, obj] of ops) {
      place(id, obj);
      touched.add(id);
    }
    // A page that changed visibility takes its contents along.
    for (const [id, obj] of ops) {
      if (obj?.type !== "page") continue;
      for (const o of this.objs.values()) {
        if (touched.has(o.id) || (o.pg ?? MAIN_PAGE) !== id) continue;
        if (this.known.get(o.id)?.bucket !== bucketOf(o, (pid) => this.objs.get(pid))) {
          place(o.id, o);
          touched.add(o.id);
        }
      }
    }

    for (const chunk of chunks(updates, MAX_PATHS)) {
      update(ref(rtdb, this.base), chunk).catch((e: unknown) => {
        // Rejected by the rules: RTDB reverts its local cache and the listeners
        // deliver the real state, which brings the engine back in line.
        console.warn("[board] change rejected:", e);
      });
    }
  }

  private touch(): void {
    if (!this.isOwner) return;
    this.dirty = true;
    const now = Date.now();
    if (now - this.lastTouch < TOUCH_EVERY_MS) return;
    this.lastTouch = now;
    touchBoard(this.boardId).catch(() => {});
  }

  // ---------- live channel ----------

  private async listenLive(): Promise<void> {
    const peersRef = this.r("live/peers");
    const toPeer = (s: DataSnapshot): PeerInfo | null => {
      const v = s.val() as Partial<PeerInfo> | null;
      if (!s.key || !v?.uid) return null;
      return { cid: s.key, uid: v.uid, name: v.name ?? "Гість", color: v.color ?? "#6d3df0", owner: !!v.owner };
    };

    const initialPeers = await get(peersRef);
    initialPeers.forEach((s) => {
      const p = toPeer(s);
      if (p && p.cid !== this.cid) this.peers.set(p.cid, p);
    });
    const initialGoto = await get(this.r("live/goto"));
    this.lastGoto = (initialGoto.val() as { pg?: string } | null)?.pg ?? null;
    // Closed while loading: don't attach listeners nobody will unsubscribe.
    if (this.closed) return;

    this.unsubs.push(
      onChildAdded(peersRef, (s) => {
        const p = toPeer(s);
        if (!p || p.cid === this.cid) return;
        const isNew = !this.peers.has(p.cid);
        this.peers.set(p.cid, p);
        if (!this.loaded || !isNew) return;
        this.cb.onPeer(p);
        if (!p.owner) this.host?.onStudentJoin(p);
      }),
      onChildRemoved(peersRef, (s) => {
        if (!s.key || !this.peers.delete(s.key)) return;
        this.cb.onLeave(s.key);
      }),
      onChildChanged(this.r("live/cur"), (s) => this.onPointer(s, false)),
      onChildAdded(this.r("live/cur"), (s) => this.onPointer(s, false)),
      onChildChanged(this.r("live/laser"), (s) => this.onPointer(s, true)),
      onChildAdded(this.r("live/laser"), (s) => this.onPointer(s, true)),
      onValue(this.r("meta"), (s) => {
        const m = s.val() as BoardMeta | null;
        if (!m) return;
        this.meta = m;
        if (this.loaded && !this.isOwner) this.cb.onPerm(m.edit, m.protect);
      }),
    );

    if (this.isOwner) {
      const onPView = (s: DataSnapshot) => {
        const v = s.val() as ViewRect | null;
        if (s.key && v) this.cb.onPView({ cid: s.key, ...v });
      };
      const pv = this.r("live/pview");
      this.unsubs.push(onChildAdded(pv, onPView), onChildChanged(pv, onPView));
    } else {
      this.unsubs.push(
        onValue(this.r("live/view"), (s) => {
          const v = s.val() as ViewRect | null;
          if (v) this.cb.onView(v);
        }),
        onValue(this.r("live/goto"), (s) => {
          const pg = (s.val() as { pg?: string } | null)?.pg ?? null;
          if (!this.loaded || !pg || pg === this.lastGoto) return;
          this.lastGoto = pg;
          this.cb.onGoto(pg);
        }),
      );
    }
  }

  private onPointer(s: DataSnapshot, laser: boolean): void {
    const v = s.val() as { x?: number; y?: number; d?: number; mv?: string } | null;
    if (!this.loaded || !s.key || s.key === this.cid || !v) return;
    if (!laser) this.onMoves(s.key, v.mv);
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return;
    const m = { cid: s.key, x: v.x as number, y: v.y as number };
    if (laser) this.cb.onLaser({ ...m, d: v.d ? 1 : 0 });
    else this.cb.onCursor(m);
  }

  /** Applies a peer's drag preview: only from the owner, or from anyone while students may draw. */
  private onMoves(cid: string, mv: string | undefined): void {
    if (!mv || this.lastMoves.get(cid) === mv) return;
    this.lastMoves.set(cid, mv);
    if (!this.peers.get(cid)?.owner && !this.meta?.edit) return;
    let ops: Op[];
    try {
      ops = JSON.parse(mv) as Op[];
    } catch {
      return;
    }
    if (Array.isArray(ops)) this.cb.onMoves?.(ops.filter((op) => Array.isArray(op) && typeof op[0] === "string" && op[1]));
  }

  // `update`, not `set`: the cursor and the drag preview share the node without clobbering each other.
  sendCursor(x: number, y: number): void {
    if (!this.loaded) return;
    update(this.r(`live/cur/${this.cid}`), { x: Math.round(x), y: Math.round(y) }).catch(() => {});
  }

  sendMoves(ops: Op[] | null): void {
    if (!this.loaded) return;
    update(this.r(`live/cur/${this.cid}`), { mv: ops ? JSON.stringify(ops) : null }).catch(() => {});
  }

  sendLaser(x: number, y: number, down: boolean): void {
    if (!this.loaded) return;
    set(this.r(`live/laser/${this.cid}`), { x: Math.round(x), y: Math.round(y), d: down ? 1 : 0, t: Date.now() }).catch(() => {});
  }

  sendView(v: ViewRect): void {
    if (this.isOwner) set(this.r("live/view"), v).catch(() => {});
  }

  sendPView(v: ViewRect): void {
    if (!this.isOwner && this.loaded) set(this.r(`live/pview/${this.cid}`), v).catch(() => {});
  }

  sendGoto(pg: string): void {
    if (!this.isOwner) return;
    set(this.r("live/goto"), { pg, t: serverTimestamp() }).catch(() => {});
    this.cb.onGotoAck([...this.peers.values()].filter((p) => !p.owner).length);
  }
}

function chunks(updates: Record<string, unknown>, size: number): Record<string, unknown>[] {
  const entries = Object.entries(updates);
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < entries.length; i += size) out.push(Object.fromEntries(entries.slice(i, i + size)));
  return out;
}
