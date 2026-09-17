import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { dailySpins } from "../src/lib/game/daily";

// Deterministic daily spins from the date — same for everyone, no race. The
// pool and the draw live in src/lib/game/daily.ts, shared with the browser.

export const getToday = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const stored = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (stored) return stored;
    const picked = dailySpins(args.date);
    return { date: args.date, spins: picked, salt: `daily-${args.date}`, createdAt: 0, _id: null as never, _creationTime: 0 };
  },
});

export const ensureToday = mutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing) return existing._id;
    const picked = dailySpins(args.date);
    return await ctx.db.insert("dailyChallenges", {
      date: args.date,
      spins: picked,
      salt: `daily-${args.date}`,
      createdAt: Date.now(),
    });
  },
});
