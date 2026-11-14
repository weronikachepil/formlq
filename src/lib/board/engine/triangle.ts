// Triangle constructions (altitude, median, bisector, midline, perpendicular bisector)
// and polygon marks (right angles, equal sides). Everything is recomputed from the vertices,
// so constructions follow the triangle when its vertices are dragged.
import { uiFont } from "./fonts";
import type {
  Point, PolygonConstruction, PolygonObject, QuadConsKind, QuadConstruction, TriangleConsKind,
  TriangleConstruction,
} from "./types";

type CentreKind = Exclude<TriangleConsKind, "mid">;

export const CONS_KINDS: { k: TriangleConsKind; name: string; color: string; by: "vertex" | "apex" | "side" }[] = [
  { k: "alt", name: "Висота", color: "#e8590c", by: "vertex" },
  { k: "med", name: "Медіана", color: "#2f9e44", by: "vertex" },
  { k: "bis", name: "Бісектриса", color: "#c2255c", by: "vertex" },
  { k: "mid", name: "Середня лінія", color: "#0c8599", by: "apex" },
  { k: "perp", name: "Серединний перпендикуляр", color: "#7048e8", by: "side" },
];
const COLOR = Object.fromEntries(CONS_KINDS.map((c) => [c.k, c.color])) as Record<TriangleConsKind, string>;

// Default letters: altitudes AD, BE, CF; medians AM, BN, CK; bisectors AL…
const LETTERS: Record<TriangleConsKind, string[]> = {
  alt: ["D", "E", "F"],
  med: ["M", "N", "K"],
  bis: ["L", "L₁", "L₂"],
  mid: ["MN", "KL", "RS"],
  perp: ["P", "Q", "R"],
};
const CENTER: Record<CentreKind, string> = { alt: "H", med: "G", bis: "I", perp: "O" };
export const CENTER_NAMES: Record<CentreKind, string> = { alt: "Ортоцентр", med: "Центр мас", bis: "Центр вписаного кола", perp: "Центр описаного кола" };

const isTriCons = (c: PolygonConstruction): c is TriangleConstruction =>
  c.k === "alt" || c.k === "med" || c.k === "bis" || c.k === "mid" || c.k === "perp";
const isQuadCons = (c: PolygonConstruction): c is QuadConstruction =>
  c.k === "diag" || c.k === "qalt" || c.k === "qmid" || c.k === "qbis";

export function consTitle(c: PolygonConstruction, labs?: string | null): string {
  const v = (i: number) => labs?.[i] || "ABC"[i];
  if (c.k === "ctr") return CENTER_NAMES[c.of];
  if (c.k === "alt") return `Висота з ${v(c.i)}`;
  if (c.k === "med") return `Медіана з ${v(c.i)}`;
  if (c.k === "bis") return `Бісектриса кута ${v(c.i)}`;
  if (c.k === "mid") return `Середня лінія ∥ ${v((c.i + 1) % 3)}${v((c.i + 2) % 3)}`;
  return `Сер. перпендикуляр до ${v(c.i)}${v((c.i + 1) % 3)}`;
}

export function toggleCons(cons: PolygonConstruction[] = [], k: TriangleConsKind, i: number): PolygonConstruction[] {
  const has = cons.findIndex((c) => isTriCons(c) && c.k === k && c.i === i);
  if (has >= 0) return cons.filter((_, j) => j !== has);
  const n = cons.filter((c) => c.k === k).length;
  return [...cons, { k, i, lab: LETTERS[k][Math.min(n, 2)] }];
}

/** Adds all three constructions of one kind plus their intersection point. */
export function addAll(cons: PolygonConstruction[] = [], k: TriangleConsKind): PolygonConstruction[] {
  const out = cons.filter((c) => !(c.k === k || (c.k === "ctr" && c.of === k)));
  const old = cons.filter((c): c is TriangleConstruction => isTriCons(c) && c.k === k);
  for (let i = 0; i < 3; i++) out.push(old.find((c) => c.i === i) || { k, i, lab: LETTERS[k][i] });
  if (k !== "mid") out.push(cons.find((c) => c.k === "ctr" && c.of === k) || { k: "ctr", of: k, lab: CENTER[k] });
  return out;
}

export function clearKind(cons: PolygonConstruction[] = [], k: TriangleConsKind): PolygonConstruction[] {
  return cons.filter((c) => !(c.k === k || (c.k === "ctr" && c.of === k)));
}

// ---------- vectors ----------
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1];
const len = (a: Point): number => Math.hypot(a[0], a[1]);
const unit = (a: Point): Point => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const perp = (a: Point): Point => [-a[1], a[0]];

/** Foot of the perpendicular from V to line BC; t is its position along B→C. */
function foot(V: Point, B: Point, C: Point): { H: Point; t: number } {
  const d = sub(C, B);
  const t = dot(sub(V, B), d) / (dot(d, d) || 1);
  return { H: add(B, mul(d, t)), t };
}

function circumcenter([A, B, C]: Point[]): Point | null {
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = dot(A, A), b2 = dot(B, B), c2 = dot(C, C);
  return [
    (a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d,
    (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d,
  ];
}

function centerPoint(of: CentreKind, P: Point[]): Point | null {
  const [A, B, C] = P;
  if (of === "med") return [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  if (of === "bis") {
    const a = len(sub(B, C)), b = len(sub(A, C)), c = len(sub(A, B));
    const s = a + b + c || 1;
    return [(a * A[0] + b * B[0] + c * C[0]) / s, (a * A[1] + b * B[1] + c * C[1]) / s];
  }
  const O = circumcenter(P);
  if (!O) return null;
  if (of === "perp") return O;
  return [A[0] + B[0] + C[0] - 2 * O[0], A[1] + B[1] + C[1] - 2 * O[1]]; // orthocentre
}

// ---------- drawing primitives ----------
function text(ctx: CanvasRenderingContext2D, str: string, p: Point, from: Point, color = "#1d1b2e", dist = 15) {
  const dir = unit(sub(p, from));
  ctx.save();
  ctx.font = 'italic 600 19px "Times New Roman", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, p[0] + dir[0] * dist, p[1] + dir[1] * dist);
  ctx.restore();
}

function dotAt(ctx: CanvasRenderingContext2D, p: Point, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p[0], p[1], 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function rightMark(ctx: CanvasRenderingContext2D, P: Point, u: Point, v: Point, s: number) {
  ctx.beginPath();
  ctx.moveTo(P[0] + u[0] * s, P[1] + u[1] * s);
  ctx.lineTo(P[0] + (u[0] + v[0]) * s, P[1] + (u[1] + v[1]) * s);
  ctx.lineTo(P[0] + v[0] * s, P[1] + v[1] * s);
  ctx.stroke();
}

function ticks(ctx: CanvasRenderingContext2D, p: Point, dir: Point, n: number) {
  const nrm = perp(unit(dir));
  const along = unit(dir);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 5;
    const q = add(p, mul(along, off));
    ctx.beginPath();
    ctx.moveTo(q[0] + nrm[0] * 6, q[1] + nrm[1] * 6);
    ctx.lineTo(q[0] - nrm[0] * 6, q[1] - nrm[1] * 6);
    ctx.stroke();
  }
}

function angleArc(ctx: CanvasRenderingContext2D, V: Point, from: number, to: number, r: number, count: number) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(V[0], V[1], r + i * 5, from, from + d, d < 0);
    ctx.stroke();
  }
}

function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point, dash: boolean) {
  ctx.save();
  if (dash) ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.restore();
}

// Intersection of the ray M + t·dir with the side segments; the smallest t > eps.
function rayExit(M: Point, dir: Point, P: Point[], skip: number): number {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    if (i === skip) continue;
    const A = P[i], B = P[(i + 1) % 3];
    const e = sub(B, A);
    const den = dir[0] * e[1] - dir[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const w = sub(A, M);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const s = (w[0] * dir[1] - w[1] * dir[0]) / den;
    if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && t < best) best = t;
  }
  return Number.isFinite(best) ? best : 0;
}

// ---------- constructions ----------
export function drawTriangleExtras(ctx: CanvasRenderingContext2D, o: PolygonObject): void {
  const P = o.pts;
  const cons = o.cons;
  if (P.length !== 3 || !cons?.length) return;
  const cen: Point = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
  const lw = Math.max(1.6, o.s * 0.75);
  const sq = (a: Point, b: Point) => Math.min(13, 0.22 * Math.min(len(a), len(b)));
  const count = (k: TriangleConsKind) => cons.filter((c) => c.k === k).length;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;

  for (const c of cons) {
    if (c.k === "ctr") {
      const col = COLOR[c.of];
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      if (count(c.of) < 3) continue;
      const Q = centerPoint(c.of, P);
      if (!Q) continue;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(Q[0], Q[1], 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (c.lab) text(ctx, c.lab, Q, cen, col, 14);
      continue;
    }
    if (!isTriCons(c)) continue;
    const col = COLOR[c.k];
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    const i = c.i;
    const V = P[i], B = P[(i + 1) % 3], C = P[(i + 2) % 3];

    if (c.k === "alt") {
      const { H, t } = foot(V, B, C);
      segment(ctx, V, H, false);
      if (t < 0) segment(ctx, B, H, true);
      else if (t > 1) segment(ctx, C, H, true);
      const u = unit(sub(t < 0 ? B : t > 1 ? C : mid(B, C), H));
      const v = unit(sub(V, H));
      ctx.lineWidth = lw * 0.8;
      rightMark(ctx, H, len(sub(mid(B, C), H)) < 1e-6 ? unit(sub(C, B)) : u, v, sq(sub(V, H), sub(C, B)));
      ctx.lineWidth = lw;
      dotAt(ctx, H, col);
      if (c.lab) text(ctx, c.lab, H, cen, col);
    } else if (c.k === "med") {
      const M = mid(B, C);
      segment(ctx, V, M, false);
      ctx.lineWidth = lw * 0.8;
      ticks(ctx, mid(B, M), sub(C, B), 1);
      ticks(ctx, mid(M, C), sub(C, B), 1);
      ctx.lineWidth = lw;
      dotAt(ctx, M, col);
      if (c.lab) text(ctx, c.lab, M, cen, col);
    } else if (c.k === "bis") {
      const b = len(sub(B, V)), cc = len(sub(C, V));
      const L = add(B, mul(sub(C, B), b / (b + cc || 1)));
      segment(ctx, V, L, false);
      const a1 = Math.atan2(B[1] - V[1], B[0] - V[0]);
      const aL = Math.atan2(L[1] - V[1], L[0] - V[0]);
      const a2 = Math.atan2(C[1] - V[1], C[0] - V[0]);
      const r = Math.min(30, 0.28 * Math.min(b, cc));
      ctx.lineWidth = lw * 0.8;
      angleArc(ctx, V, a1, aL, r, 1);
      angleArc(ctx, V, aL, a2, r, 2);
      ctx.lineWidth = lw;
      dotAt(ctx, L, col);
      if (c.lab) text(ctx, c.lab, L, cen, col);
    } else if (c.k === "mid") {
      const M1 = mid(V, B), M2 = mid(V, C);
      segment(ctx, M1, M2, false);
      dotAt(ctx, M1, col);
      dotAt(ctx, M2, col);
      if (c.lab) {
        text(ctx, c.lab[0] || "", M1, cen, col);
        text(ctx, c.lab[1] || "", M2, cen, col);
      }
    } else {
      // side i: P[i] — P[i+1]; its perpendicular bisector
      const S0 = P[i], S1 = P[(i + 1) % 3], T3 = P[(i + 2) % 3];
      const M = mid(S0, S1);
      let dir = unit(perp(sub(S1, S0)));
      if (dot(dir, sub(T3, M)) < 0) dir = mul(dir, -1);
      const tHit = rayExit(M, dir, P, i);
      const ext = 16;
      segment(ctx, add(M, mul(dir, -ext)), add(M, mul(dir, tHit + ext)), false);
      ctx.lineWidth = lw * 0.8;
      ticks(ctx, mid(S0, M), sub(S1, S0), 2);
      ticks(ctx, mid(M, S1), sub(S1, S0), 2);
      rightMark(ctx, M, unit(sub(S1, S0)), dir, Math.min(12, len(sub(S1, S0)) * 0.1));
      ctx.lineWidth = lw;
      dotAt(ctx, M, col);
      if (c.lab) text(ctx, c.lab, M, cen, col, 17);
    }
  }
  ctx.restore();
}

// ---------- marks: right angles, equal sides ----------
export function drawPolyMarks(ctx: CanvasRenderingContext2D, o: PolygonObject): void {
  const P = o.pts;
  const n = P.length;
  ctx.save();
  ctx.strokeStyle = o.c;
  ctx.lineWidth = Math.max(1.4, o.s * 0.5);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const A = P[(i + n - 1) % n], B = P[i], C = P[(i + 1) % n];
    const u = unit(sub(A, B)), v = unit(sub(C, B));
    if (Math.abs(dot(u, v)) < 0.015) rightMark(ctx, B, u, v, Math.min(14, 0.25 * Math.min(len(sub(A, B)), len(sub(C, B)))));
  }
  const lens = P.map((p, i) => len(sub(P[(i + 1) % n], p)));
  const groups: number[] = [];
  const gid = lens.map((l) => {
    let g = groups.findIndex((x) => Math.abs(x - l) <= 0.012 * x);
    if (g < 0) { groups.push(l); g = groups.length - 1; }
    return g;
  });
  const sizes = groups.map((_, g) => gid.filter((x) => x === g).length);
  P.forEach((p, i) => {
    const g = gid[i];
    if (sizes[g] < 2 || g > 2) return;
    ticks(ctx, mid(p, P[(i + 1) % n]), sub(P[(i + 1) % n], p), g + 1);
  });
  ctx.restore();
}

// ====================== quadrilaterals ======================
export const QUAD_COLORS: Record<QuadConsKind, string> = { diag: "#e8590c", qalt: "#2f9e44", qmid: "#0c8599", qbis: "#c2255c" };
const QLET: Record<QuadConsKind, string[]> = { diag: ["O"], qalt: ["H", "H₁", "H₂", "H₃"], qmid: ["MN", "KL"], qbis: ["L", "L₁", "L₂", "L₃"] };

export function toggleQuad(cons: PolygonConstruction[] = [], k: QuadConsKind, i: number, j = 0): PolygonConstruction[] {
  const at = cons.findIndex((c) => isQuadCons(c) && c.k === k && c.i === i && (c.j || 0) === j);
  if (at >= 0) return cons.filter((_, n) => n !== at);
  const n = cons.filter((c) => c.k === k).length;
  return [...cons, { k, i, j, lab: QLET[k][Math.min(n, QLET[k].length - 1)] }];
}

export function quadTitle(c: QuadConstruction, labs?: string | null): string {
  const v = (i: number) => labs?.[((i % 4) + 4) % 4] || "ABCD"[((i % 4) + 4) % 4];
  if (c.k === "diag") return `Діагоналі ${v(0)}${v(2)} і ${v(1)}${v(3)}`;
  if (c.k === "qalt") return c.j ? `Висота з ${v(c.i)} на ${v(c.i + 1)}${v(c.i + 2)}` : `Висота з ${v(c.i)} на ${v(c.i + 2)}${v(c.i + 3)}`;
  if (c.k === "qmid") return `Середня лінія: середини ${v(c.i)}${v(c.i + 1)} і ${v(c.i + 2)}${v(c.i + 3)}`;
  return `Бісектриса кута ${v(c.i)}`;
}

function lineIntersect(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = sub(b, a), s2 = sub(d, c);
  const den = r[0] * s2[1] - r[1] * s2[0];
  if (Math.abs(den) < 1e-9) return null;
  const w = sub(c, a);
  const t = (w[0] * s2[1] - w[1] * s2[0]) / den;
  return add(a, mul(r, t));
}

function polyRayExit(M: Point, dir: Point, P: Point[], skip: number[]): number {
  let best = Infinity;
  const n = P.length;
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    const A = P[i], B = P[(i + 1) % n];
    const e = sub(B, A);
    const den = dir[0] * e[1] - dir[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const w = sub(A, M);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const s2 = (w[0] * dir[1] - w[1] * dir[0]) / den;
    if (t > 1e-6 && s2 >= -1e-6 && s2 <= 1 + 1e-6 && t < best) best = t;
  }
  return Number.isFinite(best) ? best : 0;
}

export function drawQuadExtras(ctx: CanvasRenderingContext2D, o: PolygonObject): void {
  const P = o.pts;
  if (P.length !== 4 || !o.cons?.length) return;
  const cen: Point = [(P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4];
  const lw = Math.max(1.6, o.s * 0.75);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const c of o.cons) {
    if (!isQuadCons(c)) continue;
    const col = QUAD_COLORS[c.k];
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw;
    const i = c.i || 0;
    if (c.k === "diag") {
      segment(ctx, P[0], P[2], false);
      segment(ctx, P[1], P[3], false);
      const O = lineIntersect(P[0], P[2], P[1], P[3]);
      if (!O) continue;
      ctx.lineWidth = lw * 0.8;
      if (len(sub(O, mid(P[0], P[2]))) < 2 && len(sub(O, mid(P[1], P[3]))) < 2) {
        ticks(ctx, mid(P[0], O), sub(P[2], P[0]), 1);
        ticks(ctx, mid(O, P[2]), sub(P[2], P[0]), 1);
        ticks(ctx, mid(P[1], O), sub(P[3], P[1]), 2);
        ticks(ctx, mid(O, P[3]), sub(P[3], P[1]), 2);
      }
      const d1 = sub(P[2], P[0]), d2 = sub(P[3], P[1]);
      if (Math.abs(dot(d1, d2)) < 0.02 * len(d1) * len(d2)) rightMark(ctx, O, unit(d1), unit(d2), 11);
      ctx.lineWidth = lw;
      dotAt(ctx, O, col);
      if (c.lab) text(ctx, c.lab, O, cen, col, 14);
    } else if (c.k === "qalt") {
      const V = P[i];
      const t = c.j ? (i + 1) % 4 : (i + 2) % 4;
      const S0 = P[t], S1 = P[(t + 1) % 4];
      const { H, t: tt } = foot(V, S0, S1);
      segment(ctx, V, H, false);
      if (tt < 0) segment(ctx, S0, H, true);
      else if (tt > 1) segment(ctx, S1, H, true);
      const toward = tt < 0 ? S0 : tt > 1 ? S1 : mid(S0, S1);
      ctx.lineWidth = lw * 0.8;
      const uu = len(sub(toward, H)) < 1e-6 ? unit(sub(S1, S0)) : unit(sub(toward, H));
      rightMark(ctx, H, uu, unit(sub(V, H)), Math.min(13, 0.2 * len(sub(V, H))));
      ctx.lineWidth = lw;
      dotAt(ctx, H, col);
      if (c.lab) text(ctx, c.lab, H, cen, col);
    } else if (c.k === "qmid") {
      const M1 = mid(P[i], P[(i + 1) % 4]), M2 = mid(P[(i + 2) % 4], P[(i + 3) % 4]);
      segment(ctx, M1, M2, false);
      dotAt(ctx, M1, col);
      dotAt(ctx, M2, col);
      if (c.lab) {
        text(ctx, c.lab[0] || "", M1, cen, col);
        text(ctx, c.lab[1] || "", M2, cen, col);
      }
    } else {
      const V = P[i];
      const u = unit(sub(P[(i + 1) % 4], V)), v = unit(sub(P[(i + 3) % 4], V));
      const dir = unit(add(u, v));
      const th = polyRayExit(V, dir, P, [i, (i + 3) % 4]);
      if (!th) continue;
      const E = add(V, mul(dir, th));
      segment(ctx, V, E, false);
      const a1 = Math.atan2(u[1], u[0]), aM = Math.atan2(dir[1], dir[0]), a2 = Math.atan2(v[1], v[0]);
      const r = Math.min(30, 0.3 * Math.min(len(sub(P[(i + 1) % 4], V)), len(sub(P[(i + 3) % 4], V))));
      ctx.lineWidth = lw * 0.8;
      angleArc(ctx, V, a1, aM, r, 1);
      angleArc(ctx, V, aM, a2, r, 2);
      ctx.lineWidth = lw;
      dotAt(ctx, E, col);
      if (c.lab) text(ctx, c.lab, E, cen, col);
    }
  }
  ctx.restore();
}

// ====================== inscribed and circumscribed circles ======================
const CIRC_COLORS = { in: "#1c7ed6", out: "#d6336c" };

function angleAt(P: Point[], i: number): number {
  const n = P.length;
  const u = unit(sub(P[(i + 1) % n], P[i])), v = unit(sub(P[(i + n - 1) % n], P[i]));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
}

function bisectorLine(P: Point[], i: number): [Point, Point] {
  const n = P.length;
  const u = unit(sub(P[(i + 1) % n], P[i])), v = unit(sub(P[(i + n - 1) % n], P[i]));
  return [P[i], add(P[i], unit(add(u, v)))];
}

export interface Circle {
  c: Point;
  r: number;
}

/** Inscribed and circumscribed circles of a triangle or quadrilateral (when they exist). */
export function circleInfo(P: Point[]): { inc: Circle | null; out: Circle | null } {
  const n = P.length;
  let inc: Circle | null = null;
  let out: Circle | null = null;
  if (n === 3) {
    const [A, B, C] = P;
    const a = len(sub(B, C)), b = len(sub(A, C)), c = len(sub(A, B));
    const s = (a + b + c) / 2;
    const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
    if (area > 1e-6) {
      inc = { c: [(a * A[0] + b * B[0] + c * C[0]) / (2 * s), (a * A[1] + b * B[1] + c * C[1]) / (2 * s)], r: area / s };
      const O = circumcenter(P);
      if (O) out = { c: O, r: len(sub(O, A)) };
    }
  } else if (n === 4) {
    const sides = P.map((p, i) => len(sub(P[(i + 1) % 4], p)));
    if (Math.abs(sides[0] + sides[2] - sides[1] - sides[3]) < 0.012 * (sides[0] + sides[1] + sides[2] + sides[3])) {
      const [a1, a2] = bisectorLine(P, 0), [b1, b2] = bisectorLine(P, 1);
      const I = lineIntersect(a1, a2, b1, b2);
      if (I) {
        const t = foot(I, P[0], P[1]);
        inc = { c: I, r: len(sub(I, t.H)) };
      }
    }
    const sum = angleAt(P, 0) + angleAt(P, 2);
    if (Math.abs(sum - Math.PI) < (1 * Math.PI) / 180) {
      const O = circumcenter([P[0], P[1], P[2]]);
      if (O) {
        const R = len(sub(O, P[0]));
        if (Math.abs(len(sub(O, P[3])) - R) < 0.015 * R) out = { c: O, r: R };
      }
    }
  }
  return { inc, out };
}

export function drawCircles(ctx: CanvasRenderingContext2D, o: PolygonObject): void {
  const P = o.pts;
  const circs = o.circs;
  if (!circs || (P.length !== 3 && P.length !== 4)) return;
  const info = circleInfo(P);
  ctx.save();
  ctx.lineCap = "round";
  for (const key of ["in", "out"] as const) {
    const cfg = circs[key];
    const circ = key === "in" ? info.inc : info.out;
    if (!cfg || !circ) continue;
    const col = CIRC_COLORS[key];
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(1.8, o.s * 0.7);
    ctx.beginPath();
    ctx.arc(circ.c[0], circ.c[1], circ.r, 0, Math.PI * 2);
    ctx.stroke();
    // radius: inscribed — to the tangent point on the first side, circumscribed — to vertex A
    const end = key === "in" ? foot(circ.c, P[0], P[1]).H : P[0];
    segment(ctx, circ.c, end, key !== "in");
    if (key === "in") {
      const u = unit(sub(P[1], P[0])), v = unit(sub(circ.c, end));
      ctx.lineWidth = 1.4;
      rightMark(ctx, end, foot(circ.c, P[0], P[1]).t > 0.5 ? mul(u, -1) : u, v, Math.min(11, circ.r * 0.25));
    }
    dotAt(ctx, circ.c, col);
    if (cfg.lab) text(ctx, cfg.lab, circ.c, add(circ.c, [0, 1]), col, 15);
    if (cfg.rad !== false) {
      const mp = mid(circ.c, end);
      const nrm = unit(perp(sub(end, circ.c)));
      const name = key === "in" ? "r" : "R";
      const val = `${String(parseFloat((circ.r / 40).toFixed(2))).replace(".", ",")} см`;
      ctx.save();
      ctx.font = `600 14px ${uiFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      const t = `${name} = ${val}`;
      ctx.strokeText(t, mp[0] + nrm[0] * 13, mp[1] + nrm[1] * 13);
      ctx.fillStyle = col;
      ctx.fillText(t, mp[0] + nrm[0] * 13, mp[1] + nrm[1] * 13);
      ctx.restore();
    }
  }
  ctx.restore();
}
