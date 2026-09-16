import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

/* The pages that are read rather than played: how it works, the leaderboard,
   multiplayer, ratings. One bar, one footer, the same night ground. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ground text-white flex flex-col">
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}
