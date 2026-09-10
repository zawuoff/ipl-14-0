"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { PrimaryButton } from "./ui";
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
      setError(t(res.reason === "badName" ? "gift.badName" : "gift.badEmail"));
    } catch {
      setError(t("gift.failed"));
    }
    setState("asking");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-5 sm:pb-5 flex justify-center">
      <div className="w-full max-w-[420px] rounded-card bg-plate border border-plate-line shadow-[0_18px_50px_rgba(0,0,0,0.55)] px-5 py-4.5">
        {state === "done" ? (
          <div className="flex items-start gap-3">
            <p className="flex-1 text-[15px] leading-[21px] text-white">{t("gift.thanks")}</p>
            <CloseButton onClick={close} label={t("gift.close")} />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="head-display text-trophy text-[17px] leading-none">
                  {t("gift.title")}
                </p>
                <p className="text-[14px] leading-5 text-body-plate pt-1.5">{t("gift.blurb")}</p>
              </div>
              <CloseButton onClick={close} label={t("gift.close")} />
            </div>

            <form
              className="flex flex-col gap-2 pt-3.5"
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
                className="h-12 rounded-control bg-ground border border-plate-line px-3.5 text-[16px] text-white outline-none focus:border-accent"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("gift.email")}
                type="email"
                inputMode="email"
                maxLength={254}
                autoComplete="email"
                className="h-12 rounded-control bg-ground border border-plate-line px-3.5 text-[16px] text-white outline-none focus:border-accent"
              />
              {error && <p className="text-[13px] leading-[18px] text-loss-soft">{error}</p>}
              <PrimaryButton
                type="submit"
                disabled={!name.trim() || !email.trim() || state === "sending"}
                className="w-full"
              >
                {state === "sending" ? t("gift.sending") : t("gift.send")}
              </PrimaryButton>
              <p className="text-[12px] leading-[17px] text-muted-plate">{t("gift.privacy")}</p>
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
      className="shrink-0 -mr-1 -mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-muted-plate hover:text-white hover:bg-white/10 transition-colors"
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
