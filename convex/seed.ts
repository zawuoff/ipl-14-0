import { mutation, query } from "./_generated/server";

// Seed 156 teamSeasons + curated player subset into DB.
// Full playable pool also ships in src/lib/game/data.ts for instant offline play;
// this DB mirror powers squadForTeam queries + daily pool.
function range(a: number, b: number): number[] {
  const o: number[] = [];
  for (let i = a; i <= b; i++) o.push(i);
  return o;
}

const F: { f: string; code: (s: number) => string; name: (s: number) => string; colour: string; seasons: number[] }[] = [
  { f: "MI", code: () => "MI", name: () => "Mumbai Indians", colour: "#004BA0", seasons: range(2008, 2025) },
  { f: "RCB", code: () => "RCB", name: (s) => (s >= 2024 ? "Royal Challengers Bengaluru" : "Royal Challengers Bangalore"), colour: "#EC1C24", seasons: range(2008, 2025) },
  { f: "KKR", code: () => "KKR", name: () => "Kolkata Knight Riders", colour: "#3A225D", seasons: range(2008, 2025) },
  { f: "CSK", code: () => "CSK", name: () => "Chennai Super Kings", colour: "#FDB913", seasons: [...range(2008, 2015), ...range(2018, 2025)] },
  { f: "RR", code: () => "RR", name: () => "Rajasthan Royals", colour: "#EA1A85", seasons: [...range(2008, 2015), ...range(2018, 2025)] },
  { f: "DEL", code: (s) => (s >= 2019 ? "DC" : "DD"), name: (s) => (s >= 2019 ? "Delhi Capitals" : "Delhi Daredevils"), colour: "#17479E", seasons: range(2008, 2025) },
  { f: "PUN", code: (s) => (s >= 2021 ? "PBKS" : "KXIP"), name: (s) => (s >= 2021 ? "Punjab Kings" : "Kings XI Punjab"), colour: "#E81828", seasons: range(2008, 2025) },
  { f: "DCH", code: () => "DCH", name: () => "Deccan Chargers", colour: "#143975", seasons: range(2008, 2012) },
  { f: "SRH", code: () => "SRH", name: () => "Sunrisers Hyderabad", colour: "#FF822A", seasons: range(2013, 2025) },
  { f: "KTK", code: () => "KTK", name: () => "Kochi Tuskers Kerala", colour: "#E25B13", seasons: [2011] },
  { f: "PWI", code: () => "PWI", name: () => "Pune Warriors India", colour: "#00A9E0", seasons: [2011, 2012, 2013] },
  { f: "GL", code: () => "GL", name: () => "Gujarat Lions", colour: "#EB5E0B", seasons: [2016, 2017] },
  { f: "RPS", code: () => "RPS", name: (s) => (s === 2016 ? "Rising Pune Supergiants" : "Rising Pune Supergiant"), colour: "#2D0140", seasons: [2016, 2017] },
  { f: "GT", code: () => "GT", name: () => "Gujarat Titans", colour: "#1B1F3B", seasons: range(2022, 2025) },
  { f: "LSG", code: () => "LSG", name: () => "Lucknow Super Giants", colour: "#0057E2", seasons: range(2022, 2025) },
];

// [player, country, teamId, role, runs, sr, avg, wkts, econ, rating]
const PLAYERS: [string, string, string, "Opener" | "Middle" | "WK" | "AR" | "Pace" | "Spin", number, number, number, number, number, number][] = [
  ["Virat Kohli", "India", "RCB-2016", "Opener", 973, 152, 81, 0, 0, 99],
  ["Chris Gayle", "West Indies", "RCB-2012", "Opener", 733, 161, 61, 0, 0, 98],
  ["Jos Buttler", "England", "RR-2022", "Opener", 863, 149, 58, 0, 0, 97],
  ["Shubman Gill", "India", "GT-2023", "Opener", 890, 158, 59, 0, 0, 97],
  ["Lasith Malinga", "Sri Lanka", "MI-2011", "Pace", 30, 90, 8, 28, 5.95, 97],
  ["Andre Russell", "West Indies", "KKR-2019", "AR", 510, 205, 57, 11, 9.5, 97],
  ["David Warner", "Australia", "SRH-2016", "Opener", 848, 151, 61, 0, 0, 96],
  ["AB de Villiers", "South Africa", "RCB-2016", "Middle", 687, 169, 53, 0, 0, 96],
  ["Sunil Narine", "West Indies", "KKR-2012", "Spin", 40, 110, 10, 24, 5.47, 96],
  ["Shane Watson", "Australia", "RR-2008", "AR", 472, 152, 47, 17, 7.1, 96],
  ["Sunil Narine", "West Indies", "KKR-2024", "AR", 488, 181, 35, 17, 7.5, 96],
  ["Jasprit Bumrah", "India", "MI-2020", "Pace", 10, 80, 5, 27, 6.73, 96],
  ["Adam Gilchrist", "Australia", "DCH-2009", "Opener", 495, 152, 31, 0, 0, 92],
  ["Matthew Hayden", "Australia", "CSK-2009", "Opener", 572, 145, 52, 0, 0, 90],
  ["Sachin Tendulkar", "India", "MI-2010", "Opener", 618, 133, 48, 0, 0, 94],
  ["Suresh Raina", "India", "CSK-2010", "Middle", 520, 143, 47, 0, 0, 89],
  ["MS Dhoni", "India", "CSK-2011", "WK", 392, 135, 44, 0, 0, 87],
  ["Ravichandran Ashwin", "India", "CSK-2011", "Spin", 30, 100, 10, 20, 6.16, 89],
  ["Dwayne Bravo", "West Indies", "CSK-2013", "Pace", 120, 130, 15, 32, 7.95, 95],
  ["Michael Hussey", "Australia", "CSK-2013", "Opener", 733, 130, 52, 0, 0, 92],
  ["Suresh Raina", "India", "CSK-2013", "Middle", 548, 151, 42, 0, 0, 90],
  ["Harbhajan Singh", "India", "MI-2013", "Spin", 20, 90, 7, 24, 6.53, 88],
  ["Kieron Pollard", "West Indies", "MI-2013", "AR", 420, 157, 42, 10, 7.8, 89],
  ["Rohit Sharma", "India", "MI-2013", "Middle", 538, 132, 38, 0, 0, 89],
  ["Robin Uthappa", "India", "KKR-2014", "Opener", 660, 138, 44, 0, 0, 90],
  ["Glenn Maxwell", "Australia", "KXIP-2014", "Middle", 552, 188, 35, 0, 0, 90],
  ["Yuvraj Singh", "India", "PWI-2011", "AR", 343, 138, 34, 9, 7.5, 87],
  ["Brad Hodge", "Australia", "KTK-2011", "AR", 285, 135, 36, 7, 7.5, 82],
  ["Shaun Marsh", "Australia", "KXIP-2011", "Opener", 504, 146, 42, 0, 0, 88],
  ["Suresh Raina", "India", "GL-2016", "AR", 399, 145, 40, 2, 8, 84],
  ["Dwayne Smith", "West Indies", "GL-2016", "AR", 324, 150, 32, 6, 8.5, 83],
  ["Ben Stokes", "England", "RPS-2017", "AR", 316, 143, 32, 12, 7.2, 91],
  ["Jaydev Unadkat", "India", "RPS-2017", "Pace", 20, 90, 8, 24, 7.02, 89],
  ["Bhuvneshwar Kumar", "India", "SRH-2016", "Pace", 15, 90, 7, 23, 7.42, 91],
  ["Mustafizur Rahman", "Bangladesh", "SRH-2016", "Pace", 5, 70, 3, 17, 6.9, 88],
  ["Virat Kohli", "India", "RCB-2024", "Opener", 741, 155, 62, 0, 0, 95],
  ["Travis Head", "Australia", "SRH-2024", "Opener", 567, 192, 41, 0, 0, 93],
  ["Heinrich Klaasen", "South Africa", "SRH-2024", "WK", 479, 171, 40, 0, 0, 90],
  ["Abhishek Sharma", "India", "SRH-2024", "Opener", 484, 204, 32, 0, 0, 90],
  ["Kuldeep Yadav", "India", "DC-2024", "Spin", 10, 80, 5, 16, 8.65, 87],
  ["Rishabh Pant", "India", "DC-2024", "WK", 446, 155, 41, 0, 0, 87],
  ["Sanju Samson", "India", "RR-2024", "WK", 531, 153, 48, 0, 0, 88],
  ["Phil Salt", "England", "KKR-2024", "Opener", 435, 182, 40, 0, 0, 88],
  ["Shreyas Iyer", "India", "PBKS-2025", "Middle", 604, 175, 50, 0, 0, 91],
  ["Sai Sudharsan", "India", "GT-2025", "Opener", 759, 156, 54, 0, 0, 94],
  ["Suryakumar Yadav", "India", "MI-2025", "Middle", 717, 168, 65, 0, 0, 94],
  ["Mitchell Marsh", "Australia", "LSG-2025", "Opener", 627, 164, 48, 0, 0, 90],
  ["Josh Hazlewood", "Australia", "RCB-2025", "Pace", 5, 70, 3, 22, 8.77, 89],
  ["Varun Chakravarthy", "India", "KKR-2025", "Spin", 15, 85, 6, 21, 7.66, 90],
  ["Rishabh Pant", "India", "DD-2018", "WK", 684, 174, 53, 0, 0, 94],
  ["Kane Williamson", "New Zealand", "SRH-2018", "Middle", 735, 142, 53, 0, 0, 93],
  ["MS Dhoni", "India", "CSK-2018", "WK", 455, 151, 76, 0, 0, 92],
  ["Shane Watson", "Australia", "CSK-2018", "AR", 555, 155, 40, 6, 8.5, 92],
  ["Ambati Rayudu", "India", "CSK-2018", "Opener", 602, 150, 43, 0, 0, 89],
  ["KL Rahul", "India", "KXIP-2020", "Opener", 670, 129, 56, 0, 0, 92],
  ["Shikhar Dhawan", "India", "DC-2020", "Opener", 618, 145, 44, 0, 0, 90],
  ["Kagiso Rabada", "South Africa", "DC-2020", "Pace", 15, 90, 7, 30, 8.34, 95],
  ["Marcus Stoinis", "Australia", "DC-2020", "AR", 352, 148, 35, 13, 8.5, 88],
  ["Jofra Archer", "England", "RR-2020", "Pace", 30, 110, 10, 20, 6.55, 92],
  ["Trent Boult", "New Zealand", "MI-2020", "Pace", 10, 85, 5, 25, 7.97, 90],
  ["Quinton de Kock", "South Africa", "MI-2020", "Opener", 503, 141, 36, 0, 0, 88],
  ["Ishan Kishan", "India", "MI-2020", "Opener", 516, 144, 57, 0, 0, 88],
  ["Devdutt Padikkal", "India", "RCB-2020", "Opener", 473, 125, 32, 0, 0, 85],
];

export const stats = query({
  handler: async (ctx) => {
    const teams = await ctx.db.query("teamSeasons").collect();
    const first = await ctx.db.query("playerSeasons").take(1);
    return { teams: teams.length, hasPlayers: first.length > 0 };
  },
});

export const seedAll = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("teamSeasons").take(1);
    let teamsAdded = 0;
    if (existing.length === 0) {
      for (const fr of F) {
        for (const s of fr.seasons) {
          await ctx.db.insert("teamSeasons", {
            teamId: `${fr.code(s)}-${s}`,
            franchise: fr.f,
            season: s,
            code: fr.code(s),
            name: fr.name(s),
            colour: fr.colour,
          });
          teamsAdded++;
        }
      }
    }
    const pExisting = await ctx.db.query("playerSeasons").take(1);
    let playersAdded = 0;
    if (pExisting.length === 0) {
      for (const r of PLAYERS) {
        const [player, country, teamId, role, runs, sr, avg, wickets, econ, rating] = r;
        const dash = teamId.lastIndexOf("-");
        const season = parseInt(teamId.slice(dash + 1), 10);
        const code = teamId.slice(0, dash);
        const codeMap: Record<string, string> = {
          MI: "MI", RCB: "RCB", KKR: "KKR", CSK: "CSK", RR: "RR", DD: "DEL", DC: "DEL",
          KXIP: "PUN", PBKS: "PUN", DCH: "DCH", SRH: "SRH", KTK: "KTK", PWI: "PWI",
          GL: "GL", RPS: "RPS", GT: "GT", LSG: "LSG",
        };
        let bat = rating;
        let bowl = rating;
        if (role === "Opener" || role === "Middle" || role === "WK") {
          bat = rating;
          bowl = Math.max(5, Math.min(40, Math.round(rating * 0.3)));
        } else if (role === "Pace" || role === "Spin") {
          bowl = rating;
          bat = Math.max(5, Math.min(38, Math.round(rating * 0.28)));
        } else {
          bat = Math.max(40, rating - 2);
          bowl = Math.max(40, rating - 4);
        }
        await ctx.db.insert("playerSeasons", {
          player, country, overseas: country !== "India", teamId,
          franchise: codeMap[code] ?? code, season, role,
          runs, sr, avg, wickets, econ, bat, bowl, overall: rating,
        });
        playersAdded++;
      }
    }
    const teams = await ctx.db.query("teamSeasons").collect();
    return { teamsAdded, playersAdded, totalTeams: teams.length };
  },
});
