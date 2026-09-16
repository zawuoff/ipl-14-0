// Where the app lives when there is no window to ask — server renders and
// metadata. Client code should still prefer window.location.origin so preview
// deployments share links back to themselves.
export const SITE_URL = "https://buildxi.in";

/* What the game is, in the words a search result or an answer engine quotes
   back. Plain facts first — IPL, draft, 2008 to 2025, free — because that is
   what somebody types before they have heard of BuildXI. */
export const SITE_TITLE = "BuildXI · Draft an all-time IPL XI and try to go 14–0";
export const SITE_DESCRIPTION =
  "A free IPL draft game. Spin real IPL squads from 2008 to 2025, pick one player from each, and play a full season. Nobody has gone 14–0 yet.";

/* The ways into the one page, as addresses. The game switches screens without
   changing route, so these are what a link, a crawler or a new tab uses to
   land on the same screen a click in the page opens. */
export const HOME_LINKS = {
  howItWorks: "/#how-it-works",
  leaderboard: "/?view=leaderboard",
  allTime: "/?view=leaderboard&tab=all",
  daily: "/?play=daily",
  multiplayer: "/?play=multiplayer",
} as const;
