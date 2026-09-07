"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flap, PrimaryButton } from "./ui";
import { useT } from "@/lib/i18n";

// The board: SQUAD x SEASON cells cycle, decelerate, then lock.
// Outcome-first (the target is already decided), theatre second.

interface Props {
  targetTeamId: string;
  targetName: string;
  targetColour: string;
  clubPool: string[]; // full teamIds to flash through
  spinKey: number; // remount/respin trigger (parent keys on this)
  onLanded: () => void;
}

let actx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!actx) actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch {
    return null;
  }
}
function muted(): boolean {
  try {
    return localStorage.getItem("14-0-mute") === "1";
  } catch {
    return false;
  }
}
function tick(prog: number) {
  if (muted()) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = 1300 - prog * 600;
  g.gain.setValueAtTime(0.1, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.045);
}
function thud() {
  if (muted()) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = 110;
  g.gain.setValueAtTime(0.3, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.26);
}

function split(teamId: string): [string, string] {
  const d = teamId.lastIndexOf("-");
  if (d < 0) return [teamId, ""];
  return [teamId.slice(0, d), teamId.slice(d + 1)];
}

export function SlotSpin({ targetTeamId, targetName, targetColour, clubPool, spinKey, onLanded }: Props) {
  const t = useT();
  const [club, setClub] = useState("");
  const [season, setSeason] = useState("");
  const [cycling, setCycling] = useState(false);
  const [locked, setLocked] = useState(false);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;
  const stateRef = useRef({ cycling: false });

  const start = useCallback(() => {
    if (stateRef.current.cycling) return;
    stateRef.current.cycling = true;
    setCycling(true);
    setLocked(false);
    const [tClub, tSeason] = split(targetTeamId);
    const DUR = 2100;
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / DUR);
      if (t >= 1) {
        setClub(tClub);
        setSeason(tSeason);
        setCycling(false);
        setLocked(true);
        stateRef.current.cycling = false;
        thud();
        setTimeout(() => onLandedRef.current(), 800);
        return;
      }
      const pick = clubPool[Math.floor(Math.random() * clubPool.length)];
      const [c, s] = split(pick);
      setClub(c);
      setSeason(s);
      tick(t);
      setTimeout(step, 55 + t * t * 200);
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

  useEffect(() => {
    setClub("");
    setSeason("");
    setLocked(false);
    setCycling(false);
    stateRef.current.cycling = false;
  }, [spinKey]);

  const dim = !club && !locked;

  return (
    <div className="text-white px-5 lg:px-0" onClick={start}>
      <div className="flex flex-col gap-4 lg:gap-5">
        {/* The board itself: two black plates on a night panel. */}
        <div className="bg-surface rounded-card p-4 lg:p-5 flex flex-col gap-3.5">
          <div className="flex gap-3 lg:gap-3.5">
            <div className="flex-1 min-w-0">
              <Flap
                label={t("draft.squad")}
                value={<span className={dim ? "text-[#3A3A3A]" : ""}>{club || "···"}</span>}
                tone={locked ? "team" : "plate"}
                colour={targetColour}
                className="h-[112px] lg:h-[116px]"
                valueClassName="text-[56px] leading-[52px] sm:text-[64px] sm:leading-[58px] lg:text-[72px] lg:leading-[66px]"
              />
            </div>
            <div className="flex-1 min-w-0">
              <Flap
                label={t("draft.season")}
                value={<span className={dim ? "text-[#3A3A3A]" : ""}>{season || "····"}</span>}
                className="h-[112px] lg:h-[116px]"
                valueClassName="text-[56px] leading-[52px] sm:text-[64px] sm:leading-[58px] lg:text-[72px] lg:leading-[66px]"
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
