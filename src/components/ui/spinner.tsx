import { cn } from "@/lib/utils";

const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };

interface SpinnerProps {
  size?: keyof typeof sizes;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full border-2 border-foreground/80 border-t-transparent animate-spin",
        sizes[size],
        className,
      )}
    />
  );
}

/**
 * Page/section loading: a white card with a few pulsing placeholder rows where the
 * content will appear, instead of a lone spinner in an empty page that then jumps.
 * `rows` sets how many lines; `size` is kept for old callers (lg = a few more rows).
 */
export function SpinnerPage({ size = "md", rows }: { size?: keyof typeof sizes; rows?: number }) {
  const n = rows ?? (size === "lg" ? 6 : 4);
  return (
    // data-page-loading: PageTransition waits for this to go before fading the page in.
    <div className="rounded-[18px] bg-card p-4 sm:p-5 space-y-2" data-page-loading="" aria-busy="true" aria-label="Завантаження">
      {Array.from({ length: n }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** One placeholder list row: a circle and two lines. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 rounded-[14px] bg-muted/50 px-4 py-3.5", className)}>
      <span className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
      <span className="flex-1 space-y-2">
        <span className="block h-3.5 w-2/5 animate-pulse rounded-full bg-muted" />
        <span className="block h-3 w-1/4 animate-pulse rounded-full bg-muted/70" />
      </span>
    </div>
  );
}

/** Full-viewport loader (auth gates, route-level loading). */
export function SpinnerScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
