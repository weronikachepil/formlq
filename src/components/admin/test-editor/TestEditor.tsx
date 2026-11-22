"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Globe, Loader2, Lock, MousePointerClick, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import { useExamGuard } from "@/context/ExamGuardContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { SpinnerScreen } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { pluralize, PLURAL } from "@/lib/format";
import {
  NMT_2025_TABLE,
  maxRawScore,
  makeLinearTable,
  bankToTestQuestion,
  type BankQuestion,
  type TestQuestion,
} from "@/lib/tests";
import { useTestDraft } from "@/hooks/useTestDraft";
import { TestMetaCard } from "@/components/admin/test-editor/TestMetaCard";
import { QuestionStrip, TestQuestionList } from "@/components/admin/test-editor/TestQuestionList";
import { TestQuestionEditor } from "@/components/admin/test-editor/TestQuestionEditor";
import { ScoreTableEditor } from "@/components/admin/test-editor/ScoreTableEditor";
import { BankImportModal } from "@/components/admin/test-editor/BankImportModal";
import { BankExportModal } from "@/components/admin/test-editor/BankExportModal";
import { FileImportModal } from "@/components/admin/test-editor/FileImportModal";
import { TestShareModal } from "@/components/admin/test-editor/TestShareModal";
import { SegmentedControl } from "@/components/admin/test-editor/primitives";
import type { AddKind } from "@/components/admin/test-editor/constants";

type Tab = "questions" | "settings";

interface TestEditorProps {
  id: string;
  /** The tests list this editor belongs to. */
  backHref: string;
  /**
   * A teacher's own test: published only with a description and their name; no
   * question bank (it's the platform's) — questions are written or imported from a file.
   */
  personal?: boolean;
}

export function TestEditor({ id, backHref, personal = false }: TestEditorProps) {
  const { userProfile } = useAuth();
  // A teacher's name goes into the catalog with their published test.
  const draft = useTestDraft(
    id,
    backHref,
    personal ? { authorName: userProfile?.displayName?.trim() || "Викладач" } : undefined,
  );
  const { requestNav } = useExamGuard();
  const { questions } = draft;

  const [activeQId, setActiveQId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [showBank, setShowBank] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showFileImport, setShowFileImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  if (draft.loading) return <SpinnerScreen />;

  /** Open a question from the editor's own buttons: start reading it from its top. */
  function goTo(qid: string) {
    setActiveQId(qid);
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (el && el.getBoundingClientRect().top < 140) el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  /** Teachers publish with a description: the catalog shows it under their name. */
  function save() {
    if (personal && draft.published && !draft.subtitle.trim()) {
      toast.error("Додайте короткий опис — без нього тест не можна опублікувати");
      setActiveTab("settings");
      setTimeout(() => document.getElementById("test-subtitle")?.focus(), 50);
      return;
    }
    draft.save();
  }

  const activeIndex = questions.findIndex((q) => q.id === activeQId);
  const activeQ = activeIndex >= 0 ? questions[activeIndex] : null;
  const totalPoints = maxRawScore(questions);

  function importFromBank(selected: BankQuestion[]) {
    const startOrder = questions.length;
    // Fresh ids so importing the same bank question twice doesn't collide.
    const converted: TestQuestion[] = selected.map((bq, i) => ({
      ...bankToTestQuestion(bq, startOrder + i),
      id: crypto.randomUUID(),
    }));
    draft.appendQuestions(converted);
    setActiveQId(converted[0]?.id ?? null);
  }

  /** Deletes right away and offers a few seconds to bring the question back. */
  function deleteWithUndo(q: TestQuestion, index: number) {
    draft.deleteQuestion(q.id);
    setActiveQId(null);
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Завдання {index + 1} видалено
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => {
              draft.insertQuestion(q, index);
              setActiveQId(q.id);
              toast.dismiss(t.id);
            }}
          >
            Повернути
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  }

  function importFromFile(imported: TestQuestion[]) {
    draft.appendQuestions(imported);
    setActiveQId(imported[0]?.id ?? null);
  }

  return (
    <div>
      <main className="max-w-5xl space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <Link
            href={backHref}
            // Through the guard, so unsaved edits prompt before leaving.
            onClick={(e) => {
              e.preventDefault();
              requestNav(backHref);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Усі тести
          </Link>

          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <input
                id="test-title"
                value={draft.title}
                onChange={(e) => draft.setTitle(e.target.value)}
                placeholder="Назва тесту"
                aria-label="Назва тесту"
                className="w-full bg-transparent font-heading text-2xl sm:text-3xl font-bold tracking-tight outline-none rounded-xl -mx-2 px-2 py-1 hover:bg-muted/40 focus:bg-muted/40 transition-colors placeholder:text-muted-foreground/50"
              />
              {/* What the test is at a glance; the details live in «Налаштування». */}
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                <span>{pluralize(questions.length, PLURAL.task)}</span>
                <span aria-hidden>·</span>
                <span>макс. {pluralize(totalPoints, PLURAL.point)}</span>
                <span aria-hidden>·</span>
                <span>{draft.durationMinutes} хв</span>
                {draft.grade !== null && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{draft.grade} клас</span>
                  </>
                )}
                {draft.subtitle.trim() ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate max-w-80">{draft.subtitle}</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden>·</span>
                    <span className={cn(personal && draft.published && "text-destructive")}>без опису</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <PublishSwitch published={draft.published} onToggle={() => draft.setPublished((v) => !v)} />
              <Button variant="outline" onClick={() => setShowShare(true)}>
                <QrCode /> Поділитися
              </Button>
              <Button
                onClick={save}
                disabled={draft.saving || !draft.isDirty}
                className="min-w-32 gap-1.5"
                title="⌘S / Ctrl+S"
              >
                {draft.saving ? (
                  <>
                    <Loader2 className="animate-spin" /> Збереження…
                  </>
                ) : draft.isDirty ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden /> Зберегти
                  </>
                ) : (
                  <>
                    <Check /> {draft.saved ? "Збережено" : "Усе збережено"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>


        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "questions", label: `Завдання (${questions.length})` },
            { value: "settings", label: "Налаштування" },
          ]}
        />

        {activeTab === "questions" && (
          <div className="space-y-4">
            <QuestionStrip questions={questions} activeId={activeQId} onSelect={goTo} />
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
              <TestQuestionList
                questions={questions}
                activeId={activeQId}
                onSelect={(qid) => (qid ? goTo(qid) : setActiveQId(null))}
                onAdd={(type) => setActiveQId(draft.addQuestion(type))}
                onImport={personal ? undefined : () => setShowBank(true)}
                onImportFile={() => setShowFileImport(true)}
                onExport={personal ? undefined : () => setShowExport(true)}
              />

              <div ref={editorRef} className="min-w-0 scroll-mt-[calc(var(--app-header-h)+5rem)] lg:scroll-mt-[calc(var(--app-header-h)+1rem)]">
                {activeQ ? (
                  <TestQuestionEditor
                    contextId={id}
                    question={activeQ}
                    index={activeIndex}
                    onChange={(patch) => draft.updateQuestion(activeQ.id, patch)}
                    onMove={(dir) => draft.moveQuestion(activeQ.id, dir)}
                    onDelete={() => deleteWithUndo(activeQ, activeIndex)}
                    onPrev={activeIndex > 0 ? () => goTo(questions[activeIndex - 1].id) : undefined}
                    onNext={activeIndex < questions.length - 1 ? () => goTo(questions[activeIndex + 1].id) : undefined}
                    onAddSame={() => goTo(draft.addQuestion(sameKind(activeQ)))}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-2 py-16 px-6 text-center">
                    <span className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <MousePointerClick size={18} />
                    </span>
                    <p className="text-sm font-semibold">
                      {questions.length ? "Оберіть завдання зі списку" : "Тут зʼявиться редактор завдання"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      {questions.length
                        ? "Натисніть на завдання ліворуч, щоб змінити його текст, варіанти й бали."
                        : "Додайте перше завдання ліворуч — оберіть його тип."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-5">
            <TestMetaCard
              subtitle={draft.subtitle}
              onSubtitleChange={draft.setSubtitle}
              durationMinutes={draft.durationMinutes}
              onDurationChange={draft.setDurationMinutes}
              descriptionRequired={personal && draft.published}
              grade={draft.grade}
              onGradeChange={draft.setGrade}
              subject={draft.subject}
              onSubjectChange={draft.setSubject}
            />
            <div className="space-y-2">
              <h2 className="px-1 font-heading font-bold">Шкала балів</h2>
              <ScoreTableEditor
                table={draft.scoreTable}
                onChange={draft.setScoreTable}
                scaleType={draft.scaleType}
                onScaleTypeChange={(type) => {
                  draft.setScaleType(type);
                  draft.setScoreTable(
                    type === "nmt" ? NMT_2025_TABLE : makeLinearTable(totalPoints),
                  );
                }}
                maxRaw={totalPoints}
              />
            </div>
          </div>
        )}
      </main>

      <BankImportModal
        open={showBank && !personal}
        onClose={() => setShowBank(false)}
        onImport={importFromBank}
      />
      <FileImportModal
        open={showFileImport}
        onClose={() => setShowFileImport(false)}
        contextId={id}
        startOrder={questions.length}
        onImport={importFromFile}
      />
      <TestShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        testId={id}
        title={draft.title}
        published={draft.published}
        linkAccess={draft.linkAccess}
        onLinkAccessChange={draft.setLinkAccess}
        isDirty={draft.isDirty}
        saving={draft.saving}
        onSave={save}
      />
      <BankExportModal
        open={showExport && !personal}
        onClose={() => setShowExport(false)}
        questions={questions}
      />
    </div>
  );
}

/** Draft ⇄ published, as a labelled switch: what it means is spelled out, not just coloured. */
function PublishSwitch({ published, onToggle }: { published: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={published}
      onClick={onToggle}
      title={published ? "Тест бачать учні — натисніть, щоб зробити чернеткою" : "Тест бачите лише ви — натисніть, щоб опублікувати"}
      className={cn(
        "inline-flex items-center gap-2 h-10 pl-1.5 pr-4 rounded-full border text-sm font-semibold transition-colors",
        published
          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-glass-edge bg-glass shadow-pill text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "relative w-9 h-6 rounded-full transition-colors",
          published ? "bg-green-500" : "bg-muted-foreground/30",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-transform",
            published && "translate-x-3",
          )}
        >
          {published ? <Globe size={11} className="text-green-600" /> : <Lock size={10} className="text-muted-foreground" />}
        </span>
      </span>
      {published ? "Опубліковано" : "Чернетка"}
    </button>
  );
}

/** The add-menu kind a question was made from (a two-option «Так / Ні» choice counts as its own). */
function sameKind(q: TestQuestion): AddKind {
  if (q.type === "mcq" && q.options.length === 2 && q.options[0]?.text === "Так" && q.options[1]?.text === "Ні") {
    return "truefalse";
  }
  return q.type;
}
