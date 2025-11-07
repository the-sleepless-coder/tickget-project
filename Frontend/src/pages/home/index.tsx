import RoomCard from "./_components/RoomCard";
import { useState } from "react";
import { Link } from "react-router-dom";
import { paths } from "../../app/routes/paths";
import CreateRoomModal from "../game-room/_components/CreateRoomModal";
import Thumbnail01 from "../../shared/images/thumbnail/Thumbnail01.webp";
import Thumbnail02 from "../../shared/images/thumbnail/Thumbnail02.webp";
import Thumbnail03 from "../../shared/images/thumbnail/Thumbnail03.webp";
import Thumbnail04 from "../../shared/images/thumbnail/Thumbnail04.webp";
import Thumbnail05 from "../../shared/images/thumbnail/Thumbnail05.webp";
import Thumbnail06 from "../../shared/images/thumbnail/Thumbnail06.webp";

type SortKey = "start" | "latest" | "all";

export default function HomePage() {
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  const [openCreate, setOpenCreate] = useState(false);
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
      venueName: "인스파이어 아레나",
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
      venueName: "인스파이어 아레나",
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
          src="/banner-get.webp"
          alt="tickget 배너"
          className="w-full select-none"
          draggable={false}
        />
      </div>

      {/* Full-width Event Banner */}
      <div className="mt-12  relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw]">
        <img
          src="/event-banner.webp"
          alt="이벤트 배너"
          className="w-screen select-none object-cover object-center max-h-62 sm:max-h-64 lg:max-h-70"
          draggable={false}
        />
      </div>

      {/* Section: 추천 방 목록 */}
      <div className="mt-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">추천 방 목록</h2>

          <Link
            to={paths.rooms}
            className="rounded-full bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 cursor-pointer"
          >
            전체 방 보기
          </Link>

          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="rounded-full bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 cursor-pointer"
          >
            + 방 만들기
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-sm">
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
      </div>

      <CreateRoomModal open={openCreate} onClose={() => setOpenCreate(false)} />

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
