"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { recountTestTakers } from "@/lib/tests";
import { queryKeys } from "@/lib/queryKeys";
import { pluralize, PLURAL } from "@/lib/format";
import { TestsManager } from "@/components/admin/tests/TestsManager";
import { TeacherTestsList } from "@/components/admin/tests/TeacherTestsList";
import { SegmentedControl } from "@/components/admin/test-editor/primitives";

type Tab = "platform" | "teachers";

export default function AdminTestsPage() {
  const router = useRouter();
  // The tab lives in the address (`?tab=teachers`): what is shown always matches the URL,
  // and «back» from a teacher's test returns to that tab.
  const tab: Tab = useSearchParams().get("tab") === "teachers" ? "teachers" : "platform";
  const setTab = (t: Tab) =>
    router.replace(t === "teachers" ? "/admin/tests?tab=teachers" : "/admin/tests", { scroll: false });

  return (
    // --tabs-h: the sticky toolbars and folder column below sit under these tabs.
    <div className="max-w-6xl" style={{ "--tabs-h": "3.5rem" } as React.CSSProperties}>
      {/* Narrow screens: sticks under the header. Wide: the lists below scroll inside, so it stays anyway. */}
      <div className="sticky lg:static top-[var(--app-header-h)] z-30 h-[var(--tabs-h)] flex items-center bg-background lg:bg-transparent -mx-4 md:-mx-6 px-4 md:px-6 lg:mx-0 lg:px-0">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "platform", label: "Тести платформи" },
            { value: "teachers", label: "Тести викладачів" },
          ]}
        />
        <RecountTakers />
      </div>
      {tab === "platform" ? (
        <TestsManager pageTitle="Тести" owner={null} basePath="/admin/tests" />
      ) : (
        <TeacherTestsList />
      )}
    </div>
  );
}

/**
 * The catalog shows how many people finished each test. Results saved before that counter
 * existed are counted here, once (the counter then keeps itself up to date).
 */
function RecountTakers() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title="Порахувати, скільки людей пройшли кожен тест, з урахуванням давніших результатів"
      className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60 rounded-[8px] px-2.5 py-1.5 hover:bg-muted transition-colors"
      onClick={async () => {
        setBusy(true);
        try {
          const r = await recountTestTakers();
          queryClient.invalidateQueries({ queryKey: queryKeys.tests.published });
          toast.success(`Пораховано: ${pluralize(r.tests, PLURAL.test)}, ${pluralize(r.people, ["людина", "людини", "людей"])}`);
        } catch {
          toast.error("Не вдалося перерахувати. Спробуйте ще раз");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Рахую…" : "Перерахувати проходження"}
    </button>
  );
}
