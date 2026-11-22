"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeToPresence,
  subscribeToServerOffset,
  isOnline,
  type PresenceMap,
} from "@/lib/presence";

interface OnlineUsers {
  /** uid → presence entry */
  presence: PresenceMap;
  /** Set of uids currently online (connected with a recent heartbeat). */
  onlineUids: Set<string>;
  count: number;
}

/** Re-check staleness this often — entries go stale without any RTDB change. */
const TICK_MS = 30 * 1000;

/** Live online-presence map from Realtime Database. */
export function useOnlineUsers(): OnlineUsers {
  const [presence, setPresence] = useState<PresenceMap>({});
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeToPresence(setPresence), []);
  useEffect(() => subscribeToServerOffset(setOffset), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, []);

  const onlineUids = useMemo(() => {
    const serverNow = now + offset;
    return new Set(
      Object.entries(presence)
        .filter(([, entry]) => isOnline(entry, serverNow))
        .map(([uid]) => uid),
    );
  }, [presence, now, offset]);

  return { presence, onlineUids, count: onlineUids.size };
}
