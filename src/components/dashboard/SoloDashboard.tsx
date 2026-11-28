"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowRight, Plus, Presentation, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { getPublishedTests, getUserResults, isExamFailed, maxScaledScore, type TestResult } from "@/lib/tests";
import {
  boardErrorMessage,
  createBoard,
  subscribeOwnerBoards,
  DEFAULT_BOARD_TITLE,
  type Board,
} from "@/lib/boards";
import { pluralize, PLURAL, scoreColor, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TestCard, bestByTest } from "@/components/tests/TestCard";
import { SectionLabel } from "@/components/ui/section-label";

/** Four, so the two-column grid is an even 2 × 2. */
const RECOMMENDED = 4;
const RECENT_BOARDS = 3;

/** Own attempts at catalog tests (homework attempts aren't part of self-study). */
function useSelfResults(uid: string) {
  return useQuery({
    queryKey: queryKeys.results(uid),
    queryFn: () => getUserResults(uid),
    staleTime: STALE.short,
    select: (all: TestResult[]) => all.filter((r) => !r.homeworkId),
  });
}

/** Main column for a student learning on their own: progress + what to take next. */
export function SoloOverview({ userId }: { userId: string }) {
  const { data: results } = useSelfResults(userId);
  const { data: tests } = useQuery({
    queryKey: queryKeys.tests.published,
    queryFn: getPublishedTests,
    staleTime: STALE.long,
  });

  const best = useMemo(() => bestByTest(results ?? []), [results]);
  const stats = useMemo(() => {
    const list = results ?? [];
    // Below-threshold attempts carry the scale's 100 but don't count.
    const nmt = list.filter((r) => (r.scaleType ?? "nmt") === "nmt" && !isExamFailed(r.rawScore, "nmt"));
    const last = [...list].sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0))[0];
    return {
      attempts: list.length,
      tests: new Set(list.map((r) => r.testId)).size,
      bestNmt: nmt.length ? Math.max(...nmt.map((r) => r.nmtScore)) : null,
      last,
    };
  }, [results]);

  // Not yet taken first, the platform's own order; then teachers' tests.
  const next = useMemo(() => {
    const list = (tests ?? []).filter((t) => !best.has(t.id));
    return [...list.filter((t) => !t.personal), ...list.filter((t) => t.personal)].slice(0, RECOMMENDED);
  }, [tests, best]);

  const loading = !results || !tests;

  return (
    <>
      <section className="rounded-[18px] border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Твій прогрес</SectionLabel>
          {stats.attempts > 0 && (
            <Link
              href="/dashboard/history"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Історія <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
        ) : stats.attempts === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Trophy size={20} />
            </div>
            <p className="flex-1 text-sm text-muted-foreground">
              Ще жодного тесту. Почни з пробного НМТ — побачиш свій бал і розбір помилок.
            </p>
            {next[0] && (
              <Link
                href={`/dashboard/exam/${next[0].id}`}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Почати <ArrowRight size={15} />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="Пройдено" value={pluralize(stats.tests, PLURAL.test)} />
            <Tile label="Спроб" value={String(stats.attempts)} />
            <Tile
              label="Найкращий бал"
              value={stats.bestNmt === null ? "—" : String(stats.bestNmt)}
              className={stats.bestNmt === null ? undefined : scoreColor(stats.bestNmt).text}
            />
            {stats.last && (
              <Link href={`/dashboard/results/${stats.last.id}`} className="rounded-xl bg-muted/70 px-3 py-2.5 hover:bg-muted transition-colors min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Останній</p>
                <p className="text-sm font-semibold truncate">{stats.last.testTitle}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {isExamFailed(stats.last.rawScore, stats.last.scaleType ?? "nmt")
                    ? "не зараховано"
                    : (stats.last.scaleType ?? "nmt") === "nmt"
                    ? `${stats.last.nmtScore} / ${maxScaledScore(stats.last.scoreTable) || 200}`
                    : `${stats.last.rawScore} / ${stats.last.maxRaw}`}
                  {stats.last.completedAt && ` · ${timeAgo(stats.last.completedAt.toDate())}`}
                </p>
              </Link>
            )}
          </div>
        )}
      </section>

      {next.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-semibold text-base">Що пройти далі</h2>
            <Link
              href="/dashboard/tests"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Усі тести <ArrowRight size={13} />
            </Link>
          </div>
          {/* Next to the sidebar and the right column, two cards per row is what fits. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {next.map((t) => (
              <TestCard key={t.id} test={t} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/70 px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={cn("font-heading font-bold text-xl leading-tight tabular-nums truncate", className)}>{value}</p>
    </div>
  );
}

/** Right column: own boards for drafts and solutions. */
export function SoloBoardsCard({ userId }: { userId: string }) {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => subscribeOwnerBoards(userId, setBoards, () => setBoards([])), [userId]);

  async function create() {
    setCreating(true);
    try {
      const id = await createBoard(userId, userProfile?.displayName || "Учень", DEFAULT_BOARD_TITLE);
      router.push(`/board/${id}`);
    } catch (e) {
      toast.error(boardErrorMessage(e, "Не вдалося створити дошку"));
      setCreating(false);
    }
  }

  return (
    <section className="rounded-[18px] border border-border/50 bg-card p-4 space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold text-base">Мої дошки</h2>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus size={13} /> {creating ? "Створюю…" : "Нова"}
        </button>
      </div>

      {boards === null ? (
        <div className="h-11 rounded-xl bg-muted/60 animate-pulse" />
      ) : boards.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-3">
          Дошка для чернеток і розвʼязків — малюй, пиши формули, ділися посиланням.
        </p>
      ) : (
        <ul className="space-y-0.5 -mx-1">
          {boards.slice(0, RECENT_BOARDS).map((b) => (
            <li key={b.id}>
              <Link
                href={`/board/${b.id}`}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-glass-strong transition-colors"
              >
                <Presentation size={15} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{b.title}</span>
                {b.updatedAt && (
                  <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(b.updatedAt.toDate())}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/dashboard/boards"
        className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-glass-strong transition-colors"
      >
        Усі дошки <ArrowRight size={13} />
      </Link>
    </section>
  );
}
