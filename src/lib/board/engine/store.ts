// Board object store. Objects are immutable: any change is a new object with the same id.
// That makes caching rendered paths free (a WeakMap keyed by the object reference).
import type { BoardObject } from "./types";

/** Minimal shape the store needs from an object. */
export interface StoredObject {
  id: string;
  z: number;
}

/** A change: set the object, or delete it when null. */
export type StoreChange<O extends StoredObject = BoardObject> = [id: string, obj: O | null];

/** Store listener: receives the applied changes, or null after `replaceAll`. */
export type StoreListener<O extends StoredObject = BoardObject> = (changes: StoreChange<O>[] | null) => void;

export class Store<O extends StoredObject = BoardObject> {
  objs = new Map<string, O>();
  version = 0;
  private _sorted: O[] | null = null;
  listeners = new Set<StoreListener<O>>();

  get(id: string): O | undefined {
    return this.objs.get(id);
  }

  has(id: string): boolean {
    return this.objs.has(id);
  }

  get size(): number {
    return this.objs.size;
  }

  /** All objects from the bottom layer to the top. */
  all(): O[] {
    if (!this._sorted) this._sorted = [...this.objs.values()].sort((a, b) => a.z - b.z);
    return this._sorted;
  }

  topZ(): number {
    const a = this.all();
    return a.length ? a[a.length - 1].z : 0;
  }

  /** Applies changes and returns the inverse changes (for history). */
  apply(changes: StoreChange<O>[]): StoreChange<O>[] {
    const inverse: StoreChange<O>[] = [];
    for (const [id, obj] of changes) {
      inverse.push([id, this.objs.get(id) || null]);
      if (obj) this.objs.set(id, obj);
      else this.objs.delete(id);
    }
    this._sorted = null;
    this.version++;
    for (const l of this.listeners) l(changes);
    return inverse;
  }

  replaceAll(list: O[]): void {
    this.objs = new Map(list.map((o) => [o.id, o]));
    this._sorted = null;
    this.version++;
    for (const l of this.listeners) l(null);
  }

  subscribe(fn: StoreListener<O>): () => boolean {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** One undoable action: the state before and after, for each changed object (null = absent). */
export interface HistoryEntry<O extends StoredObject = BoardObject> {
  before: Map<string, O | null>;
  after: Map<string, O | null>;
}

/** User action history (Ctrl+Z / Ctrl+Y). */
export class History<E = HistoryEntry> {
  undoStack: E[] = [];
  redoStack: E[] = [];
  limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  push(entry: E): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
