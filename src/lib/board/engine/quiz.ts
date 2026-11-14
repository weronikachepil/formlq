// Test questions on the board: card (DOM), answer grading, statistics.
// The server does not send the key (key, expl, explImg) to students until the teacher turns on reveal.
import { inBounds, round1 } from "./geom";
import { TYPE_NAMES } from "./quizparse";
import type { ObjectTypeDef, QuizAnswerValue, QuizGrade, QuizObject } from "./types";

export const QUIZ_W = 640;

export const QUIZ_TYPE: ObjectTypeDef<QuizObject> = {
  dom: true,
  bounds: (o) => ({ x: o.x, y: o.y, w: o.w || QUIZ_W, h: o.h || 240 }),
  draw() {},
  hit: (o, p, tol) => inBounds({ x: o.x, y: o.y, w: o.w || QUIZ_W, h: o.h || 240 }, p, tol),
  move: (o, dx, dy) => ({ ...o, x: round1(o.x + dx), y: round1(o.y + dy) }),
  fit: (o, _from, to) => ({ ...o, x: round1(to.x), y: round1(to.y) }),
};

const num = (s: unknown): number | null => {
  const t = String(s ?? "").replace(/\s/g, "").replace(/[−–]/g, "-").replace(",", ".");
  return /^[-+]?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

export function isCorrectShort(key: unknown, val: unknown): boolean {
  const a = num(key), b = num(val);
  if (a !== null && b !== null) return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
  return String(key ?? "").trim().toLowerCase() === String(val ?? "").trim().toLowerCase() && String(key ?? "").trim() !== "";
}

/** Grades an answer. Needs the key (teacher, or after reveal); returns null without it. */
export function gradeQuiz(q: QuizObject, val: QuizAnswerValue | null | undefined): QuizGrade | null {
  const max = q.pts || 1;
  const k = q.key;
  if (!k) return null;
  if (val === undefined || val === null || val === "" || (typeof val === "object" && !Object.keys(val).length)) return { earned: 0, max, state: "empty" };
  if (q.qt === "choice") return val === k.correct ? { earned: max, max, state: "full" } : { earned: 0, max, state: "none" };
  if (q.qt === "short") return isCorrectShort(k.answer, val) ? { earned: max, max, state: "full" } : { earned: 0, max, state: "none" };
  const pairs = k.pairs || {};
  const total = Object.keys(pairs).length || 1;
  let ok = 0;
  for (const [n, l] of Object.entries(pairs)) if ((typeof val === "string" ? val[Number(n)] : val[n]) === l) ok++;
  const earned = Math.round((max * ok / total) * 100) / 100;
  return { earned, max, state: ok === total ? "full" : ok ? "part" : "none" };
}

// ---------- card HTML ----------
const esc = (s: unknown): string => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Renders LaTeX inside $...$ through `markup` (HTML-escaped when absent) and escapes the rest. */
export function rich(text: string | null | undefined, markup?: ((latex: string) => string) | null): string {
  return String(text ?? "")
    .split(/(\$[^$]+\$)/g)
    .map((p) => (p.length > 2 && p.startsWith("$") && p.endsWith("$") ? `<span class="q-math">${markup ? markup(p.slice(1, -1)) : esc(p.slice(1, -1))}</span>` : esc(p).replace(/\n/g, "<br>")))
    .join("");
}

const pretty = (v: unknown): string => String(v ?? "").replace(".", ",");

/** Owner-side answer statistics for one card. */
export interface QuizCardStats {
  answered: number;
  full: number;
  /** choice: votes per option letter. */
  dist?: Record<string, number>;
}

/** Render context of a quiz card. */
export interface QuizHtmlCtx {
  /** Current answer (own, or the viewed student's). */
  mine?: QuizAnswerValue | null;
  reveal?: boolean;
  isOwner?: boolean;
  /** Answers are closed. */
  locked?: boolean;
  stats?: QuizCardStats | null;
  /** LaTeX → HTML renderer. */
  markup?: ((latex: string) => string) | null;
  /** Name of the student whose answers the owner is viewing. */
  viewing?: string | null;
  /** Show the key to the owner. */
  showKey?: boolean;
}

export function buildQuizHtml(o: QuizObject, ctx: QuizHtmlCtx): string {
  const r = (t: string) => rich(t, ctx.markup);
  const dis = ctx.isOwner || ctx.locked ? " disabled" : "";
  const known = !!o.key && (ctx.showKey || ctx.reveal);
  const showKey = known;
  const grade = known ? gradeQuiz(o, ctx.mine) : null;
  let html = `<div class="q-head"><span class="q-n">${esc(o.n)}</span><span class="q-type">${TYPE_NAMES[o.qt] || ""}</span><span class="q-pts">${esc(pretty(o.pts))} б.</span></div>`;
  html += `<div class="q-text">${r(o.text)}</div>`;
  if (o.img) html += `<img class="q-img" src="${esc(o.img)}" alt="">`;

  if (o.qt === "choice") {
    html += '<div class="q-opts">';
    for (const op of o.opts || []) {
      let cls = ctx.mine === op.l ? " sel" : "";
      if (ctx.reveal && o.key) cls += op.l === o.key.correct ? " ok" : ctx.mine === op.l ? " bad" : "";
      html += `<button class="q-opt${cls}" data-ui data-act="opt" data-v="${esc(op.l)}"${dis}><b>${esc(op.l)}</b><span>${r(op.t)}</span></button>`;
    }
    html += "</div>";
  } else if (o.qt === "match") {
    const mine: Record<string, string> = typeof ctx.mine === "object" && ctx.mine ? ctx.mine : {};
    html += '<div class="q-match"><div class="q-col">';
    for (const l of o.left || []) {
      let cls = "";
      let extra = "";
      if (ctx.reveal && o.key?.pairs) {
        const right = o.key.pairs[l.n];
        cls = mine[l.n] === right ? " ok" : " bad";
        if (mine[l.n] !== right) extra = `<i class="q-fix">→ ${esc(right)}</i>`;
      }
      html += `<div class="q-row"><span class="q-li">${esc(l.n)}. ${r(l.t)}</span><select class="q-sel${cls}" data-ui data-act="match" data-n="${esc(l.n)}"${dis}><option value="">—</option>${(o.right || []).map((x) => `<option value="${esc(x.l)}"${mine[l.n] === x.l ? " selected" : ""}>${esc(x.l)}</option>`).join("")}</select>${extra}</div>`;
    }
    html += '</div><div class="q-col">';
    for (const x of o.right || []) html += `<div class="q-ri"><b>${esc(x.l)}.</b> ${r(x.t)}</div>`;
    html += "</div></div>";
  } else {
    const cls = ctx.reveal && o.key ? (isCorrectShort(o.key.answer, ctx.mine) ? " ok" : " bad") : "";
    html += `<div class="q-short"><input class="q-input${cls}" data-ui data-act="short" type="text" inputmode="decimal" autocomplete="off" placeholder="Ваша відповідь (число)" value="${esc(ctx.mine ?? "")}"${dis}><span class="q-saved"></span></div>`;
  }

  if (showKey && o.key) {
    const keyText = o.qt === "choice" ? o.key.correct : o.qt === "short" ? o.key.answer : Object.entries(o.key.pairs || {}).map(([n, l]) => `${n}-${l}`).join(", ");
    html += `<div class="q-key">Правильна відповідь: <b>${esc(keyText)}</b></div>`;
  }
  if ((!ctx.isOwner || ctx.viewing) && ctx.reveal && grade) html += `<div class="q-score ${grade.state}">Ваш результат: ${esc(pretty(grade.earned))} з ${esc(pretty(grade.max))}</div>`;
  if (known && o.expl) {
    html += `<details class="q-expl" data-ui${ctx.isOwner ? "" : " open"}><summary>Пояснення</summary><div>${r(o.expl)}</div>${o.explImg ? `<img class="q-img" src="${esc(o.explImg)}" alt="">` : ""}</details>`;
  }
  if (ctx.isOwner && !ctx.viewing && ctx.stats) {
    const stats = ctx.stats;
    const dist = o.qt === "choice" ? (o.opts || []).map((op) => `${esc(op.l)}: <b>${stats.dist?.[op.l] || 0}</b>`).join(" · ") : "";
    html += `<div class="q-stats">Відповіли: <b>${stats.answered}</b> · Повністю правильно: <b>${stats.full}</b>${dist ? `<br>Обрали: ${dist}` : ""}</div>`;
  }
  if (ctx.isOwner && !ctx.viewing && !o.reveal) html += `<div class="q-hint">${ctx.showKey ? "Ключ видно лише вам. " : ""}Учні не бачать правильну відповідь і пояснення, поки ви не відкриєте їх.</div>`;
  return html;
}
