"use client";
import { fnv1a32, type PlayerSeason } from "@/lib/game/types";
import { ratingTone, readableOn } from "./ui";
import { useT } from "@/lib/i18n";

function PlayerRow({
  p,
  hideRatings,
  onPick,
  reason,
  teamColour,
}: {
  p: PlayerSeason;
  hideRatings?: boolean;
  onPick?: (p: PlayerSeason) => void;
  reason?: string;
  teamColour?: string;
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
  return (
    <button
      onClick={onPick && !off ? () => onPick(p) : undefined}
      disabled={!onPick || off}
      title={reason}
      className={`w-full flex items-center gap-3 py-2.5 text-left border-t border-hairline transition-colors ${
        off ? "cursor-not-allowed" : "hover:bg-white/8 cursor-pointer"
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
        <span className={`text-[13px] leading-[18px] truncate ${off ? "text-faint" : "text-muted"}`}>
          {off ? reason : p.overseas ? `${p.country} · ${t("xi.overseas")}` : p.country}
        </span>
      </span>
      {/* The role is what makes a name takeable, so it carries the accent. */}
      <span
        className={`w-[84px] shrink-0 text-right font-semibold text-[14px] leading-[18px] ${
          off ? "text-faint" : "text-accent"
        }`}
      >
        {t(`role.${p.role}`)}
      </span>
    </button>
  );
}

export function SquadList({
  squad,
  hideRatings,
  shuffleKey,
  onPick,
  unavailable,
  teamColour,
}: {
  squad: PlayerSeason[];
  hideRatings?: boolean;
  // Legend hides the numbers, so the order must not give them away either.
  // Hashing the seed with each player id shuffles the list in a way that is
  // stable across renders and reproducible from the seed.
  shuffleKey?: string;
  onPick?: (p: PlayerSeason) => void;
  // playerId -> reason the pick is blocked (role slot filled / overseas cap)
  unavailable?: Map<string, string>;
  teamColour?: string;
}) {
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
              reason={unavailable?.get(p.id)}
              teamColour={teamColour}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
