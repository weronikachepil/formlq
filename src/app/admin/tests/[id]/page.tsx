"use client";

import { useParams } from "next/navigation";
import { TestEditor } from "@/components/admin/test-editor/TestEditor";

export default function TestEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <TestEditor id={id} backHref="/admin/tests" />;
}
