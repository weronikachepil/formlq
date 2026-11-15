"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { queryKeys } from "@/lib/queryKeys";
import { getTutorStudents, subscribeTutorHomework, type Homework } from "@/lib/tutor";
import { subscribeTutorGroups, type StudentGroup } from "@/lib/groups";
import { getResult, type TestResult } from "@/lib/tests";
import { getHomeworkStatusMeta, isHomeworkOverdue } from "@/lib/homework-status";
import { pluralize, PLURAL } from "@/lib/format";
import { GroupDialog } from "@/components/tutor/GroupDialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SpinnerPage } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** One homework given to the group: a column of the table (the members' copies share `assignId`). */
interface Assignment {
  key: string;
  title: string;
  assignedMs: number;
  dueAt: Homework["dueAt"];
  byStudent: Map<string, Homework>;
}

/** A group's members and its group homework as a table: who did what and with what score. */
export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<StudentGroup[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [results, setResults] = useState<Map<string, TestResult | null>>(() => new Map());
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());

  const { data: students = [] } = useQuery({
    queryKey: queryKeys.tutorStudents(user?.uid),
    queryFn: () => getTutorStudents(user!.uid),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const offGroups = subscribeTutorGroups(user.uid, setGroups);
    const offHomework = subscribeTutorHomework(user.uid, (list) => setHomework(list.filter((h) => h.groupId === groupId)));
    return () => {
      offGroups();
      offHomework();
    };
  }, [user, groupId]);

  const group = groups?.find((g) => g.id === groupId);
  usePageHeader(group?.name ?? "Група", "Результати групи");

  const assignments = useMemo<Assignment[]>(() => {
    const map = new Map<string, Assignment>();
    for (const h of homework ?? []) {
      const key = h.assignId ?? h.id;
      let a = map.get(key);
      if (!a) {
        a = { key, title: h.title, assignedMs: h.assignedAt?.toMillis() ?? now, dueAt: h.dueAt, byStudent: new Map() };
        map.set(key, a);
      }
      a.byStudent.set(h.studentId, h);
    }
    // Newest first: the latest homework is what the tutor checks most.
    return [...map.values()].sort((a, b) => b.assignedMs - a.assignedMs);
  }, [homework, now]);

  // Rows: current members, plus former members who still have this group's homework.
  const rows = useMemo(() => {
    const names = new Map(students.map((s) => [s.studentId, s.studentName || "Учень"]));
    for (const h of homework ?? []) if (!names.has(h.studentId)) names.set(h.studentId, h.studentName || "Учень");
    const ids = new Set([...(group?.studentIds ?? []), ...(homework ?? []).map((h) => h.studentId)]);
    return [...ids]
      .filter((id) => names.has(id))
      .map((id) => ({ studentId: id, name: names.get(id)!, member: !!group?.studentIds.includes(id) }))
      .sort((a, b) => Number(b.member) - Number(a.member) || a.name.localeCompare(b.name, "uk"));
  }, [students, homework, group]);

  // Scores live in testResults; fetch each completed copy's result once (one doc each,
  // which the testResults rule allows for the homework's tutor).
  useEffect(() => {
    const missing = (homework ?? []).filter((h) => h.resultId && !results.has(h.resultId)).map((h) => h.resultId!);
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map((id) => getResult(id).catch(() => null))).then((list) => {
      if (!alive) return;
      setResults((prev) => {
        const next = new Map(prev);
        missing.forEach((id, i) => next.set(id, list[i]));
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [homework, results]);

  if (!groups || !homework) return <SpinnerPage />;
  if (!group) {
    return (
      <EmptyState emoji="🫥" title="Групу не знайдено" description="Можливо, її видалили." />
    );
  }

  const done = (a: Assignment) => [...a.byStudent.values()].filter((h) => h.status === "completed").length;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link
        href="/tutor/students"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Усі учні
      </Link>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {pluralize(group.studentIds.length, PLURAL.student)} · {pluralize(assignments.length, PLURAL.task)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil size={15} /> Змінити групу
          </Button>
          <Button size="lg" className="gap-1.5" onClick={() => router.push(`/tutor/homework/new?group=${group.id}`)}>
            <Plus size={16} /> Завдання групі
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState emoji="🧑‍🎓" title="У групі ще немає учнів" description="Натисніть «Змінити групу», щоб додати учнів." />
      ) : assignments.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="Групі ще не давали завдань"
          description="Натисніть «Завдання групі» — кожен учень отримає своє, а тут зʼявиться таблиця результатів."
        />
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="sticky left-0 z-10 bg-popover text-left font-semibold px-4 py-3 min-w-44">Учень</th>
                {assignments.map((a) => (
                  <th key={a.key} className="text-left font-semibold px-3 py-3 min-w-36 align-bottom">
                    <span className="line-clamp-2">{a.title}</span>
                    <span className="block text-[11px] font-medium text-muted-foreground mt-0.5">
                      {a.dueAt ? `до ${a.dueAt.toDate().toLocaleDateString("uk", { day: "numeric", month: "short" })} · ` : ""}
                      здали {done(a)}/{a.byStudent.size}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className="border-b border-border/40 last:border-b-0">
                  <td className="sticky left-0 z-10 bg-popover px-4 py-2.5">
                    <Link href={`/tutor/students/${r.studentId}`} className="font-medium hover:underline underline-offset-2">
                      {r.name}
                    </Link>
                    {!r.member && <span className="block text-[11px] text-muted-foreground">вже не в групі</span>}
                  </td>
                  {assignments.map((a) => {
                    const h = a.byStudent.get(r.studentId);
                    return (
                      <td key={a.key} className="px-3 py-2.5">
                        {h ? <Cell hw={h} result={h.resultId ? results.get(h.resultId) : undefined} now={now} /> : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && user && (
        <GroupDialog
          tutorId={user.uid}
          students={students
            .map((s) => ({ studentId: s.studentId, name: s.studentName || "Учень" }))
            .sort((a, b) => a.name.localeCompare(b.name, "uk"))}
          group={group}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/** One student's copy: score when done, otherwise its status (red when overdue). */
function Cell({ hw, result, now }: { hw: Homework; result: TestResult | null | undefined; now: number }) {
  let label: string;
  let cls: string;
  if (hw.status === "completed") {
    cls = "text-green-700 dark:text-green-400 bg-green-500/10";
    if (result === undefined) label = "…";
    else if (!result) label = "Здано";
    else if ((result.scaleType ?? "nmt") === "nmt") label = `${result.nmtScore} · ${result.rawScore}/${result.maxRaw}`;
    else label = `${result.rawScore}/${result.maxRaw}`;
  } else if (isHomeworkOverdue(hw, now)) {
    label = "Прострочено";
    cls = "text-red-600 dark:text-red-400 bg-red-500/10";
  } else {
    const meta = getHomeworkStatusMeta(hw.status, "tutor");
    label = meta.label;
    cls = meta.cls;
  }
  return (
    <Link
      href={`/tutor/homework/${hw.id}`}
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums whitespace-nowrap hover:opacity-80", cls)}
    >
      {label}
    </Link>
  );
}
