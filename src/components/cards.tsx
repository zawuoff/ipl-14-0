"use client";
import { useMemo, useState } from "react";
import type { PlayerSeason } from "@/lib/game/types";

export function ratingColor(r: number): string {
  if (r >= 93) return "text-amber-300";
  if (r >= 87) return "text-emerald-300";
  if (r >= 80) return "text-sky-300";
  return "text-zinc-300";
}

export function RoleBadge({ role }: { role: PlayerSeason["role"] }) {
  const c: Record<string, string> = {
    Opener: "bg-orange-500/20 text-orange-200 border-orange-400/30",
    Middle: "bg-sky-500/20 text-sky-200 border-sky-400/30",
    WK: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30",
    AR: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    Pace: "bg-red-500/20 text-red-200 border-red-400/30",
    Spin: "bg-violet-500/20 text-violet-200 border-violet-400/30",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c[role]}`}>{role}</span>
  );
}

export function PlayerCard({
  p,
  revealed,
  onPick,
  disabled,
}: {
  p: PlayerSeason;
  revealed: boolean;
  onPick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      disabled={disabled || !onPick}
      className={`text-left rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition disabled:opacity-60 ${
        onPick ? "cursor-pointer hover:border-amber-300/50 hover:shadow-[0_0_24px_-6px_rgba(251,191,36,.5)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm leading-tight">{p.player}</div>
        {p.overseas && <span title="Overseas" className="text-xs">✈️</span>}
      </div>
      <div className="text-[11px] text-zinc-400 mt-0.5">
        {p.teamId} · {p.country}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <RoleBadge role={p.role} />
        {revealed ? (
          <span className={`text-xs font-bold ${ratingColor(p.overall)}`}>{p.overall}</span>
        ) : (
          <span className="text-xs text-zinc-500">???</span>
        )}
      </div>
      {revealed && (
        <div className="text-[11px] text-zinc-400 mt-1">
          {p.role === "Pace" || p.role === "Spin"
            ? `${p.wickets} wkts · ${p.econ} econ`
            : `${p.runs} runs · SR ${p.sr}`}
        </div>
      )}
    </button>
  );
}

export function useShareText(args: {
  seed: string;
  wins: number;
  losses: number;
  champion: boolean;
  perfect14: boolean;
  games: { result: "W" | "L" }[];
  difficulty: string;
}): string {
  return useMemo(() => {
    const boxes = args.games.map((g) => (g.result === "W" ? "🟩" : "🟥")).join("");
    const title = args.perfect14
      ? "🏆 14-0 PERFECT SEASON!"
      : args.champion
        ? `🏆 CHAMPIONS (${args.wins}-0 run ended ${args.wins}-${args.losses})`
        : `${args.wins}-${args.losses} season`;
    return `14-0 IPL Draft ${title}\n${boxes}\n${args.difficulty} · 14-0.app/r/${args.seed}\nCan you go 14-0?`;
  }, [args]);
}
