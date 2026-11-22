"use client";

import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  FolderInput,
  FolderMinus,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Pencil,
  QrCode,
  Trash2,
} from "lucide-react";
import type { TestDoc, TestFolder } from "@/lib/tests";
import { pluralize, PLURAL } from "@/lib/format";
import { Highlight } from "@/components/ui/highlight";

interface TestRowProps {
  test: TestDoc;
  index: number;
  total: number;
  folders: TestFolder[];
  currentFolderId: string | null;
  draggable: boolean;
  isDragSrc: boolean;
  dropIndicator: "before" | "after" | null;
  /** Search query to mark in title/subtitle. */
  highlight?: string;
  deleting: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Omitted where tests aren't published (a teacher's own tests): no status, no toggle. */
  onTogglePublished?: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveTo: (folderId: string | null) => void;
  onMoveToNewFolder: () => void;
}

export const menuPopupCls = cn(
  "min-w-56 max-w-72 max-h-80 overflow-y-auto rounded-[18px] border border-glass-edge bg-popover p-1.5 shadow-glass-lg outline-none",
  "origin-[var(--transform-origin)] transition-[transform,opacity] duration-150",
  "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
  "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
);

export const menuItemCls = cn(
  "flex items-center gap-2.5 px-2.5 py-2 pointer-coarse:py-2.5 rounded-[10px] text-sm cursor-pointer outline-none select-none",
  "data-[highlighted]:bg-muted data-[disabled]:opacity-40 data-[disabled]:cursor-default",
);

/** The «⋯» button: always visible, so the actions are never a hover-only mystery. */
export const menuTriggerCls =
  "w-9 h-9 pointer-coarse:w-10 pointer-coarse:h-10 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors data-[popup-open]:bg-muted data-[popup-open]:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** One test: the whole row opens it; everything else is in «⋯», named in words. */
export function TestRow({
  test,
  index,
  total,
  folders,
  currentFolderId,
  draggable,
  isDragSrc,
  dropIndicator,
  highlight = "",
  deleting,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onTogglePublished,
  onShare,
  onEdit,
  onDelete,
  onMoveTo,
  onMoveToNewFolder,
}: TestRowProps) {
  const count = test.questions?.length ?? 0;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="relative" onDragOver={onDragOver} onDrop={onDrop}>
      {dropIndicator && (
        <div
          className={cn(
            "absolute left-3 right-3 h-0.5 rounded-full bg-primary pointer-events-none z-10",
            dropIndicator === "before" ? "-top-1.25" : "-bottom-1.25",
          )}
        />
      )}
      <div
        role="link"
        tabIndex={0}
        aria-label={`Відкрити тест «${test.title || "Без назви"}»`}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onEdit();
          }
        }}
        className={cn(
          "group rounded-2xl border border-border/50 bg-card pl-3 pr-2 py-2.5 flex items-center gap-3 cursor-pointer select-none transition-colors",
          "hover:border-border hover:bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          isDragSrc && "opacity-40",
        )}
      >
        {/* Mouse: drag by the grip. Touch: «Вище / Нижче» in «⋯» (no tiny arrows to miss). */}
        {draggable && (
          <div className="hidden [@media(hover:hover)]:flex shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors cursor-grab active:cursor-grabbing">
            <GripVertical size={16} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            <Highlight text={test.title || "Без назви"} query={highlight} />
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {pluralize(count, PLURAL.task)}
            {test.subtitle && (
              <>
                {" · "}
                <Highlight text={test.subtitle} query={highlight} />
              </>
            )}
          </p>
        </div>

        {onTogglePublished && (
          <span
            className={cn(
              "shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
              test.published
                ? "bg-green-500/12 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {test.published ? <Eye size={12} /> : <EyeOff size={12} />}
            {test.published ? "Опубліковано" : "Чернетка"}
          </span>
        )}

        <ChevronRight
          size={16}
          className="shrink-0 hidden [@media(hover:hover)]:block text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"
          aria-hidden
        />

        <Menu.Root>
          <Menu.Trigger
            aria-label="Дії з тестом"
            onClick={stop}
            onKeyDown={stop}
            className={menuTriggerCls}
          >
            <MoreHorizontal size={17} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
              <Menu.Popup className={menuPopupCls} onClick={stop}>
                <Menu.Item onClick={onEdit} className={menuItemCls}>
                  <Pencil size={15} className="text-muted-foreground" /> Відкрити й редагувати
                </Menu.Item>
                {onTogglePublished && (
                  <Menu.Item onClick={onTogglePublished} className={menuItemCls}>
                    {test.published ? (
                      <>
                        <EyeOff size={15} className="text-muted-foreground" /> Зняти з публікації
                      </>
                    ) : (
                      <>
                        <Eye size={15} className="text-muted-foreground" /> Опублікувати
                      </>
                    )}
                  </Menu.Item>
                )}
                <Menu.Item onClick={onShare} className={menuItemCls}>
                  <QrCode size={15} className="text-muted-foreground" /> Поділитися посиланням
                </Menu.Item>

                {draggable && (
                  <>
                    <Menu.Item
                      onClick={onMoveUp}
                      disabled={index === 0}
                      className={cn(menuItemCls, "[@media(hover:hover)]:hidden")}
                    >
                      <ArrowUp size={15} className="text-muted-foreground" /> Перемістити вище
                    </Menu.Item>
                    <Menu.Item
                      onClick={onMoveDown}
                      disabled={index === total - 1}
                      className={cn(menuItemCls, "[@media(hover:hover)]:hidden")}
                    >
                      <ArrowDown size={15} className="text-muted-foreground" /> Перемістити нижче
                    </Menu.Item>
                  </>
                )}

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={menuItemCls}>
                    <FolderInput size={15} className="text-muted-foreground" />
                    <span className="flex-1">Перемістити в папку</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner sideOffset={4} className="z-50 outline-none">
                      <Menu.Popup className={menuPopupCls} onClick={stop}>
                        {folders.map((f) => {
                          const current = f.id === currentFolderId;
                          return (
                            <Menu.Item
                              key={f.id}
                              disabled={current}
                              onClick={() => onMoveTo(f.id)}
                              className={menuItemCls}
                            >
                              <Folder size={15} className="shrink-0 text-primary" />
                              <span className="truncate flex-1">{f.name}</span>
                              {current && <Check size={14} className="shrink-0 text-muted-foreground" />}
                            </Menu.Item>
                          );
                        })}
                        {currentFolderId !== null && (
                          <Menu.Item onClick={() => onMoveTo(null)} className={menuItemCls}>
                            <FolderMinus size={15} className="shrink-0 text-muted-foreground" />
                            <span className="truncate flex-1">Вийняти з папки</span>
                          </Menu.Item>
                        )}
                        <div className="my-1 h-px bg-border/60" />
                        <Menu.Item onClick={onMoveToNewFolder} className={menuItemCls}>
                          <FolderPlus size={15} className="shrink-0 text-muted-foreground" />
                          <span>Нова папка…</span>
                        </Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <div className="my-1 h-px bg-border/60" />
                <Menu.Item
                  onClick={onDelete}
                  disabled={deleting}
                  className={cn(menuItemCls, "text-destructive data-[highlighted]:bg-destructive/10")}
                >
                  <Trash2 size={15} /> Видалити тест
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}
