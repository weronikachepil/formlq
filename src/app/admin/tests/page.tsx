"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="max-w-5xl mx-auto" style={{ "--tabs-h": "3.5rem" } as React.CSSProperties}>
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
      </div>
      {tab === "platform" ? (
        <TestsManager pageTitle="Тести" owner={null} basePath="/admin/tests" />
      ) : (
        <TeacherTestsList />
      )}
    </div>
  );
}
