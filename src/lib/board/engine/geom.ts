// Basic canvas geometry. Points are [x, y] arrays, rectangles are {x, y, w, h}.
import type { Bounds, Point } from "./types";

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const snapTo = (v: number, step: number): number => Math.round(v / step) * step;
export const round1 = (v: number): number => Math.round(v * 10) / 10;

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function boundsOfPoints(pts: readonly Point[]): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function unionBounds(list: readonly Bounds[]): Bounds | null {
  if (!list.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of list) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function inBounds(b: Bounds, p: Point, pad = 0): boolean {
  return p[0] >= b.x - pad && p[0] <= b.x + b.w + pad && p[1] >= b.y - pad && p[1] <= b.y + b.h + pad;
}

export function rectFromPoints(a: Point, b: Point): Bounds {
  return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) };
}

export function pointInPolygon(p: Point, pts: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Polyline simplification (Ramer–Douglas–Peucker), iterative to avoid deep recursion.
export function simplify(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(pts[i], pts[a], pts[b]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Same as simplify, but returns the kept indices (to keep per-point data such as pressure). */
export function simplifyIdx(pts: Point[], eps: number): number[] {
  const kept = new Set(simplify(pts, eps));
  return pts.flatMap((p, i) => (kept.has(p) ? [i] : []));
}

// Map a point from rectangle `from` into rectangle `to`.
export function mapPoint(p: Point, from: Bounds, to: Bounds): Point {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return [round1(to.x + (p[0] - from.x) * sx), round1(to.y + (p[1] - from.y) * sy)];
}

export function centroid(pts: readonly Point[]): Point {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

export function rotPoint(p: Point, a: number, cx: number, cy: number): Point {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = p[0] - cx, dy = p[1] - cy;
  return [round1(cx + dx * c - dy * s), round1(cy + dx * s + dy * c)];
}

// Angle normalised to (-π, π].
export function normAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}
