// Text with KaTeX maths: "$x^2$" inline and "$$\frac{a}{b}$$" on its own line, the same notation
// as tests and questions elsewhere on the site (components/MathText.tsx). Plain text stays plain;
// such a text is shown as a DOM element over the board (dom.ts), like formulas.
import katex from "katex";

/** KaTeX size relative to the text, and the margin around a $$…$$ line (also in board.css, export). */
export const KATEX_EM = 1.1;
export const DISPLAY_MARGIN = "0.15em";

const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/** The text has at least one $…$ / $$…$$ piece. */
export const hasMath = (text: string | undefined): boolean => !!text && /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(text);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cache = new Map<string, string>();

function renderMath(src: string, block: boolean): string {
  const key = (block ? "B:" : "I:") + src;
  let html = cache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(src, { displayMode: block, throwOnError: false, output: "html", strict: false });
    } catch {
      html = `<span class="mb-math-err">${esc(src)}</span>`;
    }
    if (cache.size > 1500) cache.delete(cache.keys().next().value!);
    cache.set(key, html);
  }
  return html;
}

/** HTML of a text with maths: plain parts escaped (line breaks kept), maths rendered by KaTeX. */
export function mathTextHtml(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MATH_RE)) {
    const plain = text.slice(last, m.index);
    out += esc(plain).replace(/\n/g, "<br>");
    out += m[1] !== undefined ? renderMath(m[1], true) : renderMath(m[2], false);
    last = (m.index ?? 0) + m[0].length;
  }
  out += esc(text.slice(last)).replace(/\n/g, "<br>");
  return out;
}

/** Inline styles shared by the board element, the measuring probe and the export. */
export function mathTextCss(font: string, color: string): string {
  return `font:${font};color:${color};line-height:1.3;white-space:nowrap;padding:0 2px;`;
}

let probe: HTMLDivElement | null = null;

/** Size of a text with maths, as laid out by the browser (canvas measureText can't see KaTeX). */
export function measureMathText(text: string, font: string): { w: number; h: number } {
  if (!probe) {
    probe = document.createElement("div");
    probe.className = "mb-mtext-probe";
    document.body.append(probe);
    // the same KaTeX tweaks as on the board (board.css .mb-mtext), so the frame fits exactly
    const st = document.createElement("style");
    st.textContent = `.mb-mtext-probe .katex{font-size:${KATEX_EM}em}.mb-mtext-probe .katex-display{margin:${DISPLAY_MARGIN} 0}`;
    document.head.append(st);
  }
  probe.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;display:inline-block;" + mathTextCss(font, "#000");
  probe.innerHTML = mathTextHtml(text);
  return { w: Math.ceil(probe.offsetWidth) + 6, h: Math.ceil(probe.offsetHeight) + 2 };
}

// ---------- export: KaTeX CSS with its fonts embedded (an SVG image can't load files) ----------
let exportCss: Promise<string> | null = null;

/** The page's KaTeX rules, with every font url() turned into a data: URL. */
export function katexCssForExport(): Promise<string> {
  if (exportCss) return exportCss;
  exportCss = (async () => {
    const rules: string[] = [];
    for (const sheet of [...document.styleSheets]) {
      let list: CSSRuleList;
      try { list = sheet.cssRules; } catch { continue; }
      for (const r of [...list]) if (/katex/i.test(r.cssText)) rules.push(r.cssText);
    }
    let css = rules.join("\n");
    const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^)"']+\.woff2)["']?\s*\)/g)].map((m) => m[1]))];
    const data: Record<string, string> = {};
    await Promise.all(urls.map(async (u) => {
      try {
        const buf = await (await fetch(u)).arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        data[u] = "data:font/woff2;base64," + btoa(bin);
      } catch {}
    }));
    css = css.replace(/url\(\s*["']?([^)"']+\.woff2)["']?\s*\)/g, (all, u: string) => (data[u] ? `url(${data[u]})` : all));
    return css;
  })();
  return exportCss;
}
