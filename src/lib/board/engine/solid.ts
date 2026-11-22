// Solids: cube, cuboid, prism, pyramid, cylinder, cone, sphere.
// Minimal custom 3D: orthographic projection with free 360° rotation, or the "school" oblique
// (cavalier, 45°, k = 0.5) projection. Hidden edges are dashed. Supports plane sections, height,
// apothem, slant height, radius and diagonals.
import { inBounds, round1 } from "./geom";
import type { ObjectDraft, ObjectTypeDef, Point, SolidEdgeRef, SolidKind, SolidObject, Vec3 } from "./types";

export const SOLID_KINDS: { kind: SolidKind; name: string }[] = [
  { kind: "cube", name: "Куб" },
  { kind: "cuboid", name: "Паралелепіпед" },
  { kind: "prism", name: "Призма" },
  { kind: "pyramid", name: "Піраміда" },
  { kind: "cylinder", name: "Циліндр" },
  { kind: "cone", name: "Конус" },
  { kind: "sphere", name: "Куля" },
];

const DEFAULTS: Record<SolidKind, Pick<SolidObject, "n" | "hr">> = {
  cube: {},
  cuboid: {},
  prism: { n: 3, hr: 1.6 },
  pyramid: { n: 4, hr: 1.7 },
  cylinder: { hr: 1.8 },
  cone: { hr: 1.8 },
  sphere: {},
};

export interface SolidAngles {
  yaw: number;
  pitch: number;
}

export const SOLID_VIEWS: Record<"iso" | "front" | "top" | "side", SolidAngles> = {
  iso: { yaw: -0.55, pitch: 0.45 },
  front: { yaw: 0, pitch: 0 },
  top: { yaw: 0, pitch: Math.PI / 2 - 0.001 },
  side: { yaw: Math.PI / 2, pitch: 0 },
};

type SolidDraft = ObjectDraft<SolidObject>;
type SolidDefaults = Pick<
  SolidDraft,
  "type" | "kind" | "w" | "h" | "yaw" | "pitch" | "school" | "hidden" | "labs" | "c" | "s" | "f" | "sc" | "mc" | "marks" | "sec" | "n" | "hr"
>;

/** Solid defaults for `kind` merged with `extra` (callers supply at least x and y). */
export function makeSolid(kind: SolidKind): SolidDefaults;
export function makeSolid<E extends Partial<SolidDraft>>(kind: SolidKind, extra: E): SolidDefaults & E;
export function makeSolid(kind: SolidKind, extra: Partial<SolidDraft> = {}): Partial<SolidDraft> {
  return {
    type: "solid",
    kind,
    w: 300,
    h: 300,
    yaw: -0.55,
    pitch: 0.45,
    school: false,
    hidden: true,
    labs: true,
    c: "#1d1b2e",
    s: 2.4,
    f: "#6d3df0",
    sc: "#e8590c",
    mc: "#0c8599",
    marks: {},
    sec: null,
    ...DEFAULTS[kind],
    ...extra,
  };
}

const isCurved = (k: SolidKind) => k === "cylinder" || k === "cone" || k === "sphere";

// ---------- vectors ----------
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- projection ----------
const SCHOOL_K = 0.5;
const SCHOOL_A = Math.PI / 4;

interface View {
  /** Model point → projected 2D point (y up). */
  proj: (v: Vec3) => Point;
  /** Direction towards the viewer in model coordinates. */
  d: Vec3;
}

function makeView(o: SolidObject): View {
  if (o.school && o.kind !== "sphere") {
    const ca = SCHOOL_K * Math.cos(SCHOOL_A);
    const sa = SCHOOL_K * Math.sin(SCHOOL_A);
    return { proj: (v) => [v[0] - ca * v[2], v[1] - sa * v[2]], d: [ca, sa, 1] };
  }
  const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
  const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  return {
    proj: (v) => {
      const x1 = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      return [x1, v[1] * cp - z1 * sp];
    },
    d: [-cp * sy, sp, cp * cy],
  };
}

// ---------- polyhedron models ----------
interface Edge {
  a: number;
  b: number;
  /** Indices of the faces sharing this edge. */
  faces: number[];
}

interface PolyModel {
  verts: Vec3[];
  faces: number[][];
  /** Outward unit normals, one per face. */
  normals: Vec3[];
  names: string[];
  edges: Edge[];
  radius: number;
  n: number;
  hr: number;
}

function ngon(n: number, r: number, y: number): Vec3[] {
  const off = n % 2 === 0 ? Math.PI / n : Math.PI / 2;
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = off + (2 * Math.PI * i) / n;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return pts;
}

const modelCache = new Map<string, PolyModel>();
function polyModel(o: SolidObject): PolyModel {
  const n = Math.max(3, Math.min(12, Math.round(o.n || 4)));
  const hr = o.hr || 1.6;
  const key = `${o.kind}|${n}|${hr}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  let verts: Vec3[], faces: number[][], names: string[];
  if (o.kind === "cube" || o.kind === "cuboid") {
    const [a, b, c] = o.kind === "cube" ? [1, 1, 1] : [1.5, 0.95, 1.05];
    const bot: Vec3[] = [[-a, -b, c], [a, -b, c], [a, -b, -c], [-a, -b, -c]];
    verts = [...bot, ...bot.map((v): Vec3 => [v[0], b, v[2]])];
    faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    names = ["A", "B", "C", "D", "A₁", "B₁", "C₁", "D₁"];
  } else if (o.kind === "prism") {
    const bot = ngon(n, 1, -hr / 2);
    verts = [...bot, ...bot.map((v): Vec3 => [v[0], hr / 2, v[2]])];
    faces = [bot.map((_, i) => i), bot.map((_, i) => n + i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
    names = [...bot.map((_, i) => String.fromCharCode(65 + i)), ...bot.map((_, i) => String.fromCharCode(65 + i) + "₁")];
  } else {
    const bot = ngon(n, 1, -hr / 2);
    verts = [...bot, [0, hr / 2, 0]];
    faces = [bot.map((_, i) => i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
    names = [...bot.map((_, i) => String.fromCharCode(65 + i)), "S"];
  }
  const normals = faces.map((f) => {
    const [p, q, r] = [verts[f[0]], verts[f[1]], verts[f[2]]];
    let nrm = cross(sub(q, p), sub(r, p));
    const cen = f.reduce<Vec3>((s, i) => add(s, verts[i]), [0, 0, 0]);
    if (dot(nrm, cen) < 0) nrm = mul(nrm, -1);
    return unit(nrm);
  });
  const edgeMap = new Map<string, Edge>();
  faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      let e = edgeMap.get(k);
      if (!e) { e = { a, b, faces: [] }; edgeMap.set(k, e); }
      e.faces.push(fi);
    }
  });
  const model: PolyModel = { verts, faces, normals, names, edges: [...edgeMap.values()], radius: Math.max(...verts.map((v) => len(v))), n, hr };
  if (modelCache.size > 60) modelCache.clear();
  modelCache.set(key, model);
  return model;
}

// ---------- frame: scale and model → board transform ----------
interface Frame {
  view: View;
  cx: number;
  cy: number;
  /** Board pixels per model unit. */
  k: number;
  d: Vec3;
  /** Model point → board point. */
  P: (v: Vec3) => Point;
}

function frameOf(o: SolidObject): Frame {
  const view = makeView(o);
  const hr = o.hr || 1.8;
  let R: number, kk: number;
  if (o.kind === "sphere") { R = 1; kk = 0.88; } else if (isCurved(o.kind)) { R = Math.hypot(1, hr / 2); kk = 0.86; } else { R = polyModel(o).radius; kk = 0.86; }
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const k = (Math.min(o.w, o.h) / (2 * R)) * kk;
  return { view, cx, cy, k, d: view.d, P: (v) => { const p = view.proj(v); return [cx + p[0] * k, cy - p[1] * k]; } };
}

// ---------- section plane ----------
/** Plane n·p = d with unit normal n. */
interface Plane {
  n: Vec3;
  d: number;
}

interface SectionSeg {
  a: Vec3;
  b: Vec3;
  vis: boolean;
}

interface Section {
  /** Section polygon, ordered around its centre. */
  fill: Vec3[];
  segs: SectionSeg[];
}

const edgePoint = (model: PolyModel, ref: SolidEdgeRef): Vec3 | null => {
  const e = model.edges[ref.e];
  return e ? lerp(model.verts[e.a], model.verts[e.b], ref.t) : null;
};

function yRange(o: SolidObject): [number, number] {
  if (o.kind === "sphere") return [-1, 1];
  if (isCurved(o.kind)) { const h = (o.hr || 1.8) / 2; return [-h, h]; }
  const m = polyModel(o);
  const ys = m.verts.map((v) => v[1]);
  return [Math.min(...ys), Math.max(...ys)];
}

function planeOf(o: SolidObject): Plane | null {
  const s = o.sec;
  if (!s) return null;
  if (s.mode === "pts") {
    if (isCurved(o.kind) || !s.pts || s.pts.length < 3) return null;
    const m = polyModel(o);
    const P: Vec3[] = [];
    for (const r of s.pts.slice(0, 3)) {
      const p = edgePoint(m, r);
      if (!p) return null;
      P.push(p);
    }
    const n = cross(sub(P[1], P[0]), sub(P[2], P[0]));
    if (len(n) < 1e-6) return null;
    const nn = unit(n);
    return { n: nn, d: dot(nn, P[0]) };
  }
  if (s.mode === "horiz") {
    const [lo, hi] = yRange(o);
    return { n: [0, 1, 0], d: lo + (hi - lo) * (s.t ?? 0.5) };
  }
  if (s.mode === "axial") {
    const a = s.a ?? 0;
    return { n: [Math.cos(a), 0, Math.sin(a)], d: 0 };
  }
  if (s.mode === "tilt") {
    const a = s.a ?? 0;
    const t = s.tilt ?? 0.6;
    const n = unit([Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a)]);
    return { n, d: s.off ?? 0 };
  }
  return null;
}

function orderAround(points: Vec3[], n: Vec3): Vec3[] {
  const c = mul(points.reduce<Vec3>((s, p) => add(s, p), [0, 0, 0]), 1 / points.length);
  const ax: Vec3 = Math.abs(n[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const u = unit(cross(n, ax));
  const w = cross(n, u);
  return points
    .map((p) => ({ p, a: Math.atan2(dot(sub(p, c), w), dot(sub(p, c), u)) }))
    .sort((x, y) => x.a - y.a)
    .map((x) => x.p);
}

function dedupe(points: Vec3[], eps = 1e-5): Vec3[] {
  const out: Vec3[] = [];
  for (const p of points) if (!out.some((q) => len(sub(p, q)) < eps)) out.push(p);
  return out;
}

function polySection(model: PolyModel, plane: Plane, faceVis: boolean[]): Section | null {
  const { n, d } = plane;
  const eps = 1e-7;
  const segs: SectionSeg[] = [];
  const all: Vec3[] = [];
  model.faces.forEach((f, fi) => {
    const s = f.map((i) => dot(n, model.verts[i]) - d);
    if (s.every((x) => Math.abs(x) < eps)) return; // face lies in the section plane
    let pts: Vec3[] = [];
    for (let i = 0; i < f.length; i++) {
      const j = (i + 1) % f.length;
      const v0 = model.verts[f[i]], v1 = model.verts[f[j]];
      if (Math.abs(s[i]) < eps) pts.push(v0);
      else if (s[i] * s[j] < 0 && Math.abs(s[j]) >= eps) pts.push(lerp(v0, v1, s[i] / (s[i] - s[j])));
    }
    pts = dedupe(pts);
    if (pts.length < 2) return;
    let best: [Vec3, Vec3] = [pts[0], pts[1]], bd = 0;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dd = len(sub(pts[i], pts[j]));
      if (dd > bd) { bd = dd; best = [pts[i], pts[j]]; }
    }
    segs.push({ a: best[0], b: best[1], vis: faceVis[fi] });
    all.push(best[0], best[1]);
  });
  const uniq = dedupe(all);
  if (uniq.length < 3) return null;
  return { fill: orderAround(uniq, n), segs };
}

// Chord cut by the plane from the unit circle at height yc.
function capChord(plane: Plane, yc: number): [Vec3, Vec3] | null {
  const { n, d } = plane;
  const hyp = Math.hypot(n[0], n[2]);
  if (hyp < 1e-6) return null;
  const dl = (d - n[1] * yc) / hyp;
  if (Math.abs(dl) >= 1) return null;
  const ux = n[0] / hyp, uz = n[2] / hyp;
  const h = Math.sqrt(1 - dl * dl);
  return [[dl * ux - h * uz, yc, dl * uz + h * ux], [dl * ux + h * uz, yc, dl * uz - h * ux]];
}

interface RunPoint {
  pt: Vec3;
  vis: boolean;
}

function curvedSection(o: SolidObject, plane: Plane, view: View): Section | null {
  const [dx, dy, dz] = view.d;
  const { n, d } = plane;
  const [nx, ny, nz] = n;
  const segs: SectionSeg[] = [];
  const all: Vec3[] = [];
  const N = 140;
  const H = o.hr || 1.8;
  const top = H / 2;

  if (o.kind === "sphere") {
    if (Math.abs(d) >= 1) return null;
    const c0 = mul(n, d);
    const r = Math.sqrt(1 - d * d);
    const ax: Vec3 = Math.abs(nx) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    const u = unit(cross(n, ax));
    const w = cross(n, u);
    let prev: RunPoint | null = null;
    for (let i = 0; i <= N; i++) {
      const t = (2 * Math.PI * i) / N;
      const p = add(c0, add(mul(u, r * Math.cos(t)), mul(w, r * Math.sin(t))));
      all.push(p);
      const vis = dot(p, view.d) > 0;
      if (prev) segs.push({ a: prev.pt, b: p, vis: prev.vis });
      prev = { pt: p, vis };
    }
    return { fill: orderAround(dedupe(all, 1e-4), n), segs };
  }

  if (o.kind === "cylinder") {
    if (Math.abs(ny) > 1e-4) {
      let prev: RunPoint | null = null;
      for (let i = 0; i <= N; i++) {
        const t = (2 * Math.PI * i) / N;
        const c = Math.cos(t), s = Math.sin(t);
        const y = (d - nx * c - nz * s) / ny;
        const pt: Vec3 | null = Math.abs(y) <= top + 1e-9 ? [c, y, s] : null;
        if (prev && pt) segs.push({ a: prev.pt, b: pt, vis: prev.vis });
        if (pt) all.push(pt);
        prev = pt ? { pt, vis: c * dx + s * dz > 0 } : null;
      }
    } else {
      const A = Math.hypot(nx, nz) || 1;
      const ratio = d / A;
      if (Math.abs(ratio) < 1) {
        const phi = Math.atan2(nz, nx);
        for (const sg of [1, -1]) {
          const t = phi + sg * Math.acos(ratio);
          const c = Math.cos(t), s = Math.sin(t);
          const a: Vec3 = [c, -top, s], b: Vec3 = [c, top, s];
          segs.push({ a, b, vis: c * dx + s * dz > 0 });
          all.push(a, b);
        }
      }
    }
    for (const yc of [top, -top]) {
      const ch = capChord(plane, yc);
      if (!ch) continue;
      segs.push({ a: ch[0], b: ch[1], vis: yc > 0 ? dy > 0 : dy < 0 });
      all.push(ch[0], ch[1]);
    }
  } else {
    // cone
    const apex: Vec3 = [0, top, 0];
    const num = d - ny * top;
    const ch = capChord(plane, -top);
    if (Math.abs(num) < 1e-5) {
      if (!ch) return null;
      for (const e of ch) {
        const t = Math.atan2(e[2], e[0]);
        segs.push({ a: apex, b: e, vis: H * (Math.cos(t) * dx + Math.sin(t) * dz) + dy > 0 });
      }
      all.push(apex, ch[0], ch[1]);
    } else {
      let prev: RunPoint | null = null;
      for (let i = 0; i <= N; i++) {
        const t = (2 * Math.PI * i) / N;
        const c = Math.cos(t), s = Math.sin(t);
        const den = nx * c + nz * s - ny * H;
        let pt: Vec3 | null = null;
        if (Math.abs(den) > 1e-7) {
          const sc = num / den;
          if (sc >= 0 && sc <= 1) pt = [sc * c, top - sc * H, sc * s];
        }
        if (prev && pt) segs.push({ a: prev.pt, b: pt, vis: prev.vis });
        if (pt) all.push(pt);
        prev = pt ? { pt, vis: H * (c * dx + s * dz) + dy > 0 } : null;
      }
    }
    if (ch) {
      segs.push({ a: ch[0], b: ch[1], vis: dy < 0 });
      all.push(ch[0], ch[1]);
    }
  }
  const uniq = dedupe(all, 1e-4);
  if (uniq.length < 3) return null;
  return { fill: orderAround(uniq, n), segs };
}

function paintSection(ctx: CanvasRenderingContext2D, o: SolidObject, F: Frame, sec: Section | null): void {
  if (!sec) return;
  const poly = sec.fill.map((p) => F.P(p));
  ctx.save();
  ctx.fillStyle = o.sc;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = o.sc;
  ctx.lineWidth = o.s * 1.25;
  ctx.lineCap = "round";
  if (o.hidden) {
    ctx.save();
    ctx.setLineDash([o.s * 3, o.s * 2.2]);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (const s of sec.segs) {
      if (s.vis) continue;
      const a = F.P(s.a), b = F.P(s.b);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  for (const s of sec.segs) {
    if (!s.vis) continue;
    const a = F.P(s.a), b = F.P(s.b);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------- marks: height, apothem, slant height, radius, diagonals ----------
// Rim point of the circle (radius r at height y) that projects furthest right.
function rimPoint(F: Frame, y: number, r: number, steps = 72): Vec3 {
  let best: Vec3 = [r, y, 0], bx = -Infinity;
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const v: Vec3 = [Math.cos(t) * r, y, Math.sin(t) * r];
    const x = F.P(v)[0];
    if (x > bx) { bx = x; best = v; }
  }
  return best;
}

interface MarkDot {
  p: Vec3;
  label: string;
}

/** Segment O–S with foot O; `right` draws the right-angle mark between O–S and O–M. */
interface MarkFoot {
  O: Vec3;
  M: Vec3;
  S: Vec3;
  right: boolean;
}

interface Mark {
  a: Vec3;
  b: Vec3;
  vis: boolean;
  label: string;
  dots?: MarkDot[];
  foot?: MarkFoot;
}

function buildMarks(o: SolidObject, F: Frame, model: PolyModel | null, faceVis: boolean[] | null): Mark[] {
  const m = o.marks || {};
  const out: Mark[] = [];
  const k = o.kind;
  const dy = F.d[1];
  if (k === "pyramid") {
    if (!model || !faceVis) return out;
    const n = model.n;
    const O: Vec3 = [0, -model.hr / 2, 0];
    const S = model.verts[n];
    if (m.h) out.push({ a: S, b: O, vis: false, label: nm(o, "h", "h"), dots: [{ p: O, label: nm(o, "O", "O") }] });
    if (m.ap) {
      let bf = 1, bv = -Infinity;
      for (let i = 1; i <= n; i++) { const v = dot(model.normals[i], F.d); if (v > bv) { bv = v; bf = i; } }
      const f = model.faces[bf];
      const M = lerp(model.verts[f[0]], model.verts[f[1]], 0.5);
      out.push({ a: S, b: M, vis: faceVis[bf], label: nm(o, "l", "l"), dots: [{ p: M, label: nm(o, "M", "M") }], foot: { O, M, S, right: !!m.h } });
    }
  } else if (k === "prism") {
    if (!model) return out;
    const O: Vec3 = [0, -model.hr / 2, 0], O1: Vec3 = [0, model.hr / 2, 0];
    if (m.h) out.push({ a: O1, b: O, vis: false, label: nm(o, "h", "h"), dots: [{ p: O, label: nm(o, "O", "O") }, { p: O1, label: nm(o, "O1", "O₁") }] });
  } else if (k === "cube" || k === "cuboid") {
    if (!model) return out;
    const v = model.verts;
    if (m.diag) out.push({ a: v[0], b: v[6], vis: false, label: nm(o, "d", "d") });
    if (m.bdiag) out.push({ a: v[0], b: v[2], vis: dy < 0, label: nm(o, "bd", "d₁") });
  } else if (k === "cylinder") {
    const top = o.hr ? o.hr / 2 : 0.9;
    const O: Vec3 = [0, -top, 0], O1: Vec3 = [0, top, 0];
    if (m.h) out.push({ a: O1, b: O, vis: false, label: nm(o, "h", "h"), dots: [{ p: O, label: nm(o, "O", "O") }, { p: O1, label: nm(o, "O1", "O₁") }] });
    if (m.r) {
      const A = rimPoint(F, top, 1);
      out.push({ a: O1, b: A, vis: dy > 0, label: nm(o, "r", "r"), dots: [{ p: O1, label: m.h || o.labs ? "" : nm(o, "O1", "O₁") }] }); // else already named by h / the axis
    }
  } else if (k === "cone") {
    const top = o.hr ? o.hr / 2 : 0.9;
    const O: Vec3 = [0, -top, 0], S: Vec3 = [0, top, 0];
    const A = rimPoint(F, -top, 1);
    if (m.h) out.push({ a: S, b: O, vis: false, label: nm(o, "h", "h"), dots: [{ p: O, label: nm(o, "O", "O") }], foot: { O, M: A, S, right: !!m.r } });
    if (m.l) out.push({ a: S, b: A, vis: true, label: nm(o, "l", "l") });
    if (m.r) out.push({ a: O, b: A, vis: dy < 0, label: nm(o, "r", "r"), dots: [{ p: O, label: m.h || o.labs ? "" : nm(o, "O", "O") }] }); // else already named by h / the axis
  } else if (k === "sphere") {
    if (m.r) {
      const A = rimPoint(F, 0, 1);
      out.push({ a: [0, 0, 0], b: A, vis: true, label: nm(o, "R", "R"), dots: [{ p: [0, 0, 0], label: "" }] });
    }
  }
  return out;
}

function paintMarks(ctx: CanvasRenderingContext2D, o: SolidObject, F: Frame, marks: Mark[]): void {
  if (!marks.length) return;
  ctx.save();
  ctx.strokeStyle = o.mc;
  ctx.fillStyle = o.mc;
  ctx.lineWidth = o.s * 0.95;
  ctx.lineCap = "round";
  for (const mk of marks) {
    const a = F.P(mk.a), b = F.P(mk.b);
    ctx.save();
    if (!mk.vis) { ctx.setLineDash([o.s * 2.6, o.s * 2.2]); }
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
    // right angle at the foot
    if (mk.foot?.right) {
      const { O, M, S } = mk.foot;
      const e1 = mul(unit(sub(S, O)), 0.13);
      const e2 = mul(unit(sub(M, O)), 0.13);
      const p1 = F.P(add(O, e1)), p2 = F.P(add(add(O, e1), e2)), p3 = F.P(add(O, e2));
      ctx.save();
      ctx.lineWidth = o.s * 0.7;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
      ctx.stroke();
      ctx.restore();
    }
    for (const dt of mk.dots || []) {
      const p = F.P(dt.p);
      ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill();
    }
    if (mk.label) {
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      ctx.font = 'italic 600 18px "Times New Roman", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mk.label, (a[0] + b[0]) / 2 + nx * 13, (a[1] + b[1]) / 2 + ny * 13);
    }
    for (const dt of mk.dots || []) {
      if (!dt.label) continue;
      const p = F.P(dt.p);
      ctx.font = 'italic 600 18px "Times New Roman", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dt.label, p[0] + 13, p[1] + 2);
    }
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, dx: number, dy: number, dim = false): void {
  ctx.save();
  ctx.font = 'italic 600 19px "Times New Roman", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1d1b2e";
  ctx.globalAlpha = dim ? 0.55 : 1;
  ctx.fillText(text, x + dx, y + dy);
  ctx.restore();
}

const SEC_NAMES = ["M", "N", "K"];
// Label with the user's override applied (empty string hides it).
function nm(o: SolidObject, key: string, def: string): string { const v = o.tags?.[key]; return v === undefined ? def : v; }

// ---------- polyhedra ----------
function drawPoly(ctx: CanvasRenderingContext2D, o: SolidObject, F: Frame): void {
  const model = polyModel(o);
  const { verts, faces, normals, names, edges } = model;
  const P = verts.map((v) => F.P(v));
  const faceVis = normals.map((n) => dot(n, F.d) > 1e-9);
  const vertVis = verts.map(() => false);
  faces.forEach((f, fi) => { if (faceVis[fi]) f.forEach((i) => { vertVis[i] = true; }); });

  if (o.f) {
    ctx.save();
    ctx.fillStyle = o.f;
    ctx.globalAlpha = 0.13;
    faces.forEach((f, fi) => {
      if (!faceVis[fi]) return;
      ctx.beginPath();
      f.forEach((i, j) => (j ? ctx.lineTo(P[i][0], P[i][1]) : ctx.moveTo(P[i][0], P[i][1])));
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }
  ctx.strokeStyle = o.c;
  ctx.lineWidth = o.s;
  if (o.hidden) {
    ctx.save();
    ctx.setLineDash([o.s * 3, o.s * 2.4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (const e of edges) {
      if (e.faces.some((fi) => faceVis[fi])) continue;
      ctx.moveTo(P[e.a][0], P[e.a][1]); ctx.lineTo(P[e.b][0], P[e.b][1]);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  for (const e of edges) {
    if (!e.faces.some((fi) => faceVis[fi])) continue;
    ctx.moveTo(P[e.a][0], P[e.a][1]); ctx.lineTo(P[e.b][0], P[e.b][1]);
  }
  ctx.stroke();

  if (o.labs) {
    verts.forEach((_, i) => {
      if (!o.hidden && !vertVis[i]) return;
      let dx = P[i][0] - F.cx;
      let dy = P[i][1] - F.cy;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      label(ctx, o.names?.[i] ?? names[i], P[i][0], P[i][1], dx * 15, dy * 15, !vertVis[i]);
    });
  }

  // section
  const plane = planeOf(o);
  if (plane) paintSection(ctx, o, F, polySection(model, plane, faceVis));
  if (o.sec?.mode === "pts" && o.sec.pts) {
    o.sec.pts.forEach((r, i) => {
      const p3 = edgePoint(model, r);
      if (!p3) return;
      const p = F.P(p3);
      ctx.save();
      ctx.fillStyle = o.sc;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      label(ctx, nm(o, "sec" + i, SEC_NAMES[i]), p[0], p[1], 12, -12);
    });
  }
  paintMarks(ctx, o, F, buildMarks(o, F, model, faceVis));
}

// Circle of radius r in the horizontal plane at height y. Returns the board-point function of its angle.
function circleRuns(
  ctx: CanvasRenderingContext2D,
  o: SolidObject,
  F: Frame,
  y: number,
  r: number,
  visAt: (t: number) => boolean,
): (t: number) => Point {
  const N = 90;
  const pts: { x: number; y: number; vis: boolean }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (2 * Math.PI * i) / N;
    const p = F.P([Math.cos(t) * r, y, Math.sin(t) * r]);
    pts.push({ x: p[0], y: p[1], vis: visAt(t) });
  }
  const run = (wantVis: boolean) => {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (pts[i].vis !== wantVis) continue;
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    }
    ctx.stroke();
  };
  if (o.hidden) {
    ctx.save();
    ctx.setLineDash([o.s * 3, o.s * 2.4]);
    ctx.globalAlpha = 0.7;
    run(false);
    ctx.restore();
  }
  run(true);
  return (t) => F.P([Math.cos(t) * r, y, Math.sin(t) * r]);
}

function drawCurved(ctx: CanvasRenderingContext2D, o: SolidObject, F: Frame): void {
  const [dx, dy, dz] = F.d;
  const hr = o.hr || 1.8;
  const top = hr / 2;
  const bot = -hr / 2;
  ctx.strokeStyle = o.c;
  ctx.lineWidth = o.s;
  const plane = planeOf(o);

  if (o.kind === "sphere") {
    const R = F.k;
    ctx.beginPath();
    ctx.arc(F.cx, F.cy, R, 0, Math.PI * 2);
    if (o.f) { ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = o.f; ctx.fill(); ctx.restore(); }
    ctx.stroke();
    circleRuns(ctx, o, F, 0, 1, (t) => Math.cos(t) * dx + Math.sin(t) * dz > 0);
    const N = 90;
    const pts: { x: number; y: number; vis: boolean }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (2 * Math.PI * i) / N;
      const p = F.P([Math.cos(t), Math.sin(t), 0]);
      pts.push({ x: p[0], y: p[1], vis: Math.cos(t) * dx + Math.sin(t) * dy > 0 });
    }
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const wantVis of [false, true]) {
      if (!wantVis && !o.hidden) continue;
      ctx.save();
      if (!wantVis) { ctx.setLineDash([o.s * 3, o.s * 2.4]); ctx.globalAlpha = 0.5; }
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        if (pts[i].vis !== wantVis) continue;
        ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (o.labs) {
      ctx.fillStyle = "#1d1b2e";
      ctx.beginPath(); ctx.arc(F.cx, F.cy, 3.2, 0, Math.PI * 2); ctx.fill();
      label(ctx, nm(o, "O", "O"), F.cx, F.cy, 11, 12);
    }
    if (plane) paintSection(ctx, o, F, curvedSection(o, plane, F.view));
    paintMarks(ctx, o, F, buildMarks(o, F, null, null));
    return;
  }

  if (o.kind === "cylinder") {
    const topVis = dy > 0;
    const botVis = dy < 0;
    const side = (t: number) => Math.cos(t) * dx + Math.sin(t) * dz > 0;
    if (o.f) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = o.f;
      ctx.beginPath();
      for (let i = 0; i <= 90; i++) {
        const t = (2 * Math.PI * i) / 90;
        const p = F.P([Math.cos(t), top, Math.sin(t)]);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      for (let i = 90; i >= 0; i--) {
        const t = (2 * Math.PI * i) / 90;
        const p = F.P([Math.cos(t), bot, Math.sin(t)]);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.fill();
      ctx.restore();
    }
    const topPt = circleRuns(ctx, o, F, top, 1, (t) => topVis || side(t));
    const botPt = circleRuns(ctx, o, F, bot, 1, (t) => botVis || side(t));
    if (Math.hypot(dx, dz) > 1e-6) {
      const t0 = Math.atan2(dx, -dz);
      ctx.beginPath();
      for (const t of [t0, t0 + Math.PI]) {
        const a = topPt(t), b = botPt(t);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    if (o.labs && !o.marks?.h) {
      const c1 = F.P([0, top, 0]), c0 = F.P([0, bot, 0]);
      ctx.save();
      ctx.setLineDash([o.s * 3, o.s * 2.4]); ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c0[0], c0[1]); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#1d1b2e";
      for (const c of [c1, c0]) { ctx.beginPath(); ctx.arc(c[0], c[1], 3, 0, Math.PI * 2); ctx.fill(); }
      label(ctx, nm(o, "O1", "O₁"), c1[0], c1[1], 14, -3);
      label(ctx, nm(o, "O", "O"), c0[0], c0[1], 14, 3, !botVis && !!o.hidden);
    }
  } else {
    // cone
    const H = hr;
    const botVis = dy < 0;
    const sideDot = (t: number) => H * (Math.cos(t) * dx + Math.sin(t) * dz) + dy;
    const apex = F.P([0, top, 0]);
    const basePt = circleRuns(ctx, o, F, bot, 1, (t) => botVis || sideDot(t) > 0);
    const A = Math.hypot(dx, dz);
    if (A > 1e-6) {
      const arg = -dy / (H * A);
      if (Math.abs(arg) <= 1) {
        const phi = Math.atan2(dz, dx);
        const da = Math.acos(arg);
        const t1 = phi + da, t2 = phi - da;
        if (o.f) {
          ctx.save();
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = o.f;
          ctx.beginPath();
          ctx.moveTo(apex[0], apex[1]);
          const N = 60;
          let ts: number[] = [];
          for (let i = 0; i <= N; i++) ts.push(t1 + ((t2 + 2 * Math.PI * (t2 < t1 ? 1 : 0) - t1) * i) / N);
          const visMid = sideDot((ts[0] + ts[N]) / 2) > 0;
          if (visMid !== !botVis) { ts = []; for (let i = 0; i <= N; i++) ts.push(t2 + ((t1 + 2 * Math.PI * (t1 < t2 ? 1 : 0) - t2) * i) / N); }
          ts.forEach((t) => { const p = basePt(t); ctx.lineTo(p[0], p[1]); });
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.beginPath();
        for (const t of [t1, t2]) { const b = basePt(t); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(b[0], b[1]); }
        ctx.stroke();
      }
    }
    if (o.labs) {
      const c0 = F.P([0, bot, 0]);
      if (!o.marks?.h) {
        ctx.save();
        ctx.setLineDash([o.s * 3, o.s * 2.4]); ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(c0[0], c0[1]); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "#1d1b2e";
        ctx.beginPath(); ctx.arc(c0[0], c0[1], 3, 0, Math.PI * 2); ctx.fill();
        label(ctx, nm(o, "O", "O"), c0[0], c0[1], 14, 3);
      }
      label(ctx, nm(o, "S", "S"), apex[0], apex[1], 0, -15);
    }
  }
  if (plane) paintSection(ctx, o, F, curvedSection(o, plane, F.view));
  paintMarks(ctx, o, F, buildMarks(o, F, null, null));
}

// ---------- picking section points on edges ----------
const SNAP_T = [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1];

export interface SolidEdgeHit extends SolidEdgeRef {
  /** Board point on the edge. */
  pt: Point;
  /** Distance from the query point, board pixels. */
  dist: number;
}

// Nearest edge point to p (board coordinates), or null.
export function solidPickEdge(o: SolidObject, p: Point, tol: number): SolidEdgeHit | null {
  if (isCurved(o.kind)) return null;
  const F = frameOf(o);
  const model = polyModel(o);
  const faceVis = model.normals.map((n) => dot(n, F.d) > 1e-9);
  let best: SolidEdgeHit | null = null;
  model.edges.forEach((e, i) => {
    if (!o.hidden && !e.faces.some((fi) => faceVis[fi])) return;
    const a = F.P(model.verts[e.a]), b = F.P(model.verts[e.b]);
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const l2 = vx * vx + vy * vy;
    if (!l2) return;
    let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2;
    t = Math.max(0, Math.min(1, t));
    for (const s of SNAP_T) if (Math.abs(t - s) < 0.045) { t = s; break; }
    const q: Point = [a[0] + vx * t, a[1] + vy * t];
    const dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (dist <= tol && (!best || dist < best.dist)) best = { e: i, t: Math.round(t * 1000) / 1000, pt: q, dist };
  });
  return best;
}

// Board positions of the section points (for dragging).
export function solidSecPoints(o: SolidObject): (Point | null)[] {
  if (isCurved(o.kind) || o.sec?.mode !== "pts" || !o.sec.pts) return [];
  const F = frameOf(o);
  const model = polyModel(o);
  return o.sec.pts.map((r) => { const p = edgePoint(model, r); return p ? F.P(p) : null; });
}

/** An editable label: a vertex name (`vertex`) or a tag (`key`). */
export interface SolidLabelField {
  key?: string;
  vertex?: number;
  label: string;
  def: string;
}

// Fields for editing labels.
export function solidLabelFields(o: SolidObject): SolidLabelField[] {
  const out: SolidLabelField[] = [];
  const m = o.marks || {};
  const push = (key: string, label: string, def: string) => { if (!out.some((f) => f.key === key)) out.push({ key, label, def }); };
  if (!isCurved(o.kind)) {
    polyModel(o).names.forEach((def, i) => out.push({ vertex: i, label: "Вершина", def }));
  } else if (o.kind === "cylinder") { push("O1", "Центр верхньої основи", "O₁"); push("O", "Центр нижньої основи", "O"); }
  else if (o.kind === "cone") { push("S", "Вершина", "S"); push("O", "Центр основи", "O"); }
  else push("O", "Центр", "O");
  if (m.h) { push("h", "Висота", "h"); if (o.kind === "pyramid" || o.kind === "prism" || o.kind === "cylinder" || o.kind === "cone") push("O", "Центр основи", "O"); if (o.kind === "prism") push("O1", "Центр верхньої основи", "O₁"); }
  if (m.ap) { push("l", "Апофема", "l"); push("M", "Середина ребра основи", "M"); }
  if (m.l) push("l", "Твірна", "l");
  if (m.r) push(o.kind === "sphere" ? "R" : "r", "Радіус", o.kind === "sphere" ? "R" : "r");
  if (m.diag) push("d", "Діагональ тіла", "d");
  if (m.bdiag) push("bd", "Діагональ основи", "d₁");
  if (o.sec?.mode === "pts") ["M", "N", "K"].forEach((def, i) => push("sec" + i, `Точка перерізу ${i + 1}`, def));
  return out;
}

export const SOLID_TYPE: ObjectTypeDef<SolidObject> = {
  dom: false,
  interactive: true,
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  draw(ctx, o) {
    const F = frameOf(o);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (isCurved(o.kind)) drawCurved(ctx, o, F);
    else drawPoly(ctx, o, F);
    ctx.restore();
  },
  hit: (o, p) => inBounds({ x: o.x, y: o.y, w: o.w, h: o.h }, p, 0),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(90, to.w)), h: round1(Math.max(90, to.h)) }),
};
