import { useEffect, useState } from "react";
import { getLiveWeeklyRanking } from "@features/stats/api";
import type { WeeklyRankingItem, WeeklyRankingResponse } from "@features/stats/types";

export default function WeeklyRankingPage() {
  const [data, setData] = useState<WeeklyRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchRanking = async () => {
      try {
        setLoading(true);
        const res = await getLiveWeeklyRanking(10);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.error("주간 랭킹 불러오기 실패:", e);
          }
          setError("주간 랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRanking();
    const intervalId = window.setInterval(fetchRanking, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const rankings: WeeklyRankingItem[] = data?.rankingData ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-900">
          {data?.weeklyInfo ? `${data.weeklyInfo} 주간 랭킹` : "주간 랭킹"}
        </h1>
        {/* <p className="mt-1 text-sm text-neutral-500">
          {data ? "이번주 실시간 랭킹입니다." : "주간 랭킹을 불러오는 중입니다."}
        </p> */}
        {data?.updatedTime && (
          <p className="mt-1 text-xs text-neutral-400">
            업데이트: {data.updatedTime} (실시간 갱신)
          </p>
        )}
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm text-neutral-500">
          불러오는 중...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && rankings.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm text-neutral-500">
          아직 집계된 랭킹이 없습니다.
        </div>
      )}

      {!loading && !error && rankings.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <ul className="divide-y divide-neutral-100">
            {rankings.map((item) => (
              <li
                key={item.userId}
                className="flex items-center gap-4 px-4 py-3 sm:px-6 sm:py-4"
              >
                <div className="flex w-10 justify-center">
                  <span
                    className={
                      item.rank === 1
                        ? "text-lg font-extrabold text-c-fuchsia-600"
                        : item.rank === 2
                        ? "text-lg font-extrabold text-c-fuchsia-300"
                        : item.rank === 3
                        ? "text-lg font-extrabold text-c-fuchsia-200"
                        : "text-base font-semibold text-neutral-700"
                    }
                  >
                    {item.rank}
                  </span>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.nickName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = "/profile.png";
                      }}
                    />
                  ) : (
                    <img
                      src="/profile.png"
                      alt={item.nickName}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-center sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {item.nickName}
                    </p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <span className="inline-flex items-baseline rounded-full bg-c-blue-100 px-3 py-1 text-xs font-extrabold text-c-blue-300">
                      {item.points.toLocaleString()}점
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


