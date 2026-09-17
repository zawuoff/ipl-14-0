/* The best XI the game's own ratings allow, worked out rather than asserted.

   /all-time-ipl-xi is a page of claims — this player, that season, and the
   ones the four-overseas rule keeps out. Written by hand those claims would
   be true on the day and quietly wrong after the next ratings pass, so they
   are derived here from the same squads and the same rules the draft uses:
   STYLE_TEMPLATES[0] for the shape, MAX_OVERSEAS for the cap. Change a rating
   in squads-*.json and the page changes with it. */
import { buildPlayerSeasons, buildTeamSeasons } from "./data";
import { MAX_OVERSEAS, STYLE_TEMPLATES, type Role } from "./types";

export interface XIPick {
  player: string;
  country: string;
  overseas: boolean;
  role: Role;
  teamId: string;
  teamName: string;
  season: number;
  rating: number;
}

export interface XI {
  picks: XIPick[];
  total: number;
  overseas: number;
}

const ORDER: Role[] = ["Opener", "Middle", "WK", "AR", "Pace", "Spin"];
const SHAPE = STYLE_TEMPLATES[0].config;

/* One row per player: his best-rated season, in the role that season was
   filed under. A player who kept wicket in one year and opened in another is
   only ever offered as whichever of those he was better at, because the draft
   would not let you pick him twice either. */
function pool(): Map<Role, XIPick[]> {
  const teamName = new Map(buildTeamSeasons().map((t) => [t.teamId, t.name]));
  const bestInRole = new Map<string, XIPick>();

  for (const p of buildPlayerSeasons()) {
    const key = `${p.player}|${p.role}`;
    const held = bestInRole.get(key);
    if (held && held.rating >= p.overall) continue;
    bestInRole.set(key, {
      player: p.player,
      country: p.country,
      overseas: p.overseas,
      role: p.role,
      teamId: p.teamId,
      teamName: teamName.get(p.teamId) ?? p.franchise,
      season: p.season,
      rating: p.overall,
    });
  }

  const bestOverall = new Map<string, XIPick>();
  for (const pick of bestInRole.values()) {
    const held = bestOverall.get(pick.player);
    if (!held || pick.rating > held.rating) bestOverall.set(pick.player, pick);
  }

  const byRole = new Map<Role, XIPick[]>(ORDER.map((r) => [r, []]));
  for (const pick of bestOverall.values()) byRole.get(pick.role)?.push(pick);
  for (const list of byRole.values())
    list.sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player));
  return byRole;
}

const POOL = pool();

/** The best players in one role, whoever they are, in rating order. */
export function shortlist(role: Role, n: number): XIPick[] {
  return (POOL.get(role) ?? []).slice(0, n);
}

/* Inside a role, players differ only by nationality: the best way to fill k
   places using exactly o overseas is always the top o overseas and the top
   k - o Indians. That makes each role a lookup rather than a search, and the
   only thing left to decide is how to spend the overseas budget across the
   six of them. */
function roleSplits(role: Role, k: number): (XIPick[] | null)[] {
  const list = POOL.get(role) ?? [];
  const away = list.filter((p) => p.overseas);
  const home = list.filter((p) => !p.overseas);
  return Array.from({ length: k + 1 }, (_, o) =>
    away.length >= o && home.length >= k - o ? [...away.slice(0, o), ...home.slice(0, k - o)] : null
  );
}

function solve(budget: number): XI {
  type State = { picks: XIPick[]; total: number; overseas: number };
  let states: State[] = [{ picks: [], total: 0, overseas: 0 }];

  for (const role of ORDER) {
    const k = SHAPE[role];
    const splits = roleSplits(role, k);
    const next = new Map<number, State>();
    for (const state of states) {
      splits.forEach((picks, o) => {
        if (!picks) return;
        const overseas = state.overseas + o;
        if (overseas > budget) return;
        const total = state.total + picks.reduce((s, p) => s + p.rating, 0);
        const held = next.get(overseas);
        if (!held || total > held.total)
          next.set(overseas, { picks: [...state.picks, ...picks], total, overseas });
      });
    }
    states = [...next.values()];
  }

  const best = states.reduce((a, b) => (b.total > a.total ? b : a));
  const rank = new Map(ORDER.map((r, i) => [r, i]));
  return {
    ...best,
    picks: [...best.picks].sort(
      (a, b) => rank.get(a.role)! - rank.get(b.role)! || b.rating - a.rating
    ),
  };
}

/** The strongest legal XI: the game's shape, and no more overseas than allowed. */
export const ALL_TIME_XI: XI = solve(MAX_OVERSEAS);

/** The same XI with the overseas rule switched off — what the cap costs. */
export const UNCAPPED_XI: XI = solve(11);

/** The best overseas players the cap keeps out of the XI, in rating order. */
export function overseasLeftOut(n: number): XIPick[] {
  const chosen = new Set(ALL_TIME_XI.picks.map((p) => p.player));
  return ORDER.flatMap((r) => POOL.get(r) ?? [])
    .filter((p) => p.overseas && !chosen.has(p.player))
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
    .slice(0, n);
}
