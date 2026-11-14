import { cn } from "@/lib/utils";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ emoji, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "rounded-[2rem] border-2 border-dotted border-foreground/15 bg-glass/50 py-20 text-center space-y-2",
      className,
    )}>
      {emoji && <p className="text-3xl">{emoji}</p>}
      <p className="font-heading font-bold">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
