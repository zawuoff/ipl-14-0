/* One reading of a room, shared by the lobby, the draft and the season screen.
   A room is a ten-team league with the managers sitting at the top of it, so
   the seat count is 2-5 and everything else counts against that. */

export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 5;

export interface RoomMember {
  deviceId: string;
  name: string;
  picks?: string[];
  seed?: string;
  submittedAt?: number;
  finishedAt?: number;
}

export interface Room {
  code: string;
  roomSeed: number;
  difficulty: string;
  maxPlayers?: number;
  members?: RoomMember[];
}

/** Seats in this room. Rooms opened before rooms could hold a crowd are 1v1s. */
export function roomSeats(room: Room | null | undefined): number {
  const n = room?.maxPlayers;
  if (!n || !Number.isFinite(n)) return MIN_ROOM_PLAYERS;
  return Math.max(MIN_ROOM_PLAYERS, Math.min(MAX_ROOM_PLAYERS, Math.floor(n)));
}

export function roomMembers(room: Room | null | undefined): RoomMember[] {
  return room?.members ?? [];
}

export function hasLockedXI(m: RoomMember | undefined | null): boolean {
  return (m?.picks?.length ?? 0) === 11;
}

/** Every seat taken. */
export function roomFull(room: Room | null | undefined): boolean {
  return roomMembers(room).length >= roomSeats(room);
}

/** Every seat taken and every XI in. Only then does the league exist. */
export function roomReady(room: Room | null | undefined): boolean {
  const ms = roomMembers(room);
  return roomFull(room) && ms.length >= MIN_ROOM_PLAYERS && ms.every(hasLockedXI);
}

/** The host is whoever opened the room — the first seat. */
export function isHost(room: Room | null | undefined, deviceId: string): boolean {
  return roomMembers(room)[0]?.deviceId === deviceId;
}
