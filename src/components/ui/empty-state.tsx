import { cn } from "@/lib/utils";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  /** The one thing to do next (a button or link), under the text. */
  action?: React.ReactNode;
  /** Extra content under the action, e.g. a short "how it works". */
  children?: React.ReactNode;
  className?: string;
}

/** Nothing here yet: a calm white card that says why and what to do next. */
export function EmptyState({ emoji, title, description, action, children, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-[18px] bg-card px-6 py-14 text-center", className)}>
      {emoji && (
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-lavender/45 text-2xl dark:bg-lavender/25">
          {emoji}
        </span>
      )}
      <p className="font-heading text-lg font-bold">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
      {children}
    </div>
  );
}
