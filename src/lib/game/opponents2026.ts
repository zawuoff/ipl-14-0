/* The ten sides you play against, as they line up for IPL 2026.

   The draft pool is history (2008–2025), but the opposition should feel like
   the league you watch now — Kohli bats for RCB, not KKR. Each side has a
   batting order of seven and a five-man attack, with a rating that only
   decides who the stars are: how strong the team plays on the day still comes
   from the difficulty setting in the engine.

   Squads follow the November 2025 retentions and the December 2025 auction.
   The cores are firm; a handful of auction and trade moves were fast-moving,
   so if a name looks a season out of date, this is the one file to fix. */

export interface OppPlayer {
  name: string;
  rating: number;
}

export interface OppSquad {
  bat: OppPlayer[]; // batting order, top seven
  bowl: OppPlayer[]; // the five who bowl the overs
}

const p = (name: string, rating: number): OppPlayer => ({ name, rating });

export const OPPONENTS_2026: Record<string, OppSquad> = {
  MI: {
    bat: [
      p("R Sharma", 86), p("R Rickelton", 82), p("S Yadav", 91), p("T Varma", 85),
      p("H Pandya", 84), p("S Rutherford", 78), p("N Dhir", 74),
    ],
    bowl: [
      p("J Bumrah", 96), p("T Boult", 86), p("D Chahar", 80), p("M Santner", 81), p("H Pandya", 78),
    ],
  },
  CSK: {
    bat: [
      p("R Gaikwad", 86), p("S Samson", 85), p("A Mhatre", 76), p("D Brevis", 82),
      p("S Dube", 80), p("MS Dhoni", 78), p("J Overton", 74),
    ],
    bowl: [
      p("N Ahmad", 86), p("K Ahmed", 80), p("A Kamboj", 76), p("N Ellis", 79), p("P Veer", 74),
    ],
  },
  RCB: {
    bat: [
      p("P Salt", 86), p("V Kohli", 92), p("D Padikkal", 78), p("R Patidar", 84),
      p("J Sharma", 79), p("T David", 80), p("V Iyer", 78),
    ],
    bowl: [
      p("J Hazlewood", 88), p("B Kumar", 82), p("K Pandya", 80), p("Y Dayal", 78), p("S Sharma", 76),
    ],
  },
  KKR: {
    bat: [
      p("S Narine", 80), p("A Rahane", 79), p("A Raghuvanshi", 77), p("C Green", 86),
      p("Rinku Singh", 82), p("R Powell", 78), p("Ramandeep S", 74),
    ],
    bowl: [
      p("V Chakravarthy", 90), p("S Narine", 86), p("M Pathirana", 85), p("H Rana", 80), p("V Arora", 76),
    ],
  },
  DC: {
    bat: [
      p("KL Rahul", 88), p("A Porel", 76), p("K Nair", 78), p("T Stubbs", 82),
      p("A Patel", 80), p("A Sharma", 76), p("S Rizvi", 72),
    ],
    bowl: [
      p("M Starc", 88), p("K Yadav", 89), p("A Patel", 80), p("M Kumar", 78), p("T Natarajan", 79),
    ],
  },
  SRH: {
    bat: [
      p("T Head", 90), p("A Sharma", 88), p("I Kishan", 83), p("H Klaasen", 90),
      p("N Reddy", 79), p("L Livingstone", 80), p("A Verma", 75),
    ],
    bowl: [
      p("P Cummins", 87), p("H Patel", 82), p("E Malinga", 78), p("Z Ansari", 74), p("J Unadkat", 75),
    ],
  },
  RR: {
    bat: [
      p("Y Jaiswal", 90), p("V Suryavanshi", 82), p("R Parag", 80), p("D Jurel", 79),
      p("S Hetmyer", 80), p("R Jadeja", 80), p("S Curran", 78),
    ],
    bowl: [
      p("J Archer", 88), p("R Jadeja", 84), p("S Sharma", 78), p("T Deshpande", 76), p("K Maphaka", 76),
    ],
  },
  PBKS: {
    bat: [
      p("P Arya", 80), p("P Singh", 79), p("S Iyer", 88), p("J Inglis", 81),
      p("N Wadhera", 77), p("S Singh", 80), p("M Stoinis", 78),
    ],
    bowl: [
      p("A Singh", 86), p("Y Chahal", 87), p("M Jansen", 83), p("X Bartlett", 76), p("V Vyshak", 74),
    ],
  },
  GT: {
    bat: [
      p("S Gill", 90), p("B Sudharsan", 88), p("J Buttler", 88), p("S Khan", 78),
      p("W Sundar", 76), p("R Tewatia", 76), p("G Phillips", 78),
    ],
    bowl: [
      p("R Khan", 92), p("M Siraj", 86), p("P Krishna", 84), p("K Rabada", 84), p("R Sai Kishore", 78),
    ],
  },
  LSG: {
    bat: [
      p("A Markram", 82), p("M Marsh", 86), p("N Pooran", 91), p("R Pant", 85),
      p("A Badoni", 78), p("A Samad", 74), p("D Miller", 79),
    ],
    bowl: [
      p("M Shami", 84), p("A Khan", 80), p("A Deep", 78), p("M Yadav", 82), p("D Rathi", 78),
    ],
  },
};

/** The side to field for a franchise code; an unknown code gets a neutral XI. */
export function opponentSquad(code: string): OppSquad {
  return OPPONENTS_2026[code] ?? OPPONENTS_2026.MI;
}

/** A recognisable name from the side, for a one-line story after a loss. */
export function opponentStar(code: string, i: number): string {
  const s = opponentSquad(code);
  const stars = [...s.bat, ...s.bowl].sort((a, b) => b.rating - a.rating).slice(0, 4);
  return stars[i % stars.length].name;
}
