import Link from "next/link";
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Hourglass } from "lucide-react";
import { plural } from "@/lib/format";
import type { HomeworkSummary } from "@/lib/homework-status";
import { cn } from "@/lib/utils";

interface StudentCabinetCardProps {
  studentId: string;
  name: string;
  /** Shown under the name, e.g. the email when two students share a name. */
  subtitle?: string;
  summary: HomeworkSummary;
}

/**
 * A tutor's entry into one student's cabinet: who, coloured status badges, how far
 * along and the next deadline.
 */
export function StudentCabinetCard({ studentId, name, subtitle, summary }: StudentCabinetCardProps) {
  const { total, active, overdue, done, nextDueMs } = summary;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/tutor/students/${studentId}`}
      className={cn(
        "group rounded-[18px] border bg-card p-4 flex flex-col gap-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        overdue ? "border-red-500/30 hover:border-red-500/50" : "border-border/50 hover:border-primary/30",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
          {name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </div>

      {/* Coloured status badges: blue = in progress, red = overdue, green = done. */}
      <div className="flex flex-wrap gap-1.5">
        <Badge icon={<Hourglass size={12} />} tone="text-blue-600 dark:text-blue-400 bg-blue-500/10">
          {active} {plural(active, ["активне", "активні", "активних"])}
        </Badge>
        {overdue > 0 && (
          <Badge icon={<AlertCircle size={12} />} tone="text-red-600 dark:text-red-400 bg-red-500/10">
            {overdue} прострочено
          </Badge>
        )}
        <Badge icon={<CheckCircle2 size={12} />} tone="text-green-600 dark:text-green-400 bg-green-500/10">
          {done} виконано
        </Badge>
      </div>

      {/* How far along overall, and the next deadline. */}
      <div className="space-y-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{total ? `${done} з ${total}` : "Завдань ще немає"}</span>
          {nextDueMs !== null && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={11} />
              до {new Date(nextDueMs).toLocaleDateString("uk", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Badge({ icon, tone, children }: { icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums", tone)}>
      {icon}
      {children}
    </span>
  );
}
