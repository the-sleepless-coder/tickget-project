import { roomApi } from "@shared/lib/http";
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
 * Upload room thumbnail image.
 * POST /thumbnails (multipart/form-data: file)
 */
export async function uploadRoomThumbnail(
  file: File
): Promise<{ url: string }> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const form = new FormData();
  form.append("file", file);
  return roomApi.postFormData<{ url: string }>("/thumbnails", form, {
    headers,
  });
}

/**
 * Create a room.
 * - When thumbnailType is "PRESET" (or no file provided), sends JSON body.
 * - When thumbnailType is "UPLOADED", uploads thumbnail first, then sends JSON with returned URL.
 */
export async function createRoom(
  payload: CreateRoomRequest,
  thumbnailFile?: File
) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const profileImageUrl = useAuthStore.getState().profileImageUrl ?? null;

  const isUploaded: boolean = payload.thumbnailType === "UPLOADED";
  if (isUploaded) {
    if (!thumbnailFile) {
      throw new Error("'UPLOADED'일 때는 썸네일 파일이 필요합니다.");
    }
    // 1) Upload thumbnail
    const { url } = await uploadRoomThumbnail(thumbnailFile);
    // Build absolute S3 URL if server returned a MinIO key
    const absoluteUrl = /^https?:\/\//i.test(url)
      ? url
      : `https://s3.tickget.kr/${url}`;
    // 2) Create room with thumbnailValue set to uploaded URL
    const body: CreateRoomRequest = {
      ...payload,
      profileImageUrl,
      thumbnailValue: absoluteUrl,
    };
    return roomApi.postJson<CreateRoomResponse>("/rooms", body, { headers });
  }

  // PRESET일 때 JSON 요청 (또는 파일이 없을 때)
  return roomApi.postJson<CreateRoomResponse>(
    "/rooms",
    { ...payload, profileImageUrl },
    { headers }
  );
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
  const profileImageUrl = useAuthStore.getState().profileImageUrl ?? null;
  return roomApi.postJson<JoinRoomResponse>(
    `/rooms/${roomId}/join`,
    { ...payload, profileImageUrl },
    {
      headers,
    }
  );
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
  // Vite 프록시를 통해 요청: 상대 경로 사용
  // 개발 환경에서는 Vite 프록시가 /api를 https://tickget.kr로 프록시
  // 프로덕션에서는 VITE_API_ORIGIN이 설정되어 있으면 그 값을 사용
  const origin = import.meta.env.VITE_API_ORIGIN;
  const url = origin
    ? `${origin}/api/v1/dev/stmap/pipeline/process_tsx`
    : "/api/v1/dev/stmap/pipeline/process_tsx";

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

  // 503 Service Unavailable 오류 처리
  if (res.status === 503) {
    return {
      ok: false,
      detail: text.includes("no available server")
        ? "서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
        : `서버 오류 (503): ${text || res.statusText}`,
    };
  }

  // 500번대 서버 오류 처리
  if (res.status >= 500) {
    return {
      ok: false,
      detail: `서버 오류가 발생했습니다 (${res.status}). 잠시 후 다시 시도해주세요.`,
    };
  }

  if (parsed) {
    return parsed;
  }
  return {
    ok: false,
    detail: `예상치 못한 응답: ${res.status} ${res.statusText}`,
  };
}
