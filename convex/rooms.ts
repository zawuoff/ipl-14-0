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

// A room is a ten-team league with the managers taking seats off the top, so
// five is as many as can share one without crowding the franchises out.
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
function seats(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return MIN_PLAYERS;
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(n)));
}

const BLANK_CONFIG = { Opener: 2, Middle: 3, WK: 1, AR: 2, Pace: 2, Spin: 1 };

export const create = mutation({
  args: {
    name: v.string(),
    difficulty: v.string(),
    deviceId: v.string(),
    maxPlayers: v.optional(v.number()),
  },
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
    const maxPlayers = seats(args.maxPlayers);
    const id = await ctx.db.insert("rooms", {
      code,
      roomSeed,
      difficulty: args.difficulty,
      maxPlayers,
      members: [],
      createdAt: Date.now(),
    });
    // host auto-joins (XI submitted after their draft)
    await ctx.db.patch(id, {
      members: [
        {
          deviceId: args.deviceId,
          name: cleanName(args.name),
          config: { ...BLANK_CONFIG },
          picks: [],
          seed: "",
          submittedAt: 0,
        },
      ],
    });
    return { code, roomSeed, maxPlayers };
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
      if (members.length >= seats(room.maxPlayers)) throw new Error("Room is full");
      members.push({
        deviceId: args.deviceId,
        name: cleanName(args.name),
        config: { ...BLANK_CONFIG },
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

// A manager has watched their season to the end. Until everyone has, the room
// result stays hidden so an early exit can't spoil a final still being watched.
export const finish = mutation({
  args: { code: v.string(), deviceId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    if (!room) throw new Error("Room not found");
    const members = [...room.members];
    const i = members.findIndex((m) => m.deviceId === args.deviceId);
    if (i < 0) return { ok: false };
    if (members[i].finishedAt) return { ok: true };
    members[i] = { ...members[i], finishedAt: Date.now() };
    await ctx.db.patch(room._id, { members });
    return { ok: true };
  },
});

// The host waited long enough: shut the empty seats and play with whoever is
// here. Never shrinks below the people already in the room, and only the host
// (the first seat) can do it.
export const closeSeats = mutation({
  args: { code: v.string(), deviceId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    if (!room) throw new Error("Room not found");
    if (room.members[0]?.deviceId !== args.deviceId) throw new Error("Only the host can do that");
    const maxPlayers = seats(room.members.length);
    await ctx.db.patch(room._id, { maxPlayers });
    return { maxPlayers };
  },
});
