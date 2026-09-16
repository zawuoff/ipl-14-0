"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconButton, Logo, SoundIcon } from "@/components/ui";
import { useMuted } from "@/lib/sound";
import { useT, LangToggle } from "@/lib/i18n";
import { PAGES } from "@/lib/site";

/* The header and footer every page shares. Each item is a real link to a real
   route, so a crawler can walk the site from any page, and a reader can open
   any of it in a new tab. The home page's game bar reuses SiteNav and adds its
   own run controls around it. */

const NAV: { href: string; label: string }[] = [
  { href: PAGES.howItWorks, label: "nav.howItWorks" },
  { href: PAGES.leaderboard, label: "nav.leaderboard" },
  { href: PAGES.multiplayer, label: "nav.playAFriend" },
  { href: PAGES.howRatingsWork, label: "nav.howRatingsWork" },
];

const navLink = "text-[15px] leading-5 font-medium transition-colors hover:text-accent";

export function SiteNav({ className = "" }: { className?: string }) {
  const t = useT();
  const path = usePathname();
  return (
    <nav aria-label="Main" className={`items-center gap-7 ${className}`}>
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={`${navLink} ${path === href ? "text-accent" : "text-white/80"}`}
        >
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}

/** The bar for pages that are not the game: wordmark home, the four pages, sound and language. */
export function SiteHeader() {
  const t = useT();
  const path = usePathname();
  const [muted, toggleMuted] = useMuted();
  return (
    <header className="bg-band">
      <div className="relative mx-auto w-full max-w-[1440px] px-3 lg:px-10 h-[56px] lg:h-[72px] flex items-center">
        <SiteNav className="hidden lg:flex" />
        <Link
          href="/"
          aria-label="BuildXI home"
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"
        >
          <Logo className="text-[30px] lg:text-[40px]" />
        </Link>
        <span className="flex-1" />
        <div className="shrink-0 flex items-center gap-1 lg:gap-3">
          <IconButton
            onClick={toggleMuted}
            label={muted ? t("run.soundOff") : t("run.soundOn")}
            className="w-10"
          >
            <SoundIcon on={!muted} />
          </IconButton>
          <LangToggle plain className="w-10 h-9 lg:w-[46px] lg:h-[34px] text-[13px] lg:text-[14px]" />
        </div>
      </div>
      {/* A phone has no room beside the wordmark, so the pages sit on a strip of their own. */}
      <nav aria-label="Pages" className="lg:hidden border-t border-white/10 overflow-x-auto">
        <div className="flex gap-5 px-4 h-11 items-center whitespace-nowrap">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={`text-[14px] leading-5 font-medium ${path === href ? "text-accent" : "text-white/80"}`}
            >
              {t(label)}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 min-w-[150px]">
      <span className="font-semibold text-[12px] leading-4 tracking-[0.08em] uppercase text-muted">{title}</span>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

const footerLink = "text-[14px] leading-5 font-medium text-accent hover:underline";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={footerLink}>
        {children}
      </Link>
    </li>
  );
}

/* Opens the game on a mode. A full page load on purpose: the home page reads
   the mode once as it mounts, and this footer also sits on the home page,
   where a client-side hop to the same route would change nothing. */
function GameLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} className={footerLink}>
        {children}
      </a>
    </li>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-8 lg:py-12 flex flex-col lg:flex-row gap-8 lg:gap-16">
        <div className="flex flex-col gap-3 lg:flex-1 max-w-[520px]">
          <Link href="/" aria-label="BuildXI home" className="self-start">
            <Logo className="text-[26px]" />
          </Link>
          <p className="text-[13px] leading-5 text-faint">{t("footer.legal")}</p>
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-7">
          <FooterColumn title={t("footer.play")}>
            <FooterLink href="/">{t("footer.playClassic")}</FooterLink>
            <GameLink href={PAGES.dailyChallenge}>{t("home.daily.title")}</GameLink>
            <FooterLink href={PAGES.multiplayer}>{t("home.friend.title")}</FooterLink>
            <FooterLink href={PAGES.leaderboard}>{t("nav.leaderboard")}</FooterLink>
          </FooterColumn>
          <FooterColumn title={t("footer.learn")}>
            <FooterLink href={PAGES.howItWorks}>{t("nav.howItWorks")}</FooterLink>
            <FooterLink href={PAGES.howRatingsWork}>{t("nav.howRatingsWork")}</FooterLink>
          </FooterColumn>
        </div>
      </div>
    </footer>
  );
}
