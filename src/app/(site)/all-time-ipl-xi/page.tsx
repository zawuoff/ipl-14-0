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
import { ALL_TIME_XI, UNCAPPED_XI, overseasLeftOut, shortlist } from "@/lib/game/allTimeXI";
import { MAX_OVERSEAS, type Role } from "@/lib/game/types";
import { squadCount } from "@/lib/game/squads";

const PATH = PAGES.allTimeXI;

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: "The all-time IPL XI, 2008 to 2025",
  description:
    "The strongest XI you can build from every IPL squad since 2008, under real rules: eleven places, one keeper, four overseas. Who makes it, who the overseas cap keeps out, and the shortlist at every position.",
});

/* Nothing on this page is typed in by hand. The XI, the shortlists and the
   names in the answers all come out of src/lib/game/allTimeXI.ts, which reads
   the same squads and obeys the same rules as the draft. */
const COUNT = squadCount();
const XI = ALL_TIME_XI;
const LEFT_OUT = overseasLeftOut(6);
const CAP_COST = UNCAPPED_XI.total - XI.total;
const TOP_PICK = XI.picks.reduce((a, b) => (b.rating > a.rating ? b : a));
const AWAY = XI.picks.filter((p) => p.overseas);

const named = (p: { player: string; teamName: string; season: number }) =>
  `${p.player} (${p.teamName}, ${p.season})`;
const XI_SENTENCE = XI.picks.map(named).join("; ");

const ROLE_LABEL: Record<Role, string> = {
  Opener: "Openers",
  Middle: "Middle order",
  WK: "Wicketkeeper",
  AR: "All-rounders",
  Pace: "Pace",
  Spin: "Spin",
};

const FAQ = [
  {
    q: "Who is in the all-time IPL XI?",
    a: `Taking the highest-rated season of every player in BuildXI and obeying the real limits — eleven places, one keeper and no more than ${MAX_OVERSEAS} overseas — the strongest XI available is ${XI_SENTENCE}.`,
  },
  {
    q: "How many overseas players can an all-time IPL XI have?",
    a: `Four, the same as a real IPL playing XI. It is the rule that decides the side: the ${MAX_OVERSEAS} places go to ${AWAY.map((p) => p.player).join(", ")}, and every other overseas player is competing for a seat that is already taken.`,
  },
  {
    q: `Why is ${LEFT_OUT[0].player} not in the all-time IPL XI?`,
    a: `Because of the overseas cap, not the rating. ${LEFT_OUT[0].player} is rated ${LEFT_OUT[0].rating}, the highest of any overseas player left out, but the four overseas places are already spent on ${AWAY.map((p) => `${p.player} (${p.rating})`).join(", ")}. Picking him means giving one of those up, and each of them wins their position by more than he wins his.`,
  },
  {
    q: "Who is the highest-rated IPL player in BuildXI?",
    a: `${TOP_PICK.player}, at ${TOP_PICK.rating}, for ${TOP_PICK.teamName} in ${TOP_PICK.season}. He is the only player in the game rated that high.`,
  },
  {
    q: "What would the all-time IPL XI look like without the overseas rule?",
    a: `Stronger, but by less than you would think — ${CAP_COST} rating points across the whole XI. Without the cap the side would take ${UNCAPPED_XI.overseas} overseas players. India's depth at the top of the order and with the new ball is what makes the rule survivable.`,
  },
  {
    q: "Is this the official all-time IPL XI?",
    a: "No. There is no official one. BuildXI is fan-made and not affiliated with the IPL or the BCCI, and the ratings behind this XI are our own judgement of each player-season rather than a statistical ranking.",
  },
];

export default function AllTimeXIPage() {
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
              name: "The all-time IPL XI",
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: { "@id": `${SITE_URL}/#game` },
              inLanguage: "en-IN",
            },
            breadcrumbLd(PATH, "All-time IPL XI"),
            {
              "@type": "ItemList",
              "@id": `${SITE_URL}${PATH}#xi`,
              name: "The all-time IPL XI, 2008 to 2025",
              numberOfItems: XI.picks.length,
              itemListOrder: "https://schema.org/ItemListOrderAscending",
              itemListElement: XI.picks.map((p, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: p.player,
                description: `${ROLE_LABEL[p.role]} — ${p.teamName}, ${p.season}, rated ${p.rating}`,
              })),
            },
            faqLd(FAQ),
          ],
        }}
      />
      <PageBand eyebrow="The XI" title="The all-time IPL XI" />
      <Article>
        <Lead>
          Every IPL squad from 2008 to 2025 is in BuildXI — {COUNT.teams} of them, and{" "}
          {COUNT.players.toLocaleString("en-IN")} player-seasons. This is the strongest eleven you
          can assemble out of all of it while keeping to the rules a real side has to keep to:
          eleven places, one wicketkeeper, and no more than {MAX_OVERSEAS} overseas players.
        </Lead>

        <Section title="The XI">
          <FactTable
            head={["Position", "Player", "Season", "Rating"]}
            rows={XI.picks.map((p) => [
              ROLE_LABEL[p.role],
              p.overseas ? `${p.player} (overseas)` : p.player,
              `${p.teamName}, ${p.season}`,
              p.rating,
            ])}
          />
          <P>
            Eleven players, {XI.overseas} of them overseas, {XI.total} rating points between them.
            No player appears twice, whichever season he comes from, and each one is taken in the
            position he was filed under that year.
          </P>
        </Section>

        <Section title="Why this XI and not another">
          <P>
            The interesting rule is not the eleven places, it is the {MAX_OVERSEAS} overseas ones.
            They are the scarce thing, and the side is built around where they buy the most:{" "}
            {AWAY.map((p) => `${p.player} at ${p.rating}`).join(", ")}. Every other overseas player
            in the competition is bidding for a seat that has already gone.
          </P>
          <P>
            That is how {LEFT_OUT[0].player}, rated {LEFT_OUT[0].rating}, ends up outside an
            all-time XI. So does {LEFT_OUT[1].player} at {LEFT_OUT[1].rating}. Neither is worse
            than the men who beat them in the abstract — they are worse value for a place that
            costs something, and an Indian player of nearly the same rating costs nothing.
          </P>
          <FactTable
            head={["Best overseas players left out", "Position", "Season", "Rating"]}
            rows={LEFT_OUT.map((p) => [
              p.player,
              ROLE_LABEL[p.role],
              `${p.teamName}, ${p.season}`,
              p.rating,
            ])}
          />
        </Section>

        <Section title="What the overseas rule actually costs">
          <P>
            Less than it looks. Switch the cap off and the best XI takes{" "}
            {UNCAPPED_XI.overseas} overseas players and gains {CAP_COST} rating points in total —
            across eleven places, and out of {UNCAPPED_XI.total}. The reason is depth: the
            positions where India is strongest are the same positions where the overseas
            competition is fiercest, so the cap costs a point here and a point there rather than a
            whole player.
          </P>
        </Section>

        <Section title="The shortlist, position by position">
          <P>
            The XI above is one answer. These are the players it was chosen from — the best season
            of every man in the game, ranked, before the overseas rule is applied. An asterisk
            marks an overseas player, which is the column that decides most arguments.
          </P>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <div key={role}>
              <FactTable
                head={[ROLE_LABEL[role], "Season", "Rating", "Overseas"]}
                rows={shortlist(role, 5).map((p) => [
                  p.player,
                  `${p.teamName}, ${p.season}`,
                  p.rating,
                  p.overseas ? "Yes" : "No",
                ])}
              />
            </div>
          ))}
        </Section>

        <Section title="Where the ratings come from">
          <P>
            Each player-season carries one number from 62 to 99. It is our own judgement of what
            that player was that year, not a statistic and not an official ranking — {}
            {TOP_PICK.player} in {TOP_PICK.season} is the only {TOP_PICK.rating} in the game.{" "}
            <A href={PAGES.howRatingsWork}>How ratings work</A> sets out how one number becomes a
            batting and a bowling figure, and what playing a man out of position costs him.
          </P>
          <List>
            <li>
              A season is rated, not a career: the same player appears many times, and only his
              best year can make this XI.
            </li>
            <li>
              BuildXI is fan-made and not affiliated with the IPL or the BCCI.
            </li>
          </List>
        </Section>

        <Section title="Build your own">
          <P>
            The XI above is what the ratings say. The game is the argument with it: you spin eleven
            real squads, take one player from each, and find out whether the side you would have
            picked can win all fourteen. Most of the time the answer is no.
          </P>
          <PlayCta href={PAGES.home} label="Draft your XI" note="Free, in the browser, about 3 minutes." />
        </Section>

        <Section title="Questions">
          <Faq items={FAQ} />
        </Section>

        <Related
          links={[
            { href: PAGES.howItWorks, title: "How it works", blurb: "The rules of the draft, the season and the playoffs." },
            { href: PAGES.howRatingsWork, title: "How ratings work", blurb: "What a player's number means and what it costs to play him out of position." },
            { href: PAGES.leaderboard, title: "Leaderboard", blurb: "Today's best seasons, today's challenge and the all-time board." },
            { href: PAGES.multiplayer, title: "Multiplayer", blurb: "Draft against up to four friends in one shared league." },
          ]}
        />
      </Article>
    </>
  );
}
