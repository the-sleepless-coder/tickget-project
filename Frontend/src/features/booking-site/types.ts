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
  totalSeat?: number; // 총 좌석 수
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
  hallId: number;
  hallSize: HallSize;
  hallName: string;
  thumbnailType: ThumbnailType;
  thumbnailValue: string;
  totalSeat?: number; // 총 좌석 수
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

// Captcha
export interface CaptchaRequestResponse {
  image: string;
  id: string;
}

// Captcha Validate
export interface CaptchaValidateRequest {
  captchaId: string;
  input: string;
}

export interface CaptchaValidateResponse {
  // 응답 스펙 미정: 성공 시 2xx로 간주하고 본문은 사용하지 않음
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface CaptchaValidateResult {
  status: number;
  body: {
    message?: string;
    expireTime?: string;
    [key: string]: unknown;
  };
}

// ----- Queue (Ticketing) -----
export interface QueueEnqueueRequest {
  clickMiss?: number; // 기본값 0 (봇 등)
  duration?: number; // 걸린 시간(초)
}

export type PlayerType = "user" | "robot";
export type QueueStatus = "ENQUEUED" | "ALREADY_IN_QUEUE";

export interface QueueEnqueueResponse {
  eventId: string;
  matchId: string;
  playerType: PlayerType;
  playerId: string;
  status: QueueStatus;
  positionAhead: number;
  positionBehind: number;
  totalNum: number;
}

// ----- Seating (Ticketing) -----
export type SeatReservationStatus = "MY_RESERVED" | "TAKEN";

export interface SectionSeatStatusItem {
  seatId: string;
  grade: string; // e.g., "R석", "S석"
  status: SeatReservationStatus;
}

export interface SectionSeatsStatusResponse {
  sectionId: string;
  seats: SectionSeatStatusItem[];
}

// ----- Seat Hold (Ticketing) -----
export interface SeatHoldSeat {
  sectionId: number;
  row: number;
  col: number;
  grade: string;
}

export interface SeatHoldRequest {
  userId: number;
  seats: SeatHoldSeat[];
  totalSeats: number;
}

export interface SeatHoldItem {
  sectionId: string;
  seatId: string;
  grade: string;
}

export interface SeatHoldResponse {
  success: boolean;
  heldSeats: SeatHoldItem[];
  failedSeats: SeatHoldItem[];
}

export interface SeatHoldResult {
  status: number; // 200 | 409 등
  body: SeatHoldResponse;
}

// ----- Seat Cancel (Ticketing) -----
export interface SeatCancelResponse {
  success: boolean;
  message: string;
  matchId: number;
  userId: number;
  cancelledSeatCount: number;
}

export interface SeatCancelResult {
  status: number; // 200 | 404 | 409 | 500 등
  body: SeatCancelResponse;
}
