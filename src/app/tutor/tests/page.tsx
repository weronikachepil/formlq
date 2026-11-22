"use client";

import { useAuth } from "@/context/AuthContext";
import { TestsManager } from "@/components/admin/tests/TestsManager";
import { SpinnerPage } from "@/components/ui/spinner";

/** A teacher's own tests — only theirs (firestore.rules), never in the public catalog. */
export default function TutorTestsPage() {
  const { user } = useAuth();
  if (!user) return <SpinnerPage />;
  return <TestsManager pageTitle="Мої тести" owner={user.uid} basePath="/tutor/tests" />;
}
