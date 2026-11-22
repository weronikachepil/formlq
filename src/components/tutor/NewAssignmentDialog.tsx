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
import { TextInput } from "@/components/ui/text-field";
import { DateTimePicker, toLocalValue } from "@/components/ui/date-time-picker";
import { TestPicker } from "@/components/TestPicker";
import { cn } from "@/lib/utils";

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

  // Common lengths: one tap; anything else in the «інша» field.
  const presets = [30, 45, 60, 90];
  const custom = !presets.includes(dur);
  // The attempt can't outlast the window (see `save`): say so before it surprises anyone.
  const capped = !error && dur > windowMin && windowMin > 0;

  return (
    <Dialog open onClose={onClose} size="md" className="rounded-[18px] p-6" closeOnBackdrop={false}>
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl">Нове тестування</h2>
          <p className="text-sm text-muted-foreground">
            Учні відкривають тест за посиланням, вводять імʼя та прізвище й проходять його лише в заданий час.
          </p>
        </div>

        <Field label="Тест">
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              Немає тестів із питаннями.{" "}
              <Link href="/tutor/tests" className="underline underline-offset-2">
                Створити тест
              </Link>
            </p>
          ) : (
            <TestPicker tests={[...tests]} folders={[...folders]} value={testId} onChange={pickTest} />
          )}
          {test && (
            <p className="text-xs text-muted-foreground px-1">
              {pluralize(test.questions.length, PLURAL.question)}
              {test.personal && test.createdBy !== user?.uid ? ` · автор: ${test.authorName || "викладач"}` : ""}. Учні
              отримають копію тесту: зміни в ньому після створення тестування не вплинуть.
            </p>
          )}
        </Field>

        <Field label="Назва для учнів" htmlFor="as-title">
          <TextInput id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Напр. Контрольна 9-Б" maxLength={80} />
        </Field>

        {/* When it can be taken: the window and its length in one place. */}
        <div className="space-y-1.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Відкривається">
              <DateTimePicker value={opens} onChange={setOpens} clearable={false} />
            </Field>
            <Field label="Закривається">
              <DateTimePicker value={closes} onChange={setCloses} clearable={false} />
            </Field>
          </div>
          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground px-1 tabular-nums">
              Доступно {windowMin >= 60 ? `${Math.floor(windowMin / 60)} год ${windowMin % 60 ? `${windowMin % 60} хв` : ""}`.trim() : `${windowMin} хв`}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-muted-foreground px-1">Час на проходження</span>
          <div role="radiogroup" aria-label="Час на проходження" className="grid grid-cols-5 gap-1.5">
            {presets.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={dur === m}
                onClick={() => setMinutes(String(m))}
                className={cn(
                  "h-10 rounded-[12px] text-sm font-semibold tabular-nums transition-colors",
                  dur === m
                    ? "bg-primary text-primary-foreground shadow-pill-dark"
                    : "border border-glass-edge bg-glass shadow-pill hover:bg-glass-strong",
                )}
              >
                {m} хв
              </button>
            ))}
            <label>
              <span className="sr-only">Інший час, хв</span>
              <TextInput
                type="number"
                min={1}
                placeholder="інша"
                value={custom ? minutes : ""}
                onChange={(e) => setMinutes(e.target.value)}
                className={cn("tabular-nums text-center", custom && minutes && "ring-2 ring-ring/40")}
              />
            </label>
          </div>
          <p className={cn("text-xs px-1", capped ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
            {capped
              ? `Вікно коротше (${windowMin} хв) — на проходження буде ${windowMin} хв.`
              : "Відлік іде від моменту, коли учень почав, але не довше, ніж до закриття. Коли час вийде, відповіді надішлються автоматично."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {/* Say why «Створити» is disabled instead of leaving a grey button. */}
          {!test && tests.length > 0 && <p className="mr-auto text-xs text-muted-foreground">Оберіть тест</p>}
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

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-muted-foreground px-1">
        {label}
      </label>
      {children}
    </div>
  );
}
