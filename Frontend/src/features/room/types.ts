// Room creation - Types and Enums
// NOTE: These mirror backend expectations for the room-server (/rms)

export type RoomType = "SOLO" | "MULTI";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type ThumbnailType = "PRESET" | "UPLOADED";
export type HallType = "PRESET" | "AI_GENERATED";
export type HallSize = "SMALL" | "MEDIUM" | "LARGE";

export interface CreateRoomRequest {
  userId: number;
  username: string;
  profileImageUrl?: string | null;
  matchName: string;
  roomType: RoomType;
  hallId: number;
  hallType: HallType;
  hallName: string;
  difficulty: Difficulty;
  maxUserCount: number;
  totalSeat: number;
  botCount: number;
  reservationDay: string; // yyyy-MM-dd
  gameStartTime: string; // ISO string e.g., 2024-11-09T14:20:00
  thumbnailType: ThumbnailType;
  thumbnailValue?: string | null; // PRESET: "default_thumbnail", UPLOADED: server will set URL
  tsxUrl: string | null; // AI_GENERATED: TSX URL, PRESET: null
}

export interface CreateRoomResponse {
  roomId: number;
  roomType: string; // server may return values beyond our input union (e.g., "SOLO", "MULTI")
  hallId: number;
  hallSize: HallSize;
  hallName: string;
  hallType: HallType;
  matchId: number;
  totalSeat: number;
  botCount: number;
  maxBooking: number;
  subscriptionTopic: string; // e.g., "/topic/rooms/1"
  thumbnailType: ThumbnailType;
  thumbnailValue: string | null; // URL if UPLOADED
  tsxUrl: string | null; // "default" or actual URL
}

// Room join - Types
export interface JoinRoomRequest {
  userId: number;
  userName: string;
  profileImageUrl?: string | null;
}

export interface RoomMember {
  userId: number;
  username: string;
  enteredAt: number; // timestamp
  profileImageUrl?: string | null;
}

export interface JoinRoomResponse {
  roomId: number;
  currentUserCount: number;
  roomMembers: RoomMember[];
  roomStatus: string; // e.g., "WAITING"
  subscriptionTopic: string; // e.g., "/topic/rooms/1"
  totalSeat?: number; // 총 좌석 수
}

// Room exit - Types
export interface ExitRoomRequest {
  userId: number;
  userName: string;
}

export interface ExitRoomResponse {
  roomId: number;
  leftUserCount: number;
  roomStatus: string; // e.g., "WAITING" or "CLOSED"
  unsubscriptionTopic: string; // e.g., "/topic/rooms/1"
}

// Room detail types
export interface RoomDetailResponse {
  roomId: number;
  roomName: string;
  botCount: number;
  maxUserCount: number;
  currentUserCount: number;
  hostId: number;
  roomMembers: RoomMember[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | string;
  roomType: string;
  status: string;
  startTime: string; // ISO string
  hallId: number;
  hallSize: HallSize;
  hallName: string;
  hallType?: HallType; // "PRESET" | "AI_GENERATED"
  tsxUrl: string | null; // AI 생성된 방의 경우 TSX URL
  thumbnailType: ThumbnailType;
  thumbnailValue: string | null;
  totalSeat?: number; // 총 좌석 수
}

// AI Seatmap TSX generation - Types
export interface ProcessTsxSuccessResponse {
  ok: true;
  hallId: number;
  minio: {
    tsx: { bucket: string; key: string; url: string };
    meta: { bucket: string; key: string; url: string };
  };
  local: {
    tsx: { path: string; saved: boolean };
    meta: { path: string; saved: boolean };
  };
  warn?: string[];
}

export interface ProcessTsxFailResponse {
  ok: false;
  detail: string;
}

export type ProcessTsxResponse =
  | ProcessTsxSuccessResponse
  | ProcessTsxFailResponse;
