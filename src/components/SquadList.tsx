"use client";
import { useState } from "react";
import { roleRatings } from "@/lib/game/roles";
import { fnv1a32, type PlayerSeason, type Role } from "@/lib/game/types";
import { ratingTone, readableOn } from "./ui";
import { useT } from "@/lib/i18n";

function PlayerRow({
  p,
  hideRatings,
  onPick,
  openRoles,
  reason,
  teamColour,
  expanded,
  onToggle,
}: {
  p: PlayerSeason;
  hideRatings?: boolean;
  onPick?: (p: PlayerSeason, as?: Role) => void;
  openRoles?: (p: PlayerSeason) => Role[];
  reason?: string;
  teamColour?: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const t = useT();
  const off = !!reason;
  // Ratings visible: the tile carries the rating heat. Legend mode: no number
  // to colour, so the tile wears the squad's own colour instead.
  const tile = off
    ? { bg: "#16244A", fg: "rgba(255,255,255,0.45)" }
    : hideRatings
      ? { bg: teamColour ?? "#000000", fg: readableOn(teamColour ?? "#000000") }
      : ratingTone(p.overall);

  // The tray only earns its tap when there is a real choice. One open slot and
  // the row behaves exactly as it always has: tap, picked, next spin.
  const open = off ? [] : (openRoles?.(p) ?? [p.role]);
  const choice = open.length > 1;
  const ratings = choice ? roleRatings(p) : [];

  return (
    <div className={`border-t border-hairline ${expanded ? "bg-white/8" : ""}`}>
      <button
        onClick={onPick && !off ? (choice ? onToggle : () => onPick(p, open[0])) : undefined}
        disabled={!onPick || off}
        title={reason}
        aria-expanded={choice ? !!expanded : undefined}
        className={`w-full flex items-center gap-3 py-2.5 text-left transition-colors ${
          off ? "cursor-not-allowed" : expanded ? "cursor-pointer" : "hover:bg-white/8 cursor-pointer"
        }`}
      >
        <span
          className="flex items-center justify-center w-11 h-11 shrink-0 rounded-control font-display font-bold text-[26px] leading-[26px] pt-[3px] tabular"
          style={{ backgroundColor: tile.bg, color: tile.fg }}
        >
          {hideRatings ? "?" : p.overall}
        </span>
        <span className="flex flex-col flex-1 min-w-0">
          <span
            className={`font-medium text-[16px] leading-[22px] truncate ${off ? "text-faint" : ""}`}
          >
            {p.player}
          </span>
          <span
            className={`text-[13px] leading-[18px] truncate ${off ? "text-faint" : "text-muted"}`}
          >
            {off ? reason : p.overseas ? `${p.country} · ${t("xi.overseas")}` : p.country}
          </span>
        </span>
        {/* The role is what makes a name takeable, so it carries the accent.
            When a player can cover more than one, say so instead of picking
            for them — the choice is the point. */}
        <span
          className={`w-[84px] shrink-0 text-right font-semibold text-[14px] leading-[18px] ${
            off ? "text-faint" : "text-accent"
          }`}
        >
          {choice ? t("draft.rolesN", { n: open.length }) : t(`role.${open[0] ?? p.role}`)}
        </span>
      </button>

      {choice && expanded && (
        <div
          role="radiogroup"
          aria-label={t("draft.chooseRole", { player: p.player })}
          className="flex flex-wrap gap-1.5 pl-14 pr-2 pb-3 pt-0.5"
        >
          {ratings.map(({ role, overall }) => {
            const canTake = open.includes(role);
            return (
              <button
                key={role}
                role="radio"
                aria-checked={false}
                disabled={!canTake}
                title={canTake ? undefined : t("draft.slotFilled", { role: t(`role.${role}`) })}
                onClick={() => canTake && onPick?.(p, role)}
                className={`flex items-baseline gap-1.5 px-2.5 h-9 rounded-control border text-[13px] font-semibold transition-colors ${
                  canTake
                    ? "border-accent/45 text-white hover:bg-accent hover:text-ground cursor-pointer"
                    : "border-hairline text-faint cursor-not-allowed"
                }`}
              >
                <span>{t(`roleShort.${role}`)}</span>
                {!hideRatings && (
                  <span className={`tabular text-[12px] ${canTake ? "text-muted" : "text-faint"}`}>
                    {overall}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SquadList({
  squad,
  hideRatings,
  shuffleKey,
  onPick,
  openRoles,
  unavailable,
  teamColour,
}: {
  squad: PlayerSeason[];
  hideRatings?: boolean;
  // Legend hides the numbers, so the order must not give them away either.
  // Hashing the seed with each player id shuffles the list in a way that is
  // stable across renders and reproducible from the seed.
  shuffleKey?: string;
  onPick?: (p: PlayerSeason, as?: Role) => void;
  // Which slots each player could still walk into — drives the role tray.
  openRoles?: (p: PlayerSeason) => Role[];
  // playerId -> reason the pick is blocked (role slot filled / overseas cap)
  unavailable?: Map<string, string>;
  teamColour?: string;
}) {
  // One tray at a time: two open at once turns a list into a puzzle.
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = [...squad].sort((a, b) => {
    const au = unavailable?.has(a.id) ? 1 : 0;
    const bu = unavailable?.has(b.id) ? 1 : 0;
    if (au !== bu) return au - bu; // available first, greyed at the bottom
    if (shuffleKey) return fnv1a32(shuffleKey + a.id) - fnv1a32(shuffleKey + b.id);
    return b.overall - a.overall;
  });

  // Desktop shows the whole squad at once, in two columns.
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)];

  return (
    <div className="flex flex-col xl:flex-row xl:gap-5 border-b border-hairline xl:border-b-0">
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col flex-1 min-w-0 xl:border-b xl:border-hairline">
          {col.map((p) => (
            <PlayerRow
              key={p.id}
              p={p}
              hideRatings={hideRatings}
              onPick={onPick}
              openRoles={openRoles}
              reason={unavailable?.get(p.id)}
              teamColour={teamColour}
              expanded={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
