import type { Metadata } from "next";

/* Benches are for looking at things that are hard to reach in the game itself.
   They are not pages, and there is no robots.txt to keep them out of a search
   index, so they say so themselves. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
