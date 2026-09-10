"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { Eyebrow, PrimaryButton } from "./ui";
import { useT } from "@/lib/i18n";

/* The card for an unbeaten season has to be posted somewhere, so this is the
   one place in the game that asks for a name and an address.

   It only ever appears after fourteen wins and the cup, once the celebration
   has finished and the screen is the reader's again — never over the top of it.
   It is asked once per device and then never again, whether it was filled in,
   dismissed, or ignored, because a second ask would be nagging somebody who has
   already given their answer.

   Nothing is stored locally except the fact that the question has been put. */

const ASKED_KEY = "14-0-gift-asked";

function alreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    // No storage to read means no memory of asking. Asking again is the kinder
    // failure than never asking at all.
    return false;
  }
}

function markAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {}
}

/* Whether the question has been put is read the same way the mute switch is:
   as an external store, so the server and the first paint agree on "not
   showing" and the client corrects itself once localStorage is readable. */
const NEVER_CHANGES = () => () => {};

type State = "asking" | "sending" | "done";

export function GiftPrompt({ seed, deviceId }: { seed: string; deviceId: string }) {
  const t = useT();
  const claim = useMutation(api.gifts.claim);

  const asked = useSyncExternalStore(NEVER_CHANGES, alreadyAsked, () => true);
  const [dismissed, setDismissed] = useState(false);
  const open = !asked && !dismissed;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("asking");
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) firstField.current?.focus();
  }, [open]);

  if (!open) return null;

  const close = () => {
    markAsked();
    setDismissed(true);
  };

  const send = async () => {
    if (state === "sending") return;
    setError(null);
    setState("sending");
    try {
      const res = await claim({ seed, deviceId, name, email });
      if (res.ok) {
        markAsked();
        setState("done");
        return;
      }
      // Each refusal says what actually went wrong. "notEarned" is very nearly
      // always a race rather than a cheat: the season's own row is still on its
      // way to the server while this form is already on screen.
      setError(
        t(
          res.reason === "badName"
            ? "gift.badName"
            : res.reason === "notEarned"
              ? "gift.notEarned"
              : "gift.badEmail"
        )
      );
    } catch {
      setError(t("gift.failed"));
    }
    setState("asking");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5">
      {/* Dimming the run behind it is what makes this read as a question rather
          than as a banner that drifted in. Tapping it is an answer too. */}
      <button
        type="button"
        aria-label={t("gift.close")}
        onClick={close}
        className="absolute inset-0 bg-ground/72 backdrop-blur-[2px]"
        style={{ animation: "gift-scrim 260ms ease-out both" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("gift.title")}
        className="gift-card relative w-full sm:max-w-[440px] bg-surface rounded-t-2xl sm:rounded-card shadow-[0_-10px_40px_rgba(0,0,0,0.45)] sm:shadow-[0_24px_60px_rgba(0,0,0,0.55)] px-6 pt-5 pb-[max(26px,calc(env(safe-area-inset-bottom)+18px))] sm:px-8 sm:pt-7 sm:pb-8"
      >
        {/* the bar a thumb expects at the top of a sheet */}
        <span
          aria-hidden
          className="sm:hidden block w-9 h-1 rounded-full bg-white/22 mx-auto mb-5"
        />

        {state === "done" ? (
          <div className="flex items-start gap-4 py-1.5">
            <div className="flex-1 flex flex-col gap-2.5">
              <Eyebrow tone="trophy">{t("gift.sent")}</Eyebrow>
              <p className="text-[16px] leading-[23px] text-white">{t("gift.thanks")}</p>
            </div>
            <CloseButton onClick={close} label={t("gift.close")} />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className="flex-1 flex flex-col gap-2.5">
                <Eyebrow tone="trophy">{t("inv.title")}</Eyebrow>
                <p className="head-display text-white text-[23px] sm:text-[26px] leading-none">
                  {t("gift.title")}
                </p>
                <p className="text-[15px] leading-[22px] text-muted">{t("gift.blurb")}</p>
              </div>
              <CloseButton onClick={close} label={t("gift.close")} />
            </div>

            <form
              className="flex flex-col gap-3 pt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                ref={firstField}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("gift.name")}
                maxLength={60}
                autoComplete="name"
                className="h-14 rounded-control bg-plate border border-plate-line px-4 text-[16px] text-white placeholder:text-muted-plate outline-none focus:border-accent transition-colors"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("gift.email")}
                type="email"
                inputMode="email"
                maxLength={254}
                autoComplete="email"
                className="h-14 rounded-control bg-plate border border-plate-line px-4 text-[16px] text-white placeholder:text-muted-plate outline-none focus:border-accent transition-colors"
              />
              {error && <p className="text-[13px] leading-[18px] text-loss-soft">{error}</p>}
              <PrimaryButton
                type="submit"
                disabled={!name.trim() || !email.trim() || state === "sending"}
                className="w-full mt-1.5"
              >
                {state === "sending" ? t("gift.sending") : t("gift.send")}
              </PrimaryButton>
              <p className="text-[12px] leading-[17px] text-faint text-center pt-1">
                {t("gift.privacy")}
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 -mr-1.5 -mt-1 w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-white hover:bg-white/10 transition-colors"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path
          d="M5 5l14 14M19 5L5 19"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
