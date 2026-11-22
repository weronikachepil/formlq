"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

interface GuardCopy {
  title: string;
  message: string;
  confirmLabel: string;
  /**
   * Offer «Зберегти й вийти» as the main action: saves, then leaves; resolves false when
   * saving failed (the dialog stays open).
   */
  onSave?: () => Promise<boolean>;
}

const DEFAULT_COPY: GuardCopy = {
  title: "Вийти з іспиту?",
  message: "Прогрес не збережеться. Таймер зупиниться і результат не зарахується.",
  confirmLabel: "Вийти",
};

interface ExamGuardContextType {
  isGuarded: boolean;
  setGuarded: (v: boolean, copy?: Partial<GuardCopy>) => void;
  requestNav: (href: string) => void;
  requestAction: (fn: () => void) => void;
}

const ExamGuardContext = createContext<ExamGuardContextType>({
  isGuarded: false,
  setGuarded: () => {},
  requestNav: () => {},
  requestAction: () => {},
});

export function ExamGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isGuarded, setGuardedState] = useState(false);
  const [copy, setCopy] = useState<GuardCopy>(DEFAULT_COPY);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const setGuarded = useCallback((v: boolean, c?: Partial<GuardCopy>) => {
    setGuardedState(v);
    setCopy(v && c ? { ...DEFAULT_COPY, ...c } : DEFAULT_COPY);
  }, []);

  const requestNav = useCallback((href: string) => {
    if (isGuarded) {
      setPendingAction(() => () => router.push(href));
    } else {
      router.push(href);
    }
  }, [isGuarded, router]);

  const requestAction = useCallback((fn: () => void) => {
    if (isGuarded) {
      setPendingAction(() => fn);
    } else {
      fn();
    }
  }, [isGuarded]);

  function confirm() {
    pendingAction?.();
    setPendingAction(null);
    setGuarded(false);
  }

  function cancel() {
    if (saving) return;
    setPendingAction(null);
  }

  async function saveAndLeave() {
    if (!copy.onSave || saving) return;
    const action = pendingAction;
    setSaving(true);
    try {
      if (!(await copy.onSave())) return;
      action?.();
      setPendingAction(null);
      setGuarded(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ExamGuardContext.Provider value={{ isGuarded, setGuarded, requestNav, requestAction }}>
      {children}
      <Dialog open={!!pendingAction} onClose={cancel} size="sm">
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/12 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1 min-w-0 pt-0.5">
              <p className="font-heading font-bold text-base leading-tight">{copy.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{copy.message}</p>
            </div>
          </div>

          {copy.onSave ? (
            <div className="space-y-2">
              <button
                onClick={saveAndLeave}
                disabled={saving}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-pill-dark hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                Зберегти й вийти
              </button>
              <div className="flex gap-2">
                <button
                  onClick={cancel}
                  disabled={saving}
                  className="flex-1 h-10 rounded-full border border-glass-edge bg-glass shadow-pill text-sm font-semibold hover:bg-glass-strong transition-colors disabled:opacity-60"
                >
                  Залишитись
                </button>
                <button
                  onClick={confirm}
                  disabled={saving}
                  className="flex-1 h-10 rounded-full text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                >
                  {copy.confirmLabel}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancel}
                className="flex-1 h-10 px-4 rounded-full border border-glass-edge bg-glass shadow-pill text-sm font-semibold hover:bg-glass-strong transition-colors"
              >
                Залишитись
              </button>
              <button
                onClick={confirm}
                className="flex-1 h-10 px-4 rounded-full bg-destructive text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {copy.confirmLabel}
              </button>
            </div>
          )}
        </div>
      </Dialog>
    </ExamGuardContext.Provider>
  );
}

export const useExamGuard = () => useContext(ExamGuardContext);
