import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* Everything a person can open is open to crawlers too, answer engines
   included: being quoted when somebody asks for an IPL draft game is the point.

   Kept out: /api and /ingest, which are plumbing and not pages. Shared results
   and rooms (/r, /m) stay crawlable on purpose, because they carry their own
   noindex and a crawler has to be let in to read it. /lab says noindex itself
   for the same reason. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/ingest/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
