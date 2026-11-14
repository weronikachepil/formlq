"use client";

import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { TestsManager } from "@/components/admin/tests/TestsManager";
import { SpinnerPage } from "@/components/ui/spinner";

/** A teacher's own tests — only theirs (firestore.rules), never in the public catalog. */
export default function TutorTestsPage() {
  const { user } = useAuth();
  usePageHeader("Мої тести");
  if (!user) return <SpinnerPage />;
  return <TestsManager owner={user.uid} basePath="/tutor/tests" />;
}
