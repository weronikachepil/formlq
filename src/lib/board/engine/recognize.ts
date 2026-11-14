// Shape recognition: segment, circle/ellipse, triangle, rectangle, polygon — from a hand-drawn stroke.
import { boundsOfPoints, distToSegment, round1, simplify } from "./geom";
import { LABELS } from "./shapes";
import type { DrawStyle, EllipseObject, LineObject, ObjectDraft, Point, PolygonObject } from "./types";

/** What `recognize` can produce. */
export type RecognizedShape = ObjectDraft<LineObject | EllipseObject | PolygonObject>;

const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(pts: Point[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** A nearly horizontal / vertical / diagonal line becomes exact. */
function snapLine(a: Point, b: Point): [Point, Point] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  if (Math.abs(ang - snapped) < (6 * Math.PI) / 180) {
    const l = Math.hypot(dx, dy);
    return [a, [a[0] + Math.cos(snapped) * l, a[1] + Math.sin(snapped) * l]];
  }
  return [a, b];
}

function meanDistToPolygon(pts: Point[], poly: Point[]): number {
  let sum = 0;
  for (const p of pts) {
    let m = Infinity;
    for (let i = 0; i < poly.length; i++) m = Math.min(m, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
    sum += m;
  }
  return sum / pts.length;
}

/** Returns an object (without id/z) or null. */
export function recognize(pts: Point[], z: number, st: Pick<DrawStyle, "c" | "s" | "dash">): RecognizedShape | null {
  if (pts.length < 8) return null;
  const L = pathLength(pts);
  if (L < 50 / z) return null;
  const first = pts[0], last = pts[pts.length - 1];
  const chord = dist(first, last);
  const base = { c: st.c, s: st.s, dash: st.dash };

  if (chord > 0.2 * L) {
    // open stroke → segment, if nearly straight
    let dev = 0;
    for (const p of pts) dev = Math.max(dev, distToSegment(p, first, last));
    if (dev < 0.06 * chord) {
      const [a, b] = snapLine(first, last);
      return { type: "line", pts: [[round1(a[0]), round1(a[1])], [round1(b[0]), round1(b[1])]], arrow: false, ...base };
    }
    return null;
  }

  // closed shape
  const bb = boundsOfPoints(pts);
  const diag = Math.hypot(bb.w, bb.h);
  if (diag < 40 / z) return null;
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const rx = bb.w / 2 || 1, ry = bb.h / 2 || 1;

  let ell = 0;
  for (const p of pts) ell += Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1);
  const ellPx = (ell / pts.length) * ((rx + ry) / 2);

  const ring: Point[] = simplify([...pts, pts[0]], 0.055 * diag);
  ring.pop();
  const k = ring.length;
  const polyPx = k >= 3 && k <= 6 ? meanDistToPolygon(pts, ring) : Infinity;

  const best = Math.min(ellPx, polyPx);
  if (best > 0.06 * diag) return null;

  if (ellPx <= polyPx) {
    const circle = Math.abs(rx - ry) < 0.14 * Math.max(rx, ry);
    const r = (rx + ry) / 2;
    return circle
      ? { type: "ellipse", x: round1(cx - r), y: round1(cy - r), w: round1(2 * r), h: round1(2 * r), f: null, ...base }
      : { type: "ellipse", x: round1(bb.x), y: round1(bb.y), w: round1(bb.w), h: round1(bb.h), f: null, ...base };
  }

  const rounded = (arr: Point[]): Point[] => arr.map((q): Point => [round1(q[0]), round1(q[1])]);
  if (k === 4) {
    // close to a rectangle?
    const ang = (i: number): number => {
      const a = ring[(i + 3) % 4], b = ring[i], c = ring[(i + 1) % 4];
      const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
      return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1))));
    };
    const rect = [0, 1, 2, 3].every((i) => Math.abs(ang(i) - Math.PI / 2) < (22 * Math.PI) / 180);
    if (rect) {
      const horiz = ring.every((q, i) => {
        const n = ring[(i + 1) % 4];
        const a = Math.atan2(n[1] - q[1], n[0] - q[0]);
        return Math.min(Math.abs(Math.sin(a)), Math.abs(Math.cos(a))) < Math.sin((12 * Math.PI) / 180);
      });
      const pts4: Point[] = horiz
        ? [[bb.x, bb.y], [bb.x + bb.w, bb.y], [bb.x + bb.w, bb.y + bb.h], [bb.x, bb.y + bb.h]]
        : ring;
      return { type: "polygon", pts: rounded(pts4), labs: "", f: null, ...base };
    }
  }
  const tri = k === 3;
  return {
    type: "polygon", pts: rounded(ring), labs: LABELS.slice(0, k), f: null,
    ...(tri ? { marks: true, cons: [] } : {}), ...base,
  };
}
