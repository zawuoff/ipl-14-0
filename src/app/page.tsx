"use client";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GameBoard } from "@/components/GameBoard";
import { istDateKey } from "@/lib/game/types";
import { Flap, PrimaryButton, OutlineButton, SectionHead, Wordmark } from "@/components/ui";

type Screen = "home" | "game" | "board";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<"classic" | "daily">("classic");
  const [gameKey, setGameKey] = useState(0);
  const today = istDateKey();

  const challengeSpins = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const c = new URLSearchParams(window.location.search).get("challenge");
    if (!c) return undefined;
    const parts = c.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length === 11 ? parts : undefined;
  }, []);
  const roomCode = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const c = new URLSearchParams(window.location.search).get("room");
    return c ? c.toUpperCase() : undefined;
  }, []);

  // deep links jump straight into the game
  const initialScreen: Screen = challengeSpins || roomCode ? "game" : "home";
  const [entered] = useState(initialScreen);
  const show: Screen = entered === "game" ? "game" : screen;

  const dailyBoard = useQuery(
    (api as any).results?.leaderboard,
    show === "board" || show === "home" ? { dailyDate: today, limit: 20 } : "skip"
  );
  const allTimeBoard = useQuery(
    (api as any).results?.leaderboard,
    show === "board" ? { limit: 20 } : "skip"
  );

  const play = (m: "classic" | "daily") => {
    setMode(m);
    setGameKey((k) => k + 1);
    setScreen("game");
  };

  return (
    <main className="min-h-screen bg-ground text-ink flex flex-col">
      <TopBar screen={show} go={setScreen} inGame={entered === "game"} />

      {show === "home" && <HomeScreen today={today} play={play} rows={dailyBoard as Row[] | undefined} />}

      {show === "game" && (
        <GameBoard
          key={gameKey}
          initialMode={challengeSpins ? "classic" : mode}
          initialSpins={challengeSpins}
          initialRoom={roomCode}
        />
      )}

      {show === "board" && (
        <Leaderboard today={today} daily={dailyBoard as Row[] | undefined} allTime={allTimeBoard as Row[] | undefined} />
      )}

      <SiteFooter />
    </main>
  );
}

/* ---------------------------------------------------------------- chrome */

function TopBar({ screen, go, inGame }: { screen: Screen; go: (s: Screen) => void; inGame: boolean }) {
  const link = "text-[15px] leading-5 font-medium hover:text-turf transition-colors";
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-3.5 lg:py-5 flex items-center gap-3 lg:gap-5">
        <button onClick={() => !inGame && go("home")} className="flex items-baseline gap-3 min-w-0">
          <Wordmark className="text-[30px] lg:text-[34px]" />
          <span className="hidden sm:block text-[13px] lg:text-[14px] leading-[18px] text-muted truncate">
            Fan-made IPL draft game
          </span>
        </button>
        <span className="flex-1" />
        <nav className="hidden lg:flex items-center gap-7">
          <button className={link} onClick={() => go("home")}>How it works</button>
          <button className={`${link} ${screen === "board" ? "text-turf" : ""}`} onClick={() => go("board")}>
            Leaderboard
          </button>
          <button className={link} onClick={() => go("game")}>Play a friend</button>
        </nav>
        <button
          onClick={() => go("board")}
          className="lg:hidden text-[15px] font-medium px-3 h-9 flex items-center rounded-control border border-ink"
        >
          Board
        </button>
        <span
          className="flex items-center justify-center w-11 h-8 lg:w-[46px] lg:h-[34px] shrink-0 rounded-control border border-ink text-[14px] font-semibold"
          title="Hindi coming soon"
        >
          हिं
        </span>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-8 lg:py-10 flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-10">
        <p className="flex-1 max-w-[720px] text-[13px] leading-5 text-muted">
          14–0 is a fan-made game and is not affiliated with the IPL or BCCI. Player names and season
          ratings are used for description only, and ratings are derived from public season statistics.
        </p>
        <p className="text-[13px] lg:text-[14px] leading-5 font-medium">
          Leaderboard · How ratings work · Contact
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ home */

const RAIL: { role: string; name?: string; code?: string; season?: number; colour?: string }[] = [
  { role: "Opener", name: "Rohit", code: "MI", season: 2019, colour: "#004BA0" },
  { role: "Opener", name: "Gayle", code: "RCB", season: 2012, colour: "#EC1C24" },
  { role: "Middle", name: "Kohli", code: "RCB", season: 2016, colour: "#EC1C24" },
  { role: "Middle", name: "Raina", code: "CSK", season: 2013, colour: "#FDB913" },
  { role: "Middle" },
  { role: "Keeper" },
  { role: "All-rounder" },
  { role: "All-rounder" },
  { role: "Pace" },
  { role: "Pace" },
  { role: "Spin" },
];

function HomeScreen({
  today,
  play,
  rows,
}: {
  today: string;
  play: (m: "classic" | "daily") => void;
  rows: Row[] | undefined;
}) {
  const day = today.slice(8);
  const month = new Date(`${today}T00:00:00Z`)
    .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase();

  return (
    <>
      {/* The board is the hero. On desktop it fills the screen. */}
      <section className="bg-ink text-white">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-7 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-16">
            <div className="flex gap-3 lg:gap-3.5 lg:shrink-0">
              <Flap
                label="Won"
                value="14"
                wrapClassName="flex-1 lg:flex-none lg:w-[236px]"
                className="h-[132px] lg:h-[280px]"
                valueClassName="text-[128px] leading-[110px] lg:text-[216px] lg:leading-[186px]"
              />
              <Flap
                label="Lost"
                value="0"
                wrapClassName="flex-1 lg:flex-none lg:w-[236px]"
                className="h-[132px] lg:h-[280px]"
                valueClassName="text-[128px] leading-[110px] lg:text-[216px] lg:leading-[186px]"
              />
            </div>

            <div className="flex flex-col gap-5 lg:gap-5 lg:flex-1 lg:pb-2">
              <h1 className="font-semibold text-[24px] leading-[30px] lg:text-[50px] lg:leading-[58px]">
                <span className="lg:hidden">Draft an all-time IPL XI. Then try to win every single game.</span>
                <span className="hidden lg:inline">The scoreboard nobody has filled in yet.</span>
              </h1>
              <p className="text-[15px] leading-[22px] lg:text-[18px] lg:leading-7 text-body-plate lg:max-w-[540px]">
                Spin real IPL squads from 2008 to 2025, take one player from each, and play a full
                season. Win all fourteen and the board reads 14–0.
              </p>
              <div className="hidden lg:flex items-center gap-5 pt-2">
                <PrimaryButton className="h-15 px-9 text-[18px]" onClick={() => play("classic")}>
                  Spin your first squad
                </PrimaryButton>
                <span className="text-[15px] leading-[22px] text-muted-plate whitespace-nowrap">
                  About 3 minutes. No sign-up.
                </span>
              </div>
            </div>
          </div>

          {/* Eleven slots teach the whole mechanic before anyone scrolls. */}
          <div className="hidden lg:flex flex-col gap-3 mt-11 pt-9 border-t border-plate-line">
            <div className="flex items-baseline gap-3">
              <span className="text-[15px] leading-5 font-medium text-muted-plate">A run in progress</span>
              <span className="flex-1" />
              <span className="text-[15px] leading-5 text-muted-plate">4 of 11 picked · 2 re-spins left</span>
            </div>
            <div className="flex gap-2">
              {RAIL.map((s, i) =>
                s.name ? (
                  <div
                    key={i}
                    className="flex-1 min-w-0 h-24 flex flex-col gap-1.5 p-2.5 rounded-control bg-plate border border-plate-line"
                  >
                    <span
                      className="inline-flex w-fit items-center h-5 px-1.5 pt-[2px] rounded-chip font-display font-semibold text-[14px] leading-[14px]"
                      style={{ backgroundColor: s.colour, color: s.code === "CSK" ? "#000" : "#fff" }}
                    >
                      {s.code} {s.season}
                    </span>
                    <span className="font-display font-semibold text-[24px] leading-6 pt-0.5 truncate">
                      {s.name}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[12px] leading-4 text-muted-plate">{s.role}</span>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="flex-1 min-w-0 h-24 flex flex-col justify-end p-2.5 rounded-control border border-dashed border-plate-dash"
                  >
                    <span className="text-[12px] leading-4 text-[#7A7A7A] truncate">{s.role}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile keeps the action on white, directly under the board. */}
      <section className="lg:hidden px-5 pt-4 pb-2 flex flex-col gap-2.5">
        <PrimaryButton className="w-full" onClick={() => play("classic")}>
          Spin your first squad
        </PrimaryButton>
        <p className="text-[13px] leading-[18px] text-muted text-center">About 3 minutes. No sign-up.</p>
      </section>

      {/* Mobile: two straight choices. Desktop: real runs beside the choices. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-2 lg:pt-16 pb-2 lg:pb-[72px] flex flex-col lg:flex-row gap-0 lg:gap-[72px]">
        <div className="hidden lg:flex flex-col flex-1">
          <SectionHead title="Today's best runs" note="See the full board" />
          <div className="mt-3.5">
            <BoardRows rows={rows} empty="No runs logged yet today. Be the first." />
          </div>
          <p className="text-[13px] leading-5 text-muted pt-3.5">
            The board resets at midnight IST.
          </p>
        </div>

        <div className="flex flex-col lg:w-[440px] lg:shrink-0 lg:gap-4">
          <ModeRow
            badge={
              <span className="flex flex-col items-center justify-center w-13 h-13 lg:w-[58px] lg:h-[58px] shrink-0 rounded-control bg-ink">
                <span className="text-[11px] lg:text-[12px] leading-[13px] text-muted-plate">{month}</span>
                <span className="font-display font-bold text-[30px] lg:text-[32px] leading-[26px] lg:leading-7 text-white">
                  {day}
                </span>
              </span>
            }
            title="Today's challenge"
            blurb="Everyone gets the same eleven squads. Compare your XI with the rest of the country."
            action="Play"
            deskAction="Play today's challenge"
            onClick={() => play("daily")}
            first
          />
          <ModeRow
            badge={
              <span className="flex items-center justify-center w-13 h-13 lg:w-[58px] lg:h-[58px] shrink-0 rounded-control bg-ink">
                <span className="font-display font-bold text-[26px] lg:text-[28px] leading-6 text-white">1v1</span>
              </span>
            }
            title="Play a friend"
            blurb="You both draft, then one shared league decides it. Send the invite on WhatsApp."
            action="Invite"
            deskAction="Create a room"
            onClick={() => play("classic")}
          />
        </div>
      </section>

      {/* How a run works */}
      <section className="bg-ground lg:bg-panel">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-7 lg:pt-16 pb-2 lg:pb-[72px] flex flex-col gap-4 lg:gap-7">
          <h2 className="font-semibold text-[20px] leading-[26px] lg:text-[24px] lg:leading-[30px]">
            How a run works
          </h2>
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-12">
            <Step
              n={1}
              title="Spin a squad"
              body="The board lands on a real team-season, like Mumbai Indians 2019 or Deccan Chargers 2009. There are 156 of them, every season from 2008 to 2025."
            />
            <Step
              n={2}
              title="Pick one player"
              body="From that exact season's squad, and only that one. Eleven spins, two re-spins, four overseas players at most. Legend mode hides the ratings."
            />
            <Step
              n={3}
              title="Play the season"
              body="Fourteen league games, then the playoffs, with the final played ball by ball. Top four go through. Every result reproduces from its seed."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3.5 lg:gap-[18px] flex-1 items-start">
      <span className="w-9 lg:w-[46px] shrink-0 font-display font-bold text-[40px] leading-[34px] lg:text-[58px] lg:leading-[46px]">
        {n}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-[16px] leading-[22px] lg:text-[18px] lg:leading-6">{title}</span>
        <span className="text-[14px] leading-5 lg:text-[15px] lg:leading-6 text-muted">{body}</span>
      </span>
    </div>
  );
}

function ModeRow({
  badge,
  title,
  blurb,
  action,
  deskAction,
  onClick,
  first,
}: {
  badge: React.ReactNode;
  title: string;
  blurb: string;
  action: string;
  deskAction: string;
  onClick: () => void;
  first?: boolean;
}) {
  return (
    <>
      {/* mobile: a straight row with a hairline */}
      <button
        onClick={onClick}
        className={`lg:hidden flex items-center gap-3.5 py-4 text-left border-hairline ${
          first ? "border-t border-b" : "border-b"
        }`}
      >
        {badge}
        <span className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="font-semibold text-[17px] leading-[22px]">{title}</span>
          <span className="text-[14px] leading-5 text-muted">{blurb}</span>
        </span>
        <span className="flex items-center justify-center h-10 px-4 shrink-0 rounded-control border-[1.5px] border-ink font-semibold text-[15px]">
          {action}
        </span>
      </button>

      {/* desktop: a card with a full-width action */}
      <div className="hidden lg:flex flex-col gap-4 p-6 rounded-control border border-[#D4D4D4]">
        <div className="flex items-center gap-4">
          {badge}
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="font-semibold text-[18px] leading-6">{title}</span>
            <span className="text-[15px] leading-[22px] text-muted">{blurb}</span>
          </div>
        </div>
        <OutlineButton onClick={onClick} className="w-full text-[16px]">
          {deskAction}
        </OutlineButton>
      </div>
    </>
  );
}

/* ----------------------------------------------------------- leaderboard */

type Row = {
  seed: string;
  wins: number;
  losses: number;
  nrr: number;
  difficulty: string;
  champion?: boolean;
  perfect14?: boolean;
  madePlayoffs?: boolean;
  deviceId: string;
};

function Leaderboard({
  today,
  daily,
  allTime,
}: {
  today: string;
  daily: Row[] | undefined;
  allTime: Row[] | undefined;
}) {
  const [tab, setTab] = useState<"daily" | "all">("daily");
  const rows = tab === "daily" ? daily : allTime;
  return (
    <div className="mx-auto w-full max-w-[900px] px-5 lg:px-16 pt-4 lg:pt-8 pb-10">
      <h1 className="font-semibold text-[26px] leading-8 lg:text-[32px] lg:leading-10">Leaderboard</h1>
      <p className="text-[15px] leading-[22px] text-muted mt-1">
        Best seasons by anyone, anywhere. Tap a row to replay the exact run.
      </p>

      <div className="flex gap-2 mt-4">
        {(["daily", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 h-10 rounded-control font-semibold text-[15px] transition-colors ${
              tab === t ? "bg-ink text-white" : "border border-[#D4D4D4] text-ink hover:bg-panel"
            }`}
          >
            {t === "daily" ? "Today's challenge" : "All time"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <BoardRows
          rows={rows}
          empty={tab === "daily" ? "No runs logged yet today. Be the first." : "No seasons logged yet."}
        />
      </div>
      <p className="text-[13px] leading-5 text-muted pt-3">
        {tab === "daily" ? `Today is ${today}. The board resets at midnight IST.` : "Every run is verifiable from its seed."}
      </p>
    </div>
  );
}

function managerName(deviceId: string): string {
  return `Manager ${deviceId.slice(0, 4).toUpperCase()}`;
}

function outcome(r: Row): string {
  if (r.champion) return "champions";
  if (r.madePlayoffs) return "made the playoffs";
  return "missed the playoffs";
}

function BoardRows({ rows, empty }: { rows: Row[] | undefined; empty: string }) {
  if (rows === undefined) return <p className="text-[15px] text-muted py-4">Loading the board…</p>;
  if (!rows.length) return <p className="text-[15px] text-muted py-4">{empty}</p>;
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <a
          key={r.seed}
          href={`/r/${r.seed}`}
          className={`flex items-center gap-3 lg:gap-4 h-[62px] border-t border-hairline hover:bg-panel transition-colors ${
            i === rows.length - 1 ? "border-b" : ""
          }`}
        >
          <span className="w-7 lg:w-[30px] shrink-0 font-display font-semibold text-[24px] leading-[22px] pt-[3px]">
            {i + 1}
          </span>
          <span className="flex flex-col flex-1 min-w-0">
            <span className="font-medium text-[16px] leading-[22px] truncate">{managerName(r.deviceId)}</span>
            <span className="text-[13px] leading-[18px] text-muted truncate">
              {r.difficulty} · {outcome(r)} · net run rate {r.nrr > 0 ? "+" : ""}
              {r.nrr}
            </span>
          </span>
          {r.perfect14 && (
            <span className="hidden sm:inline-flex items-center h-6 px-2 pt-[2px] shrink-0 rounded bg-trophy font-display font-semibold text-[16px] leading-4 text-ink">
              PERFECT
            </span>
          )}
          <span className="w-[62px] shrink-0 text-right font-display font-bold text-[30px] leading-7 pt-[3px] tabular">
            {r.wins}–{r.losses}
          </span>
        </a>
      ))}
    </div>
  );
}
