"use client";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { GameBoard } from "@/components/GameBoard";
import { istDateKey, type PlayerSeason, type TeamSeason } from "@/lib/game/types";
import { buildPlayerSeasons, buildTeamSeasons } from "@/lib/game/data";
import {
  Card,
  Chevron,
  Eyebrow,
  Flap,
  PageBand,
  PlayerBurstCard,
  PrimaryButton,
  SectionHead,
  StatCell,
  StatStrip,
  StripeBand,
  Wordmark,
  splitName,
} from "@/components/ui";
import { QuietBoundary } from "@/components/QuietBoundary";
import { useT, useLang, LangToggle, type T } from "@/lib/i18n";

type Screen = "home" | "game" | "board";

/* The player and squad tables already ship to the client for the draft, so the
   home page resolves the day's pick counts locally instead of asking the
   backend for names it already has. */
const PLAYER_BY_ID = new Map(buildPlayerSeasons().map((p) => [p.id, p]));
const TEAM_BY_ID = new Map(buildTeamSeasons().map((t) => [t.teamId, t]));

/* Shaped by the query itself, so the page cannot drift from the backend. */
type TodayStats = FunctionReturnType<typeof api.stats.homeToday>;

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

  // The board screen's first tab is the shared daily challenge. The home page
  // shows the whole day, so it lines up with the day's numbers beside it.
  const dailyBoard = useQuery(
    api.results.leaderboard,
    show === "board" ? { dailyDate: today, limit: 20 } : "skip"
  );
  const todayBoard = useQuery(
    api.results.leaderboard,
    show === "home" ? { day: today, limit: 10 } : "skip"
  );
  const allTimeBoard = useQuery(
    api.results.leaderboard,
    show === "board" ? { limit: 20 } : "skip"
  );
  const play = (m: "classic" | "daily") => {
    setMode(m);
    setGameKey((k) => k + 1);
    setScreen("game");
  };

  return (
    <main className="min-h-screen bg-ground text-white flex flex-col">
      <TopBar screen={show} go={setScreen} inGame={entered === "game"} />

      {show === "home" && (
        <HomeScreen
          today={today}
          play={play}
          rows={todayBoard as Row[] | undefined}
          goBoard={() => setScreen("board")}
        />
      )}

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
  const t = useT();
  const link = "text-[15px] leading-5 font-medium text-white/80 hover:text-accent transition-colors";
  return (
    <header className="bg-band">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 h-[60px] lg:h-[72px] flex items-center gap-3 lg:gap-5">
        <button onClick={() => !inGame && go("home")} className="flex items-baseline gap-3 min-w-0">
          <Wordmark className="text-[30px] lg:text-[34px]" />
          <span className="hidden sm:block text-[13px] lg:text-[14px] leading-[18px] text-white/70 truncate">
            {t("app.tagline")}
          </span>
        </button>
        <span className="flex-1" />
        <nav className="hidden lg:flex items-center gap-7">
          <button className={link} onClick={() => go("home")}>{t("nav.howItWorks")}</button>
          <button
            className={`${link} ${screen === "board" ? "text-accent" : ""}`}
            onClick={() => go("board")}
          >
            {t("nav.leaderboard")}
          </button>
          <button className={link} onClick={() => go("game")}>{t("nav.playAFriend")}</button>
        </nav>
        <button
          onClick={() => go("board")}
          className="lg:hidden text-[14px] font-semibold px-3.5 h-9 flex items-center rounded-full bg-white/12 hover:bg-white/20 transition-colors"
        >
          {t("nav.board")}
        </button>
        <LangToggle className="w-11 h-9 lg:w-[46px] lg:h-[34px] text-[14px]" />
      </div>
    </header>
  );
}

function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-8 lg:py-10 flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-10">
        <p className="flex-1 max-w-[720px] text-[13px] leading-5 text-faint">
          {t("footer.legal")}
        </p>
        <p className="text-[13px] lg:text-[14px] leading-5 font-medium text-accent">
          {t("footer.links")}
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ home */

function HomeScreen({
  today,
  play,
  rows,
  goBoard,
}: {
  today: string;
  play: (m: "classic" | "daily") => void;
  rows: Row[] | undefined;
  goBoard: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const day = today.slice(8);
  const month = new Date(`${today}T00:00:00Z`)
    .toLocaleString(lang === "hi" ? "hi-IN" : "en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase();

  return (
    <>
      <StripeBand height={56} className="hidden lg:block" />
      <StripeBand height={44} className="lg:hidden" />

      {/* The board is the hero. On desktop it sits inside a night card. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-6 lg:pt-8">
        <div className="lg:bg-surface lg:rounded-card lg:px-14 lg:py-12 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-16">
          <div className="flex flex-col gap-4 lg:gap-5 lg:flex-1 lg:order-1 order-2">
            <Eyebrow className="hidden lg:block">{t("app.tagline")}</Eyebrow>
            <h1 className="head-display text-[46px] leading-[42px] lg:text-[76px] lg:leading-[68px]">
              <span className="lg:hidden">{t("home.headline.mobile")}</span>
              <span className="hidden lg:inline">{t("home.headline.desktop")}</span>
            </h1>
            <p className="text-[15px] leading-[22px] lg:text-[18px] lg:leading-7 text-muted lg:max-w-[540px]">
              {t("home.sub")}
            </p>
            <div className="hidden lg:flex items-center gap-5 pt-2">
              <PrimaryButton className="h-14 px-9 text-[17px]" onClick={() => play("classic")}>
                {t("home.cta")}
              </PrimaryButton>
              <span className="text-[15px] leading-[22px] text-muted whitespace-nowrap">
                {t("home.ctaNote")}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:shrink-0 lg:order-2 order-1">
            <div className="hidden lg:flex items-baseline justify-between">
              <Eyebrow tone="muted">{t("home.target")}</Eyebrow>
              <span className="text-[13px] leading-4 text-muted">{t("home.targetNote")}</span>
            </div>
            <div className="flex gap-3 lg:gap-3.5">
              <Flap
                label={t("word.won")}
                value="14"
                wrapClassName="flex-1 lg:flex-none lg:w-[210px]"
                className="h-[132px] lg:h-[230px]"
                valueClassName="text-[128px] leading-[110px] lg:text-[190px] lg:leading-[164px]"
              />
              <Flap
                label={t("word.lost")}
                value="0"
                wrapClassName="flex-1 lg:flex-none lg:w-[210px]"
                className="h-[132px] lg:h-[230px]"
                valueClassName="text-[128px] leading-[110px] lg:text-[190px] lg:leading-[164px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile keeps the action directly under the board. */}
      <section className="lg:hidden px-5 pt-5 pb-1 flex flex-col gap-2.5">
        <PrimaryButton className="w-full" onClick={() => play("classic")}>
          {t("home.cta")}
        </PrimaryButton>
        <p className="text-[13px] leading-[18px] text-muted text-center">{t("home.ctaNote")}</p>
      </section>

      {/* Two ways in, then the day's numbers. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-5 lg:pt-14 flex flex-col lg:flex-row gap-3 lg:gap-6">
        <ModeCard
          eyebrow={t("home.daily.title")}
          title={t("home.daily.blurb")}
          note={`${month} ${day} · ${t("home.resetNote")}`}
          onClick={() => play("daily")}
        />
        <ModeCard
          eyebrow={t("home.friend.title")}
          title={t("home.friend.blurb")}
          note={t("home.friend.actionLong")}
          onClick={() => play("classic")}
        />
      </section>

      <QuietBoundary>
        <TodaySections today={today} goBoard={goBoard} />
      </QuietBoundary>

      {/* Today's best runs, straight off the board. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-9 lg:pt-14 flex flex-col gap-3.5">
        <SectionHead title={t("home.bestRuns")} note={<button onClick={goBoard} className="text-accent font-semibold hover:underline">{t("home.seeFullBoard")}</button>} />
        <BoardRows rows={rows} empty={t("board.empty.daily")} />
      </section>

      {/* How a run works */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-10 lg:pt-16 pb-4 flex flex-col gap-4 lg:gap-7">
        <SectionHead title={t("home.steps.title")} />
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-12">
          <Step n={1} title={t("home.step1.title")} body={t("home.step1.body")} />
          <Step n={2} title={t("home.step2.title")} body={t("home.step2.body")} />
          <Step n={3} title={t("home.step3.title")} body={t("home.step3.body")} />
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------- today's board */

/** Reads the day's numbers. Lives below QuietBoundary so a backend without
    this query yet costs these two sections and nothing else. */
function TodaySections({ today, goBoard }: { today: string; goBoard: () => void }) {
  const stats = useQuery(api.stats.homeToday, { date: today });
  return (
    <>
      <TodayNumbers stats={stats} goBoard={goBoard} />
      <MostPickedToday stats={stats} />
    </>
  );
}

function pct(count: number, of: number): number {
  if (!of) return 0;
  return Math.round((count / of) * 100);
}

/** The day's numbers, read straight out of what people actually played. */
function TodayNumbers({ stats, goBoard }: { stats: TodayStats | undefined; goBoard: () => void }) {
  const t = useT();

  const mostPicked = stats?.topPicks[0];
  const mostPickedPlayer = mostPicked ? PLAYER_BY_ID.get(mostPicked.id) : undefined;
  const topBowlerPick = stats?.topPicks.find((p) => {
    const player = PLAYER_BY_ID.get(p.id);
    return player?.role === "Pace" || player?.role === "Spin";
  });
  const topBowler = topBowlerPick ? PLAYER_BY_ID.get(topBowlerPick.id) : undefined;
  const topSquad = stats?.topSquad ? TEAM_BY_ID.get(stats.topSquad.teamId) : undefined;

  const none = t("stat.none");
  const surname = (p?: PlayerSeason) => (p ? splitName(p.player).last.toUpperCase() : none);

  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-9 lg:pt-14 flex flex-col gap-3.5">
      <SectionHead
        title={t("home.todayNumbers")}
        note={
          <button onClick={goBoard} className="text-accent font-semibold hover:underline">
            {t("nav.leaderboard")}
          </button>
        }
      />

      {stats === undefined ? (
        <p className="text-[15px] text-muted py-4">{t("home.statsLoading")}</p>
      ) : (
        <>
          {/* Mobile: one strip of four. */}
          <StatStrip className="lg:hidden">
            <StatCell label={t("stat.played")} value={stats.runs.toLocaleString("en-IN")} />
            <StatCell label={t("stat.perfect")} value={stats.perfect14} tone="good" />
            <StatCell label={t("stat.mostPicked")} value={surname(mostPickedPlayer)} />
            <StatCell
              label={t("stat.bestToday")}
              value={stats.best ? `${stats.best.wins}–${stats.best.losses}` : none}
            />
          </StatStrip>

          {/* Desktop: three cards, each with its own three numbers. */}
          <div className="hidden lg:flex gap-5">
            <StatCardGroup title={t("home.card.runs")} note={t("home.sinceMidnight")}>
              <StatCell label={t("stat.played")} value={stats.runs.toLocaleString("en-IN")} />
              <StatCell label={t("stat.perfect")} value={stats.perfect14} tone="good" />
              <StatCell label={t("stat.onTheBoard")} value={stats.drafting} tone="accent" />
            </StatCardGroup>
            <StatCardGroup title={t("home.card.picks")} note={t("home.acrossRuns")}>
              <StatCell label={t("stat.mostPicked")} value={surname(mostPickedPlayer)} />
              <StatCell label={t("stat.topBowler")} value={surname(topBowler)} />
              <StatCell
                label={t("stat.topSquad")}
                value={topSquad ? `${topSquad.code} ${topSquad.season}` : none}
              />
            </StatCardGroup>
            <StatCardGroup title={t("home.card.records")} note={t("home.todayOnly")}>
              <StatCell
                label={t("stat.bestToday")}
                value={stats.best ? `${stats.best.wins}–${stats.best.losses}` : none}
              />
              <StatCell
                label={t("stat.bestNrr")}
                value={stats.bestNrr === null ? none : `${stats.bestNrr > 0 ? "+" : ""}${stats.bestNrr}`}
              />
              <StatCell label={t("stat.champions")} value={stats.champions} tone="trophy" />
            </StatCardGroup>
          </div>
        </>
      )}
    </section>
  );
}

function StatCardGroup({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-6 pt-5 pb-3.5">
        <span className="head-display text-[26px] leading-[26px]">{title}</span>
        <span className="text-[13px] leading-4 text-muted">{note}</span>
      </div>
      <div className="flex border-t border-hairline">{children}</div>
    </Card>
  );
}

/** The names people keep taking, on a burst of their own franchise colour. */
function MostPickedToday({ stats }: { stats: TodayStats | undefined }) {
  const t = useT();
  if (stats === undefined) return null;

  const cards = stats.topPicks
    .map((row) => ({ row, player: PLAYER_BY_ID.get(row.id) }))
    .filter((c): c is { row: { id: string; count: number }; player: PlayerSeason } => !!c.player)
    .slice(0, 6);

  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-9 lg:pt-14 flex flex-col gap-3.5">
      <SectionHead title={t("home.mostPicked")} note={t("home.mostPickedNote")} />
      {cards.length === 0 ? (
        <p className="text-[15px] leading-[22px] text-muted py-3 max-w-[60ch]">
          {t("home.noPicksYet")}
        </p>
      ) : (
        <div className="-mx-5 lg:mx-0 px-5 lg:px-0 flex gap-3 lg:gap-4 overflow-x-auto lg:overflow-visible">
          {cards.map(({ row, player }) => (
            <PickCard
              key={row.id}
              player={player}
              share={pct(row.count, stats.drafts)}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PickCard({ player, share, t }: { player: PlayerSeason; share: number; t: T }) {
  const team: TeamSeason | undefined = TEAM_BY_ID.get(player.teamId);
  const { first, last } = splitName(player.player);
  const bowler = player.role === "Pace" || player.role === "Spin";
  const allRounder = player.role === "AR";

  const stats = allRounder
    ? [
        { label: t("report.runs"), value: player.runs },
        { label: t("report.wickets"), value: player.wickets },
        { label: t("report.rating"), value: player.overall },
      ]
    : bowler
      ? [
          { label: t("report.wickets"), value: player.wickets },
          { label: t("xi.econ"), value: player.econ.toFixed(1) },
          { label: t("report.rating"), value: player.overall },
        ]
      : [
          { label: t("report.runs"), value: player.runs },
          { label: t("xi.sr"), value: Math.round(player.sr) },
          { label: t("report.rating"), value: player.overall },
        ];

  return (
    <PlayerBurstCard
      first={first}
      last={last.toUpperCase()}
      chip={team ? `${team.code} ${team.season}` : String(player.season)}
      colour={team?.colour ?? "#10215C"}
      stats={stats}
      footnote={share > 0 ? t("home.pickedIn", { pct: share }) : undefined}
      className="w-[190px] lg:w-auto lg:flex-1 shrink-0"
    />
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3.5 lg:gap-[18px] flex-1 items-start">
      <span className="flex items-center justify-center w-10 h-10 lg:w-11 lg:h-11 shrink-0 rounded-plate bg-plate border border-plate-line font-display font-bold text-[26px] leading-none pt-1.5">
        {n}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-[16px] leading-[22px] lg:text-[18px] lg:leading-6">{title}</span>
        <span className="text-[14px] leading-5 lg:text-[15px] lg:leading-6 text-muted">{body}</span>
      </span>
    </div>
  );
}

function ModeCard({
  eyebrow,
  title,
  note,
  onClick,
}: {
  eyebrow: string;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center gap-4 text-left p-4 lg:p-5 bg-surface rounded-card hover:bg-[#15296d] transition-colors"
    >
      <span className="flex flex-col gap-1 flex-1 min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <span className="font-semibold text-[16px] leading-[21px] lg:text-[17px] lg:leading-[22px]">
          {title}
        </span>
        <span className="text-[13px] leading-[18px] text-muted">{note}</span>
      </span>
      <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-white/10 text-white">
        <Chevron />
      </span>
    </button>
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
  const t = useT();
  const [tab, setTab] = useState<"daily" | "all">("daily");
  const rows = tab === "daily" ? daily : allTime;
  return (
    <>
      <PageBand eyebrow={t("board.sub")} title={t("board.title")} />
      <div className="mx-auto w-full max-w-[900px] px-5 lg:px-16 pt-5 lg:pt-8 pb-10">
        <div className="flex gap-1 p-1 rounded-full bg-surface">
          {(["daily", "all"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 h-10 rounded-full font-semibold text-[15px] transition-colors ${
                tab === tabKey ? "bg-accent text-ground" : "text-white hover:bg-white/8"
              }`}
            >
              {tabKey === "daily" ? t("board.tab.daily") : t("board.tab.allTime")}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <BoardRows
            rows={rows}
            empty={tab === "daily" ? t("board.empty.daily") : t("board.empty.allTime")}
          />
        </div>
        <p className="text-[13px] leading-5 text-muted pt-3">
          {tab === "daily" ? t("board.todayNote", { date: today }) : t("board.seedNote")}
        </p>
      </div>
    </>
  );
}

function outcomeKey(r: Row): string {
  if (r.champion) return "outcome.champions";
  if (r.madePlayoffs) return "outcome.madePlayoffs";
  return "outcome.missedPlayoffs";
}

function BoardRows({ rows, empty }: { rows: Row[] | undefined; empty: string }) {
  const t = useT();
  if (rows === undefined) return <p className="text-[15px] text-muted py-4">{t("board.loading")}</p>;
  if (!rows.length) return <p className="text-[15px] text-muted py-4">{empty}</p>;
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <a
          key={r.seed}
          href={`/r/${r.seed}`}
          className={`flex items-center gap-3 lg:gap-4 h-[62px] border-t border-hairline hover:bg-white/5 transition-colors ${
            i === rows.length - 1 ? "border-b" : ""
          }`}
        >
          <span
            className={`flex items-center justify-center w-9 h-9 shrink-0 rounded-plate font-display font-bold text-[22px] leading-none pt-1 tabular ${
              i === 0 ? "bg-trophy text-ground" : "bg-plate border border-plate-line text-white"
            }`}
          >
            {i + 1}
          </span>
          <span className="flex flex-col flex-1 min-w-0">
            <span className="font-medium text-[16px] leading-[22px] truncate">
              {t("board.manager", { id: r.deviceId.slice(0, 4).toUpperCase() })}
            </span>
            <span className="text-[13px] leading-[18px] text-muted truncate">
              {t("board.rowMeta", {
                difficulty: t(`difficulty.${r.difficulty}`),
                outcome: t(outcomeKey(r)),
                nrr: `${r.nrr > 0 ? "+" : ""}${r.nrr}`,
              })}
            </span>
          </span>
          {r.perfect14 && (
            <span className="hidden sm:inline-flex items-center h-6 px-2 pt-[2px] shrink-0 rounded-chip bg-trophy font-display font-semibold text-[16px] leading-4 text-ground">
              {t("board.perfect")}
            </span>
          )}
          <span
            className={`w-[62px] shrink-0 text-right font-display font-bold text-[30px] leading-7 pt-[3px] tabular ${
              r.perfect14 ? "text-trophy" : ""
            }`}
          >
            {r.wins}–{r.losses}
          </span>
        </a>
      ))}
    </div>
  );
}
