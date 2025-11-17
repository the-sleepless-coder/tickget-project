import {
  roomApi,
  ticketingApi,
  toJsonBlob,
  TICKETING_SERVER_BASE_URL,
} from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
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
  return { status: res.status, body };
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
