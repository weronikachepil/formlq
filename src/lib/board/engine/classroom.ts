// Lesson objects: comment, poll, timer, task card, grade stamp.
// vote and flag are service objects (never drawn): one vote / one "submitted" mark per student.
import { uiFont } from "./fonts";
import { inBounds, round1 } from "./geom";
import type {
  BoardObject, Bounds, CommentObject, ObjectTypeDef, Point, PollObject, StampKind, StampObject, TaskObject, TimerObject,
} from "./types";

let mctx: CanvasRenderingContext2D | null = null;
const measure = (font: string, text: string): number => {
  if (!mctx) mctx = document.createElement("canvas").getContext("2d");
  if (!mctx) throw new Error("2D canvas context is unavailable");
  mctx.font = font;
  return mctx.measureText(text).width;
};

/** Splits text into lines that fit `width`. */
export function wrapLines(text: string | null | undefined, font: string, width: number): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (line && measure(font, test) > width) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const move = <O extends { x: number; y: number }>(o: O, dx: number, dy: number): O => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) });
const NONE: Bounds = { x: 0, y: 0, w: 0, h: 0 };

// ---------- service (invisible) ----------
/** Registry entry for service types (vote, flag, answer, score): never drawn or hit. */
export function hiddenType<O extends BoardObject>(): ObjectTypeDef<O> {
  return { hidden: true, bounds: () => NONE, draw() {}, hit: () => false, move: (o) => o, fit: (o) => o };
}

export const HIDDEN_TYPE: ObjectTypeDef = hiddenType();

// ---------- comment ----------
export const COMMENT_TYPE: ObjectTypeDef<CommentObject> = {
  bounds: (o) => ({ x: o.x - 17, y: o.y - 36, w: 34, h: 36 }),
  draw(ctx, o) {
    const n = o.thread?.length || 0;
    const col = o.resolved ? "#40c057" : o.vis === "teacher" ? "#868e96" : "#fcc419";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(o.x - 15, o.y - 34, 30, 24, 8);
    ctx.moveTo(o.x - 4, o.y - 11);
    ctx.lineTo(o.x, o.y);
    ctx.lineTo(o.x + 5, o.y - 11);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = o.vis === "teacher" || o.resolved ? "#fff" : "#1d1b2e";
    ctx.font = `700 14px ${uiFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(o.resolved ? "✓" : String(n || "+"), o.x, o.y - 22);
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x - 17, y: o.y - 36, w: 34, h: 36 }, p, tol),
  move,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x + to.w / 2), y: round1(to.y + to.h) }),
};

// ---------- poll ----------
export interface PollLayout {
  w: number;
  /** Wrapped question lines. */
  lines: string[];
  /** Question block height. */
  qh: number;
  /** Option rows (absolute y). */
  rows: { y: number; h: number }[];
  h: number;
}

export function pollLayout(o: PollObject): PollLayout {
  const w = o.w || 340;
  const lines = wrapLines(o.q || "", `700 20px ${uiFont()}`, w - 32);
  const qh = 20 + lines.length * 26;
  const opts = o.opts || [];
  const rows = opts.map((_, i) => ({ y: o.y + qh + 8 + i * 48, h: 40 }));
  return { w, lines, qh, rows, h: qh + 12 + opts.length * 48 + 8 };
}

/** Index of the option row under the point, or -1. */
export function pollOptionAt(o: PollObject, p: Point): number {
  const L = pollLayout(o);
  if (p[0] < o.x + 12 || p[0] > o.x + L.w - 12) return -1;
  return L.rows.findIndex((r) => p[1] >= r.y && p[1] <= r.y + r.h);
}

export const POLL_TYPE: ObjectTypeDef<PollObject> = {
  bounds: (o) => ({ x: o.x, y: o.y, w: pollLayout(o).w, h: pollLayout(o).h }),
  draw(ctx, o, env) {
    const font = uiFont();
    const L = pollLayout(o);
    const info = env.polls?.get(o.id) || { counts: [], mine: -1, total: 0 };
    const showRes = !o.hide || o.closed || env.isOwner;
    ctx.save();
    ctx.shadowColor = "rgba(80,60,160,0.18)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#fff";
    rr(ctx, o.x, o.y, L.w, L.h, 18);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = o.closed ? "#adb5bd" : "#b197fc";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1d1b2e";
    ctx.font = `700 20px ${font}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    L.lines.forEach((ln, i) => ctx.fillText(ln, o.x + 16, o.y + 14 + i * 26));
    (o.opts || []).forEach((txt, i) => {
      const r = L.rows[i];
      const c = info.counts[i] || 0;
      const frac = info.total ? c / info.total : 0;
      ctx.fillStyle = "#f1f0f8";
      rr(ctx, o.x + 12, r.y, L.w - 24, r.h, 12);
      ctx.fill();
      if (showRes && frac > 0) {
        ctx.save();
        rr(ctx, o.x + 12, r.y, L.w - 24, r.h, 12);
        ctx.clip();
        ctx.fillStyle = info.mine === i ? "#b197fc" : "#d0bfff";
        ctx.fillRect(o.x + 12, r.y, (L.w - 24) * frac, r.h);
        ctx.restore();
      }
      if (info.mine === i) {
        ctx.strokeStyle = "#6d3df0";
        ctx.lineWidth = 2.4;
        rr(ctx, o.x + 12, r.y, L.w - 24, r.h, 12);
        ctx.stroke();
      }
      ctx.fillStyle = "#1d1b2e";
      ctx.font = `600 16px ${font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText((info.mine === i ? "✓ " : "") + txt, o.x + 24, r.y + r.h / 2);
      if (showRes) {
        ctx.textAlign = "right";
        ctx.fillText(`${c} · ${Math.round(frac * 100)}%`, o.x + L.w - 24, r.y + r.h / 2);
      }
    });
    if (o.closed) {
      ctx.fillStyle = "#868e96";
      ctx.font = `700 12px ${font}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("ЗАКРИТО", o.x + L.w - 14, o.y + 4);
    }
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: pollLayout(o).w, h: pollLayout(o).h }, p, tol),
  move,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(240, to.w)) }),
};

// ---------- timer ----------
/** Remaining ms at server time `now`. */
export const timerRemaining = (o: TimerObject, now: number): number => (o.running ? Math.max(0, (o.endsAt || 0) - now) : o.left ?? o.dur ?? 0);

export const TIMER_TYPE: ObjectTypeDef<TimerObject> = {
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }),
  draw(ctx, o, env) {
    const font = uiFont();
    const now = env.now ?? Date.now();
    const rem = timerRemaining(o, now);
    const dur = o.dur || 1;
    const frac = Math.max(0, Math.min(1, rem / dur));
    const done = rem <= 0 && (o.running || o.left === 0);
    const blink = done && Math.floor(now / 500) % 2 === 0;
    const sec = Math.ceil(rem / 1000);
    const text = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    const col = done ? "#e03131" : frac < 0.15 ? "#e8590c" : frac < 0.4 ? "#f08c00" : "#2f9e44";
    ctx.save();
    ctx.shadowColor = "rgba(80,60,160,0.18)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = blink ? "#ffe3e3" : "#fff";
    rr(ctx, o.x, o.y, o.w, o.h, 20);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#868e96";
    ctx.font = `700 13px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(o.title || (o.running ? "Таймер іде" : done ? "Час вийшов!" : "Таймер"), o.x + o.w / 2, o.y + 12);
    ctx.fillStyle = col;
    ctx.font = `700 ${Math.round(o.h * 0.42)}px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, o.x + o.w / 2, o.y + o.h * 0.52);
    ctx.fillStyle = "#e9ecef";
    rr(ctx, o.x + 18, o.y + o.h - 20, o.w - 36, 8, 4);
    ctx.fill();
    ctx.fillStyle = col;
    if (frac > 0) { rr(ctx, o.x + 18, o.y + o.h - 20, (o.w - 36) * frac, 8, 4); ctx.fill(); }
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: o.w, h: o.h }, p, tol),
  move,
  fit: (o, _from, to) => {
    const w = Math.max(160, to.w);
    return { ...o, x: round1(to.x), y: round1(to.y), w: round1(w), h: round1(w * 0.54) };
  },
};

// ---------- task card ----------
export function taskLayout(o: TaskObject): { w: number; lines: string[]; h: number } {
  const w = o.w || 420;
  const lines = wrapLines(o.text || "", `500 17px ${uiFont()}`, w - 40);
  return { w, lines, h: 64 + lines.length * 24 + 18 };
}

export const TASK_TYPE: ObjectTypeDef<TaskObject> = {
  bounds: (o) => ({ x: o.x, y: o.y, w: taskLayout(o).w, h: taskLayout(o).h }),
  draw(ctx, o) {
    const font = uiFont();
    const L = taskLayout(o);
    ctx.save();
    ctx.shadowColor = "rgba(80,60,160,0.16)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#fff";
    rr(ctx, o.x, o.y, L.w, L.h, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#6d3df0";
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, 8, L.h, [16, 0, 0, 16]);
    ctx.fill();
    ctx.fillStyle = "#6d3df0";
    ctx.font = `700 22px ${font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(o.title || "Завдання", o.x + 24, o.y + 14);
    if (o.pts) {
      const t = `${o.pts}`;
      ctx.font = `700 14px ${font}`;
      const tw = ctx.measureText(t).width + 18;
      ctx.fillStyle = "#f3f0ff";
      rr(ctx, o.x + L.w - tw - 14, o.y + 14, tw, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#6d3df0";
      ctx.textAlign = "center";
      ctx.fillText(t, o.x + L.w - tw / 2 - 14, o.y + 20);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#1d1b2e";
    ctx.font = `500 17px ${font}`;
    L.lines.forEach((ln, i) => ctx.fillText(ln, o.x + 24, o.y + 54 + i * 24));
    ctx.restore();
  },
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: taskLayout(o).w, h: taskLayout(o).h }, p, tol),
  move,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y), w: round1(Math.max(240, to.w)) }),
};

// ---------- grade stamp ----------
export const STAMPS: Record<StampKind, { glyph: string; color: string; name: string }> = {
  ok: { glyph: "✓", color: "#2f9e44", name: "Правильно" },
  bad: { glyph: "✗", color: "#e03131", name: "Неправильно" },
  part: { glyph: "½", color: "#f08c00", name: "Частково" },
  q: { glyph: "?", color: "#7048e8", name: "Поясніть" },
};

export const STAMP_TYPE: ObjectTypeDef<StampObject> = {
  bounds: (o) => ({ x: o.x - 24, y: o.y - 24, w: 48, h: 48 }),
  draw(ctx, o) {
    const font = uiFont();
    const s = STAMPS[o.kind] || STAMPS.ok;
    ctx.save();
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 26px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.glyph, o.x, o.y + 1);
    if (o.text) {
      ctx.fillStyle = s.color;
      ctx.font = `700 20px ${font}`;
      ctx.textAlign = "left";
      ctx.fillText(o.text, o.x + 30, o.y + 1);
    }
    ctx.restore();
  },
  hit: (o, p, tol) => Math.hypot(p[0] - o.x, p[1] - o.y) <= 24 + tol,
  move,
  fit: (o, _from, to) => ({ ...o, x: round1(to.x + to.w / 2), y: round1(to.y + to.h / 2) }),
};
