"use client";
import type { ReactNode } from "react";

/* A departure-board cell. The plate is split across the middle, and a change
   plays out the way the real thing does: the top leaf carrying the old value
   falls forward on the hinge, uncovering the new value printed underneath,
   then the new bottom leaf swings up to meet it.

   Four layers do it. Two are the settled board — the new value's top half and
   the old value's bottom half. Two are the moving leaves, both full-card boxes
   turning about the card's centre, which is exactly where the hinge sits, so
   each one pivots on the seam without any origin arithmetic. */

interface Props {
  /** What the cell was showing. */
  prev: ReactNode;
  /** What it is turning to. */
  next: ReactNode;
  /** Bumped on every change; restarts the leaves. */
  playKey: number;
  /** Milliseconds for the whole turn, fall and land together. */
  duration: number;
  className?: string;
  valueClassName?: string;
  /** The plate the old value sits on. */
  bg: string;
  /** The plate arriving with this turn, when the colour changes too. */
  nextBg?: string;
  bordered?: boolean;
}

function Face({
  side,
  children,
  bg,
  valueClassName,
}: {
  side: "top" | "bottom";
  children: ReactNode;
  bg: string;
  valueClassName: string;
}) {
  return (
    <div
      className={`absolute inset-x-0 h-1/2 overflow-hidden ${side === "top" ? "top-0" : "bottom-0"}`}
      style={{ backgroundColor: bg, backfaceVisibility: "hidden" }}
    >
      {/* Twice the height of the half it shows, pinned to the outer edge, so
          the glyph lands dead centre of the whole card and each half crops its
          own portion of it. */}
      <div
        className={`absolute inset-x-0 h-[200%] flex items-center justify-center ${
          side === "top" ? "top-0" : "bottom-0"
        }`}
      >
        <span className={`font-display font-bold tabular pt-[0.08em] text-white ${valueClassName}`}>
          {children}
        </span>
      </div>
    </div>
  );
}

export function SplitFlap({
  prev,
  next,
  playKey,
  duration,
  className = "",
  valueClassName = "",
  bg,
  nextBg,
  bordered,
}: Props) {
  const half = Math.max(40, duration) / 2;
  const front = nextBg ?? bg;
  return (
    <div
      className={`relative overflow-hidden rounded-plate ${className}`}
      style={{
        backgroundColor: front,
        border: bordered ? "1px solid var(--color-plate-line)" : "none",
        perspective: "460px",
      }}
    >
      <Face side="top" bg={front} valueClassName={valueClassName}>
        {next}
      </Face>
      <Face side="bottom" bg={bg} valueClassName={valueClassName}>
        {prev}
      </Face>

      <div
        key={`fall-${playKey}`}
        className="flap-leaf flap-fall absolute inset-0"
        style={{ animationDuration: `${half}ms` }}
      >
        <Face side="top" bg={bg} valueClassName={valueClassName}>
          {prev}
        </Face>
      </div>
      <div
        key={`land-${playKey}`}
        className="flap-leaf flap-land absolute inset-0"
        style={{ animationDuration: `${half}ms`, animationDelay: `${half}ms` }}
      >
        <Face side="bottom" bg={front} valueClassName={valueClassName}>
          {next}
        </Face>
      </div>

      {/* The seam. Solid on the black plate, eased back on a franchise colour,
          matching every other flap on the board. */}
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-black z-10"
        style={{ opacity: front === "#0A0A0A" ? 1 : 0.55 }}
      />
    </div>
  );
}
