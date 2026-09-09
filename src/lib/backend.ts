"use client";
import { useConvexConnectionState } from "convex/react";

/* Whether the board is merely slow, or actually out of reach.

   Every number on the home page and the leaderboard arrives over one websocket,
   and a Convex query reads `undefined` both while it is still in flight and
   while the socket is refusing to open at all. On screen those are the same
   thing, so a host the reader cannot resolve — a DNS filter swallowing the
   deployment, an office network, a captive portal — sat under "Loading the
   board…" forever with nothing to say for itself.

   The client already counts its own failed attempts, so we let it answer: once
   it has tried a couple of times and still has no socket to show for it, the
   wait has stopped being a wait and the page says so. A slow connection that is
   genuinely open never trips this. */
const ENOUGH_TRIES = 2;

export function useBackendUnreachable(): boolean {
  const { isWebSocketConnected, connectionRetries } = useConvexConnectionState();
  return !isWebSocketConnected && connectionRetries >= ENOUGH_TRIES;
}
