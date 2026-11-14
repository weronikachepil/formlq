// Image preparation for the board: downscale and compress so the object stays small.
// pdfjs-dist is only a transitive dependency (via react-pdf), so take its types from there.
type PdfJs = (typeof import("react-pdf"))["pdfjs"];
type PDFDocumentProxy = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;

const MAX_CHARS = 2_400_000;

/** A prepared image: data URL plus its pixel size. */
export interface PreparedImage {
  src: string;
  w: number;
  h: number;
}

function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function canvasBlob(c: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), type));
}

// PDF -> page images (pdf.js is loaded only when a PDF is actually opened)
export const isPdf = (f: File | null | undefined): boolean => !!f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));

async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  // pdf.js comes from react-pdf's pdfjs-dist, so the worker version always matches the API.
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = typeof e === "object" && e !== null && "name" in e ? e.name : undefined;
    if (name === "PasswordException") throw new Error("PDF захищений паролем");
    throw new Error("Не вдалося відкрити PDF (файл пошкоджений?)");
  }
}

export async function pdfCount(file: Blob): Promise<number> {
  const doc = await openPdf(file);
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

/** "1-3, 5, 8-10" -> [1,2,3,5,8,9,10] within 1..total (unique, ascending); null if malformed. */
export function parsePageRange(text: string, total: number): number[] | null {
  const set = new Set<number>();
  for (const part of String(text).split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:[-–—](\d+))?$/);
    if (!m) return null;
    let a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    for (let n = Math.max(1, a); n <= Math.min(total, b); n++) set.add(n);
  }
  return [...set].sort((x, y) => x - y);
}

/** Renders the given pages (1-based) to images. */
export async function pdfToImages(file: Blob, pages: number[]): Promise<(PreparedImage & { pg: number })[]> {
  const doc = await openPdf(file);
  const out: (PreparedImage & { pg: number })[] = [];
  for (const n of pages) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, 1600 / Math.max(base.width, base.height)) });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    // pdf.js v5: `canvas` must be null to render through an existing context (keeps the white fill above)
    await page.render({ canvas: null, canvasContext: ctx, viewport }).promise;
    const blob = await canvasBlob(c, "image/png");
    out.push({ ...(await fileToImage(blob, 1600)), pg: n });
  }
  await doc.destroy();
  return out;
}

export async function fileToImage(file: Blob, maxSide = 1600): Promise<PreparedImage> {
  const bmp = await loadBitmap(file);
  const bw = bmp.width || ("naturalWidth" in bmp ? bmp.naturalWidth : 0);
  const bh = bmp.height || ("naturalHeight" in bmp ? bmp.naturalHeight : 0);
  let scale = Math.min(1, maxSide / Math.max(bw, bh));
  const isPng = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
  for (let attempt = 0; attempt < 5; attempt++) {
    const w = Math.max(1, Math.round(bw * scale));
    const h = Math.max(1, Math.round(bh * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    let src = isPng ? c.toDataURL("image/png") : "";
    if (!src || src.length > 700_000) {
      // photos and large screenshots: JPEG on a white background
      const j = document.createElement("canvas");
      j.width = w;
      j.height = h;
      const jc = j.getContext("2d")!;
      jc.fillStyle = "#fff";
      jc.fillRect(0, 0, w, h);
      jc.drawImage(bmp, 0, 0, w, h);
      src = j.toDataURL("image/jpeg", 0.85);
    }
    if (src.length <= MAX_CHARS) return { src, w, h };
    scale *= 0.7;
  }
  throw new Error("Зображення завелике");
}
