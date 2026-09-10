import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { istDay } from "./stats";

/* Somebody went fourteen and nothing and lifted the cup, and would like the
   card that gets sent for it.

   Nothing in here ever returns a name or an address. The one query below
   answers a yes-or-no question about the caller's own device and returns a
   seed, which is already public — it is in the URL of every shared run. The
   promise that stands is the one that matters: no field a person typed into
   that form is readable by the app, on any path, so it cannot reach anybody
   else's browser. The names and addresses are read in the dashboard.

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

/* Fourteen wins and the cup, and then the reader closed the card prompt without
   filling it in. Perhaps they meant to, perhaps their thumb landed badly, and
   the thing that earned it happens once in a few thousand runs — so the next
   time they open the game they get asked once more, and then never again.

   Answers only about the device that asked, returns only a seed, and is not
   called at all unless the browser has an unanswered ask on record. */
export const outstanding = query({
  args: { deviceId: v.string() },
  returns: v.union(v.null(), v.object({ seed: v.string() })),
  handler: async (ctx, args) => {
    const unbeaten = await ctx.db
      .query("simResults")
      .withIndex("by_device_perfect", (q) =>
        q.eq("deviceId", args.deviceId).eq("perfect14", true)
      )
      .order("desc")
      .take(10);

    for (const run of unbeaten) {
      // perfect14 is the league alone; the cup is the other half of it.
      if (!run.champion) continue;
      const claimed = await ctx.db
        .query("giftClaims")
        .withIndex("by_seed", (q) => q.eq("seed", run.seed))
        .first();
      // Their best run is already spoken for, so there is nothing to chase.
      if (claimed) return null;
      return { seed: run.seed };
    }
    return null;
  },
});

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
