import {
  roomApi,
  ticketingApi,
  toJsonBlob,
  TICKETING_SERVER_BASE_URL,
} from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
import { useMatchStore } from "./store";
import { ReserveMetricKeys } from "@shared/utils/reserveMetrics";
import type {
  CreateRoomRequest,
  ExitRoomRequest,
  JoinRoomRequest,
  RoomDetailResponse,
  RoomResponse,
  Slice,
  CaptchaRequestResponse,
  CaptchaValidateRequest,
  CaptchaValidateResponse,
  CaptchaValidateResult,
  QueueEnqueueRequest,
  QueueEnqueueResponse,
  SectionSeatsStatusResponse,
  SeatHoldRequest,
  SeatHoldResponse,
  SeatHoldResult,
  SeatCancelResult,
  SeatCancelResponse,
  SeatConfirmRequest,
  SeatConfirmResponse,
  SeatStatsFailedRequest,
  SeatStatsFailedResponse,
  SessionToastLLMRequest,
  SessionToastLLMResponse,
} from "./types";

export async function getRooms(params?: { page?: number; size?: number }) {
  const headers = useAuthStore.getState().getAuthHeaders();
  return roomApi.get<Slice<RoomResponse>>("/rooms", { params, headers });
}

export async function getRoom(roomId: number) {
  return roomApi.get<RoomDetailResponse>(`/rooms/${roomId}`);
}

export async function createRoom(
  payload: CreateRoomRequest,
  thumbnailFile?: File
) {
  if (!thumbnailFile) {
    // JSON-only request
    return roomApi.postJson<{ roomId: number }>("/rooms", payload);
  }

  // Multipart request: JSON + file
  const form = new FormData();
  form.append("file", thumbnailFile);
  // Some Spring configurations accept JSON part named 'request' or similar.
  // The backend here takes @RequestBody + @RequestPart("file"). Try 'request' & fallback 'createRoomRequest'.
  form.append("request", toJsonBlob(payload));
  return roomApi.postFormData<{ roomId: number }>("/rooms", form);
}

export async function joinRoom(roomId: number, payload: JoinRoomRequest) {
  return roomApi.postJson(`/rooms/${roomId}/join`, payload);
}

export async function exitRoom(roomId: number, payload: ExitRoomRequest) {
  return roomApi.delete(`/rooms/${roomId}/exit`, payload);
}

export async function health() {
  return roomApi.get<{ status: string; timestamp: string }>("/health");
}

// ----- Captcha -----
// 보안문자 이미지 요청 (모달 오픈 시 호출)
export async function requestCaptchaImage() {
  const { accessToken, refreshToken } = useAuthStore.getState();

  // 디버그 토큰 폴백 (스토어에 토큰이 없을 경우 사용)
  const DEBUG_ACCESS_TOKEN =
    "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIzNiIsImVtYWlsIjoidGVzdC1mMzQ4ZDdmOEB0aWNrZ2V0LnRlc3QiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzYyNjY1MjQ3LCJleHAiOjE3NjI2Njg4NDd9.pKQ79BuxJCAriD9wKJ2bR_HTdTuAAk7Y20L1Q5GIOaYAeOv5PPzpi6zI5ExYAUJaRmntrWsDmDHpDNDPaOaIrQ";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else headers.Authorization = `Bearer ${DEBUG_ACCESS_TOKEN}`;
  if (refreshToken) headers["X-Refresh-Token"] = refreshToken;

  // 표준 ticketingApi(BASE: .../tkt) 기준으로 상대 경로 호출
  return ticketingApi.postJson<CaptchaRequestResponse>(
    "ticketing/captcha/request",
    {},
    { headers }
  );
}

// 보안문자 정답 확인
export async function validateCaptcha(
  payload: CaptchaValidateRequest
): Promise<CaptchaValidateResult> {
  const { getAuthHeaders, userId } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
  if (userId != null) headers["userId"] = String(userId);

  const base = TICKETING_SERVER_BASE_URL;
  const path = "ticketing/captcha/validate";
  let url: string;
  if (base.startsWith("/")) {
    const fullPath = base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    url = new URL(fullPath, window.location.origin).toString();
  } else {
    url = new URL(path, base).toString();
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let body: CaptchaValidateResponse = {};
  try {
    body = (await res.json()) as CaptchaValidateResponse;
  } catch {
    // ignore non-json
  }
  return { status: res.status, body };
}

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

// ----- Queue (Ticketing) -----
export async function enqueueTicketingQueue(
  matchId: string | number,
  payload: QueueEnqueueRequest
): Promise<QueueEnqueueResponse> {
  const { getAuthHeaders, userId } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
  // 서버 명세: X-User-Id 사용
  if (userId != null) {
    headers["X-User-Id"] = String(userId);
    // 하위 호환(혹시 백엔드 일부가 userId 키를 참고하는 경우를 대비해 함께 전송)
    headers["userId"] = String(userId);
  }

  // POST /tkt/ticketing/queue/{matchId}
  const path = `ticketing/queue/${encodeURIComponent(String(matchId))}`;
  const body = {
    clickMiss: payload.clickMiss ?? 0,
    duration: payload.duration ?? 0,
  };
  return ticketingApi.postJson<QueueEnqueueResponse>(path, body, { headers });
}

// ----- Seating (Ticketing) -----
// GET /tkt/ticketing/matches/{matchId}/sections/{sectionId}/seats/status?userId={userId}
export async function getSectionSeatsStatus(
  matchId: string | number,
  sectionId: string | number,
  userId: string | number
) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const path = `ticketing/matches/${encodeURIComponent(String(matchId))}/sections/${encodeURIComponent(String(sectionId))}/seats/status`;
  return ticketingApi.get<SectionSeatsStatusResponse>(path, {
    params: { userId },
    headers,
  });
}

// POST /tkt/ticketing/matches/{matchId}/hold
// 200: { success: true, heldSeats: [...], failedSeats: [] }
// 409: { success: false, heldSeats: [], failedSeats: [...] }
export async function holdSeat(
  matchId: string | number,
  payload: SeatHoldRequest
): Promise<SeatHoldResult> {
  const { getAuthHeaders } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };

  const base = TICKETING_SERVER_BASE_URL;
  const path = `ticketing/matches/${encodeURIComponent(String(matchId))}/hold`;
  let url: string;
  if (base.startsWith("/")) {
    const fullPath = base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    url = new URL(fullPath, window.location.origin).toString();
  } else {
    url = new URL(path, base).toString();
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  let body: SeatHoldResponse = {
    success: false,
    heldSeats: [],
    failedSeats: [],
  };
  try {
    body = (await res.json()) as SeatHoldResponse;
  } catch {
    // 본문이 없거나 JSON 파싱 실패 시 기본값 유지
  }
  return { status: res.status, body };
}

// POST /tkt/ticketing/matches/{matchId}/seats/confirm
export async function confirmSeat(
  matchId: string | number,
  payload: SeatConfirmRequest
): Promise<{ status: number; body: SeatConfirmResponse }> {
  const { getAuthHeaders } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };

  const base = TICKETING_SERVER_BASE_URL;
  const path = `ticketing/matches/${encodeURIComponent(String(matchId))}/seats/confirm`;
  let url: string;
  if (base.startsWith("/")) {
    const fullPath = base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    url = new URL(fullPath, window.location.origin).toString();
  } else {
    url = new URL(path, base).toString();
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  let body: SeatConfirmResponse = {
    success: false,
    message: "",
    userRank: 0,
    confirmedSeats: [],
    matchId: Number(matchId),
    userId: Number(payload.userId),
    status: null,
  };
  try {
    body = (await res.json()) as SeatConfirmResponse;
  } catch {
    // 본문이 없거나 JSON 파싱 실패 시 기본값 유지
  }
  // 성공적으로 좌석 확정이 이루어진 경우 성공 플래그 저장
  try {
    const userId = payload.userId;
    const resolvedMatchId = body.matchId ?? matchId;
    if (userId != null && resolvedMatchId != null && body.success) {
      const matchIdNum = Number(resolvedMatchId);
      if (!Number.isNaN(matchIdNum)) {
        const key = `reserve.seatSuccess:${matchIdNum}:${userId}`;
        sessionStorage.setItem(key, "true");
      }
    }
  } catch {
    // sessionStorage 접근 실패는 무시
  }
  return { status: res.status, body };
}

// ----- Seat Metrics 공통 수집 -----
// sessionStorage에 저장된 값을 기반으로 SeatConfirmRequest/SeatStatsFailedRequest 페이로드를 생성한다.
export function buildSeatMetricsPayload(userId: number): SeatConfirmRequest {
  const getMetric = (key: string, defaultValue: number = 0): number => {
    const value = sessionStorage.getItem(key);
    // 저장되지 않은 값은 -1로 표시 (미측정)
    if (value == null) return -1;
    const num = Number(value);
    // 값이 저장돼 있지만 숫자가 아니면 기본값(대부분 0) 사용
    return Number.isNaN(num) ? defaultValue : num;
  };

  // dateSelectTime: 예매 버튼 클릭 반응 시간 (rtSec)
  const dateSelectTime = getMetric(ReserveMetricKeys.rtSec, 0);
  // dateMissCount: 예매 버튼 클릭 전 클릭 실수 (nrClicks)
  const dateMissCount = getMetric(ReserveMetricKeys.nrClicks, 0);
  const seccodeSelectTime = getMetric(ReserveMetricKeys.captchaDurationSec, 0);
  const seccodeBackspaceCount = getMetric(ReserveMetricKeys.capBackspaces, 0);
  const seccodeTryCount = getMetric(ReserveMetricKeys.capWrong, 0);
  const seatSelectTime = getMetric(ReserveMetricKeys.capToCompleteSec, 0);
  const seatSelectTryCount = getMetric("reserve.seatTakenCount", 0);
  const seatSelectClickMissCount = getMetric("reserve.seatClickMiss", 0);

  return {
    userId,
    dateSelectTime,
    dateMissCount,
    seccodeSelectTime,
    seccodeBackspaceCount,
    seccodeTryCount,
    seatSelectTime,
    seatSelectTryCount,
    seatSelectClickMissCount,
  };
}

// ----- Seat Stats Failed (Ticketing) -----
// POST /api/v1/dev/tkt/ticketing/matches/{matchId}/stats/failed
export async function sendSeatStatsFailed(
  matchId: string | number,
  payload: SeatStatsFailedRequest
): Promise<SeatStatsFailedResponse> {
  const { getAuthHeaders } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };

  // base: /api/v1/dev/tkt
  // path: ticketing/matches/{matchId}/stats/failed
  const path = `ticketing/matches/${encodeURIComponent(
    String(matchId)
  )}/stats/failed`;

  if (import.meta.env.DEV) {
    console.log("[seat-stats-failed] API 요청:", {
      matchId,
      path,
      payload,
    });
  }

  const res = await ticketingApi.postJson<SeatStatsFailedResponse>(
    path,
    payload,
    {
      headers,
    }
  );

  if (import.meta.env.DEV) {
    console.log("[seat-stats-failed] API 응답:", res);
  }

  // 실패 통계 전송 플래그 저장 (중복 전송 방지용)
  try {
    const userId =
      payload.userId ?? useAuthStore.getState().userId ?? undefined;
    if (userId != null) {
      const key = `reserve.seatFailed:${Number(matchId)}:${Number(userId)}`;
      sessionStorage.setItem(key, "true");
    }
  } catch {
    // sessionStorage 접근 실패는 무시
  }

  return res;
}

/**
 * 현재(또는 지정된) matchId/userId 기준으로 SeatStatsFailed를 한 번만 전송하는 헬퍼.
 * - 이미 성공(SeatConfirm) 또는 실패 통계가 전송된 경우 재전송하지 않음.
 * - matchIdOverride가 없으면 MatchStore에 저장된 matchId를 사용.
 */
export async function sendSeatStatsFailedForMatch(
  matchIdOverride?: string | number | null,
  opts?: { trigger?: string }
): Promise<SeatStatsFailedResponse | null> {
  const { trigger } = opts ?? {};
  const authState = useAuthStore.getState();
  const userId = authState.userId;

  if (userId == null) {
    if (import.meta.env.DEV) {
      console.warn(
        "[seat-stats-failed] userId가 없어 실패 통계를 전송하지 않습니다.",
        { trigger }
      );
    }
    return null;
  }

  const rawMatchId =
    matchIdOverride != null
      ? matchIdOverride
      : useMatchStore.getState().matchId;

  if (rawMatchId == null) {
    if (import.meta.env.DEV) {
      console.warn(
        "[seat-stats-failed] matchId가 없어 실패 통계를 전송하지 않습니다.",
        { trigger }
      );
    }
    return null;
  }

  const matchIdNum = Number(rawMatchId);
  if (Number.isNaN(matchIdNum)) {
    if (import.meta.env.DEV) {
      console.warn(
        "[seat-stats-failed] matchId가 숫자가 아니어서 실패 통계를 전송하지 않습니다.",
        { rawMatchId, trigger }
      );
    }
    return null;
  }

  // 중복/상충 전송 방지 플래그 체크
  try {
    const successKey = `reserve.seatSuccess:${matchIdNum}:${userId}`;
    const failedKey = `reserve.seatFailed:${matchIdNum}:${userId}`;

    if (sessionStorage.getItem(successKey) === "true") {
      if (import.meta.env.DEV) {
        console.log(
          "[seat-stats-failed] 이미 성공 통계가 전송되어 실패 통계를 생략합니다.",
          { matchId: matchIdNum, userId, trigger }
        );
      }
      return null;
    }

    if (sessionStorage.getItem(failedKey) === "true") {
      if (import.meta.env.DEV) {
        console.log(
          "[seat-stats-failed] 이미 실패 통계가 전송되어 재전송을 생략합니다.",
          { matchId: matchIdNum, userId, trigger }
        );
      }
      return null;
    }
  } catch {
    // sessionStorage 접근 실패는 무시하고 계속 진행 (중복 전송 허용)
  }

  const payload = buildSeatMetricsPayload(userId);

  if (import.meta.env.DEV) {
    console.log("[seat-stats-failed] 전송 시도:", {
      matchId: matchIdNum,
      userId,
      trigger,
      payload,
    });
  }

  try {
    const res = await sendSeatStatsFailed(matchIdNum, payload);
    return res;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[seat-stats-failed] 전송 실패:", err, {
        matchId: matchIdNum,
        userId,
        trigger,
      });
    }
    return null;
  }
}

// ----- Session Toast LLM (AST) -----
// POST /api/v1/dev/ast/session-toast-llm
export async function getSessionToastLLM(
  payload: SessionToastLLMRequest
): Promise<SessionToastLLMResponse> {
  const { getAuthHeaders } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };

  const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";
  const API_PREFIX = "/api/v1/dev";
  const base = `${API_ORIGIN}${API_PREFIX}/ast`;
  const path = "session-toast-llm";
  let url: string;
  if (base.startsWith("/")) {
    const fullPath = base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    url = new URL(fullPath, window.location.origin).toString();
  } else {
    url = new URL(path, base).toString();
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Session Toast LLM API 실패: ${res.status} ${text}`);
  }

  return (await res.json()) as SessionToastLLMResponse;
}
