import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Deterministic daily spins from date hash — same for everyone, no race.
// Uses seeded teams from DB when available, else hardcoded fallback pool.
const FALLBACK_POOL = [
  "MI-2019", "CSK-2011", "DCH-2009", "RCB-2016", "KKR-2012",
  "SRH-2016", "RR-2008", "DD-2012", "KXIP-2014", "GT-2023",
  "CSK-2018", "MI-2020", "RCB-2025", "KTK-2011", "PWI-2011",
  "GL-2016", "RPS-2017", "LSG-2024", "DC-2020", "RR-2022",
];

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const getToday = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const stored = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (stored) return stored;
    const teams = await ctx.db.query("teamSeasons").collect();
    const pool =
      teams.length >= 11 ? teams.map((t) => t.teamId).sort() : FALLBACK_POOL;
    const rng = mulberry(hashStr("14-0:" + args.date));
    const picked: string[] = [];
    const copy = [...pool];
    while (picked.length < 11 && copy.length) {
      const i = Math.floor(rng() * copy.length);
      picked.push(copy.splice(i, 1)[0]);
    }
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
    const teams = await ctx.db.query("teamSeasons").collect();
    const pool =
      teams.length >= 11 ? teams.map((t) => t.teamId).sort() : FALLBACK_POOL;
    const rng = mulberry(hashStr("14-0:" + args.date));
    const picked: string[] = [];
    const copy = [...pool];
    while (picked.length < 11 && copy.length) {
      const i = Math.floor(rng() * copy.length);
      picked.push(copy.splice(i, 1)[0]);
    }
    return await ctx.db.insert("dailyChallenges", {
      date: args.date,
      spins: picked,
      salt: `daily-${args.date}`,
      createdAt: Date.now(),
    });
  },
});
