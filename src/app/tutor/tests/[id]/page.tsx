"use client";

import { useParams } from "next/navigation";
import { TestEditor } from "@/components/admin/test-editor/TestEditor";

/** Editor for a teacher's own test (firestore.rules let them open only their own). */
export default function TutorTestEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <TestEditor id={id} backHref="/tutor/tests" personal />;
}
