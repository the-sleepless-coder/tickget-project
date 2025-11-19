import { createHttpClient } from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
import type { WeeklyRankingResponse } from "./types";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";
const STATS_BASE_URL = `${API_ORIGIN}/api/v1/dev`;

const statsApi = createHttpClient(STATS_BASE_URL);

export async function getLiveWeeklyRanking(limit: number = 10) {
  const headers = useAuthStore.getState().getAuthHeaders();
  return statsApi.get<WeeklyRankingResponse>("/stats/matchstats/ranking/live", {
    params: { limit },
    headers,
  });
}
