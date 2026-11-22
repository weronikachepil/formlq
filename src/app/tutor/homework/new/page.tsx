"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { isEditor } from "@/lib/roles";
import { usePageHeader } from "@/context/HeaderContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { pluralize, PLURAL } from "@/lib/format";
import { getTutorStudents, assignHomework, assignHomeworkToGroup, NewHomework } from "@/lib/tutor";
import { subscribeTutorGroups, type StudentGroup } from "@/lib/groups";
import toast from "react-hot-toast";
import {
  getTests,
  getTestFolders,
  bankToTestQuestion,
  makeLinearTable,
  maxRawScore,
  TestQuestion,
  type BankQuestion,
} from "@/lib/tests";
import { getAllQuestions } from "@/lib/questions";
import { uploadPdf } from "@/lib/storage";
import { TOPICS } from "@/lib/topics";
import { MathText } from "@/components/MathText";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SpinnerPage } from "@/components/ui/spinner";
import { TestPicker } from "@/components/TestPicker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { IconButton } from "@/components/ui/icon-button";
import { SearchInput } from "@/components/ui/search-input";
import { TextInput } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
import { FileText, Library, Check, Loader2, FileUp, X } from "lucide-react";

/** Bank questions are НМТ-style: only these three types. */
const TYPE_LABEL: Record<BankQuestion["type"], string> = {
  mcq: "Тест",
  open: "Відкрите",
  matching: "Відповідність",
};

export default function NewHomeworkPage() {
  const { user, userProfile } = useAuth();
  // Editors assign platform tests and bank questions; teachers only their own tests.
  const editor = isEditor(userProfile?.role);
  const owner = editor ? null : (user?.uid ?? null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();

  // Who gets it: "s:<studentId>" or "g:<groupId>" (each member gets their own copy).
  const [recipient, setRecipient] = useState(() => {
    const g = params.get("group");
    const s = params.get("student");
    return g ? `g:${g}` : s ? `s:${s}` : "";
  });
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState(""); // datetime-local string
  const [source, setSource] = useState<"test" | "custom">("test");
  const [testId, setTestId] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePdf(file: File) {
    setPdfUploading(true);
    try {
      const url = await uploadPdf(file);
      setPdfUrl(url);
      setPdfName(file.name);
    } finally {
      setPdfUploading(false);
    }
  }

  // bank picker
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bankSearch, setBankSearch] = useState("");
  const [bankTopic, setBankTopic] = useState("all");
  const [bankType, setBankType] = useState<"all" | BankQuestion["type"]>("all");

  usePageHeader("Нове домашнє завдання");

  useEffect(() => {
    if (!user) return;
    return subscribeTutorGroups(user.uid, setGroups);
  }, [user]);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.tutorStudents(user?.uid),
    queryFn: () => getTutorStudents(user!.uid),
    enabled: !!user,
  });

  const { data: tests = [], isLoading: testsLoading } = useQuery({
    queryKey: queryKeys.tests.of(owner),
    queryFn: () => getTests(owner),
    enabled: !!user && !!userProfile,
    staleTime: STALE.long,
    // Show all tests (published + drafts), tests with questions first, by order.
    select: (all) =>
      [...all]
        .filter((t) => (t.questions?.length ?? 0) > 0)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });

  const { data: testFolders = [] } = useQuery({
    queryKey: queryKeys.tests.foldersOf(owner),
    queryFn: () => getTestFolders(owner),
    enabled: !!user && !!userProfile,
    staleTime: STALE.long,
  });

  const { data: bank = [] } = useQuery({
    queryKey: queryKeys.bankQuestions,
    queryFn: getAllQuestions,
    enabled: editor,
    staleTime: STALE.long,
    select: (qs) => qs.filter((q) => q.status === "approved"),
  });

  const selectedTest = tests.find((t) => t.id === testId);

  const studentId = recipient.startsWith("s:") ? recipient.slice(2) : "";
  const group = recipient.startsWith("g:") ? groups.find((g) => g.id === recipient.slice(2)) : undefined;
  // Only members who are still the tutor's students.
  const groupMembers = useMemo(
    () => (group ? students.filter((s) => group.studentIds.includes(s.studentId)) : []),
    [group, students],
  );

  const filteredBank = useMemo(() => {
    const s = bankSearch.toLowerCase();
    return bank.filter((q) => {
      if (bankTopic !== "all" && q.topicId !== bankTopic) return false;
      if (bankType !== "all" && q.type !== bankType) return false;
      if (s && !q.text.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [bank, bankSearch, bankTopic, bankType]);

  const customQuestions: TestQuestion[] = useMemo(() => {
    const chosen = bank.filter((q) => picked.has(q.id));
    return chosen.map((q, i) => bankToTestQuestion(q, i));
  }, [bank, picked]);

  const customMaxRaw = maxRawScore(customQuestions);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit =
    !!user &&
    (!!studentId || groupMembers.length > 0) &&
    title.trim().length > 0 &&
    (source === "test" ? !!testId : customQuestions.length > 0);

  async function handleAssign() {
    if (!canSubmit || !user) return;
    setSaving(true);
    try {
      const base = {
        tutorId: user.uid,
        tutorName: user.displayName ?? undefined,
        title: title.trim(),
        note: note.trim() || undefined,
        pdfUrl: pdfUrl || undefined,
        dueAt: due ? Timestamp.fromDate(new Date(due)) : null,
      };

      let payload: Omit<NewHomework, "studentId" | "studentName">;
      if (source === "test" && selectedTest) {
        payload = {
          ...base,
          source: "test",
          testId: selectedTest.id,
          // A copy of the questions: students never read the test itself (see Homework.questions).
          questions: selectedTest.questions,
          subtitle: selectedTest.subtitle ?? "",
          scoreTable: selectedTest.scoreTable,
          scaleType: selectedTest.scaleType ?? "nmt",
          durationMinutes: selectedTest.durationMinutes ?? 150,
        };
      } else {
        payload = {
          ...base,
          source: "custom",
          questions: customQuestions,
          scoreTable: makeLinearTable(customMaxRaw),
          scaleType: "custom",
          durationMinutes: 0, // homework is untimed
        };
      }
      if (group) {
        const n = await assignHomeworkToGroup(
          payload,
          group,
          groupMembers.map((m) => ({ studentId: m.studentId, studentName: m.studentName })),
        );
        toast.success(`Завдання отримали ${pluralize(n, PLURAL.student)} групи «${group.name}»`);
        router.push(`/tutor/groups/${group.id}`);
        return;
      }
      const student = students.find((s) => s.studentId === studentId);
      await assignHomework({ ...payload, studentId, studentName: student?.studentName });
      queryClient.invalidateQueries({ queryKey: queryKeys.studentHomework(studentId) });
      router.push(`/tutor/students/${studentId}`);
    } catch {
      toast.error("Не вдалося призначити завдання");
    } finally {
      setSaving(false);
    }
  }

  if (studentsLoading) return <SpinnerPage />;

  // What still blocks "Призначити" — said in words instead of a silently grey button.
  const hasContent = source === "test" ? !!testId : customQuestions.length > 0;
  const hasRecipient = !!studentId || groupMembers.length > 0;
  const missing = [
    !hasContent && (source === "test" ? "тест" : "завдання з банку"),
    !hasRecipient && (groups.length ? "учень або група" : "учень"),
    !title.trim() && "назва",
  ].filter(Boolean) as string[];

  const pdfField = pdfUrl ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[12px] border border-border/50 bg-card text-sm">
      <FileText size={16} className="text-primary shrink-0" />
      <span className="flex-1 min-w-0 truncate">{pdfName || "Конспект.pdf"}</span>
      <IconButton
        label="Прибрати"
        tone="danger"
        onClick={() => {
          setPdfUrl("");
          setPdfName("");
        }}
      >
        <X size={15} />
      </IconButton>
    </div>
  ) : (
    <label
      className={cn(
        "flex h-11 items-center justify-center gap-2 px-4 rounded-[12px] border border-dashed border-foreground/20 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-foreground transition-colors",
        pdfUploading && "pointer-events-none opacity-60",
      )}
    >
      {pdfUploading ? (
        <>
          <Loader2 size={15} className="animate-spin" /> Завантаження...
        </>
      ) : (
        <>
          <FileUp size={15} /> Прикріпити конспект (PDF)
        </>
      )}
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePdf(f);
          e.target.value = "";
        }}
      />
    </label>
  );

  // Right-hand summary: what the student will get, filled in as the form is.
  const studentName = students.find((s) => s.studentId === studentId)?.studentName;
  const questionCount = source === "test" ? (selectedTest?.questions.length ?? 0) : customQuestions.length;
  const summary: { label: string; value: string | null }[] = [
    {
      label: "Кому",
      value: group ? `Група «${group.name}» · ${pluralize(groupMembers.length, PLURAL.student)}` : (studentName ?? null),
    },
    {
      label: "Що",
      value: source === "test" ? (selectedTest?.title ?? null) : customQuestions.length ? "Завдання з банку" : null,
    },
    { label: "Назва для учня", value: title.trim() || null },
    { label: "Питань", value: questionCount ? pluralize(questionCount, PLURAL.question) : null },
    {
      label: "Час",
      value: source === "test" ? (selectedTest ? `${selectedTest.durationMinutes ?? 150} хв` : null) : "без обмеження",
    },
    {
      label: "Дедлайн",
      value: due
        ? new Date(due).toLocaleString("uk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
        : "без дедлайну",
    },
  ];

  return (
    <div className="grid items-start gap-5 pb-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0 space-y-4">
      {/* 1 — the main decision comes first: what to give. */}
      <Step n={1} done={hasContent && !!title.trim()} title="Що задати">
        {editor && (
          <div role="tablist" className="flex w-fit gap-1 p-1 rounded-[12px] bg-muted/60">
            <SourceTab active={source === "test"} onClick={() => setSource("test")} Icon={FileText} label="Готовий тест" />
            <SourceTab active={source === "custom"} onClick={() => setSource("custom")} Icon={Library} label="З банку завдань" />
          </div>
        )}

        {source === "test" || !editor ? (
          <Field label={editor ? "Тест (включно з імітаціями НМТ)" : "Тест"}>
            {!editor && !testsLoading && tests.length === 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                У вас ще немає тестів із питаннями.{" "}
                <Link href="/tutor/tests" className="text-primary font-medium hover:underline">
                  Створити тест
                </Link>
              </p>
            )}
            <TestPicker
              tests={tests}
              folders={testFolders}
              value={testId}
              onChange={(v) => {
                setTestId(v);
                const t = tests.find((x) => x.id === v);
                if (t && !title.trim()) setTitle(t.title);
              }}
            />
            {selectedTest && (
              <p className="text-xs text-muted-foreground mt-1.5 px-1 tabular-nums">
                {pluralize(selectedTest.questions.length, PLURAL.question)} ·{" "}
                {pluralize(maxRawScore(selectedTest.questions), PLURAL.point)} ·{" "}
                {(selectedTest.scaleType ?? "nmt") === "nmt" ? "шкала НМТ 100–200" : "власна шкала"}
              </p>
            )}
          </Field>
        ) : (
          <div className="space-y-3">
            {/* Bank filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SearchInput value={bankSearch} onChange={setBankSearch} className="h-9.5" />
              <Select value={bankTopic} onValueChange={setBankTopic} className="w-full">
                <SelectItem value="all">Усі теми</SelectItem>
                {TOPICS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </Select>
              <Select value={bankType} onValueChange={(v) => setBankType(v as typeof bankType)} className="w-full">
                <SelectItem value="all">Усі типи</SelectItem>
                {(Object.keys(TYPE_LABEL) as BankQuestion["type"][]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <p className="text-xs text-muted-foreground px-1 tabular-nums">
              Обрано: {picked.size} · {pluralize(customMaxRaw, PLURAL.point)}
            </p>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredBank.map((q) => {
                const isPicked = picked.has(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => togglePick(q.id)}
                    aria-pressed={isPicked}
                    className={cn(
                      "w-full text-left rounded-[12px] border px-3 py-2.5 flex items-start gap-3 transition-colors",
                      isPicked ? "border-primary bg-primary/5" : "border-border/50 bg-card hover:border-border/80",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                        isPicked ? "bg-primary border-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {isPicked && <Check size={13} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm line-clamp-2">
                        <MathText text={q.text || "—"} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {TYPE_LABEL[q.type]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Складність {q.difficulty}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredBank.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Немає завдань за фільтром</p>
              )}
            </div>
          </div>
        )}

        <Field label="Назва для учня">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Напр. Домашня №3 — Похідна" />
          {source === "test" && !testId && (
            <p className="text-[11px] text-muted-foreground mt-1 px-1">Підставиться з назви тесту — можна змінити.</p>
          )}
        </Field>
      </Step>

      {/* 2 — who gets it. */}
      <Step n={2} done={hasRecipient} title="Кому">
        <Select value={recipient} onValueChange={setRecipient} className="w-full">
          <SelectItem value="">{groups.length ? "Оберіть учня або групу..." : "Оберіть учня..."}</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g.id} value={`g:${g.id}`}>
              Група «{g.name}» · {pluralize(g.studentIds.length, PLURAL.student)}
            </SelectItem>
          ))}
          {students.map((s) => (
            <SelectItem key={s.studentId} value={`s:${s.studentId}`}>
              {s.studentName}
            </SelectItem>
          ))}
        </Select>
        {group && (
          <p className="text-xs text-muted-foreground px-1">
            {groupMembers.length
              ? `Кожен учень групи отримає своє завдання: ${groupMembers.map((m) => m.studentName).join(", ")}.`
              : "У групі немає учнів — додайте їх на сторінці «Учні»."}
          </p>
        )}
        {students.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">Немає учнів. Додайте учня на сторінці «Учні».</p>
        )}
      </Step>

      {/* 3 — optional extras, clearly separated from what's required. */}
      <Step n={3} title="Термін і деталі" optional>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Дедлайн">
            <DateTimePicker value={due} onChange={setDue} placeholder="Без дедлайну" />
          </Field>
          <Field label="Коментар для учня">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Напр. Зверни увагу на №5" />
          </Field>
        </div>
        {pdfField}
      </Step>

      {/* Phones/tablets: sticky action bar (large screens use the summary card). */}
      <div className="sticky bottom-4 z-30 flex items-center gap-3 rounded-[18px] border border-glass-edge bg-glass p-2 pl-4 shadow-pill backdrop-blur-xl lg:hidden">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {missing.length ? (
            <>
              Ще не вказано: <span className="font-semibold text-foreground">{missing.join(", ")}</span>
            </>
          ) : group ? (
            <>
              Отримають <span className="font-semibold text-foreground">{pluralize(groupMembers.length, PLURAL.student)}</span>
            </>
          ) : (
            "Усе готово"
          )}
        </p>
        <Button variant="ghost" onClick={() => router.back()}>
          Скасувати
        </Button>
        <Button disabled={!canSubmit || saving} onClick={handleAssign} className="gap-1.5">
          <Check size={16} />
          {saving ? "Призначення..." : "Призначити"}
        </Button>
      </div>
    </div>

    {/* Large screens: a live summary beside the form, with the action. */}
    <aside className="sticky top-[calc(var(--app-header-h)+1rem)] hidden space-y-4 rounded-[18px] bg-card p-5 lg:block">
      <h2 className="font-heading text-base font-bold">Підсумок</h2>
      <dl className="space-y-3">
        {summary.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className={cn("text-sm font-semibold", !row.value && "font-normal text-muted-foreground/70")}>
              {row.value ?? "—"}
            </dd>
          </div>
        ))}
        {note.trim() && (
          <div>
            <dt className="text-xs text-muted-foreground">Коментар</dt>
            <dd className="text-sm">{note.trim()}</dd>
          </div>
        )}
        {pdfUrl && (
          <div>
            <dt className="text-xs text-muted-foreground">Конспект</dt>
            <dd className="flex items-center gap-1.5 text-sm font-semibold">
              <FileText size={14} className="shrink-0" />
              <span className="truncate">{pdfName || "Конспект.pdf"}</span>
            </dd>
          </div>
        )}
      </dl>
      {missing.length > 0 && (
        <p className="rounded-[12px] bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
          Ще не вказано: <span className="font-semibold text-foreground">{missing.join(", ")}</span>
        </p>
      )}
      <div className="space-y-2">
        <Button disabled={!canSubmit || saving} onClick={handleAssign} className="w-full gap-1.5" size="lg">
          <Check size={16} />
          {saving ? "Призначення..." : "Призначити"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => router.back()}>
          Скасувати
        </Button>
      </div>
    </aside>
    </div>
  );
}

/** One numbered step of the form; the number turns into a check once it's filled. */
function Step({
  n,
  title,
  done = false,
  optional = false,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-border/50 bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums transition-colors",
            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {done ? <Check size={13} strokeWidth={3} /> : n}
        </span>
        <h2 className="font-heading text-base font-bold">{title}</h2>
        {optional && <span className="text-xs text-muted-foreground">необовʼязково</span>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground px-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function SourceTab({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 h-8 px-3 rounded-[9px] text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
