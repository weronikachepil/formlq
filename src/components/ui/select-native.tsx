"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SelectNative({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "w-full appearance-none pl-4 pr-9 py-2 rounded-full border border-glass-edge bg-glass shadow-pill",
          "text-sm text-foreground hover:bg-glass-strong focus:outline-none focus:border-foreground/50 transition-colors cursor-pointer",
          // Native option lists ignore translucency; keep them readable in both modes.
          "[&>option]:bg-popover [&>option]:text-popover-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  );
}
