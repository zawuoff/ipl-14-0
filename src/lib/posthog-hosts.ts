// Kept free of imports so next.config.ts can read these without pulling
// posthog-js into the Node build. EU project — data stays in Frankfurt.
export const ANALYTICS_HOST = "https://eu.posthog.com";
export const ANALYTICS_INGEST = "https://eu.i.posthog.com";
export const ANALYTICS_ASSETS = "https://eu-assets.i.posthog.com";
