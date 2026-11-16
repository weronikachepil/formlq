// MathBoard: the canvas itself (camera, rendering, tools, history, sync).
// No React dependency; the UI subscribes through `opts.onState`.
import { Store, History } from "./store";
import { marckScriptFamily, uiFont } from "./fonts";
import { T, uid, measureText, TEXT_FONTS } from "./shapes";
import { DomLayer } from "./dom";
import { createTools } from "./tools";
import { clamp, inBounds, snapTo, unionBounds } from "./geom";
import { drawTrace, graphToUnits, graphValues, makeGraph } from "./graph";
import { makeSolid, solidPickEdge, solidSecPoints } from "./solid";
import { fileToImage, isPdf, pdfCount, pdfToImages } from "./images";
import { snapToRuler, projectOnLine, clearImageCache, cropToFrame, drawImageObject, imageFullRect } from "./extra";
import { exportPNG, exportPDF } from "./export";
import { buildTemplate } from "./templates";
import { makeTrig, trigAngleAt } from "./trig";
import { makeNumline } from "./numline";
import { makeColmath, makeFmodel, fmodelPartAt, colmathBox } from "./arith";
import { makeChart, makeDice, makeTree, treeBox, makeCplane, cplaneAt } from "./mathobj";
import { buildExercises } from "./exercises";
import { pollOptionAt, timerRemaining } from "./classroom";
import { QUIZ_W, gradeQuiz } from "./quiz";
import type {
  BoardObject,
  BoardPrefs,
  Bounds,
  Camera,
  ChartKind,
  ColmathOp,
  CommentObject,
  DiceKind,
  DrawEnv,
  DrawStyle,
  FmodelKind,
  GraphObject,
  ImageObject,
  LaserPoint,
  NumlineInterval,
  ObjectDraft,
  ObjectType,
  ObjectTypeDef,
  Op,
  PageObject,
  PageSummary,
  Peer,
  Point,
  PollVoteInfo,
  QuizAnswerValue,
  QuizGrade,
  QuizKey,
  QuizObject,
  QuizQuestion,
  QuizQuestionType,
  SolidKind,
  SolidObject,
  StampKind,
  StrokeObject,
  TextFontId,
  TimerObject,
  TrigObject,
  ViewRect,
} from "./types";
import type {
  BoardTransport,
  CursorMessage,
  InitMessage,
  LaserMessage,
  PeerInfo,
  PViewMessage,
  SyncStatus,
  TransportFactory,
} from "./transport";

export const CELL = 40;
const MIN_Z = 0.04;
const MAX_Z = 12;
const PREF_KEY = "mathboard_prefs";
const OWNER_ONLY = new Set<ObjectType>(["stamp", "task", "poll", "timer", "quiz"]);
const ACCENT = "#6d3df0";

export interface GraphPreset {
  id: string;
  label: string;
  exprs: string;
  params: Record<string, number>;
  ranges?: Record<string, [number, number]>;
}

export const GRAPH_PRESETS: GraphPreset[] = [
  { id: "plane", label: "Координатна площина", exprs: "", params: {} },
  { id: "line", label: "Пряма y = kx + b", exprs: "k*x+b", params: { k: 1, b: 0 } },
  { id: "parabola", label: "Парабола", exprs: "a*x^2+b*x+c", params: { a: 1, b: 0, c: -2 } },
  { id: "hyper", label: "Гіпербола y = k/x", exprs: "k/x", params: { k: 2 } },
  { id: "sin", label: "Синусоїда", exprs: "A*sin(w*x+f)", params: { A: 1, w: 1, f: 0 } },
  { id: "exp", label: "Показникова функція", exprs: "a^x", params: { a: 2 }, ranges: { a: [0.1, 5] } },
  { id: "circle", label: "Коло x² + y² = r²", exprs: "x^2+y^2=r^2", params: { r: 3 }, ranges: { r: [0.5, 8] } },
  { id: "system", label: "Система рівнянь", exprs: "y=2x-1\ny=-x+5\n(2, 3)", params: {} },
  { id: "ineq", label: "Нерівність", exprs: "y>x^2-2\ny<=-x+3", params: {} },
];

const CACHED_TYPES = new Set<ObjectType>(["graph", "solid"]);

// ====================== public types ======================

export interface MathBoardOptions {
  /** Builds the network transport; the board passes its callbacks in. */
  createSync: TransportFactory;
  /** Display name, stored on answers, flags and comment messages. */
  userName: string;
  /** Cursor colour of this user (used by the transport when announcing the peer). */
  color: string;
  /** User id; "anon" when missing. */
  uid?: string;
  /** The current user is the board owner (teacher). Updated by the transport's init message. */
  isOwner?: boolean;
  /** Initial edit permission (default true); updated by the transport. */
  canEdit?: boolean;
  /** Called (at most once per animation frame) with a fresh UI snapshot. */
  onState?: (state: BoardState) => void;
  /** Short toast message for the user. */
  onNotice?: (message: string) => void;
}

/** A tool as returned by `createTools`. */
export interface BoardTool {
  cursor?: string;
  activate?(): void;
  down(p: Point, e: PointerEvent): void;
  move(p: Point, e: PointerEvent): void;
  up(p: Point, e: PointerEvent): void;
  cancel?(): void;
  /** Returns a cursor to show while hovering, if any. */
  hover?(p: Point): string | null | undefined | void;
  /** Returns true when the key was handled. */
  key?(e: KeyboardEvent): boolean | null | undefined | void;
  overlay?(ctx: CanvasRenderingContext2D): void;
}

/** Transaction: changes are applied and sent immediately; `done` records one history entry. */
export interface BoardTx {
  set(id: string, obj: BoardObject | null): void;
  del(id: string): void;
  done(): void;
  /** Restores the state before the transaction. */
  cancel(): void;
}

/** A property patch for selected objects (any field of any object type). */
export type ObjectPatch = Partial<BoardObject>;

export interface PeerSummary {
  cid: string;
  name: string;
  color: string;
  uid: string;
  owner: boolean;
  /** Page the peer is on, if known. */
  pg: string | null;
}

export interface QuizProgress {
  answered: number;
  total: number;
  submitted: boolean;
  closed: boolean;
}

export interface ScoreSummary {
  earned: number;
  max: number;
}

/** The student whose test answers the owner is viewing. */
export interface ViewingInfo {
  uid: string;
  name: string;
  earned: number;
  max: number;
  answered: number;
  total: number;
  submitted: boolean;
}

export interface CommentState {
  obj: CommentObject;
  /** Pin position in screen pixels relative to the board root. */
  sx: number;
  sy: number;
  canModify: boolean;
}

export interface PdfAskState {
  name: string;
  total: number;
  /** First page suggested in the dialog. */
  start: number;
  /** Appending to pages inserted earlier. */
  more: boolean;
}

export type EditingKind = "text" | "formula";

/** Snapshot passed to `opts.onState` and returned by `getState()`. */
export interface BoardState {
  tool: string;
  sel: BoardObject[];
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  status: SyncStatus;
  followCid: string | null;
  peers: PeerSummary[];
  showKeys: boolean;
  score: ScoreSummary | null;
  viewing: ViewingInfo | null;
  quiz: QuizProgress | null;
  stampKind: StampKind;
  stampText: string;
  canEdit: boolean;
  isOwner: boolean;
  style: DrawStyle;
  prefs: BoardPrefs;
  inter: string | null;
  secPick: string | null;
  mathError: string | null;
  page: string;
  uid: string;
  protect: boolean;
  donePages: string[];
  comment: CommentState | null;
  pages: PageSummary[];
  follow: boolean;
  vertEdit: string | null;
  /** Image being cropped: its handles move the crop edges instead of scaling it. */
  cropEdit: string | null;
  editing: EditingKind | null;
  nlEdit: string | null;
  srcEdit: string | null;
  pdfAsk: PdfAskState | null;
}

/** One cell of the results table; grade fields are missing when the question has no key. */
export type QuizResultCell = Partial<QuizGrade> & { val: QuizAnswerValue };

export interface QuizResultRow {
  uid: string;
  name?: string;
  /** Template question id → result. */
  per: Record<string, QuizResultCell>;
  total: number;
  answered?: number;
  submitted?: boolean;
}

export interface QuizResults {
  quizzes: { id: string; n: number; pts: number; qt: QuizQuestionType; key?: QuizKey }[];
  rows: QuizResultRow[];
  max: number;
  closed: boolean;
  endsAt: number | null;
  separate: boolean;
  draft: boolean;
  templateId: string;
}

export interface QuizStat {
  q: QuizObject;
  answered: number;
  full: number;
  /** choice questions: letter → number of answers. */
  dist: Record<string, number>;
}

export interface ImportedTest {
  title?: string;
  questions: QuizQuestion[];
  /** Image file name → data URL. */
  images: Map<string, string>;
}

export interface AssignTarget {
  uid: string;
  name: string;
}

// ====================== internal types ======================

interface TextStyle {
  ff?: TextFontId;
  b?: boolean;
  i?: boolean;
}

type EditingState =
  | { kind: "text"; id: string | null; at: Point; ta: HTMLTextAreaElement; fs: number; color: string; ts: TextStyle }
  | { kind: "formula"; id: string };

type InterDrag =
  | { local: true; sx: number; sy: number; o0: BoardObject }
  | { local?: false; sx: number; sy: number; o0: BoardObject; tx: BoardTx };

/** Local-only view changes (students may rotate solids, pan graphs, … without changing the board). */
type LocalPatch = Partial<Pick<GraphObject, "params" | "v">> &
  Partial<Pick<TrigObject, "ang">> &
  Partial<Pick<SolidObject, "school" | "yaw" | "pitch">>;

interface PdfMore {
  x: number;
  y: number;
  w: number;
  /** Next PDF page number to suggest. */
  next: number;
}

interface PdfAsk {
  file: File;
  name: string;
  total: number;
  at: Point | null;
  more: PdfMore | null;
  start: number;
}

interface CacheEntry {
  o: BoardObject;
  z: number;
  pw: number;
  ph: number;
  c: HTMLCanvasElement;
  bx: number;
  by: number;
}

interface Handlers {
  down: (e: PointerEvent) => void;
  move: (e: PointerEvent) => void;
  up: (e: PointerEvent) => void;
  leave: () => void;
  wheel: (e: WheelEvent) => void;
  ctx: (e: MouseEvent) => void;
  keydown: (e: KeyboardEvent) => void;
  keyup: (e: KeyboardEvent) => void;
  blur: () => void;
  paste: (e: ClipboardEvent) => void;
  dragover: (e: DragEvent) => void;
  drop: (e: DragEvent) => void;
  touch: (e: TouchEvent) => void;
}

type Timer = ReturnType<typeof setTimeout>;

const NET_EVERY_MS = 40;
/** Hard stylus press that moves an object while drawing: force (0–1), within this time and distance (screen px). */
const PRESS_GRAB = 0.7;
const PRESS_GRAB_MS = 500;
const PRESS_GRAB_SLOP = 10;
/** Tools where a press means something else (selecting, panning, typing, placing). */
const NO_PRESS_GRAB = new Set(["select", "hand", "laser", "eraser", "text", "formula", "comment", "stamp", "compass"]);
const HEAVY_CHARS = 60_000;

/** The object without its long strings (image data): what a drag preview needs. */
function withoutHeavy(o: BoardObject): BoardObject {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (!(typeof v === "string" && v.length > 4000)) out[k] = v;
  return out as unknown as BoardObject;
}

/** Total length of an object's long top-level strings (data URLs): a cheap size estimate. */
function heavySize(o: BoardObject | null): number {
  if (!o) return 0;
  let n = 0;
  for (const v of Object.values(o)) if (typeof v === "string" && v.length > 4000) n += v.length;
  return n;
}

type DistributiveOmit<O, K extends PropertyKey> = O extends unknown ? Omit<O, K> : never;

/** A draft whose position is assigned when it is placed. */
export type UnplacedDraft = DistributiveOmit<Extract<ObjectDraft, { x: number; y: number }>, "x" | "y">;

/** Registry lookup. Every def accepts any BoardObject of its own type. */
const defOf = (o: BoardObject): ObjectTypeDef => T[o.type] as ObjectTypeDef;

const closestOf = (t: EventTarget | null, sel: string): Element | null => (t instanceof Element ? t.closest(sel) : null);

const EDITABLE = 'input, textarea, math-field, select, [contenteditable="true"]';

export class MathBoard {
  root: HTMLElement;
  opts: MathBoardOptions;
  store = new Store();
  history = new History();
  cam: Camera = { x: 0, y: 0, z: 1 };
  sel = new Set<string>();
  tool = "select";
  style: DrawStyle = { c: "#1d1b2e", s: 4, f: null, dash: false, fs: 28, mfs: 36, ff: "comfortaa", b: false, i: false, hc: "#ffd43b", hs: 24 };
  prefs: BoardPrefs = { grid: "squares", snap: false, keep: false, recognize: true, ...loadPrefs() };
  baseCanEdit: boolean;
  uid: string;
  protect = true;
  timeOffset = 0;
  isOwner: boolean;
  status: SyncStatus = "connecting";
  peers = new Map<string, Peer>();
  pointers = new Map<number, { x: number; y: number; type: string }>();
  editing: EditingState | null = null;
  inter: string | null = null;
  interDrag: InterDrag | null = null;
  secPick: string | null = null;
  secDrag: { idx: number; tx: BoardTx; id: string } | null = null;
  vertEdit: string | null = null;
  /** Image in crop mode (see `toggleCrop`). */
  cropEdit: string | null = null;
  hover: Point | null = null;
  space = false;
  active: BoardTool | null = null;
  panning: { sx: number; sy: number; cx: number; cy: number } | null = null;
  pinch: { d0: number; mx: number; my: number; cam: Camera } | null = null;
  liveTx: BoardTx | null = null;
  liveTimer?: Timer;
  netBuf = new Map<string, BoardObject | null>();
  netTimer?: Timer;
  movesSent = false;
  heavyTimer?: Timer;
  clip: BoardObject[] = [];
  pasteN = 0;
  lastDown: { t: number; x: number; y: number } | null = null;
  lastPen = 0;
  lastCursorSent = 0;
  placed = false;
  dirty = true;
  domDirty = true;
  raf = 0;
  ovRaf = 0;
  emitQueued = false;
  page = "p1";
  pageCams: Record<string, Camera> = {};
  follow = false;
  followCid: string | null = null;
  teacherView: ViewRect | null = null;
  laser: { pts: LaserPoint[]; down: boolean } = { pts: [], down: false };
  laserHeld = false;
  lastLaser = 0;
  penEraser = false;
  /** A stylus press on an object that may turn into moving it, if pressed hard soon enough. */
  pressGrab: { t: number; x: number; y: number; p: Point } | null = null;
  /** Moving an object grabbed by a hard stylus press (the select tool runs the drag). */
  pressMoving = false;
  viewTimer?: Timer;
  lastView = "";
  private _objsV = -1;
  private _objsP: string | null = null;
  private _objsList: BoardObject[] = [];
  private _pagesV = -1;
  private _pagesList: PageSummary[] | null = null;
  commentOpen: string | null = null;
  showKeys = false;
  /** Local (unsaved) view changes per object: students may look around but not change the board. */
  localView = new Map<string, LocalPatch>();
  viewStudent: string | null = null;
  stampKind: StampKind = "ok";
  stampText?: string;
  private _voteV = -1;
  private _voteInfo = new Map<string, PollVoteInfo>();
  private _doneV = -1;
  private _done = new Set<string>();
  private _qsV = -1;
  private _qs: Map<string, QuizStat> | null = null;
  timerNotified = new Set<string>();
  private _timerTick: Timer | null = null;
  private _ac?: AudioContext;
  autoGoto = false;
  seenMine?: Set<string>;
  pendingFit = false;
  mathError?: string;
  srcEdit: string | null = null;
  nlEdit: string | null = null;
  pdfFiles?: Map<string, File>;
  pdfAsk: PdfAsk | null = null;
  objCache?: Map<string, CacheEntry>;
  private _lastRenderZ?: number;

  rect!: DOMRect;
  W = 0;
  H = 0;
  dpr = 1;
  cv: HTMLCanvasElement;
  domEl: HTMLDivElement;
  ov: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  octx: CanvasRenderingContext2D;
  dom: DomLayer;
  tools: Record<string, BoardTool>;
  sync: BoardTransport | null = null;
  h!: Handlers;
  ro!: ResizeObserver;
  unsubStore: () => void;

  constructor(root: HTMLElement, opts: MathBoardOptions) {
    this.root = root;
    this.opts = opts;
    this.baseCanEdit = opts.canEdit !== false;
    this.uid = opts.uid || "anon";
    this.isOwner = !!opts.isOwner;

    root.classList.add("mb-root");
    root.innerHTML = "";
    this.cv = document.createElement("canvas");
    this.cv.className = "mb-canvas";
    this.domEl = document.createElement("div");
    this.domEl.className = "mb-dom";
    this.ov = document.createElement("canvas");
    this.ov.className = "mb-overlay";
    root.append(this.cv, this.domEl, this.ov);
    const ctx = this.cv.getContext("2d");
    const octx = this.ov.getContext("2d");
    if (!ctx || !octx) throw new Error("Canvas 2D is not supported");
    this.ctx = ctx;
    this.octx = octx;
    this.dom = new DomLayer(this, this.domEl);
    this.tools = createTools(this);
    this.loadFonts();

    this.unsubStore = this.store.subscribe((changes) => {
      // When the owner changes an object, a student's local view of it is reset to the owner's.
      if (changes === null) this.localView.clear();
      else for (const [id] of changes) this.localView.delete(id);
      for (const id of [...this.sel]) if (!this.store.has(id)) this.sel.delete(id);
      if (this.inter && !this.store.has(this.inter)) this.inter = null;
      if (this.vertEdit && !this.store.has(this.vertEdit)) this.vertEdit = null;
      if (this.cropEdit && !this.store.has(this.cropEdit)) this.cropEdit = null;
      if (this.secPick && !this.store.has(this.secPick)) this.secPick = null;
      if (this.page !== "p1" && !this.store.has(this.page)) this.page = "p1";
      this.domDirty = true;
      this.requestRender();
      this.emit();
    });

    this.bind();
    this.resize();
    this.sync = opts.createSync({
      onStatus: (s: SyncStatus) => { this.status = s; this.emit(); },
      onInit: (m: InitMessage) => this.onInit(m),
      onRemoteOps: (ops: Op[]) => { this.store.apply(ops); },
      // A peer's drag preview: their light fields over our copy (which keeps the image data).
      onMoves: (ops: Op[]) => {
        const out: Op[] = [];
        for (const [id, patch] of ops) {
          const cur = this.store.get(id);
          if (cur && patch && cur.type === patch.type && !this.netBuf.has(id)) out.push([id, { ...cur, ...patch, id } as BoardObject]);
        }
        if (out.length) this.store.apply(out);
      },
      onPView: (m: PViewMessage) => this.onPView(m),
      onGoto: (pg: string) => this.onGoto(pg),
      onGotoAck: (n: number) => this.onGotoAck(n),
      onTime: (off: number) => { this.timeOffset = off; this.requestRender(); },
      onPeer: (m: PeerInfo) => {
        this.peers.set(m.cid, { name: m.name, color: m.color, uid: m.uid, owner: m.owner, x: 0, y: 0, t: 0 });
        this.emit();
      },
      onLeave: (cid: string) => { this.peers.delete(cid); this.requestRender(); this.emit(); },
      onCursor: (m: CursorMessage) => {
        const p = this.peers.get(m.cid);
        if (p) { p.x = m.x; p.y = m.y; p.t = performance.now(); this.requestRender(); }
      },
      onPerm: (canEdit: boolean, protect: boolean) => { this.protect = protect; this.setCanEdit(canEdit); },
      onView: (m: ViewRect) => { this.teacherView = m; if (this.follow && !this.isOwner) this.applyView(m); },
      onLaser: (m: LaserMessage) => {
        const pr = this.peers.get(m.cid);
        if (!pr) return;
        pr.laser = pr.laser || [];
        if (m.d) pr.laser.push({ x: m.x, y: m.y, t: performance.now() });
        this.requestRender();
      },
    });
    if (!this.canEdit) this.tool = "hand";
    this.sync.connect();
  }

  // ---------- lifecycle ----------
  bind(): void {
    const r = this.root;
    this.h = {
      down: (e) => this.onPointerDown(e),
      move: (e) => this.onPointerMove(e),
      up: (e) => this.onPointerUp(e),
      leave: () => { this.hover = null; this.requestOverlay(); },
      wheel: (e) => this.onWheel(e),
      ctx: (e) => e.preventDefault(),
      keydown: (e) => this.onKey(e),
      keyup: (e) => { if (e.key === " ") { this.space = false; this.updateCursor(); } },
      blur: () => { this.space = false; },
      paste: (e) => this.onPaste(e),
      dragover: (e) => { if (this.canEdit) e.preventDefault(); },
      drop: (e) => this.onDrop(e),
      // iPadOS: unless touches are cancelled, Scribble and text selection take over Apple
      // Pencil strokes (the stroke gets a pointercancel midway and the selection menu shows).
      // Pointer events still arrive; the board's own HTML controls keep their taps.
      touch: (e) => {
        if (e.cancelable && !closestOf(e.target, "[data-ui], " + EDITABLE)) e.preventDefault();
      },
    };
    r.addEventListener("pointerdown", this.h.down);
    r.addEventListener("pointermove", this.h.move);
    r.addEventListener("pointerup", this.h.up);
    r.addEventListener("pointerleave", this.h.leave);
    r.addEventListener("pointercancel", this.h.up);
    r.addEventListener("wheel", this.h.wheel, { passive: false });
    r.addEventListener("contextmenu", this.h.ctx);
    window.addEventListener("keydown", this.h.keydown);
    window.addEventListener("keyup", this.h.keyup);
    window.addEventListener("blur", this.h.blur);
    window.addEventListener("paste", this.h.paste);
    r.addEventListener("dragover", this.h.dragover);
    r.addEventListener("drop", this.h.drop);
    r.addEventListener("touchstart", this.h.touch, { passive: false });
    r.addEventListener("touchmove", this.h.touch, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(r);
  }

  destroy(): void {
    const r = this.root;
    r.removeEventListener("pointerdown", this.h.down);
    r.removeEventListener("pointermove", this.h.move);
    r.removeEventListener("pointerup", this.h.up);
    r.removeEventListener("pointerleave", this.h.leave);
    r.removeEventListener("pointercancel", this.h.up);
    r.removeEventListener("wheel", this.h.wheel);
    r.removeEventListener("contextmenu", this.h.ctx);
    window.removeEventListener("keydown", this.h.keydown);
    window.removeEventListener("keyup", this.h.keyup);
    window.removeEventListener("blur", this.h.blur);
    window.removeEventListener("paste", this.h.paste);
    r.removeEventListener("dragover", this.h.dragover);
    r.removeEventListener("drop", this.h.drop);
    r.removeEventListener("touchstart", this.h.touch);
    r.removeEventListener("touchmove", this.h.touch);
    clearTimeout(this.viewTimer);
    clearTimeout(this.heavyTimer);
    clearImageCache();
    this.ro.disconnect();
    this.unsubStore();
    this.flushNet();
    this.sync?.close();
    this.dom.destroy();
    cancelAnimationFrame(this.raf);
    this.stopEditing();
    r.innerHTML = "";
    r.classList.remove("mb-root");
  }

  resize(): void {
    const rect = this.root.getBoundingClientRect();
    this.rect = rect;
    this.W = rect.width;
    this.H = rect.height;
    this.dpr = window.devicePixelRatio || 1;
    for (const c of [this.cv, this.ov]) {
      c.width = Math.max(1, Math.round(this.W * this.dpr));
      c.height = Math.max(1, Math.round(this.H * this.dpr));
    }
    if (!this.placed && this.W > 0) {
      this.cam.x = -this.W / 2 / this.cam.z;
      this.cam.y = -this.H / 2 / this.cam.z;
      this.placed = true;
    }
    this.requestRender();
  }

  // ---------- data, connection ----------
  onInit(m: InitMessage): void {
    this.baseCanEdit = m.canEdit;
    this.isOwner = m.isOwner;
    this.protect = m.protect;
    this.peers = new Map(m.peers.map((p): [string, Peer] => [p.cid, { name: p.name, color: p.color, uid: p.uid, owner: p.owner, view: p.view, x: 0, y: 0, t: 0 }]));
    this.store.replaceAll(m.objs);
    this.history.clear();
    this.maybeSwitchToMyPage();
    if (m.goto && !this.isOwner && !this.autoGoto) { this.autoGoto = true; this.onGoto(m.goto, true); }
    if (m.view) { this.teacherView = m.view; if (this.follow && !this.isOwner) this.applyView(m.view); }
    if (!this.canEdit) this.tool = "hand";
    this.updateCursor();
    this.emit();
  }

  setCanEdit(v: boolean): void {
    this.baseCanEdit = v;
    if (!this.canEdit) {
      this.cancelTool();
      this.stopEditing();
      this.tool = "hand";
      this.sel.clear();
    }
    this.domDirty = true;
    this.dom.nodes.forEach((n) => { if (n.sig !== undefined) n.sig = ""; });
    this.updateCursor();
    this.requestRender();
    this.emit();
  }

  // ---------- coordinates ----------
  world(e: { clientX: number; clientY: number }): Point {
    const z = this.cam.z;
    return [(e.clientX - this.rect.left) / z + this.cam.x, (e.clientY - this.rect.top) / z + this.cam.y];
  }

  viewCenter(): Point {
    return [this.cam.x + this.W / 2 / this.cam.z, this.cam.y + this.H / 2 / this.cam.z];
  }

  get snapStep(): number { return CELL / 2; }

  snapPoint(p: Point): Point {
    return this.prefs.snap ? [snapTo(p[0], this.snapStep), snapTo(p[1], this.snapStep)] : p;
  }

  // ---------- camera ----------
  zoomAt(sx: number, sy: number, factor: number): void {
    const c = this.cam;
    const z1 = clamp(c.z * factor, MIN_Z, MAX_Z);
    const wx = c.x + sx / c.z;
    const wy = c.y + sy / c.z;
    c.z = z1;
    c.x = wx - sx / z1;
    c.y = wy - sy / z1;
    this.requestRender();
    this.emit();
  }

  zoomBy(factor: number): void { this.zoomAt(this.W / 2, this.H / 2, factor); }

  resetZoom(): void {
    const c = this.cam;
    const wx = c.x + this.W / 2 / c.z;
    const wy = c.y + this.H / 2 / c.z;
    c.z = 1;
    c.x = wx - this.W / 2;
    c.y = wy - this.H / 2;
    this.requestRender();
    this.emit();
  }

  // ---------- time, polls, timers ----------
  serverNow(): number { return Date.now() + this.timeOffset; }

  /** Page object by id, if it exists. */
  private getPage(id: string): PageObject | undefined {
    const o = this.store.get(id);
    return o?.type === "page" ? o : undefined;
  }

  voteInfo(): Map<string, PollVoteInfo> {
    if (this._voteV === this.store.version) return this._voteInfo;
    this._voteV = this.store.version;
    const map = new Map<string, PollVoteInfo>();
    for (const o of this.store.all()) {
      if (o.type !== "vote") continue;
      const e = map.get(o.poll) || { counts: [], mine: -1, total: 0 };
      e.counts[o.opt] = (e.counts[o.opt] || 0) + 1;
      e.total++;
      if (o.by === this.uid) e.mine = o.opt;
      map.set(o.poll, e);
    }
    this._voteInfo = map;
    return map;
  }

  vote(pollId: string, opt: number): void {
    const poll = this.store.get(pollId);
    if (!poll || poll.type !== "poll") return;
    if (poll.closed) { this.opts.onNotice?.("Голосування закрито"); return; }
    const id = `vote_${pollId}_${this.uid}`;
    const t = this.tx();
    const cur = this.store.get(id);
    if (cur?.type === "vote" && cur.opt === opt) t.del(id);
    else t.set(id, { id, type: "vote", poll: pollId, opt, by: this.uid, z: 0, pg: poll.pg || "p1" });
    t.done();
  }

  /** Click on a poll option; true if an option was hit. */
  tryPollVote(p: Point): boolean {
    const list = this.objs();
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (o.type !== "poll") continue;
      const k = pollOptionAt(o, p);
      if (k >= 0) { this.vote(o.id, k); return true; }
    }
    return false;
  }

  tickTimers(): void {
    const timers = this.objs().filter((o): o is TimerObject => o.type === "timer" && o.running);
    if (!timers.length) return;
    const now = this.serverNow();
    for (const o of timers) {
      const key = o.id + ":" + o.endsAt;
      if (timerRemaining(o, now) <= 0 && !this.timerNotified.has(key)) { this.timerNotified.add(key); this.beep(); }
    }
    if (!this._timerTick) this._timerTick = setTimeout(() => { this._timerTick = null; this.requestRender(); }, 250);
  }

  beep(): void {
    try {
      const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this._ac = this._ac || new AC();
      for (let i = 0; i < 3; i++) {
        const o = this._ac.createOscillator();
        const g = this._ac.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        const t0 = this._ac.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
        o.connect(g).connect(this._ac.destination);
        o.start(t0);
        o.stop(t0 + 0.3);
      }
    } catch {}
  }

  pollReset(id: string): void {
    const t = this.tx();
    for (const o of this.store.all()) if (o.type === "vote" && o.poll === id) t.del(o.id);
    t.done();
  }

  // Timer controls change the object, so only the owner can use them.
  timerStart(id: string): void {
    this.live(id, (o) => {
      if (o.type !== "timer") return o;
      const left = o.left ?? o.dur;
      return { ...o, running: true, endsAt: Math.round(this.serverNow() + (left > 0 ? left : o.dur)), left: left > 0 ? left : o.dur };
    });
    this.endLive();
  }

  timerPause(id: string): void {
    this.live(id, (o) => (o.type === "timer" ? { ...o, running: false, left: timerRemaining(o, this.serverNow()), endsAt: null } : o));
    this.endLive();
  }

  timerReset(id: string, dur?: number): void {
    this.live(id, (o) => {
      if (o.type !== "timer") return o;
      const d = dur ?? o.dur;
      return { ...o, running: false, dur: d, left: d, endsAt: null };
    });
    this.endLive();
  }

  // ---------- tests ----------
  answerKey(quizId: string): string { return `ans_${quizId}_${this.uid}`; }

  answerQuiz(quizId: string, val: QuizAnswerValue | undefined): void {
    const q = this.store.get(quizId);
    if (!q || this.isOwner) return;
    const pg = q.pg || "p1";
    if (this.getPage(pg)?.closed) { this.opts.onNotice?.("Тест завершено"); return; }
    if (this.store.has(`flag_${pg}_${this.uid}`)) { this.opts.onNotice?.("Тест уже здано"); return; }
    const id = this.answerKey(quizId);
    const empty = val === "" || val === undefined || (typeof val === "object" && !Object.keys(val).length);
    this.commit([[id, empty || val === undefined ? null : { id, type: "answer", quiz: quizId, val, by: this.uid, name: this.opts.userName, pg, z: 0 }]]);
    this.flushNet();
    this.domDirty = true;
    this.requestRender();
  }

  /** The owner starts a test: every student is moved to this page. */
  startTest(pg: string, minutes: number | string = 0, separate = false): void {
    if (!this.isOwner) return;
    const cur = this.getPage(pg);
    if (cur) {
      const t = this.tx();
      const mins = Number(minutes) > 0 ? Number(minutes) : 0;
      const endsAt = mins ? Math.round(this.serverNow() + mins * 60000) : null;
      t.set(pg, { ...cur, closed: false, draft: false, endsAt, perStudent: !!separate });
      // A timer on the page shows everyone the time left (the owner's host logic closes the test).
      if (mins) {
        const quizzes = this.store.all().filter((o): o is QuizObject => o.type === "quiz" && (o.pg || "p1") === pg);
        const first = quizzes.sort((a, b) => a.n - b.n)[0];
        const tm = this.store.all().find((o): o is TimerObject => o.type === "timer" && (o.pg || "p1") === pg);
        const base = { type: "timer", w: 220, h: 120, dur: mins * 60000, left: mins * 60000, running: true, endsAt, title: "До кінця тесту" } as const;
        if (tm) t.set(tm.id, { ...tm, ...base });
        else {
          const id = uid();
          t.set(id, { ...base, id, z: this.store.topZ() + 5, pg, by: "owner", x: (first?.x ?? -320) + (first?.w || QUIZ_W) + 40, y: first?.y ?? 0 });
        }
      }
      t.done();
    }
    if (separate) { this.opts.onNotice?.("Кожен учень отримав свій листок із тестом"); return; }
    // The transport acknowledges synchronously via onGotoAck.
    this.sync?.sendGoto(pg);
  }

  onGotoAck(n: number): void {
    this.opts.onNotice?.(n > 0
      ? `Тест запущено: на аркуші ${n} ${n === 1 ? "учень" : "учнів"}`
      : "Учнів на дошці немає. Якщо ви відкрили посилання учня в цьому ж браузері, ви там теж вчитель: використайте інший браузер або вікно «Інкогніто»");
  }

  onGoto(pg: string, quiet = false): void {
    if (this.isOwner || !this.pages().some((p) => p.id === pg)) return;
    if (this.page !== pg) this.setPage(pg);
    if (!quiet) this.opts.onNotice?.("Вчитель запустив тест");
  }

  /** A student's progress on the current test page. */
  quizProgress(): QuizProgress | null {
    const quizzes = this.objs().filter((o) => o.type === "quiz");
    if (!quizzes.length || this.isOwner) return null;
    let answered = 0;
    for (const q of quizzes) {
      const a = this.store.get(this.answerKey(q.id));
      if (a?.type === "answer" && a.val !== "" && !(typeof a.val === "object" && !Object.keys(a.val).length)) answered++;
    }
    return { answered, total: quizzes.length, submitted: this.store.has(`flag_${this.page}_${this.uid}`), closed: !!this.getPage(this.page)?.closed };
  }

  /** My total score on the current page (appears after submission). */
  myScore(): ScoreSummary | null {
    const s = this.store.get(`score_${this.page}_${this.uid}`);
    return s?.type === "score" ? { earned: s.earned, max: s.max } : null;
  }

  /** Show the answer key on cards to the owner. Has no effect for students. */
  setShowKeys(v: boolean): void {
    this.showKeys = !!v;
    this.domDirty = true;
    this.requestRender();
    this.emit();
  }

  /** Rendering context of a question card. */
  quizCtx(o: QuizObject) {
    // "View a student's work": the owner sees the selected student's graded answers.
    const viewing = this.isOwner ? this.viewStudent : null;
    const ans = this.store.get(viewing ? `ans_${o.id}_${viewing}` : this.answerKey(o.id));
    const mine = ans?.type === "answer" ? ans : undefined;
    const st = this.isOwner && !viewing ? this.quizStats().get(o.id) : null;
    const pg = o.pg || "p1";
    const markupFn = this.dom.markupFn;
    return {
      mine: mine?.val,
      mineRef: mine,
      viewing,
      reveal: !!o.reveal || !!viewing,
      isOwner: this.isOwner,
      locked: this.store.has(`flag_${pg}_${this.uid}`) || !!this.getPage(pg)?.closed,
      showKey: this.isOwner && this.showKeys,
      stats: st,
      statsKey: (viewing || "") + (st ? `${st.answered}/${st.full}/${Object.entries(st.dist).join()}` : ""),
      markup: markupFn ? (latex: string): string => { try { return markupFn(latex); } catch { return latex; } } : null,
    };
  }

  quizStats(): Map<string, QuizStat> {
    if (this._qsV === this.store.version && this._qs) return this._qs;
    this._qsV = this.store.version;
    const quizzes = new Map<string, QuizStat>();
    for (const o of this.store.all()) if (o.type === "quiz") quizzes.set(o.id, { q: o, answered: 0, full: 0, dist: {} });
    for (const a of this.store.all()) {
      if (a.type !== "answer" || a.by === this.uid) continue;
      const e = quizzes.get(a.quiz);
      if (!e) continue;
      e.answered++;
      if (e.q.qt === "choice" && typeof a.val === "string") e.dist[a.val] = (e.dist[a.val] || 0) + 1;
      if (gradeQuiz(e.q, a.val)?.state === "full") e.full++;
    }
    this._qs = quizzes;
    return quizzes;
  }

  /** Results table for the owner. */
  quizResults(pg0: string): QuizResults {
    // With per-student sheets, results from the personal copies are gathered into the template's table.
    const pg = this.getPage(pg0)?.from || pg0;
    const grp = new Set(this.testGroup(pg));
    const quizzes = this.store.all().filter((o): o is QuizObject => o.type === "quiz" && (o.pg || "p1") === pg).sort((a, b) => a.n - b.n);
    const tplByN = new Map(quizzes.map((q) => [q.n, q]));
    // question id (template or copy) → { t: template question, q: the graded question }
    const map = new Map<string, { t: QuizObject; q: QuizObject }>();
    for (const q of this.store.all()) {
      if (q.type !== "quiz" || !grp.has(q.pg || "p1")) continue;
      const t = tplByN.get(q.n);
      if (t) map.set(q.id, { t, q });
    }
    const students = new Map<string, QuizResultRow>();
    const get = (id: string, name?: string): QuizResultRow => {
      let r = students.get(id);
      if (!r) { r = { uid: id, name, per: {}, total: 0 }; students.set(id, r); }
      return r;
    };
    for (const a of this.store.all()) {
      if (a.type === "flag" && grp.has(a.pg) && a.kind === "done") { get(a.by, a.name).submitted = true; continue; }
      if (a.type !== "answer" || a.by === this.uid) continue;
      const m = map.get(a.quiz);
      if (!m) continue;
      const { t, q } = m;
      const st = get(a.by, a.name);
      st.name = a.name || st.name;
      const g = gradeQuiz(q, a.val);
      st.per[t.id] = { ...g, val: a.val };
      if (g && g.state !== "empty") st.answered = (st.answered || 0) + 1;
      st.total += g?.earned || 0;
    }
    const max = quizzes.reduce((s2, q) => s2 + (q.pts || 0), 0);
    const rows = [...students.values()]
      .map((r) => ({ ...r, total: Math.round(r.total * 100) / 100 }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "uk"));
    const tpl = this.getPage(pg);
    return {
      quizzes: quizzes.map((q) => ({ id: q.id, n: q.n, pts: q.pts, qt: q.qt, key: q.key })),
      rows,
      max,
      closed: !!tpl?.closed,
      endsAt: tpl?.endsAt || null,
      separate: !!tpl?.perStudent,
      draft: !!tpl?.draft,
      templateId: pg,
    };
  }

  /** End a test: answers close; whoever has not submitted is submitted automatically (by the owner's host logic). */
  endTest(pg: string, closed: boolean): void {
    if (!this.isOwner) return;
    const t = this.tx();
    for (const id of this.testGroup(pg)) {
      const cur = this.getPage(id);
      if (cur) t.set(id, { ...cur, closed: !!closed });
    }
    t.done();
    this.opts.onNotice?.(closed ? "Тест завершено: відповіді закрито, усім підраховано бали" : "Тест відновлено: учні знову можуть відповідати");
  }

  revealTest(pg: string, on: boolean): void {
    if (!this.isOwner) return;
    const grp = new Set(this.testGroup(pg));
    const changes = this.store.all()
      .filter((o): o is QuizObject => o.type === "quiz" && grp.has(o.pg || "p1"))
      .map((o): Op => [o.id, { ...o, reveal: !!on }]);
    this.commit(changes);
    this.flushNet();
  }

  resetAnswers(pg: string): void {
    if (!this.isOwner) return;
    const grp = new Set(this.testGroup(pg));
    const ids = new Set(this.store.all().filter((o) => o.type === "quiz" && grp.has(o.pg || "p1")).map((o) => o.id));
    const t = this.tx();
    for (const o of this.store.all()) {
      if ((o.type === "answer" && ids.has(o.quiz)) || ((o.type === "flag" || o.type === "score") && grp.has(o.pg))) t.del(o.id);
    }
    t.done();
  }

  /** Creates a test page from parsed questions. */
  importTest({ title, questions, images }: ImportedTest): void {
    if (!this.isOwner || !questions.length) return;
    const pg = "pg_" + uid();
    const t = this.tx();
    let z = this.store.topZ();
    t.set(pg, { id: pg, type: "page", name: String(title || "Тест").slice(0, 40), z: ++z, test: true, draft: true });
    let y = 0;
    for (const q of questions) {
      const o: QuizObject = {
        id: uid(), type: "quiz", z: ++z, pg, by: "owner", x: -QUIZ_W / 2, y, w: QUIZ_W, h: 240 + (q.img ? 260 : 0),
        n: q.n, qt: q.qt, pts: q.pts, text: q.text, img: images.get(q.img) || "", opts: q.opts, left: q.left, right: q.right,
        key: q.key, expl: q.expl, explImg: images.get(q.explImg) || "", reveal: false,
      };
      t.set(o.id, o);
      y += o.h + 36;
    }
    t.done();
    this.pendingFit = true;
    this.setPage(pg);
    this.domDirty = true;
    this.requestRender();
    this.opts.onNotice?.(`Тест створено (${questions.length} питань). Учні його не бачать, доки ви не натиснете «Запустити тест»`);
  }

  // ---------- comments ----------
  addComment(p: Point): void {
    if (!this.canEdit) return;
    const o = this.addObj({ type: "comment", x: Math.round(p[0]), y: Math.round(p[1]), thread: [], vis: "all", resolved: false });
    this.setTool("select");
    this.setSel([o.id]);
    this.commentOpen = o.id;
    this.emit();
  }

  openComment(id: string): void {
    this.commentOpen = id;
    this.emit();
  }

  closeComment(): void {
    if (!this.commentOpen) return;
    const o = this.store.get(this.commentOpen);
    // An empty comment without messages is not kept.
    if (o?.type === "comment" && !o.thread?.length && this.canModify(o)) { const t = this.tx(); t.del(o.id); t.done(); }
    this.commentOpen = null;
    this.emit();
  }

  commentReply(id: string, text: string): void {
    if (!this.canEdit) return;
    const msg = String(text || "").trim().slice(0, 600);
    const o = this.store.get(id);
    if (!msg || o?.type !== "comment") return;
    const t = this.tx();
    t.set(id, { ...o, thread: [...(o.thread || []), { by: this.uid, name: this.opts.userName, text: msg, t: Date.now() }] });
    t.done();
  }

  commentPatch(id: string, patch: Partial<CommentObject>): void {
    if (!this.canEdit) return;
    const o = this.store.get(id);
    if (o?.type !== "comment") return;
    const t = this.tx();
    t.set(id, { ...o, ...patch });
    t.done();
  }

  commentDelete(id: string): void {
    const o = this.store.get(id);
    if (o?.type !== "comment" || !this.canModify(o)) return;
    const t = this.tx();
    t.del(id);
    t.done();
    this.commentOpen = null;
    this.emit();
  }

  // ---------- grading, submissions, assignments ----------
  setStamp(kind?: StampKind | null, text?: string): void {
    if (kind) this.stampKind = kind;
    if (text !== undefined) this.stampText = text;
    this.emit();
  }

  addStamp(p: Point): void {
    if (!this.isOwner) return;
    this.addObj({ type: "stamp", x: Math.round(p[0]), y: Math.round(p[1]), kind: this.stampKind, text: this.stampText || "" });
  }

  donePages(): Set<string> {
    if (this._doneV === this.store.version) return this._done;
    this._doneV = this.store.version;
    const set = new Set<string>();
    for (const o of this.store.all()) if (o.type === "flag" && o.kind === "done") set.add(o.pg);
    this._done = set;
    return set;
  }

  submitPage(): void {
    const id = `flag_${this.page}_${this.uid}`;
    const t = this.tx();
    if (this.store.has(id)) t.del(id);
    else t.set(id, { id, type: "flag", kind: "done", by: this.uid, pg: this.page, name: this.opts.userName, z: 0, t: Date.now() });
    t.done();
  }

  myPage(): PageSummary | null {
    return this.pages().find((p) => p.for === this.uid) || null;
  }

  /** When a student gets a personal page (an assignment or a per-student test sheet), switch to it. */
  maybeSwitchToMyPage(): void {
    if (this.isOwner) return;
    const seen = (this.seenMine = this.seenMine || new Set());
    const mine = this.pages().filter((p) => p.for === this.uid && !seen.has(p.id));
    if (!mine.length) return;
    for (const p of mine) seen.add(p.id);
    const last = mine[mine.length - 1];
    if (this.page !== last.id) {
      this.setPage(last.id);
      this.opts.onNotice?.(last.test ? "Вам видано тест" : "Вам видано завдання");
    }
  }

  /** Template page plus the students' personal copies ("separate sheet for everyone" mode). */
  testGroup(pg0: string): string[] {
    const pg = this.getPage(pg0)?.from || pg0;
    return [pg, ...this.pages().filter((p) => p.from === pg).map((p) => p.id)];
  }

  /** Copies the current page into a personal page for each selected student. */
  assignTask(students: AssignTarget[]): void {
    if (!this.isOwner || !students.length) return;
    const src = this.objs().filter((o) => o.type !== "comment");
    const srcName = this.pages().find((p) => p.id === this.page)?.name || "Завдання";
    const t = this.tx();
    let z = this.store.topZ();
    for (const st of students) {
      const pg = "pg_" + uid();
      t.set(pg, { id: pg, type: "page", name: `${st.name} — ${srcName}`.slice(0, 40), for: st.uid, priv: true, z: ++z });
      const grp = new Map<string, string>();
      for (const o of src) {
        const c: BoardObject = { ...o, id: uid(), z: ++z, pg, by: "owner" };
        delete c.lock;
        if (o.grp) {
          let g = grp.get(o.grp);
          if (!g) { g = "g_" + uid(); grp.set(o.grp, g); }
          c.grp = g;
        }
        t.set(c.id, c);
      }
    }
    t.done();
    this.opts.onNotice?.(`Завдання видано: ${students.length}`);
  }

  /** Drawing permission: global (the owner can disable it for students) or the student's own open page. */
  get canEdit(): boolean {
    if (this.baseCanEdit) return true;
    if (this.isOwner) return false;
    const pg = this.getPage(this.page);
    return !!pg && pg.for === this.uid && !(pg.closed && pg.test);
  }

  // ---------- permissions: locking, protection ----------
  by(): string { return this.isOwner ? "owner" : this.uid; }

  /** Whether the user may interact with an object (select, erase). */
  canTouch(o: BoardObject): boolean {
    if (this.isOwner) return true;
    if (o.type === "comment") return true;
    if (OWNER_ONLY.has(o.type) || o.lock) return false;
    if (o.type === "vote" || o.type === "flag") return false;
    const pg = this.getPage(o.pg || "p1");
    if (pg?.for && pg.for !== this.uid) return false;
    return !this.protect || o.by === this.uid;
  }

  /** Whether the user may change an object (move, resize, delete). Locked objects: nobody.
   *  Students on a closed board (or a closed test page) may change nothing, not even their own comments. */
  canModify(o: BoardObject): boolean {
    if (!this.isOwner && !this.canEdit) return false;
    if (o.type === "comment") return this.isOwner || o.by === this.uid;
    if (o.lock) return false;
    return this.canTouch(o);
  }

  setLock(value: boolean): void {
    if (!this.isOwner) return;
    const objs = this.selObjs();
    if (!objs.length) return;
    this.endLive();
    const t = this.tx();
    for (const o of objs) {
      if (value) t.set(o.id, { ...o, lock: true });
      else { const c = { ...o }; delete c.lock; t.set(o.id, c); }
    }
    t.done();
  }

  // ---------- groups ----------
  groupIds(o: BoardObject): string[] {
    if (!o.grp) return [o.id];
    return this.objs().filter((x) => x.grp === o.grp).map((x) => x.id);
  }

  groupSelected(): void {
    const objs = this.selObjs().filter((o) => this.canModify(o));
    if (objs.length < 2) return;
    const g = "g_" + uid();
    const t = this.tx();
    for (const o of objs) t.set(o.id, { ...o, grp: g });
    t.done();
  }

  ungroupSelected(): void {
    const objs = this.selObjs().filter((o) => o.grp && this.canModify(o));
    if (!objs.length) return;
    const t = this.tx();
    for (const o of objs) { const c = { ...o }; delete c.grp; t.set(o.id, c); }
    t.done();
  }

  // ---------- pages ----------
  /** Objects of the current page (page service objects and hidden types excluded). */
  objs(): BoardObject[] {
    if (this._objsV !== this.store.version || this._objsP !== this.page) {
      this._objsV = this.store.version;
      this._objsP = this.page;
      this._objsList = this.store.all().filter((o) => {
        // Unknown types (e.g. from a newer client) are skipped.
        const d: ObjectTypeDef | undefined = defOf(o);
        return o.type !== "page" && !!d && !d.hidden && (o.pg || "p1") === this.page;
      });
    }
    return this._objsList;
  }

  pages(): PageSummary[] {
    if (this._pagesV === this.store.version && this._pagesList) return this._pagesList;
    this._pagesV = this.store.version;
    const list: PageSummary[] = this.store.all()
      .filter((o) => o.type === "page")
      .map((o) => ({ id: o.id, name: o.name, for: o.for, priv: o.priv, test: o.test, closed: o.closed, perStudent: o.perStudent, from: o.from }));
    if (!list.some((p) => p.id === "p1")) list.unshift({ id: "p1", name: "Аркуш 1" });
    this._pagesList = list;
    return list;
  }

  setPage(id: string, fromView = false): void {
    if (!fromView && this.followCid) this.followCid = null;
    if (id === this.page) return;
    this.pageCams[this.page] = { ...this.cam };
    this.cancelTool();
    this.stopEditing();
    this.endLive();
    this.page = id;
    if (!this.canEdit && this.tool !== "hand" && this.tool !== "laser") this.tool = "hand";
    this.sel.clear();
    this.inter = null;
    this.vertEdit = null;
    this.cropEdit = null;
    this.secPick = null;
    const saved = this.pageCams[id];
    if (saved && !fromView) this.cam = { ...saved };
    else if (!fromView) { this.cam.x = -this.W / 2 / this.cam.z; this.cam.y = -this.H / 2 / this.cam.z; }
    this.domDirty = true;
    this.requestRender();
    this.emit();
  }

  addPage(): void {
    if (!this.canEdit) return;
    const o: PageObject = { id: "pg_" + uid(), type: "page", name: `Аркуш ${this.pages().length + 1}`, z: this.store.topZ() + 1 };
    const t = this.tx();
    t.set(o.id, o);
    t.done();
    this.setPage(o.id);
  }

  renamePage(id: string, name: string): void {
    if (!this.canEdit) return;
    const clean = String(name || "").trim().slice(0, 40);
    if (!clean) return;
    const cur: PageObject = this.getPage(id) || { id, type: "page", z: -1e9 };
    const t = this.tx();
    t.set(id, { ...cur, name: clean });
    t.done();
  }

  deletePage(id: string): void {
    if (!this.canEdit || id === "p1" || this.pages().length <= 1) return;
    const t = this.tx();
    for (const o of this.store.all()) if (o.id === id || o.pg === id) t.del(o.id);
    t.done();
    if (this.page === id) this.setPage("p1");
  }

  // ---------- "follow me" ----------
  setFollow(v: boolean): void {
    this.follow = v;
    if (v && this.teacherView && !this.isOwner) this.applyView(this.teacherView);
    this.emit();
  }

  applyView(m: ViewRect): void {
    if (m.pg && m.pg !== this.page) {
      if (!this.pages().some((p) => p.id === m.pg)) return;
      this.setPage(m.pg, true);
    }
    const z = clamp(Math.min(this.W / m.w, this.H / m.h), MIN_Z, MAX_Z);
    this.cam.z = z;
    this.cam.x = m.x + m.w / 2 - this.W / 2 / z;
    this.cam.y = m.y + m.h / 2 - this.H / 2 / z;
    this.requestRender();
    this.emit();
  }

  /** The owner broadcasts their view to students ("follow me"); students report theirs to the owner. */
  broadcastView(): void {
    if (this.viewTimer) return;
    this.viewTimer = setTimeout(() => {
      this.viewTimer = undefined;
      const z = this.cam.z;
      const v: ViewRect = { x: round(this.cam.x), y: round(this.cam.y), w: round(this.W / z), h: round(this.H / z), pg: this.page };
      const key = JSON.stringify(v);
      if (key === this.lastView) return;
      this.lastView = key;
      if (this.isOwner) { if (!this.followCid) this.sync?.sendView(v); } else this.sync?.sendPView(v);
    }, this.isOwner ? 90 : 350);
  }

  // ---------- the owner watches a student ----------
  onPView(m: PViewMessage): void {
    const p = this.peers.get(m.cid);
    if (!p) return;
    p.view = { x: m.x, y: m.y, w: m.w, h: m.h, pg: m.pg };
    if (this.followCid === m.cid) this.applyView(p.view);
    this.emit();
  }

  /** Show a student's answers on the test cards (null = exit). */
  setViewStudent(uid: string | null): void {
    this.viewStudent = uid || null;
    this.domDirty = true;
    this.requestRender();
    this.emit();
  }

  viewStudentInfo(): ViewingInfo | null {
    if (!this.isOwner || !this.viewStudent) return null;
    const quizzes = this.objs().filter((o) => o.type === "quiz");
    if (!quizzes.length) return null;
    const res = this.quizResults(this.page);
    const row = res.rows.find((r) => r.uid === this.viewStudent);
    const peer = [...this.peers.values()].find((p) => p.uid === this.viewStudent);
    return { uid: this.viewStudent, name: row?.name || peer?.name || "Учень", earned: row ? row.total : 0, max: res.max, answered: row?.answered || 0, total: quizzes.length, submitted: !!row?.submitted };
  }

  /** Go to the page a student is on (without following their screen). */
  goToPeer(cid: string): void {
    const p = this.peers.get(cid);
    if (!p || !this.isOwner) return;
    this.followCid = null;
    const vpg = p.view?.pg;
    if (vpg && this.pages().some((x) => x.id === vpg)) this.setPage(vpg);
    else this.goToStudent(p.uid);
    this.viewStudent = p.uid;
    this.domDirty = true;
    this.requestRender();
    this.emit();
  }

  /** Continuous following: the owner's screen mirrors the student's. */
  followPeer(cid: string): void {
    if (!this.isOwner) return;
    this.followCid = this.followCid === cid ? null : cid;
    const p = this.peers.get(cid);
    if (this.followCid && p) { this.viewStudent = p.uid; this.domDirty = true; this.requestRender(); }
    if (this.followCid && p?.view) this.applyView(p.view);
    this.emit();
  }

  /** By uid: the student's personal page, else the page they are on, else stay. */
  goToStudent(uid: string): void {
    if (!this.isOwner) return;
    const mine = this.pages().find((p) => p.for === uid);
    const peer = [...this.peers.values()].find((p) => p.uid === uid);
    const target = mine?.id || peer?.view?.pg;
    if (target && this.pages().some((p) => p.id === target)) this.setPage(target);
    this.viewStudent = uid;
    this.domDirty = true;
    this.requestRender();
    this.emit();
  }

  stopFollowingPeer(): void {
    if (this.followCid) { this.followCid = null; this.emit(); }
  }

  followLocked(): boolean { return this.follow && !this.isOwner; }

  // ---------- laser pointer ----------
  laserPoint(p: Point, down: boolean): void {
    const now = performance.now();
    if (down) this.laser.pts.push({ x: p[0], y: p[1], t: now });
    this.laser.down = down;
    this.sync?.sendLaser(p[0], p[1], down);
    this.requestRender();
  }

  zoomToFit(): void {
    const all = this.objs();
    const b = all.length ? unionBounds(all.map((o) => defOf(o).bounds(o))) : null;
    if (!b) { this.cam.z = 1; this.cam.x = -this.W / 2; this.cam.y = -this.H / 2; this.requestRender(); this.emit(); return; }
    const pad = 70;
    const z = clamp(Math.min((this.W - pad * 2) / Math.max(b.w, 1), (this.H - pad * 2) / Math.max(b.h, 1)), MIN_Z, 2);
    this.cam.z = z;
    this.cam.x = b.x + b.w / 2 - this.W / 2 / z;
    this.cam.y = b.y + b.h / 2 - this.H / 2 / z;
    this.requestRender();
    this.emit();
  }

  // ---------- changes: transactions, history, network ----------
  commit(changes: Op[]): void {
    this.store.apply(changes);
    for (const [id, o] of changes) this.netBuf.set(id, o);
    if (!this.netTimer) this.netTimer = setTimeout(() => this.flushNet(false), NET_EVERY_MS);
  }

  /**
   * Sends buffered changes. Mid-gesture (`final` false) heavy objects — pictures carry their
   * data URL, up to megabytes — are not rewritten on every step, which stalls a tablet:
   * peers get just their light fields over the live channel, and the whole object is
   * written once the gesture ends (`final`).
   */
  flushNet(final = true): void {
    clearTimeout(this.netTimer);
    this.netTimer = undefined;
    if (!this.netBuf.size) {
      if (final && this.movesSent) { this.movesSent = false; this.sync?.sendMoves?.(null); }
      return;
    }
    const ops: Op[] = [];
    const light: Op[] = [];
    for (const op of this.netBuf) {
      if (!final && heavySize(op[1]) > HEAVY_CHARS) light.push([op[0], withoutHeavy(op[1]!)]);
      else ops.push(op);
    }
    for (const [id] of ops) this.netBuf.delete(id);
    clearTimeout(this.heavyTimer);
    if (light.length && this.sync?.sendMoves) {
      this.sync.sendMoves(light);
      this.movesSent = true;
      // Held still (or the gesture never ends cleanly): write it whole anyway.
      this.heavyTimer = setTimeout(() => this.flushNet(), 1500);
    } else if (light.length) {
      // A transport without the live channel: send them whole after all.
      for (const [id] of light) { ops.push([id, this.netBuf.get(id)!]); this.netBuf.delete(id); }
    }
    if (final && this.movesSent) { this.movesSent = false; this.sync?.sendMoves?.(null); }
    if (!ops.length) return;
    // Batches are limited by count and by size (quiz cards may contain images).
    let chunk: Op[] = [];
    let size = 0;
    for (const op of ops) {
      const big = heavySize(op[1]);
      const len = big > HEAVY_CHARS ? big + 2000 : JSON.stringify(op).length;
      if (chunk.length && (chunk.length >= 300 || size + len > 2_500_000)) { this.sync?.send(chunk); chunk = []; size = 0; }
      chunk.push(op);
      size += len;
    }
    if (chunk.length) this.sync?.send(chunk);
  }

  tx(): BoardTx {
    const before = new Map<string, BoardObject | null>();
    const after = new Map<string, BoardObject | null>();
    const set = (id: string, obj: BoardObject | null): void => {
      if (!before.has(id)) before.set(id, this.store.get(id) || null);
      after.set(id, obj);
      this.commit([[id, obj]]);
    };
    return {
      set,
      del: (id) => { if (this.store.has(id) || before.has(id)) set(id, null); },
      done: () => {
        this.flushNet();
        for (const [id, b] of [...before]) if (b === after.get(id)) { before.delete(id); after.delete(id); }
        if (before.size) { this.history.push({ before, after }); this.emit(); }
      },
      cancel: () => {
        this.commit([...before]);
        this.flushNet();
      },
    };
  }

  addObj(obj: ObjectDraft): BoardObject {
    const o: BoardObject = { ...obj, id: obj.id || uid(), z: this.store.topZ() + 1, pg: obj.pg || this.page, by: this.by() };
    const t = this.tx();
    t.set(o.id, o);
    t.done();
    return o;
  }

  /** Adds several objects as one action (one history entry). */
  addObjs(list: ObjectDraft[], group = false): string[] {
    const t = this.tx();
    let z = this.store.topZ();
    const g = group ? "g_" + uid() : null;
    const ids: string[] = [];
    for (const obj of list) {
      const o: BoardObject = { ...obj, id: uid(), z: ++z, pg: this.page, by: this.by(), ...(g ? { grp: g } : {}) };
      t.set(o.id, o);
      ids.push(o.id);
    }
    t.done();
    return ids;
  }

  undo(): void {
    if (!this.canEdit) return;
    this.endLive();
    const e = this.history.undoStack.pop();
    if (!e) return;
    this.commit([...e.before]);
    this.flushNet();
    this.history.redoStack.push(e);
    this.emit();
  }

  redo(): void {
    if (!this.canEdit) return;
    this.endLive();
    const e = this.history.redoStack.pop();
    if (!e) return;
    this.commit([...e.after]);
    this.flushNet();
    this.history.undoStack.push(e);
    this.emit();
  }

  /** A "live" change merged into one history entry (sliders, input fields, formulas). */
  live(id: string, fn: (o: BoardObject) => BoardObject): void {
    const o = this.store.get(id);
    if (!o || !this.canEdit || !this.canModify(o)) return;
    if (!this.liveTx) this.liveTx = this.tx();
    this.liveTx.set(id, fn(o));
  }

  endLive(): void {
    clearTimeout(this.liveTimer);
    if (this.liveTx) { this.liveTx.done(); this.liveTx = null; }
  }

  scheduleEndLive(ms = 500): void {
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => this.endLive(), ms);
  }

  setGraphParam(id: string, name: string, value: number): void {
    const o = this.store.get(id);
    if (!o) return;
    if (!this.canEdit || !this.canModify(o)) {
      // No permission to change it: the slider works on this screen only.
      const cur = this.viewObj(o);
      this.setLocal(id, { params: { ...(cur.type === "graph" ? cur.params : {}), [name]: value } });
      return;
    }
    this.live(id, (x) => (x.type === "graph" ? { ...x, params: { ...x.params, [name]: value } } : x));
  }

  // ---------- local view: rotate and zoom without changing the board ----------
  viewObj<O extends BoardObject>(o: O): O {
    const p = this.localView.get(o.id);
    // The patch only holds fields that belong to the object's own type.
    return p ? ({ ...o, ...p } as O) : o;
  }

  setLocal(id: string, patch: LocalPatch): void {
    this.localView.set(id, { ...(this.localView.get(id) || {}), ...patch });
    this.domDirty = true;
    this.requestRender();
  }

  resetLocal(id: string): void {
    if (this.localView.delete(id)) { this.domDirty = true; this.requestRender(); }
  }

  /** An object that can be rotated / panned locally but not changed (someone else's or locked). */
  tryLocalInteract(p: Point, e: PointerEvent, dbl: boolean): boolean {
    const list = this.objs();
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      const t = defOf(o);
      if (!t.interactive || this.canModify(o) || !t.hit(o, p, 0)) continue;
      if (dbl) { this.resetLocal(o.id); return true; }
      const cur = this.viewObj(o);
      this.interDrag = { local: true, sx: e.clientX, sy: e.clientY, o0: cur };
      if (cur.type === "trig") this.setLocal(o.id, { ang: trigAngleAt(cur, p) });
      this.updateCursor("grabbing");
      return true;
    }
    return false;
  }

  localMove(e: PointerEvent): void {
    const d = this.interDrag;
    if (!d) return;
    const o0 = d.o0;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (o0.type === "trig") this.setLocal(o0.id, { ang: trigAngleAt(o0, this.world(e)) });
    else if (o0.type === "graph") {
      const z = this.cam.z;
      this.setLocal(o0.id, { v: { ...o0.v, cx: o0.v.cx - dx / z / o0.v.sx, cy: o0.v.cy + dy / z / o0.v.sy } });
    } else if (o0.type === "solid") this.setLocal(o0.id, { school: false, yaw: o0.yaw + dx * 0.011, pitch: o0.pitch + dy * 0.011 });
  }

  // ---------- selection ----------
  setSel(ids: Iterable<string>): void {
    this.sel = new Set(ids);
    if (this.secPick && !this.sel.has(this.secPick)) this.secPick = null;
    if (this.cropEdit && !this.sel.has(this.cropEdit)) this.cropEdit = null;
    this.requestRender();
    this.emit();
  }

  selObjs(): BoardObject[] {
    const out: BoardObject[] = [];
    for (const id of this.sel) { const o = this.store.get(id); if (o) out.push(o); }
    return out;
  }

  pick(p: Point, tolPx = 6): BoardObject | null {
    const tol = tolPx / this.cam.z;
    const all = this.objs();
    for (let i = all.length - 1; i >= 0; i--) {
      if (!this.canTouch(all[i])) continue;
      if (defOf(all[i]).hit(all[i], p, tol)) return all[i];
    }
    return null;
  }

  /**
   * What a press grabs to move: an object under the point, or else a closed flat shape
   * (polygon, circle) the point is inside — unfilled ones are otherwise hit only on the outline.
   */
  pickForMove(p: Point, tolPx = 6): BoardObject | null {
    const hit = this.pick(p, tolPx);
    if (hit) return hit;
    const all = this.objs();
    for (let i = all.length - 1; i >= 0; i--) {
      const o = all[i];
      if ((o.type !== "polygon" && o.type !== "ellipse") || o.f || !this.canTouch(o)) continue;
      if (defOf(o).hit({ ...o, f: "#000" }, p, 0)) return o;
    }
    return null;
  }

  deleteSelection(): void {
    if (!this.canEdit || !this.sel.size) return;
    const t = this.tx();
    for (const o of this.selObjs()) if (this.canModify(o)) t.del(o.id);
    t.done();
  }

  duplicateSelection(t: BoardTx, dx = 24, dy = 24): void {
    const copies: string[] = [];
    const grpMap = new Map<string, string>();
    let z = this.store.topZ();
    for (const o of this.selObjs()) {
      if (o.type === "page") continue;
      const moved = dx || dy ? defOf(o).move(o, dx, dy) : o;
      const c: BoardObject = { ...moved, id: uid(), z: ++z, pg: this.page, by: this.by() };
      delete c.lock;
      if (o.grp) c.grp = groupCopyId(grpMap, o.grp);
      t.set(c.id, c);
      copies.push(c.id);
    }
    this.setSel(copies);
  }

  copy(): void {
    this.clip = this.selObjs();
    this.pasteN = 0;
    // Overwrite the system clipboard so that Ctrl+V doesn't paste an old image.
    try { void navigator.clipboard?.writeText(" ").catch(() => {}); } catch {}
  }

  paste(): void {
    if (!this.canEdit || !this.clip.length) return;
    this.pasteN++;
    const grpMap = new Map<string, string>();
    const t = this.tx();
    let z = this.store.topZ();
    const ids: string[] = [];
    for (const o of this.clip) {
      const c: BoardObject = { ...defOf(o).move(o, 24 * this.pasteN, 24 * this.pasteN), id: uid(), z: ++z, pg: this.page, by: this.by() };
      delete c.lock;
      if (o.grp) c.grp = groupCopyId(grpMap, o.grp);
      t.set(c.id, c);
      ids.push(c.id);
    }
    t.done();
    this.setSel(ids);
  }

  reorder(toFront: boolean): void {
    const objs = this.selObjs().filter((o) => this.canModify(o));
    if (!objs.length || !this.canEdit) return;
    const t = this.tx();
    const all = this.objs();
    let z = toFront ? this.store.topZ() : (all[0]?.z ?? 0) - objs.length - 1;
    for (const o of objs.sort((a, b) => a.z - b.z)) t.set(o.id, { ...o, z: ++z });
    t.done();
  }

  /** Apply property changes to the selection (colour, width, expression text, …). */
  updateSelected(patch: ObjectPatch | ((o: BoardObject) => ObjectPatch), { live = false }: { live?: boolean } = {}): void {
    if (!this.canEdit) return;
    const objs = this.selObjs().filter((o) => this.canModify(o));
    if (!objs.length) return;
    // UI patches carry fields of the selected objects' own types.
    const apply = (o: BoardObject): BoardObject => ({ ...o, ...(typeof patch === "function" ? patch(o) : patch) }) as BoardObject;
    if (live) {
      for (const o of objs) this.live(o.id, apply);
    } else {
      this.endLive();
      const t = this.tx();
      for (const o of objs) t.set(o.id, apply(o));
      t.done();
    }
  }

  /** Font, bold and italic: for new text and for selected text objects. */
  setTextStyle(patch: Partial<Pick<DrawStyle, "ff" | "b" | "i">>): void {
    this.style = { ...this.style, ...patch };
    // The font may not be loaded yet; repaint once it is.
    const font = patch.ff && TEXT_FONTS[patch.ff];
    if (font) document.fonts?.load(`16px ${font.css}`).then(() => this.requestRender()).catch(() => {});
    if (this.sel.size) {
      this.updateSelected((o) => {
        if (o.type !== "text") return {};
        const n = { ...o, ...patch };
        const m = measureText(o.text, o.fs, n);
        return { ...patch, w: m.w, h: m.h };
      });
    }
    this.emit();
  }

  setStyle(patch: Partial<DrawStyle>): void {
    this.style = { ...this.style, ...patch };
    const mapped: Partial<Pick<DrawStyle, "c" | "s" | "f" | "dash">> = {};
    if ("c" in patch) mapped.c = patch.c;
    if ("s" in patch) mapped.s = patch.s;
    if ("f" in patch) mapped.f = patch.f;
    if ("dash" in patch) mapped.dash = patch.dash;
    if (this.sel.size && Object.keys(mapped).length) {
      // Font size of text/formulas is controlled separately.
      this.updateSelected((o) => {
        const out = { ...mapped };
        if (o.type === "text" || o.type === "formula" || o.type === "graph" || o.type === "solid") delete out.s;
        if (o.type === "stroke" && o.hl) { delete out.s; delete out.c; }
        if (o.type === "stroke" || o.type === "line" || o.type === "text" || o.type === "formula") delete out.f;
        if (o.type === "graph") return {};
        if (o.type === "ellipse" && o.solid && "c" in out) { out.f = out.c; delete out.s; } // a point: fill always follows the colour
        return out;
      });
    }
    this.emit();
  }

  /** Highlighter colour and width (also applied to selected highlighter strokes). */
  setHighlighter(patch: { c?: string; s?: number }): void {
    const st: Partial<DrawStyle> = {};
    if ("c" in patch) st.hc = patch.c;
    if ("s" in patch) st.hs = patch.s;
    this.style = { ...this.style, ...st };
    const objs = this.selObjs().filter((o): o is StrokeObject => o.type === "stroke" && !!o.hl);
    if (objs.length && this.canEdit) {
      this.endLive();
      const t = this.tx();
      for (const o of objs) t.set(o.id, { ...o, ...patch });
      t.done();
    }
    this.emit();
  }

  setPrefs(patch: Partial<BoardPrefs>): void {
    this.prefs = { ...this.prefs, ...patch };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs)); } catch {}
    this.requestRender();
    this.emit();
  }

  // ---------- inserting maths objects ----------
  scaleForView(): number { return clamp(1 / this.cam.z, 0.5, 3); }

  insertGraph(presetId?: string): void {
    if (!this.canEdit) return;
    const preset = GRAPH_PRESETS.find((p) => p.id === presetId) || GRAPH_PRESETS[0];
    const k = this.scaleForView();
    const w = 520 * k, h = 400 * k;
    const [cx, cy] = this.viewCenter();
    const o = this.addObj(makeGraph({
      x: Math.round(cx - w / 2), y: Math.round(cy - h / 2 - 20 * k), w: Math.round(w), h: Math.round(h),
      v: { cx: 0, cy: 0, sx: 40 * k, sy: 40 * k },
      exprs: preset.exprs, params: { ...preset.params }, ranges: { ...(preset.ranges || {}) },
    }));
    this.setTool("select");
    this.setSel([o.id]);
  }

  insertSolid(kind: SolidKind): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const s = 300 * k;
    const [cx, cy] = this.viewCenter();
    const o = this.addObj(makeSolid(kind, { x: Math.round(cx - s / 2), y: Math.round(cy - s / 2), w: Math.round(s), h: Math.round(s), c: this.style.c }));
    this.setTool("select");
    this.setSel([o.id]);
  }

  createFormula(p: Point): void {
    if (!this.canEdit) return;
    this.endLive();
    const t = this.tx();
    const fs = this.style.mfs;
    const k = fs / 36;
    const o: BoardObject = { type: "formula", id: uid(), z: this.store.topZ() + 1, x: round(p[0]), y: round(p[1] - 24 * k), w: round(90 * k), h: round(56 * k), fs, latex: "", c: this.style.c };
    t.set(o.id, o);
    this.liveTx = t;
    this.setTool("select");
    this.setSel([o.id]);
    this.editFormula(o.id);
  }

  onMathError(e: unknown): void {
    this.mathError = String((e instanceof Error ? e.message : undefined) || e);
    this.emit();
  }

  // ---------- editing text and formulas ----------
  editText({ id, at }: { id?: string | null; at?: Point }): void {
    if (!this.canEdit) return;
    this.stopEditing();
    const found = id ? this.store.get(id) : undefined;
    const o = found?.type === "text" ? found : null;
    const pos: Point = o ? [o.x, o.y] : at ?? this.viewCenter();
    const fs = o?.fs || this.style.fs;
    const color = o?.c || this.style.c;
    const ts: TextStyle = o ? { ff: o.ff, b: o.b, i: o.i } : { ff: this.style.ff, b: this.style.b, i: this.style.i };
    const z = this.cam.z;
    const ta = document.createElement("textarea");
    ta.className = "mb-text-edit";
    ta.value = o?.text || "";
    ta.style.left = (pos[0] - this.cam.x) * z + "px";
    ta.style.top = (pos[1] - this.cam.y) * z + "px";
    ta.style.fontSize = fs * z + "px";
    ta.style.color = color;
    ta.style.fontFamily = ((ts.ff && TEXT_FONTS[ts.ff]) || TEXT_FONTS.comfortaa).css;
    ta.style.fontWeight = ts.b ? "700" : "400";
    ta.style.fontStyle = ts.i ? "italic" : "normal";
    ta.setAttribute("data-ui", "");
    ta.placeholder = "Текст…";
    const autosize = () => {
      const m = measureText(ta.value || "Текст…", fs, ts);
      ta.style.width = Math.max(80, m.w * z + 24) + "px";
      ta.style.height = Math.max(fs * z * 1.5, m.h * z + 8) + "px";
    };
    ta.addEventListener("input", autosize);
    ta.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") ta.blur(); });
    ta.addEventListener("blur", () => this.stopEditing());
    this.root.append(ta);
    this.editing = { kind: "text", id: o?.id || null, at: pos, ta, fs, color, ts };
    this.requestRender();
    autosize();
    ta.focus();
  }

  editFormula(id: string): void {
    if (!this.canEdit) return;
    if (this.editing && this.editing.id !== id) this.stopEditing();
    this.editing = { kind: "formula", id };
    this.domDirty = true;
    this.requestRender();
    this.emit();
    void this.dom.loading.then(() => {
      if (this.editing?.id !== id) return;
      if (this.dom.error) { this.stopEditing(); return; }
      this.dom.sync();
      let tries = 60;
      const attempt = () => {
        if (this.editing?.id !== id) return;
        if (!this.dom.focusFormula(id) && tries-- > 0) requestAnimationFrame(attempt);
      };
      attempt();
    });
  }

  onFormulaInput(id: string, mf: { value: string }, el: HTMLElement): void {
    const latex = mf.value;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    this.live(id, (o) => (o.type === "formula" ? { ...o, latex, w, h } : o));
  }

  onFormulaBlur(id: string): void {
    if (this.editing?.kind === "formula" && this.editing.id === id) this.stopEditing();
  }

  stopEditing(): void {
    const ed = this.editing;
    if (!ed) return;
    this.editing = null;
    if (ed.kind === "text") {
      const text = ed.ta.value.replace(/\s+$/, "");
      ed.ta.remove();
      const t = this.tx();
      if (ed.id) {
        const o = this.store.get(ed.id);
        if (o?.type === "text") {
          if (!text) t.del(ed.id);
          else { const m = measureText(text, o.fs, o); t.set(ed.id, { ...o, text, w: m.w, h: m.h }); }
        }
        t.done();
      } else if (text) {
        const m = measureText(text, ed.fs, ed.ts);
        const o = this.addObj({ type: "text", x: round(ed.at[0]), y: round(ed.at[1]), w: m.w, h: m.h, text, fs: ed.fs, c: ed.color, ff: ed.ts.ff, b: !!ed.ts.b, i: !!ed.ts.i });
        if (!this.prefs.keep) { this.setTool("select"); this.setSel([o.id]); }
      }
    } else {
      this.dom.blurFormula(ed.id);
      try { (window as Window & { mathVirtualKeyboard?: { hide(): void } }).mathVirtualKeyboard?.hide(); } catch {}
      const o = this.store.get(ed.id);
      if (o?.type === "formula") {
        if (!o.latex.trim()) {
          if (!this.liveTx) this.liveTx = this.tx();
          this.liveTx.del(ed.id);
        } else {
          const m = this.dom.measure(ed.id);
          if (m && (Math.abs(m.w - o.w) > 1 || Math.abs(m.h - o.h) > 1)) this.live(ed.id, (x) => (x.type === "formula" ? { ...x, w: m.w, h: m.h } : x));
        }
      }
      this.endLive();
    }
    this.emit();
  }

  // ---------- interactive mode (graph, solid, …) ----------
  enterInteractive(id: string): void {
    this.inter = id;
    this.setSel([id]);
    this.updateCursor();
    this.requestRender();
    this.emit();
  }

  // ---------- cropping images ----------
  /**
   * Crop mode for an image: the selection handles move the crop edges while the picture
   * stays in place, and the hidden part is shown faded around the frame. Widening the
   * frame later reveals more of the image (a task shown step by step). Not for rotated images.
   */
  toggleCrop(id: string): void {
    const o = this.store.get(id);
    if (this.cropEdit === id || o?.type !== "image" || o.rot || !this.canModify(o)) { this.exitCrop(); return; }
    this.cropEdit = id;
    this.vertEdit = null;
    if (!this.sel.has(id) || this.sel.size !== 1) this.setSel([id]);
    this.requestRender();
    this.emit();
  }

  exitCrop(): void {
    if (!this.cropEdit) return;
    this.cropEdit = null;
    this.requestRender();
    this.emit();
  }

  /** Shows the whole image again (the frame grows to the full picture). */
  resetCrop(id: string): void {
    const o = this.store.get(id);
    if (o?.type !== "image" || !o.crop || !this.canModify(o)) return;
    const full = imageFullRect(o);
    const t = this.tx();
    t.set(o.id, cropToFrame(o, full, full));
    t.done();
  }

  exitInteractive(): void {
    if (!this.inter) return;
    this.inter = null;
    this.interDrag = null;
    this.endLive();
    this.updateCursor();
    this.requestRender();
    this.emit();
  }

  zoomGraph(id: string, factor: number, anchor?: Point | null): void {
    this.live(id, (o) => {
      if (o.type !== "graph") return o;
      const sx = clamp(o.v.sx * factor, 0.5, 5000);
      const sy = clamp(o.v.sy * factor, 0.5, 5000);
      let { cx, cy } = o.v;
      if (anchor) {
        const [ux, uy] = graphToUnits(o, anchor[0], anchor[1]);
        cx = ux - (anchor[0] - o.x - o.w / 2) / sx;
        cy = uy + (anchor[1] - o.y - o.h / 2) / sy;
      }
      return { ...o, v: { cx, cy, sx, sy } };
    });
    this.scheduleEndLive();
  }

  resetGraphView(id: string): void {
    this.live(id, (o) => (o.type === "graph" ? { ...o, v: { cx: 0, cy: 0, sx: 40, sy: 40 } } : o));
    this.endLive();
  }

  insertTrig(): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const w = Math.round(580 * k), h = Math.round(430 * k);
    const c = this.viewCenter();
    const o = this.addObj(makeTrig({ x: Math.round(c[0] - w / 2), y: Math.round(c[1] - h / 2), w, h }));
    this.setTool("select");
    this.setSel([o.id]);
  }

  /** Number line with intervals; a null bound means infinity. */
  insertNumline(ivs: NumlineInterval[]): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const w = Math.round(560 * k), h = Math.round(110 * k);
    const c = this.viewCenter();
    const o = this.addObj({ ...makeNumline({ w, h, ivs }), x: Math.round(c[0] - w / 2), y: Math.round(c[1] - h / 2) });
    this.setTool("select");
    this.setSel([o.id]);
  }

  /** Column arithmetic: "+", "−", "×", "÷" or "frac". */
  insertColmath(op: ColmathOp): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const o0 = makeColmath(op, { cell: Math.round(44 * k) });
    const box = colmathBox(o0);
    const c = this.viewCenter();
    const o = this.addObj({ ...o0, x: Math.round(c[0] - box.w / 2), y: Math.round(c[1] - box.h / 2) });
    this.setTool("select");
    this.setSel([o.id]);
  }

  /** Fraction model ("circle" or "strip"); opens in interactive mode (click a part to fill it). */
  insertFmodel(kind: FmodelKind): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const o0 = makeFmodel(kind);
    const w = Math.round(o0.w * k), h = Math.round(o0.h * k);
    const c = this.viewCenter();
    const o = this.addObj({ ...o0, w, h, x: Math.round(c[0] - w / 2), y: Math.round(c[1] - h / 2) });
    this.setTool("select");
    this.enterInteractive(o.id);
  }

  /** Inserts an object at the centre of the view and selects it. */
  placeCentered(o0: UnplacedDraft, box: { w: number; h: number }, enter = false): BoardObject {
    const c = this.viewCenter();
    const o = this.addObj({ ...o0, x: Math.round(c[0] - box.w / 2), y: Math.round(c[1] - box.h / 2) });
    this.setTool("select");
    if (enter) this.enterInteractive(o.id);
    else this.setSel([o.id]);
    return o;
  }

  insertChart(kind: ChartKind, src: string): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const o0 = makeChart(kind, src);
    this.placeCentered({ ...o0, w: Math.round(o0.w * k), h: Math.round(o0.h * k) }, { w: o0.w * k, h: o0.h * k });
  }

  insertTree(src: string): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const o0 = makeTree(src, { k });
    this.placeCentered(o0, treeBox(o0));
  }

  /** Change the text data of a chart or probability tree. */
  setSrc(id: string, src: string): void {
    const o = this.store.get(id);
    if (!this.canEdit || !o || (o.type !== "chart" && o.type !== "ptree")) return;
    this.endLive();
    const t = this.tx();
    t.set(id, { ...o, src });
    t.done();
  }

  editSrc(id: string | null): void {
    this.srcEdit = id;
    this.emit();
  }

  insertDice(kind: DiceKind): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const o0 = makeDice(kind);
    this.placeCentered({ ...o0, w: Math.round(o0.w * k), h: Math.round(o0.h * k) }, { w: o0.w * k, h: o0.h * k });
  }

  /** Roll the dice / flip the coin `times` times, updating the current values and frequencies. */
  rollDice(id: string, times = 1): void {
    const o = this.store.get(id);
    if (!this.canEdit || !o || o.type !== "dice") return;
    const freq = { ...(o.freq || {}) };
    let cur = o.cur || [];
    const n = o.kind === "coin" ? 1 : o.cnt;
    for (let i = 0; i < times; i++) {
      if (o.kind === "coin") cur = [Math.random() < 0.5 ? 0 : 1];
      else cur = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
      const key = o.kind === "coin" ? (cur[0] === 0 ? "Г" : "Ц") : String(cur.reduce((s, v) => s + v, 0));
      freq[key] = (freq[key] || 0) + 1;
    }
    this.endLive();
    const t = this.tx();
    t.set(id, { ...o, cur, freq, tot: (o.tot || 0) + times });
    t.done();
  }

  insertCplane(): void {
    if (!this.canEdit) return;
    const k = this.scaleForView();
    const o0 = makeCplane();
    const w = Math.round(o0.w * k);
    this.placeCentered({ ...o0, w, h: w }, { w, h: w }, true);
  }

  /** Exercise generator. */
  insertExercises(opts: Parameters<typeof buildExercises>[0]): void {
    if (!this.canEdit) return;
    const c = this.viewCenter();
    const list = buildExercises(opts, c, this.scaleForView());
    if (!list.length) return;
    const ids = this.addObjs(list, false);
    this.setTool("select");
    this.setSel(ids);
  }

  setNumlineIntervals(id: string, ivs: NumlineInterval[]): void {
    const o = this.store.get(id);
    if (!this.canEdit || !o || o.type !== "numline") return;
    this.endLive();
    const t = this.tx();
    t.set(id, { ...o, ivs });
    t.done();
  }

  editNumline(id: string | null): void {
    this.nlEdit = id;
    this.emit();
  }

  insertPoll(): void {
    if (!this.isOwner) return;
    const c = this.viewCenter();
    const o = this.addObj({ type: "poll", x: Math.round(c[0] - 170), y: Math.round(c[1] - 120), w: 340, q: "Ваше питання?", opts: ["Варіант 1", "Варіант 2", "Варіант 3"], closed: false, hide: false });
    this.setTool("select");
    this.setSel([o.id]);
  }

  insertTimer(minutes = 5): void {
    if (!this.isOwner) return;
    const c = this.viewCenter();
    const dur = minutes * 60000;
    const o = this.addObj({ type: "timer", x: Math.round(c[0] - 130), y: Math.round(c[1] - 70), w: 260, h: 140, dur, left: dur, running: false, endsAt: null });
    this.setTool("select");
    this.setSel([o.id]);
  }

  insertTask(): void {
    if (!this.isOwner) return;
    const n = this.objs().filter((o) => o.type === "task").length + 1;
    const c = this.viewCenter();
    const o = this.addObj({ type: "task", x: Math.round(c[0] - 210), y: Math.round(c[1] - 120), w: 420, title: `Завдання ${n}`, text: "Умова завдання…", pts: "" });
    this.setTool("select");
    this.setSel([o.id]);
  }

  // ---------- images ----------
  async insertImage(file: Blob, at?: Point | null): Promise<void> {
    if (!this.canEdit) return;
    try {
      const img = await fileToImage(file);
      const z = this.cam.z;
      const k = Math.min(1, (this.W / z * 0.55) / img.w, (this.H / z * 0.7) / img.h);
      const w = Math.round(img.w * k), h = Math.round(img.h * k);
      const c = at || this.viewCenter();
      const o = this.addObj({ type: "image", x: Math.round(c[0] - w / 2), y: Math.round(c[1] - h / 2), w, h, src: img.src });
      this.setTool("select");
      this.setSel([o.id]);
    } catch (e) {
      console.error("[mathboard] image", e);
      this.opts.onNotice?.("Не вдалося вставити зображення");
    }
  }

  /** PDF: first ask which pages to insert (the pdfAsk state shows a dialog), then placePdf. */
  async insertPdf(file: File, at?: Point | null, more: PdfMore | null = null): Promise<void> {
    if (!this.canEdit) return;
    try {
      const total = await pdfCount(file);
      this.pdfFiles = this.pdfFiles || new Map();
      this.pdfFiles.set(file.name, file);
      this.pdfAsk = { file, name: file.name, total, at: at || null, more, start: more ? more.next : 1 };
      this.emit();
    } catch (e) {
      console.error("[mathboard] pdf", e);
      this.opts.onNotice?.((e instanceof Error && e.message) || "Не вдалося відкрити PDF");
    }
  }

  cancelPdf(): void {
    this.pdfAsk = null;
    this.emit();
  }

  /** Insert more pages from the PDF image `o` came from (file from memory, else ask the user to pick it). */
  morePdf(o: ImageObject): void {
    // An image not linked to a PDF (inserted earlier): place below it, pages from the first.
    const same = o.pdf ? this.objs().filter((x): x is ImageObject => x.type === "image" && x.pdf === o.pdf) : [o];
    const last = same.reduce((m, x) => (x.y + x.h > m.y + m.h ? x : m), same[0]);
    const more: PdfMore = { x: last.x, y: last.y + last.h, w: last.w, next: o.pdf ? Math.max(...same.map((x) => x.pdfPage || 0)) + 1 : 1 };
    const cached = o.pdf ? this.pdfFiles?.get(o.pdf) : null;
    if (cached) { void this.insertPdf(cached, null, more); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = () => { const f = input.files?.[0]; if (f) void this.insertPdf(f, null, more); };
    input.click();
  }

  async placePdf(pages: number[]): Promise<void> {
    const ask = this.pdfAsk;
    this.pdfAsk = null;
    this.emit();
    if (!ask || !pages.length || !this.canEdit) return;
    this.opts.onNotice?.("Вставляю сторінки PDF…");
    try {
      const images = await pdfToImages(ask.file, pages);
      const z = this.cam.z;
      const gap = 24;
      const k = ask.more ? ask.more.w / images[0].w : Math.min(1, (this.W / z * 0.5) / images[0].w, (this.H / z * 0.85) / images[0].h);
      const sizes = images.map((im) => ({ w: Math.round(im.w * k), h: Math.round(im.h * k) }));
      const c = ask.at || this.viewCenter();
      const totalH = sizes.reduce((s, q) => s + q.h, 0) + gap * (sizes.length - 1);
      let y = ask.more ? Math.round(ask.more.y + gap) : Math.round(c[1] - Math.min(totalH, this.H / z * 0.85) / 2);
      const x0 = ask.more ? ask.more.x : null;
      const list = images.map((im, i): ObjectDraft<ImageObject> => {
        // The PDF page number goes to `pdfPage`: `pg` is the board page and addObjs overwrites it.
        const o: ObjectDraft<ImageObject> = { type: "image", x: x0 !== null ? x0 : Math.round(c[0] - sizes[i].w / 2), y, w: sizes[i].w, h: sizes[i].h, src: im.src, pdf: ask.name, pdfPage: im.pg };
        y += sizes[i].h + gap;
        return o;
      });
      const ids = this.addObjs(list, false);
      this.setTool("select");
      this.setSel(ids);
      this.opts.onNotice?.(`Вставлено сторінок: ${images.length}`);
    } catch (e) {
      console.error("[mathboard] pdf", e);
      this.opts.onNotice?.((e instanceof Error && e.message) || "Не вдалося вставити сторінки PDF");
    }
  }

  insertFile(file: File, at?: Point | null): Promise<void> {
    return isPdf(file) ? this.insertPdf(file, at) : this.insertImage(file, at);
  }

  pickImage(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf,.pdf";
    input.onchange = () => { const f = input.files?.[0]; if (f) void this.insertFile(f); };
    input.click();
  }

  onPaste(e: ClipboardEvent): void {
    if (closestOf(e.target, EDITABLE) || !this.root.isConnected || !this.canEdit) return;
    const items = [...(e.clipboardData?.items || [])];
    const img = items.find((i) => i.kind === "file" && (i.type.startsWith("image/") || i.type === "application/pdf"));
    if (img) {
      e.preventDefault();
      const f = img.getAsFile();
      if (f) void this.insertFile(f);
      return;
    }
    e.preventDefault();
    this.paste();
  }

  onDrop(e: DragEvent): void {
    if (!this.canEdit) return;
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/") || isPdf(x));
    if (!f) return;
    e.preventDefault();
    this.rect = this.root.getBoundingClientRect();
    void this.insertFile(f, this.world(e));
  }

  // ---------- instruments, templates, export ----------
  insertInstrument(kind: "ruler" | "protractor"): void {
    if (!this.canEdit) return;
    const c = this.viewCenter();
    const spec = kind === "ruler" ? { w: 480, h: 56 } : { w: 360, h: 204 };
    const o = this.addObj({ type: kind, x: Math.round(c[0] - spec.w / 2), y: Math.round(c[1] - spec.h / 2), w: spec.w, h: spec.h, rot: 0 });
    this.setTool("select");
    this.setSel([o.id]);
  }

  insertTemplate(name: string, opts?: Parameters<typeof buildTemplate>[3]): void {
    if (!this.canEdit) return;
    const objs = buildTemplate(name, this.viewCenter(), this.style, opts);
    if (!objs?.length) return;
    const t = this.tx();
    let z = this.store.topZ();
    const ids: string[] = [];
    for (const ob of objs) {
      const o: BoardObject = { ...ob, id: uid(), z: ++z, pg: this.page, by: this.by() };
      t.set(o.id, o);
      ids.push(o.id);
    }
    t.done();
    this.setTool("select");
    this.setSel(ids);
  }

  /** Value table of the first function of the selected graph. */
  insertValueTable(graphId: string, xs?: number[] | null): void {
    const g = this.store.get(graphId);
    if (g?.type !== "graph") return;
    const { values, error } = graphValues(g, xs && xs.length ? xs : [-3, -2, -1, 0, 1, 2, 3]);
    if (!values) { this.opts.onNotice?.("Таблиця значень працює для функції виду y = f(x)"); return; }
    if (values.every((v) => v === null)) {
      this.opts.onNotice?.(`Не вдалося обчислити функцію${error ? ": " + error : " (перевірте запис)"}`);
      return;
    }
    this.insertTemplate("values", { graph: g, xs: xs ?? undefined });
  }

  async exportAs(kind: "png" | "pdf"): Promise<void> {
    try {
      if (kind === "png") await exportPNG(this);
      else await exportPDF(this);
    } catch (e) {
      console.error("[mathboard] export", e);
      this.opts.onNotice?.("Не вдалося зберегти файл");
    }
  }

  /** Ruler: a nearby edge that a line snaps to, if any. */
  rulerLock(p: Point): { a: Point; b: Point } | null {
    const rulers = this.objs().filter((o) => o.type === "ruler");
    if (!rulers.length) return null;
    const hit = snapToRuler(rulers, p, 16 / this.cam.z);
    return hit ? { a: hit.a, b: hit.b } : null;
  }

  projectToLock(lock: { a: Point; b: Point }, p: Point): Point {
    return projectOnLine(p, lock.a, lock.b, true);
  }

  // ---------- section points on solid edges ----------
  startSecPick(id: string): void {
    this.secPick = id;
    this.inter = null;
    this.setSel([id]);
    this.updateCursor("crosshair");
    this.requestRender();
    this.emit();
  }

  stopSecPick(): void {
    if (!this.secPick) return;
    this.secPick = null;
    this.secDrag = null;
    this.updateCursor();
    this.requestRender();
    this.emit();
  }

  secDown(p: Point): boolean {
    const o = this.secPick ? this.store.get(this.secPick) : undefined;
    if (!o || o.type !== "solid" || !inBounds(T.solid.bounds(o), p, 30 / this.cam.z)) { this.stopSecPick(); return false; }
    const tol = 14 / this.cam.z;
    this.endLive();
    const idx = solidSecPoints(o).findIndex((q) => q && Math.hypot(q[0] - p[0], q[1] - p[1]) < tol);
    if (idx >= 0) { this.secDrag = { idx, tx: this.tx(), id: o.id }; return true; }
    const hit = solidPickEdge(o, p, tol * 1.6);
    if (!hit) return true;
    let refs = o.sec?.mode === "pts" ? [...(o.sec.pts || [])] : [];
    if (refs.length >= 3) refs = [];
    refs.push({ e: hit.e, t: hit.t });
    const t = this.tx();
    t.set(o.id, { ...o, sec: { mode: "pts", pts: refs } });
    t.done();
    return true;
  }

  secMove(p: Point): void {
    const d = this.secDrag;
    if (!d) return;
    const o = this.store.get(d.id);
    if (o?.type !== "solid" || o.sec?.mode !== "pts") return;
    const hit = solidPickEdge(o, p, 60 / this.cam.z);
    if (!hit) return;
    const refs = o.sec.pts.map((r, i) => (i === d.idx ? { e: hit.e, t: hit.t } : r));
    d.tx.set(o.id, { ...o, sec: { ...o.sec, pts: refs } });
  }

  // ---------- tools ----------
  setTool(name: string): void {
    if (!this.canEdit && name !== "hand" && name !== "laser") return;
    const tool = this.tools[name];
    if (!tool) return;
    this.cancelTool();
    this.stopEditing();
    this.tool = name;
    this.hover = null; // the pointer is over the toolbar now, not the board
    tool.activate?.();
    this.inter = null;
    this.secPick = null;
    this.vertEdit = null;
    this.cropEdit = null;
    if (name !== "select") this.sel.clear();
    this.updateCursor();
    this.requestRender();
    this.emit();
  }

  cancelTool(): void {
    if (this.active) { this.active.cancel?.(); this.active = null; }
    if (this.pressMoving) this.setSel([]);
    this.pressGrab = null;
    this.pressMoving = false;
    this.panning = null;
  }

  updateCursor(c?: string): void {
    let cur = c;
    if (!cur) cur = this.space || this.tool === "hand" || !this.canEdit ? "grab" : this.tools[this.tool]?.cursor || "default";
    if (this.inter) cur = "grab";
    this.root.style.cursor = cur;
  }

  // ---------- pointer ----------
  onPointerDown(e: PointerEvent): void {
    if (closestOf(e.target, "[data-ui]")) return;
    if (this.editing) this.stopEditing();
    this.rect = this.root.getBoundingClientRect();
    try { this.root.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    const ae = document.activeElement;
    if (ae && ae !== document.body && !this.root.contains(ae) && "blur" in ae && typeof ae.blur === "function") ae.blur();
    const now = performance.now();
    if (e.pointerType === "pen") this.lastPen = now;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (this.pointers.size === 2) {
      if (this.followLocked()) return;
      this.cancelTool();
      this.endInterDrag();
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    const p = this.world(e);
    const dbl = !!this.lastDown && now - this.lastDown.t < 320 && Math.hypot(e.clientX - this.lastDown.x, e.clientY - this.lastDown.y) < 8;
    this.lastDown = dbl ? null : { t: now, x: e.clientX, y: e.clientY };

    const palmRejected = e.pointerType === "touch" && now - this.lastPen < 3000;
    const viewerPan = !this.canEdit && this.tool !== "laser";
    if (e.button === 1 || this.space || this.tool === "hand" || viewerPan || palmRejected) {
      if (this.followLocked()) return;
      this.stopFollowingPeer();
      this.panning = { sx: e.clientX, sy: e.clientY, cx: this.cam.x, cy: this.cam.y };
      this.updateCursor("grabbing");
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // The stylus's back end erases for the duration of one stroke.
    if (e.pointerType === "pen" && (e.buttons & 32) && this.canEdit) {
      this.active = this.tools.eraser;
      this.penEraser = true;
      this.active.down(p, e);
      return;
    }

    if ((this.tool === "select" || this.tool === "hand" || this.tool === "laser" || !this.canEdit) && this.tryPollVote(p)) return;
    if (this.secPick && this.secDown(p)) return;
    if ((this.tool === "select" || this.tool === "hand" || !this.canEdit) && this.tryLocalInteract(p, e, dbl)) return;
    if (this.inter && this.interDown(p, e)) return;
    if (dbl && this.tool === "select" && this.onDoubleClick(p)) return;

    if (this.tool === "laser") { this.laserHeld = true; this.lastLaser = performance.now(); this.laserPoint(p, true); }
    this.active = this.tools[this.tool];
    this.active.down(p, e);
    // Drawing over an object with the stylus: a hard press moves it instead.
    this.pressGrab = null;
    if (e.pointerType === "pen" && this.canEdit && !NO_PRESS_GRAB.has(this.tool)) {
      const o = this.pickForMove(p);
      if (o && this.canModify(o)) {
        this.pressGrab = { t: now, x: e.clientX, y: e.clientY, p };
        if (e.pressure >= PRESS_GRAB) this.startPressGrab(e);
      }
    }
  }

  /** Drops the stroke just begun and moves the object under the stylus instead. */
  startPressGrab(e: PointerEvent): void {
    const g = this.pressGrab;
    this.pressGrab = null;
    if (!g) return;
    this.active?.cancel?.();
    this.active = this.tools.select;
    this.pressMoving = true;
    this.active.down(g.p, e);
    this.requestRender();
  }

  onPointerMove(e: PointerEvent): void {
    const pt = this.pointers.get(e.pointerId);
    if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
    const p = this.world(e);
    this.hover = p;
    if (this.tool === "laser" && this.laserHeld && !this.panning) {
      const t = performance.now();
      if (t - (this.lastLaser || 0) > 25) { this.lastLaser = t; this.laserPoint(p, true); }
    }
    const now = performance.now();
    if (now - this.lastCursorSent > 60) { this.lastCursorSent = now; this.sync?.sendCursor(p[0], p[1]); }

    if (this.pinch && this.pointers.size >= 2) { this.updatePinch(); return; }
    if (this.panning) {
      this.cam.x = this.panning.cx - (e.clientX - this.panning.sx) / this.cam.z;
      this.cam.y = this.panning.cy - (e.clientY - this.panning.sy) / this.cam.z;
      this.requestRender();
      return;
    }
    if (this.secDrag) { this.secMove(p); return; }
    if (this.interDrag) { this.interMove(e); return; }
    if (this.pressGrab && this.active) {
      const g = this.pressGrab;
      if (performance.now() - g.t > PRESS_GRAB_MS || Math.hypot(e.clientX - g.x, e.clientY - g.y) > PRESS_GRAB_SLOP) this.pressGrab = null;
      else if (e.pressure >= PRESS_GRAB) this.startPressGrab(e);
    }
    if (this.active) { this.active.move(p, e); return; }

    const t = this.tools[this.tool];
    const c = t?.hover?.(p);
    if (c) this.updateCursor(c);
    if (this.tool === "eraser" || this.inter || this.secPick || this.tool === "polygon") this.requestOverlay();
  }

  onPointerUp(e: PointerEvent): void {
    if (this.laserHeld) { this.laserHeld = false; this.laserPoint(this.world(e), false); }
    this.pointers.delete(e.pointerId);
    try { this.root.releasePointerCapture(e.pointerId); } catch {}
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    if (this.panning) { this.panning = null; this.updateCursor(); return; }
    if (this.secDrag) { this.secDrag.tx.done(); this.secDrag = null; return; }
    if (this.interDrag) { this.endInterDrag(); return; }
    if (this.active) {
      const a = this.active;
      this.active = null;
      this.penEraser = false;
      this.pressGrab = null;
      const pressed = this.pressMoving;
      this.pressMoving = false;
      // The system may cancel a stylus stroke midway (e.g. iPadOS gestures): keep what was
      // drawn rather than lose it. Other cancelled gestures are undone.
      if (e.type === "pointercancel" && !(e.pointerType === "pen" && (this.tool === "pen" || this.tool === "highlighter") && a === this.tools[this.tool])) a.cancel?.();
      else a.up(this.world(e), e);
      if (pressed) this.setSel([]);
    }
  }

  startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinch = {
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mx: (a.x + b.x) / 2 - this.rect.left,
      my: (a.y + b.y) / 2 - this.rect.top,
      cam: { ...this.cam },
    };
  }

  updatePinch(): void {
    const p = this.pinch;
    if (!p) return;
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2 - this.rect.left;
    const my = (a.y + b.y) / 2 - this.rect.top;
    const z1 = clamp(p.cam.z * (d / p.d0), MIN_Z, MAX_Z);
    const wx = p.cam.x + p.mx / p.cam.z;
    const wy = p.cam.y + p.my / p.cam.z;
    this.cam.z = z1;
    this.cam.x = wx - mx / z1;
    this.cam.y = wy - my / z1;
    this.requestRender();
    this.emit();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.followLocked()) return;
    this.stopFollowingPeer();
    const sx = e.clientX - this.rect.left;
    const sy = e.clientY - this.rect.top;
    // Non-standard, but the most reliable way to tell a mouse wheel from a touchpad.
    const wheelDeltaY = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
    const isMouse = e.deltaMode === 1 || (!!wheelDeltaY && wheelDeltaY % 120 === 0 && e.deltaX === 0);
    // The mouse wheel over a graph the user can't change zooms it on this screen only (Ctrl zooms the board).
    if (isMouse && !e.ctrlKey && !this.inter) {
      const w = this.world(e);
      const g = this.objs().slice().reverse().find((o): o is GraphObject => o.type === "graph" && !this.canModify(o) && inBounds(T.graph.bounds(o), w));
      if (g) {
        const cur = this.viewObj(g);
        const f = Math.exp(-e.deltaY * 0.0016);
        const gsx = clamp(cur.v.sx * f, 0.5, 5000), gsy = clamp(cur.v.sy * f, 0.5, 5000);
        const [ux, uy] = graphToUnits(cur, w[0], w[1]);
        this.setLocal(g.id, { v: { cx: ux - (w[0] - g.x - g.w / 2) / gsx, cy: uy + (w[1] - g.y - g.h / 2) / gsy, sx: gsx, sy: gsy } });
        return;
      }
    }
    if (this.inter) {
      const o = this.store.get(this.inter);
      if (o && o.type === "graph" && inBounds(T.graph.bounds(o), this.world(e))) {
        this.zoomGraph(o.id, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), this.world(e));
        return;
      }
    }
    if (e.ctrlKey || isMouse) {
      this.zoomAt(sx, sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
    } else {
      this.cam.x += e.deltaX / this.cam.z;
      this.cam.y += e.deltaY / this.cam.z;
      this.requestRender();
    }
  }

  onDoubleClick(p: Point): boolean {
    const o = this.pick(p, 6);
    if (!o) return false;
    if (o.type === "formula") { this.setSel([o.id]); this.editFormula(o.id); return true; }
    if (o.type === "text") { this.setSel([o.id]); this.editText({ id: o.id }); return true; }
    if ((o.type === "chart" || o.type === "ptree") && this.canEdit) { this.setSel([o.id]); this.editSrc(o.id); return true; }
    if (o.type === "numline" && this.canEdit) { this.setSel([o.id]); this.editNumline(o.id); return true; }
    // Enters crop mode. Already in it: not a double click, so two quick drags that slide
    // the picture under the frame both reach the select tool.
    if (o.type === "image" && this.canModify(o) && !o.rot) {
      if (this.cropEdit === o.id) return false;
      this.toggleCrop(o.id);
      return true;
    }
    if (defOf(o).interactive) { this.enterInteractive(o.id); return true; }
    if (o.type === "polygon") { this.setSel([o.id]); this.vertEdit = this.vertEdit === o.id ? null : o.id; this.requestRender(); this.emit(); return true; }
    return false;
  }

  interDown(p: Point, e: PointerEvent): boolean {
    const o = this.inter ? this.store.get(this.inter) : undefined;
    if (!o || !inBounds(defOf(o).bounds(o), p)) { this.exitInteractive(); return false; }
    this.endLive();
    const tx = this.tx();
    this.interDrag = { sx: e.clientX, sy: e.clientY, o0: o, tx };
    if (o.type === "trig") tx.set(o.id, { ...o, ang: trigAngleAt(o, p) });
    if (o.type === "cplane") {
      const [u, v] = cplaneAt(o, p);
      if (Math.abs(u) <= o.R + 0.3 && Math.abs(v) <= o.R + 0.3) {
        const pts = o.pts || [];
        const near = pts.findIndex((q) => Math.hypot(q[0] - u, q[1] - v) < 0.4);
        const x = Math.max(-o.R, Math.min(o.R, Math.round(u))), y = Math.max(-o.R, Math.min(o.R, Math.round(v)));
        const next: Point[] = near >= 0 ? pts.filter((_, i) => i !== near) : pts.length < 26 ? [...pts, [x, y]] : pts;
        tx.set(o.id, { ...o, pts: next });
      }
    }
    if (o.type === "fmodel") {
      const i = fmodelPartAt(o, p);
      if (i >= 0) {
        const on = new Set(o.fill || []);
        if (on.has(i)) on.delete(i);
        else on.add(i);
        tx.set(o.id, { ...o, fill: [...on].sort((x, y) => x - y) });
      }
    }
    this.updateCursor("grabbing");
    return true;
  }

  interMove(e: PointerEvent): void {
    const d = this.interDrag;
    if (!d) return;
    if (d.local) { this.localMove(e); return; }
    const o0 = d.o0;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (o0.type === "trig") {
      d.tx.set(o0.id, { ...o0, ang: trigAngleAt(o0, this.world(e)) });
    } else if (o0.type === "graph") {
      const z = this.cam.z;
      d.tx.set(o0.id, { ...o0, v: { ...o0.v, cx: o0.v.cx - dx / z / o0.v.sx, cy: o0.v.cy + dy / z / o0.v.sy } });
    } else if (o0.type === "solid") {
      d.tx.set(o0.id, { ...o0, school: false, yaw: o0.yaw + dx * 0.011, pitch: o0.pitch + dy * 0.011 });
    }
  }

  endInterDrag(): void {
    if (!this.interDrag) return;
    if (!this.interDrag.local) this.interDrag.tx.done();
    this.interDrag = null;
    this.updateCursor();
  }

  // ---------- keyboard ----------
  onKey(e: KeyboardEvent): void {
    if (closestOf(e.target, EDITABLE)) return;
    if (!this.root.isConnected) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();

    if (this.tools[this.tool]?.key?.(e)) { e.preventDefault(); return; }

    if (e.key === " ") { if (!this.space) { this.space = true; this.updateCursor(); } e.preventDefault(); return; }
    if (e.key === "Escape") {
      if (this.secPick) this.stopSecPick();
      else if (this.inter) this.exitInteractive();
      else if (this.cropEdit) this.exitCrop();
      else if (this.vertEdit) { this.vertEdit = null; this.requestRender(); }
      else if (this.sel.size) this.setSel([]);
      else if (this.tool !== "select") this.setTool("select");
      return;
    }
    if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && k === "y") { e.preventDefault(); this.redo(); return; }
    if (mod && k === "a") { e.preventDefault(); if (this.canEdit) { this.setTool("select"); this.setSel(this.objs().map((o) => o.id)); } return; }
    if (mod && k === "g") { e.preventDefault(); if (e.shiftKey) this.ungroupSelected(); else this.groupSelected(); return; }
    if (mod && k === "c") { this.copy(); return; }
    if (mod && k === "x") { this.copy(); this.deleteSelection(); return; }
    if (mod && k === "d") {
      e.preventDefault();
      if (this.canEdit && this.sel.size) { const t = this.tx(); this.duplicateSelection(t); t.done(); }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); this.deleteSelection(); return; }
    if (e.key.startsWith("Arrow") && this.sel.size && this.canEdit) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      const t = this.tx();
      for (const o of this.selObjs()) if (this.canModify(o)) t.set(o.id, defOf(o).move(o, dx, dy));
      t.done();
      return;
    }
    if (mod) return;
    if (e.key === "=" || e.key === "+") { this.zoomBy(1.25); return; }
    if (e.key === "-" || e.key === "_") { this.zoomBy(0.8); return; }
    if (e.key === "0") { this.resetZoom(); return; }
    if (e.key === "!" || (e.key === "1" && e.shiftKey)) { this.zoomToFit(); return; }
    const map: Record<string, string> = { v: "select", h: "hand", p: "pen", m: "highlighter", e: "eraser", l: "line", a: "arrow", o: "ellipse", r: "rect", g: "polygon", t: "text", f: "formula", b: "laser", c: "compass" };
    if (map[k] && !e.altKey) this.setTool(map[k]);
  }

  // ---------- rendering ----------
  /** Canvas text does not trigger a font download, and the board may draw before its fonts have
   *  arrived, so fetch them here and repaint (cached bitmaps too) once they are ready. */
  private loadFonts(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const ui = uiFont();
    Promise.all([fonts.load(`400 16px ${ui}`), fonts.load(`700 16px ${ui}`), fonts.load(`400 16px ${marckScriptFamily()}`)])
      .then(() => {
        if (!this.root.isConnected) return;
        this.objCache?.clear();
        this.requestRender();
      })
      .catch(() => {});
  }

  requestRender(): void {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  /** Repaint only the overlay (cursor, trace, previews), not the whole board. */
  requestOverlay(): void {
    if (this.dirty || this.ovRaf) return;
    this.ovRaf = requestAnimationFrame(() => { this.ovRaf = 0; if (!this.dirty) this.drawOverlay(); });
  }

  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const { ctx, cam, dpr, W, H } = this;
    const z = cam.z;
    // The page may have closed (test finished): drawing tools are then disabled.
    if (!this.canEdit && this.tool !== "hand" && this.tool !== "laser") { this.cancelTool(); this.tool = "hand"; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    this.drawGrid(ctx);

    ctx.save();
    ctx.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * z * dpr, -cam.y * z * dpr);
    const view = { x: cam.x - 30, y: cam.y - 30, w: W / z + 60, h: H / z + 60 };
    const env: DrawEnv = {
      zoom: z,
      hideId: this.editing?.kind === "text" ? this.editing.id : null,
      interactingId: this.inter,
      repaint: () => this.requestRender(),
      now: this.serverNow(),
      polls: this.voteInfo(),
      isOwner: this.isOwner,
    };
    const stable = this._lastRenderZ === z; // no caching while zooming
    for (const o0 of this.objs()) {
      const o = this.viewObj(o0);
      const def = defOf(o);
      const b = def.bounds(o);
      const pad = (o.s || 0) + 24;
      if (b.x > view.x + view.w || b.x + b.w + pad < view.x || b.y > view.y + view.h || b.y + b.h + pad < view.y) continue;
      if (stable && CACHED_TYPES.has(o.type) && env.interactingId !== o.id && this.drawCached(ctx, o, b, env)) continue;
      def.draw(ctx, o, env);
    }
    this._lastRenderZ = z;
    ctx.restore();

    this.dom.setCamera(cam);
    if (this.domDirty) { this.domDirty = false; this.dom.sync(); }
    this.drawOverlay();
    this.broadcastView();
    this.tickTimers();
    if (this.commentOpen) this.emit();
  }

  /** Heavy objects (graphs, solids) are rendered once to a bitmap that is then just blitted while panning. */
  drawCached(ctx: CanvasRenderingContext2D, o: BoardObject, bd: Bounds, env: DrawEnv): boolean {
    const z = this.cam.z;
    const s = z * this.dpr;
    const pad = 24;
    const pw = Math.ceil((bd.w + pad * 2) * s), ph = Math.ceil((bd.h + pad * 2) * s);
    if (pw < 2 || ph < 2 || pw * ph > 6_000_000) return false;
    this.objCache = this.objCache || new Map();
    let e = this.objCache.get(o.id);
    if (!e || e.o !== o || e.z !== z || e.pw !== pw || e.ph !== ph) {
      const c = e?.c || document.createElement("canvas");
      c.width = pw;
      c.height = ph;
      const cx = c.getContext("2d");
      if (!cx) return false;
      cx.setTransform(s, 0, 0, s, -(bd.x - pad) * s, -(bd.y - pad) * s);
      defOf(o).draw(cx, o, env);
      e = { o, z, pw, ph, c, bx: bd.x - pad, by: bd.y - pad };
    }
    this.objCache.delete(o.id);
    this.objCache.set(o.id, e);
    while (this.objCache.size > 24) {
      const oldest = this.objCache.keys().next().value;
      if (oldest === undefined) break;
      this.objCache.delete(oldest);
    }
    // Copy pixel to pixel (no rescaling) so lines stay sharp.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(e.c, Math.round((e.bx - this.cam.x) * s), Math.round((e.by - this.cam.y) * s));
    ctx.restore();
    return true;
  }

  drawGrid(ctx: CanvasRenderingContext2D): void {
    const mode = this.prefs.grid;
    if (mode === "none") return;
    const { cam, W, H } = this;
    const z = cam.z;
    let step = CELL * z;
    while (step < 18) step *= 2;
    const ox = -cam.x * z;
    const oy = -cam.y * z;
    const sx0 = ((ox % step) + step) % step;
    const sy0 = ((oy % step) + step) % step;
    if (mode === "dots") {
      ctx.fillStyle = "#c9cde0";
      for (let x = sx0; x < W; x += step) for (let y = sy0; y < H; y += step) ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      return;
    }
    ctx.lineWidth = 1;
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? "#cfd6ec" : "#e6eaf6";
      ctx.beginPath();
      for (let x = sx0; x < W; x += step) {
        const i = Math.round((x - ox) / step);
        if ((i % 5 === 0) !== major) continue;
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, H);
      }
      for (let y = sy0; y < H; y += step) {
        const i = Math.round((y - oy) / step);
        if ((i % 5 === 0) !== major) continue;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(W, Math.round(y) + 0.5);
      }
      ctx.stroke();
    }
  }

  drawOverlay(): void {
    const { octx: ctx, cam, dpr, W, H } = this;
    const z = cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * z * dpr, -cam.y * z * dpr);
    this.tools[this.tool]?.overlay?.(ctx);
    if (this.tool === "select" || this.inter) this.drawSelection(ctx);
    if (this.inter && this.hover) {
      const o = this.store.get(this.inter);
      if (o?.type === "graph") drawTrace(ctx, this.viewObj(o), this.hover, z);
    }
    if (this.secPick && this.hover) {
      const o = this.store.get(this.secPick);
      const hit = o?.type === "solid" ? solidPickEdge(o, this.hover, 24 / z) : null;
      if (o?.type === "solid" && hit) {
        ctx.save();
        ctx.fillStyle = o.sc;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2 / z;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(hit.pt[0], hit.pt[1], 7 / z, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    const now = performance.now();
    for (const p of this.peers.values()) {
      if (!p.t || now - p.t > 15000) continue;
      drawCursor(ctx, p, z);
    }
    let alive = drawLaser(ctx, this.laser.pts, "#ff2d2d", z, now);
    for (const p of this.peers.values()) if (p.laser) alive = drawLaser(ctx, p.laser, p.color, z, now) || alive;
    ctx.restore();
    if (alive) this.requestRender();
  }

  drawSelection(ctx: CanvasRenderingContext2D): void {
    const sel = this.selObjs();
    if (!sel.length) return;
    const z = this.cam.z;
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.6 / z;
    const single = sel.length === 1 ? sel[0] : null;
    const handle = (x: number, y: number) => {
      const r = 4.5 / z;
      ctx.beginPath();
      ctx.rect(x - r, y - r, r * 2, r * 2);
      ctx.fill();
      ctx.stroke();
    };
    const dot = (x: number, y: number, r = 5.5) => {
      ctx.beginPath();
      ctx.arc(x, y, r / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    if (single?.type === "line") {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = single.s + 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(single.pts[0][0], single.pts[0][1]);
      ctx.lineTo(single.pts[1][0], single.pts[1][1]);
      ctx.stroke();
      ctx.restore();
      if (this.canEdit) single.pts.forEach((q) => dot(q[0], q[1]));
    } else {
      if (sel.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1 / z;
        for (const o of sel) { const b = defOf(o).bounds(o); ctx.strokeRect(b.x, b.y, b.w, b.h); }
        ctx.restore();
      }
      const bd = unionBounds(sel.map((o) => defOf(o).bounds(o)));
      if (!bd) { ctx.restore(); return; }
      const pad = (single?.s || 0) / 2 + 4 / z;
      if (single?.type === "image" && this.cropEdit === single.id) {
        // Crop mode: the hidden part of the picture, faded, around the visible frame.
        const full = imageFullRect(single);
        ctx.save();
        ctx.beginPath();
        ctx.rect(full.x, full.y, full.w, full.h);
        ctx.rect(single.x, single.y, single.w, single.h);
        ctx.clip("evenodd");
        ctx.globalAlpha = 0.3;
        drawImageObject(ctx, single, { zoom: z, repaint: () => this.requestRender() }, true);
        ctx.restore();
        ctx.save();
        ctx.setLineDash([5 / z, 4 / z]);
        ctx.lineWidth = 1 / z;
        ctx.strokeRect(full.x, full.y, full.w, full.h);
        ctx.restore();
      }
      ctx.strokeRect(bd.x - pad, bd.y - pad, bd.w + pad * 2, bd.h + pad * 2);
      if (single && this.vertEdit === single.id) {
        if (this.canEdit && single.type === "polygon") single.pts.forEach((q) => dot(q[0], q[1]));
      } else if (this.canEdit && !this.inter && !this.secPick && !this.editing) {
        const hp: Point[] = [
          [bd.x - pad, bd.y - pad], [bd.x + bd.w / 2, bd.y - pad], [bd.x + bd.w + pad, bd.y - pad], [bd.x + bd.w + pad, bd.y + bd.h / 2],
          [bd.x + bd.w + pad, bd.y + bd.h + pad], [bd.x + bd.w / 2, bd.y + bd.h + pad], [bd.x - pad, bd.y + bd.h + pad], [bd.x - pad, bd.y + bd.h / 2],
        ];
        for (const q of hp) handle(q[0], q[1]);
      }
      if (this.canEdit && !this.inter && !this.secPick && !this.editing && !this.vertEdit && !this.cropEdit && sel.some((o) => defOf(o).rotate)) {
        const hx = bd.x + bd.w / 2;
        const hy = bd.y - pad - 30 / z;
        ctx.save();
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.4 / z;
        ctx.beginPath();
        ctx.moveTo(hx, bd.y - pad);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(hx, hy, 8 / z, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx, hy, 3.6 / z, -2.6, 1.9);
        ctx.stroke();
        ctx.restore();
      }
      if (single?.type === "solid" && this.canEdit && !this.inter && !this.secPick) {
        const hx = bd.x + bd.w + 22 / z;
        const hy = bd.y - 22 / z;
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(hx, hy, 11 / z, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.8 / z;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 5.5 / z, 3 / z, -0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(hx, hy, 3 / z, 5.5 / z, -0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- state for the UI ----------
  emit(): void {
    if (this.emitQueued) return;
    this.emitQueued = true;
    requestAnimationFrame(() => {
      this.emitQueued = false;
      this.opts.onState?.(this.getState());
    });
  }

  commentState(): CommentState | null {
    const o = this.commentOpen ? this.store.get(this.commentOpen) : undefined;
    if (o?.type !== "comment") return null;
    return { obj: o, sx: (o.x - this.cam.x) * this.cam.z, sy: (o.y - this.cam.y) * this.cam.z, canModify: this.canModify(o) };
  }

  getState(): BoardState {
    return {
      tool: this.tool,
      sel: this.selObjs(),
      zoom: this.cam.z,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      status: this.status,
      followCid: this.followCid,
      peers: [...this.peers.entries()].map(([cid, p]) => ({ cid, name: p.name, color: p.color, uid: p.uid, owner: p.owner, pg: p.view?.pg || null })),
      showKeys: this.showKeys,
      score: this.myScore(),
      viewing: this.viewStudentInfo(),
      quiz: this.quizProgress(),
      stampKind: this.stampKind,
      stampText: this.stampText || "",
      canEdit: this.canEdit,
      isOwner: this.isOwner,
      style: this.style,
      prefs: this.prefs,
      inter: this.inter,
      secPick: this.secPick,
      mathError: this.mathError || null,
      page: this.page,
      uid: this.uid,
      protect: this.protect,
      donePages: [...this.donePages()],
      comment: this.commentState(),
      pages: this.pages(),
      follow: this.follow,
      vertEdit: this.vertEdit,
      cropEdit: this.cropEdit,
      editing: this.editing?.kind || null,
      nlEdit: this.nlEdit || null,
      srcEdit: this.srcEdit || null,
      pdfAsk: this.pdfAsk ? { name: this.pdfAsk.name, total: this.pdfAsk.total, start: this.pdfAsk.start, more: !!this.pdfAsk.more } : null,
    };
  }
}

const round = (v: number): number => Math.round(v * 10) / 10;

/** Group id of the copy of group `grp` (one new id per original group). */
function groupCopyId(map: Map<string, string>, grp: string): string {
  let g = map.get(grp);
  if (!g) { g = "g_" + uid(); map.set(grp, g); }
  return g;
}

function loadPrefs(): Partial<BoardPrefs> {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") as Partial<BoardPrefs>; } catch { return {}; }
}

/** Laser trail; fades in about a second. Returns true while there is something to draw. */
function drawLaser(ctx: CanvasRenderingContext2D, pts: LaserPoint[], color: string, z: number, now: number): boolean {
  const LIFE = 1000;
  while (pts.length && now - pts[0].t > LIFE) pts.shift();
  if (!pts.length) return false;
  ctx.save();
  ctx.fillStyle = color;
  // One filled outline per continuous run, so the trail is a smooth line that tapers to
  // its tail, with no darker dots where pieces would overlap.
  let run: LaserPoint[] = [pts[0]];
  const flush = () => {
    if (run.length > 1) fillLaserRun(ctx, smoothLaser(run), z, now, LIFE);
  };
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].t - pts[i - 1].t > 250) { flush(); run = []; }
    run.push(pts[i]);
  }
  flush();
  const last = pts[pts.length - 1];
  const age = (now - last.t) / LIFE;
  ctx.globalAlpha = Math.max(0, 1 - age);
  const g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 16 / z);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,45,45,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(last.x, last.y, 16 / z, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return true;
}

/** Catmull–Rom through the sampled points (they come every ~25 ms, so the raw line is angular). */
function smoothLaser(pts: LaserPoint[]): LaserPoint[] {
  if (pts.length < 3) return pts;
  const out: LaserPoint[] = [];
  const STEPS = 6;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), t: p1.t + (p2.t - p1.t) * t });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Fills the run as one outline whose width shrinks with each point's age; the head is rounded. */
function fillLaserRun(ctx: CanvasRenderingContext2D, pts: LaserPoint[], z: number, now: number, life: number): void {
  const half = (p: LaserPoint) => (3.5 / z) * Math.max(0, 1 - (now - p.t) / life);
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny);
    if (l) { nx /= l; ny /= l; } else { nx = 0; ny = 0; }
    const w = half(pts[i]);
    left.push([pts[i].x + nx * w, pts[i].y + ny * w]);
    right.push([pts[i].x - nx * w, pts[i].y - ny * w]);
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const q of left) ctx.lineTo(q[0], q[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  const h = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(h.x, h.y, half(h), 0, Math.PI * 2);
  ctx.fill();
}

function drawCursor(ctx: CanvasRenderingContext2D, p: Peer, z: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1 / z, 1 / z);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4.5, 13);
  ctx.lineTo(8, 20);
  ctx.lineTo(11, 18.5);
  ctx.lineTo(7.5, 12);
  ctx.lineTo(13, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = `600 12px ${uiFont()}`;
  const w = ctx.measureText(p.name).width;
  ctx.fillRect(14, 16, w + 12, 20);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(p.name, 20, 26);
  ctx.restore();
}
