"use client";

import { useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Видалити",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Dialog open={open} onClose={onCancel} size="sm">
      <div className="p-7 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-destructive" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="font-heading font-bold text-sm leading-tight">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            ref={cancelRef}
            size="sm"
            variant="ghost"
            onClick={onCancel}
          >
            Скасувати
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-white shadow-none gap-1.5"
          >
            <Trash2 size={13} />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
