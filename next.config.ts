import type { NextConfig } from "next";

import { ANALYTICS_ASSETS, ANALYTICS_INGEST } from "./src/lib/posthog-hosts";

const nextConfig: NextConfig = {
  // PostHog goes out through our own origin, so blockers that drop
  // requests to posthog.com don't quietly erase half the audience.
  rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${ANALYTICS_ASSETS}/static/:path*` },
      { source: "/ingest/:path*", destination: `${ANALYTICS_INGEST}/:path*` },
    ];
  },
  /* One origin, not two.

     Both the apex and www answer, and everything this game remembers about a
     person — the device id, the streak, the language, whether the card prompt
     has been asked — lives in localStorage, which belongs to one origin and
     not the other. Somebody who arrived on www and came back on the bare
     address was a stranger again: no streak, asked for their address a second
     time, and counted twice. In the first four days that was 89 people on one
     and 103 on the other.

     `/ingest` is left out of it so a page still open on www can finish posting
     its analytics: a redirect there would make the request cross-origin and
     the events would be dropped rather than moved. */
  redirects() {
    return [
      {
        source: "/:path((?!ingest/).*)",
        has: [{ type: "host", value: "www.buildxi.in" }],
        destination: "https://buildxi.in/:path",
        permanent: true,
      },
    ];
  },
  // PostHog's ingest endpoints are trailing-slash sensitive.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
