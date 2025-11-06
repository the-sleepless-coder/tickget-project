import RoomCard from "../home/_components/RoomCard";
import { useMemo, useState } from "react";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CreateRoomModal from "./_components/CreateRoomModal";
import Thumbnail01 from "../../shared/images/thumbnail/Thumbnail01.webp";
import Thumbnail02 from "../../shared/images/thumbnail/Thumbnail02.webp";
import Thumbnail03 from "../../shared/images/thumbnail/Thumbnail03.webp";
import Thumbnail04 from "../../shared/images/thumbnail/Thumbnail04.webp";
import Thumbnail05 from "../../shared/images/thumbnail/Thumbnail05.webp";
import Thumbnail06 from "../../shared/images/thumbnail/Thumbnail06.webp";

type SortKey = "start" | "latest";

export default function RoomsPage() {
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  const [query, setQuery] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const baseRooms = useMemo(
    () => [
      {
        title: "18시 모집합니다~~!! 18시 모집합니다~~!! 18시 모집합니다~~!!",
        variant: "blue" as const,
        size: "small" as const,
        venueName: "샤롯데씨어터",
        participants: { current: 8, capacity: 10 },
        startTime: "18:10",
        ongoing: false,
        imageSrc: Thumbnail01,
      },
      {
        title: "록페스티벌 가즈아",
        variant: "blue" as const,
        size: "medium" as const,
        venueName: "올림픽공원 올림픽홀",
        participants: { current: 1, capacity: 1 },
        startTime: "14:20",
        ongoing: false,
        imageSrc: Thumbnail02,
      },
      {
        title: "뮤지컬 킹키부츠 예매",
        variant: "blue" as const,
        size: "large" as const,
        venueName: "인스파이어 아레나",
        participants: { current: 15, capacity: 20 },
        startTime: "13:50",
        ongoing: true,
        imageSrc: Thumbnail03,
      },
      {
        title: "팬미팅 연습하실 분",
        variant: "blue" as const,
        size: "small" as const,
        venueName: "샤롯데씨어터",
        participants: { current: 10, capacity: 10 },
        startTime: "18:10",
        ongoing: true,
        imageSrc: Thumbnail04,
      },
      {
        title: "센과 치히로 내한",
        variant: "green" as const,
        size: "medium" as const,
        venueName: "올림픽공원 올림픽홀",
        participants: { current: 4, capacity: 5 },
        startTime: "14:30",
        ongoing: false,
        imageSrc: Thumbnail05,
      },
      {
        title: "B-Dragon 컴백콘서트",
        variant: "orange" as const,
        size: "large" as const,
        venueName: "인스파이어 아레나",
        participants: { current: 15, capacity: 20 },
        startTime: "14:50",
        ongoing: false,
        imageSrc: Thumbnail06,
      },
    ],
    []
  );
  const rooms = useMemo(() => {
    // 6개를 2번 반복하여 12개 구성
    return Array.from({ length: 12 }).map((_, idx) => ({
      id: idx,
      ...baseRooms[idx % baseRooms.length],
    }));
  }, [baseRooms]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRooms = rooms
    .filter((r) =>
      normalizedQuery ? r.title.toLowerCase().includes(normalizedQuery) : true
    )
    .filter((r) => {
      if (!availableOnly) return true;
      const isFull = r.participants
        ? r.participants.current >= r.participants.capacity
        : false;
      return !r.ongoing && !isFull;
    });
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* Search */}
      <div className="relative w-full max-w-3xl mx-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="text"
          placeholder="방 제목으로 검색"
          className="w-full rounded-full border border-gray-300 px-5 py-3 pr-12 text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
          <SearchIcon />
        </span>
      </div>

      {/* Heading + Controls */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 whitespace-nowrap overflow-x-auto md:overflow-visible">
          <h1 className="text-xl font-semibold text-gray-900">전체 방 목록</h1>
          <div className="hidden md:block">
            <Tooltip
              title={
                <span>
                  방의 <b className="text-purple-600">참가 인원, AI 봇 수</b>를
                  지정할 수 있습니다.
                </span>
              }
              placement="top"
              arrow
              slotProps={{
                tooltip: {
                  sx: {
                    borderRadius: 3,
                    px: 2,
                    py: 1.5,
                    fontSize: 14,
                    bgcolor: "#ffffff",
                    color: "#111827",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                  },
                },
                arrow: { sx: { color: "#ffffff" } },
              }}
            >
              <button
                type="button"
                aria-label="전체 방 목록 도움말"
                className="grid h-7 w-7 place-items-center rounded-full bg-purple-600 text-white shadow-md focus:outline-none"
              >
                <InfoOutlined sx={{ fontSize: 16 }} />
              </button>
            </Tooltip>
          </div>
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="rounded-full bg-purple-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-600 cursor-pointer"
          >
            + 방 만들기
          </button>
          <button
            type="button"
            aria-pressed={availableOnly}
            onClick={() => setAvailableOnly((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-colors cursor-pointer ${
              availableOnly
                ? "bg-purple-500 text-white hover:bg-purple-600"
                : "bg-purple-50 text-purple-600 hover:bg-purple-100"
            }`}
          >
            입장 가능
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm self-end md:self-auto">
          <button
            type="button"
            aria-pressed={activeSort === "start"}
            onClick={() => setActiveSort("start")}
            className={`rounded-full px-4 py-2 transition-colors cursor-pointer ${
              activeSort === "start"
                ? "text-purple-600 bg-purple-50"
                : "text-gray-900 bg-gray-100"
            }`}
          >
            시작순
          </button>
          <button
            type="button"
            aria-pressed={activeSort === "latest"}
            onClick={() => setActiveSort("latest")}
            className={`rounded-full px-4 py-2 transition-colors cursor-pointer ${
              activeSort === "latest"
                ? "text-purple-600 bg-purple-50"
                : "text-gray-900 bg-gray-100"
            }`}
          >
            최신순
          </button>
        </div>
      </div>

      <CreateRoomModal open={openCreate} onClose={() => setOpenCreate(false)} />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {filteredRooms.map((room) => (
          <RoomCard
            key={room.id}
            title={room.title}
            variant={room.variant}
            size={room.size}
            venueName={room.venueName}
            participants={room.participants}
            startTime={room.startTime}
            ongoing={room.ongoing}
            imageSrc={room.imageSrc}
          />
        ))}
      </div>
      {filteredRooms.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-500">
          검색 결과가 없습니다.
        </p>
      ) : null}
    </div>
  );
}
