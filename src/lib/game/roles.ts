// Who can fill which slot, and what it costs to ask.
//
// A player-season carries one role, but cricketers are not one thing: Kohli
// opened, KL Rahul kept and opened, Jadeja bats seven and bowls four. Modelling
// role as a single value made six team-seasons unfillable (Lucknow 2024 has no
// opener on paper, because its two openers are both filed WK) and pushed the
// draft into a fallback that offered Sachin Tendulkar for a 2024 squad.
//
// Eligibility is built in three layers, cheapest first:
//   1. career union  — the roles a player is coded in ANYWHERE in the data.
//                      Free, and already true: 56 of 436 players carry two.
//   2. this matrix   — rule-derived moves, each with a rating cost.
//   3. traits        — per-player gates and half-price moves (player-traits.ts).
//
// The cost is the point. Without it every batter opens, the role quota stops
// binding, and the draft loses the decision that makes it a game.

import { ALSO_KEEPS, arBowlingRole, VERSATILE, WK_OPENERS } from "./player-traits";
import type { PlayerSeason, Role } from "./types";

/** What a move out of a player's filed role costs, in rating points.
    Absent pairs are impossible: pace never turns into spin, a batter never
    keeps wicket, and nobody crosses between batting and bowling except an AR. */
const OFF_ROLE_COST: Partial<Record<Role, Partial<Record<Role, number>>>> = {
  Opener: { Middle: 3, WK: 4 }, // WK gated on ALSO_KEEPS
  Middle: { Opener: 5, WK: 4 }, // ditto
  WK: { Middle: 2, Opener: 6 }, // Opener gated on WK_OPENERS
  AR: { Middle: 4, Pace: 4, Spin: 4 }, // bowling side gated on how they bowl
  Pace: { AR: 8 },
  Spin: { AR: 8 },
};

function allowed(player: string, from: Role, to: Role): boolean {
  // Keeping is the one job nobody improvises, so WK opens only to a named keeper.
  if (to === "WK") return from !== "WK" && ALSO_KEEPS.has(player);
  if (OFF_ROLE_COST[from]?.[to] === undefined) return false;
  if (from === "WK" && to === "Opener") return WK_OPENERS.has(player);
  if (from === "AR" && (to === "Pace" || to === "Spin")) return arBowlingRole(player) === to;
  return true;
}

/** Rating points lost moving `player` from `from` into `to`. A genuine two-role
    cricketer pays half, rounded down but never quite free. */
export function offRoleCost(player: string, from: Role, to: Role): number {
  if (from === to) return 0;
  const full = OFF_ROLE_COST[from]?.[to] ?? 0;
  return VERSATILE.has(player) ? Math.max(1, Math.floor(full / 2)) : full;
}

/** Every role this player-season may be drafted into, filed role first.
    `careerRoles` is the union of roles the player holds across all 156 squads. */
export function eligibleRoles(
  player: string,
  filed: Role,
  careerRoles: ReadonlySet<Role>
): Role[] {
  const out = new Set<Role>([filed, ...careerRoles]);
  for (const from of [...out]) {
    for (const to of Object.keys(OFF_ROLE_COST[from] ?? {}) as Role[]) {
      if (allowed(player, from, to)) out.add(to);
    }
  }
  // Filed role leads; the rest follow in a stable order so the chips never jump.
  const order: Role[] = ["Opener", "Middle", "WK", "AR", "Pace", "Spin"];
  return [filed, ...order.filter((r) => r !== filed && out.has(r))];
}

/** The cheapest way into `to` from anything this player is natively coded as.
    A player filed Middle who also kept in some season reaches Opener through
    whichever door costs less. */
export function cheapestCost(p: PlayerSeason, to: Role): number {
  if (p.role === to) return 0;
  let best = Infinity;
  for (const from of p.native) {
    if (from === to) return 0;
    if (!allowed(p.player, from, to)) continue;
    best = Math.min(best, offRoleCost(p.player, from, to));
  }
  return Number.isFinite(best) ? best : 0;
}

function clamp(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

/** The player as they would take the field in `to`.
 *
 * The cost lands on the ability the new job actually needs, which is what makes
 * the sim feel it: `teamStrength` averages `bat` over the batting roles and
 * `bowl` over the bowling ones. A seamer shoved into an all-rounder slot keeps
 * his real bat of 27 and joins the batting pool with it — the XI is punished for
 * the shape, not by a number invented for the occasion.
 */
export function assignRole(p: PlayerSeason, to: Role): PlayerSeason {
  if (p.role === to) return p;
  const cost = cheapestCost(p, to);
  const batting = to === "Opener" || to === "Middle" || to === "WK";
  const bowling = to === "Pace" || to === "Spin";
  return {
    ...p,
    role: to,
    offRole: true,
    filedRole: p.filedRole ?? p.role,
    bat: clamp(p.bat - (batting || to === "AR" ? cost : 0)),
    bowl: clamp(p.bowl - (bowling || to === "AR" ? cost : 0)),
    overall: clamp(p.overall - cost),
  };
}

/* ---- persistence ----
   Convex stores an XI as player-season ids, which say who was taken but not what
   they were taken AS. An off-role pick would come back from a room or a shared
   board in its filed role and sim as a different player. Appending the role keeps
   ids opaque strings, so nothing in the schema has to change and every id written
   before multi-role existed still decodes to exactly what it always meant. */
const ROLE_MARK = "@";

export function encodePick(p: PlayerSeason): string {
  return p.offRole ? `${p.id}${ROLE_MARK}${p.role}` : p.id;
}

/** Rebuild a pick from a stored id. `lookup` resolves the base player-season. */
export function decodePick(
  stored: string,
  lookup: (id: string) => PlayerSeason | undefined
): PlayerSeason | undefined {
  const at = stored.lastIndexOf(ROLE_MARK);
  if (at < 0) return lookup(stored);
  const base = lookup(stored.slice(0, at));
  const role = stored.slice(at + 1) as Role;
  if (!base) return undefined;
  return base.eligible.includes(role) ? assignRole(base, role) : base;
}

/** What this player would be rated in each role they can fill. Drives the chips. */
export function roleRatings(p: PlayerSeason): { role: Role; overall: number }[] {
  return p.eligible.map((r) => ({ role: r, overall: clamp(p.overall - cheapestCost(p, r)) }));
}
