import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// 14-0 IPL draft game — MVP schema, no auth (anonymous deviceId)
export default defineSchema({
  playerSeasons: defineTable({
    player: v.string(), // "Virat Kohli"
    country: v.string(), // "India"
    overseas: v.boolean(),
    teamId: v.string(), // "RCB-2016"
    franchise: v.string(), // "RCB"
    season: v.number(), // 2016
    role: v.union(
      v.literal("Opener"),
      v.literal("Middle"),
      v.literal("WK"),
      v.literal("AR"),
      v.literal("Pace"),
      v.literal("Spin")
    ),
    runs: v.number(),
    sr: v.number(),
    avg: v.number(),
    wickets: v.number(),
    econ: v.number(),
    bat: v.number(), // 1-99 hidden until drafted
    bowl: v.number(), // 1-99 hidden until drafted
    overall: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_role", ["role"])
    .index("by_player", ["player"]),

  teamSeasons: defineTable({
    teamId: v.string(), // "MI-2019"
    franchise: v.string(),
    season: v.number(),
    code: v.string(), // era-accurate short code
    name: v.string(),
    colour: v.string(),
  }).index("by_teamId", ["teamId"]),

  drafts: defineTable({
    seed: v.string(), // "1abc-def0" verifiable
    deviceId: v.string(), // anon client id, no auth
    mode: v.union(v.literal("classic"), v.literal("daily")),
    dailyDate: v.optional(v.string()), // "2026-09-04" for daily
    difficulty: v.union(
      v.literal("Rookie"),
      v.literal("Pro"),
      v.literal("Legend")
    ),
    spins: v.array(v.string()), // teamIds in spin order
    picks: v.array(v.string()), // playerSeason ids (= `${player}|${teamId}`), length <= 11
    rerollsLeft: v.number(),
    status: v.union(
      v.literal("drafting"),
      v.literal("complete"),
      v.literal("simulated")
    ),
    createdAt: v.number(),
  })
    .index("by_seed", ["seed"])
    .index("by_daily", ["dailyDate"])
    .index("by_device", ["deviceId"]),

  simResults: defineTable({
    seed: v.string(),
    draftId: v.optional(v.id("drafts")),
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
    perfect14: v.boolean(), // 14-0 league
    games: v.array(
      v.object({
        opp: v.string(),
        gf: v.string(), // "187/6"
        ga: v.string(), // "172/8"
        result: v.union(v.literal("W"), v.literal("L")),
        margin: v.string(), // "15 runs" / "6 wkts (8 balls left)"
      })
    ),
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
    createdAt: v.number(),
  })
    .index("by_seed", ["seed"])
    .index("by_daily", ["dailyDate"])
    .index("by_device", ["deviceId"]),

  dailyChallenges: defineTable({
    date: v.string(), // "2026-09-04" IST
    spins: v.array(v.string()), // same 11 teamIds for all
    salt: v.string(), // sim salt for the day
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  challenges: defineTable({    code: v.string(), // 6-char room code
    spins: v.array(v.string()), // locked wheel for both players
    config: v.object({
      Opener: v.number(),
      Middle: v.number(),
      WK: v.number(),
      AR: v.number(),
      Pace: v.number(),
      Spin: v.number(),
    }),
    difficulty: v.string(),
    creatorDevice: v.string(),
    // up to 2 entries: creator + one opponent
    entries: v.array(
      v.object({
        deviceId: v.string(),
        seed: v.string(),
        wins: v.number(),
        losses: v.number(),
        nrr: v.number(),
        champion: v.boolean(),
        perfect14: v.boolean(),
      })
    ),
    createdAt: v.number(),
  }).index("by_code", ["code"]),
  // Shared-league multiplayer rooms: both managers + names in ONE table.
  // The season sim is deterministic from roomSeed + both XIs, so every
  // client computes the identical league — no result conflicts, ever.
  rooms: defineTable({
    code: v.string(),
    roomSeed: v.number(),
    difficulty: v.string(),
    members: v.array(
      v.object({
        deviceId: v.string(),
        name: v.string(),
        config: v.object({
          Opener: v.number(),
          Middle: v.number(),
          WK: v.number(),
          AR: v.number(),
          Pace: v.number(),
          Spin: v.number(),
        }),
        picks: v.array(v.string()), // playerSeason ids
        seed: v.string(),
        submittedAt: v.number(),
      })
    ),
    createdAt: v.number(),
  }).index("by_code", ["code"]),
});
