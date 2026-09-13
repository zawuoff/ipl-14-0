"use client";
import { useEffect, useRef } from "react";

import { analytics } from "@/lib/analytics";

/* Every link the game hands out carries how it was sent. WhatsApp gives the
   browser no referrer worth reading, so without this marker a friend arriving
   on a shared board looks exactly like someone who typed the address in. */

export type ShareVia = "wa" | "copy";
export type ShareKind = "result" | "room" | "challenge";

const PARAM = "via";

/** Stamps a link on its way out. Only ever added to what is sent, never to
    what is shown — the address in the invite text stays readable. */
export function withVia(url: string, via: ShareVia): string {
  return `${url}${url.includes("?") ? "&" : "?"}${PARAM}=${via}`;
}

/** How this visit arrived. "unknown" covers a bare link, a pasted address, and
    a manager reopening their own board. */
export function readVia(): ShareVia | "unknown" {
  if (typeof window === "undefined") return "unknown";
  try {
    const v = new URLSearchParams(window.location.search).get(PARAM);
    return v === "wa" || v === "copy" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

/* Whether this device has opened this particular board before.

   "unknown" above covers three very different arrivals that all read the same:
   a bare link, a pasted address, and a manager reopening his own board. Two
   thirds of every arrival landed in it, which left no way to ask the only
   question that matters about a share — whether it brought somebody new. The
   marker cannot separate them. The device can: a board it has opened before is
   not a new person arriving, whatever the link said. */
export type SeenBefore = "new" | "repeat" | "unknown";

const SEEN_KEY = "14-0-opened";
/* Enough to cover any plausible run of rooms without growing without end. */
const SEEN_CAP = 60;

/** What was shared, independent of how it was sent — so one board opened first
    from WhatsApp and later from the address bar is still one board. */
function boardKey(): string {
  const q = new URLSearchParams(window.location.search);
  q.delete(PARAM);
  const rest = q.toString();
  return window.location.pathname + (rest ? `?${rest}` : "");
}

function seenBefore(): SeenBefore {
  if (typeof window === "undefined") return "unknown";
  try {
    const key = boardKey();
    const raw: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    const seen: string[] = Array.isArray(raw) ? raw.filter((s) => typeof s === "string") : [];
    if (seen.includes(key)) return "repeat";
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, key].slice(-SEEN_CAP)));
    return "new";
  } catch {
    // Nothing readable to go on. Say so, rather than booking a stranger as a
    // returning manager or a returning manager as somebody new.
    return "unknown";
  }
}

/** Reports the arrival once per visit. Pass null on a page that is only
    sometimes the end of a shared link — hooks cannot be called conditionally. */
export function useShareOpened(kind: ShareKind | null) {
  const sent = useRef(false);
  useEffect(() => {
    if (!kind || sent.current) return;
    sent.current = true;
    analytics.shareOpened(kind, readVia(), seenBefore());
  }, [kind]);
}
