import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import InsertPhotoOutlined from "@mui/icons-material/InsertPhotoOutlined";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";
import InfoOutlined from "@mui/icons-material/InfoOutlined";

export default function CreateRoomModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  dayjs.locale("ko");
  const [startTime, setStartTime] = useState<Dayjs | null>(dayjs());
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<"소형" | "중형" | "대형">("소형");
  const [difficulty, setDifficulty] = useState<"쉬움" | "보통" | "어려움">(
    "쉬움"
  );
  const [venue, setVenue] = useState("");
  const [platform, setPlatform] = useState<string>("익스터파크");
  const [botCount, setBotCount] = useState<string>("");
  const [participantCount, setParticipantCount] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const sizeOptions = useMemo(() => ["소형", "중형", "대형"] as const, []);
  const diffOptions = useMemo(() => ["쉬움", "보통", "어려움"] as const, []);
  const botOptions = useMemo(() => [100, 500, 1000, 2000, 5000] as const, []);
  const sizeToVenues: Record<(typeof sizeOptions)[number], string[]> = {
    소형: ["샤롯데씨어터"],
    중형: ["올림픽공원 올림픽홀"],
    대형: ["올림픽 주경기장"],
  };
  const allowedVenues = sizeToVenues[size];
  const handleSelectSize = (label: (typeof sizeOptions)[number]) => {
    setSize(label);
    const [first] = sizeToVenues[label];
    setVenue(first);
  };
  const onThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    setThumbnailUrl(nextUrl);
  };
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="mt-4 px-8 bg-white rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between h-[50px]">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold">
                <TitleWithInfo />
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm text-purple-300 inline-flex items-center gap-1 cursor-pointer"
                  title="설정 불러오기"
                >
                  <span className="hidden sm:inline">설정 불러오기</span>
                </button>
                <button
                  type="button"
                  className="text-sm text-purple-600 inline-flex items-center gap-1 cursor-pointer"
                  title="현재 설정 저장"
                >
                  <span className="hidden sm:inline">현재 설정 저장</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="모달 닫기"
                className="text-2xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
          {/* small screens: actions in separate row, right-aligned */}
          <div className="mt-2 flex justify-end gap-2 md:hidden">
            <button
              type="button"
              className="text-sm text-gray-600 hover:text-gray-500 inline-flex items-center gap-1 cursor-pointer"
              title="현재 설정 저장"
            >
              <span className="inline">현재 설정 저장</span>
            </button>
            <button
              type="button"
              className="text-sm text-c-purple-200 inline-flex items-center gap-1 cursor-pointer"
              title="설정 불러오기"
            >
              <span className="inline">설정 불러오기</span>
            </button>
          </div>
        </div>
        <div className="px-8 py-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[270px_1fr] gap-6">
            <div className="flex flex-col">
              <label htmlFor="room-thumbnail" className="cursor-pointer">
                <div className="grid place-items-center rounded-md bg-gray-200 w-[240px] h-[320px] md:w-[260px] md:h-[347px] mx-auto md:mx-0 overflow-hidden">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="썸네일 미리보기"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="grid h-12 w-12 place-items-center text-gray-500">
                        <InsertPhotoOutlined sx={{ fontSize: 48 }} />
                      </div>
                      <div className="text-gray-500 mt-1 text-sm font-medium">
                        방 썸네일을 <br />
                        업로드할 수 있습니다
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <input
                id="room-thumbnail"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onThumbnailChange}
              />
            </div>

            <div className="flex-1 space-y-5">
              {/* Title at top */}
              <div className="relative">
                <label className="sr-only">방 제목</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="방 제목을 입력해주세요"
                  className="w-full border-b-2 border-gray-300 px-2 py-3 text-xl outline-none text-gray-700 focus:border-purple-600"
                  maxLength={50}
                />
                {/* <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-300">
                  (50자)
                </div> */}
              </div>

              {/* Middle: two columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: platform, difficulty, size */}
                <div className="space-y-4">
                  {/* Platform select */}
                  <div>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full border-b-2 border-gray-300 px-2 py-3 text-gray-600 outline-none focus:border-purple-600"
                    >
                      <option value="">예매처 선택</option>
                      <option value="익스터파크">익스터파크</option>
                      <option value="워터멜론">워터멜론</option>
                      <option value="NO24">NO24</option>
                    </select>
                  </div>

                  {/* Difficulty */}
                  <div className="flex items-center gap-2">
                    {diffOptions.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setDifficulty(label)}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          difficulty === label
                            ? label === "쉬움"
                              ? "bg-[#F9FBAD] text-[#8DBA07]"
                              : label === "보통"
                                ? "bg-[#FFEEA2] text-[#FF8800]"
                                : "bg-[#FFDEDE] text-[#FF4040]"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Size */}
                  <div className="flex items-center gap-2">
                    {sizeOptions.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleSelectSize(label)}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          size === label
                            ? label === "소형"
                              ? "bg-[#F9FBAD] text-[#8DBA07]"
                              : label === "중형"
                                ? "bg-[#FFEEA2] text-[#FF8800]"
                                : "bg-[#FFDEDE] text-[#FF4040]"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: participant, bot, venue */}
                <div className="space-y-4">
                  {/* Participant count */}
                  <div className="relative">
                    <input
                      value={participantCount}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        if (digits === "") {
                          setParticipantCount("");
                          return;
                        }
                        const num = Math.max(
                          1,
                          Math.min(10, parseInt(digits, 10))
                        );
                        setParticipantCount(String(num));
                      }}
                      className="w-full text-gray-600 border-b-2 border-gray-300 px-2 py-3 pr-20 outline-none focus:border-purple-600"
                      placeholder="참여 인원"
                      inputMode="numeric"
                    />
                    <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      최대 10 명
                    </div>
                  </div>

                  {/* Bot count (dropdown) */}
                  <div>
                    <select
                      value={botCount}
                      onChange={(e) => setBotCount(e.target.value)}
                      className="w-full border-b-2 border-gray-300 px-2 py-3 text-gray-600 outline-none focus:border-purple-600"
                    >
                      <option value="">봇 인원 선택</option>
                      {botOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt} 명
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Venue select (filtered by size) */}
                  <div>
                    <select
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="w-full border-b-2 border-gray-300 px-2 py-3 text-gray-700 outline-none focus:border-purple-600"
                    >
                      {allowedVenues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Time picker row */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">시작 시간</span>
                    <div className="w-[160px]">
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <TimePicker
                          label={undefined}
                          ampm={false}
                          format="HH:mm"
                          value={startTime}
                          onChange={(v: Dayjs | null) => setStartTime(v)}
                          slotProps={{
                            textField: {
                              size: "small",
                              fullWidth: true,
                              sx: {
                                "& .MuiInputBase-root": {
                                  borderRadius: "8px",
                                  backgroundColor: "#f3f4f6",
                                },
                              },
                            },
                          }}
                        />
                      </LocalizationProvider>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="mb-4 h-[50px] px-8 rounded-b-xl flex-shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            취소하기
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700"
          >
            방 생성하기
          </button>
        </div>
      </div>
    </div>
  );
}

function TitleWithInfo() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-bold">방 만들기</span>
      <InfoBubble />
    </div>
  );
}

function InfoBubble() {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label="방 만들기 도움말"
        className="grid h-6 w-6 place-items-center rounded-full bg-purple-600 text-white shadow-md focus:outline-none cursor-pointer"
      >
        <InfoOutlined sx={{ fontSize: 14 }} />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-[13px] text-gray-900 shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>
          <b className="text-purple-600">AI 봇</b>이 경기에 참여해 실제와 같은
          티켓팅을 연습할 수 있습니다.
        </span>
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-8 border-x-transparent border-t-8 border-t-white drop-shadow-sm" />
      </div>
    </div>
  );
}
