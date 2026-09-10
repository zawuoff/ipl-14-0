"use client";
import { useEffect, useRef, useState } from "react";

import { Confetti } from "./Confetti";

/* Fourteen played, fourteen won, and the cup lifted at the end of it. One
   person has ever done it. A championship already gets paper in the air, so
   this cannot just be more paper — it has to stop the page.

   The board goes gold. Fourteen win cards turn over one after the other, which
   is the season replayed in a second and a half, and the moment the last one
   lands the screen takes the colour of the trophy and the score arrives through
   it. It is the scoreboard language the rest of the game already speaks, turned
   all the way up.

   It owns the whole screen for five seconds, takes no clicks, and puts itself
   away. The reduced-motion rule in globals.css flattens the whole thing to a
   still frame, which is the point: the number and the word are the payload, the
   motion is only the delivery. */

export interface InvincibleProps {
  /** The big line. "IMMORTAL", or whatever the language file says. */
  title: string;
  /** The quiet line under it. */
  sub: string;
  /** Fires once the screen is the reader's again. */
  onDone?: () => void;
}

const CARD_MS = 92; // the gap between one card turning and the next
const SETTLED = 14 * CARD_MS + 260; // the last card is down; the gold may start
const SCORE_AT = SETTLED + 120;
const RUN_MS = 5200;

export function Invincible({ title, sub, onDone }: InvincibleProps) {
  const [gone, setGone] = useState(false);
  // Held in a ref so a fresh callback identity from the parent cannot restart
  // the clock half way through the celebration.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const id = window.setTimeout(() => {
      setGone(true);
      done.current?.();
    }, RUN_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (gone) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {/* The cards need their own ground to turn over on. Without this they
          spend the first second and a half floating over a live result screen,
          which reads as a glitch rather than as a flourish. */}
      <div
        className="absolute inset-0 bg-ground"
        style={{ animation: "inv-dim 260ms ease-out both" }}
      />

      {/* and then the ground itself goes the colour of the trophy */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, #F2C94C 0%, #E0A81C 34%, #8A6206 74%, #2A1D02 100%)",
          animation: `inv-wash 900ms cubic-bezier(0.2, 0.7, 0.3, 1) ${SETTLED}ms both`,
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        {/* the season, replayed: fourteen win cards, one after the next */}
        <div
          className="flex gap-[3px] sm:gap-1.5 pb-5 sm:pb-7"
          style={{ perspective: "700px" }}
        >
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="flex items-center justify-center w-[19px] h-[27px] sm:w-[40px] sm:h-[54px] rounded-plate bg-turf font-display font-bold leading-none text-white text-[14px] sm:text-[28px] pt-[2px] sm:pt-1"
              style={{
                transformOrigin: "center top",
                animation: `inv-card 200ms cubic-bezier(0.2, 0.9, 0.3, 1.06) ${i * CARD_MS}ms both`,
                boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.28)",
              }}
            >
              W
            </span>
          ))}
        </div>

        {/* the ring the score pushes out ahead of it */}
        <div
          className="absolute rounded-full border-[3px] border-white/70"
          style={{
            width: "min(46vw, 340px)",
            height: "min(46vw, 340px)",
            animation: `inv-ring 1100ms cubic-bezier(0.1, 0.8, 0.3, 1) ${SCORE_AT}ms both`,
          }}
        />

        <div
          className="flex flex-col items-center"
          style={{ animation: `inv-pop 640ms cubic-bezier(0.2, 0.9, 0.28, 1.1) ${SCORE_AT}ms both` }}
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

      <Delayed ms={SCORE_AT}>
        <Confetti variant="gold" seconds={3.4} />
      </Delayed>
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
