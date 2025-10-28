import RoomCard from "../home/_components/RoomCard";
import { useState } from "react";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CreateRoomModal from "./_components/CreateRoomModal";

type SortKey = "start" | "latest";
// Only show blue, orange, green in the order: blue, blue, blue, orange, green
const variantsPattern = ["blue", "blue", "blue", "orange", "green"] as const;
const titles = [
  "18시 모집합니다~~!! 18시 모집합니다~~!! 18시 모집합니다~~!!",
  "록페스티벌 가즈아",
  "뮤지컬 킹키부츠 예매",
  "팬미팅 연습하실 분",
  "센과 치히로 내한",
  "B-Dragon 컴백콘서트",
  "빨래하는 날",
  "가을 야구 보러가자",
] as const;
const badges = ["익스터파크", "워터멜론", "NO24"] as const;

export default function RoomsPage() {
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  const [query, setQuery] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const rooms = Array.from({ length: 12 }).map((_, idx) => ({
    id: idx,
    title: titles[idx % titles.length],
    variant: variantsPattern[idx % variantsPattern.length],
    badgeText: badges[idx % badges.length],
  }));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRooms = normalizedQuery
    ? rooms.filter((r) => r.title.toLowerCase().includes(normalizedQuery))
    : rooms;
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* Search */}
      <div className="relative w-full max-w-3xl mx-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="text"
          placeholder="방제목으로 검색"
          className="w-full rounded-full border border-gray-300 px-5 py-3 pr-12 text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
          <SearchIcon />
        </span>
      </div>

      {/* Heading + Controls */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
            aria-pressed={activeSort === "start"}
            onClick={() => setActiveSort("start")}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
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
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              activeSort === "latest"
                ? "text-purple-600 bg-purple-50"
                : "text-gray-900 bg-gray-100"
            }`}
          >
            최신순
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="rounded-full bg-purple-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-600"
          >
            + 방만들기
          </button>
        </div>
      </div>

      <CreateRoomModal open={openCreate} onClose={() => setOpenCreate(false)} />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRooms.map((room) => (
          <RoomCard
            key={room.id}
            title={room.title}
            variant={room.variant}
            badgeText={room.badgeText}
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
