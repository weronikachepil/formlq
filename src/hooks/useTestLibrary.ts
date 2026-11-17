"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { isEditor } from "@/lib/roles";
import { getPublishedTests, getTestFolders, getTests, type TestDoc, type TestFolder } from "@/lib/tests";

/** A run of tests under one heading: a folder (own tests) or an author (catalog). */
export interface TestGroup {
  key: string;
  name: string;
  tests: TestDoc[];
}

const hasQuestions = (t: TestDoc) => (t.questions?.length ?? 0) > 0;
const byOrder = (a: TestDoc, b: TestDoc) => (a.order ?? 0) - (b.order ?? 0);

/**
 * Tests a teacher can give out: their own (the platform's for editors) with their folders,
 * and the published catalog without those. Only tests that have questions.
 */
export function useTestLibrary({ catalog = true }: { catalog?: boolean } = {}) {
  const { user, userProfile } = useAuth();
  const editor = isEditor(userProfile?.role);
  // Same source as homework: a teacher's own tests, or the platform's for editors.
  const owner = editor ? null : (user?.uid ?? null);
  const ready = !!user && !!userProfile;

  const mineQ = useQuery({
    queryKey: queryKeys.tests.of(owner),
    queryFn: () => getTests(owner),
    enabled: ready,
    staleTime: STALE.long,
  });
  const foldersQ = useQuery({
    queryKey: queryKeys.tests.foldersOf(owner),
    queryFn: () => getTestFolders(owner),
    enabled: ready,
    staleTime: STALE.long,
  });
  const catalogQ = useQuery({
    queryKey: queryKeys.tests.published,
    queryFn: getPublishedTests,
    enabled: ready && catalog,
    staleTime: STALE.long,
  });

  const mine = useMemo(() => (mineQ.data ?? []).filter(hasQuestions).sort(byOrder), [mineQ.data]);
  const folders = useMemo<TestFolder[]>(() => foldersQ.data ?? [], [foldersQ.data]);
  const published = useMemo(
    () =>
      (catalogQ.data ?? [])
        .filter(hasQuestions)
        // Without what is already under «Мої»: an editor's are the platform's, a teacher's are theirs.
        .filter((t) => (editor ? t.personal : t.createdBy !== user?.uid))
        .sort(byOrder),
    [catalogQ.data, editor, user?.uid],
  );

  /** Own tests by folder (folder order), tests without a folder last. */
  const mineGroups = useMemo<TestGroup[]>(() => {
    const ids = new Set(folders.map((f) => f.id));
    const groups = folders.map((f) => ({ key: f.id, name: f.name, tests: mine.filter((t) => t.folderId === f.id) }));
    groups.push({ key: "none", name: "Без папки", tests: mine.filter((t) => !t.folderId || !ids.has(t.folderId)) });
    return groups.filter((g) => g.tests.length);
  }, [mine, folders]);

  /** Catalog by author: formlq's own first, then teachers by name. */
  const catalogGroups = useMemo<TestGroup[]>(() => {
    const map = new Map<string, TestGroup>();
    for (const t of published) {
      const name = t.personal ? t.authorName || "Викладач" : "formlq";
      const key = t.personal ? `author:${t.createdBy}` : "formlq";
      if (!map.has(key)) map.set(key, { key, name, tests: [] });
      map.get(key)!.tests.push(t);
    }
    return [...map.values()].sort(
      (a, b) => Number(b.key === "formlq") - Number(a.key === "formlq") || a.name.localeCompare(b.name, "uk"),
    );
  }, [published]);

  return {
    editor,
    mine,
    mineGroups,
    published,
    catalogGroups,
    mineLoading: mineQ.isLoading,
    mineError: mineQ.isError,
    catalogLoading: catalogQ.isLoading,
    catalogError: catalogQ.isError,
  };
}
