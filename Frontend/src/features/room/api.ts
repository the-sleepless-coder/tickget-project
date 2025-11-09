import { roomApi, toJsonBlob } from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
import type { CreateRoomRequest, CreateRoomResponse } from "./types";

/**
 * Create a room.
 * - When thumbnailType is "PRESET" (or no file provided), sends JSON body.
 * - When thumbnailType is "UPLOADED", sends multipart (JSON + file).
 *   - The JSON part key is "request"
 *   - The file part key is "file"
 */
export async function createRoom(
  payload: CreateRoomRequest,
  thumbnailFile?: File
) {
  const headers = useAuthStore.getState().getAuthHeaders();

  const isUploaded: boolean = payload.thumbnailType === "UPLOADED";
  if (isUploaded) {
    if (!thumbnailFile) {
      throw new Error(
        "'UPLOADED'일 때는 썸네일 파일이 필요합니다."
      );
    }
    const form = new FormData();
    form.append("file", thumbnailFile);
    form.append("request", toJsonBlob(payload));
    return roomApi.postFormData<CreateRoomResponse>("/rooms", form, {
      headers,
    });
  }

  // PRESET일 때 JSON 요청 (또는 파일이 없을 때)
  return roomApi.postJson<CreateRoomResponse>("/rooms", payload, { headers });
}
