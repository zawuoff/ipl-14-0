"use client";
import { useCallback, useSyncExternalStore } from "react";

import { analytics } from "./analytics";

/* Every sound in the game is synthesised — no files to download on a phone
   connection. One shared context, one shared mute switch, so the toggle in the
   header and the noises made deep inside the draft always agree. */

const KEY = "14-0-mute";

let cache: boolean | null = null;
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  if (cache !== null) return cache;
  try {
    cache = localStorage.getItem(KEY) === "1";
  } catch {
    cache = false;
  }
  return cache;
}

export function setMuted(m: boolean): void {
  cache = m;
  try {
    localStorage.setItem(KEY, m ? "1" : "0");
  } catch {}
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The mute switch as state. Renders silent-side-up on the server, which is
    what the first paint shows anyway until localStorage can be read. */
export function useMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(
    subscribe,
    isMuted,
    () => false
  );
  // Reported from the toggle rather than from setMuted: this is the switch a
  // manager actually reaches for, in all three headers.
  const toggle = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    analytics.soundToggled(next);
  }, []);
  return [muted, toggle];
}

let actx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!actx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      actx = new Ctor();
    }
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch {
    return null;
  }
}

/** One note. Ramps rather than switches, so nothing clicks. */
function blip(
  c: AudioContext,
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  gain: number
): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** The reel ticking past a squad. */
export function tick(prog: number): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  blip(c, 1300 - prog * 600, c.currentTime, 0.04, "triangle", 0.1);
}

/** A squad locking in. */
export function thud(): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  blip(c, 110, c.currentTime, 0.25, "sine", 0.3);
}

/** Lifting the cup: a rising major arpeggio, an octave of sparkle over it, and
    the whole chord left ringing on a low drum. */
export function fanfare(): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.03;
  const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  chord.forEach((f, i) => {
    const at = t0 + i * 0.1;
    blip(c, f, at, 0.3, "triangle", 0.15);
    blip(c, f * 2, at, 0.18, "sine", 0.045);
  });
  const ring = t0 + 0.42;
  for (const f of chord) blip(c, f, ring, 1.15, "triangle", 0.085);
  blip(c, 1567.98, ring + 0.06, 0.9, "sine", 0.05); // G6 shimmer on top
  blip(c, 130.81, ring, 0.55, "sine", 0.22); // C3 under it
}

/** Lifting the cup: three rockets going up, each with a pop at the top. */
export function fireworks(): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.03;
  for (let i = 0; i < 3; i++) {
    const launch = t0 + i * 0.42;
    // the whistle up
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(320, launch);
    o.frequency.exponentialRampToValueAtTime(1100, launch + 0.32);
    g.gain.setValueAtTime(0.0001, launch);
    g.gain.exponentialRampToValueAtTime(0.05, launch + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, launch + 0.34);
    o.connect(g).connect(c.destination);
    o.start(launch);
    o.stop(launch + 0.36);
    // the pop
    const at = launch + 0.36;
    blip(c, 90, at, 0.22, "sine", 0.28);
    blip(c, 1800 + i * 300, at, 0.08, "triangle", 0.09);
    blip(c, 2600 + i * 200, at + 0.02, 0.12, "sine", 0.04);
  }
}

/* ------------------------------------------------------------------ the roar

   The one noise in the game that is not synthesised. Fourteen won, none lost,
   and the cup lifted — no oscillator was going to sell that, so a real crowd
   comes down the wire instead. See public/sfx/README.md for where it is from.

   It costs nobody anything. Nothing is fetched until a run reaches the
   playoffs, and only a run that is still unbeaten by then will ever play it,
   which so far is one run in every few thousand. Starting the fetch that early
   also means it is decoded and waiting well before the final ball. */

const ROAR_URL = "/sfx/invincible.mp3";

let roarBuffer: AudioBuffer | null = null;
let roarPending = false;

/** Start pulling the crowd down. Safe to call more than once; safe to ignore. */
export function prefetchRoar(): void {
  if (roarBuffer || roarPending) return;
  const c = audio();
  if (!c) return;
  roarPending = true;
  void fetch(ROAR_URL)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((bytes) => c.decodeAudioData(bytes))
    .then((buf) => {
      roarBuffer = buf;
    })
    .catch(() => {
      // No crowd, then. The synthesised encore below covers it.
      roarPending = false;
    });
}

/** The unbeaten season. Falls back to the fireworks if the crowd has not
    arrived — a slow connection should still get a noise, not silence. */
export function roar(): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  if (!roarBuffer) {
    prefetchRoar();
    fireworks();
    return;
  }
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = roarBuffer;
  g.gain.setValueAtTime(0.9, c.currentTime);
  src.connect(g).connect(c.destination);
  src.start();
}
