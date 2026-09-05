# 14-0 · IPL Draft — chase the perfect season

38-0.app loop, rebuilt for IPL cricket. Spin a wheel across **real franchise-seasons
(IPL 2008–2025, 156 team-seasons incl. Deccan, Kochi, Pune Warriors, GL, RPS)**,
draft 1 player from each squad into an XI (11 picks, 2 rerolls), then simulate a
**14-game league + playoffs** chasing a perfect **14-0**.

## Stack

- Next.js 16 (App Router) + Tailwind v4 + TypeScript
- Convex (tables: `playerSeasons`, `teamSeasons`, `drafts`, `simResults`, `dailyChallenges`)
- Seeded, verifiable sim (mulberry32) — every result reproduces from its seed

## Run it

```bash
npm install
# env (dev deployment wired):
# NEXT_PUBLIC_CONVEX_URL=https://exciting-owl-14.convex.cloud
npm run dev
```

Backend (needs `CONVEX_DEPLOY_KEY` in env):

```bash
npx convex dev --once --typecheck disable  # push schema + functions
npx convex run seed:seedAll                # 156 teams + curated player subset
npx convex data                            # verify
```

## Game rules

- Roles: **2 Opener · 3 Middle · 1 WK/Finisher · 2 AR · 2 Pace · 1 Spin**, max **4 overseas**
- Invalid XI still sims, but power-penalized per violation
- Difficulty: Rookie (−7 opp) / Pro / Legend (+7 opp)
- Daily challenge: same 11 spins for everyone (IST date), deterministic from date hash
- Share: `/r/<seed>` verifiable result page + emoji-grid copy card
- 1v1-lite: result card has “send this exact wheel” → friend opens `/?challenge=<11 teamIds>`

## Ratings

Derived from real season stats (runs/SR/avg, wkts/econ), 1–99, visible on Rookie/Pro,
hidden on Legend. Full pool ships in `src/lib/game/squads-*.json` — **156 real
researched squads, 1,872 player-seasons**; Convex tables hold a 63-player subset
for queries/daily pool.

## Layout

- `convex/schema.ts` — 5 tables
- `convex/drafts.ts|results.ts|daily.ts|seed.ts` — persistence, leaderboard, daily, seeding
- `src/lib/game/types.ts` — roles, XI validation, seed format (`VHHH-SSSS`), IST daily key
- `src/lib/game/data.ts` — 156 team-seasons + curated stars
- `src/lib/sim/engine.ts` — team strength, ball-level score gen, 14-game + playoff sim
- `src/components/GameBoard.tsx` — wheel → draft → XI → suspense sim → share
- `src/app/r/[seed]/page.tsx` — verifiable share route
