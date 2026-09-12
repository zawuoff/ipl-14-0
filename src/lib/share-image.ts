"use client";
/* The season as a picture.

   Instagram takes no text and no link — a story is an image or it is nothing.
   So the card on screen gets drawn a second time onto a canvas at a size a
   phone is happy to post, and that PNG is what goes out: to the share sheet
   where one exists, and to the downloads folder where it does not.

   Everything here is the board's own furniture — navy ground, band and
   stripes across the top, black plates, Teko numerals — so the picture that
   lands in somebody's feed is recognisably the same game. */

import type { SeasonResult } from "@/lib/sim/engine";

const W = 1080;
const H = 1350;

const GROUND = "#071238";
const SURFACE = "#10215C";
const BAND = "#1B3A8F";
const STRIPE = "#2E5BC4";
const ACCENT = "#5AC2FF";
const TROPHY = "#E0A81C";
const TURF = "#1A8A3C";
const LOSS = "#FF5A47";
const PLATE = "#0A0A0A";

function fontStack(which: "teko" | "hind"): string {
  if (typeof window === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(which === "teko" ? "--font-teko" : "--font-hind")
    .trim();
  return `${v || (which === "teko" ? "Teko" : "Hind")}, sans-serif`;
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** One leaning stripe, the same rake as the bands on the site. */
function stripe(
  c: CanvasRenderingContext2D,
  topLeft: number,
  width: number,
  top: number,
  height: number,
  lean: number,
  fill: string
): void {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(topLeft, top);
  c.lineTo(topLeft + width, top);
  c.lineTo(topLeft + width - lean, top + height);
  c.lineTo(topLeft - lean, top + height);
  c.closePath();
  c.fill();
}

export type ShareImageInput = {
  result: SeasonResult;
  /** "Champions." / "Knocked out in the final." — already in the reader's language. */
  headline: string;
  /** "Classic" / "Daily · 11 Sept" */
  mode: string;
  difficulty: string;
  /** Shown along the bottom, without the protocol. */
  url: string;
  labels: {
    won: string;
    lost: string;
    points: string;
    nrr: string;
    rank: string;
    onTheTable: string;
    orange: string;
    purple: string;
  };
};

/** Draws the card and hands back a PNG. Returns null if the canvas is refused. */
export async function renderShareImage(input: ShareImageInput): Promise<Blob | null> {
  const { result: r, labels } = input;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return null;

  // Teko is what makes it look like the board rather than like a screenshot of
  // a spreadsheet, so it is worth waiting for.
  try {
    await document.fonts.ready;
  } catch {}
  const teko = fontStack("teko");
  const hind = fontStack("hind");
  const gold = r.champion;

  /* ---- ground ---- */
  const bg = c.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, SURFACE);
  bg.addColorStop(1, GROUND);
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  /* ---- the band across the top, stripes running off the right edge ---- */
  const bandH = 190;
  c.fillStyle = BAND;
  c.fillRect(0, 0, W, bandH);
  stripe(c, 600, 70, 0, bandH, 130, STRIPE);
  stripe(c, 730, 82, 0, bandH, 130, gold ? TROPHY : ACCENT);
  stripe(c, 862, 36, 0, bandH, 130, STRIPE);
  stripe(c, 950, 70, 0, bandH, 130, gold ? TROPHY : ACCENT);

  c.font = `700 46px ${teko}`;
  c.fillStyle = "#FFFFFF";
  c.textBaseline = "alphabetic";
  c.letterSpacing = "2px";
  c.fillText("BUILDXI", 72, 96);
  c.font = `600 26px ${hind}`;
  c.fillStyle = "rgba(255,255,255,0.72)";
  c.letterSpacing = "3px";
  c.fillText(`${input.mode.toUpperCase()} · ${input.difficulty.toUpperCase()}`, 72, 144);
  c.letterSpacing = "0px";

  /* ---- the headline ---- */
  let y = bandH + 104;
  c.font = `700 84px ${teko}`;
  c.fillStyle = gold ? TROPHY : "#FFFFFF";
  const head = input.headline.toUpperCase();
  c.fillText(head.length > 26 ? head.slice(0, 25) + "…" : head, 72, y);

  /* ---- the two plates ---- */
  y += 56;
  const plateW = 420;
  const plateH = 300;
  const gap = 24;
  for (const [i, cell] of (
    [
      [String(r.wins), labels.won, "#4FCB74"],
      [String(r.losses), labels.lost, r.losses ? LOSS : "#FFFFFF"],
    ] as const
  ).entries()) {
    const x = 72 + i * (plateW + gap);
    c.fillStyle = PLATE;
    roundRect(c, x, y, plateW, plateH, 14);
    c.fill();
    // the hinge every plate on the board carries
    c.strokeStyle = "#2E2E2E";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y + plateH / 2);
    c.lineTo(x + plateW, y + plateH / 2);
    c.stroke();

    c.font = `600 30px ${hind}`;
    c.fillStyle = "#9A9A9A";
    c.letterSpacing = "4px";
    c.fillText(cell[1].toUpperCase(), x + 28, y + 56);
    c.letterSpacing = "0px";

    c.font = `700 236px ${teko}`;
    c.fillStyle = cell[2];
    c.textAlign = "center";
    c.fillText(cell[0], x + plateW / 2, y + plateH - 42);
    c.textAlign = "left";
  }

  /* ---- fourteen matches, then whatever the playoffs gave ---- */
  y += plateH + 64;
  const boxes = [
    ...r.games.map((g) => (g.result === "W" ? TURF : LOSS)),
    ...r.playoffs.map((p) => (p.result === "W" ? TROPHY : LOSS)),
  ];
  const stripW = W - 144;
  const bw = (stripW - (boxes.length - 1) * 8) / boxes.length;
  boxes.forEach((fill, i) => {
    c.fillStyle = fill;
    roundRect(c, 72 + i * (bw + 8), y, bw, 26, 5);
    c.fill();
  });

  /* ---- the numbers under it ---- */
  y += 104;
  const stats: [string, string][] = [
    [String(r.points), labels.points],
    [`${r.nrr > 0 ? "+" : ""}${r.nrr}`, labels.nrr],
    [labels.rank, labels.onTheTable],
  ];
  stats.forEach(([value, label], i) => {
    const x = 72 + i * 316;
    c.font = `600 26px ${hind}`;
    c.fillStyle = "rgba(255,255,255,0.66)";
    c.letterSpacing = "3px";
    c.fillText(label.toUpperCase(), x, y);
    c.letterSpacing = "0px";
    c.font = `700 76px ${teko}`;
    c.fillStyle = i === 2 && r.madePlayoffs ? ACCENT : "#FFFFFF";
    c.fillText(value, x, y + 74);
  });

  /* ---- the two who did the work ---- */
  y += 150;
  c.strokeStyle = "rgba(255,255,255,0.14)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(72, y);
  c.lineTo(W - 72, y);
  c.stroke();

  y += 62;
  const caps: [string, string, string, string][] = [
    [labels.orange, r.orangeCap.player, String(r.orangeCap.runs), "#FF822A"],
    [labels.purple, r.purpleCap.player, String(r.purpleCap.wickets), "#A76BFF"],
  ];
  for (const [label, player, tally, colour] of caps) {
    c.fillStyle = colour;
    roundRect(c, 72, y - 26, 10, 34, 3);
    c.fill();
    c.font = `600 25px ${hind}`;
    c.fillStyle = "rgba(255,255,255,0.66)";
    c.letterSpacing = "3px";
    c.fillText(label.toUpperCase(), 102, y - 4);
    c.letterSpacing = "0px";
    c.font = `600 38px ${hind}`;
    c.fillStyle = "#FFFFFF";
    c.fillText(player, 102, y + 42);
    c.font = `700 54px ${teko}`;
    c.fillStyle = colour;
    c.textAlign = "right";
    c.fillText(tally, W - 72, y + 40);
    c.textAlign = "left";
    y += 110;
  }

  /* ---- the address, so the picture can be followed home ---- */
  c.font = `600 34px ${hind}`;
  c.fillStyle = ACCENT;
  c.fillText(input.url, 72, H - 68);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** True when this browser can hand a file to the OS share sheet. */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
