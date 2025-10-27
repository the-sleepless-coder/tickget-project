import { useEffect, useState } from "react";
import PeopleIcon from "@mui/icons-material/People";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { paths } from "../../app/routes/paths";

type Participant = {
  name: string;
  isHost?: boolean;
  avatarUrl?: string;
};

const BANNER_HIDE_KEY = "iticket.topBannerHideUntil";

export default function ITicketPage() {
  const [secondsLeft, setSecondsLeft] = useState<number>(3);
  const [showBanner, setShowBanner] = useState<boolean>(true);

  const participants: Participant[] = Array.from({ length: 18 }, (_, i) => ({
    name: "닉네임123",
    isHost: i === 0,
    avatarUrl: `https://i.pravatar.cc/48?img=${(i % 70) + 1}`,
  }));
  const capacity = 20;

  useEffect(() => {
    const until = localStorage.getItem(BANNER_HIDE_KEY);
    if (until && Date.now() < Number(until)) {
      setShowBanner(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatted =
    secondsLeft < 10 ? `00:0${secondsLeft}` : `00:${secondsLeft}`;

  const openQueueWindow = () => {
    const url =
      (paths as { booking: { waiting: string } })?.booking?.waiting ??
      "/booking/waiting";
    window.open(
      url,
      "_blank",
      "width=900,height=682,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=no"
    );
  };

  return (
    <div className="min-h-screen">
      {showBanner && (
        <TopBanner
          onClose={(hideFor3Days) => {
            if (hideFor3Days) {
              const until = Date.now() + 3 * 24 * 60 * 60 * 1000;
              localStorage.setItem(BANNER_HIDE_KEY, String(until));
            }
            setShowBanner(false);
          }}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <TagsRow />
        <TitleSection />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SeatThumbnail />
          <ParticipantList participants={participants} capacity={capacity} />
          <StartInfoCard
            openText="티켓오픈"
            openAt="2025.10.23 18:00"
            remaining={formatted}
            canReserve={secondsLeft === 0}
            onReserve={openQueueWindow}
          />
        </div>
      </div>
    </div>
  );
}

function TopBanner({ onClose }: { onClose: (hideFor3Days: boolean) => void }) {
  const [dontShow, setDontShow] = useState(false);
  return (
    <div className="bg-gradient-to-r from-[#104BB7] to-[#072151] text-white">
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-3 text-sm">
        <p className="absolute inset-0 flex items-center justify-center font-semibold text-center pointer-events-none">
          본 경기는 티켓팅 연습용으로, 실제 티켓팅이 되지 않습니다.
        </p>
        <div className="flex items-center gap-4 justify-end">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            <span>3일간 보지않기</span>
          </label>
          <button
            aria-label="close-banner"
            onClick={() => onClose(dontShow)}
            className="text-xl leading-none"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function TagsRow() {
  const Pill = ({
    children,
    bgVar,
    colorVar,
  }: {
    children: string;
    bgVar: string;
    colorVar: string;
  }) => (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
      style={{ backgroundColor: `var(${bgVar})`, color: `var(${colorVar})` }}
    >
      {children}
    </span>
  );
  return (
    <div className="flex items-center gap-3 py-4">
      <Pill bgVar="--color-c-red-100" colorVar="--color-c-red-200">
        어려움
      </Pill>
      <Pill bgVar="--color-c-blue-100" colorVar="--color-c-blue-200">
        최대 10명
      </Pill>
      <Pill bgVar="--color-c-blue-100" colorVar="--color-c-blue-200">
        봇 3000명
      </Pill>
    </div>
  );
}

function TitleSection() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
        18시에 티켓팅하실 분 모집합니다
      </h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
        <span>돔형 콘서트장</span>
        <span className="text-gray-300">|</span>
        <span>커스텀</span>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-600"
        >
          <SettingsOutlinedIcon fontSize="small" />
          <span>방 설정</span>
        </button>
      </div>
    </div>
  );
}

function SeatThumbnail() {
  return (
    <section className="bg-white rounded-xl p-4 flex flex-col items-center border border-neutral-200 shadow">
      <img
        src="/temp-seats.jpg"
        alt="좌석 썸네일"
        className="w-full max-w-md rounded-md"
      />
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 w-full max-w-md">
        <Legend color="#6b21a8" label="VIP석" />
        <Legend color="#1d4ed8" label="R석" />
        <Legend color="#10b981" label="S석" />
        <Legend color="#f59e0b" label="A석" />
        <Legend color="#9ca3af" label="휠체어석" />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ParticipantList({
  participants,
  capacity,
}: {
  participants: Participant[];
  capacity: number;
}) {
  return (
    <section className="bg-white rounded-xl overflow-hidden border border-neutral-200 shadow">
      <div className="flex items-center justify-between px-4 py-3 bg-[#eef2ff]">
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          <PeopleIcon style={{ color: "var(--color-c-blue-200)" }} />
          <span>입장자</span>
        </div>
        <span className="text-sm text-gray-700 font-bold">
          {participants.length} / {capacity}명
        </span>
      </div>
      <ul className="max-h-[420px] overflow-y-auto py-1 space-y-1 pr-1 nice-scroll">
        {participants.map((p, idx) => (
          <li key={idx} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-700">
                  👤
                </span>
              )}
              <span className="text-gray-800">{p.name}</span>
            </div>
            {p.isHost && (
              <span className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-semibold">
                방장
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartInfoCard({
  openText,
  openAt,
  remaining,
  canReserve,
  onReserve,
}: {
  openText: string;
  openAt: string;
  remaining: string;
  canReserve: boolean;
  onReserve: () => void;
}) {
  return (
    <section className="bg-white rounded-xl p-6 flex flex-col items-stretch border border-neutral-200 shadow">
      <h3 className="text-lg font-bold text-gray-900 mb-4">경기시작안내</h3>
      <div className="rounded-xl border bg-[#fafafa] p-6 text-center mb-6">
        <div className="text-2xl font-extrabold text-red-500 mb-2">Start</div>
        <div className="text-gray-800 font-semibold">{openText}</div>
        <div className="text-gray-600 mt-1">{openAt}</div>
        <p className="text-xs text-gray-500 mt-3">
          경기가 위 시간에 시작될 예정이므로 준비해주세요.
        </p>
      </div>
      {canReserve ? (
        <button
          className="mt-auto w-full py-4 rounded-lg bg-blue-600 text-white font-extrabold hover:bg-blue-700"
          onClick={onReserve}
          type="button"
        >
          예매하기
        </button>
      ) : (
        <button
          className="mt-auto w-full py-4 rounded-lg bg-gray-200 text-gray-700 font-extrabold"
          disabled
          type="button"
        >
          남은시간 {remaining}
        </button>
      )}
    </section>
  );
}
