import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/site";

/* The pages with an address of their own. Query-string doors into the game
   (/?play=daily) are not pages, and shared seasons and rooms are noindex, so
   neither belongs here.

   lastModified is when the words on the page last changed, not the build
   time: a date that moves on every deploy teaches a crawler to ignore it. The
   home page and the board change every day, and say so. */
const WORDS_CHANGED = "2026-09-17";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number,
    lastModified: string | Date = WORDS_CHANGED
  ) => ({ url: `${SITE_URL}${path === "/" ? "/" : path}`, lastModified, changeFrequency, priority });

  return [
    page(PAGES.home, "daily", 1, new Date()),
    page(PAGES.howItWorks, "monthly", 0.8),
    page(PAGES.leaderboard, "daily", 0.8, new Date()),
    page(PAGES.allTimeXI, "monthly", 0.8),
    page(PAGES.multiplayer, "monthly", 0.7),
    page(PAGES.howRatingsWork, "monthly", 0.6),
  ];
}
