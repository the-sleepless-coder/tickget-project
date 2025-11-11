import { TICKETING_SERVER_BASE_URL } from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
import type { SeatCancelResult, SeatCancelResponse } from "./types";

// DELETE /tkt/ticketing/matches/{matchId}/seats/cancel?userId={userId}
// 200 OK, 404 Not Found, 409 Conflict, 500 Internal Server Error
export async function cancelSeats(
  matchId: string | number,
  userId: string | number
): Promise<SeatCancelResult> {
  const { getAuthHeaders } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    Accept: "application/json",
  };

  const base = TICKETING_SERVER_BASE_URL;
  const path = `ticketing/matches/${encodeURIComponent(String(matchId))}/seats/cancel`;
  let urlObj: URL;
  if (base.startsWith("/")) {
    const fullPath = base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    urlObj = new URL(fullPath, window.location.origin);
  } else {
    urlObj = new URL(path, base);
  }
  urlObj.searchParams.set("userId", String(userId));

  const res = await fetch(urlObj.toString(), {
    method: "DELETE",
    headers,
  });

  let body: SeatCancelResponse = {
    success: false,
    message: "",
    matchId: Number(matchId),
    userId: Number(userId),
    cancelledSeatCount: 0,
  };
  try {
    body = (await res.json()) as SeatCancelResponse;
  } catch {
    // 본문이 없거나 JSON 파싱 실패 시 기본값 유지
  }
  return { status: res.status, body };
}
