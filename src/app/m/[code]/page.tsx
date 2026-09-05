"use client";
import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RoomSeason, deviceId } from "@/components/RoomSeason";
import { copyText } from "@/lib/clipboard";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = code.toUpperCase();
  const room = useQuery((api as any).rooms?.get, { code: upper });
  const joinRoom = useMutation((api as any).rooms?.join);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const meId = deviceId();

  const roomUrl = typeof window !== "undefined" ? `${window.location.origin}/m/${upper}` : `/m/${upper}`;

  return (
    <main className="min-h-screen bg-[#060a08] text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <a href="/" className="text-sm text-zinc-400 hover:text-white">← 14-0 home</a>
        <h1 className="text-2xl font-black mt-2">
          ⚔️ Room <span className="font-mono text-emerald-300">/m/{upper}</span>
        </h1>

        {room === undefined && <p className="text-sm text-zinc-500 mt-4">Finding room…</p>}
        {room === null && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            No room with that code. Codes look like <span className="font-mono">KX7Q2M</span>.
          </div>
        )}

        {room && <RoomLobby room={room} meId={meId} roomUrl={roomUrl} name={name} setName={setName} joining={joining} setJoining={setJoining} joinRoom={joinRoom} copied={copied} setCopied={setCopied} />}
      </div>
    </main>
  );
}

function RoomLobby({
  room, meId, roomUrl, name, setName, joining, setJoining, joinRoom, copied, setCopied,
}: {
  room: any;
  meId: string;
  roomUrl: string;
  name: string;
  setName: (v: string) => void;
  joining: boolean;
  setJoining: (v: boolean) => void;
  joinRoom: any;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const members: any[] = room.members ?? [];
  const me = members.find((m) => m.deviceId === meId);
  const mate = members.find((m) => m.deviceId !== meId);
  const bothIn = members.length >= 2;
  const bothReady = members.length === 2 && members.every((m) => m.picks?.length === 11);

  const doJoin = async () => {
    if (!name.trim() || joining) return;
    setJoining(true);
    try {
      await joinRoom({ code: room.code, name: name.trim(), deviceId: meId });
    } catch {}
    setJoining(false);
  };

  return (
    <div className="mt-4 space-y-3">
      {/* managers */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => {
          const m = members[i];
          return (
            <div key={i} className={`rounded-xl border p-3 text-center ${m ? "border-emerald-300/40 bg-emerald-400/[0.06]" : "border-dashed border-white/15"}`}>
              {m ? (
                <>
                  <div className="font-black">{m.name}</div>
                  <div className="text-[11px] text-zinc-400">
                    {m.deviceId === meId ? "(you)" : ""} {m.picks?.length === 11 ? "· XI locked ✅" : "· drafting…"}
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500">Open seat</div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-400 text-center">
        {room.difficulty} · one shared 18-game table · head-to-head counts for both
      </p>

      {/* join */}
      {!me && !bothIn && (
        <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/[0.07] p-4">
          <div className="text-sm font-bold text-center">Take the open seat — your own spins, your own style</div>
          <div className="flex gap-2 mt-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doJoin()}
              placeholder="Your name (e.g. Yuvi)"
              maxLength={14}
              className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-300"
            />
            <button
              onClick={doJoin}
              disabled={!name.trim() || joining}
              className="px-5 py-2.5 rounded-lg bg-fuchsia-400 text-black font-black text-sm disabled:opacity-40"
            >
              {joining ? "…" : "Join"}
            </button>
          </div>
        </div>
      )}
      {!me && bothIn && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-zinc-400">
          Room is full — but rematches are free. Ask the host for a new room.
        </div>
      )}

      {/* share */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[11px] text-zinc-500">INVITE LINK (tap to select, works everywhere)</div>
        <div
          className="font-mono text-sm text-emerald-200 break-all mt-1 select-all cursor-text"
          onClick={async () => {
            if (await copyText(roomUrl)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {roomUrl}
        </div>
        <button
          onClick={async () => {
            if (await copyText(roomUrl)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="mt-2 w-full py-2 rounded-lg bg-white/10 border border-white/15 text-sm font-bold"
        >
          {copied ? "✅ Copied!" : "📋 Copy invite link"}
        </button>
      </div>

      {/* next step */}
      {me && me.picks?.length !== 11 && (
        <a
          href={`/?room=${room.code}`}
          className="block text-center py-3.5 rounded-2xl bg-emerald-400 text-black font-black text-lg hover:bg-emerald-300"
        >
          {mate ? `Draft vs ${mate.name} →` : "Start your draft →"}
        </a>
      )}
      {me && me.picks?.length === 11 && !bothReady && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/[0.06] p-4 text-center text-sm">
          XI locked ✅ — waiting for <b>{mate ? mate.name : "opponent"}</b> to finish drafting…
          <div className="text-[11px] text-zinc-500 mt-1">This page updates live.</div>
        </div>
      )}
      {bothReady && (
        <div className="rounded-2xl border border-emerald-300/30 bg-black/40 p-4">
          <div className="text-center text-sm text-zinc-300 mb-3">
            Both XIs locked — <b>one league, one table.</b> Good luck, managers.
          </div>
          <RoomSeason room={room} />
        </div>
      )}
    </div>
  );
}
