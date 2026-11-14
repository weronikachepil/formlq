"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { EyeOff, FileText, Trash2, UserRound } from "lucide-react";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { deleteTest, getTeacherTests, updateTest, type TestDoc } from "@/lib/tests";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Highlight } from "@/components/ui/highlight";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * Moderation of teachers' tests: editors can't edit them (they're the teacher's),
 * but can take one off the catalog or delete it.
 */
export function TeacherTestsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<TestDoc | null>(null);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: queryKeys.tests.teachers,
    queryFn: getTeacherTests,
    staleTime: STALE.medium,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.tests.published });
  }

  const unpublish = useMutation({
    mutationFn: (id: string) => updateTest(id, { published: false }),
    onSuccess: () => toast.success("Тест знято з публікації"),
    onError: () => toast.error("Не вдалося зняти з публікації"),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTest(id),
    onSuccess: () => toast.success("Тест видалено"),
    onError: () => toast.error("Не вдалося видалити тест"),
    onSettled: refresh,
  });

  const q = search.trim().toLowerCase();
  const [published, drafts] = useMemo(() => {
    const updated = (t: TestDoc) => t.updatedAt?.toMillis() ?? 0;
    const list = tests
      .filter(
        (t) =>
          !q ||
          [t.title, t.subtitle, t.authorName].some((s) => (s ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => updated(b) - updated(a));
    return [list.filter((t) => t.published), list.filter((t) => !t.published)];
  }, [tests, q]);

  function renderRow(t: TestDoc) {
    return (
      <div
        key={t.id}
        className={cn(
          "rounded-2xl border bg-card px-4 py-3 flex items-center gap-3 group",
          t.published ? "border-border/50" : "border-border/30",
        )}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            t.published ? "bg-green-500" : "bg-muted-foreground/30",
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            <Highlight text={t.title || "Без назви"} query={search} />
          </p>
          {t.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              <Highlight text={t.subtitle} query={search} />
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 min-w-0 truncate">
              <UserRound size={11} className="shrink-0" />
              <Highlight text={t.authorName || "Без імені"} query={search} />
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <FileText size={11} /> {t.questions?.length ?? 0}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {t.published && (
            <IconButton
              label="Зняти з публікації"
              onClick={() => unpublish.mutate(t.id)}
              disabled={unpublish.isPending}
            >
              <EyeOff size={13} />
            </IconButton>
          )}
          <IconButton
            label="Видалити"
            tone="danger"
            onClick={() => setConfirmDelete(t)}
            disabled={remove.isPending}
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Пошук за назвою, описом чи автором"
        className="h-9"
      />

      {isLoading ? (
        <SpinnerPage />
      ) : tests.length === 0 ? (
        <EmptyState emoji="🧑‍🏫" title="Викладачі ще не створили тестів" />
      ) : published.length + drafts.length === 0 ? (
        <EmptyState emoji="🔍" title="Нічого не знайдено" description={`За запитом «${search.trim()}»`} />
      ) : (
        <>
          {published.length > 0 && (
            <div className="space-y-2">
              <SectionLabel className="px-1">У каталозі · {published.length}</SectionLabel>
              {published.map(renderRow)}
            </div>
          )}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <SectionLabel className="px-1">Чернетки · {drafts.length}</SectionLabel>
              {drafts.map(renderRow)}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Видалити тест «${confirmDelete?.title || "Без назви"}»?`}
        description={`Тест викладача ${confirmDelete?.authorName ?? ""} буде видалено назавжди. Домашні завдання з ним перестануть відкриватися.`}
        confirmLabel="Видалити"
        onConfirm={() => {
          if (confirmDelete) remove.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
