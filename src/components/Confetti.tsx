"use client";
import { useEffect, useRef } from "react";

/* Winning the cup gets paper in the air: a pop from the two bottom corners for
   the bang, and a fall across the whole width so the screen is actually full of
   it on a phone as well as on a laptop. Mount it when the cup is won and forget
   about it — it clears itself down and stops burning frames. Anyone who has
   asked for less motion gets none of it. */

const COLOURS = ["#E0A81C", "#5AC2FF", "#FFFFFF", "#4FCB74", "#FF822A", "#A76BFF"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  sway: number; // how far it wanders from side to side coming down
  phase: number;
  colour: string;
}

const GRAVITY = 0.3;
const TERMINAL = 7; // paper stops speeding up early, but still falls

export function Confetti({ seconds = 5 }: { seconds?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pieces: Piece[] = [];
    const make = (x: number, y: number, vx: number, vy: number): Piece => ({
      x,
      y,
      vx,
      vy,
      w: 6 + Math.random() * 5,
      h: 9 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35,
      sway: 0.4 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    });

    // The pop: up and inward, hard enough to clear most of the screen, and
    // spread wide enough that the two sides meet in the middle.
    const pop = () => {
      const up = Math.sqrt(2 * GRAVITY * h * 0.8);
      const across = w / (up / GRAVITY);
      const sides: [number, number][] = [
        [-6, 1],
        [w + 6, -1],
      ];
      for (const [x, dir] of sides) {
        for (let i = 0; i < 55; i++) {
          pieces.push(
            make(
              x,
              h + 6,
              dir * across * (0.5 + Math.random() * 2.2),
              -up * (0.7 + Math.random() * 0.5)
            )
          );
        }
      }
    };

    // The fall: spread over the full width, so no screen shape leaves a gap.
    const drop = (n: number) => {
      for (let i = 0; i < n; i++) {
        pieces.push(
          make(
            Math.random() * w,
            -20 - Math.random() * h * 0.25,
            (Math.random() - 0.5) * 1.6,
            1 + Math.random() * 2
          )
        );
      }
    };

    pop();
    drop(60);
    const showers = [250, 550, 900, 1300, 1700].map((ms) => window.setTimeout(() => drop(45), ms));

    let raf = 0;
    const start = performance.now();
    let last = start;
    const total = seconds * 1000;
    const frame = (now: number) => {
      const life = now - start;
      // Step by real time, not by frames: a 120Hz phone must not run the
      // celebration at double speed and half the height.
      const dt = Math.min(3, Math.max(0.4, (now - last) / 16.667));
      last = now;
      ctx.clearRect(0, 0, w, h);
      const fade = life > total - 900 ? Math.max(0, (total - life) / 900) : 1;
      for (const p of pieces) {
        p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL);
        p.vx *= Math.pow(0.985, dt);
        p.phase += 0.08 * dt;
        p.x += (p.vx + Math.sin(p.phase) * p.sway) * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        if (p.y > h + 30) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (life < total) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      for (const id of showers) window.clearTimeout(id);
      window.removeEventListener("resize", resize);
    };
  }, [seconds]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50" />;
}
