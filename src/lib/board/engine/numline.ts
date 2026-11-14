// Number line with intervals: each interval has bounds (null = infinity) and "inclusive" flags.
import { uiFont } from "./fonts";
import { inBounds, round1 } from "./geom";
import type { NumlineInterval, NumlineObject, ObjectTemplate, ObjectTypeDef } from "./types";

export const NL_COLORS = ["#1d1b2e", "#e03131", "#1971c2", "#2f9e44", "#e8590c", "#7048e8"];

export function makeNumline(extra: Partial<NumlineObject> = {}): ObjectTemplate<NumlineObject> {
  return { type: "numline", c: "#1d1b2e", w: 560, h: 110, ivs: [makeInterval(0)], ...extra };
}

export function makeInterval(i = 0): NumlineInterval {
  return { a: null, b: null, ai: true, bi: true, c: NL_COLORS[i % NL_COLORS.length] };
}

const fmt = (v: number) => String(Math.round(v * 1e6) / 1e6).replace("-", "−").replace(".", ",");

/** Axis range and tick step from the finite interval bounds. */
export function nlRange(o: Pick<NumlineObject, "ivs">): { lo: number; hi: number; step: number } {
  const vals: number[] = [];
  for (const iv of o.ivs || []) {
    if (iv.a !== null && iv.a !== undefined) vals.push(iv.a);
    if (iv.b !== null && iv.b !== undefined) vals.push(iv.b);
  }
  let lo = vals.length ? Math.min(...vals) : -5;
  let hi = vals.length ? Math.max(...vals) : 5;
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
  const pad = Math.max((hi - lo) * 0.18, 0.5);
  lo -= pad; hi += pad;
  const raw = (hi - lo) / 9;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw) || raw;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}

export const NUMLINE_TYPE: ObjectTypeDef<NumlineObject> = {
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  draw(ctx, o) {
    const k = o.h / 110;
    const { lo, hi, step } = nlRange(o);
    const x0 = o.x + 28 * k, x1 = o.x + o.w - 28 * k;
    const X = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    const y = o.y + o.h * 0.45;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // axis with an arrow
    const ink = o.c || "#1d1b2e";
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.moveTo(o.x + 6 * k, y); ctx.lineTo(o.x + o.w - 6 * k, y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x + o.w - 6 * k, y); ctx.lineTo(o.x + o.w - 18 * k, y - 6 * k); ctx.lineTo(o.x + o.w - 18 * k, y + 6 * k);
    ctx.closePath(); ctx.fill();
    // ticks and numbers
    ctx.font = `600 ${15 * k}px ${uiFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 2 * k;
    ctx.fillStyle = ink;
    const n = Math.round((hi - lo) / step);
    for (let i = 0; i <= n; i++) {
      const v = lo + i * step;
      const x = X(v);
      ctx.beginPath(); ctx.moveTo(x, y - 6 * k); ctx.lineTo(x, y + 6 * k); ctx.stroke();
      ctx.fillText(fmt(v), x, y + 12 * k);
    }
    // intervals: thick band and dots at the bounds
    (o.ivs || []).forEach((iv) => {
      const a = iv.a, b = iv.b;
      const inf0 = a === null || a === undefined;
      const inf1 = b === null || b === undefined;
      const xa = inf0 ? o.x + 6 * k : X(a);
      const xb = inf1 ? o.x + o.w - 6 * k : X(b);
      ctx.strokeStyle = iv.c;
      ctx.fillStyle = iv.c;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 7 * k;
      ctx.beginPath(); ctx.moveTo(Math.min(xa, xb), y); ctx.lineTo(Math.max(xa, xb), y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3 * k;
      const dot = (x: number, incl: boolean) => {
        ctx.beginPath(); ctx.arc(x, y, 7 * k, 0, Math.PI * 2);
        ctx.fillStyle = incl ? iv.c : "#fff";
        ctx.fill(); ctx.stroke();
      };
      if (!inf0) dot(xa, iv.ai !== false);
      if (!inf1) dot(xb, iv.bi !== false);
    });
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: o.w, h: o.h }, p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, _from, to) => {
    const w = Math.max(240, to.w);
    return { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1((w * o.h) / o.w) };
  },
};
