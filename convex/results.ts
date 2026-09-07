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
    const lim = Math.min(50, args.limit ?? 20);
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
    filtered.sort(
      (a, b) =>
        b.wins - a.wins || (b.champion ? 1 : 0) - (a.champion ? 1 : 0) || b.nrr - a.nrr
    );
    return filtered.slice(0, lim).map((r) => ({
      seed: r.seed,
      deviceId: r.deviceId.slice(0, 6),
      mode: r.mode,
      difficulty: r.difficulty,
      wins: r.wins,
      losses: r.losses,
      nrr: r.nrr,
      champion: r.champion,
      perfect14: r.perfect14,
    }));
  },
});
