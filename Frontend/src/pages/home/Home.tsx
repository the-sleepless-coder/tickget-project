import RoomCard from "./_components/RoomCard";
import { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { paths } from "../../app/routes/paths";
import CreateRoomModal from "../room/create-room/CreateRoomModal";
import { getRooms } from "@features/booking-site/api";
import type { RoomResponse } from "@features/booking-site/types";
import { useAuthStore } from "@features/auth/store";
import RoomSortControls from "./_components/RoomSortButton";
import { sortRooms } from "./_components/RoomSortUtil";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  const userId = useAuthStore((s) => s.userId);
  const nickname = useAuthStore((s) => s.nickname);

  type UiRoom = {
    id: number;
    title: string;
    variant?: "purple" | "blue" | "green" | "orange" | "gray";
    size?: "small" | "medium" | "large";
    venueName?: string;
    imageSrc?: string;
    participants?: { current: number; capacity: number };
    startTime?: string;
    startAtMs?: number;
    ongoing?: boolean;
    createdAtMs?: number;
    difficulty?: string;
    maxUserCount?: number;
    botCount?: number;
    totalSeat?: number;
  };

  const [rooms, setRooms] = useState<UiRoom[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // hallName을 한글로 변환하는 함수 (hallType이 AI_GENERATED면 "AI" 반환)
  const convertHallNameToKorean = (
    hallName: string,
    hallType?: string
  ): string => {
    // AI 생성된 방은 "AI"로 표시
    if (hallType === "AI_GENERATED") {
      return "AI";
    }
    const hallNameMap: Record<string, string> = {
      InspireArena: "인스파이어 아레나",
      CharlotteTheater: "샤롯데씨어터",
      OlympicHall: "올림픽공원 올림픽홀",
    };
    return hallNameMap[hallName] || hallName;
  };

  // 썸네일 번호 -> 이미지 매핑
  const THUMBNAIL_IMAGES: Record<string, string> = {
    "1": Thumbnail01,
    "2": Thumbnail02,
    "3": Thumbnail03,
    "4": Thumbnail04,
    "5": Thumbnail05,
    "6": Thumbnail06,
  };

  // thumbnailType이 PRESET일 때 thumbnailValue에 따라 썸네일 이미지 경로 반환
  const getThumbnailImagePath = (
    thumbnailType: string,
    thumbnailValue: string
  ): string | undefined => {
    if (thumbnailType === "PRESET" && thumbnailValue) {
      return THUMBNAIL_IMAGES[thumbnailValue];
    }
    return undefined;
  };

  // difficulty를 한글로 변환하는 함수
  const convertDifficultyToKorean = (difficulty: string): string => {
    const difficultyMap: Record<string, string> = {
      EASY: "쉬움",
      MEDIUM: "보통",
      HARD: "어려움",
    };
    return difficultyMap[difficulty] || difficulty;
  };

  // capacityText를 생성하는 함수
  const generateCapacityText = (
    difficulty?: string,
    maxUserCount?: number,
    botCount?: number,
    totalSeat?: number
  ): string => {
    const difficultyLabel = difficulty
      ? convertDifficultyToKorean(difficulty)
      : "어려움";
    // totalSeat가 있으면 "총 좌석 수 --명"으로 표시, 없으면 기존 "최대 --명" 표시
    const maxUserLabel = totalSeat
      ? `총좌석 ${totalSeat.toLocaleString()}명`
      : maxUserCount !== undefined
        ? `총 좌석수 ${maxUserCount}명`
        : "총 좌석수 1,000명";
    const botLabel = botCount !== undefined ? `봇 ${botCount}명` : "봇 0명";
    return `${difficultyLabel}  |  ${maxUserLabel}  |  ${botLabel}`;
  };

  // 방 목록 불러오기 함수
  const fetchRooms = useCallback(async () => {
    try {
      const slice = await getRooms({ page: 0, size: 6 });
      const mapped: UiRoom[] = (slice.content ?? []).map(
        (r: RoomResponse): UiRoom => {
          const size =
            (r.hallSize?.toLowerCase() as UiRoom["size"]) ?? undefined;
          const createdAtMs = r.createdAt ? dayjs(r.createdAt).valueOf() : 0;
          const startAtMs =
            r.startTime && dayjs(r.startTime).isValid()
              ? dayjs(r.startTime).valueOf()
              : undefined;
          const startTime =
            r.startTime && r.startTime.length >= 16
              ? r.startTime.substring(11, 16)
              : undefined;
          const thumbnailImageSrc = getThumbnailImagePath(
            r.thumbnailType,
            r.thumbnailValue
          );
          return {
            id: r.roomId,
            title: r.roomName,
            variant: "blue",
            size,
            venueName: convertHallNameToKorean(r.hallName, r.hallType),
            imageSrc: thumbnailImageSrc,
            participants: {
              current: r.currentUserCount,
              capacity: r.maxUserCount,
            },
            startTime,
            startAtMs,
            ongoing: r.status === "PLAYING",
            createdAtMs,
            difficulty: r.difficulty,
            maxUserCount: r.maxUserCount,
            botCount: r.botCount,
            totalSeat: r.totalSeat,
          };
        }
      );
      // 상태 업데이트 (정렬은 displayedRooms에서 처리)
      setRooms(mapped);
    } catch (e) {
      console.error("추천 방 목록 불러오기 실패:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRooms();
    setIsRefreshing(false);
  }, [fetchRooms]);

  const displayedRooms = useMemo(() => {
    // 진행 중인 방은 추천 방 목록에서 제외
    const filteredRooms = rooms.filter((r) => !r.ongoing);
    return sortRooms(
      filteredRooms,
      activeSort === "latest" ? "latest" : "start"
    );
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
            onClick={() => {
              if (!userId || !nickname) {
                alert("로그인이 필요합니다.");
                return;
              }
              setOpenCreate(true);
            }}
            className="rounded-full bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 cursor-pointer"
          >
            + 방 만들기
          </button>
        </div>

        <div className="flex items-center gap-3">
          <RoomSortControls
            activeSort={activeSort === "latest" ? "latest" : "start"}
            onChange={(k) => setActiveSort(k)}
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="group flex items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="새로고침"
          >
            <RefreshIcon
              className={
                isRefreshing
                  ? "animate-spin"
                  : "group-hover:animate-spin transition-transform"
              }
              sx={{ fontSize: 20 }}
            />
          </button>
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
            imageSrc={r.imageSrc}
            capacityText={generateCapacityText(
              r.difficulty,
              r.maxUserCount,
              r.botCount,
              r.totalSeat
            )}
            participants={r.participants}
            startTime={r.startTime}
            ongoing={r.ongoing}
            roomId={r.id}
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
