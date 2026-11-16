"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { CalendarClock, Pencil } from "lucide-react";
import { formatDate, pluralize, PLURAL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DateTimePicker, toLocalValue } from "@/components/ui/date-time-picker";

/** Timestamp → the picker's value, in local time. */
const toLocalInput = (ts: Timestamp | null) => (ts ? toLocalValue(ts.toDate()) : "");

interface DueEditorProps {
  dueAt: Timestamp | null;
  /** Set for group homework: offers to change the deadline for the whole group. */
  groupName?: string;
  /** Saves; returns how many homework were updated. */
  onSave: (dueAt: Timestamp | null, wholeGroup: boolean) => Promise<number>;
}

/** The homework deadline with «Змінити»: set, move or remove it (for one student or the group). */
export function DueEditor({ dueAt, groupName, onSave }: DueEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [wholeGroup, setWholeGroup] = useState(true);
  const [saving, setSaving] = useState(false);

  function open() {
    setValue(toLocalInput(dueAt));
    setWholeGroup(true);
    setEditing(true);
  }

  async function save(next: Timestamp | null) {
    setSaving(true);
    try {
      const n = await onSave(next, !!groupName && wholeGroup);
      toast.success(
        (next ? "Дедлайн змінено" : "Дедлайн прибрано") + (n > 1 ? ` · ${pluralize(n, PLURAL.student)}` : ""),
      );
      setEditing(false);
    } catch {
      toast.error("Не вдалося змінити дедлайн");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <CalendarClock size={12} />
        {dueAt ? <>Дедлайн: {formatDate(dueAt)}</> : "Без дедлайну"}
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground underline-offset-2 hover:underline"
        >
          <Pencil size={11} /> {dueAt ? "Змінити" : "Додати"}
        </button>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 p-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground shrink-0">Новий дедлайн</span>
        <DateTimePicker size="sm" value={value} onChange={setValue} clearable={false} className="sm:w-80" />
      </div>
      {groupName && (
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={wholeGroup} onChange={(e) => setWholeGroup(e.target.checked)} className="accent-current" />
          Для всієї групи «{groupName}»
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saving || !value} onClick={() => save(Timestamp.fromDate(new Date(value)))}>
          {saving ? "Зберігаю…" : "Зберегти"}
        </Button>
        {dueAt && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => save(null)}>
            Прибрати дедлайн
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}
