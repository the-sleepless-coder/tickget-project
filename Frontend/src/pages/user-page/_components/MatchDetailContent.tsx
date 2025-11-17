import { useState, useMemo, useEffect, useRef } from "react";
import TsxPreview from "../../../shared/components/TsxPreview";
import SmallVenue from "../../performance-halls/small-venue/CharlotteTheater";
import MediumVenue from "../../performance-halls/medium-venue/OlympicHall";
import LargeVenue from "../../performance-halls/large-venue/InspireArena";

interface UserRank {
  id: number;
  nickname: string;
  rank: number;
  seatArea: string;
  seatSection?: string;
  seatRow?: number;
  seatCol?: number;
  time?: string;
  metrics?: {
    bookingClick?: { reactionMs?: number; misclicks?: number };
    captcha?: {
      durationMs?: number;
      wrongCount?: number;
      backspaceCount?: number;
    };
    seatSelection?: {
      durationMs?: number;
      misclicks?: number;
      duplicateSeat?: number;
    };
  };
  differenceMetrics?: {
    bookingClick?: { reactionMs?: number; misclicks?: number };
    captcha?: { durationMs?: number; backspaceCount?: number };
    seatSelection?: {
      durationMs?: number;
      misclicks?: number;
      duplicateSeat?: number;
    };
  };
}

interface MatchDetailContentProps {
  mySeatArea: string;
  mySeatSection: string;
  users: UserRank[];
  totalTime?: number;
  date?: string;
  time?: string;
  onUserClick?: (user: UserRank) => void;
  isAIGenerated?: boolean;
  tsxUrl?: string | null;
  hallId?: number;
  roomType?: "SOLO" | "MULTI";
}

export default function MatchDetailContent({
  mySeatArea,
  mySeatSection,
  users,
  totalTime,
  onUserClick,
  isAIGenerated,
  tsxUrl,
  hallId,
  roomType,
}: MatchDetailContentProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [hoveredUserId, setHoveredUserId] = useState<number | null>(null);

  const meFallback: UserRank = {
    id: 0,
    nickname: "나",
    rank: 0,
    seatArea: mySeatArea,
    seatSection: mySeatSection,
  };
  const meUser: UserRank = users.find((u) => u.id === 0) ?? meFallback;
  const selectedUser: UserRank | undefined =
    selectedUserId !== null
      ? users.find((u) => u.id === selectedUserId)
      : undefined;
  const hoveredUser: UserRank | undefined =
    hoveredUserId !== null
      ? users.find((u) => u.id === hoveredUserId)
      : undefined;

  const formatMsToClock = (ms?: number): string => {
    if (!ms || ms < 0) return "00:00.00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    const hundredths = Math.floor((ms % 1000) / 10)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}.${hundredths}`;
  };

  const formatSecondsToClock = (seconds?: number): string => {
    if (!seconds || seconds < 0) return "00:00.00";
    const totalMs = Math.round(seconds * 1000);
    return formatMsToClock(totalMs);
  };

  const calculateTotalTime = (user: UserRank): number => {
    const booking = user.metrics?.bookingClick?.reactionMs ?? 0;
    const captcha = user.metrics?.captcha?.durationMs ?? 0;
    const seat = user.metrics?.seatSelection?.durationMs ?? 0;
    return booking + captcha + seat;
  };

  const diffSignVal = (
    a: number | undefined,
    b: number | undefined,
    suffix: string
  ): string => {
    const av = a ?? 0;
    const bv = b ?? 0;
    const d = av - bv;
    const sign = d > 0 ? "+" : d < 0 ? "-" : "±";
    const val = Math.abs(d);
    return `${sign} ${val}${suffix}`;
  };

  const diffSec = (aMs?: number, bMs?: number): string => {
    const a = aMs ?? 0;
    const b = bMs ?? 0;
    const d = Math.round(Math.abs(a - b) / 1000);
    const sign = a > b ? "+" : a < b ? "-" : "±";
    return `${sign} ${d}초`;
  };

  const StatCard = ({
    title,
    timeText,
    timeDiff,
    misclicksText,
    misclicksDiff,
    extraText,
    extraTextDiff,
    extraLabel,
  }: {
    title: string;
    timeText: string;
    timeDiff?: string;
    misclicksText: string;
    misclicksDiff?: string;
    extraText?: string;
    extraTextDiff?: string;
    extraLabel?: string;
  }) => (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="rounded-t-xl bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-600">
        {title}
      </div>
      <div className="space-y-3 px-6 py-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
            ⏲
          </span>
          <span className="text-neutral-600">소요 시간 :</span>
          <span className="text-base font-semibold text-neutral-900">
            {timeText}
            {timeDiff && (
              <span
                className={`ml-2 text-xs ${
                  timeDiff.startsWith("+")
                    ? "text-red-500"
                    : timeDiff.startsWith("-")
                      ? "text-blue-500"
                      : "text-neutral-500"
                }`}
              >
                ({timeDiff})
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
            🖱
          </span>
          <span className="text-neutral-600">클릭 실수 :</span>
          <span className="text-base font-semibold text-neutral-900">
            {misclicksText}
            {misclicksDiff && (
              <span
                className={`ml-2 text-xs ${
                  misclicksDiff.startsWith("+")
                    ? "text-red-500"
                    : misclicksDiff.startsWith("-")
                      ? "text-blue-500"
                      : "text-neutral-500"
                }`}
              >
                ({misclicksDiff})
              </span>
            )}
          </span>
        </div>
        {extraText && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
              ※
            </span>
            <span className="text-neutral-600">{extraLabel || "이선좌"} :</span>
            <span className="text-base font-semibold text-neutral-900">
              {extraText}
              {extraTextDiff && (
                <span
                  className={`ml-2 text-xs ${
                    extraTextDiff.startsWith("+")
                      ? "text-red-500"
                      : extraTextDiff.startsWith("-")
                        ? "text-blue-500"
                        : "text-neutral-500"
                  }`}
                >
                  ({extraTextDiff})
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const renderUserStats = (
    user: UserRank,
    _color: "purple" | "blue",
    baseline?: UserRank
  ) => {
    const booking = user.metrics?.bookingClick;
    const captcha = user.metrics?.captcha;
    const seat = user.metrics?.seatSelection;

    // 차이 값은 differenceMetrics에서 가져오기 (다른 사용자일 때만 존재)
    const diffBooking = user.differenceMetrics?.bookingClick;
    const diffCaptcha = user.differenceMetrics?.captcha;
    const diffSeat = user.differenceMetrics?.seatSelection;

    // 차이 값 포맷팅 함수
    const formatDiffMs = (ms?: number): string => {
      if (ms === undefined || ms === 0) return "";
      const sign = ms > 0 ? "+" : "-";
      const absMs = Math.abs(ms);
      return diffSec(absMs, 0).replace("±", sign);
    };

    const formatDiffCount = (count?: number, suffix: string = "번"): string => {
      if (count === undefined || count === 0) return "";
      const sign = count > 0 ? "+" : "-";
      return `${sign} ${Math.abs(count)}${suffix}`;
    };

    return (
      <div className="space-y-4">
        {/* 총 소요시간 표시 */}
        {totalTime !== undefined && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-6 py-4">
            <div className="text-center">
              <div className="text-sm font-medium text-purple-700">
                총 소요 시간
              </div>
              <div className="mt-1 text-2xl font-bold text-purple-900">
                {formatSecondsToClock(totalTime)}
              </div>
            </div>
          </div>
        )}
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-3`}>
          <StatCard
            title="예매 버튼 클릭"
            timeText={`${formatMsToClock(booking?.reactionMs ?? 0)}`}
            timeDiff={
              diffBooking?.reactionMs
                ? formatDiffMs(diffBooking.reactionMs)
                : undefined
            }
            misclicksText={`${booking?.misclicks ?? 0}번`}
            misclicksDiff={
              diffBooking?.misclicks !== undefined
                ? formatDiffCount(diffBooking.misclicks)
                : undefined
            }
          />
          <StatCard
            title="보안 문자"
            timeText={`${formatMsToClock(captcha?.durationMs ?? 0)}`}
            timeDiff={
              diffCaptcha?.durationMs
                ? formatDiffMs(diffCaptcha.durationMs)
                : undefined
            }
            misclicksText={`${captcha?.wrongCount ?? 0}번`}
            misclicksDiff={undefined}
            extraText={
              captcha?.backspaceCount !== undefined
                ? `${captcha.backspaceCount}번`
                : undefined
            }
            extraTextDiff={
              diffCaptcha?.backspaceCount !== undefined
                ? formatDiffCount(diffCaptcha.backspaceCount)
                : undefined
            }
            extraLabel="백스페이스"
          />
          <StatCard
            title="좌석 선택"
            timeText={`${formatMsToClock(seat?.durationMs ?? 0)}`}
            timeDiff={
              diffSeat?.durationMs
                ? formatDiffMs(diffSeat.durationMs)
                : undefined
            }
            misclicksText={`${seat?.misclicks ?? 0}번`}
            misclicksDiff={
              diffSeat?.misclicks !== undefined
                ? formatDiffCount(diffSeat.misclicks)
                : undefined
            }
            extraText={` ${seat?.duplicateSeat ?? 0}번`}
            extraTextDiff={
              diffSeat?.duplicateSeat !== undefined
                ? formatDiffCount(diffSeat.duplicateSeat)
                : undefined
            }
          />
        </div>
      </div>
    );
  };

  // SOLO 모드는 roomType이 "SOLO"인 경우에만
  // MULTI 모드는 roomType이 "MULTI"이거나 참가 인원이 2명 이상인 경우
  const isSoloMode =
    roomType === "SOLO" || (roomType !== "MULTI" && users.length === 1);

  // 공연장별 좌석 ID 변환 함수
  const convertSeatIdForVenue = useMemo(() => {
    return (
      hallId: number | undefined,
      seatSection: string | number,
      seatRow: string | number,
      seatCol: string | number
    ) => {
      if (!hallId) return null;

      // 문자열로 변환
      const section = String(seatSection);
      const row = String(seatRow);
      const col = String(seatCol);

      // SmallVenue (hallId === 2): small-${floor}-${displaySection}-${row}-${col}
      // 프리셋 모드에서는 displaySection이 "1" (OP는 "0")
      // floor는 1 또는 2인데, 사용자 정보에서 알 수 없으므로 1로 가정
      // row는 displayRowInSection, col은 seatCol
      if (hallId === 2) {
        // 프리셋 모드에서는 section을 "1"로 설정 (OP는 "0"이지만 일반적으로 "1")
        const displaySection = section === "0" ? "0" : "1";
        const floor = 1; // 기본값, 필요시 조정
        return `small-${floor}-${displaySection}-${row}-${col}`;
      }

      // MediumVenue & LargeVenue (hallId === 3 or 4): ${section}-${row}-${seat}
      // seatCol이 실제로 seat 번호인지 확인 필요
      // 일단 seatCol을 seat로 사용 (API 응답 형식에 따라 다를 수 있음)
      if (hallId === 3 || hallId === 4) {
        return `${section}-${row}-${col}`;
      }

      return null;
    };
  }, []);

  // 사용자 좌석 정보를 공연장별 좌석 ID로 변환
  // 호버된 유저가 있으면 해당 유저의 좌석만, 없으면 모든 좌석
  const selectedSeatIds = useMemo(() => {
    const targetUsers =
      hoveredUserId !== null
        ? users.filter((u) => u.id === hoveredUserId)
        : users;

    return targetUsers
      .filter((u) => u.seatSection && u.seatRow && u.seatCol)
      .map((u) => {
        const seatId = convertSeatIdForVenue(
          hallId,
          u.seatSection!,
          u.seatRow!,
          u.seatCol!
        );
        return seatId || `${u.seatSection}-${u.seatRow}-${u.seatCol}`;
      })
      .filter((id): id is string => id !== null);
  }, [users, hallId, convertSeatIdForVenue, hoveredUserId]);

  // 내 좌석 ID
  const mySeatId = useMemo(() => {
    const me = users.find((u) => u.id === 0);
    if (me?.seatSection && me.seatRow && me.seatCol) {
      const seatId = convertSeatIdForVenue(
        hallId,
        me.seatSection,
        me.seatRow,
        me.seatCol
      );
      return seatId || `${me.seatSection}-${me.seatRow}-${me.seatCol}`;
    }
    return null;
  }, [users, hallId, convertSeatIdForVenue]);

  // 호버된 유저의 섹션 번호 추출 (AI 생성 맵용, 컴포넌트 최상단에서 호출)
  const hoveredUserSeatIds = useMemo(() => {
    if (hoveredUserId === null) return [];
    const hoveredUser = users.find((u) => u.id === hoveredUserId);
    if (!hoveredUser || !hoveredUser.seatSection) {
      return [];
    }
    // 섹션 번호만 포함된 좌석 ID 형식으로 전달 (예: "12-0-0")
    // TsxPreview에서 섹션 번호를 추출하여 매칭함
    return [`${hoveredUser.seatSection}-0-0`];
  }, [hoveredUserId, users]);

  // SVG 자동 크기 조정을 위한 ref
  const seatMapContainerRef = useRef<HTMLDivElement>(null);

  // SVG 또는 SmallVenue 요소를 찾아서 자동 크기 조정
  useEffect(() => {
    const adjustSize = () => {
      const container = seatMapContainerRef.current;
      if (!container) return;

      // SVG 요소 찾기 (MediumVenue, LargeVenue, TsxPreview)
      const svg = container.querySelector("svg");
      if (svg) {
        // SVG의 고정 width/height 속성 제거
        svg.removeAttribute("width");
        svg.removeAttribute("height");

        // 컨테이너 크기 가져오기 (패딩 제외)
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // viewBox 가져오기
        const viewBox = svg.getAttribute("viewBox");
        if (viewBox) {
          const [, , vbWidth, vbHeight] = viewBox.split(" ").map(Number);
          const aspectRatio = vbWidth / vbHeight;
          const containerAspectRatio = containerWidth / containerHeight;

          // 컨테이너에 맞게 스케일 계산 (약간의 여유 공간을 두기 위해 0.98 배율 적용)
          let scale: number;
          if (aspectRatio > containerAspectRatio) {
            // 너비가 더 넓은 경우
            scale = (containerWidth * 0.98) / vbWidth;
          } else {
            // 높이가 더 높은 경우
            scale = (containerHeight * 0.98) / vbHeight;
          }

          // SVG 크기 설정
          const svgWidth = vbWidth * scale;
          const svgHeight = vbHeight * scale;
          svg.style.width = `${svgWidth}px`;
          svg.style.height = `${svgHeight}px`;
          svg.style.maxWidth = `${containerWidth}px`;
          svg.style.maxHeight = `${containerHeight}px`;
          svg.style.display = "block";
          svg.style.margin = "auto";
        } else {
          // viewBox가 없으면 기본 CSS 사용
          svg.style.width = "100%";
          svg.style.height = "100%";
          svg.style.maxWidth = "100%";
          svg.style.maxHeight = "100%";
          svg.style.display = "block";
          svg.style.margin = "auto";
        }

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        return;
      }

      // SmallVenue의 경우 (div 기반)
      const smallVenueContainer = container.querySelector('div[class*="grid"]');
      if (smallVenueContainer) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // SmallVenue의 실제 크기 측정
        const venueElement = smallVenueContainer as HTMLElement;
        const venueWidth = venueElement.scrollWidth;
        const venueHeight = venueElement.scrollHeight;

        if (venueWidth > 0 && venueHeight > 0) {
          const aspectRatio = venueWidth / venueHeight;
          const containerAspectRatio = containerWidth / containerHeight;

          // 컨테이너에 맞게 스케일 계산 (약간의 여유 공간을 두기 위해 0.98 배율 적용)
          let scale: number;
          if (aspectRatio > containerAspectRatio) {
            // 너비가 더 넓은 경우
            scale = (containerWidth * 0.98) / venueWidth;
          } else {
            // 높이가 더 높은 경우
            scale = (containerHeight * 0.98) / venueHeight;
          }

          // transform scale 적용
          venueElement.style.transform = `scale(${scale})`;
          venueElement.style.transformOrigin = "center center";
          venueElement.style.width = `${venueWidth}px`;
          venueElement.style.height = `${venueHeight}px`;
        }
      }
    };

    // 초기 조정 (약간의 지연을 두어 DOM이 완전히 렌더링된 후 실행)
    const timeoutId = setTimeout(adjustSize, 100);

    // MutationObserver로 SVG 또는 SmallVenue가 추가될 때 감지
    const observer = new MutationObserver(() => {
      setTimeout(adjustSize, 100);
    });

    if (seatMapContainerRef.current) {
      observer.observe(seatMapContainerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["width", "height", "viewBox", "style"],
      });
    }

    // ResizeObserver로 컨테이너 크기 변경 감지
    const resizeObserver = new ResizeObserver(adjustSize);
    if (seatMapContainerRef.current) {
      resizeObserver.observe(seatMapContainerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [selectedUserId, hoveredUserId, hallId, tsxUrl]);

  // 좌석 배치도 렌더링
  const renderSeatMap = () => {
    // AI 생성인 경우 - 우선순위 1
    // tsxUrl이 있고 "default"가 아니고 빈 문자열이 아닌 경우 렌더링
    // isAIGenerated가 false여도 tsxUrl이 있으면 AI 생성으로 간주
    const isValidTsxUrl =
      tsxUrl &&
      tsxUrl !== "default" &&
      tsxUrl !== null &&
      typeof tsxUrl === "string" &&
      tsxUrl.trim() !== "";

    // tsxUrl이 있으면 AI 생성으로 간주 (isAIGenerated가 false여도)
    // tsxUrl이 http:// 또는 https://로 시작하면 AI 생성으로 간주
    const shouldRenderAI =
      isValidTsxUrl &&
      (isAIGenerated ||
        (typeof tsxUrl === "string" &&
          (tsxUrl.startsWith("http://") || tsxUrl.startsWith("https://"))));

    if (shouldRenderAI) {
      // AI 생성 좌석 배치도에 선택된 좌석 정보 전달
      // selectedSeatIds는 section-row-col 형식
      // 호버 시: 해당 유저의 좌석만 색상 유지, 나머지 회색 처리
      // 호버 없을 때: 모든 좌석 원래 색상으로 표시
      // hoveredUserSeatIds는 컴포넌트 최상단에서 이미 계산됨
      return (
        <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
          <div
            ref={seatMapContainerRef}
            className="w-full h-full flex items-center justify-center"
          >
            <TsxPreview
              key={`match-detail-${tsxUrl}`}
              src={tsxUrl}
              className="w-full h-full"
              selectedSeatIds={hoveredUserSeatIds}
              readOnly={hoveredUserId !== null}
            />
          </div>
        </div>
      );
    }

    // AI 생성이지만 tsxUrl이 없는 경우 디버깅
    if (isAIGenerated && !isValidTsxUrl) {
      console.warn(
        "[MatchDetailContent] AI 생성이지만 tsxUrl이 유효하지 않음:",
        {
          isAIGenerated,
          tsxUrl,
          isValidTsxUrl,
        }
      );
    }

    // 프리셋인 경우 hallId 기준으로 렌더링 - 우선순위 2
    // AI 생성이 아니고 hallId가 있는 경우에만 프리셋 렌더링
    // shouldRenderAI가 false일 때만 프리셋 렌더링
    if (hallId && !shouldRenderAI) {
      // 모든 사용자의 좌석을 selectedIds에 포함 (내 좌석은 첫 번째로)
      const allSeatIds = mySeatId
        ? [mySeatId, ...selectedSeatIds.filter((id) => id !== mySeatId)]
        : selectedSeatIds;

      // hallId 2: 샤롯데씨어터 (SmallVenue)
      // 호버 시: 해당 유저의 좌석만 색상 유지, 나머지 회색 처리
      // 호버 없을 때: 모든 좌석 원래 색상으로 표시
      if (hallId === 2) {
        const hoveredUserSeatIds =
          hoveredUserId !== null
            ? users
                .filter(
                  (u) =>
                    u.id === hoveredUserId &&
                    u.seatSection &&
                    u.seatRow &&
                    u.seatCol
                )
                .map((u) => {
                  const seatId = convertSeatIdForVenue(
                    hallId,
                    u.seatSection!,
                    u.seatRow!,
                    u.seatCol!
                  );
                  return seatId || `${u.seatSection}-${u.seatRow}-${u.seatCol}`;
                })
                .filter((id): id is string => id !== null)
            : allSeatIds;

        return (
          <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
            <div
              ref={seatMapContainerRef}
              className="w-full h-full flex items-center justify-center"
            >
              <SmallVenue
                selectedIds={hoveredUserSeatIds}
                takenSeats={new Set(hoveredUserSeatIds)}
                isPreset={true}
                readOnly={hoveredUserId !== null}
              />
            </div>
          </div>
        );
      }

      // hallId 3: 올림픽홀 (MediumVenue)
      // 호버 시: 해당 유저의 좌석만 색상 유지, 나머지 회색 처리
      // 호버 없을 때: 모든 좌석 원래 색상으로 표시 (readOnly=false, selectedIds=[])
      if (hallId === 3) {
        const hoveredUserSeatIds =
          hoveredUserId !== null
            ? users
                .filter(
                  (u) =>
                    u.id === hoveredUserId &&
                    u.seatSection &&
                    u.seatRow &&
                    u.seatCol
                )
                .map((u) => {
                  const seatId = convertSeatIdForVenue(
                    hallId,
                    u.seatSection!,
                    u.seatRow!,
                    u.seatCol!
                  );
                  return seatId || `${u.seatSection}-${u.seatRow}-${u.seatCol}`;
                })
                .filter((id): id is string => id !== null)
            : [];

        return (
          <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
            <div
              ref={seatMapContainerRef}
              className="w-full h-full flex items-center justify-center"
            >
              <MediumVenue
                selectedIds={hoveredUserSeatIds}
                onToggleSeat={undefined}
                readOnly={true}
              />
            </div>
          </div>
        );
      }

      // hallId 4: 인스파이어 아레나 (LargeVenue)
      // 호버 시: 해당 유저의 좌석만 색상 유지, 나머지 회색 처리
      // 호버 없을 때: 모든 좌석 원래 색상으로 표시
      if (hallId === 4) {
        const hoveredUserSeatIds =
          hoveredUserId !== null
            ? users
                .filter(
                  (u) =>
                    u.id === hoveredUserId &&
                    u.seatSection &&
                    u.seatRow &&
                    u.seatCol
                )
                .map((u) => {
                  const seatId = convertSeatIdForVenue(
                    hallId,
                    u.seatSection!,
                    u.seatRow!,
                    u.seatCol!
                  );
                  return seatId || `${u.seatSection}-${u.seatRow}-${u.seatCol}`;
                })
                .filter((id): id is string => id !== null)
            : allSeatIds;

        return (
          <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
            <div
              ref={seatMapContainerRef}
              className="w-full h-full flex items-center justify-center"
            >
              <LargeVenue
                selectedIds={hoveredUserSeatIds}
                onToggleSeat={undefined}
                readOnly={true}
              />
            </div>
          </div>
        );
      }
    }

    // 기본 구역 뷰 (기존 코드)
    return (
      <div>
        {/* Stage */}
        <div className="mb-6 flex justify-center">
          <div className="h-4 w-64 rounded bg-black" />
        </div>

        {/* Seating Chart - 구역별 */}
        <div className="space-y-4">
          {/* 상단: A구역, B구역 */}
          <div className="grid grid-cols-2 gap-4">
            {/* A구역 */}
            <div>
              <div className="mb-2 text-center text-sm font-semibold text-neutral-700">
                A구역
              </div>
              <div
                className={`mx-auto h-24 w-full rounded-lg border-2 transition-colors ${
                  hoveredUserId === null
                    ? mySeatSection === "A"
                      ? "border-purple-300 bg-purple-100"
                      : "border-neutral-200 bg-neutral-100"
                    : hoveredUser?.seatSection === "A"
                      ? "border-blue-300 bg-blue-100"
                      : mySeatSection === "A"
                        ? "border-purple-300 bg-purple-100"
                        : "border-neutral-200 bg-neutral-100"
                }`}
              />
            </div>

            {/* B구역 */}
            <div>
              <div className="mb-2 text-center text-sm font-semibold text-neutral-700">
                B구역
              </div>
              <div
                className={`mx-auto h-24 w-full rounded-lg border-2 transition-colors ${
                  hoveredUserId === null
                    ? mySeatSection === "B"
                      ? "border-purple-300 bg-purple-100"
                      : "border-neutral-200 bg-neutral-100"
                    : hoveredUser?.seatSection === "B"
                      ? "border-blue-300 bg-blue-100"
                      : mySeatSection === "B"
                        ? "border-purple-300 bg-purple-100"
                        : "border-neutral-200 bg-neutral-100"
                }`}
              />
            </div>
          </div>

          {/* 하단: C구역, D구역 */}
          <div className="grid grid-cols-2 gap-4">
            {/* C구역 */}
            <div>
              <div className="mb-2 text-center text-sm font-semibold text-neutral-700">
                C구역
              </div>
              <div
                className={`mx-auto h-24 w-full rounded-lg border-2 transition-colors ${
                  hoveredUserId === null
                    ? mySeatSection === "C"
                      ? "border-purple-300 bg-purple-100"
                      : "border-neutral-200 bg-neutral-100"
                    : hoveredUser?.seatSection === "C"
                      ? "border-blue-300 bg-blue-100"
                      : mySeatSection === "C"
                        ? "border-purple-300 bg-purple-100"
                        : "border-neutral-200 bg-neutral-100"
                }`}
              />
            </div>

            {/* D구역 */}
            <div>
              <div className="mb-2 text-center text-sm font-semibold text-neutral-700">
                D구역
              </div>
              <div
                className={`mx-auto h-24 w-full rounded-lg border-2 transition-colors ${
                  hoveredUserId === null
                    ? mySeatSection === "D"
                      ? "border-purple-300 bg-purple-100"
                      : "border-neutral-200 bg-neutral-100"
                    : hoveredUser?.seatSection === "D"
                      ? "border-blue-300 bg-blue-100"
                      : mySeatSection === "D"
                        ? "border-purple-300 bg-purple-100"
                        : "border-neutral-200 bg-neutral-100"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-purple-300" />
            <span className="text-sm text-neutral-700">나</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-300" />
            <span className="text-sm text-neutral-700">다른 유저</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex overflow-x-auto ${isSoloMode ? "" : "gap-6"}`}>
      {/* 좌측: 전체 등수 - 솔로 모드가 아니고 선택되지 않았을 때만 표시 */}
      {!isSoloMode && selectedUserId === null && (
        <div className="min-w-[224px] w-56 shrink-0 md:min-w-[256px] md:w-64 lg:min-w-[288px] lg:w-72">
          <h4 className="mb-4 text-base font-bold">전체 등수</h4>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-2">
            {users
              .slice()
              .sort((a, b) => a.rank - b.rank)
              .map((user) => (
                <div
                  key={user.id}
                  onMouseEnter={() => setHoveredUserId(user.id)}
                  onMouseLeave={() => setHoveredUserId(null)}
                  onClick={(e) => {
                    // 더블클릭 또는 컨텍스트 메뉴(우클릭)로 유저 전체 통계 보기
                    if (e.detail === 2 || e.type === "contextmenu") {
                      e.preventDefault();
                      if (onUserClick) {
                        onUserClick(user);
                      }
                    } else {
                      // 싱글클릭은 기존 동작 (상세 정보)
                      setSelectedUserId((prev) =>
                        prev === user.id ? null : user.id
                      );
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (onUserClick) {
                      onUserClick(user);
                    }
                  }}
                  className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                    selectedUserId === user.id
                      ? "border-purple-500 bg-purple-50"
                      : hoveredUserId === user.id
                        ? "border-blue-400 bg-blue-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50"
                  }`}
                >
                  <span className="text-lg font-bold text-neutral-600">
                    {user.rank}.
                  </span>
                  <div className="ml-3 mr-3 h-8 w-8 rounded-full bg-neutral-300" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base text-neutral-700">
                        {user.nickname}
                      </span>
                      {user.seatSection && user.seatRow && user.seatCol && (
                        <span className="text-xs text-neutral-500">
                          ({user.seatSection}-{user.seatRow}번 {user.seatCol}번)
                        </span>
                      )}
                    </div>
                    {user.metrics && (
                      <div className="mt-1 text-xs text-neutral-500">
                        총 소요 시간:{" "}
                        {formatMsToClock(calculateTotalTime(user))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 우측: 구역 뷰 또는 통계 뷰 */}
      <div className="min-w-[320px] flex-1">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          {selectedUserId === null && !isSoloMode ? (
            renderSeatMap()
          ) : (
            <div className="space-y-6">
              {/* 선택된 유저가 나인지 비교 */}
              {!isSoloMode ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded ${selectedUser && selectedUser.id === 0 ? "bg-purple-400" : "bg-blue-400"}`}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        {selectedUser?.nickname}
                      </span>
                    </div>
                    <button
                      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                      onClick={() => setSelectedUserId(null)}
                    >
                      돌아가기
                    </button>
                  </div>
                  {selectedUser &&
                    renderUserStats(
                      selectedUser,
                      selectedUser.id === 0 ? "purple" : "blue",
                      selectedUser.id !== 0 ? meUser : undefined
                    )}
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-purple-400" />
                    <span className="text-sm font-medium text-neutral-700">
                      {meUser.nickname}
                    </span>
                    <span className="text-sm text-neutral-500">
                      ({mySeatSection}-{mySeatArea.replace("-", "번 ")}번)
                    </span>
                  </div>
                  {renderUserStats(meUser, "purple")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
