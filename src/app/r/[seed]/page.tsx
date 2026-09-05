"use client";
import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function SharePage({ params }: { params: Promise<{ seed: string }> }) {
  const { seed } = use(params);
  const data = useQuery((api as any).results?.getBySeed, { seed });

  return (
    <main className="min-h-screen bg-[#07070f] text-zinc-100">
      <div className="max-w-xl mx-auto px-4 py-10">
        <a href="/" className="text-sm text-zinc-400 hover:text-white">← 14-0 home</a>
        <h1 className="text-2xl font-black mt-2">14-0 · Result <span className="font-mono text-amber-300">/r/{seed}</span></h1>
        {data === undefined && <p className="text-sm text-zinc-500 mt-4">Verifying seed…</p>}
        {data === null && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            No recorded season for this seed yet — it may be a fresh draft link. Open the home page
            and run the draft; results save automatically with this seed.
          </div>
        )}
        {data && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xl font-black">
              {(data.result.perfect14 && "🏆 14-0 PERFECT SEASON") ||
                (data.result.champion && `🏆 CHAMPIONS ${data.result.wins}-${data.result.losses}`) ||
                `${data.result.wins}-${data.result.losses} SEASON`}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {data.result.difficulty} · {data.result.points} pts · NRR {data.result.nrr} · seed {data.result.seed}
            </div>
            <div className="mt-3 space-y-1.5">
              {data.result.games.map((g: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 border border-white/10 bg-black/30">
                  <span className="text-zinc-500 text-xs w-6">M{i + 1}</span>
                  <span>{g.result === "W" ? "🟩" : "🟥"}</span>
                  <span className="font-mono">YOU {g.gf}</span>
                  <span className="text-zinc-500">vs</span>
                  <span className="font-mono">{g.ga} {g.opp}</span>
                  <span className="ml-auto text-xs text-zinc-400">{g.margin}</span>
                </div>
              ))}
            </div>
            {data.result.playoffs?.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs tracking-[0.2em] text-zinc-400">PLAYOFFS</h3>
                {data.result.playoffs.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 border border-amber-300/20 bg-amber-400/5 mt-1.5">
                    <span className="text-xs text-zinc-400 w-24">{p.stage}</span>
                    <span className="font-mono">YOU {p.gf}</span>
                    <span className="text-zinc-500">vs</span>
                    <span className="font-mono">{p.ga}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-zinc-500 mt-3">
              Verifiable: same seed + spins reproduce this season deterministically. ✅ stored {new Date(data.result.createdAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
