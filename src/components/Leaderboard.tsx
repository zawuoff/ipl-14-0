"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useIstDay } from "@/lib/day";
import { useBackendUnreachable } from "@/lib/backend";
import { useT } from "@/lib/i18n";

/* The board, live. It used to be a screen inside the home page, which gave it
   no address of its own; now /leaderboard renders this, and the home page
   borrows BoardRows for its top ten. */

// Today is every run of the IST day; challenge is only that day's shared squads.
export type BoardTab = "today" | "daily" | "all";

export type Row = {
  seed: string;
  wins: number;
  losses: number;
  nrr: number;
  difficulty: string;
  champion?: boolean;
  perfect14?: boolean;
  madePlayoffs?: boolean;
  deviceId: string;
  name?: string | null;
};

const TABS: { key: BoardTab; label: string; empty: string }[] = [
  { key: "today", label: "board.tab.today", empty: "board.empty.today" },
  { key: "daily", label: "board.tab.challenge", empty: "board.empty.challenge" },
  { key: "all", label: "board.tab.allTime", empty: "board.empty.allTime" },
];

function tabFrom(value: string | null): BoardTab {
  return value === "all" || value === "daily" ? value : "today";
}

/** Reads ?tab= from the address, so "All time" can be linked to directly. */
export function LiveLeaderboard() {
  const t = useT();
  const today = useIstDay();
  const params = useSearchParams();
  const [tab, setTab] = useState<BoardTab>(() => tabFrom(params.get("tab")));

  // Only the tab on screen is subscribed; the other two cost nothing until
  // somebody opens them.
  const rows = useQuery(
    api.results.leaderboard,
    tab === "today"
      ? { day: today, limit: 100 }
      : tab === "daily"
        ? { dailyDate: today, limit: 100 }
        : { limit: 100 }
  ) as Row[] | undefined;

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 p-1 rounded-full bg-surface" role="tablist" aria-label={t("board.title")}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 h-10 px-2 rounded-full font-semibold text-[14px] sm:text-[15px] transition-colors ${
              tab === key ? "bg-accent text-ground" : "text-white hover:bg-white/8"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <BoardRows rows={rows} empty={t(TABS.find((x) => x.key === tab)!.empty)} />
      </div>
      <p className="text-[13px] leading-5 text-muted pt-3">
        {tab === "all" ? t("board.seedNote") : t("board.todayNote", { date: today })}
      </p>
    </div>
  );
}

function outcomeKey(r: Row): string {
  if (r.champion) return "outcome.champions";
  if (r.madePlayoffs) return "outcome.madePlayoffs";
  return "outcome.missedPlayoffs";
}

/* Gold, silver, bronze for the podium; everyone else keeps the black plate. */
const PODIUM = ["bg-trophy text-ground", "bg-silver text-ground", "bg-bronze text-ground"];

export function BoardRows({ rows, empty }: { rows: Row[] | undefined; empty: string }) {
  const t = useT();
  const unreachable = useBackendUnreachable();
  if (rows === undefined)
    return (
      <p className="text-[15px] text-muted py-4">
        {t(unreachable ? "backend.unreachable" : "board.loading")}
      </p>
    );
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
            className={`flex items-center justify-center w-9 h-9 shrink-0 rounded-plate font-display font-bold leading-none pt-1 tabular ${
              i + 1 >= 100 ? "text-[15px]" : "text-[22px]"
            } ${PODIUM[i] ?? "bg-plate border border-plate-line text-white"}`}
          >
            {i + 1}
          </span>
          <span className="flex flex-col flex-1 min-w-0">
            <span className="font-medium text-[16px] leading-[22px] truncate">
              {r.name?.trim() || t("board.manager", { id: r.deviceId.slice(0, 4).toUpperCase() })}
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
