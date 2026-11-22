"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { getStudentTutorLinks } from "@/lib/tutor";
import { findTutorByCode, joinTutor, normalizeInviteCode } from "@/lib/invites";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types";

/**
 * Shown to a student with no teacher yet: join one by the code they were given.
 * `compact` — a side card for students who study on their own.
 */
export function JoinTutorCard({ compact = false }: { compact?: boolean }) {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: links } = useQuery({
    queryKey: queryKeys.studentTutors(user?.uid),
    queryFn: () => getStudentTutorLinks(user!.uid),
    enabled: !!user,
    staleTime: STALE.medium,
  });

  if (!user || !userProfile || !links || links.length > 0) return null;

  async function lookUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const tutor = await findTutorByCode(code);
      if (tutor) setFound(tutor);
      else toast.error("Викладача з таким кодом не знайдено");
    } catch {
      toast.error("Не вдалося перевірити код");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!found) return;
    setBusy(true);
    try {
      await joinTutor(userProfile!, found.uid);
      toast.success(`Тепер ваш викладач — ${found.displayName}`);
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не вдалося приєднатися");
      setBusy(false);
    }
  }

  return (
    <section className={cn("rounded-[18px] border border-border/50 bg-card space-y-3", compact ? "p-4" : "p-5")}>
      {compact ? (
        <div className="px-1">
          <h2 className="font-semibold text-sm">Маєте викладача?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Введіть його код — зʼявляться домашні завдання й календар занять.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UserPlus size={19} />
          </div>
          <div>
            <h2 className="font-semibold text-base">Приєднатися до викладача</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Введіть код від свого викладача — він зможе давати вам домашні завдання й планувати заняття.
            </p>
          </div>
        </div>
      )}

      {found ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-[12px] border border-glass-edge bg-glass px-4 py-3",
            !compact && "sm:flex-row sm:items-center",
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Викладач</p>
            <p className="font-semibold truncate">{found.displayName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setFound(null)} disabled={busy}>
              Інший код
            </Button>
            <Button onClick={join} disabled={busy}>
              {busy ? "Приєднання…" : "Приєднатися"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={lookUp} className={cn("flex gap-2", compact && "flex-col")}>
          <TextInput
            value={code}
            onChange={(e) => setCode(normalizeInviteCode(e.target.value).slice(0, 6))}
            placeholder={compact ? "Код викладача" : "Код, напр. K7Q3MA"}
            aria-label="Код викладача"
            className="font-mono tracking-[0.2em] uppercase"
          />
          <Button type="submit" disabled={busy || code.length !== 6} className="shrink-0">
            {busy ? "Перевірка…" : "Далі"}
          </Button>
        </form>
      )}
    </section>
  );
}
