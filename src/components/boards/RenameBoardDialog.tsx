"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RenameBoardDialogProps {
  open: boolean;
  initialTitle: string;
  onSave: (title: string) => Promise<void>;
  onClose: () => void;
}

export function RenameBoardDialog({ open, initialTitle, onSave, onClose }: RenameBoardDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="sm">
      {/* Keyed so the field resets to the current title every time it opens. */}
      {open && <RenameForm key={initialTitle} initialTitle={initialTitle} onSave={onSave} onClose={onClose} />}
    </Dialog>
  );
}

function RenameForm({ initialTitle, onSave, onClose }: Omit<RenameBoardDialogProps, "open">) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      <p className="font-semibold text-sm">Перейменувати дошку</p>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} autoFocus />
      <div className="flex gap-2 justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Скасувати
        </Button>
        <Button type="submit" size="sm" disabled={saving || !title.trim()}>
          Зберегти
        </Button>
      </div>
    </form>
  );
}
