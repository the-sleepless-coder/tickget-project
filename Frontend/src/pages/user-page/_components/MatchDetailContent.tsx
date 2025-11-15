import { useState } from "react";

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
    captcha?: { durationMs?: number; wrongCount?: number };
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
}

export default function MatchDetailContent({
  mySeatArea,
  mySeatSection,
  users,
  totalTime,
  onUserClick,
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
  }: {
    title: string;
    timeText: string;
    timeDiff?: string;
    misclicksText: string;
    misclicksDiff?: string;
    extraText?: string;
    extraTextDiff?: string;
  }) => (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
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
            <span className="text-neutral-600">이선좌 :</span>
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
              <div className="text-sm font-medium text-purple-700">총 소요 시간</div>
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
            timeDiff={diffBooking?.reactionMs ? formatDiffMs(diffBooking.reactionMs) : undefined}
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
            timeDiff={diffCaptcha?.durationMs ? formatDiffMs(diffCaptcha.durationMs) : undefined}
            misclicksText={`재시도 ${captcha?.wrongCount ?? 0}번`}
            misclicksDiff={undefined}
            extraText={
              captcha?.backspaceCount !== undefined
                ? `백스페이스 ${captcha.backspaceCount}번`
                : undefined
            }
            extraTextDiff={
              diffCaptcha?.backspaceCount !== undefined
                ? formatDiffCount(diffCaptcha.backspaceCount)
                : undefined
            }
          />
          <StatCard
            title="좌석 선택"
            timeText={`${formatMsToClock(seat?.durationMs ?? 0)}`}
            timeDiff={diffSeat?.durationMs ? formatDiffMs(diffSeat.durationMs) : undefined}
            misclicksText={`${seat?.misclicks ?? 0}번`}
            misclicksDiff={
              diffSeat?.misclicks !== undefined
                ? formatDiffCount(diffSeat.misclicks)
                : undefined
            }
            extraText={`이선좌 ${seat?.duplicateSeat ?? 0}번`}
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

  const isSoloMode = users.length === 1;

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
