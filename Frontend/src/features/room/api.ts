import { roomApi, toJsonBlob } from "@shared/lib/http";
import { useAuthStore } from "@features/auth/store";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ExitRoomRequest,
  ExitRoomResponse,
  RoomDetailResponse,
  ProcessTsxResponse,
} from "./types";

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
      throw new Error("'UPLOADED'일 때는 썸네일 파일이 필요합니다.");
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

/**
 * Join a room.
 * POST /rooms/{roomId}/join
 */
export async function joinRoom(
  roomId: number,
  payload: JoinRoomRequest
): Promise<JoinRoomResponse> {
  const headers = useAuthStore.getState().getAuthHeaders();
  return roomApi.postJson<JoinRoomResponse>(`/rooms/${roomId}/join`, payload, {
    headers,
  });
}

/**
 * Exit a room.
 * DELETE /rooms/{roomId}/exit
 */
export async function exitRoom(
  roomId: number,
  payload: ExitRoomRequest
): Promise<ExitRoomResponse> {
  const headers = useAuthStore.getState().getAuthHeaders();
  return roomApi.delete<ExitRoomResponse>(`/rooms/${roomId}/exit`, payload, {
    headers,
  });
}

// Room detail: GET /rooms/{roomId}
export async function getRoomDetail(roomId: number) {
  return roomApi.get<RoomDetailResponse>(`/rooms/${roomId}`);
}

/**
 * AI Seatmap TSX generation
 * POST {VITE_API_ORIGIN||https://tickget.kr}/api/v1/dev/stmap/pipeline/process_tsx
 * Body (multipart/form-data):
 *  - file: File (e.g., images(1).png)
 *  - capacity: text (e.g., "1246")
 */
export async function processSeatmapTsx(
  file: File,
  capacity: number
): Promise<ProcessTsxResponse> {
  const origin = import.meta.env.VITE_API_ORIGIN ?? "https://tickget.kr";
  const url = `${origin}/api/v1/dev/stmap/pipeline/process_tsx`;

  const form = new FormData();
  form.append("file", file);
  form.append("capacity", String(capacity));

  // Build headers, excluding any content-type override for multipart
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const authHeaders = useAuthStore.getState().getAuthHeaders?.();
    if (authHeaders) {
      for (const [k, v] of Object.entries(authHeaders)) {
        if (k.toLowerCase() !== "content-type") {
          headers[k] = v as string;
        }
      }
    }
  } catch {
    // ignore
  }

  // Debug: log request summary (mask authorization)
  const maskedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) =>
      k.toLowerCase() === "authorization"
        ? [k, v ? `${String(v).slice(0, 8)}...` : ""]
        : [k, v]
    )
  );
  try {
    console.log("[processSeatmapTsx] Request", {
      url,
      headers: maskedHeaders,
      body: {
        fileName: file?.name,
        fileSize: file?.size,
        capacity,
      },
    });
  } catch {
    // ignore console issues
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });

  const text = await res.text();
  let parsed: ProcessTsxResponse | null = null;
  try {
    parsed = text ? (JSON.parse(text) as ProcessTsxResponse) : null;
  } catch {
    parsed = null;
  }

  try {
    console.log("[processSeatmapTsx] Response", {
      status: res.status,
      ok: res.ok,
      bodyPreview: text.slice(0, 300),
    });
  } catch {
    // ignore console issues
  }

  if (parsed) {
    return parsed;
  }
  return {
    ok: false,
    detail: `Unexpected response: ${res.status} ${res.statusText}`,
  };
}
