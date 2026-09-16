import type { Metadata } from "next";

// Where the app lives when there is no window to ask — server renders and
// metadata. Client code should still prefer window.location.origin so preview
// deployments share links back to themselves.
export const SITE_URL = "https://buildxi.in";

/* What the game is, in the words a search result or an answer engine quotes
   back. Plain facts first — IPL, draft, 2008 to 2025, free — because that is
   what somebody types before they have heard of BuildXI. */
export const SITE_TITLE = "BuildXI · Draft an all-time IPL XI and try to go 14–0";
export const SITE_DESCRIPTION =
  "A free IPL draft game. Spin real IPL squads from 2008 to 2025, pick one player from each, and play a full season. Nobody has gone 14–0 yet.";

/* Every page with an address of its own. `dailyChallenge` is the one that is
   not a page: it opens the game straight onto today's squads, and is linked so
   that a reader can get there in one tap. */
export const PAGES = {
  home: "/",
  howItWorks: "/how-it-works",
  leaderboard: "/leaderboard",
  multiplayer: "/multiplayer",
  howRatingsWork: "/how-ratings-work",
  dailyChallenge: "/?play=daily",
  startMultiplayer: "/?play=multiplayer",
} as const;

/* The floodlit trophy card. The file beside the root layout covers the home
   page, but a page that sets its own openGraph loses it, so pages name it. */
const SHARE_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "BuildXI: a gold trophy engraved 14–0 under stadium floodlights, beside the question “Can you go 14–0?”",
};

/* One page's metadata, whole. A segment's openGraph and twitter replace the
   root layout's outright rather than merging into them, so each page states
   all of it: its own title, words and canonical address, and the shared site
   name and picture. */
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  const full = `${title} · BuildXI`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: "BuildXI",
      locale: "en_IN",
      title: full,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [SHARE_IMAGE] },
  };
}

/** Home → page, for the breadcrumb trail search results show under a link. */
export function breadcrumbLd(path: string, name: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "BuildXI", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
}
