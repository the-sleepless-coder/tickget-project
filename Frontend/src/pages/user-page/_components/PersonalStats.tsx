import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getMyPageStats, getRankingPercentile } from "@features/user-page/api";
import type {
  MyPageStatsResponse,
  RankingPercentileResponse,
} from "@features/user-page/types";

export default function PersonalStats() {
  const [matchFilter, setMatchFilter] = useState<"all" | "match" | "solo">(
    "all"
  );
  const [allStatsData, setAllStatsData] = useState<MyPageStatsResponse[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 랭킹/퍼센타일 통계 상태
  const [rankingStats, setRankingStats] =
    useState<RankingPercentileResponse | null>(null);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);

  // API 데이터 로드 (초기 로드)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        setAllStatsData([]);
        setCurrentPage(1);
        setHasMorePages(true);

        const data = await getMyPageStats(1);

        setAllStatsData([data]);
        // 다음 페이지가 있는지 확인 (specificsList가 비어있으면 더 이상 없음)
        setHasMorePages(data?.specificsList && data.specificsList.length > 0);
      } catch (err) {
        console.error("통계 데이터 로드 실패:", err);
        setError(
          err instanceof Error
            ? err.message
            : "데이터를 불러오는데 실패했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [matchFilter]);

  // 랭킹/퍼센타일 통계 로드 (마운트 시 1회)
  useEffect(() => {
    let cancelled = false;

    const fetchRankingStats = async () => {
      try {
        setRankingLoading(true);
        setRankingError(null);

        const data = await getRankingPercentile();
        if (!cancelled) {
          setRankingStats(data);
        }
      } catch (err) {
        console.error("랭킹 통계 로드 실패:", err);
        if (!cancelled) {
          setRankingError(
            err instanceof Error
              ? err.message
              : "랭킹 데이터를 불러오는데 실패했습니다."
          );
        }
      } finally {
        if (!cancelled) {
          setRankingLoading(false);
        }
      }
    };

    void fetchRankingStats();

    return () => {
      cancelled = true;
    };
  }, []);

  // 더보기 버튼 클릭 시 다음 페이지 데이터 로드
  const handleLoadMore = async () => {
    if (loadingMore || !hasMorePages) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getMyPageStats(nextPage);

      if (data?.specificsList && data.specificsList.length > 0) {
        setAllStatsData((prev) => [...prev, data]);
        setCurrentPage(nextPage);
        // 다음 페이지가 있는지 확인
        setHasMorePages(data.specificsList.length > 0);
      } else {
        setHasMorePages(false);
      }
    } catch (err) {
      console.error("통계 데이터 더 불러오기 실패:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // 모든 페이지의 데이터를 합쳐서 사용
  const statsData: MyPageStatsResponse | null =
    allStatsData.length > 0
      ? {
          userId: allStatsData[0].userId,
          clickStats: allStatsData[0].clickStats, // 첫 페이지의 클릭 통계 사용
          specificsList: allStatsData.flatMap(
            (data) => data.specificsList || []
          ),
        }
      : null;

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string): { date: string; time: string } => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return {
      date: `${year}.${month}.${day}`,
      time: `${hours}:${minutes}`,
    };
  };

  // 예매 버튼 클릭 그래프 데이터
  const queueClickChartData = (statsData?.clickStats?.queueClick ?? [])
    .map((item) => {
      const { date, time } = formatDate(item.date);
      return {
        date,
        time,
        clickTime: Math.max(0, item.clickTime),
        dateTime: `${date} ${time}`,
      };
    })
    .reverse();

  // 보안 문자 그래프 데이터
  const captchaClickChartData = (statsData?.clickStats?.catpchaClick ?? [])
    .map((item) => {
      const { date, time } = formatDate(item.date);
      return {
        date,
        time,
        selectTime: Math.max(0, item.selectTime),
        dateTime: `${date} ${time}`,
      };
    })
    .reverse();

  // 좌석 선택 그래프 데이터
  const seatReserveClickChartData = (
    statsData?.clickStats?.seatReserveClick ?? []
  )
    .map((item) => {
      const { date, time } = formatDate(item.date);
      return {
        date,
        time,
        selectTime: Math.max(0, item.selectTime),
        dateTime: `${date} ${time}`,
      };
    })
    .reverse();

  // 상세 기록 데이터 처리
  const specificsData = (statsData?.specificsList ?? [])
    .map((item) => {
      const { date, time } = formatDate(item.date);
      const gameType = item.gameType === "MULTI" ? "대결" : "솔로";
      const totalParticipants =
        (item.userTotCount ?? 0) + (item.playerTotCount ?? 0);
      const topPercentile =
        item.playerTotCount > 0
          ? ((item.totRank / item.playerTotCount) * 100).toFixed(2)
          : "0.00";

      return {
        date,
        time,
        dateTime: `${date} ${time}`,
        gameType,
        topPercentile,
        userRank: item.userRank,
        userTotCount: item.userTotCount,
        playerTotCount: item.playerTotCount,
        totRank: item.totRank,
        totalParticipants,
        queueClickTime: Math.max(0, item.queueClickTime).toFixed(2),
        captchaClickTime: Math.max(0, item.captchaClickTime).toFixed(2),
        seatClickTime: Math.max(0, item.seatClickTime).toFixed(2),
        totalDuration: Math.max(0, item.totalDuration).toFixed(2),
        timestamp: new Date(item.date).getTime(),
      };
    })
    // 최신 순 정렬 (가장 최근 경기가 위로 오도록)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  // 필터링된 상세 기록
  const filteredSpecificsData = specificsData.filter((item) => {
    if (matchFilter === "all") return true;
    if (matchFilter === "match") return item.gameType === "대결";
    if (matchFilter === "solo") return item.gameType === "솔로";
    return true;
  });

  // 디버깅: 데이터 확인
  useEffect(() => {}, [
    statsData,
    specificsData,
    filteredSpecificsData,
    matchFilter,
  ]);

  // 랭킹 API 기반 평균 퍼센타일 / 문구
  const avgPercentile =
    rankingStats && typeof rankingStats.avgPercentile === "number"
      ? rankingStats.avgPercentile
      : null;

  const formattedAvgPercentile =
    avgPercentile !== null ? avgPercentile.toFixed(2) : "-";

  // 상위/하위 텍스트 결정 (50% 기준)
  const percentileText =
    avgPercentile !== null ? `상위 ${avgPercentile.toFixed(2)}%` : "-";

  // 랭킹 API 기반 순위 차트 데이터 (최근 데이터가 위에서 아래로 오도록 정렬)
  const rankingChartData =
    rankingStats?.percentileData && rankingStats.percentileData.length > 0
      ? [...rankingStats.percentileData]
          .slice()
          .reverse() // 오래된 데이터부터 왼쪽에 표시
          .map((item, index) => ({
            matchNumber: index + 1,
            percentile: item.percentile,
            dateTime: item.dateInfo,
            points: item.points,
          }))
      : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-neutral-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-red-500">오류: {error}</div>
      </div>
    );
  }

  if (!statsData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-neutral-500">데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 평균 퍼센트 카드 (랭킹 API 기준) */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">
          {rankingStats?.seasonInfo
            ? `${rankingStats.seasonInfo} 기록 평균`
            : "기록 평균"}
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-purple-600">
              {percentileText}
            </span>
          </div>
          {formattedAvgPercentile !== "-" && (
            <p className="text-sm text-neutral-500">
              전체 참가자 중 {formattedAvgPercentile}%를 기록했습니다.
            </p>
          )}
          {rankingLoading && (
            <p className="text-xs text-neutral-400">
              기록 평균을 불러오는 중입니다.
            </p>
          )}
          {rankingError && (
            <p className="text-xs text-neutral-500">
              기록 평균을 보려면 더 많은 경기에 참여해보세요!
            </p>
          )}
        </div>
      </div>

      {/* 퍼센트 추이 차트 (랭킹 API 기준) */}
      {rankingChartData.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm focus:outline-none focus-visible:outline-none">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">
              나의 기록 그래프
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rankingChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="matchNumber"
                label={{ value: "", position: "insideBottom", offset: -5 }}
              />
              <YAxis />
              <Tooltip
                cursor={{ fill: "#F5EFFD" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const data = payload[0].payload as {
                    dateTime?: string;
                    percentile?: number;
                  };
                  const rawDateTime = data.dateTime ?? "";
                  const [datePart, timePart] = rawDateTime.split(" ");
                  const displayDate = datePart || "";
                  const displayTime = timePart || "";
                  const value = data.percentile ?? payload[0].value;
                  const numeric =
                    typeof value === "number"
                      ? value
                      : Number.parseFloat(String(value));

                  return (
                    <div className="rounded-lg border border-neutral-200 bg-white p-2 shadow-lg text-xs">
                      <p className="font-semibold text-neutral-900">
                        {displayDate}
                        {displayTime && ` (${displayTime})`}
                      </p>
                      <p className="mt-1 text-neutral-700">
                        경기 성과{" "}
                        {Number.isFinite(numeric)
                          ? `${numeric.toFixed(2)}%`
                          : "-"}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="percentile"
                stroke="#9333ea"
                strokeWidth={2}
                name="퍼센트(%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 예매 성능 분석 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 예매 버튼 클릭 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm focus:outline-none focus-visible:outline-none">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            예매 버튼 클릭
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={queueClickChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip
                cursor={{ fill: "#F5EFFD" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const data = payload[0].payload as {
                    date?: string;
                    time?: string;
                  };
                  const fullDate = data?.date ?? "";
                  const shortDate =
                    fullDate.length >= 3 ? fullDate.slice(2) : fullDate;
                  const time = data?.time ?? "";
                  const value = payload[0].value;
                  return (
                    <div className="rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                      <p className="font-semibold text-neutral-900">
                        {time ? `20${shortDate} (${time})` : shortDate}
                      </p>
                      <p className="text-neutral-600">
                        소요시간 :{" "}
                        {typeof value === "number" ? value.toFixed(2) : value}초
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="clickTime" fill="#F483F7" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 보안 문자 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm focus:outline-none focus-visible:outline-none">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            보안 문자
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={captchaClickChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip
                cursor={{ fill: "#F5EFFD" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const data = payload[0].payload as {
                    date?: string;
                    time?: string;
                  };
                  const fullDate = data?.date ?? "";
                  const shortDate =
                    fullDate.length >= 3 ? fullDate.slice(2) : fullDate;
                  const time = data?.time ?? "";
                  const value = payload[0].value;
                  return (
                    <div className="rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                      <p className="font-semibold text-neutral-900">
                        {time ? `20${shortDate} (${time})` : shortDate}
                      </p>
                      <p className="text-neutral-600">
                        소요시간 :{" "}
                        {typeof value === "number" ? value.toFixed(2) : value}초
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="selectTime" fill="#A634FB" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 좌석 선택 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm focus:outline-none focus-visible:outline-none">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            좌석 선택
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={seatReserveClickChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip
                cursor={{ fill: "#F5EFFD" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const data = payload[0].payload as {
                    date?: string;
                    time?: string;
                  };
                  const fullDate = data?.date ?? "";
                  const shortDate =
                    fullDate.length >= 3 ? fullDate.slice(2) : fullDate;
                  const time = data?.time ?? "";
                  const value = payload[0].value;
                  return (
                    <div className="rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                      <p className="font-semibold text-neutral-900">
                        {time ? `20${shortDate} (${time})` : shortDate}
                      </p>
                      <p className="text-neutral-600">
                        소요시간 :{" "}
                        {typeof value === "number" ? value.toFixed(2) : value}초
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="selectTime" fill="#5920D4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">상세 기록</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setMatchFilter("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  matchFilter === "all"
                    ? "bg-purple-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setMatchFilter("match")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  matchFilter === "match"
                    ? "bg-purple-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                대결
              </button>
              <button
                onClick={() => setMatchFilter("solo")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  matchFilter === "solo"
                    ? "bg-purple-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                솔로
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  경기 일시
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  경기 모드
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  유저 랭크
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  <span className="relative flex items-center gap-1">
                    토탈 랭크
                    <div className="group relative">
                      <span className="cursor-help text-neutral-400 hover:text-neutral-600">
                        (?)
                      </span>
                      <div className="absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 transform rounded-md bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block whitespace-nowrap">
                        봇 + 사용자 전체 기준
                        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-800"></div>
                      </div>
                    </div>
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  예매 클릭
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  보안 문자
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  좌석 선택
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  총 소요시간
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredSpecificsData.length > 0 ? (
                filteredSpecificsData.map((data, index) => (
                  <tr key={index} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm text-neutral-900">
                      <div className="flex flex-col">
                        <span className="font-extrabold">
                          {data.date
                            ? data.date.length >= 3
                              ? data.date.slice(2)
                              : data.date
                            : "-"}
                        </span>
                        <span className="text-neutral-500">
                          {data.time || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {data.gameType === "솔로" ? (
                        <span className="inline-block rounded-md bg-c-blue-100 px-2 py-1 text-xs font-medium text-c-blue-200">
                          솔로
                        </span>
                      ) : data.gameType === "대결" ? (
                        <span className="inline-block rounded-md bg-c-blue-200 px-2 py-1 text-xs font-medium text-white">
                          대결
                        </span>
                      ) : (
                        <span className="text-neutral-900">
                          {data.gameType}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {data.userRank === -1 ? (
                        <div className="text-sm text-red-500 font-extrabold">
                          실패
                        </div>
                      ) : data.userTotCount !== null &&
                        data.userTotCount > 0 &&
                        data.userRank !== null &&
                        data.userRank !== undefined ? (
                        <div className="text-sm text-green-600 font-extrabold">
                          {data.userRank}/{data.userTotCount}등
                        </div>
                      ) : (
                        <div className="text-sm text-neutral-500">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {data.totRank === -1 ? (
                        <div className="text-sm text-red-500 font-extrabold">
                          실패
                        </div>
                      ) : data.totalParticipants &&
                        data.totalParticipants > 0 &&
                        data.totRank !== null &&
                        data.totRank !== undefined ? (
                        <div className="text-sm text-green-600 font-extrabold">
                          {data.totRank}/{data.totalParticipants}등
                        </div>
                      ) : (
                        <div className="text-sm text-neutral-500">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-extrabold">
                      {data.queueClickTime}초
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-extrabold">
                      {data.captchaClickTime}초
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-extrabold">
                      {data.seatClickTime}초
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-extrabold">
                      {data.totalDuration}초
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-neutral-500"
                  >
                    표시할 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 더보기 버튼 */}
        {hasMorePages && (
          <div className="flex justify-center border-t border-neutral-200 px-6 py-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-lg border border-purple-500 bg-white px-6 py-2 text-sm font-medium text-purple-500 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:bg-purple-500 hover:text-white disabled:hover:bg-white disabled:hover:text-purple-500"
            >
              {loadingMore ? "로딩중" : "더보기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
