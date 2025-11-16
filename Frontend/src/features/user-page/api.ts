import { useAuthStore } from "@features/auth/store";
import type { MyPageStatsResponse, MatchDataResponse } from "./types";

/**
 * 마이페이지 통계 데이터 조회
 * @param pageId 페이지 번호 (1-based, 프론트엔드 기준)
 * @returns 마이페이지 통계 응답 데이터
 */
export async function getMyPageStats(
  pageId: number = 1
): Promise<MyPageStatsResponse> {
  const { accessToken } = useAuthStore.getState();

  // 백엔드는 0-based 페이지네이션 사용 (page=0이 1페이지)
  // 프론트엔드는 1-based이므로 변환 필요
  const backendPage = Math.max(0, pageId - 1);

  // 상대 경로 사용 (Vite 프록시를 통해 요청)
  const apiUrl = "/api/v1/dev/stats/mypage";
  const url = `${apiUrl}?page=${backendPage}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `마이페이지 통계 조회 실패: ${response.status} ${errorText}`
    );
  }

  return response.json();
}

/**
 * 경기 기록 데이터 조회
 * @param mode 필터 모드: "all" | "solo" | "multi"
 * @param page 페이지 번호 (0-based, 백엔드 기준)
 * @returns 경기 기록 응답 데이터 배열
 */
export async function getMatchHistory(
  mode: "all" | "solo" | "multi" = "all",
  page: number = 0
): Promise<MatchDataResponse[]> {
  const { accessToken } = useAuthStore.getState();

  // 상대 경로 사용 (Vite 프록시를 통해 요청)
  const apiUrl = "/api/v1/dev/stats/mypage/matchData";
  const url = `${apiUrl}?mode=${mode}&page=${page}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`경기 기록 조회 실패: ${response.status} ${errorText}`);
  }

  return response.json();
}
