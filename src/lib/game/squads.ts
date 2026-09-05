import type { PlayerSeason, Role } from "./types";
import SA from "./squads-a.json";
import SB from "./squads-b.json";
import SC from "./squads-c.json";
import SD from "./squads-d.json";

type RawSquad = { t: string; s: [string, string, string, number][] };

const ALL_SQUADS: RawSquad[] = [
  ...(SA as unknown as RawSquad[]),
  ...(SB as unknown as RawSquad[]),
  ...(SC as unknown as RawSquad[]),
  ...(SD as unknown as RawSquad[]),
];

const CODE_TO_FRANCHISE: Record<string, string> = {
  MI: "MI", RCB: "RCB", KKR: "KKR", CSK: "CSK", RR: "RR",
  DD: "DEL", DC: "DEL", KXIP: "PUN", PBKS: "PUN",
  DCH: "DCH", SRH: "SRH", KTK: "KTK", PWI: "PWI",
  GL: "GL", RPS: "RPS", GT: "GT", LSG: "LSG",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Ratings drive the sim; runs/wickets are plausible that-season shapes for display.
function synthStats(role: Role, rating: number) {
  if (role === "Pace" || role === "Spin") {
    const wickets = clamp(Math.round((rating - 52) * 0.72), 4, 32);
    const econ = Math.round(clamp(9.6 - (rating - 58) * 0.075, 5.4, 9.8) * 100) / 100;
    return { runs: 0, sr: 0, avg: 0, wickets, econ };
  }
  const runs = clamp(Math.round(rating * 6.4), 120, 950);
  const sr = clamp(Math.round(118 + (rating - 62) * 1.35), 105, 205);
  const avg = Math.round((18 + (rating - 58) * 0.85) * 10) / 10;
  if (role === "AR") {
    return {
      runs: Math.round(runs * 0.55),
      sr, avg,
      wickets: clamp(Math.round((rating - 52) * 0.45), 2, 18),
      econ: Math.round(clamp(9.6 - (rating - 58) * 0.07, 6.2, 9.6) * 100) / 100,
    };
  }
  return { runs, sr, avg, wickets: 0, econ: 0 };
}

export function buildSquadPlayers(): PlayerSeason[] {
  const out: PlayerSeason[] = [];
  for (const sq of ALL_SQUADS) {
    const dash = sq.t.lastIndexOf("-");
    const code = sq.t.slice(0, dash);
    const season = parseInt(sq.t.slice(dash + 1), 10);
    const franchise = CODE_TO_FRANCHISE[code] ?? code;
    for (const [player, country, roleRaw, rating] of sq.s) {
      const role = roleRaw as Role;
      let bat = rating;
      let bowl = rating;
      if (role === "Opener" || role === "Middle" || role === "WK") {
        bat = rating;
        bowl = Math.max(5, Math.min(40, Math.round(rating * 0.3)));
      } else if (role === "Pace" || role === "Spin") {
        bowl = rating;
        bat = Math.max(5, Math.min(38, Math.round(rating * 0.28)));
      } else {
        bat = Math.max(40, rating - 2);
        bowl = Math.max(40, rating - 4);
      }
      const st = synthStats(role, rating);
      out.push({
        id: `${player}|${sq.t}`,
        player,
        country,
        overseas: country !== "India",
        teamId: sq.t,
        franchise,
        season,
        role,
        runs: st.runs,
        sr: st.sr,
        avg: st.avg,
        wickets: st.wickets,
        econ: st.econ,
        bat,
        bowl,
        overall: rating,
      });
    }
  }
  return out;
}

export function squadCount(): { teams: number; players: number } {
  let players = 0;
  for (const sq of ALL_SQUADS) players += sq.s.length;
  return { teams: ALL_SQUADS.length, players };
}
