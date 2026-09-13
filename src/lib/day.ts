"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { istDateKey } from "@/lib/game/types";

/* Which IST day the game is on.

   The device clock is the opening guess, so nothing on screen waits for a
   request. It is only a guess though: a device set to the wrong date would be
   handed the wrong daily challenge and the wrong board, and would have no way
   of knowing. One call to the server settles the difference, and the day is
   read off the corrected clock from then on — which also rolls the boards over
   at midnight IST without a reload.

   If that call fails the device clock stands, which is right for all but the
   handful of readers whose clock is wrong in the first place. */
/** How far the device clock sits from the server's, in ms.
    The reply was already on its way back when it was written, so it is credited
    half the round trip. */
export function clockSkew(sent: number, serverNow: number, received: number): number {
  return serverNow + (received - sent) / 2 - received;
}

export function useIstDay(): string {
  const [skew, setSkew] = useState(0);
  const [day, setDay] = useState(istDateKey);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sent = Date.now();
        const res = await fetch("/api/now", { cache: "no-store" });
        const { now } = (await res.json()) as { now: number };
        if (!live || !Number.isFinite(now)) return;
        setSkew(clockSkew(sent, now, Date.now()));
      } catch {
        // no answer: carry on with the clock we have
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const tick = () =>
      setDay((prev) => {
        const now = istDateKey(new Date(Date.now() + skew));
        return prev === now ? prev : now;
      });
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [skew]);

  return day;
}

/* Nothing to subscribe to: the day arrives as a re-render from `useIstDay`,
   and a re-render is when the snapshot is read again. */
const subscribeNothing = () => () => {};
const serverSnapshot = () => "";

/** A day from `useIstDay`, held back until the client has it — for the markup.

    `useIstDay` answers immediately because a query can be sent against a day
    that may be corrected a moment later. Rendering it is a different matter:
    the guess is computed during render, and a page Next prerenders runs that
    render at build time, so the day is baked into the static HTML and every
    visitor after the build hydrates against a stale date. React threw #418 on
    the home page for exactly that reason.

    `useSyncExternalStore` is the primitive for a value the server cannot know:
    the prerender reads the server snapshot, the client reads its own, and React
    reconciles the two itself rather than calling the difference a failure. Pass
    the day the caller already holds — asking for it again would mean a second
    clock request and a second timer for the same date. The first paint simply
    has no day in it, the same trade the gift prompt and the mute toggle make. */
export function useIstDayLabel(day: string): string {
  return useSyncExternalStore(subscribeNothing, () => day, serverSnapshot);
}
