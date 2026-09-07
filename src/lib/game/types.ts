// 14-0 game-loop types — spin -> draft x11 -> sim 14 + playoffs
// Roles: 2 Opener, 3 Middle, 1 WK/Finisher, 2 AR, 2 Pace, 1 Spin. Max 4 overseas.

export type Role = "Opener" | "Middle" | "WK" | "AR" | "Pace" | "Spin";
export type Difficulty = "Rookie" | "Pro" | "Legend";
export type GameMode = "classic" | "daily";

export interface TeamSeason {
  teamId: string; // "MI-2019"
  franchise: string;
  season: number;
  code: string;
  name: string;
  colour: string;
}

export interface PlayerSeason {
  id: string; // `${player}|${teamId}`
  player: string;
  country: string;
  overseas: boolean;
  teamId: string;
  franchise: string;
  season: number;
  role: Role;
  runs: number;
  sr: number;
  avg: number;
  wickets: number;
  econ: number;
  bat: number; // 1-99
  bowl: number; // 1-99
  overall: number;
}

export interface Spin {
  index: number; // 0..10
  teamId: string;
  rerolled?: boolean;
}

export interface DraftState {
  seed: string;
  mode: GameMode;
  difficulty: Difficulty;
  config: XIConfig;
  spins: Spin[];
  picks: (PlayerSeason | null)[]; // len 11
  rerollsLeft: number;
  status: "drafting" | "complete";
}

export const ROLE_QUOTA: Record<Role, number> = {
  Opener: 2,
  Middle: 3,
  WK: 1,
  AR: 2,
  Pace: 2,
  Spin: 1,
};

// Team styles (38-0 formation-picker equivalent): role quotas always sum to 11.
export type XIConfig = Record<Role, number>;
export interface StyleTemplate {
  name: string;
  blurb: string;
  config: XIConfig;
}
export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    name: "Balanced",
    blurb: "The classic",
    config: { Opener: 2, Middle: 3, WK: 1, AR: 2, Pace: 2, Spin: 1 },
  },
  {
    name: "Pace Attack",
    blurb: "Three quicks, one spinner",
    config: { Opener: 2, Middle: 3, WK: 1, AR: 1, Pace: 3, Spin: 1 },
  },
  {
    name: "Spin Twins",
    blurb: "Two spinners strangle",
    config: { Opener: 2, Middle: 3, WK: 1, AR: 2, Pace: 1, Spin: 2 },
  },
  {
    name: "Batting Heavy",
    blurb: "Four middle-order guns",
    config: { Opener: 2, Middle: 4, WK: 1, AR: 1, Pace: 2, Spin: 1 },
  },
];

export const MAX_OVERSEAS = 4;
export const TOTAL_PICKS = 11;

// How many spins you may throw away. Rookie can shop around, Pro gets one
// mulligan, Legend takes what the board gives.
export const REROLLS: Record<Difficulty, number> = {
  Rookie: 3,
  Pro: 1,
  Legend: 0,
};

export function validateXI(xi: PlayerSeason[], config: XIConfig = ROLE_QUOTA): {
  valid: boolean;
  errors: string[];
  overseas: number;
  counts: Record<Role, number>;
} {
  const counts: Record<Role, number> = {
    Opener: 0,
    Middle: 0,
    WK: 0,
    AR: 0,
    Pace: 0,
    Spin: 0,
  };
  for (const p of xi) counts[p.role]++;
  const errors: string[] = [];
  (Object.keys(config) as Role[]).forEach((r) => {
    if (counts[r] !== config[r])
      errors.push(`${r}: need ${config[r]}, have ${counts[r]}`);
  });
  const overseas = xi.filter((p) => p.overseas).length;
  if (overseas > MAX_OVERSEAS)
    errors.push(`Max ${MAX_OVERSEAS} overseas, have ${overseas}`);
  if (xi.length !== 11) errors.push(`Need 11 players, have ${xi.length}`);
  // WK eligibility is structural (role WK) — no extra check needed for MVP
  return { valid: errors.length === 0, errors, overseas, counts };
}

export function nextSlotIndex(picks: (PlayerSeason | null)[]): number {
  return picks.findIndex((p) => p === null);
}

// ---- verifiable seed: VHHH-SSSS, 8x base36 ----
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function toBase36(n: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s = B36[n % 36] + s;
    n = Math.floor(n / 36);
  }
  return s;
}

export function canonicalSpins(spins: string[], seedSalt = ""): string {
  return spins.join(",") + "|" + seedSalt;
}

export function makeSeed(spins: string[]): string {
  const hhh = fnv1a32(canonicalSpins(spins)) % 46656;
  const ssss = Math.floor(Math.random() * 36 ** 4);
  return `1${toBase36(hhh, 3)}-${toBase36(ssss, 4)}`;
}

export function simU32FromSeed(seed: string, spins: string[]): number {
  const clean = seed.replace("-", "");
  return fnv1a32(`1:${clean}:${spins.join(",")}`) >>> 0;
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Daily key: IST date string YYYY-MM-DD
export function istDateKey(d = new Date()): string {
  const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
  return ist.toISOString().slice(0, 10);
}
