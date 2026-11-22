"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ChevronRight, Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { deleteTest, getTeacherTests, updateTest, type TestDoc } from "@/lib/tests";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { pluralize, PLURAL } from "@/lib/format";
import { usePageHeader } from "@/context/HeaderContext";
import { menuItemCls, menuPopupCls, menuTriggerCls } from "./TestRow";
import { Highlight } from "@/components/ui/highlight";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * Moderation of teachers' tests: editors can't edit them (they're the teacher's),
 * but can open one read-only, take it off the catalog or delete it.
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

  usePageHeader(
    "Тести",
    isLoading ? "" : `Тести викладачів: ${tests.length} · у каталозі ${tests.filter((t) => t.published).length}`,
  );

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
    const href = `/admin/tests/teachers/${t.id}`;
    return (
      <div
        key={t.id}
        className="group relative rounded-2xl border border-border/50 bg-card pl-4 pr-2 py-2.5 flex items-center gap-3 transition-shadow hover:shadow-[0_8px_28px_rgba(20,38,42,0.08)]"
      >
        {/* The whole row opens the test (stretched link); the «⋯» sits above it. */}
        <Link href={href} className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <span className="sr-only">Переглянути тест «{t.title || "Без назви"}»</span>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            <Highlight text={t.title || "Без назви"} query={search} />
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            <Highlight text={t.authorName || "Без імені"} query={search} />
            {" · "}
            {pluralize(t.questions?.length ?? 0, PLURAL.task)}
            {t.subtitle && (
              <>
                {" · "}
                <Highlight text={t.subtitle} query={search} />
              </>
            )}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
            t.published
              ? "bg-green-500/12 text-green-700 dark:text-green-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {t.published ? <Eye size={12} /> : <EyeOff size={12} />}
          {t.published ? "У каталозі" : "Чернетка"}
        </span>
        <ChevronRight
          size={16}
          className="shrink-0 hidden [@media(hover:hover)]:block text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"
          aria-hidden
        />
        <Menu.Root>
          <Menu.Trigger aria-label="Дії з тестом" className={cn(menuTriggerCls, "relative z-10")}>
            <MoreHorizontal size={17} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
              <Menu.Popup className={menuPopupCls}>
                <Menu.Item render={<Link href={href} />} className={menuItemCls}>
                  <Eye size={15} className="text-muted-foreground" /> Переглянути
                </Menu.Item>
                {t.published && (
                  <Menu.Item
                    onClick={() => unpublish.mutate(t.id)}
                    disabled={unpublish.isPending}
                    className={menuItemCls}
                  >
                    <EyeOff size={15} className="text-muted-foreground" /> Зняти з каталогу
                  </Menu.Item>
                )}
                <div className="my-1 h-px bg-border/60" />
                <Menu.Item
                  onClick={() => setConfirmDelete(t)}
                  disabled={remove.isPending}
                  className={cn(menuItemCls, "text-destructive data-[highlighted]:bg-destructive/10")}
                >
                  <Trash2 size={15} /> Видалити тест
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-var(--app-header-h)-3rem-var(--tabs-h,0px))]">
      <div className="sticky lg:static top-[calc(var(--app-header-h)+var(--tabs-h,0px))] z-20 py-2 bg-background lg:bg-transparent -mx-4 md:-mx-6 px-4 md:px-6 lg:mx-0 lg:px-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук: назва, опис чи автор"
        />
      </div>

      <div className="pt-1 pb-4 space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:-mx-2 lg:px-2">
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
              <div className="grid gap-2 lg:grid-cols-2">{published.map(renderRow)}</div>
            </div>
          )}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <SectionLabel className="px-1">Чернетки · {drafts.length}</SectionLabel>
              <div className="grid gap-2 lg:grid-cols-2">{drafts.map(renderRow)}</div>
            </div>
          )}
        </>
      )}

      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Видалити тест «${confirmDelete?.title || "Без назви"}»?`}
        description={`Тест викладача ${confirmDelete?.authorName ?? ""} зникне назавжди, і домашки з ним перестануть відкриватися.`}
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
