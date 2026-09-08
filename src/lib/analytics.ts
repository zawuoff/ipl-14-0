// One place that knows the event names, so the dashboard and the code can't drift.
import posthog from "posthog-js";

import type { Difficulty, GameMode } from "@/lib/game/types";
import type { SeasonResult } from "@/lib/sim/engine";

type Props = Record<string, unknown>;

// Analytics is never worth a crash: a blocked script, a private window with no
// storage, a token that isn't set in dev — all of it fails quietly.
function track(event: string, props?: Props) {
  try {
    posthog.capture(event, props);
  } catch {}
}

export const analytics = {
  draftStarted(mode: GameMode, difficulty: Difficulty) {
    track("draft_started", { mode, difficulty });
  },

  // Pick number is the whole point: it says where people put the phone down.
  pickMade(n: number, mode: GameMode, opts: { lastResort: boolean; rerollsLeft: number }) {
    track("pick_made", {
      pick_number: n,
      mode,
      last_resort: opts.lastResort,
      rerolls_left: opts.rerollsLeft,
    });
  },

  seasonSimulated(r: SeasonResult, mode: GameMode, difficulty: Difficulty) {
    track("season_simulated", {
      mode,
      difficulty,
      wins: r.wins,
      losses: r.losses,
      rank: r.rank,
      made_playoffs: r.madePlayoffs,
      champion: r.champion,
      // The thing nobody has done yet. Its own property so it is one filter away.
      perfect14: r.perfect14,
    });
  },

  seasonShared(channel: "whatsapp" | "copy" | "challenge" | "plate") {
    track("season_shared", { channel });
  },

  roomCreated(seats: number) {
    track("room_created", { seats });
  },

  roomJoined(seats: number) {
    track("room_joined", { seats });
  },
};
