"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface WheelSegment {
  teamId: string;
  code: string; // "MI19"
  colour: string;
}

interface Props {
  segments: WheelSegment[]; // includes target; stable for this spin
  targetTeamId: string;
  spinKey: number; // increment to (re)start spin
  onLanded: () => void;
  autoStart?: boolean;
}

function shortCode(teamId: string): string {
  const d = teamId.lastIndexOf("-");
  if (d < 0) return teamId.slice(0, 4).toUpperCase();
  return (teamId.slice(0, d) + teamId.slice(d + 1)).slice(0, 5).toUpperCase();
}

// ---- tiny WebAudio synth, no assets ----
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
export function isMuted(): boolean {
  try {
    return localStorage.getItem("14-0-mute") === "1";
  } catch {
    return false;
  }
}
function tick(prog: number) {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = 1400 - prog * 700;
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.035);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.04);
}
function thud() {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = 120;
  g.gain.setValueAtTime(0.3, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.26);
  [880, 1320].forEach((f, i) => {
    const oo = c.createOscillator();
    const gg = c.createGain();
    oo.type = "sine";
    oo.frequency.value = f;
    const t = c.currentTime + 0.12 + i * 0.12;
    gg.gain.setValueAtTime(0.0001, t);
    gg.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    oo.connect(gg).connect(c.destination);
    oo.start(t);
    oo.stop(t + 0.3);
  });
}

const R = 150;
const CX = 160;
const CY = 160;

function polar(aDeg: number, r: number): [number, number] {
  const a = ((aDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

export function Wheel({ segments, targetTeamId, spinKey, onLanded, autoStart = true }: Props) {
  const n = segments.length;
  const seg = 360 / n;
  const rotorRef = useRef<SVGGElement>(null);
  const rotRef = useRef(0);
  const [winner, setWinner] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const winnerIndex = useMemo(() => {
    const i = segments.findIndex((s) => s.teamId === targetTeamId);
    return i >= 0 ? i : 0;
  }, [segments, targetTeamId]);

  useEffect(() => {
    if (spinKey <= 0) return;
    setWinner(false);
    const startSpin = () => {
      if (reduced) {
        // accessibility: fade straight to result
        const wc = winnerIndex * seg + seg / 2;
        rotRef.current = (360 - wc) % 360;
        rotorRef.current?.setAttribute("transform", `rotate(${rotRef.current} ${CX} ${CY})`);
        setWinner(true);
        thud();
        setTimeout(() => onLandedRef.current(), 900);
        return;
      }
      setSpinning(true);
      const from = rotRef.current;
      const winnerCenter = winnerIndex * seg + seg / 2;
      const jitter = (Math.random() - 0.5) * seg * 0.5;
      const delta = 360 * 5 + (((360 - winnerCenter - (from % 360)) % 360) + 360) % 360 + jitter;
      const DUR = 4000;
      const t0 = performance.now();
      let lastBoundary = 0;
      let raf = 0;
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / DUR);
        const e = 1 - Math.pow(1 - t, 4); // easeOutQuart ≈ requested bezier
        const rot = from + delta * e;
        rotRef.current = rot;
        rotorRef.current?.setAttribute("transform", `rotate(${rot} ${CX} ${CY})`);
        const b = Math.floor((delta * e) / seg);
        if (b > lastBoundary) {
          lastBoundary = b;
          tick(e);
        }
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          setSpinning(false);
          thud();
          setWinner(true);
          setTimeout(() => onLandedRef.current(), 1100);
        }
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    };
    if (autoStart) {
      const t = setTimeout(startSpin, 450);
      return () => clearTimeout(t);
    }
  }, [spinKey, winnerIndex, seg, reduced, autoStart]);

  const target = segments[winnerIndex];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* pointer */}
        <div
          className={`absolute -top-1 left-1/2 -translate-x-1/2 z-10 text-2xl transition-transform ${spinning ? "" : winner ? "scale-125" : ""}`}
        >
          🔻
        </div>
        <svg width="300" height="300" viewBox="0 0 320 320" className="drop-shadow-[0_0_30px_rgba(251,191,36,0.25)]">
          <circle cx={CX} cy={CY} r={R + 6} fill="#111" stroke="#333" strokeWidth="2" />
          <g ref={rotorRef}>
            {segments.map((s, i) => {
              const a0 = i * seg;
              const a1 = a0 + seg;
              const [x0, y0] = polar(a0, R);
              const [x1, y1] = polar(a1, R);
              const large = seg > 180 ? 1 : 0;
              const dim = winner && s.teamId !== targetTeamId;
              const [tx, ty] = polar(a0 + seg / 2, R * 0.68);
              return (
                <g key={s.teamId + i} opacity={dim ? 0.3 : 1}>
                  <path
                    d={`M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`}
                    fill={s.colour}
                    stroke="#0a0a12"
                    strokeWidth="2"
                    style={
                      winner && s.teamId === targetTeamId
                        ? { filter: "drop-shadow(0 0 10px rgba(255,255,255,.9))" }
                        : undefined
                    }
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill="rgba(255,255,255,.92)"
                    fontSize="10"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${a0 + seg / 2} ${tx} ${ty})`}
                  >
                    {shortCode(s.teamId)}
                  </text>
                </g>
              );
            })}
          </g>
          {/* hub */}
          <circle cx={CX} cy={CY} r="34" fill="#0a0a12" stroke="#fbbf24" strokeWidth="2.5" />
          <text x={CX} y={CY - 2} textAnchor="middle" fill="#fbbf24" fontSize="13" fontWeight="900">
            {winner ? shortCode(target.teamId) : "14-0"}
          </text>
          <text x={CX} y={CY + 13} textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="700">
            {winner ? "LOCKED IN" : "SPIN"}
          </text>
        </svg>
      </div>
      {winner && (
        <div className="mt-2 text-center animate-[pulse_1s_ease-in-out_2]">
          <div className="text-2xl font-black" style={{ color: target.colour === "#1B1F3B" ? "#a5b4fc" : target.colour }}>
            {target.teamId}
          </div>
        </div>
      )}
    </div>
  );
}
