"use client";
import { useEffect, useRef, useState } from "react";

import { Confetti } from "./Confetti";
import { TrophyIcon } from "./ui";

/* Fourteen played, fourteen won, and the cup lifted at the end of it. One
   person has ever done it. A championship already gets paper in the air, so
   this cannot just be more paper — it has to stop the page.

   Three treatments are in here while the shape of the moment is still being
   chosen. Each one owns the whole screen for a few seconds, sits above
   everything, takes no clicks, and takes itself back down. The reduced-motion
   rule in globals.css flattens all three to a still frame, which is the point:
   the words and the number are always the payload, the motion is the delivery. */

export type InvincibleVariant = "gold" | "spotlight" | "stamp";

export interface InvincibleProps {
  variant: InvincibleVariant;
  /** The big line. "IMMORTAL", or whatever the language file says. */
  title: string;
  /** The quiet line under it. */
  sub: string;
  /** Fires once the screen is the reader's again. */
  onDone?: () => void;
}

/* How long each treatment holds the screen. The stamp is a single beat and is
   gone; the spotlight is a slow reveal and needs the room. */
const RUN_MS: Record<InvincibleVariant, number> = {
  gold: 5200,
  spotlight: 6400,
  stamp: 4200,
};

export function Invincible({ variant, title, sub, onDone }: InvincibleProps) {
  const [gone, setGone] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const id = window.setTimeout(() => {
      setGone(true);
      done.current?.();
    }, RUN_MS[variant]);
    return () => window.clearTimeout(id);
  }, [variant]);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      style={{ perspective: "900px" }}
    >
      {variant === "gold" && <GoldBoard title={title} sub={sub} />}
      {variant === "spotlight" && <Spotlight title={title} sub={sub} />}
      {variant === "stamp" && <Stamp title={title} sub={sub} />}
    </div>
  );
}

/** Hold a child back until the beat it belongs on. */
function Delayed({ ms, children }: { ms: number; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return on ? <>{children}</> : null;
}

/* ---------------------------------------------------------------- variant A
   The board goes gold. Fourteen result chips turn over to green one after the
   other — the season replayed in a second and a half — and the moment the last
   one lands the screen takes the colour of the trophy and the score arrives
   through it. It is the scoreboard language the rest of the game is already
   speaking, turned all the way up. */
function GoldBoard({ title, sub }: { title: string; sub: string }) {
  const CHIP_MS = 92; // the gap between one chip turning and the next
  const settled = 14 * CHIP_MS + 260; // when the wash is allowed to start

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, #F2C94C 0%, #E0A81C 34%, #8A6206 74%, #2A1D02 100%)",
          animation: `inv-wash 900ms cubic-bezier(0.2, 0.7, 0.3, 1) ${settled}ms both`,
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-5">
        {/* the season, replayed */}
        <div className="flex gap-[5px] sm:gap-2" style={{ perspective: "600px" }}>
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="block w-[15px] h-[26px] sm:w-[26px] sm:h-[42px] rounded-chip bg-turf-soft"
              style={{
                transformOrigin: "center top",
                animation: `inv-chip 200ms cubic-bezier(0.2, 0.9, 0.3, 1.06) ${i * CHIP_MS}ms both`,
                boxShadow: "0 2px 0 rgba(0,0,0,0.35)",
              }}
            />
          ))}
        </div>

        {/* the ring the score pushes ahead of it */}
        <div
          className="absolute rounded-full border-[3px] border-white/70"
          style={{
            width: "min(46vw, 340px)",
            height: "min(46vw, 340px)",
            animation: `inv-ring 1100ms cubic-bezier(0.1, 0.8, 0.3, 1) ${settled + 120}ms both`,
          }}
        />

        <div
          className="flex flex-col items-center"
          style={{ animation: `inv-pop 640ms cubic-bezier(0.2, 0.9, 0.28, 1.1) ${settled + 120}ms both` }}
        >
          <span
            className="font-display font-bold leading-[0.8] tabular text-ink"
            style={{ fontSize: "min(30vw, 260px)", textShadow: "0 6px 0 rgba(0,0,0,0.18)" }}
          >
            14–0
          </span>
          <span className="head-display text-ink text-[26px] sm:text-[38px] leading-none pt-3">
            {title}
          </span>
          <span className="text-ink/70 text-[14px] sm:text-[16px] leading-6 pt-2 text-center max-w-[30ch]">
            {sub}
          </span>
        </div>
      </div>

      <Delayed ms={settled + 120}>
        <Confetti variant="gold" seconds={3.4} />
      </Delayed>
    </>
  );
}

/* ---------------------------------------------------------------- variant B
   The floodlights come down. Everything else on the page goes dark, two beams
   sweep the ground, and the cup comes up out of the black on its own. It is the
   opposite move to the confetti burst a championship already gets: quieter, and
   longer, because the thing being marked has happened once. */
function Spotlight({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      {/* the house lights going down */}
      <div
        className="absolute inset-0 bg-[#02060F]"
        style={{ animation: "inv-dim 620ms ease-out both" }}
      />

      {/* the beams. Two soft wedges turning slowly, clipped to a circle so the
          light falls off rather than reaching the corners. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: "170vmax",
          height: "170vmax",
          marginLeft: "-85vmax",
          marginTop: "-85vmax",
          background:
            "conic-gradient(from 0deg, rgba(224,168,28,0) 0deg, rgba(224,168,28,0.34) 16deg, rgba(224,168,28,0) 34deg, rgba(224,168,28,0) 180deg, rgba(224,168,28,0.34) 196deg, rgba(224,168,28,0) 214deg, rgba(224,168,28,0) 360deg)",
          maskImage: "radial-gradient(circle, #000 12%, transparent 62%)",
          WebkitMaskImage: "radial-gradient(circle, #000 12%, transparent 62%)",
          animation:
            "inv-rays 15s linear 500ms infinite, inv-breathe 2.6s ease-in-out 500ms infinite alternate",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        {/* the cup, with its own glow behind it so it reads as lit rather than
            drawn */}
        <div
          className="relative flex items-center justify-center"
          style={{ animation: "inv-rise 1100ms cubic-bezier(0.16, 0.8, 0.3, 1) 620ms both" }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: "min(70vw, 420px)",
              height: "min(70vw, 420px)",
              background:
                "radial-gradient(circle, rgba(242,201,76,0.5) 0%, rgba(224,168,28,0.16) 42%, transparent 70%)",
              animation: "inv-breathe 2.2s ease-in-out infinite alternate",
            }}
          />
          <span className="relative text-trophy" style={{ filter: "drop-shadow(0 0 26px rgba(242,201,76,0.55))" }}>
            <TrophyIcon size={168} />
          </span>
        </div>

        <span
          className="font-display font-bold leading-[0.82] tabular text-white pt-7"
          style={{
            fontSize: "min(21vw, 168px)",
            animation: "inv-lift 700ms cubic-bezier(0.2, 0.9, 0.3, 1) 1500ms both",
            textShadow: "0 0 40px rgba(242,201,76,0.42)",
          }}
        >
          14–0
        </span>
        <span
          className="head-display text-trophy text-[24px] sm:text-[34px] leading-none pt-2"
          style={{ animation: "inv-lift 700ms cubic-bezier(0.2, 0.9, 0.3, 1) 1780ms both" }}
        >
          {title}
        </span>
        <span
          className="text-white/70 text-[14px] sm:text-[16px] leading-6 pt-2.5 text-center max-w-[34ch]"
          style={{ animation: "inv-lift 700ms cubic-bezier(0.2, 0.9, 0.3, 1) 2020ms both" }}
        >
          {sub}
        </span>
      </div>

      <Delayed ms={1400}>
        <Confetti variant="gold" seconds={4.6} />
      </Delayed>
    </>
  );
}

/* ---------------------------------------------------------------- variant C
   One beat. The seal comes down out of nowhere, the board takes the hit, and
   the paper goes up out from underneath it. Nothing fades in, nothing is
   revealed slowly — it is over in about a second, which is its own kind of
   emphasis. */
function Stamp({ title, sub }: { title: string; sub: string }) {
  const HIT = 420; // when the seal actually lands

  return (
    <>
      <div
        className="absolute inset-0 bg-ground/78"
        style={{ animation: "inv-dim 300ms ease-out both" }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center px-5"
        style={{ animation: `inv-shake 460ms cubic-bezier(0.36, 0.07, 0.19, 0.97) ${HIT}ms both` }}
      >
        <div
          className="flex flex-col items-center border-[6px] border-trophy rounded-card px-7 py-6 sm:px-12 sm:py-9 bg-ground/50"
          style={{
            animation: `inv-stamp 460ms cubic-bezier(0.5, 0, 0.2, 1) 60ms both`,
            boxShadow: "0 0 60px rgba(224,168,28,0.35), inset 0 0 40px rgba(224,168,28,0.16)",
          }}
        >
          <span className="head-display text-trophy text-[13px] sm:text-[16px] leading-none tracking-[0.28em] pb-2">
            14 · 0
          </span>
          <span
            className="head-display text-trophy leading-[0.86]"
            style={{ fontSize: "min(16vw, 116px)", letterSpacing: "0.02em" }}
          >
            {title}
          </span>
          <span className="text-white/75 text-[13px] sm:text-[15px] leading-5 pt-3 text-center max-w-[30ch]">
            {sub}
          </span>
        </div>
      </div>

      <Delayed ms={HIT}>
        <Confetti variant="cannons" seconds={3.4} />
      </Delayed>
    </>
  );
}
