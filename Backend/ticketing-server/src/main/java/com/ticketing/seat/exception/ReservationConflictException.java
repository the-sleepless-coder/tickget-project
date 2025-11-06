package com.ticketing.seat.exception;

public class ReservationConflictException extends RuntimeException {
    public ReservationConflictException(Long matchId) {
        super("Reservation failed. One or more seats are already taken in match " + matchId + ".");
    }
}
