"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/** Light/dark switch (the app has a single MathBoard theme). */
export function ThemeSelector({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme();
  const dark = mode === "dark";

  return (
    <IconButton
      label={dark ? "Світла тема" : "Темна тема"}
      size="md"
      aria-pressed={dark}
      onClick={toggleMode}
      className={cn("bg-card text-foreground hover:bg-sidebar-accent hover:text-foreground", className)}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
