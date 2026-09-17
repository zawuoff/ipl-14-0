import { buildTeamSeasons } from "./data";

/* Today's eleven squads, one function for the server and the browser.

   Until 17 Sep 2026 the server drew them from a hand-picked list of twenty
   famous squads, because it looked for team rows in the database that
   production never had. Those twenty are three rating points stronger at the
   top than the game as a whole, and eleven of twenty came round every day, so
   the daily was the easiest way to a trophy in the game: 83% on Rookie. From
   18 Sep it draws from all 156, the same as a normal draft.

   Dates already played keep the old pool, so a past day still deals the squads
   its board was played on. The "14-0:" seed prefix is frozen for the same
   reason: changing it would deal a different day to a date people already
   played. */

export const LEGACY_DAILY_POOL = [
  "MI-2019", "CSK-2011", "DCH-2009", "RCB-2016", "KKR-2012",
  "SRH-2016", "RR-2008", "DD-2012", "KXIP-2014", "GT-2023",
  "CSK-2018", "MI-2020", "RCB-2025", "KTK-2011", "PWI-2011",
  "GL-2016", "RPS-2017", "LSG-2024", "DC-2020", "RR-2022",
];

/** The first IST date dealt from every team-season. */
export const FULL_DAILY_POOL_FROM = "2026-09-18";

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

/** The eleven team-season ids for an IST date ("2026-09-18"). */
export function dailySpins(date: string): string[] {
  const pool =
    date < FULL_DAILY_POOL_FROM ? LEGACY_DAILY_POOL : buildTeamSeasons().map((t) => t.teamId).sort();
  const rng = mulberry(hashStr("14-0:" + date));
  const copy = [...pool];
  const out: string[] = [];
  while (out.length < 11 && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}
