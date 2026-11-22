"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { useAuth } from "@/context/AuthContext";
import { canTutor, isEditor } from "@/lib/roles";
import {
  GRADES,
  SUBJECT_LABEL,
  getPublishedTests,
  getUserResults,
  type TestDoc,
  type TestSubject,
} from "@/lib/tests";
import { Select, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { FileText } from "lucide-react";
import { TestRow, bestByTest } from "@/components/tests/TestCard";

type Filter = "all" | "nmt" | "teachers";

const FILTER_LABEL: Record<Filter, string> = {
  all: "Усі",
  nmt: "НМТ",
  teachers: "Від викладачів",
};

const ALL = "all";

interface Query {
  text: string;
  source: Filter;
  grade: string; // ALL or "5".."11"
  subject: TestSubject | typeof ALL;
}

/**
 * Catalog group of a test. Teachers' tests are one group; platform tests are split
 * into formlq's own NMT imitations and real NMT sessions by year (read from the title).
 */
function groupOf(t: TestDoc): string {
  if (t.personal) return "Від викладачів";
  if (/імітац/i.test(t.title)) return "Імітації НМТ від formlq";
  const year = t.title.match(/20\d\d/)?.[0];
  return year ? `НМТ ${year} року` : "Інші тести";
}

/** Groups in the order their first (newest) test appears; tests keep their order. */
function groupTests(list: TestDoc[]): { name: string; tests: TestDoc[] }[] {
  const map = new Map<string, TestDoc[]>();
  for (const t of list) {
    const g = groupOf(t);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(t);
  }
  return [...map].map(([name, tests]) => ({ name, tests }));
}

function matches(t: TestDoc, q: Query): boolean {
  if (q.source === "nmt" && t.personal) return false;
  if (q.source === "teachers" && !t.personal) return false;
  if (q.grade !== ALL && String(t.grade ?? "") !== q.grade) return false;
  // "Algebra and geometry" tests suit either filter.
  if (q.subject !== ALL && t.subject !== q.subject && t.subject !== "mixed") return false;
  if (!q.text) return true;
  return [t.title, t.subtitle, t.authorName].some((s) => (s ?? "").toLowerCase().includes(q.text));
}

export default function TestsPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  // The catalog is for students (and editors); teachers work with their own tests.
  const teacher = canTutor(userProfile?.role) && !isEditor(userProfile?.role);
  useEffect(() => {
    if (teacher) router.replace("/tutor/tests");
  }, [teacher, router]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [grade, setGrade] = useState<string>(ALL);
  const [subject, setSubject] = useState<TestSubject | typeof ALL>(ALL);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: queryKeys.tests.published,
    queryFn: getPublishedTests,
    enabled: !!user && !!userProfile && !teacher,
    staleTime: STALE.long,
  });

  // Same cached list as the history page.
  const { data: results = [] } = useQuery({
    queryKey: queryKeys.results(user?.uid),
    queryFn: () => getUserResults(user!.uid),
    enabled: !!user && !!userProfile && !teacher,
    staleTime: STALE.short,
  });
  const best = useMemo(() => bestByTest(results), [results]);

  // Newest published first — platform and teachers' tests alike (getPublishedTests sorts).
  const ordered = tests;
  const teacherCount = ordered.filter((t) => t.personal).length;

  const q: Query = { text: search.trim().toLowerCase(), source: filter, grade, subject };
  const visible = ordered.filter((t) => matches(t, q));
  // Source counts follow the other filters, so the tabs say what you'll get.
  const counts = Object.fromEntries(
    (Object.keys(FILTER_LABEL) as Filter[]).map((f) => [f, ordered.filter((t) => matches(t, { ...q, source: f })).length]),
  ) as Record<Filter, number>;
  const filtered = !!q.text || filter !== "all" || grade !== ALL || subject !== ALL;

  const groups = groupTests(visible);
  // "Пройдено": at least one attempt, counted or not.
  const done = ordered.filter((t) => best.has(t.id)).length;
  const donePct = ordered.length ? Math.round((done / ordered.length) * 100) : 0;

  if (isLoading || teacher || !userProfile) return <SpinnerPage />;
  if (tests.length === 0) {
    return <EmptyState emoji="📝" title="Тести ще не додані" description="Зайдіть пізніше" />;
  }

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-4 rounded-[18px] bg-card p-5 sm:p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-lavender text-[#14262a]">
          <FileText size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-bold sm:text-2xl">Тести з математики</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {done} з {ordered.length} тестів пройдено
          </p>
          <div className="mt-2.5 h-1.5 max-w-sm overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${donePct}%` }} />
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук за назвою, описом чи автором"
          wrapperClassName="flex-1"
          className="h-10"
        />
        <div className="sm:w-36">
            <Select value={grade} onValueChange={setGrade} className="w-full">
              <SelectItem value={ALL}>Усі класи</SelectItem>
              {GRADES.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g} клас
                </SelectItem>
              ))}
            </Select>
          </div>
        <div className="sm:w-44">
          <Select value={subject} onValueChange={(v) => setSubject(v as TestSubject | typeof ALL)} className="w-full">
            <SelectItem value={ALL}>Усі розділи</SelectItem>
            <SelectItem value="algebra">{SUBJECT_LABEL.algebra}</SelectItem>
            <SelectItem value="geometry">{SUBJECT_LABEL.geometry}</SelectItem>
          </Select>
        </div>
      </div>

      {teacherCount > 0 && (
        <div className="flex">
          <div role="tablist" className="flex gap-1 p-1 rounded-full bg-glass border border-glass-edge shadow-pill w-fit">
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-8 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  filter === f
                    ? "bg-primary text-primary-foreground shadow-pill-dark"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {FILTER_LABEL[f]}
                <span className="ml-1.5 text-xs opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Нічого не знайдено"
          description={filtered ? "Спробуйте інший запит або приберіть фільтри" : undefined}
        />
      ) : (
        groups.map((g) => (
          <section key={g.name} className="rounded-[18px] bg-card p-4 sm:p-6 space-y-3">
            <h2 className="px-1 font-heading text-lg font-bold">
              {g.name}
              <span className="ml-2 text-sm font-medium text-muted-foreground">{g.tests.length}</span>
            </h2>
            <div className="space-y-2">
              {g.tests.map((t, i) => (
                <TestRow key={t.id} test={t} index={i + 1} best={best.get(t.id)} query={search} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
