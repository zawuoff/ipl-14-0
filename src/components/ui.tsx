"use client";
import type { ReactNode } from "react";

/* Shared pieces of the scoreboard language: flap cells, team chips, the pick
   strip, stat strips, split score cards, and the button shapes. Everything
   else is plain Tailwind. */

/** Black text on light franchise colours, white on dark ones. */
export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#000000" : "#FFFFFF";
}

/** A card. Every panel in the night layout sits on this navy surface. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`bg-surface rounded-card ${className}`}>{children}</div>;
}

/** Tiny caps label in the accent. Sits above headlines and stat numbers. */
export function Eyebrow({
  children,
  tone = "accent",
  className = "",
}: {
  children: ReactNode;
  tone?: "accent" | "muted" | "trophy";
  className?: string;
}) {
  const colour =
    tone === "trophy" ? "text-trophy" : tone === "muted" ? "text-muted" : "text-accent";
  return (
    <span
      className={`font-semibold text-[11px] lg:text-[12px] leading-4 tracking-[0.08em] uppercase ${colour} ${className}`}
    >
      {children}
    </span>
  );
}

/** One cell of the manual scoreboard: a plate, a hinge line, a big numeral. */
export function Flap({
  label,
  value,
  tone = "plate",
  colour,
  className = "",
  wrapClassName = "",
  valueClassName = "text-[64px] leading-[58px]",
  valueColour,
  labelOnPlate = true,
  labelCentred,
}: {
  label?: string;
  value: ReactNode;
  tone?: "plate" | "turf" | "team";
  colour?: string;
  className?: string;
  wrapClassName?: string;
  valueClassName?: string;
  valueColour?: string;
  labelOnPlate?: boolean;
  labelCentred?: boolean;
}) {
  const bg = tone === "turf" ? "#1A8A3C" : tone === "team" ? colour ?? "#0A0A0A" : "#0A0A0A";
  const bordered = tone === "plate";
  return (
    <div className={`flex flex-col gap-2 min-w-0 ${wrapClassName}`}>
      {label && (
        <div
          className={`text-[13px] leading-[18px] font-medium ${
            labelOnPlate ? "text-muted-plate" : "text-muted"
          } ${labelCentred ? "text-center" : ""}`}
        >
          {label}
        </div>
      )}
      <div
        className={`relative flex items-center justify-center rounded-plate overflow-hidden ${className}`}
        style={{
          backgroundColor: bg,
          border: bordered ? "1px solid var(--color-plate-line)" : "none",
        }}
      >
        <div
          className={`font-display font-bold tabular pt-[0.08em] ${valueClassName}`}
          style={{ color: valueColour ?? "#FFFFFF" }}
        >
          {value}
        </div>
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px]"
          style={{ backgroundColor: "#000000", opacity: tone === "plate" ? 1 : 0.55 }}
        />
      </div>
    </div>
  );
}

/** Franchise colour is the only colour the game chrome allows itself. */
export function TeamChip({
  code,
  season,
  colour,
  className = "",
}: {
  code: string;
  season?: number | string;
  colour: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center h-[22px] px-1.5 pt-[2px] rounded-chip font-display font-semibold text-[15px] leading-[15px] whitespace-nowrap ${className}`}
      style={{ backgroundColor: colour, color: readableOn(colour) }}
    >
      {season ? `${code} ${season}` : code}
    </span>
  );
}

/** Eleven picks, laid out as one bar per slot. */
export function SlotStrip({
  total = 11,
  filled,
  current,
  className = "",
}: {
  total?: number;
  filled: number;
  current?: number;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 ${className}`} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="flex-1 h-1.5 rounded-full"
          style={{
            backgroundColor:
              i === current
                ? "#5AC2FF"
                : i < filled
                  ? "#4FCB74"
                  : "rgba(255,255,255,0.16)",
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- bands */

/** The diagonal speed stripes the IPL uses across its own headers. Decorative
    only: it never carries meaning, so it is hidden from assistive tech. */
export function StripeBand({
  height = 56,
  className = "",
  tone = "accent",
}: {
  height?: number;
  className?: string;
  tone?: "accent" | "trophy";
}) {
  const bright = tone === "trophy" ? "#E0A81C" : "#5AC2FF";
  return (
    <div
      className={`relative overflow-hidden bg-band ${className}`}
      style={{ height }}
      aria-hidden
    >
      <svg
        viewBox="0 0 400 56"
        preserveAspectRatio="xMaxYMid slice"
        className="absolute right-0 top-0 h-full w-[400px]"
      >
        <polygon points="150,0 200,0 110,56 60,56" fill="#2E5BC4" />
        <polygon points="225,0 285,0 195,56 135,56" fill={bright} />
        <polygon points="310,0 335,0 245,56 220,56" fill="#2E5BC4" />
        <polygon points="370,0 425,0 335,56 280,56" fill={bright} />
        <circle cx="345" cy="40" r="46" fill="#2E5BC4" />
        <circle cx="345" cy="40" r="29" fill="#1B3A8F" />
      </svg>
    </div>
  );
}

/** A page header: eyebrow, big Teko title, stripes running off to the right. */
export function PageBand({
  eyebrow,
  title,
  tone = "accent",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: string;
  tone?: "accent" | "trophy";
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-band ${className}`}>
      <svg
        viewBox="0 0 320 96"
        preserveAspectRatio="xMaxYMid slice"
        className="absolute right-0 top-0 h-full w-[320px]"
        aria-hidden
      >
        <polygon points="120,0 180,0 70,96 10,96" fill="#2E5BC4" />
        <polygon points="205,0 265,0 155,96 95,96" fill={tone === "trophy" ? "#E0A81C" : "#5AC2FF"} />
        <polygon points="290,0 320,0 210,96 180,96" fill="#2E5BC4" />
        <circle cx="272" cy="64" r="48" fill="#2E5BC4" />
        <circle cx="272" cy="64" r="30" fill="#1B3A8F" />
      </svg>
      <div className="relative mx-auto w-full max-w-[1440px] px-5 lg:px-16 py-4 lg:py-5 flex flex-col gap-0.5">
        {eyebrow && <Eyebrow tone={tone === "trophy" ? "trophy" : "accent"}>{eyebrow}</Eyebrow>}
        <h1 className="head-display text-[38px] leading-[36px] lg:text-[46px] lg:leading-[42px]">
          {title}
        </h1>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ stat strip */

/** Tiny caps label over a big Teko number, cells split by hairlines. */
export function StatStrip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex bg-surface rounded-card overflow-hidden ${className}`}>{children}</div>
  );
}

export function StatCell({
  label,
  value,
  tone = "plain",
  className = "",
}: {
  label: string;
  value: ReactNode;
  tone?: "plain" | "good" | "bad" | "trophy" | "accent";
  className?: string;
}) {
  const colour =
    tone === "good"
      ? "text-turf-soft"
      : tone === "bad"
        ? "text-loss"
        : tone === "trophy"
          ? "text-trophy"
          : tone === "accent"
            ? "text-accent"
            : "text-white";
  return (
    <div
      className={`flex flex-col items-center gap-0.5 flex-1 min-w-0 px-2 py-3.5 lg:py-4 border-r border-hairline last:border-r-0 ${className}`}
    >
      <span className="font-semibold text-[10px] lg:text-[11px] leading-[14px] tracking-[0.07em] uppercase text-muted whitespace-nowrap">
        {label}
      </span>
      <span
        className={`font-display font-bold text-[32px] leading-[32px] lg:text-[38px] lg:leading-[36px] pt-1 tabular whitespace-nowrap ${colour}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------- split score card */

/** Your side on a black plate, theirs on their own colour, a diagonal seam
    between them and a VS badge on the join. The IPL match-card shape. */
export function SplitScore({
  homeName,
  homeScore,
  homeNote,
  awayName,
  awayScore,
  awayNote,
  awayColour,
  height = "h-[92px]",
  scoreClass = "text-[38px] leading-[36px] lg:text-[42px] lg:leading-[40px]",
}: {
  homeName: string;
  homeScore: ReactNode;
  homeNote?: ReactNode;
  awayName: string;
  awayScore: ReactNode;
  awayNote?: ReactNode;
  awayColour: string;
  height?: string;
  scoreClass?: string;
}) {
  const awayInk = readableOn(awayColour);
  return (
    <div className={`relative flex ${height}`}>
      <div className="flex flex-col justify-center flex-1 min-w-0 pl-4 lg:pl-5 pr-6 bg-plate">
        <span className="font-display font-semibold text-[19px] leading-[21px] text-white truncate">
          {homeName}
        </span>
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className={`font-display font-bold tabular text-white ${scoreClass}`}>
            {homeScore}
          </span>
          {homeNote && (
            <span className="text-[12px] leading-4 text-muted-plate whitespace-nowrap">
              {homeNote}
            </span>
          )}
        </span>
      </div>
      <div
        className="flex flex-col justify-center items-end flex-1 min-w-0 -ml-[26px] pl-8 pr-4 lg:pr-5"
        style={{
          backgroundColor: awayColour,
          clipPath: "polygon(26px 0, 100% 0, 100% 100%, 0 100%)",
        }}
      >
        <span
          className="font-display font-semibold text-[19px] leading-[21px] truncate"
          style={{ color: awayInk }}
        >
          {awayName}
        </span>
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span
            className={`font-display font-bold tabular ${scoreClass}`}
            style={{ color: awayInk }}
          >
            {awayScore}
          </span>
          {awayNote && (
            <span
              className="text-[12px] leading-4 whitespace-nowrap"
              style={{ color: awayInk, opacity: 0.65 }}
            >
              {awayNote}
            </span>
          )}
        </span>
      </div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-band border-2 border-surface pt-[3px] font-display font-bold text-[15px] leading-none text-white">
        VS
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- buttons */

export function PrimaryButton({
  children,
  onClick,
  className = "",
  disabled,
  type = "button",
  tone = "accent",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  tone?: "accent" | "whatsapp";
}) {
  const skin =
    tone === "whatsapp"
      ? "bg-turf text-white hover:bg-[#15702f] active:bg-[#125f28]"
      : "bg-accent text-ground hover:bg-accent-deep active:bg-[#2b98da]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2.5 h-14 px-8 rounded-full font-semibold text-[17px] whitespace-nowrap disabled:opacity-40 transition-colors ${skin} ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  onClick,
  className = "",
  onPlate,
  disabled,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  onPlate?: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full font-semibold text-[15px] text-white transition-colors disabled:opacity-40 ${
    onPlate ? "bg-white/12 hover:bg-white/20" : "bg-white/10 hover:bg-white/18"
  } ${className}`;
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/** Small control that sits on a black plate (speed, skip, re-spin). */
export function PlateButton({
  children,
  onClick,
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center h-9 px-4 rounded-full bg-white/12 text-white font-medium text-[13px] hover:bg-white/20 disabled:opacity-40 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function WhatsAppIcon({ size = 22, fill = "#FFFFFF" }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4l-.5-.3-1.9-.9c-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5h-.6z" />
    </svg>
  );
}

/** A chevron for rows you can walk into. */
export function Chevron({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Section heading, set in Teko caps like a scoreboard header. */
export function SectionHead({
  title,
  note,
  className = "",
}: {
  title: string;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <h2 className="head-display text-[26px] leading-[26px] lg:text-[30px] lg:leading-[28px]">
        {title}
      </h2>
      {note && (
        <>
          <span className="flex-1" />
          <span className="text-[13px] leading-[18px] lg:text-[14px] lg:leading-5 text-muted text-right">
            {note}
          </span>
        </>
      )}
    </div>
  );
}

/** Wordmark. The dash is an en dash so it reads as a scoreline. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold leading-none tracking-[0.01em] ${className}`}>
      14–0
    </span>
  );
}

/** Rating heat, read straight off the tile. Gold is the top shelf, then green,
    then the plate, then the greys. Text colour is picked for contrast. */
export function ratingTone(rating: number): { bg: string; fg: string } {
  if (rating >= 90) return { bg: "#E0A81C", fg: "#000000" };
  if (rating >= 84) return { bg: "#1A8A3C", fg: "#FFFFFF" };
  if (rating >= 78) return { bg: "#0A0A0A", fg: "#FFFFFF" };
  if (rating >= 72) return { bg: "#25355F", fg: "#FFFFFF" };
  return { bg: "#1C2A4D", fg: "rgba(255,255,255,0.7)" };
}

export function Crown({ size = 16, colour = "#E0A81C" }: { size?: number; colour?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={colour} aria-label="Champions" role="img">
      <path d="M3 8.5 6.6 12 12 4.5 17.4 12 21 8.5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

/* --------------------------------------------------------- player tiles */

/** A player on a burst of their franchise colour, the way the IPL prints its
    cap holders. Used for the most-picked row on the home page. */
export function PlayerBurstCard({
  first,
  last,
  chip,
  colour,
  stats,
  footnote,
  className = "",
}: {
  first?: string;
  last: string;
  chip: string;
  colour: string;
  stats: { label: string; value: ReactNode }[];
  footnote?: ReactNode;
  className?: string;
}) {
  const ink = readableOn(colour);
  return (
    <div className={`flex flex-col bg-surface rounded-card overflow-hidden ${className}`}>
      <div
        className="relative flex flex-col justify-end h-[150px] p-3"
        style={{ backgroundColor: colour }}
      >
        <svg
          viewBox="0 0 170 150"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <g fill={ink} opacity="0.12">
            <polygon points="85,150 0,0 32,0" />
            <polygon points="85,150 62,0 104,0" />
            <polygon points="85,150 140,0 170,0" />
            <polygon points="85,150 170,58 170,100" />
            <polygon points="85,150 0,58 0,100" />
          </g>
        </svg>
        <span
          className="absolute right-2.5 top-2.5 inline-flex items-center h-5 px-1.5 pt-[2px] rounded-chip bg-white font-display font-semibold text-[13px] leading-none"
          style={{ color: colour }}
        >
          {chip}
        </span>
        {first && (
          <span
            className="relative font-medium text-[13px] leading-4 truncate"
            style={{ color: ink, opacity: 0.85 }}
          >
            {first}
          </span>
        )}
        <span
          className="relative font-display font-bold text-[30px] leading-[30px] truncate"
          style={{ color: ink }}
        >
          {last}
        </span>
      </div>
      <div className="flex">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center flex-1 min-w-0 px-1 py-2 border-r border-hairline last:border-r-0"
          >
            <span className="font-semibold text-[9px] leading-3 tracking-[0.06em] uppercase text-muted whitespace-nowrap">
              {s.label}
            </span>
            <span className="font-display font-bold text-[22px] leading-6 pt-0.5 tabular whitespace-nowrap">
              {s.value}
            </span>
          </div>
        ))}
      </div>
      {footnote && (
        <div className="px-3 py-2 text-[12px] leading-4 font-semibold text-accent truncate">
          {footnote}
        </div>
      )}
    </div>
  );
}

/** Split a display name into the bit above and the big bit. */
export function splitName(name: string): { first?: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { last: name };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}
