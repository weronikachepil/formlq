// HTML layer above the canvas: formulas (MathLive), quiz cards and graph parameter sliders.
// The whole layer is transformed with the camera matrix, so elements sit in board coordinates.
import type { MathfieldElement } from "mathlive";
import { graphParams } from "./graph";
import { buildQuizHtml } from "./quiz";
import type { MathBoard } from "./board";
import type { BoardObject, Camera, FormulaObject, GraphObject, Op, QuizObject, TextObject } from "./types";
import { hasMath, mathTextCss, mathTextHtml } from "./katexText";
import { fontCss } from "./shapes";

type MathliveModule = typeof import("mathlive");

let mathliveReady: Promise<MathliveModule> | null = null;
function loadMathlive(): Promise<MathliveModule> {
  if (!mathliveReady) {
    mathliveReady = import("mathlive").then((mod) => {
      mod.MathfieldElement.fontsDirectory = "/mathlive-fonts";
      mod.MathfieldElement.soundsDirectory = null;
      return mod;
    });
  }
  return mathliveReady;
}

const fmt = (v: number): string => String(parseFloat(v.toFixed(2))).replace(".", ",");

/** A DOM node owned by the layer, keyed by object id. */
interface DomNode {
  el: HTMLDivElement;
  /** Object the node was last rendered from (reference equality = up to date). */
  obj: BoardObject | null;
  /** Formula editor (formula nodes only). */
  mf?: MathfieldElement;
  /** Slider signature (graph nodes only). */
  sig?: string;
  // quiz nodes: the inputs of the last render
  quizObj?: QuizObject;
  mine?: unknown;
  statsKey?: string;
  viewing?: string | null;
  locked?: boolean;
  showKey?: boolean;
  css?: boolean;
}

/** Pending debounce timers of short-answer inputs. */
/**
 * The quiz layout stores each card's position and height (`y`, `h`) back on the object;
 * that alone must not rebuild the card, or opening an explanation (which makes the card
 * taller) would at once rebuild it collapsed.
 */
function onlyLayoutChanged(prev: BoardObject | null | undefined, next: QuizObject): boolean {
  if (!prev || prev.type !== "quiz") return false;
  const a = prev as unknown as Record<string, unknown>;
  const b = next as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (k !== "y" && k !== "h" && a[k] !== b[k]) return false;
  return true;
}

const inputTimers = new WeakMap<HTMLInputElement, ReturnType<typeof setTimeout>>();

export class DomLayer {
  board: MathBoard;
  el: HTMLElement;
  nodes = new Map<string, DomNode>();
  ready = false;
  error: unknown = null;
  loading: Promise<void>;
  markupFn: ((latex: string) => string) | null = null;
  /** undefined: not requested yet; false: loading; true: loaded. */
  cssReady: boolean | undefined = undefined;
  private _ql: number | null = null;

  constructor(board: MathBoard, el: HTMLElement) {
    this.board = board;
    this.el = el;
    // start loading MathLive right away: the first load can take a few seconds
    this.loading = loadMathlive()
      .then((mod) => {
        this.markupFn = mod.convertLatexToMarkup;
        this.ready = true;
        board.domDirty = true;
        board.requestRender();
        this.loadMathCss();
      })
      .catch((e: unknown) => { this.error = e; console.error("[mathboard] не вдалося завантажити MathLive", e); board.onMathError?.(e); });
  }

  /** Styles for maths inside quiz cards (fonts come from /mathlive-fonts). */
  loadMathCss(): void {
    if (this.cssReady !== undefined) return;
    this.cssReady = false;
    fetch("/mathlive-static.css").then((r) => r.text()).then((css) => {
      const st = document.createElement("style");
      st.textContent = css.replace(/url\(\s*["']?fonts\//g, "url(/mathlive-fonts/");
      document.head.append(st);
      this.cssReady = true;
      this.board.domDirty = true;
      this.board.requestRender();
    }).catch(() => {});
  }

  setCamera(cam: Camera): void {
    this.el.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;
  }

  sync(): void {
    const seen = new Set<string>();
    for (const o0 of this.board.objs() as BoardObject[]) {
      const o: BoardObject = this.board.viewObj(o0);
      if (o.type === "formula") {
        if (this.ready) { this.syncFormula(o); seen.add(o.id); }
      } else if (o.type === "graph") {
        this.syncGraph(o);
        seen.add(o.id);
      } else if (o.type === "quiz") {
        if (this.ready) { this.syncQuiz(o); seen.add(o.id); }
      } else if (o.type === "text" && hasMath(o.text)) {
        this.syncMathText(o);
        seen.add(o.id);
      }
    }
    for (const [id, n] of this.nodes) {
      if (!seen.has(id) && !(n.mf && !this.ready)) { n.el.remove(); this.nodes.delete(id); }
    }
  }

  // ---------- quiz question ----------
  syncQuiz(o: QuizObject): void {
    let n = this.nodes.get(o.id);
    if (!n) {
      const el = document.createElement("div");
      el.className = "mb-quiz";
      el.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.dataset.act === "short") e.target.blur();
      });
      el.addEventListener("click", (e) => {
        const t = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-act="opt"]') : null;
        if (t && !t.disabled) this.board.answerQuiz(o.id, t.dataset.v);
      });
      // a typed number is saved while typing (slightly debounced), not only when the field loses focus
      el.addEventListener("input", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement) || t.dataset.act !== "short") return;
        clearTimeout(inputTimers.get(t));
        const mark = el.querySelector(".q-saved");
        if (mark) mark.textContent = "…";
        inputTimers.set(t, setTimeout(() => {
          this.board.answerQuiz(o.id, t.value.trim());
          const m2 = el.querySelector(".q-saved");
          if (m2) m2.textContent = "Збережено ✓";
        }, 350));
      });
      el.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.dataset.act === "match") {
          const map: Record<string, string> = {};
          el.querySelectorAll<HTMLSelectElement>('select[data-act="match"]').forEach((s2) => { if (s2.value && s2.dataset.n) map[s2.dataset.n] = s2.value; });
          this.board.answerQuiz(o.id, map);
        } else if (t.dataset.act === "short" && t instanceof HTMLInputElement) this.board.answerQuiz(o.id, t.value.trim());
      });
      el.addEventListener("load", () => this.scheduleQuizLayout(), true);
      el.addEventListener("toggle", () => this.scheduleQuizLayout(), true);
      this.el.append(el);
      n = { el, obj: null };
      el.style.top = o.y + "px";
      this.nodes.set(o.id, n);
    }
    n.quizObj = o;
    const ctx = this.board.quizCtx(o);
    // while the student types, their own save does not rebuild the card (the caret would be lost)
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const typing = !!active && n.el.contains(active) && active instanceof HTMLElement && active.dataset.act === "short";
    const same = (n.obj === o || onlyLayoutChanged(n.obj, o)) && (n.mine === ctx.mineRef || typing) && n.statsKey === ctx.statsKey && n.viewing === ctx.viewing && n.locked === ctx.locked && n.showKey === ctx.showKey && n.css === this.cssReady;
    n.el.style.left = o.x + "px";
    n.el.style.width = (o.w || 640) + "px";
    if (o.auto === false) n.el.style.top = o.y + "px";
    if (same) {
      n.obj = o;
      if (typing) n.mine = ctx.mineRef;
      return;
    }
    n.obj = o;
    n.mine = ctx.mineRef;
    n.statsKey = ctx.statsKey;
    n.viewing = ctx.viewing;
    n.locked = ctx.locked;
    n.showKey = ctx.showKey;
    n.css = this.cssReady;
    // Rebuilding the card must not collapse an explanation the user has opened (or reopen a closed one).
    const expl = n.el.querySelector<HTMLDetailsElement>(".q-expl");
    const explOpen = expl ? expl.open : null;
    n.el.innerHTML = buildQuizHtml(o, ctx);
    if (explOpen !== null) {
      const next = n.el.querySelector<HTMLDetailsElement>(".q-expl");
      if (next) next.open = explOpen;
    }
    this.scheduleQuizLayout();
  }

  // Quiz cards are stacked in a column by their real height (explanations, images and counters make it
  // vary), so every client lays them out itself. The teacher also stores heights and positions.
  scheduleQuizLayout(): void {
    if (this._ql) return;
    this._ql = requestAnimationFrame(() => { this._ql = null; this.layoutQuiz(); });
  }

  layoutQuiz(): void {
    const items = [...this.nodes.values()]
      .filter((n): n is DomNode & { quizObj: QuizObject } => !!n.quizObj && n.quizObj.auto !== false)
      .sort((a, b) => a.quizObj.n - b.quizObj.n);
    if (!items.length) return;
    let y = Math.min(...items.map((n) => n.quizObj.y));
    const changes: Op[] = [];
    for (const n of items) {
      const o = n.quizObj;
      n.el.style.top = y + "px";
      const h = n.el.offsetHeight;
      if (this.board.isOwner && (Math.abs(o.y - y) > 1 || Math.abs((o.h || 0) - h) > 2)) changes.push([o.id, { ...o, y: Math.round(y), h }]);
      y += h + 36;
    }
    if (changes.length) { this.board.commit(changes); this.board.flushNet(); }
    if (this.board.pendingFit && (this.board.objs() as BoardObject[]).filter((o) => o.type === "quiz").length === items.length && !changes.length) {
      this.board.pendingFit = false;
      this.board.zoomToFit();
    }
  }

  // ---------- text with KaTeX maths ----------
  syncMathText(o: TextObject): void {
    let n = this.nodes.get(o.id);
    if (!n) {
      const el = document.createElement("div");
      el.className = "mb-mtext";
      this.el.append(el);
      n = { el, obj: null };
      this.nodes.set(o.id, n);
    }
    // the text being edited is shown by its textarea
    n.el.style.display = this.board.editing?.id === o.id ? "none" : "";
    if (n.obj === o) return;
    n.obj = o;
    n.el.style.cssText = `left:${o.x}px;top:${o.y}px;transform-origin:50% 50%;${o.rot ? `transform:rotate(${o.rot}rad);` : ""}`
      + mathTextCss(fontCss(o, o.fs), o.c || "#1d1b2e") + (n.el.style.display ? "display:none;" : "");
    n.el.innerHTML = mathTextHtml(o.text);
  }

  // ---------- formula ----------
  syncFormula(o: FormulaObject): void {
    let n = this.nodes.get(o.id);
    if (!n) {
      const el = document.createElement("div");
      el.className = "mb-formula";
      // "math-field" is not in HTMLElementTagNameMap; mathlive registers it on import
      const mf = document.createElement("math-field") as MathfieldElement;
      mf.setAttribute("read-only", "");
      mf.readOnly = true;
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.addEventListener("input", () => this.board.onFormulaInput(o.id, mf, el));
      // focus briefly moves to a button / the virtual keyboard — that is not the end of editing
      mf.addEventListener("blur", () => setTimeout(() => {
        if (document.activeElement === mf || mf.matches(":focus-within") || window.mathVirtualKeyboard?.visible) return;
        this.board.onFormulaBlur(o.id);
      }, 250));
      mf.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); mf.blur(); }
      });
      el.append(mf);
      this.el.append(el);
      n = { el, mf, obj: null };
      this.nodes.set(o.id, n);
    }
    if (n.obj === o) return;
    n.obj = o;
    n.el.style.left = o.x + "px";
    n.el.style.top = o.y + "px";
    n.el.style.transformOrigin = "50% 50%";
    n.el.style.transform = o.rot ? `rotate(${o.rot}rad)` : "";
    const mf = n.mf;
    if (!mf) return;
    mf.style.fontSize = o.fs + "px";
    mf.style.color = o.c || "#1d1b2e";
    const editing = this.board.editing?.id === o.id;
    if (!editing && mf.getValue?.() !== o.latex) mf.setValue?.(o.latex, { silenceNotifications: true });
  }

  focusFormula(id: string): boolean {
    const n = this.nodes.get(id);
    if (!n?.mf) return false;
    n.mf.readOnly = false;
    n.mf.removeAttribute("read-only");
    n.mf.mathVirtualKeyboardPolicy = "auto";
    n.el.classList.add("editing");
    n.el.setAttribute("data-ui", "");
    n.mf.focus();
    return true;
  }

  blurFormula(id: string): void {
    const n = this.nodes.get(id);
    if (!n?.mf) return;
    // drop the caret / selection: a read-only field keeps showing it as a highlighted group
    try { n.mf.executeCommand?.("moveToMathfieldEnd"); } catch {}
    n.mf.readOnly = true;
    n.mf.setAttribute("read-only", "");
    n.mf.mathVirtualKeyboardPolicy = "manual";
    n.el.classList.remove("editing");
    n.el.removeAttribute("data-ui");
  }

  measure(id: string): { w: number; h: number } | null {
    const n = this.nodes.get(id);
    return n ? { w: n.el.offsetWidth, h: n.el.offsetHeight } : null;
  }

  // ---------- graph sliders ----------
  syncGraph(o: GraphObject): void {
    let n = this.nodes.get(o.id);
    const params = graphParams(o);
    if (!params.length) {
      if (n) { n.el.remove(); this.nodes.delete(o.id); }
      return;
    }
    if (!n) {
      const el = document.createElement("div");
      el.className = "mb-sliders";
      el.setAttribute("data-ui", "");
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      this.el.append(el);
      n = { el, obj: null, sig: "" };
      this.nodes.set(o.id, n);
    }
    n.obj = o;
    n.el.style.left = o.x + "px";
    n.el.style.top = o.y + o.h + 8 + "px";
    n.el.style.width = o.w + "px";
    const sig = params.map((p) => `${p.name}:${p.min}:${p.max}:${p.step}`).join("|");
    if (sig !== n.sig) {
      n.sig = sig;
      n.el.innerHTML = "";
      for (const p of params) {
        const row = document.createElement("label");
        row.className = "mb-slider";
        const name = document.createElement("i");
        name.textContent = p.name;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(p.min);
        input.max = String(p.max);
        input.step = String(p.step);
        input.value = String(p.value);
        input.disabled = false;
        input.dataset.name = p.name;
        const val = document.createElement("span");
        val.textContent = fmt(p.value);
        input.addEventListener("input", () => {
          val.textContent = fmt(Number(input.value));
          this.board.setGraphParam(o.id, p.name, Number(input.value));
        });
        input.addEventListener("change", () => this.board.endLive());
        row.append(name, input, val);
        n.el.append(row);
      }
    } else {
      for (const p of params) {
        const input = n.el.querySelector<HTMLInputElement>(`input[data-name="${p.name}"]`);
        if (input && document.activeElement !== input) {
          input.value = String(p.value);
          if (input.nextSibling) input.nextSibling.textContent = fmt(p.value);
        }
      }
    }
  }

  destroy(): void {
    for (const n of this.nodes.values()) n.el.remove();
    this.nodes.clear();
  }
}
