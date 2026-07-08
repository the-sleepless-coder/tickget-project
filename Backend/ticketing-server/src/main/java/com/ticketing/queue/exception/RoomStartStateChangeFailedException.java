package com.ticketing.queue.exception;

public class RoomStartStateChangeFailedException extends MatchStartFlowException {
    public RoomStartStateChangeFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
