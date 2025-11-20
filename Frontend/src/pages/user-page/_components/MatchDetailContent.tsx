import { useState, useEffect, useRef } from "react";
import TsxPreview from "./TsxPreview";
import SmallVenue from "../../performance-halls/small-venue/CharlotteTheater";
import MediumVenue from "../../performance-halls/medium-venue/OlympicHall";
import LargeVenue from "../../performance-halls/large-venue/InspireArena";
import { normalizeProfileImageUrl } from "@shared/utils/profileImageUrl";

interface UserRank {
  id: number;
  nickname: string;
  rank: number;
  rankAmongUsers?: number;
  seatArea: string;
  seatSection?: string;
  seatRow?: number;
  seatCol?: number;
  time?: string;
  isCurrentUser?: boolean;
  profileImageUrl?: string | null;
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

function UserAvatar({
  nickname,
  profileImageUrl,
}: {
  nickname: string;
  profileImageUrl?: string | null;
}) {
  const [hasError, setHasError] = useState(false);
  const displayInitial = nickname?.trim().charAt(0)?.toUpperCase() || "U";

  if (!profileImageUrl || hasError) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 text-xs font-semibold text-white">
        {displayInitial}
      </div>
    );
  }

  return (
    <img
      src={profileImageUrl}
      alt={`${nickname} 프로필 이미지`}
      className="h-8 w-8 rounded-full object-cover"
      onError={() => setHasError(true)}
    />
  );
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

  const meFallback: UserRank = {
    id: 0,
    nickname: "나",
    rank: 0,
    seatArea: mySeatArea,
    seatSection: mySeatSection,
    isCurrentUser: true,
  };
  const meUser: UserRank =
    users.find((u) => u.isCurrentUser || u.id === 0) ?? meFallback;
  const selectedUser: UserRank | undefined =
    selectedUserId !== null
      ? users.find((u) => u.id === selectedUserId)
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

  type StatCardProps = {
    title: string;
    timeText: string;
    timeDiff?: string;
    misclicksText: string;
    misclicksDiff?: string;
    extraText?: string;
    extraTextDiff?: string;
    extraLabel?: string;
    hideMisclicks?: boolean;
    timeLabel?: string;
    misclicksLabel?: string;
    extraFirst?: boolean;
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
    hideMisclicks,
    timeLabel,
    misclicksLabel,
    extraFirst,
  }: StatCardProps) => (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="rounded-t-xl bg-purple-50 px-4 py-3 text-center text-sm font-semibold text-purple-700">
        {title}
      </div>
      <div className="space-y-3 px-6 py-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
            ⏲
          </span>
          <span className="text-neutral-600">{timeLabel ?? "소요 시간"} :</span>
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

        {/* 클릭 실수 / 추가 정보 영역 */}
        {extraFirst ? (
          <>
            {extraText && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
                  ※
                </span>
                <span className="text-neutral-600">
                  {extraLabel || "이선좌"} :
                </span>
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
            {!hideMisclicks && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
                  🖱
                </span>
                <span className="text-neutral-600">
                  {misclicksLabel ?? "클릭 실수"} :
                </span>
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
            )}
          </>
        ) : (
          <>
            {!hideMisclicks && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
                  🖱
                </span>
                <span className="text-neutral-600">
                  {misclicksLabel ?? "클릭 실수"} :
                </span>
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
            )}
            {extraText && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-700">
                  ※
                </span>
                <span className="text-neutral-600">
                  {extraLabel || "이선좌"} :
                </span>
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
          </>
        )}
      </div>
    </div>
  );

  const renderUserStats = (user: UserRank) => {
    const booking = user.metrics?.bookingClick;
    const captcha = user.metrics?.captcha;
    const seat = user.metrics?.seatSelection;

    // 차이 값은 differenceMetrics에서 가져오기 (다른 사용자일 때만 존재)
    const diffBooking = user.differenceMetrics?.bookingClick;
    const diffCaptcha = user.differenceMetrics?.captcha;
    const diffSeat = user.differenceMetrics?.seatSelection;

    // 차이 값 포맷팅 함수
    // - API에서 초 단위(예: 2.53)를 내려주지만,
    // - 과거 ms 단위(예: 2530)로 들어올 수도 있으므로 1000 이상이면 초로 보정
    const formatDiffMs = (raw?: number): string => {
      if (raw === undefined || raw === 0) return "";

      // 1000 이상이면 ms 단위로 판단하여 초 단위로 변환
      let seconds = raw;
      if (Math.abs(seconds) >= 1000) {
        seconds = seconds / 1000;
      }

      const sign = seconds > 0 ? "+" : "-";
      const absSeconds = Math.abs(seconds);
      const absStr = (Math.round(absSeconds * 1000) / 1000).toString(); // 소수 3자리까지
      return `${sign} ${absStr}초`;
    };

    const formatDiffCount = (count?: number, suffix: string = "번"): string => {
      if (count === undefined || count === 0) return "";
      const sign = count > 0 ? "+" : "-";
      return `${sign} ${Math.abs(count)}${suffix}`;
    };

    return (
      <div className="space-y-4">
        {/* 총 소요시간 표시 - 유저별 totalTime 사용, 없으면 props의 totalTime 사용 */}
        {(() => {
          const userTotalSeconds =
            user.time !== undefined ? Number(user.time) : totalTime;
          if (userTotalSeconds === undefined || isNaN(userTotalSeconds)) {
            return null;
          }
          return (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-6 py-4">
              <div className="text-center">
                <div className="text-sm font-medium text-purple-700">
                  총 소요 시간
                </div>
                <div className="mt-1 text-2xl font-bold text-purple-900">
                  {formatSecondsToClock(userTotalSeconds)}
                </div>
              </div>
            </div>
          );
        })()}
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-3`}>
          <StatCard
            title="예매 버튼 클릭"
            timeLabel="반응 속도"
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
            timeLabel="소요 시간"
            timeText={`${formatMsToClock(captcha?.durationMs ?? 0)}`}
            timeDiff={
              diffCaptcha?.durationMs
                ? formatDiffMs(diffCaptcha.durationMs)
                : undefined
            }
            misclicksText={`${captcha?.wrongCount ?? 0}번`}
            misclicksDiff={undefined}
            misclicksLabel="틀린 횟수"
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
            extraFirst
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
            hideMisclicks
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

  // 공연장별 좌석 ID 변환 함수 (프리셋 공연장용, 좌표 → seatId)
  const convertSeatIdForVenue = (
    hallId: number | undefined,
    seatSection: string | number,
    seatRow: string | number,
    seatCol: string | number
  ): string | null => {
    if (!hallId) return null;

    const section = String(seatSection);
    const row = String(seatRow);
    const col = String(seatCol);

    // SmallVenue (hallId === 2):
    // - 예약/기록 API에서는 "section-row-col" 형식의 seatId를 사용
    // - CharlotteTheater(SmallVenue) 컴포넌트에서도 동일한 형식을 사용해
    //   좌석을 식별하므로, 여기서는 그대로 반환한다.
    if (hallId === 2) {
      return `${section}-${row}-${col}`;
    }

    // MediumVenue & LargeVenue (hallId === 3 or 4): ${section}-${row}-${seat}
    if (hallId === 3 || hallId === 4) {
      return `${section}-${row}-${col}`;
    }

    return null;
  };

  // 좌석 선택 성공 여부 판단
  const hasAnyValidSeatSection = users.some(
    (u) =>
      u.seatSection !== undefined &&
      u.seatSection !== null &&
      u.seatSection !== "failed"
  );
  const allFailed = users.length > 0 && !hasAnyValidSeatSection;

  // AI/TSX 공연장용: 섹션 단위 seatId 목록 (예: "12-0-0") - 모든 참가자 섹션
  const aiSelectedSeatIds: string[] = (() => {
    if (!hasAnyValidSeatSection) return [];

    const sectionSet = new Set<string>();
    users.forEach((u) => {
      if (
        u.seatSection !== undefined &&
        u.seatSection !== null &&
        u.seatSection !== "failed"
      ) {
        const num = Number(u.seatSection);
        if (!Number.isNaN(num)) {
          const normalized = String(num);
          sectionSet.add(normalized);
        }
      }
    });
    const sortedSections = Array.from(sectionSet).sort(
      (a, b) => Number(a) - Number(b)
    );
    return sortedSections.map((s) => `${s}-0-0`);
  })();

  // 프리셋 공연장용: 실제 좌표 기반 seatId 목록 (모든 참가자, 여러 좌석 지원)
  const presetSelectedSeatIds: string[] = (() => {
    // 모든 유저가 failed이면, 존재하지 않는 섹션 ID를 하나 넣어서
    // 공연장 컴포넌트 내부 로직이 "선택된 섹션 없음"으로 판단하게 함 → 전체 회색 처리
    if (!hasAnyValidSeatSection) {
      return ["9999-0-0"];
    }

    const ids: string[] = [];

    users.forEach((u) => {
      if (!u.seatArea) return;

      // seatArea 예시: "1-24-38" 또는 "1-24-38,1-24-39"
      u.seatArea
        .split(/[,\\n]+/)
        .map((seat) => seat.trim())
        .filter(Boolean)
        .forEach((seat) => {
          const match = seat.match(/^(\d+)-(\d+)-(\d+)$/);
          if (!match) return;
          const [, section, row, col] = match;
          const seatId = convertSeatIdForVenue(hallId, section, row, col);
          if (seatId) {
            ids.push(seatId);
          }
        });
    });

    // seatArea 기반으로 하나도 만들어지지 않았다면, 기존 단일 좌석 로직을 fallback으로 사용
    if (ids.length === 0) {
      return users
        .filter(
          (u) =>
            u.seatSection &&
            u.seatSection !== "failed" &&
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
        .filter((id): id is string => id !== null);
    }

    return ids;
  })();

  const getSeatDetails = (user: UserRank): string[] => {
    // 1) 여러 좌석이 있는 경우 (예: "1-15-32,1-14-30")
    if (user.seatArea && user.seatArea.includes(",")) {
      return user.seatArea
        .split(/[,\\n]+/)
        .map((seat) => seat.trim())
        .filter(Boolean)
        .map((seat) => {
          const match = seat.match(/^(\d+)-(\d+)-(\d+)$/);
          if (match) {
            const [, section, row, col] = match;
            return `${section}구역-${row}열-${col}`;
          }
          return seat;
        });
    }

    // 2) 단일 좌석 정보가 명시된 경우
    if (
      user.seatSection &&
      user.seatSection !== "failed" &&
      user.seatRow !== undefined &&
      user.seatCol !== undefined
    ) {
      return [`${user.seatSection}구역-${user.seatRow}열-${user.seatCol}`];
    }

    // 3) seatArea만 있는 경우 (예: "1-15-32" 또는 "실패")
    if (user.seatArea) {
      return user.seatArea
        .split(/[,\\n]+/)
        .map((seat) => seat.trim())
        .filter(Boolean)
        .map((seat) => {
          const match = seat.match(/^(\d+)-(\d+)-(\d+)$/);
          if (match) {
            const [, section, row, col] = match;
            return `${section}구역-${row}열-${col}`;
          }
          // 실패 좌석은 '-'로 표시
          if (seat.toLowerCase() === "failed" || seat === "실패") {
            return "-";
          }
          return seat;
        });
    }

    return [];
  };

  // SVG 자동 크기 조정을 위한 ref
  const seatMapContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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
  }, [selectedUserId, hallId, tsxUrl]);

  // 섹션 호버 시 툴팁 표시
  useEffect(() => {
    const container = seatMapContainerRef.current;
    if (!container) return;

    // 툴팁 요소 생성 (없으면)
    if (!tooltipRef.current) {
      const tooltip = document.createElement("div");
      tooltip.style.position = "fixed";
      tooltip.style.pointerEvents = "none";
      tooltip.style.padding = "8px 12px";
      tooltip.style.background = "#ffffff";
      tooltip.style.color = "#333";
      tooltip.style.fontSize = "12px";
      tooltip.style.fontFamily =
        "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      tooltip.style.borderRadius = "6px";
      tooltip.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
      tooltip.style.border = "1px solid #e0e0e0";
      tooltip.style.zIndex = "9999";
      tooltip.style.maxWidth = "300px";
      tooltip.style.display = "none";
      tooltip.style.lineHeight = "1.5";
      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
    }

    const tooltip = tooltipRef.current;

    // 섹션 번호 추출 함수
    const extractSectionId = (element: Element | null): string | null => {
      if (!element) return null;

      // SmallVenue (샤롯데 씨어터): section 속성 (div 기반)
      // 프리셋 모드일 때는 section이 "0" 또는 "1"이지만, 실제로는 여러 섹션이 섞여있을 수 있음
      // seatid에서 섹션 정보 추출 시도
      const seatId = element.getAttribute("seatid");
      if (seatId && seatId.startsWith("small-")) {
        // small-${floor}-${displaySection}-${row}-${col} 형식
        const parts = seatId.split("-");
        if (parts.length >= 3) {
          const sectionFromSeatId = parts[2];
          // 프리셋 모드에서는 displaySection이 "0" 또는 "1"이지만,
          // 실제 유저의 seatSection과 매칭하기 위해 좌석의 실제 섹션 정보를 사용
          // title에서 섹션 정보 추출 시도
          const title = element.getAttribute("title") || "";
          const titleMatch = title.match(/(\d+)구역/);
          if (titleMatch) return titleMatch[1];
          // title이 없으면 seatid의 섹션 사용
          return sectionFromSeatId;
        }
      }

      // AI 공연장: section 속성 또는 data-section
      const sectionAttr =
        element.getAttribute("section") || element.getAttribute("data-section");
      if (sectionAttr) return sectionAttr;

      // 프리셋 공연장: data-id (올림픽홀, 인스파이어 아레나)
      const dataId = element.getAttribute("data-id");
      if (dataId && dataId !== "0") return dataId;

      // title에서 추출 시도
      const title = element.getAttribute("title") || "";
      const titleMatch = title.match(/(\d+)구역/);
      if (titleMatch) return titleMatch[1];

      return null;
    };

    // 해당 섹션을 선택한 유저들 찾기
    const getUsersInSection = (sectionId: string): UserRank[] => {
      return users.filter((u) => {
        if (!u.seatSection || u.seatSection === "failed") return false;
        const normalized = String(Number(u.seatSection));
        return normalized === sectionId || u.seatSection === sectionId;
      });
    };

    // 툴팁 내용 생성
    const createTooltipContent = (sectionId: string): string => {
      const sectionUsers = getUsersInSection(sectionId);
      if (sectionUsers.length === 0) return "";

      // 10명 이상이면 처음 10명만 표시하고 나머지는 "..."으로 표시
      const displayUsers =
        sectionUsers.length > 10 ? sectionUsers.slice(0, 10) : sectionUsers;
      const hasMore = sectionUsers.length > 10;

      const userLines = displayUsers
        .map((user) => {
          const seats: string[] = [];

          // 1) seatArea에 여러 좌석이 있는 경우 (예: "1-15-32,1-14-30")
          if (user.seatArea) {
            user.seatArea
              .split(/[,\\n]+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((seat) => {
                const match = seat.match(/^(\d+)-(\d+)-(\d+)$/);
                if (match) {
                  const [, sec, row, col] = match;
                  // 현재 섹션과 일치하는 좌석만 표시
                  if (String(Number(sec)) === sectionId) {
                    seats.push(`${sec}구역-${row}열-${col}`);
                  }
                }
              });
          }

          // 2) fallback: 단일 좌석 정보가 있는 경우
          if (
            seats.length === 0 &&
            user.seatSection &&
            user.seatSection !== "failed" &&
            user.seatRow !== undefined &&
            user.seatCol !== undefined &&
            String(Number(user.seatSection)) === sectionId
          ) {
            seats.push(
              `${user.seatSection}구역-${user.seatRow}열-${user.seatCol}`
            );
          }

          const seatText = seats.length > 0 ? seats.join(", ") : "";

          // 이름과 좌석 번호를 한 줄로 표시
          return `<span style="color: #7c3aed;">${user.nickname}</span>${
            seatText ? ` <span style="color: #acacac;">${seatText}</span>` : ""
          }`;
        })
        .join("<br/>");

      // 10명 이상인 경우 "..." 추가
      return hasMore
        ? `${userLines}<br/><span style="color: #acacac;">...</span>`
        : userLines;
    };

    // 마우스 이동 이벤트 핸들러
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) {
        tooltip.style.display = "none";
        return;
      }

      // polygon 또는 섹션 요소 찾기
      // SmallVenue는 div 기반이므로 [section] 속성을 가진 div도 찾아야 함
      const sectionElement =
        target.closest("polygon") ||
        target.closest("[section]") ||
        target.closest("[data-section]") ||
        target.closest("[data-id]") ||
        (target.hasAttribute("section") ? target : null) ||
        (target.hasAttribute("seatid") ? target : null);

      const sectionId = extractSectionId(sectionElement);
      if (!sectionId) {
        tooltip.style.display = "none";
        return;
      }

      const tooltipContent = createTooltipContent(sectionId);
      if (!tooltipContent) {
        tooltip.style.display = "none";
        return;
      }

      tooltip.innerHTML = tooltipContent;
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY - 10}px`;
      tooltip.style.display = "block";
    };

    const handleMouseLeave = () => {
      tooltip.style.display = "none";
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, [users, hallId]);

  // 좌석 배치도 렌더링
  const renderSeatMap = () => {
    // 1) tsxUrl이 있으면 TSX 기반 좌석 배치도 렌더링 (AI 공연장 + tsxUrl이 있는 프리셋 모두)
    const isValidTsxUrl =
      tsxUrl &&
      tsxUrl !== "default" &&
      tsxUrl !== null &&
      typeof tsxUrl === "string" &&
      tsxUrl.trim() !== "";

    const shouldRenderWithTsx = !!isValidTsxUrl;

    if (shouldRenderWithTsx) {
      // TSX 기반 좌석 배치도
      // - 정상 섹션이 하나라도 있으면 해당 섹션들만 컬러 유지
      // - 모든 유저가 실패(allFailed)면 전체 회색 처리 (selectedSeatIds 비워서 전달)
      const displaySeatIdsForTsx = allFailed ? [] : aiSelectedSeatIds;
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
              selectedSeatIds={displaySeatIdsForTsx}
              readOnly={true}
            />
          </div>
        </div>
      );
    }

    // 2) tsxUrl이 없고 hallId가 있는 프리셋 공연장인 경우: 프론트 내장 TSX 컴포넌트 사용
    if (hallId && !isValidTsxUrl) {
      // hallId 2: 샤롯데씨어터 (SmallVenue)
      // - selectedIds: "section-row-col" 형식의 좌석 ID 사용
      // - SmallVenue 내부에서 section/row/col 기반으로 매칭함
      if (hallId === 2) {
        return (
          <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
            <div
              ref={seatMapContainerRef}
              className="w-full h-full flex items-center justify-center"
            >
              <SmallVenue
                selectedIds={presetSelectedSeatIds}
                isPreset={true}
                readOnly={true}
              />
            </div>
          </div>
        );
      }

      // hallId 3: 올림픽홀 (MediumVenue) - 선택된 섹션만 원래 색상
      if (hallId === 3) {
        return (
          <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
            <div
              ref={seatMapContainerRef}
              className="w-full h-full flex items-center justify-center"
            >
              <MediumVenue
                selectedIds={presetSelectedSeatIds}
                onToggleSeat={undefined}
                readOnly={true}
              />
            </div>
          </div>
        );
      }

      // hallId 4: 인스파이어 아레나 (LargeVenue) - 선택된 섹션만 원래 색상
      if (hallId === 4) {
        return (
          <div className="w-full h-[400px] flex justify-center items-center bg-white rounded-lg p-4">
            <div
              ref={seatMapContainerRef}
              className="w-full h-full flex items-center justify-center"
            >
              <LargeVenue
                selectedIds={presetSelectedSeatIds}
                onToggleSeat={undefined}
                readOnly={true}
              />
            </div>
          </div>
        );
      }
    }

    // tsxUrl도 없고 프리셋 매핑도 없으면 좌석 배치도 표시 불가
    console.warn("[MatchDetailContent] 좌석 배치도를 렌더링할 수 없습니다.", {
      hallId,
      isAIGenerated,
      tsxUrl,
    });
    return null;
  };

  return (
    <div className="flex overflow-x-auto gap-6">
      {/* 좌측: 전체 등수 - 선택되지 않았을 때만 표시 */}
      {selectedUserId === null && (
        <div className="min-w-[224px] w-56 shrink-0 md:min-w-[256px] md:w-64 lg:min-w-[288px] lg:w-72">
          <h4 className="mb-4 text-base font-bold">경기 결과</h4>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-2">
            {users
              .slice()
              // 랭크 -1(실패한 유저)는 아래로 내리고, 나머지는 랭크 오름차순 정렬
              .sort((a, b) => {
                const aFailed = a.rank === -1;
                const bFailed = b.rank === -1;
                if (aFailed && !bFailed) return 1;
                if (!aFailed && bFailed) return -1;
                return a.rank - b.rank;
              })
              .map((user) => {
                const seatDetails = getSeatDetails(user);
                const resolvedProfileImage =
                  user.profileImageUrl ||
                  (user.id && user.id > 0
                    ? normalizeProfileImageUrl(null, user.id)
                    : null);
                return (
                  <div
                    key={user.id}
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
                    className={`group flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                      selectedUserId === user.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50"
                    }`}
                  >
                    {/* 등수 영역: 고정 가로폭을 가진 칼럼 */}
                    <div className="w-8 flex-shrink-0 text-left">
                      <span className="text-lg font-bold text-blue-600">
                        {user.rank === -1 ? "실패" : `${user.rank}등`}
                      </span>
                    </div>
                    <div className="ml-3 mr-3">
                      <UserAvatar
                        nickname={user.nickname}
                        profileImageUrl={resolvedProfileImage}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-neutral-700 group-hover:text-neutral-900">
                          {user.nickname}
                        </span>
                        {typeof user.rankAmongUsers === "number" &&
                          user.rankAmongUsers > 0 && (
                            <span className="font-semibold text-xs text-blue-600">
                              전체랭크 {user.rankAmongUsers}등
                            </span>
                          )}
                      </div>
                      {/* {user.metrics && (
                        <div className="mt-1 text-xs text-neutral-500">
                          총 소요 시간{" "}
                          {formatMsToClock(calculateTotalTime(user))}
                        </div>
                      )} */}
                      {seatDetails.length > 0 && (
                        <div className="mt-1 text-xs text-neutral-500 leading-4">
                          {seatDetails.map((detail, idx) => (
                            <div key={`${user.id}-seat-${idx}`}>{detail}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 오른쪽 화살표 아이콘 */}
                    <svg
                      className="h-5 w-5 flex-shrink-0 transition-colors text-white group-hover:text-neutral-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 우측: 구역 뷰 또는 통계 뷰 */}
      <div className="min-w-[320px] flex-1">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {selectedUserId === null ? (
            renderSeatMap()
          ) : (
            <div className="space-y-6">
              {/* 선택된 유저가 나인지 비교 */}
              {!isSoloMode ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded ${
                          selectedUser &&
                          (selectedUser.isCurrentUser || selectedUser.id === 0)
                            ? "bg-purple-400"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        {selectedUser?.nickname}
                      </span>
                    </div>
                    <button
                      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                      onClick={() => setSelectedUserId(null)}
                    >
                      돌아가기
                    </button>
                  </div>
                  {selectedUser && renderUserStats(selectedUser)}
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-purple-400" />
                    <span className="text-sm font-medium text-neutral-700">
                      {meUser.nickname}
                    </span>
                  </div>
                  {renderUserStats(meUser)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
