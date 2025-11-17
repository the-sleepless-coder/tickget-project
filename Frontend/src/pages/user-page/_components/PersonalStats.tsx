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
import { getMyPageStats } from "@features/user-page/api";
import type { MyPageStatsResponse } from "@features/user-page/types";

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
        clickTime: item.clickTime,
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
        selectTime: item.selectTime,
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
        selectTime: item.selectTime,
        dateTime: `${date} ${time}`,
      };
    })
    .reverse();

  // 상세 기록 데이터 처리
  const specificsData = (statsData?.specificsList ?? [])
    .map((item) => {
      const { date, time } = formatDate(item.date);
      const gameType = item.gameType === "MULTI" ? "대결" : "솔로";
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
        queueClickTime: item.queueClickTime.toFixed(2),
        captchaClickTime: item.captchaClickTime.toFixed(2),
        seatClickTime: item.seatClickTime.toFixed(2),
        totalDuration: item.totalDuration.toFixed(2),
      };
    })
    .reverse();

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

  // 평균 상위 비율 계산
  const averageTopPercentile =
    specificsData.length > 0
      ? (
          specificsData.reduce(
            (sum, item) => sum + parseFloat(item.topPercentile),
            0
          ) / specificsData.length
        ).toFixed(2)
      : "-";

  // 상위/하위 텍스트 결정 (50% 기준)
  const percentileText =
    averageTopPercentile !== "-"
      ? parseFloat(averageTopPercentile) <= 50
        ? `상위 ${averageTopPercentile}%`
        : `하위 ${(100 - parseFloat(averageTopPercentile)).toFixed(2)}%`
      : "-";

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
      {/* 평균 퍼센트 카드 */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">평균 성과</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-purple-600">
              {percentileText}
            </span>
            <span className="text-sm text-neutral-600">
              (총 {specificsData.length}회 참여)
            </span>
          </div>
          {averageTopPercentile !== "-" && (
            <p className="text-sm text-neutral-500">
              전체 참가자 중 평균 {averageTopPercentile}% 위치
            </p>
          )}
        </div>
      </div>

      {/* 퍼센트 추이 차트 */}
      {specificsData.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">성과 추이</h3>
            <p className="text-xs text-neutral-500">
              {specificsData.length}경기 표시
            </p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={specificsData.map((item, index) => ({
                matchNumber: specificsData.length - index,
                percentile: item.topPercentile,
                dateTime: item.dateTime,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="matchNumber"
                label={{ value: "경기", position: "insideBottom", offset: -5 }}
              />
              <YAxis />
              <Tooltip
                formatter={(
                  value: string,
                  _name: string,
                  props: { payload?: { dateTime?: string } }
                ) => [`${value}%`, props.payload?.dateTime || ""]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="percentile"
                stroke="#9333ea"
                strokeWidth={2}
                name="퍼센트"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 예매 성능 분석 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 예매 버튼 클릭 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            예매 버튼 클릭
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={queueClickChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip
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
                        {time ? `${shortDate}(${time})` : shortDate}
                      </p>
                      <p className="text-neutral-600">
                        소요시간 :{" "}
                        {typeof value === "number" ? value.toFixed(2) : value}초
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="clickTime" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 보안 문자 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            보안 문자
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={captchaClickChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip
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
                        {time ? `${shortDate}(${time})` : shortDate}
                      </p>
                      <p className="text-neutral-600">
                        소요시간 :{" "}
                        {typeof value === "number" ? value.toFixed(2) : value}초
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="selectTime" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 좌석 선택 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            좌석 선택
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={seatReserveClickChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip
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
                        {time ? `${shortDate}(${time})` : shortDate}
                      </p>
                      <p className="text-neutral-600">
                        소요시간 :{" "}
                        {typeof value === "number" ? value.toFixed(2) : value}초
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="selectTime" fill="#f59e0b" />
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
                  날짜/시간
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  경기 정보
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  <span className="relative flex items-center gap-1">
                    상위 비율
                    <div className="group relative">
                      <span className="cursor-help text-neutral-400 hover:text-neutral-600">
                        (?)
                      </span>
                      <div className="absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 transform rounded-md bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block whitespace-nowrap">
                        봇 + 사용자
                        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-800"></div>
                      </div>
                    </div>
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  등수 정보
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  예매 클릭 (초)
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  보안 문자 (초)
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  좌석 선택 (초)
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  총 소요시간 (초)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredSpecificsData.length > 0 ? (
                filteredSpecificsData.map((data, index) => (
                  <tr key={index} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm text-neutral-900">
                      <div className="flex flex-col">
                        <span>
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
                    <td className="px-6 py-4 text-sm text-neutral-900">
                      {data.gameType}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-purple-600">
                      {data.topPercentile}%
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {data.userTotCount !== null && data.userTotCount > 0 ? (
                        <div className="text-sm text-purple-600">
                          {data.userRank}/{data.userTotCount}등
                        </div>
                      ) : (
                        <div className="text-sm text-neutral-500">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {data.queueClickTime}초
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {data.captchaClickTime}초
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {data.seatClickTime}초
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
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
              {loadingMore ? "로딩 중..." : "더보기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
