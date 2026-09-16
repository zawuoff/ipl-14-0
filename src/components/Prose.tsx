import Link from "next/link";
import type { ReactNode } from "react";

/* The reading pages: rules, the board, rooms, ratings. Same night ground and
   Teko headings as the game, set for reading rather than tapping — a narrow
   measure, Hind at a comfortable size, and headings a crawler can outline. */

export function Article({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[860px] px-5 lg:px-8 pt-6 lg:pt-10 pb-14 flex flex-col gap-9 lg:gap-11">
      {children}
    </article>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[17px] leading-[27px] lg:text-[19px] lg:leading-[30px] text-white/90">{children}</p>;
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3.5 scroll-mt-6">
      <h2 className="head-display text-[28px] leading-[28px] lg:text-[34px] lg:leading-[32px]">{title}</h2>
      {children}
    </section>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold text-[18px] leading-6 pt-1">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[16px] leading-[26px] text-white/80">{children}</p>;
}

export function List({ children, ordered }: { children: ReactNode; ordered?: boolean }) {
  const cls = `flex flex-col gap-2 pl-5 text-[16px] leading-[26px] text-white/80 ${ordered ? "list-decimal" : "list-disc"} marker:text-accent`;
  return ordered ? <ol className={cls}>{children}</ol> : <ul className={cls}>{children}</ul>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-accent font-medium underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
      {children}
    </Link>
  );
}

/** A small table of facts. Real <table> markup: it is tabular, and answer engines read tables well. */
export function FactTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full text-left text-[15px] leading-[22px]">
        <thead>
          <tr className="border-b border-hairline">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold text-[12px] leading-4 tracking-[0.08em] uppercase text-muted whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i ? "border-t border-hairline" : ""}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-4 py-3 font-medium text-white whitespace-nowrap">{c}</th>
                ) : (
                  <td key={j} className="px-4 py-3 text-white/80">{c}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Questions and answers, written out on the page so the FAQ structured data describes what a reader can see. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col">
      {items.map(({ q, a }, i) => (
        <div key={q} className={`py-4 flex flex-col gap-1.5 ${i ? "border-t border-hairline" : ""}`}>
          <h3 className="font-semibold text-[17px] leading-6">{q}</h3>
          <p className="text-[16px] leading-[26px] text-white/80">{a}</p>
        </div>
      ))}
    </div>
  );
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** The call to play. The game reads its mode from the address when it mounts, and coming from another page it always does. */
export function PlayCta({ href, label, note }: { href: string; label: string; note?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-card bg-surface p-5 lg:p-6">
      <Link
        href={href}
        className="h-12 px-8 inline-flex items-center justify-center rounded-full bg-accent text-ground font-semibold text-[16px] hover:bg-accent-deep transition-colors"
      >
        {label}
      </Link>
      {note && <span className="text-[14px] leading-5 text-muted">{note}</span>}
    </div>
  );
}

/** Where to read next. Every page links home and to its neighbours. */
export function Related({ links }: { links: { href: string; title: string; blurb: string }[] }) {
  return (
    <nav aria-label="Related pages" className="flex flex-col gap-3">
      <h2 className="head-display text-[24px] leading-[24px]">Keep reading</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-card bg-surface p-4 hover:bg-[#15296d] transition-colors flex flex-col gap-1">
            <span className="font-semibold text-[16px] leading-[22px] text-accent">{l.title}</span>
            <span className="text-[14px] leading-5 text-muted">{l.blurb}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escaped so no string in it can close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
