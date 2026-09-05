"use client";
import type { Forecast, SeasonResult } from "@/lib/sim/engine";
import { SectionHead } from "./ui";
import { unitWord } from "./XIPanel";

const ROLE_LABEL: Record<string, string> = {
  Opener: "Opener",
  Middle: "Middle",
  WK: "Keeper",
  AR: "All-rounder",
  Pace: "Pace",
  Spin: "Spin",
};

export function SeasonReport({
  result,
  forecast,
  bat,
  bowl,
  compact,
  leagueOnly,
  slim,
}: {
  result: SeasonResult;
  forecast: Forecast | null;
  bat: number;
  bowl: number;
  compact?: boolean;
  leagueOnly?: boolean;
  slim?: boolean;
}) {
  // Checkpoint before the playoffs: where you finished, and how that compares.
  if (slim) {
    return (
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat value={`#${result.rank}`} label="finished" />
        <Stat value={`~${forecast?.medRank ?? "–"}`} label="the bookies said" />
        <Stat value={String(result.points)} label="points" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {leagueOnly && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-[20px] leading-[26px] lg:text-[24px] lg:leading-8">
            {verdict(result)}
          </h2>
          <p className="text-[15px] leading-6 text-muted max-w-[70ch]">{body(result, bat, bowl)}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:gap-12 lg:items-start">
        <section className="flex flex-col flex-1 min-w-0">
          <SectionHead
            title="Your XI, season numbers"
            note={`${result.games.length + result.playoffs.length} matches`}
          />
          <div className="flex items-center gap-3 h-7 mt-1 text-[12px] leading-4 text-muted">
            <span className="flex-1">Player</span>
            <span className="w-[84px] shrink-0 hidden sm:block">Role</span>
            <span className="w-14 shrink-0 text-right">Runs</span>
            <span className="w-14 shrink-0 text-right">Wickets</span>
            <span className="w-11 shrink-0 text-right">Rating</span>
          </div>
          {[...result.playerRuns]
            .sort((a, b) => b.runs + b.wickets * 20 - (a.runs + a.wickets * 20))
            .map((p, i, arr) => (
              <div
                key={p.player}
                className={`flex items-center gap-3 h-10 border-t border-hairline ${
                  i === arr.length - 1 ? "border-b" : ""
                }`}
              >
                <span className="flex-1 min-w-0 font-medium text-[16px] leading-[22px] truncate">
                  {p.player}
                </span>
                <span className="w-[84px] shrink-0 hidden sm:block text-[13px] leading-[18px] text-muted">
                  {ROLE_LABEL[p.role] ?? p.role}
                </span>
                <Num value={p.runs} />
                <Num value={p.wickets} />
                <span className="w-11 shrink-0 text-right font-display font-bold text-[22px] leading-5 pt-[3px] tabular">
                  {p.overall}
                </span>
              </div>
            ))}
        </section>

        <section className="flex flex-col mt-8 lg:mt-0 lg:w-[400px] lg:shrink-0">
          <SectionHead title="Season awards" />
          <Award
            colour="#FF822A"
            name={result.orangeCap.player}
            note="Orange Cap, most runs"
            value={result.orangeCap.runs}
            first
          />
          <Award
            colour="#6B3FA0"
            name={result.purpleCap.player}
            note="Purple Cap, most wickets"
            value={result.purpleCap.wickets}
          />
          <Award
            colour="#E0A81C"
            name={result.mvp.player}
            note="Player of the season"
            value={result.mvp.points}
            last
          />

          {!compact && (
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-6">
              <Stat value={unitWord(bat)} label="batting" />
              <Stat value={unitWord(bowl)} label="bowling" />
              <Stat value={`${result.nrr > 0 ? "+" : ""}${result.nrr}`} label="net run rate" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Num({ value }: { value: number }) {
  return (
    <span
      className={`w-14 shrink-0 text-right font-display font-semibold text-[22px] leading-5 pt-[3px] tabular ${
        value ? "" : "text-faint"
      }`}
    >
      {value || "–"}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display font-semibold text-[30px] leading-7 pt-1 tabular">{value}</span>
      <span className="text-[13px] leading-[18px] text-muted">{label}</span>
    </div>
  );
}

function Award({
  colour,
  name,
  note,
  value,
  first,
  last,
}: {
  colour: string;
  name: string;
  note: string;
  value: number;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 h-[60px] border-t border-hairline ${
        last ? "border-b" : ""
      } ${first ? "" : ""}`}
    >
      <span className="w-2.5 h-[38px] shrink-0 rounded-[2px]" style={{ backgroundColor: colour }} />
      <span className="flex flex-col flex-1 min-w-0">
        <span className="font-medium text-[16px] leading-[22px] truncate">{name}</span>
        <span className="text-[13px] leading-[18px] text-muted truncate">{note}</span>
      </span>
      <span className="shrink-0 font-display font-semibold text-[28px] leading-[26px] pt-[3px] tabular">
        {value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

function verdict(r: SeasonResult): string {
  if (r.perfect14) return "Fourteen from fourteen in the league.";
  if (r.rank === 1) return "Top of the table.";
  if (r.madePlayoffs) return "Through to the knockouts.";
  if (r.rank <= 6) return "The playoffs were right there.";
  if (r.rank <= 8) return "Mid-table, and nowhere near it.";
  return "Rock bottom.";
}

function body(r: SeasonResult, bat: number, bowl: number): string {
  const bits: string[] = [];
  bits.push(`${r.wins} won, ${r.losses} lost, ${r.points} points, finished #${r.rank}.`);
  const weak: string[] = [];
  if (bat < 78) weak.push("the batting");
  if (bowl < 78) weak.push("the bowling");
  bits.push(
    weak.length
      ? `This XI was built on ${unitWord(Math.max(bat, bowl)).toLowerCase()} ${
          bat >= bowl ? "batting" : "bowling"
        }, and ${weak.join(" and ")} let it down.`
      : "No weak links. This XI had everything."
  );
  if (!r.madePlayoffs) bits.push("Top four was the promised land.");
  return bits.join(" ");
}
