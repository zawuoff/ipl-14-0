import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBand } from "@/components/ui";
import { LiveLeaderboard } from "@/components/Leaderboard";
import { A, Article, JsonLd, Lead, List, P, PlayCta, Related, Section } from "@/components/Prose";
import { PAGES, SITE_URL, breadcrumbLd, pageMetadata } from "@/lib/site";

const PATH = PAGES.leaderboard;

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: "IPL draft leaderboard: today's best XIs",
  description:
    "The live BuildXI leaderboard: the best IPL draft seasons today, in today's challenge and of all time. See who went 14–0 and open any season game by game.",
});

export default function LeaderboardPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${SITE_URL}${PATH}#page`,
              url: `${SITE_URL}${PATH}`,
              name: "BuildXI leaderboard",
              description: "The best BuildXI seasons today, in today's challenge and of all time.",
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: { "@id": `${SITE_URL}/#game` },
              inLanguage: "en-IN",
            },
            breadcrumbLd(PATH, "Leaderboard"),
          ],
        }}
      />
      <PageBand eyebrow="Best seasons by anyone, anywhere" title="BuildXI leaderboard" />
      <Article>
        <Lead>
          Every season finished in BuildXI lands here. The board ranks the best all-time IPL XIs
          people have drafted today, in today&apos;s shared challenge and since the game began, and
          every row opens the full season behind it.
        </Lead>

        {/* Live rows need the browser; the words around them do not. */}
        <Suspense fallback={<p className="text-[15px] text-muted py-4">Loading the board…</p>}>
          <LiveLeaderboard />
        </Suspense>

        <Section title="The three boards">
          <List>
            <li>
              <strong className="text-white font-semibold">Today</strong> is every season finished
              since midnight IST, whichever way it was played.
            </li>
            <li>
              <strong className="text-white font-semibold">Challenge</strong> is only today&apos;s
              challenge, where everyone starts from the same eleven squads. It is the fairest
              comparison on the site. <A href={PAGES.dailyChallenge}>Play today&apos;s challenge</A>.
            </li>
            <li>
              <strong className="text-white font-semibold">All time</strong> is every season ever
              recorded.
            </li>
          </List>
          <P>Each board shows its top hundred. The Today and Challenge boards start again at midnight IST.</P>
        </Section>

        <Section title="How the board is ranked">
          <P>
            Wins alone would put a lucky 11–3 on Rookie above a hard-won title on Legend, so the
            board sorts seasons into three groups first and ranks within each.
          </P>
          <List ordered>
            <li>
              <strong className="text-white font-semibold">Perfect seasons.</strong> Any 14–0 league
              record, even one that went on to lose in the playoffs. Among them, the harder setting
              ranks higher (Legend, then Pro, then Rookie), then a season that also won the title,
              then net run rate.
            </li>
            <li>
              <strong className="text-white font-semibold">Champions.</strong> Seasons that won the
              final. The harder setting ranks higher, then more league wins, then net run rate.
            </li>
            <li>
              <strong className="text-white font-semibold">Everyone else.</strong> More league wins
              first, then reaching the playoffs, then the harder setting, then net run rate.
            </li>
          </List>
        </Section>

        <Section title="Names and seasons">
          <P>
            A row shows the name you entered before your season. Leave it blank and you stay
            anonymous, shown as &quot;Manager&quot; and four characters from a random ID made on your
            device. There are no accounts.
          </P>
          <P>
            Tap any row to open that season: its record, points and net run rate, every league
            result with its score, and the playoffs. It is the same page a player sends when they share a result, so a
            14–0 can be looked at, not just claimed.
          </P>
          <P>
            New to the game? Read <A href={PAGES.howItWorks}>how BuildXI works</A>, or learn what
            decides a season on <A href={PAGES.howRatingsWork}>how ratings work</A>.
          </P>
        </Section>

        <PlayCta href="/" label="Draft your XI" note="Free, in the browser, about 3 minutes." />

        <Related
          links={[
            { href: PAGES.howItWorks, title: "How it works", blurb: "Spins, picks, settings and the season, from the first spin to the final." },
            { href: PAGES.multiplayer, title: "Multiplayer", blurb: "Settle it with friends in one shared league." },
          ]}
        />
      </Article>
    </>
  );
}
