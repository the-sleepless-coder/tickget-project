export interface SeatReservationRequest {
  userId: number;
  seatIds: string[];
  sectionId: string;
  grade: string;
}

export interface ReservedSeatInfoDto {
  sectionId: string;
  seatId: string;
  grade: string;
  matchId: number;
}

export interface SeatReservationResponse {
  success: boolean;
  heldSeats?: ReservedSeatInfoDto[];
  failedSeats?: ReservedSeatInfoDto[];
  message?: string;
}

export interface SeatConfirmationRequest {
  userId: number;
  seatIds: string[];
}
