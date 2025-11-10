import { useState } from "react";
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
import type { MatchHistory } from "../mockData";

interface UserStatsProps {
  userId: number;
  userNickname: string;
  matchHistory: MatchHistory[];
}

export default function UserStats({
  userId,
  userNickname,
  matchHistory,
}: UserStatsProps) {
  const [visibleRows, setVisibleRows] = useState(5);
  const [matchFilter, setMatchFilter] = useState<"all" | "match" | "solo">(
    "all"
  );

  const computeRankAmongUsers = (
    users?: Array<{ id: number; rank: number }>,
    targetUserId?: number
  ): number | undefined => {
    if (!users || users.length === 0 || targetUserId === undefined)
      return undefined;
    const sortedByRank = [...users].sort(
      (a, b) => (a.rank ?? 0) - (b.rank ?? 0)
    );
    const idx = sortedByRank.findIndex((u) => u.id === targetUserId);
    return idx >= 0 ? idx + 1 : undefined;
  };

  // 전체 참가자 수를 계산하는 함수
  const getTotalParticipants = (match: MatchHistory): number => {
    let humanParticipants = 0;
    let botParticipants = 0;

    // participants에서 참가인원 추출
    const participantsMatch = match.participants.match(/참가인원\s+(\d+)명/);
    if (participantsMatch) {
      humanParticipants = parseInt(participantsMatch[1], 10);
    }

    // tags에서 봇 인원 추출
    const botTag = match.tags?.find((tag: { label: string }) =>
      tag.label.includes("봇")
    );
    if (botTag) {
      const botMatch = botTag.label.match(/봇\s+(\d+)명/);
      if (botMatch) {
        botParticipants = parseInt(botMatch[1], 10);
      }
    }

    return humanParticipants + botParticipants;
  };

  // 해당 유저의 데이터만 필터링하고 날짜순으로 정렬
  const userData = matchHistory
    .filter((match) =>
      match.users?.some((user: { id: number }) => user.id === userId)
    )
    .map((match) => {
      const myUser = match.users?.find(
        (user: { id: number }) => user.id === userId
      );
      const totalParticipants = getTotalParticipants(match);
      const percentile =
        totalParticipants > 0
          ? ((myUser?.rank ?? 0) / totalParticipants) * 100
          : 0;

      // 솔로/대결 판단
      const participantsMatch = match.participants.match(/참가인원\s+(\d+)명/);
      const humanCount = participantsMatch
        ? parseInt(participantsMatch[1], 10)
        : 0;
      const matchType = humanCount === 1 ? "솔로" : "대결";

      const derivedRankAmongUsers =
        myUser?.rankAmongUsers ?? computeRankAmongUsers(match.users, userId);

      return {
        date: match.date,
        time: match.time,
        matchType,
        rank: myUser?.rank ?? 0,
        humanParticipants: humanCount,
        rankAmongBots: myUser?.rankAmongBots,
        rankAmongUsers: derivedRankAmongUsers,
        totalParticipants,
        percentile,
        bookingClick: myUser?.metrics?.bookingClick?.reactionMs ?? 0,
        captcha: myUser?.metrics?.captcha?.durationMs ?? 0,
        seatSelection: myUser?.metrics?.seatSelection?.durationMs ?? 0,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // 역순 정렬
    .slice(0, 20); // 최대 20개만

  // 평균 퍼센트 계산
  const averagePercentile =
    userData.length > 0
      ? (
          userData.reduce((sum, data) => sum + data.percentile, 0) /
          userData.length
        ).toFixed(2)
      : "-";

  // 상위/하위 텍스트 결정
  const percentileText =
    averagePercentile !== "-"
      ? parseFloat(averagePercentile) <= 50
        ? `상위 ${averagePercentile}%`
        : `하위 ${(100 - parseFloat(averagePercentile)).toFixed(2)}%`
      : "-";

  // 차트 데이터 포맷팅 (역순으로 정렬하여 최신부터 표시)
  const chartData = userData
    .slice()
    .reverse() // 차트는 오래된 것부터 표시
    .map((data, index) => ({
      matchNumber: userData.length - index, // 경기 번호 (최신 경기 = 큰 번호)
      date: data.date.replace(/-/g, "."),
      dateTime: `${data.date.replace(/-/g, ".")} ${data.time} [${data.matchType}]`,
      time: data.time,
      matchType: data.matchType,
      rank: data.rank,
      humanParticipants: data.humanParticipants,
      totalParticipants: data.totalParticipants,
      rankAmongBots: data.rankAmongBots,
      rankAmongUsers: data.rankAmongUsers,
      percentile: data.percentile.toFixed(2),
      bookingClick: (data.bookingClick / 1000).toFixed(2),
      captcha: (data.captcha / 1000).toFixed(2),
      seatSelection: (data.seatSelection / 1000).toFixed(2),
      totalTime: (
        (data.bookingClick + data.captcha + data.seatSelection) /
        1000
      ).toFixed(2),
    }));

  return (
    <div className="space-y-6">
      {/* 평균 성과 카드 */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">
          {userNickname}님의 평균 성과
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-purple-600">
              {percentileText}
            </span>
            <span className="text-sm text-neutral-600">
              (총 {userData.length}회 참여)
            </span>
          </div>
          {averagePercentile !== "-" && (
            <p className="text-sm text-neutral-500">
              전체 참가자 중 평균 {averagePercentile}% 위치
            </p>
          )}
        </div>
      </div>

      {/* 퍼센트 추이 차트 */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-900">성과 추이</h3>
          <p className="text-xs text-neutral-500">최근 20경기만 표시</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
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

      {/* 예매 성능 분석 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 예매 버튼 클릭 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            예매 버튼 클릭
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
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
              <Bar dataKey="bookingClick" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 보안 문자 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            보안 문자
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
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
              <Bar dataKey="captcha" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 좌석 선정 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-base font-bold text-neutral-900">
            좌석 선정
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
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
              <Bar dataKey="seatSelection" fill="#f59e0b" />
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
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  matchFilter === "all"
                    ? "bg-purple-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setMatchFilter("match")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  matchFilter === "match"
                    ? "bg-purple-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                대결
              </button>
              <button
                onClick={() => setMatchFilter("solo")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "12px" }}
                >
                  날짜/시간
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "16px" }}
                >
                  경기 정보
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "18px" }}
                >
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
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "19px" }}
                >
                  등수 정보
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "21px" }}
                >
                  예매 클릭 (초)
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "22px" }}
                >
                  보안 문자 (초)
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "24px" }}
                >
                  좌석 선정 (초)
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "31px" }}
                >
                  총 소요시간 (초)
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "40px" }}
                >
                  전체 등수
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "42px" }}
                >
                  전체 참가자
                </th>
                <th
                  className="px-2 py-3 text-left text-sm font-semibold text-neutral-700"
                  style={{ width: "44px" }}
                >
                  봇 중 등수
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {chartData
                .filter((data) => {
                  if (matchFilter === "all") return true;
                  if (matchFilter === "match") return data.matchType === "대결";
                  if (matchFilter === "solo") return data.matchType === "솔로";
                  return true;
                })
                .slice(0, visibleRows)
                .map((data, index) => (
                  <tr key={index} className="hover:bg-neutral-50">
                    <td
                      className="px-2 py-4 text-sm text-neutral-900"
                      style={{ width: "12px" }}
                    >
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
                    <td
                      className="px-2 py-4 text-sm text-neutral-900"
                      style={{ width: "16px" }}
                    >
                      {data.matchType}
                    </td>
                    <td
                      className="px-2 py-4 text-sm font-semibold text-purple-600"
                      style={{ width: "18px" }}
                    >
                      {data.percentile}%
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "19px" }}
                    >
                      {data.humanParticipants &&
                      data.humanParticipants > 1 &&
                      data.rankAmongUsers ? (
                        <div className="text-sm text-purple-600">
                          {data.rankAmongUsers}/{data.humanParticipants}등
                        </div>
                      ) : (
                        <div className="text-sm text-neutral-500">-</div>
                      )}
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "21px" }}
                    >
                      {data.bookingClick}초
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "22px" }}
                    >
                      {data.captcha}초
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "24px" }}
                    >
                      {data.seatSelection}초
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "31px" }}
                    >
                      {data.totalTime}초
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "40px" }}
                    >
                      {data.rank}/{data.totalParticipants}등
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "42px" }}
                    >
                      {data.totalParticipants}명
                    </td>
                    <td
                      className="px-2 py-4 text-sm text-neutral-700"
                      style={{ width: "44px" }}
                    >
                      {data.rankAmongBots ? `${data.rankAmongBots}등` : "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* 더보기 버튼 */}
        {(() => {
          const filteredData = chartData.filter((data) => {
            if (matchFilter === "all") return true;
            if (matchFilter === "match") return data.matchType === "대결";
            if (matchFilter === "solo") return data.matchType === "솔로";
            return true;
          });
          return visibleRows < filteredData.length ? (
            <div className="flex justify-center border-t border-neutral-200 px-6 py-4">
              <button
                onClick={() =>
                  setVisibleRows((prev) =>
                    Math.min(prev + 5, filteredData.length)
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-6 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                더보기
              </button>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
