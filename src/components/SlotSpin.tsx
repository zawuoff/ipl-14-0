"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PrimaryButton } from "./ui";
import { SplitFlap } from "./SplitFlap";
import { useT } from "@/lib/i18n";
import { tick, thud } from "@/lib/sound";

// The board: SQUAD x SEASON cells cycle, decelerate, then lock.
// Outcome-first (the target is already decided), theatre second.

interface Props {
  targetTeamId: string;
  targetName: string;
  targetColour: string;
  clubPool: string[]; // full teamIds to flash through
  onLanded: () => void;
}

function split(teamId: string): [string, string] {
  const d = teamId.lastIndexOf("-");
  if (d < 0) return [teamId, ""];
  return [teamId.slice(0, d), teamId.slice(d + 1)];
}

/* One turn of the board. Everything a flap needs to draw itself lives here so
   the old and new faces can never drift apart between renders. */
interface Board {
  prevClub: string;
  prevSeason: string;
  club: string;
  season: string;
  turn: number;
  flipMs: number;
  landed: boolean;
}

const REST: Board = {
  prevClub: "",
  prevSeason: "",
  club: "",
  season: "",
  turn: 0,
  flipMs: 0,
  landed: false,
};

export function SlotSpin({ targetTeamId, targetName, targetColour, clubPool, onLanded }: Props) {
  const t = useT();
  const [board, setBoard] = useState<Board>(REST);
  const [cycling, setCycling] = useState(false);
  const onLandedRef = useRef(onLanded);
  // The spin runs on timers, so it must call whatever the parent last passed
  // rather than the closure it started with.
  useEffect(() => {
    onLandedRef.current = onLanded;
  });
  const stateRef = useRef({ cycling: false });
  const locked = board.landed;

  const start = useCallback(() => {
    if (stateRef.current.cycling) return;
    stateRef.current.cycling = true;
    setCycling(true);
    setBoard((b) => ({ ...b, landed: false }));
    const [tClub, tSeason] = split(targetTeamId);
    const DUR = 2100;
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / DUR);
      // The board starts fast and tires. A leaf has to finish falling before
      // the next one starts, so the turn is always a little under the gap.
      // Nothing goes quicker than about five turns a second: past that a leaf
      // is gone inside a few frames and the board reads as flicker rather than
      // as something mechanical, which is the whole point of it.
      const gap = 190 + p * p * 260;
      const flipMs = Math.min(gap * 0.9, 400);
      const last = p >= 1;
      const pick = clubPool[Math.floor(Math.random() * clubPool.length)];
      const [c, s] = last ? [tClub, tSeason] : split(pick);
      setBoard((b) => ({
        prevClub: b.club,
        prevSeason: b.season,
        club: c,
        season: s,
        turn: b.turn + 1,
        flipMs,
        landed: last,
      }));
      if (last) {
        stateRef.current.cycling = false;
        setCycling(false);
        // The thud belongs to the leaf hitting the stop, not to the decision.
        setTimeout(thud, flipMs);
        setTimeout(() => onLandedRef.current(), flipMs + 800);
        return;
      }
      tick(p);
      setTimeout(step, gap);
    };
    step();
  }, [targetTeamId, clubPool]);

  // Space or tap anywhere to spin
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [start]);

  const dim = !board.club && !locked;
  const face = (v: string, fallback: string) => (
    <span className={dim ? "text-[#3A3A3A]" : ""}>{v || fallback}</span>
  );
  const SIZE =
    "text-[56px] leading-[52px] sm:text-[64px] sm:leading-[58px] lg:text-[72px] lg:leading-[66px]";

  return (
    <div className="text-white px-5 lg:px-0" onClick={start}>
      <div className="flex flex-col gap-4 lg:gap-5">
        {/* The board itself: two black plates on a night panel. */}
        <div className="bg-surface rounded-card p-4 lg:p-5 flex flex-col gap-3.5">
          <div className="flex gap-3 lg:gap-3.5">
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="text-[13px] leading-[18px] font-medium text-muted-plate">
                {t("draft.squad")}
              </div>
              <SplitFlap
                prev={face(board.prevClub, "···")}
                next={face(board.club, "···")}
                playKey={board.turn}
                duration={board.flipMs}
                bg="#0A0A0A"
                nextBg={locked ? targetColour : undefined}
                bordered={!locked}
                className="h-[112px] lg:h-[116px]"
                valueClassName={SIZE}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="text-[13px] leading-[18px] font-medium text-muted-plate">
                {t("draft.season")}
              </div>
              <SplitFlap
                prev={face(board.prevSeason, "····")}
                next={face(board.season, "····")}
                playKey={board.turn}
                duration={board.flipMs}
                bg="#0A0A0A"
                bordered
                className="h-[112px] lg:h-[116px]"
                valueClassName={SIZE}
              />
            </div>
          </div>

          {locked && (
            <p className="font-semibold text-[17px] leading-[22px] lg:text-[20px] lg:leading-[26px]">
              {targetName}
            </p>
          )}
        </div>

        {!locked && (
          <>
            <PrimaryButton className="w-full" disabled={cycling} onClick={start}>
              {cycling ? t("draft.spinning") : t("draft.spinBoard")}
            </PrimaryButton>
            <p className="text-[13px] leading-[18px] text-muted text-center">
              {t("draft.spinHint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
