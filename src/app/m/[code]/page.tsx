"use client";
import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RoomSeason, deviceId } from "@/components/RoomSeason";
import { copyText } from "@/lib/clipboard";
import {
  Flap,
  OutlineButton,
  PageBand,
  PrimaryButton,
  SectionHead,
  WhatsAppIcon,
  Wordmark,
} from "@/components/ui";
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
      <header className="bg-band">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-16 h-[60px] lg:h-[72px] flex items-center gap-3">
          <a href="/" className="flex items-baseline gap-3">
            <Wordmark className="text-[30px]" />
            <span className="text-[13px] leading-[18px] text-white/70">{t("nav.backToGame")}</span>
          </a>
          <span className="flex-1" />
          <LangToggle className="w-11 h-9 text-[14px]" />
        </div>
      </header>

      {!started && <PageBand eyebrow={t("mroom.roomCode")} title={t("home.friend.title")} />}

      <div className="mx-auto w-full max-w-[1000px] px-5 lg:px-16 pt-5 lg:pt-7 pb-12">
        {room === undefined && <p className="text-[15px] text-muted py-6">{t("mroom.finding")}</p>}
        {room === null && (
          <div className="mt-1 bg-surface rounded-card p-5">
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
      <RoomSeason room={room} />
    );
  }

  return (
    <>
      <div className="mt-1 bg-surface rounded-card p-4 lg:p-7 flex flex-col gap-3.5">
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] leading-[18px] text-muted">{t("mroom.roomCode")}</span>
          <span className="flex-1" />
          <span className="text-[13px] leading-[18px] text-muted text-right">
            {t(`difficulty.${room.difficulty}`)} ·{" "}
            {bothIn ? t("mroom.bothSeats") : t("mroom.oneSeat")}
          </span>
        </div>

        {/* The code reads off the board, one flap per character. */}
        <div className="flex gap-1.5 lg:gap-2">
          {code.split("").map((ch, i) => (
            <Flap
              key={i}
              value={ch}
              wrapClassName="flex-1 min-w-0"
              className="h-[72px] lg:h-[84px]"
              valueClassName="text-[44px] leading-[40px] sm:text-[52px] sm:leading-[46px] lg:text-[58px] lg:leading-[52px]"
            />
          ))}
        </div>

        <div className="flex gap-2.5">
          {[0, 1].map((i) => {
            const m = members[i];
            return (
              <div
                key={i}
                className={`flex flex-col gap-0.5 flex-1 min-w-0 p-3.5 rounded-plate ${
                  m ? "bg-plate border border-plate-line" : "border border-dashed border-white/25"
                }`}
              >
                <span
                  className={`font-semibold text-[16px] leading-[22px] truncate ${
                    m ? "" : "text-muted"
                  }`}
                >
                  {m ? m.name : t("mroom.openSeat")}
                  {m && m.deviceId === meId ? ` ${t("room.you")}` : ""}
                </span>
                <span
                  className={`text-[13px] leading-[18px] ${
                    m?.picks?.length === 11 ? "text-turf-soft" : m ? "text-muted-plate" : "text-muted"
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
              className="flex items-center justify-center gap-2.5 h-14 rounded-full bg-turf text-white font-semibold text-[17px] hover:bg-[#15702f] active:bg-[#125f28] transition-colors"
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
              className="min-h-11 flex items-center justify-center text-[13px] leading-[18px] text-muted text-center hover:text-white transition-colors"
            >
              {copied ? t("share.linkCopied") : t("mroom.orCopy", { url: roomUrl })}
            </button>
          </>
        )}
      </div>

      {!me && !bothIn && (
        <div className="mt-6 flex flex-col gap-2.5">
          <SectionHead title={t("mroom.takeSeat")} />
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doJoin()}
              placeholder={t("setup.yourName")}
              maxLength={14}
              className="flex-1 h-13 rounded-full bg-surface border border-white/25 px-5 text-[16px] placeholder:text-faint outline-none focus:border-accent"
            />
            <OutlineButton className="h-13 px-6" disabled={!name.trim() || joining} onClick={doJoin}>
              {joining ? "…" : t("setup.join")}
            </OutlineButton>
          </div>
        </div>
      )}

      {!me && bothIn && (
        <p className="mt-6 text-[15px] leading-[22px] text-muted bg-surface rounded-card p-4">
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
        <p className="mt-6 text-[15px] leading-[22px] bg-surface rounded-card p-4">
          {t("mroom.waitingFor", { name: mate ? mate.name : t("mroom.opponent") })}
        </p>
      )}

      {!bothReady && (
        <div className="mt-8 flex flex-col gap-3">
          <SectionHead title={t("mroom.howTitle")} />
          <div className="bg-surface rounded-card p-4 lg:p-6 flex flex-col">
            {[t("mroom.how1"), t("mroom.how2"), t("mroom.how3")].map((line, i) => (
              <div key={i} className="flex gap-3.5 py-3 border-t border-hairline first:border-t-0">
                <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-plate bg-plate border border-plate-line font-display font-bold text-[22px] leading-none pt-1.5">
                  {i + 1}
                </span>
                <p className="flex-1 min-w-0 text-[15px] leading-[22px] text-muted pt-1">{line}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
