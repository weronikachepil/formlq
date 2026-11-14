// Registry of board object types. For each type: bounds / draw / hit / move / fit.
// All objects are immutable: move() and fit() return a new copy.
import {
  boundsOfPoints, centroid, distToSegment, inBounds, mapPoint, pointInPolygon, round1,
} from "./geom";
import { drawGraph } from "./graph";
import { SOLID_TYPE } from "./solid";
import { drawCircles, drawPolyMarks, drawQuadExtras, drawTriangleExtras } from "./triangle";
import { drawLength, drawMeasures, fmtNum } from "./measure";
import {
  COMMENT_TYPE, hiddenType, POLL_TYPE, STAMP_TYPE, TASK_TYPE, TIMER_TYPE,
} from "./classroom";
import { TRIG_TYPE } from "./trig";
import { NUMLINE_TYPE } from "./numline";
import { COLMATH_TYPE, FMODEL_TYPE } from "./arith";
import { CHART_TYPE, DICE_TYPE, PTREE_TYPE, CPLANE_TYPE } from "./mathobj";
import { QUIZ_TYPE } from "./quiz";
import {
  ARC_TYPE, IMAGE_TYPE, PAGE_TYPE, PROTRACTOR_TYPE, RULER_TYPE, rotatePtsObj, withRotation,
} from "./extra";
import { marckScriptFamily, uiFont } from "./fonts";
import type {
  AngleObject, Bounds, BoxFields, EllipseObject, FormulaObject, GraphObject, LineObject, ObjectTypeDef, Point,
  PolygonObject, StrokeObject, TextFontId, TextObject, TypeRegistry,
} from "./types";

/**
 * Static fallback of the UI font family list. Canvas code should call `uiFont()` (./fonts),
 * which resolves the next/font family from `--font-comfortaa` at runtime.
 */
export const FONT = "Comfortaa, system-ui, sans-serif";

export interface TextFont {
  /** Display name for the font picker. */
  readonly name: string;
  /** CSS font-family list; resolved at read time for fonts loaded through next/font. */
  readonly css: string;
}

// Fonts for text objects (all support Cyrillic)
export const TEXT_FONTS: Record<TextFontId, TextFont> = {
  comfortaa: { name: "Comfortaa", get css() { return uiFont(); } },
  sans: { name: "Arial", css: "Arial, Helvetica, sans-serif" },
  serif: { name: "Times New Roman", css: '"Times New Roman", Times, serif' },
  georgia: { name: "Georgia", css: "Georgia, serif" },
  mono: { name: "Courier New", css: '"Courier New", Courier, monospace' },
  hand: { name: "Marck Script", get css() { return `${marckScriptFamily()}, cursive`; } },
};

export const isTextFontId = (v: unknown): v is TextFontId =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(TEXT_FONTS, v);

/** CSS font-family list for a text font id (Comfortaa for unknown ids). */
export const fontFamily = (id: unknown): string => (isTextFontId(id) ? TEXT_FONTS[id] : TEXT_FONTS.comfortaa).css;

/** Style fields that affect text font: italic, bold, font id. */
export interface FontStyle {
  i?: boolean;
  b?: boolean;
  ff?: string;
}

export const fontCss = (o: FontStyle | null | undefined, size: number): string =>
  `${o?.i ? "italic " : ""}${o?.b ? "700 " : "400 "}${size}px ${fontFamily(o?.ff)}`;
export const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let counter = 0;
export function uid(): string {
  const r = new Uint32Array(2);
  crypto.getRandomValues(r);
  return r[0].toString(36) + r[1].toString(36) + (counter++).toString(36);
}

type PtsObject = { pts: Point[] };

const pathCache = new WeakMap<StrokeObject, Path2D>();
const boundsCache = new WeakMap<PtsObject, Bounds>();
const box = (o: BoxFields): Bounds => ({ x: o.x, y: o.y, w: o.w, h: o.h });
const moveBox = <O extends { x: number; y: number }>(o: O, dx: number, dy: number): O => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) });
const movePts = <O extends PtsObject>(o: O, dx: number, dy: number): O => ({ ...o, pts: o.pts.map((p): Point => [round1(p[0] + dx), round1(p[1] + dy)]) });
const fitPts = <O extends PtsObject>(o: O, from: Bounds, to: Bounds): O => ({ ...o, pts: o.pts.map((p) => mapPoint(p, from, to)) });
const ptsBounds = (o: PtsObject): Bounds => {
  let b = boundsCache.get(o);
  if (!b) { b = boundsOfPoints(o.pts); boundsCache.set(o, b); }
  return b;
};
const MIN_SIDE = 4;
// Angles move / rotate without 0.1 px rounding, otherwise short rays drift (90° -> 90.1°).
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function strokePath(o: StrokeObject): Path2D {
  let p = pathCache.get(o);
  if (p) return p;
  p = new Path2D();
  const pts = o.pts;
  p.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) p.lineTo(pts[1][0], pts[1][1]);
  else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    p.lineTo(l[0], l[1]);
  }
  pathCache.set(o, p);
  return p;
}

const dashOf = (o: { dash?: boolean; s: number }): number[] => (o.dash ? [o.s * 3.2, o.s * 2.4] : []);

function drawLabels(ctx: CanvasRenderingContext2D, o: PolygonObject) {
  const labs = o.labs;
  if (!labs) return;
  const c = centroid(o.pts);
  ctx.save();
  ctx.font = 'italic 600 21px "Times New Roman", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1d1b2e";
  o.pts.forEach((p, i) => {
    const ch = labs[i];
    if (!ch) return;
    let dx = p[0] - c[0];
    let dy = p[1] - c[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    ctx.fillText(ch, p[0] + dx * (15 + o.s), p[1] + dy * (15 + o.s));
  });
  ctx.restore();
}

// ---------- freehand stroke (pen / highlighter) ----------
const STROKE_TYPE: ObjectTypeDef<StrokeObject> = {
  bounds: ptsBounds,
  draw(ctx, o) {
    ctx.save();
    ctx.strokeStyle = o.c;
    ctx.lineWidth = o.s;
    ctx.lineJoin = "round";
    ctx.lineCap = o.hl ? "butt" : "round";
    if (o.hl) { ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = "multiply"; }
    ctx.stroke(strokePath(o));
    ctx.restore();
  },
  hit(o, p, tol) {
    const r = tol + o.s / 2;
    if (!inBounds(ptsBounds(o), p, r)) return false;
    const pts = o.pts;
    if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= r;
    for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= r) return true;
    return false;
  },
  move: movePts,
  fit: fitPts,
  rotate: rotatePtsObj,
};

// ---------- segment / arrow ----------
const LINE_TYPE: ObjectTypeDef<LineObject> = {
  bounds: ptsBounds,
  draw(ctx, o) {
    const [a, b] = o.pts;
    ctx.save();
    ctx.strokeStyle = o.c;
    ctx.fillStyle = o.c;
    ctx.lineWidth = o.s;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dashOf(o));
    let end = b;
    let start = a;
    let head: Point[] | null = null;
    let head2: Point[] | null = null;
    if (o.arrow2) {
      const ang0 = Math.atan2(a[1] - b[1], a[0] - b[0]);
      const hl0 = 9 + o.s * 2.6;
      start = [a[0] - Math.cos(ang0) * hl0 * 0.8, a[1] - Math.sin(ang0) * hl0 * 0.8];
      head2 = [
        [a[0], a[1]],
        [a[0] - hl0 * Math.cos(ang0 - 0.42), a[1] - hl0 * Math.sin(ang0 - 0.42)],
        [a[0] - hl0 * Math.cos(ang0 + 0.42), a[1] - hl0 * Math.sin(ang0 + 0.42)],
      ];
    }
    if (o.arrow) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const hl = 9 + o.s * 2.6;
      end = [b[0] - Math.cos(ang) * hl * 0.8, b[1] - Math.sin(ang) * hl * 0.8];
      head = [
        [b[0], b[1]],
        [b[0] - hl * Math.cos(ang - 0.42), b[1] - hl * Math.sin(ang - 0.42)],
        [b[0] - hl * Math.cos(ang + 0.42), b[1] - hl * Math.sin(ang + 0.42)],
      ];
    }
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
    for (const h of [head, head2]) {
      if (!h) continue;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(h[0][0], h[0][1]);
      ctx.lineTo(h[1][0], h[1][1]);
      ctx.lineTo(h[2][0], h[2][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (o.lens || (o.lent !== undefined && o.lent !== null)) drawLength(ctx, a, b, null, o.lent);
  },
  hit: (o, p, tol) => distToSegment(p, o.pts[0], o.pts[1]) <= tol + o.s / 2,
  move: movePts,
  fit: fitPts,
  verts: (o) => o.pts,
  rotate: rotatePtsObj,
};

// ---------- ellipse / circle ----------
const ELLIPSE_TYPE: ObjectTypeDef<EllipseObject> = withRotation<EllipseObject>({
  bounds: box,
  draw(ctx, o) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.max(0.5, o.w / 2), Math.max(0.5, o.h / 2), 0, 0, Math.PI * 2);
    if (o.f) { ctx.globalAlpha = o.solid ? 1 : 0.18; ctx.fillStyle = o.f; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = o.c;
    ctx.lineWidth = o.s;
    ctx.setLineDash(dashOf(o));
    ctx.stroke();
    ctx.restore();
  },
  hit(o, p, tol) {
    const rx = o.w / 2 || 0.5;
    const ry = o.h / 2 || 0.5;
    const d = Math.hypot((p[0] - o.x - rx) / rx, (p[1] - o.y - ry) / ry);
    if (o.f && d <= 1) return true;
    return Math.abs(d - 1) * Math.min(rx, ry) <= tol + o.s / 2;
  },
  move: moveBox,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(MIN_SIDE, to.w)), h: round1(Math.max(MIN_SIDE, to.h)) }),
});

// ---------- polygon (rectangle, triangle, n-gon…) ----------
const POLYGON_TYPE: ObjectTypeDef<PolygonObject> = {
  bounds: ptsBounds,
  draw(ctx, o) {
    ctx.save();
    ctx.beginPath();
    o.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    if (o.f) { ctx.globalAlpha = 0.18; ctx.fillStyle = o.f; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = o.c;
    ctx.lineWidth = o.s;
    ctx.lineJoin = "round";
    ctx.setLineDash(dashOf(o));
    ctx.stroke();
    ctx.restore();
    if (o.marks) { ctx.save(); drawPolyMarks(ctx, o); ctx.restore(); }
    if (o.pts.length === 3) drawTriangleExtras(ctx, o);
    if (o.pts.length === 4) drawQuadExtras(ctx, o);
    if (o.circs) drawCircles(ctx, o);
    drawLabels(ctx, o);
    if (o.lens || o.angs || o.area || o.sidet || o.angt) drawMeasures(ctx, o);
  },
  hit(o, p, tol) {
    if (o.f && pointInPolygon(p, o.pts)) return true;
    const r = tol + o.s / 2;
    const n = o.pts.length;
    for (let i = 0; i < n; i++) if (distToSegment(p, o.pts[i], o.pts[(i + 1) % n]) <= r) return true;
    return false;
  },
  move: movePts,
  fit: fitPts,
  verts: (o) => o.pts,
  rotate: rotatePtsObj,
};

// ---------- angle: three points A, B (vertex), C ----------
const ANGLE_TYPE: ObjectTypeDef<AngleObject> = {
  bounds: ptsBounds,
  draw(ctx, o) {
    const [A, B, C] = o.pts;
    const a1 = Math.atan2(A[1] - B[1], A[0] - B[0]);
    const a2 = Math.atan2(C[1] - B[1], C[0] - B[0]);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const deg = Math.abs(d) * 180 / Math.PI;
    const l1 = Math.hypot(A[0] - B[0], A[1] - B[1]);
    const l2 = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const r = Math.max(8, Math.min(34, 0.35 * Math.min(l1, l2)));
    ctx.save();
    ctx.strokeStyle = o.c;
    ctx.lineWidth = o.s;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dashOf(o));
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1.4, o.s * 0.6);
    ctx.beginPath();
    if (Math.abs(deg - 90) < 0.6) {
      const u = [Math.cos(a1), Math.sin(a1)], v = [Math.cos(a2), Math.sin(a2)];
      const k = r * 0.7;
      ctx.moveTo(B[0] + u[0] * k, B[1] + u[1] * k);
      ctx.lineTo(B[0] + (u[0] + v[0]) * k, B[1] + (u[1] + v[1]) * k);
      ctx.lineTo(B[0] + v[0] * k, B[1] + v[1] * k);
    } else {
      ctx.arc(B[0], B[1], r, a1, a1 + d, d < 0);
    }
    ctx.stroke();
    ctx.restore();
    if (o.angs !== false) {
      const m = a1 + d / 2;
      const tr = r + 16;
      ctx.save();
      ctx.font = `600 15px ${uiFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      const txt = o.angt !== undefined && o.angt !== null && o.angt !== "" ? o.angt : `${fmtNum(deg)}°`;
      ctx.strokeText(txt, B[0] + Math.cos(m) * tr, B[1] + Math.sin(m) * tr);
      ctx.fillStyle = "#c2255c";
      ctx.fillText(txt, B[0] + Math.cos(m) * tr, B[1] + Math.sin(m) * tr);
      ctx.restore();
    }
    const labs = o.labs;
    if (labs) {
      ctx.save();
      ctx.font = 'italic 600 21px "Times New Roman", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#1d1b2e";
      const mid = a1 + d / 2;
      o.pts.forEach((p, i) => {
        const ch = labs[i];
        if (!ch) return;
        let dx, dy;
        if (i === 1) { dx = -Math.cos(mid); dy = -Math.sin(mid); }
        else { dx = p[0] - B[0]; dy = p[1] - B[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
        ctx.fillText(ch, p[0] + dx * (15 + o.s), p[1] + dy * (15 + o.s));
      });
      ctx.restore();
    }
  },
  hit(o, p, tol) {
    const r = tol + o.s / 2;
    return distToSegment(p, o.pts[0], o.pts[1]) <= r || distToSegment(p, o.pts[1], o.pts[2]) <= r;
  },
  // no 0.1 px rounding, so the angle value does not drift when moved
  move: <O extends PtsObject>(o: O, dx: number, dy: number): O => ({ ...o, pts: o.pts.map((p): Point => [r3(p[0] + dx), r3(p[1] + dy)]) }),
  fit: fitPts,
  verts: (o) => o.pts,
  rotate: <O extends PtsObject>(o: O, a: number, cx: number, cy: number): O => {
    const c = Math.cos(a), s = Math.sin(a);
    return { ...o, pts: o.pts.map(([x, y]): Point => [r3(cx + (x - cx) * c - (y - cy) * s), r3(cy + (x - cx) * s + (y - cy) * c)]) };
  },
};

// ---------- text ----------
const TEXT_TYPE: ObjectTypeDef<TextObject> = withRotation<TextObject>({
  bounds: box,
  draw(ctx, o, env) {
    if (env.hideId === o.id) return;
    ctx.save();
    ctx.font = fontCss(o, o.fs);
    ctx.fillStyle = o.c;
    ctx.textBaseline = "top";
    o.text.split("\n").forEach((line, i) => ctx.fillText(line, o.x + 2, o.y + i * o.fs * 1.3));
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds(box(o), p, tol),
  move: moveBox,
  fit(o, from, to) {
    const sx = from.w ? to.w / from.w : 1;
    const sy = from.h ? to.h / from.h : 1;
    const k = Math.max(0.2, Math.sqrt(sx * sy));
    return { ...o, x: round1(to.x), y: round1(to.y), fs: round1(Math.max(8, o.fs * k)), w: round1(o.w * k), h: round1(o.h * k) };
  },
});

// ---------- formula (rendered as a MathLive DOM element) ----------
const FORMULA_TYPE: ObjectTypeDef<FormulaObject> = withRotation<FormulaObject>({
  dom: true,
  bounds: box,
  draw() {},
  hit: (o, p, tol) => inBounds(box(o), p, tol),
  move: moveBox,
  fit(o, from, to) {
    const sx = from.w ? to.w / from.w : 1;
    const sy = from.h ? to.h / from.h : 1;
    const k = Math.max(0.2, Math.sqrt(sx * sy));
    return { ...o, x: round1(to.x), y: round1(to.y), fs: round1(Math.max(10, o.fs * k)), w: round1(o.w * k), h: round1(o.h * k) };
  },
});

// ---------- graph / coordinate plane ----------
const GRAPH_TYPE: ObjectTypeDef<GraphObject> = {
  dom: true,
  interactive: true,
  bounds: box,
  draw: drawGraph,
  hit: (o, p) => inBounds(box(o), p, 0),
  move: moveBox,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(160, to.w)), h: round1(Math.max(120, to.h)) }),
};

export const T: TypeRegistry = {
  stroke: STROKE_TYPE,
  line: LINE_TYPE,
  ellipse: ELLIPSE_TYPE,
  polygon: POLYGON_TYPE,
  angle: ANGLE_TYPE,
  text: TEXT_TYPE,
  formula: FORMULA_TYPE,
  graph: GRAPH_TYPE,
  solid: SOLID_TYPE,
  image: IMAGE_TYPE,
  arc: ARC_TYPE,
  ruler: RULER_TYPE,
  protractor: PROTRACTOR_TYPE,
  page: PAGE_TYPE,
  comment: COMMENT_TYPE,
  poll: POLL_TYPE,
  timer: TIMER_TYPE,
  task: TASK_TYPE,
  stamp: STAMP_TYPE,
  trig: TRIG_TYPE,
  numline: NUMLINE_TYPE,
  colmath: COLMATH_TYPE,
  fmodel: FMODEL_TYPE,
  chart: CHART_TYPE,
  dice: DICE_TYPE,
  ptree: PTREE_TYPE,
  cplane: CPLANE_TYPE,
  vote: hiddenType(),
  flag: hiddenType(),
  answer: hiddenType(),
  score: hiddenType(),
  quiz: QUIZ_TYPE,
};

// ---------- polygon factories from a frame ----------
export const rectPoints = (b: Bounds): Point[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
export const triPoints = (b: Bounds): Point[] => [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
// right angle at vertex C (the third)
export const rightTriPoints = (b: Bounds): Point[] => [[b.x, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
export const scaleneTriPoints = (b: Bounds): Point[] => [[b.x, b.y + b.h], [b.x + b.w * 0.34, b.y], [b.x + b.w, b.y + b.h * 0.86]];
export const trapezoidPoints = (b: Bounds): Point[] => [[b.x + b.w * 0.22, b.y], [b.x + b.w * 0.78, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
export const parallelogramPoints = (b: Bounds): Point[] => [[b.x + b.w * 0.25, b.y], [b.x + b.w, b.y], [b.x + b.w * 0.75, b.y + b.h], [b.x, b.y + b.h]];
export function regularPoints(n: number, b: Bounds): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    pts.push([b.x + b.w / 2 + (Math.cos(a) * b.w) / 2, b.y + b.h / 2 + (Math.sin(a) * b.h) / 2]);
  }
  return pts;
}

// Quadrilaterals: A is bottom-left, then clockwise on screen: B top-left, C top-right, D bottom-right.
export function quadPoints(kind: string, b: Bounds): Point[] {
  const { x, y, w, h } = b;
  const P = (px: number, py: number): Point => [x + w * px, y + h * py];
  switch (kind) {
    case "q_square":
    case "q_rect": return [P(0, 1), P(0, 0), P(1, 0), P(1, 1)];
    case "q_rhombus": return [P(0, 0.5), P(0.5, 0), P(1, 0.5), P(0.5, 1)];
    case "q_para": return [P(0, 1), P(0.25, 0), P(1, 0), P(0.75, 1)];
    case "q_trap_iso": return [P(0, 1), P(0.22, 0), P(0.78, 0), P(1, 1)];
    case "q_trap_right": return [P(0, 1), P(0, 0), P(0.62, 0), P(1, 1)];
    case "q_trap": return [P(0, 1), P(0.16, 0), P(0.6, 0), P(1, 1)];
    default: return [P(0, 0.82), P(0.2, 0), P(1, 0.18), P(0.78, 1)];
  }
}

// ---------- text measurement ----------
let mctx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, fs: number, style?: FontStyle | null): { w: number; h: number } {
  if (!mctx) mctx = document.createElement("canvas").getContext("2d");
  if (!mctx) throw new Error("2D canvas context is unavailable");
  mctx.font = fontCss(style, fs);
  const lines = String(text).split("\n");
  let w = 0;
  for (const l of lines) w = Math.max(w, mctx.measureText(l).width);
  return { w: Math.ceil(w) + 6, h: Math.ceil(lines.length * fs * 1.3) + 2 };
}
