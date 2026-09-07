/* The name a manager puts on the board. Anonymous by default — the game has no
   accounts — so this is just a label kept on the device and sent with a result. */

const KEY = "14-0-name";
export const MAX_NAME = 14;

export function playerName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const clean = name.trim().slice(0, MAX_NAME);
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
  } catch {}
}
