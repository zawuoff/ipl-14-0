"use client";
import Link from "next/link";
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
  IconButton,
  SoundIcon,
  Chevron,
} from "@/components/ui";
import { useMuted } from "@/lib/sound";
import { useT, LangToggle } from "@/lib/i18n";
import {
  hasLockedXI,
  isHost,
  roomFull,
  roomMembers,
  roomReady,
  roomSeats,
  type RoomMember,
} from "@/lib/game/room";
import { SITE_URL } from "@/lib/site";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = code.toUpperCase();
  const t = useT();
  const [muted, toggleMuted] = useMuted();
  const room = useQuery((api as any).rooms?.get, { code: upper });
  // Every XI locked: the league is on, so the lobby chrome gets out of the way.
  const started = roomReady(room);
  const joinRoom = useMutation((api as any).rooms?.join);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const meId = deviceId();

  const roomUrl =
    typeof window !== "undefined" ? `${window.location.origin}/m/${upper}` : `${SITE_URL}/m/${upper}`;

  return (
    <main className="min-h-screen bg-ground text-white flex flex-col">
      <header className="bg-band">
        <div className="relative mx-auto w-full max-w-[1440px] px-3 lg:px-10 h-[56px] lg:h-[72px] flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[14px] leading-5 font-medium text-white/80 hover:text-accent transition-colors"
          >
            <span className="rotate-180 flex"><Chevron size={16} /></span>
            {t("nav.backToGame")}
          </Link>
          <Link
            href="/"
            aria-label="14-0"
            className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"
          >
            <Wordmark className="text-[30px] lg:text-[40px]" />
          </Link>
          <span className="flex-1" />
          <div className="shrink-0 flex items-center gap-1 lg:gap-3">
            <IconButton
              onClick={toggleMuted}
              label={muted ? t("run.soundOff") : t("run.soundOn")}
              className="w-10"
            >
              <SoundIcon on={!muted} />
            </IconButton>
            <LangToggle plain className="w-10 h-9 lg:w-[46px] lg:h-[34px] text-[13px] lg:text-[14px]" />
          </div>
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
  const closeSeats = useMutation((api as any).rooms?.closeSeats);
  const [closing, setClosing] = useState(false);
  const members: RoomMember[] = roomMembers(room);
  const seats = roomSeats(room);
  const me = members.find((m) => m.deviceId === meId);
  const rivals = members.filter((m) => m.deviceId !== meId);
  const full = roomFull(room);
  const open = Math.max(0, seats - members.length);
  const allReady = roomReady(room);
  const waitingOn = members.filter((m) => m.deviceId !== meId && !hasLockedXI(m));

  const doJoin = async () => {
    if (!name.trim() || joining) return;
    setJoining(true);
    try {
      await joinRoom({ code: room.code, name: name.trim(), deviceId: meId });
    } catch {}
    setJoining(false);
  };

  const invite = t("mroom.inviteText", { code, url: roomUrl });

  if (allReady) {
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
            {full
              ? seats === 2
                ? t("mroom.bothSeats")
                : t("mroom.allSeats", { n: seats })
              : open === 1
                ? t("mroom.oneSeat")
                : t("mroom.seatsOpen", { n: open })}
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

        {/* One tile per seat. Two managers still sit side by side, as before. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Array.from({ length: seats }, (_, i) => {
            const m = members[i];
            return (
              <div
                key={i}
                className={`flex flex-col gap-0.5 min-w-0 p-3.5 rounded-plate ${
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
                    hasLockedXI(m) ? "text-turf-soft" : m ? "text-muted-plate" : "text-muted"
                  }`}
                >
                  {m
                    ? hasLockedXI(m)
                      ? t("mroom.xiLocked")
                      : t("mroom.drafting")
                    : t("mroom.waitingFriend")}
                </span>
              </div>
            );
          })}
        </div>

        {!full && (
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
            {/* Nobody should be stuck waiting on a seat that is never coming. */}
            {isHost(room, meId) && members.length >= 2 && (
              <button
                disabled={closing}
                onClick={async () => {
                  if (closing) return;
                  setClosing(true);
                  try {
                    await closeSeats({ code: room.code, deviceId: meId });
                  } catch {}
                  setClosing(false);
                }}
                className="min-h-11 flex items-center justify-center text-[13px] leading-[18px] text-accent text-center hover:text-white transition-colors"
              >
                {t("mroom.closeSeats", { n: members.length })}
              </button>
            )}
          </>
        )}
      </div>

      {!me && !full && (
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

      {!me && full && (
        <p className="mt-6 text-[15px] leading-[22px] text-muted bg-surface rounded-card p-4">
          {t("mroom.full")}
        </p>
      )}

      {me && !hasLockedXI(me) && (
        <div className="mt-6">
          <PrimaryButton
            className="w-full sm:w-auto sm:px-10"
            onClick={() => (window.location.href = `/?room=${room.code}`)}
          >
            {rivals.length === 1
              ? t("mroom.draftAgainst", { name: rivals[0].name })
              : rivals.length > 1
                ? t("mroom.draftAgainstRoom")
                : t("mroom.startDraft")}
          </PrimaryButton>
        </div>
      )}

      {me && hasLockedXI(me) && (
        <p className="mt-6 text-[15px] leading-[22px] bg-surface rounded-card p-4">
          {!full
            ? t("mroom.waitingSeats", { n: open })
            : waitingOn.length === 1
              ? t("mroom.waitingFor", { name: waitingOn[0].name })
              : t("mroom.waitingForMany", { n: waitingOn.length })}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <SectionHead title={t("mroom.howTitle")} />
        <div className="bg-surface rounded-card p-4 lg:p-6 flex flex-col">
          {[
            t("mroom.how1"),
            t("mroom.how2", { n: seats }),
            t("mroom.how3"),
          ].map((line, i) => (
            <div key={i} className="flex gap-3.5 py-3 border-t border-hairline first:border-t-0">
              <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-plate bg-plate border border-plate-line font-display font-bold text-[22px] leading-none pt-1.5">
                {i + 1}
              </span>
              <p className="flex-1 min-w-0 text-[15px] leading-[22px] text-muted pt-1">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
