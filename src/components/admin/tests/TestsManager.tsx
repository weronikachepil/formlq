"use client";

import { queryKeys, STALE } from "@/lib/queryKeys";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import {
  getTests,
  updateTest,
  createTest,
  deleteTest,
  getTestFolders,
  createTestFolder,
  renameTestFolder,
  deleteTestFolder,
  saveTestLayout,
  getLinkAccess,
  type TestDoc,
  type TestFolder,
  type TestOwner,
} from "@/lib/tests";
import { SpinnerPage } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Plus, FolderPlus, Folder, Inbox } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TestRow } from "@/components/admin/tests/TestRow";
import { TestShareModal } from "@/components/admin/test-editor/TestShareModal";
import { FolderSection } from "@/components/admin/tests/FolderSection";
import { pluralize, PLURAL } from "@/lib/format";
import { FolderNameInput } from "@/components/admin/tests/FolderNameInput";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const UNFILED = "__unfiled__";
/** How long «Повернути» is offered after deleting a test. */
const UNDO_MS = 6000;
const COLLAPSED_KEY = "admin-tests-collapsed-folders"; // folder ids are unique across owners

type Buckets = Record<string, TestDoc[]>;
type DragItem = { kind: "test" | "folder"; id: string };
type DropTarget =
  | { kind: "test"; id: string; after: boolean }
  | { kind: "into"; key: string }
  | { kind: "folder"; id: string; after: boolean };

const byOrder = (a: { order?: number }, b: { order?: number }) =>
  (a.order ?? 0) - (b.order ?? 0);

function sameDrop(a: DropTarget | null, b: DropTarget | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isLowerHalf(e: React.DragEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.clientY > r.top + r.height / 2;
}

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

interface TestsManagerProps {
  /** Shown in the app header, with a live summary under it. */
  pageTitle: string;
  /** `null` = platform tests (admin); a uid = that teacher's own tests. */
  owner: TestOwner;
  /** Where the editor lives: `${basePath}/${id}`. */
  basePath: string;
}

/**
 * Tests list with folders, drag & drop, publishing and sharing. Teachers get the
 * same tool for their own tests; they publish with a description and their name.
 */
export function TestsManager({ pageTitle, owner, basePath }: TestsManagerProps) {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const personal = owner !== null;
  const authorName = personal ? userProfile?.displayName?.trim() || "Викладач" : undefined;
  const testsKey = queryKeys.tests.of(owner);
  const foldersKey = queryKeys.tests.foldersOf(owner);

  const [shareTestId, setShareTestId] = useState<string | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] =
    useState<TestFolder | null>(null);
  const [newFolder, setNewFolder] = useState<{ forTestId?: string } | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [search, setSearch] = useState("");
  /** Quick access: show one folder (or the unfiled tests) only; null = everything. */
  const [folderFilterRaw, setFolderFilter] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);

  const { data: allTests = [], isLoading: testsLoading } = useQuery({
    queryKey: testsKey,
    queryFn: () => getTests(owner),
    staleTime: STALE.medium,
  });

  // Deleting is undoable: a deleted test hides at once and is really deleted a few
  // seconds later, unless «Повернути» is pressed (no «are you sure?» step).
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  // A stable map (not state: changing it never needs a render).
  const [pendingDeletes] = useState(() => new Map<string, { timer: ReturnType<typeof setTimeout>; doc: TestDoc }>());
  const tests = useMemo(() => allTests.filter((t) => !hiddenIds.has(t.id)), [allTests, hiddenIds]);

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: foldersKey,
    queryFn: () => getTestFolders(owner),
    staleTime: STALE.medium,
  });

  // folderId → tests in display order; tests pointing at a missing folder fall back to UNFILED
  const buckets = useMemo<Buckets>(() => {
    const map: Buckets = { [UNFILED]: [] };
    folders.forEach((f) => (map[f.id] = []));
    [...tests].sort(byOrder).forEach((t) => {
      const key = t.folderId && map[t.folderId] ? t.folderId : UNFILED;
      map[key].push(t);
    });
    return map;
  }, [tests, folders]);

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const dragEnabled = !searching;

  function visibleTests(key: string, folderName?: string): TestDoc[] {
    const list = buckets[key] ?? [];
    if (!searching || folderName?.toLowerCase().includes(q)) return list;
    return list.filter(
      (t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.subtitle || "").toLowerCase().includes(q),
    );
  }

  // ── Layout persistence ─────────────────────────────────────

  /** Normalises order (folders first, then unfiled) and saves only what changed. */
  function commitLayout(nextFolders: TestFolder[], nextBuckets: Buckets) {
    const orderedFolders = nextFolders.map((f, i) => ({ ...f, order: i }));
    const prevFolderOrder = new Map(folders.map((f) => [f.id, f.order]));
    const changedFolders = orderedFolders.filter(
      (f) => prevFolderOrder.get(f.id) !== f.order,
    );

    const flat: TestDoc[] = [];
    [...orderedFolders.map((f) => f.id), UNFILED].forEach((key) =>
      nextBuckets[key]?.forEach((t) =>
        flat.push({
          ...t,
          order: flat.length,
          folderId: key === UNFILED ? null : key,
        }),
      ),
    );
    const prevTests = new Map(tests.map((t) => [t.id, t]));
    const changedTests = flat.filter((t) => {
      const p = prevTests.get(t.id);
      return !p || p.order !== t.order || (p.folderId ?? null) !== t.folderId;
    });

    queryClient.setQueryData(foldersKey, orderedFolders);
    queryClient.setQueryData(testsKey, flat);
    if (!changedFolders.length && !changedTests.length) return;

    saveTestLayout(
      changedFolders.map((f) => ({ id: f.id, order: f.order })),
      changedTests.map((t) => ({
        id: t.id,
        order: t.order!,
        folderId: t.folderId ?? null,
      })),
    )
      .then(() =>
        queryClient.invalidateQueries({ queryKey: queryKeys.tests.published }),
      )
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: testsKey });
        queryClient.invalidateQueries({ queryKey: foldersKey });
      });
  }

  function moveTest(
    testId: string,
    toKey: string,
    anchor: { id: string; after: boolean } | null,
    from: Buckets = buckets,
    nextFolders: TestFolder[] = folders,
  ) {
    const next: Buckets = Object.fromEntries(
      Object.entries(from).map(([k, v]) => [k, [...v]]),
    );
    let moving: TestDoc | undefined;
    for (const list of Object.values(next)) {
      const i = list.findIndex((t) => t.id === testId);
      if (i >= 0) [moving] = list.splice(i, 1);
    }
    const target = next[toKey];
    if (!moving || !target) return;

    let at = target.length;
    if (anchor) {
      const i = target.findIndex((t) => t.id === anchor.id);
      if (i >= 0) at = i + (anchor.after ? 1 : 0);
    }
    target.splice(at, 0, moving);
    commitLayout(nextFolders, next);
  }

  function moveFolder(folderId: string, anchorId: string, after: boolean) {
    const moving = folders.find((f) => f.id === folderId);
    if (!moving) return;
    const next = folders.filter((f) => f.id !== folderId);
    const i = next.findIndex((f) => f.id === anchorId);
    if (i < 0) return;
    next.splice(i + (after ? 1 : 0), 0, moving);
    commitLayout(next, buckets);
  }

  function setFolderExpanded(id: string, expanded: boolean) {
    setCollapsed((prev) => {
      if (prev.has(id) === !expanded) return prev;
      const next = new Set(prev);
      if (expanded) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (folderId: string | null) => {
      const order = Math.max(-1, ...tests.map((t) => t.order ?? 0)) + 1;
      return createTest(user!.uid, folderId, order, personal, authorName);
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: testsKey });
      router.push(`${basePath}/${id}`);
    },
  });

  const unhide = (id: string) =>
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  function finalizeDelete(id: string) {
    pendingDeletes.delete(id);
    deleteTest(id)
      .catch(() => toast.error("Вибачте, тест не вдалося видалити. Спробуйте ще раз"))
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: testsKey });
        queryClient.invalidateQueries({ queryKey: queryKeys.tests.published });
        unhide(id);
      });
  }

  function deleteWithUndo(test: TestDoc) {
    setHiddenIds((prev) => new Set(prev).add(test.id));
    const timer = setTimeout(() => finalizeDelete(test.id), UNDO_MS);
    pendingDeletes.set(test.id, { timer, doc: test });
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Тест «{test.title || "Без назви"}» видалено
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => {
              undoDelete(test.id);
              toast.dismiss(t.id);
            }}
          >
            Повернути
          </button>
        </span>
      ),
      { duration: UNDO_MS },
    );
  }

  function undoDelete(id: string) {
    const pending = pendingDeletes.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDeletes.delete(id);
    // A layout change meanwhile may have dropped it from the cache: put it back.
    queryClient.setQueryData<TestDoc[]>(testsKey, (prev = []) =>
      prev.some((t) => t.id === id) ? prev : [...prev, pending.doc],
    );
    unhide(id);
  }

  // Leaving the page doesn't cancel a delete: pending ones go through right away.
  useEffect(() => {
    return () => {
      for (const [id, { timer }] of pendingDeletes) {
        clearTimeout(timer);
        void deleteTest(id).catch(() => {});
      }
      pendingDeletes.clear();
    };
  }, [pendingDeletes]);

  /** Saves a field straight away (no draft here), updating the list optimistically. */
  async function patchTest(id: string, patch: Partial<TestDoc>) {
    queryClient.setQueryData<TestDoc[]>(testsKey, (prev) =>
      prev?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    await updateTest(id, patch);
    queryClient.invalidateQueries({ queryKey: testsKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.tests.published });
  }

  /** Teachers publish with a description; their name goes along to the catalog. */
  function togglePublished(test: TestDoc) {
    if (!personal) return patchTest(test.id, { published: !test.published });
    if (!test.published && !test.subtitle?.trim()) {
      toast.error("Додайте короткий опис тесту, щоб опублікувати його");
      router.push(`${basePath}/${test.id}`);
      return;
    }
    return patchTest(test.id, { published: !test.published, authorName }).catch(() => {
      toast.error("Вибачте, публікацію не вдалося змінити. Спробуйте ще раз");
      queryClient.invalidateQueries({ queryKey: testsKey });
    });
  }

  const shareTest = tests.find((t) => t.id === shareTestId);

  async function handleCreateFolder(name: string) {
    const forTestId = newFolder?.forTestId;
    setNewFolder(null);
    const order = folders.length;
    const id = await createTestFolder(name, order, owner);
    const nextFolders = [...folders, { id, name, order, createdAt: null }];
    queryClient.setQueryData(foldersKey, nextFolders);
    setFolderExpanded(id, true);
    if (forTestId) {
      moveTest(forTestId, id, null, { ...buckets, [id]: [] }, nextFolders);
    }
  }

  async function handleRenameFolder(id: string, name: string) {
    setRenamingId(null);
    queryClient.setQueryData<TestFolder[]>(
      foldersKey,
      (prev = []) => prev.map((f) => (f.id === id ? { ...f, name } : f)),
    );
    await renameTestFolder(id, name).catch(() =>
      queryClient.invalidateQueries({ queryKey: foldersKey }),
    );
  }

  async function handleDeleteFolder() {
    const folder = confirmDeleteFolder;
    setConfirmDeleteFolder(null);
    if (!folder) return;
    const ids = (buckets[folder.id] ?? []).map((t) => t.id);
    queryClient.setQueryData<TestFolder[]>(
      foldersKey,
      (prev = []) => prev.filter((f) => f.id !== folder.id),
    );
    await deleteTestFolder(folder.id, ids).finally(() => {
      queryClient.invalidateQueries({ queryKey: testsKey });
      queryClient.invalidateQueries({ queryKey: foldersKey });
    });
  }


  // ── Drag & drop ────────────────────────────────────────────

  function startDrag(e: React.DragEvent, item: DragItem) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    setDrag(item);
  }

  function endDrag() {
    setDrag(null);
    setDrop(null);
  }

  function updateDrop(target: DropTarget | null) {
    setDrop((prev) => (sameDrop(prev, target) ? prev : target));
  }

  function onTestDragOver(e: React.DragEvent, testId: string) {
    if (drag?.kind !== "test") return;
    e.preventDefault();
    e.stopPropagation();
    updateDrop(
      drag.id === testId
        ? null
        : { kind: "test", id: testId, after: isLowerHalf(e) },
    );
  }

  function onFolderHeaderDragOver(e: React.DragEvent, folderId: string) {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    if (drag.kind === "test") updateDrop({ kind: "into", key: folderId });
    else
      updateDrop(
        drag.id === folderId
          ? null
          : { kind: "folder", id: folderId, after: isLowerHalf(e) },
      );
  }

  function onAreaDragOver(e: React.DragEvent, key: string) {
    if (!drag) return;
    e.preventDefault();
    if (drag.kind === "test") updateDrop({ kind: "into", key });
    else if (key !== UNFILED && drag.id !== key)
      updateDrop({ kind: "folder", id: key, after: true });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const d = drag;
    const t = drop;
    endDrag();
    if (!d || !t) return;

    if (d.kind === "test") {
      const fromKey =
        Object.keys(buckets).find((k) =>
          buckets[k].some((x) => x.id === d.id),
        ) ?? UNFILED;
      if (t.kind === "test") {
        const toKey =
          Object.keys(buckets).find((k) =>
            buckets[k].some((x) => x.id === t.id),
          ) ?? UNFILED;
        moveTest(d.id, toKey, { id: t.id, after: t.after });
      } else if (t.kind === "into" && t.key !== fromKey) {
        moveTest(d.id, t.key, null);
      }
    } else if (t.kind === "folder") {
      moveFolder(d.id, t.id, t.after);
    }
  }

  // Hovering a test over a collapsed folder opens it after a short pause.
  const hoverIntoKey = drop?.kind === "into" ? drop.key : null;
  useEffect(() => {
    if (
      !hoverIntoKey ||
      hoverIntoKey === UNFILED ||
      !collapsed.has(hoverIntoKey)
    )
      return;
    const timer = setTimeout(() => setFolderExpanded(hoverIntoKey, true), 650);
    return () => clearTimeout(timer);
  }, [hoverIntoKey, collapsed]);

  // ── Render ─────────────────────────────────────────────────

  function renderTests(key: string, list: TestDoc[]) {
    const full = buckets[key] ?? [];
    return list.map((test) => {
      const i = full.findIndex((t) => t.id === test.id);
      const indicator =
        drop?.kind === "test" && drop.id === test.id
          ? drop.after
            ? "after"
            : "before"
          : null;
      return (
        <TestRow
          key={test.id}
          test={test}
          index={i}
          total={full.length}
          folders={folders}
          currentFolderId={key === UNFILED ? null : key}
          draggable={dragEnabled}
          isDragSrc={drag?.kind === "test" && drag.id === test.id}
          dropIndicator={indicator}
          highlight={search}
          deleting={false}
          onDragStart={(e) => startDrag(e, { kind: "test", id: test.id })}
          onDragOver={(e) => onTestDragOver(e, test.id)}
          onDrop={handleDrop}
          onDragEnd={endDrag}
          onMoveUp={() =>
            i > 0 &&
            moveTest(test.id, key, { id: full[i - 1].id, after: false })
          }
          onMoveDown={() =>
            i < full.length - 1 &&
            moveTest(test.id, key, { id: full[i + 1].id, after: true })
          }
          onTogglePublished={() => togglePublished(test)}
          onShare={() => setShareTestId(test.id)}
          onEdit={() => router.push(`${basePath}/${test.id}`)}
          onDelete={() => deleteWithUndo(test)}
          onMoveTo={(folderId) => {
            moveTest(test.id, folderId ?? UNFILED, null);
            if (folderId) setFolderExpanded(folderId, true);
          }}
          onMoveToNewFolder={() => setNewFolder({ forTestId: test.id })}
        />
      );
    });
  }

  const isLoading = testsLoading || foldersLoading;
  // Header: what is here, at a glance, instead of a generic «Управління тестами».
  const publishedTotal = tests.filter((t) => t.published).length;
  usePageHeader(
    pageTitle,
    isLoading
      ? ""
      : `${pluralize(tests.length, PLURAL.test)} · опубліковано ${publishedTotal}`,
  );
  const hasFolders = folders.length > 0;
  // A deleted folder can't stay picked.
  const folderFilter =
    folderFilterRaw && (folderFilterRaw === UNFILED || folders.some((f) => f.id === folderFilterRaw))
      ? folderFilterRaw
      : null;
  const showUnfiled = !folderFilter || folderFilter === UNFILED;
  const unfiled = showUnfiled ? visibleTests(UNFILED) : [];
  const visibleFolders = folders
    .filter((f) => !folderFilter || f.id === folderFilter)
    .map((f) => ({ folder: f, list: visibleTests(f.id, f.name) }))
    .filter(
      ({ folder, list }) =>
        !searching || list.length > 0 || folder.name.toLowerCase().includes(q),
    );
  const nothingFound =
    searching && unfiled.length === 0 && visibleFolders.length === 0;
  const draggingTestFromFolder =
    drag?.kind === "test" && !buckets[UNFILED].some((t) => t.id === drag.id);

  /** «Усі», each folder, «Без папки»: chips in a row, or a list in the side column. */
  function folderNav(vertical: boolean) {
    return (
      <>
        <FolderChip vertical={vertical} active={!folderFilter} onClick={() => setFolderFilter(null)} count={tests.length}>
          {vertical ? "Усі тести" : "Усі"}
        </FolderChip>
        {folders.map((f) => (
          <FolderChip
            key={f.id}
            vertical={vertical}
            active={folderFilter === f.id}
            onClick={() => setFolderFilter(folderFilter === f.id ? null : f.id)}
            count={buckets[f.id]?.length ?? 0}
            icon
          >
            {f.name}
          </FolderChip>
        ))}
        {buckets[UNFILED].length > 0 && (
          <FolderChip
            vertical={vertical}
            active={folderFilter === UNFILED}
            onClick={() => setFolderFilter(folderFilter === UNFILED ? null : UNFILED)}
            count={buckets[UNFILED].length}
          >
            Без папки
          </FolderChip>
        )}
      </>
    );
  }

  return (
    // Wide screens: folders in a side column (like a file manager), tests on the right.
    // Wide screens: exactly the window's height; the folder column and the tests scroll on
    // their own, everything else stays put. Narrow: the page scrolls, the toolbar sticks.
    <div className="max-w-6xl lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6 lg:h-[calc(100dvh-var(--app-header-h)-3rem-var(--tabs-h,0px))]">
      {!isLoading && (
        <aside
          aria-label="Папки"
          className="hidden lg:flex flex-col gap-1 min-h-0 pt-2"
        >
          <p className="px-3 pb-1 text-[13px] font-semibold text-muted-foreground">
            Папки
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 -mx-1 px-1">
            {folderNav(true)}
          </div>
          <button
            onClick={() => setNewFolder({})}
            className="mt-2 flex items-center gap-2 h-10 px-3 rounded-[12px] text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <FolderPlus size={16} /> Нова папка
          </button>
        </aside>
      )}

    <div className="min-w-0 flex flex-col lg:min-h-0">
      {/* Toolbar (and the folder chips on narrow screens): stays put; only the tests scroll. */}
      <div className="sticky lg:static top-[calc(var(--app-header-h)+var(--tabs-h,0px))] z-20 py-2 space-y-2 bg-background lg:bg-transparent -mx-4 md:-mx-6 px-4 md:px-6 lg:mx-0 lg:px-0">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук тестів і папок"
          wrapperClassName="flex-1 min-w-48"
        />
        <button
          onClick={() => setNewFolder({})}
          className="lg:hidden flex items-center gap-1.5 h-10 pointer-coarse:h-11 px-4 rounded-full border border-glass-edge bg-glass shadow-pill text-sm font-semibold hover:bg-glass-strong transition-colors"
        >
          <FolderPlus size={15} />
          Нова папка
        </button>
        <button
          onClick={() =>
            user && createMutation.mutate(folderFilter && folderFilter !== UNFILED ? folderFilter : null)
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 h-10 pointer-coarse:h-11 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-pill-dark hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus size={15} />
          {createMutation.isPending ? "Створення..." : "Новий тест"}
        </button>
      </div>

      {/* Quick access to folders (narrow screens): one tap shows just that folder, opened. */}
      {!isLoading && hasFolders && <FolderStrip>{folderNav(false)}</FolderStrip>}
      </div>

      <div className="pt-1 pb-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:-mx-2 lg:px-2">
      {isLoading ? (
        <SpinnerPage />
      ) : tests.length === 0 && !hasFolders && !newFolder ? (
        <EmptyState
          emoji="📝"
          title="Тестів ще немає"
          description="Натисніть «Новий тест» угорі — і почніть додавати завдання."
        />
      ) : nothingFound ? (
        <EmptyState
          emoji="🔍"
          title="Нічого не знайдено"
          description={`За запитом «${search.trim()}»`}
        />
      ) : (
        <div className="space-y-2">
          {visibleFolders.map(({ folder, list }) => {
            const all = buckets[folder.id] ?? [];
            const folderDrop =
              drop?.kind === "folder" && drop.id === folder.id
                ? drop.after
                  ? "after"
                  : "before"
                : null;
            return (
              <FolderSection
                key={folder.id}
                name={folder.name}
                highlight={search}
                count={all.length}
                publishedCount={all.filter((t) => t.published).length}
                expanded={searching || folderFilter === folder.id || !collapsed.has(folder.id)}
                renaming={renamingId === folder.id}
                draggable={dragEnabled}
                isDragSrc={drag?.kind === "folder" && drag.id === folder.id}
                isDropInto={drop?.kind === "into" && drop.key === folder.id}
                dropIndicator={folderDrop}
                creatingTest={createMutation.isPending}
                onToggle={() =>
                  setFolderExpanded(folder.id, collapsed.has(folder.id))
                }
                onRenameStart={() => setRenamingId(folder.id)}
                onRename={(name) => handleRenameFolder(folder.id, name)}
                onRenameCancel={() => setRenamingId(null)}
                onAddTest={() => user && createMutation.mutate(folder.id)}
                onDelete={() => setConfirmDeleteFolder(folder)}
                onHeaderDragStart={(e) =>
                  startDrag(e, { kind: "folder", id: folder.id })
                }
                onHeaderDragOver={(e) => onFolderHeaderDragOver(e, folder.id)}
                onBodyDragOver={(e) => onAreaDragOver(e, folder.id)}
                onDrop={handleDrop}
                onDragEnd={endDrag}
              >
                {renderTests(folder.id, list)}
              </FolderSection>
            );
          })}

          {newFolder && (
            <div className="rounded-2xl border border-primary/40 bg-card px-4 py-3 flex items-center gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <Folder size={16} />
              </div>
              <div className="flex-1 min-w-0 pl-2">
                <FolderNameInput
                  onSubmit={handleCreateFolder}
                  onCancel={() => setNewFolder(null)}
                />
              </div>
              <span className="hidden sm:block text-[11px] text-muted-foreground shrink-0">
                Enter — зберегти · Esc — скасувати
              </span>
            </div>
          )}

          {/* Tests outside any folder */}
          {showUnfiled && (unfiled.length > 0 || draggingTestFromFolder || folderFilter === UNFILED) && (
            <div
              className={cn("space-y-2", hasFolders && "pt-3")}
              onDragOver={(e) => onAreaDragOver(e, UNFILED)}
              onDrop={handleDrop}
            >
              {hasFolders && (
                <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <Inbox size={13} />
                  <span>Без папки</span>
                  <span className="text-muted-foreground/60">
                    · {pluralize(buckets[UNFILED].length, PLURAL.test)}
                  </span>
                  <div className="flex-1 h-px bg-border/50 ml-1" />
                </div>
              )}
              {unfiled.length === 0 ? (
                <div
                  className={cn(
                    "rounded-2xl border border-dashed py-6 text-center text-xs transition-colors",
                    drop?.kind === "into" && drop.key === UNFILED
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-border/50 text-muted-foreground",
                  )}
                >
                  Перетягніть сюди, щоб вийняти тест з папки
                </div>
              ) : (
                renderTests(UNFILED, unfiled)
              )}
            </div>
          )}
        </div>
      )}

      </div>
    </div>

      {shareTest && (
        <TestShareModal
          open
          onClose={() => setShareTestId(null)}
          testId={shareTest.id}
          title={shareTest.title}
          published={shareTest.published}
          linkAccess={getLinkAccess(shareTest)}
          onLinkAccessChange={(v) => patchTest(shareTest.id, { linkAccess: v })}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteFolder !== null}
        title={`Видалити папку «${confirmDeleteFolder?.name ?? ""}»?`}
        description="Тести з неї лишаться — у «Без папки»."
        confirmLabel="Видалити папку"
        onConfirm={handleDeleteFolder}
        onCancel={() => setConfirmDeleteFolder(null)}
      />
    </div>
  );
}

function FolderChip({
  active,
  onClick,
  count,
  icon,
  vertical,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  icon?: boolean;
  /** A row of the side column instead of a chip. */
  vertical?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={typeof children === "string" ? children : undefined}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap transition-colors",
        vertical
          ? "w-full h-10 px-3 rounded-[12px]"
          : "shrink-0 gap-1.5 h-9 pointer-coarse:h-10 px-3.5 rounded-full border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : vertical
            ? "text-foreground/80 hover:bg-muted/60"
            : "bg-card border-border/50 text-foreground/80 hover:bg-muted",
      )}
    >
      {icon && <Folder size={15} className={cn("shrink-0", active ? "opacity-80" : "text-primary")} />}
      <span className={cn("truncate", vertical ? "flex-1 min-w-0 text-left" : "max-w-48")}>{children}</span>
      <span className={cn("shrink-0 text-xs tabular-nums", active ? "opacity-70" : "text-muted-foreground")}>
        {count}
      </span>
    </button>
  );
}

/**
 * A sideways row without a scrollbar: the mouse wheel scrolls it sideways, and a soft fade
 * on an edge shows there is more beyond it.
 */
function FolderStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    // A vertical wheel turn moves the row sideways (non-passive: it replaces the page scroll).
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, []);

  const mask = `linear-gradient(to right, ${edges.left ? "transparent 0, black 2.5rem" : "black 0"}, ${
    edges.right ? "black calc(100% - 2.5rem), transparent 100%" : "black 100%"
  })`;

  return (
    <nav
      ref={ref}
      aria-label="Папки"
      className="lg:hidden -mx-1 px-1 py-0.5 flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </nav>
  );
}
