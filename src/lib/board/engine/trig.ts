// Trigonometric circle with a draggable point: sin, cos, tg, ctg and exact values for standard angles.
import { inBounds, round1 } from "./geom";
import { uiFont } from "./fonts";
import type { ObjectDraft, ObjectTypeDef, Point, TrigObject } from "./types";

const TAU = Math.PI * 2;
const SIN_C = "#e03131";
const COS_C = "#1971c2";
const TAN_C = "#2f9e44";
const COT_C = "#e8590c";

type TrigDraft = ObjectDraft<TrigObject>;
type TrigDefaults = Pick<TrigDraft, "type" | "w" | "h" | "ang" | "snap" | "showCot" | "showRad">;

/** Trig defaults merged with `extra` (callers supply at least x and y). */
export function makeTrig(): TrigDefaults;
export function makeTrig<E extends Partial<TrigDraft>>(extra: E): TrigDefaults & E;
export function makeTrig(extra: Partial<TrigDraft> = {}): Partial<TrigDraft> {
  const base: TrigDefaults = { type: "trig", w: 580, h: 430, ang: Math.PI / 6, snap: true, showCot: false, showRad: true };
  return { ...base, ...extra };
}

export interface TrigGeom {
  cx: number;
  cy: number;
  R: number;
  leftW: number;
}

export function trigGeom(o: TrigObject): TrigGeom {
  const leftW = o.w * 0.62;
  const R = Math.min(leftW / 2 - 72, o.h / 2 - 60);
  return { cx: o.x + leftW / 2, cy: o.y + o.h / 2, R, leftW };
}

// Angle (0…2π) from the pointer position; snaps to multiples of 15° when `snap` is on.
export function trigAngleAt(o: TrigObject, p: Point): number {
  const { cx, cy } = trigGeom(o);
  let a = Math.atan2(-(p[1] - cy), p[0] - cx);
  if (a < 0) a += TAU;
  if (o.snap) {
    const step = Math.PI / 12;
    const k = Math.round(a / step);
    if (Math.abs(a - k * step) < (3.2 * Math.PI) / 180) a = k * step;
  }
  return ((a % TAU) + TAU) % TAU;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export function radLabel(deg: number): string {
  if (deg === 0) return "0";
  const g = gcd(deg, 180);
  const n = deg / g, d = 180 / g;
  return `${n === 1 ? "" : n}π${d === 1 ? "" : "/" + d}`;
}

type TrigValues = [sin: string, cos: string, tan: string, cot: string];

// Exact [sin, cos, tg, ctg] for multiples of 30° and 45°.
const REF: Record<number, TrigValues> = {
  30: ["1/2", "√3/2", "√3/3", "√3"],
  45: ["√2/2", "√2/2", "1", "1"],
  60: ["√3/2", "1/2", "√3", "√3/3"],
};
export function exactValues(deg: number): TrigValues | null {
  const d = ((deg % 360) + 360) % 360;
  if (!(d % 30 === 0 || d % 45 === 0)) return null;
  if (d % 90 === 0) {
    const s = d === 90 ? "1" : d === 270 ? "−1" : "0";
    const c = d === 0 ? "1" : d === 180 ? "−1" : "0";
    return [s, c, d % 180 === 0 ? "0" : "—", d % 180 === 0 ? "—" : "0"];
  }
  const q = Math.floor(d / 90);
  const r = d % 90;
  const ref = q % 2 === 0 ? r : 90 - r; // acute reference angle
  const R = REF[ref];
  const sinS = [1, 1, -1, -1][q];
  const cosS = [1, -1, -1, 1][q];
  const tanS = sinS * cosS;
  const sg = (sign: number, str: string) => (sign < 0 ? "−" + str : str);
  return [sg(sinS, R[0]), sg(cosS, R[1]), sg(tanS, R[2]), sg(tanS, R[3])];
}

const num = (v: number) => String(parseFloat(v.toFixed(3))).replace("-", "−").replace(".", ",");

function arrowTo(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  font = `600 14px ${uiFont()}`,
  align: CanvasTextAlign = "center",
): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export const TRIG_TYPE: ObjectTypeDef<TrigObject> = {
  interactive: true,
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  draw(ctx, o, env) {
    const { cx, cy, R, leftW } = trigGeom(o);
    const a = o.ang;
    const sin = Math.sin(a), cos = Math.cos(a);
    const px = cx + R * cos, py = cy - R * sin;
    const deg = (a * 180) / Math.PI;
    const degR = Math.round(deg);
    const onGrid = Math.abs(deg - degR) < 0.05;
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, o.h, 18);
    ctx.fill();
    ctx.save();
    ctx.clip();

    // axes
    ctx.strokeStyle = "#1d1b2e";
    ctx.fillStyle = "#1d1b2e";
    ctx.lineWidth = 1.6;
    arrowTo(ctx, cx - R - 34, cy, cx + R + 52, cy);
    arrowTo(ctx, cx, cy + R + 34, cx, cy - R - 52);
    label(ctx, "x", cx + R + 58, cy + 16, "#1d1b2e", `italic 600 16px "Times New Roman", serif`);
    label(ctx, "y", cx + 16, cy - R - 58, "#1d1b2e", `italic 600 16px "Times New Roman", serif`);

    // circle and angle ticks
    ctx.strokeStyle = "#1d1b2e";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    for (let d = 0; d < 360; d += 15) {
      const t = (d * Math.PI) / 180;
      const major = d % 30 === 0 || d % 45 === 0;
      ctx.beginPath();
      ctx.moveTo(cx + (R - (major ? 7 : 4)) * Math.cos(t), cy - (R - (major ? 7 : 4)) * Math.sin(t));
      ctx.lineTo(cx + (R + (major ? 7 : 4)) * Math.cos(t), cy - (R + (major ? 7 : 4)) * Math.sin(t));
      ctx.stroke();
      if (major) {
        // Hide the label under the moving point (its value is shown on the right).
        let dd = Math.abs(d - deg);
        if (dd > 180) dd = 360 - dd;
        if (dd < 9) continue;
        const c2 = Math.cos(t), s2 = Math.sin(t);
        const place = (txt: string, x: number, y: number, col: string, font: string, align: CanvasTextAlign) =>
          label(ctx, txt, x, y, col, font, align);
        let x: number, y: number, align: CanvasTextAlign;
        if (d === 0) { x = cx + R + 12; y = cy + 18; align = "left"; }
        else if (d === 180) { x = cx - R - 12; y = cy + 18; align = "right"; }
        else if (d === 90) { x = cx - 12; y = cy - R - 22; align = "right"; }
        else if (d === 270) { x = cx + 12; y = cy + R + 24; align = "left"; }
        else {
          // 45°, 135°… sit between the 30° marks; push them further out so labels don't overlap.
          const rr = d % 30 === 0 ? R + 16 : R + 46;
          x = cx + rr * c2;
          y = cy - rr * s2;
          align = c2 > 0.25 ? "left" : c2 < -0.25 ? "right" : "center";
        }
        place(`${d}°`, x, y - (o.showRad ? 7 : 0), "#495057", `600 11px ${uiFont()}`, align);
        if (o.showRad) place(radLabel(d), x, y + 7, "#868e96", `600 10px ${uiFont()}`, align);
      }
    }

    // angle arc
    ctx.strokeStyle = "#7048e8";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, -a, true);
    ctx.stroke();
    label(ctx, "α", cx + 40 * Math.cos(a / 2), cy - 40 * Math.sin(a / 2), "#7048e8", `italic 600 17px "Times New Roman", serif`);

    // projections: cos (blue) and sin (red)
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = COS_C;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();
    ctx.strokeStyle = SIN_C;
    ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();
    // tangent
    if (Math.abs(cos) > 1e-3) {
      const ty = cy - R * (sin / cos);
      if (Math.abs(ty - cy) < R * 1.6) {
        ctx.strokeStyle = TAN_C;
        ctx.beginPath(); ctx.moveTo(cx + R, cy); ctx.lineTo(cx + R, ty); ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, ty); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // cotangent
    if (o.showCot && Math.abs(sin) > 1e-3) {
      const tx = cx + R * (cos / sin);
      if (Math.abs(tx - cx) < R * 1.6) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = COT_C;
        ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(tx, cy - R); ctx.stroke();
      }
    }
    // radius and point
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#1d1b2e";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    label(ctx, "cos α", (cx + px) / 2, cy + (sin >= 0 ? 15 : -15), COS_C, `600 13px ${uiFont()}`);
    label(ctx, "sin α", px + (cos >= 0 ? -30 : 30), (cy + py) / 2, SIN_C, `600 13px ${uiFont()}`);
    ctx.fillStyle = "#7048e8";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore(); // clip

    // value table on the right
    const ex = onGrid ? exactValues(degR) : null;
    const vals = [Math.sin(a), Math.cos(a), Math.tan(a), 1 / Math.tan(a)];
    const bad = (i: number) => (i === 2 && Math.abs(cos) < 1e-9) || (i === 3 && Math.abs(sin) < 1e-9);
    const px0 = o.x + leftW + 6;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#7048e8";
    ctx.font = `700 17px ${uiFont()}`;
    ctx.fillText(`α = ${num(deg)}°`, px0, o.y + 44);
    if (onGrid) { ctx.font = `600 15px ${uiFont()}`; ctx.fillStyle = "#868e96"; ctx.fillText(`= ${radLabel(((degR % 360) + 360) % 360)} рад`, px0, o.y + 68); }
    else { ctx.font = `600 15px ${uiFont()}`; ctx.fillStyle = "#868e96"; ctx.fillText(`= ${num(a)} рад`, px0, o.y + 68); }
    const rows: [string, string][] = [["sin α", SIN_C], ["cos α", COS_C], ["tg α", TAN_C], ["ctg α", COT_C]];
    rows.forEach(([name, col], i) => {
      if (i === 3 && !o.showCot) return;
      const y = o.y + 118 + i * 58;
      ctx.fillStyle = col;
      ctx.font = `700 17px ${uiFont()}`;
      ctx.fillText(name, px0, y);
      ctx.fillStyle = "#1d1b2e";
      ctx.font = `700 19px ${uiFont()}`;
      const val = bad(i) ? "не існує" : ex && ex[i] !== undefined && ex[i] !== "—" ? ex[i] : num(vals[i]);
      ctx.fillText(`= ${val}`, px0 + 62, y);
      if (!bad(i) && ex && ex[i] && ex[i] !== "—" && /[√/]/.test(ex[i])) {
        ctx.fillStyle = "#868e96";
        ctx.font = `600 13px ${uiFont()}`;
        ctx.fillText(`≈ ${num(vals[i])}`, px0 + 62, y + 20);
      }
    });
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = env.interactingId === o.id ? "#6d3df0" : "#cfcbe6";
    ctx.lineWidth = Math.max(1.5, 1.3 / env.zoom);
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, o.h, 18);
    ctx.stroke();
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: o.w, h: o.h }, p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, from, to) => {
    const w = Math.max(380, to.w);
    return { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1((w * 430) / 580) };
  },
};
