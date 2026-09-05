"use client";
import type { PlayerSeason, Role, XIConfig } from "@/lib/game/types";

// Left panel: XI slots grouped by role, driven by the chosen style config.
const GROUP_META: { role: Role; label: string; color: string }[] = [
  { role: "Opener", label: "OPENERS", color: "bg-orange-500" },
  { role: "Middle", label: "MIDDLE ORDER", color: "bg-sky-500" },
  { role: "WK", label: "KEEPER", color: "bg-fuchsia-500" },
  { role: "AR", label: "ALL-ROUNDERS", color: "bg-emerald-500" },
  { role: "Pace", label: "PACE", color: "bg-red-500" },
  { role: "Spin", label: "SPIN", color: "bg-violet-500" },
];

export function XIPanel({
  picks,
  overseas,
  power,
  avg,
  hideRatings,
  config,
}: {
  picks: (PlayerSeason | null)[];
  overseas: number;
  power?: number | null;
  avg?: number | null;
  hideRatings?: boolean;
  config: XIConfig;
}) {
  const filled = picks.filter(Boolean) as PlayerSeason[];
  const remaining = [...filled];
  const takeFor = (role: Role): PlayerSeason | null => {
    const i = remaining.findIndex((p) => p.role === role);
    if (i < 0) return null;
    return remaining.splice(i, 1)[0];
  };
  // slots per group from config (hard caps mean overflow shouldn't happen — shown anyway as safety)
  const groups = GROUP_META.filter((g) => (config[g.role] ?? 0) > 0).map((g) => ({
    ...g,
    slots: Array.from({ length: config[g.role] }, () => takeFor(g.role)),
  }));
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0f1c] p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black tracking-wide text-sm">
          YOUR XI <span className="text-zinc-400 font-semibold">· {filled.length}/11</span>
        </h3>
        <span className="text-xs text-zinc-400">
          ✈️ {overseas}/4
          {avg != null && filled.length > 0 && (
            <> · AVG <b className="text-white">{avg}</b></>
          )}
          {power != null && (
            <> · PWR <b className="text-emerald-300">{power}</b></>
          )}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">
              {g.label} <span className="text-zinc-600">({g.slots.filter(Boolean).length}/{g.slots.length})</span>
            </div>
            <div className="space-y-1">
              {g.slots.map((p, i) =>
                p ? (
                  <div
                    key={g.role + i}
                    className="flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1.5"
                  >
                    <span className={`w-2 h-2 rounded-full ${g.color}`} />
                    <span className="text-sm font-semibold truncate">{p.player}</span>
                    {p.overseas && <span className="text-[10px]">✈️</span>}
                    <span className="ml-auto text-xs font-bold text-emerald-300">
                      {hideRatings ? "?" : p.overall}
                    </span>
                  </div>
                ) : (
                  <div
                    key={g.role + i}
                    className="rounded-lg border border-dashed border-white/15 px-2.5 py-1.5 text-xs text-zinc-600"
                  >
                    + {g.role}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
        {remaining.length > 0 && (
          <div>
            <div className="text-[10px] tracking-[0.2em] text-red-400 mb-1">EXTRA (OVER QUOTA)</div>
            {remaining.map((p) => (
              <div key={p.id} className="text-xs text-red-300 px-2 py-1">
                {p.player} · {p.role}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-3 text-[10px] text-zinc-500">
        <span>🟠 Open</span>
        <span>🔵 Middle</span>
        <span>🟢 AR</span>
        <span>🔴 Pace</span>
      </div>
    </div>
  );
}
