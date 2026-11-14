// Contract between the board engine and its network layer.
// The engine never talks to Firebase directly: it receives a `TransportFactory`
// in its options and only uses the methods below (see src/lib/board/sync.ts).
import type { BoardObject, Op, ViewRect } from "./types";

export type SyncStatus = "connecting" | "online" | "offline";

/** A participant as announced by the transport. `cid` is unique per tab. */
export interface PeerInfo {
  cid: string;
  uid: string;
  name: string;
  color: string;
  owner: boolean;
  /** Where a student currently is (only delivered to the owner). */
  view?: ViewRect;
}

/** Full board state, delivered on connect and after a reconnect / version restore. */
export interface InitMessage {
  cid: string;
  objs: BoardObject[];
  peers: PeerInfo[];
  canEdit: boolean;
  protect: boolean;
  isOwner: boolean;
  /** The owner's last broadcast view ("follow me"). */
  view: ViewRect | null;
  /** Page the owner has sent every student to (a running test). */
  goto: string | null;
}

export interface CursorMessage {
  cid: string;
  x: number;
  y: number;
}

export interface LaserMessage extends CursorMessage {
  /** 1 while the pointer is down. */
  d: 0 | 1;
}

export interface PViewMessage extends ViewRect {
  cid: string;
}

export interface SyncCallbacks {
  onStatus: (status: SyncStatus) => void;
  onInit: (m: InitMessage) => void;
  /** Changes made by someone else (or by the owner's host logic). */
  onRemoteOps: (ops: Op[]) => void;
  /** Server-clock minus local-clock, ms. */
  onTime: (offset: number) => void;
  onPeer: (p: PeerInfo) => void;
  onLeave: (cid: string) => void;
  onCursor: (m: CursorMessage) => void;
  onLaser: (m: LaserMessage) => void;
  onPerm: (canEdit: boolean, protect: boolean) => void;
  onView: (v: ViewRect) => void;
  onPView: (m: PViewMessage) => void;
  onGoto: (pg: string) => void;
  /** Owner only: number of students that received a `goto`. */
  onGotoAck: (n: number) => void;
}

export interface BoardTransport {
  connect(): void;
  /** Applies local changes remotely. The engine has already applied them to its store. */
  send(ops: Op[]): void;
  sendCursor(x: number, y: number): void;
  sendLaser(x: number, y: number, down: boolean): void;
  /** Owner: broadcast the current view for "follow me". */
  sendView(v: ViewRect): void;
  /** Student: report the current view to the owner. */
  sendPView(v: ViewRect): void;
  /** Owner: move every student to a page. */
  sendGoto(pg: string): void;
  close(): void;
}

export type TransportFactory = (callbacks: SyncCallbacks) => BoardTransport;
