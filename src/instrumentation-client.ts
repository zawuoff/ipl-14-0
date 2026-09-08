// Analytics boots here rather than in a provider: this file runs after the HTML
// lands but before hydration, so the first pageview is recorded even if a phone
// on a slow connection never makes it to interactive.
import posthog from "posthog-js";
import { ANALYTICS_HOST } from "@/lib/posthog-hosts";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  try {
    posthog.init(key, {
      // Same-origin: /ingest is rewritten to PostHog in next.config.ts, so the
      // requests survive the ad blockers a cricket audience actually runs.
      api_host: "/ingest",
      ui_host: ANALYTICS_HOST,
      // We capture pageviews ourselves below — the App Router does not reload
      // the document, so PostHog's own listener would only ever see the first.
      capture_pageview: false,
      capture_pageleave: true,
    });
    posthog.capture("$pageview");
  } catch {
    // Never let a blocked script take the board down with it.
  }
}

export function onRouterTransitionStart(url: string) {
  try {
    posthog.capture("$pageview", { $current_url: new URL(url, location.origin).href });
  } catch {}
}
