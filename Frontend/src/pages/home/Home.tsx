import RoomCard from "./_components/RoomCard";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { paths } from "../../app/routes/paths";
import CreateRoomModal from "../room/create-room/CreateRoomModal";
import { getRooms } from "@features/booking-site/api";
import type { RoomResponse } from "@features/booking-site/types";

type SortKey = "start" | "latest" | "all";

export default function HomePage() {
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  const [openCreate, setOpenCreate] = useState(false);

  type UiRoom = {
    id: number;
    title: string;
    variant?: "purple" | "blue" | "green" | "orange" | "gray";
    size?: "small" | "medium" | "large";
    venueName?: string;
    participants?: { current: number; capacity: number };
    startTime?: string;
    ongoing?: boolean;
    createdAtMs?: number;
  };

  const [rooms, setRooms] = useState<UiRoom[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const slice = await getRooms({ page: 0, size: 6 });
        const mapped: UiRoom[] = (slice.content ?? []).map(
          (r: RoomResponse): UiRoom => {
            const size =
              (r.hallSize?.toLowerCase() as UiRoom["size"]) ?? undefined;
            const createdAtMs = r.createdAt ? Date.parse(r.createdAt) : 0;
            const startTime =
              r.startTime && r.startTime.length >= 16
                ? r.startTime.substring(11, 16)
                : undefined;
            return {
              id: r.roomId,
              title: r.roomName,
              variant: "blue",
              size,
              venueName: r.hallName,
              participants: {
                current: r.currentUserCount,
                capacity: r.maxUserCount,
              },
              startTime,
              ongoing: r.status === "PLAYING",
              createdAtMs,
            };
          }
        );
        // 기본 최신순 정렬
        mapped.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
        if (!cancelled) setRooms(mapped);
      } catch (e) {
        console.error("추천 방 목록 불러오기 실패:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedRooms = useMemo(() => {
    if (activeSort === "latest") {
      return [...rooms].sort(
        (a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)
      );
    }
    return rooms;
  }, [rooms, activeSort]);
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
      <div className="mt-12  relative left-1/2 -translate-x-1/2 w-screen max-w-none overflow-x-hidden">
        <img
          src="/event-banner.webp"
          alt="이벤트 배너"
          className="block w-full select-none object-cover object-center max-h-62 sm:max-h-64 lg:max-h-70"
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
        {displayedRooms.map((r, idx) => (
          <RoomCard
            key={idx}
            title={r.title}
            variant={r.variant}
            size={r.size}
            venueName={r.venueName}
            participants={r.participants}
            startTime={r.startTime}
          />
        ))}
      </div>
      {displayedRooms.length === 0 ? (
        <div className="mt-30 mb-40 text-center text-md text-gray-500 leading-relaxed">
          티켓팅 연습방을 만들어보세요 !
        </div>
      ) : null}
      <div className="h-10" />
    </div>
  );
}
