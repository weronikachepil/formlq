"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listVersions, restoreVersion, saveVersion, type BoardVersion } from "@/lib/boards";
import { pluralize } from "@/lib/format";
import { ConfirmModal, Modal } from "@/components/board/dialogs/Modal";

interface VersionsDialogProps {
  boardId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a version was restored, so the board can be remounted. */
  onRestored: () => void;
}

/** mathboard "Версії дошки" modal (rendered inside the `.mathboard` page root). */
export function VersionsDialog({ boardId, open, onClose, onRestored }: VersionsDialogProps) {
  if (!open) return null;
  return <VersionsBody boardId={boardId} onClose={onClose} onRestored={onRestored} />;
}

function VersionsBody({ boardId, onClose, onRestored }: Omit<VersionsDialogProps, "open">) {
  const [versions, setVersions] = useState<BoardVersion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<BoardVersion | null>(null);

  useEffect(() => {
    let alive = true;
    listVersions(boardId)
      .then((v) => alive && setVersions(v))
      .catch(() => alive && setVersions([]));
    return () => {
      alive = false;
    };
  }, [boardId]);

  async function handleSave() {
    setBusy(true);
    try {
      await saveVersion(boardId, "Збережено вручну");
      setVersions(await listVersions(boardId));
    } catch {
      toast.error("Не вдалося зберегти версію");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(v: BoardVersion) {
    setBusy(true);
    try {
      await restoreVersion(boardId, v.id);
      onRestored();
      onClose();
    } catch {
      toast.error("Не вдалося відновити версію");
      setBusy(false);
    }
  }

  // the confirm is a sibling: the glass card (backdrop-filter) would trap a nested fixed backdrop
  return (
    <>
      <Modal onClose={onClose}>
        <h2>Версії дошки</h2>
        <p className="sub">
          Дошка зберігає версії автоматично (не частіше ніж раз на 10 хвилин). Відновлення не втрачає поточний стан: він теж стає
          версією.
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          <button disabled={busy} onClick={handleSave}>
            Зберегти версію зараз
          </button>
          <button className="ghost" onClick={onClose}>
            Закрити
          </button>
        </div>
        {versions?.length === 0 && <p className="empty">Версій ще немає.</p>}
        {versions?.map((v) => (
          <div className="board-item" key={v.id}>
            <span className="title">{new Date(v.ts).toLocaleString("uk-UA")}</span>
            <span className="date">
              {v.label} · {pluralize(v.count, ["обʼєкт", "обʼєкти", "обʼєктів"])}
            </span>
            <button className="ghost" disabled={busy} onClick={() => setRestoring(v)}>
              Відновити
            </button>
          </div>
        ))}
      </Modal>
      {restoring && (
        <ConfirmModal
          text="Відновити дошку до цієї версії?"
          confirmLabel="Відновити"
          onConfirm={() => handleRestore(restoring)}
          onClose={() => setRestoring(null)}
        />
      )}
    </>
  );
}
