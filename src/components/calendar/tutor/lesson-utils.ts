import { Lesson, lessonEndMs, lessonStatus } from "@/lib/lessons";
import { formatDayMonth, formatHm } from "@/lib/calendar";

/**
 * Another lesson whose time intersects [startMs, endMs). Cancelled lessons free
 * their slot, so they never conflict.
 */
export function findConflict(
  all: Lesson[],
  startMs: number,
  endMs: number,
  exclude: Set<string>,
): Lesson | null {
  return (
    all.find(
      (l) =>
        !exclude.has(l.id) &&
        lessonStatus(l) !== "canceled" &&
        startMs < lessonEndMs(l) &&
        l.start.toMillis() < endMs,
    ) ?? null
  );
}

/** "Цей час уже зайнятий уроком з Олею (14 листопада, 16:00)" */
export function conflictMessage(c: Lesson): string {
  const d = c.start.toDate();
  return `Цей час уже зайнятий уроком з ${c.studentName ?? "іншим учнем"} (${formatDayMonth(d)}, ${formatHm(d)})`;
}

/** Lessons that start inside [fromMs, toMs). */
export function lessonsInRange(all: Lesson[], fromMs: number, toMs: number): Lesson[] {
  return all.filter((l) => {
    const s = l.start.toMillis();
    return s >= fromMs && s < toMs;
  });
}

/** Price of the student's most recent priced lesson, to prefill a new one. */
export function lastPriceFor(all: Lesson[], studentId: string): number | undefined {
  let best: Lesson | undefined;
  for (const l of all) {
    if (l.studentId !== studentId || l.price === undefined) continue;
    if (!best || l.start.toMillis() > best.start.toMillis()) best = l;
  }
  return best?.price;
}

/** Past lesson whose status was never set. */
export function needsStatus(l: Lesson, now: number): boolean {
  return lessonStatus(l) === "planned" && lessonEndMs(l) < now;
}
