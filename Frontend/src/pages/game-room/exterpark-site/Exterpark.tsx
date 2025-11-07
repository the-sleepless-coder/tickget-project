import { useEffect, useState } from "react";
import { Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PeopleIcon from "@mui/icons-material/People";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { paths } from "../../../app/routes/paths";
import RoomSettingModal from "../../room-modal/edit-room-setting/RoomSettingModal";
import Thumbnail03 from "../../../shared/images/thumbnail/Thumbnail03.webp";

type Participant = {
  name: string;
  isHost?: boolean;
  avatarUrl?: string;
};

const BANNER_HIDE_KEY = "iticket.topBannerHideUntil";

export default function ITicketPage() {
  const [secondsLeft, setSecondsLeft] = useState<number>(3);
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [reserveAppearedAt, setReserveAppearedAt] = useState<number | null>(
    null
  );
  const [nonReserveClickCount, setNonReserveClickCount] = useState<number>(0);
  const [isTrackingClicks, setIsTrackingClicks] = useState<boolean>(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);

  const participants: Participant[] = Array.from({ length: 18 }, (_, i) => ({
    name: "닉네임",
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

  useEffect(() => {
    if (secondsLeft === 0 && reserveAppearedAt === null) {
      const appearedTs = Date.now();
      setReserveAppearedAt(appearedTs);
      setNonReserveClickCount(0);
      setIsTrackingClicks(true);
      // Log: the moment the reserve button becomes available
      console.log("[ReserveTiming] Button appeared", {
        appearedAt: new Date(appearedTs).toISOString(),
      });
    }
  }, [secondsLeft, reserveAppearedAt]);

  useEffect(() => {
    if (!isTrackingClicks) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isReserveButton = Boolean(target.closest("[data-reserve-button]"));
      if (!isReserveButton) {
        setNonReserveClickCount((prev) => {
          const next = prev + 1;
          console.log("[ReserveTiming] Non-reserve click", { count: next });
          return next;
        });
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isTrackingClicks]);

  const formatted =
    secondsLeft < 10 ? `00:0${secondsLeft}` : `00:${secondsLeft}`;

  const openQueueWindow = () => {
    let finalUrl: string;
    const baseUrl =
      (paths as { booking: { waiting: string } })?.booking?.waiting ??
      "/booking/waiting";

    if (reserveAppearedAt) {
      const clickedTs = Date.now();
      const reactionMs = clickedTs - reserveAppearedAt;
      const reactionSec = Number((reactionMs / 1000).toFixed(3));
      // Log: reaction time between appearance and click
      console.log("[ReserveTiming] Reaction time until click", {
        reactionMs,
        reactionSec,
        appearedAt: new Date(reserveAppearedAt).toISOString(),
        clickedAt: new Date(clickedTs).toISOString(),
        nonReserveClickCount,
      });
      setIsTrackingClicks(false);
      finalUrl = `${baseUrl}?rtSec=${encodeURIComponent(String(reactionSec))}&nrClicks=${encodeURIComponent(String(nonReserveClickCount))}`;
    } else {
      console.log(
        "[ReserveTiming] Click without appearance timestamp (possibly test click)"
      );
      finalUrl = `${baseUrl}?rtSec=0&nrClicks=${encodeURIComponent(String(nonReserveClickCount))}`;
    }

    window.open(
      finalUrl,
      "_blank",
      "width=900,height=682,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=no"
    );
  };

  return (
    <>
      <div className="min-h-screen overflow-x-auto">
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

        <div className="productWrapper max-w-[1280px] w-full mx-auto px-4 md:px-6">
          <TagsRow />
          <TitleSection onOpenSettings={() => setIsRoomModalOpen(true)} />

          <div className="mt-6 flex flex-col md:flex-row gap-8">
            <div className="summary w-full md:w-[830px]">
              <div className="flex flex-col md:flex-row items-start">
                <PosterBox />
                <div className="ml-0 md:ml-[25px] my-0 mr-0 w-full md:w-[400px]">
                  <ParticipantList
                    participants={participants}
                    capacity={capacity}
                  />
                </div>
              </div>
            </div>
            <aside className="productSide w-full md:w-[370px] mt-6 md:mt-0">
              <StartInfoCard
                openText="티켓오픈"
                openAt="2025.10.23 18:00"
                remaining={formatted}
                canReserve={secondsLeft === 0}
                onReserve={openQueueWindow}
              />
            </aside>
          </div>
        </div>
      </div>
      <RoomSettingModal
        open={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
      />
    </>
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
        봇 3000명
      </Pill>
      <Pill bgVar="--color-c-blue-100" colorVar="--color-c-blue-200">
        익스터파크
      </Pill>
    </div>
  );
}

function TitleSection({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
        18시에 티켓팅하실 분 모집합니다
      </h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
        <span>소형</span>
        <span className="text-gray-300">|</span>
        <span>샤롯데씨어터</span>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-gray-500 cursor-pointer"
          onClick={onOpenSettings}
        >
          <SettingsOutlinedIcon fontSize="small" />
          <span>방 설정</span>
        </button>
      </div>
    </div>
  );
}

function PosterBox() {
  return (
    <div>
      <img
        src={Thumbnail03}
        alt="포스터 이미지"
        className="posterBoxImage w-40 h-56 md:w-[300px] md:h-[400px] object-cover rounded-lg border border-neutral-200"
      />
    </div>
  );
}

// removed SeatThumbnail and Legend in favor of PosterBox

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
  if (canReserve) {
    return <BookingCalendarCard onBook={onReserve} />;
  }
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
      <button
        className="mt-auto w-full py-4 rounded-lg bg-gray-200 text-gray-700 font-extrabold"
        disabled
        type="button"
      >
        남은시간 {remaining}
      </button>
    </section>
  );
}

function BookingCalendarCard({ onBook }: { onBook: () => void }) {
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const [month, setMonth] = useState<number>(today.getMonth());
  const [year, setYear] = useState<number>(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [selectedSlot, setSelectedSlot] = useState<string>("1회 14:30");
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(true);
  const [isTimesOpen, setIsTimesOpen] = useState<boolean>(true);

  const monthStart = new Date(year, month, 1);
  const startDay = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: Array<Array<number | null>> = [];
  let day = 1 - startDay; // Sunday-first grid
  for (let w = 0; w < 6; w++) {
    const week: Array<number | null> = [];
    for (let d = 0; d < 7; d++) {
      const dateNum = day;
      if (dateNum < 1 || dateNum > daysInMonth) week.push(null);
      else week.push(dateNum);
      day++;
    }
    weeks.push(week);
  }

  const monthLabel = `${year}. ${(month + 1).toString().padStart(2, "0")}`;

  const isSelected = (d: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === d
    );
  };

  const changeMonth = (delta: number) => {
    const base = new Date(year, month + delta, 1);
    setYear(base.getFullYear());
    setMonth(base.getMonth());
  };

  const dateMeta = (d: number) => {
    const dateObj = new Date(year, month, d);
    const isSunday = dateObj.getDay() === 0;
    // 오늘부터 2일 후까지만 활성화 (총 3일)
    const maxDate = new Date(todayStart);
    maxDate.setDate(todayStart.getDate() + 2);
    const isDisabled = dateObj < todayStart || dateObj > maxDate;
    const selected = isSelected(d);
    return { dateObj, isSunday, isDisabled, selected };
  };

  const formatSelectedDate = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    const weekday = "일월화수목금토"[date.getDay()];
    return `${y}.${m}.${d} (${weekday})`;
  };

  return (
    <section className="bg-white rounded-xl p-4 border border-neutral-200 shadow flex flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-base font-bold text-gray-900"
          onClick={() => setIsCalendarOpen((v) => !v)}
          aria-label="toggle-calendar"
        >
          관람일
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-7 w-7 grid place-items-center rounded-full text-gray-600 "
            onClick={() => changeMonth(-1)}
            aria-label="prev-month"
          >
            ‹
          </button>
          <div className="min-w-[120px] text-center font-semibold">
            {monthLabel}
          </div>
          <button
            type="button"
            className="h-7 w-7 grid place-items-center rounded-full text-gray-600 "
            onClick={() => changeMonth(1)}
            aria-label="next-month"
          >
            ›
          </button>
          <IconButton
            size="small"
            onClick={() => {
              setIsCalendarOpen((v) => !v);
              setIsTimesOpen(true);
            }}
            aria-label="collapse-calendar"
            className={`transition-transform ${isCalendarOpen ? "rotate-180" : ""}`}
            sx={{ color: "#6b7280", p: 0.5 }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white p-3">
        {/* Condensed date when collapsed */}
        {!isCalendarOpen && selectedDate && (
          <div className="text-lg font-semibold text-gray-900">
            {formatSelectedDate(selectedDate)}
          </div>
        )}

        <Collapse in={isCalendarOpen} timeout="auto">
          <div>
            {/* Weekday bar */}
            <div className="grid grid-cols-7 text-center text-xs text-gray-600 bg-gray-50 rounded-xl py-1">
              {"일월화수목금토".split("").map((ch) => (
                <div key={ch} className="py-1 font-medium">
                  {ch}
                </div>
              ))}
            </div>

            {/* Dates grid */}
            <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
              {weeks.map((wk, wi) => (
                <div key={wi} className="contents">
                  {wk.map((d, di) => {
                    if (!d) return <div key={di} className="py-2" />;
                    const { isSunday, isDisabled, selected } = dateMeta(d);
                    const baseColor = isDisabled
                      ? isSunday
                        ? "text-red-300"
                        : "text-gray-300"
                      : isSunday
                        ? "text-red-500"
                        : "text-gray-900";
                    return (
                      <button
                        key={di}
                        type="button"
                        disabled={isDisabled}
                        onClick={() =>
                          !isDisabled &&
                          setSelectedDate(new Date(year, month, d))
                        }
                        className={`mx-auto h-10 w-10 rounded-full text-sm transition-colors ${
                          selected
                            ? "bg-indigo-600 text-white"
                            : `${baseColor} ${isDisabled ? "" : "hover:bg-gray-100"}`
                        } ${isDisabled ? "cursor-not-allowed pointer-events-none" : ""}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Collapse>

        {/* Divider */}
        <div className="my-3 h-px bg-gray-100" />

        {/* Times header with toggle */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">회차</h4>
          <IconButton
            size="small"
            onClick={() => setIsTimesOpen((v) => !v)}
            aria-label="toggle-times"
            className={`transition-transform ${isTimesOpen ? "rotate-180" : ""}`}
            sx={{ color: "#6b7280", p: 0.5 }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </div>

        <Collapse in={isTimesOpen} timeout="auto">
          <div className="mt-2">
            <div className="grid grid-cols-2 gap-2">
              {[{ label: "1회 14:30" }].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSelectedSlot(s.label)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selectedSlot === s.label
                      ? "border-indigo-500 text-indigo-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-700">
              R석 147 / S석 134 / A석 224 / B석 288
            </div>
          </div>
        </Collapse>
      </div>

      {/* Actions inside same container, without outer border */}
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          data-reserve-button
          onClick={onBook}
          className="w-full py-4 rounded-xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700"
        >
          예매하기
        </button>
        <button
          type="button"
          className="w-full py-3 rounded-xl border text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-sm font-semibold"
        >
          BOOKING / 外國語
        </button>
      </div>
    </section>
  );
}
