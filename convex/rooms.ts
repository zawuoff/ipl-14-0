import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

const configValidator = v.object({
  Opener: v.number(),
  Middle: v.number(),
  WK: v.number(),
  AR: v.number(),
  Pace: v.number(),
  Spin: v.number(),
});

function cleanName(n: string): string {
  return n.trim().slice(0, 14) || "Manager";
}

export const create = mutation({
  args: { name: v.string(), difficulty: v.string(), deviceId: v.string() },
  handler: async (ctx, args) => {
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const taken = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!taken) break;
      code = makeCode();
    }
    const roomSeed = Math.floor(Math.random() * 0xffffffff);
    const id = await ctx.db.insert("rooms", {
      code,
      roomSeed,
      difficulty: args.difficulty,
      members: [],
      createdAt: Date.now(),
    });
    // host auto-joins (XI submitted after their draft)
    await ctx.db.patch(id, {
      members: [
        {
          deviceId: args.deviceId,
          name: cleanName(args.name),
          config: { Opener: 2, Middle: 3, WK: 1, AR: 2, Pace: 2, Spin: 1 },
          picks: [],
          seed: "",
          submittedAt: 0,
        },
      ],
    });
    return { code, roomSeed };
  },
});

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
  },
});

export const join = mutation({
  args: { code: v.string(), name: v.string(), deviceId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    if (!room) throw new Error("Room not found");
    const members = [...room.members];
    const mine = members.findIndex((m) => m.deviceId === args.deviceId);
    if (mine < 0) {
      if (members.length >= 2) throw new Error("Room is full");
      members.push({
        deviceId: args.deviceId,
        name: cleanName(args.name),
        config: { Opener: 2, Middle: 3, WK: 1, AR: 2, Pace: 2, Spin: 1 },
        picks: [],
        seed: "",
        submittedAt: 0,
      });
      await ctx.db.patch(room._id, { members });
    }
    return { code: room.code };
  },
});

// Lock in your XI (after your draft). Re-submits overwrite (rematch-friendly).
export const submitXI = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
    config: configValidator,
    picks: v.array(v.string()),
    seed: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    if (!room) throw new Error("Room not found");
    if (args.picks.length !== 11) throw new Error("XI needs exactly 11 picks");
    const members = [...room.members];
    const i = members.findIndex((m) => m.deviceId === args.deviceId);
    if (i < 0) throw new Error("Join the room first");
    members[i] = {
      ...members[i],
      config: args.config,
      picks: args.picks,
      seed: args.seed,
      submittedAt: Date.now(),
    };
    await ctx.db.patch(room._id, { members });
    const ready = members.filter((m) => m.picks.length === 11).length;
    return { ready };
  },
});
