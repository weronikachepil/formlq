"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { usePageHeader } from "@/context/HeaderContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { subscribeStudentHomework, Homework } from "@/lib/tutor";
import { getUserResults, type TestResult } from "@/lib/tests";
import { useNow } from "@/components/calendar/tutor/useNow";
import { SpinnerPage } from "@/components/ui/spinner";
import { StudentHomeworkCabinet } from "@/components/homework/StudentHomeworkCabinet";

export default function StudentHomeworkPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Homework[] | null>(null);
  const now = useNow();

  usePageHeader("Домашні завдання", "Завдання від ваших вчителів");

  useEffect(() => {
    if (!user) return;
    return subscribeStudentHomework(user.uid, setList);
  }, [user]);

  // Scores of completed homework: one query for all the student's results — the
  // same cached list as the history page — instead of a read per homework.
  const hasCompleted = !!list?.some((h) => h.status === "completed" && h.resultId);
  const { data: results = [] } = useQuery({
    queryKey: queryKeys.results(user?.uid),
    queryFn: () => getUserResults(user!.uid),
    enabled: !!user && hasCompleted,
    staleTime: STALE.short,
  });
  const byId = useMemo(() => new Map<string, TestResult>(results.map((r) => [r.id, r])), [results]);

  if (!list) return <SpinnerPage />;
  return <StudentHomeworkCabinet homework={list} results={byId} now={now} />;
}
