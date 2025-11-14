import { useAuthStore } from "@features/auth/store";
import type { MyPageStatsResponse } from "./types";

/**
 * 마이페이지 통계 데이터 조회
 * @param pageId 페이지 번호
 * @returns 마이페이지 통계 응답 데이터
 */
export async function getMyPageStats(
  pageId: number = 1
): Promise<MyPageStatsResponse> {
  const { accessToken } = useAuthStore.getState();

  // 상대 경로 사용 (Vite 프록시를 통해 요청)
  const apiUrl = "/api/v1/dev/stats/mypage";
  const url = `${apiUrl}?page=${pageId}`;

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
