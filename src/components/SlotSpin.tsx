"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// 38-0-style slot reveal: CLUB × SEASON boxes cycle, decelerate, lock.
// Outcome-first (target predetermined), theater-second.

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

  // Space / tap-anywhere to spin (38-0 style)
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

  // reset when a new spin arrives
  useEffect(() => {
    setClub("");
    setSeason("");
    setLocked(false);
    setCycling(false);
    stateRef.current.cycling = false;
  }, [spinKey]);

  return (
    <div className="text-center cursor-pointer" onClick={start}>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <div className="flex-1 max-w-[220px]">
          <div className="text-[10px] tracking-[0.25em] text-zinc-500 mb-1">CLUB</div>
          <div
            className={`rounded-xl border bg-[#12121f] px-3 py-4 font-black text-xl sm:text-2xl min-h-[64px] flex items-center justify-center transition-colors ${
              locked ? "border-emerald-400/70" : "border-white/10"
            }`}
            style={locked ? { color: targetColour, boxShadow: `0 0 24px -6px ${targetColour}` } : undefined}
          >
            {club || "···"}
          </div>
        </div>
        <div className="text-zinc-600 font-black text-xl">×</div>
        <div className="w-[120px] sm:w-[150px]">
          <div className="text-[10px] tracking-[0.25em] text-zinc-500 mb-1">SEASON</div>
          <div
            className={`rounded-xl border bg-[#12121f] px-3 py-4 font-black text-xl sm:text-2xl min-h-[64px] flex items-center justify-center transition-colors ${
              locked ? "border-emerald-400/70 text-amber-300" : "border-white/10"
            }`}
          >
            {season || "···"}
          </div>
        </div>
      </div>

      {locked ? (
        <div className="mt-3 text-sm text-zinc-300">
          <span className="font-bold text-white">{targetName}</span>
        </div>
      ) : (
        <button
          onClick={start}
          disabled={cycling}
          className="mt-5 px-8 py-3.5 rounded-xl bg-emerald-400 text-black font-black text-lg hover:bg-emerald-300 disabled:opacity-70 shadow-[0_0_36px_-8px_rgba(52,211,153,.8)]"
        >
          {cycling ? "Spinning…" : "🎰 Spin the Wheel"}
        </button>
      )}
      {!locked && !cycling && (
        <p className="text-[11px] text-zinc-500 mt-2">or tap anywhere, or press Space</p>
      )}
    </div>
  );
}
