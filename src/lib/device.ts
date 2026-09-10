"use client";

/* Who this browser is, as far as the board is concerned.

   There is no sign-in anywhere in the game, so an anonymous id in localStorage
   is what carries a streak, a name on the leaderboard, and a claim on a run.
   Losing it is losing all three, which is why it is only ever written once.

   The storage key keeps the old name deliberately. It is how a returning player
   is recognised; renaming it orphans every existing device and wipes every
   streak, so the rename to BuildXI stops here. */
const KEY = "14-0-device";

export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let d = localStorage.getItem(KEY);
  if (!d) {
    d = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, d);
  }
  return d;
}
