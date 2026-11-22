"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronRight, Link2, Pencil, Plus, Presentation, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  boardErrorMessage,
  boardLink,
  createBoard,
  deleteBoard,
  forgetBoardVisit,
  renameBoard,
  subscribeBoardVisits,
  subscribeOwnerBoards,
  DEFAULT_BOARD_TITLE,
  type Board,
  type BoardVisit,
} from "@/lib/boards";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/empty-state";
import { SpinnerPage } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RenameBoardDialog } from "@/components/boards/RenameBoardDialog";

interface BoardsListProps {
  /** Shown in the empty state of «Мої дошки». */
  emptyHint: string;
  /** Fallback author name for new boards. */
  fallbackName: string;
}

/**
 * «Дошки» for anyone: boards I own (create, share, rename, delete) and boards
 * of others I've opened by link or from a lesson.
 */
export function BoardsList({ emptyHint, fallbackName }: BoardsListProps) {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [visits, setVisits] = useState<BoardVisit[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeBoardVisits(user.uid, setVisits, (e) => console.error("[boards] visits failed:", e));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeOwnerBoards(
      user.uid,
      (list) => {
        setBoards(list);
        setLoading(false);
      },
      (e) => {
        console.error("[boards] list failed:", e);
        toast.error(boardErrorMessage(e, "Не вдалося завантажити дошки"));
        setLoading(false);
      },
    );
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    try {
      const id = await createBoard(
        user.uid,
        userProfile?.displayName || user.displayName || fallbackName,
        title || DEFAULT_BOARD_TITLE,
      );
      router.push(`/board/${id}`);
    } catch (e) {
      console.error("[boards] create failed:", e);
      toast.error(boardErrorMessage(e, "Не вдалося створити дошку"));
      setCreating(false);
    }
  }

  async function copyLink(b: Board) {
    try {
      await navigator.clipboard.writeText(boardLink(b.id));
      toast.success("Посилання скопійовано");
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  async function handleDelete(b: Board) {
    setDeleting(null);
    try {
      await deleteBoard(b.id);
      toast.success("Дошку видалено");
    } catch {
      toast.error("Не вдалося видалити дошку");
    }
  }

  async function handleForget(v: BoardVisit) {
    if (!user) return;
    try {
      await forgetBoardVisit(user.uid, v.id);
    } catch {
      toast.error("Не вдалося прибрати дошку зі списку");
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Назва, напр. «Квадратні рівняння, 9 клас»"
          maxLength={100}
          className="h-11"
        />
        <Button type="submit" size="lg" className="gap-1.5" disabled={creating}>
          <Plus size={16} />
          Нова дошка
        </Button>
      </form>

      {loading ? (
        <SpinnerPage />
      ) : boards.length === 0 ? (
        <EmptyState
          emoji="🧑‍🏫"
          title="Дошок ще немає"
          description={emptyHint}
        />
      ) : (
        <div className="space-y-2">
          <h2 className="px-1 font-heading text-lg font-bold">Мої дошки<span className="ml-2 text-sm font-medium text-muted-foreground">{boards.length}</span></h2>
          {boards.map((b) => (
            <div
              key={b.id}
              onClick={() => router.push(`/board/${b.id}`)}
              className="rounded-[14px] bg-card px-4 py-3.5 flex items-center gap-3 group transition-shadow cursor-pointer hover:shadow-[0_8px_28px_rgba(20,38,42,0.08)]"
            >
              <div className="w-10 h-10 rounded-full bg-peach/60 text-[#14262a] dark:bg-peach/20 dark:text-foreground flex items-center justify-center shrink-0">
                <Presentation size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold truncate">{b.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Змінено {timeAgo(b.updatedAt?.toDate())}
                </p>
              </div>
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton label="Скопіювати посилання" tone="primary" onClick={() => copyLink(b)}>
                  <Link2 size={14} />
                </IconButton>
                <IconButton label="Перейменувати" onClick={() => setRenaming(b)}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton label="Видалити" tone="danger" onClick={() => setDeleting(b)}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
              <ChevronRight
                size={14}
                className="text-muted-foreground/30 group-hover:text-muted-foreground shrink-0"
              />
            </div>
          ))}
        </div>
      )}

      {visits.length > 0 && (
        <div className="space-y-2">
          <h2 className="px-1 pt-2 font-heading text-lg font-bold">Доступні мені<span className="ml-2 text-sm font-medium text-muted-foreground">{visits.length}</span></h2>
          {visits.map((v) => (
            <div
              key={v.id}
              onClick={() => router.push(`/board/${v.id}`)}
              className="rounded-[14px] bg-card px-4 py-3.5 flex items-center gap-3 group transition-shadow cursor-pointer hover:shadow-[0_8px_28px_rgba(20,38,42,0.08)]"
            >
              <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <Presentation size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold truncate">{v.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {v.ownerName ? `${v.ownerName} · ` : ""}відкрито {timeAgo(v.visitedAt?.toDate())}
                </p>
              </div>
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton label="Прибрати зі списку" tone="danger" onClick={() => handleForget(v)}>
                  <X size={14} />
                </IconButton>
              </div>
              <ChevronRight
                size={14}
                className="text-muted-foreground/30 group-hover:text-muted-foreground shrink-0"
              />
            </div>
          ))}
        </div>
      )}

      <RenameBoardDialog
        open={!!renaming}
        initialTitle={renaming?.title ?? ""}
        onSave={async (t) => {
          if (renaming) await renameBoard(renaming.id, t);
        }}
        onClose={() => setRenaming(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={`Видалити дошку «${deleting?.title ?? ""}»?`}
        description="Дошку, її вміст і всі версії буде видалено назавжди."
        onConfirm={() => deleting && handleDelete(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
