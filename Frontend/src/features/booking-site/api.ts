import { roomApi, toJsonBlob } from "@shared/lib/http";
import type {
  CreateRoomRequest,
  ExitRoomRequest,
  JoinRoomRequest,
  RoomDetailResponse,
  RoomResponse,
  Slice,
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
