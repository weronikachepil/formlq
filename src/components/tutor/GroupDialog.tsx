"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, Trash2 } from "lucide-react";
import { createGroup, deleteGroup, updateGroup, type StudentGroup } from "@/lib/groups";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { SectionLabel } from "@/components/ui/section-label";
import { TextInput } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

export interface GroupStudent {
  studentId: string;
  name: string;
}

interface GroupDialogProps {
  tutorId: string;
  students: GroupStudent[];
  /** Group to edit; `null` creates a new one. */
  group: StudentGroup | null;
  onClose: () => void;
}

/** Create or edit a group: its name and which students are in it. Mounted only while open. */
export function GroupDialog({ tutorId, students, group, onClose }: GroupDialogProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(group?.studentIds ?? []));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const q = search.trim().toLowerCase();
  const visible = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Keep members who are no longer the tutor's students out of the list.
      const known = new Set(students.map((s) => s.studentId));
      const studentIds = [...picked].filter((id) => known.has(id));
      if (group) await updateGroup(group.id, { name, studentIds });
      else await createGroup(tutorId, { name, studentIds });
      toast.success(group ? "Групу збережено" : `Групу «${name.trim()}» створено`);
      onClose();
    } catch {
      toast.error("Не вдалося зберегти групу");
      setSaving(false);
    }
  }

  async function remove() {
    if (!group) return;
    setConfirmDelete(false);
    try {
      await deleteGroup(group.id);
      toast.success("Групу видалено");
      onClose();
    } catch {
      toast.error("Не вдалося видалити групу");
    }
  }

  return (
    <>
      <Dialog open onClose={onClose} size="md" className="p-6" closeOnBackdrop={false}>
        <form onSubmit={save} className="space-y-5">
          <h2 className="font-heading font-bold text-xl">{group ? "Група" : "Нова група"}</h2>

          <div className="space-y-2">
            <SectionLabel as="label" htmlFor="group-name">
              Назва
            </SectionLabel>
            <TextInput
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр. 11-А або НМТ вечірня"
              maxLength={60}
              autoFocus={!group}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Учні ({picked.size})</SectionLabel>
              {students.length > 8 && (
                <SearchInput value={search} onChange={setSearch} placeholder="Пошук…" size="sm" wrapperClassName="w-44" />
              )}
            </div>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">Спершу запросіть учнів, а потім додайте їх у групу.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-border/50 p-1">
                {visible.map((s) => {
                  const on = picked.has(s.studentId);
                  return (
                    <button
                      key={s.studentId}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(s.studentId)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-left hover:bg-glass-strong transition-colors"
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          on ? "bg-primary border-transparent text-primary-foreground" : "border-foreground/25 bg-glass",
                        )}
                      >
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
                {visible.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Нікого не знайдено</p>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {group && (
              <Button type="button" variant="ghost" className="gap-1.5 text-red-600 dark:text-red-400" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Видалити
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Зберігаю…" : group ? "Зберегти" : "Створити"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Видалити групу «${group?.name ?? ""}»?`}
        description="Учні залишаться вашими учнями, а видані їм завдання й уроки — без змін."
        confirmLabel="Видалити"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
