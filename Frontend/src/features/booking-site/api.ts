import { roomApi, ticketingApi, toJsonBlob } from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
import type {
  CreateRoomRequest,
  ExitRoomRequest,
  JoinRoomRequest,
  RoomDetailResponse,
  RoomResponse,
  Slice,
  CaptchaRequestResponse,
} from "./types";

export async function getRooms(params?: { page?: number; size?: number }) {
  return roomApi.get<Slice<RoomResponse>>("/rooms", { params });
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
