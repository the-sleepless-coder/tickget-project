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
import type { MatchHistory } from "../../pages/mypage/mockData";

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

  // 해당 유저의 데이터만 필터링하고 날짜순으로 정렬
  const userData = matchHistory
    .filter((match) => match.users?.some((user) => user.id === userId))
    .map((match) => {
      const myUser = match.users?.find((user) => user.id === userId);
      return {
        date: match.date,
        rank: myUser?.rank ?? 0,
        bookingClick: myUser?.metrics?.bookingClick?.reactionMs ?? 0,
        captcha: myUser?.metrics?.captcha?.durationMs ?? 0,
        seatSelection: myUser?.metrics?.seatSelection?.durationMs ?? 0,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 평균 등수 계산
  const averageRank =
    userData.length > 0
      ? (
          userData.reduce((sum, data) => sum + data.rank, 0) / userData.length
        ).toFixed(1)
      : "-";

  // 차트 데이터 포맷팅
  const chartData = userData.map((data) => ({
    date: data.date.replace(/-/g, "."),
    rank: data.rank,
    bookingClick: (data.bookingClick / 1000).toFixed(2),
    captcha: (data.captcha / 1000).toFixed(2),
    seatSelection: (data.seatSelection / 1000).toFixed(2),
  }));

  return (
    <div className="space-y-6">
      {/* 평균 등수 카드 */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">
          {userNickname}님의 평균 등수
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-purple-600">
            {averageRank}위
          </span>
          <span className="text-sm text-neutral-600">
            (총 {userData.length}회 참여)
          </span>
        </div>
      </div>

      {/* 등수 추이 차트 */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">등수 추이</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis reversed />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="rank"
              stroke="#9333ea"
              strokeWidth={2}
              name="등수"
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
              <Tooltip />
              <Bar
                dataKey="bookingClick"
                fill="#3b82f6"
                name="소요 시간 (초)"
              />
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
              <Tooltip />
              <Bar dataKey="captcha" fill="#10b981" name="소요 시간 (초)" />
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
              <Tooltip />
              <Bar
                dataKey="seatSelection"
                fill="#f59e0b"
                name="소요 시간 (초)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h3 className="text-lg font-bold text-neutral-900">상세 기록</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  등수
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  예매 클릭 (초)
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  보안 문자 (초)
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">
                  좌석 선정 (초)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {chartData.slice(0, visibleRows).map((data, index) => (
                <tr key={index} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm text-neutral-900">
                    {data.date}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-purple-600">
                    {data.rank}위
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700">
                    {data.bookingClick}초
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700">
                    {data.captcha}초
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700">
                    {data.seatSelection}초
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 더보기 버튼 */}
        {visibleRows < chartData.length && (
          <div className="flex justify-center border-t border-neutral-200 px-6 py-4">
            <button
              onClick={() =>
                setVisibleRows((prev) => Math.min(prev + 5, chartData.length))
              }
              className="rounded-md border border-neutral-300 bg-white px-6 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              더보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
