"use client";

import { cn } from "@/lib/utils";
import { pluralize, PLURAL } from "@/lib/format";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { FolderNameInput } from "./FolderNameInput";
import { Highlight } from "@/components/ui/highlight";
import { Menu } from "@base-ui/react/menu";
import { menuItemCls, menuPopupCls, menuTriggerCls } from "./TestRow";

interface FolderSectionProps {
  name: string;
  /** Search query to mark in the folder name. */
  highlight?: string;
  count: number;
  /** Omitted where tests aren't published (a teacher's own tests). */
  publishedCount?: number;
  expanded: boolean;
  renaming: boolean;
  draggable: boolean;
  isDragSrc: boolean;
  /** A test is being dragged over this folder — it will land inside. */
  isDropInto: boolean;
  /** A folder is being dragged over this one — reorder indicator. */
  dropIndicator: "before" | "after" | null;
  creatingTest: boolean;
  onToggle: () => void;
  onRenameStart: () => void;
  onRename: (name: string) => void;
  onRenameCancel: () => void;
  onAddTest: () => void;
  onDelete: () => void;
  onHeaderDragStart: (e: React.DragEvent) => void;
  onHeaderDragOver: (e: React.DragEvent) => void;
  onBodyDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}

export function FolderSection({
  name,
  highlight = "",
  count,
  publishedCount,
  expanded,
  renaming,
  draggable,
  isDragSrc,
  isDropInto,
  dropIndicator,
  creatingTest,
  onToggle,
  onRenameStart,
  onRename,
  onRenameCancel,
  onAddTest,
  onDelete,
  onHeaderDragStart,
  onHeaderDragOver,
  onBodyDragOver,
  onDrop,
  onDragEnd,
  children,
}: FolderSectionProps) {
  const Icon = expanded ? FolderOpen : Folder;

  return (
    <div className="relative" onDrop={onDrop}>
      {dropIndicator && (
        <div
          className={cn(
            "absolute left-3 right-3 h-0.5 rounded-full bg-primary pointer-events-none z-10",
            dropIndicator === "before" ? "-top-1.25" : "-bottom-1.25",
          )}
        />
      )}
      <div
        className={cn(
          "rounded-2xl border bg-card transition-all",
          isDropInto
            ? "border-primary/60 bg-primary/5 ring-2 ring-primary/15"
            : "border-transparent",
          isDragSrc && "opacity-40",
        )}
      >
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          draggable={draggable && !renaming}
          onDragStart={onHeaderDragStart}
          onDragOver={onHeaderDragOver}
          onDragEnd={onDragEnd}
          onClick={() => !renaming && onToggle()}
          onKeyDown={(e) => {
            if (renaming || e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
            if (e.key === "F2") onRenameStart();
          }}
          className="group flex items-center gap-3 pl-4 pr-2 py-2.5 cursor-pointer select-none rounded-2xl outline-none hover:bg-muted/30 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {draggable && (
            <div className="hidden [@media(hover:hover)]:flex shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors cursor-grab active:cursor-grabbing -ml-0.5">
              <GripVertical size={16} />
            </div>
          )}

          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />

          <div
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              isDropInto ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
            )}
          >
            <Icon size={16} />
          </div>

          <div className="flex-1 min-w-0">
            {renaming ? (
              <FolderNameInput
                initial={name}
                onSubmit={onRename}
                onCancel={onRenameCancel}
              />
            ) : (
              <>
                <p
                  className="font-semibold text-sm truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onRenameStart();
                  }}
                >
                  <Highlight text={name} query={highlight} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {count === 0
                    ? "Порожня папка"
                    : publishedCount === undefined
                      ? pluralize(count, PLURAL.test)
                      : publishedCount === 0
                        ? `${pluralize(count, PLURAL.test)} · усі чернетки`
                        : publishedCount === count
                          ? `${pluralize(count, PLURAL.test)} · усі опубліковані`
                          : `${pluralize(count, PLURAL.test)} · опубліковано ${publishedCount}`}
                </p>
              </>
            )}
          </div>

          {!renaming && (
            <Menu.Root>
              <Menu.Trigger
                aria-label="Дії з папкою"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={menuTriggerCls}
              >
                <MoreHorizontal size={17} />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
                  <Menu.Popup className={menuPopupCls} onClick={(e) => e.stopPropagation()}>
                    <Menu.Item onClick={onAddTest} disabled={creatingTest} className={menuItemCls}>
                      <Plus size={15} className="text-muted-foreground" /> Новий тест у цій папці
                    </Menu.Item>
                    <Menu.Item onClick={onRenameStart} className={menuItemCls}>
                      <Pencil size={15} className="text-muted-foreground" /> Перейменувати
                    </Menu.Item>
                    <div className="my-1 h-px bg-border/60" />
                    <Menu.Item
                      onClick={onDelete}
                      className={cn(menuItemCls, "text-destructive data-[highlighted]:bg-destructive/10")}
                    >
                      <Trash2 size={15} /> Видалити папку
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>

        {/* Body (animated collapse via grid-rows trick) */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden" onDragOver={onBodyDragOver}>
            <div className="px-2 pb-2 space-y-2">
              {count === 0 ? (
                <div
                  className={cn(
                    "rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground transition-colors",
                    isDropInto ? "border-primary/50 text-primary" : "border-border/50",
                  )}
                >
                  {/* Touch screens can't drag: don't suggest it there. */}
                  <span className="[@media(hover:none)]:hidden">Перетягніть сюди тести або </span>
                  <span className="hidden [@media(hover:none)]:inline">Порожня папка · </span>
                  <button
                    onClick={onAddTest}
                    disabled={creatingTest}
                    className="text-primary font-semibold underline-offset-4 hover:underline disabled:opacity-50 pointer-coarse:py-2"
                  >
                    створіть тест тут
                  </button>
                </div>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
