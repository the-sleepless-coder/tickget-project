import { ticketingApi } from "@shared/lib/http";
import type {
  SeatReservationRequest,
  SeatReservationResponse,
  SeatConfirmationRequest,
} from "./types";

export async function holdSeats(
  matchId: number,
  payload: SeatReservationRequest
) {
  // Backend expects matchId in path; ensure body also carries matchId if server uses it internally
  const body = { ...payload, matchId } as SeatReservationRequest & {
    matchId: number;
  };
  return ticketingApi.postJson<SeatReservationResponse>(
    `/matches/${matchId}/hold`,
    body
  );
}

export async function confirmSeats(
  matchId: number,
  payload: SeatConfirmationRequest
) {
  return ticketingApi.postJson<SeatReservationResponse>(
    `/matches/${matchId}/seats/confirm`,
    payload
  );
}

export async function health() {
  return ticketingApi.get<string>("/health");
}
