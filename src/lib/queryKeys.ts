/**
 * Single source of truth for React Query keys.
 * Use these everywhere (useQuery / invalidateQueries / setQueryData) so the
 * same data is never cached under two different keys.
 */
export const queryKeys = {
  tests: {
    /** Platform tests; teachers' lists live under it, so invalidating it refreshes all. */
    all: ["all-tests"] as const,
    published: ["published-tests"] as const,
    /** All teachers' tests (admin moderation); under `all` so test edits refresh it. */
    teachers: ["all-tests", "__teachers__"] as const,
    folders: ["test-folders"] as const,
    /** Tests of one owner (`null` = platform), see `TestOwner`. */
    of: (owner: string | null) => (owner ? (["all-tests", owner] as const) : (["all-tests"] as const)),
    foldersOf: (owner: string | null) =>
      owner ? (["test-folders", owner] as const) : (["test-folders"] as const),
  },
  bankQuestions: ["bank-questions"] as const,
  tips: ["tips"] as const,
  user: (uid: string | undefined) => ["user", uid] as const,
  allTutors: ["all-tutors"] as const,
  results: (uid: string | undefined) => ["results", uid] as const,
  studentHomework: (uid: string | undefined) => ["student-homework", uid] as const,
  studentTutors: (uid: string | undefined) => ["student-tutors", uid] as const,
  tutorStudents: (uid: string | undefined) => ["tutor-students", uid] as const,
  dailyQuestion: (uid: string | undefined, day: string) =>
    ["daily-question", uid, day] as const,
};

/** Shared staleTime presets (ms). */
export const STALE = {
  short: 60 * 1000,
  medium: 2 * 60 * 1000,
  long: 5 * 60 * 1000,
} as const;
