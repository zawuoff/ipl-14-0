"use client";
import type { Forecast, SeasonResult } from "@/lib/sim/engine";

// 38-0-style season report: finished/projected, verdict, units, blurb,
// XI table with season aggregates, tiles, awards.
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
  const verdict = getVerdict(result, leagueOnly);
  if (slim) {
    // checkpoint before playoffs: rank + projection + verdict only.
    // Full recap lives at the end — no repeats.
    return (
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <div className="font-black text-2xl">#{result.rank}</div>
          <div className="text-[10px] text-zinc-500 tracking-widest">FINISHED</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <div className="font-black text-2xl text-zinc-300">~{forecast?.medRank ?? "–"}</div>
          <div className="text-[10px] text-zinc-500 tracking-widest">PROJECTED</div>
        </div>
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/[0.06] p-3 text-center flex items-center justify-center">
          <div className="font-black text-[13px] text-amber-200 leading-tight">{verdict}</div>
        </div>
      </div>
    );
  }
  const units = getUnits(result, bat, bowl);
  return (
    <div className="space-y-3">
      {/* results list */}
      {!compact && (
        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
          {result.games.map((g, i) => {
            const st = result.matchStars[i];
            const hero = st
              ? g.result === "W"
                ? g.margin.includes("runs")
                  ? `${short(st.bowl.player)} ${st.bowl.wickets}/${st.bowl.runsConceded}`
                  : `${short(st.bat.player)} ${st.bat.runs}(${st.bat.balls})`
                : oppHero(g.opp, i)
              : "";
            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-[13px] rounded-lg px-2.5 py-1.5 border ${
                  g.result === "W" ? "border-emerald-400/25 bg-emerald-500/[0.07]" : "border-red-400/25 bg-red-500/[0.07]"
                }`}
              >
                <span className="text-zinc-500 text-[11px] w-8">M{i + 1}</span>
                <span
                  className={`w-4 h-4 rounded text-[10px] font-black flex items-center justify-center ${
                    g.result === "W" ? "bg-emerald-400 text-black" : "bg-red-500 text-white"
                  }`}
                >
                  {g.result}
                </span>
                <span className="font-semibold">{g.opp}</span>
                <span className="text-zinc-500 text-[11px]">(A)</span>
                <span className="ml-auto font-mono font-bold">
                  {g.gf} <span className="text-zinc-500 font-normal">vs {g.ga}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {compact && (
        <div className="font-mono text-sm text-center">
          {result.games.map((g) => (g.result === "W" ? "🟩" : "🟥")).join("")}
        </div>
      )}
      {!compact &&
        result.games.map((g, i) => {
          const st = result.matchStars[i];
          if (!st) return null;
          const hero =
            g.result === "W"
              ? g.margin.includes("runs")
                ? `${short(st.bowl.player)} ${st.bowl.wickets}/${st.bowl.runsConceded} defended ${g.gf}`
                : `${short(st.bat.player)} ${st.bat.runs}(${st.bat.balls}) finished it`
              : `${oppHero(g.opp, i)} stunned you`;
          return (
            <div key={"h" + i} className="text-[11px] text-zinc-500 -mt-2 mb-1 ml-11">
              ⚾ {hero}
            </div>
          );
        })}

      {/* finished / projected / verdict */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <div className="font-black text-2xl">#{result.rank}</div>
          <div className="text-[10px] text-zinc-500 tracking-widest">FINISHED</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <div className="font-black text-2xl text-zinc-300">~{forecast?.medRank ?? "–"}</div>
          <div className="text-[10px] text-zinc-500 tracking-widest">PROJECTED</div>
        </div>
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/[0.06] p-3 text-center flex items-center justify-center">
          <div className="font-black text-[13px] text-amber-200 leading-tight">{verdict}</div>
        </div>
      </div>

      {/* units */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-center text-[11px] text-zinc-400">
        {units.map((u, i) => (
          <span key={u.label}>
            {i > 0 && <span className="mx-1.5 text-zinc-600">·</span>}
            {u.label} <b className={u.color}>{u.word}</b>
          </span>
        ))}
        <div className="text-zinc-500 mt-0.5">{unitBlurb(result, units)}</div>
      </div>

      {/* newspaper blurb */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[13px] leading-relaxed text-zinc-300">
        <div className="font-black text-sm text-white mb-1">{blurbHead(result, leagueOnly)}</div>
        {blurbBody(result, leagueOnly)}
      </div>

      {/* XI table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="text-[10px] tracking-[0.2em] text-zinc-500 px-3 pt-2">
          YOUR XI · SEASON NUMBERS
        </div>
        <table className="w-full text-xs mt-1">
          <thead>
            <tr className="text-zinc-500 text-left">
              <th className="font-semibold px-3 py-1">PLAYER</th>
              <th className="font-semibold text-right px-1">RUNS</th>
              <th className="font-semibold text-right px-1">WKTS</th>
              <th className="font-semibold text-right px-3">OVR</th>
            </tr>
          </thead>
          <tbody>
            {[...result.playerRuns]
              .sort((a, b) => b.runs + b.wickets * 20 - (a.runs + a.wickets * 20))
              .map((p) => (
                <tr key={p.player} className="border-t border-white/5">
                  <td className="px-3 py-1.5">
                    <span className="font-semibold">{p.player}</span>{" "}
                    <span className="text-zinc-500 text-[10px]">{p.role}</span>
                  </td>
                  <td className="text-right font-mono px-1">{p.runs || "–"}</td>
                  <td className="text-right font-mono px-1">{p.wickets || "–"}</td>
                  <td className="text-right font-mono font-bold text-emerald-300 px-3">{p.overall}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* tiles */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile value={String(result.wins)} label="Wins" color="text-emerald-300" />
        <Tile value={String(result.points)} label="Points" />
        <Tile value={`${result.nrr > 0 ? "+" : ""}${result.nrr}`} label="NRR" />
        <Tile value={String(sumRuns(result))} label="Runs Scored" color="text-emerald-300" />
        <Tile value={String(sumAgainst(result))} label="Runs Conceded" color="text-red-300" />
        <Tile value={result.biggestWin} label="Biggest Win" small />
      </div>

      {/* awards */}
      <div>
        <div className="text-[10px] tracking-[0.25em] text-zinc-500 mb-1.5">SEASON AWARDS</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-orange-300/30 bg-orange-400/[0.07] p-2.5 text-center">
            <div className="text-[10px] text-orange-200/80 font-bold">🟠 ORANGE CAP</div>
            <div className="font-bold text-sm mt-0.5">{result.orangeCap.player}</div>
            <div className="text-xs text-zinc-400">{result.orangeCap.runs} runs</div>
          </div>
          <div className="rounded-xl border border-violet-300/30 bg-violet-400/[0.07] p-2.5 text-center">
            <div className="text-[10px] text-violet-200/80 font-bold">🟣 PURPLE CAP</div>
            <div className="font-bold text-sm mt-0.5">{result.purpleCap.player}</div>
            <div className="text-xs text-zinc-400">{result.purpleCap.wickets} wkts</div>
          </div>
          <div className="rounded-xl border border-amber-300/30 bg-amber-400/[0.07] p-2.5 text-center">
            <div className="text-[10px] text-amber-200/80 font-bold">🏅 MVP</div>
            <div className="font-bold text-sm mt-0.5">{result.mvp.player}</div>
            <div className="text-xs text-zinc-400">{result.mvp.points} pts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ value, label, color, small }: { value: string; label: string; color?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className={`font-black ${small ? "text-[11px] leading-tight" : "text-xl"} ${color ?? ""}`}>{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

function short(full: string): string {
  const parts = full.split(" ");
  if (parts.length === 1) return full;
  return `${parts[0][0]} ${parts[parts.length - 1]}`;
}

const OPP_HEROES = ["Warner", "Buttler", "Bumrah", "Rashid", "Gayle", "Dhoni", "ABD", "Malinga", "Narine", "Pant", "SKY", "Head"];
function oppHero(opp: string, i: number): string {
  return OPP_HEROES[(opp.length + i) % OPP_HEROES.length];
}

function getVerdict(r: SeasonResult, leagueOnly?: boolean): string {
  if (r.perfect14) return leagueOnly ? "🔥 14-0 LEAGUE. PLAYOFFS AWAIT." : "🏆 IMMORTALS";
  if (r.champion && !leagueOnly) return "🏆 CHAMPIONS";
  if (r.rank === 1 && leagueOnly) return "🔝 TOP OF THE TABLE";
  if (r.madePlayoffs && leagueOnly) return "✅ PLAYOFFS SEALED";
  if (r.madePlayoffs) return "💔 KNOCKOUT HEARTBREAK";
  if (r.rank <= 6) return "WHAT MIGHT HAVE BEEN";
  if (r.rank <= 8) return "FLATTERED TO DECEIVE";
  return "🧹 WOODEN SPOON";
}

function unitWord(x: number): { word: string; color: string } {
  if (x >= 88) return { word: "Elite", color: "text-emerald-300" };
  if (x >= 82) return { word: "Strong", color: "text-emerald-300" };
  if (x >= 76) return { word: "Solid", color: "text-sky-300" };
  if (x >= 70) return { word: "Modest", color: "text-amber-300" };
  return { word: "Shaky", color: "text-red-300" };
}

function getUnits(r: SeasonResult, bat: number, bowl: number) {
  const ars = r.playerRuns.filter((p) => p.role === "AR");
  const arAvg = ars.length ? ars.reduce((a, p) => a + p.overall, 0) / ars.length : 70;
  return [
    { label: "BATTING", ...unitWord(bat) },
    { label: "BOWLING", ...unitWord(bowl) },
    { label: "ALL-ROUND", ...unitWord(arAvg) },
  ];
}

function unitBlurb(r: SeasonResult, units: { label: string; word: string }[]): string {
  const weak = units.filter((u) => u.word === "Modest" || u.word === "Shaky");
  if (weak.length === 0) return "No weak links. This XI had everything.";
  return `Built around the ${units[0].word.toLowerCase()} batting; the ${weak.map((w) => w.label.toLowerCase()).join(" and ")} let them down.`;
}

function blurbHead(r: SeasonResult, leagueOnly?: boolean): string {
  if (r.perfect14 && leagueOnly) return "14-0 IN THE LEAGUE — JOB HALF DONE";
  if (r.perfect14) return "14-0. PERFECT — NOBODY DOES THIS";
  if (r.champion && !leagueOnly) return "CHAMPIONS — PARADE THROUGH TOWN";
  if (leagueOnly && r.rank === 1) return "TOP OF THE PILE — NOW WIN THREE MORE";
  if (leagueOnly && r.madePlayoffs) return "THROUGH TO THE KNOCKOUTS";
  if (r.madePlayoffs) return "SO NEAR, YET OUT OF THE FINAL";
  if (r.rank <= 6) return "THE PLAYOFFS WERE RIGHT THERE";
  if (r.rank <= 8) return "MID-TABLE NOWHERE";
  return "ROCK BOTTOM — INQUEST TIME";
}

function blurbBody(r: SeasonResult, leagueOnly?: boolean): string {
  const bits: string[] = [];
  bits.push(
    `${r.wins} wins, ${r.losses} defeats, ${r.points} points — finished #${r.rank}.`
  );
  if (!r.madePlayoffs) bits.push("Top four was the promised land. Holiday brochures out early.");
  if (leagueOnly && r.madePlayoffs) bits.push("The league is only half the job. Knockout wins now, and nobody remembers the table.");
  if (!leagueOnly && r.madePlayoffs && !r.champion) bits.push("Through the league, undone when it mattered. Knockout cricket is cruel.");
  bits.push(
    `${r.orangeCap.player} carried the batting (${r.orangeCap.runs} runs); ${r.purpleCap.player} led the attack (${r.purpleCap.wickets} wickets).`
  );
  if (r.perfect14 && !leagueOnly) bits.push("Fourteen played, fourteen won. Put this XI in a museum.");
  return bits.join(" ");
}

function sumRuns(r: SeasonResult): number {
  return r.games.reduce((a, g) => a + (parseInt(g.gf.split("/")[0], 10) || 0), 0);
}
function sumAgainst(r: SeasonResult): number {
  return r.games.reduce((a, g) => a + (parseInt(g.ga.split("/")[0], 10) || 0), 0);
}
