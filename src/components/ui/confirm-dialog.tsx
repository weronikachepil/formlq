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
    <Dialog open={open} onClose={onCancel} size="sm" className="max-w-[420px]" showClose>
      <div className="px-7 pb-7 pt-9 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 size={24} />
        </span>
        <p className="mt-5 font-heading text-xl font-bold leading-tight">{title}</p>
        {description && <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <Button ref={cancelRef} size="lg" variant="ghost" className="bg-muted hover:bg-muted/70" onClick={onCancel}>
            Скасувати
          </Button>
          <Button size="lg" onClick={onConfirm} className="bg-destructive text-white shadow-none hover:bg-destructive/90">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
