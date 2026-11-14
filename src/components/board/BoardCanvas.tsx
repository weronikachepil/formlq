"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MathBoard } from "@/lib/board/engine/board";
import { createBoardSync } from "@/lib/board/sync";
import type { TransportFactory } from "@/lib/board/engine/transport";
import "./board.css";
import { BottomBar } from "./BottomBar";
import { CommentPanel } from "./CommentPanel";
import { NumlineDialog } from "./dialogs/NumlineDialog";
import { QuizResultsDialog } from "./dialogs/QuizResultsDialog";
import { AssignDialog, ExerciseDialog, PdfDialog, SourceDialog } from "./dialogs/SimpleDialogs";
import { TestImportDialog } from "./dialogs/TestImportDialog";
import { boardFonts } from "./fonts";
import { Inspector } from "./inspector/Inspector";
import type { DialogRequest, MenuControl, MenuId } from "./menu";
import { PagesBar } from "./PagesBar";
import { PeopleBar } from "./PeopleBar";
import { StatusBanners } from "./StatusBanners";
import { Toolbar } from "./Toolbar";
import type { BoardState } from "./types";
import { BoardContext, type BoardContextValue } from "./useBoard";
import { useInstantTips } from "./useInstantTips";

const NOTICE_MS = 3500;

export interface BoardCanvasProps {
  boardId: string;
  user: { uid: string; name: string; color: string };
  isOwner: boolean;
  /** Network layer override (tests / offline demos); defaults to the Firebase sync. */
  createSync?: TransportFactory;
}

/** The live MathBoard: engine canvas plus its toolbars, panels and dialogs. */
export function BoardCanvas({ boardId, user, isOwner, createSync }: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // engine snapshot together with the engine that produced it (set from the engine's onState)
  const [view, setView] = useState<{ st: BoardState; board: MathBoard } | null>(null);
  const st = view?.st ?? null;
  const board = view?.board ?? null;
  // the open menu belongs to the tool it was opened with: any tool change closes it
  const [menuState, setMenuState] = useState<{ id: MenuId; tool: string } | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { uid, name, color } = user;

  useInstantTips(hostRef);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const b = new MathBoard(stage, {
      createSync: createSync ?? createBoardSync(boardId, { uid, name, color }),
      userName: name,
      color,
      uid,
      isOwner,
      onState: (s) => setView({ st: s, board: b }),
      onNotice: (m) => {
        setNotice(m);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(""), NOTICE_MS);
      },
    });
    (window as Window & { __mathboard?: MathBoard }).__mathboard = b;
    b.emit();
    return () => {
      b.destroy();
      clearTimeout(noticeTimer.current);
    };
  }, [boardId, uid, name, color, isOwner, createSync]);

  const tool = st?.tool ?? "";
  const menu = menuState && menuState.tool === tool ? menuState.id : null;

  const mc = useMemo<MenuControl>(
    () => ({
      menu,
      toggle: (id) => setMenuState(menu === id ? null : { id, tool }),
      close: () => setMenuState(null),
      setTool: (t) => {
        setMenuState(null);
        board?.setTool(t);
      },
      openDialog: setDialog,
    }),
    [menu, tool, board],
  );
  const ctx = useMemo<BoardContextValue | null>(() => (st && board ? { st, b: () => board } : null), [st, board]);
  const getBoard = () => board;
  const closeDialog = () => setDialog(null);

  const nlObj = st?.nlEdit ? st.sel.find((o) => o.id === st.nlEdit) : undefined;
  const srcObj = st?.srcEdit ? st.sel.find((o) => o.id === st.srcEdit) : undefined;

  return (
    <div ref={hostRef} className={"mathboard mb-host " + boardFonts}>
      <div className="bd">
        <div ref={stageRef} className="bd-stage" onPointerDown={() => setMenuState(null)} />

        {ctx && st && (
          <BoardContext.Provider value={ctx}>
            <Toolbar mc={mc} />
            <PeopleBar mc={mc} />
            <PagesBar />
            <StatusBanners notice={notice} />
            {st.comment && <CommentPanel c={st.comment} />}

            {dialog?.kind === "assign" && <AssignDialog onClose={closeDialog} />}
            {dialog?.kind === "numline" && (
              <NumlineDialog
                onClose={closeDialog}
                onDone={(ivs) => {
                  getBoard()?.insertNumline(ivs);
                  closeDialog();
                }}
              />
            )}
            {nlObj?.type === "numline" && (
              <NumlineDialog
                ivs={nlObj.ivs}
                onClose={() => getBoard()?.editNumline(null)}
                onDone={(ivs) => {
                  getBoard()?.setNumlineIntervals(nlObj.id, ivs);
                  getBoard()?.editNumline(null);
                }}
              />
            )}
            {dialog?.kind === "source" && (
              <SourceDialog
                kind={dialog.src}
                onClose={closeDialog}
                onDone={(txt) => {
                  if (dialog.src === "tree") getBoard()?.insertTree(txt);
                  else getBoard()?.insertChart(dialog.src, txt);
                  closeDialog();
                }}
              />
            )}
            {(srcObj?.type === "chart" || srcObj?.type === "ptree") && (
              <SourceDialog
                kind={srcObj.type === "ptree" ? "tree" : srcObj.kind}
                value={srcObj.src}
                onClose={() => getBoard()?.editSrc(null)}
                onDone={(txt) => {
                  getBoard()?.setSrc(srcObj.id, txt);
                  getBoard()?.editSrc(null);
                }}
              />
            )}
            {st.pdfAsk && (
              <PdfDialog
                ask={st.pdfAsk}
                onClose={() => getBoard()?.cancelPdf()}
                onDone={(pages) => getBoard()?.placePdf(pages)}
              />
            )}
            {dialog?.kind === "exercises" && (
              <ExerciseDialog
                onClose={closeDialog}
                onDone={(opts) => {
                  getBoard()?.insertExercises(opts);
                  closeDialog();
                }}
              />
            )}
            {dialog?.kind === "testImport" && <TestImportDialog onClose={closeDialog} />}
            {dialog?.kind === "results" && <QuizResultsDialog onClose={closeDialog} />}

            <BottomBar />
            {st.canEdit && <Inspector />}
          </BoardContext.Provider>
        )}
      </div>
    </div>
  );
}
