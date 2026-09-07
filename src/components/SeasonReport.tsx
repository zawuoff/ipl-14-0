"use client";
import type { Forecast, SeasonResult } from "@/lib/sim/engine";
import { SectionHead } from "./ui";
import { unitWord } from "./XIPanel";
import { useT } from "@/lib/i18n";

export function SeasonReport({
  result,
  forecast,
  bat,
  bowl,
  compact,
  leagueOnly,
  slim,
  owners,
}: {
  result: SeasonResult;
  forecast: Forecast | null;
  bat: number;
  bowl: number;
  compact?: boolean;
  leagueOnly?: boolean;
  slim?: boolean;
  // In a room both managers can hold the same player, so an award needs to say
  // whose XI it came from.
  owners?: (player: string) => string[];
}) {
  const t = useT();
  // Checkpoint before the playoffs: where you finished, and how that compares.
  if (slim) {
    return (
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat value={`#${result.rank}`} label={t("report.finished")} />
        <Stat value={`~${forecast?.medRank ?? "–"}`} label={t("report.bookiesSaid")} />
        <Stat value={String(result.points)} label={t("word.points")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {leagueOnly && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-[20px] leading-[26px] lg:text-[24px] lg:leading-8">
            {verdict(result, t)}
          </h2>
          <p className="text-[15px] leading-6 text-muted max-w-[70ch]">{body(result, bat, bowl, t)}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:gap-12 lg:items-start">
        <section className="flex flex-col flex-1 min-w-0">
          <SectionHead
            title={t("report.xiNumbers")}
            note={t("report.matches", { n: result.games.length + result.playoffs.length })}
          />
          <div className="flex items-center gap-3 h-7 mt-1 text-[12px] leading-4 text-muted">
            <span className="flex-1">{t("report.player")}</span>
            <span className="w-[84px] shrink-0 hidden sm:block">{t("report.role")}</span>
            <span className="w-14 shrink-0 text-right">{t("report.runs")}</span>
            <span className="w-14 shrink-0 text-right">{t("report.wickets")}</span>
            <span className="w-11 shrink-0 text-right">{t("report.rating")}</span>
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
                  {t(`role.${p.role}`)}
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
          <SectionHead title={t("report.awards")} />
          <Award
            colour="#FF822A"
            name={result.orangeCap.player}
            note={t("report.orangeCap")}
            value={result.orangeCap.runs}
            owners={owners?.(result.orangeCap.player)}
          />
          <Award
            colour="#A76BFF"
            name={result.purpleCap.player}
            note={t("report.purpleCap")}
            value={result.purpleCap.wickets}
            owners={owners?.(result.purpleCap.player)}
          />
          <Award
            colour="#E0A81C"
            name={result.mvp.player}
            note={t("report.mvp")}
            value={result.mvp.points}
            owners={owners?.(result.mvp.player)}
            last
          />

          {!compact && (
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-6">
              <Stat value={t(`unit.${unitWord(bat)}`)} label={t("report.batting")} />
              <Stat value={t(`unit.${unitWord(bowl)}`)} label={t("report.bowling")} />
              <Stat value={`${result.nrr > 0 ? "+" : ""}${result.nrr}`} label={t("word.nrr")} />
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
  owners,
  last,
}: {
  colour: string;
  name: string;
  note: string;
  value: number;
  owners?: string[];
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 min-h-[60px] py-2 border-t border-hairline ${
        last ? "border-b" : ""
      }`}
    >
      <span className="w-2.5 h-[38px] shrink-0 rounded-[2px]" style={{ backgroundColor: colour }} />
      <span className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[16px] leading-[22px] truncate">{name}</span>
          {owners?.map((o) => (
            <span
              key={o}
              className={`shrink-0 inline-flex items-center h-[19px] px-1.5 rounded-chip text-[12px] leading-none font-medium ${
                o === "You" ? "bg-accent text-ground" : "border border-white/30 text-white"
              }`}
            >
              {o}
            </span>
          ))}
        </span>
        <span className="text-[13px] leading-[18px] text-muted truncate">{note}</span>
      </span>
      <span className="shrink-0 font-display font-semibold text-[28px] leading-[26px] pt-[3px] tabular">
        {value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

type T = (k: string, v?: Record<string, string | number>) => string;

function verdict(r: SeasonResult, t: T): string {
  if (r.perfect14) return t("verdict.perfect14");
  if (r.rank === 1) return t("verdict.top");
  if (r.madePlayoffs) return t("verdict.through");
  if (r.rank <= 6) return t("verdict.rightThere");
  if (r.rank <= 8) return t("verdict.midTable");
  return t("verdict.bottom");
}

function body(r: SeasonResult, bat: number, bowl: number, t: T): string {
  const bits: string[] = [];
  bits.push(t("report.recordLine", { w: r.wins, l: r.losses, points: r.points, rank: r.rank }));
  const weak: string[] = [];
  if (bat < 78) weak.push(t("report.theBatting"));
  if (bowl < 78) weak.push(t("report.theBowling"));
  bits.push(
    weak.length
      ? t("report.weakLink", {
          strength: t(`unit.${unitWord(Math.max(bat, bowl))}`),
          unit: bat >= bowl ? t("report.batting") : t("report.bowling"),
          weak: weak.join(" / "),
        })
      : t("report.noWeak")
  );
  if (!r.madePlayoffs) bits.push(t("end.promisedLand"));
  return bits.join(" ");
}
