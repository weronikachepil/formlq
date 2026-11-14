// Canvas font families.
// next/font hashes family names and exposes them as CSS variables (the board's on its `.mathboard`
// root, the app's on <html>), but canvas `ctx.font` needs the real family list, so the variables are
// resolved lazily at runtime and cached.
// Without a DOM (SSR) or before a font is registered, the literal family name is used.

const resolved = new Map<string, string>();
const misses = new Map<string, number>();
/** Re-check an unresolved variable at most this often (fonts may be loaded later). */
const RETRY_MS = 1000;

/** Value of a CSS custom property on the board root or <html> (a font-family list), or `fallback` when unset. */
export function cssFontVar(name: string, fallback: string): string {
  const hit = resolved.get(name);
  if (hit) return hit;
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return fallback;
  const now = Date.now();
  const missedAt = misses.get(name);
  if (missedAt !== undefined && now - missedAt < RETRY_MS) return fallback;
  const host = document.querySelector(".mathboard") ?? document.documentElement;
  const v = getComputedStyle(host).getPropertyValue(name).trim();
  if (!v) {
    misses.set(name, now);
    return fallback;
  }
  resolved.set(name, v);
  misses.delete(name);
  return v;
}

/** The app's sans font (used for fonts the app does not load). */
export const sansFamily = (): string => cssFontVar("--font-sans", "system-ui");

/** Manrope: the board's UI font, also the default for text (loaded by src/components/board/fonts.ts). */
export const manropeFamily = (): string => cssFontVar("--mb-font-manrope", "Manrope");

/** Marck Script: handwriting font for text objects (loaded by the board UI). */
export const marckScriptFamily = (): string => cssFontVar("--font-marck-script", '"Marck Script"');

/** Full font-family list for canvas UI text. */
export const uiFont = (): string => `${manropeFamily()}, system-ui, sans-serif`;
