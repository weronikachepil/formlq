"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { atMinutes, snapMinutes } from "@/lib/calendar";
import { DEFAULT_DURATION_MIN, SNAP_MIN } from "./types";
import { edgeScroll, slotAt, type GridGeometry } from "./useLessonDrag";

export interface SlotSelection {
  dayIndex: number;
  startMin: number;
  durationMin: number;
}

interface Options extends GridGeometry {
  onCreate: (start: Date, durationMin: number) => void;
}

/**
 * Click an empty slot → a default-length lesson there; mouse click-drag
 * vertically → a lesson spanning the selected range. Touch: tap only (a swipe scrolls).
 */
export function useSlotSelect(opts: Options) {
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const touch = e.pointerType === "touch";
    if (!touch) e.preventDefault();
    const p = slotAt(optsRef.current, e.clientX, e.clientY);
    const anchor = Math.floor(p.min / SNAP_MIN) * SNAP_MIN;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const id = e.pointerId;
    let sel: SlotSelection = { dayIndex: p.dayIndex, startMin: anchor, durationMin: DEFAULT_DURATION_MIN };
    let dragged = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (touch) {
        if (dist > 8) finish(false);
        return;
      }
      if (!dragged && dist < 4) return;
      dragged = true;
      const q = slotAt(optsRef.current, ev.clientX, ev.clientY);
      const cur = snapMinutes(q.min, SNAP_MIN);
      const from = Math.min(anchor, cur);
      const to = Math.max(anchor + SNAP_MIN, cur);
      sel = { dayIndex: sel.dayIndex, startMin: from, durationMin: Math.max(SNAP_MIN, to - from) };
      setSelection(sel);
      edgeScroll(optsRef.current.scrollRef.current, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId === id) finish(true);
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId === id) finish(false);
    };

    function detach() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      cleanup.current = () => {};
    }

    function finish(create: boolean) {
      detach();
      if (!create) {
        setSelection(null);
        return;
      }
      const day = optsRef.current.days[sel.dayIndex];
      if (!day) return;
      // Keep the highlighted slot visible until the dialog opens over it.
      setSelection(sel);
      optsRef.current.onCreate(atMinutes(day, sel.startMin), sel.durationMin);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    cleanup.current = detach;
  }, []);

  const clear = useCallback(() => setSelection(null), []);

  return { selection, onPointerDown, clear };
}
