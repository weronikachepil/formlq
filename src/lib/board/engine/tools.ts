// Board tools. Every tool has down / move / up (+ hover, and overlay for the draft).
// p is a point in board coordinates, e is the pointer event.
import {
  boundsIntersect, clamp, dist, distToSegment, normAngle, rectFromPoints, round1, simplify, snapTo, unionBounds,
} from "./geom";
import { recognize, type RecognizedShape } from "./recognize";
import { uiFont } from "./fonts";
import { fmtLen } from "./measure";
import { cropToFrame, imageFullRect, rulerEdges } from "./extra";
import { createConstrTools } from "./constr";
import {
  LABELS, T, drawHighlight, parallelogramPoints, quadPoints, rectPoints, regularPoints, rightTriPoints, scaleneTriPoints, trapezoidPoints, triPoints, uid,
} from "./shapes";
import type { MathBoard } from "./board";
import type {
  AngleObject, ArcObject, BoardObject, Bounds, DrawEnv, DrawStyle, EllipseObject, ImageObject, LineObject, ObjectDraft, ObjectType,
  ObjectTypeDef, Point, PolygonObject, SolidObject, StrokeObject,
} from "./types";

/** A board tool. The board routes pointer and key events to the active tool. */
export interface Tool {
  cursor: string;
  down(p: Point, e: PointerEvent): void;
  move(p: Point, e: PointerEvent): void;
  up(p: Point, e: PointerEvent): void;
  /** Pointer moves with no button pressed; returns the cursor to show. */
  hover?(p: Point): string;
  /** Pointer cancelled or tool switched mid-gesture. */
  cancel?(): void;
  /** Called when the tool becomes active. */
  activate?(): void;
  /** Returns true when the key was handled. */
  key?(e: KeyboardEvent): boolean;
  /** Draws the tool's draft on the overlay canvas (board coordinates). */
  overlay?(ctx: CanvasRenderingContext2D): void;
}

type Tx = ReturnType<MathBoard["tx"]>;
type HandleName = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const def = (type: ObjectType): ObjectTypeDef => T[type];

/** Tool previews draw drafts (no id/z yet); draw functions never read those fields. */
function drawDraft(ctx: CanvasRenderingContext2D, o: ObjectDraft, env: DrawEnv): void {
  def(o.type).draw(ctx, o as BoardObject, env);
}

const HANDLE_NAMES: HandleName[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<string, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
const BIG_TYPES = new Set<ObjectType>(["graph", "solid", "formula", "image", "ruler", "protractor", "comment", "poll", "timer", "task", "trig", "numline", "colmath", "fmodel", "chart", "dice", "ptree", "cplane", "stamp"]);
const LOCK_TYPES = new Set<ObjectType>(["text", "formula", "solid", "image", "protractor"]);

export function handlePoints(bd: Bounds): Record<HandleName, Point> {
  const { x, y, w, h } = bd;
  return {
    nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2],
    se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2],
  };
}

function mapRect(r: Bounds, from: Bounds, to: Bounds): Bounds {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return { x: to.x + (r.x - from.x) * sx, y: to.y + (r.y - from.y) * sy, w: r.w * sx, h: r.h * sy };
}

/** New frame while dragging handle h. */
function resizedBounds(h: string, b0: Bounds, p: Point, lock: boolean): Bounds {
  let x0 = b0.x, y0 = b0.y, x1 = b0.x + b0.w, y1 = b0.y + b0.h;
  const MIN = 6;
  if (h.includes("w")) x0 = Math.min(p[0], x1 - MIN);
  if (h.includes("e")) x1 = Math.max(p[0], x0 + MIN);
  if (h.includes("n")) y0 = Math.min(p[1], y1 - MIN);
  if (h.includes("s")) y1 = Math.max(p[1], y0 + MIN);
  if (lock && h.length === 2 && b0.w && b0.h) {
    const k = Math.max((x1 - x0) / b0.w, (y1 - y0) / b0.h);
    const w = b0.w * k;
    const hh = b0.h * k;
    if (h.includes("w")) x0 = x1 - w; else x1 = x0 + w;
    if (h.includes("n")) y0 = y1 - hh; else y1 = y0 + hh;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const boundsOfObjs = (objs: BoardObject[]): Bounds => unionBounds(objs.map((o) => def(o.type).bounds(o)))!;

// ---------- selection handles ----------
/** Handle under p: a resize handle name, "rot", "rot3d", "v<i>" (vertex), or null. */
export function handleAt(b: MathBoard, p: Point): string | null {
  const sel: BoardObject[] = b.selObjs();
  if (!sel.length || !b.canEdit) return null;
  const z = b.cam.z;
  const r = 11 / z;
  if (sel.length === 1) {
    const o = sel[0];
    if (o.type === "line" || (o.type === "polygon" && b.vertEdit === o.id)) {
      for (let i = 0; i < o.pts.length; i++) if (dist(p, o.pts[i]) <= r) return "v" + i;
      if (o.type === "line") return null;
    }
    if (o.type === "solid") {
      const bd = T.solid.bounds(o);
      if (dist(p, [bd.x + bd.w + 22 / z, bd.y - 22 / z]) <= r) return "rot3d";
    }
  }
  if (b.vertEdit) return null;
  const bd = boundsOfObjs(sel);
  if (!b.cropEdit && sel.some((o) => def(o.type).rotate)) {
    const pad = (sel.length === 1 ? sel[0].s || 0 : 0) / 2 + 4 / z;
    if (dist(p, [bd.x + bd.w / 2, bd.y - pad - 30 / z]) <= r) return "rot";
  }
  const pts = handlePoints(bd);
  for (const n of HANDLE_NAMES) if (dist(p, pts[n]) <= r) return n;
  return null;
}

// ---------- select / move / resize ----------
type SelectDrag =
  | { mode: "rotate"; origs: BoardObject[]; c: Point; a0: number }
  | { mode: "rot3d"; o0: SolidObject; start: Point }
  | { mode: "vert"; o0: LineObject | PolygonObject; i: number }
  | { mode: "resize"; h: string; origs: { o: BoardObject; ob: Bounds }[]; b0: Bounds; lock: boolean }
  // Crop mode (MathBoard.cropEdit): a handle moves a crop edge / a drag slides the picture under the frame.
  | { mode: "crop"; h: string; o0: ImageObject; full: Bounds; b0: Bounds }
  | { mode: "cropPan"; o0: ImageObject; full: Bounds; start: Point }
  | { mode: "move"; start: Point; moved: boolean; origs: BoardObject[]; b0: Bounds }
  | { mode: "marquee"; start: Point; cur: Point; base: Set<string> };

function selectTool(b: MathBoard): Tool {
  let drag: SelectDrag | null = null;
  let tx: Tx | null = null;
  return {
    cursor: "default",
    hover(p) {
      const h = handleAt(b, p);
      if (h) return h === "rot3d" ? "grab" : h === "rot" ? "crosshair" : h[0] === "v" ? "crosshair" : CURSORS[h];
      const o = b.pickForMove(p);
      if (o && o.id === b.cropEdit) return "grab";
      return o ? "move" : "default";
    },
    down(p, e) {
      drag = null;
      const h = handleAt(b, p);
      if (h) {
        tx = b.tx();
        const objs = (b.selObjs() as BoardObject[]).filter((o) => b.canModify(o));
        if (!objs.length) { tx = null; return; }
        const o0 = objs[0];
        if (h === "rot") {
          const bd = boundsOfObjs(objs);
          const c: Point = [bd.x + bd.w / 2, bd.y + bd.h / 2];
          drag = { mode: "rotate", origs: objs, c, a0: Math.atan2(p[1] - c[1], p[0] - c[0]) };
        } else if (h === "rot3d") {
          if (o0.type === "solid") drag = { mode: "rot3d", o0, start: p };
        } else if (h[0] === "v") {
          if (o0.type === "line" || o0.type === "polygon") drag = { mode: "vert", o0, i: Number(h.slice(1)) };
        } else if (o0.type === "image" && b.cropEdit === o0.id) {
          drag = { mode: "crop", h, o0, full: imageFullRect(o0), b0: { x: o0.x, y: o0.y, w: o0.w, h: o0.h } };
        } else {
          const origs = objs.filter((o) => b.canModify(o)).map((o) => ({ o, ob: def(o.type).bounds(o) }));
          if (!origs.length) { tx = null; return; }
          drag = { mode: "resize", h, origs, b0: unionBounds(origs.map((x) => x.ob))!, lock: objs.some((o) => LOCK_TYPES.has(o.type)) };
        }
        return;
      }
      const hit: BoardObject | null = b.pickForMove(p);
      if (hit && hit.type === "image" && b.cropEdit === hit.id && b.canModify(hit)) {
        tx = b.tx();
        drag = { mode: "cropPan", o0: hit, full: imageFullRect(hit), start: p };
        return;
      }
      if (hit) {
        if (hit.type === "comment") b.openComment(hit.id);
        else b.closeComment();
        const ids: string[] = b.groupIds(hit);
        if (e.shiftKey) {
          const set = new Set<string>(b.sel);
          if (ids.every((id) => set.has(id))) ids.forEach((id) => set.delete(id));
          else ids.forEach((id) => set.add(id));
          b.setSel([...set]);
          if (!set.has(hit.id)) return;
        } else if (!b.sel.has(hit.id)) {
          b.setSel(ids);
        }
        if (b.vertEdit && b.vertEdit !== hit.id) b.vertEdit = null;
        const movable = (b.selObjs() as BoardObject[]).filter((o) => b.canModify(o));
        if (!movable.length) return; // locked objects can only be selected
        tx = b.tx();
        if (e.altKey) b.duplicateSelection(tx, 0, 0);
        const objs = (b.selObjs() as BoardObject[]).filter((o) => b.canModify(o));
        drag = { mode: "move", start: p, moved: false, origs: objs, b0: boundsOfObjs(objs) };
        return;
      }
      b.closeComment();
      b.vertEdit = null;
      if (!e.shiftKey) b.setSel([]);
      drag = { mode: "marquee", start: p, cur: p, base: new Set<string>(b.sel) };
    },
    move(p, e) {
      if (!drag) return;
      const z = b.cam.z;
      if (drag.mode === "move") {
        let dx = p[0] - drag.start[0];
        let dy = p[1] - drag.start[1];
        if (!drag.moved && Math.hypot(dx, dy) * z < 3) return;
        drag.moved = true;
        if (b.prefs.snap) {
          dx = snapTo(drag.b0.x + dx, b.snapStep) - drag.b0.x;
          dy = snapTo(drag.b0.y + dy, b.snapStep) - drag.b0.y;
        }
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        for (const o of drag.origs) {
          const mv = def(o.type).move(o, dx, dy);
          tx!.set(o.id, mv.type === "quiz" ? { ...mv, auto: false } : mv);
        }
      } else if (drag.mode === "resize") {
        const sp: Point = b.snapPoint(p);
        const nb = resizedBounds(drag.h, drag.b0, sp, drag.lock || e.shiftKey);
        for (const { o, ob } of drag.origs) tx!.set(o.id, def(o.type).fit(o, ob, mapRect(ob, drag.b0, nb)));
      } else if (drag.mode === "crop") {
        // The frame's dragged edges follow the pointer, kept inside the whole picture.
        const { full } = drag;
        const MIN = 12 / z;
        const q: Point = [clamp(p[0], full.x, full.x + full.w), clamp(p[1], full.y, full.y + full.h)];
        const nb = resizedBounds(drag.h, drag.b0, q, false);
        const x0 = Math.max(full.x, nb.x);
        const y0 = Math.max(full.y, nb.y);
        const x1 = Math.min(full.x + full.w, Math.max(x0 + MIN, nb.x + nb.w));
        const y1 = Math.min(full.y + full.h, Math.max(y0 + MIN, nb.y + nb.h));
        tx!.set(drag.o0.id, cropToFrame(drag.o0, full, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }));
      } else if (drag.mode === "cropPan") {
        // The picture slides under the fixed frame, never leaving a gap inside it.
        const { full, o0 } = drag;
        const dx = clamp(p[0] - drag.start[0], o0.x + o0.w - (full.x + full.w), o0.x - full.x);
        const dy = clamp(p[1] - drag.start[1], o0.y + o0.h - (full.y + full.h), o0.y - full.y);
        const moved = { ...full, x: full.x + dx, y: full.y + dy };
        tx!.set(o0.id, cropToFrame(o0, moved, { x: o0.x, y: o0.y, w: o0.w, h: o0.h }));
      } else if (drag.mode === "rotate") {
        let ang = Math.atan2(p[1] - drag.c[1], p[0] - drag.c[0]) - drag.a0;
        if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
        for (const o of drag.origs) {
          const d = def(o.type);
          if (d.rotate) tx!.set(o.id, d.rotate(o, ang, drag.c[0], drag.c[1]));
        }
      } else if (drag.mode === "vert") {
        let q: Point = b.snapPoint(p);
        const o0 = drag.o0;
        const i = drag.i;
        if (e.shiftKey && o0.type === "line") q = constrainAngle(o0.pts[1 - i], q);
        const pts = o0.pts.map((pt, j): Point => (j === i ? [round1(q[0]), round1(q[1])] : pt));
        tx!.set(o0.id, o0.type === "line" ? { ...o0, pts: [pts[0], pts[1]] } : { ...o0, pts });
      } else if (drag.mode === "rot3d") {
        const dx = (p[0] - drag.start[0]) * z;
        const dy = (p[1] - drag.start[1]) * z;
        tx!.set(drag.o0.id, { ...drag.o0, school: false, yaw: drag.o0.yaw + dx * 0.011, pitch: drag.o0.pitch + dy * 0.011 });
      } else if (drag.mode === "marquee") {
        drag.cur = p;
        const rect = rectFromPoints(drag.start, p);
        const ids = new Set(drag.base);
        for (const o of b.objs() as BoardObject[]) {
          if (b.canTouch(o) && boundsIntersect(rect, def(o.type).bounds(o))) for (const id of b.groupIds(o) as string[]) ids.add(id);
        }
        b.setSel([...ids]);
        b.requestRender();
      }
    },
    up() {
      if (tx) { tx.done(); tx = null; }
      if (drag?.mode === "marquee") b.requestRender();
      drag = null;
    },
    cancel() {
      if (tx) { tx.cancel(); tx = null; }
      drag = null;
    },
    overlay(ctx) {
      if (drag?.mode !== "marquee") return;
      const r = rectFromPoints(drag.start, drag.cur);
      const z = b.cam.z;
      ctx.save();
      ctx.fillStyle = "rgba(109,61,240,0.08)";
      ctx.strokeStyle = "#6d3df0";
      ctx.lineWidth = 1 / z;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    },
  };
}

function constrainAngle(from: Point, to: Point): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
  return [from[0] + Math.cos(a) * len, from[1] + Math.sin(a) * len];
}

/** Ruler edge a stroke snaps to (MathBoard.rulerLock). */
interface Lock {
  a: Point;
  b: Point;
}

// ---------- pen and highlighter ----------
const DRAFT_KEY = {}; // the highlighter draft's raster
/** Shape recognition: how long (ms) and how still (screen px) the pen must be held. */
const HOLD_MS = 800;
const HOLD_SLOP = 2;
function penTool(b: MathBoard, highlighter: boolean): Tool {
  let pts: Point[] | null = null;
  let lock: Lock | null = null; // snapped to a ruler edge
  let hold: Point | null = null; // where the pen stopped
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shape: RecognizedShape | null = null;
  let path: Path2D | null = null; // draft path, extended incrementally instead of rebuilt every frame
  let built = 1;
  const color = (): string => (highlighter ? b.style.hc : b.style.c);
  const size = (): number => (highlighter ? b.style.hs : b.style.s);
  const draft = () => ({ type: "stroke" as const, pts, c: color(), s: size(), hl: highlighter });
  const arm = (p: Point) => {
    clearTimeout(timer);
    shape = null;
    hold = p;
    if (highlighter || lock || !b.prefs.recognize) return;
    timer = setTimeout(() => {
      if (!pts) return;
      const r = recognize(pts, b.cam.z, b.style);
      if (r) { shape = r; b.requestOverlay(); }
    }, HOLD_MS);
  };
  return {
    cursor: "crosshair",
    down(p) {
      lock = b.rulerLock(p);
      const q: Point = lock ? b.projectToLock(lock, p) : p;
      pts = [[round1(q[0]), round1(q[1])]];
      path = null;
      built = 1;
      arm(q);
    },
    move(p, e) {
      if (!pts) return;
      if (lock) {
        const q: Point = b.projectToLock(lock, p);
        pts = [pts[0], [round1(q[0]), round1(q[1])]];
        built = 1; path = null;
        b.requestOverlay();
        return;
      }
      if (e.shiftKey) {
        // Shift — a straight line from the start (underline)
        pts = [pts[0], [round1(p[0]), round1(p[1])]];
        built = 1; path = null;
        b.requestOverlay();
        return;
      }
      // A wide highlighter needs fewer points.
      const min = highlighter ? Math.max(0.7 / b.cam.z, size() * 0.3) : 0.7 / b.cam.z;
      const evs = e.getCoalescedEvents?.() || [];
      const list: Point[] = evs.length ? evs.map((ev) => b.world(ev)) : [p];
      for (const q of list) {
        const l = pts[pts.length - 1];
        if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= min) pts.push([round1(q[0]), round1(q[1])]);
      }
      // Any real movement restarts the wait: a shape is recognised only when the pen is held still.
      // Once recognised, lifting the pen may drift a little without losing the shape.
      const slop = shape ? 10 : HOLD_SLOP;
      if (!hold || Math.hypot(p[0] - hold[0], p[1] - hold[1]) > slop / b.cam.z) arm(p);
      b.requestOverlay();
    },
    up() {
      clearTimeout(timer);
      if (!pts) return;
      if (shape) {
        const sh = shape;
        shape = null;
        pts = null;
        b.addObj(sh);
        return;
      }
      let out = pts.length === 1 ? [pts[0], pts[0]] : simplify(pts, Math.max(0.3, 0.45 / b.cam.z));
      if (out.length === 1) out = [out[0], out[0]];
      const o: ObjectDraft<StrokeObject> = { ...draft(), pts: out };
      pts = null;
      b.addObj(o);
    },
    cancel() { clearTimeout(timer); pts = null; shape = null; path = null; },
    overlay(ctx) {
      if (shape) {
        drawDraft(ctx, shape, { zoom: b.cam.z });
        return;
      }
      if (pts && pts.length && highlighter) {
        drawHighlight(ctx, pts, color(), size(), DRAFT_KEY, true);
        return;
      }
      if (pts && pts.length) {
        const mid = (a: Point, c: Point): Point => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        if (!path) { path = new Path2D(); path.moveTo(pts[0][0], pts[0][1]); built = 1; }
        // append only the new points: each adds a quadratic curve to the middle of the next segment
        while (built < pts.length - 1) {
          const m = mid(pts[built], pts[built + 1]);
          path.quadraticCurveTo(pts[built][0], pts[built][1], m[0], m[1]);
          built++;
        }
        const last = pts[pts.length - 1];
        const from = built === 1 ? pts[0] : mid(pts[built - 1], pts[built]);
        ctx.save();
        ctx.strokeStyle = color();
        ctx.lineWidth = size();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke(path);
        ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(last[0], last[1]); ctx.stroke();
        ctx.restore();
        return;
      }
      if (!b.hover) return;
      // stroke-size dot under the cursor
      ctx.save();
      ctx.globalAlpha = highlighter ? 0.45 : 0.9;
      ctx.fillStyle = color();
      ctx.beginPath();
      ctx.arc(b.hover[0], b.hover[1], Math.max(size() / 2, 1.2 / b.cam.z), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

// ---------- eraser ----------
function eraserTool(b: MathBoard): Tool {
  let tx: Tx | null = null;
  let click = false;
  const erase = (t: Tx, p: Point) => {
    const tol = 10 / b.cam.z;
    for (const o of b.objs() as BoardObject[]) {
      // Pictures (and PDF pages) are never erased: erasing ink over a task removed the task
      // itself. They are deleted on purpose instead (select → trash / Delete).
      if (o.type === "image") continue;
      // big objects are erased only by a click, not by swiping over them
      if (BIG_TYPES.has(o.type) && !click) continue;
      if (b.canModify(o) && def(o.type).hit(o, p, tol)) t.del(o.id);
    }
  };
  return {
    cursor: "none",
    down(p) { tx = b.tx(); click = true; erase(tx, p); click = false; },
    move(p) { if (tx) erase(tx, p); b.requestOverlay(); },
    up() { if (tx) { tx.done(); tx = null; } },
    cancel() { if (tx) { tx.done(); tx = null; } },
    overlay(ctx) {
      if (!b.hover) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.hover[0], b.hover[1], 10 / b.cam.z, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(224,49,49,0.12)";
      ctx.strokeStyle = "rgba(224,49,49,0.7)";
      ctx.lineWidth = 1.5 / b.cam.z;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  };
}

// ---------- shapes by dragging ----------
/** Default size when the shape is placed by a click instead of a drag. */
const SHAPES: Record<string, { dw: number; dh: number }> = {
  ellipse: { dw: 150, dh: 150 }, rect: { dw: 180, dh: 120 },
  triangle: { dw: 170, dh: 150 }, rtriangle: { dw: 150, dh: 130 }, tri_scalene: { dw: 200, dh: 150 }, tri_eq: { dw: 190, dh: 165 }, tri_obt: { dw: 230, dh: 90 }, trapezoid: { dw: 190, dh: 120 },
  parallelogram: { dw: 190, dh: 120 }, q_square: { dw: 150, dh: 150 }, q_rect: { dw: 200, dh: 120 }, q_rhombus: { dw: 190, dh: 130 }, q_para: { dw: 200, dh: 120 }, q_trap_iso: { dw: 210, dh: 120 }, q_trap_right: { dw: 210, dh: 120 }, q_trap: { dw: 220, dh: 120 }, q_quad: { dw: 200, dh: 150 }, pentagon: { dw: 160, dh: 160 }, hexagon: { dw: 170, dh: 150 },
};

type ShapeDraft = ObjectDraft<LineObject | EllipseObject | PolygonObject>;
type ShapeStyle = Pick<DrawStyle, "c" | "s" | "f" | "dash">;

function buildShape(kind: string, a: Point, c: Point, shift: boolean, style: ShapeStyle, z: number): ShapeDraft | null {
  const base = { c: style.c, s: style.s, dash: style.dash };
  if (kind === "line" || kind === "arrow" || kind === "arrow2") {
    if (dist(a, c) < 4 / z) return null;
    const end = shift ? constrainAngle(a, c) : c;
    return { type: "line", pts: [[round1(a[0]), round1(a[1])], [round1(end[0]), round1(end[1])]], arrow: kind === "arrow" || kind === "arrow2", ...(kind === "arrow2" ? { arrow2: true } : {}), ...base };
  }
  const cfg = SHAPES[kind];
  let box: Bounds;
  if (dist(a, c) < 5 / z) {
    box = { x: a[0] - cfg.dw / 2, y: a[1] - cfg.dh / 2, w: cfg.dw, h: cfg.dh };
  } else {
    let end = c;
    if (shift) {
      const w = c[0] - a[0], h = c[1] - a[1];
      const s = Math.max(Math.abs(w), Math.abs(h));
      end = [a[0] + Math.sign(w || 1) * s, a[1] + Math.sign(h || 1) * s];
    }
    box = rectFromPoints(a, end);
  }
  if (kind.startsWith("q_")) {
    const tiny = dist(a, c) < 5 / z;
    let box: Bounds;
    if (kind === "q_square") {
      const sd = tiny ? cfg.dw : Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), 20);
      box = tiny ? { x: a[0] - sd / 2, y: a[1] - sd / 2, w: sd, h: sd } : { x: c[0] >= a[0] ? a[0] : a[0] - sd, y: c[1] >= a[1] ? a[1] : a[1] - sd, w: sd, h: sd };
    } else box = tiny ? { x: a[0] - cfg.dw / 2, y: a[1] - cfg.dh / 2, w: cfg.dw, h: cfg.dh } : rectFromPoints(a, c);
    return {
      type: "polygon", pts: (quadPoints(kind, box) as Point[]).map((q): Point => [round1(q[0]), round1(q[1])]),
      labs: "ABCD", marks: true, cons: [], f: style.f, ...base,
    };
  }
  const TRI = new Set(["triangle", "rtriangle", "tri_scalene", "tri_eq", "tri_obt"]);
  if (kind === "tri_eq" || kind === "tri_obt") {
    // only the base width sets the size, so the angles stay exact
    const tiny = dist(a, c) < 5 / z;
    const w = tiny ? cfg.dw : Math.max(20, Math.abs(c[0] - a[0]));
    const hh = kind === "tri_eq" ? (w * Math.sqrt(3)) / 2 : w * 0.36;
    const x0 = tiny ? a[0] - w / 2 : Math.min(a[0], c[0]);
    const y0 = tiny ? a[1] - hh / 2 : Math.min(a[1], c[1]);
    const pts: Point[] = kind === "tri_eq"
      ? [[x0, y0 + hh], [x0 + w / 2, y0], [x0 + w, y0 + hh]]
      : [[x0, y0 + hh], [x0 + 0.28 * w, y0], [x0 + w, y0 + hh]];
    return { type: "polygon", pts: pts.map((q): Point => [round1(q[0]), round1(q[1])]), labs: "ABC", marks: true, cons: [], f: style.f, ...base };
  }
  if (kind === "ellipse") return { type: "ellipse", x: round1(box.x), y: round1(box.y), w: round1(box.w), h: round1(box.h), f: style.f, ...base };
  const pts: Point[] =
    kind === "rect" ? rectPoints(box) :
    kind === "triangle" ? triPoints(box) :
    kind === "tri_scalene" ? scaleneTriPoints(box) :
    kind === "rtriangle" ? rightTriPoints(box) :
    kind === "trapezoid" ? trapezoidPoints(box) :
    kind === "parallelogram" ? parallelogramPoints(box) :
    kind === "pentagon" ? regularPoints(5, box) : regularPoints(6, box);
  return {
    type: "polygon",
    pts: pts.map((q): Point => [round1(q[0]), round1(q[1])]),
    labs: kind === "rect" ? "" : LABELS.slice(0, pts.length),
    ...(TRI.has(kind) ? { marks: true, cons: [] } : {}),
    f: style.f,
    ...base,
  };
}

function shapeTool(b: MathBoard, kind: string): Tool {
  let a: Point | null = null;
  let cur: Point | null = null;
  let shift = false;
  let lock: Lock | null = null;
  const pt = (p: Point): Point => (lock ? b.projectToLock(lock, p) : b.snapPoint(p));
  return {
    cursor: "crosshair",
    down(p) {
      lock = kind === "line" || kind === "arrow" || kind === "arrow2" ? b.rulerLock(p) : null;
      a = pt(p);
      cur = a;
    },
    move(p, e) {
      if (!a) return;
      cur = pt(p);
      shift = e.shiftKey;
      b.requestRender();
    },
    up(p, e) {
      if (!a) return;
      const o = buildShape(kind, a, pt(p), e.shiftKey && !lock, b.style, b.cam.z);
      a = null;
      if (!o) return;
      const added = b.addObj(o);
      if (!b.prefs.keep) { b.setTool("select"); b.setSel([added.id]); }
    },
    cancel() { a = null; },
    overlay(ctx) {
      if (!a || !cur) return;
      const o = buildShape(kind, a, cur, shift && !lock, b.style, b.cam.z);
      if (o && dist(a, cur) > 3 / b.cam.z) drawDraft(ctx, o, { zoom: b.cam.z });
    },
  };
}

// ---------- free polygon (click by click) ----------
function polygonTool(b: MathBoard): Tool {
  let pts: Point[] = [];
  let cur: Point | null = null;
  const finish = () => {
    if (pts.length >= 3) {
      const added = b.addObj({
        type: "polygon", pts: pts.map((q): Point => [round1(q[0]), round1(q[1])]), labs: LABELS.slice(0, pts.length),
        c: b.style.c, s: b.style.s, f: b.style.f, dash: b.style.dash,
      });
      if (!b.prefs.keep) { b.setTool("select"); b.setSel([added.id]); }
    }
    pts = [];
    b.requestRender();
  };
  return {
    cursor: "crosshair",
    down(p) {
      const q: Point = b.snapPoint(p);
      const near = (pt: Point) => dist(q, pt) < 12 / b.cam.z;
      if (pts.length >= 3 && (near(pts[0]) || near(pts[pts.length - 1]))) return finish();
      pts.push(q);
      cur = q;
      b.requestRender();
    },
    move(p) { cur = b.snapPoint(p); if (pts.length) b.requestOverlay(); },
    hover(p) { cur = b.snapPoint(p); if (pts.length) b.requestOverlay(); return "crosshair"; },
    up() {},
    cancel() { pts = []; b.requestRender(); },
    key(e) {
      if (e.key === "Enter") { finish(); return true; }
      if (e.key === "Escape") { pts = []; b.requestRender(); return true; }
      return false;
    },
    overlay(ctx) {
      if (!pts.length) return;
      const z = b.cam.z;
      ctx.save();
      ctx.strokeStyle = b.style.c;
      ctx.lineWidth = b.style.s;
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      if (cur) ctx.lineTo(cur[0], cur[1]);
      ctx.stroke();
      ctx.fillStyle = "#6d3df0";
      pts.forEach((q, i) => {
        ctx.beginPath();
        ctx.arc(q[0], q[1], (i === 0 && pts.length >= 3 ? 7 : 4) / z, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    },
  };
}

// ---------- text and formula: a click places the object and opens the editor ----------
function placeTool(b: MathBoard, kind: "text" | "formula"): Tool {
  let at: Point | null = null;
  return {
    cursor: "text",
    down(p) { at = p; },
    move() {},
    up() {
      if (!at) return;
      const p = at;
      at = null;
      setTimeout(() => {
        if (kind === "text") b.editText({ at: p });
        else b.createFormula(p);
      }, 0);
    },
    cancel() { at = null; },
  };
}

// ---------- compass: set the radius, then draw arcs and circles of that radius ----------
type CompassDrag =
  | { mode: "radius" }
  | { mode: "sweep"; a0: number; last: number; sweep: number; moved: boolean };

function compassTool(b: MathBoard): Tool {
  let phase = 0; // 0 — no centre yet; 1 — centre and radius set
  let C: Point | null = null;
  let r = 0;
  let drag: CompassDrag | null = null;
  const style = () => ({ c: b.style.c, s: b.style.s, dash: b.style.dash });
  const reset = () => { phase = 0; C = null; r = 0; drag = null; };
  return {
    cursor: "crosshair",
    activate: reset,
    down(p) {
      const q: Point = b.snapPoint(p);
      if (phase === 1 && C && Math.abs(dist(q, C) - r) < 22 / b.cam.z) {
        const a0 = Math.atan2(q[1] - C[1], q[0] - C[0]);
        drag = { mode: "sweep", a0, last: a0, sweep: 0, moved: false };
        return;
      }
      C = q;
      r = 0;
      phase = 0;
      drag = { mode: "radius" };
    },
    move(p) {
      if (!drag || !C) return;
      const q: Point = b.snapPoint(p);
      if (drag.mode === "radius") r = dist(q, C);
      else {
        const a = Math.atan2(q[1] - C[1], q[0] - C[0]);
        drag.sweep += normAngle(a - drag.last);
        drag.last = a;
        if (Math.abs(drag.sweep) > 0.05) drag.moved = true;
      }
      b.requestRender();
    },
    up() {
      if (!drag || !C) return;
      if (drag.mode === "radius") {
        if (r < 6 / b.cam.z) reset();
        else phase = 1;
      } else if (!drag.moved || Math.abs(drag.sweep) >= Math.PI * 2 - 0.06) {
        b.addObj({ type: "ellipse", x: round1(C[0] - r), y: round1(C[1] - r), w: round1(2 * r), h: round1(2 * r), f: null, ...style() });
      } else {
        b.addObj({ type: "arc", cx: round1(C[0]), cy: round1(C[1]), r: round1(r), a0: drag.a0, a1: drag.a0 + drag.sweep, ...style() });
      }
      drag = null;
      b.requestRender();
    },
    cancel: reset,
    key(e) {
      if (e.key === "Escape" && (phase || drag)) { reset(); b.requestRender(); return true; }
      return false;
    },
    overlay(ctx) {
      if (!C) return;
      const z = b.cam.z;
      ctx.save();
      ctx.strokeStyle = "#6d3df0";
      ctx.fillStyle = "#6d3df0";
      ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      ctx.arc(C[0], C[1], 4 / z, 0, Math.PI * 2);
      ctx.fill();
      if (drag?.mode === "radius" && b.hover) {
        ctx.setLineDash([6 / z, 5 / z]);
        ctx.beginPath();
        ctx.moveTo(C[0], C[1]);
        ctx.lineTo(b.hover[0], b.hover[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${14 / z}px ${uiFont()}`;
        ctx.fillText(`r = ${fmtLen(r)}`, b.hover[0] + 10 / z, b.hover[1] - 10 / z);
      } else if (phase === 1) {
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([6 / z, 5 / z]);
        ctx.beginPath();
        ctx.arc(C[0], C[1], r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.font = `${14 / z}px ${uiFont()}`;
        ctx.fillText(`r = ${fmtLen(r)}`, C[0] + 8 / z, C[1] - 8 / z);
        if (drag?.mode === "sweep") {
          const arc: ObjectDraft<ArcObject> = { type: "arc", cx: C[0], cy: C[1], r, a0: drag.a0, a1: drag.a0 + drag.sweep, ...style() };
          // the arc's draw ignores env
          drawDraft(ctx, arc, { zoom: z });
        }
      }
      ctx.restore();
    },
  };
}

// ---------- laser pointer: the board draws the trail itself (see MathBoard.laserPoint) ----------
const laserTool: Tool = { cursor: "crosshair", down() {}, move() {}, up() {} };

// ---------- parallel / perpendicular: pick a line, then a point ----------
function pickSegment(b: MathBoard, p: Point, tol: number): Lock | null {
  const list: BoardObject[] = b.objs();
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    let sides: Point[][] = [];
    if (o.type === "line") sides = [[o.pts[0], o.pts[1]]];
    else if (o.type === "polygon") sides = o.pts.map((q, k) => [q, o.pts[(k + 1) % o.pts.length]]);
    else if (o.type === "ruler") sides = rulerEdges(o);
    for (const [a, c] of sides) if (distToSegment(p, a, c) <= tol) return { a, b: c };
  }
  return null;
}

function relTool(b: MathBoard, kind: "parallel" | "perp"): Tool {
  let ref: Lock | null = null;
  const base = () => ({ c: b.style.c, s: b.style.s, dash: b.style.dash });
  const build = (ref: Lock, q: Point): ObjectDraft<LineObject | StrokeObject>[] => {
    const d = [ref.b[0] - ref.a[0], ref.b[1] - ref.a[1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const u = [d[0] / L, d[1] / L];
    const st = base();
    const rp = (x: Point): Point => [round1(x[0]), round1(x[1])];
    if (kind === "parallel") {
      const half = Math.max(140, L / 2);
      return [{ type: "line", pts: [rp([q[0] - u[0] * half, q[1] - u[1] * half]), rp([q[0] + u[0] * half, q[1] + u[1] * half])], arrow: false, ...st }];
    }
    const t = ((q[0] - ref.a[0]) * u[0] + (q[1] - ref.a[1]) * u[1]);
    const H: Point = [ref.a[0] + u[0] * t, ref.a[1] + u[1] * t];
    const dist2 = Math.hypot(q[0] - H[0], q[1] - H[1]);
    if (dist2 < 2) return [];
    const out: ObjectDraft<LineObject | StrokeObject>[] = [{ type: "line", pts: [rp(q), rp(H)], arrow: false, ...st }];
    // extend the line to the foot of the perpendicular when it falls outside the segment
    if (t < 0) out.push({ type: "line", pts: [rp(ref.a), rp(H)], arrow: false, c: st.c, s: Math.max(2, st.s * 0.7), dash: true });
    else if (t > L) out.push({ type: "line", pts: [rp(ref.b), rp(H)], arrow: false, c: st.c, s: Math.max(2, st.s * 0.7), dash: true });
    // right-angle mark
    const s = Math.min(14, dist2 * 0.3);
    const v = [(q[0] - H[0]) / dist2, (q[1] - H[1]) / dist2];
    const su = t > L / 2 ? [-u[0], -u[1]] : u;
    out.push({ type: "stroke", pts: [rp([H[0] + su[0] * s, H[1] + su[1] * s]), rp([H[0] + (su[0] + v[0]) * s, H[1] + (su[1] + v[1]) * s]), rp([H[0] + v[0] * s, H[1] + v[1] * s])], c: st.c, s: Math.max(2, st.s * 0.6), hl: false });
    return out;
  };
  return {
    cursor: "crosshair",
    activate() { ref = null; },
    down(p) {
      if (!ref) {
        const hit = pickSegment(b, p, 12 / b.cam.z);
        if (hit) { ref = hit; b.requestRender(); }
        return;
      }
      const q: Point = b.snapPoint(p);
      const objs = build(ref, q);
      if (objs.length) b.addObjs(objs, true);
    },
    move() { b.requestOverlay(); },
    hover() { b.requestOverlay(); return "crosshair"; },
    up() {},
    cancel() { ref = null; },
    key(e) {
      if (e.key === "Escape" && ref) { ref = null; b.requestRender(); return true; }
      return false;
    },
    overlay(ctx) {
      const z = b.cam.z;
      const target = ref || (b.hover ? pickSegment(b, b.hover, 12 / z) : null);
      if (target) {
        ctx.save();
        ctx.strokeStyle = "#6d3df0";
        ctx.globalAlpha = ref ? 0.55 : 0.35;
        ctx.lineWidth = 7 / z;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(target.a[0], target.a[1]);
        ctx.lineTo(target.b[0], target.b[1]);
        ctx.stroke();
        ctx.restore();
      }
      if (ref && b.hover) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        for (const o of build(ref, b.snapPoint(b.hover))) drawDraft(ctx, o, { zoom: z });
        ctx.restore();
      }
    },
  };
}

// ---------- angle: three clicks — point A, vertex B, point C ----------
function angleTool(b: MathBoard): Tool {
  let pts: Point[] = [];
  let cur: Point | null = null;
  const reset = () => { pts = []; cur = null; b.requestRender(); };
  return {
    cursor: "crosshair",
    down(p) {
      const q: Point = b.snapPoint(p);
      if (pts.length && dist(q, pts[pts.length - 1]) < 4 / b.cam.z) return;
      pts.push(q);
      cur = q;
      if (pts.length === 3) {
        const [A, B, C] = pts.map((r): Point => [round1(r[0]), round1(r[1])]);
        const added = b.addObj({
          type: "angle", pts: [A, B, C], labs: "ABC",
          c: b.style.c, s: b.style.s, dash: b.style.dash,
        });
        pts = [];
        if (!b.prefs.keep) { b.setTool("select"); b.setSel([added.id]); }
      }
      b.requestRender();
    },
    move(p) { cur = b.snapPoint(p); if (pts.length) b.requestOverlay(); },
    hover(p) { cur = b.snapPoint(p); if (pts.length) b.requestOverlay(); return "crosshair"; },
    up() {},
    cancel: reset,
    key(e) {
      if (e.key === "Escape" && pts.length) { reset(); return true; }
      return false;
    },
    overlay(ctx) {
      if (!pts.length || !cur) return;
      const z = b.cam.z;
      ctx.save();
      if (pts.length > 1) {
        const draft: ObjectDraft<AngleObject> = { type: "angle", pts: [pts[0], pts[1], cur], c: b.style.c, s: b.style.s, dash: b.style.dash, labs: "ABC" };
        drawDraft(ctx, draft, { zoom: z });
      } else {
        const all = [pts[0], cur];
        ctx.strokeStyle = b.style.c;
        ctx.lineWidth = b.style.s;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(all[0][0], all[0][1]); ctx.lineTo(all[1][0], all[1][1]); ctx.stroke();
      }
      ctx.fillStyle = "#6d3df0";
      for (const q of pts) { ctx.beginPath(); ctx.arc(q[0], q[1], 4 / z, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    },
  };
}

// ---------- comment and stamp: a click places the object ----------
const clickTool = (fn: (p: Point) => void): Tool => ({ cursor: "crosshair", down(p) { fn(p); }, move() {}, up() {} });

const handTool: Tool = { cursor: "grab", down() {}, move() {}, up() {} };

export function createTools(b: MathBoard): Record<string, Tool> {
  return {
    select: selectTool(b),
    hand: handTool,
    parallel: relTool(b, "parallel"),
    perp: relTool(b, "perp"),
    comment: clickTool((p) => b.addComment(p)),
    stamp: clickTool((p) => b.addStamp(p)),
    laser: laserTool,
    compass: compassTool(b),
    pen: penTool(b, false),
    highlighter: penTool(b, true),
    eraser: eraserTool(b),
    line: shapeTool(b, "line"),
    arrow: shapeTool(b, "arrow"),
    arrow2: shapeTool(b, "arrow2"),
    ...createConstrTools(b),
    ellipse: shapeTool(b, "ellipse"),
    rect: shapeTool(b, "rect"),
    triangle: shapeTool(b, "triangle"),
    tri_scalene: shapeTool(b, "tri_scalene"),
    tri_eq: shapeTool(b, "tri_eq"),
    q_square: shapeTool(b, "q_square"),
    q_rect: shapeTool(b, "q_rect"),
    q_rhombus: shapeTool(b, "q_rhombus"),
    q_para: shapeTool(b, "q_para"),
    q_trap_iso: shapeTool(b, "q_trap_iso"),
    q_trap_right: shapeTool(b, "q_trap_right"),
    q_trap: shapeTool(b, "q_trap"),
    q_quad: shapeTool(b, "q_quad"),
    tri_obt: shapeTool(b, "tri_obt"),
    rtriangle: shapeTool(b, "rtriangle"),
    trapezoid: shapeTool(b, "trapezoid"),
    parallelogram: shapeTool(b, "parallelogram"),
    pentagon: shapeTool(b, "pentagon"),
    hexagon: shapeTool(b, "hexagon"),
    polygon: polygonTool(b),
    angle: angleTool(b),
    text: placeTool(b, "text"),
    formula: placeTool(b, "formula"),
  };
}

export { uid };
