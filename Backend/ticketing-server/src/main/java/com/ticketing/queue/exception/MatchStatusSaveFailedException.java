package com.ticketing.queue.exception;

public class MatchStatusSaveFailedException extends MatchStartFlowException {
    public MatchStatusSaveFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
