import {
  ref,
  onValue,
  onDisconnect,
  set,
  update,
  serverTimestamp,
  type DatabaseReference,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";

export type PresenceState = "online" | "offline";

export interface PresenceEntry {
  state: PresenceState;
  /** ms since epoch (RTDB server timestamp) of the last online/offline switch */
  lastChanged: number;
  /** ms since epoch (RTDB server timestamp) of the last heartbeat from an active tab */
  lastActive?: number;
  displayName?: string;
}

export type PresenceMap = Record<string, PresenceEntry>;

/** No input for this long (or the tab is hidden) → the tab stops reporting activity. */
const IDLE_MS = 5 * 60 * 1000;
/** An active tab refreshes `lastActive` this often. */
const HEARTBEAT_MS = 60 * 1000;
/** Without a heartbeat for this long a user no longer counts as online. */
export const ONLINE_STALE_MS = 3 * 60 * 1000;

/**
 * Online = connected AND recently active. A tab left open and forgotten stays
 * connected, so `state` alone would keep it "online" forever; the heartbeat
 * stops once the tab is hidden or idle, and the entry goes stale.
 * `now` should be server time (see `subscribeToServerOffset`).
 */
export function isOnline(entry: PresenceEntry | undefined, now: number): boolean {
  return (
    entry?.state === "online" &&
    typeof entry.lastActive === "number" &&
    now - entry.lastActive < ONLINE_STALE_MS
  );
}

/** When the user was last seen active (falls back to the last online/offline switch). */
export function lastSeenAt(entry: PresenceEntry | undefined): number | null {
  return entry?.lastActive ?? entry?.lastChanged ?? null;
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Marks the user online in RTDB and schedules an offline write via onDisconnect
 * (fires server-side even if the tab is closed/crashes). While the tab is visible
 * and used, it sends a heartbeat (`lastActive`); a hidden or idle tab stays silent,
 * so readers drop it after `ONLINE_STALE_MS`. Returns a cleanup that marks the
 * user offline immediately (e.g. on logout).
 */
export function connectPresence(uid: string, displayName?: string): () => void {
  const statusRef: DatabaseReference = ref(rtdb, `status/${uid}`);
  const connectedRef = ref(rtdb, ".info/connected");

  // RTDB rejects `undefined` values (throws synchronously), so only include
  // displayName when we actually have one — it's still unset right after signup.
  const base = displayName ? { displayName } : {};
  const offline = {
    state: "offline" as const,
    lastChanged: serverTimestamp(),
    ...base,
  };

  let connected = false;
  let lastInput = Date.now();
  let lastBeat = 0;

  const active = () =>
    document.visibilityState === "visible" && Date.now() - lastInput < IDLE_MS;

  // Every heartbeat also re-asserts "online": with several tabs open, closing one
  // fires its onDisconnect and writes "offline" while another is still in use.
  function beat() {
    if (!connected || !active()) return;
    lastBeat = Date.now();
    try {
      update(statusRef, {
        state: "online",
        lastActive: serverTimestamp(),
        ...base,
      }).catch(() => {});
    } catch {
      // presence is best-effort; never let it break auth/render
    }
  }

  // Coming back after a pause shows the user online right away, not on the next tick.
  function onInput() {
    const wasIdle = Date.now() - lastBeat >= HEARTBEAT_MS;
    lastInput = Date.now();
    if (wasIdle) beat();
  }
  function onVisibility() {
    if (document.visibilityState === "visible") onInput();
  }

  const unsub = onValue(connectedRef, (snap) => {
    connected = snap.val() === true;
    if (!connected) return;
    // Register the disconnect handler first, then flip to online.
    // Wrapped in try/catch — set()/onDisconnect().set() can throw synchronously.
    try {
      onDisconnect(statusRef)
        .set(offline)
        .then(() =>
          set(statusRef, {
            state: "online",
            lastChanged: serverTimestamp(),
            // A reconnect of a hidden/idle tab must not look like fresh activity.
            ...(active() ? { lastActive: serverTimestamp() } : {}),
            ...base,
          }),
        )
        .then(() => {
          if (active()) lastBeat = Date.now();
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  });

  const timer = window.setInterval(beat, HEARTBEAT_MS);
  for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onInput, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    unsub();
    window.clearInterval(timer);
    for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onInput);
    document.removeEventListener("visibilitychange", onVisibility);
    try {
      set(statusRef, offline).catch(() => {});
    } catch {
      // ignore
    }
  };
}

/** Subscribes to every user's presence. Returns an unsubscribe fn. */
export function subscribeToPresence(
  cb: (map: PresenceMap) => void,
): () => void {
  const statusRef = ref(rtdb, "status");
  return onValue(statusRef, (snap) => {
    cb((snap.val() as PresenceMap) ?? {});
  });
}

/** Server clock minus local clock, ms — to compare server timestamps with `Date.now()`. */
export function subscribeToServerOffset(cb: (offsetMs: number) => void): () => void {
  return onValue(ref(rtdb, ".info/serverTimeOffset"), (snap) => cb(Number(snap.val()) || 0));
}
