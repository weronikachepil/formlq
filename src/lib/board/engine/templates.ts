// Ready-made templates: number line, tables, Euler–Venn diagrams, function value table.
// Return plain objects (lines, text, ellipses) without id/z — the board assigns them.
import { fmtNum, graphValues } from "./graph";
import { measureText } from "./shapes";
import type { DrawStyle, EllipseObject, GraphObject, LineObject, ObjectDraft, Point, TextObject } from "./types";

export type TemplateName = "numline" | "table" | "venn2" | "venn3" | "values";

export interface TemplateOptions {
  rows?: number;
  cols?: number;
  /** Source graph for "values". */
  graph?: GraphObject;
  /** x values for "values"; defaults to −3…3. */
  xs?: number[];
}

export type TemplateObject = ObjectDraft<LineObject | TextObject | EllipseObject>;
type St = Pick<DrawStyle, "c" | "s">;

const line = (a: Point, b: Point, st: St, extra: Partial<Pick<LineObject, "arrow" | "s">> = {}): ObjectDraft<LineObject> =>
  ({ type: "line", pts: [[a[0], a[1]], [b[0], b[1]]], c: st.c, s: Math.max(2, st.s * 0.7), ...extra });
const text = (str: string, x: number, y: number, fs: number, st: St, align: "center" | "left" = "center"): ObjectDraft<TextObject> => {
  const m = measureText(str, fs);
  return { type: "text", text: str, fs, c: st.c, x: Math.round(align === "center" ? x - m.w / 2 : x), y: Math.round(y), w: m.w, h: m.h };
};

function numberLine(c: Point, st: St): TemplateObject[] {
  const out: TemplateObject[] = [];
  const step = 60;
  const half = 6;
  const y = c[1];
  out.push(line([c[0] - half * step - 30, y], [c[0] + half * step + 30, y], st, { arrow: true, s: 3 }));
  for (let i = -half; i <= half; i++) {
    const x = c[0] + i * step;
    out.push(line([x, y - 8], [x, y + 8], st, { s: 2.5 }));
    out.push(text(String(i).replace("-", "−"), x, y + 14, 20, st));
  }
  return out;
}

function table(c: Point, st: St, rows: number, cols: number, cw = 110, ch = 52): TemplateObject[] {
  const out: TemplateObject[] = [];
  const w = cols * cw, h = rows * ch;
  const x0 = c[0] - w / 2, y0 = c[1] - h / 2;
  for (let i = 0; i <= rows; i++) out.push(line([x0, y0 + i * ch], [x0 + w, y0 + i * ch], st, { s: 2.5 }));
  for (let j = 0; j <= cols; j++) out.push(line([x0 + j * cw, y0], [x0 + j * cw, y0 + h], st, { s: 2.5 }));
  return out;
}

function venn(c: Point, st: St, n: 2 | 3): TemplateObject[] {
  const r = 120;
  const fills = ["#3b5bdb", "#e8590c", "#2f9e44"];
  const centers: Point[] = n === 2 ? [[c[0] - 70, c[1]], [c[0] + 70, c[1]]] : [[c[0] - 70, c[1] + 40], [c[0] + 70, c[1] + 40], [c[0], c[1] - 80]];
  const out: TemplateObject[] = [];
  centers.forEach((p, i) => {
    out.push({ type: "ellipse", x: p[0] - r, y: p[1] - r, w: r * 2, h: r * 2, c: fills[i], s: 3, f: fills[i], dash: false });
  });
  centers.forEach((p, i) => {
    const dx = p[0] - c[0], dy = p[1] - (n === 2 ? c[1] : c[1] + 10);
    const l = Math.hypot(dx, dy) || 1;
    out.push(text("ABC"[i], p[0] + (dx / l) * 125, p[1] + (dy / l) * 125 - 14, 28, st));
  });
  return out;
}

/** Value table of the graph's first y = f(x) function. */
function valuesTable(c: Point, st: St, g: GraphObject, xs: number[] | undefined): TemplateObject[] {
  const list = xs && xs.length ? xs : [-3, -2, -1, 0, 1, 2, 3];
  const { values, error } = graphValues(g, list);
  if (!values) return [];
  if (error) console.warn("[mathboard] таблиця значень:", error);
  const cols = list.length + 1;
  const cy = g.y + g.h + 150;
  const out = table([g.x + g.w / 2, cy], st, 2, cols, 74, 44);
  const x0 = g.x + g.w / 2 - (cols * 74) / 2;
  const y0 = cy - 44;
  out.push(text("x", x0 + 37, y0 + 8, 22, st));
  out.push(text("y", x0 + 37, y0 + 52, 22, st));
  list.forEach((xv, i) => {
    const v = values[i];
    out.push(text(fmtNum(xv), x0 + 74 * (i + 1) + 37, y0 + 8, 20, st));
    out.push(text(v === null ? "—" : fmtNum(v, 2), x0 + 74 * (i + 1) + 37, y0 + 52, 20, st));
  });
  return out;
}

export function buildTemplate(name: TemplateName | (string & Record<never, never>), c: Point, st: St, opts: TemplateOptions = {}): TemplateObject[] {
  if (name === "numline") return numberLine(c, st);
  if (name === "table") return table(c, st, opts.rows || 3, opts.cols || 3);
  if (name === "venn2") return venn(c, st, 2);
  if (name === "venn3") return venn(c, st, 3);
  if (name === "values") return opts.graph ? valuesTable(c, st, opts.graph, opts.xs) : [];
  return [];
}
