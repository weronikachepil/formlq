// Board export to PNG (current page) and PDF (all pages, one per PDF page).
import { T } from "./shapes";
import { unionBounds } from "./geom";
import type { MathBoard } from "./board";
import type { BoardObject, DrawEnv, FormulaObject, ObjectTypeDef, Rotatable } from "./types";

const MAX_SIDE = 4096;

const def = (o: BoardObject): ObjectTypeDef => T[o.type];

function download(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const stamp = (): string => new Date().toISOString().slice(0, 10);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------- formulas: rendered through an SVG foreignObject with embedded fonts ----------
let cssCache: string | null = null;
async function mathCss(): Promise<string> {
  if (cssCache) return cssCache;
  let css = await (await fetch("/mathlive-static.css")).text();
  const names = [...new Set([...css.matchAll(/url\(\s*["']?fonts\/([^)"']+)["']?\s*\)/g)].map((m) => m[1]))];
  const data: Record<string, string> = {};
  await Promise.all(names.map(async (n) => {
    const buf = await (await fetch("/mathlive-fonts/" + n)).arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    data[n] = "data:font/woff2;base64," + btoa(bin);
  }));
  css = css.replace(/url\(\s*["']?fonts\/([^)"']+)["']?\s*\)/g, (_, n: string) => `url(${data[n]})`);
  cssCache = css;
  return css;
}

async function formulaImage(o: FormulaObject): Promise<{ img: HTMLImageElement; w: number; h: number }> {
  const { convertLatexToMarkup } = await import("mathlive");
  const css = await mathCss();
  const wrap = document.createElement("div");
  wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrap.style.cssText = `font-size:${o.fs}px;color:${o.c || "#1d1b2e"};white-space:nowrap;display:inline-block;line-height:normal;padding:2px 8px;`;
  wrap.innerHTML = `<style>${css}</style>${convertLatexToMarkup(o.latex)}`;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:-9999px;top:0;visibility:hidden;";
  probe.append(wrap);
  document.body.append(probe);
  await document.fonts.ready;
  const w = Math.ceil(wrap.offsetWidth) + 2;
  const h = Math.ceil(wrap.offsetHeight) + 2;
  const xhtml = new XMLSerializer().serializeToString(wrap);
  probe.remove();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  return { img, w, h };
}

async function drawBoxed(ctx: CanvasRenderingContext2D, o: Rotatable, drawFn: () => Promise<void>): Promise<void> {
  const c = [o.x + o.w / 2, o.y + o.h / 2];
  ctx.save();
  if (o.rot) { ctx.translate(c[0], c[1]); ctx.rotate(o.rot); ctx.translate(-c[0], -c[1]); }
  await drawFn();
  ctx.restore();
}

/** Draws the objects into a separate canvas. Returns null when there is nothing to draw. */
export async function renderObjects(
  objs: BoardObject[],
  { scale = 2, grid = false }: { scale?: number; grid?: boolean } = {},
): Promise<HTMLCanvasElement | null> {
  const list = objs.filter((o) => o.type !== "page" && o.type !== "comment" && !def(o).hidden);
  const b = unionBounds(list.map((o) => def(o).bounds(o)));
  if (!b) return null;
  const pad = 40;
  const bw = b.w + pad * 2;
  const bh = b.h + pad * 2;
  const k = Math.min(scale, MAX_SIDE / Math.max(bw, bh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bw * k));
  c.height = Math.max(1, Math.round(bh * k));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.setTransform(k, 0, 0, k, (-b.x + pad) * k, (-b.y + pad) * k);
  if (grid) {
    ctx.strokeStyle = "#e6eaf6";
    ctx.lineWidth = 1 / k;
    ctx.beginPath();
    for (let x = Math.floor((b.x - pad) / 40) * 40; x < b.x + b.w + pad; x += 40) { ctx.moveTo(x, b.y - pad); ctx.lineTo(x, b.y + b.h + pad); }
    for (let y = Math.floor((b.y - pad) / 40) * 40; y < b.y + b.h + pad; y += 40) { ctx.moveTo(b.x - pad, y); ctx.lineTo(b.x + b.w + pad, y); }
    ctx.stroke();
  }
  const env: DrawEnv = { zoom: k, repaint: () => {} };
  for (const o of list.sort((x, y) => x.z - y.z)) {
    if (o.type === "formula") {
      try {
        const f = await formulaImage(o);
        await drawBoxed(ctx, o, async () => ctx.drawImage(f.img, o.x, o.y, o.w || f.w, o.h || f.h));
      } catch (e) {
        console.warn("[mathboard] формула не експортована", e);
        ctx.save();
        ctx.font = `${o.fs}px serif`;
        ctx.fillStyle = o.c || "#000";
        ctx.textBaseline = "top";
        ctx.fillText(o.latex, o.x, o.y);
        ctx.restore();
      }
    } else if (o.type === "image") {
      try {
        const img = await loadImage(o.src);
        await drawBoxed(ctx, o, async () => {
          if (!o.crop) { ctx.drawImage(img, o.x, o.y, o.w, o.h); return; }
          const [cx, cy, cw, ch] = o.crop;
          const nw = img.naturalWidth;
          const nh = img.naturalHeight;
          ctx.drawImage(img, cx * nw, cy * nh, cw * nw, ch * nh, o.x, o.y, o.w, o.h);
        });
      } catch { /* skip a broken image */ }
    } else {
      def(o).draw(ctx, o, env);
    }
  }
  return c;
}

const pageObjs = (board: MathBoard, id: string): BoardObject[] =>
  (board.store.all() as BoardObject[]).filter((o) => o.type !== "page" && (o.pg || "p1") === id);

export async function exportPNG(board: MathBoard): Promise<void> {
  const c = await renderObjects(pageObjs(board, board.page), { grid: board.prefs.grid !== "none" });
  if (!c) { board.opts.onNotice?.("Аркуш порожній"); return; }
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (blob) download(blob, `doshka-${stamp()}.png`);
}

interface PdfPage {
  w: number;
  h: number;
  bytes: Uint8Array<ArrayBuffer>;
}

export async function exportPDF(board: MathBoard): Promise<void> {
  const pages: PdfPage[] = [];
  for (const p of board.pages() as { id: string }[]) {
    const c = await renderObjects(pageObjs(board, p.id), { grid: board.prefs.grid !== "none" });
    if (!c) continue;
    const url = c.toDataURL("image/jpeg", 0.92);
    const bin = atob(url.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    pages.push({ w: c.width, h: c.height, bytes });
  }
  if (!pages.length) { board.opts.onNotice?.("Дошка порожня"); return; }
  download(pdfBlob(pages), `doshka-${stamp()}.pdf`);
}

/** Minimal PDF: every page is a single JPEG image. */
function pdfBlob(pages: PdfPage[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const push = (d: string | Uint8Array<ArrayBuffer>) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    chunks.push(b);
    offset += b.length;
  };
  const obj = (id: number, body: string) => { offsets[id] = offset; push(`${id} 0 obj\n${body}\nendobj\n`); };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
  pages.forEach((p, i) => {
    const pid = 3 + i * 3;
    const W = (p.w * 0.75).toFixed(2);
    const H = (p.h * 0.75).toFixed(2);
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${pid + 1} 0 R /Resources << /XObject << /Im0 ${pid + 2} 0 R >> >> >>`);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pid + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[pid + 2] = offset;
    push(`${pid + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
    push(p.bytes);
    push("\nendstream\nendobj\n");
  });
  const total = 3 + pages.length * 3;
  const xref = offset;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}
