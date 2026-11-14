// Primary-school arithmetic: column operations (+ − × ÷, fractions) and fraction models (circle, strip).
import { uiFont } from "./fonts";
import { inBounds, round1 } from "./geom";
import type {
  ArithSign, Bounds, ColmathObject, ColmathOp, FmodelKind, FmodelObject, ObjectDraft, ObjectTypeDef, Point,
} from "./types";

const INK = "#1d1b2e";
const GRID = "#cfd8f2";
const EDGE = "#364fc7";

// ---------- column operation ----------
export function makeColmath(op: ColmathOp, extra: Partial<ColmathObject> = {}): ObjectDraft<ColmathObject> {
  const frac = op === "frac";
  return { type: "colmath", op, c: "#1d1b2e", fop: "+", a: frac ? "1/2" : op === "÷" ? "96" : "348", b: frac ? "1/3" : op === "÷" ? "4" : "25", cell: 44, x: 0, y: 0, ...extra };
}

const SIGN: Record<ArithSign, string> = { "+": "+", "−": "−", "×": "×", "÷": "÷" };
const fparts = (t: string | null | undefined): [string, string] => {
  const [p, q = ""] = String(t || "").split("/");
  return [p.trim(), q.trim()];
};
const fwidth = (t: string | null | undefined) => { const [p, q] = fparts(t); return Math.max(1, p.length, q.length); };

type ColmathShape = Pick<ColmathObject, "op" | "a" | "b">;

/** Grid size in cells. */
export function colmathGrid(o: ColmathShape): { cols: number; rows: number } {
  const la = String(o.a || "").length || 1;
  const lb = String(o.b || "").length || 1;
  if (o.op === "frac") return { cols: fwidth(o.a) + fwidth(o.b) + 5, rows: 8 };
  if (o.op === "×") return { cols: la + lb + 1, rows: 2 + (lb > 1 ? lb + 1 : 1) };
  if (o.op === "÷") return { cols: la + 1 + Math.max(lb + 1, la), rows: Math.max(3, Math.min(2 * la + 1, 9)) };
  return { cols: Math.max(la, lb) + 1, rows: 3 };
}

export const colmathBox = (o: ColmathShape & Pick<ColmathObject, "x" | "y" | "cell">): Bounds => {
  const g = colmathGrid(o);
  return { x: o.x, y: o.y, w: g.cols * o.cell, h: g.rows * o.cell };
};

function frac(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, cell: number, fw: number) {
  const [p, q] = fparts(t);
  const cx = x + (fw * cell) / 2;
  ctx.fillText(p, cx, y + cell * 0.5);
  ctx.fillText(q, cx, y + cell * 1.5);
  ctx.beginPath(); ctx.moveTo(x + cell * 0.1, y + cell); ctx.lineTo(x + fw * cell - cell * 0.1, y + cell); ctx.stroke();
}

export const COLMATH_TYPE: ObjectTypeDef<ColmathObject> = {
  bounds: colmathBox,
  draw(ctx, o) {
    const c = o.cell;
    const { cols, rows } = colmathGrid(o);
    const a = String(o.a || ""), b = String(o.b || "");
    ctx.save();
    // notebook cells
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) { ctx.moveTo(o.x + i * c, o.y); ctx.lineTo(o.x + i * c, o.y + rows * c); }
    for (let j = 0; j <= rows; j++) { ctx.moveTo(o.x, o.y + j * c); ctx.lineTo(o.x + cols * c, o.y + j * c); }
    ctx.stroke();
    ctx.fillStyle = o.c || INK;
    ctx.strokeStyle = o.c || INK;
    ctx.lineCap = "round";
    ctx.lineWidth = o.s ? Math.max(1.5, o.s * 0.8) : 2.6;
    ctx.font = `600 ${c * 0.62}px ${uiFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const put = (ch: string, col: number, row: number) => ctx.fillText(ch, o.x + (col + 0.5) * c, o.y + (row + 0.5) * c + 1);
    const line = (x0: number, y0: number, x1: number, y1: number) => { ctx.beginPath(); ctx.moveTo(o.x + x0 * c, o.y + y0 * c); ctx.lineTo(o.x + x1 * c, o.y + y1 * c); ctx.stroke(); };

    if (o.op === "frac") {
      const fa = fwidth(a), fb = fwidth(b);
      // on the level of the fraction bar
      const mid = (ch: string, col: number, row: number) => ctx.fillText(ch, o.x + (col + 0.5) * c, o.y + row * c + 1);
      frac(ctx, a, o.x, o.y, c, fa);
      mid(SIGN[o.fop] || "+", fa, 1);
      frac(ctx, b, o.x + (fa + 1) * c, o.y, c, fb);
      mid("=", fa + 1 + fb, 1);
      for (let r = 1; r < 4; r++) mid("=", 0, r * 2 + 1);
    } else if (o.op === "÷") {
      for (let i = 0; i < a.length; i++) put(a[i], i, 0);
      const bx = a.length;
      line(bx, 0, bx, rows);
      for (let i = 0; i < b.length; i++) put(b[i], bx + 1 + i, 0);
      line(bx, 1, cols, 1);
    } else {
      for (let i = 0; i < a.length; i++) put(a[i], cols - a.length + i, 0);
      for (let i = 0; i < b.length; i++) put(b[i], cols - b.length + i, 1);
      put(SIGN[o.op] || "+", 0, 1);
      line(0, 2, cols, 2);
    }
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds(colmathBox(o), p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, _from, to) => {
    const w = colmathBox(o).w;
    return { ...o, x: round1(to.x), y: round1(to.y), cell: Math.max(24, Math.min(90, round1((o.cell * to.w) / w))) };
  },
};

// ---------- fraction model ----------
export function makeFmodel(kind: FmodelKind, extra: Partial<FmodelObject> = {}): ObjectDraft<FmodelObject> {
  const circle = kind === "circle";
  return { type: "fmodel", kind, c: "#1971c2", n: circle ? 4 : 5, fill: [], x: 0, y: 0, w: circle ? 180 : 360, h: circle ? 180 : 64, ...extra };
}

/** Index of the part under the point (-1 = outside the shape). */
export function fmodelPartAt(o: FmodelObject, p: Point): number {
  const n = Math.max(1, o.n | 0);
  if (o.kind === "circle") {
    const R = Math.min(o.w, o.h) / 2 - 3;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const dx = p[0] - cx, dy = p[1] - cy;
    if (Math.hypot(dx, dy) > R) return -1;
    let ang = Math.atan2(dx, -dy); // clockwise from the top
    if (ang < 0) ang += Math.PI * 2;
    return Math.min(n - 1, Math.floor(ang / ((Math.PI * 2) / n)));
  }
  if (p[0] < o.x || p[0] > o.x + o.w || p[1] < o.y || p[1] > o.y + o.h) return -1;
  return Math.min(n - 1, Math.floor(((p[0] - o.x) / o.w) * n));
}

export const FMODEL_TYPE: ObjectTypeDef<FmodelObject> = {
  interactive: true,
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  draw(ctx, o) {
    const n = Math.max(1, o.n | 0);
    const on = new Set(o.fill || []);
    ctx.save();
    ctx.lineJoin = "round";
    const col = o.c || EDGE;
    ctx.strokeStyle = col;
    ctx.lineWidth = o.s ? Math.max(1.5, o.s * 0.8) : 2.6;
    const shade = () => { ctx.globalAlpha = 0.38; ctx.fillStyle = col; };
    if (o.kind === "circle") {
      const R = Math.min(o.w, o.h) / 2 - 3;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const a0 = -Math.PI / 2;
      const step = (Math.PI * 2) / n;
      shade();
      for (let i = 0; i < n; i++) {
        if (!on.has(i)) continue;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0 + i * step, a0 + (i + 1) * step); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      if (n > 1) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a0 + i * step), cy + R * Math.sin(a0 + i * step)); }
        ctx.stroke();
      }
    } else {
      const cw = o.w / n;
      shade();
      for (let i = 0; i < n; i++) if (on.has(i)) ctx.fillRect(o.x + i * cw, o.y, cw, o.h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.beginPath();
      for (let i = 1; i < n; i++) { ctx.moveTo(o.x + i * cw, o.y); ctx.lineTo(o.x + i * cw, o.y + o.h); }
      ctx.stroke();
    }
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: o.w, h: o.h }, p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, _from, to) => {
    const w = Math.max(60, to.w);
    return o.kind === "circle"
      ? { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1(w) }
      : { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1((w * o.h) / o.w) };
  },
};
