import { query } from "./_generated/server";
import { v } from "convex/values";

/* What the country did with the game today.
   Everything here reads one indexed day of rows and counts in memory. The
   client already ships the full player and squad tables, so this returns ids
   and counts only — names, colours and ratings are resolved on the client. */

// Convex runs in UTC; the game's day rolls over at midnight IST (UTC+5:30).
export function istDay(ms: number): string {
  return new Date(ms + 330 * 60000).toISOString().slice(0, 10);
}

// A day of play is small, but bound the reads anyway so a viral day cannot
// turn the home page into a table scan.
const MAX_ROWS = 4000;
const TOP_PICKS = 40;

export const homeToday = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const [results, drafts] = await Promise.all([
      ctx.db
        .query("simResults")
        .withIndex("by_day", (q) => q.eq("day", date))
        .take(MAX_ROWS),
      ctx.db
        .query("drafts")
        .withIndex("by_day", (q) => q.eq("day", date))
        .take(MAX_ROWS),
    ]);

    // How the seasons went.
    let perfect14 = 0;
    let champions = 0;
    let bestWins = -1;
    let bestLosses = 0;
    let bestNrr: number | null = null;
    for (const r of results) {
      if (r.perfect14) perfect14++;
      if (r.champion) champions++;
      if (r.wins > bestWins) {
        bestWins = r.wins;
        bestLosses = r.losses;
      }
      if (bestNrr === null || r.nrr > bestNrr) bestNrr = r.nrr;
    }

    // What people drafted. A draft row is upserted by seed, so a run counts
    // once however many times it was saved along the way.
    const picks = new Map<string, number>();
    const squads = new Map<string, number>();
    for (const d of drafts) {
      for (const id of d.picks) picks.set(id, (picks.get(id) ?? 0) + 1);
      for (const teamId of d.spins) squads.set(teamId, (squads.get(teamId) ?? 0) + 1);
    }

    const topPicks = [...picks.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_PICKS)
      .map(([id, count]) => ({ id, count }));

    const topSquad = [...squads.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0];

    return {
      date,
      drafts: drafts.length,
      runs: results.length,
      perfect14,
      champions,
      best: bestWins < 0 ? null : { wins: bestWins, losses: bestLosses },
      bestNrr,
      topPicks,
      topSquad: topSquad ? { teamId: topSquad[0], count: topSquad[1] } : null,
      // How many of today's drafts are still on the board rather than played.
      drafting: drafts.filter((d) => d.status === "drafting").length,
    };
  },
});
