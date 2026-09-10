import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { istDay } from "./stats";

/* Somebody went fourteen and nothing and lifted the cup, and would like the
   card that gets sent for it.

   This file has exactly one mutation and no query, on purpose. Nothing in the
   app ever reads a name or an address back out — the only way to see this table
   is the Convex dashboard, which is one account. A query here, however well
   scoped, would be a way for one person's address to reach another person's
   browser, and there is no version of that worth having.

   The gate is the run itself. A claim names a seed, and the seed has to already
   be sitting in simResults as an unbeaten season with the cup on top. That is
   not something a caller can assert: it is written by the sim when the season
   is played out. Anyone poking at the mutation directly gets nothing, and there
   is no rate limit to tune, because the thing being rate-limited is going
   14-0. */

// Deliberately loose. The job here is to catch a typo and a paste of the wrong
// thing, not to adjudicate RFC 5322 — a real address that this rejected would
// be a person who went unbeaten and got told no.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const claim = mutation({
  args: {
    seed: v.string(),
    deviceId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(
      v.union(v.literal("badName"), v.literal("badEmail"), v.literal("notEarned"))
    ),
  }),
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 60);
    const email = args.email.trim().toLowerCase();

    if (!name) return { ok: false, reason: "badName" as const };
    if (email.length > 254 || !LOOKS_LIKE_EMAIL.test(email)) {
      return { ok: false, reason: "badEmail" as const };
    }

    // The whole of the anti-spam story: the season has to have happened.
    const run = await ctx.db
      .query("simResults")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
    if (!run || !run.perfect14 || !run.champion) {
      return { ok: false, reason: "notEarned" as const };
    }

    // One card per run. Coming back to correct a typo should work, so a second
    // claim on the same seed overwrites rather than piling up.
    const existing = await ctx.db
      .query("giftClaims")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { name, email });
      return { ok: true };
    }

    const now = Date.now();
    await ctx.db.insert("giftClaims", {
      seed: args.seed,
      deviceId: args.deviceId,
      name,
      email,
      createdAt: now,
      day: istDay(now),
    });
    return { ok: true };
  },
});
