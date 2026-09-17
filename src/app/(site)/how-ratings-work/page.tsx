import type { Metadata } from "next";
import { PageBand } from "@/components/ui";
import { A, Article, FactTable, H3, JsonLd, Lead, List, P, PlayCta, Related, Section } from "@/components/Prose";
import { PAGES, SITE_URL, breadcrumbLd, pageMetadata } from "@/lib/site";

const PATH = PAGES.howRatingsWork;

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: "How player ratings work",
  description:
    "Every IPL player-season in BuildXI has one rating from 62 to 99. What it means, what playing out of position costs, and how ratings decide a match.",
});

/* Every number on this page is read off the code, not remembered:
   ratings and derived skills  src/lib/game/squads.ts
   off-role costs              src/lib/game/roles.ts
   team strength and the sim   src/lib/sim/engine.ts
   If any of those change, this page has to change with them. */

export default function HowRatingsWorkPage() {
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
              name: "How BuildXI player ratings work",
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: { "@id": `${SITE_URL}/#game` },
              inLanguage: "en-IN",
            },
            breadcrumbLd(PATH, "How ratings work"),
          ],
        }}
      />
      <PageBand eyebrow="Behind the numbers" title="How ratings work" />
      <Article>
        <Lead>
          Every player in BuildXI is rated season by season, not once for a whole career. Virat
          Kohli is 99 in 2016 and 72 in 2022. Picking the right player is half the game; picking the
          right season of him is the other half.
        </Lead>

        <Section title="One number per season">
          <P>
            The game has 156 squads of twelve, which makes 1,872 player-seasons across 436 players.
            Each one carries a single rating between 62 and 99. It is a hand-set judgement of how good
            that player was in that IPL season, in the role he played for that team. It is not
            worked out by a formula from a stats table, and it is not an official rating from the
            IPL or anyone else.
          </P>
          <FactTable
            head={["Player", "Team", "Season", "Role", "Rating"]}
            rows={[
              ["Virat Kohli", "Royal Challengers Bangalore", 2016, "Opener", 99],
              ["Chris Gayle", "Royal Challengers Bangalore", 2012, "Opener", 98],
              ["Jasprit Bumrah", "Mumbai Indians", 2020, "Pace", 96],
              ["Andre Russell", "Kolkata Knight Riders", 2019, "All-rounder", 96],
              ["Sunil Narine", "Kolkata Knight Riders", 2012, "Spin", 96],
              ["MS Dhoni", "Chennai Super Kings", 2018, "Keeper", 92],
              ["Rashid Khan", "Gujarat Titans", 2023, "Spin", 93],
            ]}
          />
          <P>
            The same player moves a long way between seasons. Bumrah goes from 74 in his first
            season in 2013 to 96 in 2020. Narine is a 96 as a spinner in 2012 and a 96 again in 2024,
            this time as an all-rounder who opened the batting.
          </P>
          <FactTable
            head={["Rating", "Colour in the game", "Player-seasons"]}
            rows={[
              ["90 to 99", "Gold", 80],
              ["84 to 89", "Green", 324],
              ["78 to 83", "Black", 662],
              ["72 to 77", "Navy", 542],
              ["62 to 71", "Faded navy", 264],
            ]}
          />
          <P>Only 80 player-seasons in the whole game are rated 90 or more, which is about one in twenty-three.</P>
        </Section>

        <Section title="Batting and bowling">
          <P>
            A match needs to know how well a player bats and how well he bowls, so the one rating is
            split into both, according to the role he played that season.
          </P>
          <FactTable
            head={["Role", "Batting", "Bowling"]}
            rows={[
              ["Opener, middle order, keeper", "The rating", "30% of the rating, between 5 and 40"],
              ["Pace or spin bowler", "28% of the rating, between 5 and 38", "The rating"],
              ["All-rounder", "The rating minus 2, at least 40", "The rating minus 4, at least 40"],
            ]}
          />
          <P>
            So Kohli in 2016 bats at 99 and bowls at 30, Bumrah in 2024 bowls at 94 and bats at 26,
            and an all-rounder rated 90 bats at 88 and bowls at 86. All-rounders give up a little at
            each skill to be useful at both.
          </P>
        </Section>

        <Section title="Playing out of position">
          <P>
            If a player filled more than one role in his IPL career, every one of those roles is his
            own in every season, at no cost. Kohli batted in the middle order for years before he
            opened, so Kohli 2016 can bat at three for the full 99.
          </P>
          <P>
            Outside his own roles a player can still fill some places, but he loses rating points
            for it, taken off his overall rating and off the skill that place uses.
          </P>
          <FactTable
            head={["From", "To", "Points lost"]}
            rows={[
              ["Opener", "Middle order", 3],
              ["Opener", "Keeper", 4],
              ["Middle order", "Opener", 5],
              ["Middle order", "Keeper", 4],
              ["Keeper", "Middle order", 2],
              ["Keeper", "Opener", 6],
              ["All-rounder", "Middle order, pace or spin", 4],
              ["Pace or spin bowler", "All-rounder", 8],
            ]}
          />
          <List>
            <li>Any move not in the table is not allowed: a spinner never becomes a seamer, and a specialist batter never bowls.</li>
            <li>Keeping wicket is only open to genuine keepers, and a keeper can only open if he actually opened in the IPL.</li>
            <li>An all-rounder moved into the attack has to bowl the way he really bowled, pace or spin.</li>
            <li>A handful of genuine two-role cricketers lose only half the usual points, and never less than one.</li>
          </List>
        </Section>

        <Section title="From ratings to results">
          <H3>Your team&apos;s batting and bowling</H3>
          <P>
            Your team&apos;s batting is the average batting of your openers, middle order, keeper and
            all-rounders. Its bowling is the average bowling of your all-rounders, pace bowlers and
            spinners. All-rounders count in both, which is why a good one is worth so much. Every
            pick moves one of those averages, so one weak pick costs a side in every match it plays.
          </P>
          <H3>Inside a match</H3>
          <P>
            Each innings is played ball by ball over twenty overs. The gap between the batting side&apos;s
            batting and the bowling side&apos;s bowling sets the chance of a wicket on each ball, from
            about one in thirty-five to one in twelve, and tilts dot balls towards fours and sixes. A
            chase that falls behind the rate takes more risks and loses more wickets.
          </P>
          <H3>Form</H3>
          <P>
            Before each league game both sides get a form swing of up to 16 points either way on
            their batting and on their bowling. Most days it is small, sometimes it is not, and that
            is why the best XI in the room still loses games and why 14–0 is so rare.
          </P>
          <H3>The opposition</H3>
          <FactTable
            head={["Setting", "League opponents", "Playoff opponents"]}
            rows={[
              ["Easy", "About 75 to 85", "About 78 to 88"],
              ["Medium", "77 to 87", "80 to 90"],
              ["Hard", "About 81 to 91", "About 84 to 94"],
            ]}
          />
          <P>
            Opponents are rated on the same scale as your XI, and each league opponent&apos;s strength
            is drawn fresh for that game within the range for your setting. Playoff sides are picked
            from the top of that range and above it.
          </P>
        </Section>

        <Section title="What the stats on player cards are">
          <P>
            Player cards in the game show runs, strike rate, wickets or economy next to the rating.
            Those figures are illustrations drawn from the rating, so a higher-rated batter shows more
            runs at a faster strike rate. They give a feel for the kind of season a rating stands for.
            They are not that player&apos;s real IPL figures, and they play no part in the simulation.
          </P>
        </Section>

        <P>
          Ready to put it to use? Read <A href={PAGES.howItWorks}>how the draft works</A> or go straight
          to the game.
        </P>
        <PlayCta href="/" label="Draft your XI" note="Free, in the browser, about 3 minutes." />

        <Related
          links={[
            { href: PAGES.howItWorks, title: "How it works", blurb: "Spins, picks, XI shapes and settings." },
            { href: PAGES.leaderboard, title: "Leaderboard", blurb: "Whose ratings added up to the best season today." },
          ]}
        />
      </Article>
    </>
  );
}
