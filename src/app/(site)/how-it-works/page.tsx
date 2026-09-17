import type { Metadata } from "next";
import { PageBand } from "@/components/ui";
import {
  A,
  Article,
  FactTable,
  Faq,
  JsonLd,
  Lead,
  List,
  P,
  PlayCta,
  Related,
  Section,
  faqLd,
} from "@/components/Prose";
import { PAGES, SITE_URL, breadcrumbLd, pageMetadata } from "@/lib/site";

const PATH = PAGES.howItWorks;

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: "How to play: IPL draft game rules",
  description:
    "The rules of BuildXI: spin 11 real IPL team-seasons from 2008 to 2025, pick one player from each, build a balanced XI and try to win all 14 league games.",
});

/* Every answer here is also said in the body of the page above it, and
   matches what the game does in code: src/lib/game and src/lib/sim. */
const FAQ = [
  {
    q: "How do I play the BuildXI IPL draft game?",
    a: "Spin eleven real IPL team-seasons from 2008 to 2025. From each squad you pick one player, filling an XI shape with at most four overseas. Then the game plays a simulated season of fourteen league games, and the playoffs if you finish in the top four. The target is 14–0.",
  },
  {
    q: "What are the BuildXI IPL draft rules?",
    a: "Eleven spins, one player from each real team-season squad, and a player can only be in your XI once whichever season he comes from. At most four overseas. Every pick has to fill one of the open places in the XI shape you chose. Easy, Medium and Hard change the number of re-spins, the strength of the opposition, and whether ratings are shown.",
  },
  {
    q: "How many players do I draft in BuildXI?",
    a: "Exactly eleven — one pick from each of eleven squad spins.",
  },
  {
    q: "What does 14–0 mean?",
    a: "Winning all fourteen league games and losing none. It is the hardest thing in the game, and a 14–0 season ranks above every other result on the leaderboard.",
  },
  {
    q: "Which IPL seasons and teams are in the game?",
    a: "All 156 team-seasons from 2008 to 2025, including sides that no longer exist such as Deccan Chargers, Kochi Tuskers Kerala, Pune Warriors India, Gujarat Lions and Rising Pune Supergiant.",
  },
  {
    q: "How many overseas players can I pick?",
    a: "Four at most, the same limit as a real IPL playing XI. The game will not let you take a fifth.",
  },
  {
    q: "How many re-spins do I get?",
    a: "Three on Easy, one on Medium and none on Hard. If a spin lands on a squad with nobody who fits your open slots, you are offered players from other seasons of the same franchise first, and a free re-spin if none of them fit either.",
  },
  {
    q: "What is the difference between Easy, Medium and Hard?",
    a: "The opposition gets stronger at each level, you get fewer re-spins, and on Hard the squad list hides every rating until you have made your pick.",
  },
  {
    q: "Can I play an IPL draft with friends on BuildXI?",
    a: "Yes. Open a multiplayer room for two to five managers, send the invite on WhatsApp, and everyone drafts their own XI into one shared league.",
  },
  {
    q: "How is BuildXI different from Dream11 or IPL fantasy?",
    a: "They are built on different things. Dream11 and the official IPL fantasy game follow live matches: you pick players who are turning out that day and your score follows what they do in real time. BuildXI is a draft game about IPL history — the squads are finished seasons from 2008 to 2025, and your season is simulated the moment your XI is full. There is no live match to wait for, no entry fee and no account.",
  },
  {
    q: "Is BuildXI affiliated with the IPL or BCCI?",
    a: "No. BuildXI is fan-made and not affiliated with the IPL or the BCCI. The player-season ratings are our own judgement, not official numbers.",
  },
  {
    q: "Is BuildXI free?",
    a: "Yes. BuildXI is free in the browser and needs no sign-up or account.",
  },
  {
    q: "How long does a BuildXI game take?",
    a: "About three minutes for a solo season, from the first spin to the final league table.",
  },
];

export default function HowItWorksPage() {
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
              name: "How to play BuildXI",
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: { "@id": `${SITE_URL}/#game` },
              inLanguage: "en-IN",
            },
            breadcrumbLd(PATH, "How it works"),
            faqLd(FAQ),
          ],
        }}
      />
      <PageBand eyebrow="The rules" title="How BuildXI works" />
      <Article>
        <Lead>
          BuildXI is a free IPL draft game. You spin real IPL squads from 2008 to 2025, take one
          player from each, and play a full season with the XI you end up with. The target is the
          one result nobody forgets: fourteen league games, fourteen wins, 14–0.
        </Lead>

        <Section title="1. Spin a squad">
          <P>
            Each spin lands on one real team-season, such as Mumbai Indians 2019, Chennai Super
            Kings 2011 or Deccan Chargers 2009. There are 156 of them, one for every franchise in
            every season from 2008 to 2025, and that includes the sides that have since gone:
            Deccan Chargers, Kochi Tuskers Kerala, Pune Warriors India, Gujarat Lions and Rising
            Pune Supergiant. Each squad is twelve players deep, and no squad comes up twice in the
            same draft.
          </P>
          <P>
            A draft is eleven spins, one for each place in your XI. The squad you land on is the
            only squad you may pick from for that place, so part of the game is deciding what a
            thin squad is still good for.
          </P>
        </Section>

        <Section title="2. Pick one player">
          <P>
            From the squad on the board you take exactly one player, and a player can only be in
            your XI once, whichever season he comes from. Before you start you choose a shape for
            the XI, and every pick has to fill one of its open places.
          </P>
          <FactTable
            head={["Shape", "Openers", "Middle order", "Keeper", "All-rounders", "Pace", "Spin"]}
            rows={[
              ["Balanced", 2, 3, 1, 2, 2, 1],
              ["Pace Attack", 2, 3, 1, 1, 3, 1],
              ["Spin Twins", 2, 3, 1, 2, 1, 2],
              ["Batting Heavy", 2, 4, 1, 1, 2, 1],
            ]}
          />
          <List>
            <li>At most four overseas players, as in a real IPL XI.</li>
            <li>
              A player can fill a place other than his usual one, such as an opener batting in the
              middle order, but he loses a few rating points for it. Keeping wicket is only open
              to genuine keepers. The costs are listed on{" "}
              <A href={PAGES.howRatingsWork}>how ratings work</A>.
            </li>
            <li>
              If a spin lands on a squad with nobody who fits your open places, you are offered
              players from other seasons of the same franchise, nearest seasons first. If none of
              those fit either, the re-spin is free.
            </li>
          </List>
        </Section>

        <Section title="3. Choose how hard it is">
          <FactTable
            head={["Setting", "Re-spins", "Opposition", "Ratings"]}
            rows={[
              ["Easy", 3, "Weaker sides", "Shown"],
              ["Medium", 1, "Standard", "Shown"],
              ["Hard", 0, "Stronger sides", "Hidden until you pick"],
            ]}
          />
          <P>
            On Hard the squad list shows a question mark in place of every rating and is shuffled,
            so you are picking on what you remember about that player&apos;s season, not on a number.
          </P>
        </Section>

        <Section title="4. Play the season">
          <P>
            Your XI plays fourteen league games. Every match is simulated ball by ball over twenty
            overs a side, with your batting line-up against their bowling and the other way round.
            Each side also brings its form for the day, which is why a great XI can still lose on a
            bad night and a tidy one can win a game it had no right to. A tie goes to a Super Over.
          </P>
          <P>
            Finish in the top four and you reach the playoffs. You start in Qualifier 1 against the
            strongest side in the table: win it and you go straight to the final; lose it and you
            get one more knockout for a place in the final. Every knockout is played out ball by
            ball with named players, so you can watch the chase unfold.
          </P>
        </Section>

        <Section title="5. Today's challenge">
          <P>
            Once a day everybody gets the same eleven opening squads, so you can compare the XI
            you built with the one the rest of the country built from the same spins. Re-spins,
            the XI shape and the setting are still yours to choose. The challenge and its board
            reset at midnight IST.
          </P>
          <PlayCta href={PAGES.dailyChallenge} label="Play today's challenge" note="About 3 minutes. No sign-up." />
        </Section>

        <Section title="6. Get on the board">
          <P>
            Every finished season goes on the <A href={PAGES.leaderboard}>leaderboard</A>, under a
            name if you give one and anonymously if you don&apos;t. Each row opens that season game
            by game, so a 14–0 can be shared and looked at, not just claimed. To play the same draft
            against people you know, set up a <A href={PAGES.multiplayer}>multiplayer room</A> and
            send the link on WhatsApp.
          </P>
        </Section>

        <Section title="What BuildXI is, and is not">
          <P>
            Dream11 and the official IPL fantasy game are built on live matches: you pick players
            who are turning out that day, and your score follows what they do in real time. BuildXI
            is a different thing — a draft game about IPL history. The squads are finished seasons,
            your season is simulated the moment your XI is full, and there is no live match to wait
            for, no entry fee and no account.
          </P>
          <P>
            It is fan-made, and not affiliated with the IPL or the BCCI. The ratings are our own
            judgement of each player-season rather than official numbers, and{" "}
            <A href={PAGES.howRatingsWork}>how ratings work</A> sets out how they are arrived at.
          </P>
        </Section>

        <Section title="Questions">
          <Faq items={FAQ} />
        </Section>

        <PlayCta href="/" label="Draft your XI" note="Free, in the browser, about 3 minutes." />

        <Related
          links={[
            { href: PAGES.allTimeXI, title: "The all-time IPL XI", blurb: "The strongest eleven in the game, and who the overseas rule keeps out." },
            { href: PAGES.howRatingsWork, title: "How ratings work", blurb: "What a player's number means and what it costs to play him out of position." },
            { href: PAGES.leaderboard, title: "Leaderboard", blurb: "Today's best seasons, today's challenge and the all-time board." },
            { href: PAGES.multiplayer, title: "Multiplayer", blurb: "Draft against up to four friends in one shared league." },
            { href: PAGES.home, title: "Play BuildXI", blurb: "Spin your first squad." },
          ]}
        />
      </Article>
    </>
  );
}
