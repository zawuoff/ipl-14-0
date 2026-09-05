"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  MAX_OVERSEAS,
  TOTAL_REROLLS,
  STYLE_TEMPLATES,
  istDateKey,
  makeSeed,
  nextSlotIndex,
  simU32FromSeed,
  validateXI,
  type Difficulty,
  type DraftState,
  type GameMode,
  type PlayerSeason,
  type TeamSeason,
  type XIConfig,
} from "@/lib/game/types";
import { buildPlayerSeasons, buildTeamSeasons } from "@/lib/game/data";
import { forecastSeason, simSeason, teamStrength, type GameResult, type SeasonResult } from "@/lib/sim/engine";
import { SlotSpin } from "./SlotSpin";
import { SquadList } from "./SquadList";
import { XIPanel } from "./XIPanel";
import { PlayoffMatch } from "./PlayoffMatch";
import { SeasonReport } from "./SeasonReport";
import { copyText } from "@/lib/clipboard";

const ALL_TEAMS: TeamSeason[] = buildTeamSeasons();
const ALL_PLAYERS: PlayerSeason[] = buildPlayerSeasons();
const TEAM_MAP = new Map(ALL_TEAMS.map((t) => [t.teamId, t]));
const SQUAD_MAP = (() => {
  const m = new Map<string, PlayerSeason[]>();
  for (const p of ALL_PLAYERS) {
    const a = m.get(p.teamId) ?? [];
    a.push(p);
    m.set(p.teamId, a);
  }
  return m;
})();

// Full REAL squad for the spun team+season (12 players). Fallback only if data missing.
export function getSquad(teamId: string): PlayerSeason[] {
  const exact = SQUAD_MAP.get(teamId) ?? [];
  if (exact.length >= 8) return [...exact].sort((a, b) => b.overall - a.overall);
  // fallback: same-franchise players (shouldn't happen — all 156 have squads)
  const t = TEAM_MAP.get(teamId);
  const out = [...exact];
  const seen = new Set(out.map((p) => p.id));
  if (t) {
    for (const p of ALL_PLAYERS) {
      if (out.length >= 12) break;
      if (p.franchise === t.franchise && !seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out.sort((a, b) => b.overall - a.overall);
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailySpinsLocal(date: string): string[] {
  const pool = ALL_TEAMS.map((t) => t.teamId).sort();
  const rng = mulberry(hashStr("14-0:" + date));
  const copy = [...pool];
  const out: string[] = [];
  while (out.length < 11 && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

function randomSpins(): string[] {
  // every team-season now has a full real squad — uniform across all 156
  const pool = ALL_TEAMS.map((t) => t.teamId);
  const out: string[] = [];
  let guard = 0;
  while (out.length < 11 && guard++ < 500) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}

function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let d = localStorage.getItem("14-0-device");
  if (!d) {
    d = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("14-0-device", d);
  }
  return d;
}

export function GameBoard({ initialMode = "classic", initialSpins, initialRoom }: { initialMode?: GameMode; initialSpins?: string[]; initialRoom?: string }) {
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [difficulty, setDifficulty] = useState<Difficulty>("Pro");
  const [styleIdx, setStyleIdx] = useState(0); // chosen XI template on setup screen
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [phase, setPhase] = useState<"slot" | "squad">("slot"); // per-pick: spin first, then draft
  const [slotKey, setSlotKey] = useState(0);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<SeasonResult | null>(null);
  const [simIdx, setSimIdx] = useState(0); // league games revealed
  const [simPhase, setSimPhase] = useState<"idle" | "league" | "leagueDone" | "playoffs" | "preFinal" | "final" | "done">("idle");
  const [poIdx, setPoIdx] = useState(0); // playoff matches completed
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(1);
  const [simPower, setSimPower] = useState(0);
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastPick, setLastPick] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // auto-scroll the fixed games feed as results land (38-0 style)
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [simIdx, simPhase]);

  const hideRatings = difficulty === "Legend"; // Legend = pick on knowledge alone

  const today = istDateKey();
  const dailyQuery = useQuery(
    (api as any).daily?.getToday,
    mode === "daily" ? { date: today } : "skip"
  );
  const saveDraft = useMutation((api as any).drafts?.saveDraft);
  const saveResult = useMutation((api as any).results?.saveResult);
  const joinRoom = useMutation((api as any).rooms?.join);
  const submitRoomXI = useMutation((api as any).rooms?.submitXI);
  const createRoom2 = useMutation((api as any).rooms?.create);
  const [roomName, setRoomName] = useState("");
  const [roomSubmitted, setRoomSubmitted] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const roomQ = useQuery(
    (api as any).rooms?.get,
    initialRoom ? { code: initialRoom.toUpperCase() } : "skip"
  );
  const inRoomGame = !!initialRoom && !!roomQ;
  const myRoomMember = roomQ?.members?.find((m: any) => m.deviceId === deviceId());

  useEffect(() => {
    try {
      setStreak(parseInt(localStorage.getItem("14-0-streak") ?? "0", 10) || 0);
      setMuted(localStorage.getItem("14-0-mute") === "1");
    } catch {}
  }, []);

  const startDraft = useCallback(
    (m: GameMode, config: XIConfig, opts?: { spins?: string[]; difficulty?: Difficulty }) => {
      const spins =
        opts?.spins ??
        (initialSpins && initialSpins.length === 11
          ? [...initialSpins]
          : m === "daily"
            ? (dailyQuery?.spins as string[] | undefined) ?? dailySpinsLocal(today)
            : randomSpins());
      const seed = makeSeed(spins);
      const diff = opts?.difficulty ?? difficulty;
      setDraft({
        seed,
        mode: m,
        difficulty: diff,
        config,
        spins: spins.map((teamId, index) => ({ index, teamId })),
        picks: Array(11).fill(null),
        rerollsLeft: TOTAL_REROLLS,
        status: "drafting",
      });
      setResult(null);
      setSimIdx(0);
      setSimPhase("idle");
      setCopied(false);
      setLastPick(null);
      setPhase("slot");
      setSlotKey((k) => k + 1);
    },
    [dailyQuery, difficulty, today, initialSpins]
  );

  // setup screen first — no auto-start (choose your style, then spin)

  const slot = draft ? nextSlotIndex(draft.picks) : -1;
  const currentSpin = draft && slot >= 0 ? draft.spins[slot] : null;

  const pickedXI = useMemo(
    () => (draft ? (draft.picks.filter(Boolean) as PlayerSeason[]) : []),
    [draft]
  );
  // no repeats: picked player NAMES are locked out of all future squads
  const pickedNames = useMemo(() => new Set(pickedXI.map((p) => p.player)), [pickedXI]);
  const options = useMemo(() => {
    if (!currentSpin) return [];
    let squad = getSquad(currentSpin.teamId).filter((p) => !pickedNames.has(p.player));
    if (squad.length === 0) {
      // every squad member already drafted — pull franchise mates (rare)
      const t = TEAM_MAP.get(currentSpin.teamId);
      squad = ALL_PLAYERS.filter(
        (p) => p.franchise === t?.franchise && !pickedNames.has(p.player)
      )
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 12);
    }
    return squad;
  }, [currentSpin, pickedNames]);

  const validity = useMemo(
    () => validateXI(pickedXI as PlayerSeason[], draft?.config),
    [pickedXI, draft]
  );
  const strength = useMemo(
    () => (pickedXI.length ? teamStrength(pickedXI as PlayerSeason[], draft?.config) : null),
    [pickedXI, draft]
  );
  const overseas = pickedXI.filter((p) => (p as PlayerSeason).overseas).length;
  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of pickedXI) c[(p as PlayerSeason).role] = (c[(p as PlayerSeason).role] ?? 0) + 1;
    return c;
  }, [pickedXI]);

  // hard caps → greyed-out reasons (38-0 style: filled slots sink to bottom, greyed)
  const unavailable = useMemo(() => {
    const m = new Map<string, string>();
    if (!draft || !currentSpin) return m;
    const capHit = overseas >= MAX_OVERSEAS;
    for (const p of getSquad(currentSpin.teamId)) {
      if (pickedNames.has(p.player)) continue; // already filtered out
      if (capHit && p.overseas) m.set(p.id, "✈️ overseas cap hit (4/4)");
      else if ((roleCounts[p.role] ?? 0) >= (draft.config[p.role] ?? 0))
        m.set(p.id, `${p.role} slot filled`);
    }
    return m;
  }, [draft, currentSpin, pickedNames, overseas, roleCounts]);
  // dead spin: nothing in this squad fits the open slots → stand-ins who DO fit
  // (same franchise flavour first). Caps stay absolute — quotas can never bust.
  const deadSpin = options.length > 0 && options.every((p) => unavailable.get(p.id));
  const standIns = useMemo(() => {
    if (!draft || !deadSpin) return [];
    const t = currentSpin ? TEAM_MAP.get(currentSpin.teamId) : undefined;
    const fits = (p: PlayerSeason) =>
      !pickedNames.has(p.player) &&
      (roleCounts[p.role] ?? 0) < (draft.config[p.role] ?? 0) &&
      (!p.overseas || overseas < MAX_OVERSEAS);
    const same = ALL_PLAYERS.filter((p) => p.franchise === t?.franchise && fits(p)).sort(
      (a, b) => b.overall - a.overall
    );
    if (same.length > 0) return same.slice(0, 12);
    return ALL_PLAYERS.filter(fits)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 12);
  }, [draft, deadSpin, currentSpin, pickedNames, roleCounts, overseas]);
  const lastResort = deadSpin && standIns.length === 0; // ~impossible; only then anyone goes
  const shownOptions = deadSpin && standIns.length > 0 ? standIns : options;
  const effectiveUnavailable: Map<string, string> = deadSpin ? new Map() : unavailable;

  // bookies forecast once XI is locked (160 quick sims — guidance, not destiny)
  const forecast = useMemo(() => {
    if (!draft || draft.status !== "complete" || pickedXI.length !== 11) return null;
    try {
      const u32 = simU32FromSeed(draft.seed, draft.spins.map((s) => s.teamId));
      return forecastSeason(pickedXI as PlayerSeason[], u32, draft.difficulty);
    } catch {
      return null;
    }
  }, [draft, pickedXI]);

  const rerollSpin = useCallback(() => {
    if (!draft || slot < 0 || draft.rerollsLeft <= 0 || phase !== "squad") return;
    const used = new Set(draft.spins.map((s) => s.teamId));
    let target = ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)].teamId;
    let guard = 0;
    while (used.has(target) && guard++ < 100) {
      target = ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)].teamId;
    }
    const spins = draft.spins.map((s) =>
      s.index === slot ? { ...s, teamId: target, rerolled: true } : s
    );
    setDraft({ ...draft, spins, rerollsLeft: draft.rerollsLeft - 1 });
    setPhase("slot");
    setSlotKey((k) => k + 1);
  }, [draft, slot, phase]);

  const pick = useCallback(
    (p: PlayerSeason) => {
      if (!draft || slot < 0) return;
      if (!lastResort) {
        // hard caps, always enforced (UI greys these out — double-guarded here)
        const roleN = draft.picks.filter((x) => x && (x as PlayerSeason).role === p.role).length;
        const ovN = draft.picks.filter((x) => x && (x as PlayerSeason).overseas).length;
        if (roleN >= (draft.config[p.role] ?? 0)) return;
        if (p.overseas && ovN >= MAX_OVERSEAS) return;
        if (pickedNames.has(p.player)) return;
      }
      const picks = [...draft.picks];
      picks[slot] = p;
      const done = picks.every(Boolean);
      setDraft({ ...draft, picks, status: done ? "complete" : "drafting" });
      setLastPick(p.id);
      if (!done) {
        setPhase("slot");
        setSlotKey((k) => k + 1);
      }
    },
    [draft, slot, lastResort, pickedNames]
  );

  const simulate = useCallback(() => {
    if (!draft || pickedXI.length !== 11) return;
    const xi = pickedXI as PlayerSeason[];
    const u32 = simU32FromSeed(draft.seed, draft.spins.map((s) => s.teamId));
    const r = simSeason(xi, u32, draft.difficulty);
    const st0 = teamStrength(xi, draft.config);
    setResult(r);
    setSimPower(st0.power);
    setSimIdx(0);
    setSimPhase("league");
    setPoIdx(0);
    try {
      const ns = r.champion ? streak + 1 : 0;
      localStorage.setItem("14-0-streak", String(ns));
      setStreak(ns);
      const gp = parseInt(localStorage.getItem("14-0-played") ?? "0", 10) || 0;
      localStorage.setItem("14-0-played", String(gp + 1));
    } catch {}
    (async () => {
      try {
        await saveDraft({
          seed: draft.seed,
          deviceId: deviceId(),
          mode: draft.mode,
          dailyDate: draft.mode === "daily" ? today : undefined,
          difficulty: draft.difficulty,
          spins: draft.spins.map((s) => s.teamId),
          picks: xi.map((p) => p.id),
          rerollsLeft: draft.rerollsLeft,
          status: "simulated",
        });
        await saveResult({
          seed: draft.seed,
          deviceId: deviceId(),
          mode: draft.mode,
          dailyDate: draft.mode === "daily" ? today : undefined,
          difficulty: draft.difficulty,
          wins: r.wins,
          losses: r.losses,
          points: r.points,
          nrr: r.nrr,
          madePlayoffs: r.madePlayoffs,
          champion: r.champion,
          perfect14: r.perfect14,
          games: r.games.map((g) => ({ opp: g.opp, gf: g.gf, ga: g.ga, result: g.result, margin: g.margin, superOver: g.superOver })),
          playoffs: r.playoffs.map((p) => ({ stage: p.stage, gf: p.gf, ga: p.ga, result: p.result, margin: p.margin })),
          teamBat: st0.bat,
          teamBowl: st0.bowl,
          power: st0.power,
        });

      } catch {}
    })();
  }, [draft, pickedXI, saveDraft, saveResult, streak, today]);

  // ---- league auto-reveal: 14 games, one at a time, then STOP at leagueDone ----
  const firstLossIdx = useMemo(
    () => (result ? result.games.findIndex((g) => g.result === "L") : -1),
    [result]
  );

  useEffect(() => {
    if (!result || simPhase !== "league") return;
    if (simIdx >= result.games.length) {
      setSimPhase("leagueDone");
      return;
    }
    const i = simIdx;
    let dwell: number;
    let clampMin = 0;
    if (i === firstLossIdx) {
      dwell = 2800;
      clampMin = 1200;
    } else if (i < 3) {
      dwell = 1300;
    } else if (i < 10) {
      dwell = 850;
    } else {
      dwell = 1400;
    }
    const wait = Math.max(dwell / simSpeed, clampMin);
    const t = setTimeout(() => {
      setSimIdx((v) => v + 1);
      // first loss gets the long dwell above, then play rolls on — no tap needed
    }, wait);
    return () => clearTimeout(t);
  }, [result, simPhase, simIdx, simSpeed, firstLossIdx]);

  const simAdvance = useCallback(() => {
    if (!result || simPhase !== "league") return;
    setSimIdx((v) => Math.min(v + 1, result.games.length));
    if (simIdx + 1 >= result.games.length) setSimPhase("leagueDone");
  }, [result, simIdx, simPhase]);

  const simSkip = useCallback(() => {
    if (!result || simPhase !== "league") return;
    setSimIdx(result.games.length);
    setSimPhase("leagueDone");
  }, [result, simPhase]);

  // playoff sequencing: non-final games auto-chain, final needs its gate
  const nonFinals = useMemo(
    () => (result ? result.playoffs.filter((p) => p.stage !== "Final") : []),
    [result]
  );
  const finalGame = useMemo(
    () => (result ? result.playoffs.find((p) => p.stage === "Final") ?? null : null),
    [result]
  );
  const onPlayoffDone = useCallback(() => {
    if (!result) return;
    const next = poIdx + 1;
    setPoIdx(next);
    if (next < nonFinals.length) return; // next non-final auto-plays (rendered by poIdx)
    if (finalGame) setSimPhase("preFinal");
    else setSimPhase("done"); // knocked out before the final
  }, [result, poIdx, nonFinals.length, finalGame]);

  const simShown: { games: GameResult[]; playoffs: SeasonResult["playoffs"]; wins: number; losses: number; nrr: number } = useMemo(() => {
    if (!result) return { games: [], playoffs: [], wins: 0, losses: 0, nrr: 0 };
    const games = result.games.slice(0, Math.min(simIdx, result.games.length));
    const pCount = Math.max(0, simIdx - result.games.length);
    const playoffs = result.playoffs.slice(0, pCount);
    const wins = games.filter((g) => g.result === "W").length;
    const losses = games.length - wins;
    let nrr = 0;
    if (games.length) {
      let rf = 0;
      let ra = 0;
      for (const g of games) {
        rf += parseInt(g.gf.split("/")[0], 10) || 0;
        ra += parseInt(g.ga.split("/")[0], 10) || 0;
      }
      nrr = Math.round(((rf - ra) / (games.length * 20)) * 100) / 100;
    }
    return { games, playoffs, wins, losses, nrr };
  }, [result, simIdx]);

  const shareText = useMemo(() => {
    if (!draft || !result) return "";
    const boxes = result.games.map((g) => (g.result === "W" ? "🟩" : "🟥")).join("");
    const head = result.perfect14
      ? "🏆 14-0 PERFECT SEASON. IMMORTAL."
      : result.champion
        ? `🏆 CHAMPIONS ${result.wins}-${result.losses}`
        : `${result.wins}-${result.losses} SEASON`;
    const tag = draft.mode === "daily" ? ` Daily ${today}` : "";
    return `14-0 IPL Draft${tag} — ${head}\n${boxes}\n${draft.difficulty} · ${typeof window !== "undefined" ? window.location.origin : "14-0.app"}/r/${draft.seed}\nCan you go 14-0?`;
  }, [draft, result, today]);

  const slotsLeft = draft ? 11 - pickedXI.length : 11;
  const spunTeam = currentSpin ? TEAM_MAP.get(currentSpin.teamId) : undefined;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-24">
      {/* slim status HUD once playing (settings live on the setup screen) */}
      {draft && (
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <div className="text-xs text-zinc-400 capitalize">
          {initialRoom ? `⚔️ Room /m/${initialRoom.toUpperCase()} · ` : draft.mode === "daily" ? `📅 Daily ${today.slice(5)} · ` : "🎡 Classic · "}{draft.difficulty} ·{" "}
          {STYLE_TEMPLATES.find((t) => JSON.stringify(t.config) === JSON.stringify(draft.config))?.name ?? "Custom"}
        </div>
        <button
          onClick={() => {
            setDraft(null);
            setResult(null);
            setSimPhase("idle");
            setSimIdx(0);
            setPoIdx(0);
          }}
          className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 ml-auto"
        >
          ↻ Restart run
        </button>
        <button
          onClick={() => {
            const m = !muted;
            setMuted(m);
            try {
              localStorage.setItem("14-0-mute", m ? "1" : "0");
            } catch {}
          }}
          className="text-sm px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10"
          title="Toggle sounds"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        {streak > 0 && (
          <span className="text-sm text-amber-300 font-semibold">🔥 {streak}-title streak</span>
        )}
      </div>
      )}


      {!draft && (
        <div className="mt-6 max-w-2xl mx-auto">
          {initialRoom && !roomQ && (
            <p className="text-sm text-zinc-400 text-center">Loading room {initialRoom.toUpperCase()}…</p>
          )}
          {initialRoom && roomQ === null && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-center text-sm">
              Room not found — it may have expired. <button className="underline" onClick={() => window.location.search = ""}>Start a normal run</button>
            </div>
          )}
          {initialRoom && roomQ && !myRoomMember && (
            <div className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/[0.07] p-5 text-center">
              <div className="text-[11px] tracking-[0.25em] text-fuchsia-200 font-bold">⚔️ SHARED LEAGUE INVITE</div>
              <div className="font-black text-xl mt-1">
                {roomQ.members?.map((m: any) => m.name).join("  vs  ") || "1v1"}
                {roomQ.members?.length < 2 ? " · one seat open" : ""}
              </div>
              <div className="text-xs text-zinc-300 mt-1 capitalize">
                {roomQ.difficulty} · your own spins, your own style · one 18-game table
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="Your name (e.g. Yuvi)"
                  maxLength={14}
                  className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-300"
                />
                <button
                  onClick={async () => {
                    if (!roomName.trim() || roomBusy) return;
                    setRoomBusy(true);
                    try {
                      await joinRoom({ code: roomQ.code, name: roomName.trim(), deviceId: deviceId() });
                    } catch {}
                    setRoomBusy(false);
                  }}
                  disabled={!roomName.trim() || roomBusy}
                  className="px-5 py-2.5 rounded-lg bg-fuchsia-400 text-black font-black text-sm disabled:opacity-40"
                >
                  {roomBusy ? "…" : "Join"}
                </button>
              </div>
            </div>
          )}
          {initialRoom && roomQ && myRoomMember && (
            <div className="rounded-2xl border border-emerald-300/40 bg-emerald-400/[0.06] p-4 text-center text-sm">
              Playing as <b>{myRoomMember.name}</b> · {roomQ.difficulty} locked · draft your own XI below, then lock it in.
            </div>
          )}
          {(!initialRoom || myRoomMember) && (
          <>
          {!initialRoom && (
          <>
          <div className="text-[11px] tracking-[0.25em] text-zinc-500 text-center">MODE</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(["classic", "daily"] as GameMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl border p-3 transition ${
                  mode === m
                    ? "border-emerald-300 bg-emerald-400/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <div className={`font-black ${mode === m ? "text-emerald-300" : ""}`}>
                  {m === "daily" ? "📅 Daily" : "🎡 Classic"}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {m === "daily" ? `Same 11 spins for everyone · ${today.slice(5)}` : "Fresh random wheel every run"}
                </div>
              </button>
            ))}
          </div>
          </>
          )}

          <div className="text-[11px] tracking-[0.25em] text-zinc-500 text-center mt-5">CHOOSE YOUR STYLE</div>
          <h2 className="font-black text-2xl mt-1 text-center">How will your XI look?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-left">
            {STYLE_TEMPLATES.map((t, i) => (
              <button
                key={t.name}
                onClick={() => setStyleIdx(i)}
                className={`rounded-xl border p-3.5 transition ${
                  styleIdx === i
                    ? "border-emerald-300 bg-emerald-400/[0.08] shadow-[0_0_24px_-8px_rgba(52,211,153,.7)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border-2 ${styleIdx === i ? "border-emerald-300 bg-emerald-300" : "border-zinc-600"}`} />
                  <span className="font-black">{t.name}</span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">{t.blurb}</div>
                <div className="text-[11px] text-zinc-500 mt-1.5">
                  {(['Opener', 'Middle', 'WK', 'AR', 'Pace', 'Spin'] as const)
                    .map((r) => `${t.config[r]} ${roleWord(r, t.config[r])}`)
                    .join(" · ")}
                </div>
              </button>
            ))}
          </div>

          {initialRoom && roomQ ? (
            <div className="text-center mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              Room rules locked: <b className="capitalize">{roomQ.difficulty}</b> · your own spins, your own style
            </div>
          ) : (
          <>
          <div className="text-[11px] tracking-[0.25em] text-zinc-500 text-center mt-5">DIFFICULTY</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(
              [
                { d: "Rookie", sub: "Gentler opps" },
                { d: "Pro", sub: "True sim" },
                { d: "Legend", sub: "Harder · ratings hidden" },
              ] as { d: Difficulty; sub: string }[]
            ).map(({ d, sub }) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-xl border p-3 transition ${
                  difficulty === d
                    ? "border-amber-300 bg-amber-400/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <div className={`font-black ${difficulty === d ? "text-amber-300" : ""}`}>{d}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>
              </button>
            ))}
          </div>
          </>
          )}

          <button
            onClick={() => {
              const diff = initialRoom && roomQ ? (roomQ.difficulty as Difficulty) : difficulty;
              if (initialRoom && roomQ) setDifficulty(roomQ.difficulty as Difficulty);
              startDraft("classic", STYLE_TEMPLATES[styleIdx].config, { difficulty: diff });
            }}
            className="mt-5 w-full py-4 rounded-2xl bg-emerald-400 text-black font-black text-xl hover:bg-emerald-300 shadow-[0_0_50px_-10px_rgba(52,211,153,.8)]"
          >
            Start Draft → 11 spins
          </button>
          <p className="text-[11px] text-zinc-500 mt-2 text-center">
            {initialRoom && roomQ ? roomQ.difficulty : difficulty} · 2 re-rolls · max 4 overseas
          </p>
          {!initialRoom && (
          <div className="mt-4 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/[0.05] p-3.5">
            <div className="text-[11px] tracking-[0.25em] text-fuchsia-200 font-bold text-center">⚔️ MULTIPLAYER — SHARED LEAGUE</div>
            <p className="text-[11px] text-zinc-400 text-center mt-1">You + a mate · one 18-game table · head-to-head counts for both</p>
            <div className="mt-2.5 flex gap-2">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Your name (e.g. Yuvi)"
                maxLength={14}
                className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-300"
              />
              <button
                onClick={async () => {
                  if (!roomName.trim() || roomBusy) return;
                  setRoomBusy(true);
                  try {
                    const r = (await createRoom2({
                      name: roomName.trim(),
                      difficulty,
                      deviceId: deviceId(),
                    })) as unknown as { code: string } | null;
                    if (r?.code) window.location.href = `/m/${r.code}`;
                  } catch {}
                  setRoomBusy(false);
                }}
                disabled={!roomName.trim() || roomBusy}
                className="px-5 py-2.5 rounded-lg bg-fuchsia-400 text-black font-black text-sm disabled:opacity-40"
              >
                {roomBusy ? "…" : "Create room"}
              </button>
            </div>
          </div>
          )}
          </>
          )}
        </div>
      )}

      {draft && draft.status === "drafting" && currentSpin && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
          {/* left: XI panel */}
          <div className="order-2 lg:order-1 lg:sticky lg:top-16">
            <XIPanel
              config={draft.config}
              picks={draft.picks}
              overseas={overseas}
              power={strength?.power} avg={strength?.avg}
              hideRatings={hideRatings}
            />
          </div>

          {/* right: spin / draft */}
          <div className="order-1 lg:order-2 min-w-0">
            <div className="text-[11px] tracking-[0.25em] text-zinc-500">SPIN FOR A SQUAD</div>
            <h2 className="font-black text-xl mt-0.5">
              {slotsLeft} position{slotsLeft === 1 ? "" : "s"} left to fill
            </h2>

            {phase === "slot" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b0f1c] p-5">
                <SlotSpin
                  key={slotKey}
                  targetTeamId={currentSpin.teamId}
                  targetName={spunTeam?.name ?? ""}
                  targetColour={spunTeam?.colour ?? "#fff"}
                  clubPool={ALL_TEAMS.map((t) => t.teamId)}
                  spinKey={slotKey}
                  onLanded={() => setPhase("squad")}
                />
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-emerald-400/[0.06] px-3 py-2.5">
                  <span className="text-[11px] tracking-widest text-zinc-400">SQUAD SPUN</span>
                  <span className="font-black" style={{ color: spunTeam?.colour }}>
                    {spunTeam?.name ?? currentSpin.teamId}{" "}
                    <span className="text-amber-300">{spunTeam?.season}</span>
                  </span>
                  <button
                    onClick={rerollSpin}
                    disabled={draft.rerollsLeft <= 0}
                    className="ml-auto text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-amber-300/40 text-amber-200 disabled:opacity-40"
                  >
                    🎲 Re-roll ({draft.rerollsLeft} left)
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-3 mb-2">
                  {lastResort
                    ? "🃏 Dead spin — anyone goes"
                    : deadSpin
                      ? `🔄 No fitting ${spunTeam?.code ?? "squad"} players left — stand-ins for your open slots:`
                      : hideRatings ? "Legend mode — ratings hidden, trust your knowledge 👀" : "Pick 1 — that season's real squad 👇"}
                </p>
                <SquadList squad={shownOptions} hideRatings={hideRatings} onPick={pick} unavailable={effectiveUnavailable} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* XI complete → sim trigger (left panel context on desktop) */}
      {draft && draft.status === "complete" && !result && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
          <div className="order-2 lg:order-1">
            <XIPanel config={draft.config} picks={draft.picks} overseas={overseas} power={strength?.power} avg={strength?.avg} hideRatings={hideRatings} />
          </div>
          <div className="order-1 lg:order-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.05] p-5 text-center">
            {!validity.valid && (
              <div className="text-xs text-red-300 mb-2">⚠️ {validity.errors.join(" · ")} (sim penalized)</div>
            )}
            {lastPick && (
              <p className="text-sm text-zinc-300 mb-2">
                Last pick rated <b className="text-emerald-300">{(pickedXI.find((p) => (p as PlayerSeason).id === lastPick) as PlayerSeason | undefined)?.overall ?? ""}</b>
                {(() => {
                  const lp = pickedXI.find((p) => (p as PlayerSeason).id === lastPick) as PlayerSeason | undefined;
                  if (!lp) return null;
                  return lp.overall >= 92 ? " 🔥 STEAL!" : lp.overall >= 85 ? " ✅ solid" : " 🎲 punt";
                })()}
              </p>
            )}
            <div className="text-xs text-zinc-400">XI locked · {overseas}/4 overseas · AVG {strength?.avg} · PWR {strength?.power}</div>
            {inRoomGame ? (
              roomSubmitted ? (
                <a
                  href={`/m/${initialRoom!.toUpperCase()}`}
                  className="mt-3 block w-full py-3.5 rounded-xl bg-emerald-400 text-black font-black text-lg text-center"
                >
                  XI locked ✅ — back to room →
                </a>
              ) : (
                <>
                  <p className="text-xs text-zinc-400 mt-3">
                    Room league plays from both locked XIs — no sim here. Head to the room once locked.
                  </p>
                  <button
                    onClick={async () => {
                      if (roomBusy || !roomQ) return;
                      setRoomBusy(true);
                      try {
                        await submitRoomXI({
                          code: roomQ.code,
                          deviceId: deviceId(),
                          config: draft.config,
                          picks: (pickedXI as PlayerSeason[]).map((p) => p.id),
                          seed: draft.seed,
                        });
                        setRoomSubmitted(true);
                      } catch {}
                      setRoomBusy(false);
                    }}
                    disabled={roomBusy}
                    className="mt-3 w-full py-3.5 rounded-xl bg-fuchsia-400 text-black font-black text-lg hover:bg-fuchsia-300 disabled:opacity-50"
                  >
                    {roomBusy ? "Locking…" : "🔒 Lock in XI for the room"}
                  </button>
                </>
              )
            ) : (
            <>
            {forecast && (
              <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/[0.06] p-3 text-sm">
                <div className="text-[10px] tracking-[0.25em] text-amber-200/70 font-bold">🔮 BOOKIES SAY (NOT SET IN STONE)</div>
                <div className="mt-1.5 flex items-end justify-center gap-4">
                  <div>
                    <div className="font-black text-2xl">{forecast.expPts}<span className="text-xs text-zinc-400 font-semibold"> pts</span></div>
                    <div className="text-[11px] text-zinc-400">expected</div>
                  </div>
                  <div>
                    <div className="font-black text-2xl">~{forecast.medRank}<span className="text-xs text-zinc-400 font-semibold">{forecast.medRank === 1 ? "st" : forecast.medRank === 2 ? "nd" : forecast.medRank === 3 ? "rd" : "th"}</span></div>
                    <div className="text-[11px] text-zinc-400">likely finish</div>
                  </div>
                  <div>
                    <div className="font-black text-2xl">{forecast.playoffPct}<span className="text-xs text-zinc-400 font-semibold">%</span></div>
                    <div className="text-[11px] text-zinc-400">playoffs</div>
                  </div>
                  <div>
                    <div className="font-black text-2xl text-amber-300">{forecast.titlePct}<span className="text-xs text-zinc-400 font-semibold">%</span></div>
                    <div className="text-[11px] text-zinc-400">title</div>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1.5">Top 4 make the playoffs — anything can happen.</div>
              </div>
            )}
            <button
              onClick={simulate}
              className="mt-3 w-full py-3.5 rounded-xl bg-emerald-400 text-black font-black text-lg hover:bg-emerald-300 shadow-[0_0_40px_-8px_rgba(52,211,153,.7)]"
            >
              ▶ Simulate Season
            </button>
            </>
            )}
          </div>
        </div>
      )}

      {/* sim — staged: league auto-ticker → season report → playoffs → final */}
      {result && draft && (
        <>
      {(simPhase === "league" || simPhase === "leagueDone") && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-[0.25em] text-zinc-500">
              {simPhase === "league" ? `MATCH ${Math.min(simIdx + 1, 14)} / 14` : "SEASON COMPLETE"}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setSimSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                className="text-xs px-2.5 py-1.5 rounded bg-white/10 border border-white/10"
                title="Playback speed"
              >
                {simSpeed}x ⏩
              </button>
              {simPhase === "league" && (
                <button
                  onClick={simSkip}
                  className="text-xs px-2.5 py-1.5 rounded bg-white/10 border border-white/10"
                >
                  Skip ⏭
                </button>
              )}
            </span>
          </div>

          {/* running season panel */}
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-center gap-6 text-center">
              <StatMini value={String(simShown.wins)} label="WON" color="text-emerald-300" />
              <StatMini value={String(simShown.losses)} label="LOST" color="text-red-300" />
              <StatMini value={String(simShown.wins * 2)} label="PTS" color="text-amber-300" />
              <span
                className={`px-3 py-1 rounded-full font-black text-sm ${
                  simShown.losses === 0 && simPhase === "league"
                    ? "bg-emerald-400 text-black animate-pulse"
                    : "bg-white/10 text-white"
                }`}
              >
                {simShown.losses === 0 && simPhase === "league" && simShown.wins > 0
                  ? `🔥 ${simShown.wins}-0 ALIVE`
                  : `${simShown.wins}-${simShown.losses}`}
              </span>
            </div>
            <div className="text-center text-[11px] text-zinc-500 mt-1.5">
              Scored {leagueRuns(simShown.games)} · Conceded {leagueAgainst(simShown.games)} · NRR{" "}
              {simShown.nrr > 0 ? "+" : ""}
              {simShown.nrr}
            </div>
          </div>

          <div
            ref={feedRef}
            className="mt-3 space-y-1.5 max-h-[380px] overflow-y-auto pr-1"
            onClick={simPhase === "league" ? simAdvance : undefined}
          >
            {simShown.games.map((g, i) => (
              <GameRow
                key={i}
                label={`M${i + 1}`}
                opp={g.opp}
                gf={g.gf}
                ga={g.ga}
                win={g.result === "W"}
                margin={g.margin}
                fav={winPct(simPower, g.oppPower)}
                hero={leagueHero(g, i, result.matchStars[i])}
                fresh={simPhase === "league" && i === simShown.games.length - 1}
              />
            ))}
          </div>

          {simPhase === "league" && (
            <p className="text-[11px] text-zinc-500 mt-2">tap a result to fast-forward one game · {simSpeed}x speed</p>
          )}

          {simPhase === "leagueDone" && (
            <div className="mt-4">
              {result.madePlayoffs ? (
                <>
                  <SeasonReport
                    result={result}
                    forecast={forecast}
                    bat={strength?.bat ?? 0}
                    bowl={strength?.bowl ?? 0}
                    leagueOnly
                    slim
                  />
                  <button
                    onClick={() => {
                      setPoIdx(0);
                      setSimPhase("playoffs");
                    }}
                    className="mt-4 w-full py-4 rounded-2xl bg-amber-400 text-black font-black text-xl hover:bg-amber-300 shadow-[0_0_50px_-10px_rgba(251,191,36,.8)]"
                  >
                    ⚔️ Finished #{result.rank} — Start Playoffs →
                  </button>
                </>
              ) : (
                <>
                  <SeasonReport
                    result={result}
                    forecast={forecast}
                    bat={strength?.bat ?? 0}
                    bowl={strength?.bowl ?? 0}
                    leagueOnly
                  />
                  <TableView rows={result.table} />
                  <ShareBlock
                    shareText={shareText}
                    seed={draft.seed}
                    spins={draft.spins.map((s) => s.teamId)}
                    mode={mode}
                    draftConfig={draft.config}
                    startDraft={startDraft}
                    copied={copied}
                    setCopied={setCopied}
                    challengeCopied={challengeCopied}
                    setChallengeCopied={setChallengeCopied}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

          {/* ---- playoffs: ball-by-ball knockouts, one match at a time ---- */}
          {simPhase === "playoffs" && (
            <div className="mt-6 rounded-2xl border border-amber-300/25 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] tracking-[0.25em] text-amber-200 font-bold">⚔️ PLAYOFFS</span>
                <span className="text-[11px] text-zinc-400">
                  via {result.wins}-{result.losses} · #{result.rank}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => setSimSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                    className="text-xs px-2.5 py-1.5 rounded bg-white/10 border border-white/10"
                  >
                    {simSpeed}x ⏩
                  </button>
                </span>
              </div>
              {nonFinals.slice(0, poIdx).map((p, i) => (
                <PlayoffSummary key={i} stage={p.stage} gf={p.gf} ga={p.ga} win={p.result === "W"} margin={p.margin} />
              ))}
              {nonFinals[poIdx] && nonFinals[poIdx].detail && (
                <PlayoffMatch
                  key={poIdx}
                  stage={nonFinals[poIdx].stage}
                  detail={nonFinals[poIdx].detail!}
                  userTag="YOU"
                  speed={simSpeed}
                  nextLabel={
                    nonFinals[poIdx].result === "W"
                      ? poIdx + 1 < nonFinals.length
                        ? `Next: ${nonFinals[poIdx + 1].stage}`
                        : "To the Final"
                      : nonFinals[poIdx].stage === "Qualifier 1"
                        ? "Down to Qualifier 2 →"
                        : "Season over — results"
                  }
                  onDone={onPlayoffDone}
                />
              )}
            </div>
          )}

          {/* ---- final gate ---- */}
          {simPhase === "preFinal" && finalGame && (
            <div className="mt-6 rounded-2xl border border-amber-300/50 bg-gradient-to-b from-amber-400/15 to-black p-6 text-center">
              <div className="text-[11px] tracking-[0.3em] text-amber-200 font-bold">THE FINAL</div>
              <div className="font-black text-3xl mt-2">YOU <span className="text-zinc-500 text-xl">vs</span> {finalGame.detail?.opp ?? "???"}</div>
              <div className="text-sm text-zinc-400 mt-1">One game. Immortality adjacent. Full ball-by-ball.</div>
              <button
                onClick={() => setSimPhase("final")}
                className="mt-4 px-10 py-4 rounded-2xl bg-amber-400 text-black font-black text-xl hover:bg-amber-300 shadow-[0_0_50px_-10px_rgba(251,191,36,.9)]"
              >
                🏆 Play the Final
              </button>
            </div>
          )}

          {simPhase === "final" && finalGame && finalGame.detail && (
            <div className="mt-6 rounded-2xl border border-amber-300/25 bg-black/40 p-4">
              <PlayoffMatch
                stage="Final"
                detail={finalGame.detail}
                userTag="YOU"
                speed={simSpeed}
                fullMatch
                nextLabel={finalGame.result === "W" ? "🏆 Lift the trophy" : "Full-time — results"}
                onDone={() => setSimPhase("done")}
              />
            </div>
          )}

          {simPhase === "done" && (
            <>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-black text-2xl text-center">
                  {result.perfect14
                    ? "🏆 14-0. PERFECT. IMMORTAL."
                    : result.champion
                      ? `🏆 CHAMPIONS · ${result.wins}-${result.losses}`
                      : result.madePlayoffs
                        ? `💔 Knocked out — ${knockoutStage(result)}`
                        : `📉 ${result.wins}-${result.losses} — missed the playoffs`}
                </div>
                <div className="text-xs text-zinc-400 mt-1 text-center">
                  #{result.rank} · {result.points} pts · NRR {result.nrr > 0 ? "+" : ""}
                  {result.nrr} · {draft.difficulty}
                </div>
                {!result.perfect14 && result.wins >= 11 && (
                  <p className="text-sm text-amber-200 mt-1 text-center">
                    😱 So close — {14 - result.wins} loss{14 - result.wins > 1 ? "es" : ""} from immortality. One more spin?
                  </p>
                )}
                <SeasonReport
                  result={result}
                  forecast={forecast}
                  bat={strength?.bat ?? 0}
                  bowl={strength?.bowl ?? 0}
                  compact
                />
                <TableView rows={result.table} />
              </div>
              <ShareBlock
                shareText={shareText}
                seed={draft.seed}
                spins={draft.spins.map((s) => s.teamId)}
                mode={mode}
                draftConfig={draft.config}
                startDraft={startDraft}
                copied={copied}
                setCopied={setCopied}
                challengeCopied={challengeCopied}
                setChallengeCopied={setChallengeCopied}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function roleWord(r: "Opener" | "Middle" | "WK" | "AR" | "Pace" | "Spin", n: number): string {
  const words = {
    Opener: n === 1 ? "opener" : "openers",
    Middle: n === 1 ? "middle-order" : "middle-order",
    WK: "keeper",
    AR: n === 1 ? "all-rounder" : "all-rounders",
    Pace: n === 1 ? "pacer" : "pacers",
    Spin: n === 1 ? "spinner" : "spinners",
  } as const;
  return words[r];
}

function winPct(myPower: number, oppPower: number): number {
  const p = 1 / (1 + Math.pow(10, -(myPower - oppPower) / 15));
  return Math.round(p * 100);
}

const OPP_HEROES = ["Warner", "Buttler", "Bumrah", "Rashid", "Gayle", "Dhoni", "ABD", "Malinga", "Narine", "Pant", "SKY", "Head"];

function shortName(full: string): string {
  const parts = full.split(" ");
  if (parts.length === 1) return full;
  return `${parts[0][0]} ${parts[parts.length - 1]}`;
}

// hero line from the ACTUAL match stars (no more random names for your team)
function leagueHero(
  g: GameResult,
  i: number,
  star?: { bat: { player: string; runs: number; balls: number }; bowl: { player: string; wickets: number; runsConceded: number } }
): string {
  if (g.result === "W" && star) {
    return g.margin.includes("runs")
      ? `${shortName(star.bowl.player)} ${star.bowl.wickets}/${star.bowl.runsConceded} defended ${g.gf}`
      : `${shortName(star.bat.player)} ${star.bat.runs}(${star.bat.balls}) finished it`;
  }
  const h = OPP_HEROES[(g.opp.length + i) % OPP_HEROES.length];
  return `${h} stunned you`;
}

function leagueRuns(games: GameResult[]): number {
  return games.reduce((a, g) => a + (parseInt(g.gf.split("/")[0], 10) || 0), 0);
}
function leagueAgainst(games: GameResult[]): number {
  return games.reduce((a, g) => a + (parseInt(g.ga.split("/")[0], 10) || 0), 0);
}

function knockoutStage(r: SeasonResult): string {
  const last = r.playoffs[r.playoffs.length - 1];
  if (!last) return "the league";
  if (last.stage === "Final") return "the Final";
  return last.stage;
}

function StatMini({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <span className="text-center">
      <span className={`block font-black text-xl ${color ?? ""}`}>{value}</span>
      <span className="block text-[10px] text-zinc-500 tracking-widest">{label}</span>
    </span>
  );
}

function PlayoffSummary({ stage, gf, ga, win, margin }: { stage: string; gf: string; ga: string; win: boolean; margin: string }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 border text-sm ${
        win ? "border-amber-300/40 bg-amber-400/[0.07]" : "border-red-400/30 bg-red-500/10"
      }`}
    >
      <div className="text-[10px] tracking-[0.2em] text-zinc-400">{stage.toUpperCase()}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span>{win ? "🟩" : "🟥"}</span>
        <span className="font-mono font-bold">YOU {gf}</span>
        <span className="text-zinc-500">vs</span>
        <span className="font-mono">{ga}</span>
        <span className="ml-auto text-xs text-zinc-300">
          {win ? "won by " : "lost by"}
          {margin}
        </span>
      </div>
    </div>
  );
}

function ShareBlock({
  shareText,
  seed,
  spins,
  mode,
  draftConfig,
  startDraft,
  copied,
  setCopied,
  challengeCopied,
  setChallengeCopied,
}: {
  shareText: string;
  seed: string;
  spins: string[];
  mode: GameMode;
  draftConfig: XIConfig;
  startDraft: (m: GameMode, c: XIConfig) => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
  challengeCopied: boolean;
  setChallengeCopied: (v: boolean) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-400/[0.07] p-3">
      <div className="text-xs text-emerald-100/80 font-mono break-all">{shareText}</div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={async () => {
            if (await copyText(shareText)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="px-4 py-2 rounded-lg bg-emerald-400 text-black font-bold text-sm"
        >
          {copied ? "✅ Copied!" : "📋 Copy result card"}
        </button>
        <a href={`/r/${seed}`} className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-sm">
          🔗 Verify: /r/{seed}
        </a>
        <button onClick={() => startDraft(mode, draftConfig)} className="px-4 py-2 rounded-lg bg-white text-black font-bold text-sm ml-auto">
          Run it back ↻
        </button>
      </div>
      <button
        onClick={async () => {
          const url = `${window.location.origin}/?challenge=${spins.join(",")}`;
          if (await copyText(`⚔️ Beat my wheel: ${url}`)) {
            setChallengeCopied(true);
            setTimeout(() => setChallengeCopied(false), 2000);
          }
        }}
        className="mt-2 w-full px-4 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 font-bold text-sm"
      >
        {challengeCopied ? "✅ Challenge link copied!" : "⚔️ 1v1: send a friend this exact wheel"}
      </button>
    </div>
  );
}

function GameRow({
  label,
  opp,
  gf,
  ga,
  win,
  margin,
  fav,
  hero,
  fresh,
}: {
  label: string;
  opp: string;
  gf: string;
  ga: string;
  win: boolean;
  margin: string;
  fav: number;
  hero: string;
  fresh?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 border text-sm ${
        win ? "border-emerald-400/30 bg-emerald-500/10" : "border-red-400/40 bg-red-500/10"
      } ${fresh ? "animate-[pulse_0.6s_ease-in-out_1]" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 w-7 text-xs">{label}</span>
        <span>{win ? "🟩" : "🟥"}</span>
        <span className="font-mono font-bold">YOU {gf}</span>
        <span className="text-zinc-500">vs</span>
        <span className="font-mono">
          {ga} {opp}
        </span>
        <span className="ml-auto text-[11px] text-zinc-400">
          {fav}% {fav >= 50 ? "fav" : "dog"}
        </span>
      </div>
      <div className="text-[11px] text-zinc-400 mt-0.5 ml-9">
        {margin === "Super Over" ? (
          <>decided in a <b className="text-amber-300">Super Over</b> · <span className="italic">{hero}</span></>
        ) : (
          <>{win ? "won by " : "lost by"}{margin} · <span className="italic">{hero}</span></>
        )}
      </div>
    </div>
  );
}

function TableView({ rows }: { rows: SeasonResult["table"] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
      <div className="text-[10px] tracking-[0.25em] text-zinc-500 px-3 pt-2.5">POINTS TABLE · TOP 4 PLAYOFFS</div>
      <table className="w-full text-sm mt-1">
        <thead>
          <tr className="text-[10px] text-zinc-500 border-b border-white/10">
            <th className="text-left font-semibold px-3 py-1.5">#</th>
            <th className="text-left font-semibold px-1 py-1.5">TEAM</th>
            <th className="font-semibold px-1 py-1.5">P</th>
            <th className="font-semibold px-1 py-1.5">W</th>
            <th className="font-semibold px-1 py-1.5">L</th>
            <th className="font-semibold px-1 py-1.5">PTS</th>
            <th className="text-right font-semibold px-3 py-1.5">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <>
              <tr key={r.team} className={r.you ? "bg-emerald-400/15 font-bold" : i % 2 ? "bg-white/[0.02]" : ""}>
                <td className="px-3 py-1.5 text-zinc-400">{i + 1}</td>
                <td className="px-1 py-1.5">{r.you ? "⭐ YOU" : r.team}</td>
                <td className="px-1 py-1.5 text-center text-zinc-400">{r.p}</td>
                <td className="px-1 py-1.5 text-center">{r.w}</td>
                <td className="px-1 py-1.5 text-center text-zinc-400">{r.l}</td>
                <td className="px-1 py-1.5 text-center font-bold">{r.pts}</td>
                <td className="px-3 py-1.5 text-right font-mono text-xs">
                  {r.nrr > 0 ? "+" : ""}
                  {r.nrr}
                </td>
              </tr>
              {i === 3 && (
                <tr key="cut">
                  <td colSpan={7} className="border-b-2 border-dashed border-emerald-400/50 h-0 p-0" />
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
