"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { ROLE_META, canTutor, isEditor } from "@/lib/roles";
import { propagateDisplayName } from "@/lib/rename";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-field";
import { SectionLabel } from "@/components/ui/section-label";
import { SpinnerPage } from "@/components/ui/spinner";

/** "Олена Коваленко-Сидоренко" → first word / the rest. */
function splitName(full: string): [string, string] {
  const [first = "", ...rest] = full.trim().split(/\s+/);
  return [first, rest.join(" ")];
}

export default function ProfilePage() {
  const { user, userProfile } = useAuth();
  usePageHeader("Профіль");
  if (!user || !userProfile) return <SpinnerPage />;
  // Keyed so the form starts from the saved name once the profile is loaded.
  return <ProfileForm key={userProfile.displayName} />;
}

function ProfileForm() {
  const { user, userProfile, updateDisplayName } = useAuth();
  const queryClient = useQueryClient();
  const [initialFirst, initialLast] = splitName(userProfile?.displayName ?? "");
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [saving, setSaving] = useState(false);

  const role = userProfile?.role ?? "student";
  const teacher = canTutor(role) && !isEditor(role);
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const dirty = name !== (userProfile?.displayName ?? "").trim();
  const valid = !!firstName.trim() && !!lastName.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !dirty || saving || !user) return;
    setSaving(true);
    try {
      await updateDisplayName(name);
      // Lessons, homework, student lists, boards and tests keep a copy of the name.
      const failed = await propagateDisplayName(user.uid, name, { teacher });
      queryClient.invalidateQueries();
      if (failed) toast("Імʼя збережено, але в деяких старих записах воно оновиться не одразу");
      else toast.success("Збережено");
    } catch {
      toast.error("Не вдалося зберегти. Спробуйте ще раз");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={save} className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <SectionLabel as="label" htmlFor="first-name">
              Імʼя
            </SectionLabel>
            <TextInput
              id="first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              maxLength={40}
            />
          </div>
          <div className="space-y-1">
            <SectionLabel as="label" htmlFor="last-name">
              Прізвище
            </SectionLabel>
            <TextInput
              id="last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              maxLength={60}
            />
          </div>
        </div>

        {teacher && (
          <p className="text-xs text-muted-foreground">
            Це імʼя показується як автор ваших опублікованих тестів.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <SectionLabel>Email</SectionLabel>
            <p className="px-1 truncate">{userProfile?.email}</p>
          </div>
          <div className="space-y-1">
            <SectionLabel>Роль</SectionLabel>
            <p className="px-1">{ROLE_META[role].label}</p>
          </div>
        </div>

        <Button type="submit" disabled={!valid || !dirty || saving} className="w-full">
          {saving ? "Збереження…" : "Зберегти"}
        </Button>
      </form>
    </div>
  );
}
