import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { istDay } from "./stats";

const gameValidator = v.object({
  opp: v.string(),
  gf: v.string(),
  ga: v.string(),
  result: v.union(v.literal("W"), v.literal("L")),
  margin: v.string(),
  superOver: v.optional(v.string()),
});

export const saveResult = mutation({
  args: {
    seed: v.string(),
    deviceId: v.string(),
    name: v.optional(v.string()),
    mode: v.union(v.literal("classic"), v.literal("daily")),
    dailyDate: v.optional(v.string()),
    difficulty: v.string(),
    wins: v.number(),
    losses: v.number(),
    points: v.number(),
    nrr: v.number(),
    madePlayoffs: v.boolean(),
    champion: v.boolean(),
    perfect14: v.boolean(),
    games: v.array(gameValidator),
    playoffs: v.optional(
      v.array(
        v.object({
          stage: v.string(),
          gf: v.string(),
          ga: v.string(),
          result: v.union(v.literal("W"), v.literal("L")),
          margin: v.string(),
        })
      )
    ),
    teamBat: v.number(),
    teamBowl: v.number(),
    power: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("simResults")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
    if (existing) return existing._id;
    // mark draft simulated
    const draft = await ctx.db
      .query("drafts")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
    const draftId = draft?._id;
    if (draft) await ctx.db.patch(draft._id, { status: "simulated" });
    const now = Date.now();
    return await ctx.db.insert("simResults", {
      ...args,
      draftId,
      createdAt: now,
      day: istDay(now),
    });
  },
});

export const getBySeed = query({
  args: { seed: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("simResults")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
    if (!result) return null;
    const draft = result.draftId ? await ctx.db.get(result.draftId) : null;
    return { result, draft };
  },
});

/* ---- How the board ranks a season ----

   Wins alone were never the right measure: they are not comparable across
   difficulties, so a Rookie side that won 13 sat above a Legend side that won
   the whole thing. What the game actually asks of you is, in order:

   1. A perfect 14-0. That is the whole point of the game, so it tops the board
      on any setting — Rookie included.
   2. The trophy. Between two champions the harder setting wins, whatever the
      records say: winning it on Legend is a bigger night than winning it on
      Rookie with three more league wins.
   3. Everything else, where nobody won anything and the record is all there is
      to go on — so wins lead, and difficulty only splits a tie. */

const DIFF_RANK: Record<string, number> = { Legend: 3, Pro: 2, Rookie: 1 };
function diffRank(difficulty: string): number {
  return DIFF_RANK[difficulty] ?? 0;
}

interface Ranked {
  difficulty: string;
  wins: number;
  nrr: number;
  champion: boolean;
  perfect14: boolean;
  madePlayoffs: boolean;
}

/** 0 = a perfect season, 1 = champions, 2 = the rest. */
function tier(r: Ranked): number {
  return r.perfect14 ? 0 : r.champion ? 1 : 2;
}

export function compareRuns(a: Ranked, b: Ranked): number {
  const byTier = tier(a) - tier(b);
  if (byTier !== 0) return byTier;
  if (tier(a) === 2) {
    return (
      b.wins - a.wins ||
      Number(b.madePlayoffs) - Number(a.madePlayoffs) ||
      diffRank(b.difficulty) - diffRank(a.difficulty) ||
      b.nrr - a.nrr
    );
  }
  // Two of the same kind of night. What separates them is what it was won on.
  return (
    diffRank(b.difficulty) - diffRank(a.difficulty) ||
    Number(b.champion) - Number(a.champion) ||
    b.wins - a.wins ||
    b.nrr - a.nrr
  );
}

export const leaderboard = query({
  args: {
    mode: v.optional(v.union(v.literal("classic"), v.literal("daily"))),
    dailyDate: v.optional(v.string()),
    // Every run played on one IST day, whichever mode it was. `dailyDate` is
    // narrower: only runs of that day's shared challenge.
    day: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = Math.min(100, args.limit ?? 20);
    let rows;
    if (args.day) {
      rows = await ctx.db
        .query("simResults")
        .withIndex("by_day", (q) => q.eq("day", args.day))
        .take(4000);
    } else if (args.dailyDate) {
      rows = await ctx.db
        .query("simResults")
        .withIndex("by_daily", (q) => q.eq("dailyDate", args.dailyDate))
        .collect();
    } else {
      rows = await ctx.db.query("simResults").collect();
    }
    const filtered = args.mode ? rows.filter((r) => r.mode === args.mode) : rows;
    filtered.sort(compareRuns);
    return filtered.slice(0, lim).map((r) => ({
      seed: r.seed,
      deviceId: r.deviceId.slice(0, 6),
      name: r.name,
      mode: r.mode,
      difficulty: r.difficulty,
      wins: r.wins,
      losses: r.losses,
      nrr: r.nrr,
      champion: r.champion,
      perfect14: r.perfect14,
      // The row says "made the playoffs" or "missed" off this. It was never
      // sent, so every run that reached the top four read as having missed it.
      madePlayoffs: r.madePlayoffs,
    }));
  },
});
