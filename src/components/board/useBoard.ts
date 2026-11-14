"use client";

import { createContext, useContext, useMemo } from "react";
import type { MathBoard } from "@/lib/board/engine/board";
import type { BoardObject } from "@/lib/board/engine/types";
import type { BoardState } from "./types";

export interface BoardContextValue {
  st: BoardState;
  /** The engine instance (null before the first snapshot). */
  b: () => MathBoard | null;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

/** Engine state + engine getter for any component inside <BoardCanvas>. */
export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside <BoardCanvas>");
  return ctx;
}

/** A patch for the selected objects: fields, or a function of the current object. */
export type Patch<O extends BoardObject> = Partial<O> | ((o: O) => Partial<O>);

type EnginePatch = Parameters<MathBoard["updateSelected"]>[0];

export interface SelectionActions {
  /** Commit a change to every selected object (one history step). */
  set<O extends BoardObject>(patch: Patch<O>): void;
  /** Live change while typing / dragging a slider; committed after `ms` of inactivity or on `end()`. */
  live<O extends BoardObject>(patch: Patch<O>, ms?: number): void;
  /** Live change without scheduling the commit (caller ends it). */
  liveOnly<O extends BoardObject>(patch: Patch<O>): void;
  /** Commit the pending live change now. */
  end(): void;
}

/** Typed wrappers around MathBoard.updateSelected for inspector panels. */
export function useSelection(): SelectionActions {
  const { b } = useBoard();
  return useMemo<SelectionActions>(
    () => ({
      set(patch) {
        b()?.updateSelected(patch as EnginePatch);
      },
      live(patch, ms = 500) {
        const board = b();
        board?.updateSelected(patch as EnginePatch, { live: true });
        board?.scheduleEndLive(ms);
      },
      liveOnly(patch) {
        b()?.updateSelected(patch as EnginePatch, { live: true });
      },
      end() {
        b()?.endLive();
      },
    }),
    [b],
  );
}
