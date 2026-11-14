"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lesson } from "@/lib/lessons";
import { atMinutes, minutesOfDay, sameDay, snapMinutes } from "@/lib/calendar";
import { HOUR_H, SNAP_MIN } from "./types";

const DAY_MIN = 24 * 60;
/** Touch: hold this long before a lesson starts following the finger. */
export const LONG_PRESS_MS = 350;
/** Mouse moves less than this are still a click. */
const CLICK_SLOP_PX = 4;
/** Touch moves more than this before the long-press fires mean "scrolling". */
const TOUCH_SLOP_PX = 8;

export interface GridGeometry {
  /** Element spanning the day columns, its top edge = `startHour`:00. */
  gridRef: React.RefObject<HTMLDivElement | null>;
  /** Scrollable container around the grid (for edge auto-scroll). */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  days: Date[];
  startHour: number;
}

/** Day column and minutes-since-midnight under a pointer position. */
export function slotAt(geo: GridGeometry, clientX: number, clientY: number) {
  const rect = geo.gridRef.current?.getBoundingClientRect();
  if (!rect) return { dayIndex: 0, min: 0 };
  const n = geo.days.length;
  const dayIndex = Math.min(n - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * n)));
  const min = geo.startHour * 60 + ((clientY - rect.top) / HOUR_H) * 60;
  return { dayIndex, min: Math.min(DAY_MIN, Math.max(0, min)) };
}

/** Scrolls the grid when the pointer is near its top/bottom edge while dragging. */
export function edgeScroll(scroller: HTMLElement | null, clientY: number) {
  if (!scroller) return;
  const r = scroller.getBoundingClientRect();
  if (clientY < r.top + 48) scroller.scrollTop -= 14;
  else if (clientY > r.bottom - 32) scroller.scrollTop += 14;
}

export interface DragPreview {
  lessonId: string;
  dayIndex: number;
  /** Minutes since midnight. */
  startMin: number;
  durationMin: number;
}

interface Session {
  lesson: Lesson;
  mode: "move" | "resize";
  block: HTMLElement | null;
  pointerId: number;
  touch: boolean;
  x0: number;
  y0: number;
  /** Minutes between the lesson start and the grab point (move). */
  grab: number;
  startMin: number;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  preview: DragPreview;
}

interface Options extends GridGeometry {
  onCommit: (lesson: Lesson, start: Date, durationMin: number) => void;
  onClick: (lesson: Lesson, anchor: DOMRect) => void;
}

/**
 * Pointer-driven move (whole block) and resize (bottom handle) of lesson blocks.
 * Mouse drags start after a few pixels; touch drags start after a long press so
 * a normal swipe still scrolls the grid. A press without a drag is a click.
 */
export function useLessonDrag(opts: Options) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const session = useRef<Session | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, lesson: Lesson, mode: "move" | "resize") => {
      if (e.button !== 0 || session.current) return;
      // Don't start a "create lesson" selection underneath.
      e.stopPropagation();
      const touch = e.pointerType === "touch";
      if (!touch) e.preventDefault(); // no text selection while dragging
      const geo = optsRef.current;
      const start = lesson.start.toDate();
      const startMin = minutesOfDay(start);
      const p = slotAt(geo, e.clientX, e.clientY);
      const dayIndex = Math.max(0, geo.days.findIndex((d) => sameDay(d, start)));

      const s: Session = {
        lesson,
        mode,
        block: (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-lesson-block]"),
        pointerId: e.pointerId,
        touch,
        x0: e.clientX,
        y0: e.clientY,
        grab: p.min - startMin,
        startMin,
        active: false,
        timer: null,
        preview: { lessonId: lesson.id, dayIndex, startMin, durationMin: lesson.durationMin },
      };
      session.current = s;

      const activate = () => {
        s.active = true;
        setPreview(s.preview);
        if (s.touch) navigator.vibrate?.(10);
      };
      if (touch) s.timer = setTimeout(activate, LONG_PRESS_MS);

      const update = (clientX: number, clientY: number) => {
        const g = optsRef.current;
        const q = slotAt(g, clientX, clientY);
        let next: DragPreview;
        if (s.mode === "move") {
          const dur = s.lesson.durationMin;
          const m = Math.min(DAY_MIN - dur, Math.max(0, snapMinutes(q.min - s.grab, SNAP_MIN)));
          next = { ...s.preview, dayIndex: q.dayIndex, startMin: m };
        } else {
          const end = Math.min(DAY_MIN, snapMinutes(q.min, SNAP_MIN));
          next = { ...s.preview, durationMin: Math.max(SNAP_MIN, end - s.startMin) };
        }
        if (
          next.dayIndex !== s.preview.dayIndex ||
          next.startMin !== s.preview.startMin ||
          next.durationMin !== s.preview.durationMin
        ) {
          s.preview = next;
          setPreview(next);
        }
        edgeScroll(g.scrollRef.current, clientY);
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== s.pointerId) return;
        const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
        if (!s.active) {
          if (s.touch) {
            if (dist > TOUCH_SLOP_PX) end(false); // it's a scroll
            return;
          }
          if (dist < CLICK_SLOP_PX) return;
          activate();
        }
        update(ev.clientX, ev.clientY);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== s.pointerId) return;
        end(true);
      };
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== s.pointerId) return;
        end(false);
      };
      // While a touch drag is active, stop the page from scrolling under the finger.
      const onTouchMove = (ev: TouchEvent) => {
        if (s.active) ev.preventDefault();
      };

      const detach = () => {
        if (s.timer) clearTimeout(s.timer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("touchmove", onTouchMove);
        session.current = null;
        cleanup.current = () => {};
      };

      function end(commit: boolean) {
        detach();
        const g = optsRef.current;
        if (!s.active) {
          setPreview(null);
          if (commit && s.block) g.onClick(s.lesson, s.block.getBoundingClientRect());
          return;
        }
        setPreview(null);
        if (!commit) return;
        const day = g.days[s.preview.dayIndex];
        if (!day) return;
        g.onCommit(s.lesson, atMinutes(day, s.preview.startMin), s.preview.durationMin);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      cleanup.current = detach;
    },
    [],
  );

  return { preview, onPointerDown };
}
