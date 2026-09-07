"use client";
import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RoomSeason, deviceId } from "@/components/RoomSeason";
import { copyText } from "@/lib/clipboard";
import { PrimaryButton, OutlineButton, WhatsAppIcon, Wordmark } from "@/components/ui";
import { useT, LangToggle } from "@/lib/i18n";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = code.toUpperCase();
  const t = useT();
  const room = useQuery((api as any).rooms?.get, { code: upper });
  // Both XIs locked: the league is on, so the lobby chrome gets out of the way.
  const started =
    !!room &&
    (room.members?.length ?? 0) === 2 &&
    room.members.every((m: any) => m.picks?.length === 11);
  const joinRoom = useMutation((api as any).rooms?.join);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const meId = deviceId();

  const roomUrl =
    typeof window !== "undefined" ? `${window.location.origin}/m/${upper}` : `https://14-0.app/m/${upper}`;

  return (
    <main className="min-h-screen bg-ground text-white flex flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-8 py-3.5 flex items-center gap-3">
          <a href="/" className="flex items-baseline gap-3">
            <Wordmark className="text-[30px]" />
            <span className="text-[13px] leading-[18px] text-muted">{t("nav.backToGame")}</span>
          </a>
          <span className="flex-1" />
          <LangToggle className="w-11 h-8 text-[14px]" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-8 pt-5 pb-12">
        {!started && (
          <>
            <h1 className="font-semibold text-[26px] leading-8 lg:text-[32px] lg:leading-10">
              {t("home.friend.title")}
            </h1>
            <p className="text-[15px] leading-[22px] text-muted mt-1 max-w-[70ch]">
              {t("mroom.how2")}
            </p>
          </>
        )}

        {room === undefined && <p className="text-[15px] text-muted py-6">{t("mroom.finding")}</p>}
        {room === null && (
          <div className="mt-5 border border-hairline rounded-control p-5">
            <p className="font-semibold text-[18px] leading-6">{t("mroom.noRoomTitle")}</p>
            <p className="text-[15px] leading-[22px] text-muted mt-1">
              {t("mroom.noRoomBody")}
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
  const t = useT();
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

  const invite = t("mroom.inviteText", { code, url: roomUrl });

  if (bothReady) {
    return (
      <>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-semibold text-[22px] leading-7 lg:text-[26px] lg:leading-8">
            {members.map((m) => m.name).join(t("mroom.against"))}
          </h1>
          <span className="text-[14px] leading-5 text-muted">
            {t("mroom.headerMeta", { code, difficulty: t(`difficulty.${room.difficulty}`) })}
          </span>
        </div>
        <div className="mt-4">
          <RoomSeason room={room} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mt-5 -mx-5 lg:mx-0 lg:rounded-card lg:overflow-hidden bg-surface text-white px-5 py-5 lg:px-7 lg:py-6 flex flex-col gap-3.5">
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] leading-[18px] text-muted-plate">{t("mroom.roomCode")}</span>
          <span className="flex-1" />
          <span className="text-[13px] leading-[18px] text-muted-plate">
            {t(`difficulty.${room.difficulty}`)} ·{" "}
            {bothIn ? t("mroom.bothSeats") : t("mroom.oneSeat")}
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
                  {m ? m.name : t("mroom.openSeat")}
                  {m && m.deviceId === meId ? ` ${t("room.you")}` : ""}
                </span>
                <span
                  className={`text-[13px] leading-[18px] ${
                    m?.picks?.length === 11 ? "text-turf-soft" : "text-muted-plate"
                  }`}
                >
                  {m
                    ? m.picks?.length === 11
                      ? t("mroom.xiLocked")
                      : t("mroom.drafting")
                    : t("mroom.waitingFriend")}
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
              {t("mroom.sendInvite")}
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
              {copied ? t("share.linkCopied") : t("mroom.orCopy", { url: roomUrl })}
            </button>
          </>
        )}
      </div>

      {!me && !bothIn && (
        <div className="mt-6 flex flex-col gap-2.5">
          <h2 className="font-semibold text-[17px] leading-[22px]">{t("mroom.takeSeat")}</h2>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doJoin()}
              placeholder={t("setup.yourName")}
              maxLength={14}
              className="flex-1 h-13 rounded-control border border-white/25 px-3.5 text-[16px] outline-none focus:border-white/30"
            />
            <OutlineButton className="h-13 px-6" disabled={!name.trim() || joining} onClick={doJoin}>
              {joining ? "…" : t("setup.join")}
            </OutlineButton>
          </div>
        </div>
      )}

      {!me && bothIn && (
        <p className="mt-6 text-[15px] leading-[22px] text-muted border border-hairline rounded-control p-4">
          {t("mroom.full")}
        </p>
      )}

      {me && me.picks?.length !== 11 && (
        <div className="mt-6">
          <PrimaryButton
            className="w-full sm:w-auto sm:px-10"
            onClick={() => (window.location.href = `/?room=${room.code}`)}
          >
            {mate ? t("mroom.draftAgainst", { name: mate.name }) : t("mroom.startDraft")}
          </PrimaryButton>
        </div>
      )}

      {me && me.picks?.length === 11 && !bothReady && (
        <p className="mt-6 text-[15px] leading-[22px] border border-hairline rounded-control p-4">
          {t("mroom.waitingFor", { name: mate ? mate.name : t("mroom.opponent") })}
        </p>
      )}

      {!bothReady && (
        <div className="mt-8 flex flex-col gap-3">
          <h2 className="font-semibold text-[17px] leading-[22px] lg:text-[20px] lg:leading-[26px]">
            {t("mroom.howTitle")}
          </h2>
          <p className="text-[15px] leading-[22px]">{t("mroom.how1")}</p>
          <p className="text-[15px] leading-[22px]">{t("mroom.how2")}</p>
          <p className="text-[15px] leading-[22px]">{t("mroom.how3")}</p>
        </div>
      )}
    </>
  );
}
