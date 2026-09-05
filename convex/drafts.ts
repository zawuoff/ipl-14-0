import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveDraft = mutation({
  args: {
    seed: v.string(),
    deviceId: v.string(),
    mode: v.union(v.literal("classic"), v.literal("daily")),
    dailyDate: v.optional(v.string()),
    difficulty: v.union(v.literal("Rookie"), v.literal("Pro"), v.literal("Legend")),
    spins: v.array(v.string()),
    picks: v.array(v.string()),
    rerollsLeft: v.number(),
    status: v.union(v.literal("drafting"), v.literal("complete"), v.literal("simulated")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("drafts")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, createdAt: existing.createdAt });
      return existing._id;
    }
    return await ctx.db.insert("drafts", { ...args, createdAt: now });
  },
});

export const getBySeed = query({
  args: { seed: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drafts")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
  },
});

export const squadForTeam = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("playerSeasons")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const allTeams = query({
  handler: async (ctx) => {
    return await ctx.db.query("teamSeasons").collect();
  },
});
