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
  // PostHog's ingest endpoints are trailing-slash sensitive.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
