// Graphs: expression parsing, curve evaluation and canvas drawing.
// Supports: y = f(x), implicit curves (x^2+y^2=25), inequalities (y > x^2), points ((2, 3), A=(1,2)),
// slider parameters (a*x^2+b*x+c) and Ukrainian notation (tg, ctg, arctg, ln, lg).
import { compile, derivative, isFunctionNode, isSymbolNode, parse, simplify } from "mathjs";
import { uiFont } from "./fonts";
import type { EvalFunction } from "mathjs";
import type { DrawEnv, GraphObject, GraphParamInfo, ObjectDraft, Point } from "./types";

export const GRAPH_COLORS = ["#3b5bdb", "#e8590c", "#2f9e44", "#c2255c", "#7048e8", "#0c8599", "#b8860b"];
const RESERVED = new Set(["x", "y", "e", "pi", "PI", "tau", "phi", "i", "Infinity", "NaN"]);

/** A parsed expression line. */
export type ParsedLine =
  | { kind: "empty"; params: string[] }
  | { kind: "point"; name: string; fx: EvalFunction; fy: EvalFunction; params: string[] }
  | { kind: "ineq"; op: string; f: EvalFunction; params: string[] }
  | { kind: "fn"; f: EvalFunction; src: string; params: string[] }
  | { kind: "implicit"; f: EvalFunction; params: string[] }
  | { kind: "error"; msg: string; params: string[] };

type FnLine = Extract<ParsedLine, { kind: "fn" }>;
const isFnLine = (p: ParsedLine): p is FnLine => p.kind === "fn";

/** Evaluation scope: x, y and slider parameters. */
interface Scope {
  x: number;
  y: number;
  [name: string]: number;
}

interface Mapper {
  X: (u: number) => number;
  Y: (u: number) => number;
  ux: (px: number) => number;
  uy: (py: number) => number;
}

function errorText(e: unknown): string {
  const msg = typeof e === "object" && e !== null && "message" in e ? e.message : undefined;
  return String(msg || e);
}

function normalize(raw: string): string {
  return String(raw)
    .replace(/[−–—]/g, "-")
    .replace(/[·×]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([A-Za-z0-9_.]+)/g, "sqrt($1)")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\barcsin\b/g, "asin")
    .replace(/\barccos\b/g, "acos")
    .replace(/\barcctg\b/g, "acot")
    .replace(/\barctg\b/g, "atan")
    .replace(/\barctan\b/g, "atan")
    .replace(/\btg\b/g, "tan")
    .replace(/\bctg\b/g, "cot")
    .replace(/\bln\b/g, "log")
    .replace(/\blg\b/g, "log10")
    .replace(/([0-9A-Za-z)\]])\s*²/g, "$1^2")
    .replace(/([0-9A-Za-z)\]])\s*³/g, "$1^3")
    .replace(/([0-9A-Za-z)\]])\s*⁴/g, "$1^4")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\|([^|]+)\|/g, "abs($1)")
    .trim();
}

function paramsOf(sources: string[]): string[] {
  const names: string[] = [];
  for (const s of sources) {
    parse(s).traverse((node, path, parent) => {
      const isFn = isFunctionNode(parent) && path === "fn";
      if (isSymbolNode(node) && !isFn && !RESERVED.has(node.name) && !names.includes(node.name)) names.push(node.name);
    });
  }
  return names;
}

const POINT_RE = /^(?:([A-Za-z]\w*)\s*=\s*)?\(\s*(.+?)\s*[,;]\s*(.+?)\s*\)$/;
const cache = new Map<string, ParsedLine>();

// Parse one line. Results are cached by text.
export function parseLine(raw: string): ParsedLine {
  const hit = cache.get(raw);
  if (hit) return hit;
  let res: ParsedLine;
  try {
    const src = normalize(raw);
    if (!src) res = { kind: "empty", params: [] };
    else {
      let m = src.match(POINT_RE);
      if (m) {
        res = { kind: "point", name: m[1] || "", fx: compile(m[2]), fy: compile(m[3]), params: paramsOf([m[2], m[3]]) };
      } else if ((m = src.match(/^(.*?)(<=|>=|<|>)(.*)$/))) {
        const F = `(${m[1] || "0"})-(${m[3] || "0"})`;
        res = { kind: "ineq", op: m[2], f: compile(F), params: paramsOf([F]) };
      } else if (src.includes("=")) {
        const i = src.indexOf("=");
        const lhs = src.slice(0, i).trim();
        const rhs = src.slice(i + 1).trim();
        if (/^(y|[A-Za-z]\(x\))$/.test(lhs)) res = { kind: "fn", f: compile(rhs), src: rhs, params: paramsOf([rhs]) };
        else if (rhs === "y") res = { kind: "fn", f: compile(lhs), src: lhs, params: paramsOf([lhs]) };
        else {
          const F = `(${lhs})-(${rhs})`;
          res = { kind: "implicit", f: compile(F), params: paramsOf([F]) };
        }
      } else {
        res = { kind: "fn", f: compile(src), src, params: paramsOf([src]) };
      }
    }
  } catch (e) {
    res = { kind: "error", msg: errorText(e), params: [] };
  }
  if (cache.size > 500) cache.clear();
  cache.set(raw, res);
  return res;
}

export const splitExprs = (exprs: string | null | undefined): string[] =>
  String(exprs || "").split("\n").map((s) => s.trim()).filter(Boolean);

export function findParams(exprs: string | null | undefined): string[] {
  const names: string[] = [];
  for (const line of splitExprs(exprs)) {
    for (const n of parseLine(line).params) if (!names.includes(n)) names.push(n);
  }
  return names;
}

// Sliders with ranges for display.
export function graphParams(o: GraphObject): GraphParamInfo[] {
  return findParams(o.exprs).map((name) => {
    const value = typeof o.params?.[name] === "number" ? o.params[name] : 1;
    let [min, max] = o.ranges?.[name] || [-5, 5];
    if (value < min) min = Math.floor(value);
    if (value > max) max = Math.ceil(value);
    return { name, value, min, max, step: max - min <= 20 ? 0.05 : 0.5 };
  });
}

function safeEval(node: EvalFunction, scope: Scope): number {
  try {
    const r: unknown = node.evaluate(scope);
    return typeof r === "number" && Number.isFinite(r) ? r : NaN;
  } catch {
    return NaN;
  }
}

export function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export function fmtNum(n: number, digits?: number): string {
  if (Math.abs(n) < 1e-9) return "0";
  const s = String(digits === undefined ? parseFloat(n.toPrecision(8)) : parseFloat(n.toFixed(digits)));
  return s.replace("-", "−").replace(".", ",");
}

type GraphDraft = ObjectDraft<GraphObject>;
type GraphDefaults = Pick<GraphDraft, "type" | "w" | "h" | "v" | "exprs" | "params" | "ranges" | "legend">;

/** Graph defaults merged with `extra` (callers supply at least x and y). */
export function makeGraph(): GraphDefaults;
export function makeGraph<E extends Partial<GraphDraft>>(extra: E): GraphDefaults & E;
export function makeGraph(extra: Partial<GraphDraft> = {}): Partial<GraphDraft> {
  return {
    type: "graph",
    w: 520,
    h: 400,
    v: { cx: 0, cy: 0, sx: 40, sy: 40 },
    exprs: "",
    params: {},
    ranges: {},
    legend: true,
    ...extra,
  };
}

// ---------- coordinate transforms ----------
const mapper = (o: GraphObject): Mapper => {
  const { x, y, w, h, v } = o;
  return {
    X: (u) => x + w / 2 + (u - v.cx) * v.sx,
    Y: (u) => y + h / 2 - (u - v.cy) * v.sy,
    ux: (px) => v.cx + (px - x - w / 2) / v.sx,
    uy: (py) => v.cy - (py - y - h / 2) / v.sy,
  };
};
export const graphToUnits = (o: GraphObject, wx: number, wy: number): Point => {
  const m = mapper(o);
  return [m.ux(wx), m.uy(wy)];
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface GraphValuesResult {
  /** One entry per input x: a number, or null where undefined. null when there is no y = f(x) line. */
  values: (number | null)[] | null;
  error: string | null;
}

// Values of the graph's first y = f(x) function at xs.
export function graphValues(o: GraphObject, xs: number[]): GraphValuesResult {
  const first = splitExprs(o.exprs).map((raw) => parseLine(raw)).find(isFnLine);
  if (!first) return { values: null, error: "Немає функції виду y = f(x)" };
  const scope = scopeOf(o);
  let error: string | null = null;
  const values = xs.map((x) => {
    scope.x = x;
    try {
      const r: unknown = first.f.evaluate(scope);
      if (typeof r === "number" && Number.isFinite(r)) return r;
      if (r && typeof r === "object") {
        // BigNumber / Fraction
        if ("toNumber" in r && typeof r.toNumber === "function") {
          const n: unknown = r.toNumber();
          if (typeof n === "number" && Number.isFinite(n)) return n;
        }
        // Complex with a negligible imaginary part
        if ("re" in r && typeof r.re === "number" && Math.abs(Number("im" in r ? r.im : undefined)) < 1e-12) return r.re;
      }
      return null;
    } catch (e) {
      error = errorText(e);
      return null;
    }
  });
  return { values, error };
}

function scopeOf(o: GraphObject): Scope {
  const s: Scope = { x: 0, y: 0 };
  for (const p of graphParams(o)) s[p.name] = p.value;
  return s;
}

// Contour F(x,y)=0 via marching squares. Appends segments to `path`.
function contour(path: Path2D, f: EvalFunction, scope: Scope, o: GraphObject, m: Mapper, cell: number): void {
  const cols = Math.ceil(o.w / cell);
  const rows = Math.ceil(o.h / cell);
  const W = cols + 1;
  const vals = new Float64Array(W * (rows + 1));
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      scope.x = m.ux(o.x + i * cell);
      scope.y = m.uy(o.y + j * cell);
      vals[j * W + i] = safeEval(f, scope);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const fa = vals[j * W + i];
      const fb = vals[j * W + i + 1];
      const fc = vals[(j + 1) * W + i + 1];
      const fd = vals[(j + 1) * W + i];
      if (Number.isNaN(fa + fb + fc + fd)) continue;
      const idx = (fa > 0 ? 8 : 0) | (fb > 0 ? 4 : 0) | (fc > 0 ? 2 : 0) | (fd > 0 ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x0 = o.x + i * cell;
      const y0 = o.y + j * cell;
      const top = (): Point => [x0 + (fa / (fa - fb)) * cell, y0];
      const right = (): Point => [x0 + cell, y0 + (fb / (fb - fc)) * cell];
      const bottom = (): Point => [x0 + (fd / (fd - fc)) * cell, y0 + cell];
      const left = (): Point => [x0, y0 + (fa / (fa - fd)) * cell];
      const seg = (p: Point, q: Point) => { path.moveTo(p[0], p[1]); path.lineTo(q[0], q[1]); };
      switch (idx) {
        case 1: case 14: seg(left(), bottom()); break;
        case 2: case 13: seg(bottom(), right()); break;
        case 3: case 12: seg(left(), right()); break;
        case 4: case 11: seg(top(), right()); break;
        case 6: case 9: seg(top(), bottom()); break;
        case 7: case 8: seg(top(), left()); break;
        case 5: seg(top(), right()); seg(left(), bottom()); break;
        case 10: seg(top(), left()); seg(bottom(), right()); break;
      }
    }
  }
}

function functionPath(path: Path2D, f: EvalFunction, scope: Scope, o: GraphObject, m: Mapper): void {
  const n = Math.min(1600, Math.ceil(o.w / 0.8));
  let pen = false;
  let prev = 0;
  for (let i = 0; i <= n; i++) {
    const px = o.x + (o.w * i) / n;
    scope.x = m.ux(px);
    const y = safeEval(f, scope);
    if (Number.isNaN(y)) { pen = false; continue; }
    let py = m.Y(y);
    py = Math.max(o.y - o.h * 40, Math.min(o.y + o.h * 41, py));
    if (pen && Math.abs(py - prev) > o.h * 1.5) pen = false;
    if (pen) path.lineTo(px, py);
    else { path.moveTo(px, py); pen = true; }
    prev = py;
  }
}

// ---------- special points, tangent, area ----------
type RealFn = (x: number) => number;

function bisect(fn: RealFn, a: number, b: number, iters = 42): number | null {
  let fa = fn(a);
  for (let i = 0; i < iters; i++) {
    const mid = (a + b) / 2;
    const fm = fn(mid);
    if (!Number.isFinite(fm)) return null;
    if (fa * fm <= 0) b = mid;
    else { a = mid; fa = fm; }
  }
  return (a + b) / 2;
}

function extremum(fn: RealFn, a: number, b: number, isMax: boolean, iters = 48): [number, number] | null {
  let lo = a, hi = b;
  for (let i = 0; i < iters; i++) {
    const d = hi - lo;
    const x1 = lo + 0.382 * d;
    const x2 = hi - 0.382 * d;
    const f1 = fn(x1), f2 = fn(x2);
    if (!Number.isFinite(f1) || !Number.isFinite(f2)) return null;
    if (isMax ? f1 < f2 : f1 > f2) lo = x1;
    else hi = x2;
  }
  const x = (lo + hi) / 2;
  return [x, fn(x)];
}

function simpson(fn: RealFn, a: number, b: number, n = 240): number {
  const h = (b - a) / n;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < n; i++) sum += fn(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

function tagText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.save();
  ctx.font = `600 13px ${uiFont()}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function hollowDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

// Symbolic derivative of a function (for the legend). null if it fails.
const derivCache = new Map<string, string | null>();
export function derivativeText(src: string): string | null {
  const hit = derivCache.get(src);
  if (hit !== undefined) return hit;
  let out: string | null = null;
  try {
    out = simplify(derivative(parse(src), "x"))
      .toString()
      .replace(/\s*\*\s*/g, "·")
      .replace(/\s*\^\s*2\b/g, "²")
      .replace(/\s*\^\s*3\b/g, "³")
      .replace(/\s*\^\s*/g, "^")
      .replace(/\s*\/\s*/g, "/")
      .replace(/log\(/g, "ln(");
  } catch {
    out = null;
  }
  derivCache.set(src, out);
  return out;
}

function evalCurvePath(path: Path2D, fn: RealFn, o: GraphObject, m: Mapper): void {
  const n = Math.min(1600, Math.ceil(o.w / 0.8));
  let pen = false;
  let prev = 0;
  for (let i = 0; i <= n; i++) {
    const px = o.x + (o.w * i) / n;
    const y = fn(m.ux(px));
    if (!Number.isFinite(y)) { pen = false; continue; }
    const py = Math.max(o.y - o.h * 40, Math.min(o.y + o.h * 41, m.Y(y)));
    if (pen && Math.abs(py - prev) > o.h * 1.5) pen = false;
    if (pen) path.lineTo(px, py);
    else { path.moveTo(px, py); pen = true; }
    prev = py;
  }
}

/** A y = f(x) line sampled across the frame. */
interface FeatureLine {
  idx: number;
  p: FnLine;
  fn: RealFn;
  /** Samples at xmin + i·dx, i = 0…N. */
  ys: number[];
  col: string;
}

interface FeatureMark {
  x: number;
  y: number;
  col: string;
}

function drawFeatures(ctx: CanvasRenderingContext2D, o: GraphObject, m: Mapper, scope: Scope): void {
  const fnLines: { idx: number; p: FnLine }[] = [];
  splitExprs(o.exprs).forEach((raw, idx) => {
    const p = parseLine(raw);
    if (isFnLine(p)) fnLines.push({ idx, p });
  });
  if (!fnLines.length) return;
  const evalX = (p: FnLine): RealFn => (x) => { scope.x = x; return safeEval(p.f, scope); };
  const xmin = m.ux(o.x), xmax = m.ux(o.x + o.w);
  const N = 520;
  const dx = (xmax - xmin) / N;
  const lines: FeatureLine[] = fnLines.map(({ idx, p }) => {
    const fn = evalX(p);
    const ys: number[] = [];
    for (let i = 0; i <= N; i++) ys.push(fn(xmin + i * dx));
    return { idx, p, fn, ys, col: GRAPH_COLORS[idx % GRAPH_COLORS.length] };
  });
  const marks: FeatureMark[] = [];
  const spanY = o.h / o.v.sy;

  if (o.zeros) {
    for (const l of lines) {
      for (let i = 0; i < N; i++) {
        const a = l.ys[i], b = l.ys[i + 1];
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        // An exact zero counts once — not at every sample of y = 0 or a flat piece on the axis.
        if (a === 0) { if (i === 0 || l.ys[i - 1] !== 0) marks.push({ x: xmin + i * dx, y: 0, col: l.col }); continue; }
        if (a * b < 0 && Math.abs(a - b) < spanY * 3) {
          const x0 = bisect(l.fn, xmin + i * dx, xmin + (i + 1) * dx);
          if (x0 !== null && Math.abs(l.fn(x0)) < 1e-4 * (1 + spanY)) marks.push({ x: x0, y: 0, col: l.col });
        }
      }
    }
  }
  if (o.ext) {
    for (const l of lines) {
      for (let i = 1; i < N; i++) {
        const a = l.ys[i - 1], b = l.ys[i], c = l.ys[i + 1];
        if (![a, b, c].every(Number.isFinite)) continue;
        if ((b - a) * (c - b) < 0 && Math.abs(b - a) < spanY && Math.abs(c - b) < spanY) {
          const r = extremum(l.fn, xmin + (i - 1) * dx, xmin + (i + 1) * dx, b > a);
          if (r) marks.push({ x: r[0], y: r[1], col: l.col });
        }
      }
    }
  }
  if (o.inter) {
    for (let a = 0; a < lines.length; a++) {
      for (let b = a + 1; b < lines.length; b++) {
        const A = lines[a], B = lines[b];
        const diff = (x: number) => A.fn(x) - B.fn(x);
        for (let i = 0; i < N; i++) {
          const d0 = A.ys[i] - B.ys[i], d1 = A.ys[i + 1] - B.ys[i + 1];
          if (!Number.isFinite(d0) || !Number.isFinite(d1)) continue;
          // Coinciding pieces (y = x and y = |x|, two equal lines) are not hundreds of intersections.
          const touch = d0 === 0 && (i === 0 || A.ys[i - 1] - B.ys[i - 1] !== 0);
          if (touch || (d0 !== 0 && d0 * d1 < 0 && Math.abs(d0 - d1) < spanY * 3)) {
            const x0 = d0 === 0 ? xmin + i * dx : bisect(diff, xmin + i * dx, xmin + (i + 1) * dx);
            if (x0 === null) continue;
            const y0 = A.fn(x0);
            if (Number.isFinite(y0) && Math.abs(diff(x0)) < 1e-4 * (1 + Math.abs(y0))) marks.push({ x: x0, y: y0, col: "#1d1b2e" });
          }
        }
      }
    }
  }
  // One label per point: a zero that is also an intersection, or neighbouring samples, closer than 8px.
  for (let i = marks.length - 1; i > 0; i--) {
    const m = marks[i];
    if (marks.slice(0, i).some((q) => Math.abs(q.x - m.x) * o.v.sx < 8 && Math.abs(q.y - m.y) * o.v.sy < 8)) marks.splice(i, 1);
  }

  const first = lines[0];
  // derivative and antiderivative of the first function
  if (first && (o.deriv || o.anti)) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (o.deriv) {
      const path = new Path2D();
      evalCurvePath(path, (x) => {
        const h = 1e-5 * (1 + Math.abs(x));
        return (first.fn(x + h) - first.fn(x - h)) / (2 * h);
      }, o, m);
      ctx.strokeStyle = "#e8590c";
      ctx.lineWidth = 2.6;
      ctx.setLineDash([9, 6]);
      ctx.stroke(path);
    }
    if (o.anti) {
      // F(x) = ∫ from 0 to x, accumulated per pixel column
      const px0 = o.x;
      const step = 1.5;
      const cols = Math.ceil(o.w / step);
      const xs: number[] = [];
      for (let i = 0; i <= cols; i++) xs.push(m.ux(px0 + i * step));
      const F = new Array<number>(cols + 1);
      let acc = simpson((x) => { const y = first.fn(x); return Number.isFinite(y) ? y : 0; }, 0, xs[0], 400);
      F[0] = acc;
      for (let i = 1; i <= cols; i++) {
        const a = first.fn(xs[i - 1]), b = first.fn(xs[i]);
        if (Number.isFinite(a) && Number.isFinite(b)) acc += ((a + b) / 2) * (xs[i] - xs[i - 1]);
        else acc = NaN;
        F[i] = acc;
      }
      const path = new Path2D();
      let pen = false;
      for (let i = 0; i <= cols; i++) {
        if (!Number.isFinite(F[i])) { pen = false; continue; }
        const px = px0 + i * step;
        const py = Math.max(o.y - o.h * 40, Math.min(o.y + o.h * 41, m.Y(F[i])));
        if (pen) path.lineTo(px, py);
        else { path.moveTo(px, py); pen = true; }
      }
      ctx.strokeStyle = "#2f9e44";
      ctx.lineWidth = 2.6;
      ctx.setLineDash([12, 4, 2, 4]);
      ctx.stroke(path);
    }
    ctx.restore();
  }
  // area under the first function
  if (o.area && first) {
    const a = Math.min(o.area[0], o.area[1]), b = Math.max(o.area[0], o.area[1]);
    if (b - a > 1e-9) {
      const steps = Math.max(30, Math.ceil(((b - a) * o.v.sx) / 2));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(m.X(a), m.Y(0));
      for (let i = 0; i <= steps; i++) {
        const x = a + ((b - a) * i) / steps;
        const y = first.fn(x);
        ctx.lineTo(m.X(x), m.Y(Number.isFinite(y) ? y : 0));
      }
      ctx.lineTo(m.X(b), m.Y(0));
      ctx.closePath();
      ctx.fillStyle = first.col;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = first.col;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const x of [a, b]) { ctx.moveTo(m.X(x), m.Y(0)); ctx.lineTo(m.X(x), m.Y(first.fn(x) || 0)); }
      ctx.stroke();
      ctx.restore();
      const val = simpson((x) => { const y = first.fn(x); return Number.isFinite(y) ? y : 0; }, a, b);
      tagText(ctx, `S ≈ ${fmtNum(val)}`, m.X((a + b) / 2) - 24, m.Y(0) + (val >= 0 ? -16 : 16), first.col);
    }
  }
  // tangent to the first function at x₀
  if (o.tan !== null && o.tan !== undefined && first) {
    const x0 = o.tan;
    const y0 = first.fn(x0);
    const h = 1e-5 * (1 + Math.abs(x0));
    const k = (first.fn(x0 + h) - first.fn(x0 - h)) / (2 * h);
    if (Number.isFinite(y0) && Number.isFinite(k)) {
      ctx.save();
      ctx.strokeStyle = "#1d1b2e";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.moveTo(m.X(xmin), m.Y(y0 + k * (xmin - x0)));
      ctx.lineTo(m.X(xmax), m.Y(y0 + k * (xmax - x0)));
      ctx.stroke();
      ctx.restore();
      hollowDot(ctx, m.X(x0), m.Y(y0), "#1d1b2e");
      const b0 = y0 - k * x0;
      const eq = `y = ${fmtNum(k, 2)}x ${b0 < 0 ? "−" : "+"} ${fmtNum(Math.abs(b0), 2)}`;
      tagText(ctx, `${eq}   (k = ${fmtNum(k, 2)})`, m.X(x0) + 10, m.Y(y0) - 18, "#1d1b2e");
    }
  }
  for (const mk of marks) {
    hollowDot(ctx, m.X(mk.x), m.Y(mk.y), mk.col);
    tagText(ctx, `(${fmtNum(mk.x, 2)}; ${fmtNum(mk.y, 2)})`, m.X(mk.x) + 9, m.Y(mk.y) - 12, mk.col);
  }
}

export function drawGraph(ctx: CanvasRenderingContext2D, o: GraphObject, env: DrawEnv): void {
  const { x, y, w, h } = o;
  const z = env.zoom;
  const hair = 1 / z;
  const m = mapper(o);
  const interacting = env.interactingId === o.id;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();

  // grid
  const stepX = niceStep(55 / o.v.sx);
  const stepY = niceStep(55 / o.v.sy);
  const xmin = m.ux(x), xmax = m.ux(x + w), ymin = m.uy(y + h), ymax = m.uy(y);
  ctx.lineWidth = hair;
  ctx.strokeStyle = "#e9e7f4";
  ctx.beginPath();
  for (let u = Math.ceil(xmin / stepX) * stepX; u <= xmax; u += stepX) { ctx.moveTo(m.X(u), y); ctx.lineTo(m.X(u), y + h); }
  for (let u = Math.ceil(ymin / stepY) * stepY; u <= ymax; u += stepY) { ctx.moveTo(x, m.Y(u)); ctx.lineTo(x + w, m.Y(u)); }
  ctx.stroke();

  // axes
  const ax = Math.min(x + w - 1, Math.max(x + 1, m.X(0)));
  const ay = Math.min(y + h - 1, Math.max(y + 1, m.Y(0)));
  ctx.strokeStyle = "#1d1b2e";
  ctx.fillStyle = "#1d1b2e";
  ctx.lineWidth = Math.max(1.6, 1.2 / z);
  ctx.beginPath();
  ctx.moveTo(x, ay); ctx.lineTo(x + w, ay);
  ctx.moveTo(ax, y + h); ctx.lineTo(ax, y);
  ctx.stroke();
  // axis arrows
  ctx.beginPath();
  ctx.moveTo(x + w - 1, ay); ctx.lineTo(x + w - 11, ay - 4.5); ctx.lineTo(x + w - 11, ay + 4.5);
  ctx.moveTo(ax, y + 1); ctx.lineTo(ax - 4.5, y + 11); ctx.lineTo(ax + 4.5, y + 11);
  ctx.fill();

  // axis labels
  ctx.font = `12px ${uiFont()}`;
  ctx.fillStyle = "#57546e";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const lblY = Math.min(y + h - 16, ay + 5);
  for (let u = Math.ceil(xmin / stepX) * stepX; u <= xmax; u += stepX) {
    if (Math.abs(u) < stepX / 1000) continue;
    const px = m.X(u);
    if (px < x + 14 || px > x + w - 14) continue;
    ctx.fillText(fmtNum(u), px, lblY);
    ctx.fillRect(px - hair / 2, ay - 3, hair, 6);
  }
  ctx.textAlign = ax > x + w - 40 ? "right" : "left";
  ctx.textBaseline = "middle";
  const lblX = ax > x + w - 40 ? ax - 6 : ax + 6;
  for (let u = Math.ceil(ymin / stepY) * stepY; u <= ymax; u += stepY) {
    if (Math.abs(u) < stepY / 1000) continue;
    const py = m.Y(u);
    if (py < y + 14 || py > y + h - 14) continue;
    ctx.fillText(fmtNum(u), lblX, py);
    ctx.fillRect(ax - 3, py - hair / 2, 6, hair);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#1d1b2e";
  ctx.font = 'italic 15px "Times New Roman", serif';
  ctx.fillText("x", x + w - 16, Math.min(y + h - 20, ay + 8));
  ctx.fillText("y", Math.min(x + w - 14, ax + 9), y + 6);
  if (xmin < 0 && xmax > 0 && ymin < 0 && ymax > 0) {
    ctx.font = `12px ${uiFont()}`;
    ctx.fillStyle = "#57546e";
    ctx.textAlign = "right";
    ctx.fillText("0", ax - 4, ay + 4);
    ctx.textAlign = "left";
  }

  // expressions
  const lines = splitExprs(o.exprs);
  const scope = scopeOf(o);
  const lw = Math.max(2.5, 1.6 / z);
  lines.forEach((raw, idx) => {
    const col = GRAPH_COLORS[idx % GRAPH_COLORS.length];
    const p = parseLine(raw);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (p.kind === "fn") {
      const path = new Path2D();
      functionPath(path, p.f, scope, o, m);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke(path);
    } else if (p.kind === "implicit") {
      const path = new Path2D();
      contour(path, p.f, scope, o, m, interacting ? 10 : 5);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke(path);
    } else if (p.kind === "ineq") {
      const strict = p.op === "<" || p.op === ">";
      const positive = p.op[0] === ">";
      const blk = interacting ? 10 : 5;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.16;
      for (let by = 0; by < h; by += blk) {
        for (let bx = 0; bx < w; bx += blk) {
          scope.x = m.ux(x + bx + blk / 2);
          scope.y = m.uy(y + by + blk / 2);
          const val = safeEval(p.f, scope);
          if (!Number.isNaN(val) && (positive ? val > 0 : val < 0)) ctx.fillRect(x + bx, y + by, blk, blk);
        }
      }
      ctx.globalAlpha = 1;
      const path = new Path2D();
      contour(path, p.f, scope, o, m, interacting ? 10 : 5);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.setLineDash(strict ? [10, 7] : []);
      ctx.stroke(path);
      ctx.setLineDash([]);
    } else if (p.kind === "point") {
      const ux = safeEval(p.fx, scope);
      const uy = safeEval(p.fy, scope);
      if (!Number.isNaN(ux + uy)) {
        const px = m.X(ux), py = m.Y(uy);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = 'italic 600 16px "Times New Roman", serif';
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#1d1b2e";
        ctx.fillText(p.name ? `${p.name}(${fmtNum(ux)}; ${fmtNum(uy)})` : `(${fmtNum(ux)}; ${fmtNum(uy)})`, px + 9, py - 9);
        ctx.textBaseline = "top";
      }
    }
  });

  drawFeatures(ctx, o, m, scope);

  // legend
  const extra: { text: string; col: string }[] = [];
  if (o.deriv || o.anti) {
    const fl = splitExprs(o.exprs).map((raw) => parseLine(raw)).find(isFnLine);
    if (fl && o.deriv) extra.push({ text: `f′(x) = ${derivativeText(fl.src) || "…"}`, col: "#e8590c" });
    if (fl && o.anti) extra.push({ text: "F(x) = ∫f(x)dx,  F(0) = 0", col: "#2f9e44" });
  }
  if (o.legend && extra.length) {
    ctx.font = `13px ${uiFont()}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let ey = y + h - 16 - (extra.length - 1) * 22;
    let ew = 0;
    for (const e of extra) ew = Math.max(ew, ctx.measureText(e.text).width);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(x + 8, ey - 14, ew + 34, extra.length * 22 + 4);
    for (const e of extra) {
      ctx.fillStyle = e.col;
      ctx.fillRect(x + 14, ey - 5, 10, 10);
      ctx.fillStyle = "#1d1b2e";
      ctx.fillText(e.text, x + 30, ey);
      ey += 22;
    }
  }
  if (o.legend && lines.length) {
    ctx.font = `13px ${uiFont()}`;
    ctx.textBaseline = "middle";
    let ly = y + 16;
    let maxW = 0;
    lines.slice(0, 7).forEach((raw) => { maxW = Math.max(maxW, ctx.measureText(raw).width); });
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillRect(x + 8, y + 6, maxW + 34, Math.min(lines.length, 7) * 22 + 6);
    lines.slice(0, 7).forEach((raw, idx) => {
      ctx.fillStyle = GRAPH_COLORS[idx % GRAPH_COLORS.length];
      ctx.fillRect(x + 14, ly - 5, 10, 10);
      ctx.fillStyle = parseLine(raw).kind === "error" ? "#c0264a" : "#1d1b2e";
      ctx.fillText(raw, x + 30, ly);
      ly += 22;
    });
  }
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.lineWidth = Math.max(1.5, 1.3 / z);
  ctx.strokeStyle = interacting ? "#6d3df0" : "#cfcbe6";
  ctx.stroke();
  ctx.restore();
}

// Marker for the curve point under the cursor (drawn on the overlay). `pt` is in board coordinates.
export function drawTrace(ctx: CanvasRenderingContext2D, o: GraphObject, pt: Point, zoom: number): void {
  const m = mapper(o);
  if (pt[0] < o.x || pt[0] > o.x + o.w || pt[1] < o.y || pt[1] > o.y + o.h) return;
  const scope = scopeOf(o);
  const u = m.ux(pt[0]);
  splitExprs(o.exprs).forEach((raw, idx) => {
    const p = parseLine(raw);
    if (p.kind !== "fn") return;
    scope.x = u;
    const val = safeEval(p.f, scope);
    if (Number.isNaN(val)) return;
    const px = pt[0], py = m.Y(val);
    if (py < o.y || py > o.y + o.h) return;
    const col = GRAPH_COLORS[idx % GRAPH_COLORS.length];
    ctx.save();
    ctx.fillStyle = col;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(px, py, 6 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${13 / zoom}px ${uiFont()}`;
    const label = `(${fmtNum(u)}; ${fmtNum(val)})`;
    const tw = ctx.measureText(label).width;
    const lx = Math.min(px + 10 / zoom, o.x + o.w - tw - 8 / zoom);
    ctx.fillStyle = "rgba(29,27,46,0.9)";
    ctx.fillRect(lx - 4 / zoom, py - 26 / zoom, tw + 8 / zoom, 20 / zoom);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx, py - 16 / zoom);
    ctx.restore();
  });
}
