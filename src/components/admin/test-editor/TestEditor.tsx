"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import toast from "react-hot-toast";
import { useExamGuard } from "@/context/ExamGuardContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpinnerScreen } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
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
import { TestQuestionList } from "@/components/admin/test-editor/TestQuestionList";
import { TestQuestionEditor } from "@/components/admin/test-editor/TestQuestionEditor";
import { ScoreTableEditor } from "@/components/admin/test-editor/ScoreTableEditor";
import { BankImportModal } from "@/components/admin/test-editor/BankImportModal";
import { BankExportModal } from "@/components/admin/test-editor/BankExportModal";
import { FileImportModal } from "@/components/admin/test-editor/FileImportModal";
import { TestShareModal } from "@/components/admin/test-editor/TestShareModal";
import { SegmentedControl } from "@/components/admin/test-editor/primitives";

type Tab = "questions" | "scoring";

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

  if (draft.loading) return <SpinnerScreen />;

  /** Teachers publish with a description: the catalog shows it under their name. */
  function save() {
    if (personal && draft.published && !draft.subtitle.trim()) {
      toast.error("Додайте короткий опис — без нього тест не можна опублікувати");
      document.getElementById("test-subtitle")?.focus();
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
      <main className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              // Through the guard, so unsaved edits prompt before leaving.
              onClick={(e) => {
                e.preventDefault();
                requestNav(backHref);
              }}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ← Тести
            </Link>
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer select-none text-xs",
                draft.published
                  ? "border-green-500/40 text-green-600 bg-green-500/10 hover:bg-green-500/20"
                  : "border-border/50 text-muted-foreground hover:border-primary/40",
              )}
              onClick={() => draft.setPublished((v) => !v)}
            >
              {draft.published ? "✓ Опубліковано" : "Чернетка"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShare(true)}
            >
              <QrCode /> Поділитися
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={draft.saving || !draft.isDirty}
              className="min-w-[100px]"
            >
              {draft.saving
                ? "Збереження..."
                : draft.saved && !draft.isDirty
                  ? "✓ Збережено"
                  : "Зберегти"}
            </Button>
          </div>
        </div>

        <TestMetaCard
          title={draft.title}
          onTitleChange={draft.setTitle}
          subtitle={draft.subtitle}
          onSubtitleChange={draft.setSubtitle}
          durationMinutes={draft.durationMinutes}
          onDurationChange={draft.setDurationMinutes}
          totalPoints={totalPoints}
          descriptionRequired={personal && draft.published}
          grade={draft.grade}
          onGradeChange={draft.setGrade}
          subject={draft.subject}
          onSubjectChange={draft.setSubject}
        />

        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "questions", label: `Питання (${questions.length})` },
            { value: "scoring", label: "Шкала балів" },
          ]}
        />

        {activeTab === "questions" && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
            <TestQuestionList
              questions={questions}
              activeId={activeQId}
              onSelect={setActiveQId}
              onAdd={(type) => setActiveQId(draft.addQuestion(type))}
              onImport={personal ? undefined : () => setShowBank(true)}
              onImportFile={() => setShowFileImport(true)}
              onExport={personal ? undefined : () => setShowExport(true)}
            />

            {activeQ ? (
              <TestQuestionEditor
                contextId={id}
                question={activeQ}
                index={activeIndex}
                onChange={(patch) => draft.updateQuestion(activeQ.id, patch)}
                onMove={(dir) => draft.moveQuestion(activeQ.id, dir)}
                onDelete={() => deleteWithUndo(activeQ, activeIndex)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/50 flex items-center justify-center h-48 text-sm text-muted-foreground">
                Оберіть питання для редагування
              </div>
            )}
          </div>
        )}

        {activeTab === "scoring" && (
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
