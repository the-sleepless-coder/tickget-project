import RoomCard from "./_components/RoomCard";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";

type SortKey = "start" | "latest" | "all";

export default function HomePage() {
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src="/banner-get.png"
          alt="tickget 배너"
          className="w-full select-none"
          draggable={false}
        />
      </div>

      {/* Section: 추천 방 목록 */}
      <div className="mt-8 flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900">추천 방 목록</h2>
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          더보기
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              aria-pressed={activeSort === "start"}
              onClick={() => setActiveSort("start")}
              className={`rounded-full px-4 py-2 transition-colors ${
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
              className={`rounded-full px-4 py-2 transition-colors ${
                activeSort === "latest"
                  ? "text-purple-600 bg-purple-50"
                  : "text-gray-900 bg-gray-100"
              }`}
            >
              최신순
            </button>
          </div>

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
                aria-label="추천 방 목록 도움말"
                className="grid h-7 w-7 place-items-center rounded-full bg-purple-600 text-white shadow-md focus:outline-none"
              >
                <InfoOutlined sx={{ fontSize: 16 }} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 새로 만들기 카드 */}
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          <div>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white">
              +
            </div>
            새로운 방 만들기
          </div>
        </div>

        <RoomCard
          title="18시 모집합니다~~!! 18시 모집합니다~~!! 18시 모집합니다~~!!"
          variant="blue"
          badgeText="익스터파크"
        />
        <RoomCard
          title="18시 모집합니다~~!! 18시 시작"
          variant="purple"
          badgeText="익스터파크"
        />
        <RoomCard
          title="18시 모집합니다~~!! 18시 시작"
          variant="green"
          badgeText="워터멜론"
        />
        <RoomCard
          title="18시 모집합니다~~!! 18시 시작"
          variant="orange"
          badgeText="NO24"
        />
        <RoomCard title="18시 모집합니다~~!! 18시 시작" variant="gray" />
      </div>

      <div className="h-10" />
    </div>
  );
}
