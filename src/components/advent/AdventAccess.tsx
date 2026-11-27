"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { canTutor, isEditor } from "@/lib/roles";
import { withNext } from "@/lib/utils";
import { claimAdventCode, hasAdventCode, ownsAdventCodes, type ClaimResult } from "@/lib/advent-codes";
import {
  JAR_URL,
  PRICE_STUDENT,
  TEACHER_MAX_CODES,
  getMyOrders,
  jarPayUrl,
  newOrderRef,
  orderAmount,
  placeOrder,
  teacherCodePrice,
  type OrderKind,
} from "@/lib/advent-shop";

/**
 * Who may open the advent calendar:
 * - admin: editors, always (they confirm orders and may create codes);
 * - teacher: a tutor who owns codes (bought a pack) — calendar + their codes;
 * - granted: a student who bought access or claimed a teacher's code;
 * - teacher-none / none: signed in without access — they see how to buy.
 */
export type AdventAccess = "loading" | "signed-out" | "admin" | "teacher" | "teacher-none" | "granted" | "none";

export const accessKey = (uid?: string) => ["adventAccess", uid] as const;
export const ordersKey = (uid?: string) => ["adventOrders", uid] as const;

export function useAdventAccess(): AdventAccess {
  const { user, userProfile, loading } = useAuth();
  const role = userProfile?.role;
  const editor = isEditor(role);
  const tutor = canTutor(role) && !editor;
  const { data, isError } = useQuery({
    queryKey: accessKey(user?.uid),
    queryFn: () => (tutor ? ownsAdventCodes(user!.uid) : hasAdventCode(user!.uid)),
    enabled: !!user && !!userProfile && !editor,
    staleTime: 60 * 1000,
    retry: 1,
  });
  if (loading || (user && !userProfile)) return "loading";
  if (!user) return "signed-out";
  if (editor) return "admin";
  // A failed check (offline, rules not published) means no access, not an endless skeleton.
  if (data === undefined && !isError) return "loading";
  if (tutor) return data ? "teacher" : "teacher-none";
  return data ? "granted" : "none";
}

/* ---------- buying ---------- */

/**
 * Buy access (student) or a pack of codes (teacher). Pays into the Monobank jar with the
 * order reference in the comment, then «Я оплатив(ла)» files the order for an editor to confirm.
 * Styled by advent.css; rendered inside `.landing`.
 */
export function AdventBuy({ kind, onDone }: { kind: OrderKind; onDone?: () => void }) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const [qty, setQty] = useState(10);
  const [ref] = useState(newOrderRef);
  const [step, setStep] = useState<"choose" | "pay">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ordersKey(user?.uid),
    queryFn: () => getMyOrders(user!.uid),
    enabled: !!user,
  });
  const pending = orders.find((o) => o.status === "pending" && o.kind === kind);
  const rejected = orders[0]?.status === "rejected" && orders[0].kind === kind ? orders[0] : null;

  const n = kind === "self" ? 1 : qty;
  const amount = orderAmount(kind, n);
  const payUrl = jarPayUrl(amount, ref);

  async function confirmPaid() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await placeOrder({
        uid: user.uid,
        name: userProfile?.displayName || "Без імені",
        email: user.email || userProfile?.email || "",
        kind,
        qty: n,
        ref,
      });
      await qc.invalidateQueries({ queryKey: ordersKey(user.uid) });
      onDone?.();
    } catch {
      setError("Не вдалося надіслати. Спробуй ще раз.");
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="adv-access card adv-buy">
        <h2 className="adv-h2">Перевіряємо оплату</h2>
        <p className="adv-access-lead">
          Замовлення <b>{pending.ref}</b> на {pending.amount} грн отримали. Щойно знайдемо платіж у банці,
          {kind === "self" ? " календар відкриється тут" : " тут з’являться ваші коди"} — зазвичай протягом кількох годин.
        </p>
        <button type="button" className="btn ghost" onClick={() => {
          qc.invalidateQueries({ queryKey: accessKey(user?.uid) });
          qc.invalidateQueries({ queryKey: ordersKey(user?.uid) });
        }}>
          Оновити
        </button>
      </div>
    );
  }

  return (
    <div className="adv-access card adv-buy">
      {kind === "self" ? (
        <>
          <h2 className="adv-h2">Купити календар — {PRICE_STUDENT} грн</h2>
          <p className="adv-access-lead">
            24 віконця з задачами в стилі НМТ і міні-іграми, Ігротека, конспект від Миколая і 5 імітацій НМТ у подарунок.
            Доступ — для твого акаунта.
          </p>
        </>
      ) : (
        <>
          <h2 className="adv-h2">Коди для учнів</h2>
          <p className="adv-access-lead">
            Кожен код відкриває календар одному учневі. Ви отримуєте повний доступ безкоштовно з будь-яким пакетом.
          </p>
          <div className="adv-qty">
            <label htmlFor="adv-qty" className="lbl">Скільки учнів</label>
            <div className="adv-qty-row">
              <input
                id="adv-qty"
                type="number"
                min={1}
                max={TEACHER_MAX_CODES}
                value={qty}
                disabled={step === "pay"}
                onChange={(e) => setQty(Math.max(1, Math.min(TEACHER_MAX_CODES, Number(e.target.value) || 1)))}
              />
              <span>× {teacherCodePrice(qty)} грн = <b>{amount} грн</b></span>
            </div>
            <p className="adv-access-note">99 грн за код, від 20 кодів — 79 грн (учень окремо платить {PRICE_STUDENT} грн).</p>
          </div>
        </>
      )}

      {rejected && step === "choose" && (
        <p className="err" role="alert">
          Оплату за замовленням {rejected.ref} не знайшли. Якщо ви платили, напишіть нам — розберемося.
        </p>
      )}

      {step === "choose" ? (
        <div className="cta">
          <button type="button" className="btn" onClick={() => setStep("pay")} disabled={!JAR_URL}>
            {JAR_URL ? `Купити за ${amount} грн` : "Оплата скоро"}
          </button>
        </div>
      ) : (
        <ol className="adv-steps adv-pay-steps">
          <li>
            Оплати <b>{amount} грн</b> у банку monobank і в коментарі напиши номер замовлення{" "}
            <b className="adv-ref">{ref}</b> — так ми знайдемо твій платіж.
            <div className="cta">
              <a className="btn" href={payUrl} target="_blank" rel="noopener noreferrer">Оплатити в monobank</a>
            </div>
          </li>
          <li>
            Після оплати натисни кнопку нижче. Ми перевіримо платіж і відкриємо доступ.
            <div className="cta">
              <button type="button" className="btn ghost" onClick={confirmPaid} disabled={busy}>
                {busy ? "Надсилаю…" : "Я оплатив(ла)"}
              </button>
              <button type="button" className="link" onClick={() => setStep("choose")}>Назад</button>
            </div>
            {error && <p className="err" role="alert">{error}</p>}
          </li>
        </ol>
      )}
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

/** What a signed-in visitor without access sees under the hero. */
export function AdventLocked({ access }: { access: "none" | "teacher-none" }) {
  if (access === "teacher-none") return <AdventBuy kind="pack" />;
  return (
    <div className="adv-locked-grid">
      <AdventBuy kind="self" />
      <AdventCodeEntry />
    </div>
  );
}

/** A guest on the public page: how to get access. */
export function AdventGuestSteps() {
  return (
    <div className="adv-access card">
      <h2 className="adv-h2">Як отримати доступ</h2>
      <ol className="adv-steps">
        <li><b>Увійди або зареєструйся</b> на formlq — це безкоштовно.</li>
        <li><b>Купи календар</b> за {PRICE_STUDENT} грн або <b>введи код</b>, який дав викладач.</li>
        <li><b>Розв&apos;язуй щодня</b> з 1 до 24 грудня — і забирай подарунки.</li>
      </ol>
      <p className="adv-access-note">Викладачі можуть купити коди для всього класу дешевше.</p>
      <div className="cta">
        <Link className="btn" href={withNext("/login", "/dashboard/advent")}>Увійти</Link>
        <Link className="btn ghost" href={withNext("/register", "/dashboard/advent")}>Зареєструватися</Link>
      </div>
    </div>
  );
}
