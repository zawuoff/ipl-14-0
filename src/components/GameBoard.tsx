"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  MAX_OVERSEAS,
  REROLLS,
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
  type Role,
  type TeamSeason,
  type XIConfig,
} from "@/lib/game/types";
import { buildPlayerSeasons, buildTeamSeasons } from "@/lib/game/data";
import { forecastSeason, simSeason, teamStrength, type GameResult, type SeasonResult } from "@/lib/sim/engine";
import { SlotSpin } from "./SlotSpin";
import { SquadList } from "./SquadList";
import { XIPanel, unitWord } from "./XIPanel";
import {
  Eyebrow,
  Flap,
  PageBand,
  SlotStrip,
  SplitScore,
  StatCell,
  StatStrip,
  PrimaryButton,
  OutlineButton,
  PlateButton,
  SectionHead,
  WhatsAppIcon,
  Crown,
} from "./ui";
import { PlayoffMatch } from "./PlayoffMatch";
import { SeasonReport } from "./SeasonReport";
import { copyText } from "@/lib/clipboard";
import { MAX_NAME, playerName, setPlayerName } from "@/lib/player";
import { useT, localiseMargin, ordinal } from "@/lib/i18n";

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

export function GameBoard({
  initialMode = "classic",
  initialSpins,
  initialRoom,
  initialIntent = "solo",
}: {
  initialMode?: GameMode;
  initialSpins?: string[];
  initialRoom?: string;
  // Whether the player came here to draft alone or to open a room. The setup
  // screen ends in a different button for each.
  initialIntent?: "solo" | "friend";
}) {
  const t = useT();
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

  // Legend hides the squad list, so you pick on what you know. Once a player is
  // in your XI you see exactly what you took.
  const hideRatings = difficulty === "Legend";

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
  // One name, whichever way you came in: it goes on a room seat and on the board.
  const [roomName, setRoomName] = useState("");
  const friendFlow = initialIntent === "friend" && !initialRoom;
  useEffect(() => {
    // Reading the device's stored name has to wait for mount: it does not exist
    // while this renders on the server, and seeding the input from it up front
    // would hand React two different values to hydrate.
    const saved = playerName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setRoomName((n) => n || saved);
  }, []);
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
        rerollsLeft: REROLLS[diff],
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
      const spun = TEAM_MAP.get(currentSpin.teamId);
      squad = ALL_PLAYERS.filter(
        (p) => p.franchise === spun?.franchise && !pickedNames.has(p.player)
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
      if (capHit && p.overseas) m.set(p.id, t("draft.capFull"));
      else if ((roleCounts[p.role] ?? 0) >= (draft.config[p.role] ?? 0))
        m.set(p.id, t("draft.slotFilled", { role: t(`role.${p.role}`) }));
    }
    return m;
  }, [draft, currentSpin, pickedNames, overseas, roleCounts]);
  // dead spin: nothing in this squad fits the open slots → stand-ins who DO fit
  // (same franchise flavour first). Caps stay absolute — quotas can never bust.
  const deadSpin = options.length > 0 && options.every((p) => unavailable.get(p.id));
  const standIns = useMemo(() => {
    if (!draft || !deadSpin) return [];
    const spun = currentSpin ? TEAM_MAP.get(currentSpin.teamId) : undefined;
    const fits = (p: PlayerSeason) =>
      !pickedNames.has(p.player) &&
      (roleCounts[p.role] ?? 0) < (draft.config[p.role] ?? 0) &&
      (!p.overseas || overseas < MAX_OVERSEAS);
    const same = ALL_PLAYERS.filter((p) => p.franchise === spun?.franchise && fits(p)).sort(
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
          name: playerName() || undefined,
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
          games: r.games.map((g) => ({
            opp: g.opp,
            gf: g.gf,
            ga: g.ga,
            result: g.result,
            margin: g.margin,
            superOver: g.superOver,
          })),
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
      dwell = 3600;
      clampMin = 1600;
    } else if (i < 3) {
      dwell = 2400;
    } else if (i < 10) {
      dwell = 1900;
    } else {
      dwell = 2400;
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

  const teamMeta = (teamId: string) => {
    const meta = TEAM_MAP.get(teamId);
    return meta ? { code: meta.code, season: meta.season, colour: meta.colour } : undefined;
  };
  const picked = pickedXI.length;
  const roomBothReady =
    !!roomQ &&
    (roomQ.members?.length ?? 0) === 2 &&
    roomQ.members.every((m: any) => m.picks?.length === 11);
  const modeLabel = initialRoom
    ? t("run.room", { code: initialRoom.toUpperCase() })
    : draft?.mode === "daily"
      ? t("run.dailyWithDate", { date: today })
      : t("run.classic");

  return (
    <div className="flex-1 flex flex-col">
      {draft && (
        <div className="border-b border-hairline">
          <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-2.5 lg:py-3.5 flex items-center gap-3">
            <span className="text-[13px] lg:text-[14px] leading-5 text-muted truncate">
              {modeLabel} · {t(`difficulty.${draft.difficulty}`)}
            </span>
            <span className="flex-1" />
            {draft.status === "drafting" && REROLLS[draft.difficulty] > 0 && (
              <span className="hidden sm:block text-[14px] leading-5 font-medium">
                {t("draft.respinsLeft", { n: draft.rerollsLeft })}
              </span>
            )}
            <button
              onClick={() => {
                const m = !muted;
                setMuted(m);
                try {
                  localStorage.setItem("14-0-mute", m ? "1" : "0");
                } catch {}
              }}
              className="h-9 px-4 rounded-full bg-white/10 text-[13px] lg:text-[14px] font-medium hover:bg-white/18 transition-colors"
            >
              {muted ? t("run.soundOff") : t("run.soundOn")}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setResult(null);
                setSimPhase("idle");
                setSimIdx(0);
                setPoIdx(0);
              }}
              className="h-9 px-4 rounded-full bg-white/10 text-[13px] lg:text-[14px] font-medium hover:bg-white/18 transition-colors"
            >
              {t("run.restart")}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ set up a run */}
      {!draft && (
        <>
          {(!initialRoom || myRoomMember) && (
            <PageBand
              eyebrow={
                initialRoom
                  ? t("run.room", { code: initialRoom.toUpperCase() })
                  : mode === "daily"
                    ? t("run.dailyWithDate", { date: today })
                    : t("run.classic")
              }
              title={t("setup.title")}
            />
          )}
          <div className="mx-auto w-full max-w-[720px] px-5 lg:px-8 pt-5 lg:pt-8 pb-10">
          {initialRoom && !roomQ && (
            <p className="text-[15px] text-muted text-center py-6">
              Finding room {initialRoom.toUpperCase()}…
            </p>
          )}
          {initialRoom && roomQ === null && (
            <div className="bg-surface rounded-card border border-loss p-4 text-center text-[15px]">
              {t("setup.noRoom")}{" "}
              <button className="underline font-medium text-accent" onClick={() => (window.location.search = "")}>
                {t("setup.normalRun")}
              </button>
            </div>
          )}
          {initialRoom && roomQ && !myRoomMember && (
            <div className="bg-surface rounded-card p-5 flex flex-col gap-3">
              <Eyebrow>{t("setup.inviteTitle")}</Eyebrow>
              <span className="head-display text-[26px] leading-[26px] lg:text-[30px] lg:leading-[28px]">
                {roomQ.members?.map((m: any) => m.name).join("  vs  ") || "1v1"}
                {roomQ.members?.length < 2 ? " · one seat open" : ""}
              </span>
              <span className="text-[15px] leading-[22px] text-muted">
                {t("setup.inviteRules", { difficulty: t(`difficulty.${roomQ.difficulty}`) })}
              </span>
              <div className="flex gap-2 pt-1">
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={t("setup.yourName")}
                  maxLength={14}
                  className="flex-1 h-13 rounded-control bg-plate border border-plate-line px-3.5 text-[16px] outline-none focus:border-accent"
                />
                <PrimaryButton
                  disabled={!roomName.trim() || roomBusy}
                  onClick={async () => {
                    if (!roomName.trim() || roomBusy) return;
                    setRoomBusy(true);
                    try {
                      await joinRoom({ code: roomQ.code, name: roomName.trim(), deviceId: deviceId() });
                    } catch {}
                    setRoomBusy(false);
                  }}
                >
                  {roomBusy ? t("setup.joining") : t("setup.join")}
                </PrimaryButton>
              </div>
            </div>
          )}
          {initialRoom && roomQ && myRoomMember && (
            <p className="text-[15px] leading-[22px] text-center bg-surface rounded-card p-4">
              {t("setup.playingAs")} <b>{myRoomMember.name}</b>. {t("setup.draftBelow")}
            </p>
          )}

          {(!initialRoom || myRoomMember) && (
            <>
              <p className="text-[15px] leading-[22px] lg:text-[16px] lg:leading-6 text-muted">
                {t("setup.sub")}
              </p>

              {!initialRoom && !friendFlow && (
                <div className="mt-7 flex flex-col gap-3">
                  <SectionHead title={t("setup.mode")} />
                  <div className="grid grid-cols-2 gap-2.5">
                    {(["classic", "daily"] as GameMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex flex-col gap-0.5 p-4 rounded-card text-left transition-colors ${
                          mode === m ? "bg-surface border-2 border-accent" : "bg-surface border-2 border-transparent hover:bg-white/8"
                        }`}
                      >
                        <span className="font-semibold text-[16px] leading-[22px]">
                          {m === "daily" ? t("home.daily.title") : t("run.classic")}
                        </span>
                        <span
                          className={`text-[13px] leading-[18px] ${
                            mode === m ? "text-white/85" : "text-muted"
                          }`}
                        >
                          {m === "daily" ? t("setup.dailySub") : t("setup.classicSub")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-2.5">
                <SectionHead title={t("setup.shape")} note={t("setup.always11")} />
                {STYLE_TEMPLATES.map((tpl, i) => {
                  const on = styleIdx === i;
                  return (
                    <button
                      key={tpl.name}
                      onClick={() => setStyleIdx(i)}
                      className={`flex items-center gap-3 p-4 rounded-card bg-surface text-left transition-colors ${
                        on ? "border-2 border-accent" : "border-2 border-transparent hover:bg-white/8"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 shrink-0 rounded-full ${
                          on ? "border-[6px] border-accent" : "border-[1.5px] border-white/35"
                        }`}
                      />
                      <span className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <span className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-[16px] leading-5">
                            {t(`style.${tpl.name}`)}
                          </span>
                          <span className="text-[13px] leading-[18px] text-muted">
                            {t(`style.blurb.${tpl.name}`)}
                          </span>
                        </span>
                        {on && <StyleStrip config={tpl.config} />}
                        <span className="text-[13px] leading-[18px] text-muted">
                          {(["Opener", "Middle", "WK", "AR", "Pace", "Spin"] as Role[])
                            .filter((r) => (tpl.config[r] ?? 0) > 0)
                            .map((r) => `${tpl.config[r]} ${t(`role.${r}`)}`)
                            .join(", ")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {initialRoom && roomQ ? (
                <p className="mt-7 text-[15px] leading-[22px] text-center bg-surface rounded-card p-4">
                  {t("setup.roomLocked")} <b>{t(`difficulty.${roomQ.difficulty}`)}</b>
                </p>
              ) : (
                <div className="mt-7 flex flex-col gap-3">
                  <SectionHead title={t("setup.difficulty")} />
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { d: "Rookie", sub: "setup.rookieSub" },
                        { d: "Pro", sub: "setup.proSub" },
                        { d: "Legend", sub: "setup.legendSub" },
                      ] as { d: Difficulty; sub: string }[]
                    ).map(({ d, sub }) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`flex flex-col gap-0.5 p-3.5 rounded-card text-left transition-colors ${
                          difficulty === d ? "bg-surface border-2 border-accent" : "bg-surface border-2 border-transparent hover:bg-white/8"
                        }`}
                      >
                        <span className="font-semibold text-[16px] leading-[22px]">{t(`difficulty.${d}`)}</span>
                        <span
                          className={`text-[13px] leading-[18px] ${
                            difficulty === d ? "text-white/85" : "text-muted"
                          }`}
                        >
                          {t(sub)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-7 pt-6 border-t border-hairline flex flex-col gap-2.5">
                {!initialRoom && (
                  <>
                    <SectionHead title={t("setup.nameHead")} />
                    <p className="text-[14px] leading-5 text-muted">
                      {friendFlow ? t("setup.friendBlurb") : t("setup.nameNote")}
                    </p>
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder={t("setup.yourName")}
                      maxLength={MAX_NAME}
                      className="h-13 rounded-control bg-surface border border-hairline px-3.5 text-[16px] outline-none focus:border-accent"
                    />
                  </>
                )}

                {friendFlow ? (
                  <PrimaryButton
                    className="w-full mt-1"
                    disabled={!roomName.trim() || roomBusy}
                    onClick={async () => {
                      if (!roomName.trim() || roomBusy) return;
                      setRoomBusy(true);
                      setPlayerName(roomName);
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
                  >
                    {roomBusy ? "…" : t("setup.createRoom")}
                  </PrimaryButton>
                ) : (
                  <>
                    <PrimaryButton
                      className="w-full mt-1"
                      onClick={() => {
                        const diff = initialRoom && roomQ ? (roomQ.difficulty as Difficulty) : difficulty;
                        if (initialRoom && roomQ) setDifficulty(roomQ.difficulty as Difficulty);
                        setPlayerName(roomName);
                        startDraft(initialRoom ? "classic" : mode, STYLE_TEMPLATES[styleIdx].config, {
                          difficulty: diff,
                        });
                      }}
                    >
                      {t("setup.start")}
                    </PrimaryButton>
                    <p className="text-[13px] leading-[18px] text-muted text-center">
                      {REROLLS[difficulty] > 0
                        ? t("setup.rules", { n: REROLLS[difficulty] })
                        : t("setup.rulesNone")}
                    </p>
                  </>
                )}
              </div>

            </>
          )}
          </div>
        </>
      )}

      {/* --------------------------------------------------- spin, then pick */}
      {draft && draft.status === "drafting" && currentSpin && (
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-4 lg:pt-6 pb-12">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="head-display text-[28px] leading-[28px] lg:text-[34px] lg:leading-[32px]">
                {t("draft.pickOf", { n: picked + 1 })}
              </h1>
              <span className="flex-1" />
              <span className="text-[14px] leading-5 text-muted">
                {t("draft.slotsOpen", { n: slotsLeft })}
              </span>
            </div>
            <SlotStrip filled={picked} current={picked} />
          </div>

          <div className="mt-5 lg:mt-7 flex flex-col lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-10 lg:items-start">
            <div className="order-2 lg:order-1 mt-7 lg:mt-0">
              <XIPanel
                config={draft.config}
                picks={draft.picks}
                overseas={overseas}
                power={strength?.power}
                bat={strength?.bat}
                bowl={strength?.bowl}
                hideRatings={false}
                teamMeta={teamMeta}
              />
            </div>

            <div className="order-1 lg:order-2 min-w-0">
              {phase === "slot" ? (
                <div className="-mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden">
                  <SlotSpin
                    key={slotKey}
                    targetTeamId={currentSpin.teamId}
                    targetName={spunTeam?.name ?? ""}
                    targetColour={spunTeam?.colour ?? "#141414"}
                    clubPool={ALL_TEAMS.map((t) => t.teamId)}
                    spinKey={slotKey}
                    onLanded={() => setPhase("squad")}
                  />
                </div>
              ) : (
                <>
                  <div className="-mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-5 lg:px-6 lg:py-6 flex flex-col gap-3.5">
                    <div className="flex gap-3 lg:gap-3.5">
                      <div className="flex-1 min-w-0">
                        <Flap
                          label={t("draft.squad")}
                          value={spunTeam?.code ?? currentSpin.teamId}
                          tone="team"
                          colour={spunTeam?.colour}
                          className="h-24 lg:h-[116px]"
                          valueClassName="text-[56px] leading-[52px] lg:text-[72px] lg:leading-[66px]"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Flap
                          label={t("draft.season")}
                          value={spunTeam?.season ?? ""}
                          className="h-24 lg:h-[116px]"
                          valueClassName="text-[56px] leading-[52px] lg:text-[72px] lg:leading-[66px]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-semibold text-[17px] leading-[22px] lg:text-[22px] lg:leading-7">
                          {t("draft.teamSeason", {
                            name: spunTeam?.name ?? currentSpin.teamId,
                            season: spunTeam?.season ?? "",
                          })}
                        </span>
                        <span className="text-[13px] leading-[18px] lg:text-[15px] lg:leading-[22px] text-muted">
                          {hideRatings ? t("draft.legendNote") : t("draft.takeOne")}
                        </span>
                      </div>
                      {REROLLS[draft.difficulty] > 0 && (
                        <PlateButton
                          className="h-11 shrink-0"
                          onClick={rerollSpin}
                          disabled={draft.rerollsLeft <= 0}
                        >
                          {t("draft.respin", { n: draft.rerollsLeft })}
                        </PlateButton>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2.5">
                    <div className="flex flex-col gap-1.5">
                      <SectionHead
                        title={
                          lastResort
                            ? t("draft.deadSpin")
                            : deadSpin
                              ? t("draft.noFit")
                              : t("draft.pickFrom", { season: spunTeam?.season ?? "" })
                        }
                      />
                      <p className="text-[13px] leading-[18px] lg:text-[14px] lg:leading-5 text-muted">
                        {deadSpin && !lastResort
                          ? t("draft.standIns")
                          : t("draft.stillOpen", { roles: openSlotSummary(draft.config, roleCounts, t) })}
                      </p>
                    </div>
                    <SquadList
                      squad={shownOptions}
                      hideRatings={hideRatings}
                      shuffleKey={hideRatings ? `${draft.seed}:${currentSpin?.teamId ?? ""}` : undefined}
                      onPick={pick}
                      unavailable={effectiveUnavailable}
                      teamColour={spunTeam?.colour}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- XI is locked */}
      {draft && draft.status === "complete" && !result && (
        <>
        <PageBand eyebrow={modeLabel} title={t("xi.locked")} />
        <div className="mx-auto w-full max-w-[900px] px-5 lg:px-8 pt-4 lg:pt-7 pb-12">
          <p className="text-[15px] leading-[22px] lg:text-[16px] lg:leading-6 text-muted">
            {inRoomGame ? t("xi.lockedRoomSub") : t("xi.lockedSub")}
          </p>

          {!validity.valid && (
            <p className="mt-3 text-[14px] leading-5 text-loss">
              {t("xi.penalty", { errors: validity.errors.join(" · ") })}
            </p>
          )}

          <div className="mt-5 -mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-5 lg:px-7 lg:py-7 flex flex-col gap-5">
            <div className="flex gap-6 lg:gap-10">
              <div className="flex flex-col gap-1">
                <Eyebrow>{t("xi.teamPower")}</Eyebrow>
                <span className="font-display font-bold text-[72px] leading-[62px] pt-1.5 tabular">
                  {Math.round(strength?.power ?? 0)}
                </span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {[
                  [t("xi.batting"), t(`unit.${unitWord(strength?.bat ?? 0)}`)],
                  [t("xi.bowling"), t(`unit.${unitWord(strength?.bowl ?? 0)}`)],
                  [t("xi.overseas"), t("xi.ofFour", { n: overseas })],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2">
                    <span className="w-[84px] text-[14px] leading-5 text-muted">{k}</span>
                    <span className="font-semibold text-[16px] leading-5">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {forecast && !inRoomGame && (
              <div className="pt-5 border-t border-hairline flex flex-col gap-2.5">
                <Eyebrow>{t("xi.bookies")}</Eyebrow>
                <div className="flex gap-2">
                  {[
                    [String(forecast.expPts), t("xi.expPoints")],
                    [
                      forecast.rankLo === forecast.rankHi
                        ? ordinal(forecast.medRank, t)
                        : `${forecast.rankLo}–${forecast.rankHi}`,
                      t("xi.likelyFinish"),
                    ],
                    [`${forecast.playoffPct}%`, t("xi.makePlayoffs")],
                    [`${forecast.titlePct}%`, t("xi.winTitle")],
                  ].map(([v, k]) => (
                    <div key={k} className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="font-display font-semibold text-[30px] leading-7 lg:text-[36px] lg:leading-8 pt-1 tabular">
                        {v}
                      </span>
                      <span className="text-[13px] leading-[18px] text-muted">{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            {inRoomGame ? (
              roomSubmitted ? (
                <a
                  href={`/m/${initialRoom!.toUpperCase()}`}
                  className={`flex items-center justify-center h-14 w-full rounded-full font-semibold text-[17px] transition-colors ${
                    roomBothReady
                      ? "bg-accent text-ground hover:bg-accent-deep"
                      : "bg-white/10 text-white hover:bg-white/18"
                  }`}
                >
                  {roomBothReady ? t("xi.startLeague") : t("xi.waitingOpponent")}
                </a>
              ) : (
                <PrimaryButton
                  className="w-full"
                  disabled={roomBusy}
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
                >
                  {roomBusy ? t("xi.locking") : t("xi.lockIn")}
                </PrimaryButton>
              )
            ) : (
              <>
                <PrimaryButton className="w-full" onClick={simulate}>
                  {t("xi.playSeason")}
                </PrimaryButton>
                <p className="text-[13px] leading-[18px] text-muted text-center">
                  {t("xi.playNote")}
                </p>
              </>
            )}
          </div>

          <div className="mt-8">
            <XIPanel
              title={t("xi.theXI")}
              config={draft.config}
              picks={draft.picks}
              overseas={overseas}
              hideRatings={false}
              teamMeta={teamMeta}
            />
          </div>
        </div>
        </>
      )}

      {/* ------------------------------------------------------------ the sim */}
      {result && draft && (
        <>
          {(simPhase === "league" || simPhase === "leagueDone") && (
            <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-4 lg:pt-6 pb-12">
              <div className="-mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-5 lg:px-7 lg:py-7 flex flex-col lg:flex-row lg:items-end gap-5 lg:gap-11">
                <div className="flex gap-3 lg:shrink-0">
                  <Flap
                    label={t("word.won")}
                    value={simShown.wins}
                    valueColour="#4FCB74"
                    wrapClassName="flex-1 lg:flex-none lg:w-[148px]"
                    className="h-[88px] lg:h-[132px]"
                    valueClassName="text-[72px] leading-[64px] lg:text-[108px] lg:leading-[96px]"
                  />
                  <Flap
                    label={t("word.lost")}
                    value={simShown.losses}
                    valueColour={simShown.losses ? "#FF5A47" : "#FFFFFF"}
                    wrapClassName="flex-1 lg:flex-none lg:w-[148px]"
                    className="h-[88px] lg:h-[132px]"
                    valueClassName="text-[72px] leading-[64px] lg:text-[108px] lg:leading-[96px]"
                  />
                </div>

                <div className="flex flex-col gap-2.5 flex-1 lg:pb-1.5">
                  <span className="head-display text-[26px] leading-[26px] lg:text-[32px] lg:leading-[30px]">
                    {simPhase === "league"
                      ? t("league.matchOf", { n: Math.min(simIdx + 1, 14) })
                      : t("league.complete")}
                  </span>
                  <span
                    className={`font-semibold text-[15px] leading-[22px] lg:text-[17px] lg:leading-6 ${
                      simShown.losses === 0 && simShown.wins > 0 ? "text-turf-soft" : "text-muted"
                    }`}
                  >
                    {simPhase === "leagueDone"
                      ? t("league.finishedLine", {
                          rank: ordinal(result.rank, t),
                          points: result.points,
                          note: result.madePlayoffs ? t("league.inTopFour") : t("league.outsideTopFour"),
                        })
                      : leagueLine(simShown.wins, simShown.losses, t)}
                  </span>
                </div>

                <div className="flex gap-2.5 lg:shrink-0 lg:pb-2">
                  <PlateButton
                    className="h-11 flex-1 lg:flex-none"
                    onClick={() => setSimSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                  >
                    {t("league.speed", { n: simSpeed })}
                  </PlateButton>
                  {simPhase === "league" && (
                    <PlateButton className="h-11 flex-1 lg:flex-none" onClick={simSkip}>
                      {t("league.skip")}
                    </PlateButton>
                  )}
                </div>
              </div>

              <StatStrip className="mt-3">
                <StatCell label={t("word.points")} value={simShown.wins * 2} tone="good" />
                <StatCell
                  label={t("word.nrr")}
                  value={`${simShown.nrr > 0 ? "+" : ""}${simShown.nrr}`}
                  tone={simShown.nrr >= 0 ? "plain" : "bad"}
                />
                <StatCell label={t("word.runsScored")} value={leagueRuns(simShown.games)} />
              </StatStrip>

              <div
                className={`mt-6 flex flex-col ${
                  simPhase === "leagueDone" ? "lg:flex-row lg:gap-12 lg:items-start" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <SectionHead
                    title={t("league.results")}
                    note={simPhase === "league" ? t("league.tapAhead") : undefined}
                  />
                  <div
                    ref={feedRef}
                    className="mt-3 flex flex-col gap-2.5 h-[360px] lg:h-[440px] overflow-y-auto pr-1"
                    onClick={simPhase === "league" ? simAdvance : undefined}
                  >
                    {[...simShown.games].map((g, i) => (
                      <MatchRow
                        key={i}
                        n={i + 1}
                        g={g}
                        hero={leagueHero(g, i, t, result.matchStars[i])}
                      />
                    ))}
                  </div>
                </div>

                {simPhase === "leagueDone" && (
                  <div className="mt-8 lg:mt-0 lg:w-[440px] lg:shrink-0">
                    <PointsTable rows={result.table} championIsYou={result.champion} />
                  </div>
                )}
              </div>

              {simPhase === "leagueDone" && (
                <div className="mt-8">
                  {result.madePlayoffs ? (
                    <>
                      <div className="flex flex-col items-center gap-3">
                        <p className="font-semibold text-[17px] leading-6 lg:text-[20px] lg:leading-7 text-center">
                          {t("league.threeWins")}
                        </p>
                        <PrimaryButton
                          className="w-full sm:w-auto sm:px-12"
                          onClick={() => {
                            setPoIdx(0);
                            setSimPhase("playoffs");
                          }}
                        >
                          {t("league.intoPlayoffs")}
                        </PrimaryButton>
                      </div>
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

          {simPhase === "playoffs" && (
            <div className="mx-auto w-full max-w-[900px] px-5 lg:px-8 pt-5 pb-12 flex flex-col gap-3.5">
              <div className="flex items-baseline gap-3">
                <h1 className="head-display text-[28px] leading-[28px] lg:text-[34px] lg:leading-[32px]">
                  {t("po.title")}
                </h1>
                <span className="text-[14px] leading-5 text-muted">
                  {t("po.via", { rank: result.rank, w: result.wins, l: result.losses })}
                </span>
                <span className="flex-1" />
                <PlateButton onClick={() => setSimSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}>
                  {t("league.speed", { n: simSpeed })}
                </PlateButton>
              </div>
              {nonFinals.slice(0, poIdx).map((p, i) => (
                <PlayoffSummary key={i} stage={t(`stage.${p.stage}`)} gf={p.gf} ga={p.ga} win={p.result === "W"} margin={p.margin} />
              ))}
              {nonFinals[poIdx] && nonFinals[poIdx].detail && (
                <PlayoffMatch
                  key={poIdx}
                  stage={t(`stage.${nonFinals[poIdx].stage}`)}
                  detail={nonFinals[poIdx].detail!}
                  userTag="YOU"
                  speed={simSpeed}
                  nextLabel={
                    nonFinals[poIdx].result === "W"
                      ? poIdx + 1 < nonFinals.length
                        ? t("po.next", { stage: t(`stage.${nonFinals[poIdx + 1].stage}`) })
                        : t("po.toFinal")
                      : t("po.seasonOver")
                  }
                  onDone={onPlayoffDone}
                />
              )}
            </div>
          )}

          {simPhase === "preFinal" && finalGame && (
            <div className="mx-auto w-full max-w-[900px] px-5 lg:px-8 pt-5 pb-12">
              <div className="-mx-5 lg:mx-0 lg:rounded-card bg-surface text-white px-5 py-8 lg:px-10 lg:py-12 text-center flex flex-col items-center gap-3">
                <Eyebrow tone="trophy">{t("po.theFinal")}</Eyebrow>
                <span className="head-display text-[36px] leading-[34px] lg:text-[52px] lg:leading-[48px]">
                  {t("po.versus", { opp: finalGame.detail?.opp ?? "?" })}
                </span>
                <span className="text-[15px] leading-[22px] text-muted">
                  {t("po.oneGame")}
                </span>
                <PrimaryButton className="mt-3 w-full sm:w-auto px-10" onClick={() => setSimPhase("final")}>
                  {t("po.playFinal")}
                </PrimaryButton>
              </div>
            </div>
          )}

          {simPhase === "final" && finalGame && finalGame.detail && (
            <div className="mx-auto w-full max-w-[900px] px-5 lg:px-8 pt-5 pb-12">
              <PlayoffMatch
                stage={t("stage.Final")}
                detail={finalGame.detail}
                userTag="YOU"
                speed={simSpeed}
                fullMatch
                nextLabel={finalGame.result === "W" ? t("po.liftTrophy") : t("po.fullTime")}
                onDone={() => setSimPhase("done")}
              />
            </div>
          )}

          {simPhase === "done" && (
            <div className="pb-12">
              <PageBand
                eyebrow={modeLabel}
                title={headline(result, t)}
                tone={result.champion ? "trophy" : "accent"}
              />
              <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-4 lg:pt-6">
                <div className="-mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-6 lg:px-9 lg:py-9 flex flex-col xl:flex-row xl:items-end gap-6 xl:gap-10 2xl:gap-14">
                  <div className="flex gap-3 xl:gap-3.5 xl:shrink-0">
                    <Flap
                      label={t("word.won")}
                      value={result.wins}
                      valueColour="#4FCB74"
                      wrapClassName="flex-1 xl:flex-none xl:w-[150px] 2xl:w-[196px]"
                      className="h-[120px] xl:h-[180px] 2xl:h-[224px]"
                      valueClassName="text-[112px] leading-[98px] xl:text-[132px] xl:leading-[114px] 2xl:text-[176px] 2xl:leading-[152px]"
                    />
                    <Flap
                      label={t("word.lost")}
                      value={result.losses}
                      valueColour={result.losses ? "#FF5A47" : "#FFFFFF"}
                      wrapClassName="flex-1 xl:flex-none xl:w-[150px] 2xl:w-[196px]"
                      className="h-[120px] xl:h-[180px] 2xl:h-[224px]"
                      valueClassName="text-[112px] leading-[98px] xl:text-[132px] xl:leading-[114px] 2xl:text-[176px] 2xl:leading-[152px]"
                    />
                  </div>

                  <div className="flex flex-col gap-4 flex-1 min-w-0 xl:pb-1">
                    <p className="text-[15px] leading-[22px] lg:text-[17px] lg:leading-[26px] text-muted">
                      {resultBlurb(result, t)}
                    </p>
                    <SeasonStrip result={result} />
                  </div>

                  <div className="flex flex-col gap-2.5 xl:w-[268px] xl:shrink-0">
                    <ShareButtons
                      shareText={shareText}
                      seed={draft.seed}
                      spins={draft.spins.map((s) => s.teamId)}
                      copied={copied}
                      setCopied={setCopied}
                      challengeCopied={challengeCopied}
                      setChallengeCopied={setChallengeCopied}
                      onPlate
                    />
                  </div>
                </div>

                <StatStrip className="mt-3">
                  <StatCell
                    label={t("word.points")}
                    value={result.points}
                    tone={result.champion ? "trophy" : "good"}
                  />
                  <StatCell
                    label={t("word.nrr")}
                    value={`${result.nrr > 0 ? "+" : ""}${result.nrr}`}
                    tone={result.nrr >= 0 ? "plain" : "bad"}
                  />
                  <StatCell
                    label={t("word.onTheTable")}
                    value={ordinal(result.rank, t)}
                    tone={result.madePlayoffs ? "accent" : "plain"}
                  />
                  <StatCell
                    label={t("word.difficulty")}
                    value={t(`difficulty.${draft.difficulty}`)}
                  />
                </StatStrip>
              </div>

              <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 mt-8">
                <SeasonReport
                  result={result}
                  forecast={forecast}
                  bat={strength?.bat ?? 0}
                  bowl={strength?.bowl ?? 0}
                  compact
                />
                <div className="mt-8 flex flex-col lg:flex-row lg:gap-12 lg:items-start">
                  <div className="lg:w-[440px] lg:shrink-0">
                    <PointsTable rows={result.table} championIsYou={result.champion} />
                  </div>
                  <div className="mt-8 lg:mt-0 flex-1 flex flex-col gap-3">
                    <PrimaryButton
                      className="w-full"
                      onClick={() => startDraft(mode, draft.config)}
                    >
                      {t("end.playAnother")}
                    </PrimaryButton>
                    <p className="text-[13px] leading-5 text-muted text-center">
                      {t("end.playAnotherNote")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

const CODE_COLOUR: Record<string, string> = {
  MI: "#004BA0",
  CSK: "#FDB913",
  RCB: "#EC1C24",
  KKR: "#3A225D",
  DC: "#17479E",
  DD: "#17479E",
  SRH: "#FF822A",
  RR: "#EA1A85",
  PBKS: "#E81828",
  KXIP: "#E81828",
  GT: "#1B2133",
  LSG: "#00A3E0",
  DCH: "#143975",
  KTK: "#E25B13",
  PWI: "#3D6BB3",
  GL: "#E04F16",
  RPS: "#D6218B",
};

function oppColour(code: string): string {
  return CODE_COLOUR[code] ?? "#2E2E2E";
}

function openSlotSummary(
  config: XIConfig,
  counts: Record<string, number>,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  const words: string[] = [];
  (["Opener", "Middle", "WK", "AR", "Pace", "Spin"] as Role[]).forEach((r) => {
    const left = (config[r] ?? 0) - (counts[r] ?? 0);
    if (left > 0) words.push(`${left} ${t(`role.${r}`)}`);
  });
  return words.join(", ");
}

function leagueLine(
  wins: number,
  losses: number,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  if (losses === 0 && wins >= 1) return t("league.unbeaten", { n: 14 - wins });
  if (losses === 1) return t("league.oneDefeat");
  return t("league.record", { w: wins, l: losses });
}

function headline(
  r: SeasonResult,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  if (r.perfect14 && r.champion) return t("end.perfect");
  if (r.champion) return t("end.champions");
  if (r.madePlayoffs) return t("end.knockedOut", { stage: knockoutStage(r, t) });
  return t("end.missed");
}

function resultBlurb(
  r: SeasonResult,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  const bits: string[] = [];
  bits.push(
    t("end.recordLine", { w: r.wins, l: r.losses, points: r.points, rank: ordinal(r.rank, t) })
  );
  bits.push(
    t("end.capsLine", {
      orange: r.orangeCap.player,
      runs: r.orangeCap.runs,
      purple: r.purpleCap.player,
      wickets: r.purpleCap.wickets,
    })
  );
  if (r.perfect14) bits.push(t("end.neverDone"));
  else if (!r.madePlayoffs) bits.push(t("end.promisedLand"));
  return bits.join(" ");
}

/** Fourteen league bars, then the playoff bars in gold. */
function SeasonStrip({ result }: { result: SeasonResult }) {
  return (
    <div className="flex gap-1 items-center" aria-hidden>
      {result.games.map((g, i) => (
        <span
          key={i}
          className="flex-1 h-2.5 rounded-[2px]"
          style={{ backgroundColor: g.result === "W" ? "#1A8A3C" : "#FF5A47" }}
        />
      ))}
      {result.playoffs.length > 0 && <span className="w-2.5" />}
      {result.playoffs.map((p, i) => (
        <span
          key={`p${i}`}
          className="flex-1 h-2.5 rounded-[2px]"
          style={{ backgroundColor: p.result === "W" ? "#E0A81C" : "#FF5A47" }}
        />
      ))}
    </div>
  );
}

function StyleStrip({ config }: { config: XIConfig }) {
  const cells: { letter: string; bg: string }[] = [];
  const push = (n: number, letter: string, bg: string) => {
    for (let i = 0; i < n; i++) cells.push({ letter, bg });
  };
  push(config.Opener ?? 0, "O", "#000000");
  push(config.Middle ?? 0, "M", "#4A4A4A");
  push(config.WK ?? 0, "WK", "#000000");
  push(config.AR ?? 0, "AR", "#4A4A4A");
  push(config.Pace ?? 0, "P", "#1A8A3C");
  push(config.Spin ?? 0, "S", "#1A8A3C");
  return (
    <span className="flex gap-[3px]" aria-hidden>
      {cells.map((c, i) => (
        <span
          key={i}
          className="w-6 h-[22px] flex items-center justify-center rounded-[3px] font-display font-semibold text-[15px] leading-none text-white pt-[2px]"
          style={{ backgroundColor: c.bg }}
        >
          {c.letter}
        </span>
      ))}
    </span>
  );
}

/** One finished league game, as a match card: the result line, the split
    scoreboard, then who won it for you. */
function MatchRow({ n, g, hero }: { n: number; g: GameResult; hero: string }) {
  const t = useT();
  const win = g.result === "W";
  const colour = oppColour(g.opp);
  const superOver = g.margin === "Super Over";
  const m = localiseMargin(g.margin, t);
  const wide = superOver
    ? t(win ? "match.wonSO" : "match.lostSO")
    : t(win ? "match.won" : "match.lost", { margin: m });
  const narrow = superOver
    ? t(win ? "match.beatSO" : "match.lostToSO", { opp: g.opp })
    : t(win ? "match.beat" : "match.lostTo", { opp: g.opp, margin: m });
  return (
    <div className="shrink-0 bg-surface rounded-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 lg:px-4 py-2.5">
        <span
          className={`w-6 h-6 lg:w-[26px] lg:h-[26px] shrink-0 flex items-center justify-center rounded-chip font-display font-bold text-[18px] lg:text-[19px] leading-none text-white pt-[2px] ${
            win ? "bg-turf" : "bg-loss"
          }`}
        >
          {g.result}
        </span>
        <span className="flex-1 min-w-0 font-medium text-[15px] leading-5 truncate">
          <span className="sm:hidden">{narrow}</span>
          <span className="hidden sm:inline">{wide}</span>
        </span>
        <Eyebrow tone="muted" className="shrink-0">
          M{n}
        </Eyebrow>
      </div>
      <SplitScore
        homeName={t("table.yourXI")}
        homeScore={g.gf}
        awayName={g.opp}
        awayScore={g.ga}
        awayColour={colour}
        height="h-[84px] lg:h-[92px]"
        scoreClass="text-[32px] leading-[32px] lg:text-[38px] lg:leading-[36px]"
      />
      <div className="px-3.5 lg:px-4 py-2.5 text-[13px] leading-[18px] lg:text-[14px] lg:leading-5 text-muted truncate">
        {hero}
      </div>
    </div>
  );
}

function PointsTable({ rows, championIsYou }: { rows: SeasonResult["table"]; championIsYou?: boolean }) {
  const t = useT();
  return (
    <section className="flex flex-col">
      <SectionHead title={t("table.title")} note={t("table.topFour")} />
      <div className="mt-3 bg-surface rounded-card px-3 pt-1 pb-2">
      <div className="flex items-center gap-2 h-7 px-2 text-[12px] leading-4 text-muted">
        <span className="w-[22px] shrink-0" />
        <span className="flex-1">{t("table.team")}</span>
        <span className="w-[26px] shrink-0 text-right">P</span>
        <span className="w-[26px] shrink-0 text-right">W</span>
        <span className="w-[26px] shrink-0 text-right">L</span>
        <span className="w-[34px] shrink-0 text-right">Pts</span>
        <span className="w-[54px] shrink-0 text-right">NRR</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.team}>
          <div
            className={`flex items-center gap-2 h-[42px] px-2 ${
              r.you ? "bg-accent/15 rounded-card" : "border-t border-hairline"
            } ${i === rows.length - 1 && !r.you ? "border-b" : ""}`}
          >
            <span className="w-[22px] shrink-0 font-display font-semibold text-[20px] leading-[18px] pt-[3px] tabular">
              {i + 1}
            </span>
            <span
              className={`flex-1 min-w-0 flex items-center gap-1.5 truncate ${
                r.you ? "font-semibold text-[16px] leading-[22px]" : "text-[15px] leading-5"
              } ${!r.you && i > 3 ? "text-muted" : ""}`}
            >
              {r.you ? t("table.yourXI") : r.team}
              {r.you && championIsYou && <Crown size={18} />}
            </span>
            {(["p", "w", "l"] as const).map((k) => (
              <span
                key={k}
                className={`w-[26px] shrink-0 text-right font-display font-medium text-[19px] leading-[18px] pt-[3px] tabular ${
                  !r.you && i > 3 ? "text-muted" : ""
                }`}
              >
                {r[k]}
              </span>
            ))}
            <span
              className={`w-[34px] shrink-0 text-right font-display font-semibold text-[19px] leading-[18px] pt-[3px] tabular ${
                !r.you && i > 3 ? "text-muted" : ""
              }`}
            >
              {r.pts}
            </span>
            <span
              className={`w-[54px] shrink-0 text-right font-display font-medium text-[19px] leading-[18px] pt-[3px] tabular ${
                !r.you && i > 3 ? "text-muted" : ""
              }`}
            >
              {r.nrr > 0 ? "+" : ""}
              {r.nrr}
            </span>
          </div>
          {i === 3 && (
            <div className="flex items-center h-7 pt-1.5 px-2 border-t-2 border-accent/50">
              <Eyebrow tone="muted">{t("table.cut")}</Eyebrow>
            </div>
          )}
        </div>
      ))}
      </div>
    </section>
  );
}

function PlayoffSummary({
  stage,
  gf,
  ga,
  win,
  margin,
}: {
  stage: string;
  gf: string;
  ga: string;
  win: boolean;
  margin: string;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 bg-surface rounded-card px-3.5 py-3">
      <Eyebrow tone={win ? "trophy" : "muted"} className="w-[110px] shrink-0">
        {stage}
      </Eyebrow>
      <span
        className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-chip font-display font-bold text-[18px] leading-none pt-[2px] ${
          win ? "bg-trophy text-ground" : "bg-loss text-white"
        }`}
      >
        {win ? "W" : "L"}
      </span>
      <span className="flex-1 min-w-0 text-[15px] leading-5 truncate">
        {t(win ? "match.won" : "match.lost", { margin: localiseMargin(margin, t) })}
      </span>
      <span className="shrink-0 font-display font-semibold text-[20px] leading-5 pt-[3px] tabular">
        {gf} · {ga}
      </span>
    </div>
  );
}

function ShareButtons({
  shareText,
  seed,
  spins,
  copied,
  setCopied,
  challengeCopied,
  setChallengeCopied,
  onPlate,
}: {
  shareText: string;
  seed: string;
  spins: string[];
  copied: boolean;
  setCopied: (v: boolean) => void;
  challengeCopied: boolean;
  setChallengeCopied: (v: boolean) => void;
  onPlate?: boolean;
}) {
  const t = useT();
  return (
    <>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 h-14 px-6 rounded-full bg-turf text-white font-semibold text-[17px] whitespace-nowrap hover:bg-[#15702f] active:bg-[#125f28] transition-colors"
      >
        <WhatsAppIcon />
        {t("share.whatsapp")}
      </a>
      <OutlineButton
        onPlate={onPlate}
        onClick={async () => {
          if (await copyText(shareText)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? t("share.copied") : t("share.copy")}
      </OutlineButton>
      <OutlineButton
        onPlate={onPlate}
        onClick={async () => {
          const url = `${window.location.origin}/?challenge=${spins.join(",")}`;
          if (await copyText(t("share.beatMyBoard", { url }))) {
            setChallengeCopied(true);
            setTimeout(() => setChallengeCopied(false), 2000);
          }
        }}
      >
        {challengeCopied ? t("share.linkCopied") : t("share.challenge")}
      </OutlineButton>
      <p className="text-[13px] leading-[18px] pt-0.5 text-muted">
        {t("share.replayNote", { seed })}
      </p>
    </>
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
  const t = useT();
  return (
    <div className="mt-6 flex flex-col gap-2.5 max-w-[420px]">
      <ShareButtons
        shareText={shareText}
        seed={seed}
        spins={spins}
        copied={copied}
        setCopied={setCopied}
        challengeCopied={challengeCopied}
        setChallengeCopied={setChallengeCopied}
      />
      <PrimaryButton className="w-full mt-1" onClick={() => startDraft(mode, draftConfig)}>
        {t("end.playAnother")}
      </PrimaryButton>
    </div>
  );
}

const OPP_HEROES = ["Warner", "Buttler", "Bumrah", "Rashid", "Gayle", "Dhoni", "ABD", "Malinga", "Narine", "Pant", "SKY", "Head"];

function shortName(full: string): string {
  const parts = full.split(" ");
  if (parts.length === 1) return full;
  return `${parts[0][0]} ${parts[parts.length - 1]}`;
}

// hero line from the actual match stars
function leagueHero(
  g: GameResult,
  i: number,
  t: (k: string, v?: Record<string, string | number>) => string,
  star?: { bat: { player: string; runs: number; balls: number }; bowl: { player: string; wickets: number; runsConceded: number } }
): string {
  if (g.result === "W" && star) {
    return g.margin.includes("runs")
      ? t("hero.defended", {
          name: shortName(star.bowl.player),
          w: star.bowl.wickets,
          r: star.bowl.runsConceded,
        })
      : t("hero.finished", {
          name: shortName(star.bat.player),
          runs: star.bat.runs,
          balls: star.bat.balls,
        });
  }
  const h = OPP_HEROES[(g.opp.length + i) % OPP_HEROES.length];
  return t("hero.opp", { name: h });
}

function leagueRuns(games: GameResult[]): number {
  return games.reduce((a, g) => a + (parseInt(g.gf.split("/")[0], 10) || 0), 0);
}

function knockoutStage(
  r: SeasonResult,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  const last = r.playoffs[r.playoffs.length - 1];
  if (!last) return t("stage.playoffs");
  return t(`stage.${last.stage}`);
}
