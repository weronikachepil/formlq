"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import type { TestFolder } from "@/lib/tests";
import { useTestLibrary } from "@/hooks/useTestLibrary";
import { createAssignment } from "@/lib/assignments";
import { pluralize, PLURAL } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { TextInput } from "@/components/ui/text-field";
import { DateTimePicker, toLocalValue } from "@/components/ui/date-time-picker";
import { TestPicker } from "@/components/TestPicker";

const parse = (v: string) => (v ? new Date(v) : null);

/** Next round 5 minutes from now. */
function soon(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 5) * 5);
  return d;
}

/** «Нове тестування»: a test, its time window and the time per attempt. Mounted only while open. */
export function NewAssignmentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { user, userProfile } = useAuth();
  const [testId, setTestId] = useState("");
  const [title, setTitle] = useState("");
  const [opens, setOpens] = useState(() => toLocalValue(soon()));
  const [closes, setCloses] = useState(() => toLocalValue(new Date(soon().getTime() + 45 * 60_000)));
  const [minutes, setMinutes] = useState("45");
  const [saving, setSaving] = useState(false);

  const lib = useTestLibrary();
  // One picker for both: own tests in their folders, then the catalog as «Каталог · author» folders.
  const [tests, folders] = useMemo(() => {
    const catFolders: TestFolder[] = lib.catalogGroups.map((g, i) => ({
      id: `catalog:${g.key}`,
      name: `Каталог · ${g.name}`,
      order: 10_000 + i,
      createdAt: null,
    }));
    const catTests = lib.catalogGroups.flatMap((g) => g.tests.map((t) => ({ ...t, folderId: `catalog:${g.key}` })));
    const ownFolders = lib.mineGroups.filter((g) => g.key !== "none").map((g, i) => ({ id: g.key, name: g.name, order: i, createdAt: null }));
    return [
      [...lib.mine, ...catTests],
      [...ownFolders, ...catFolders],
    ] as const;
  }, [lib.mine, lib.mineGroups, lib.catalogGroups]);

  const test = tests.find((t) => t.id === testId);
  const o = parse(opens);
  const c = parse(closes);
  const windowMin = o && c ? Math.round((c.getTime() - o.getTime()) / 60_000) : 0;
  const dur = Number(minutes);
  const error = !o || !c ? "Вкажіть час відкриття й закриття" : windowMin <= 0 ? "Тест має закриватися пізніше, ніж відкривається" : null;
  const ready = !!test && !error && dur >= 1 && !saving;

  function pickTest(id: string) {
    setTestId(id);
    const t = tests.find((x) => x.id === id);
    if (!t) return;
    if (!title.trim()) setTitle(t.title);
    if (t.durationMinutes) setMinutes(String(t.durationMinutes));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !user || !test || !o || !c) return;
    setSaving(true);
    try {
      const id = await createAssignment({
        ownerId: user.uid,
        ownerName: userProfile?.displayName || user.displayName || "",
        test,
        title,
        durationMinutes: Math.min(dur, windowMin),
        opensAt: o,
        closesAt: c,
      });
      toast.success("Тестування створено");
      onCreated(id);
    } catch {
      toast.error("Не вдалося створити тестування");
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} size="md" className="p-6" closeOnBackdrop={false}>
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl">Нове тестування</h2>
          <p className="text-sm text-muted-foreground">
            Учні відкривають тест за посиланням, вводять імʼя та прізвище й проходять його лише в заданий час.
          </p>
        </div>

        <div className="space-y-2">
          <SectionLabel>Тест</SectionLabel>
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Немає тестів із питаннями.{" "}
              <Link href="/tutor/tests" className="underline underline-offset-2">
                Створити тест
              </Link>
            </p>
          ) : (
            <TestPicker tests={[...tests]} folders={[...folders]} value={testId} onChange={pickTest} />
          )}
          {test && (
            <p className="text-xs text-muted-foreground">
              {pluralize(test.questions.length, PLURAL.question)}
              {test.personal && test.createdBy !== user?.uid ? ` · автор: ${test.authorName || "викладач"}` : ""}. Учні
              отримають копію тесту: зміни в ньому після створення тестування не вплинуть.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <SectionLabel as="label" htmlFor="as-title">
            Назва для учнів
          </SectionLabel>
          <TextInput id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Напр. Контрольна 9-Б" maxLength={80} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <SectionLabel>Відкривається</SectionLabel>
            <DateTimePicker value={opens} onChange={setOpens} clearable={false} />
          </div>
          <div className="space-y-2">
            <SectionLabel>Закривається</SectionLabel>
            <DateTimePicker value={closes} onChange={setCloses} clearable={false} />
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel as="label" htmlFor="as-min">
            Час на проходження, хв
          </SectionLabel>
          <TextInput
            id="as-min"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="sm:w-40"
          />
          <p className="text-xs text-muted-foreground">
            Відлік іде від моменту, коли учень почав, але не довше, ніж до закриття. Коли час вийде, відповіді
            надішлються автоматично.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={!ready}>
            {saving ? "Створюю…" : "Створити"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
