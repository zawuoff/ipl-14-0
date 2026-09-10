"use client";
import { useState } from "react";

import { Invincible } from "@/components/Invincible";
import { Flap, PageBand, PlateButton } from "@/components/ui";
import { fireworks } from "@/lib/sound";

/* A bench for the unbeaten-season celebration, and nothing else.

   It has to be judged on the screen it will actually land on — same fonts, same
   navy, same flaps, same sound — so this route stages a real 14–0 result behind
   it rather than a blank page. It is not linked from anywhere, and it is kept
   because the real thing fires perhaps once in a few thousand runs — without a
   bench there is no way to look at it again.

   The card prompt is deliberately not staged here: it writes a real name and a
   real address to a real table, and a bench is no place for that. */

export default function InvincibleLab() {
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);

  const play = () => {
    setPlaying(true);
    setRun((n) => n + 1);
    fireworks();
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {playing && (
        <Invincible
          key={run}
          title="IMMORTAL"
          sub="Fourteen played. Fourteen won. Nobody does this."
          onDone={() => setPlaying(false)}
        />
      )}

      {/* the chooser */}
      <div className="bg-plate border-b border-plate-line">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-4 flex flex-col gap-3">
          <p className="head-display text-[19px] leading-none text-white">The 14–0 celebration</p>
          <button
            onClick={play}
            className="self-start text-left rounded-control border border-plate-line hover:border-accent px-4 py-3 transition-colors"
          >
            <span className="block text-white font-semibold text-[15px] leading-5">
              Play the celebration
            </span>
            <span className="block text-muted-plate text-[13px] leading-[18px] pt-1">
              Fourteen win cards turn over, the screen goes gold, the score lands
            </span>
          </button>
          <p className="text-muted-plate text-[13px] leading-[18px]">
            It plays over the result screen below, exactly where it would land in a real run.
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
              <PlateButton onClick={play}>Play again</PlateButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
