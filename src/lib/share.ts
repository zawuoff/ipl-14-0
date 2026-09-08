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

/** Reports the arrival once per visit. Pass null on a page that is only
    sometimes the end of a shared link — hooks cannot be called conditionally. */
export function useShareOpened(kind: ShareKind | null) {
  const sent = useRef(false);
  useEffect(() => {
    if (!kind || sent.current) return;
    sent.current = true;
    analytics.shareOpened(kind, readVia());
  }, [kind]);
}
