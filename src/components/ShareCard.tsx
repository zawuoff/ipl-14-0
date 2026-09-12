"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { analytics } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { useT } from "@/lib/i18n";
import { withVia, type ShareVia } from "@/lib/share";
import { canShareFile, downloadBlob, renderShareImage } from "@/lib/share-image";
import type { SeasonResult } from "@/lib/sim/engine";
import { WhatsAppIcon } from "./ui";

/* The season, handed over.

   A finished run used to end in three buttons in a column, which is a form,
   not a trophy. This is the trophy: the board's own card, lifted off the page
   on a bit of perspective so it reads as a thing you could pick up, with every
   way out of the game underneath it.

   The tilt follows the pointer because a card that answers the hand is the
   cheapest way to say "this is an object". It rests at a slight angle rather
   than flat so that it still reads as one on a phone, where there is no
   pointer to follow. Reduced motion flattens the drift; the rest is transform,
   which costs nothing.

   Instagram is the reason `share-image.ts` exists: it takes neither text nor a
   link, so the card is redrawn onto a canvas and the picture is what travels. */

type Cell = { value: string; label: string; colour: string };

export function ShareCard({
  result,
  seed,
  spins,
  headline,
  modeLabel,
  difficultyLabel,
  rankLabel,
  shareText,
  surface,
  onClose,
}: {
  result: SeasonResult;
  seed: string;
  spins: string[];
  headline: string;
  modeLabel: string;
  difficultyLabel: string;
  rankLabel: string;
  shareText: (via: ShareVia) => string;
  surface: "report" | "plate";
  onClose: () => void;
}) {
  const t = useT();
  const gold = result.champion;

  const [tilt, setTilt] = useState({ x: 7, y: -9 });
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const boardUrl = `${origin}/r/${seed}`;
  const prettyUrl = boardUrl.replace(/^https?:\/\//, "");

  const say = useCallback((msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 3200);
  }, []);

  /* ---- the picture, built only when somebody asks for it ---- */
  const makeImage = useCallback(
    async (channel: "instagram" | "image") => {
      if (busy) return;
      setBusy(true);
      let blob: Blob | null = null;
      try {
        blob = await renderShareImage({
          result,
          headline,
          mode: modeLabel,
          difficulty: difficultyLabel,
          url: prettyUrl,
          labels: {
            won: t("word.won"),
            lost: t("word.lost"),
            points: t("word.points"),
            nrr: t("word.nrr"),
            rank: rankLabel,
            onTheTable: t("word.onTheTable"),
            orange: t("share.orangeCap"),
            purple: t("share.purpleCap"),
          },
        });
      } catch {
        blob = null;
      }
      setBusy(false);
      if (!blob) {
        say(t("share.imageFailed"));
        return;
      }
      const file = new File([blob], `buildxi-${seed}.png`, { type: "image/png" });
      if (channel === "instagram" && canShareFile(file)) {
        try {
          await navigator.share({ files: [file], text: shareText("copy") });
          analytics.seasonShared("instagram", surface);
        } catch {
          // Waved away at the OS sheet. Nothing to report and nothing to fix.
        }
        return;
      }
      downloadBlob(blob, file.name);
      analytics.seasonShared(channel === "instagram" ? "instagram" : "image", surface);
      say(t(channel === "instagram" ? "share.igSaved" : "share.saved"));
    },
    [
      busy,
      result,
      headline,
      modeLabel,
      difficultyLabel,
      prettyUrl,
      rankLabel,
      seed,
      shareText,
      surface,
      say,
      t,
    ]
  );

  const plates: Cell[] = [
    { value: String(result.wins), label: t("word.won"), colour: "#4FCB74" },
    {
      value: String(result.losses),
      label: t("word.lost"),
      colour: result.losses ? "#FF5A47" : "#FFFFFF",
    },
  ];

  const boxes = [
    ...result.games.map((g) => (g.result === "W" ? "#1A8A3C" : "#FF5A47")),
    ...result.playoffs.map((p) => (p.result === "W" ? "#E0A81C" : "#FF5A47")),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("share.title")}
      className="fixed inset-0 z-50 flex flex-col"
    >
      {/* The run goes dark behind it. There is no panel and no sheet: the card
          is the only lit thing on the screen, which is the whole point of
          handing it over. Anywhere off the card closes. */}
      <button
        type="button"
        aria-label={t("share.close")}
        onClick={onClose}
        className="absolute inset-0 bg-ground/96 backdrop-blur-[10px]"
        style={{ animation: "gift-scrim 260ms ease-out both" }}
      />

      <div className="relative shrink-0 flex justify-end px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("share.close")}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <path
              d="M1 1l13 13M14 1L1 14"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* ------------------------------------------- the card, on its own */}
      <div className="relative flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-5 py-2 [perspective:900px]">
        <div className="share-in w-full max-w-[368px] sm:max-w-[412px]">
          <div
            className="share-float"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = (e.clientX - r.left) / r.width - 0.5;
              const py = (e.clientY - r.top) / r.height - 0.5;
              setTilt({ x: 7 - py * 17, y: -9 + px * 22 });
            }}
            onPointerLeave={() => setTilt({ x: 7, y: -9 })}
          >
            <div
              className="share-tilt relative rounded-card"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* The slab behind the face. Without a second surface set back in
                  space, a tilted rectangle is just a rectangle at an angle. */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-card"
                style={{
                  background: "linear-gradient(160deg, #0b1a4a, #040a1f)",
                  transform: "translateZ(-20px) scale(1.035)",
                  boxShadow: "0 40px 60px -26px rgba(0,0,0,0.9)",
                }}
              />
              {/* the floodlight the card is standing under */}
              <span
                aria-hidden
                className="absolute -inset-6 rounded-card blur-2xl opacity-45"
                style={{
                  background: gold
                    ? "radial-gradient(60% 50% at 50% 40%, rgba(224,168,28,0.5), transparent 70%)"
                    : "radial-gradient(60% 50% at 50% 40%, rgba(90,194,255,0.42), transparent 70%)",
                  transform: "translateZ(-40px)",
                }}
              />

              <div
                className="relative overflow-hidden rounded-card"
                style={{
                  background: "linear-gradient(155deg, #16307f 0%, #10215c 46%, #071238 100%)",
                  boxShadow: `0 1px 0 rgba(255,255,255,0.22) inset, 0 -30px 60px rgba(0,0,0,0.35) inset, 0 30px 54px -20px rgba(0,0,0,0.85), 0 0 0 1px ${
                    gold ? "rgba(224,168,28,0.35)" : "rgba(90,194,255,0.22)"
                  }`,
                }}
              >
                {/* the band and its stripes, the same rake as the site header */}
                <div className="relative h-[52px] bg-band overflow-hidden">
                  <svg
                    viewBox="0 0 360 52"
                    preserveAspectRatio="xMaxYMid slice"
                    className="absolute inset-0 h-full w-full"
                    aria-hidden
                  >
                    <polygon points="196,0 226,0 176,52 146,52" fill="#2E5BC4" />
                    <polygon points="244,0 282,0 232,52 194,52" fill={gold ? "#E0A81C" : "#5AC2FF"} />
                    <polygon points="298,0 314,0 264,52 248,52" fill="#2E5BC4" />
                    <polygon points="330,0 368,0 318,52 280,52" fill={gold ? "#E0A81C" : "#5AC2FF"} />
                  </svg>
                  <div
                    className="relative h-full px-4 flex items-center justify-between"
                    style={{ transform: "translateZ(18px)" }}
                  >
                    <span className="head-display text-[19px] leading-none tracking-[0.06em]">
                      BuildXI
                    </span>
                    <span className="font-semibold text-[9px] leading-none tracking-[0.14em] uppercase text-white bg-ground/75 rounded-chip px-2 py-[5px]">
                      {difficultyLabel}
                    </span>
                  </div>
                </div>

                <div
                  className="px-4 pt-3.5 pb-4"
                  style={{ transform: "translateZ(14px)", transformStyle: "preserve-3d" }}
                >
                  <span className="font-semibold text-[9px] leading-none tracking-[0.16em] uppercase text-white/60">
                    {modeLabel}
                  </span>
                  <p
                    className={`head-display text-[27px] leading-[27px] pt-1.5 ${
                      gold ? "text-trophy" : "text-white"
                    }`}
                  >
                    {headline}
                  </p>

                  {/* the two plates, forward of everything else on the face */}
                  <div
                    className="flex gap-2.5 pt-3"
                    style={{ transform: "translateZ(16px)" }}
                  >
                    {plates.map((cell) => (
                      <div
                        key={cell.label}
                        className="flex-1 rounded-plate bg-plate px-3 pt-2 pb-1.5 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)]"
                      >
                        <span className="block font-semibold text-[9px] leading-none tracking-[0.16em] uppercase text-muted-plate">
                          {cell.label}
                        </span>
                        <span className="block border-t border-plate-line mt-2" />
                        <span
                          className="block font-display font-bold text-[58px] leading-[52px] text-center tabular pt-0.5"
                          style={{ color: cell.colour }}
                        >
                          {cell.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-[3px] items-center pt-3.5" aria-hidden>
                    {boxes.map((fill, i) => (
                      <span
                        key={i}
                        className="flex-1 h-2 rounded-[2px]"
                        style={{ backgroundColor: fill }}
                      />
                    ))}
                  </div>

                  <div className="flex items-end gap-4 pt-3.5">
                    {[
                      { v: String(result.points), l: t("word.points"), c: "#FFFFFF" },
                      {
                        v: `${result.nrr > 0 ? "+" : ""}${result.nrr}`,
                        l: t("word.nrr"),
                        c: result.nrr >= 0 ? "#FFFFFF" : "#FF5A47",
                      },
                      {
                        v: rankLabel,
                        l: t("word.onTheTable"),
                        c: result.madePlayoffs ? "#5AC2FF" : "#FFFFFF",
                      },
                    ].map((s) => (
                      <div key={s.l} className="flex-1 min-w-0">
                        <span className="block font-semibold text-[8px] leading-[11px] tracking-[0.14em] uppercase text-white/55 truncate">
                          {s.l}
                        </span>
                        <span
                          className="block font-display font-bold text-[26px] leading-[26px] tabular"
                          style={{ color: s.c }}
                        >
                          {s.v}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-white/14 flex flex-col gap-2">
                    {[
                      {
                        k: t("share.orangeCap"),
                        who: result.orangeCap.player,
                        n: result.orangeCap.runs,
                        c: "#FF822A",
                      },
                      {
                        k: t("share.purpleCap"),
                        who: result.purpleCap.player,
                        n: result.purpleCap.wickets,
                        c: "#A76BFF",
                      },
                    ].map((row) => (
                      <div key={row.k} className="flex items-center gap-2.5">
                        <span
                          className="w-[3px] h-6 shrink-0 rounded-full"
                          style={{ backgroundColor: row.c }}
                        />
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-[8px] leading-[11px] tracking-[0.14em] uppercase text-white/55">
                            {row.k}
                          </span>
                          <span className="font-medium text-[13px] leading-[17px] truncate">
                            {row.who}
                          </span>
                        </span>
                        <span
                          className="shrink-0 font-display font-bold text-[22px] leading-[22px] tabular"
                          style={{ color: row.c }}
                        >
                          {row.n}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="pt-3 text-[10px] leading-none text-accent truncate">{prettyUrl}</p>
                </div>

                {/* The light on the face.

                    A flat white band laid diagonally across everything read as
                    a stripe painted on the card rather than as light falling on
                    it, and it greyed out whatever it crossed. This is a single
                    soft source instead: a wide pool that slides the opposite
                    way to the turn, the way a reflection does, blended so it
                    lifts what is under it rather than veiling it. */}
                <span
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    mixBlendMode: "soft-light",
                    background: `radial-gradient(130% 82% at ${50 - tilt.y * 2.9}% ${
                      34 + tilt.x * 2.6
                    }%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.42) 26%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0) 72%)`,
                  }}
                />
                {/* the rim the light catches on the edge tipped towards it */}
                <span
                  aria-hidden
                  className="absolute inset-0 pointer-events-none rounded-card"
                  style={{
                    boxShadow: `inset 0 ${tilt.x > 0 ? 1 : -1}px 0 rgba(255,255,255,${(
                      0.1 +
                      Math.min(Math.abs(tilt.x), 16) * 0.016
                    ).toFixed(3)}), inset ${tilt.y > 0 ? 1 : -1}px 0 0 rgba(255,255,255,${(
                      0.05 +
                      Math.min(Math.abs(tilt.y), 20) * 0.009
                    ).toFixed(3)})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------- the ways out, along the bottom edge */}
      <div className="share-up relative shrink-0 w-full max-w-[440px] mx-auto px-5 pt-3 pb-[max(18px,env(safe-area-inset-bottom))]">
        <div className="flex gap-2.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText("wa"))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics.seasonShared("whatsapp", surface)}
            className="flex-1 flex items-center justify-center gap-2 h-[52px] rounded-full bg-turf text-white font-semibold text-[15px] hover:bg-[#15702f] active:bg-[#125f28] transition-colors"
          >
            <WhatsAppIcon size={20} />
            WhatsApp
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => makeImage("instagram")}
            className="flex-1 flex items-center justify-center gap-2 h-[52px] rounded-full text-white font-semibold text-[15px] disabled:opacity-60 transition-opacity hover:opacity-92"
            style={{
              background:
                "linear-gradient(62deg, #F9A825 0%, #E8453C 34%, #C32AA3 66%, #7B35C9 100%)",
            }}
          >
            <InstagramIcon size={19} />
            {busy ? t("share.drawing") : "Instagram"}
          </button>
        </div>

        <div className="flex gap-2.5 pt-2.5">
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(shareText("copy"))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics.seasonShared("x", surface)}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-white/10 hover:bg-white/18 text-white font-semibold text-[14px] transition-colors"
          >
            <XIcon size={15} />
            {t("share.post")}
          </a>
          <button
            type="button"
            onClick={async () => {
              if (await copyText(shareText("copy"))) {
                analytics.seasonShared("copy", surface);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-white/10 hover:bg-white/18 text-white font-semibold text-[14px] transition-colors"
          >
            <LinkIcon size={15} />
            {copied ? t("share.copied") : t("share.copyShort")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => makeImage("image")}
            aria-label={t("share.saveImage")}
            title={t("share.saveImage")}
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/18 disabled:opacity-60 transition-colors"
          >
            <DownloadIcon size={16} />
          </button>
        </div>

        {/* Same eleven squads, their own XI. A different thing from sending a
            result, so it gets its own line rather than a fourth icon. */}
        <div className="mt-3 pt-3 border-t border-hairline flex flex-col gap-1.5">
          {/* This was the one share in the game that only ever reached the
              clipboard, on the assumption the sender would paste it somewhere
              themselves. Everywhere the game offers both, WhatsApp beats copy
              about four to one — so the dare leads with WhatsApp now, and the
              clipboard stays underneath for a desktop that has no share sheet. */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              t("share.beatMyBoard", {
                url: withVia(`${origin}/?challenge=${spins.join(",")}`, "wa"),
              })
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics.seasonShared("challenge", surface)}
            className="w-full flex items-center justify-center gap-2 h-[52px] rounded-full bg-accent text-ground font-semibold text-[15px] hover:bg-accent-deep transition-colors"
          >
            <SwordsIcon size={17} />
            {t("share.challenge")}
          </a>
          <button
            type="button"
            onClick={async () => {
              const url = withVia(`${origin}/?challenge=${spins.join(",")}`, "copy");
              if (await copyText(t("share.beatMyBoard", { url }))) {
                analytics.seasonShared("challenge", surface);
                setChallengeCopied(true);
                setTimeout(() => setChallengeCopied(false), 2400);
              }
            }}
            className="min-h-11 flex items-center justify-center text-[13px] leading-[18px] text-muted text-center hover:text-white transition-colors"
          >
            {challengeCopied ? t("share.linkCopied") : t("share.copyShort")}
          </button>
          <p className="text-[12px] leading-[17px] text-muted text-center">
            {challengeCopied ? t("share.challengePasteNote") : t("share.challengeNote")}
          </p>
        </div>

        <p
          aria-live="polite"
          className={`pt-2 text-[12px] leading-[17px] text-center transition-opacity ${
            note ? "opacity-100 text-accent" : "opacity-0"
          }`}
        >
          {note ?? " "}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="#FFFFFF" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.2" stroke="#FFFFFF" strokeWidth="1.9" />
      <circle cx="17.4" cy="6.6" r="1.25" fill="#FFFFFF" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
      <path d="M18.2 2H21l-6.4 7.3L22 22h-5.9l-4.6-6-5.3 6H3.4l6.9-7.8L2.3 2h6l4.2 5.5L18.2 2zm-1 18h1.6L7.9 3.7H6.2L17.2 20z" />
    </svg>
  );
}

function LinkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 14.5l5-5M11 6.5l1.6-1.6a4 4 0 115.6 5.6L16.6 12M13 17.5l-1.6 1.6a4 4 0 11-5.6-5.6L7.4 12"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SwordsIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3h4l11 11M3 21l7-7M21 3h-4l-4 4M21 21h-4l-2.5-2.5M3 21v-4"
        stroke="#071238"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
