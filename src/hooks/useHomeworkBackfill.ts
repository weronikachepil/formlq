"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { canTutor, isEditor } from "@/lib/roles";
import { backfillHomeworkQuestions } from "@/lib/tutor";

const KEY = "formlq-hw-questions-v1";

/**
 * Once per browser and account: copies test questions into old homework that only
 * referenced the test (see backfillHomeworkQuestions). Teachers fix their own homework,
 * editors everyone's. Safe to repeat: already copied homework is skipped.
 */
export function useHomeworkBackfill() {
  const { user, userProfile } = useAuth();
  const role = userProfile?.role;

  useEffect(() => {
    if (!user || !canTutor(role)) return;
    const key = `${KEY}:${user.uid}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // storage unavailable: run anyway, it is idempotent
    }
    backfillHomeworkQuestions(isEditor(role) ? null : user.uid)
      .then((n) => {
        if (n) console.info(`[homework] copied test questions into ${n} homework`);
        try {
          localStorage.setItem(key, "1");
        } catch {
          // ignore
        }
      })
      .catch((err) => console.warn("[homework] backfill failed:", err?.code ?? err));
  }, [user, role]);
}
