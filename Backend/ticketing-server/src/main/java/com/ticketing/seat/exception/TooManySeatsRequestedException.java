package com.ticketing.seat.exception;

public class TooManySeatsRequestedException extends RuntimeException {
    public TooManySeatsRequestedException(int count) {
        super("Invalid number of seats requested: " + count + ". You can reserve up to 2 seats per request.");
    }
}
