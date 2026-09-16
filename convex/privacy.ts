/* A device id is the only key a player has. There are no accounts, so whoever
   holds the id can join rooms as that player, lock their XI, and claim their
   gift. It has to stay with the device that made it.

   Anything public that needs to tell players apart gets a stand-in instead: a
   SHA-256 of the id, scoped to where it is shown, so the same player reads the
   same within one room or one board and cannot be followed from one to the
   other, or walked back to the id. The one exception is the viewer's own row,
   which keeps the real id: they already have it, and it is how the page knows
   which seat is theirs. */

async function digestHex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** A stable stand-in for a device id, unique to one scope (a room code, "board"). */
export async function publicId(deviceId: string, scope: string): Promise<string> {
  return `p-${(await digestHex(`buildxi:${scope}:${deviceId}`)).slice(0, 20)}`;
}

/** Swap each deviceId for its stand-in, except the viewer's own. */
export async function maskDevices<T extends { deviceId: string }>(
  rows: T[],
  scope: string,
  viewer: string | undefined
): Promise<T[]> {
  return Promise.all(
    rows.map(async (r) =>
      viewer && r.deviceId === viewer ? r : { ...r, deviceId: await publicId(r.deviceId, scope) }
    )
  );
}

/** The row without its device id, for anything looked up by a public key such as a seed. */
export function withoutDevice<T extends { deviceId: string }>(row: T): Omit<T, "deviceId"> {
  const copy: Partial<T> = { ...row };
  delete copy.deviceId;
  return copy as Omit<T, "deviceId">;
}
