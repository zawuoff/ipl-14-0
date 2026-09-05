import type { PlayerSeason, TeamSeason } from "./types";
import { buildSquadPlayers } from "./squads";

// ---- Franchise meta (colour + eras) ----
const FRANCHISES: {
  franchise: string;
  code: (season: number) => string;
  name: (season: number) => string;
  colour: string;
  seasons: number[];
}[] = [
  {
    franchise: "MI",
    code: () => "MI",
    name: () => "Mumbai Indians",
    colour: "#004BA0",
    seasons: range(2008, 2025),
  },
  {
    franchise: "RCB",
    code: () => "RCB",
    name: (s) => (s >= 2024 ? "Royal Challengers Bengaluru" : "Royal Challengers Bangalore"),
    colour: "#EC1C24",
    seasons: range(2008, 2025),
  },
  {
    franchise: "KKR",
    code: () => "KKR",
    name: () => "Kolkata Knight Riders",
    colour: "#3A225D",
    seasons: range(2008, 2025),
  },
  {
    franchise: "CSK",
    code: () => "CSK",
    name: () => "Chennai Super Kings",
    colour: "#FDB913",
    seasons: [...range(2008, 2015), ...range(2018, 2025)],
  },
  {
    franchise: "RR",
    code: () => "RR",
    name: () => "Rajasthan Royals",
    colour: "#EA1A85",
    seasons: [...range(2008, 2015), ...range(2018, 2025)],
  },
  {
    franchise: "DEL",
    code: (s) => (s >= 2019 ? "DC" : "DD"),
    name: (s) => (s >= 2019 ? "Delhi Capitals" : "Delhi Daredevils"),
    colour: "#17479E",
    seasons: range(2008, 2025),
  },
  {
    franchise: "PUN",
    code: (s) => (s >= 2021 ? "PBKS" : "KXIP"),
    name: (s) => (s >= 2021 ? "Punjab Kings" : "Kings XI Punjab"),
    colour: "#E81828",
    seasons: range(2008, 2025),
  },
  {
    franchise: "DCH",
    code: () => "DCH",
    name: () => "Deccan Chargers",
    colour: "#143975",
    seasons: range(2008, 2012),
  },
  {
    franchise: "SRH",
    code: () => "SRH",
    name: () => "Sunrisers Hyderabad",
    colour: "#FF822A",
    seasons: range(2013, 2025),
  },
  {
    franchise: "KTK",
    code: () => "KTK",
    name: () => "Kochi Tuskers Kerala",
    colour: "#E25B13",
    seasons: [2011],
  },
  {
    franchise: "PWI",
    code: () => "PWI",
    name: () => "Pune Warriors India",
    colour: "#00A9E0",
    seasons: [2011, 2012, 2013],
  },
  {
    franchise: "GL",
    code: () => "GL",
    name: () => "Gujarat Lions",
    colour: "#EB5E0B",
    seasons: [2016, 2017],
  },
  {
    franchise: "RPS",
    code: () => "RPS",
    name: (s) => (s === 2016 ? "Rising Pune Supergiants" : "Rising Pune Supergiant"),
    colour: "#2D0140",
    seasons: [2016, 2017],
  },
  {
    franchise: "GT",
    code: () => "GT",
    name: () => "Gujarat Titans",
    colour: "#1B1F3B",
    seasons: range(2022, 2025),
  },
  {
    franchise: "LSG",
    code: () => "LSG",
    name: () => "Lucknow Super Giants",
    colour: "#0057E2",
    seasons: range(2022, 2025),
  },
];

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function teamIdFor(franchise: string, season: number): string {
  const f = FRANCHISES.find((x) => x.franchise === franchise)!;
  return `${f.code(season)}-${season}`;
}

export function buildTeamSeasons(): TeamSeason[] {
  const out: TeamSeason[] = [];
  for (const f of FRANCHISES) {
    for (const s of f.seasons) {
      out.push({
        teamId: `${f.code(s)}-${s}`,
        franchise: f.franchise,
        season: s,
        code: f.code(s),
        name: f.name(s),
        colour: f.colour,
      });
    }
  }
  return out.sort((a, b) => a.season - b.season || a.teamId.localeCompare(b.teamId));
}

// ---- Full player pool: 156 REAL researched squads (~1,870 player-seasons) ----
export function buildPlayerSeasons(): PlayerSeason[] {
  return buildSquadPlayers();
}

// Squads by team for spin->draft lookup
export function squadByTeam(players: PlayerSeason[]): Map<string, PlayerSeason[]> {
  const m = new Map<string, PlayerSeason[]>();
  for (const p of players) {
    const arr = m.get(p.teamId) ?? [];
    arr.push(p);
    m.set(p.teamId, arr);
  }
  return m;
}

export { teamIdFor };
