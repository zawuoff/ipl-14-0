"use client";
import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Flap, SectionHead, PrimaryButton, Wordmark } from "@/components/ui";
import { useT, LangToggle, localiseMargin } from "@/lib/i18n";

const CODE_COLOUR: Record<string, string> = {
  MI: "#004BA0",
  CSK: "#FDB913",
  RCB: "#EC1C24",
  KKR: "#3A225D",
  DC: "#17479E",
  SRH: "#FF822A",
  RR: "#EA1A85",
  PBKS: "#E81828",
  GT: "#1B2133",
  LSG: "#00A3E0",
};

function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.45 ? "#000000" : "#FFFFFF";
}

export default function SharePage({ params }: { params: Promise<{ seed: string }> }) {
  const { seed } = use(params);
  const t = useT();
  const data = useQuery((api as any).results?.getBySeed, { seed });
  const r = data?.result;

  return (
    <main className="min-h-screen bg-ground text-white flex flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-8 py-3.5 flex items-center gap-3">
          <a href="/" className="flex items-baseline gap-3">
            <Wordmark className="text-[30px]" />
            <span className="text-[13px] leading-[18px] text-muted">{t("nav.backToGame")}</span>
          </a>
          <span className="flex-1" />
          <LangToggle className="w-11 h-8 text-[14px]" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-8 pt-5 pb-12">
        {data === undefined && <p className="text-[15px] text-muted py-6">{t("seed.checking")}</p>}

        {data === null && (
          <div className="border border-hairline rounded-control p-5 mt-2">
            <h1 className="font-semibold text-[22px] leading-7">{t("seed.notFound")}</h1>
            <p className="text-[15px] leading-[22px] text-muted mt-1.5">
              {t("seed.notFoundBody")}
            </p>
            <PrimaryButton className="mt-4 w-full sm:w-auto sm:px-10" onClick={() => (window.location.href = "/")}>
              {t("seed.playRun")}
            </PrimaryButton>
          </div>
        )}

        {r && (
          <>
            <div className="-mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-6 lg:px-9 lg:py-9 flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-12">
              <div className="flex gap-3 lg:shrink-0">
                <Flap
                  label={t("word.won")}
                  value={r.wins}
                  tone={r.perfect14 ? "turf" : "plate"}
                  wrapClassName="flex-1 lg:flex-none lg:w-[160px]"
                  className="h-[120px] lg:h-[180px]"
                  valueClassName="text-[112px] leading-[98px] lg:text-[140px] lg:leading-[122px]"
                />
                <Flap
                  label={t("word.lost")}
                  value={r.losses}
                  wrapClassName="flex-1 lg:flex-none lg:w-[160px]"
                  className="h-[120px] lg:h-[180px]"
                  valueClassName="text-[112px] leading-[98px] lg:text-[140px] lg:leading-[122px]"
                />
              </div>
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <h1
                  className={`font-semibold text-[26px] leading-8 lg:text-[36px] lg:leading-[44px] ${
                    r.champion ? "text-trophy" : ""
                  }`}
                >
                  {r.perfect14 && r.champion
                    ? t("end.perfect")
                    : r.champion
                      ? t("end.champions")
                      : r.madePlayoffs
                        ? t("seed.madePlayoffs")
                        : t("end.missed")}
                </h1>
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  {[
                    [String(r.points), t("word.points")],
                    [`${r.nrr > 0 ? "+" : ""}${r.nrr}`, t("word.nrr")],
                    [t(`difficulty.${r.difficulty}`), t("word.difficulty")],
                  ].map(([v, k]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="font-display font-semibold text-[30px] leading-7 pt-1 tabular">{v}</span>
                      <span className="text-[13px] leading-[18px] text-body-plate">{k}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[13px] leading-[18px] text-muted-plate">
                  {t("seed.note", { seed: r.seed })}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <SectionHead title={t("seed.theLeague")} note={t("report.matches", { n: r.games.length })} />
              <div className="mt-2.5">
                {r.games.map((g: any, i: number) => {
                  const colour = CODE_COLOUR[g.opp] ?? "#2E2E2E";
                  const win = g.result === "W";
                  const superOver = g.margin === "Super Over";
                  const wide = superOver
                    ? t(win ? "match.wonSO" : "match.lostSO")
                    : t(win ? "match.won" : "match.lost", { margin: localiseMargin(g.margin, t) });
                  const narrow = superOver
                    ? t(win ? "match.beatSO" : "match.lostToSO", { opp: g.opp })
                    : t(win ? "match.beat" : "match.lostTo", { opp: g.opp, margin: localiseMargin(g.margin, t) });
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-2.5 border-t border-hairline ${
                        i === r.games.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <span className="w-7 shrink-0 text-[13px] leading-[18px] text-muted">M{i + 1}</span>
                      <span
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded font-display font-bold text-[18px] leading-none text-white pt-[2px]"
                        style={{ backgroundColor: win ? "#1A8A3C" : "#D8321F" }}
                      >
                        {g.result}
                      </span>
                      <span
                        className="hidden sm:flex w-14 h-[22px] shrink-0 items-center justify-center rounded-chip font-display font-semibold text-[15px] leading-none pt-[2px]"
                        style={{ backgroundColor: colour, color: readableOn(colour) }}
                      >
                        {g.opp}
                      </span>
                      <span className="flex-1 min-w-0 text-[15px] leading-5 truncate">
                        <span className="sm:hidden">{narrow}</span>
                        <span className="hidden sm:inline">{wide}</span>
                      </span>
                      <span className="shrink-0 font-display font-semibold text-[20px] leading-5 pt-[3px] tabular whitespace-nowrap">
                        {g.gf} · {g.ga}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {r.playoffs?.length > 0 && (
              <div className="mt-8">
                <SectionHead title={t("po.title")} />
                <div className="mt-2.5">
                  {r.playoffs.map((p: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-2.5 border-t border-hairline ${
                        i === r.playoffs.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <span className="w-[110px] shrink-0 text-[13px] leading-[18px] text-muted">
                        {t(`stage.${p.stage}`)}
                      </span>
                      <span className="flex-1 min-w-0 text-[15px] leading-5 truncate">
                        {t(p.result === "W" ? "match.won" : "match.lost", { margin: localiseMargin(p.margin, t) })}
                      </span>
                      <span className="shrink-0 font-display font-semibold text-[20px] leading-5 pt-[3px] tabular">
                        {p.gf} · {p.ga}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <PrimaryButton className="sm:px-10" onClick={() => (window.location.href = "/")}>
                {t("seed.playYourOwn")}
              </PrimaryButton>
              <p className="text-[13px] leading-5 text-muted self-center">
                {t("seed.savedAt", { when: new Date(r.createdAt).toLocaleString("en-IN") })}
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
