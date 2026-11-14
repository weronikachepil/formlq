"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { InviteStudentsDialog } from "@/components/tutor/InviteStudentsDialog";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import {
  subscribeTutorHomework,
  subscribeTutorStudents,
  type Homework,
  type TutorStudent,
} from "@/lib/tutor";
import { summarizeHomework, type HomeworkSummary } from "@/lib/homework-status";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SectionLabel } from "@/components/ui/section-label";
import { StudentCabinetCard } from "@/components/homework/StudentCabinetCard";

interface Cabinet {
  studentId: string;
  name: string;
  email?: string;
  summary: HomeworkSummary;
}

/** The tutor's students, each with a cabinet card summarising their homework. */
export default function TutorStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<TutorStudent[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);
  // Fixed per visit, so "overdue" doesn't flicker while rendering.
  const [now] = useState(() => Date.now());

  usePageHeader("Учні", "Кабінети та домашні завдання");

  useEffect(() => {
    if (!user) return;
    const offStudents = subscribeTutorStudents(user.uid, setStudents);
    const offHomework = subscribeTutorHomework(user.uid, setHomework);
    return () => {
      offStudents();
      offHomework();
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
    const out: Cabinet[] = students.map((s) => ({
      studentId: s.studentId,
      name: s.studentName || s.studentEmail,
      email: s.studentEmail,
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

  const q = search.trim().toLowerCase();
  const visible = q
    ? cabinets.filter((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
    : cabinets;

  const loading = !students || !homework;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        {cabinets.length > 4 ? (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Пошук учня…"
            wrapperClassName="sm:w-72"
          />
        ) : (
          <div />
        )}
        <div className="flex gap-2">
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
      ) : visible.length === 0 ? (
        <EmptyState emoji="🔍" title="Нікого не знайдено" description="Спробуйте інше імʼя або email." />
      ) : (
        <div className="space-y-2">
          <SectionLabel size="2xs">Учні ({visible.length})</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <StudentCabinetCard key={c.studentId} {...c} />
            ))}
          </div>
        </div>
      )}

      <InviteStudentsDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
