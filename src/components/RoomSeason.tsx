"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
import { Flap, PrimaryButton, OutlineButton, PlateButton, SectionHead, WhatsAppIcon, Crown, tidyMargin } from "./ui";

function stageWords(stage?: string): string {
  if (!stage) return "the playoffs";
  return stage === "Final" ? "the final" : stage;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

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
  // null = we do not know yet whether the backend tracks who has finished
  const [gateSupported, setGateSupported] = useState<boolean | null>(null);
  const reportedDone = useRef(false);
  const finishRoom = useMutation((api as any).rooms?.finish);

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
    const dwell = i < 3 ? 2400 : i < 14 ? 1900 : 2600;
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

  useEffect(() => {
    if (phase !== "done" || reportedDone.current) return;
    reportedDone.current = true;
    (async () => {
      try {
        await finishRoom({ code: room.code, deviceId: meId });
        setGateSupported(true);
      } catch {
        // backend has not been pushed with the finishedAt field yet — no gate
        setGateSupported(false);
      }
    })();
  }, [phase, finishRoom, room.code, meId]);

  const ownerSets = useMemo(() => {
    const mineNames = new Set<string>();
    const mateNames = new Set<string>();
    const mineM = members.find((m) => m.deviceId === (me?.deviceId ?? meId));
    const mateM = members.find((m) => m.deviceId !== (me?.deviceId ?? meId));
    for (const id of mineM?.picks ?? []) {
      const p = BY_ID.get(id);
      if (p) mineNames.add(p.player);
    }
    for (const id of mateM?.picks ?? []) {
      const p = BY_ID.get(id);
      if (p) mateNames.add(p.player);
    }
    return { mineNames, mateNames };
  }, [members, me, meId]);

  if (!league || myIdx < 0 || !report) {
    return <p className="text-[15px] text-muted py-4">Working out the shared season…</p>;
  }

  const nonFinals = league.playoffs.filter((p) => p.stage !== "Final");
  const finalPO = league.playoffs.find((p) => p.stage === "Final") ?? null;
  const myNonFinals = nonFinals.filter((p) => p.t1 === myIdx || p.t2 === myIdx);
  const myFinal = finalPO && (finalPO.t1 === myIdx || finalPO.t2 === myIdx) ? finalPO : null;

  const championName = finalPO ? league.teams[finalPO.winner].name : undefined;
  const ownersOf = (player: string) => {
    const out: string[] = [];
    if (ownerSets.mineNames.has(player)) out.push("You");
    if (mate && ownerSets.mateNames.has(player)) out.push(mate.name);
    return out;
  };
  // If you went out before the final, hold the room result until the manager
  // still playing has watched theirs. Only possible once the backend tracks it.
  const holdForMate = gateSupported === true && !myFinal && !!mate && !mate.finishedAt;

  const share = `${myName} went ${report.wins}-${report.losses} in a shared 18-game room season${report.champion ? " and WON IT" : ""} — ${typeof window !== "undefined" ? window.location.origin : "14-0.app"}/m/${room.code}`;

  return (
    <div className="flex flex-col gap-6">
      {(phase === "league" || phase === "leagueDone") && (
        <>
          <div className="-mx-5 lg:mx-0 lg:rounded-control lg:overflow-hidden bg-ink text-white px-5 py-6 lg:px-8 lg:py-8 flex flex-col items-center gap-5">
            <div className="w-full flex items-center gap-3">
              <span className="text-[13px] leading-[18px] text-muted-plate truncate">
                You are {myName}
              </span>
              <span className="flex-1" />
              <PlateButton onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}>
                Speed {speed}x
              </PlateButton>
              {phase === "league" && (
                <PlateButton
                  onClick={() => {
                    setSimIdx(myFixtures.length);
                    setPhase("leagueDone");
                  }}
                >
                  Skip to end
                </PlateButton>
              )}
            </div>

            <div className="flex gap-3 w-full max-w-[400px]">
              <Flap
                label="Won"
                labelCentred
                value={wins}
                valueColour="#4FCB74"
                wrapClassName="flex-1"
                className="h-[118px] sm:h-[132px]"
                valueClassName="text-[96px] leading-[84px] sm:text-[108px] sm:leading-[96px]"
              />
              <Flap
                label="Lost"
                labelCentred
                value={losses}
                valueColour="#FF6152"
                wrapClassName="flex-1"
                className="h-[118px] sm:h-[132px]"
                valueClassName="text-[96px] leading-[84px] sm:text-[108px] sm:leading-[96px]"
              />
            </div>

            <div className="flex flex-col items-center gap-1 text-center">
              <span className="font-semibold text-[20px] leading-[26px] sm:text-[24px] sm:leading-8">
                {phase === "league"
                  ? `Round ${myFixtures[Math.min(simIdx, myFixtures.length - 1)]?.round ?? 18} of 18`
                  : "League complete"}
              </span>
              <span className="text-[15px] leading-[22px] text-body-plate">
                {phase === "league"
                  ? losses === 0 && wins > 0
                    ? `Still unbeaten after ${wins}.`
                    : `${wins} won, ${losses} lost.`
                  : `Finished ${ordinal(report.rank)} on ${report.points} points. ${
                      report.madePlayoffs ? "Into the top four." : "Outside the top four."
                    }`}
              </span>
            </div>

            {phase === "leagueDone" && (
              <div className="flex gap-8 sm:gap-12 pt-1">
                {[
                  [String(report.points), "points"],
                  [`${report.nrr > 0 ? "+" : ""}${report.nrr}`, "net run rate"],
                  [ordinal(report.rank), "on the table"],
                ].map(([v, k]) => (
                  <div key={k} className="flex flex-col items-center gap-0.5">
                    <span className="font-display font-semibold text-[30px] leading-7 pt-1 tabular">
                      {v}
                    </span>
                    <span className="text-[13px] leading-[18px] text-body-plate">{k}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHead
              title="Your results"
              note={
                <>
                  <span className="text-ink font-medium">your score</span> ·{" "}
                  <span className="text-muted">theirs</span>
                </>
              }
            />
            <div
              ref={feedRef}
              className={`mt-2.5 ${
                phase === "league" ? "h-[360px] lg:h-[440px] overflow-y-auto pr-1" : ""
              }`}
            >
              {shown.map((f, i) => {
                const iAmHome = f.home === myIdx;
                const opp = league.teams[iAmHome ? f.away : f.home].name;
                const isH2H = league.teams[f.home].human && league.teams[f.away].human;
                const won = f.winner === myIdx;
                const st = report.matchStars[i];
                const hero = f.superOverNote
                  ? `${won ? "Won" : "Lost"} a super over, ${f.superOverNote.replace(/^SO /, "")}`
                  : won
                    ? f.margin.includes("runs")
                      ? `${shortName(st.bowl.player)} ${st.bowl.wickets} for ${st.bowl.runsConceded}`
                      : `${shortName(st.bat.player)} ${st.bat.runs} off ${st.bat.balls}`
                    : "their night";
                return (
                  <div key={i}>
                    <button
                      onClick={() => (isH2H && f.detail ? setExpanded(expanded === i ? null : i) : undefined)}
                      className={`w-full flex items-center gap-2.5 lg:gap-3.5 py-2.5 text-left border-t border-hairline ${
                        i === shown.length - 1 ? "border-b" : ""
                      } ${isH2H && f.detail ? "hover:bg-panel" : ""}`}
                    >
                      <span className="w-7 shrink-0 text-[13px] leading-[18px] text-muted">R{f.round}</span>
                      <span
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded font-display font-bold text-[18px] leading-none text-white pt-[2px]"
                        style={{ backgroundColor: won ? "#1A8A3C" : "#D8321F" }}
                      >
                        {won ? "W" : "L"}
                      </span>
                      <span className="flex flex-col flex-1 min-w-0 lg:flex-row lg:items-baseline lg:gap-3.5">
                        <span className="font-medium text-[15px] leading-5 lg:w-[220px] lg:shrink-0 truncate">
                          {isH2H ? "Head to head with " : ""}
                          {opp}
                        </span>
                        <span className="text-[13px] leading-[18px] lg:text-[14px] text-muted truncate">
                          {f.margin === "Super Over"
                            ? hero
                            : `${won ? "Won" : "Lost"} by ${tidyMargin(f.margin)} · ${hero}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-display font-semibold text-[19px] leading-5 lg:text-[22px] tabular pt-[3px] whitespace-nowrap">
                        <span className="text-ink">{iAmHome ? f.hs : f.as}</span>
                        <span className="text-faint"> · </span>
                        <span className="text-muted">{iAmHome ? f.as : f.hs}</span>
                      </span>
                    </button>
                    {expanded === i && isH2H && f.detail && (
                      <div className="py-4">
                        <PlayoffMatch
                          stage={`Head to head, round ${f.round}`}
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
          </div>

          {phase === "leagueDone" && (
            <div>
              {report.madePlayoffs ? (
                <>
                  <div className="flex justify-center">
                    <PrimaryButton
                      className="w-full sm:w-auto sm:px-12"
                      onClick={() => {
                        setPoIdx(0);
                        setPhase("playoffs");
                      }}
                    >
                      Into the playoffs
                    </PrimaryButton>
                  </div>
                </>
              ) : (
                // Missing the top four still ends your season, so the room
                // result waits behind the same button and the same gate.
                <div className="flex flex-col items-center gap-3">
                  <p className="font-semibold text-[17px] leading-6 lg:text-[20px] lg:leading-7 text-center">
                    Outside the top four. Your season ends here.
                  </p>
                  <PrimaryButton className="w-full sm:w-auto sm:px-12" onClick={() => setPhase("done")}>
                    See how the room finished
                  </PrimaryButton>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {phase === "playoffs" && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-baseline gap-3">
            <h2 className="font-semibold text-[20px] leading-[26px]">Playoffs</h2>
            <span className="text-[14px] leading-5 text-muted">
              in as #{report.rank} on {report.wins}-{report.losses}
            </span>
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
            <p className="text-[15px] text-muted">Result pending…</p>
          )}
        </div>
      )}

      {phase === "preFinal" && myFinal && (
        <div className="-mx-5 lg:mx-0 lg:rounded-control bg-ink text-white px-5 py-8 lg:px-10 lg:py-12 text-center flex flex-col items-center gap-3">
          <span className="text-[13px] leading-[18px] text-muted-plate">The final</span>
          <span className="font-semibold text-[26px] leading-8 lg:text-[36px] lg:leading-[44px]">
            {myName} versus {oppOf(myFinal, myIdx, league)}
          </span>
          <PrimaryButton className="mt-3 w-full sm:w-auto sm:px-10" onClick={() => setPhase("final")}>
            Play the final
          </PrimaryButton>
        </div>
      )}

      {phase === "final" && myFinal?.detail && (
        <PlayoffMatch
          stage="Final"
          detail={toDetail(myFinal.detail, myFinal.t1, myFinal.t2, myIdx, myName, oppOf(myFinal, myIdx, league), myFinal.winner === myIdx)!}
          userTag={myName}
          speed={speed}
          fullMatch
          nextLabel={myFinal.winner === myIdx ? "Lift the trophy" : "Full time — see the results"}
          onDone={() => setPhase("done")}
        />
      )}

      {phase === "done" && holdForMate && (
        <div className="flex flex-col gap-4">
          <div className="-mx-5 lg:mx-0 lg:rounded-control bg-ink text-white px-5 py-7 lg:px-9 lg:py-9 flex flex-col items-center gap-3 text-center">
            <span className="font-semibold text-[24px] leading-8 lg:text-[30px] lg:leading-10">
              No spoilers.
            </span>
            <span className="text-[15px] leading-[22px] lg:text-[17px] lg:leading-[26px] text-body-plate max-w-[52ch]">
              {mate!.name} is still watching their season. Your result is ready and appears here the
              moment they finish. This page updates on its own.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-[18px] leading-6">
              Your season: {report.wins}-{report.losses},{" "}
              {report.madePlayoffs
                ? `knocked out in ${stageWords(report.playoffs[report.playoffs.length - 1]?.stage)}`
                : "no playoffs"}
              .
            </p>
            <p className="text-[15px] leading-[22px] text-muted">
              Finished {ordinal(report.rank)} on {report.points} points.
            </p>
          </div>
        </div>
      )}

      {phase === "done" && !holdForMate && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2
              className={`flex items-center gap-2.5 font-semibold text-[26px] leading-8 lg:text-[32px] lg:leading-10 ${
                report.champion ? "text-trophy" : ""
              }`}
            >
              {report.champion && <Crown size={26} />}
              {report.champion
                ? `${myName} wins the room.`
                : championName
                  ? `${championName} wins the room.`
                  : `${report.wins}-${report.losses}, no playoffs.`}
            </h2>
            <p className="text-[15px] leading-[22px] text-muted">
              You finished {ordinal(report.rank)} on {report.points} points, net run rate{" "}
              {report.nrr > 0 ? "+" : ""}
              {report.nrr}
              {report.champion
                ? "."
                : report.madePlayoffs
                  ? `, out in ${stageWords(report.playoffs[report.playoffs.length - 1]?.stage)}.`
                  : "."}
            </p>
          </div>
          <SeasonReport
            result={report}
            forecast={null}
            bat={report._st.bat}
            bowl={report._st.bowl}
            compact
            owners={ownersOf}
          />
          <RoomTable rows={report.table} me={myName} mate={mate?.name} champion={championName} />
          <RoomShare share={share} copied={copied} setCopied={setCopied} code={room.code} />
        </div>
      )}
    </div>
  );

  function nextPO(list: typeof myNonFinals, i: number, hasFinal: boolean): string {
    const won = list[i].winner === myIdx;
    if (!won) return list[i].stage === "Qualifier 1" ? "Down to Qualifier 2" : "Season over — see the results";
    if (i + 1 < list.length) return `Next: ${list[i + 1].stage}`;
    return hasFinal ? "To the final" : "Season over — see the results";
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
    <div className="flex items-center gap-3 py-3 border-t border-hairline">
      <span className="w-[110px] shrink-0 text-[13px] leading-[18px] text-muted">{p.stage}</span>
      <span
        className="w-6 h-6 shrink-0 flex items-center justify-center rounded font-display font-bold text-[18px] leading-none pt-[2px]"
        style={{ backgroundColor: win ? "#E0A81C" : "#D8321F", color: win ? "#000" : "#fff" }}
      >
        {win ? "W" : "L"}
      </span>
      <span className="flex-1 min-w-0 text-[15px] leading-5 truncate">
        {win ? "Won" : "Lost"} by {tidyMargin(p.margin)} against {teams[iAmHome ? p.t2 : p.t1].name}
      </span>
      <span className="shrink-0 font-display font-semibold text-[20px] leading-5 pt-[3px] tabular">
        {iAmHome ? p.s1 : p.s2} · {iAmHome ? p.s2 : p.s1}
      </span>
    </div>
  );
}

function RoomTable({ rows, me, mate, champion }: { rows: TableRow[]; me: string; mate?: string; champion?: string }) {
  return (
    <section className="flex flex-col mt-6">
      <SectionHead title="The shared table" note="Top 4 go through" />
      <div className="flex items-center gap-2 h-7 mt-1 text-[12px] leading-4 text-muted">
        <span className="w-[22px] shrink-0" />
        <span className="flex-1">Team</span>
        <span className="w-[26px] shrink-0 text-right">P</span>
        <span className="w-[26px] shrink-0 text-right">W</span>
        <span className="w-[26px] shrink-0 text-right">L</span>
        <span className="w-[34px] shrink-0 text-right">Pts</span>
        <span className="w-[54px] shrink-0 text-right">NRR</span>
      </div>
      {rows.map((r, i) => {
        const isMe = r.team === me;
        const isMate = r.team === mate;
        const faded = !isMe && !isMate && i > 3;
        return (
          <div key={r.team}>
            <div
              className={`flex items-center gap-2 h-[42px] px-2 ${
                isMe ? "bg-ink text-white rounded-control" : "border-t border-hairline"
              } ${i === rows.length - 1 && !isMe ? "border-b" : ""}`}
            >
              <span className="w-[22px] shrink-0 font-display font-semibold text-[20px] leading-[18px] pt-[3px] tabular">
                {i + 1}
              </span>
              <span
                className={`flex-1 min-w-0 flex items-center gap-1.5 truncate ${
                  isMe || isMate ? "font-semibold text-[16px] leading-[22px]" : "text-[15px] leading-5"
                } ${faded ? "text-muted" : ""}`}
              >
                <span className="truncate">
                  {r.team}
                  {isMe ? " (you)" : ""}
                </span>
                {champion === r.team && <Crown size={18} />}
              </span>
              {(["p", "w", "l"] as const).map((k) => (
                <span
                  key={k}
                  className={`w-[26px] shrink-0 text-right font-display font-medium text-[19px] leading-[18px] pt-[3px] tabular ${
                    faded ? "text-muted" : ""
                  }`}
                >
                  {r[k]}
                </span>
              ))}
              <span
                className={`w-[34px] shrink-0 text-right font-display font-semibold text-[19px] leading-[18px] pt-[3px] tabular ${
                  faded ? "text-muted" : ""
                }`}
              >
                {r.pts}
              </span>
              <span
                className={`w-[54px] shrink-0 text-right font-display font-medium text-[19px] leading-[18px] pt-[3px] tabular ${
                  faded ? "text-muted" : ""
                }`}
              >
                {r.nrr > 0 ? "+" : ""}
                {r.nrr}
              </span>
            </div>
            {i === 3 && (
              <div className="flex items-center h-7 pt-1.5 border-t-2 border-ink">
                <span className="text-[12px] leading-4 text-muted">Playoff cut</span>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function RoomShare({ share, copied, setCopied, code }: { share: string; copied: boolean; setCopied: (v: boolean) => void; code: string }) {
  return (
    <div className="mt-6 flex flex-col gap-2.5 max-w-[420px]">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(share)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 h-14 rounded-control bg-turf text-white font-semibold text-[16px] hover:bg-[#15702f] transition-colors"
      >
        <WhatsAppIcon />
        Share on WhatsApp
      </a>
      <OutlineButton
        onClick={async () => {
          if (await copyText(share)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? "Copied" : "Copy the result"}
      </OutlineButton>
      <p className="text-[13px] leading-[18px] text-muted">This room lives at /m/{code}</p>
    </div>
  );
}
