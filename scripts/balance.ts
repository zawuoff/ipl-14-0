/* How often each setting wins the trophy, measured rather than guessed.

   Drafts thousands of XIs the way people actually draft, plays each one
   through the real season sim, and prints the rates per setting:

     npx tsx scripts/balance.ts            5000 seasons per row
     npx tsx scripts/balance.ts 20000      more, for a tighter read
     ROOKIE_MOD=-4 npx tsx scripts/balance.ts   try an opposition modifier
     ROOKIE_REROLLS=2 npx tsx scripts/balance.ts   try a re-spin count
     DAILY_POOL=fallback npx tsx scripts/balance.ts  daily rows on the old 20-squad pool

   Settings print by their stored names: Rookie is Easy, Pro Medium, Legend Hard.

   Two kinds of manager:
   - "sharp" takes the best-rated player that fits an open place and re-spins
     any squad whose best fit is under 82. The daily row is sharp too, playing
     the same eleven squads a day the way a returning player does.
   - "casual" picks from the top three fits at random and only re-spins a
     squad whose best fit is under 76. */
import { buildPlayerSeasons, buildTeamSeasons, squadByTeam } from "../src/lib/game/data";
import { assignRole } from "../src/lib/game/roles";
import {
  MAX_OVERSEAS,
  REROLLS,
  ROLE_QUOTA,
  mulberry32,
  type Difficulty,
  type PlayerSeason,
  type Role,
} from "../src/lib/game/types";
import { DIFF_MOD, simSeason } from "../src/lib/sim/engine";

const N = Number(process.argv[2] ?? 5000);
if (process.env.ROOKIE_MOD) DIFF_MOD.Rookie = Number(process.env.ROOKIE_MOD);
if (process.env.ROOKIE_REROLLS) REROLLS.Rookie = Number(process.env.ROOKIE_REROLLS);

// The twenty squads convex/daily.ts fell back to while production had no teamSeasons rows.
const FALLBACK_POOL = [
  "MI-2019", "CSK-2011", "DCH-2009", "RCB-2016", "KKR-2012", "SRH-2016", "RR-2008", "DD-2012", "KXIP-2014", "GT-2023",
  "CSK-2018", "MI-2020", "RCB-2025", "KTK-2011", "PWI-2011", "GL-2016", "RPS-2017", "LSG-2024", "DC-2020", "RR-2022",
];

const PLAYERS = buildPlayerSeasons();
const SQUADS = squadByTeam(PLAYERS);
const TEAMS = buildTeamSeasons().map((t) => t.teamId);

type Skill = "sharp" | "casual";

function draft(rng: () => number, diff: Difficulty, skill: Skill, fixed?: string[]): PlayerSeason[] {
  const open: Record<Role, number> = { ...ROLE_QUOTA };
  const xi: PlayerSeason[] = [];
  const used = new Set<string>();
  const seen = new Set<string>();
  let rerolls = REROLLS[diff];
  let turn = 0;
  const floor = skill === "sharp" ? 82 : 76;
  const randomTeam = () => {
    let t: string;
    do t = TEAMS[Math.floor(rng() * TEAMS.length)];
    while (seen.has(t));
    return t;
  };
  let team = fixed ? fixed[0] : randomTeam();
  let guard = 0;
  while (xi.length < 11 && guard++ < 200) {
    seen.add(team);
    const overseas = xi.filter((p) => p.overseas).length;
    const fits: PlayerSeason[] = [];
    for (const p of SQUADS.get(team) ?? []) {
      if (used.has(p.player)) continue;
      if (p.overseas && overseas >= MAX_OVERSEAS) continue;
      for (const r of p.eligible) if (open[r] > 0) fits.push(assignRole(p, r));
    }
    fits.sort((a, b) => b.overall - a.overall);
    const nextTeam = () => {
      turn++;
      return fixed && turn < fixed.length && !seen.has(fixed[turn]) ? fixed[turn] : randomTeam();
    };
    if (!fits.length) {
      team = randomTeam(); // a dead spin re-spins for free
      continue;
    }
    if (fits[0].overall < floor && rerolls > 0) {
      rerolls--;
      team = randomTeam();
      continue;
    }
    const pick = skill === "sharp" ? fits[0] : fits[Math.floor(rng() * Math.min(3, fits.length))];
    xi.push(pick);
    used.add(pick.player);
    open[pick.role]--;
    team = nextTeam();
  }
  return xi;
}

function run(diff: Difficulty, skill: Skill, daily: boolean) {
  let champ = 0, playoffs = 0, perfect = 0, wins = 0;
  for (let i = 0; i < N; i++) {
    const rng = mulberry32((i * 2654435761 + (daily ? 7 : 0) + (skill === "sharp" ? 13 : 0)) >>> 0);
    // A day's squads, and the same manager coming back to them a few times.
    const day = daily ? mulberry32(Math.floor(i / 5) + 1000) : null;
    const pool = process.env.DAILY_POOL === "fallback" ? FALLBACK_POOL : TEAMS;
    const fixed = day ? [...pool].sort(() => day() - 0.5).slice(0, 11) : undefined;
    const xi = draft(rng, diff, skill, fixed);
    if (xi.length < 11) continue;
    const r = simSeason(xi, Math.floor(rng() * 2 ** 32) >>> 0, diff);
    wins += r.wins;
    if (r.madePlayoffs) playoffs++;
    if (r.champion) champ++;
    if (r.wins === 14) perfect++;
  }
  const pct = (n: number) => `${((100 * n) / N).toFixed(1)}%`.padStart(6);
  console.log(
    `${diff.padEnd(7)} ${(daily ? "daily" : "classic").padEnd(8)} ${skill.padEnd(7)} ` +
      `wins ${(wins / N).toFixed(1).padStart(4)}  playoffs ${pct(playoffs)}  title ${pct(champ)}  14-0 ${pct(perfect)}`
  );
}

console.log(`opposition modifier: Rookie ${DIFF_MOD.Rookie}, Pro ${DIFF_MOD.Pro}, Legend ${DIFF_MOD.Legend}; re-spins Rookie ${REROLLS.Rookie}; ${N} seasons a row\n`);
for (const diff of ["Rookie", "Pro", "Legend"] as Difficulty[]) {
  run(diff, "casual", false);
  run(diff, "sharp", false);
  run(diff, "sharp", true);
}
