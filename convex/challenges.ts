import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { maskDevices } from "./privacy";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export const create = mutation({
  args: {
    spins: v.array(v.string()),
    config: v.object({
      Opener: v.number(),
      Middle: v.number(),
      WK: v.number(),
      AR: v.number(),
      Pace: v.number(),
      Spin: v.number(),
    }),
    difficulty: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.spins.length !== 11) throw new Error("Room needs exactly 11 spins");
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const taken = await ctx.db
        .query("challenges")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!taken) break;
      code = makeCode();
    }
    const id = await ctx.db.insert("challenges", {
      code,
      spins: args.spins,
      config: args.config,
      difficulty: args.difficulty,
      creatorDevice: args.deviceId,
      entries: [],
      createdAt: Date.now(),
    });
    return { code, id };
  },
});

// Readable by anyone with the code, so no device id leaves it (see privacy.ts).
export const get = query({
  args: { code: v.string(), deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("challenges")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    if (!challenge) return null;
    const { creatorDevice, ...rest } = challenge;
    const scope = `challenge:${challenge.code}`;
    return {
      ...rest,
      creatorIsYou: !!args.deviceId && creatorDevice === args.deviceId,
      entries: await maskDevices(challenge.entries, scope, args.deviceId),
    };
  },
});

const entryValidator = v.object({
  deviceId: v.string(),
  seed: v.string(),
  wins: v.number(),
  losses: v.number(),
  nrr: v.number(),
  champion: v.boolean(),
  perfect14: v.boolean(),
});

// Submit (or overwrite) your entry. Room holds max 2 distinct players:
// the creator + the first opponent. Re-submits from the same device update.
export const submit = mutation({
  args: { code: v.string(), entry: entryValidator },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("challenges")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    if (!room) throw new Error("Room not found");
    const entries = [...room.entries];
    const mine = entries.findIndex((e) => e.deviceId === args.entry.deviceId);
    if (mine >= 0) {
      entries[mine] = args.entry;
    } else {
      if (entries.length >= 2) throw new Error("Room is full — already claimed");
      entries.push(args.entry);
    }
    await ctx.db.patch(room._id, { entries });
    return { entries: entries.length };
  },
});
