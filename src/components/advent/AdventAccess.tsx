"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { canTutor, isEditor } from "@/lib/roles";
import { withNext } from "@/lib/utils";
import { claimAdventCode, hasAdventCode, teacherCodeStatus, type ClaimResult } from "@/lib/advent-codes";
import { ORDER_CONTACT, PRICE_STUDENT } from "@/lib/advent-shop";
import { ZSU_SHARE } from "@/lib/advent";
import { AdventPreview } from "./AdventPreview";

/** «20% доходу — на ЗСУ» with the flag; styled by advent.css. */
export function ZsuNote({ className = "" }: { className?: string }) {
  return (
    <p className={`adv-zsu ${className}`}>
      <span className="adv-flag" aria-hidden><i /><i /></span>
      {ZSU_SHARE}% доходу від календаря — на ЗСУ
    </p>
  );
}

/**
 * Who may open the advent calendar:
 * - admin: editors, always (they create the codes);
 * - teacher: a tutor whose bought code a student has used — calendar + their codes;
 * - teacher-waiting: a tutor who bought codes, none used yet — their codes, calendar still closed;
 * - granted: a student who bought access or claimed a teacher's code;
 * - teacher-none / none: signed in without access — they see how to buy.
 */
export type AdventAccess =
  | "loading" | "signed-out" | "admin" | "teacher" | "teacher-waiting" | "teacher-none" | "granted" | "none";

export const accessKey = (uid?: string) => ["adventAccess", uid] as const;

export function useAdventAccess(): AdventAccess {
  const { user, userProfile, loading } = useAuth();
  const role = userProfile?.role;
  const editor = isEditor(role);
  const tutor = canTutor(role) && !editor;
  const { data, isError } = useQuery({
    queryKey: accessKey(user?.uid),
    queryFn: async () => {
      if (!tutor) return (await hasAdventCode(user!.uid)) ? "granted" : "none";
      const s = await teacherCodeStatus(user!.uid);
      return s.used ? "teacher" : s.owns ? "teacher-waiting" : "teacher-none";
    },
    enabled: !!user && !!userProfile && !editor,
    staleTime: 60 * 1000,
    retry: 1,
  });
  if (loading || (user && !userProfile)) return "loading";
  if (!user) return "signed-out";
  if (editor) return "admin";
  // A failed check (offline, rules not published) means no access, not an endless skeleton.
  if (data === undefined && !isError) return "loading";
  if (data) return data;
  return tutor ? "teacher-none" : "none";
}

/* ---------- getting a code ---------- */

/** The Telegram channel button when a contact is set, otherwise a plain hint. */
function ContactButton({ text }: { text: string }) {
  if (!ORDER_CONTACT.href) return <p className="adv-access-note">{text}</p>;
  return (
    <div className="cta">
      <a className="btn" href={ORDER_CONTACT.href} target="_blank" rel="noopener noreferrer">{ORDER_CONTACT.label}</a>
    </div>
  );
}

/**
 * How to get access without a code yet. Buying happens outside the site: the buyer writes
 * to formlq, pays, and an editor sends a personal code (lib/advent-shop.ts).
 */
export function AdventBuy({ kind }: { kind: "self" | "pack" }) {
  if (kind === "self") {
    return (
      <div className="adv-access card adv-buy">
        <h2 className="adv-h2">Календар — {PRICE_STUDENT} грн</h2>
        <p className="adv-access-lead">
          24 віконця з задачами в стилі НМТ і міні-іграми, Ігротека, конспект від Миколая і 5 імітацій НМТ у подарунок.
          Як купити й отримати особистий код — у нашому Telegram-каналі.
        </p>
        <ContactButton text="Щоб отримати код, напиши formlq або попроси свого викладача." />
        <ZsuNote />
      </div>
    );
  }
  return (
    <div className="adv-access card adv-buy">
      <h2 className="adv-h2">Коди для учнів</h2>
      <p className="adv-access-lead">
        Кожен код відкриває календар одному учневі: 99 грн за код, від 20 кодів — 79 грн. Календар відкриється
        і для вас, щойно перший учень введе свій код. Як замовити коди — у нашому Telegram-каналі; після оплати
        вони з’являться тут.
      </p>
      <ContactButton text="Щоб отримати коди, напишіть formlq." />
      <ZsuNote />
    </div>
  );
}

/* ---------- a teacher's code ---------- */

const ERRORS: Record<Exclude<ClaimResult, "ok">, string> = {
  invalid: "Код має 8 символів, наприклад AB3K-7QXZ.",
  "not-found": "Такого коду немає. Перевір, чи правильно введено літери й цифри.",
  used: "Цей код уже використав інший учень. Попроси у викладача новий.",
};

/** A signed-in student types the personal code their teacher gave them. */
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
      <h2 className="adv-h2">Маєш код від викладача?</h2>
      <p className="adv-access-lead">Код працює лише для одного акаунта: після введення він стане твоїм.</p>
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
    </div>
  );
}

/** A teacher who bought codes, before any student has used one. */
export function AdventTeacherWaiting() {
  return (
    <div className="adv-access card">
      <h2 className="adv-h2">Календар відкриється, щойно учень введе код</h2>
      <p className="adv-access-lead">
        Ваші коди — у блоці вище. Надішліть кожному учневі його код: коли перший учень активує свій,
        календар відкриється і для вас.
      </p>
    </div>
  );
}

/** What a signed-in visitor without access sees under the hero: how to get in, then what's inside. */
export function AdventLocked({ access }: { access: "none" | "teacher-none" }) {
  return (
    <>
      {access === "teacher-none" ? (
        <AdventBuy kind="pack" />
      ) : (
        <div className="adv-locked-grid">
          <AdventBuy kind="self" />
          <AdventCodeEntry />
        </div>
      )}
      <AdventPreview />
    </>
  );
}

/** A guest on the public page: how to get access. */
export function AdventGuestSteps() {
  return (
    <div className="adv-access card">
      <h2 className="adv-h2">Як отримати доступ</h2>
      <ol className="adv-steps">
        <li><b>Увійди або зареєструйся</b> на formlq — це безкоштовно.</li>
        <li><b>Отримай код:</b> як купити (календар — {PRICE_STUDENT} грн) — у нашому Telegram-каналі, або попроси свого викладача.</li>
        <li><b>Розв&apos;язуй щодня</b> з 1 до 24 грудня — і забирай подарунки.</li>
      </ol>
      <p className="adv-access-note">Викладачі можуть купити коди для всього класу дешевше.</p>
      <ZsuNote />
      <div className="cta">
        <Link className="btn" href={withNext("/login", "/dashboard/advent")}>Увійти</Link>
        <Link className="btn ghost" href={withNext("/register", "/dashboard/advent")}>Зареєструватися</Link>
        {ORDER_CONTACT.href && (
          <a className="btn ghost" href={ORDER_CONTACT.href} target="_blank" rel="noopener noreferrer">Telegram-канал</a>
        )}
      </div>
    </div>
  );
}
