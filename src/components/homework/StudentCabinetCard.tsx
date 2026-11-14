import Link from "next/link";
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Hourglass } from "lucide-react";
import type { HomeworkSummary } from "@/lib/homework-status";
import { cn } from "@/lib/utils";

interface StudentCabinetCardProps {
  studentId: string;
  name: string;
  email?: string;
  summary: HomeworkSummary;
}

/** A tutor's entry into one student's cabinet: who, how they are doing, what's next. */
export function StudentCabinetCard({ studentId, name, email, summary }: StudentCabinetCardProps) {
  const { total, active, overdue, done, nextDueMs } = summary;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/tutor/students/${studentId}`}
      className={cn(
        "group rounded-2xl border bg-card p-4 flex flex-col gap-3 transition-all",
        overdue ? "border-red-500/30 hover:border-red-500/50" : "border-border/50 hover:border-border/80",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
          {name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </div>
        <ChevronRight
          size={16}
          className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Stat icon={<Hourglass size={12} />} value={active} label="активних" tone="text-blue-600 dark:text-blue-400 bg-blue-500/10" />
        {overdue > 0 && (
          <Stat icon={<AlertCircle size={12} />} value={overdue} label="прострочено" tone="text-red-600 dark:text-red-400 bg-red-500/10" />
        )}
        <Stat icon={<CheckCircle2 size={12} />} value={done} label="виконано" tone="text-green-600 dark:text-green-400 bg-green-500/10" />
      </div>

      <div className="space-y-1.5">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {total ? `Виконано ${done} з ${total}` : "Завдань ще немає"}
          </span>
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

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full", tone)}>
      {icon}
      {value} {label}
    </span>
  );
}
