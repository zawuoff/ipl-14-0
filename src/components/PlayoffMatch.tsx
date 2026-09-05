"use client";
import { useEffect, useMemo, useState } from "react";
import type { DetailedInnings, SuperOverInnings } from "@/lib/sim/engine";
import { PrimaryButton, OutlineButton, PlateButton, SectionHead } from "./ui";

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

// Knockout theatre: fast batches through the bulk; only the last over goes
// ball by ball, and only when the game is close. The result freezes for a click.
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
  userTag: string;
  speed: number;
  fullMatch?: boolean; // final: play both innings live
  nextLabel: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"inn1" | "inn2" | "so1" | "so2" | "over">(
    fullMatch ? "inn1" : "inn2"
  );
  const [cursor, setCursor] = useState(0);
  const live = phase === "inn1" ? detail.inn1 : detail.inn2;
  const done = phase === "over";
  const inSO = phase === "so1" || phase === "so2";

  // close game? decided from the actual finish — theatre over a known result.
  const tense = useMemo(() => {
    const { inn1, inn2 } = detail;
    if (inn2.balls >= 108) return true;
    const diff = Math.abs(inn1.runs - inn2.runs);
    if (inn1.runs > inn2.runs) return diff < 15;
    return diff < 12;
  }, [detail]);

  const target = useMemo(() => {
    if (phase === "inn2") return detail.inn1.runs + 1;
    return undefined;
  }, [phase, detail.inn1.runs]);

  useEffect(() => {
    if (done) return;
    if (inSO) return;
    const evts = live.events;
    if (cursor >= evts.length) {
      if (phase === "inn1") {
        const t = setTimeout(() => {
          setPhase("inn2");
          setCursor(0);
        }, 1400);
        return () => clearTimeout(t);
      }
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
      step = 1; // last over of a close game — one ball at a time
      wait = 750;
    } else if (tense) {
      step = 6;
      wait = 600;
    } else {
      step = 12;
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
  const ballsLeft = live.events.length - balls;
  const need = target !== undefined ? target - runs : null;
  const battingYou = (phase === "inn1") === detail.userFirst;
  const recent = live.events.slice(Math.max(0, cursor - (balls % 6 === 0 ? 6 : balls % 6)), cursor);
  const overSlots = balls % 6 === 0 && balls > 0 ? 6 : balls % 6;

  const inn1Score = phase === "inn1" && !done ? score : detail.inn1.score;
  const inn1Overs =
    phase === "inn1" && !done
      ? oversStr
      : `${Math.floor(detail.inn1.balls / 6)}.${detail.inn1.balls % 6}`;

  return (
    <div className="flex flex-col">
      {/* the board */}
      <div className="-mx-5 lg:mx-0 lg:rounded-control lg:overflow-hidden bg-ink text-white px-5 py-5 lg:px-7 lg:py-6 flex flex-col gap-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-semibold text-[17px] leading-[22px]">{stage}</span>
          <span className="text-[13px] leading-[18px] text-muted-plate">
            {done
              ? "Complete"
              : inSO
                ? "Super over"
                : `${battingYou ? userTag : detail.opp} batting · ${
                    phase === "inn1" ? "1st innings" : "2nd innings"
                  }`}
          </span>
        </div>

        <InningsLine
          side={detail.userFirst ? userTag : detail.opp}
          you={detail.userFirst}
          note={`${inn1Overs} overs, batted first`}
          score={inn1Score}
        />
        <InningsLine
          side={!detail.userFirst ? userTag : detail.opp}
          you={!detail.userFirst}
          note={
            phase === "inn2" || done
              ? `${oversStr} overs, chasing ${detail.inn1.runs + 1}`
              : `chasing ${detail.inn1.runs + 1}`
          }
          score={phase === "inn2" || done ? score : "—"}
        />

        {!done && !inSO && phase === "inn2" && need !== null && (
          <div className="pt-4 border-t border-plate-line flex flex-col gap-2.5">
            <div className="flex items-baseline gap-3 flex-wrap">
              {need > 0 ? (
                <>
                  <span className="font-display font-bold text-[56px] leading-[48px] pt-1 tabular">
                    {need}
                  </span>
                  <span className="font-medium text-[17px] leading-[22px]">
                    needed off {ballsLeft} ball{ballsLeft === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span className="font-semibold text-[24px] leading-8 text-turf-soft">Chased down.</span>
              )}
              <span className="flex-1" />
              {cur && (
                <span className="text-[13px] leading-[18px] text-muted-plate">
                  {cur.bowler} to {cur.striker}
                </span>
              )}
            </div>
            <BallStrip recent={recent} slots={overSlots} over={Math.floor(balls / 6) + 1} />
            <p className="text-[15px] leading-[22px] text-body-plate">
              {tense && ballsLeft <= 6
                ? "Final over, and it is still alive."
                : tense
                  ? "Working through the overs."
                  : "Cruising. Fast-forwarding."}
            </p>
          </div>
        )}

        {!done && !inSO && phase === "inn1" && (
          <div className="pt-4 border-t border-plate-line flex flex-col gap-2.5">
            <div className="flex items-baseline gap-3">
              <span className="font-display font-bold text-[44px] leading-[38px] pt-1 tabular">
                {score}
              </span>
              <span className="font-medium text-[16px] leading-[22px]">after {oversStr} overs</span>
              <span className="flex-1" />
              {cur && (
                <span className="text-[13px] leading-[18px] text-muted-plate">
                  {cur.bowler} to {cur.striker}
                </span>
              )}
            </div>
            <BallStrip recent={recent} slots={overSlots} over={Math.floor(balls / 6) + 1} />
          </div>
        )}

        {inSO && detail.superOver && (
          <SuperOverLive
            key={phase}
            oppName={detail.opp}
            userTag={userTag}
            inn={phase === "so1" ? detail.superOver.inn1 : detail.superOver.inn2}
            other={phase === "so1" ? null : detail.superOver.inn1}
            speed={speed}
            onDone={() => {
              if (phase === "so1") setPhase("so2");
              else setPhase("over");
            }}
          />
        )}
      </div>

      {done && <MatchResult detail={detail} userTag={userTag} nextLabel={nextLabel} onDone={onDone} />}

      {/* scorecards */}
      {/* Scorecards only appear once an innings is over — no spoilers mid-chase. */}
      {(phase === "inn2" || inSO || done) && (
        <div className="mt-6 flex flex-col lg:flex-row lg:gap-12 lg:items-start">
          <div className="flex-1 min-w-0">
            <InningsCard
              title={`${detail.userFirst ? userTag : detail.opp}, 1st innings`}
              inn={detail.inn1}
              defaultOpen
            />
          </div>
          {done && (
            <div className="flex-1 min-w-0 mt-6 lg:mt-0">
              <InningsCard
                title={`${!detail.userFirst ? userTag : detail.opp}, 2nd innings`}
                inn={detail.inn2}
                defaultOpen
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InningsLine({
  side,
  you,
  note,
  score,
}: {
  side: string;
  you: boolean;
  note: string;
  score: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex items-center justify-center w-14 h-[30px] shrink-0 rounded font-display font-bold text-[20px] leading-none pt-[2px]"
        style={{ backgroundColor: you ? "#FFFFFF" : "#2E2E2E", color: you ? "#000000" : "#FFFFFF" }}
      >
        {side}
      </span>
      <span className="flex-1 min-w-0 text-[14px] leading-5 text-muted-plate truncate">{note}</span>
      <span className="shrink-0 font-display font-bold text-[34px] leading-[30px] lg:text-[40px] lg:leading-[34px] pt-1 tabular">
        {score}
      </span>
    </div>
  );
}

function BallStrip({
  recent,
  slots,
  over,
}: {
  recent: { n: number; runs: number; wicket?: boolean }[];
  slots: number;
  over: number;
}) {
  const empties = Math.max(0, 6 - slots);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="w-[60px] shrink-0 text-[13px] leading-[18px] text-muted-plate">Over {over}</span>
      {recent.slice(-6).map((e) => (
        <span
          key={e.n}
          className="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-full font-display font-semibold text-[20px] leading-none pt-[2px]"
          style={
            e.wicket
              ? { backgroundColor: "#D8321F", color: "#FFFFFF" }
              : e.runs >= 4
                ? { backgroundColor: "#FFFFFF", color: "#000000" }
                : { border: "1px solid #4A4A4A", color: "#FFFFFF" }
          }
        >
          {e.wicket ? "W" : e.runs}
        </span>
      ))}
      {Array.from({ length: empties }, (_, i) => (
        <span
          key={`e${i}`}
          className="w-[34px] h-[34px] shrink-0 rounded-full border border-dashed border-[#4A4A4A]"
        />
      ))}
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
  const chase = detail.inn2;
  const so = detail.superOver;
  const soU = so ? (so.inn1.side === userTag ? so.inn1 : so.inn2) : null;
  const soO = so && soU ? (soU === so.inn1 ? so.inn2 : so.inn1) : null;
  const soLine = so && soU && soO ? `${soU.score} to ${soO.score}` : (so as any)?.scoreline ?? "";
  const margin = so
    ? `in a super over, ${soLine}`
    : won
      ? detail.userFirst
        ? `by ${userRuns - oppRuns} runs`
        : `by ${10 - chase.wickets} wickets, ${Math.max(0, 120 - chase.balls)} balls left`
      : detail.userFirst
        ? `by ${10 - chase.wickets} wickets`
        : `by ${oppRuns - userRuns} runs`;
  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          className="flex items-center justify-center h-7 px-2.5 pt-[2px] rounded font-display font-bold text-[20px] leading-none"
          style={{ backgroundColor: won ? "#1A8A3C" : "#D8321F", color: "#FFFFFF" }}
        >
          {won ? "WON" : "LOST"}
        </span>
        <span className="font-semibold text-[20px] leading-7 lg:text-[24px] lg:leading-8">{margin}</span>
      </div>
      <p className="text-[15px] leading-[22px] text-muted">
        {userTag} {detail.userFirst ? detail.inn1.score : detail.inn2.score} versus{" "}
        {detail.userFirst ? detail.inn2.score : detail.inn1.score} {detail.opp}
      </p>
      <PrimaryButton className="w-full sm:w-auto sm:px-12 sm:self-center mt-1" onClick={onDone}>
        {nextLabel}
      </PrimaryButton>
    </div>
  );
}

// Super over: six balls, snappy; the last three slow down.
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
    <div className="pt-4 border-t border-plate-line flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <span className="font-semibold text-[17px] leading-[22px]">Super over · {sideLabel}</span>
        {other && (
          <span className="text-[13px] leading-[18px] text-muted-plate">
            {other.side} made {other.score}, needs {other.runs + 1}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-display font-bold text-[44px] leading-[38px] pt-1 tabular">
          {last ? last.score : "0/0"}
        </span>
        <span className="flex-1" />
        <span className="text-[13px] leading-[18px] text-muted-plate">
          {done ? "Super over complete" : inn.events.length - cursor <= 3 ? "Last three balls" : ""}
        </span>
      </div>
      <div className="flex gap-2">
        {inn.events.map((e, i) => (
          <span
            key={e.n}
            className="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-full font-display font-semibold text-[20px] leading-none pt-[2px]"
            style={
              i >= cursor
                ? { border: "1px dashed #4A4A4A", color: "#4A4A4A" }
                : e.wicket
                  ? { backgroundColor: "#D8321F", color: "#FFFFFF" }
                  : e.runs >= 4
                    ? { backgroundColor: "#FFFFFF", color: "#000000" }
                    : { border: "1px solid #4A4A4A", color: "#FFFFFF" }
            }
          >
            {i < cursor ? (e.wicket ? "W" : e.runs) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function parseScoreStr(s: string): [number, number] {
  const p = s.split("/");
  return [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
}

export function InningsCard({
  title,
  inn,
  defaultOpen,
}: {
  title: string;
  inn: DetailedInnings;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="flex flex-col">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-baseline gap-3 py-1">
        <SectionHead title={title} />
        <span className="flex-1" />
        <span className="font-display font-semibold text-[22px] leading-5 pt-[3px] tabular whitespace-nowrap">
          {inn.score}
        </span>
        <span className="text-[13px] text-muted w-14 text-right">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-6 mt-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 h-7 text-[12px] leading-4 text-muted">
              <span className="flex-1">Batter</span>
              <span className="w-12 shrink-0 text-right">Runs</span>
              <span className="w-12 shrink-0 text-right">Balls</span>
            </div>
            {inn.batsmen
              .filter((b) => b.balls > 0)
              .map((b, i, arr) => (
                <div
                  key={b.name}
                  className={`flex items-center gap-3 h-9 border-t border-hairline ${
                    i === arr.length - 1 ? "border-b" : ""
                  }`}
                >
                  <span className="flex-1 min-w-0 text-[15px] leading-5 truncate">
                    {b.name}
                    {!b.out && <span className="text-turf"> not out</span>}
                  </span>
                  <span className="w-12 shrink-0 text-right font-display font-semibold text-[20px] leading-5 pt-[3px] tabular">
                    {b.runs}
                  </span>
                  <span className="w-12 shrink-0 text-right font-display text-[20px] leading-5 pt-[3px] tabular text-muted">
                    {b.balls}
                  </span>
                </div>
              ))}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3 h-7 text-[12px] leading-4 text-muted">
              <span className="flex-1">Bowler</span>
              <span className="w-12 shrink-0 text-right">Overs</span>
              <span className="w-12 shrink-0 text-right">Runs</span>
              <span className="w-12 shrink-0 text-right">Wkts</span>
            </div>
            {inn.bowlers
              .filter((b) => b.balls > 0)
              .map((b, i, arr) => (
                <div
                  key={b.name}
                  className={`flex items-center gap-3 h-9 border-t border-hairline ${
                    i === arr.length - 1 ? "border-b" : ""
                  }`}
                >
                  <span className="flex-1 min-w-0 text-[15px] leading-5 truncate">{b.name}</span>
                  <span className="w-12 shrink-0 text-right font-display text-[20px] leading-5 pt-[3px] tabular text-muted">
                    {Math.floor(b.balls / 6)}.{b.balls % 6}
                  </span>
                  <span className="w-12 shrink-0 text-right font-display text-[20px] leading-5 pt-[3px] tabular">
                    {b.runs}
                  </span>
                  <span className="w-12 shrink-0 text-right font-display font-semibold text-[20px] leading-5 pt-[3px] tabular">
                    {b.wickets}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
