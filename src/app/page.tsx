"use client";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GameBoard } from "@/components/GameBoard";
import { istDateKey } from "@/lib/game/types";

export default function Home() {
  const [screen, setScreen] = useState<"home" | "game" | "board">("home");
  const [mode, setMode] = useState<"classic" | "daily">("classic");
  const [gameKey, setGameKey] = useState(0);
  const today = istDateKey();
  const challengeSpins = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const c = new URLSearchParams(window.location.search).get("challenge");
    if (!c) return undefined;
    const parts = c.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length === 11 ? parts : undefined;
  }, []);
  const roomCode = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const c = new URLSearchParams(window.location.search).get("room");
    return c ? c.toUpperCase() : undefined;
  }, []);
  // deep links jump straight into the game
  const initialScreen = challengeSpins || roomCode ? "game" : "home";
  const [entered] = useState(initialScreen);
  const show = entered === "game" ? "game" : screen;

  const board = useQuery(
    (api as any).results?.leaderboard,
    show === "board" ? { limit: 20 } : "skip"
  );
  const dailyBoard = useQuery(
    (api as any).results?.leaderboard,
    show === "board" ? { dailyDate: today, limit: 20 } : "skip"
  );

  const play = (m: "classic" | "daily") => {
    setMode(m);
    setGameKey((k) => k + 1);
    setScreen("game");
  };

  return (
    <main className="min-h-screen bg-[#060a08] text-zinc-100">
      <header className="border-b border-white/10 bg-black/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setScreen("home")} className="text-xl font-black tracking-tight">
            14-0 <span className="text-emerald-300">🏏</span>
          </button>
          <nav className="ml-auto flex gap-1 text-sm">
            <button
              onClick={() => setScreen("game")}
              className={`px-3 py-1.5 rounded-lg ${show === "game" ? "bg-white text-black font-bold" : "bg-white/5 text-zinc-300"}`}
            >
              Play
            </button>
            <button
              onClick={() => setScreen("board")}
              className={`px-3 py-1.5 rounded-lg ${show === "board" ? "bg-white text-black font-bold" : "bg-white/5 text-zinc-300"}`}
            >
              🏆 Board
            </button>
          </nav>
        </div>
      </header>

      {show === "home" && (
        <div className="max-w-xl mx-auto px-4 pt-12 pb-20 text-center">
          <div className="inline-block text-[11px] font-bold tracking-[0.2em] text-amber-300 border border-amber-300/40 rounded-full px-4 py-1.5">
            ● UNOFFICIAL FAN DRAFT GAME
          </div>
          <h1 className="font-black leading-none mt-4 text-[92px] sm:text-[120px] tracking-tighter">
            14-<span className="text-emerald-400">0</span>
          </h1>
          <p className="font-black text-2xl sm:text-3xl mt-2 leading-tight">
            Build an All-Time
            <br />
            IPL XI
          </p>
          <p className="text-sm text-zinc-400 mt-3">
            Spin real franchise-seasons 2008–2025 · draft 11 · sim 14 games + playoffs.
            <br />
            Has anyone ever gone <b className="text-white">14-0</b>?
          </p>
          <button
            onClick={() => play("classic")}
            className="mt-6 w-full py-4 rounded-2xl bg-emerald-400 text-black font-black text-xl hover:bg-emerald-300 shadow-[0_0_50px_-10px_rgba(52,211,153,.8)]"
          >
            Play 14-0 →
          </button>
          <button
            onClick={() => setScreen("game")}
            className="mt-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-zinc-300"
          >
            How it works
          </button>

          <div className="text-left mt-8">
            <div className="text-[11px] tracking-[0.25em] text-emerald-300 font-bold">TODAY</div>
            <button
              onClick={() => play("daily")}
              className="mt-2 w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-emerald-300/40"
            >
              <span className="text-2xl">🏏</span>
              <span>
                <span className="block font-bold">Daily Challenge</span>
                <span className="block text-xs text-zinc-400">Same 11 spins for everyone · {today}</span>
              </span>
              <span className="ml-auto px-4 py-2 rounded-xl bg-emerald-400 text-black text-sm font-black">Play</span>
            </button>
            <button
              onClick={() => play("classic")}
              className="mt-2 w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-emerald-300/40"
            >
              <span className="text-2xl">⚔️</span>
              <span>
                <span className="block font-bold">1v1 vs mates</span>
                <span className="block text-xs text-zinc-400">Shared 18-game league, head-to-head counts.</span>
              </span>
              <span className="ml-auto text-zinc-500">→</span>
            </button>
          </div>

          <div className="text-left mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-300 space-y-2">
            <p><b className="text-white">1.</b> Hit spin — land on a real squad like MI 2019 or Deccan 2009.</p>
            <p><b className="text-white">2.</b> Draft 1 player from that exact season's squad. 11 picks, 2 re-rolls, no repeats.</p>
            <p><b className="text-white">3.</b> Sim the 14-game season + playoffs. Top 4 go through. Chase the mythical 14-0.</p>
            <p className="text-xs text-zinc-500">Roles: 2 openers · 3 middle · keeper · 2 all-rounders · 2 pace · 1 spin. Max 4 overseas. Legend mode hides ratings.</p>
          </div>
        </div>
      )}

      {show === "game" && (
          <GameBoard key={gameKey} initialMode={challengeSpins ? "classic" : mode} initialSpins={challengeSpins} initialRoom={roomCode} />
      )}

      {show === "board" && (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <section>
            <h2 className="font-bold text-sm text-zinc-300">📅 DAILY · {today}</h2>
            <BoardList rows={dailyBoard as any} empty="No daily runs yet — be the first." />
          </section>
          <section>
            <h2 className="font-bold text-sm text-zinc-300">🌍 ALL-TIME TOP SEASONS</h2>
            <BoardList rows={board as any} empty="No seasons logged yet." />
          </section>
        </div>
      )}

      <footer className="border-t border-white/10 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 text-[11px] text-zinc-500">
          14-0 is an unofficial fan-made IPL draft game. Not affiliated with the IPL or BCCI. Player
          names and season ratings are used for descriptive purposes only. ·{" "}
          <button className="underline" onClick={() => setScreen("home")}>Home</button>
        </div>
      </footer>
    </main>
  );
}

function BoardList({ rows, empty }: { rows: any[] | undefined; empty: string }) {
  if (rows === undefined) return <p className="text-xs text-zinc-500 mt-2">Loading…</p>;
  if (!rows.length) return <p className="text-xs text-zinc-500 mt-2">{empty}</p>;
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((r: any, i: number) => (
        <a
          key={r.seed}
          href={`/r/${r.seed}`}
          className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
        >
          <span className="text-zinc-500 w-6">#{i + 1}</span>
          <span className="font-bold">
            {r.wins}-{r.losses}
          </span>
          {r.perfect14 && <span>🏆14-0</span>}
          {r.champion && !r.perfect14 && <span>🏆</span>}
          <span className="text-xs text-zinc-400">
            {r.difficulty} · NRR {r.nrr > 0 ? "+" : ""}{r.nrr} · {r.deviceId}…
          </span>
          <span className="ml-auto font-mono text-[11px] text-emerald-200/80">/r/{r.seed}</span>
        </a>
      ))}
    </div>
  );
}
