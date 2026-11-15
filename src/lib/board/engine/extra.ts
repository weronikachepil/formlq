// Extra object types: image, arc (compass), ruler, protractor, page;
// plus rotation for frame objects (ellipse, text, formula, image).
import { uiFont } from "./fonts";
import {
  boundsOfPoints, clamp, distToSegment, inBounds, mapPoint, normAngle, rotPoint, round1,
} from "./geom";
import type {
  ArcObject, BoardObject, Bounds, BoxFields, ImageObject, ObjectTypeDef, PageObject, Point, ProtractorObject,
  Rotatable, RulerObject,
} from "./types";

const box = (o: BoxFields): Bounds => ({ x: o.x, y: o.y, w: o.w, h: o.h });
const center = (o: BoxFields): Point => [o.x + o.w / 2, o.y + o.h / 2];
const rp = (p: Point, a: number, cx: number, cy: number): Point => {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = p[0] - cx, dy = p[1] - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};

/** Frame corners in board coordinates (rotation applied). */
export function corners(o: Rotatable): Point[] {
  const c = center(o);
  const pts: Point[] = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
  const rot = o.rot;
  return rot ? pts.map((p) => rp(p, rot, c[0], c[1])) : pts;
}

/** Adds rotation (the `rot` field) to a type with an x, y, w, h frame. Mutates and returns `t`. */
export function withRotation<O extends BoardObject & Rotatable>(t: ObjectTypeDef<O>): ObjectTypeDef<O> {
  const base = { bounds: t.bounds, draw: t.draw, hit: t.hit, fit: t.fit };
  t.bounds = (o) => (o.rot ? boundsOfPoints(corners(o)) : base.bounds(o));
  t.draw = (ctx, o, env) => {
    if (!o.rot) { base.draw(ctx, o, env); return; }
    const c = center(o);
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.rotate(o.rot);
    ctx.translate(-c[0], -c[1]);
    base.draw(ctx, o, env);
    ctx.restore();
  };
  t.hit = (o, p, tol) => {
    if (!o.rot) return base.hit(o, p, tol);
    const c = center(o);
    return base.hit(o, rp(p, -o.rot, c[0], c[1]), tol);
  };
  t.fit = (o, from, to) => {
    if (!o.rot) return base.fit(o, from, to);
    const sx = from.w ? to.w / from.w : 1;
    const sy = from.h ? to.h / from.h : 1;
    const nc = mapPoint(center(o), from, to);
    const nw = o.w * sx;
    const nh = o.h * sy;
    return { ...base.fit(o, box(o), { x: nc[0] - nw / 2, y: nc[1] - nh / 2, w: nw, h: nh }), rot: o.rot };
  };
  t.rotate = (o, a, cx, cy) => {
    const nc = rp(center(o), a, cx, cy);
    return { ...o, x: round1(nc[0] - o.w / 2), y: round1(nc[1] - o.h / 2), rot: normAngle((o.rot || 0) + a) };
  };
  return t;
}

/** Rotates every point of a `pts` object about (cx, cy). */
export const rotatePtsObj = <O extends { pts: Point[] }>(o: O, a: number, cx: number, cy: number): O => ({ ...o, pts: o.pts.map((p) => rotPoint(p, a, cx, cy)) });

// ---------- image ----------
const imgCache = new Map<string, { src: string; img: HTMLImageElement }>();
function imageFor(o: ImageObject, repaint: (() => void) | undefined): HTMLImageElement {
  let e = imgCache.get(o.id);
  if (!e || e.src !== o.src) {
    const img = new Image();
    img.onload = () => repaint?.();
    img.src = o.src;
    e = { src: o.src, img };
    imgCache.set(o.id, e);
  }
  return e.img;
}

// Downscaled copies (each half the previous size), so a big image at a small zoom is not
// resampled at full size every frame.
type MipLevel = HTMLImageElement | HTMLCanvasElement;
const mipCache = new Map<string, { src: string; levels: MipLevel[] }>();
function mipFor(o: ImageObject, img: HTMLImageElement, scale: number): MipLevel {
  if (scale >= 0.5) return img;
  const m = Math.min(4, Math.floor(Math.log2(1 / scale)));
  if (m < 1) return img;
  let e = mipCache.get(o.id);
  if (!e || e.src !== o.src) { e = { src: o.src, levels: [img] }; mipCache.set(o.id, e); }
  for (let i = e.levels.length; i <= m; i++) {
    const prev = e.levels[i - 1];
    const pw = (prev instanceof HTMLImageElement && prev.naturalWidth) || prev.width;
    const ph = (prev instanceof HTMLImageElement && prev.naturalHeight) || prev.height;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(pw / 2));
    c.height = Math.max(1, Math.round(ph / 2));
    const cx = c.getContext("2d");
    if (!cx) return img;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(prev, 0, 0, c.width, c.height);
    e.levels.push(c);
  }
  return e.levels[m];
}

const FULL_CROP: [number, number, number, number] = [0, 0, 1, 1];

/** Where the whole (uncropped) image lies on the board, given the object's visible frame. */
export function imageFullRect(o: ImageObject): Bounds {
  const [cx, cy, cw, ch] = o.crop || FULL_CROP;
  const w = o.w / cw;
  const h = o.h / ch;
  return { x: o.x - cx * w, y: o.y - cy * h, w, h };
}

/** The image showing `frame` of its whole rect `full`; `crop` is dropped when nothing is cut off. */
export function cropToFrame(o: ImageObject, full: Bounds, frame: Bounds): ImageObject {
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  const crop: [number, number, number, number] = [
    r((frame.x - full.x) / full.w), r((frame.y - full.y) / full.h), r(frame.w / full.w), r(frame.h / full.h),
  ];
  const whole = crop[0] <= 0.001 && crop[1] <= 0.001 && crop[2] >= 0.999 && crop[3] >= 0.999;
  const next: ImageObject = { ...o, x: round1(frame.x), y: round1(frame.y), w: round1(frame.w), h: round1(frame.h) };
  if (whole) delete next.crop;
  else next.crop = crop;
  return next;
}

/** Draws the image (or its loading placeholder) so its whole rect lands on `full`, clipped to the object's frame. */
export function drawImageObject(ctx: CanvasRenderingContext2D, o: ImageObject, env: { zoom?: number; repaint?: () => void } | undefined, full = false): void {
  const img = imageFor(o, env?.repaint);
  const fr = imageFullRect(o);
  if (!(img.complete && img.naturalWidth)) {
    ctx.save();
    ctx.fillStyle = "#f1f0f8";
    if (full) ctx.fillRect(fr.x, fr.y, fr.w, fr.h);
    else ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.restore();
    return;
  }
  const scale = ((env?.zoom || 1) * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1) * fr.w) / img.naturalWidth;
  const src = mipFor(o, img, scale);
  if (full || !o.crop) { ctx.drawImage(src, fr.x, fr.y, fr.w, fr.h); return; }
  const sw = (src instanceof HTMLImageElement && src.naturalWidth) || src.width;
  const sh = (src instanceof HTMLImageElement && src.naturalHeight) || src.height;
  const [cx, cy, cw, ch] = o.crop;
  ctx.drawImage(src, cx * sw, cy * sh, cw * sw, ch * sh, o.x, o.y, o.w, o.h);
}

export const IMAGE_TYPE: ObjectTypeDef<ImageObject> = withRotation<ImageObject>({
  bounds: box,
  draw(ctx, o, env) {
    drawImageObject(ctx, o, env);
  },
  hit: (o, p, tol) => inBounds(box(o), p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(20, to.w)), h: round1(Math.max(20, to.h)) }),
});

// ---------- arc (drawn with the compass) ----------
const arcPoints = (o: ArcObject, n = 48): Point[] => {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = o.a0 + ((o.a1 - o.a0) * i) / n;
    pts.push([o.cx + Math.cos(a) * o.r, o.cy + Math.sin(a) * o.r]);
  }
  return pts;
};

export const ARC_TYPE: ObjectTypeDef<ArcObject> = {
  bounds: (o) => boundsOfPoints(arcPoints(o)),
  draw(ctx, o) {
    ctx.save();
    ctx.strokeStyle = o.c;
    ctx.lineWidth = o.s;
    ctx.lineCap = "round";
    if (o.dash) ctx.setLineDash([o.s * 3.2, o.s * 2.4]);
    ctx.beginPath();
    ctx.arc(o.cx, o.cy, o.r, o.a0, o.a1, o.a1 < o.a0);
    ctx.stroke();
    ctx.restore();
  },
  hit(o, p, tol) {
    const d = Math.hypot(p[0] - o.cx, p[1] - o.cy);
    if (Math.abs(d - o.r) > tol + o.s / 2) return false;
    const lo = Math.min(o.a0, o.a1), span = Math.abs(o.a1 - o.a0);
    if (span >= Math.PI * 2 - 1e-6) return true;
    let a = Math.atan2(p[1] - o.cy, p[0] - o.cx) - lo;
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    return a <= span + 0.04;
  },
  move: (o, dx, dy) => ({ ...o, cx: round1(o.cx + dx), cy: round1(o.cy + dy) }),
  fit(o, from, to) {
    const c = mapPoint([o.cx, o.cy], from, to);
    const k = Math.sqrt(((from.w ? to.w / from.w : 1) * (from.h ? to.h / from.h : 1)) || 1);
    return { ...o, cx: c[0], cy: c[1], r: round1(Math.max(2, o.r * k)) };
  },
  rotate(o, a, cx, cy) {
    const c = rotPoint([o.cx, o.cy], a, cx, cy);
    return { ...o, cx: c[0], cy: c[1], a0: o.a0 + a, a1: o.a1 + a };
  },
};

// ---------- ruler ----------
const CM = 40; // 1 cm = 40 board pixels

export const RULER_TYPE: ObjectTypeDef<RulerObject> = withRotation<RulerObject>({
  bounds: box,
  draw(ctx, o) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, o.h, 8);
    ctx.fillStyle = "rgba(255, 233, 150, 0.82)";
    ctx.fill();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const x0 = o.x + 14;
    const steps = Math.floor((o.w - 28) / (CM / 10));
    ctx.strokeStyle = "#5c4b05";
    ctx.fillStyle = "#5c4b05";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i * CM) / 10;
      const len = i % 10 === 0 ? 20 : i % 5 === 0 ? 14 : 8;
      ctx.moveTo(x, o.y);
      ctx.lineTo(x, o.y + len);
    }
    ctx.stroke();
    ctx.font = `12px ${uiFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 10; i <= steps; i += 10) ctx.fillText(String(i / 10), x0 + (i * CM) / 10, o.y + 23);
    ctx.textAlign = "left";
    ctx.fillText("см", o.x + o.w - 30, o.y + o.h - 20);
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds(box(o), p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(120, to.w)), h: o.h }),
});

/** Ruler edges in board coordinates: [top, bottom], each [start, end]. */
export function rulerEdges(o: Rotatable): [[Point, Point], [Point, Point]] {
  const c = center(o);
  const rot = o.rot;
  const r = (p: Point): Point => (rot ? rp(p, rot, c[0], c[1]) : p);
  return [
    [r([o.x, o.y]), r([o.x + o.w, o.y])],
    [r([o.x, o.y + o.h]), r([o.x + o.w, o.y + o.h])],
  ];
}

/** The ruler edge a point snapped to: segment a–b, distance d, ruler id. */
export interface RulerSnap {
  a: Point;
  b: Point;
  d: number;
  id: string;
}

/** Snaps a point to the nearest ruler edge within `tol`, or returns null. */
export function snapToRuler(rulers: Iterable<RulerObject>, p: Point, tol: number): RulerSnap | null {
  let best: RulerSnap | null = null;
  for (const o of rulers) {
    for (const [a, b] of rulerEdges(o)) {
      const d = distToSegment(p, a, b);
      if (d <= tol && (!best || d < best.d)) best = { a, b, d, id: o.id };
    }
  }
  return best;
}

export function projectOnLine(p: Point, a: Point, b: Point, clampSeg = true): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  if (clampSeg) t = clamp(t, 0, 1);
  return [a[0] + dx * t, a[1] + dy * t];
}

// ---------- protractor ----------
export const PROTRACTOR_TYPE: ObjectTypeDef<ProtractorObject> = withRotation<ProtractorObject>({
  bounds: box,
  draw(ctx, o) {
    const font = uiFont();
    const r = o.w / 2;
    const cx = o.x + r;
    const cy = o.y + r;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.lineTo(cx + r, cy + 24);
    ctx.lineTo(cx - r, cy + 24);
    ctx.closePath();
    ctx.fillStyle = "rgba(116, 192, 252, 0.26)";
    ctx.fill();
    ctx.strokeStyle = "#1c7ed6";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // inner half-circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.42, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();
    // ticks
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = 0; d <= 180; d++) {
      const a = (d * Math.PI) / 180;
      const len = d % 10 === 0 ? 14 : d % 5 === 0 ? 10 : 6;
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(cx + ca * r, cy - sa * r);
      ctx.lineTo(cx + ca * (r - len), cy - sa * (r - len));
    }
    ctx.stroke();
    ctx.fillStyle = "#1864ab";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let d = 0; d <= 180; d += 10) {
      const a = (d * Math.PI) / 180;
      ctx.font = `11px ${font}`;
      ctx.fillText(String(d), cx + Math.cos(a) * (r - 25), cy - Math.sin(a) * (r - 25));
      ctx.font = `9px ${font}`;
      ctx.fillText(String(180 - d), cx + Math.cos(a) * (r * 0.42 + 12), cy - Math.sin(a) * (r * 0.42 + 12));
    }
    // centre
    ctx.strokeStyle = "#e03131";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds(box(o), p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit(o, _from, to) {
    const w = Math.max(160, to.w);
    return { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1(w / 2 + 24) };
  },
});

// ---------- page (service object: only name and order) ----------
export const PAGE_TYPE: ObjectTypeDef<PageObject> = {
  bounds: () => ({ x: 0, y: 0, w: 0, h: 0 }),
  draw() {},
  hit: () => false,
  move: (o) => o,
  fit: (o) => o,
};

export function clearImageCache(): void { imgCache.clear(); }
