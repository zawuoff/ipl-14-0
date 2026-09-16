import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* One page. The leaderboard, the daily challenge and multiplayer are screens
   of it reached by query string, and those all name "/" as canonical, so
   listing them here would only hand a crawler duplicates. Shared results and
   rooms are noindex and have no place in a sitemap.

   The board changes every day, and "daily" says so. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
