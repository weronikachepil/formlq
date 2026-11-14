"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, type SignUpRole } from "@/context/AuthContext";
import { GraduationCap, Presentation } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, safeNextPath, withNext } from "@/lib/utils";

export function RegisterForm({ modal = false }: { modal?: boolean }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignUpRole>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  // Set when sent here from a protected page (e.g. a test QR code); return there after sign-in.
  const nextParam = useSearchParams().get("next");
  const next = safeNextPath(nextParam);

  // A new teacher lands on their students page unless a link sent them somewhere.
  const afterSignUp = () => (role === "tutor" && !nextParam ? "/tutor/students" : next);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) {
      setError("Вкажіть імʼя та прізвище");
      return;
    }
    if (password.length < 6) {
      setError("Пароль має бути не менше 6 символів");
      return;
    }
    setLoading(true);
    try {
      // Full name: shown to tutors and as the author of published tests.
      await signUp(email, password, `${firstName.trim()} ${lastName.trim()}`, role);
      router.push(afterSignUp());
    } catch {
      setError("Не вдалось зареєструватись. Перевірте дані.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle(role);
      router.push(afterSignUp());
    } catch {
      setError("Google sign-in error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      modal={modal}
      title="Створити акаунт"
      footerText="Вже є акаунт?"
      footerLinkHref={withNext("/login", nextParam ? next : null)}
      footerLinkLabel="Увійти"
    >
      <RolePicker value={role} onChange={setRole} disabled={loading} />

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className={cn(
          "w-full flex items-center justify-center gap-2.5 h-11 rounded-full border border-glass-edge bg-glass text-sm font-semibold shadow-pill transition-all",
          "hover:bg-glass-strong active:scale-[0.98]",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Зареєструватись через Google
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-foreground/10" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">або</span>
        <div className="flex-1 h-px bg-foreground/10" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first-name" className="text-sm font-medium">Імʼя</Label>
            <Input id="first-name" type="text" placeholder="Олена" value={firstName}
              onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" className="h-11" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="last-name" className="text-sm font-medium">Прізвище</Label>
            <Input id="last-name" type="text" placeholder="Коваленко" value={lastName}
              onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" className="h-11" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-11" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-sm font-medium">Пароль</Label>
          <Input id="password" type="password" placeholder="Мінімум 6 символів" value={password}
            onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="h-11" />
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-2.5">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading} size="lg" className="mt-1">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Реєстрація…
            </span>
          ) : "Зареєструватись"}
        </Button>
      </form>
    </AuthCard>
  );
}

const ROLES: { value: SignUpRole; label: string; hint: string; Icon: typeof GraduationCap }[] = [
  { value: "student", label: "Я учень", hint: "Тести й заняття", Icon: GraduationCap },
  { value: "tutor", label: "Я вчитель", hint: "Учні й розклад", Icon: Presentation },
];

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: SignUpRole;
  onChange: (r: SignUpRole) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Хто ви?" className="grid grid-cols-2 gap-2">
      {ROLES.map(({ value: v, label, hint, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-colors",
              "disabled:opacity-50 disabled:pointer-events-none",
              active
                ? "border-transparent bg-primary text-primary-foreground shadow-pill-dark"
                : "border-glass-edge bg-glass shadow-pill hover:bg-glass-strong",
            )}
          >
            <Icon size={18} className={cn("shrink-0", active ? "opacity-90" : "text-muted-foreground")} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold leading-tight">{label}</span>
              <span className={cn("truncate text-[11px] leading-snug", active ? "opacity-70" : "text-muted-foreground")}>
                {hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
