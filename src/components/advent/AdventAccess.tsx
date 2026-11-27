"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { canTutor } from "@/lib/roles";
import { withNext } from "@/lib/utils";
import { claimAdventCode, hasAdventCode, type ClaimResult } from "@/lib/advent-codes";

/**
 * Who may open the advent calendar: teachers and editors always; a student once they
 * have claimed a personal code from a teacher (lib/advent-codes.ts).
 */
export type AdventAccess = "loading" | "signed-out" | "staff" | "granted" | "none";

const accessKey = (uid?: string) => ["adventAccess", uid] as const;

export function useAdventAccess(): AdventAccess {
  const { user, userProfile, loading } = useAuth();
  const staff = canTutor(userProfile?.role);
  const { data, isLoading } = useQuery({
    queryKey: accessKey(user?.uid),
    queryFn: () => hasAdventCode(user!.uid),
    enabled: !!user && !!userProfile && !staff,
    staleTime: 5 * 60 * 1000,
  });
  if (loading || (user && !userProfile)) return "loading";
  if (!user) return "signed-out";
  if (staff) return "staff";
  if (isLoading || data === undefined) return "loading";
  return data ? "granted" : "none";
}

const ERRORS: Record<Exclude<ClaimResult, "ok">, string> = {
  invalid: "Код має 8 символів, наприклад AB3K-7QXZ.",
  "not-found": "Такого коду немає. Перевір, чи правильно введено літери й цифри.",
  used: "Цей код уже використав інший учень. Попроси у викладача новий.",
};

/** A signed-in student without access types their personal code. Styled by advent.css. */
export function AdventCodeEntry() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await claimAdventCode(value, user.uid, userProfile?.displayName || "Учень");
      if (r === "ok") await qc.invalidateQueries({ queryKey: accessKey(user.uid) });
      else setError(ERRORS[r]);
    } catch {
      setError("Не вдалося перевірити код. Спробуй ще раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adv-access card">
      <h2 className="adv-h2">Введи свій код</h2>
      <p className="adv-access-lead">
        Календар відкривається за особистим кодом від викладача. Код працює лише для одного акаунта: після введення він стане твоїм.
      </p>
      <form onSubmit={submit} className="adv-code-form" noValidate>
        <label htmlFor="adv-code" className="lbl">Особистий код</label>
        <div className="answer-row">
          <input
            id="adv-code"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder="AB3K-7QXZ"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? "adv-code-err" : undefined}
          />
          <button type="submit" className="btn" disabled={!value.trim() || busy}>
            {busy ? "Перевіряю…" : "Відкрити календар"}
          </button>
        </div>
        {error && <p id="adv-code-err" className="err" role="alert">{error}</p>}
      </form>
      <p className="adv-access-note">Немає коду? Попроси його у свого викладача з formlq.</p>
    </div>
  );
}

/** A guest on the public page: how to get access. */
export function AdventGuestSteps() {
  return (
    <div className="adv-access card">
      <h2 className="adv-h2">Як отримати доступ</h2>
      <ol className="adv-steps">
        <li><b>Попроси код у викладача.</b> Кожен учень отримує свій особистий код.</li>
        <li><b>Увійди або зареєструйся</b> на formlq — це безкоштовно.</li>
        <li><b>Введи код</b>, і календар відкриється у твоєму кабінеті.</li>
      </ol>
      <div className="cta">
        <Link className="btn" href={withNext("/login", "/dashboard/advent")}>Увійти</Link>
        <Link className="btn ghost" href={withNext("/register", "/dashboard/advent")}>Зареєструватися</Link>
      </div>
    </div>
  );
}
