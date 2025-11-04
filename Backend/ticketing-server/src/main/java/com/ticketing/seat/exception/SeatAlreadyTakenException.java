package com.ticketing.seat.exception;

public class SeatAlreadyTakenException extends RuntimeException {
    public SeatAlreadyTakenException(String seatId) {
        super("Seat " + seatId + " is already reserved.");
    }
}
