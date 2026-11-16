"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TestsManager } from "@/components/admin/tests/TestsManager";
import { TeacherTestsList } from "@/components/admin/tests/TeacherTestsList";
import { SegmentedControl } from "@/components/admin/test-editor/primitives";

type Tab = "platform" | "teachers";

export default function AdminTestsPage() {
  // `?tab=teachers` comes back from a teacher's test page.
  const initial = useSearchParams().get("tab") === "teachers" ? "teachers" : "platform";
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "platform", label: "Мої тести" },
          { value: "teachers", label: "Тести викладачів" },
        ]}
      />
      {tab === "platform" ? (
        <TestsManager owner={null} basePath="/admin/tests" />
      ) : (
        <TeacherTestsList />
      )}
    </div>
  );
}
