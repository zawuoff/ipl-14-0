"use client";
import { useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { GameBoard } from "@/components/GameBoard";
import { type PlayerSeason, type TeamSeason } from "@/lib/game/types";
import { useIstDay, useIstDayLabel } from "@/lib/day";
import { useBackendUnreachable } from "@/lib/backend";
import { deviceId } from "@/lib/device";
import {
  ASKED_AGAIN_KEY,
  GiftPrompt,
  alreadyAsked,
  markAsked,
  markChecked,
  worthChecking,
} from "@/components/GiftPrompt";
import { buildPlayerSeasons, buildTeamSeasons } from "@/lib/game/data";
import {
  Card,
  Chevron,
  Eyebrow,
  Flap,
  Logo,
  PlayerBurstCard,
  PrimaryButton,
  OutlineButton,
  SectionHead,
  StatCell,
  StatStrip,
  StripeBand,
  splitName,
  IconButton,
  SoundIcon,
  TrophyIcon,
} from "@/components/ui";
import { QuietBoundary } from "@/components/QuietBoundary";
import { ChromeProvider, useChrome } from "@/components/Chrome";
import { useMuted } from "@/lib/sound";
import { useT, useLang, LangToggle, type T } from "@/lib/i18n";
import { analytics } from "@/lib/analytics";
import { useShareOpened } from "@/lib/share";
import Link from "next/link";
import { BoardRows, type Row } from "@/components/Leaderboard";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { PAGES, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

type Screen = "home" | "game";

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
  const [intent, setIntent] = useState<"solo" | "friend">("solo");
  const [gameKey, setGameKey] = useState(0);
  const today = useIstDay();

  /* A challenge link carries the eleven squads in its address, and anything
     other than eleven of them cannot be played. That used to fail in silence:
     the visitor landed on the home page as though they had typed it in, and
     nothing was recorded, so a link clipped by whatever it was pasted into
     looked exactly like a link nobody ever sent. */
  const challengeParts = useMemo(() => {
    if (typeof window === "undefined") return null;
    const c = new URLSearchParams(window.location.search).get("challenge");
    if (!c) return null;
    return c.split(",").map((s) => s.trim()).filter(Boolean);
  }, []);
  const challengeSpins = challengeParts?.length === 11 ? challengeParts : undefined;
  const challengeBroken =
    challengeParts && challengeParts.length !== 11 ? challengeParts.length : null;

  // Reported from an effect rather than the memo above: a memo runs during
  // render, which is no place to send anything.
  useEffect(() => {
    if (challengeBroken === null) return;
    analytics.challengeLinkBroken(challengeBroken);
  }, [challengeBroken]);
  const roomCode = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const c = new URLSearchParams(window.location.search).get("room");
    return c ? c.toUpperCase() : undefined;
  }, []);

  // A board someone was dared to beat: the same arrival as a shared result,
  // one door further in.
  useShareOpened(challengeSpins ? "challenge" : null);

  // deep links jump straight into the game
  const initialScreen: Screen = challengeSpins || roomCode ? "game" : "home";
  const [entered] = useState(initialScreen);
  const show: Screen = entered === "game" ? "game" : screen;

  // The top ten of the day, beside the day's numbers. The full board has its
  // own page at /leaderboard.
  const todayBoard = useQuery(
    api.results.leaderboard,
    show === "home" ? { day: today, limit: 10 } : "skip"
  );
  const play = (m: "classic" | "daily", how: "solo" | "friend" = "solo") => {
    setMode(m);
    setIntent(how);
    setGameKey((k) => k + 1);
    setScreen("game");
  };

  /* /?play=daily and /?play=multiplayer open the game straight onto that mode,
     from a link, a new tab or the footer. Read once, after hydration, so the
     prerendered home page is what the server and the first client render agree
     on. A challenge or room link has already claimed the screen and wins. */
  useEffect(() => {
    if (entered === "game") return;
    const q = new URLSearchParams(window.location.search);
    const how = q.get("play");
    // The address does not exist while this prerenders, so it waits for mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (how === "daily") {
      play("daily");
    } else if (how === "multiplayer") {
      play("classic", "friend");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Once, on arrival: later clicks move between screens themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ChromeProvider>
    <main className="min-h-screen bg-ground text-white flex flex-col">
      <StructuredData faq={show === "home"} />
      <TopBar go={setScreen} inGame={entered === "game"} />

      {show === "home" && (
        <HomeScreen
          today={today}
          play={play}
          rows={todayBoard as Row[] | undefined}
        />
      )}

      {/* Somebody who went unbeaten and closed the card prompt without filling
          it in gets asked once more, here, and then never again. */}
      {show === "home" && <UnclaimedGift />}

      {show === "game" && (
        <GameBoard
          key={gameKey}
          initialMode={challengeSpins ? "classic" : mode}
          initialSpins={challengeSpins}
          initialRoom={roomCode}
          initialIntent={intent}
        />
      )}

      <SiteFooter />
    </main>
    </ChromeProvider>
  );
}

/* ---------------------------------------------------------------- chrome */

function TopBar({
  go,
  inGame,
}: {
  go: (s: Screen) => void;
  inGame: boolean;
}) {
  const t = useT();
  const { run } = useChrome();
  const [muted, toggleMuted] = useMuted();
  const [confirmRestart, setConfirmRestart] = useState(false);

  // A restart throws the board away, and the control is now an icon, so it asks
  // once. The question withdraws itself rather than sitting there armed.
  useEffect(() => {
    if (!confirmRestart) return;
    const id = window.setTimeout(() => setConfirmRestart(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmRestart]);

  /* The drawn design centres the wordmark and balances it: navigation on one
     side, one action on the other. Three chips crowded down the right-hand end
     was never the shape of it. The four pages only fit beside the wordmark on
     a wide screen; below that the trophy stands in for the leaderboard and the
     footer carries the rest, so the game keeps its one bar on a phone. */
  return (
    <header className="bg-band">
      <div className="relative mx-auto w-full max-w-[1440px] px-3 lg:px-10 h-[56px] lg:h-[72px] flex items-center">
        <div className="flex items-center gap-1 lg:gap-7 min-w-0">
          <SiteNav className="hidden xl:flex" />
          <IconButton
            onClick={toggleMuted}
            label={muted ? t("run.soundOff") : t("run.soundOn")}
            className="w-10 lg:hidden"
          >
            <SoundIcon on={!muted} />
          </IconButton>
          <LangToggle plain className="lg:hidden w-10 h-9 text-[13px]" />
        </div>

        {/* Already on the home route, so a click only has to bring the home
            screen back; the address is still there for everything else. */}
        <Link
          href="/"
          onClick={(e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (!inGame) go("home");
          }}
          aria-label="BuildXI home"
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"
        >
          <Logo className="text-[30px] lg:text-[40px]" />
        </Link>

        <span className="flex-1" />
        <div className="shrink-0 flex items-center gap-1 lg:gap-3">
          <IconButton
            onClick={toggleMuted}
            label={muted ? t("run.soundOff") : t("run.soundOn")}
            className="hidden lg:flex w-10"
          >
            <SoundIcon on={!muted} />
          </IconButton>
          <LangToggle className="hidden lg:flex w-[46px] h-[34px] text-[14px]" />
          {run ? (
            <button
              onClick={() => {
                if (!confirmRestart) {
                  setConfirmRestart(true);
                  return;
                }
                setConfirmRestart(false);
                run.onRestart();
              }}
              className={`shrink-0 h-[34px] px-3.5 flex items-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                confirmRestart ? "bg-loss text-white" : "bg-white/12 text-white hover:bg-white/20"
              }`}
            >
              {confirmRestart ? t("run.restartSure") : t("run.restartShort")}
            </button>
          ) : (
            /* A wide screen already has the leaderboard in the nav. */
            <Link
              href={PAGES.leaderboard}
              aria-label={t("nav.leaderboard")}
              title={t("nav.leaderboard")}
              className="xl:hidden shrink-0 w-10 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
            >
              <TrophyIcon />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/* The three questions the page answers out loud, named once. The visible block
   and the FAQ structured data both read these keys, so the two cannot drift. */
const HOME_FAQ = [
  { q: "home.faq.q1", a: "home.faq.a1" },
  { q: "home.faq.q2", a: "home.faq.a2" },
  { q: "home.faq.q3", a: "home.faq.a3" },
] as const;

function HomeFaq() {
  const t = useT();
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-10 lg:pt-16 pb-4 flex flex-col gap-4 lg:gap-7">
      <SectionHead
        title={t("home.faq.title")}
        note={
          <Link href={PAGES.howItWorks} className="text-accent font-semibold hover:underline">
            {t("home.faq.more")}
          </Link>
        }
      />
      <div className="flex flex-col lg:max-w-[900px]">
        {HOME_FAQ.map(({ q, a }, i) => (
          <div
            key={q}
            className={`py-4 flex flex-col gap-1.5 ${i ? "border-t border-hairline" : ""}`}
          >
            <h3 className="font-semibold text-[17px] leading-6">{t(q)}</h3>
            <p className="text-[16px] leading-[26px] text-muted">{t(a)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* What the site is, for search engines and answer engines, in schema.org
   terms. The fuller set of questions lives on /how-it-works; the three here
   are the ones the home page itself answers, and they are only declared while
   that block is on screen. */
function StructuredData({ faq }: { faq: boolean }) {
  const t = useT();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "BuildXI",
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon.png`, width: 180, height: 180 },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: "BuildXI",
        alternateName: ["Build XI", "BuildXI IPL draft game"],
        description: SITE_DESCRIPTION,
        inLanguage: ["en-IN", "hi-IN"],
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": ["VideoGame", "WebApplication"],
        "@id": `${SITE_URL}/#game`,
        name: "BuildXI",
        url: `${SITE_URL}/`,
        description: SITE_DESCRIPTION,
        image: `${SITE_URL}/opengraph-image.png`,
        genre: ["Sports", "Cricket", "Strategy"],
        gamePlatform: "Web browser",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        playMode: ["SinglePlayer", "MultiPlayer"],
        inLanguage: ["en-IN", "hi-IN"],
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        about: {
          "@type": "SportsOrganization",
          name: "Indian Premier League",
          sameAs: "https://en.wikipedia.org/wiki/Indian_Premier_League",
        },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      ...(faq
        ? [
            {
              "@type": "FAQPage",
              "@id": `${SITE_URL}/#faq`,
              inLanguage: "en-IN",
              isPartOf: { "@id": `${SITE_URL}/#website` },
              mainEntity: HOME_FAQ.map(({ q, a }) => ({
                "@type": "Question",
                name: t(q),
                acceptedAnswer: { "@type": "Answer", text: t(a) },
              })),
            },
          ]
        : []),
    ],
  };
  return (
    <script
      type="application/ld+json"
      // Escaped so no string in it can close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}

/* ------------------------------------------------------------------ home */

function HomeScreen({
  today,
  play,
  rows,
}: {
  today: string;
  play: (m: "classic" | "daily", how?: "solo" | "friend") => void;
  rows: Row[] | undefined;
}) {
  const t = useT();
  const { lang } = useLang();
  // The date reaches the markup here, so it comes from the label hook: this
  // page is prerendered, and rendering the render-time guess put the build
  // date into the static HTML.
  const shownDay = useIstDayLabel(today);
  const day = shownDay.slice(8);
  const month = shownDay
    ? new Date(`${shownDay}T00:00:00Z`)
        .toLocaleString(lang === "hi" ? "hi-IN" : "en-GB", { month: "short", timeZone: "UTC" })
        .toUpperCase()
    : "";

  return (
    <>
      <StripeBand />

      {/* The board is the hero. On desktop it sits inside a night card. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-6 lg:pt-8">
        <div className="lg:bg-surface lg:rounded-card lg:px-14 lg:py-12 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-16">
          <div className="flex flex-col gap-4 lg:gap-5 lg:flex-1 lg:order-1 order-2">
            <Eyebrow className="hidden lg:block">{t("app.tagline")}</Eyebrow>
            <h1 className="head-display text-[46px] leading-[42px] lg:text-[76px] lg:leading-[68px]">
              {t("home.headline")}
            </h1>
            <p className="text-[15px] leading-[22px] lg:text-[18px] lg:leading-7 text-muted lg:max-w-[540px]">
              {t("home.sub")}
            </p>
            <div className="hidden lg:flex items-center gap-4 pt-2">
              <PrimaryButton className="h-14 px-10 text-[17px]" onClick={() => play("classic")}>
                {t("home.cta")}
              </PrimaryButton>
              <OutlineButton className="h-14 px-7 text-[17px]" onClick={() => play("classic", "friend")}>
                {t("home.multiplayer")}
              </OutlineButton>
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
        <div className="flex gap-2.5">
          <PrimaryButton className="flex-1" onClick={() => play("classic")}>
            {t("home.cta")}
          </PrimaryButton>
          <OutlineButton className="flex-1" onClick={() => play("classic", "friend")}>
            {t("home.multiplayer")}
          </OutlineButton>
        </div>
        <p className="text-[13px] leading-[18px] text-muted text-center">{t("home.ctaNote")}</p>
      </section>

      {/* Two ways in, then the day's numbers. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-5 lg:pt-14 flex flex-col lg:flex-row gap-3 lg:gap-6">
        <ModeCard
          eyebrow={t("home.daily.title")}
          title={t("home.daily.blurb")}
          note={shownDay ? `${month} ${day} · ${t("home.resetNote")}` : t("home.resetNote")}
          onClick={() => play("daily")}
        />
        <ModeCard
          eyebrow={t("home.friend.title")}
          title={t("home.friend.blurb")}
          note={t("home.friend.actionLong")}
          onClick={() => play("classic", "friend")}
        />
      </section>

      <QuietBoundary>
        <TodaySections today={today} />
      </QuietBoundary>

      {/* Today's best runs, straight off the board. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-9 lg:pt-14 flex flex-col gap-3.5">
        <SectionHead
          title={t("home.bestRuns")}
          note={
            <>
              <Link href={PAGES.leaderboard} className="text-accent font-semibold hover:underline">{t("home.seeFullBoard")}</Link>
              <span className="text-faint"> · </span>
              <Link href={`${PAGES.leaderboard}?tab=all`} className="text-accent font-semibold hover:underline">{t("board.tab.allTime")}</Link>
            </>
          }
        />
        <BoardRows rows={rows} empty={t("board.empty.today")} />
      </section>

      {/* How a run works, in three steps. The whole of it is at /how-it-works. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-10 lg:pt-16 pb-4 flex flex-col gap-4 lg:gap-7">
        <SectionHead
          title={t("home.steps.title")}
          note={
            <Link href={PAGES.howItWorks} className="text-accent font-semibold hover:underline">
              {t("home.steps.more")}
            </Link>
          }
        />
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-12">
          <Step n={1} title={t("home.step1.title")} body={t("home.step1.body")} />
          <Step n={2} title={t("home.step2.title")} body={t("home.step2.body")} />
          <Step n={3} title={t("home.step3.title")} body={t("home.step3.body")} />
        </div>
      </section>

      <HomeFaq />
    </>
  );
}

/* --------------------------------------------------------- today's board */

/** Reads the day's numbers. Lives below QuietBoundary so a backend without
    this query yet costs these two sections and nothing else. */
/* The second and last ask.

   A live subscription would be the wrong shape here twice over. It is a
   question about how this browser arrived, which cannot change while the page
   is open; and the moment the form is submitted the claim exists, so a live
   answer flips to "nothing owed" and tears the prompt off the screen at exactly
   the wrong instant, leaving the reader looking at nothing and wondering
   whether their address went anywhere. One question, once, and then hold it.

   Every browser asks the server this once, ever, and after that only the ones
   carrying an ask they never answered ask again. So the steady-state cost for
   somebody who has never gone unbeaten is a localStorage read and no request at
   all. The wait is so the game does not open with a form in the reader's
   face. */
function UnclaimedGift() {
  const convex = useConvex();
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    if (alreadyAsked(ASKED_AGAIN_KEY) || !worthChecking()) return;
    let live = true;
    const id = window.setTimeout(async () => {
      try {
        const owed = await convex.query(api.gifts.outstanding, { deviceId: deviceId() });
        if (!live) return;
        // Asked and answered, whatever the answer was.
        markChecked();
        if (!owed) return;
        setAsking(owed.seed);
        // Spent when it goes up, not when it is answered. Closing the tab on it
        // is an answer too: either way this was the last ask.
        markAsked(ASKED_AGAIN_KEY);
      } catch {
        // No answer, no ask. It keeps for next time.
      }
    }, 1600);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [convex]);

  if (!asking) return null;
  return (
    <GiftPrompt
      seed={asking}
      deviceId={deviceId()}
      askKey={ASKED_AGAIN_KEY}
      blurbKey="gift.blurbAgain"
    />
  );
}

function TodaySections({ today }: { today: string }) {
  const stats = useQuery(api.stats.homeToday, { date: today });
  return (
    <>
      <TodayNumbers stats={stats} />
      <MostPickedToday stats={stats} />
    </>
  );
}

function pct(count: number, of: number): number {
  if (!of) return 0;
  return Math.round((count / of) * 100);
}

/** The day's numbers, read straight out of what people actually played. */
function TodayNumbers({ stats }: { stats: TodayStats | undefined }) {
  const t = useT();
  const unreachable = useBackendUnreachable();

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
          <Link href={PAGES.leaderboard} className="text-accent font-semibold hover:underline">
            {t("nav.leaderboard")}
          </Link>
        }
      />

      {stats === undefined ? (
        <p className="text-[15px] text-muted py-4">
          {t(unreachable ? "backend.unreachable" : "home.statsLoading")}
        </p>
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
      <div className="flex gap-px bg-hairline border-t border-hairline">{children}</div>
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
