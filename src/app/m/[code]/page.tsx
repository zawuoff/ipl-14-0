"use client";
import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RoomSeason, deviceId } from "@/components/RoomSeason";
import { copyText } from "@/lib/clipboard";
import { PrimaryButton, OutlineButton, WhatsAppIcon, Wordmark } from "@/components/ui";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = code.toUpperCase();
  const room = useQuery((api as any).rooms?.get, { code: upper });
  const joinRoom = useMutation((api as any).rooms?.join);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const meId = deviceId();

  const roomUrl =
    typeof window !== "undefined" ? `${window.location.origin}/m/${upper}` : `https://14-0.app/m/${upper}`;

  return (
    <main className="min-h-screen bg-ground text-ink flex flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-8 py-3.5 flex items-center gap-3">
          <a href="/" className="flex items-baseline gap-3">
            <Wordmark className="text-[30px]" />
            <span className="text-[13px] leading-[18px] text-muted">Back to the game</span>
          </a>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-8 pt-5 pb-12">
        <h1 className="font-semibold text-[26px] leading-8 lg:text-[32px] lg:leading-10">Play a friend</h1>
        <p className="text-[15px] leading-[22px] text-muted mt-1 max-w-[70ch]">
          You both draft your own XI. Then one shared league of 18 games decides it, and your
          head-to-head games count for real.
        </p>

        {room === undefined && <p className="text-[15px] text-muted py-6">Finding the room…</p>}
        {room === null && (
          <div className="mt-5 border border-hairline rounded-control p-5">
            <p className="font-semibold text-[18px] leading-6">No room with that code</p>
            <p className="text-[15px] leading-[22px] text-muted mt-1">
              Codes look like KX7Q2M. Check the link, or start a new room from the home page.
            </p>
          </div>
        )}

        {room && (
          <RoomLobby
            room={room}
            meId={meId}
            roomUrl={roomUrl}
            code={upper}
            name={name}
            setName={setName}
            joining={joining}
            setJoining={setJoining}
            joinRoom={joinRoom}
            copied={copied}
            setCopied={setCopied}
          />
        )}
      </div>
    </main>
  );
}

function RoomLobby({
  room,
  meId,
  roomUrl,
  code,
  name,
  setName,
  joining,
  setJoining,
  joinRoom,
  copied,
  setCopied,
}: {
  room: any;
  meId: string;
  roomUrl: string;
  code: string;
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

  const invite = `Play me at 14-0, the IPL draft game. Room ${code}: ${roomUrl}`;

  return (
    <>
      <div className="mt-5 -mx-5 lg:mx-0 lg:rounded-control lg:overflow-hidden bg-ink text-white px-5 py-5 lg:px-7 lg:py-6 flex flex-col gap-3.5">
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] leading-[18px] text-muted-plate">Room code</span>
          <span className="flex-1" />
          <span className="text-[13px] leading-[18px] text-muted-plate capitalize">
            {room.difficulty} · {bothIn ? "both seats taken" : "one seat open"}
          </span>
        </div>

        <div className="flex gap-1.5">
          {code.split("").map((ch, i) => (
            <span
              key={i}
              className="relative flex-1 h-[72px] flex items-center justify-center rounded-control bg-plate border border-plate-line overflow-hidden"
            >
              <span className="font-display font-bold text-[44px] sm:text-[52px] leading-none pt-1">{ch}</span>
              <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-ink" />
            </span>
          ))}
        </div>

        <div className="flex gap-2.5">
          {[0, 1].map((i) => {
            const m = members[i];
            return (
              <div
                key={i}
                className={`flex flex-col gap-0.5 flex-1 min-w-0 p-3.5 rounded-control ${
                  m ? "bg-plate" : "border border-dashed border-[#4A4A4A]"
                }`}
              >
                <span
                  className={`font-semibold text-[16px] leading-[22px] truncate ${
                    m ? "" : "text-muted-plate"
                  }`}
                >
                  {m ? m.name : "Open seat"}
                  {m && m.deviceId === meId ? " (you)" : ""}
                </span>
                <span
                  className={`text-[13px] leading-[18px] ${
                    m?.picks?.length === 11 ? "text-turf-soft" : "text-muted-plate"
                  }`}
                >
                  {m ? (m.picks?.length === 11 ? "XI locked" : "Drafting") : "Waiting for a friend"}
                </span>
              </div>
            );
          })}
        </div>

        {!bothIn && (
          <>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 h-14 rounded-control bg-turf text-white font-semibold text-[17px] hover:bg-[#15702f] transition-colors"
            >
              <WhatsAppIcon />
              Send invite on WhatsApp
            </a>
            <button
              onClick={async () => {
                if (await copyText(roomUrl)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="text-[13px] leading-[18px] text-muted-plate text-center hover:text-white transition-colors"
            >
              {copied ? "Link copied" : `Or copy the link: ${roomUrl}`}
            </button>
          </>
        )}
      </div>

      {!me && !bothIn && (
        <div className="mt-6 flex flex-col gap-2.5">
          <h2 className="font-semibold text-[17px] leading-[22px]">Take the open seat</h2>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doJoin()}
              placeholder="Your name"
              maxLength={14}
              className="flex-1 h-13 rounded-control border border-[#8A8A8A] px-3.5 text-[16px] outline-none focus:border-ink"
            />
            <OutlineButton className="h-13 px-6" disabled={!name.trim() || joining} onClick={doJoin}>
              {joining ? "…" : "Join"}
            </OutlineButton>
          </div>
        </div>
      )}

      {!me && bothIn && (
        <p className="mt-6 text-[15px] leading-[22px] text-muted border border-hairline rounded-control p-4">
          This room is full. Rematches are free — ask the host to start a new one.
        </p>
      )}

      {me && me.picks?.length !== 11 && (
        <div className="mt-6">
          <PrimaryButton
            className="w-full sm:w-auto sm:px-10"
            onClick={() => (window.location.href = `/?room=${room.code}`)}
          >
            {mate ? `Draft against ${mate.name}` : "Start your draft"}
          </PrimaryButton>
        </div>
      )}

      {me && me.picks?.length === 11 && !bothReady && (
        <p className="mt-6 text-[15px] leading-[22px] border border-hairline rounded-control p-4">
          Your XI is locked. Waiting for <b>{mate ? mate.name : "your opponent"}</b> to finish
          drafting. This page updates on its own.
        </p>
      )}

      {bothReady && (
        <div className="mt-8">
          <RoomSeason room={room} />
        </div>
      )}

      {!bothReady && (
        <div className="mt-8 flex flex-col gap-3">
          <h2 className="font-semibold text-[17px] leading-[22px] lg:text-[20px] lg:leading-[26px]">
            How a 1v1 works
          </h2>
          <p className="text-[15px] leading-[22px]">
            Each of you spins your own board and drafts your own XI. Same difficulty, same rules.
          </p>
          <p className="text-[15px] leading-[22px]">
            Once both XIs are locked, one 18-game league plays out with both teams in it. You meet
            each other twice.
          </p>
          <p className="text-[15px] leading-[22px]">
            Whoever finishes higher wins the room. A playoff final between you settles a tie.
          </p>
        </div>
      )}
    </>
  );
}
