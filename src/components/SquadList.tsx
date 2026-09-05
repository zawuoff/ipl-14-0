"use client";
import type { PlayerSeason, Role } from "@/lib/game/types";

// 38-0-style squad rows: rating square (role colour) + name/country + role tag.
export const ROLE_SQUARE: Record<Role, string> = {
  Opener: "bg-orange-500",
  Middle: "bg-sky-500",
  WK: "bg-fuchsia-500",
  AR: "bg-emerald-500",
  Pace: "bg-red-500",
  Spin: "bg-violet-500",
};

export const ROLE_TAG: Record<Role, string> = {
  Opener: "bg-orange-500/15 text-orange-200",
  Middle: "bg-sky-500/15 text-sky-200",
  WK: "bg-fuchsia-500/15 text-fuchsia-200",
  AR: "bg-emerald-500/15 text-emerald-200",
  Pace: "bg-red-500/15 text-red-200",
  Spin: "bg-violet-500/15 text-violet-200",
};

export function SquadList({
  squad,
  hideRatings,
  onPick,
  unavailable,
}: {
  squad: PlayerSeason[];
  hideRatings?: boolean;
  onPick?: (p: PlayerSeason) => void;
  // playerId -> reason the pick is blocked (role slot filled / overseas cap)
  unavailable?: Map<string, string>;
}) {
  const rows = [...squad].sort((a, b) => {
    const au = unavailable?.has(a.id) ? 1 : 0;
    const bu = unavailable?.has(b.id) ? 1 : 0;
    if (au !== bu) return au - bu; // available first, greyed at bottom
    return b.overall - a.overall;
  });
  return (
    <div className="space-y-1.5">
      {rows.map((p) => {
        const reason = unavailable?.get(p.id);
        const off = !!reason;
        return (
          <button
            key={p.id}
            onClick={onPick && !off ? () => onPick(p) : undefined}
            disabled={!onPick || off}
            title={reason}
            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              off
                ? "border-white/[0.04] bg-white/[0.01] opacity-40 grayscale cursor-not-allowed"
                : "border-white/[0.07] bg-white/[0.03] hover:border-emerald-300/50 hover:bg-emerald-400/[0.07] cursor-pointer"
            }`}
          >
            <span
              className={`w-10 h-10 shrink-0 rounded-lg ${ROLE_SQUARE[p.role]} flex items-center justify-center font-black text-white text-[15px]`}
            >
              {hideRatings ? "?" : p.overall}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-[15px] leading-tight truncate">
                {p.player} {p.overseas && <span className="text-xs">✈️</span>}
              </span>
              <span className="block text-xs text-zinc-400">
                {off ? reason : `${p.country} · ${p.teamId}`}
              </span>
            </span>
            <span className={`ml-auto text-[10px] font-bold px-2 py-1 rounded-md shrink-0 ${ROLE_TAG[p.role]}`}>
              {p.role === "WK" ? "WK" : p.role.toUpperCase().slice(0, 5)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
