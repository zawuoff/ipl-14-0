"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  distributeMatch,
  simSharedLeague,
  teamStrength,
  type GameResult,
  type MatchStar,
  type SeasonResult,
  type SharedFixture,
  type SharedLeague,
  type SharedPlayoff,
  type TableRow,
} from "@/lib/sim/engine";
import { buildPlayerSeasons } from "@/lib/game/data";
import { mulberry32, type Difficulty, type PlayerSeason } from "@/lib/game/types";
import { PlayoffMatch, type PlayoffDetail } from "./PlayoffMatch";
import { SeasonReport } from "./SeasonReport";
import { copyText } from "@/lib/clipboard";

const ALL_PLAYERS = buildPlayerSeasons();
const BY_ID = new Map(ALL_PLAYERS.map((p) => [p.id, p]));

export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let d = localStorage.getItem("14-0-device");
  if (!d) {
    d = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("14-0-device", d);
  }
  return d;
}

function parseScore(s: string): [number, number] {
  const p = s.split("/");
  return [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
}

function shortName(full: string): string {
  const parts = full.split(" ");
  if (parts.length === 1) return full;
  return `${parts[0][0]} ${parts[parts.length - 1]}`;
}

// Neutral shared detail → my PlayoffDetail view.
function adaptDetail(
  d: SharedFixture["detail"] | SharedPlayoff["detail"],
  homeIdx: number,
  awayIdx: number,
  meIdx: number,
  myName: string,
  oppName: string
): PlayoffDetail | null {
  if (!d) return null;
  const iAmHome = homeIdx === meIdx;
  const userFirst = (d.firstIsHome && iAmHome) || (!d.firstIsHome && !iAmHome);
  const norm = (n: string) => (n === "YOU" ? myName : n === "OPP" ? oppName : n);
  return {
    inn1: d.inn1,
    inn2: d.inn2,
    userFirst,
    opp: oppName,
    superOver: d.superOver
      ? {
          inn1: { ...d.superOver.inn1, side: norm(d.superOver.inn1.side) },
          inn2: { ...d.superOver.inn2, side: norm(d.superOver.inn2.side) },
          winnerIsUser:
            (d.superOver.inn1.side === myName || (d.superOver.inn1.side === "YOU" && iAmHome) || (d.superOver.inn1.side === "HOME" && iAmHome)) &&
            true,
          scoreline: "",
        }
      : undefined,
  };
}

export function RoomSeason({ room }: { room: any }) {
  const meId = deviceId();
  const members: any[] = room.members ?? [];
  const me = members.find((m) => m.deviceId === meId) ?? members[0];
  const mate = members.find((m) => m.deviceId !== (me?.deviceId ?? meId)) ?? members[1];

  const league: SharedLeague | null = useMemo(() => {
    try {
      const humans = members
        .filter((m) => m.picks?.length === 11)
        .map((m) => ({
          name: m.name,
          deviceId: m.deviceId,
          xi: m.picks.map((id: string) => BY_ID.get(id)).filter(Boolean) as PlayerSeason[],
        }))
        .filter((h) => h.xi.length === 11);
      if (humans.length < 2) return null;
      // order stable: host (members[0]) first
      humans.sort(
        (a, b) => members.findIndex((m) => m.deviceId === a.deviceId) - members.findIndex((m) => m.deviceId === b.deviceId)
      );
      return simSharedLeague(humans, room.roomSeed, room.difficulty as Difficulty);
    } catch {
      return null;
    }
  }, [room]);

  const [phase, setPhase] = useState<"league" | "leagueDone" | "playoffs" | "preFinal" | "final" | "done">("league");
  const [simIdx, setSimIdx] = useState(0);
  const [poIdx, setPoIdx] = useState(0);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const myIdx = league ? league.teams.findIndex((t) => t.deviceId === me?.deviceId) : -1;
  const myName = me?.name ?? "YOU";
  const myFixtures = useMemo(
    () => (league ? league.fixtures.filter((f) => f.home === myIdx || f.away === myIdx) : []),
    [league, myIdx]
  );

  useEffect(() => {
    if (phase !== "league" || !league) return;
    if (simIdx >= myFixtures.length) {
      setPhase("leagueDone");
      return;
    }
    const i = simIdx;
    const dwell = i < 3 ? 1200 : i < 12 ? 750 : 1300;
    const t = setTimeout(() => setSimIdx((v) => v + 1), dwell / speed);
    return () => clearTimeout(t);
  }, [phase, simIdx, speed, myFixtures.length, league]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [simIdx, phase]);

  const shown = myFixtures.slice(0, Math.min(simIdx, myFixtures.length));
  const wins = shown.filter((f) => f.winner === myIdx).length;
  const losses = shown.length - wins;

  // awards from my innings across shown/all fixtures
  const report: (SeasonResult & { _st: { bat: number; bowl: number } }) | null = useMemo(() => {
    if (!league || myIdx < 0) return null;
    const xi = league && BY_ID
      ? members
          .find((m) => m.deviceId === me?.deviceId)
          ?.picks.map((id: string) => BY_ID.get(id))
          .filter(Boolean) as PlayerSeason[]
      : [];
    if (!xi || xi.length !== 11) return null;
    const games: GameResult[] = [];
    const stars: MatchStar[] = [];
    const agg = new Map<string, { runs: number; balls: number; wkts: number }>();
    let rf = 0;
    let ra = 0;
    let w = 0;
    let biggestWin = "—";
    let biggestScore = -1;
    myFixtures.forEach((f, fi) => {
      const iAmHome = f.home === myIdx;
      const myS = iAmHome ? f.hs : f.as;
      const opS = iAmHome ? f.as : f.hs;
      const [mr, mw] = parseScore(myS);
      const [or] = parseScore(opS);
      const [, ow] = parseScore(iAmHome ? f.as : f.hs);
      void mw;
      void or;
      const won = f.winner === myIdx;
      if (won) w++;
      rf += mr;
      ra += iAmHome ? f.ar : f.hr;
      const rng = mulberry32((room.roomSeed + 7000 + fi * 31) >>> 0);
      const star = distributeMatch(xi, mr, mw, ow, rng);
      stars.push(star);
      for (const b of star.batAll) bump(agg, b.player, b.runs, b.balls, 0);
      for (const w of star.bowlAll) bump(agg, w.player, 0, 0, w.wickets);
      if (won) {
        const m = parseInt(f.margin, 10) || 0;
        const score = f.margin.includes("runs") ? m : m * 10;
        if (score > biggestScore) {
          biggestScore = score;
          biggestWin = `Won by ${f.margin} vs ${league.teams[iAmHome ? f.away : f.home].name}`;
        }
      }
      games.push({
        opp: league.teams[iAmHome ? f.away : f.home].name,
        gf: myS,
        ga: opS,
        result: won ? "W" : "L",
        margin: f.margin,
        oppPower: 0,
        userRuns: mr,
        oppRuns: iAmHome ? f.ar : f.hr,
        superOver: f.superOverNote ? `SO ${f.superOverNote.replace("SO ", "")}` : undefined,
      });
    });
    const nrr = Math.round(((rf - ra) / (myFixtures.length * 20)) * 100) / 100;
    const rank = league.table.findIndex((r) => r.team === myName) + 1;
    const info = new Map(xi.map((p) => [p.player, p]));
    const playerRuns = [...agg.entries()].map(([player, e]) => ({
      player,
      role: info.get(player)?.role ?? "",
      overall: info.get(player)?.overall ?? 0,
      runs: e.runs,
      wickets: e.wkts,
    }));
    for (const p of xi) {
      if (!agg.has(p.player)) playerRuns.push({ player: p.player, role: p.role, overall: p.overall, runs: 0, wickets: 0 });
    }
    playerRuns.sort((a, b) => b.runs - a.runs || b.wickets - a.wickets);
    // league-wide caps across BOTH managers (same league → same awards on both screens)
    const mateIdx = league.teams.findIndex((t, i) => t.human && i !== myIdx);
    const mateXi: PlayerSeason[] =
      mateIdx >= 0
        ? (members.find((m) => m.deviceId === league.teams[mateIdx].deviceId)?.picks
            ?.map((id: string) => BY_ID.get(id))
            .filter(Boolean) as PlayerSeason[]) ?? []
        : [];
    const mateFx = mateIdx >= 0 ? league.fixtures.filter((f) => f.home === mateIdx || f.away === mateIdx) : [];
    const combined = new Map<string, { runs: number; wkts: number }>();
    const fold = (mp: Map<string, { runs: number; balls: number; wkts: number }>) => {
      for (const [player, e] of mp) {
        const c = combined.get(player) ?? { runs: 0, wkts: 0 };
        c.runs += e.runs;
        c.wkts += e.wkts;
        combined.set(player, c);
      }
    };
    fold(agg);
    if (mateXi.length === 11) {
      const mateAgg = new Map<string, { runs: number; balls: number; wkts: number }>();
      mateFx.forEach((f, fi) => {
        const mateHome = f.home === mateIdx;
        const mS = mateHome ? f.hs : f.as;
        const oS = mateHome ? f.as : f.hs;
        const [mr, mw] = parseScore(mS);
        const [, ow] = parseScore(oS);
        const star = distributeMatch(mateXi, mr, mw, ow, mulberry32((room.roomSeed + 9000 + fi * 31) >>> 0));
        for (const b of star.batAll) bump(mateAgg, b.player, b.runs, b.balls, 0);
        for (const ww of star.bowlAll) bump(mateAgg, ww.player, 0, 0, ww.wickets);
      });
      fold(mateAgg);
    }
    const capRows = [...combined.entries()].map(([player, e]) => ({ player, runs: e.runs, wickets: e.wkts }));
    const orange = capRows.reduce((a, b) => (b.runs > a.runs ? b : a), capRows[0]);
    const purple = [...capRows].sort((a, b) => b.wickets - a.wickets || b.runs - a.runs)[0];
    const mvp = [...capRows].sort((a, b) => b.runs + b.wickets * 25 - (a.runs + a.wickets * 20))[0];
    const myPO = league.playoffs
      .filter((p) => p.t1 === myIdx || p.t2 === myIdx)
      .map((p) => {
        const iAmHome = p.t1 === myIdx;
        const myS = iAmHome ? p.s1 : p.s2;
        const opS = iAmHome ? p.s2 : p.s1;
        const [mr] = parseScore(myS);
        const [or] = parseScore(opS);
        return {
          stage: p.stage,
          gf: myS,
          ga: opS,
          result: (p.winner === myIdx ? "W" : "L") as "W" | "L",
          margin: p.margin,
        };
      });
    const champPO = league.playoffs.find((p) => p.stage === "Final");
    const champion = !!champPO && champPO.winner === myIdx;
    const st = teamStrength(xi);
    return {
      wins: w,
      losses: myFixtures.length - w,
      points: w * 2,
      nrr,
      rank,
      table: league.table.map((r) => ({ ...r, you: r.team === myName })),
      madePlayoffs: rank <= 4 && rank > 0,
      champion,
      perfect14: w === myFixtures.length,
      games,
      playoffs: myPO,
      matchStars: stars,
      orangeCap: { player: orange.player, runs: orange.runs },
      purpleCap: { player: purple.player, wickets: purple.wickets },
      mvp: { player: mvp.player, points: mvp.runs + mvp.wickets * 25 },
      playerRuns,
      biggestWin,
      _st: st,
    } as unknown as SeasonResult & { _st: { bat: number; bowl: number } };
  }, [league, myIdx, myName, myFixtures, members, me, room]);

  if (!league || myIdx < 0 || !report) {
    return <p className="text-sm text-zinc-500 mt-4">Computing the shared season…</p>;
  }

  const nonFinals = league.playoffs.filter((p) => p.stage !== "Final");
  const finalPO = league.playoffs.find((p) => p.stage === "Final") ?? null;
  const myNonFinals = nonFinals.filter((p) => p.t1 === myIdx || p.t2 === myIdx);
  const myFinal = finalPO && (finalPO.t1 === myIdx || finalPO.t2 === myIdx) ? finalPO : null;

  const share = `${myName} went ${report.wins}-${report.losses} in a shared 18-game room season${report.champion ? " and WON IT" : ""} — ${typeof window !== "undefined" ? window.location.origin : "14-0.app"}/m/${room.code}`;

  return (
    <div className="space-y-4">
      {(phase === "league" || phase === "leagueDone") && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-[0.25em] text-zinc-500">
              {phase === "league" ? `ROUND ${myFixtures[Math.min(simIdx, myFixtures.length - 1)]?.round ?? 18} / 18` : "SEASON COMPLETE"}
            </span>
            <span
              className={`px-3 py-1 rounded-full font-black text-sm ${
                losses === 0 && phase === "league" ? "bg-emerald-400 text-black animate-pulse" : "bg-white/10 text-white"
              }`}
            >
              {wins}-{losses}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))} className="text-xs px-2.5 py-1.5 rounded bg-white/10 border border-white/10">
                {speed}x ⏩
              </button>
              {phase === "league" && (
                <button
                  onClick={() => {
                    setSimIdx(myFixtures.length);
                    setPhase("leagueDone");
                  }}
                  className="text-xs px-2.5 py-1.5 rounded bg-white/10 border border-white/10"
                >
                  Skip ⏭
                </button>
              )}
            </span>
          </div>

          <div ref={feedRef} className="mt-3 space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {shown.map((f, i) => {
              const iAmHome = f.home === myIdx;
              const opp = league.teams[iAmHome ? f.away : f.home].name;
              const isH2H = league.teams[f.home].human && league.teams[f.away].human;
              const won = f.winner === myIdx;
              const st = report.matchStars[i];
              const hero = f.superOverNote
                ? `Super Over ${f.superOverNote}`
                : won
                  ? f.margin.includes("runs")
                    ? `${shortName(st.bowl.player)} ${st.bowl.wickets}/${st.bowl.runsConceded}`
                    : `${shortName(st.bat.player)} ${st.bat.runs}(${st.bat.balls})`
                  : "their night";
              return (
                <div key={i}>
                  <button
                    onClick={() => (isH2H && f.detail ? setExpanded(expanded === i ? null : i) : undefined)}
                    className={`w-full flex items-center gap-2 text-sm rounded-lg px-3 py-2 border text-left ${
                      won ? "border-emerald-400/30 bg-emerald-500/10" : "border-red-400/30 bg-red-500/10"
                    }`}
                  >
                    <span className="text-zinc-500 w-8 text-xs">R{f.round}</span>
                    <span>{won ? "🟩" : "🟥"}</span>
                    <span className="font-mono font-bold">
                      {iAmHome ? f.hs : f.as} <span className="text-zinc-500 font-normal">vs {iAmHome ? f.as : f.hs}</span>
                    </span>
                    <span className="text-xs">
                      {isH2H ? <>⚔️ <b>{opp}</b></> : <span className="text-zinc-400">{opp}</span>}
                    </span>
                    <span className="ml-auto text-[11px] text-zinc-400">{f.margin === "Super Over" ? "SO" : (won ? "won by " : "lost by ") + f.margin}</span>
                  </button>
                  <div className="text-[11px] text-zinc-500 ml-11 mb-1">⚾ {hero}{isH2H && f.detail ? " · tap for ball-by-ball" : ""}</div>
                  {expanded === i && isH2H && f.detail && (
                    <div className="mt-1 mb-2">
                      <PlayoffMatch
                        stage={`Rivalry · Round ${f.round}`}
                        detail={toDetail(f.detail, f.home, f.away, myIdx, myName, opp, f.winner === myIdx)}
                        userTag={myName}
                        speed={speed}
                        nextLabel="Close"
                        onDone={() => setExpanded(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === "leagueDone" && (
            <div className="mt-4">
              {report.madePlayoffs ? (
                <>
                  <SeasonReport result={report} forecast={null} bat={report._st.bat} bowl={report._st.bowl} leagueOnly slim />
                  <button
                    onClick={() => {
                      setPoIdx(0);
                      setPhase("playoffs");
                    }}
                    className="mt-4 w-full py-4 rounded-2xl bg-amber-400 text-black font-black text-xl hover:bg-amber-300"
                  >
                    ⚔️ Finished #{report.rank} — Start Playoffs →
                  </button>
                </>
              ) : (
                <>
                  <SeasonReport result={report} forecast={null} bat={report._st.bat} bowl={report._st.bowl} leagueOnly />
                  <RoomTable rows={report.table} me={myName} mate={mate?.name} />
                  <RoomShare share={share} copied={copied} setCopied={setCopied} code={room.code} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "playoffs" && (
        <div className="rounded-2xl border border-amber-300/25 bg-black/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-[0.25em] text-amber-200 font-bold">⚔️ PLAYOFFS</span>
            <span className="text-[11px] text-zinc-400">via {report.wins}-{report.losses} · #{report.rank}</span>
          </div>
          {myNonFinals.slice(0, poIdx).map((p, i) => (
            <PlayoffSummary key={i} p={p} myIdx={myIdx} teams={league.teams} />
          ))}
          {myNonFinals[poIdx] && myNonFinals[poIdx].detail && (
            <PlayoffMatch
              key={poIdx}
              stage={myNonFinals[poIdx].stage}
              detail={toDetail(myNonFinals[poIdx].detail!, myNonFinals[poIdx].t1, myNonFinals[poIdx].t2, myIdx, myName, oppOf(myNonFinals[poIdx], myIdx, league), myNonFinals[poIdx].winner === myIdx)!}
              userTag={myName}
              speed={speed}
              nextLabel={nextPO(myNonFinals, poIdx, !!myFinal)}
              onDone={() => {
                const next = poIdx + 1;
                setPoIdx(next);
                if (next < myNonFinals.length) return;
                if (myFinal) setPhase("preFinal");
                else setPhase("done");
              }}
            />
          )}
          {myNonFinals[poIdx] && !myNonFinals[poIdx].detail && (
            <div className="text-sm text-zinc-400">Result pending…</div>
          )}
        </div>
      )}

      {phase === "preFinal" && myFinal && (
        <div className="rounded-2xl border border-amber-300/50 bg-gradient-to-b from-amber-400/15 to-black p-6 text-center">
          <div className="text-[11px] tracking-[0.3em] text-amber-200 font-bold">THE FINAL</div>
          <div className="font-black text-3xl mt-2">
            {myName} <span className="text-zinc-500 text-xl">vs</span> {oppOf(myFinal, myIdx, league)}
          </div>
          <button
            onClick={() => setPhase("final")}
            className="mt-4 px-10 py-4 rounded-2xl bg-amber-400 text-black font-black text-xl hover:bg-amber-300"
          >
            🏆 Play the Final
          </button>
        </div>
      )}

      {phase === "final" && myFinal?.detail && (
        <div className="rounded-2xl border border-amber-300/25 bg-black/40 p-4">
          <PlayoffMatch
            stage="Final"
            detail={toDetail(myFinal.detail, myFinal.t1, myFinal.t2, myIdx, myName, oppOf(myFinal, myIdx, league), myFinal.winner === myIdx)!}
            userTag={myName}
            speed={speed}
            fullMatch
            nextLabel={myFinal.winner === myIdx ? "🏆 Lift the trophy" : "Full-time — results"}
            onDone={() => setPhase("done")}
          />
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="font-black text-2xl text-center">
            {report.champion
              ? `🏆 ${myName.toUpperCase()} WINS THE ROOM`
              : report.madePlayoffs
                ? `💔 Knocked out — ${report.playoffs[report.playoffs.length - 1]?.stage ?? "playoffs"}`
                : `📉 ${report.wins}-${report.losses}`}
          </div>
          <div className="text-xs text-zinc-400 mt-1 text-center">
            #{report.rank} · {report.points} pts · NRR {report.nrr > 0 ? "+" : ""}
            {report.nrr}
          </div>
          <SeasonReport result={report} forecast={null} bat={report._st.bat} bowl={report._st.bowl} compact />
          <RoomTable rows={report.table} me={myName} mate={mate?.name} />
          <RoomShare share={share} copied={copied} setCopied={setCopied} code={room.code} />
        </div>
      )}
    </div>
  );

  function nextPO(list: typeof myNonFinals, i: number, hasFinal: boolean): string {
    const won = list[i].winner === myIdx;
    if (!won) return list[i].stage === "Qualifier 1" ? "Down to Qualifier 2 →" : "Season over — results";
    if (i + 1 < list.length) return `Next: ${list[i + 1].stage}`;
    return hasFinal ? "To the Final" : "Season over — results";
  }

  function oppOf(p: { t1: number; t2: number }, me: number, lg: SharedLeague): string {
    return lg.teams[p.t1 === me ? p.t2 : p.t1].name;
  }
}

function toDetail(
  d: NonNullable<SharedFixture["detail"]>,
  homeIdx: number,
  awayIdx: number,
  meIdx: number,
  myName: string,
  oppName: string,
  won: boolean
): PlayoffDetail {
  const iAmHome = homeIdx === meIdx;
  const userFirst = (d.firstIsHome && iAmHome) || (!d.firstIsHome && !iAmHome);
  const norm = (n: string) => (n === "YOU" ? myName : n === "OPP" ? oppName : n);
  const soU = d.superOver
    ? norm(d.superOver.inn1.side) === myName
      ? d.superOver.inn1
      : d.superOver.inn2
    : null;
  const soO = d.superOver && soU ? (soU === d.superOver.inn1 ? d.superOver.inn2 : d.superOver.inn1) : null;
  return {
    inn1: d.inn1,
    inn2: d.inn2,
    userFirst,
    opp: oppName,
    superOver: d.superOver
      ? {
          inn1: { ...d.superOver.inn1, side: norm(d.superOver.inn1.side) },
          inn2: { ...d.superOver.inn2, side: norm(d.superOver.inn2.side) },
          winnerIsUser: won,
          scoreline: soU && soO ? `SO ${soU.score}–${soO.score}` : "",
        }
      : undefined,
  };
}

function bump(agg: Map<string, { runs: number; balls: number; wkts: number }>, player: string, runs: number, balls: number, wkts: number) {
  const e = agg.get(player) ?? { runs: 0, balls: 0, wkts: 0 };
  e.runs += runs;
  e.balls += balls;
  e.wkts += wkts;
  agg.set(player, e);
}

function PlayoffSummary({ p, myIdx, teams }: { p: SharedPlayoff; myIdx: number; teams: SharedLeague["teams"] }) {
  const iAmHome = p.t1 === myIdx;
  const win = p.winner === myIdx;
  return (
    <div className={`rounded-lg px-3 py-2 border text-sm ${win ? "border-amber-300/40 bg-amber-400/[0.07]" : "border-red-400/30 bg-red-500/10"}`}>
      <div className="text-[10px] tracking-[0.2em] text-zinc-400">{p.stage.toUpperCase()}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span>{win ? "🟩" : "🟥"}</span>
        <span className="font-mono font-bold">{iAmHome ? p.s1 : p.s2}</span>
        <span className="text-zinc-500">vs</span>
        <span className="font-mono">{iAmHome ? p.s2 : p.s1} {teams[iAmHome ? p.t2 : p.t1].name}</span>
        <span className="ml-auto text-xs text-zinc-300">{win ? "won by " : "lost by"}{p.margin}</span>
      </div>
    </div>
  );
}

function RoomTable({ rows, me, mate }: { rows: TableRow[]; me: string; mate?: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
      <div className="text-[10px] tracking-[0.25em] text-zinc-500 px-3 pt-2.5">SHARED TABLE · TOP 4 PLAYOFFS</div>
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
              <tr key={r.team} className={r.team === me ? "bg-emerald-400/15 font-bold" : r.team === mate ? "bg-sky-400/10 font-bold" : i % 2 ? "bg-white/[0.02]" : ""}>
                <td className="px-3 py-1.5 text-zinc-400">{i + 1}</td>
                <td className="px-1 py-1.5">
                  {r.team === me ? "⭐ " : r.team === mate ? "⚔️ " : ""}
                  {r.team}
                </td>
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

function RoomShare({ share, copied, setCopied, code }: { share: string; copied: boolean; setCopied: (v: boolean) => void; code: string }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-400/[0.07] p-3">
      <div className="text-xs text-emerald-100/80 font-mono break-all">{share}</div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={async () => {
            if (await copyText(share)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="px-4 py-2 rounded-lg bg-emerald-400 text-black font-bold text-sm"
        >
          {copied ? "✅ Copied!" : "📋 Copy result"}
        </button>
        <a href={`/m/${code}`} className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-sm">
          🔗 Room /m/{code}
        </a>
      </div>
    </div>
  );
}
