import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileUp, Library, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralize, PLURAL } from "@/lib/format";
import type { TestQuestion } from "@/lib/tests";
import { ADD_GROUPS, KIND_ICON, TYPE_ICON, TYPE_LABELS, type AddKind } from "./constants";


/** «+ Додати завдання»: question types in two groups, each with what the student does. */
function AddMenu({ onAdd }: { onAdd: (kind: AddKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];

  useEffect(() => {
    if (!open) return;
    // Near the bottom of the screen: scroll just enough to show the whole menu.
    menuRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    items()[0]?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** ↑ / ↓ / Home / End move between the types. */
  function onMenuKey(e: React.KeyboardEvent) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const go = (k: number) => {
      e.preventDefault();
      list[(k + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-pill-dark hover:opacity-90 transition-opacity"
      >
        <Plus size={16} /> Додати завдання
        <ChevronDown size={14} className={cn("opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Тип завдання"
          onKeyDown={onMenuKey}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[min(75vh,30rem)] overflow-y-auto overscroll-contain rounded-[18px] border border-glass-edge bg-popover p-1.5 shadow-glass-lg animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {ADD_GROUPS.map((g, gi) => (
            <div key={g.title} role="group" aria-label={g.title} className={cn(gi > 0 && "mt-1 pt-1 border-t border-border/50")}>
              <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {g.title}
              </p>
              {g.kinds.map(({ kind, label, hint }) => {
                const Icon = KIND_ICON[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onAdd(kind);
                    }}
                    className="group w-full flex items-center gap-3 rounded-[10px] px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-[10px] bg-muted flex items-center justify-center text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:bg-primary group-focus-visible:text-primary-foreground">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{label}</span>
                      <span className="block text-xs text-muted-foreground leading-snug">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Import / export: quiet text buttons, secondary to adding a question. */
function SourceButton({
  icon,
  children,
  ...props
}: { icon: React.ReactNode; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex items-center gap-1.5 h-8 pointer-coarse:h-10 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      {icon}
      {children}
    </button>
  );
}

/** Sidebar: compact list of test questions + add/import/export actions. */
export function TestQuestionList({
  questions,
  activeId,
  onSelect,
  onAdd,
  onImport,
  onImportFile,
  onExport,
}: {
  questions: TestQuestion[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (type: AddKind) => void;
  /** Omitted = no question bank here (a teacher's own test). */
  onImport?: () => void;
  onImportFile: () => void;
  onExport?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const emptyCount = questions.filter((q) => !q.text.trim()).length;
  // The chosen question (from the list, prev/next or a new one) is always in view in the list.
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`[data-qid="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId, questions.length]);

  return (
    // Sticks under the app header and fits the screen; a long list scrolls inside.
    <div className="space-y-3 lg:sticky lg:top-[calc(var(--app-header-h)+1rem)] lg:max-h-[calc(100dvh-var(--app-header-h)-2rem)] lg:flex lg:flex-col">
      <div className="space-y-1.5">
        <AddMenu onAdd={onAdd} />
        <div className="flex flex-wrap items-center justify-center gap-0.5">
          {onImport && (
            <SourceButton icon={<Library size={13} />} onClick={onImport}>
              З банку
            </SourceButton>
          )}
          <SourceButton icon={<FileUp size={13} />} onClick={onImportFile}>
            З файлу
          </SourceButton>
          {onExport && (
            <SourceButton
              icon={<Upload size={13} />}
              onClick={onExport}
              disabled={questions.length === 0}
              title="Зберегти вибрані завдання в банк питань"
            >
              У банк
            </SourceButton>
          )}
        </div>
      </div>

      {/* Jump by number: every question one click away, however long the list. */}
      {questions.length > 1 && (
        <div className="hidden lg:grid grid-cols-8 gap-1" role="navigation" aria-label="Перейти до завдання">
          {questions.map((q, i) => {
            const active = q.id === activeId;
            const empty = !q.text.trim();
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(q.id)}
                aria-current={active}
                aria-label={`Завдання ${i + 1}${empty ? ", без умови" : ""}`}
                title={q.text.trim() ? q.text.replace(/\$+/g, "").slice(0, 80) : "Без умови"}
                className={cn(
                  "relative h-8 rounded-[8px] text-xs font-semibold tabular-nums transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border/50 text-foreground/80 hover:border-foreground/30",
                )}
              >
                {i + 1}
                {empty && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}

      {emptyCount > 0 && (
        <p className="hidden lg:block px-1 text-xs text-amber-700 dark:text-amber-400">
          {emptyCount === questions.length
            ? "Заповніть умови завдань"
            : `Ще без умови: ${pluralize(emptyCount, PLURAL.task)}`}
        </p>
      )}
      {questions.length > 0 ? (
        <div
          ref={listRef}
          className="hidden lg:block space-y-1.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mx-1 lg:px-1 lg:py-0.5 overscroll-contain"
        >
          {questions.map((q, i) => {
            const Icon = TYPE_ICON[q.type];
            const active = activeId === q.id;
            return (
              <button
                key={q.id}
                type="button"
                data-qid={q.id}
                onClick={() => onSelect(active ? null : q.id)}
                aria-current={active}
                className={cn(
                  "w-full text-left pl-2 pr-3 py-2 rounded-xl border flex items-center gap-2.5 transition-colors",
                  active
                    ? "border-primary/50 bg-primary/8 shadow-sm"
                    : "border-border/40 bg-card hover:border-border/80 hover:bg-muted/30",
                )}
              >
                <span className="w-6 text-center text-xs font-semibold text-muted-foreground tabular-nums shrink-0">
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "w-7 h-7 shrink-0 rounded-lg flex items-center justify-center",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  title={TYPE_LABELS[q.type]}
                >
                  <Icon size={14} />
                </span>
                <span className="flex-1 min-w-0 text-sm truncate">
                  {q.text.trim() ? (
                    q.text.replace(/\$+/g, "")
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                      Без умови
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {q.points} б
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-center">
          <p className="text-sm font-semibold">Завдань ще немає</p>
          <p className="text-xs text-muted-foreground mt-1">Натисніть «Додати завдання» або імпортуйте готові.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Narrow screens (an iPad upright): the questions as a sticky strip of numbers under the
 * header, swiped sideways — the editor stays right below instead of after a long list.
 */
export function QuestionStrip({
  questions,
  activeId,
  onSelect,
}: {
  questions: TestQuestion[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeId) return;
    ref.current
      ?.querySelector(`[data-qid="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeId, questions.length]);
  if (!questions.length) return null;

  return (
    <div className="lg:hidden sticky top-[var(--app-header-h)] z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/80 backdrop-blur-xl border-b border-glass-edge">
      <div ref={ref} className="flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {questions.map((q, i) => {
          const Icon = TYPE_ICON[q.type];
          const active = q.id === activeId;
          const empty = !q.text.trim();
          return (
            <button
              key={q.id}
              type="button"
              data-qid={q.id}
              onClick={() => onSelect(q.id)}
              aria-current={active}
              aria-label={`Завдання ${i + 1}, ${TYPE_LABELS[q.type]}${empty ? ", без умови" : ""}`}
              className={cn(
                "relative shrink-0 h-11 min-w-14 px-3 rounded-full border inline-flex items-center justify-center gap-1.5 text-sm font-semibold tabular-nums transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/50 text-foreground/80 active:bg-muted",
              )}
            >
              <Icon size={14} className={active ? "opacity-80" : "text-muted-foreground"} />
              {i + 1}
              {empty && (
                <span
                  className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-background"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
