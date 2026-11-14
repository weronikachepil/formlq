"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Copy, Link2, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ensureInviteCode, inviteLink } from "@/lib/invites";
import { addStudentByEmail } from "@/lib/tutor";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-field";
import { SectionLabel } from "@/components/ui/section-label";
import { Spinner } from "@/components/ui/spinner";

/** How a teacher gets students: share a link/code, or add a registered student by email. */
export function InviteStudentsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, userProfile, refreshProfile } = useAuth();
  const [code, setCode] = useState<string | null>(userProfile?.inviteCode ?? null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || code || !userProfile) return;
    ensureInviteCode(userProfile)
      .then((c) => {
        setCode(c);
        refreshProfile();
      })
      .catch(() => toast.error("Не вдалося створити посилання-запрошення"));
  }, [open, code, userProfile, refreshProfile]);

  async function copy(what: "link" | "code") {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(what === "link" ? inviteLink(code) : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  async function addByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !email.trim()) return;
    setAdding(true);
    try {
      const link = await addStudentByEmail(user.uid, email.trim());
      toast.success(`${link.studentName} — тепер ваш учень`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося додати учня");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md" className="p-6 space-y-5">
      <div>
        <h2 className="font-heading font-bold text-xl">Запросити учня</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Надішліть учню посилання або код. Він зареєструється (якщо ще не має акаунта) і приєднається до вас.
        </p>
      </div>

      <div className="space-y-2">
        <SectionLabel>Посилання</SectionLabel>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 h-10 px-4 rounded-full border border-glass-edge bg-glass flex items-center gap-2 text-sm">
            <Link2 size={14} className="shrink-0 text-muted-foreground" />
            {code ? <span className="truncate">{inviteLink(code)}</span> : <Spinner className="w-4 h-4" />}
          </div>
          <Button onClick={() => copy("link")} disabled={!code} className="shrink-0 gap-1.5">
            {copied === "link" ? <Check size={15} /> : <Copy size={15} />}
            {copied === "link" ? "Скопійовано" : "Копіювати"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>Або код</SectionLabel>
        <button
          type="button"
          onClick={() => copy("code")}
          disabled={!code}
          title="Скопіювати код"
          className="w-full rounded-2xl border border-dashed border-border py-3 font-mono text-2xl font-bold tracking-[0.35em] hover:bg-glass-strong transition-colors"
        >
          {copied === "code" ? "✓" : (code ?? "······")}
        </button>
        <p className="text-xs text-muted-foreground">
          Учень вводить його на головній сторінці: «Приєднатися до викладача».
        </p>
      </div>

      <form onSubmit={addByEmail} className="space-y-2 border-t border-foreground/8 pt-4">
        <SectionLabel as="label" htmlFor="invite-email">
          Учень уже зареєстрований? Додайте за email
        </SectionLabel>
        <div className="flex gap-2">
          <TextInput
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
          />
          <Button type="submit" variant="outline" disabled={adding || !email.trim()} className="shrink-0 gap-1.5">
            <Mail size={15} /> {adding ? "Додаю…" : "Додати"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
