import { NextResponse } from "next/server";

/* The server's clock, so a board's day does not depend on the reader's.

   Everything day-shaped — which challenge you are served, which runs count as
   today's — was read off the device clock, so a phone a day out got the wrong
   game. This is the one piece of truth the client cannot work out for itself.
   Never prerendered, never cached: a stale answer here is the bug it fixes. */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
