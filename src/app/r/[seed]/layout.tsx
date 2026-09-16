import type { Metadata, ResolvingMetadata } from "next";

/* One shared season. There is a page like this for every run ever played, each
   thin and nearly alike, so none of them goes in a search index: the home page
   is the one to find. The link out to it is still followed, and the preview a
   friend sees in WhatsApp is untouched. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ seed: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const { seed } = await params;
  return {
    alternates: { canonical: `/r/${seed}` },
    // Merged by hand: a segment's openGraph replaces its parent's outright,
    // and the preview should keep the game's title, words and picture.
    openGraph: { ...(await parent).openGraph, url: `/r/${seed}` },
    robots: { index: false, follow: true },
  };
}

export default function SharedSeasonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
