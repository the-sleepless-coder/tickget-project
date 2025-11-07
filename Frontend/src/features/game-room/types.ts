// TS shapes aligned with Backend room-server DTOs

export type RoomType = string; // e.g., "SOLO" | "VERSUS"
export type RoomStatus = string; // e.g., "WAITING" | "PLAYING"
export type HallSize = string; // e.g., "SMALL" | "MEDIUM" | "LARGE"
export type ThumbnailType = string; // e.g., "URL" | "PRESET"

export interface RoomResponse {
  roomId: number;
  roomName: string;
  botCount: number;
  maxUserCount: number;
  currentUserCount: number;
  difficulty: string;
  roomType: RoomType;
  status: RoomStatus;
  createdAt: string; // ISO string
  startTime: string; // ISO string
  hallSize: HallSize;
  hallName: string;
  thumbnailType: ThumbnailType;
  thumbnailValue: string;
}

export interface RoomDetailResponse {
  roomId: number;
  roomName: string;
  botCount: number;
  maxUserCount: number;
  currentUserCount: number;
  hostId: number;
  roomMembers: Array<{
    userId: number;
    username: string;
  }>;
  difficulty: string;
  roomType: RoomType;
  status: RoomStatus;
  startTime: string; // ISO string
  hallSize: HallSize;
  hallName: string;
  thumbnailType: ThumbnailType;
  thumbnailValue: string;
}

export interface CreateRoomRequest {
  userId: number;
  username: string;
  matchName: string;
  roomType: RoomType;
  hallId: number;
  hallType: string;
  difficulty: string;
  maxUserCount: number;
  botCount: number;
  totalSeat: number;
  reservationDay: string; // yyyy-MM-dd
  gameStartTime: string; // ISO string
  thumbnailType: ThumbnailType;
  thumbnailValue: string;
}

export interface JoinRoomRequest {
  userId: number;
  userName: string;
}

export interface ExitRoomRequest {
  userId: number;
  userName: string;
}

export type Slice<T> = {
  content: T[];
  number?: number;
  size?: number;
  last?: boolean;
  first?: boolean;
  empty?: boolean;
  numberOfElements?: number;
};
