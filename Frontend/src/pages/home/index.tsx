import RoomCard from "./_components/RoomCard";
import { useState } from "react";
import { Link } from "react-router-dom";
import { paths } from "../../app/routes/paths";
import Thumbnail01 from "../../shared/images/thumbnail/Thumbnail01.jpg";
import Thumbnail02 from "../../shared/images/thumbnail/Thumbnail02.jpg";
import Thumbnail03 from "../../shared/images/thumbnail/Thumbnail03.jpg";
import Thumbnail04 from "../../shared/images/thumbnail/Thumbnail04.jpg";
import Thumbnail05 from "../../shared/images/thumbnail/Thumbnail05.jpg";
import Thumbnail06 from "../../shared/images/thumbnail/Thumbnail06.jpg";

type SortKey = "start" | "latest" | "all";

export default function HomePage() {
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  const rooms = [
    {
      title: "18시 모집합니다~~!! 18시 모집합니다~~!! 18시 모집합니다~~!!",
      variant: "blue" as const,
      size: "small" as const,
      venueName: "샤롯데씨어터",
      participants: { current: 8, capacity: 10 },
      startTime: "18:10",
      imageSrc: Thumbnail01,
    },
    {
      title: "18시 모집합니다~~!! 18시 시작",
      variant: "blue" as const,
      size: "medium" as const,
      venueName: "올림픽공원 올림픽홀",
      participants: { current: 1, capacity: 1 },
      startTime: "14:20",
      imageSrc: Thumbnail02,
    },
    {
      title: "18시 모집합니다~~!! 18시 시작",
      variant: "blue" as const,
      size: "large" as const,
      venueName: "올림픽 주경기장",
      participants: { current: 15, capacity: 20 },
      startTime: "13:50",
      imageSrc: Thumbnail03,
    },
    {
      title: "18시 모집합니다~~!! 18시 시작",
      variant: "blue" as const,
      size: "small" as const,
      venueName: "샤롯데씨어터",
      participants: { current: 10, capacity: 10 },
      startTime: "18:10",
      imageSrc: Thumbnail04,
    },
    {
      title: "18시 모집합니다~~!! 18시 시작",
      variant: "green" as const,
      size: "medium" as const,
      venueName: "올림픽공원 올림픽홀",
      participants: { current: 4, capacity: 5 },
      startTime: "14:30",
      imageSrc: Thumbnail05,
    },
    {
      title: "18시 모집합니다~~!! 18시 시작",
      variant: "orange" as const,
      size: "large" as const,
      venueName: "올림픽 주경기장",
      participants: { current: 15, capacity: 20 },
      startTime: "14:50",
      imageSrc: Thumbnail06,
    },
  ];
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
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">
            추천 방 목록
          </h2>

          <Link
            to={paths.rooms}
            className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
          >
            전체방 보기
          </Link>
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {rooms.map((r, idx) => (
          <RoomCard
            key={idx}
            title={r.title}
            variant={r.variant}
            size={r.size}
            venueName={r.venueName}
            participants={r.participants}
            startTime={r.startTime}
            imageSrc={r.imageSrc}
          />
        ))}
      </div>

      <div className="h-10" />
    </div>
  );
}
