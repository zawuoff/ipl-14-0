"use client";
import type { PlayerSeason, Role, XIConfig } from "@/lib/game/types";
import { Flap, TeamChip } from "./ui";
import { useT } from "@/lib/i18n";

const ORDER: Role[] = ["Opener", "Middle", "WK", "AR", "Pace", "Spin"];

export function unitWord(x: number): string {
  if (x >= 88) return "Elite";
  if (x >= 82) return "Strong";
  if (x >= 76) return "Solid";
  if (x >= 70) return "Modest";
  return "Shaky";
}

export type TeamMeta = (teamId: string) => { code: string; season: number; colour: string } | undefined;

export function XIPanel({
  picks,
  overseas,
  power,
  bat,
  bowl,
  hideRatings,
  config,
  teamMeta,
  title,
}: {
  picks: (PlayerSeason | null)[];
  overseas: number;
  power?: number | null;
  bat?: number | null;
  bowl?: number | null;
  hideRatings?: boolean;
  config: XIConfig;
  teamMeta: TeamMeta;
  title?: string;
}) {
  const t = useT();
  const filled = picks.filter(Boolean) as PlayerSeason[];
  const remaining = [...filled];
  const takeFor = (role: Role): PlayerSeason | null => {
    const i = remaining.findIndex((p) => p.role === role);
    if (i < 0) return null;
    return remaining.splice(i, 1)[0];
  };

  // One row per slot the chosen style asks for, in batting order.
  const slots: { role: Role; player: PlayerSeason | null }[] = [];
  for (const role of ORDER) {
    for (let i = 0; i < (config[role] ?? 0); i++) {
      slots.push({ role, player: takeFor(role) });
    }
  }

  return (
    <section className="flex flex-col">
      <div className="flex items-baseline gap-3 pb-2.5">
        <h2 className="font-semibold text-[17px] leading-[22px] lg:text-[20px] lg:leading-[26px]">{title ?? t("draft.xiSoFar")}</h2>
        <span className="flex-1" />
        <span className="text-[13px] leading-[18px] lg:text-[14px] lg:leading-5 text-muted">
          {t("draft.overseasCount", { n: overseas })}
        </span>
      </div>

      {slots.map((s, i) => {
        const meta = s.player ? teamMeta(s.player.teamId) : undefined;
        return (
          <div
            key={`${s.role}-${i}`}
            className={`flex items-center gap-2.5 border-t border-hairline ${
              s.player ? "h-[50px]" : "h-[46px]"
            } ${i === slots.length - 1 ? "border-b" : ""}`}
          >
            <span className="w-[74px] lg:w-[78px] shrink-0 text-[13px] leading-[18px] text-muted">
              {t(`role.${s.role}`)}
            </span>
            {s.player ? (
              <>
                <span className="flex-1 min-w-0 font-medium text-[16px] leading-[22px] truncate">
                  {s.player.player}
                </span>
                {meta && <TeamChip code={meta.code} season={meta.season} colour={meta.colour} />}
                <span className="w-8 shrink-0 text-right font-display font-bold text-[26px] leading-6 pt-[3px] tabular">
                  {hideRatings ? "?" : s.player.overall}
                </span>
              </>
            ) : (
              <span className="flex-1 text-[15px] leading-5 text-faint">{t("draft.notPicked")}</span>
            )}
          </div>
        );
      })}

      {remaining.length > 0 && (
        <p className="text-[13px] leading-[18px] text-loss pt-2">
          {t("draft.overQuota", { names: remaining.map((p) => p.player).join(", ") })}
        </p>
      )}

      {power != null && filled.length > 0 && (
        <div className="flex items-end gap-5 lg:gap-7 pt-4">
          {/* Team power reads off a plate, like every other number on the board. */}
          <Flap
            label={t("xi.teamPower")}
            labelOnPlate={false}
            value={hideRatings ? "?" : Math.round(power)}
            wrapClassName="shrink-0"
            className="w-[112px] h-[78px]"
            valueClassName="text-[48px] leading-[44px]"
          />
          {!hideRatings && bat != null && bowl != null && (
            <div className="flex flex-col gap-1.5 pb-2.5">
              <div className="flex items-baseline gap-2">
                <span className="w-[62px] text-[14px] leading-5 text-muted">{t("xi.batting")}</span>
                <span className="font-semibold text-[15px] leading-5">{t(`unit.${unitWord(bat)}`)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-[62px] text-[14px] leading-5 text-muted">{t("xi.bowling")}</span>
                <span className="font-semibold text-[15px] leading-5">{t(`unit.${unitWord(bowl)}`)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
