// Construction tools, vector operations, points and brackets. All of them create ordinary objects
// (line / stroke / ellipse), so the result can be moved, recoloured and deleted as usual.
import { distToSegment, round1 } from "./geom";
import { T } from "./shapes";
import type { MathBoard } from "./board";
import type { Tool } from "./tools";
import type {
  BoardObject, DrawEnv, EllipseObject, LineObject, ObjectDraft, ObjectTypeDef, Point, StrokeObject,
} from "./types";

/** Style the builders read from the board. */
interface St {
  c: string;
  s: number;
  dash: boolean;
}

/** A picked segment (line or polygon side). */
interface Seg {
  a: Point;
  b: Point;
}

type Draft = ObjectDraft<LineObject | StrokeObject | EllipseObject>;
type LineExtra = Partial<Pick<LineObject, "c" | "s" | "dash" | "arrow">>;

/** Tool previews draw drafts (no id/z yet); draw functions never read those fields. */
function drawDraft(ctx: CanvasRenderingContext2D, o: ObjectDraft, env: DrawEnv): void {
  const def: ObjectTypeDef = T[o.type];
  def.draw(ctx, o as BoardObject, env);
}

const RED = "#e03131";
const rp = (q: Point): Point => [round1(q[0]), round1(q[1])];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const len = (a: Point): number => Math.hypot(a[0], a[1]);
const unit = (a: Point): Point => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const rot = (a: Point, t: number): Point => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];

const base = (b: MathBoard): St => ({ c: b.style.c, s: b.style.s, dash: b.style.dash });
const seg = (a: Point, c: Point, st: St, extra: LineExtra = {}): ObjectDraft<LineObject> =>
  ({ type: "line", pts: [rp(a), rp(c)], arrow: false, c: st.c, s: st.s, dash: false, ...extra });
const poly = (pts: Point[], st: St): ObjectDraft<StrokeObject> =>
  ({ type: "stroke", pts: pts.map(rp), c: st.c, s: Math.max(2, st.s * 0.8), hl: false });
const dot = (p: Point, st: St, filled: boolean): ObjectDraft<EllipseObject> => {
  const r = filled ? 5 : 6;
  return { type: "ellipse", x: round1(p[0] - r), y: round1(p[1] - r), w: r * 2, h: r * 2, c: st.c, s: filled ? 4 : 2.5, f: filled ? st.c : null, solid: filled, dash: false };
};
const circle = (c: Point, r: number, st: St): ObjectDraft<EllipseObject> =>
  ({ type: "ellipse", x: round1(c[0] - r), y: round1(c[1] - r), w: round1(2 * r), h: round1(2 * r), c: st.c, s: st.s, f: null, dash: false });

const bezier = (p0: Point, p1: Point, p2: Point, p3: Point, n = 14): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
};
const headOf = (tip: Point, dir: Point, size: number, st: St) =>
  poly([sub(tip, mul(rot(dir, 0.45), size)), tip, sub(tip, mul(rot(dir, -0.45), size))], st);

// ---------- constructions ----------
const midpoint = ([A, B]: Point[], st: St): Draft[] => {
  const M = mul(add(A, B), 0.5);
  const n = unit([-(B[1] - A[1]), B[0] - A[0]]);
  const tick = (T0: Point) => seg(sub(T0, mul(n, 6)), add(T0, mul(n, 6)), st, { s: Math.max(2, st.s * 0.7) });
  return [dot(M, st, true), tick(mul(add(A, M), 0.5)), tick(mul(add(M, B), 0.5))];
};

const bisector = ([A, Bv, C]: Point[], st: St): Draft[] => {
  const u = unit(sub(A, Bv)), v = unit(sub(C, Bv));
  let w = add(u, v);
  if (len(w) < 1e-3) w = [-u[1], u[0]];
  w = unit(w);
  const L = Math.max(90, Math.max(len(sub(A, Bv)), len(sub(C, Bv))) * 1.1);
  const a1 = Math.atan2(u[1], u[0]), a2 = Math.atan2(v[1], v[0]);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const r = Math.max(16, Math.min(34, Math.min(len(sub(A, Bv)), len(sub(C, Bv))) * 0.3));
  const arc = (s0: number, s1: number) => poly(Array.from({ length: 13 }, (_, i): Point => { const t = s0 + ((s1 - s0) * i) / 12; return [Bv[0] + r * Math.cos(t), Bv[1] + r * Math.sin(t)]; }), st);
  return [seg(Bv, add(Bv, mul(w, L)), st), arc(a1, a1 + d / 2), arc(a1 + d / 2, a1 + d)];
};

const circle3 = ([A, B, C]: Point[], st: St): Draft[] => {
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  if (Math.abs(d) < 1e-6) return [];
  const a2 = A[0] ** 2 + A[1] ** 2, b2 = B[0] ** 2 + B[1] ** 2, c2 = C[0] ** 2 + C[1] ** 2;
  const O: Point = [(a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d, (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d];
  return [circle(O, len(sub(A, O)), st), dot(O, st, true)];
};

const incircle = ([A, B, C]: Point[], st: St): Draft[] => {
  const a = len(sub(B, C)), b = len(sub(A, C)), c = len(sub(A, B));
  const p = a + b + c;
  if (p < 1e-6) return [];
  const I: Point = [(a * A[0] + b * B[0] + c * C[0]) / p, (a * A[1] + b * B[1] + c * C[1]) / p];
  const area2 = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]));
  if (area2 < 1e-6) return [];
  return [circle(I, area2 / p, st), dot(I, st, true)];
};

// ---------- points, arrows, brackets (2 clicks: A, B) ----------
const frame = (A: Point, B: Point) => {
  const d = sub(B, A);
  const L = len(d) || 1;
  const e: Point = [d[0] / L, d[1] / L];
  const n: Point = [e[1], -e[0]];
  return { L, e, n, at: (x: number, y: number) => add(add(A, mul(e, x)), mul(n, y)) };
};

const brace = ([A, B]: Point[], st: St): Draft[] => {
  const { L, at } = frame(A, B);
  const h = Math.max(10, Math.min(26, L * 0.14));
  const left = bezier(at(0, 0), at(0, h * 0.75), at(L * 0.5, h * 0.25), at(L * 0.5, h));
  const right = bezier(at(L * 0.5, h), at(L * 0.5, h * 0.25), at(L, h * 0.75), at(L, 0)).slice(1);
  return [poly([...left, ...right], st)];
};

const curvedArrow = ([A, B]: Point[], st: St): Draft[] => {
  const { L, at } = frame(A, B);
  const h = L * 0.35;
  const pts = bezier(A, at(L * 0.2, h), at(L * 0.8, h), B, 20);
  const dir = unit(sub(pts[pts.length - 1], pts[pts.length - 3]));
  return [poly(pts, st), headOf(B, dir, 12, st)];
};

const cornerArrow = ([A, B]: Point[], st: St): Draft[] => {
  const K: Point = [A[0], B[1]];
  const dir = unit(sub(B, K));
  return [poly([A, K, B], st), headOf(B, dir[0] === 0 && dir[1] === 0 ? [1, 0] : dir, 12, st)];
};

const bracket = ([A, B]: Point[], st: St): Draft[] => {
  const { L, at } = frame(A, B);
  const h = Math.max(10, L * 0.25);
  return [poly(Array.from({ length: 25 }, (_, i) => { const t = (i / 24) * Math.PI; return at((L / 2) * (1 - Math.cos(t)), h * Math.sin(t)); }), st)];
};

// ---------- marks: equal segments, parallel, equal and right angles ----------
const eqTicks = (n: number) => ({ a, b }: Seg, st: St): Draft[] => {
  const M = mul(add(a, b), 0.5);
  const e = unit(sub(b, a));
  const nrm: Point = [-e[1], e[0]];
  return Array.from({ length: n }, (_, i) => {
    const T0 = add(M, mul(e, (i - (n - 1) / 2) * 6));
    return seg(sub(T0, mul(nrm, 7)), add(T0, mul(nrm, 7)), st, { s: Math.max(2, st.s * 0.8) });
  });
};
const parMarks = (n: number) => ({ a, b }: Seg, st: St): Draft[] => {
  const M = mul(add(a, b), 0.5);
  const e = unit(sub(b, a));
  return Array.from({ length: n }, (_, i) => {
    const T0 = add(M, mul(e, (i - (n - 1) / 2) * 9));
    return poly([sub(T0, add(mul(e, 4), mul([-e[1], e[0]], -6))), add(T0, mul(e, 4)), sub(T0, add(mul(e, 4), mul([-e[1], e[0]], 6)))], st);
  });
};
const angleArcs = (n: number) => ([A, V, C]: Point[], st: St): Draft[] => {
  const u = unit(sub(A, V)), v = unit(sub(C, V));
  const a1 = Math.atan2(u[1], u[0]);
  let d = Math.atan2(v[1], v[0]) - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const r0 = Math.max(16, Math.min(32, Math.min(len(sub(A, V)), len(sub(C, V))) * 0.3));
  return Array.from({ length: n }, (_, i) => poly(Array.from({ length: 14 }, (__, j): Point => {
    const t = a1 + (d * j) / 13;
    return [V[0] + (r0 + i * 5) * Math.cos(t), V[1] + (r0 + i * 5) * Math.sin(t)];
  }), st));
};
const rightAngle = ([A, V, C]: Point[], st: St): Draft[] => {
  const u = unit(sub(A, V)), v = unit(sub(C, V));
  const s = Math.max(10, Math.min(18, Math.min(len(sub(A, V)), len(sub(C, V))) * 0.3));
  return [poly([add(V, mul(u, s)), add(V, mul(add(u, v), s)), add(V, mul(v, s))], st)];
};

function sidesOf(o: BoardObject): Seg[] {
  if (o.type === "line") return [{ a: o.pts[0], b: o.pts[1] }];
  if (o.type === "polygon") return o.pts.map((q, k) => ({ a: q, b: o.pts[(k + 1) % o.pts.length] }));
  return [];
}
function pickSide(b: MathBoard, p: Point, tol: number): Seg | null {
  const list: BoardObject[] = b.objs();
  for (let i = list.length - 1; i >= 0; i--) {
    for (const sd of sidesOf(list[i])) if (distToSegment(p, sd.a, sd.b) <= tol + (list[i].s || 2) / 2) return sd;
  }
  return null;
}
/** "Click a side / segment" tool. */
function sideTool(b: MathBoard, build: (sd: Seg, st: St) => Draft[]): Tool {
  return {
    cursor: "crosshair",
    down(p) {
      const sd = pickSide(b, p, 10 / b.cam.z);
      if (!sd) return;
      b.addObjs(build(sd, base(b)), true);
    },
    move() { b.requestOverlay(); },
    hover() { b.requestOverlay(); return "crosshair"; },
    up() {},
    overlay(ctx) {
      const sd = b.hover && pickSide(b, b.hover, 10 / b.cam.z);
      if (!sd) return;
      ctx.save();
      ctx.strokeStyle = "#6d3df0"; ctx.globalAlpha = 0.35; ctx.lineWidth = 7 / b.cam.z; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sd.a[0], sd.a[1]); ctx.lineTo(sd.b[0], sd.b[1]); ctx.stroke();
      ctx.restore();
    },
  };
}

// ---------- generic "several clicks" tool ----------
function seqTool(b: MathBoard, n: number, build: (pts: Point[], st: St) => Draft[]): Tool {
  let pts: Point[] = [];
  const reset = () => { pts = []; b.requestOverlay(); };
  return {
    cursor: "crosshair",
    activate() { pts = []; },
    down(p) {
      pts.push(b.snapPoint(p));
      if (pts.length === n) {
        const objs = build(pts, base(b));
        pts = [];
        if (objs.length) b.addObjs(objs, true);
        b.requestRender();
      } else b.requestOverlay();
    },
    move() { if (pts.length) b.requestOverlay(); },
    hover() { if (pts.length) b.requestOverlay(); return "crosshair"; },
    up() {},
    cancel: reset,
    key(e) { if (e.key === "Escape" && pts.length) { reset(); return true; } return false; },
    overlay(ctx) {
      if (!pts.length) return;
      const z = b.cam.z;
      ctx.save();
      if (b.hover && pts.length === n - 1) {
        ctx.globalAlpha = 0.55;
        for (const o of build([...pts, b.snapPoint(b.hover)], base(b))) drawDraft(ctx, o, { zoom: z });
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#6d3df0";
      for (const q of pts) { ctx.beginPath(); ctx.arc(q[0], q[1], 4 / z, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    },
  };
}

// ---------- pick an existing triangle for the incircle / circumcircle ----------
function inTri(p: Point, [A, B, C]: Point[]): boolean {
  const s = (P: Point, Q: Point, R: Point) => (P[0] - R[0]) * (Q[1] - R[1]) - (Q[0] - R[0]) * (P[1] - R[1]);
  const d1 = s(p, A, B), d2 = s(p, B, C), d3 = s(p, C, A);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const pickTriangle = (b: MathBoard, p: Point, tol: number): Point[] | null => {
  const list: BoardObject[] = b.objs();
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (o.type !== "polygon" || o.pts.length !== 3) continue;
    const near = o.pts.some((q, k) => distToSegment(p, q, o.pts[(k + 1) % 3]) <= tol);
    if (near || inTri(p, o.pts)) return o.pts;
  }
  return null;
};

function triTool(b: MathBoard, build: (tri: Point[], st: St) => Draft[]): Tool {
  return {
    cursor: "crosshair",
    down(p) {
      const tri = pickTriangle(b, p, 10 / b.cam.z);
      if (!tri) return;
      const objs = build(tri, base(b));
      if (objs.length) b.addObjs(objs, true);
    },
    move() { b.requestOverlay(); },
    hover(p) { b.requestOverlay(); return pickTriangle(b, p, 10 / b.cam.z) ? "pointer" : "crosshair"; },
    up() {},
    overlay(ctx) {
      if (!b.hover) return;
      const t = pickTriangle(b, b.hover, 10 / b.cam.z);
      if (!t) return;
      ctx.save();
      ctx.strokeStyle = "#6d3df0";
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 7 / b.cam.z;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(t[0][0], t[0][1]); ctx.lineTo(t[1][0], t[1][1]); ctx.lineTo(t[2][0], t[2][1]); ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },
  };
}

// ---------- vector operations: pick 1–2 segments/arrows, then (if needed) click ----------
function pickLine(b: MathBoard, p: Point, tol: number): Seg | null {
  const list: BoardObject[] = b.objs();
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (o.type === "line" && distToSegment(p, o.pts[0], o.pts[1]) <= tol + o.s / 2) return { a: o.pts[0], b: o.pts[1] };
  }
  return null;
}

interface VectorBuilder {
  picks: number;
  /** After picking, one more click sets the point the result starts from. */
  click?: boolean;
  build(got: Seg[], q: Point | undefined, st: St): Draft[];
}

function vecTool(b: MathBoard, { picks, click, build }: VectorBuilder): Tool & { vec(g: Seg): Point } {
  let got: Seg[] = [];
  const reset = () => { got = []; b.requestOverlay(); };
  const vec = (g: Seg) => sub(g.b, g.a);
  const make = (q?: Point) => build(got, q, base(b));
  return {
    cursor: "crosshair",
    activate() { got = []; },
    down(p) {
      if (got.length < picks) {
        const g = pickLine(b, p, 12 / b.cam.z);
        if (!g) return;
        got.push(g);
        if (got.length === picks && !click) { const objs = make(); got = []; if (objs.length) b.addObjs(objs, true); }
        b.requestOverlay();
        return;
      }
      const objs = make(b.snapPoint(p));
      got = [];
      if (objs.length) b.addObjs(objs, true);
      b.requestOverlay();
    },
    move() { b.requestOverlay(); },
    hover() { b.requestOverlay(); return "crosshair"; },
    up() {},
    cancel: reset,
    key(e) { if (e.key === "Escape" && got.length) { reset(); return true; } return false; },
    overlay(ctx) {
      const z = b.cam.z;
      const hl = (g: Seg, a: number) => {
        ctx.save();
        ctx.strokeStyle = "#6d3df0"; ctx.globalAlpha = a; ctx.lineWidth = 7 / z; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(g.a[0], g.a[1]); ctx.lineTo(g.b[0], g.b[1]); ctx.stroke();
        ctx.restore();
      };
      got.forEach((g) => hl(g, 0.55));
      if (got.length < picks) { const h = b.hover && pickLine(b, b.hover, 12 / z); if (h) hl(h, 0.3); }
      else if (click && b.hover) {
        ctx.save(); ctx.globalAlpha = 0.6;
        for (const o of make(b.snapPoint(b.hover))) drawDraft(ctx, o, { zoom: z });
        ctx.restore();
      }
    },
    vec,
  };
}

const arrow = (a: Point, c: Point, st: St, extra: LineExtra = {}) => seg(a, c, st, { arrow: true, ...extra });
const thin = (st: St) => ({ s: Math.max(2, st.s * 0.7) });

const VECTOR_BUILDERS: Record<string, VectorBuilder> = {
  // place a copy of the vector at a point
  vcopy: { picks: 1, click: true, build: ([v], q, st) => (q ? [arrow(q, add(q, sub(v.b, v.a)), st)] : []) },
  // sum: triangle rule
  vsum_t: {
    picks: 2,
    build: ([v1, v2], _q, st) => {
      const P = v1.b, Q = add(P, sub(v2.b, v2.a));
      return [arrow(P, Q, st, { dash: true, ...thin(st) }), arrow(v1.a, Q, st, { c: RED })];
    },
  },
  // sum: parallelogram rule
  vsum_p: {
    picks: 2,
    build: ([v1, v2], _q, st) => {
      const O = v1.a, a = sub(v1.b, v1.a), c = sub(v2.b, v2.a);
      const S = add(add(O, a), c);
      return [seg(add(O, a), S, st, { dash: true, ...thin(st) }), seg(add(O, c), S, st, { dash: true, ...thin(st) }), arrow(O, S, st, { c: RED })];
    },
  },
  // difference v1 − v2
  vdiff: {
    picks: 2,
    build: ([v1, v2], _q, st) => {
      const O = v1.a, P1 = v1.b, P2 = add(O, sub(v2.b, v2.a));
      return [arrow(O, P2, st, { dash: true, ...thin(st) }), arrow(P2, P1, st, { c: RED })];
    },
  },
  // vector × number: the number is asked after the vector is picked
  vscale: {
    picks: 1,
    build: ([v], _q, st) => {
      const raw = typeof window !== "undefined" ? window.prompt("На яке число помножити вектор? (наприклад 2 або −0,5)", "2") : null;
      const k = parseFloat(String(raw ?? "").replace("−", "-").replace(",", "."));
      if (!isFinite(k) || k === 0) return [];
      return [arrow(v.a, add(v.a, mul(sub(v.b, v.a), k)), st, { c: RED })];
    },
  },
};

const dotTool = (b: MathBoard, filled: boolean): Tool => ({
  cursor: "crosshair",
  down(p) { b.addObjs([dot(b.snapPoint(p), base(b), filled)]); },
  move() {},
  up() {},
});

export function createConstrTools(b: MathBoard): Record<string, Tool> {
  const tools: Record<string, Tool> = {
    dot: dotTool(b, true),
    odot: dotTool(b, false),
    brace: seqTool(b, 2, brace),
    curvearr: seqTool(b, 2, curvedArrow),
    cornerarr: seqTool(b, 2, cornerArrow),
    bracket: seqTool(b, 2, bracket),
    midpt: seqTool(b, 2, midpoint),
    bisect: seqTool(b, 3, bisector),
    circ3: seqTool(b, 3, circle3),
    circum: triTool(b, circle3),
    incirc: triTool(b, incircle),
    eqs1: sideTool(b, eqTicks(1)),
    eqs2: sideTool(b, eqTicks(2)),
    eqs3: sideTool(b, eqTicks(3)),
    par1: sideTool(b, parMarks(1)),
    par2: sideTool(b, parMarks(2)),
    eqa1: seqTool(b, 3, angleArcs(1)),
    eqa2: seqTool(b, 3, angleArcs(2)),
    rang: seqTool(b, 3, rightAngle),
  };
  for (const [name, cfg] of Object.entries(VECTOR_BUILDERS)) tools[name] = vecTool(b, cfg);
  return tools;
}
