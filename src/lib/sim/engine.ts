import { mulberry32, type PlayerSeason, type Difficulty, type XIConfig, ROLE_QUOTA } from "../game/types";

// ---- Team strength ----
export interface TeamStrength {
  bat: number;
  bowl: number;
  power: number;
  avg: number; // mean overall — the live "team rating" that moves with every pick
  penalties: string[];
  bonuses: string[];
}

export function teamStrength(xi: PlayerSeason[], config: XIConfig = ROLE_QUOTA): TeamStrength {
  const penalties: string[] = [];
  const bonuses: string[] = [];
  const batPool = xi.filter((p) =>
    ["Opener", "Middle", "WK", "AR"].includes(p.role)
  );
  const bowlPool = xi.filter((p) => ["AR", "Pace", "Spin"].includes(p.role));
  const bat = avg(batPool.map((p) => p.bat)) || 50;
  const bowl = avg(bowlPool.map((p) => p.bowl)) || 50;
  const avgRating = xi.length ? avg(xi.map((p) => p.overall)) : 0;
  let power = 0.55 * bat + 0.45 * bowl;

  // structural checks vs chosen style
  const counts = countBy(xi.map((p) => p.role));
  const need: Record<string, number> = { ...config };
  for (const k of Object.keys(need)) {
    if ((counts[k] ?? 0) !== need[k]) {
      penalties.push(`XI shape off: ${k}`);
      power -= 6;
    }
  }
  const overseas = xi.filter((p) => p.overseas).length;
  if (overseas > 4) {
    penalties.push(`${overseas} overseas (max 4)`);
    power -= 6 * (overseas - 4);
  }
  if (bowlPool.filter((p) => p.bowl >= 45).length < 5) {
    penalties.push("Thin bowling");
    power -= 6;
  }
  if (batPool.filter((p) => p.bat >= 55).length < 6) {
    penalties.push("Thin batting");
    power -= 6;
  }
  const ars = xi.filter((p) => p.role === "AR");
  if (ars.length === 2 && ars.every((a) => a.overall >= 70)) {
    bonuses.push("Elite AR pair +1.5");
    power += 1.5;
  }
  const wk = xi.find((p) => p.role === "WK");
  if (wk && wk.bat >= 70) {
    bonuses.push("Gun keeper-bat +1.5");
    power += 1.5;
  }
  return { bat, bowl, power: round1(power), avg: round1(avgRating), penalties, bonuses };
}

const DIFF_MOD: Record<Difficulty, number> = { Rookie: -7, Pro: 0, Legend: 7 };

// Opponent pool strength by difficulty (Pro league ~ 77-87 — tuned so real drafted
// XIs go ~8-10 wins and 14-0 stays mythical; playoffs draw elite 82-92 sides)
export function oppPower(rng: () => number, diff: Difficulty, elite = false): number {
  const base = elite ? 80 + rng() * 10 : 77 + rng() * 10;
  return round1(base + DIFF_MOD[diff] * 0.6);
}

export interface Innings {
  runs: number;
  wickets: number;
  balls: number;
  score: string; // "187/6"
}

export function simInnings(
  batAtt: number,
  bowlDef: number,
  rng: () => number,
  target?: number
): Innings {
  const exp = clamp(168 + (batAtt - bowlDef) * 0.5, 145, 205);
  let runs = 0;
  let wkts = 0;
  let balls = 0;
  const probs: Record<string, number> = {};
  for (let b = 0; b < 120; b++) {
    if (wkts >= 10) break;
    balls++;
    let wProb = clamp(0.052 + (bowlDef - batAtt) * 0.0012, 0.028, 0.085);
    let boost = clamp((batAtt - bowlDef) * 0.005, -0.05, 0.05);
    if (target !== undefined) {
      const ballsLeft = 120 - b;
      const reqRpb = (target - runs) / Math.max(1, ballsLeft);
      const parRpb = exp / 120;
      if (reqRpb > 1.5 * parRpb) {
        wProb *= 1.25;
        boost += 0.03;
      } else if (reqRpb < parRpb) {
        wProb *= 0.85;
        boost -= 0.02;
      }
    }
    if (rng() < wProb) {
      wkts++;
      continue;
    }
    // runs distribution [0,1,2,3,4,6]
    let p0 = 0.32 - boost;
    let p1 = 0.34;
    let p2 = 0.12;
    let p3 = 0.01;
    let p4 = 0.14 + boost * 0.6;
    let p6 = 0.07 + boost * 0.4;
    p0 = Math.max(0.1, p0);
    const tot = p0 + p1 + p2 + p3 + p4 + p6;
    p0 /= tot; p1 /= tot; p2 /= tot; p3 /= tot; p4 /= tot; p6 /= tot;
    void probs;
    const r = rng();
    let add = 0;
    if (r < p0) add = 0;
    else if (r < p0 + p1) add = 1;
    else if (r < p0 + p1 + p2) add = 2;
    else if (r < p0 + p1 + p2 + p3) add = 3;
    else if (r < p0 + p1 + p2 + p3 + p4) add = 4;
    else add = 6;
    runs += add;
    if (target !== undefined && runs >= target) break;
  }
  runs = clamp(Math.round(runs), 90, 240);
  return { runs, wickets: Math.min(10, wkts), balls, score: `${runs}/${Math.min(10, wkts)}` };
}

export interface GameResult {
  opp: string;
  oppPower: number;
  gf: string;
  ga: string;
  result: "W" | "L";
  margin: string;
  userRuns: number;
  oppRuns: number;
  superOver?: string; // "SO 14/0–11/1" when tied
}

const OPP_NAMES = ["MI", "CSK", "RCB", "KKR", "DC", "SRH", "RR", "PBKS", "GT", "LSG"];

export function simMatch(
  myBat: number,
  myBowl: number,
  myPower: number,
  rng: () => number,
  diff: Difficulty,
  oppIdx: number,
  elite = false
): GameResult {
  const oPow = oppPower(rng, diff, elite);
  // derive opp bat/bowl around oPow with variance
  const oBat = clamp(oPow + (rng() - 0.5) * 6, 60, 95);
  const oBowl = clamp(oPow + (rng() - 0.5) * 6, 60, 95);
  const opp = OPP_NAMES[oppIdx % OPP_NAMES.length];
  const batFirst = rng() < 0.5;
  let gf = "";
  let ga = "";
  let result: "W" | "L";
  let margin = "";
  let userRuns = 0;
  let oppRuns = 0;
  if (batFirst) {
    const first = simInnings(myBat, oBowl, rng);
    const second = simInnings(oBat, myBowl, rng, first.runs + 1);
    userRuns = first.runs;
    oppRuns = second.runs;
    gf = first.score;
    ga = second.score;
    if (first.runs > second.runs) {
      result = "W";
      margin = `${first.runs - second.runs} runs`;
    } else {
      result = "L";
      const wktsLeft = 10 - second.wickets;
      margin = `${wktsLeft} wkts (${Math.max(0, 120 - second.balls)} balls left)`;
    }
  } else {
    const first = simInnings(oBat, myBowl, rng);
    const second = simInnings(myBat, oBowl, rng, first.runs + 1);
    oppRuns = first.runs;
    userRuns = second.runs;
    ga = first.score;
    gf = second.score;
    if (second.runs >= first.runs + 1) {
      result = "W";
      const wktsLeft = 10 - second.wickets;
      margin = `${wktsLeft} wkts (${Math.max(0, 120 - second.balls)} balls left)`;
    } else {
      result = "L";
      margin = `${first.runs - second.runs} runs`;
    }
  }
  void myPower;
  // tie → Super Over (slim, strengths only). Never a draw in the IPL.
  let superOver: string | undefined;
  if (userRuns === oppRuns) {
    const firstBat = batFirst ? myBat : oBat;
    const firstBowl = batFirst ? oBowl : myBowl;
    const secondBat = batFirst ? oBat : myBat;
    const secondBowl = batFirst ? myBowl : oBowl;
    const so = superOverSlim(firstBat, firstBowl, secondBat, secondBowl, rng);
    const userFirst = batFirst;
    const userSO = userFirst ? so.s1 : so.s2;
    const oppSO = userFirst ? so.s2 : so.s1;
    superOver = `SO ${userSO}–${oppSO}`;
    const userWon = (so.winnerIsFirst && userFirst) || (!so.winnerIsFirst && !userFirst);
    result = userWon ? "W" : "L";
    margin = "Super Over";
  }
  return { opp, oppPower: oPow, gf, ga, result, margin, userRuns, oppRuns, superOver };
}

export interface TableRow {
  team: string;
  p: number;
  w: number;
  l: number;
  pts: number;
  nrr: number;
  you?: boolean;
}

const AI_TEAMS = ["MI", "CSK", "RCB", "KKR", "DC", "SRH", "RR", "PBKS", "GT", "LSG"];

// Believable 10-team table, seeded (verifiable) — AI rows are cosmetic,
// your row is 100% your results. Top 4 make playoffs.
export function buildTable(
  userWins: number,
  userNrr: number,
  seedU32: number
): { rows: TableRow[]; rank: number } {
  const rng = mulberry32((seedU32 ^ 0x51ab3f) >>> 0);
  const names = [...AI_TEAMS].sort(() => rng() - 0.5).slice(0, 9);
  const rows: TableRow[] = names.map((n) => {
    const w = clamp(Math.round(7 + (rng() - 0.5) * 7), 2, 12);
    return {
      team: n,
      p: 14,
      w,
      l: 14 - w,
      pts: w * 2,
      nrr: round2((rng() - 0.48) * 1.8),
    };
  });
  rows.push({ team: "YOU", p: 14, w: userWins, l: 14 - userWins, pts: userWins * 2, nrr: userNrr, you: true });
  rows.sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
  return { rows, rank: rows.findIndex((r) => r.you) + 1 };
}

export interface MatchStar {
  bat: { player: string; runs: number; balls: number };
  bowl: { player: string; wickets: number; runsConceded: number };
  batAll: { player: string; runs: number; balls: number }[];
  bowlAll: { player: string; wickets: number }[];
}

export interface SeasonResult {
  wins: number;
  losses: number;
  points: number;
  nrr: number;
  rank: number;
  table: TableRow[];
  madePlayoffs: boolean;
  champion: boolean;
  perfect14: boolean;
  games: GameResult[];
  playoffs: {
    stage: string;
    gf: string;
    ga: string;
    result: "W" | "L";
    margin: string;
    detail?: { inn1: DetailedInnings; inn2: DetailedInnings; userFirst: boolean; opp: string; superOver?: DetailedMatch["superOver"] };
  }[];
  // season aggregates for awards + XI table + hero lines
  matchStars: MatchStar[];
  orangeCap: { player: string; runs: number };
  purpleCap: { player: string; wickets: number };
  mvp: { player: string; points: number };
  playerRuns: { player: string; role: string; overall: number; runs: number; wickets: number }[];
  biggestWin: string;
}

export function simSeason(
  xi: PlayerSeason[],
  seedU32: number,
  diff: Difficulty
): SeasonResult {
  const { bat, bowl } = teamStrength(xi);
  const games: GameResult[] = [];
  const matchStars: MatchStar[] = [];
  const agg = new Map<string, { runs: number; balls: number; wkts: number }>();
  let wins = 0;
  let runsFor = 0;
  let runsAgainst = 0;
  let biggestWin = "—";
  let biggestWinMargin = -1;
  // 14 games, double round-robin vs 7 rotating opps; stream per match for verifiability
  for (let i = 0; i < 14; i++) {
    const rng = mulberry32((seedU32 + i * 0x9e3779b9) >>> 0);
    const g = simMatch(bat, bowl, 0, rng, diff, i);
    games.push(g);
    if (g.result === "W") wins++;
    runsFor += g.userRuns;
    runsAgainst += g.oppRuns;
    const [ur, uw] = parseScore(g.gf);
    const [, ow] = parseScore(g.ga);
    const star = distributeMatch(xi, ur, uw, ow, rng);
    matchStars.push(star);
    for (const b of star.batAll) bump(agg, b.player, b.runs, b.balls, 0);
    for (const w of star.bowlAll) bump(agg, w.player, 0, 0, w.wickets);
    if (g.result === "W") {
      const m = parseInt(g.margin, 10) || 0;
      const byRuns = g.margin.includes("runs");
      const score = byRuns ? m : m * 10 + (140 - Math.min(140, g.userRuns)) / 10;
      if (score > biggestWinMargin) {
        biggestWinMargin = score;
        biggestWin = `Won by ${g.margin} vs ${g.opp}`;
      }
    }
  }
  const losses = 14 - wins;
  const points = wins * 2;
  const nrr = round2((runsFor - runsAgainst) / (14 * 20));
  const { rows: table, rank } = buildTable(wins, nrr, seedU32);
  const madePlayoffs = rank <= 4;
  const playoffs: SeasonResult["playoffs"] = [];
  let champion = false;
  if (madePlayoffs) {
    const stages = ["Qualifier 1", "Eliminator / Q2", "Final"];
    // top-2 finish shortcut: win Q1 -> final; else Q2 -> final
    let alive = true;
    const q1rng = mulberry32((seedU32 + 99 * 0x9e3779b9) >>> 0);
    const q1 = simDetailedMatch(xi, bat, bowl, q1rng, diff, 21);
    const pack = (stage: string, m: DetailedMatch) => ({
      stage,
      gf: m.gf,
      ga: m.ga,
      result: m.result,
      margin: m.margin,
      detail: { inn1: m.inn1, inn2: m.inn2, userFirst: m.userFirst, opp: m.opp, superOver: m.superOver },
    });
    if (q1.result === "W") {
      playoffs.push(pack(stages[0], q1));
      const frng = mulberry32((seedU32 + 101 * 0x9e3779b9) >>> 0);
      const f = simDetailedMatch(xi, bat, bowl, frng, diff, 23);
      playoffs.push(pack(stages[2], f));
      champion = f.result === "W";
      alive = champion;
    } else {
      playoffs.push({ ...pack(stages[0], q1), result: "L" });
      const q2rng = mulberry32((seedU32 + 100 * 0x9e3779b9) >>> 0);
      const q2 = simDetailedMatch(xi, bat, bowl, q2rng, diff, 22);
      playoffs.push(pack(stages[1], q2));
      if (q2.result === "W") {
        const frng = mulberry32((seedU32 + 101 * 0x9e3779b9) >>> 0);
        const f = simDetailedMatch(xi, bat, bowl, frng, diff, 23);
        playoffs.push(pack(stages[2], f));
        champion = f.result === "W";
        alive = champion;
      } else {
        alive = false;
      }
    }
    void alive;
  }
  return {
    wins,
    losses,
    points,
    nrr,
    rank,
    table,
    madePlayoffs,
    champion,
    perfect14: wins === 14,
    games,
    playoffs,
    matchStars,
    ...seasonAwards(xi, agg),
    biggestWin,
  };
}

function parseScore(s: string): [number, number] {
  const parts = s.split("/");
  return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
}

function bump(
  agg: Map<string, { runs: number; balls: number; wkts: number }>,
  player: string,
  runs: number,
  balls: number,
  wkts: number
) {
  const e = agg.get(player) ?? { runs: 0, balls: 0, wkts: 0 };
  e.runs += runs;
  e.balls += balls;
  e.wkts += wkts;
  agg.set(player, e);
}

// Split a team innings among the XI (weighted by ratings) for awards + hero lines.
export function distributeMatch(
  xi: PlayerSeason[],
  userRuns: number,
  _userWkts: number,
  oppWktsFallen: number,
  rng: () => number
): MatchStar {
  void _userWkts;
  const batters = xi
    .filter((p) => ["Opener", "Middle", "WK", "AR"].includes(p.role))
    .sort((a, b) => b.bat - a.bat)
    .slice(0, 7);
  const bw = batters.map((p) => Math.pow(p.bat, 6));
  const btot = bw.reduce((a, b) => a + b, 0) || 1;
  const bruns = batters.map((_, i) => Math.floor((userRuns * bw[i]) / btot));
  let rem = userRuns - bruns.reduce((a, b) => a + b, 0);
  // remainder + 55% cap to the top
  const order = batters.map((_, i) => i).sort((a, b) => bruns[b] - bruns[a]);
  let oi = 0;
  while (rem > 0) {
    bruns[order[oi % order.length]]++;
    rem--;
    oi++;
  }
  const cap = Math.floor(userRuns * 0.55);
  for (let i = 1; i < bruns.length && bruns[0] > cap; i++) {
    const move = Math.min(bruns[0] - cap, Math.floor(cap / 2));
    bruns[0] -= move;
    bruns[i] += move;
  }
  const batAll = batters.map((p, i) => {
    const sr = clamp(115 + (p.bat - 65) * 1.3, 100, 200);
    return { player: p.player, runs: bruns[i], balls: Math.max(1, Math.round((bruns[i] * 100) / sr)) };
  });
  let topBat = { player: batters[0]?.player ?? "—", runs: 0, balls: 0 };
  for (const b of batAll) {
    if (b.runs > topBat.runs) topBat = b;
  }

  const bowlers = xi
    .filter((p) => ["AR", "Pace", "Spin"].includes(p.role))
    .sort((a, b) => b.bowl - a.bowl)
    .slice(0, 5);
  const ww = bowlers.map((p) => Math.pow(Math.max(20, p.bowl), 3));
  const wtot = ww.reduce((a, b) => a + b, 0) || 1;
  const wk = bowlers.map((_, i) => Math.floor((oppWktsFallen * ww[i]) / wtot));
  let wrem = oppWktsFallen - wk.reduce((a, b) => a + b, 0);
  const worder = bowlers.map((_, i) => i).sort((a, b) => wk[b] - wk[a]);
  let wi = 0;
  while (wrem > 0 && worder.length) {
    wk[worder[wi % worder.length]]++;
    wrem--;
    wi++;
  }
  const bowlAll = bowlers.map((p, i) => ({ player: p.player, wickets: wk[i] }));
  let topBowl = { player: bowlers[0]?.player ?? "—", wickets: 0, runsConceded: 0 };
  bowlers.forEach((p, i) => {
    const rc = wk[i] > 0 ? Math.round(wk[i] * 7.5 + rng() * 12) : Math.round(18 + rng() * 18);
    if (wk[i] > topBowl.wickets || (wk[i] === topBowl.wickets && rc < topBowl.runsConceded)) {
      topBowl = { player: p.player, wickets: wk[i], runsConceded: rc };
    }
  });
  return { bat: topBat, bowl: topBowl, batAll, bowlAll };
}

function seasonAwards(
  xi: PlayerSeason[],
  agg: Map<string, { runs: number; balls: number; wkts: number }>
): Pick<SeasonResult, "orangeCap" | "purpleCap" | "mvp" | "playerRuns"> {
  const info = new Map(xi.map((p) => [p.player, p]));
  const playerRuns = [...agg.entries()].map(([player, e]) => ({
    player,
    role: info.get(player)?.role ?? "",
    overall: info.get(player)?.overall ?? 0,
    runs: e.runs,
    wickets: e.wkts,
  }));
  // every XI member appears (DNB rows for non-contributors)
  for (const p of xi) {
    if (!agg.has(p.player)) {
      playerRuns.push({ player: p.player, role: p.role, overall: p.overall, runs: 0, wickets: 0 });
    }
  }
  playerRuns.sort((a, b) => b.runs - a.runs || b.wickets - a.wickets);
  const orange = playerRuns.reduce((a, b) => (b.runs > a.runs ? b : a), playerRuns[0]);
  const purple = [...playerRuns].sort((a, b) => b.wickets - a.wickets || b.runs - a.runs)[0];
  const mvp = [...playerRuns].sort((a, b) => b.runs + b.wickets * 20 - (a.runs + a.wickets * 20))[0];
  return {
    orangeCap: { player: orange.player, runs: orange.runs },
    purpleCap: { player: purple.player, wickets: purple.wickets },
    mvp: { player: mvp.player, points: mvp.runs + mvp.wickets * 20 },
    playerRuns,
  };
}

// Bookies forecast: Monte-Carlo the season N times for expected points,
// most-likely finish, playoff/title odds. Guidance, not destiny.
export interface Forecast {
  expPts: number;
  medRank: number;
  playoffPct: number;
  titlePct: number;
  perfectPct: number;
}

export function forecastSeason(
  xi: PlayerSeason[],
  seedU32: number,
  diff: Difficulty,
  n = 160
): Forecast {
  const ranks: number[] = [];
  let pts = 0;
  let po = 0;
  let ti = 0;
  let pf = 0;
  for (let k = 0; k < n; k++) {
    const r = simSeason(xi, (seedU32 ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0, diff);
    pts += r.points;
    ranks.push(r.rank);
    if (r.madePlayoffs) po++;
    if (r.champion) ti++;
    if (r.perfect14) pf++;
  }
  ranks.sort((a, b) => a - b);
  return {
    expPts: Math.round((pts / n) * 10) / 10,
    medRank: ranks[Math.floor(n / 2)],
    playoffPct: Math.round((po / n) * 100),
    titlePct: Math.round((ti / n) * 100),
    perfectPct: Math.round((pf / n) * 1000) / 10,
  };
}

// ---- Ball-by-ball detailed innings (playoffs + final only) ----
export interface BallEvent {
  n: number; // 1-based ball number in innings
  over: string; // "4.3"
  runs: number;
  wicket: boolean;
  striker: string;
  bowler: string;
  score: string; // "45/2" after this ball
}

export interface BatCard {
  name: string;
  runs: number;
  balls: number;
  out: boolean;
}

export interface BowlCard {
  name: string;
  balls: number;
  runs: number;
  wickets: number;
}

export interface DetailedInnings {
  runs: number;
  wickets: number;
  balls: number;
  score: string;
  batsmen: BatCard[];
  bowlers: BowlCard[];
  events: BallEvent[];
}

const OPP_BAT_POOL: [string, number][] = [
  ["Warner", 90], ["Buttler", 89], ["Kohli", 88], ["SKY", 87], ["Head", 86],
  ["Gill", 85], ["Klaasen", 85], ["Pant", 83], ["Miller", 82], ["Jaiswal", 81],
  ["Samson", 80], ["Maxwell", 80],
];
const OPP_BOWL_POOL: [string, number][] = [
  ["Bumrah", 95], ["Rashid", 90], ["Malinga", 88], ["Narine", 86], ["Archer", 86],
  ["Chahal", 84], ["Boult", 83], ["Shami", 83], ["Starc", 84], ["Jadeja", 82],
  ["Kuldeep", 80], ["Cummins", 80],
];

function ballOutcome(batAtt: number, bowlDef: number, rng: () => number): { runs: number; wicket: boolean } {
  const wProb = clamp(0.052 + (bowlDef - batAtt) * 0.0012, 0.028, 0.085);
  if (rng() < wProb) return { runs: 0, wicket: true };
  const boost = clamp((batAtt - bowlDef) * 0.005, -0.05, 0.05);
  const p0 = Math.max(0.1, 0.32 - boost);
  const p1 = 0.34;
  const p2 = 0.12;
  const p3 = 0.01;
  const p4 = 0.14 + boost * 0.6;
  const p6 = 0.07 + boost * 0.4;
  const tot = p0 + p1 + p2 + p3 + p4 + p6;
  const r = rng() * tot;
  if (r < p0) return { runs: 0, wicket: false };
  if (r < p0 + p1) return { runs: 1, wicket: false };
  if (r < p0 + p1 + p2) return { runs: 2, wicket: false };
  if (r < p0 + p1 + p2 + p3) return { runs: 3, wicket: false };
  if (r < p0 + p1 + p2 + p3 + p4) return { runs: 4, wicket: false };
  return { runs: 6, wicket: false };
}

export function simDetailedInnings(
  batSide: { name: string; w: number }[],
  bowlSide: { name: string; w: number }[],
  batAtt: number,
  bowlDef: number,
  rng: () => number,
  target?: number
): DetailedInnings {
  const order = batSide.slice(0, 7);
  const attack = bowlSide.slice(0, 5);
  const batCards = new Map<string, BatCard>();
  const bowlCards = new Map<string, BowlCard>();
  const card = (n: string): BatCard => {
    let c = batCards.get(n);
    if (!c) {
      c = { name: n, runs: 0, balls: 0, out: false };
      batCards.set(n, c);
    }
    return c;
  };
  const bcard = (n: string): BowlCard => {
    let c = bowlCards.get(n);
    if (!c) {
      c = { name: n, balls: 0, runs: 0, wickets: 0 };
      bowlCards.set(n, c);
    }
    return c;
  };

  let striker = 0;
  let nonStriker = 1;
  let nextIn = 2;
  let runs = 0;
  let wkts = 0;
  let bowlerIdx = 0;
  const events: BallEvent[] = [];
  const exp = clamp(168 + (batAtt - bowlDef) * 0.5, 145, 205);

  for (let b = 0; b < 120 && wkts < 10; b++) {
    // bowler rotation, max 4 overs (24 balls) each
    let guard = 0;
    while (bcard(attack[bowlerIdx % attack.length].name).balls >= 24 && guard++ < 8) bowlerIdx++;
    const bowler = attack[bowlerIdx % attack.length];
    const bat = order[Math.min(striker, order.length - 1)];
    const sName = bat.name;
    const sW = bat.w;

    // chase pressure shifts (mirrors simInnings)
    let batA = (sW + batAtt) / 2;
    let bowlD = (bowler.w + bowlDef) / 2;
    if (target !== undefined) {
      const ballsLeft = 120 - b;
      const reqRpb = (target - runs) / Math.max(1, ballsLeft);
      const parRpb = exp / 120;
      if (reqRpb > 1.5 * parRpb) {
        batA += 6;
        bowlD -= 3;
      } else if (reqRpb < parRpb) {
        batA -= 3;
        bowlD += 2;
      }
    }
    const { runs: add, wicket } = ballOutcome(batA, bowlD, rng);
    const bc = bcard(bowler.name);
    bc.balls++;
    const sc = card(sName);
    sc.balls++;
    if (wicket) {
      wkts++;
      sc.out = true;
      bc.wickets++;
      if (nextIn < order.length + 3) {
        striker = nextIn;
        nextIn++;
      }
    } else {
      runs += add;
      sc.runs += add;
      bc.runs += add;
      if (add % 2 === 1) {
        const t = striker;
        striker = nonStriker;
        nonStriker = t;
      }
    }
    const overDone = (b + 1) % 6 === 0;
    if (overDone && !wicket) {
      const t = striker;
      striker = nonStriker;
      nonStriker = t;
      bowlerIdx++;
    } else if (overDone) {
      bowlerIdx++;
    }
    events.push({
      n: b + 1,
      over: `${Math.floor((b + 1) / 6)}.${(b + 1) % 6}`,
      runs: add,
      wicket,
      striker: sName,
      bowler: bowler.name,
      score: `${runs}/${Math.min(10, wkts)}`,
    });
    if (target !== undefined && runs >= target) break;
  }
  runs = clamp(runs, 40, 250);
  return {
    runs,
    wickets: Math.min(10, wkts),
    balls: events.length,
    score: `${runs}/${Math.min(10, wkts)}`,
    batsmen: order.map((o) => batCards.get(o.name) ?? { name: o.name, runs: 0, balls: 0, out: false }),
    bowlers: attack.map((a) => bowlCards.get(a.name) ?? { name: a.name, balls: 0, runs: 0, wickets: 0 }),
    events,
  };
}

export interface DetailedMatch extends Omit<GameResult, "superOver"> {
  inn1: DetailedInnings;
  inn2: DetailedInnings;
  userFirst: boolean;
  superOver?: {
    inn1: SuperOverInnings;
    inn2: SuperOverInnings;
    winnerIsUser: boolean;
    scoreline: string;
  };
}

export function simDetailedMatch(
  xi: PlayerSeason[],
  bat: number,
  bowl: number,
  rng: () => number,
  diff: Difficulty,
  oppIdx: number
): DetailedMatch {
  const oPow = oppPower(rng, diff, true);
  const oBat = clamp(oPow + (rng() - 0.5) * 6, 60, 95);
  const oBowl = clamp(oPow + (rng() - 0.5) * 6, 60, 95);
  const opp = OPP_NAMES[oppIdx % OPP_NAMES.length];

  // user batting order: openers first, then by bat
  const openers = xi.filter((p) => p.role === "Opener").sort((a, b) => b.bat - a.bat);
  const rest = xi.filter((p) => p.role !== "Opener").sort((a, b) => b.bat - a.bat);
  const userBat = [...openers, ...rest].map((p) => ({ name: shortName(p.player), w: p.bat }));
  const userBowl = xi
    .filter((p) => ["AR", "Pace", "Spin"].includes(p.role))
    .sort((a, b) => b.bowl - a.bowl)
    .slice(0, 5)
    .map((p) => ({ name: shortName(p.player), w: p.bowl }));

  const rotB = (pool: [string, number][]) =>
    Array.from({ length: 7 }, (_, i) => {
      const [name] = pool[(oppIdx * 3 + i) % pool.length];
      return { name, w: clamp(Math.round(oBat + (rng() - 0.5) * 8), 55, 97) };
    });
  const rotW = (pool: [string, number][]) =>
    Array.from({ length: 5 }, (_, i) => {
      const [name] = pool[(oppIdx * 2 + i) % pool.length];
      return { name, w: clamp(Math.round(oBowl + (rng() - 0.5) * 8), 55, 97) };
    });
  const oppBat = rotB(OPP_BAT_POOL);
  const oppBowl = rotW(OPP_BOWL_POOL);

  const batFirst = rng() < 0.5;
  let inn1: DetailedInnings;
  let inn2: DetailedInnings;
  let userFirst: boolean;
  if (batFirst) {
    inn1 = simDetailedInnings(userBat, oppBowl, bat, oBowl, rng);
    inn2 = simDetailedInnings(oppBat, userBowl, oBat, bowl, rng, inn1.runs + 1);
    userFirst = true;
  } else {
    inn1 = simDetailedInnings(oppBat, userBowl, oBat, bowl, rng);
    inn2 = simDetailedInnings(userBat, oppBowl, bat, oBowl, rng, inn1.runs + 1);
    userFirst = false;
  }
  const gf = userFirst ? inn1.score : inn2.score;
  const ga = userFirst ? inn2.score : inn1.score;
  const userRuns = userFirst ? inn1.runs : inn2.runs;
  const oppRuns = userFirst ? inn2.runs : inn1.runs;
  let result: "W" | "L";
  let margin: string;
  const defended = userFirst ? inn1 : inn2;
  if (userRuns > oppRuns) {
    result = "W";
    margin = userFirst
      ? `${userRuns - oppRuns} runs`
      : `${10 - inn2.wickets} wkts (${Math.max(0, 120 - inn2.balls)} balls left)`;
  } else {
    result = "L";
    // lost defending → opp chased it down (wkts); lost chasing → fell short (runs)
    margin = userFirst
      ? `${10 - inn2.wickets} wkts (${Math.max(0, 120 - inn2.balls)} balls left)`
      : `${oppRuns - userRuns} runs`;
  }
  void defended;
  // tie → named Super Over with full ball events for the theater
  let superOver: DetailedMatch["superOver"];
  if (userRuns === oppRuns) {
    const so = superOverNamed(userBat, userBowl, oppBat, oppBowl, bat, bowl, oBat, oBowl, userFirst, rng);
    const uSO = so.inn1.side === "YOU" ? so.inn1 : so.inn2;
    const oSO = so.inn1.side === "YOU" ? so.inn2 : so.inn1;
    superOver = {
      inn1: so.inn1,
      inn2: so.inn2,
      winnerIsUser: so.winnerIsUser,
      scoreline: `SO ${uSO.score}–${oSO.score}`,
    };
    result = so.winnerIsUser ? "W" : "L";
    margin = "Super Over";
  }
  return { opp, oppPower: oPow, gf, ga, result, margin, userRuns, oppRuns, inn1, inn2, userFirst, superOver };
}

function shortName(full: string): string {
  const parts = full.split(" ");
  if (parts.length === 1) return full.slice(0, 8);
  return `${parts[0][0]} ${parts[parts.length - 1]}`.slice(0, 12);
}

// ---- Super Over: tie-breaker, 1 over per side, max 2 wickets ----
export interface SuperOverInnings {
  side: string; // team/user tag batting
  runs: number;
  wickets: number;
  fours: number;
  sixes: number;
  events: BallEvent[];
  score: string;
}

function simSuperOverInnings(
  side: string,
  batters: { name: string; w: number }[], // top 3, best first
  bowler: { name: string; w: number },
  batAtt: number,
  bowlDef: number,
  rng: () => number,
  target?: number
): SuperOverInnings {
  let striker = 0;
  let nonStriker = 1;
  let nextIn = 2;
  let runs = 0;
  let wkts = 0;
  let fours = 0;
  let sixes = 0;
  const events: BallEvent[] = [];
  for (let b = 0; b < 6 && wkts < 2; b++) {
    const batA = (batters[Math.min(striker, 2)].w + batAtt) / 2;
    const bowlD = (bowler.w + bowlDef) / 2;
    const { runs: add, wicket } = ballOutcome(batA, bowlD, rng);
    if (wicket) {
      wkts++;
      striker = nextIn;
      nextIn++;
    } else {
      runs += add;
      if (add === 4) fours++;
      if (add === 6) sixes++;
      if (add % 2 === 1) {
        const t = striker;
        striker = nonStriker;
        nonStriker = t;
      }
    }
    events.push({
      n: b + 1,
      over: `0.${b + 1}`,
      runs: add,
      wicket,
      striker: batters[Math.min(striker, 2)].name,
      bowler: bowler.name,
      score: `${runs}/${wkts}`,
    });
    if (target !== undefined && runs >= target) break;
  }
  return { side, runs, wickets: wkts, fours, sixes, events, score: `${runs}/${wkts}` };
}

export interface SuperOverResult {
  inn1: SuperOverInnings;
  inn2: SuperOverInnings;
  winnerIsFirst: boolean;
}

// Slim (league): team-strength only, no names. Replays on dead ties (max 3)
// then boundary countback — always a winner.
export function superOverSlim(
  bat1: number,
  bowl1: number,
  bat2: number,
  bowl2: number,
  rng: () => number
): { s1: string; s2: string; winnerIsFirst: boolean } {
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = simSuperOverInnings(
      "A",
      [{ name: "A", w: bat1 }, { name: "A", w: bat1 }, { name: "A", w: bat1 }],
      { name: "X", w: bowl2 },
      bat1, bowl2, rng
    );
    const b = simSuperOverInnings(
      "B",
      [{ name: "B", w: bat2 }, { name: "B", w: bat2 }, { name: "B", w: bat2 }],
      { name: "Y", w: bowl1 },
      bat2, bowl1, rng, a.runs + 1
    );
    if (a.runs !== b.runs) {
      return { s1: `${a.runs}/${a.wickets}`, s2: `${b.runs}/${b.wickets}`, winnerIsFirst: a.runs > b.runs };
    }
    if (attempt === 2) {
      // boundary countback
      const ba = a.fours + a.sixes;
      const bb = b.fours + b.sixes;
      if (ba !== bb) {
        return { s1: `${a.runs}/${a.wickets}`, s2: `${b.runs}/${b.wickets}`, winnerIsFirst: ba > bb };
      }
      return { s1: `${a.runs}/${a.wickets}`, s2: `${b.runs}/${b.wickets}`, winnerIsFirst: rng() < 0.5 };
    }
  }
  return { s1: "0/0", s2: "0/0", winnerIsFirst: true };
}

function top3(bat: { name: string; w: number }[]): { name: string; w: number }[] {
  return [...bat].sort((a, b) => b.w - a.w).slice(0, 3);
}

// Named (playoffs): real players, full ball events for the theater.
// tagFirst/tagSecond label the two Super Over innings (default YOU/OPP).
export function superOverNamed(
  userBat: { name: string; w: number }[],
  userBowl: { name: string; w: number }[],
  oppBat: { name: string; w: number }[],
  oppBowl: { name: string; w: number }[],
  bat: number,
  bowl: number,
  oBat: number,
  oBowl: number,
  userFirst: boolean,
  rng: () => number,
  tagFirst = "YOU",
  tagSecond = "OPP"
): { inn1: SuperOverInnings; inn2: SuperOverInnings; winnerIsUser: boolean } {
  const u3 = top3(userBat);
  const o3 = top3(oppBat);
  const uBest = userBowl[0] ?? { name: "—", w: bowl };
  const oBest = oppBowl[0] ?? { name: "—", w: oBowl };
  for (let attempt = 0; attempt < 3; attempt++) {
    const first = userFirst
      ? simSuperOverInnings(tagFirst, u3, oBest, bat, oBowl, rng)
      : simSuperOverInnings(tagSecond, o3, uBest, oBat, bowl, rng);
    const second = userFirst
      ? simSuperOverInnings(tagSecond, o3, uBest, oBat, bowl, rng, first.runs + 1)
      : simSuperOverInnings(tagFirst, u3, oBest, bat, oBowl, rng, first.runs + 1);
    // fix sides labels
    const inn1 = { ...first, side: tagFirst };
    const inn2 = { ...second, side: tagSecond };
    if (first.runs !== second.runs) {
      return { inn1, inn2, winnerIsUser: (first.runs > second.runs) === userFirst };
    }
    if (attempt === 2) {
      const b1 = first.fours + first.sixes;
      const b2 = second.fours + second.sixes;
      const firstWins = b1 === b2 ? rng() < 0.5 : b1 > b2;
      return { inn1, inn2, winnerIsUser: firstWins === userFirst };
    }
  }
  throw new Error("unreachable super over");
}


// ---- Shared multiplayer league: 10 teams (2 humans + 8 AI), double
// round-robin = 18 games each. ONE result per fixture, mirrored to both
// viewers — same league, same table, no conflicts, ever. ----

export interface SharedTeam {
  name: string;
  human: boolean;
  deviceId?: string;
}

export interface NeutralDetail {
  inn1: DetailedInnings;
  inn2: DetailedInnings;
  firstIsHome: boolean;
  superOver?: {
    inn1: SuperOverInnings;
    inn2: SuperOverInnings;
    firstIsHome: boolean;
  };
}

export interface SharedFixture {
  round: number; // 1..18
  home: number; // index into teams
  away: number;
  hs: string; // home score "186/4"
  as: string;
  hr: number;
  ar: number;
  winner: number; // team index
  margin: string; // neutral: "24 runs" | "5 wkts (8 balls left)" | "Super Over"
  superOverNote?: string; // neutral "SO 12/0-9/1" (home first)
  detail?: NeutralDetail; // H2H games: ball-by-ball, scores match by construction
}

export interface SharedPlayoff {
  stage: string;
  t1: number;
  t2: number;
  s1: string;
  s2: string;
  winner: number;
  margin: string;
  superOverNote?: string;
  detail?: NeutralDetail; // set when a human is involved
}

export interface SharedLeague {
  teams: SharedTeam[];
  fixtures: SharedFixture[];
  table: TableRow[];
  playoffs: SharedPlayoff[];
}

const LEAGUE_AI = ["MI", "CSK", "RCB", "KKR", "DC", "SRH", "RR", "PBKS"];

function aiStrengths(seedU32: number): { bat: number; bowl: number }[] {
  const rng = mulberry32((seedU32 ^ 0x77aa) >>> 0);
  return LEAGUE_AI.map(() => ({
    bat: round1(74 + rng() * 14),
    bowl: round1(74 + rng() * 14),
  }));
}

function wktsMarginStr(chase: { wickets: number; balls: number }): string {
  const wktsLeft = 10 - chase.wickets;
  return `${wktsLeft} wkts (${Math.max(0, 120 - chase.balls)} balls left)`;
}

// Aggregate neutral fixture (AI involved). Home/away scores official.
function simFixture(
  batH: number,
  bowlH: number,
  batA: number,
  bowlA: number,
  rng: () => number
): { hs: string; as: string; hr: number; ar: number; winner: "H" | "A"; margin: string; superOverNote?: string } {
  const homeFirst = rng() < 0.5;
  const first = homeFirst ? simInnings(batH, bowlA, rng) : simInnings(batA, bowlH, rng);
  const second = homeFirst
    ? simInnings(batA, bowlH, rng, first.runs + 1)
    : simInnings(batH, bowlA, rng, first.runs + 1);
  const hs = homeFirst ? first.score : second.score;
  const as = homeFirst ? second.score : first.score;
  const hr = homeFirst ? first.runs : second.runs;
  const ar = homeFirst ? second.runs : first.runs;
  if (hr === ar) {
    const so = superOverSlim(batH, bowlH, batA, bowlA, rng);
    return { hs, as, hr, ar, winner: so.winnerIsFirst ? "H" : "A", margin: "Super Over", superOverNote: `SO ${so.s1}-${so.s2}` };
  }
  const homeWon = hr > ar;
  const winnerBattedFirst = (homeWon && homeFirst) || (!homeWon && !homeFirst);
  const margin = winnerBattedFirst ? `${Math.abs(hr - ar)} runs` : wktsMarginStr(second);
  return { hs, as, hr, ar, winner: homeWon ? "H" : "A", margin };
}

function orderSides(xi: PlayerSeason[]): { bat: { name: string; w: number }[]; bowl: { name: string; w: number }[] } {
  const openers = xi.filter((p) => p.role === "Opener").sort((a, b) => b.bat - a.bat);
  const rest = xi.filter((p) => p.role !== "Opener").sort((a, b) => b.bat - a.bat);
  return {
    bat: [...openers, ...rest].map((p) => ({ name: shortName(p.player), w: p.bat })),
    bowl: xi
      .filter((p) => ["AR", "Pace", "Spin"].includes(p.role))
      .sort((a, b) => b.bowl - a.bowl)
      .slice(0, 5)
      .map((p) => ({ name: shortName(p.player), w: p.bowl })),
  };
}

// Detailed neutral H2H: both XIs real, real names, Super Over on ties.
function simH2H(
  xiH: PlayerSeason[],
  nameH: string,
  batH: number,
  bowlH: number,
  xiA: PlayerSeason[],
  nameA: string,
  batA: number,
  bowlA: number,
  rng: () => number
): {
  hs: string; as: string; hr: number; ar: number;
  winner: "H" | "A"; margin: string; superOverNote?: string;
  detail: NeutralDetail;
} {
  const H = orderSides(xiH);
  const A = orderSides(xiA);
  const homeFirst = rng() < 0.5;
  let inn1: DetailedInnings;
  let inn2: DetailedInnings;
  if (homeFirst) {
    inn1 = simDetailedInnings(H.bat, A.bowl, batH, bowlA, rng);
    inn2 = simDetailedInnings(A.bat, H.bowl, batA, bowlH, rng, inn1.runs + 1);
  } else {
    inn1 = simDetailedInnings(A.bat, H.bowl, batA, bowlH, rng);
    inn2 = simDetailedInnings(H.bat, A.bowl, batH, bowlA, rng, inn1.runs + 1);
  }
  const hr = homeFirst ? inn1.runs : inn2.runs;
  const ar = homeFirst ? inn2.runs : inn1.runs;
  const hs = homeFirst ? inn1.score : inn2.score;
  const as = homeFirst ? inn2.score : inn1.score;
  const detail: NeutralDetail = { inn1, inn2, firstIsHome: homeFirst };
  void nameH;
  void nameA;
  if (hr !== ar) {
    const homeWon = hr > ar;
    const winnerBattedFirst = (homeWon && homeFirst) || (!homeWon && !homeFirst);
    const margin = winnerBattedFirst ? `${Math.abs(hr - ar)} runs` : wktsMarginStr(inn2);
    return { hs, as, hr, ar, winner: homeWon ? "H" : "A", margin, detail };
  }
  const so = superOverNamed(H.bat, H.bowl, A.bat, A.bowl, batH, bowlH, batA, bowlA, true, rng, nameH, nameA);
  detail.superOver = { inn1: so.inn1, inn2: so.inn2, firstIsHome: true };
  return {
    hs, as, hr, ar,
    winner: so.winnerIsUser ? "H" : "A",
    margin: "Super Over",
    superOverNote: `SO ${so.inn1.score}-${so.inn2.score}`,
    detail,
  };
}

// Circle-method double round robin for 10 teams -> 18 rounds x 5.
function doubleRoundRobin(): [number, number][][] {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const rounds: [number, number][][] = [];
  for (let r = 0; r < 9; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const a = arr[i];
      const b = arr[9 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  for (let r = 0; r < 9; r++) {
    rounds.push(rounds[r].map(([a, b]) => [b, a] as [number, number]));
  }
  return rounds;
}

export function simSharedLeague(
  humans: { name: string; deviceId: string; xi: PlayerSeason[] }[],
  roomSeed: number,
  diff: Difficulty
): SharedLeague {
  const ai = aiStrengths(roomSeed);
  const teams: SharedTeam[] = [
    ...humans.map((h) => ({ name: h.name, human: true as const, deviceId: h.deviceId })),
    ...LEAGUE_AI.map((name) => ({ name, human: false as const })),
  ];
  const strengths = [
    ...humans.map((h) => {
      const st = teamStrength(h.xi);
      return { bat: st.bat, bowl: st.bowl };
    }),
    ...ai,
  ];
  const xis = new Map<number, PlayerSeason[]>();
  humans.forEach((h, i) => xis.set(i, h.xi));

  const rounds = doubleRoundRobin();
  const fixtures: SharedFixture[] = [];
  rounds.forEach((round, ri) => {
    round.forEach(([h, a], mi) => {
      const rng = mulberry32((roomSeed + (ri * 5 + mi) * 0x9e3779b9) >>> 0);
      if (xis.has(h) && xis.has(a)) {
        const stH = strengths[h];
        const stA = strengths[a];
        const m = simH2H(xis.get(h)!, teams[h].name, stH.bat, stH.bowl, xis.get(a)!, teams[a].name, stA.bat, stA.bowl, rng);
        fixtures.push({ round: ri + 1, home: h, away: a, hs: m.hs, as: m.as, hr: m.hr, ar: m.ar, winner: m.winner === "H" ? h : a, margin: m.margin, superOverNote: m.superOverNote, detail: m.detail });
      } else {
        const m = simFixture(strengths[h].bat, strengths[h].bowl, strengths[a].bat, strengths[a].bowl, rng);
        fixtures.push({
          round: ri + 1, home: h, away: a, hs: m.hs, as: m.as, hr: m.hr, ar: m.ar,
          winner: m.winner === "H" ? h : a, margin: m.margin, superOverNote: m.superOverNote,
        });
      }
    });
  });

  const table: TableRow[] = teams.map((t, i) => {
    const mine = fixtures.filter((f) => f.home === i || f.away === i);
    let w = 0;
    let rf = 0;
    let ra = 0;
    for (const f of mine) {
      if (f.winner === i) w++;
      if (f.home === i) {
        rf += f.hr;
        ra += f.ar;
      } else {
        rf += f.ar;
        ra += f.hr;
      }
    }
    return { team: t.name, p: mine.length, w, l: mine.length - w, pts: w * 2, nrr: round2((rf - ra) / (mine.length * 20)), you: t.human };
  });
  table.sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);

  const idxOf = (name: string) => teams.findIndex((t) => t.name === name);
  const order = [...table].map((r) => r.team);
  const playoffs: SharedPlayoff[] = [];
  const playKO = (stage: string, nA: string, nB: string, salt: number): number => {
    const iA = idxOf(nA);
    const iB = idxOf(nB);
    const rng = mulberry32((roomSeed + salt) >>> 0);
    const aH = xis.has(iA);
    const bH = xis.has(iB);
    if (aH && bH) {
      const m = simH2H(xis.get(iA)!, nA, strengths[iA].bat, strengths[iA].bowl, xis.get(iB)!, nB, strengths[iB].bat, strengths[iB].bowl, rng);
      const winner = m.winner === "H" ? iA : iB;
      playoffs.push({ stage, t1: iA, t2: iB, s1: m.hs, s2: m.as, winner, margin: m.margin, superOverNote: m.superOverNote, detail: m.detail });
      return winner;
    }
    if (aH || bH) {
      const hi = aH ? iA : iB;
      const hsx = strengths[hi];
      const drng = mulberry32((roomSeed + salt + 13) >>> 0);
      const m = simDetailedMatch(xis.get(hi)!, hsx.bat, hsx.bowl, drng, diff, salt % 10);
      const userIsA = hi === iA;
      const s1 = userIsA ? (m.userFirst ? m.inn1.score : m.inn2.score) : (!m.userFirst ? m.inn1.score : m.inn2.score);
      const s2 = userIsA ? (!m.userFirst ? m.inn1.score : m.inn2.score) : (m.userFirst ? m.inn1.score : m.inn2.score);
      const winner = m.result === "W" ? hi : hi === iA ? iB : iA;
      playoffs.push({
        stage, t1: iA, t2: iB, s1, s2, winner, margin: m.margin,
        superOverNote: m.superOver ? `SO ${m.superOver.scoreline.split(" ")[1] ?? ""}` : undefined,
        detail: {
          inn1: m.inn1, inn2: m.inn2,
          firstIsHome: (m.userFirst && userIsA) || (!m.userFirst && !userIsA),
          superOver: m.superOver
            ? { inn1: m.superOver.inn1, inn2: m.superOver.inn2, firstIsHome: (m.userFirst && userIsA) || (!m.userFirst && !userIsA) }
            : undefined,
        },
      });
      return winner;
    }
    const m = simFixture(strengths[iA].bat, strengths[iA].bowl, strengths[iB].bat, strengths[iB].bowl, rng);
    const winner = m.winner === "H" ? iA : iB;
    playoffs.push({ stage, t1: iA, t2: iB, s1: m.hs, s2: m.as, winner, margin: m.margin, superOverNote: m.superOverNote });
    return winner;
  };
  const q1w = playKO("Qualifier 1", order[0], order[1], 910);
  const elW = playKO("Eliminator", order[2], order[3], 920);
  const q1l = q1w === idxOf(order[0]) ? idxOf(order[1]) : idxOf(order[0]);
  const q2w = playKO("Qualifier 2", teams[q1l].name, teams[elW].name, 930);
  playKO("Final", teams[q1w].name, teams[q2w].name, 940);

  return { teams, fixtures, table, playoffs };
}

// helpers
function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function countBy(xs: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return m;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
