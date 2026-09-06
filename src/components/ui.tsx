"use client";
import type { ReactNode } from "react";

/* Shared pieces of the scoreboard language: flap cells, team chips, the pick
   strip, and the two button shapes. Everything else is plain Tailwind. */

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
  const bg = tone === "turf" ? "#1A8A3C" : tone === "team" ? colour ?? "#141414" : "#141414";
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
        className={`relative flex items-center justify-center rounded-lg overflow-hidden ${className}`}
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
          className="flex-1 h-2 rounded-[2px]"
          style={{
            backgroundColor:
              i === current ? "#1A8A3C" : i < filled ? "#000000" : "#E4E4E4",
          }}
        />
      ))}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center h-14 px-8 rounded-control bg-turf text-white font-semibold text-[17px] whitespace-nowrap hover:bg-[#15702f] active:bg-[#125f28] disabled:opacity-45 transition-colors ${className}`}
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
  const cls = `inline-flex items-center justify-center h-12 px-4 rounded-control border-[1.5px] font-semibold text-[15px] transition-colors disabled:opacity-40 ${
    onPlate
      ? "border-white text-white hover:bg-white/10"
      : "border-ink text-ink hover:bg-panel"
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
      className={`inline-flex items-center justify-center h-9 px-3.5 rounded-control border border-[#4A4A4A] text-white font-medium text-[13px] hover:bg-white/10 disabled:opacity-40 transition-colors ${className}`}
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

/** Section heading with an optional right-hand note, used across every screen. */
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
      <h2 className="font-semibold text-[17px] leading-[22px] lg:text-[20px] lg:leading-[26px]">
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
    then ink, then the greys. Text colour is picked for contrast. */
export function ratingTone(rating: number): { bg: string; fg: string } {
  if (rating >= 90) return { bg: "#E0A81C", fg: "#000000" };
  if (rating >= 84) return { bg: "#1A8A3C", fg: "#FFFFFF" };
  if (rating >= 78) return { bg: "#000000", fg: "#FFFFFF" };
  if (rating >= 72) return { bg: "#4A4A4A", fg: "#FFFFFF" };
  return { bg: "#8A8A8A", fg: "#FFFFFF" };
}

export function Crown({ size = 16, colour = "#E0A81C" }: { size?: number; colour?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={colour} aria-label="Champions" role="img">
      <path d="M3 8.5 6.6 12 12 4.5 17.4 12 21 8.5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

