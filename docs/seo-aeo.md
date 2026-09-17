# SEO and AEO notes

Three changes raised on 17 Sep 2026, recorded with the reasoning behind each.
Status is against the code as it stood that day, not against what was asked for
— two of the three were already true.

The distinction that runs through all of it: **SEO** is about ranking a page a
person then clicks, **AEO** is about being the text a model quotes when nobody
clicks at all. They mostly want the same things, but not always, and where they
diverge it is worth knowing which one a change is for.

---

## 1. No `/privacy` and no `/contact`

**Status: already true.** Neither route exists. `src/app` has five indexable
pages — `/`, `/how-it-works`, `/how-ratings-work`, `/leaderboard`,
`/multiplayer` — and `sitemap.ts` lists exactly those five. The only matches for
"privacy" in the source are `gift.privacy`, a UI string in the gift prompt.

**SEO.** On a five-page site, two boilerplate pages would be 40% of the
crawlable surface carrying no rankable content. Nothing on a privacy page
answers a query anyone types. Keeping them out means every URL in the sitemap is
one that can earn a click.

**AEO.** A model building a picture of the site reads what it can crawl. Legal
boilerplate adds no facts about what BuildXI *is*, and a contact page with no
real address behind it reads as a trust negative rather than a positive. The
same crawl budget spent on `/how-it-works` produces quotable material instead.

**The caveat, recorded honestly.** There are two futures where this flips:

- **Ads.** Google AdSense and Google Ads both require a privacy policy. If
  BuildXI is ever monetised that way, the page becomes mandatory, not optional.
- **Data law.** The site sets a device id and runs PostHog. Traffic is not only
  Indian — the UK, EU, US and UAE all show up in analytics. GDPR (UK/EU) and
  India's DPDP Act both expect a disclosure of what is collected and why.

Neither is urgent while the site is free, unauthenticated and pre-scale, and the
call was made deliberately. But the reason to add a privacy note later will be
legal, not SEO, and it should be written as a short honest paragraph rather than
a generated template.

---

## 2. One H1, one line

**Status: open. This is the real change of the three.**

The current markup ships two headlines inside a single `<h1>` and picks between
them with CSS:

```tsx
<h1 className="head-display ...">
  <span className="lg:hidden">{t("home.headline.mobile")}</span>
  <span className="hidden lg:inline">{t("home.headline.desktop")}</span>
</h1>
```

Both spans are always in the DOM. `lg:hidden` and `hidden lg:inline` change what
a human sees; they do not change what is in the HTML. So the text content of the
H1, to anything that reads the markup rather than rendering it, is:

> Draft an all-time IPL XI. Then try to win every single game.The scoreboard nobody has filled in yet.

That is the "three jammed sentences" — two from the mobile string, one from the
desktop string, concatenated with no space. Google renders CSS and will usually
attribute this correctly. Plainer text extractors, and most AI crawlers, will
not.

**SEO.** The H1 is the strongest on-page signal after `<title>`. Two problems
compound here. The concatenation is the first. The second is that the desktop
line — *"The scoreboard nobody has filled in yet"* — contains no noun anyone
searches for: no "IPL", no "draft", no "game", no "XI". It is good copy and a
bad heading. On the largest viewport, the single most weighted element on the
page targets nothing.

**AEO.** When someone asks a model "is there a game where I draft an all-time
IPL XI", the answer is assembled from crisp declarative sentences. The H1 should
read like the first line of the answer you want back. A line of poetry gives a
model nothing to lift.

**What to do.** One H1, identical at every width, carrying the words people
actually search:

> **Draft an all-time IPL XI**

Then move the rest down a level, where it does no harm and still does its job:

- `app.tagline` eyebrow — already "Fan-made IPL draft game", already right.
- `home.sub` keeps the mechanic and the hook: spin real squads 2008–2025, one
  player from each, win all fourteen and the board reads 14–0.
- *"The scoreboard nobody has filled in yet"* is the best line on the site.
  Keep it — as the sub-line, the eyebrow, or the section head above the board.
  It just should not be the H1.

Losing the mobile/desktop split is the point, not a side effect. One URL should
have one H1.

---

## 3. FAQ section plus FAQPage JSON-LD on `/how-it-works`

**Status: already shipped.** `src/app/(site)/how-it-works/page.tsx` holds a
seven-entry `FAQ` array, renders it as a visible "Questions" section via
`<Faq items={FAQ} />`, and emits the structured data through `faqLd(FAQ)`
(`src/components/Prose.tsx`), which builds a proper `FAQPage` with `Question`
and `acceptedAnswer` nodes. Questions cover how to play, what 14–0 means, which
seasons are included, the overseas limit, re-spins, the difficulty settings, and
whether it is free.

**SEO — with a correction worth knowing.** Since 2023 Google has restricted FAQ
rich results to well-known government and health sites. For a game, the starred
FAQ dropdown in the SERP is almost certainly not coming back. So the JSON-LD's
value here is *parsing*, not *rich results* — do not expect a visual change in
Google. The on-page question text still earns long-tail traffic on its own
merits, because the headings match how people phrase the query.

**AEO — this is where it pays.** A question written the way a user asks it,
followed by a short factual answer, is close to the ideal unit of retrieval.
It is the most quotable format there is, and `FAQPage` makes the pairing
explicit rather than something a model has to infer from headings. This is the
clearest case on the site where the SEO return is now modest and the AEO return
is high, which is a good reason to keep investing in it even though the rich
result is gone.

**Where it went next (17 Sep 2026).** The original seven answered what the game
is, and missed the comparison and intent queries that are exactly what people
ask a model. The set is now thirteen, adding the draft-rules phrasings people
search, the multiplayer question, the Dream11 comparison, the affiliation
answer, and game length as a question of its own. A body section, *What BuildXI
is, and is not*, carries the same two claims in prose, because every answer in
the FAQ is also said above it on the page.

The home page now carries its own three-question block — what BuildXI is, how a
draft is played, and whether it is free — with a matching `FAQPage` node. Both
pages were checked after build: every question and answer string in the
structured data is present verbatim in the rendered HTML, which is the
requirement that most often breaks silently.

Still open: nothing on the site targets "is there a free IPL fantasy game",
which is a different query from "is BuildXI free".

---

## The rule that outranks all three

Page copy must match the code. An FAQ that says something the game does not do
is worse than no FAQ, because a model will repeat the error confidently and at
scale — and unlike a wrong sentence on a page a person reads, there is nothing
to correct once it has been quoted.

The code has real surprises to check against before editing any of these pages:
player ratings are hand-set integers in `squads-*.json` rather than derived from
statistics, the runs and wickets on a player card are synthesised from that
rating, team "power" penalties never reach the simulation, and solo playoffs do
not use the IPL format although rooms do. Re-read `src/lib/game`, `src/lib/sim`
and `convex/results.ts` before changing a factual claim on any content page.
