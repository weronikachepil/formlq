"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { LEGACY_THEME_KEYS, THEME_MODE_KEY, type ThemeMode } from "@/lib/theme-mode";

export type { ThemeMode };

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  setMode: () => {},
  toggleMode: () => {},
});

function applyMode(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  // Sync from localStorage after mount (reading it during render would break SSR hydration).
  // The pre-paint script in the root layout has already set the `dark` class.
  useEffect(() => {
    let saved: ThemeMode = "light";
    try {
      saved = localStorage.getItem(THEME_MODE_KEY) === "dark" ? "dark" : "light";
      // The colour/font pickers are gone: drop their stored values and attributes.
      for (const key of LEGACY_THEME_KEYS) localStorage.removeItem(key);
    } catch {
      // Storage unavailable (private mode etc.): stay on light.
    }
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-font");
    applyMode(saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(saved);
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    applyMode(next);
    try {
      localStorage.setItem(THEME_MODE_KEY, next);
    } catch {
      // Not persisted; the mode still applies for this session.
    }
  }

  function toggleMode() {
    setMode(mode === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
