import type { Metadata } from "next";
import { PageBand } from "@/components/ui";
import { A, Article, FactTable, JsonLd, Lead, List, P, PlayCta, Related, Section } from "@/components/Prose";
import { PAGES, SITE_URL, breadcrumbLd, pageMetadata } from "@/lib/site";

const PATH = PAGES.multiplayer;

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: "Play an IPL draft with friends on WhatsApp",
  description:
    "Open a BuildXI room, send the link on WhatsApp and let 2 to 5 managers draft their own all-time IPL XI. One shared league and IPL-style playoffs decide it.",
});

export default function MultiplayerPage() {
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
              name: "BuildXI multiplayer",
              description: "Draft an all-time IPL XI against friends in one shared league.",
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: { "@id": `${SITE_URL}/#game` },
              inLanguage: "en-IN",
            },
            breadcrumbLd(PATH, "Multiplayer"),
          ],
        }}
      />
      <PageBand eyebrow="Draft against your friends" title="BuildXI multiplayer" />
      <Article>
        <Lead>
          Every cricket group chat has had the argument about whose all-time IPL XI is better. A
          BuildXI room settles it: everyone drafts their own XI from real IPL squads, then all of
          them play in the same league, against each other and the franchises, until one side lifts
          the trophy.
        </Lead>

        <PlayCta href={PAGES.startMultiplayer} label="Create a room" note="Free, no sign-up. Invites go out on WhatsApp." />

        <Section title="How a room works">
          <List ordered>
            <li>
              <strong className="text-white font-semibold">Open a room.</strong> Choose how many
              managers will play, from 2 to 5 including you, and the setting: Rookie, Pro or Legend.
              The room gets a six-character code.
            </li>
            <li>
              <strong className="text-white font-semibold">Send the invite.</strong> Share the room
              link on WhatsApp, or copy it anywhere else. A friend opens it and takes an open seat.
              Nobody needs an account.
            </li>
            <li>
              <strong className="text-white font-semibold">Everyone drafts.</strong> Each manager
              spins their own squads and builds their own XI under the same rules and the same
              setting. See <A href={PAGES.howItWorks}>how the draft works</A>.
            </li>
            <li>
              <strong className="text-white font-semibold">The league plays out.</strong> Once every
              seat is filled and every XI is locked, the season starts on its own. If somebody never
              turns up, the host can close the empty seats and play with whoever has joined, as long
              as there are at least two of you.
            </li>
          </List>
        </Section>

        <Section title="The league">
          <P>
            A room league always has ten teams: the managers, and IPL franchises to fill the rest of
            the table. Every team plays every other team twice, so each side plays
            eighteen games and you meet each of your friends twice. Games between two managers are
            played ball by ball.
          </P>
          <FactTable
            head={["", "Solo season", "Multiplayer room"]}
            rows={[
              ["Managers", "1", "2 to 5"],
              ["Teams in the league", "10", "10"],
              ["League games each", "14", "18"],
              ["Playoffs", "Top four, with a second chance", "IPL format: Qualifier 1, Eliminator, Qualifier 2, Final"],
              ["Who wins", "The final", "The final, and a franchise can win it"],
            ]}
          />
          <P>
            The top four go through to the playoffs in the IPL&apos;s own format: first plays second
            in Qualifier 1, third plays fourth in the Eliminator, and the Qualifier 2 winner meets the
            Qualifier 1 winner in the final. Whoever wins the final wins the room, so topping the
            table is not enough, and if all of you slip up a franchise can take the trophy instead.
          </P>
        </Section>

        <Section title="Challenge a friend from a finished season">
          <P>
            Had a season worth showing off? When a solo season ends you can challenge a friend
            straight from the result. That opens a room with your XI already locked in and your
            record next to it, and your friend drafts to beat it.
          </P>
        </Section>

        <Section title="Tips for a good room">
          <List>
            <li>Agree the setting first. Legend hides every rating, which makes it a test of memory rather than arithmetic.</li>
            <li>Everyone spins their own squads, so nobody can take a player from you. The limit of four overseas players applies to every manager, so spend those places on the picks that matter most.</li>
            <li>
              Every pick counts. A team&apos;s batting is the average of its batters and all-rounders,
              and its bowling the average of its all-rounders and bowlers, so one weak pick drags a
              whole side down. <A href={PAGES.howRatingsWork}>How ratings work</A> has the detail.
            </li>
            <li>
              Want to play alone first? Try a solo season or <A href={PAGES.dailyChallenge}>today&apos;s
              challenge</A>, then check where you stand on the <A href={PAGES.leaderboard}>leaderboard</A>.
            </li>
          </List>
        </Section>

        <PlayCta href={PAGES.startMultiplayer} label="Create a room" note="Takes a minute to set up." />

        <Related
          links={[
            { href: PAGES.howItWorks, title: "How it works", blurb: "The draft rules every manager in the room plays under." },
            { href: PAGES.leaderboard, title: "Leaderboard", blurb: "The best solo seasons today and of all time." },
          ]}
        />
      </Article>
    </>
  );
}
