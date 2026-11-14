/** Light/dark mode shared by the theme context and the pre-paint script in the root layout. */
export type ThemeMode = "light" | "dark";

/** localStorage key holding the chosen mode. */
export const THEME_MODE_KEY = "theme-mode";

/** Keys of the removed colour/font pickers; cleared so stale values never resurface. */
export const LEGACY_THEME_KEYS = ["color-theme", "font-theme"] as const;

/**
 * Inline script run before first paint: applies the saved mode as the `dark` class on <html>.
 * Anything other than "dark" (missing, legacy or garbage values) falls back to light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  THEME_MODE_KEY,
)});document.documentElement.classList.toggle("dark",m==="dark");}catch(e){}})();`;
