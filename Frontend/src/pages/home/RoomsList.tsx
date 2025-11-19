import RoomCard from "./_components/RoomCard";
import { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { Snackbar, Alert } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CreateRoomModal from "../room/create-room/CreateRoomModal";
import { getRooms } from "@features/booking-site/api";
import type { RoomResponse } from "@features/booking-site/types";
import { useAuthStore } from "@features/auth/store";
import { paths } from "../../app/routes/paths";
import Thumbnail01 from "../../shared/images/thumbnail/Thumbnail01.webp";
import Thumbnail02 from "../../shared/images/thumbnail/Thumbnail02.webp";
import Thumbnail03 from "../../shared/images/thumbnail/Thumbnail03.webp";
import Thumbnail04 from "../../shared/images/thumbnail/Thumbnail04.webp";
import Thumbnail05 from "../../shared/images/thumbnail/Thumbnail05.webp";
import Thumbnail06 from "../../shared/images/thumbnail/Thumbnail06.webp";
import RoomSortControls from "./_components/RoomSortButton";
import { sortRooms } from "./_components/RoomSortUtil";

type SortKey = "start" | "latest";

export default function RoomsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSort, setActiveSort] = useState<SortKey>("start");
  const [query, setQuery] = useState("");
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
    startingSoon?: boolean;
    createdAtMs?: number;
    difficulty?: string;
    maxUserCount?: number;
    botCount?: number;
    totalSeat?: number;
  };

  const [rooms, setRooms] = useState<UiRoom[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startingSoonToastOpen, setStartingSoonToastOpen] = useState(false);

  // hallName을 한글로 변환하는 함수 (AI 생성도 실제 hallName 사용)
  const convertHallNameToKorean = (hallName: string): string => {
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
    // totalSeat가 있으면 "총 좌석 수 --명"으로 표시, 없으면 기존 "총 좌석 수 --명" 표시
    const maxUserLabel = totalSeat
      ? `총 좌석 수 ${totalSeat.toLocaleString()}명`
      : maxUserCount !== undefined
        ? `총 좌석 수 ${maxUserCount}명`
        : "총 좌석 수 1,000명";
    const botLabel = botCount !== undefined ? `봇 ${botCount}명` : "봇 0명";
    return `${difficultyLabel}  |  ${maxUserLabel}  |  ${botLabel}`;
  };

  // 방 목록 불러오기 함수
  const fetchRooms = useCallback(async () => {
    try {
      const slice = await getRooms({ page: 0, size: 12 });
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
          const normalizeS3Url = (value: string): string => {
            return /^https?:\/\//i.test(value)
              ? value
              : `https://s3.tickget.kr/${value}`;
          };
          const thumbnailImageSrc =
            getThumbnailImagePath(r.thumbnailType, r.thumbnailValue) ||
            (r.thumbnailType === "UPLOADED" && r.thumbnailValue
              ? normalizeS3Url(r.thumbnailValue)
              : undefined);
          const localizedHallName = convertHallNameToKorean(r.hallName);
          const displayHallName =
            r.hallType === "AI_GENERATED"
              ? `${localizedHallName} (AI 생성)`
              : localizedHallName;
          const nowMs = Date.now();
          const startingSoon =
            startAtMs !== undefined &&
            startAtMs > nowMs &&
            startAtMs - nowMs <= 30 * 1000;
          return {
            id: r.roomId,
            title: r.roomName,
            variant: "blue",
            size,
            venueName: displayHallName,
            imageSrc: thumbnailImageSrc,
            participants: {
              current: r.currentUserCount,
              capacity: r.maxUserCount,
            },
            startTime,
            startAtMs,
            ongoing: r.status === "PLAYING",
            startingSoon,
            createdAtMs,
            difficulty: r.difficulty,
            maxUserCount: r.maxUserCount,
            botCount: r.botCount,
            totalSeat: r.totalSeat,
          };
        }
      );
      // 기본 최신순 정렬
      mapped.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
      setRooms(mapped);
    } catch (e) {
      console.error("방 목록 불러오기 실패:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms, availableOnly]);

  // 상단 헤더 '새로운방'에서 전달된 state(openCreate) 처리
  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      setOpenCreate(true);
      // 한 번만 열리도록 state 초기화
      navigate(location.pathname, {
        replace: true,
        state: { ...state, openCreate: false },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRooms();
    setIsRefreshing(false);
  }, [fetchRooms]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRooms = rooms
    .filter((r) =>
      normalizedQuery ? r.title.toLowerCase().includes(normalizedQuery) : true
    )
    .filter((r) => {
      // 종료된 방(시작 시간이 없는 방)은 제외
      if (!r.startTime) return false;
      if (!availableOnly) return true;
      // 진행 중이거나 시작 준비 중이거나 최대 인원인 방은 제외
      const isFull = r.participants
        ? r.participants.current >= r.participants.capacity
        : false;
      const isStartingSoon = r.startingSoon === true;
      return !r.ongoing && !isStartingSoon && !isFull;
    });

  const sortedRooms = useMemo(() => {
    return sortRooms(
      filteredRooms,
      activeSort === "latest" ? "latest" : "start"
    );
  }, [filteredRooms, activeSort]);
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
      <div className="mt-6 flex flex-row items-center justify-between gap-3">
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
            onClick={() => {
              if (!userId || !nickname) {
                if (
                  confirm(
                    "로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?"
                  )
                ) {
                  navigate(paths.auth.login);
                }
                return;
              }
              setOpenCreate(true);
            }}
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
        <div className="flex items-center gap-3 text-sm shrink-0">
          <RoomSortControls
            activeSort={activeSort === "latest" ? "latest" : "start"}
            onChange={(k) => setActiveSort(k)}
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="group flex items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {sortedRooms.map((room) => (
          <RoomCard
            key={room.id}
            title={room.title}
            variant={room.variant}
            size={room.size}
            venueName={room.venueName}
            imageSrc={room.imageSrc}
            capacityText={generateCapacityText(
              room.difficulty,
              room.maxUserCount,
              room.botCount,
              room.totalSeat
            )}
            participants={room.participants}
            startTime={room.startTime}
            startAtMs={room.startAtMs}
            ongoing={room.ongoing}
            startingSoon={room.startingSoon}
            onStartingSoonBlocked={async () => {
              setStartingSoonToastOpen(true);
              await handleRefresh();
            }}
            roomId={room.id}
          />
        ))}
      </div>
      {sortedRooms.length === 0 ? (
        <div className="mt-30 mb-40 text-center text-md text-gray-500 leading-relaxed">
          현재 진행되는 경기가 없습니다.
        </div>
      ) : null}

      <Snackbar
        open={startingSoonToastOpen}
        autoHideDuration={2500}
        onClose={() => setStartingSoonToastOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setStartingSoonToastOpen(false)}
          severity="info"
          variant="filled"
          sx={{ width: "100%" }}
        >
          경기 시작 30초 전에는 입장이 불가능합니다. 방 목록을 새로고침했습니다.
        </Alert>
      </Snackbar>
    </div>
  );
}
