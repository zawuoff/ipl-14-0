"use client";
import { useEffect, useMemo, useState } from "react";
import type { DetailedInnings, SuperOverInnings } from "@/lib/sim/engine";

export interface PlayoffDetail {
  inn1: DetailedInnings;
  inn2: DetailedInnings;
  userFirst: boolean;
  opp: string;
  superOver?: {
    inn1: SuperOverInnings;
    inn2: SuperOverInnings;
    winnerIsUser: boolean;
    scoreline: string;
  };
}

// Knockout theater: fast batches through the bulk; ONLY the last over goes
// ball-by-ball, and only when the game is close. Result freezes for a click.
export function PlayoffMatch({
  stage,
  detail,
  userTag,
  speed,
  fullMatch,
  nextLabel,
  onDone,
}: {
  stage: string;
  detail: PlayoffDetail;
  userTag: string; // "YOU"
  speed: number;
  fullMatch?: boolean; // final: play both innings live
  nextLabel: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"inn1" | "inn2" | "so1" | "so2" | "over">(fullMatch ? "inn1" : "inn2");
  const [cursor, setCursor] = useState(0); // balls revealed in live innings
  const live = phase === "inn1" ? detail.inn1 : detail.inn2;
  const done = phase === "over";
  const inSO = phase === "so1" || phase === "so2";

  // close game? decided from the actual finish — theater over a known result.
  const tense = useMemo(() => {
    const { inn1, inn2 } = detail;
    if (inn2.balls >= 108) return true; // went to the death
    const diff = Math.abs(inn1.runs - inn2.runs);
    if (inn1.runs > inn2.runs) return diff < 15; // defended narrowly
    return diff < 12;
  }, [detail]);

  const target = useMemo(() => {
    if (phase === "inn2") return detail.inn1.runs + 1;
    return undefined;
  }, [phase, detail.inn1.runs]);

  useEffect(() => {
    if (done) return; // frozen — user clicks Continue
    if (inSO) return; // SuperOverLive drives its own cursor
    const evts = live.events;
    if (cursor >= evts.length) {
      if (phase === "inn1") {
        const t = setTimeout(() => {
          setPhase("inn2");
          setCursor(0);
        }, 1400);
        return () => clearTimeout(t);
      }
      // tied → Super Over theater, else done
      if (detail.superOver) {
        const t = setTimeout(() => {
          setPhase("so1");
          setCursor(0);
        }, 1200);
        return () => clearTimeout(t);
      }
      setPhase("over");
      return;
    }
    const ballsLeft = evts.length - cursor;
    const lastOver = ballsLeft <= 6;
    let step: number;
    let wait: number;
    if (tense && lastOver) {
      step = 1; // 🎙️ last over, close game — ball by ball
      wait = 750;
    } else if (tense) {
      step = 6;
      wait = 600;
    } else {
      step = 12; // cruise — fly through
      wait = 380;
    }
    const t = setTimeout(() => setCursor((c) => Math.min(c + step, evts.length)), wait / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, phase, done, speed, tense]);

  const shown = live.events.slice(0, cursor);
  const cur = shown.length ? shown[shown.length - 1] : null;
  const score = cur ? cur.score : "0/0";
  const balls = shown.length;
  const oversStr = `${Math.floor(balls / 6)}.${balls % 6}`;
  const [runs] = parseScoreStr(score);
  const crr = balls > 0 ? ((runs / balls) * 6).toFixed(1) : "0.0";
  let req: string | null = null;
  if (target !== undefined && !done) {
    const need = target - runs;
    const bl = live.events.length - balls;
    req = need <= 0 ? "DONE" : `${need} off ${(bl / 6).toFixed(1)} ov`;
  }
  const battingYou = (phase === "inn1") === detail.userFirst;
  const recent = live.events.slice(Math.max(0, cursor - 12), cursor);

  return (
    <div className="rounded-xl border border-amber-300/30 bg-black/50 overflow-hidden">
      <div className="px-3 py-2 bg-amber-400/10 border-b border-amber-300/20 flex items-center gap-2">
        <span className="text-[10px] tracking-[0.2em] text-amber-200 font-bold">{stage.toUpperCase()}</span>
        <span className="ml-auto text-[11px] text-zinc-400">
          {battingYou ? userTag : detail.opp} {phase === "inn1" && fullMatch ? "· 1st innings" : phase === "inn2" ? "· 2nd innings" : "· complete"}
        </span>
      </div>

      {/* how much we scored — both innings, properly presented */}
      <div className="px-4 pt-3 grid grid-cols-2 gap-2 text-center">
        <div
          className={`rounded-lg border px-2 py-2 ${
            detail.userFirst ? "border-emerald-300/40 bg-emerald-400/[0.07]" : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <div className="text-[10px] tracking-widest text-zinc-400">
            {detail.userFirst ? userTag : detail.opp} · 1ST
          </div>
          <div className="font-black font-mono text-xl">
            {phase === "inn1" && !done ? score : detail.inn1.score}{" "}
            <span className="text-xs text-zinc-500 font-semibold">
              ({phase === "inn1" && !done ? oversStr : `${Math.floor(detail.inn1.balls / 6)}.${detail.inn1.balls % 6}`})
            </span>
          </div>
        </div>
        <div
          className={`rounded-lg border px-2 py-2 ${
            !detail.userFirst ? "border-emerald-300/40 bg-emerald-400/[0.07]" : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <div className="text-[10px] tracking-widest text-zinc-400">
            {!detail.userFirst ? userTag : detail.opp} · 2ND
            {phase === "inn2" && target !== undefined && !done && (
              <> · NEED {Math.max(0, target - runs)} </>
            )}
          </div>
          <div className="font-black font-mono text-xl">
            {phase === "inn2" || done ? score : "yet to bat"}{" "}
            {(phase === "inn2" || done) && (
              <span className="text-xs text-zinc-500 font-semibold">({oversStr})</span>
            )}
          </div>
        </div>
      </div>

      {/* live ticker */}
      {!inSO && (
      <div className="px-4 py-2 text-center">
        <div className="text-[11px] text-zinc-400">
          {battingYou ? `${userTag} vs ${detail.opp}` : `${detail.opp} vs ${userTag}`}
        </div>
        <div className="font-black text-4xl font-mono mt-0.5">
          {score} <span className="text-lg text-zinc-400">({oversStr})</span>
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          CRR {crr}
          {req && req !== "DONE" && <> · NEED <b className="text-amber-300">{req}</b></>}
          {req === "DONE" && <> · <b className="text-emerald-300">CHASED!</b></>}
        </div>
        {/* this-over ticker */}
        <div className="flex justify-center gap-1 mt-2 flex-wrap">
          {recent.map((e) => (
            <span
              key={e.n}
              className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
                e.wicket
                  ? "bg-red-500 text-white"
                  : e.runs === 6
                    ? "bg-emerald-400 text-black"
                    : e.runs === 4
                      ? "bg-emerald-500/40 text-emerald-100 border border-emerald-300/50"
                      : "bg-white/10 text-zinc-300"
              }`}
            >
              {e.wicket ? "W" : e.runs}
            </span>
          ))}
          {!done && cursor < live.events.length && (
            <span className="w-6 h-6 rounded-full bg-amber-400 text-black text-[11px] font-bold flex items-center justify-center animate-pulse">
              •
            </span>
          )}
        </div>
        {!done && (
          <div className="text-[10px] text-zinc-500 mt-1.5">
            {tense && live.events.length - cursor <= 6
              ? "🎙️ final over, close game — ball by ball"
              : tense
                ? "⏩ working through the overs…"
                : "⏩ cruising — fast-forwarding"}
          </div>
        )}
      </div>
      )}

      {/* super over theater */}
      {inSO && detail.superOver && (
        <SuperOverLive
          key={phase}
          oppName={detail.opp}
          userTag={userTag}
          inn={phase === "so1" ? detail.superOver.inn1 : detail.superOver.inn2}
          other={phase === "so1" ? null : detail.superOver.inn1}
          speed={speed}
          onDone={() => {
            if (phase === "so1") {
              setPhase("so2");
            } else {
              setPhase("over");
            }
          }}
        />
      )}

      {/* innings-1 final (when live is inn2, or completed) */}
      {(phase === "inn2" || done) && (
        <InningsCard title={`1st INNINGS · ${detail.userFirst ? userTag : detail.opp}`} inn={detail.inn1} defaultOpen={false} />
      )}
      {done && <InningsCard title={`2nd INNINGS · ${!detail.userFirst ? userTag : detail.opp}`} inn={detail.inn2} defaultOpen />}

      {/* frozen result — proceeds only on click */}
      {done && <MatchResult detail={detail} userTag={userTag} nextLabel={nextLabel} onDone={onDone} />}
    </div>
  );
}

function MatchResult({
  detail,
  userTag,
  nextLabel,
  onDone,
}: {
  detail: PlayoffDetail;
  userTag: string;
  nextLabel: string;
  onDone: () => void;
}) {
  const userRuns = detail.userFirst ? detail.inn1.runs : detail.inn2.runs;
  const oppRuns = detail.userFirst ? detail.inn2.runs : detail.inn1.runs;
  const won = userRuns > oppRuns;
  // inn2 is always the chase: won-chasing / lost-defending → wkts; else runs
  const chase = detail.inn2;
  const so = detail.superOver;
  const soU = so ? (so.inn1.side === userTag ? so.inn1 : so.inn2) : null;
  const soO = so && soU ? (soU === so.inn1 ? so.inn2 : so.inn1) : null;
  const soLine = so && soU && soO ? `SO ${soU.score}–${soO.score}` : (so as any)?.scoreline ?? "";
  // tie at 20 overs is impossible here — Super Over always produces a winner
  const title = so ? (won ? "⚡ WON IN SUPER OVER" : "⚡ LOST IN SUPER OVER") : won ? "✅ WON " : "❌ LOST ";
  const margin = so
    ? soLine
    : won
      ? detail.userFirst
        ? `by ${userRuns - oppRuns} runs`
        : `by ${10 - chase.wickets} wkts (${Math.max(0, 120 - chase.balls)} balls left)`
      : detail.userFirst
        ? `by ${10 - chase.wickets} wkts (${Math.max(0, 120 - chase.balls)} balls left)`
        : `by ${oppRuns - userRuns} runs`;
  return (
    <div
      className={`m-3 rounded-xl border p-4 text-center ${
        won ? "border-emerald-300/50 bg-emerald-400/10" : "border-red-400/50 bg-red-500/10"
      }`}
    >
      <div className="font-black text-2xl">
        {title} <span className="text-lg text-zinc-300">{margin}</span>
      </div>
      <div className="font-mono text-sm text-zinc-300 mt-1">
        {userTag} {detail.userFirst ? detail.inn1.score : detail.inn2.score} vs {detail.userFirst ? detail.inn2.score : detail.inn1.score}{" "}
        {detail.opp}
      </div>
      <button
        onClick={onDone}
        className={`mt-3 w-full py-3 rounded-xl font-black ${
          won ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-white/10 text-white hover:bg-white/20 border border-white/15"
        }`}
      >
        {nextLabel} →
      </button>
    </div>
  );
}

// Super Over: 6 balls, snappy; last 3 slow down a touch.
function SuperOverLive({
  inn,
  other,
  oppName,
  userTag,
  speed,
  onDone,
}: {
  inn: SuperOverInnings;
  other: SuperOverInnings | null;
  oppName: string;
  userTag: string;
  speed: number;
  onDone: () => void;
}) {
  const sideLabel = inn.side === userTag ? userTag : oppName;
  const [cursor, setCursor] = useState(0);
  const done = cursor >= inn.events.length;
  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 1400);
      return () => clearTimeout(t);
    }
    const last3 = inn.events.length - cursor <= 3;
    const t = setTimeout(
      () => setCursor((c) => Math.min(c + 1, inn.events.length)),
      (last3 ? 800 : 450) / speed
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, done, speed]);
  const shown = inn.events.slice(0, cursor);
  const last = shown.length ? shown[shown.length - 1] : null;
  return (
    <div className="px-4 py-3 text-center border-t border-amber-300/20">
      <div className="text-[11px] tracking-[0.25em] text-amber-200 font-bold">⚡ SUPER OVER · {sideLabel}</div>
      {other && (
        <div className="text-[11px] text-zinc-500 mt-0.5">
          {other.side} {other.score} · need {other.runs + 1}
        </div>
      )}
      <div className="font-black font-mono text-3xl mt-1">{last ? last.score : "0/0"}</div>
      <div className="flex justify-center gap-1.5 mt-2">
        {inn.events.map((e, i) => (
          <span
            key={e.n}
            className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center border ${
              i >= cursor
                ? "border-white/10 text-zinc-600"
                : e.wicket
                  ? "bg-red-500 text-white border-red-400"
                  : e.runs === 6
                    ? "bg-emerald-400 text-black border-emerald-300"
                    : e.runs === 4
                      ? "bg-emerald-500/40 text-emerald-100 border-emerald-300/50"
                      : "bg-white/10 text-zinc-200 border-white/10"
            }`}
          >
            {i < cursor ? (e.wicket ? "W" : e.runs) : "·"}
          </span>
        ))}
      </div>
      <div className="text-[10px] text-zinc-500 mt-1.5">
        {done ? "Super over complete" : inn.events.length - cursor <= 3 ? "🎙️ last 3 balls…" : "⚡ super over"}
      </div>
      <div className="text-[11px] text-zinc-400 mt-1">
        {(() => {
          const e = shown[shown.length - 1] ?? inn.events[0];
          return e ? `${e.striker} * · ${e.bowler} bowling` : "";
        })()}
      </div>
    </div>
  );
}

function parseScoreStr(s: string): [number, number] {
  const p = s.split("/");
  return [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
}

export function InningsCard({ title, inn, defaultOpen }: { title: string; inn: DetailedInnings; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-white/10">
      <button onClick={() => setOpen((o) => !o)} className="w-full px-3 py-2 flex items-center gap-2 text-xs">
        <span className="text-zinc-400 tracking-widest">{title}</span>
        <span className="font-mono font-bold ml-auto">
          {inn.score} ({Math.floor(inn.balls / 6)}.{inn.balls % 6} ov)
        </span>
        <span className="text-zinc-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 grid sm:grid-cols-2 gap-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 text-left">
                <th className="font-semibold py-1">BATTER</th>
                <th className="font-semibold text-right">R</th>
                <th className="font-semibold text-right">B</th>
              </tr>
            </thead>
            <tbody>
              {inn.batsmen.filter((b) => b.balls > 0).map((b) => (
                <tr key={b.name} className="border-t border-white/5">
                  <td className="py-1 pr-2 truncate max-w-[110px]">{b.name}</td>
                  <td className="text-right font-mono font-bold">
                    {b.runs}
                    {!b.out && <span className="text-emerald-300">*</span>}
                  </td>
                  <td className="text-right font-mono text-zinc-400">{b.balls}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 text-left">
                <th className="font-semibold py-1">BOWLER</th>
                <th className="font-semibold text-right">O</th>
                <th className="font-semibold text-right">R</th>
                <th className="font-semibold text-right">W</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlers.filter((b) => b.balls > 0).map((b) => (
                <tr key={b.name} className="border-t border-white/5">
                  <td className="py-1 pr-2 truncate max-w-[110px]">{b.name}</td>
                  <td className="text-right font-mono text-zinc-400">
                    {Math.floor(b.balls / 6)}.{b.balls % 6}
                  </td>
                  <td className="text-right font-mono">{b.runs}</td>
                  <td className="text-right font-mono font-bold">{b.wickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
