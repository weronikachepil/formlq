"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Table2, Trash2, UserPlus, Users } from "lucide-react";
import { InviteStudentsDialog } from "@/components/tutor/InviteStudentsDialog";
import { DeleteGroupConfirm, GroupDialog } from "@/components/tutor/GroupDialog";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import {
  subscribeTutorHomework,
  subscribeTutorStudents,
  type Homework,
  type TutorStudent,
} from "@/lib/tutor";
import { subscribeTutorGroups, type StudentGroup } from "@/lib/groups";
import { summarizeHomework, type HomeworkSummary } from "@/lib/homework-status";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { StudentCabinetCard } from "@/components/homework/StudentCabinetCard";
import { cn } from "@/lib/utils";

interface Cabinet {
  studentId: string;
  name: string;
  /** Email, shown only when another student has the same name. */
  subtitle?: string;
  summary: HomeworkSummary;
}

/** Which students are shown: everyone (by group), one group, or those in no group. */
type Filter = "all" | "none" | string;

interface Section {
  key: string;
  title: string;
  group?: StudentGroup;
  items: Cabinet[];
}

/** The tutor's students, each with a cabinet card summarising their homework, arranged by group. */
export default function TutorStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<TutorStudent[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [groups, setGroups] = useState<StudentGroup[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [inviting, setInviting] = useState(false);
  // The group dialog: a group to edit, "new", or closed.
  const [editing, setEditing] = useState<StudentGroup | "new" | null>(null);
  const [deleting, setDeleting] = useState<StudentGroup | null>(null);
  // Fixed per visit, so "overdue" doesn't flicker while rendering.
  const [now] = useState(() => Date.now());

  usePageHeader("Учні", "Кабінети, групи та домашні завдання");

  useEffect(() => {
    if (!user) return;
    const offStudents = subscribeTutorStudents(user.uid, setStudents);
    const offHomework = subscribeTutorHomework(user.uid, setHomework);
    const offGroups = subscribeTutorGroups(user.uid, setGroups);
    return () => {
      offStudents();
      offHomework();
      offGroups();
    };
  }, [user]);

  const cabinets = useMemo<Cabinet[]>(() => {
    if (!students || !homework) return [];
    const byStudent = new Map<string, Homework[]>();
    for (const hw of homework) {
      const list = byStudent.get(hw.studentId) ?? [];
      list.push(hw);
      byStudent.set(hw.studentId, list);
    }
    // Two students with one name can't be told apart without their email.
    const nameCount = new Map<string, number>();
    for (const s of students) nameCount.set(s.studentName || "Учень", (nameCount.get(s.studentName || "Учень") ?? 0) + 1);
    const out: Cabinet[] = students.map((s) => ({
      studentId: s.studentId,
      name: s.studentName || "Учень",
      subtitle: (nameCount.get(s.studentName || "Учень") ?? 0) > 1 ? s.studentEmail || undefined : undefined,
      summary: summarizeHomework(byStudent.get(s.studentId) ?? [], now),
    }));
    // Homework of students who are no longer linked still gets a cabinet.
    const linked = new Set(students.map((s) => s.studentId));
    for (const [studentId, list] of byStudent) {
      if (linked.has(studentId)) continue;
      out.push({ studentId, name: list[0].studentName ?? "Учень", summary: summarizeHomework(list, now) });
    }
    // Students who need attention first.
    return out.sort(
      (a, b) =>
        b.summary.overdue - a.summary.overdue ||
        b.summary.active - a.summary.active ||
        a.name.localeCompare(b.name, "uk"),
    );
  }, [students, homework, now]);

  const groupList = useMemo(() => groups ?? [], [groups]);
  // A filter pointing at a group that was just deleted falls back to everyone.
  const activeFilter: Filter =
    filter === "all" || filter === "none" || groupList.some((g) => g.id === filter) ? filter : "all";

  const q = search.trim().toLowerCase();
  const sections = useMemo<Section[]>(() => {
    const matches = (c: Cabinet) => !q || c.name.toLowerCase().includes(q);
    const byId = new Map(cabinets.map((c) => [c.studentId, c]));
    const inGroup = new Set(groupList.flatMap((g) => g.studentIds));
    const groupSection = (g: StudentGroup): Section => ({
      key: g.id,
      title: g.name,
      group: g,
      // Keep the attention-first order of `cabinets`.
      items: cabinets.filter((c) => g.studentIds.includes(c.studentId) && byId.has(c.studentId) && matches(c)),
    });
    const ungrouped: Section = {
      key: "none",
      title: groupList.length ? "Без групи" : "Учні",
      items: cabinets.filter((c) => !inGroup.has(c.studentId) && matches(c)),
    };
    if (activeFilter === "none") return [ungrouped];
    if (activeFilter !== "all") {
      const g = groupList.find((x) => x.id === activeFilter);
      return g ? [groupSection(g)] : [];
    }
    const out = groupList.map(groupSection);
    // While searching, groups without a match are hidden.
    return [...(q ? out.filter((s) => s.items.length) : out), ...(ungrouped.items.length || !groupList.length ? [ungrouped] : [])];
  }, [cabinets, groupList, activeFilter, q]);

  const shownCount = new Set(sections.flatMap((s) => s.items.map((c) => c.studentId))).size;
  const loading = !students || !homework || !groups;
  const dialogStudents = useMemo(
    () => (students ?? []).map((s) => ({ studentId: s.studentId, name: s.studentName || "Учень" })).sort((a, b) => a.name.localeCompare(b.name, "uk")),
    [students],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        {cabinets.length > 4 ? (
          <SearchInput value={search} onChange={setSearch} placeholder="Пошук учня…" wrapperClassName="sm:w-72" />
        ) : (
          <div />
        )}
        <div className="flex flex-wrap gap-2">
          {cabinets.length > 0 && (
            <Button size="lg" variant="outline" className="gap-1.5" onClick={() => setEditing("new")}>
              <Users size={16} />
              Нова група
            </Button>
          )}
          <Button size="lg" variant="outline" className="gap-1.5" onClick={() => setInviting(true)}>
            <UserPlus size={16} />
            Запросити учня
          </Button>
          {cabinets.length > 0 && (
            <Button size="lg" className="gap-1.5" onClick={() => router.push("/tutor/homework/new")}>
              <Plus size={16} />
              Нове завдання
            </Button>
          )}
        </div>
      </div>

      {groupList.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Групи">
          <FilterChip active={activeFilter === "all"} onClick={() => setFilter("all")}>
            Усі
          </FilterChip>
          {groupList.map((g) => (
            <FilterChip key={g.id} active={activeFilter === g.id} onClick={() => setFilter(g.id)}>
              {g.name} <span className="opacity-60">{g.studentIds.length}</span>
            </FilterChip>
          ))}
          <FilterChip active={activeFilter === "none"} onClick={() => setFilter("none")}>
            Без групи
          </FilterChip>
        </div>
      )}

      {loading ? (
        <SpinnerPage />
      ) : cabinets.length === 0 ? (
        <div className="space-y-4 text-center">
          <EmptyState
            emoji="🧑‍🎓"
            title="Поки немає учнів"
            description="Надішліть учням посилання-запрошення — після приєднання тут зʼявляться їхні кабінети."
          />
          <Button size="lg" className="gap-1.5" onClick={() => setInviting(true)}>
            <UserPlus size={16} />
            Запросити учня
          </Button>
        </div>
      ) : q && shownCount === 0 ? (
        <EmptyState emoji="🔍" title="Нікого не знайдено" description="Спробуйте інше імʼя." />
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.key} className="space-y-2">
              <div className="flex items-center gap-2 min-h-8">
                <h2 className="px-1 font-heading text-lg font-bold">
                  {s.title}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {s.group ? s.group.studentIds.length : s.items.length}
                  </span>
                </h2>
                {s.group && (
                  <>
                    <Button size="xs" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => setEditing(s.group!)}>
                      <Pencil size={12} />
                      Змінити
                    </Button>
                    <Button size="xs" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => router.push(`/tutor/groups/${s.group!.id}`)}>
                      <Table2 size={12} />
                      Результати
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="gap-1 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => setDeleting(s.group!)}
                    >
                      <Trash2 size={12} />
                      Видалити
                    </Button>
                  </>
                )}
              </div>
              {s.items.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {s.items.map((c) => (
                    <StudentCabinetCard key={c.studentId} {...c} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {s.group ? (
                    <>
                      У групі ще немає учнів.{" "}
                      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setEditing(s.group!)}>
                        Додати
                      </button>
                    </>
                  ) : (
                    "Усі учні вже в групах."
                  )}
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      <InviteStudentsDialog open={inviting} onClose={() => setInviting(false)} />
      {editing && user && (
        <GroupDialog
          tutorId={user.uid}
          students={dialogStudents}
          group={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteGroupConfirm group={deleting} onCancel={() => setDeleting(null)} onDeleted={() => setDeleting(null)} />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-sidebar-accent",
      )}
    >
      {children}
    </button>
  );
}
