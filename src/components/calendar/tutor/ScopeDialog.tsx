"use client";

import { useCallback, useState } from "react";
import { Repeat } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SeriesScope } from "./types";

interface ScopeRequest {
  title: string;
  description?: string;
  destructive?: boolean;
  resolve: (scope: SeriesScope | null) => void;
}

/**
 * Promise-based "this occurrence / this and following" prompt for weekly series.
 * `ask` resolves with the chosen scope, or `null` when cancelled.
 */
export function useScopePrompt() {
  const [req, setReq] = useState<ScopeRequest | null>(null);

  const ask = useCallback(
    (title: string, opts: { description?: string; destructive?: boolean } = {}) =>
      new Promise<SeriesScope | null>((resolve) => setReq({ title, ...opts, resolve })),
    [],
  );

  const finish = (scope: SeriesScope | null) => {
    req?.resolve(scope);
    setReq(null);
  };

  const dialog = (
    <Dialog open={!!req} onClose={() => finish(null)} size="sm">
      {req && (
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Repeat size={16} />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="font-heading font-bold text-sm leading-tight">{req.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {req.description ?? "Цей урок входить у щотижневу серію."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant={req.destructive ? "destructive" : "default"}
              onClick={() => finish("one")}
            >
              Лише цей урок
            </Button>
            <Button
              variant={req.destructive ? "destructive" : "outline"}
              onClick={() => finish("following")}
            >
              Цей і наступні
            </Button>
            <Button variant="ghost" onClick={() => finish(null)}>
              Скасувати
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );

  return { ask, dialog };
}
