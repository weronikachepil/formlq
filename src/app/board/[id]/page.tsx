"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getBoard, recordBoardVisit, userColor, type Board } from "@/lib/boards";
import { withNext } from "@/lib/utils";
import { SpinnerScreen } from "@/components/ui/spinner";
import { BoardTopBar } from "@/components/boards/BoardTopBar";
import { VersionsDialog } from "@/components/boards/VersionsDialog";
import { boardFonts } from "@/components/board/fonts";
import "@/components/board/board.css";

// The canvas engine only runs in the browser.
const BoardCanvas = dynamic(() => import("@/components/board/BoardCanvas").then((m) => ({ default: m.BoardCanvas })), {
  ssr: false,
  loading: () => <SpinnerScreen />,
});

/**
 * Live whiteboard. The owner (a tutor) gets permission / version / share controls;
 * any other signed-in user who has the link joins as a student.
 */
export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [versionsOpen, setVersionsOpen] = useState(false);
  // Bumped after a version restore to remount the board with fresh state.
  const [mount, setMount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace(withNext("/login", pathname));
  }, [authLoading, user, router, pathname]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getBoard(id)
      .then((b) => {
        if (!alive) return;
        setBoard(b);
        setState(b ? "ready" : "missing");
        // Someone else's board: remember it in this user's «Дошки».
        if (b && b.ownerId !== user.uid) recordBoardVisit(user.uid, b).catch(() => {});
      })
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, [id, user]);

  if (authLoading || !user || state === "loading") return <SpinnerScreen />;

  if (state === "missing" || !board) {
    return (
      <div className={"mathboard mb-page " + boardFonts}>
        <div className="center">
          <div className="card">
            <p className="err">Дошку не знайдено</p>
            <Link href="/dashboard">До кабінету</Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = board.ownerId === user.uid;
  const name = userProfile?.displayName || user.displayName || user.email || "Учень";

  return (
    <div className={"mathboard mb-page " + boardFonts}>
      <div className="board-wrap">
        <BoardTopBar board={board} isOwner={isOwner} onOpenVersions={() => setVersionsOpen(true)} />
        <div className="board-canvas">
          <BoardCanvas
            key={mount}
            boardId={board.id}
            isOwner={isOwner}
            user={{ uid: user.uid, name, color: userColor(user.uid) }}
          />
        </div>
        {isOwner && (
          <VersionsDialog
            boardId={board.id}
            open={versionsOpen}
            onClose={() => setVersionsOpen(false)}
            onRestored={() => setMount((n) => n + 1)}
          />
        )}
      </div>
    </div>
  );
}
