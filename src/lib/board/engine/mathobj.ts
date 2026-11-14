// Maths objects: charts with statistics, die / coin, probability tree, coordinate plane with points.
import { uiFont } from "./fonts";
import { inBounds, round1 } from "./geom";
import { niceStep } from "./graph";
import type {
  BoardObject, Bounds, BoxFields, ChartKind, ChartObject, CplaneObject, DiceKind, DiceObject, ObjectTemplate,
  ObjectTypeDef, Point, PtreeObject,
} from "./types";

const INK = "#1d1b2e";
const SOFT = "#cfcbe6";
const PAL = ["#4c6ef5", "#f76707", "#37b24d", "#e64980", "#7048e8", "#1098ad", "#f59f00", "#868e96"];

const toNum = (s: string | number) => Number(String(s).replace(",", ".").replace("−", "-"));
export const fmtN = (v: number, d = 2): string => String(Math.round(v * 10 ** d) / 10 ** d).replace("-", "−").replace(".", ",");

const card = (ctx: CanvasRenderingContext2D, o: BoxFields, k: number) => {
  ctx.beginPath();
  ctx.roundRect(o.x, o.y, o.w, o.h, 14 * k);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = SOFT;
  ctx.lineWidth = 1.5;
  ctx.stroke();
};
const fitBox = <O extends BoxFields>(o: O, to: Bounds): O => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(160, to.w)), h: round1((Math.max(160, to.w) * o.h) / o.w) });
const base = <O extends BoardObject & { x: number; y: number }>(extra: Omit<ObjectTypeDef<O>, "hit" | "move">): ObjectTypeDef<O> => ({
  hit: (o, p, tol) => inBounds(extra.bounds(o), p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  ...extra,
});

// =============== charts ===============
export interface ChartRow {
  /** Label ("" when the line is a bare number). */
  l: string;
  v: number;
}

export function parseRows(src: string | null | undefined): ChartRow[] {
  const rows: ChartRow[] = [];
  for (const line of String(src || "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)[\s;:=]+(-?\d+(?:[.,]\d+)?)$/);
    if (m) rows.push({ l: m[1].trim(), v: toNum(m[2]) });
    else if (/^-?\d+(?:[.,]\d+)?$/.test(t)) rows.push({ l: "", v: toNum(t) });
  }
  return rows;
}
export const rawNumbers = (src: string | null | undefined): number[] => (String(src || "").match(/-?\d+(?:[.,]\d+)?/g) || []).map(toNum);

export interface Stats {
  n: number;
  mean: number;
  median: number;
  modes: number[];
  range: number;
  min: number;
  max: number;
}

export function statsOf(list: readonly number[]): Stats | null {
  const a = [...list].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return null;
  const mean = a.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  const cnt = new Map<number, number>();
  for (const v of a) cnt.set(v, (cnt.get(v) || 0) + 1);
  const top = Math.max(...cnt.values());
  const modes = top === 1 ? [] : [...cnt].filter(([, c]) => c === top).map(([v]) => v);
  return { n, mean, median, modes, range: a[n - 1] - a[0], min: a[0], max: a[n - 1] };
}
export const statsLine = (s: Stats | null): string => (s
  ? `Середнє ${fmtN(s.mean)} · мода ${s.modes.length ? s.modes.map((v) => fmtN(v)).join(", ") : "—"} · медіана ${fmtN(s.median)} · розмах ${fmtN(s.range)}`
  : "");

/** Histogram bin [a, b) with count c. */
export interface HistBin {
  a: number;
  b: number;
  c: number;
}

/** Histogram data; s0 (first bin start), w (bin width) and n (bin count) are missing when there is no data. */
export interface HistData {
  bins: HistBin[];
  list: number[];
  s0?: number;
  w?: number;
  n?: number;
}

export interface RowsData {
  rows: ChartRow[];
  list: number[];
  /** Histogram-only fields, never set here (declared so they can be read from the union). */
  s0?: undefined;
  w?: undefined;
  n?: undefined;
}

export function chartData(o: Pick<ChartObject, "kind" | "src" | "bw">): HistData | RowsData {
  if (o.kind === "hist") {
    const xs = rawNumbers(o.src);
    if (!xs.length) return { bins: [], list: xs };
    const lo = Math.min(...xs), hi = Math.max(...xs);
    const nb = Math.max(3, Math.min(10, Math.ceil(1 + Math.log2(xs.length))));
    const w = o.bw && o.bw > 0 ? o.bw : niceStep((hi - lo || 1) / nb);
    const s0 = Math.floor(lo / w) * w;
    const n = Math.min(60, Math.max(1, Math.ceil((hi - s0) / w + (hi === s0 + Math.ceil((hi - s0) / w) * w ? 1 : 0))));
    const bins: HistBin[] = Array.from({ length: n }, (_, i) => ({ a: s0 + i * w, b: s0 + (i + 1) * w, c: 0 }));
    for (const v of xs) bins[Math.min(n - 1, Math.floor((v - s0) / w))].c++;
    return { bins, list: xs, s0, w, n };
  }
  const rows = parseRows(o.src);
  return { rows, list: rows.map((r) => r.v) };
}

export const chartSize = (o: Pick<ChartObject, "w" | "h">): { w: number; h: number } => ({ w: o.w, h: o.h });

export const CHART_TYPE: ObjectTypeDef<ChartObject> = base<ChartObject>({
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  fit: (o, _from, to) => fitBox(o, to),
  draw(ctx, o) {
    const font = uiFont();
    const k = o.w / 460;
    const d = chartData(o);
    ctx.save();
    card(ctx, o, k);
    const st = o.stats ? statsOf(d.list) : null;
    const ink = o.c || INK; // a chosen colour makes the chart single-coloured
    const L = o.x + 52 * k, R = o.x + o.w - 22 * k;
    const T = o.y + 30 * k, B = o.y + o.h - (st ? 70 : 46) * k;
    ctx.font = `600 ${13 * k}px ${font}`;
    ctx.textBaseline = "middle";
    const empty = "bins" in d ? !d.bins.length : !d.rows.length;
    if (empty) {
      ctx.fillStyle = "#868e96"; ctx.textAlign = "center";
      ctx.fillText("Немає даних", o.x + o.w / 2, o.y + o.h / 2);
    } else if (o.kind === "pie" && "rows" in d) {
      const rows = d.rows.filter((r) => r.v > 0);
      const sum = rows.reduce((s, r) => s + r.v, 0) || 1;
      const cx = (L + R) / 2, cy = (T + B) / 2;
      const r = Math.max(20, Math.min((R - L) / 2 - 70 * k, (B - T) / 2 - 6 * k));
      let a0 = -Math.PI / 2;
      rows.forEach((row, i) => {
        const a1 = a0 + (row.v / sum) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
        ctx.fillStyle = o.c || PAL[i % PAL.length];
        ctx.globalAlpha = o.c ? Math.max(0.25, 1 - (0.7 * i) / Math.max(1, rows.length - 1)) : 1;
        ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * k; ctx.stroke();
        const m = (a0 + a1) / 2;
        const right = Math.cos(m) >= 0;
        ctx.fillStyle = INK;
        ctx.textAlign = right ? "left" : "right";
        ctx.fillText(`${row.l ? row.l + " " : ""}${fmtN(row.v)} (${fmtN((row.v / sum) * 100, 1)}%)`, cx + Math.cos(m) * (r + 8 * k), cy + Math.sin(m) * (r + 8 * k));
        a0 = a1;
      });
    } else {
      const hist = "bins" in d ? d : null;
      const rel = !!hist && !!o.rel;
      const items: ChartRow[] = hist ? hist.bins.map((b) => ({ v: rel ? (b.c / hist.list.length) * 100 : b.c, l: `${fmtN(b.a)}–${fmtN(b.b)}` })) : "rows" in d ? d.rows : [];
      const sfx = rel ? "%" : "";
      const fv = (v: number) => fmtN(rel ? Math.round(v * 10) / 10 : v) + sfx;
      const vmax = Math.max(1, ...items.map((i) => i.v));
      const step = niceStep(vmax / 5);
      const top = Math.ceil(vmax / step) * step;
      const Y = (v: number) => B - (v / top) * (B - T);
      ctx.strokeStyle = "#ece9f7"; ctx.lineWidth = 1; ctx.fillStyle = "#57546e"; ctx.textAlign = "right";
      for (let v = 0; v <= top + 1e-9; v += step) {
        ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke();
        ctx.fillText(fv(v), L - 6 * k, Y(v));
      }
      ctx.strokeStyle = ink; ctx.lineWidth = 2 * k;
      ctx.beginPath(); ctx.moveTo(L, T - 6 * k); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
      const slot = (R - L) / items.length;
      const gap = hist ? (o.gap ? slot * 0.18 : 0) : slot * 0.22;
      items.forEach((it, i) => {
        const x = L + i * slot + gap / 2;
        const w = slot - gap;
        ctx.fillStyle = o.c || (hist && !o.rb ? "#4c6ef5" : PAL[i % PAL.length]);
        ctx.fillRect(x, Y(Math.max(0, it.v)), w, Math.max(0, B - Y(Math.max(0, it.v))));
        if (hist) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5 * k; ctx.strokeRect(x, Y(it.v), w, B - Y(it.v)); }
        ctx.fillStyle = INK; ctx.textAlign = "center";
        if (!(hist && o.nov)) ctx.fillText(fv(it.v), x + w / 2, Y(Math.max(0, it.v)) - 9 * k);
        ctx.font = `600 ${Math.min(13, Math.max(9, (slot / (it.l.length || 1)) * 1.7)) * k}px ${font}`;
        ctx.fillText(it.l, x + w / 2, B + 14 * k);
        ctx.font = `600 ${13 * k}px ${font}`;
      });
      if (hist) {
        const s0 = hist.s0 ?? 0, bw = hist.w ?? 1, bn = hist.n ?? 1;
        const X = (v: number) => L + ((v - s0) / (bn * bw)) * (R - L);
        if (o.poly) {
          ctx.strokeStyle = "#e8590c"; ctx.fillStyle = "#e8590c"; ctx.lineWidth = 2.5 * k; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(L, B);
          items.forEach((it, i) => ctx.lineTo(L + (i + 0.5) * slot, Y(it.v)));
          ctx.lineTo(R, B); ctx.stroke();
          items.forEach((it, i) => { ctx.beginPath(); ctx.arc(L + (i + 0.5) * slot, Y(it.v), 3.5 * k, 0, Math.PI * 2); ctx.fill(); });
        }
        const sm = o.mlines ? statsOf(hist.list) : null;
        if (sm) {
          const mk = (v: number, col: string, name: string, dy: number) => {
            const x = X(v);
            ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2 * k; ctx.setLineDash([6 * k, 4 * k]);
            ctx.beginPath(); ctx.moveTo(x, T - 4 * k); ctx.lineTo(x, B); ctx.stroke(); ctx.setLineDash([]);
            ctx.font = `700 ${11.5 * k}px ${font}`; ctx.textAlign = "left";
            ctx.fillText(`${name} ${fmtN(v)}`, x + 4 * k, T + dy * k);
            ctx.font = `600 ${13 * k}px ${font}`;
          };
          mk(sm.mean, "#c2255c", "сер.", 4);
          mk(sm.median, "#2b8a3e", "мед.", 18);
        }
      }
    }
    if (st) {
      ctx.font = `700 ${12.5 * k}px ${font}`;
      ctx.fillStyle = o.c || "#364fc7"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(statsLine(st), o.x + o.w / 2, o.y + o.h - 16 * k, o.w - 20 * k);
    }
    ctx.restore();
  },
});

export const makeChart = (kind: ChartKind, src: string, extra: Partial<ChartObject> = {}): ObjectTemplate<ChartObject> =>
  ({ type: "chart", kind, src, w: 460, h: 320, stats: kind !== "pie", ...extra });

// =============== die / coin ===============
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};
export const diceOutcomes = (o: Pick<DiceObject, "kind" | "cnt">): string[] => (o.kind === "coin" ? ["Г", "Ц"] : o.cnt === 2 ? Array.from({ length: 11 }, (_, i) => String(i + 2)) : ["1", "2", "3", "4", "5", "6"]);
export const makeDice = (kind: DiceKind, extra: Partial<DiceObject> = {}): ObjectTemplate<DiceObject> =>
  ({ type: "dice", kind, cnt: 1, c: "#1d1b2e", cur: [], tot: 0, freq: {}, w: 440, h: 300, ...extra });

export const DICE_TYPE: ObjectTypeDef<DiceObject> = base<DiceObject>({
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  fit: (o, _from, to) => fitBox(o, to),
  draw(ctx, o) {
    const font = uiFont();
    const k = o.w / 440;
    ctx.save();
    card(ctx, o, k);
    const cur = o.cur || [];
    const ink = o.c || INK;
    const size = 62 * k;
    const n = o.kind === "coin" ? 1 : o.cnt;
    const x0 = o.x + o.w / 2 - (n * size + (n - 1) * 16 * k) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (size + 16 * k), y = o.y + 16 * k;
      const v: number | undefined = cur[i];
      ctx.strokeStyle = ink; ctx.lineWidth = 2.5 * k; ctx.fillStyle = "#fff";
      if (o.kind === "coin") {
        ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink; ctx.font = `700 ${size * 0.5}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(v === undefined ? "?" : v === 0 ? "Г" : "Ц", x + size / 2, y + size / 2 + 2 * k);
      } else {
        ctx.beginPath(); ctx.roundRect(x, y, size, size, 10 * k); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink;
        for (const [cx, cy] of (v !== undefined && PIPS[v]) || []) { ctx.beginPath(); ctx.arc(x + size * (0.22 + cx * 0.28), y + size * (0.22 + cy * 0.28), size * 0.075, 0, Math.PI * 2); ctx.fill(); }
        if (!v) { ctx.font = `700 ${size * 0.5}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", x + size / 2, y + size / 2); }
      }
    }
    // frequencies
    const outs = diceOutcomes(o);
    const tot = o.tot || 0;
    const L = o.x + 24 * k, R = o.x + o.w - 24 * k;
    const T = o.y + 110 * k, B = o.y + o.h - 56 * k;
    const mx = Math.max(1, ...outs.map((s) => o.freq?.[s] || 0));
    const slot = (R - L) / outs.length;
    ctx.textBaseline = "middle";
    outs.forEach((s, i) => {
      const c = o.freq?.[s] || 0;
      const h = (c / mx) * (B - T);
      ctx.fillStyle = o.c || PAL[i % PAL.length];
      ctx.fillRect(L + i * slot + slot * 0.15, B - h, slot * 0.7, h);
      ctx.fillStyle = INK; ctx.textAlign = "center";
      ctx.font = `700 ${13 * k}px ${font}`;
      ctx.fillText(s, L + i * slot + slot / 2, B + 12 * k);
      ctx.font = `600 ${11 * k}px ${font}`;
      ctx.fillText(`${c}`, L + i * slot + slot / 2, B - h - 8 * k);
      ctx.fillStyle = "#57546e";
      ctx.fillText(tot ? `${fmtN((c / tot) * 100, 0)}%` : "", L + i * slot + slot / 2, B + 28 * k);
    });
    ctx.strokeStyle = ink; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(L, B); ctx.lineTo(R, B); ctx.stroke();
    ctx.fillStyle = o.c || "#364fc7"; ctx.font = `700 ${13 * k}px ${font}`; ctx.textAlign = "center";
    ctx.fillText(`Кидків: ${tot}`, o.x + o.w / 2, o.y + o.h - 12 * k);
    ctx.restore();
  },
});

// =============== probability tree ===============
/** One branch of a tree level: label and probability. */
export interface TreeItem {
  l: string;
  p: number;
}

const parseP = (s: string): number => {
  const t = String(s).trim().replace(",", ".");
  if (t.endsWith("%")) return Number(t.slice(0, -1)) / 100;
  if (t.includes("/")) { const [a, b] = t.split("/"); return Number(a) / Number(b); }
  return Number(t);
};
/** Levels of the tree; items without a probability share the remainder equally. */
export function parseTree(src: string | null | undefined): TreeItem[][] {
  const levels: TreeItem[][] = [];
  for (const block of String(src || "").split(/\n\s*\n/)) {
    const items: { l: string; p: number | null }[] = [];
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^(.*?)[\s;:=]+([-\d.,/%]+)$/);
      const p = m ? parseP(m[2]) : NaN;
      items.push(m && Number.isFinite(p) ? { l: m[1].trim(), p } : { l: t, p: null });
    }
    if (!items.length) continue;
    const known = items.reduce((s, i) => s + (i.p ?? 0), 0);
    const unk = items.filter((i) => i.p === null).length;
    const fill = unk ? Math.max(0, 1 - known) / unk : 0;
    levels.push(items.map((i) => ({ l: i.l, p: i.p === null ? fill : i.p })));
  }
  return levels;
}
const leavesOf = (levels: TreeItem[][]) => levels.reduce((n, lv) => n * lv.length, 1);
export const treeBox = (o: Pick<PtreeObject, "src" | "k" | "x" | "y">): Bounds => {
  const lv = parseTree(o.src);
  const k = o.k || 1;
  return { x: o.x, y: o.y, w: (lv.length * 150 + 200) * k, h: Math.max(150, Math.min(leavesOf(lv), 64) * 36 + 24) * k };
};
export const makeTree = (src: string, extra: Partial<PtreeObject> = {}): ObjectTemplate<PtreeObject> & Pick<PtreeObject, "x" | "y"> =>
  ({ type: "ptree", src, c: "#1d1b2e", k: 1, x: 0, y: 0, ...extra });

type TreeNode =
  | { leaf: true; y: number; label: string; prod: number }
  | { leaf: false; y: number; kids: { it: TreeItem; node: TreeNode }[]; depth: number };

export const PTREE_TYPE: ObjectTypeDef<PtreeObject> = base<PtreeObject>({
  bounds: treeBox,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), k: Math.max(0.5, Math.min(2.5, (o.k || 1) * (to.w / treeBox(o).w))) }),
  draw(ctx, o) {
    const font = uiFont();
    const levels = parseTree(o.src);
    const box = treeBox(o);
    const k = o.k || 1;
    ctx.save();
    card(ctx, { x: o.x, y: o.y, w: box.w, h: box.h }, k);
    if (!levels.length || leavesOf(levels) > 64) {
      ctx.fillStyle = "#868e96"; ctx.font = `600 ${14 * k}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(levels.length ? "Забагато гілок (до 64)" : "Немає даних", o.x + box.w / 2, o.y + box.h / 2);
      ctx.restore(); return;
    }
    const colW = 150 * k;
    const rowH = (box.h - 24 * k) / leavesOf(levels);
    let leaf = 0;
    const rootX = o.x + 26 * k;
    const rec = (depth: number, label: string, prod: number): TreeNode => {
      if (depth === levels.length) return { leaf: true, y: o.y + 12 * k + (leaf++ + 0.5) * rowH, label, prod };
      const kids = levels[depth].map((it) => ({ it, node: rec(depth + 1, label + it.l, prod * it.p) }));
      return { leaf: false, y: kids.reduce((s, c) => s + c.node.y, 0) / kids.length, kids, depth };
    };
    const tree = rec(0, "", 1);
    const ink = o.c || INK;
    ctx.strokeStyle = ink; ctx.lineWidth = 2 * k; ctx.textBaseline = "middle";
    const draw = (n: TreeNode, x: number) => {
      if (n.leaf) {
        ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.font = `700 ${13 * k}px ${font}`;
        ctx.fillText(`${n.label} = ${fmtN(n.prod, 4)}`, x + 10 * k, n.y);
        return;
      }
      for (const { it, node } of n.kids) {
        const x2 = x + colW;
        ctx.strokeStyle = ink; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.moveTo(x, n.y); ctx.lineTo(x2, node.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(x2, node.y, 3.5 * k, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
        const mx = (x + x2) / 2, my = (n.y + node.y) / 2;
        ctx.font = `700 ${12 * k}px ${font}`; ctx.textAlign = "center";
        const t = `${it.l ? it.l + ": " : ""}${fmtN(it.p, 3)}`;
        const wTxt = ctx.measureText(t).width + 8 * k;
        ctx.fillStyle = "#fff"; ctx.fillRect(mx - wTxt / 2, my - 9 * k, wTxt, 18 * k);
        ctx.fillStyle = "#c2255c"; ctx.fillText(t, mx, my);
        draw(node, x2);
      }
    };
    ctx.beginPath(); ctx.arc(rootX, tree.y, 4 * k, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    draw(tree, rootX);
    ctx.restore();
  },
});

// =============== coordinate plane with points ===============
export const makeCplane = (extra: Partial<CplaneObject> = {}): ObjectTemplate<CplaneObject> =>
  ({ type: "cplane", c: "#1971c2", w: 420, h: 420, R: 6, pts: [[1, 2], [4, 2], [4, 5]], joined: true, closed: true, lens: false, names: true, ...extra });
const LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const cpGeom = (o: CplaneObject) => {
  const pad = 24 * (o.w / 420);
  const cell = (Math.min(o.w, o.h) - 2 * pad) / (2 * o.R);
  return { cx: o.x + o.w / 2, cy: o.y + o.h / 2, cell };
};
/** Board point → plane units. */
export const cplaneAt = (o: CplaneObject, p: Point): Point => {
  const { cx, cy, cell } = cpGeom(o);
  const u = (p[0] - cx) / cell, v = -(p[1] - cy) / cell;
  return [u, v];
};
/** Perimeter (or path length) and area (closed polygons only) in units. */
export function cplaneStats(o: CplaneObject): { per: number; area: number | null } {
  const P = o.pts || [];
  let per = 0, area = 0;
  const m = o.closed && P.length > 2 ? P.length : P.length - 1;
  for (let i = 0; i < m; i++) { const a = P[i], b = P[(i + 1) % P.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); area += a[0] * b[1] - b[0] * a[1]; }
  return { per, area: o.closed && P.length > 2 ? Math.abs(area) / 2 : null };
}

export const CPLANE_TYPE: ObjectTypeDef<CplaneObject> = base<CplaneObject>({
  interactive: true,
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  fit: (o, _from, to) => {
    const w = Math.max(220, to.w);
    return { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1(w) };
  },
  draw(ctx, o) {
    const font = uiFont();
    const k = o.w / 420;
    const { cx, cy, cell } = cpGeom(o);
    const X = (u: number) => cx + u * cell, Y = (v: number) => cy - v * cell;
    ctx.save();
    card(ctx, o, k);
    ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 14 * k); ctx.clip();
    ctx.strokeStyle = "#e1def2"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -o.R; i <= o.R; i++) { ctx.moveTo(X(i), Y(-o.R)); ctx.lineTo(X(i), Y(o.R)); ctx.moveTo(X(-o.R), Y(i)); ctx.lineTo(X(o.R), Y(i)); }
    ctx.stroke();
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(X(-o.R) - 6 * k, Y(0)); ctx.lineTo(X(o.R) + 10 * k, Y(0)); ctx.moveTo(X(0), Y(-o.R) + 6 * k); ctx.lineTo(X(0), Y(o.R) - 10 * k); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(o.R) + 12 * k, Y(0)); ctx.lineTo(X(o.R) + 2 * k, Y(0) - 4 * k); ctx.lineTo(X(o.R) + 2 * k, Y(0) + 4 * k);
    ctx.moveTo(X(0), Y(o.R) - 12 * k); ctx.lineTo(X(0) - 4 * k, Y(o.R) - 2 * k); ctx.lineTo(X(0) + 4 * k, Y(o.R) - 2 * k);
    ctx.fill();
    ctx.font = `600 ${11 * k}px ${font}`; ctx.fillStyle = "#57546e";
    const every = o.R > 12 ? 5 : o.R > 7 ? 2 : 1;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = -o.R; i <= o.R; i += every) if (i) ctx.fillText(fmtN(i, 0), X(i), Y(0) + 4 * k);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = -o.R; i <= o.R; i += every) if (i) ctx.fillText(fmtN(i, 0), X(0) - 5 * k, Y(i));
    ctx.font = `italic 700 ${14 * k}px "Times New Roman", serif`; ctx.fillStyle = INK;
    ctx.textAlign = "left"; ctx.fillText("x", X(o.R) - 4 * k, Y(0) - 12 * k); ctx.fillText("y", X(0) + 8 * k, Y(o.R) + 2 * k);
    const P = o.pts || [];
    const col = o.c || "#1971c2";
    if (o.joined && P.length > 1) {
      ctx.beginPath();
      P.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))));
      if (o.closed && P.length > 2) { ctx.closePath(); ctx.globalAlpha = 0.14; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = col; ctx.lineWidth = 2.6 * k; ctx.lineJoin = "round"; ctx.stroke();
    }
    if (o.lens && P.length > 1) {
      ctx.font = `700 ${12 * k}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const m = o.closed && P.length > 2 ? P.length : P.length - 1;
      for (let i = 0; i < m; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L = Math.hypot(dx, dy) || 1;
        const mx = X((a[0] + b[0]) / 2) + (dy / L) * 13 * k, my = Y((a[1] + b[1]) / 2) + (dx / L) * 13 * k;
        ctx.lineWidth = 4 * k; ctx.strokeStyle = "#fff"; ctx.strokeText(fmtN(L), mx, my);
        ctx.fillStyle = "#c2255c"; ctx.fillText(fmtN(L), mx, my);
      }
    }
    P.forEach((q, i) => {
      ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5 * k, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      if (o.names) {
        ctx.font = `700 ${13 * k}px ${font}`; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
        const t = `${LET[i % 26]}(${fmtN(q[0])}; ${fmtN(q[1])})`;
        ctx.lineWidth = 4 * k; ctx.strokeStyle = "#fff"; ctx.strokeText(t, X(q[0]) + 7 * k, Y(q[1]) - 5 * k);
        ctx.fillStyle = INK; ctx.fillText(t, X(q[0]) + 7 * k, Y(q[1]) - 5 * k);
      }
    });
    ctx.restore();
  },
});
