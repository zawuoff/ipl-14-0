// One place that knows the event names, so the dashboard and the code can't drift.
import posthog from "posthog-js";

import type { Difficulty, GameMode } from "@/lib/game/types";
import type { Lang } from "@/lib/i18n";
import type { SeasonResult } from "@/lib/sim/engine";
import type { SeenBefore, ShareKind, ShareVia } from "@/lib/share";

type Props = Record<string, unknown>;

// Analytics is never worth a crash: a blocked script, a private window with no
// storage, a token that isn't set in dev — all of it fails quietly.
function track(event: string, props?: Props) {
  try {
    posthog.capture(event, props);
  } catch {}
}

export const analytics = {
  // A link opened. The rest of the visit belongs to this arrival, so the marker
  // is registered for the session: the draft it leads to carries it too, and
  // the loop reads end to end — shared, opened, played.
  // `seen` is the one that answers whether sharing grows anything: `via` alone
  // cannot tell a friend arriving on a link from the manager opening his own
  // room for the third time, and both of those read "unknown".
  shareOpened(kind: ShareKind, via: ShareVia | "unknown", seen: SeenBefore) {
    try {
      posthog.register_for_session({ share_kind: kind, share_via: via, share_seen: seen });
    } catch {}
    track("share_opened", { kind, via, seen });
  },

  // A challenge link that arrived and could not be read. The parser wants
  // exactly eleven ids; anything else drops the visitor on the home page, and
  // until now it did so with nothing recorded at all — so a link clipped by
  // whatever it was pasted into was invisible, and the feature looked merely
  // unloved rather than possibly broken.
  challengeLinkBroken(parts: number) {
    track("challenge_link_broken", { parts });
  },

  // `origin` separates a first run from a rematch, `entry` says which door they
  // came through — a challenge link is the whole point of sharing one.
  draftStarted(
    mode: GameMode,
    difficulty: Difficulty,
    opts: { origin: "setup" | "again"; entry: "direct" | "challenge" | "room" }
  ) {
    track("draft_started", {
      mode,
      difficulty,
      origin: opts.origin,
      entry: opts.entry,
    });
  },

  // Pick number is the whole point: it says where people put the phone down.
  // `off_role` and `role` are how we find out whether the new multi-role tray is
  // used at all, or whether everyone just takes the name in its filed position.
  pickMade(
    n: number,
    mode: GameMode,
    opts: { lastResort: boolean; offRole: boolean; role: string; rerollsLeft: number }
  ) {
    track("pick_made", {
      pick_number: n,
      mode,
      last_resort: opts.lastResort,
      off_role: opts.offRole,
      role: opts.role,
      rerolls_left: opts.rerollsLeft,
    });
  },

  // Does a respin rescue a stalling draft, or is it the last thing they do?
  rerollUsed(n: number, difficulty: Difficulty, rerollsLeft: number) {
    track("reroll_used", { pick_number: n, difficulty, rerolls_left: rerollsLeft });
  },

  // What they chose on the way in, against what they actually finished.
  setupChanged(field: "mode" | "seats" | "style" | "difficulty", value: string | number) {
    track("setup_changed", { field, value });
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

  // Whether the season is watched or skipped decides what the animation is worth.
  simSpeedChanged(speed: number, context: "solo" | "room") {
    track("sim_speed_changed", { speed, context });
  },

  simSkipped(atMatch: number, context: "solo" | "room") {
    track("sim_skipped", { at_match: atMatch, context });
  },

  // `surface` is the block it was sent from: the season report, or the plate
  // beside the final score.
  seasonShared(
    // Instagram and the saved picture both come out of the canvas card, and
    // are worth telling apart: one went to a share sheet, the other to a
    // downloads folder and possibly nowhere.
    channel: "whatsapp" | "copy" | "challenge" | "instagram" | "x" | "image",
    surface: "report" | "plate"
  ) {
    track("season_shared", { channel, surface });
  },

  roomShared(channel: "whatsapp" | "copy", stage: "lobby" | "result") {
    track("room_shared", { channel, stage });
  },

  roomCreated(seats: number) {
    track("room_created", { seats });
  },

  roomJoined(seats: number) {
    track("room_joined", { seats });
  },

  // The lobby's own funnel: seats fill, XIs lock, the league runs.
  roomXILocked(seats: number, filled: number) {
    track("room_xi_locked", { seats, filled });
  },

  roomFilled(seats: number) {
    track("room_filled", { seats });
  },

  roomSeatsClosed(seats: number, filled: number) {
    track("room_seats_closed", { seats, filled });
  },

  roomSeasonStarted(players: number) {
    track("room_season_started", { players });
  },

  roomSeasonFinished(players: number, r: { wins: number; losses: number; champion: boolean }) {
    track("room_season_finished", {
      players,
      wins: r.wins,
      losses: r.losses,
      champion: r.champion,
    });
  },

  languageChanged(to: Lang) {
    track("language_changed", { to });
  },

  soundToggled(muted: boolean) {
    track("sound_toggled", { muted });
  },
};
