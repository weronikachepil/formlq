"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { canTutor } from "@/lib/roles";
import { boardLink, getBoardSettings, updateBoardSettings, type Board, type BoardSettings } from "@/lib/boards";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface BoardTopBarProps {
  board: Board;
  isOwner: boolean;
  onOpenVersions: () => void;
}

/** mathboard `.board-bar`: back link, title and the owner's controls (permissions, versions, share link). */
export function BoardTopBar({ board, isOwner, onOpenVersions }: BoardTopBarProps) {
  const { userProfile } = useAuth();
  return (
    <div className="board-bar">
      <Link href={canTutor(userProfile?.role) ? "/tutor/boards" : "/dashboard/boards"}>← Дошки</Link>
      <span className="title">{board.title}</span>
      {isOwner && <OwnerControls boardId={board.id} onOpenVersions={onOpenVersions} />}
    </div>
  );
}

function OwnerControls({ boardId, onOpenVersions }: { boardId: string; onOpenVersions: () => void }) {
  const [settings, setSettings] = useState<BoardSettings | null>(null);
  const { copied, copy } = useCopyToClipboard(2500);

  useEffect(() => {
    let alive = true;
    getBoardSettings(boardId)
      .then((s) => alive && setSettings(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [boardId]);

  async function toggle(key: keyof BoardSettings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      await updateBoardSettings(boardId, { [key]: next[key] });
    } catch {
      setSettings(settings);
      toast.error("Не вдалося змінити доступ");
    }
  }

  const edit = settings?.studentEdit ?? true;
  const protect = settings?.studentProtect ?? true;

  return (
    <>
      <button className={edit ? "ghost" : "danger"} disabled={!settings} onClick={() => toggle("studentEdit")}>
        {edit ? "Учні можуть малювати" : "Учні лише дивляться"}
      </button>
      <button
        className={protect ? "ghost" : "danger"}
        disabled={!settings}
        title="Чи можуть учні змінювати та видаляти чужі об'єкти"
        onClick={() => toggle("studentProtect")}
      >
        {protect ? "Учні змінюють лише своє" : "Учні змінюють і чуже"}
      </button>
      <button className="ghost" onClick={onOpenVersions}>
        Версії
      </button>
      <button className="ghost" onClick={() => copy(boardLink(boardId))}>
        {copied ? "Скопійовано ✓" : "Посилання для учнів"}
      </button>
    </>
  );
}
