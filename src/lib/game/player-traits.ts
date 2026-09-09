// Hand-curated facts the squad rows can't carry.
//
// squads-*.json stores one role per player-season, which is enough to draft with
// but not enough to say what a player could ALSO have done. Two gaps matter:
// an all-rounder's row never says how they bowl, and a keeper's row never says
// whether they opened. Both are per-player truths, not per-season ones, so they
// live here as an overlay rather than being smeared across 1,872 rows.

import type { Role } from "./types";

/** All-rounders who bowl spin. Every other AR is treated as a seamer — that is
    the larger group, and a wrong guess only ever costs an off-role option. */
export const AR_SPINNERS: ReadonlySet<string> = new Set([
  "Abhishek Sharma",
  "Ashok Menaria",
  "Axar Patel",
  "Daniel Vettori",
  "Deepak Hooda",
  "Dwaraka Ravi Teja",
  "Glenn Maxwell",
  "JP Duminy",
  "Johan Botha",
  "Krishnappa Gowtham",
  "Krunal Pandya",
  "Lalit Yadav",
  "Liam Livingstone",
  "Marlon Samuels",
  "Michael Bracewell",
  "Mithun Manhas",
  "Mitchell Santner",
  "Moeen Ali",
  "Mohammad Nabi",
  "Parvez Rasool",
  "Pawan Negi",
  "Rahul Tewatia",
  "Ravindra Jadeja",
  "Riyan Parag",
  "Roelof van der Merwe",
  "Sanath Jayasuriya",
  "Shahbaz Ahmed",
  "Shahid Afridi",
  "Shakib Al Hasan",
  "Sunil Narine",
  "Washington Sundar",
  "Will Jacks",
  "Yusuf Pathan",
  "Yuvraj Singh",
]);

/** How an all-rounder bowls, for the AR -> bowling-slot move. */
export function arBowlingRole(player: string): Role {
  return AR_SPINNERS.has(player) ? "Spin" : "Pace";
}

/** Keepers who actually opened the batting in the IPL. This is the list that
    fixes the reported bug: KL Rahul and Quinton de Kock are filed WK in all 156
    squads, so Lucknow 2024 shipped with no opener at all. Keepers absent from
    this list (Dhoni, Pant, de Villiers, Karthik) stay middle-order only. */
export const WK_OPENERS: ReadonlySet<string> = new Set([
  "Abishek Porel",
  "Adam Gilchrist",
  "Anuj Rawat",
  "Brendon McCullum",
  "Ishan Kishan",
  "Jonny Bairstow",
  "Jos Buttler",
  "KL Rahul",
  "Kumar Sangakkara",
  "Manvinder Bisla",
  "Matthew Wade",
  "Parthiv Patel",
  "Phil Salt",
  "Quinton de Kock",
  "Rahmanullah Gurbaz",
  "Robin Uthappa",
  "Ryan Rickelton",
  "Srikar Bharat",
  "Wriddhiman Saha",
]);

/** Players who keep wicket but are filed under another role, so their squad
    would otherwise field nobody for the WK slot. Prabhsimran Singh is Punjab's
    keeper and is filed Opener; without this, PBKS 2025 has no keeper at all. */
export const ALSO_KEEPS: ReadonlySet<string> = new Set([
  "Prabhsimran Singh",
]);

/** Players who genuinely covered a second role at the same level — Kohli opening
    for RCB was not a downgrade, nor was Jadeja bowling his full four. They pay
    half the usual move, never nothing: a free switch would hand the best players
    in the game unlimited flexibility and quietly retire the role quota, which is
    the constraint the draft is built on. */
export const VERSATILE: ReadonlySet<string> = new Set([
  "Virat Kohli",
  "Jacques Kallis",
  "Shane Watson",
  "Sanath Jayasuriya",
  "Ravindra Jadeja",
  "Shakib Al Hasan",
  "Sunil Narine",
  "Andre Russell",
  "Ben Stokes",
  "Glenn Maxwell",
  "Yuvraj Singh",
  "KL Rahul",
  "Jos Buttler",
  "Adam Gilchrist",
  "Kumar Sangakkara",
  "AB de Villiers",
]);
