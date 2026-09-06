"use client";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GameBoard } from "@/components/GameBoard";
import { istDateKey } from "@/lib/game/types";
import { Flap, PrimaryButton, OutlineButton, SectionHead, Wordmark } from "@/components/ui";
import { useT, useLang, LangToggle } from "@/lib/i18n";

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
  const t = useT();
  const link = "text-[15px] leading-5 font-medium hover:text-turf transition-colors";
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-3.5 lg:py-5 flex items-center gap-3 lg:gap-5">
        <button onClick={() => !inGame && go("home")} className="flex items-baseline gap-3 min-w-0">
          <Wordmark className="text-[30px] lg:text-[34px]" />
          <span className="hidden sm:block text-[13px] lg:text-[14px] leading-[18px] text-muted truncate">
            {t("app.tagline")}
          </span>
        </button>
        <span className="flex-1" />
        <nav className="hidden lg:flex items-center gap-7">
          <button className={link} onClick={() => go("home")}>{t("nav.howItWorks")}</button>
          <button className={`${link} ${screen === "board" ? "text-turf" : ""}`} onClick={() => go("board")}>
            {t("nav.leaderboard")}
          </button>
          <button className={link} onClick={() => go("game")}>{t("nav.playAFriend")}</button>
        </nav>
        <button
          onClick={() => go("board")}
          className="lg:hidden text-[15px] font-medium px-3 h-9 flex items-center rounded-control border border-ink"
        >
          {t("nav.board")}
        </button>
        <LangToggle className="w-11 h-8 lg:w-[46px] lg:h-[34px] text-[14px]" />
      </div>
    </header>
  );
}

function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-8 lg:py-10 flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-10">
        <p className="flex-1 max-w-[720px] text-[13px] leading-5 text-muted">
          {t("footer.legal")}
        </p>
        <p className="text-[13px] lg:text-[14px] leading-5 font-medium">
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
}: {
  today: string;
  play: (m: "classic" | "daily") => void;
  rows: Row[] | undefined;
}) {
  const t = useT();
  const { lang } = useLang();
  const day = today.slice(8);
  const month = new Date(`${today}T00:00:00Z`)
    .toLocaleString(lang === "hi" ? "hi-IN" : "en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase();

  return (
    <>
      {/* The board is the hero. On desktop it fills the screen. */}
      <section className="bg-ink text-white">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-7 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-16">
            <div className="flex gap-3 lg:gap-3.5 lg:shrink-0">
              <Flap
                label={t("word.won")}
                value="14"
                wrapClassName="flex-1 lg:flex-none lg:w-[236px]"
                className="h-[132px] lg:h-[280px]"
                valueClassName="text-[128px] leading-[110px] lg:text-[216px] lg:leading-[186px]"
              />
              <Flap
                label={t("word.lost")}
                value="0"
                wrapClassName="flex-1 lg:flex-none lg:w-[236px]"
                className="h-[132px] lg:h-[280px]"
                valueClassName="text-[128px] leading-[110px] lg:text-[216px] lg:leading-[186px]"
              />
            </div>

            <div className="flex flex-col gap-5 lg:gap-5 lg:flex-1 lg:pb-2">
              <h1 className="font-semibold text-[24px] leading-[30px] lg:text-[50px] lg:leading-[58px]">
                <span className="lg:hidden">{t("home.headline.mobile")}</span>
                <span className="hidden lg:inline">{t("home.headline.desktop")}</span>
              </h1>
              <p className="text-[15px] leading-[22px] lg:text-[18px] lg:leading-7 text-body-plate lg:max-w-[540px]">
                {t("home.sub")}
              </p>
              <div className="hidden lg:flex items-center gap-5 pt-2">
                <PrimaryButton className="h-15 px-9 text-[18px]" onClick={() => play("classic")}>
                  {t("home.cta")}
                </PrimaryButton>
                <span className="text-[15px] leading-[22px] text-muted-plate whitespace-nowrap">
                  {t("home.ctaNote")}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Mobile keeps the action on white, directly under the board. */}
      <section className="lg:hidden px-5 pt-4 pb-2 flex flex-col gap-2.5">
        <PrimaryButton className="w-full" onClick={() => play("classic")}>
          {t("home.cta")}
        </PrimaryButton>
        <p className="text-[13px] leading-[18px] text-muted text-center">{t("home.ctaNote")}</p>
      </section>

      {/* Mobile: two straight choices. Desktop: real runs beside the choices. */}
      <section className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-2 lg:pt-16 pb-2 lg:pb-[72px] flex flex-col lg:flex-row gap-0 lg:gap-[72px]">
        <div className="hidden lg:flex flex-col flex-1">
          <SectionHead title={t("home.bestRuns")} note={t("home.seeFullBoard")} />
          <div className="mt-3.5">
            <BoardRows rows={rows} empty={t("board.empty.daily")} />
          </div>
          <p className="text-[13px] leading-5 text-muted pt-3.5">
            {t("home.resetNote")}
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
            title={t("home.daily.title")}
            blurb={t("home.daily.blurb")}
            action={t("home.daily.action")}
            deskAction={t("home.daily.actionLong")}
            onClick={() => play("daily")}
            first
          />
          <ModeRow
            badge={
              <span className="flex items-center justify-center w-13 h-13 lg:w-[58px] lg:h-[58px] shrink-0 rounded-control bg-ink">
                <span className="font-display font-bold text-[26px] lg:text-[28px] leading-6 text-white">1v1</span>
              </span>
            }
            title={t("home.friend.title")}
            blurb={t("home.friend.blurb")}
            action={t("home.friend.action")}
            deskAction={t("home.friend.actionLong")}
            onClick={() => play("classic")}
          />
        </div>
      </section>

      {/* How a run works */}
      <section className="bg-ground lg:bg-panel">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-7 lg:pt-16 pb-2 lg:pb-[72px] flex flex-col gap-4 lg:gap-7">
          <h2 className="font-semibold text-[20px] leading-[26px] lg:text-[24px] lg:leading-[30px]">
            {t("home.steps.title")}
          </h2>
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-12">
            <Step
              n={1}
              title={t("home.step1.title")}
              body={t("home.step1.body")}
            />
            <Step
              n={2}
              title={t("home.step2.title")}
              body={t("home.step2.body")}
            />
            <Step
              n={3}
              title={t("home.step3.title")}
              body={t("home.step3.body")}
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
  const t = useT();
  const [tab, setTab] = useState<"daily" | "all">("daily");
  const rows = tab === "daily" ? daily : allTime;
  return (
    <div className="mx-auto w-full max-w-[900px] px-5 lg:px-16 pt-4 lg:pt-8 pb-10">
      <h1 className="font-semibold text-[26px] leading-8 lg:text-[32px] lg:leading-10">{t("board.title")}</h1>
      <p className="text-[15px] leading-[22px] text-muted mt-1">
        {t("board.sub")}
      </p>

      <div className="flex gap-2 mt-4">
        {(["daily", "all"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 h-10 rounded-control font-semibold text-[15px] transition-colors ${
              tab === tabKey ? "bg-ink text-white" : "border border-[#D4D4D4] text-ink hover:bg-panel"
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
          className={`flex items-center gap-3 lg:gap-4 h-[62px] border-t border-hairline hover:bg-panel transition-colors ${
            i === rows.length - 1 ? "border-b" : ""
          }`}
        >
          <span className="w-7 lg:w-[30px] shrink-0 font-display font-semibold text-[24px] leading-[22px] pt-[3px]">
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
            <span className="hidden sm:inline-flex items-center h-6 px-2 pt-[2px] shrink-0 rounded bg-trophy font-display font-semibold text-[16px] leading-4 text-ink">
              {t("board.perfect")}
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
