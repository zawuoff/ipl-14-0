"use client";
import { useEffect, useRef, useState } from "react";

import { CloseButton, owesAnAnswer } from "./GiftPrompt";
import { Eyebrow, WhatsAppIcon } from "./ui";
import { analytics, type CommunitySurface } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/site";

/* The WhatsApp community, and every door into it.

   The game grew by people forwarding their results to a group chat, so the
   community is the group chat the game keeps for itself. It is offered in
   three ways, each quieter than the last:

   - a few seconds after landing on the home page — on the first visit and on
     every return after that, but no more than once a day, so a regular who
     opens the game five times an evening is asked once, not five times;
   - after a finished run, at most twice in a browser's life and never twice in
     one page load, and never over an unbeaten season, which the gift prompt
     already owns;
   - and a card that simply stays on the page — home, result, room — for
     whoever waved the first two away. The footer carries a link everywhere.

   Tapping join settles it: neither ask comes back once it has been tapped.

   Everything that reads localStorage does it after mount. Both asks start
   closed on the server and on the first paint, so the prerendered home page
   and the browser's first render agree, and there is nothing to hydrate
   against. The cards read nothing at all. */

const JOINED_KEY = "14-0-community-joined";
/* When the welcome ask last went up, in ms. */
const ARRIVAL_KEY = "14-0-community-arrival-at";
const RUN_ASKS_KEY = "14-0-community-run-asks";

/* Long enough for the page to land and be looked at, short enough that it
   still reads as a welcome rather than as an interruption. */
const ARRIVAL_DELAY_MS = 3000;
/* A returning visitor is asked again once this much time has passed. */
const ARRIVAL_EVERY_MS = 24 * 60 * 60 * 1000;
/* The result has to land before anything goes over it. */
const RUN_DELAY_MS = 1800;
const RUN_ASKS_EVER = 2;

/* One ask after a run per page load, however many runs are played in it. */
let runAskedThisLoad = false;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function joined(): boolean {
  return read(JOINED_KEY) === "1";
}

/** Whether the community is set up at all. A constant, so the server and the
    client always agree on it. */
export const communityOn = WHATSAPP_COMMUNITY_URL.length > 0;

function JoinLink({
  surface,
  className = "",
  onJoin,
  autoFocus,
}: {
  surface: CommunitySurface;
  className?: string;
  onJoin?: () => void;
  autoFocus?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <a
      ref={ref}
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        write(JOINED_KEY, "1");
        analytics.communityJoinClicked(surface);
        onJoin?.();
      }}
      className={`flex items-center justify-center gap-2.5 h-14 px-8 rounded-full bg-turf text-white font-semibold text-[17px] whitespace-nowrap hover:bg-[#15702f] active:bg-[#125f28] transition-colors ${className}`}
    >
      <WhatsAppIcon />
      {t("community.join")}
    </a>
  );
}

/* The sheet both asks use. The same shape as the gift prompt, so it reads as
   the game asking a question rather than as an advert. */
function CommunitySheet({
  surface,
  titleKey,
  onDismiss,
  onJoin,
}: {
  surface: CommunitySurface;
  titleKey: string;
  onDismiss: () => void;
  onJoin: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5">
      <button
        type="button"
        aria-label={t("community.notNow")}
        onClick={onDismiss}
        className="absolute inset-0 bg-ground/72 backdrop-blur-[2px]"
        style={{ animation: "gift-scrim 260ms ease-out both" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
        className="gift-card relative w-full sm:max-w-[440px] bg-surface rounded-t-2xl sm:rounded-card shadow-[0_-10px_40px_rgba(0,0,0,0.45)] sm:shadow-[0_24px_60px_rgba(0,0,0,0.55)] px-6 pt-5 pb-[max(26px,calc(env(safe-area-inset-bottom)+18px))] sm:px-8 sm:pt-7 sm:pb-8"
      >
        <span aria-hidden className="sm:hidden block w-9 h-1 rounded-full bg-white/22 mx-auto mb-5" />
        <div className="flex items-start gap-4">
          <div className="flex-1 flex flex-col gap-2.5">
            <Eyebrow>{t("community.eyebrow")}</Eyebrow>
            <p className="head-display text-white text-[23px] sm:text-[26px] leading-none">{t(titleKey)}</p>
            <p className="text-[15px] leading-[22px] text-muted">{t("community.body")}</p>
          </div>
          <CloseButton onClick={onDismiss} label={t("community.notNow")} />
        </div>
        <div className="flex flex-col gap-1 pt-6">
          <JoinLink surface={surface} onJoin={onJoin} autoFocus className="w-full" />
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 text-[14px] leading-5 text-muted hover:text-white transition-colors"
          >
            {t("community.notNow")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The welcome ask: a few seconds after landing on the home page, at most once
    a day, for first-time and returning visitors alike, until they join. */
export function ArrivalCommunityPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!communityOn) return;
    // Someone who went unbeaten and still owes the gift an answer is asked
    // that first; this can wait for another visit.
    if (joined() || owesAnAnswer()) return;
    const last = Number(read(ARRIVAL_KEY) ?? "0") || 0;
    if (Date.now() - last < ARRIVAL_EVERY_MS) return;
    const id = setTimeout(() => {
      write(ARRIVAL_KEY, String(Date.now()));
      analytics.communityPromptShown("arrival");
      setOpen(true);
    }, ARRIVAL_DELAY_MS);
    // Leaving the home page before it fires — straight into a game — cancels
    // it, and it waits for the next visit rather than landing mid-draft.
    return () => clearTimeout(id);
  }, []);

  if (!open) return null;
  return (
    <CommunitySheet
      surface="arrival"
      titleKey="community.title"
      onJoin={() => setOpen(false)}
      onDismiss={() => {
        analytics.communityPromptDismissed("arrival");
        setOpen(false);
      }}
    />
  );
}

/** The ask after a finished run. Mounted by the result screen once it is up. */
export function RunCommunityPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!communityOn || runAskedThisLoad || joined()) return;
    const asks = Number(read(RUN_ASKS_KEY) ?? "0") || 0;
    if (asks >= RUN_ASKS_EVER) return;
    const id = setTimeout(() => {
      runAskedThisLoad = true;
      write(RUN_ASKS_KEY, String(asks + 1));
      analytics.communityPromptShown("run");
      setOpen(true);
    }, RUN_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  if (!open) return null;
  return (
    <CommunitySheet
      surface="run"
      titleKey="community.runTitle"
      onJoin={() => setOpen(false)}
      onDismiss={() => {
        analytics.communityPromptDismissed("run");
        setOpen(false);
      }}
    />
  );
}

/** The card that stays on the page for whoever waved the asks away. */
export function CommunityCard({
  surface,
  className = "",
}: {
  surface: Extract<CommunitySurface, "home" | "result" | "room">;
  className?: string;
}) {
  const t = useT();
  if (!communityOn) return null;
  return (
    <div
      className={`rounded-card bg-surface border border-hairline p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 ${className}`}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Eyebrow>{t("community.eyebrow")}</Eyebrow>
        <p className="font-semibold text-[18px] leading-6 text-white">{t("community.title")}</p>
        <p className="text-[14px] leading-[21px] text-muted">{t("community.body")}</p>
      </div>
      <JoinLink surface={surface} className="sm:shrink-0" />
    </div>
  );
}

/** The footer's link, on every page. */
export function CommunityFooterLink({ className }: { className: string }) {
  const t = useT();
  if (!communityOn) return null;
  return (
    <li>
      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          write(JOINED_KEY, "1");
          analytics.communityJoinClicked("footer");
        }}
        className={className}
      >
        {t("community.footer")}
      </a>
    </li>
  );
}
