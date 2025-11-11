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
 * POST https://tickget.kr/api/v1/dev/stmap/pipeline/process_tsx
 * Body: { file: string ($binary base64), capacity: number }
 */
export async function processSeatmapTsx(payload: {
  file: string;
  capacity: number;
}): Promise<ProcessTsxResponse> {
  const url = "https://tickget.kr/api/v1/dev/stmap/pipeline/process_tsx";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // Include auth header if available
  try {
    const authHeaders = useAuthStore.getState().getAuthHeaders?.();
    if (authHeaders) {
      for (const [k, v] of Object.entries(authHeaders)) {
        headers[k] = v as string;
      }
    }
  } catch {
    // ignore
  }

  // Debug: request log (do not dump the whole base64)
  const maskedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => {
      if (k.toLowerCase() === "authorization") {
        return [k, v ? `${v.slice(0, 8)}...` : ""];
      }
      return [k, v];
    })
  );
  const fileLen = payload.file?.length ?? 0;
  const filePreview = payload.file ? payload.file.slice(0, 24) : "";
  console.log("[process-tsx] Request", {
    url,
    headers: maskedHeaders,
    body: {
      capacity: payload.capacity,
      fileLength: fileLen,
      filePreview, // first 24 chars, base64
    },
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      credentials: "include",
    });

    const text = await res.text();
    let parsed: ProcessTsxResponse | null = null;
    try {
      parsed = text
        ? (JSON.parse(text) as ProcessTsxResponse)
        : ({} as unknown as ProcessTsxResponse);
    } catch {
      parsed = null;
    }

    console.log("[process-tsx] HTTP response", {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    });

    if (parsed) {
      if (parsed.ok === true) {
        console.log("[process-tsx] Success", {
          hallId: parsed.hallId,
          minioTsx: parsed.minio?.tsx?.url,
          minioMeta: parsed.minio?.meta?.url,
          warn: parsed.warn,
          raw: parsed,
        });
        return parsed;
      } else if (parsed.ok === false) {
        console.warn("[process-tsx] Fail", {
          detail: parsed.detail,
          raw: parsed,
        });
        return parsed;
      }
      // Unknown JSON shape
      console.warn("[process-tsx] Unexpected JSON shape", parsed);
      return {
        ok: false,
        detail: `Unexpected JSON response shape: ${text.slice(0, 200)}`,
      };
    }

    // Non-JSON response
    console.error("[process-tsx] Non-JSON response body", {
      status: res.status,
      statusText: res.statusText,
      bodyPreview: text.slice(0, 300),
    });
    return {
      ok: false,
      detail: `Unexpected response: ${res.status} ${res.statusText}`,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "";
    console.error("[process-tsx] Request error", {
      message,
      error: err,
    });
    return {
      ok: false,
      detail: `Network or client error: ${message || String(err)}`,
    };
  }
}
