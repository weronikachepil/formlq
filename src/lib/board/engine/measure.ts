// Measurements: side lengths, angles, area. Unit: 1 grid cell = 1 cm.
import { centroid } from "./geom";
import { uiFont } from "./fonts";
import type { Point, PolygonObject } from "./types";

export const UNIT = 40; // board pixels per 1 cm

export const fmtNum = (v: number, d = 1): string => {
  const s = String(parseFloat(v.toFixed(d)));
  return s.replace(".", ",");
};
export const fmtLen = (px: number): string => `${fmtNum(px / UNIT)} см`;

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#1d1b2e"): void {
  ctx.save();
  ctx.font = `600 15px ${uiFont()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Length of segment a–b, labelled on the side away from the shape centre `from`; `text` overrides the value.
export function drawLength(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  from?: Point | null,
  text?: string | null,
): void {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const l = Math.hypot(nx, ny) || 1;
  nx /= l; ny /= l;
  if (from && nx * (mx - from[0]) + ny * (my - from[1]) < 0) { nx = -nx; ny = -ny; }
  tag(ctx, text !== undefined && text !== null ? text : fmtLen(l), mx + nx * 15, my + ny * 15, "#0b7285");
}

export function polygonArea(pts: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

export interface InteriorAngle {
  /** Interior angle, radians. */
  a: number;
  /** Direction of the outgoing side, radians. */
  start: number;
  /** Orientation sign of the polygon (±1). */
  sgn: number;
}

export function interiorAngles(pts: readonly Point[]): InteriorAngle[] {
  const n = pts.length;
  const sgn = Math.sign(polygonArea(pts)) || 1;
  return pts.map((cur, i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
    const u = [next[0] - cur[0], next[1] - cur[1]];
    const v = [prev[0] - cur[0], prev[1] - cur[1]];
    const th = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
    let a = sgn * th;
    if (a < 0) a += 2 * Math.PI;
    return { a, start: Math.atan2(u[1], u[0]), sgn };
  });
}

export const sideLengths = (pts: readonly Point[]): number[] =>
  pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]));
export const angleDegrees = (pts: readonly Point[]): number[] => interiorAngles(pts).map((x) => (x.a * 180) / Math.PI);
const set = (v: string | null | undefined): v is string => v !== undefined && v !== null;

export function drawMeasures(ctx: CanvasRenderingContext2D, o: PolygonObject): void {
  const pts = o.pts;
  const c = centroid(pts);
  ctx.save();
  // Side lengths: a custom label takes priority over the computed value.
  for (let i = 0; i < pts.length; i++) {
    const custom = o.sidet?.[i];
    if (set(custom)) drawLength(ctx, pts[i], pts[(i + 1) % pts.length], c, custom);
    else if (o.lens) drawLength(ctx, pts[i], pts[(i + 1) % pts.length], c);
  }
  if (o.angs || o.angt?.some(set)) {
    const angs = interiorAngles(pts);
    angs.forEach(({ a, start, sgn }, i) => {
      const custom = o.angt?.[i];
      if (!set(custom) && !o.angs) return;
      const p = pts[i];
      const r = 24;
      const deg = (a * 180) / Math.PI;
      const right = Math.abs(deg - 90) < 0.6;
      if (!right) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, start, start + sgn * a, sgn < 0);
        ctx.strokeStyle = "#c2255c";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      const mid = start + (sgn * a) / 2;
      const label = set(custom) ? custom : `${fmtNum(deg, Math.abs(deg - Math.round(deg)) < 0.05 ? 0 : 1)}°`;
      tag(ctx, label, p[0] + Math.cos(mid) * (r + 17), p[1] + Math.sin(mid) * (r + 17), "#c2255c");
    });
  }
  if (o.area && pts.length >= 3) {
    tag(ctx, `S = ${fmtNum(Math.abs(polygonArea(pts)) / (UNIT * UNIT), 2)} см²`, c[0], c[1], "#5f3dc4");
  }
  ctx.restore();
}
