"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { canTutor } from "@/lib/roles";
import { findTutorByCode, joinTutor, normalizeInviteCode } from "@/lib/invites";
import { withNext } from "@/lib/utils";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { SpinnerScreen } from "@/components/ui/spinner";
import type { UserProfile } from "@/types";

/**
 * Invite link from a teacher. Signed out → sign up first (and come back here);
 * signed in as a student → confirm the teacher's name and join.
 */
export default function JoinTutorPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeInviteCode(rawCode);
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tutor, setTutor] = useState<UserProfile | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(withNext("/register", `/join/${code}`));
  }, [loading, user, router, code]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    findTutorByCode(code)
      .catch(() => null)
      .then((t) => !cancelled && setTutor(t));
    return () => {
      cancelled = true;
    };
  }, [user, code]);

  if (loading || !user || !userProfile || tutor === undefined) return <SpinnerScreen />;

  const toDashboard = { footerText: "Не зараз?", footerLinkHref: "/dashboard", footerLinkLabel: "На головну" };

  if (!tutor) {
    return (
      <AuthCard title="Запрошення не знайдено" {...toDashboard}>
        <p className="text-sm text-muted-foreground">
          Код <span className="font-mono font-semibold text-foreground">{code}</span> не дійсний. Попросіть
          викладача надіслати нове посилання.
        </p>
      </AuthCard>
    );
  }

  if (canTutor(userProfile.role)) {
    return (
      <AuthCard title="Це запрошення для учнів" {...toDashboard}>
        <p className="text-sm text-muted-foreground">
          Ви увійшли як викладач. Щоб приєднатися до {tutor.displayName}, увійдіть з акаунта учня.
        </p>
      </AuthCard>
    );
  }

  async function join() {
    setJoining(true);
    try {
      const added = await joinTutor(userProfile!, tutor!.uid);
      queryClient.invalidateQueries();
      toast.success(added ? `Тепер ваш викладач — ${tutor!.displayName}` : "Ви вже учень цього викладача");
      router.replace("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не вдалося приєднатися");
      setJoining(false);
    }
  }

  return (
    <AuthCard title="Запрошення від викладача" {...toDashboard}>
      <div className="rounded-2xl border border-glass-edge bg-glass px-4 py-3">
        <p className="text-xs text-muted-foreground">Викладач</p>
        <p className="font-heading font-bold text-lg">{tutor.displayName}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Викладач бачитиме ваші домашні завдання й результати, зможе призначати завдання та заняття.
      </p>
      <Button size="lg" onClick={join} disabled={joining}>
        {joining ? "Приєднання…" : "Приєднатися"}
      </Button>
    </AuthCard>
  );
}
