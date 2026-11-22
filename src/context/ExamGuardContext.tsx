"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
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
      <Dialog open={!!pendingAction} onClose={cancel} size="sm" className="max-w-[420px]" showClose>
        <div className="px-7 pb-7 pt-9 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-lavender/45 text-[#14262a] dark:bg-lavender/25 dark:text-foreground">
            <Info size={26} />
          </span>
          <p className="mt-5 font-heading text-xl font-bold leading-tight">{copy.title}</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{copy.message}</p>

          {copy.onSave ? (
            <div className="mt-7 space-y-3">
              <button
                onClick={saveAndLeave}
                disabled={saving}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                Зберегти й вийти
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={cancel}
                  disabled={saving}
                  className="h-12 rounded-full bg-muted text-sm font-semibold transition-colors hover:bg-muted/70 disabled:opacity-60"
                >
                  Залишитись
                </button>
                <button
                  onClick={confirm}
                  disabled={saving}
                  className="h-12 rounded-full text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                >
                  {copy.confirmLabel}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                onClick={cancel}
                className="h-12 rounded-full bg-muted text-sm font-semibold transition-colors hover:bg-muted/70"
              >
                Залишитись
              </button>
              <button
                onClick={confirm}
                className="h-12 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
