"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { Eyebrow, PrimaryButton } from "./ui";
import { useT } from "@/lib/i18n";

/* The card for an unbeaten season has to be posted somewhere, so this is the
   one place in the game that asks for a name and an address.

   It appears twice at most, and only ever for a run that went fourteen wins
   and the cup. Once when the celebration has finished and the screen is the
   reader's again, never over the top of it; and if that ask went unanswered,
   once more the next time they open the game, because the thing that earned it
   happens once in a few thousand runs and a mistimed thumb should not cost it.
   After that it is done, whichever way it was answered.

   Which of the two asks this is decides only which key remembers it, so the two
   cannot silence each other. Nothing is stored locally except the fact that the
   question has been put.

   Whether to ask at all is the caller's decision, not this component's. Both
   deciding meant both had to agree on the exact moment the key was written, and
   they did not: the caller marked it as the form went up, this component read
   the mark on its first render, and the form vanished before it was ever seen.
   Now it renders when it is mounted, and closes when it is answered. */

export const ASKED_KEY = "14-0-gift-asked";
export const ASKED_AGAIN_KEY = "14-0-gift-asked-again";
/* Set when an ask is closed without an answer, cleared when one is given.

   It exists so the second ask costs nothing to not need. Without it the game
   would have to ask the server "does this browser owe me anything?" on every
   single page load, for every reader, to catch the handful who went unbeaten
   and closed the form. The browser already knows, so it answers first. */
const OWED_KEY = "14-0-gift-owed";

function readKey(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    // No storage to read means no memory of asking. Asking again is the kinder
    // failure than never asking at all.
    return false;
  }
}

export function alreadyAsked(key: string): boolean {
  return readKey(key);
}

/** Whether this browser walked away from an ask without answering it. */
export function owesAnAnswer(): boolean {
  return readKey(OWED_KEY);
}

export function markAsked(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {}
  // Deliberately not written back into the cache below. Marking has to be
  // invisible to a caller that is already showing the form, or answering it
  // would pull it off the screen before the thank-you could be read.
}

/* Settled once per page load and then held.

   useSyncExternalStore calls getSnapshot on every render, so reading
   localStorage live would mean the act of recording "asked" yanked the form out
   from under whoever was typing in it. Caching also matches the question being
   asked, which is about how this browser arrived, not how it is now.

   The cost is that going unbeaten twice without reloading would ask twice. That
   is two fourteen-nils in one page load, and the second claim overwrites the
   first, so it is a fair trade for the form staying put. */
const settled = new Map<string, boolean>();

/** Whether this browser still owes an answer. False on the server and on the
    first paint, so nothing flashes before localStorage can be read. */
export function useMayAsk(key: string): boolean {
  const read = useCallback(() => {
    let v = settled.get(key);
    if (v === undefined) {
      v = readKey(key);
      settled.set(key, v);
    }
    return !v;
  }, [key]);
  return useSyncExternalStore(NEVER_CHANGES, read, () => false);
}

/* Whether the question has been put is read the same way the mute switch is:
   as an external store, so the server and the first paint agree on "not
   showing" and the client corrects itself once localStorage is readable. */
const NEVER_CHANGES = () => () => {};

type State = "asking" | "sending" | "done";

export function GiftPrompt({
  seed,
  deviceId,
  askKey = ASKED_KEY,
  blurbKey = "gift.blurb",
}: {
  seed: string;
  deviceId: string;
  /** Which ask this is. The two remember themselves separately. */
  askKey?: string;
  blurbKey?: string;
}) {
  const t = useT();
  const claim = useMutation(api.gifts.claim);

  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed;

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
    markAsked(askKey);
    // Walked away from it. Worth one more ask next time, and worth the one
    // query it takes to find out.
    markAsked(OWED_KEY);
    setDismissed(true);
  };

  const send = async () => {
    if (state === "sending") return;
    setError(null);
    setState("sending");
    try {
      const res = await claim({ seed, deviceId, name, email });
      if (res.ok) {
        // A filled-in form settles both asks at once: there is nothing left to
        // chase, so the second one must never fire.
        markAsked(ASKED_KEY);
        markAsked(ASKED_AGAIN_KEY);
        try {
          localStorage.removeItem(OWED_KEY);
        } catch {}
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
                <p className="text-[15px] leading-[22px] text-muted">{t(blurbKey)}</p>
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
