"use client";

import { useAuth } from "@/context/AuthContext";
import { TestsManager } from "@/components/admin/tests/TestsManager";
import { SpinnerPage } from "@/components/ui/spinner";
import { AdventGiftTestsCard } from "@/components/advent/AdventGiftTests";

/** A teacher's own tests — only theirs (firestore.rules), never in the public catalog. */
export default function TutorTestsPage() {
  const { user } = useAuth();
  if (!user) return <SpinnerPage />;
  return (
    <div className="space-y-6">
      <AdventGiftTestsCard />
      <TestsManager pageTitle="Мої тести" owner={user.uid} basePath="/tutor/tests" />
    </div>
  );
}
