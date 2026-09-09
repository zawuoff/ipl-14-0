"use client";
import { useState } from "react";

import { Invincible, type InvincibleVariant } from "@/components/Invincible";
import { Flap, PageBand, PlateButton } from "@/components/ui";
import { fireworks } from "@/lib/sound";

/* A bench for the unbeaten-season celebration, and nothing else.

   The three treatments have to be judged on the screen they will actually land
   on — same fonts, same navy, same flaps, same sound — so this route stages a
   real 14–0 result behind them rather than a blank page. It is not linked from
   anywhere and it goes away once one of them is chosen. */

const VARIANTS: { key: InvincibleVariant; name: string; note: string }[] = [
  { key: "gold", name: "Board goes gold", note: "14 chips flip, screen takes the trophy's colour, score lands" },
  { key: "spotlight", name: "Trophy spotlight", note: "Lights down, beams sweep, the cup comes up out of the dark" },
  { key: "stamp", name: "Immortal stamp", note: "One beat: the seal drops, the board shakes, paper goes up" },
];

export default function InvincibleLab() {
  const [playing, setPlaying] = useState<InvincibleVariant | null>(null);
  const [run, setRun] = useState(0);

  const play = (v: InvincibleVariant) => {
    setPlaying(v);
    setRun((n) => n + 1);
    fireworks();
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {playing && (
        <Invincible
          key={`${playing}-${run}`}
          variant={playing}
          title="IMMORTAL"
          sub="Fourteen played. Fourteen won. Nobody does this."
          onDone={() => setPlaying(null)}
        />
      )}

      {/* the chooser */}
      <div className="bg-plate border-b border-plate-line">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-4 flex flex-col gap-3">
          <p className="head-display text-[19px] leading-none text-white">
            Pick the 14–0 celebration
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            {VARIANTS.map((v) => (
              <button
                key={v.key}
                onClick={() => play(v.key)}
                className="flex-1 text-left rounded-control border border-plate-line hover:border-accent px-4 py-3 transition-colors"
              >
                <span className="block text-white font-semibold text-[15px] leading-5">{v.name}</span>
                <span className="block text-muted-plate text-[13px] leading-[18px] pt-1">{v.note}</span>
              </button>
            ))}
          </div>
          <p className="text-muted-plate text-[13px] leading-[18px]">
            Each one plays over the result screen below, exactly where it would land in a real run.
          </p>
        </div>
      </div>

      {/* the screen it lands on: a real unbeaten season */}
      <PageBand eyebrow="Classic · Pro" title="An unbeaten season" tone="trophy" />

      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 pt-4 lg:pt-6 pb-12">
        <div className="-mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-6 lg:px-9 lg:py-9 flex flex-col xl:flex-row xl:items-end gap-6 xl:gap-10">
          <div className="flex gap-3 xl:gap-3.5 xl:shrink-0">
            <Flap
              label="Won"
              value={14}
              valueColour="#4FCB74"
              wrapClassName="flex-1 xl:flex-none xl:w-[150px]"
              className="h-[120px] xl:h-[180px]"
              valueClassName="text-[112px] leading-[98px] xl:text-[132px] xl:leading-[114px]"
            />
            <Flap
              label="Lost"
              value={0}
              valueColour="#FFFFFF"
              wrapClassName="flex-1 xl:flex-none xl:w-[150px]"
              className="h-[120px] xl:h-[180px]"
              valueClassName="text-[112px] leading-[98px] xl:text-[132px] xl:leading-[114px]"
            />
          </div>

          <div className="flex flex-col gap-4 flex-1 min-w-0 xl:pb-1">
            <p className="text-[15px] leading-[22px] lg:text-[17px] lg:leading-[26px] text-muted">
              Fourteen league games, fourteen wins, and the cup at the end of it. It has been done
              once.
            </p>
            <div className="flex gap-1">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className="h-2.5 flex-1 rounded-chip bg-turf-soft" />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 xl:w-[268px] xl:shrink-0">
            {playing ? (
              <p className="text-muted text-[14px] leading-5">Playing…</p>
            ) : (
              <PlateButton onClick={() => play("gold")}>Replay last</PlateButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
