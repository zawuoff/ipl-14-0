import type { Metadata, ResolvingMetadata } from "next";

/* A multiplayer room lives for one evening and belongs to the handful of
   people invited to it, so it stays out of search. The link out to the home
   page is still followed, and the invite preview is untouched. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const { code } = await params;
  return {
    alternates: { canonical: `/m/${code}` },
    // Merged by hand: a segment's openGraph replaces its parent's outright,
    // and the preview should keep the game's title, words and picture.
    openGraph: { ...(await parent).openGraph, url: `/m/${code}` },
    robots: { index: false, follow: true },
  };
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
